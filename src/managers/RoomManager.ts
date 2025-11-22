import RoomDefense from './DefenseManager';
import SpawnManager from './SpawnManager';
import BasePlanner, { computePlanChecksum } from '../modules/BasePlanner';
import { STRUCTURE_PRIORITY, PLAYER_USERNAME } from '../functions/utils/constants';
import { legacySpawnManager } from './room/utils';
import { calcPathLength, log, getReturnCode, calcPath } from '../functions/utils/globals';
import { determineBodyParts } from '../functions/creep/body';
import RoomPlanningVisualizer from '@modules/PlanVisualizer';
import * as FUNC from '@functions/index';

/** Manages all logic and operations for a single room. */
export default class RoomManager {
	private room: Room;
	private resources: RoomResources;
	private stats: RoomStats;
	private spawnManager: SpawnManager;
	private legacySpawnManager;
	private basePlanner: BasePlanner | null;
	private basePlan: PlanResult | null = null;
	private haulerPairs: { start: string, end: string, length: number }[] | null = null;
	public planVisualizer: RoomPlanningVisualizer | null = null;

	constructor(room: Room) {
		this.room = room;
		this.resources = this.scanResources();
		this.stats = this.gatherStats();
		this.spawnManager = new SpawnManager(room);
		this.legacySpawnManager = legacySpawnManager;
		this.basePlanner = null; // Only create when regeneration is needed
		this.planVisualizer = new RoomPlanningVisualizer(room);

		// Initialize all required room memory structures
		this.initializeMemory(); // Partial initialization - other settings added as needed
	}

	private initializeMemory() {
		if (!this.room.memory.data) this.room.memory.data = {};
		if (!this.room.memory.data.flags) this.room.memory.data.flags = {};
		if (!this.room.memory.data.indices) this.room.memory.data.indices = {};
		if (!this.room.memory.visuals)
			this.room.memory.visuals = {
				settings: {},
				basePlan: {
					visDistTrans: false,
					visBasePlan: false,
					visFloodFill: false,
					visPlanInfo: false,
					buildProgress: false
				},
				enableVisuals: false,
				redAlertOverlay: true,
				showPlanning: false
			};
		if (!this.room.memory.quotas) this.room.memory.quotas = {};
		if (!this.room.memory.objects) this.room.memory.objects = {};
		if (!this.room.memory.containers) this.room.memory.containers = {} as any;
		if (!this.room.memory.remoteRooms) this.room.memory.remoteRooms = {};
		if (!this.room.memory.settings)
			this.room.memory.settings = {
				basePlanning: { debug: false }
			} as any;
	}

	/** Main run method - called every tick */
	run(): void {

		const room = this.room;
		const roomMem = room.memory;
		roomMem.data ??= { flags: {}, indices: {} };
		const rmData = roomMem.data;

		if (!rmData.flags.initialized) {
			rmData.flags.advSpawnSystem = false;
			Memory.globalData.numColonies++;
			this.room.initRoom();
			rmData.flags.initialized ??= true;
			this.room.log(`First Time Room Initialization Complete!`);
		}

		if (room.controller && room.controller.level !== room.memory.data.controllerLevel) {
			const newLevel = room.controller.level;
			room.memory.data.controllerLevel = newLevel;
			this.stats.controllerLevel = newLevel;
			if (newLevel > room.memory.stats.controllerLevelReached)
				room.memory.stats.controllerLevelReached = newLevel;
		}

		if (room.memory?.visuals?.settings?.displayTowerRanges) FUNC.towerDamageOverlay(room);

		// Update resources and stats (throttled to every 10 ticks for performance)
		if (!rmData.lastResourceScan || Game.time - rmData.lastResourceScan >= 10) {
			this.resources = this.scanResources();
			this.stats = this.gatherStats();
			rmData.lastResourceScan = Game.time;
		}

		if (this.room.linkStorage && this.room.linkController && this.room.storage && !this.room.memory.quotas.conveyor)
			this.room.setQuota('conveyor', 1);

		// Assess need for bootstrapping mode
		this.updateBootstrapState();

		// Generate and cache base plan data
		const rcl = this.room.controller?.level ?? 0;
		const mem = this.room.memory;

		// Initialize visual settings if needed
		if (!rmData.flags.basePlanGenerated) {
			if (!this.room.memory.visuals.basePlan) this.room.memory.visuals.basePlan = {};
			this.room.memory.visuals.basePlan.visDistTrans ??= true;
			this.room.memory.visuals.basePlan.visFloodFill ??= true;
			this.room.memory.visuals.basePlan.visBasePlan ??= true;
			rmData.flags.basePlanGenerated = true;
		}

		let regenerate = false;

		// Determine whether to regenerate plan
		if (!mem.basePlan) regenerate = true;
		else if (mem.basePlan.rclAtGeneration !== rcl) regenerate = true;

		// If regeneration is required
		if (regenerate) {
			this.basePlanner = new BasePlanner(this.room);
			this.basePlan = this.basePlanner.createPlan();

			if (this.basePlan) {
				mem.basePlan = {
					lastGenerated: Game.time,
					rclAtGeneration: rcl,
					checksum: computePlanChecksum(this.basePlan),
					data: this.basePlan
				};
				console.log(`${this.room.link()} Base plan regenerated for RCL${rcl}`);
				// Otherwise, load cached plan (only assign from memory if not already loaded)
			}
		} else if (!this.basePlan && mem.basePlan) this.basePlan = mem.basePlan.data;

		// Process the plan if available
		if (this.basePlan) this.handleBasePlan(this.basePlan);

		if (this.room.controller!.level >= 4 && this.room.storage && this.room.energyCapacityAvailable >= 1200)
			this.scanAdjacentRooms();

		// Assess creep needs and submit spawn requests if using advanced spawn manager
		if (rmData.flags.advSpawnSystem === false && rmData.pendingSpawn && this.room.energyAvailable === this.room.energyCapacityAvailable) {
			const spawns = this.room.find(FIND_MY_SPAWNS, { filter: i => !i.spawning});
			for (const spawn of spawns) {
				const result = spawn.retryPending();
				if (result === OK) break;
			}
		}

		if (rmData.flags.advSpawnSystem) {
			this.spawnManager.run();
			this.assessCreepNeeds();
		} else {
			// Otherwise execute legacy spawn manager logic
			this.legacySpawnManager.run(this.room);
		}

		// Assign tasks to worker creeps
		this.assignCreepTasks();

		// Manage towers
		this.manageTowers();

		// Manage hauler container pairs
		if (this.shouldManageContainers()) this.manageContainers();

		// Manage links (if any)
		if (this.resources.links.length > 0) {
			this.manageLinks();
		}

		if (this.room.memory.visuals.enableVisuals)
			this.planVisualizer?.visualize(this.basePlan?.dtGrid, this.basePlan?.floodFill, this.basePlan?.placements);
	}

	/** Sets current bootstrapping state in room memory */
	private updateBootstrapState(): void {
		const level = this.stats.controllerLevel;
		const hasContainer = this.resources.containers.length > 0;
		const creepCount = this.room.find(FIND_MY_CREEPS).length;

		if (!this.room.memory.flags) this.room.memory.flags = {};
		this.room.memory.data.flags.bootstrappingMode = (level === 1 && creepCount < 5 && !hasContainer);
	}

	/** Scans the room for all relevant structures and resources */
	private scanResources(): RoomResources {
		return {
			sources: this.room.find(FIND_SOURCES),
			minerals: this.room.find(FIND_MINERALS),
			controller: this.room.controller,
			containers: this.room.find(FIND_STRUCTURES, {
				filter: (s) => s.structureType === STRUCTURE_CONTAINER
			}) as StructureContainer[],
			towers: this.room.find(FIND_MY_STRUCTURES, {
				filter: (s) => s.structureType === STRUCTURE_TOWER
			}) as StructureTower[],
			spawns: this.room.find(FIND_MY_STRUCTURES, {
				filter: (s) => s.structureType === STRUCTURE_SPAWN
			}) as StructureSpawn[],
			links: this.room.find(FIND_MY_STRUCTURES, {
				filter: (s) => s.structureType === STRUCTURE_LINK
			}) as StructureLink[],
			storage: this.room.storage,
			terminal: this.room.terminal
		};
	}

	/** Toggle base planner visuals */
	public togglePlanVisuals(): void {
		if (!this.room.memory.visuals.basePlan) this.room.memory.visuals.basePlan = {};
		const current = this.room.memory.visuals.basePlan.visBasePlan ?? false;
		this.room.memory.visuals.basePlan.visBasePlan = !current;
		this.room.memory.visuals.basePlan.visDistTrans = !current;
		this.room.memory.visuals.basePlan.visFloodFill = !current;
		console.log(`${this.room.link()} Base planner visuals ${!current ? 'enabled' : 'disabled'}`);
	}

	/** Force regeneration of base plan */
	public regenerateBasePlan(): void {
		delete this.room.memory.basePlan;
		console.log(`${this.room.link()} Base plan cleared - will regenerate next tick`);
	}

	/** Gathers current room statistics */
	private gatherStats(): RoomStats {
		const damagedStructures = this.room.find(FIND_STRUCTURES, {
			filter: (s) => s.hits < s.hitsMax && s.structureType !== STRUCTURE_WALL
		});

		// Prioritize critical structures
		damagedStructures.sort((a, b) => {
			const aPriority = this.getRepairPriority(a);
			const bPriority = this.getRepairPriority(b);
			return bPriority - aPriority;
		});

		return {
			controllerLevel: this.room.controller?.level || 0,
			energyAvailable: this.room.energyAvailable,
			energyCapacityAvailable: this.room.energyCapacityAvailable,
			constructionSites: this.room.find(FIND_CONSTRUCTION_SITES),
			damagedStructures
		};
	}

	/** Determines repair priority for structures */
	private getRepairPriority(structure: Structure): number {
		const hitsPercent = structure.hits / structure.hitsMax;

		// Critical structures get highest priority
		if (structure.structureType === STRUCTURE_TOWER) 			return 100 	- hitsPercent * 100;
		if (structure.structureType === STRUCTURE_SPAWN) 			return 95 	- hitsPercent * 100;
		if (structure.structureType === STRUCTURE_EXTENSION) 	return 80 	- hitsPercent * 100;
		if (structure.structureType === STRUCTURE_CONTAINER) {
			// Containers decay, only repair when below 50%
			return hitsPercent < 0.5 ? 70 - hitsPercent * 100 : 0;
		}
		if (structure.structureType === STRUCTURE_ROAD) {
			// Roads decay, only repair when below 50%
			return hitsPercent < 0.5 ? 60 - hitsPercent * 100 : 0;
		}

		return 50 - hitsPercent * 100;
	}

	/** Assesses which creeps are needed and submits spawn requests to SpawnManager */
	private assessCreepNeeds(): void {
		const roomName = this.room.name;
		const rMem = this.room.memory;

		// Throttle spawn assessments to prevent duplicate requests (every 5 ticks)
		if (rMem.data.lastSpawnAssessment && Game.time - rMem.data.lastSpawnAssessment < 5) {
			return;
		}
		rMem.data.lastSpawnAssessment = Game.time;

		// Pull creep role caps from room memory, or set to default value if none are set
		const harvesterTarget 			= _.get(rMem, ['quotas', 'harvesters'], 2);
		const fillerTarget 					= _.get(rMem, ['quotas', 'fillers'], 2);
		const upgraderTarget 				= _.get(rMem, ['quotas', 'upgraders'], 2);
		const builderTarget 				= _.get(rMem, ['quotas', 'builders'], 2);
		const repairerTarget 				= _.get(rMem, ['quotas', 'repairers'], 0);
		const reserverTarget 				= _.get(rMem, ['quotas', 'reservers'], 1);
		const haulerTarget 					= _.get(rMem, ['quotas', 'haulers'], 2);
		const defenderTarget				= _.get(rMem, ['quotas', 'defenders'], 2);
		const remoteharvesterTarget = _.get(rMem, ['quotas', 'remoteharvesters'], 2);

		// Pull current amount of creeps alive by RFQ (Role For Quota) - Single pass optimization
		const creepsByRole = _.groupBy(
			_.filter(Game.creeps, c => c.memory.home === roomName),
			c => c.memory.RFQ || c.memory.role
		);
		const harvesters = creepsByRole['harvester'] || [];
		const fillers = creepsByRole['filler'] || [];
		const upgraders = creepsByRole['upgrader'] || [];
		const builders = creepsByRole['builder'] || [];
		const repairers = creepsByRole['repairer'] || [];
		const reservers = creepsByRole['reserver'] || [];
		const defenders = creepsByRole['defender'] || [];
		const haulers = creepsByRole['hauler'] || [];
		const remoteharvesters = creepsByRole['remoteharvester'] || [];

		// Get current spawn queue to check pending spawns
		const queue = this.spawnManager.getQueue();
		const scheduled = this.spawnManager.getScheduledSpawns();

		// Count pending spawns by role (in queue + scheduled)
		const countPendingRole = (role: string): number => {
			const inQueue = queue.filter(req => req.role === role && req.roomName === roomName).length;
			const inScheduled = scheduled.filter(s => s.role === role).length;
			return inQueue + inScheduled;
		};

		// Calculate total (alive + pending) for each role
		const totalHarvesters = harvesters.length + countPendingRole('harvester');
		const totalFillers = fillers.length + countPendingRole('filler');
		const totalUpgraders = upgraders.length + countPendingRole('upgrader');
		const totalBuilders = builders.length + countPendingRole('builder');
		const totalRepairers = repairers.length + countPendingRole('repairer');
		const totalReservers = reservers.length + countPendingRole('reserver');
		const totalHaulers = haulers.length + countPendingRole('hauler');
		const totalRemoteHarvesters = remoteharvesters.length + countPendingRole('remoteharvester');

		const harvesters_fillers_haulers_satisfied = (
			totalHarvesters >= (rMem.objects?.sources?.length || 2) &&
			totalFillers >= fillerTarget &&
			totalHaulers >= haulerTarget
		);

		// Use energyCapacityAvailable unless we have no harvesters (emergency)
		let cap = this.stats.energyCapacityAvailable;
		if (harvesters.length === 0) cap = this.stats.energyAvailable;

		// Priority spawning logic - submit requests to SpawnManager
		if (!harvesters_fillers_haulers_satisfied) {
			// Request Harvesters first
			if (this.needMoreHarvesters() && totalHarvesters < (rMem.objects?.sources?.length || 2)) {
				const body = determineBodyParts('harvester', cap, this.room);
				if (body) {
					let nextHarvesterAssigned = rMem.data?.indices.nextHarvesterAssigned || 0;
					let sourceID: Id<Source> | undefined;
					let containerID: string | undefined;

					if (nextHarvesterAssigned === 0 && rMem.objects?.sources) {
						sourceID = rMem.objects.sources[0] as Id<Source>;
						containerID = rMem.containers?.sourceOne;
					} else if (rMem.objects?.sources) {
						sourceID = rMem.objects.sources[1] as Id<Source>;
						containerID = rMem.containers?.sourceTwo;
					}

					this.spawnManager.submitRequest({
						role: 'harvester',
						priority: 100,
						body: body,
						memory: {
							role: 'harvester',
							RFQ: 'harvester',
							home: roomName,
							room: roomName,
							working: false,
							disable: false,
							rally: 'none',
							source: sourceID,
							bucket: containerID
						},
						roomName: roomName,
						urgent: harvesters.length === 0
					});
				}
			}
			// Request Fillers
			else if (totalFillers < fillerTarget) {
				const body = determineBodyParts('filler', cap, this.room);
				if (body) {
					this.spawnManager.submitRequest({
						role: 'filler',
						priority: 95,
						body: body,
						memory: {
							role: 'filler',
							RFQ: 'filler',
							home: roomName,
							room: roomName,
							working: false,
							disable: false,
							rally: 'none'
						},
						roomName: roomName,
						urgent: false
					});
				}
			}
			// Request Haulers
			else if (this.resources.storage && totalHaulers < haulerTarget) {
				const body = determineBodyParts('hauler', cap, this.room);
				if (body) {
					this.spawnManager.submitRequest({
						role: 'hauler',
						priority: 90,
						body: body,
						memory: {
							role: 'hauler',
							RFQ: 'hauler',
							home: roomName,
							room: roomName,
							working: false,
							disable: false,
							rally: 'none'
						},
						roomName: roomName,
						urgent: false
					});
				}
			}
		} else {
			// Request other creep types if harvesters & fillers fulfilled
			// Request Upgraders
			if (totalUpgraders < upgraderTarget) {
				const body = determineBodyParts('upgrader', cap, this.room);
				if (body) {
					this.spawnManager.submitRequest({
						role: 'upgrader',
						priority: 70,
						body: body,
						memory: {
							role: 'upgrader',
							RFQ: 'upgrader',
							home: roomName,
							room: roomName,
							working: false,
							disable: false,
							rally: 'none'
						},
						roomName: roomName,
						urgent: false
					});
				}
			}
			// Request Builders
			else if (this.stats.constructionSites.length > 0 && totalBuilders < builderTarget) {
				const body = determineBodyParts('builder', cap, this.room);
				if (body) {
					this.spawnManager.submitRequest({
						role: 'builder',
						priority: 65,
						body: body,
						memory: {
							role: 'builder',
							RFQ: 'builder',
							home: roomName,
							room: roomName,
							working: false,
							disable: false,
							rally: 'none'
						},
						roomName: roomName,
						urgent: false
					});
				}
			}
			// Request Repairers
			else if (totalRepairers < repairerTarget) {
				const body = determineBodyParts('repairer', cap, this.room);
				if (body) {
					this.spawnManager.submitRequest({
						role: 'repairer',
						priority: 60,
						body: body,
						memory: {
							role: 'repairer',
							RFQ: 'repairer',
							home: roomName,
							room: roomName,
							working: false,
							disable: false,
							rally: 'none'
						},
						roomName: roomName,
						urgent: false
					});
				}
			}
			// Request Reservers
			else if (cap >= 800 && totalReservers < reserverTarget) {
				const body = determineBodyParts('reserver', cap, this.room);
				if (body) {
					this.spawnManager.submitRequest({
						role: 'reserver',
						priority: 55,
						body: body,
						memory: {
							role: 'reserver',
							RFQ: 'reserver',
							home: roomName,
							room: roomName,
							working: false,
							disable: false,
							rally: 'none'
						},
						roomName: roomName,
						urgent: false
					});
				}
			}
			// Remote/reserver logic: use cached adjacent room data to decide on reservers and remote harvesters
			try {
				const remoteRoomsMem = this.room.memory.remoteRooms || {};
				let totalRemoteSources = 0;
				const roomsNeedingReserver: string[] = [];

				// Build counts and determine rooms needing reservation
				for (const rName of Object.keys(remoteRoomsMem)) {
					const info = remoteRoomsMem[rName];
					if (!info) continue;
					const sources = info.sources || [];

					// If controlled by another player, skip remote harvesting/reserving
					if (info.controllerOwner && info.controllerOwner !== PLAYER_USERNAME) continue;

					totalRemoteSources += sources.length;

					const reservation = info.reservation;
					const reservedByUs = reservation && reservation.username === PLAYER_USERNAME;
					if (info.controllerId && (!reservedByUs || (reservation && reservation.ticksToEnd < 500))) {
						roomsNeedingReserver.push(rName);
					}
				}

				// Count pending role requests
				const pendingRemoteHarvesters = countPendingRole('remoteharvester');
				const totalRemoteHarvestersAll = remoteharvesters.length + pendingRemoteHarvesters;
				const pendingReservers = countPendingRole('reserver');
				const totalReserversAll = reservers.length + pendingReservers;

				// Request reservers for rooms that need one (one reserver per room)
				for (const rName of roomsNeedingReserver) {
					// Ensure we don't already have a reserver queued for this room
					const inQueueCount = queue.filter((q: any) => q.role === 'reserver' && q.roomName === roomName && q.memory?.targetRoom === rName).length;
					const inScheduledCount = scheduled.filter((s: any) => s.role === 'reserver' && s.memory?.targetRoom === rName).length;
					const aliveCount = _.filter(Game.creeps, (c) => (c.memory.role === 'reserver' || c.memory.RFQ === 'reserver') && c.memory.home === roomName && c.memory.targetRoom === rName).length;
					if (inQueueCount + inScheduledCount + aliveCount > 0) continue;

					const body = determineBodyParts('reserver', cap, this.room);
					if (body) {
						this.spawnManager.submitRequest({
							role: 'reserver',
							priority: 55,
							body,
							memory: {
								role: 'reserver',
								RFQ: 'reserver',
								home: roomName,
								room: roomName,
								targetRoom: rName,
								working: false,
								disable: false,
								rally: 'none'
							},
							roomName: roomName,
							urgent: false
						});
					}
				}

				// Request remote harvesters: simple policy — one harvester per remote source
				if (totalRemoteSources > 0 && totalRemoteHarvestersAll < totalRemoteSources) {
					const needed = Math.min(totalRemoteSources - totalRemoteHarvestersAll, remoteharvesterTarget || (totalRemoteSources - totalRemoteHarvestersAll));
					for (let i = 0; i < needed; i++) {
						const body = determineBodyParts('harvester', cap, this.room); // reuse harvester body; customize later if needed
						if (!body) break;
						this.spawnManager.submitRequest({
							role: 'remoteharvester',
							priority: 50,
							body,
							memory: {
								role: 'remoteharvester',
								RFQ: 'remoteharvester',
								home: roomName,
								room: roomName,
								working: false,
								disable: false,
								rally: 'none'
							},
							roomName: roomName,
							urgent: false
						});
					}
				}
			} catch (e) {
				console.log(`${this.room.link()} Remote spawn logic error: ${e}`);
			}
		}
	}

	/** Helper method to determine if more harvesters are needed (from main.ts logic) */
	private needMoreHarvesters(): boolean {
		const roomName = this.room.name;
		const harvesters = _.filter(Game.creeps, (c) => (c.memory.RFQ == 'harvester' || c.memory.role == 'harvester') && c.memory.home == roomName);

		const sources = this.resources.sources;
		let totalWorkParts = 0;

		for (const harvester of harvesters)
			totalWorkParts += harvester.body.filter(part => part.type === WORK).length;

		// Each source can support 5 WORK parts (generates 10 energy/tick), need at least that many
		const neededWorkParts = sources.length * 5;
		return totalWorkParts < neededWorkParts;
	}

	/** Assigns tasks to worker creeps based on room needs */
	private assignCreepTasks(): void {
		const creeps = this.room.find(FIND_MY_CREEPS);

		for (const creep of creeps) {
			const role = creep.memory.role;

			// Skip harvesters and haulers - they have specific jobs
			if (role === 'harvester' || role === 'hauler') continue;

			// For multi-purpose workers (builders, repairers, upgraders)
			if (role === 'builder' || role === 'repairer' || role === 'upgrader') {
				this.assignWorkerTask(creep);
			}
		}
	}

	/** Assigns dynamic tasks to worker creeps based on priorities */
	private assignWorkerTask(creep: Creep): void {
		// If creep is empty, it should withdraw energy
		if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
			creep.memory.task = 'withdraw';
			return;
		}

		// If creep is full, assign a task based on priorities
		if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
			// Priority 1: Spawn/Extension needs energy
			if (this.stats.energyAvailable < this.stats.energyCapacityAvailable) {
				creep.memory.task = 'haul';
				return;
			}

			// Priority 2: Towers need energy
			const lowTower = this.resources.towers.find(
				tower => tower.store.getFreeCapacity(RESOURCE_ENERGY) > 200
			);
			if (lowTower) {
				creep.memory.task = 'fillTower';
				return;
			}

			// Priority 3: Critical repairs needed
			if (this.stats.damagedStructures.length > 0) {
				const critical = this.stats.damagedStructures.find(
					s => s.hits < s.hitsMax * 0.3
				);
				if (critical) {
					creep.memory.task = 'repair';
					return;
				}
			}

			// Priority 4: Construction sites exist
			if (this.stats.constructionSites.length > 0) {
				creep.memory.task = 'build';
				return;
			}

			// Priority 5: General repairs
			if (this.stats.damagedStructures.length > 0) {
				creep.memory.task = 'repair';
				return;
			}

			// Priority 6: Upgrade controller
			creep.memory.task = 'upgrade';
		}
	}

	/** Manages tower operations (defense and repair) */
	private manageTowers(): void {
		for (const tower of this.resources.towers) RoomDefense(tower);
	}

	/** Manages link energy transfers */
	private manageLinks(): void {
		// Find source links (near sources) and sink links (near controller/storage)
		const sourceLinks: StructureLink[] = [];
		const sinkLinks: StructureLink[] = [];

		for (const link of this.resources.links) {
			const nearSource = this.resources.sources.some(
				source => link.pos.getRangeTo(source) <= 2
			);

			if (nearSource) sourceLinks.push(link);
			else sinkLinks.push(link);
		}

		// Transfer energy from full source links to empty sink links
		for (const sourceLink of sourceLinks) {
			if (sourceLink.store.getUsedCapacity(RESOURCE_ENERGY) > 700) {
				const emptySink = sinkLinks.find(
					link => link.store.getFreeCapacity(RESOURCE_ENERGY) > 400
				);
				if (emptySink) sourceLink.transferEnergy(emptySink);
			}
		}
	}

	/** Gets the current room resources (for external access) */
	getResources(): RoomResources {
		return this.resources;
	}

	/** Gets the current room stats (for external access) */
	getStats(): RoomStats {
		return this.stats;
	}

	/** Gets the SpawnManager instance (for external access) */
	getSpawnManager(): SpawnManager {
		return this.spawnManager;
	}

	/** Sets what tasks need to be prioritized based on new RCL */
	private setRclTasks(rcl: number): void {
		switch (rcl) {
			case 0:
				// For new room, set quotas for harvesters (they will build their own containers)
				// Then built, and focus energy into upgrader output
				log(`Setting creep role quotas for early, low-tech spawn system.`);
				this.room.setQuota('harvester', 4) // Ensures 80% utilization per source
				this.room.setQuota('hauler', 0);
				this.room.setQuota('builder', 1);
				this.room.setQuota('upgrader', 3);

				log(`Quotas: Harvesters (4)  Haulers (0)  Builders (1)  Upgraders (3)`);

				break;
			case 1:
				break;
			case 2:
				break;
			case 3:
				break;
			case 4:
				break;
			case 5:
				break;
			case 6:
				break;
			case 7:
				break;
			case 8:
				break;
			default:
				break;
		}
	}

	/** Sets allowed capabilities for manager daemon based upon RCL input */
	private enableCapabilities(rcl: number): void {
		switch (rcl) {
			case 0:
				break;
			case 1:
				break;
			case 2:
				break;
			case 3:
				break;
			case 4:
				break;
			case 5:
				break;
			case 6:
				break;
			case 7:
				break;
			case 8:
				break;
			default:
				break;
		}
	}

	/** Determine if there is a need to update or create new hauler route pair information. */
	private shouldManageContainers(): boolean {
		const cont = this.room.memory.containers || {};
		const ids = [
			cont.sourceOne || '',
			cont.sourceTwo || '',
			cont.prestorage || '',
			cont.controller || '',
			(this.room.storage && this.room.storage.id) || ''
		].join('|');

		// simple change-detection stored in memory
		if (this.room.memory.data._lastContainerHash !== ids) {
			this.room.memory.data._lastContainerHash = ids;
			return true;
		}
		return false;
	}

	/** Create/update hauler route pairs. */
	public manageContainers(): void {

		const pairArray: { start: string, end: string, length: number }[] = [];
		if (this.room.memory.containers.sourceOne && (this.room.memory.containers.prestorage || this.room.storage)) {
			const sourceOneContainer: StructureContainer = Game.getObjectById(this.room.memory.containers.sourceOne)!;
			let storageCont;
			if (this.room.storage)
				storageCont = this.room.storage;
			else if (this.room.prestorage)
				storageCont = this.room.prestorage;

			const pathLength = calcPathLength(sourceOneContainer.pos, storageCont.pos);
			const pair = { start: this.room.memory.containers.sourceOne, end: storageCont.id, length: pathLength };
			pairArray.push(pair);
		}
		if (this.room.memory.containers.sourceTwo && (this.room.memory.containers.prestorage || this.room.storage)) {
			const sourceTwoContainer: StructureContainer = Game.getObjectById(this.room.memory.containers.sourceTwo)!;
			let storageCont;
			if (this.room.storage)
				storageCont = this.room.storage;
			else if (this.room.prestorage)
				storageCont = this.room.prestorage;

			const pathLength = calcPathLength(sourceTwoContainer.pos, storageCont.pos);
			const pair = { start: this.room.memory.containers.sourceTwo, end: storageCont.id, length: pathLength };
			pairArray.push(pair);
		}
		if (this.room.storage && this.room.memory.containers.controller) {
			const controllerContainer: StructureContainer = Game.getObjectById(this.room.memory.containers.controller)!;
			const storage: StructureStorage = this.room.storage;
			const pathLength = calcPathLength(storage.pos, controllerContainer.pos);
			const pair = { start: storage.id, end: this.room.memory.containers.controller, length: pathLength };
			pairArray.push(pair);
		} else if (this.room.memory.containers.controller && this.room.memory.containers.prestorage) {
				const controllerContainer: StructureContainer = Game.getObjectById(this.room.memory.containers.controller)!;
				const prestorageContainer: StructureContainer = Game.getObjectById(this.room.memory.containers.prestorage)!;
				const pathLength = calcPathLength(prestorageContainer.pos, controllerContainer.pos);
				const pair = { start: this.room.memory.containers.prestorage, end: this.room.memory.containers.controller, length: pathLength };
				pairArray.push(pair);
		}

		if (this.room.memory.remoteRooms && Object.keys(this.room.memory.remoteRooms).length && this.room.storage) {
			const remoteRooms = this.room.memory.remoteRooms;
			for (const room in remoteRooms) {
				if (Game.rooms[room]) {
					Game.rooms[room].cacheObjects();
					if (Game.rooms[room].memory.containers) {
						if (Game.rooms[room].memory.containers.sourceOne) {
							const start = Game.rooms[room].containerOne.id;
							const end = this.room.storage?.id;
							const length = calcPathLength(Game.rooms[room].containerOne.pos, this.room.storage.pos);

							const pair = { start, end, length };
							pairArray.push(pair);
						}
						if (Game.rooms[room].memory.containers.sourceTwo) {
							const start = Game.rooms[room].containerTwo.id;
							const end = this.room.storage?.id;
							const length = calcPathLength(Game.rooms[room].containerTwo.pos, this.room.storage.pos);

							const pair = { start, end, length };
							pairArray.push(pair);
						}
					}
				}
			}
		}

		this.room.memory.data.haulerPairs = pairArray;
		this.haulerPairs = pairArray;
		this.room.setQuota('hauler', pairArray.length);
	}

	/**
 * Scan adjacent rooms (exits) for visible rooms, cache their objects
 * and request scouts for non-visible rooms (throttled).
 */
	private scanAdjacentRooms(): void {
		const roomName = this.room.name;
		const exits = Game.map.describeExits(roomName);
		if (!exits) return;

		const remoteRooms = this.room.memory.remoteRooms as any || {};
		const now = Game.time;

		for (const dir in exits) {
			const rName = (exits as any)[dir] as string;
			// Initialize memory entry if needed
			if (!remoteRooms[rName]) {
				remoteRooms[rName] = {
					lastScanned: 0,
					sources: [],
					controllerId: undefined,
					controllerOwner: undefined,
					reservation: null
				};
			}

			// Throttle scanning of each remote room
			if (now - (remoteRooms[rName].lastScanned || 0) < 50) continue;

			// If we have visibility:
			const remoteRoom = Game.rooms[rName];
			if (remoteRoom) {
				remoteRooms[rName].lastScanned = now;
				const sources = remoteRoom.find(FIND_SOURCES);
				remoteRooms[rName].sources = sources.map(s => s.id);
				remoteRooms[rName].controllerId = remoteRoom.controller?.id;
				remoteRooms[rName].controllerOwner = remoteRoom.controller?.owner?.username;
				remoteRooms[rName].reservation = remoteRoom.controller?.reservation ? {
					username: remoteRoom.controller!.reservation!.username,
					ticksToEnd: remoteRoom.controller!.reservation!.ticksToEnd
				} : null;
			} else {
				// No visibility - ensure we have a scout enqueued to get visibility
				// Attempt to create a small scout body (most rooms support a tiny scout)
				const body = determineBodyParts('scout', Math.min(200, this.stats.energyCapacityAvailable), this.room) || [MOVE];
				if (this.room.memory.data.flags.advSpawnSystem) {
					const alreadyPending = this.isScoutPendingFor(rName);
					if (!alreadyPending) {
						this.spawnManager.submitRequest({
							role: 'scout',
							priority: 110,
							body,
							memory: {
								role: 'scout',
								home: roomName,
								room: roomName,
								targetRoom: rName
							},
							roomName: roomName,
							urgent: false
						});
					}
				} else {
					let scouts: Creep[] = _.filter(Game.creeps, (creep) => creep.memory.role == 'scout' && creep.memory.home === this.room.name);
					if (scouts.length < remoteRooms.length) {
						const spawn: StructureSpawn | null = Game.getObjectById(this.room.memory.objects.spawns[0]);
						const result = spawn!.spawnScout('none', false, { targetRoom: rName } );
						console.log(`${this.room.link()}: Attempted to spawn scout: ${getReturnCode(result)}`)

						if (result === OK) {
							const numCreeps: number = Object.keys(Game.creeps).length;
							const name = Object.keys(Game.creeps)[Object.keys(Game.creeps).length - 1];
							this.room.memory.remoteRooms[rName].scoutAssigned = name;
						}
					}
				}
			}
		}
		this.room.memory.remoteRooms = remoteRooms;
	}

	/** Returns true if there is a pending or scheduled scout spawn targeting `roomName` */
	private isScoutPendingFor(targetRoom: string): boolean {
		const queue = this.spawnManager.getQueue();
		const scheduled = this.spawnManager.getScheduledSpawns();
		const inQueue = queue.some((req: any) => req.role === 'scout' && req.memory?.targetRoom === targetRoom);
		const inScheduled = scheduled.some((s: any) => s.role === 'scout' && s.memory?.targetRoom === targetRoom);
		return inQueue || inScheduled;
	}

	/** Process construction tasks as created by BasePlanner */
	private handleBasePlan(plan: PlanResult): void {
		const mem = this.room.memory;
		const rcl = this.stats.controllerLevel;
		const now = Game.time;
		const debugMode = this.room.memory.settings?.basePlanning?.debug || false;

		// Initialize or reset plan
		if (!mem.buildQueue || mem.buildQueue.activeRCL !== rcl) {
			const plannedForRCL = plan.rclSchedule[rcl] || [];

			mem.buildQueue = {
				plannedAt: now,
				lastBuiltTick: 0,
				index: 0,
				activeRCL: rcl,
				failedPlacements: []  // Track structures that failed to place
			};

			// Log RCL schedule contents for debugging
			if (plannedForRCL.length > 0) {
				const structureCounts: { [key: string]: number } = {};
				for (const p of plannedForRCL) {
					structureCounts[p.structure] = (structureCounts[p.structure] || 0) + 1;
				}
				const structureList = Object.entries(structureCounts)
					.map(([type, count]) => `${count}x ${type}`)
					.join(', ');
				console.log(`${this.room.link()} RCL${rcl} build schedule: ${structureList} (${plannedForRCL.length} total structures)`);
			} else {
				console.log(`${this.room.link()} WARNING: RCL${rcl} build schedule is empty!`);
			}
		}

		// Ensure buildQueue is defined before continuing
		if (!mem.buildQueue) return;

		// Early return: Skip expensive room.find() calls if we've completed all structures for current RCL
		const plannedForCurrentRCL = plan.rclSchedule[rcl] || [];
		if (mem.buildQueue.index >= plannedForCurrentRCL.length && (!mem.buildQueue.failedPlacements || mem.buildQueue.failedPlacements.length === 0)) {
			// All structures for this RCL are complete - no need to process build queue
			// RCL upgrades will reset the build queue when RCL changes
			return;
		}

		// Safety limit: 5 new sites per tick unless CPU is constrained
		const MAX_PER_TICK = (Game.cpu.bucket > 8000) ? 5 : 1;
		let created = 0;

		const existingSites = this.room.find(FIND_CONSTRUCTION_SITES);
		const existingStructs = this.room.find(FIND_STRUCTURES);
		const existingPositions = new Set(
			[
				...existingStructs.map(s => `${s.pos.x},${s.pos.y},${s.structureType}`),
				...existingSites.map(s => `${s.pos.x},${s.pos.y},${s.structureType}`)
			]
		);

		const plannedForRCL = plan.rclSchedule[rcl] || [];
		const queueStart = mem.buildQueue.index;
		const remaining = plannedForRCL
			.slice(queueStart)
			.sort((a, b) => {
				const pa = STRUCTURE_PRIORITY[a.structure as BuildableStructureConstant] ?? 99;
				const pb = STRUCTURE_PRIORITY[b.structure as BuildableStructureConstant] ?? 99;
				return pa - pb;
			});

		// Track placements and errors for batch logging
		const placedStructures: string[] = [];
		const placementErrors: Array<{structure: string, pos: {x: number, y: number}, error: string}> = [];

		for (const entry of remaining) {
			const key = `${entry.pos.x},${entry.pos.y},${entry.structure}`;
			if (existingPositions.has(key)) {
				mem.buildQueue.index++;
				continue;
			}

			const pos = new RoomPosition(entry.pos.x, entry.pos.y, this.room.name);
			const result = this.room.createConstructionSite(pos, entry.structure as BuildableStructureConstant);

			if (result === OK) {
				created++;
				mem.buildQueue.index++;
				mem.buildQueue.lastBuiltTick = now;
				placedStructures.push(`${entry.structure}@${entry.pos.x},${entry.pos.y}`);
				if (created >= MAX_PER_TICK) break;
			} else {
				// Handle errors from createConstructionSite
				const errorMessages: Record<number, string> = {
					[ERR_INVALID_TARGET]: 'Invalid target location',
					[ERR_FULL]: 'Too many construction sites (max 100)',
					[ERR_INVALID_ARGS]: 'Invalid structure type or position',
					[ERR_RCL_NOT_ENOUGH]: 'Room Controller Level too low',
					[ERR_NOT_OWNER]: 'Not the owner of this room'
				};

				const errorMsg = errorMessages[result] || `Unknown error (${result})`;

				// Track error for batch logging and potential retry
				placementErrors.push({
					structure: entry.structure,
					pos: { x: entry.pos.x, y: entry.pos.y },
					error: errorMsg
				});

				// Only skip this item if it's not a temporary error (like ERR_FULL or ERR_RCL_NOT_ENOUGH)
				// These errors may resolve themselves and should be retried
				if (result === ERR_FULL) {
					// Too many construction sites - stop processing and retry next tick
					break;
				} else if (result === ERR_RCL_NOT_ENOUGH) {
					// RCL not high enough yet - this shouldn't happen if BasePlanner is working correctly
					// Skip this structure and move to next
					mem.buildQueue.index++;
					console.log(`${this.room.link()} WARNING: Tried to place ${entry.structure} at RCL${rcl} but it requires higher RCL!`);
				} else {
					// Permanent error (invalid position, etc.) - skip and move on
					mem.buildQueue.index++;
				}
			}
		}

		// Batch log placements and errors
		if (placedStructures.length > 0) {
			if (debugMode) {
				console.log(`${this.room.link()} Placed ${placedStructures.length} construction sites for RCL${rcl}: ${placedStructures.join(', ')}`);
			}
		}
		if (placementErrors.length > 0 && debugMode) {
			console.log(`${this.room.link()} Failed to place ${placementErrors.length} structures:`);
			for (const err of placementErrors) {
				console.log(`  - ${err.structure}@${err.pos.x},${err.pos.y}: ${err.error}`);
			}
		}

		// If we've finished the current RCL batch, log completion
		// Don't reset index - leave it at length to prevent repeated expensive room.find() calls
		if (mem.buildQueue.index >= plannedForRCL.length) {
			// Log only once when first completing the RCL, not every tick
			if (mem.buildQueue.index === plannedForRCL.length) {
				console.log(`${this.room.link()} Finished placing all RCL${rcl} construction sites from base plan.`);
				mem.buildQueue.index++; // Increment past length to prevent this log from repeating
			}
		}

		const visual = new RoomVisual(this.room.name);
		visual.text(
			`Building ${mem.buildQueue?.index ?? 0}/${plan.rclSchedule[mem.buildQueue?.activeRCL || 1]?.length || 0}`,
			3, 48,
			{ align: 'left', color: '#88f', font: 0.8 }
		);
	}

	/** Draws planned structures (like extensions) on the room using RoomVisuals. */
	private drawPlanningVisuals(): void {
		const visual = new RoomVisual(this.room.name);

		// Extensions (planned)
		const extensionSites = this.room.find(FIND_CONSTRUCTION_SITES, {
			filter: s => s.structureType === STRUCTURE_EXTENSION
		});

		for (const site of extensionSites) {
			visual.circle(site.pos, {
				radius: 0.4,
				fill: 'yellow',
				opacity: 0.3,
				stroke: 'orange'
			});
		}

		// Existing extensions
		const extensions = this.room.find(FIND_STRUCTURES, {
			filter: s => s.structureType === STRUCTURE_EXTENSION
		});
		for (const ext of extensions) {
			visual.circle(ext.pos, {
				radius: 0.4,
				fill: '#00ff00',
				opacity: 0.2
			});
		}

		// Planned controller or source containers (from memory)
		const data = this.room.memory.data as RoomData | undefined;
		if (data) {
			if (data.controllerContainer) {
				const obj = Game.getObjectById(data.controllerContainer);
				if (obj) visual.circle(obj.pos, { radius: 0.45, fill: 'cyan', opacity: 0.3 });
			}
			if (data.sourceOne?.container) {
				const obj = Game.getObjectById(data.sourceOne.container);
				if (obj) visual.circle(obj.pos, { radius: 0.45, fill: 'purple', opacity: 0.3 });
			}
			if (data.sourceTwo?.container) {
				const obj = Game.getObjectById(data.sourceTwo.container);
				if (obj) visual.circle(obj.pos, { radius: 0.45, fill: 'purple', opacity: 0.3 });
			}
		}

		// Draw spawn marker (center of planning)
		const spawn = this.resources.spawns[0];
		if (spawn) {
			visual.circle(spawn.pos, { radius: 0.6, fill: '#00f', opacity: 0.2 });
			visual.text('Spawn Center', spawn.pos.x, spawn.pos.y - 0.8, {
				align: 'center',
				color: '#66f',
				font: 0.6
			});
		}
	}

	/** Draws Base Plan construction progress widget for visualization. */
	private visualizeBuildQueue(): void {
		const visual = new RoomVisual(this.room.name);
		const mem = this.room.memory.buildQueue;
		if (!mem) return;

		visual.text(
			`RCL${mem.activeRCL} build ${mem.index}`,
			3, 47,
			{ align: 'left', color: '#ccc', font: 0.8 }
		);
	}

	private drawPlannerVisuals(): void {
		const vis = new RoomVisual(this.room.name);

		if (this.room.memory.visuals.basePlan.visDistTrans && this.basePlanner?.dtGrid) {
			this.drawDistanceTransform(vis, this.basePlanner.dtGrid);
		}

		if (this.room.memory.visuals.basePlan.visFloodFill && this.basePlanner?.floodGrid) {
			this.drawFloodFill(vis, this.basePlanner.floodGrid);
		}

		if (this.room.memory.visuals.basePlan.visBasePlan && this.basePlan) {
			this.drawBaseLayout(vis, this.basePlan);
		}
	}

	private drawDistanceTransform(vis: RoomVisual, dist: number[][]): void {
		const flatDist: number[] = [];

		for (let i = 0; i < dist.length; i++) flatDist.push(...dist[i]);
		const max = Math.max(...flatDist);

		for (let x = 0; x < 50; x++) {
			for (let y = 0; y < 50; y++) {
				const val = dist[x][y];
				if (val <= 0) continue;

				const hue = Math.floor((val / max) * 240); // blue → green gradient
				vis.rect(x - 0.5, y - 0.5, 1, 1, {
					fill: `hsl(${hue}, 80%, 40%)`,
					opacity: 0.4,
					stroke: 'none'
				});
			}
		}

		vis.text('Distance Transform', 25, 1, { align: 'center', color: '#00f', font: 0.8 });
	}

	private drawFloodFill(vis: RoomVisual, flood: number[][]): void {
		const flatFlood: number[] = [];
		for (let i = 0; i < flood.length; i++) flatFlood.push(...flood[i]);
		const max = Math.max(...flatFlood);
		for (let x = 0; x < 50; x++) {
			for (let y = 0; y < 50; y++) {
				const val = flood[x][y];
				if (val <= 0) continue;

				const hue = Math.floor((1 - val / max) * 240); // red→green gradient
				vis.rect(x - 0.5, y - 0.5, 1, 1, {
					fill: `hsl(${hue}, 80%, 40%)`,
					opacity: 0.35,
					stroke: 'none'
				});
			}
		}

		vis.text('Flood Fill Map', 25, 2, { align: 'center', color: '#0f0', font: 0.8 });
	}

	private drawBaseLayout(vis: RoomVisual, plan: PlanResult): void {
		const rcl = this.room.controller?.level ?? 8;
		const placements = Object.values(plan.rclSchedule).reduce((acc, arr) => acc.concat(arr), [] as any[]);

		for (const entry of placements) {
			const { x, y } = entry.pos;
			const sType = entry.structure as BuildableStructureConstant;

			switch (sType) {
				case STRUCTURE_ROAD:
					vis.line(x, y, x + 0.001, y + 0.001, { color: '#aaa', width: 0.1 });
					break;

				case STRUCTURE_SPAWN:
					this.drawShape(vis, x, y, 'circle', '#a0f', 'S');
					break;

				case STRUCTURE_EXTENSION:
					this.drawShape(vis, x, y, 'circle', '#ff0', 'E', 0.35);
					break;

				case STRUCTURE_TOWER:
					this.drawShape(vis, x, y, 'circle', '#f00', 'T');
					break;

				case STRUCTURE_LINK:
					this.drawShape(vis, x, y, 'diamond', '#7f7', 'L');
					break;

				case STRUCTURE_STORAGE:
					this.drawShape(vis, x, y, 'rect', '#f80', 'S', 0.55, 0.35);
					break;

				case STRUCTURE_TERMINAL:
					this.drawShape(vis, x, y, 'triangle', '#0ff', 'T', 0.6);
					break;

				case STRUCTURE_LAB:
					this.drawShape(vis, x, y, 'circle', '#0f0', 'L');
					break;

				case STRUCTURE_FACTORY:
					this.drawShape(vis, x, y, 'hex', '#fff', 'F', 0.5);
					break;

				case STRUCTURE_NUKER:
					this.drawShape(vis, x, y, 'oct', '#f0f', 'N', 0.6);
					break;

				case STRUCTURE_OBSERVER:
					this.drawShape(vis, x, y, 'triangle', '#88f', 'O', 0.4);
					break;

				case STRUCTURE_RAMPART:
					vis.rect(x - 0.5, y - 0.5, 1, 1, {
						fill: '#00ff0080',
						stroke: '#0f0',
						opacity: 0.3
					});
					break;

				default:
					vis.circle(x, y, { radius: 0.25, fill: '#999', stroke: '#555' });
					break;
			}
		}

		vis.text('Base Layout', 25, 3, { align: 'center', color: '#fff', font: 0.8 });
	}

	private drawShape(
		vis: RoomVisual,
		x: number,
		y: number,
		shape: 'circle' | 'rect' | 'triangle' | 'diamond' | 'hex' | 'oct',
		color: string,
		label: string,
		size: number = 0.45,
		height?: number
	): void {
		const opts = { stroke: color, fill: `${color}40`, opacity: 0.8 };
		switch (shape) {
			case 'circle':
				vis.circle(x, y, { radius: size, ...opts });
				break;
			case 'rect':
				vis.rect(x - size, y - (height ?? size), size * 2, (height ?? size) * 2, opts);
				break;
			case 'triangle':
				vis.poly([[x, y - size], [x - size, y + size], [x + size, y + size]], opts);
				break;
			case 'diamond':
				vis.poly([[x, y - size], [x - size, y], [x, y + size], [x + size, y]], opts);
				break;
			case 'hex':
				vis.poly(this.makePolygon(x, y, 6, size), opts);
				break;
			case 'oct':
				vis.poly(this.makePolygon(x, y, 8, size), opts);
				break;
		}
		vis.text(label, x, y + 0.05, { color: '#000', align: 'center', font: 0.5 });
	}

	private makePolygon(cx: number, cy: number, sides: number, radius: number): [number, number][] {
		const pts: [number, number][] = [];
		for (let i = 0; i < sides; i++) {
			const a = (2 * Math.PI * i) / sides;
			pts.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)]);
		}
		return pts;
	}

}
