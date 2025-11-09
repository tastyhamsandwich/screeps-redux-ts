import RoomDefense from './DefenseManager';
import SpawnManager from './SpawnManager';
import BasePlanner, { computePlanChecksum } from '../modules/BasePlanner';
import { STRUCTURE_PRIORITY } from '../functions/utils/constants';
import { legacySpawnManager } from './room/utils';
import { log } from '../functions/utils/globals';
import { determineBodyParts } from '../functions/creep/body';

/** Manages all logic and operations for a single room. */
export default class RoomManager {
	private room: Room;
	private resources: RoomResources;
	private stats: RoomStats;
	private spawnManager: SpawnManager;
	private legacySpawnManager;
	private basePlanner: BasePlanner | null;
	private basePlan: PlanResult | null = null;

	constructor(room: Room) {
		this.room = room;
		this.resources = this.scanResources();
		this.stats = this.gatherStats();
		this.spawnManager = new SpawnManager(room);
		this.legacySpawnManager = legacySpawnManager;
		this.basePlanner = null; // Only create when regeneration is needed

		// Initialize all required room memory structures
		if (!this.room.memory.data) this.room.memory.data = {};
		if (!this.room.memory.flags) this.room.memory.flags = {};
		if (!this.room.memory.visuals) this.room.memory.visuals = {};
		if (!this.room.memory.quotas) this.room.memory.quotas = {};
		if (!this.room.memory.objects) this.room.memory.objects = {};
		if (!this.room.memory.containers) {
			this.room.memory.containers = {} as any; // Will be populated as containers are discovered
		}
		if (!this.room.memory.settings) {
			this.room.memory.settings = {
				basePlanning: { debug: false }
			} as any; // Partial initialization - other settings added as needed
		}
	}

	/** Main run method - called every tick */
	run(): void {

		const roomMem = this.room.memory;
		const rmData = roomMem.data;

		// Update resources and stats (throttled to every 10 ticks for performance)
		if (!rmData.lastResourceScan || Game.time - rmData.lastResourceScan >= 10) {
			this.resources = this.scanResources();
			this.stats = this.gatherStats();
			rmData.lastResourceScan = Game.time;
		}

		if (!rmData.firstTimeInit) {
			rmData.advSpawnSystem = false;
			Memory.globalData.numColonies++;
		}

		rmData.firstTimeInit ??= true;

		// Assess need for bootstrapping mode
		this.updateBootstrapState();

		// Generate and cache base plan data
		const rcl = this.room.controller?.level ?? 0;
		const mem = this.room.memory;

		// Initialize visual settings if needed
		if (!rmData.basePlanGenerated) {
			if (!this.room.memory.visuals) this.room.memory.visuals = {};
			this.room.memory.visuals.visDistTrans ??= true;
			this.room.memory.visuals.visFloodFill ??= true;
			this.room.memory.visuals.visBasePlan ??= true;
			rmData.basePlanGenerated = true;
		}

		let regenerate = false;

		// Determine whether to regenerate plan
		if (!mem.basePlan) regenerate = true;
		else if (mem.basePlan.rclAtGeneration !== rcl) regenerate = true;
		// Removed periodic refresh - base plans are deterministic and don't need regeneration

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
				console.log(`[${this.room.name}] Base plan regenerated for RCL${rcl}`);
				// Otherwise, load cached plan (only assign from memory if not already loaded)
			}
		} else if (!this.basePlan && mem.basePlan) this.basePlan = mem.basePlan.data;

		// Process the plan if available
		if (this.basePlan) this.handleBasePlan(this.basePlan);

		// Assess creep needs and submit spawn requests if using advanced spawn manager
		if (rmData.advSpawnSystem) {
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

		// Manage links (if any)
		if (this.resources.links.length > 0) {
			this.manageLinks();
		}

		this.drawPlanningVisuals();
	}

	/** Sets current bootstrapping state in room memory */
	private updateBootstrapState(): void {
		const level = this.stats.controllerLevel;
		const hasContainer = this.resources.containers.length > 0;
		const creepCount = this.room.find(FIND_MY_CREEPS).length;

		if (!this.room.memory.flags) this.room.initRoom();
		this.room.memory.flags.bootstrap = (level === 1 && creepCount < 5 && !hasContainer);
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

	// Public API methods

	/** Get current room statistics */
	public getStats(): RoomStats {
		return this.stats;
	}

	/** Get current room resources */
	public getResources(): RoomResources {
		return this.resources;
	}

	/** Toggle base planner visuals */
	public togglePlanVisuals(): void {
		if (!this.room.memory.visuals) this.room.memory.visuals = {};
		const current = this.room.memory.visuals.visBasePlan ?? false;
		this.room.memory.visuals.visBasePlan = !current;
		this.room.memory.visuals.visDistTrans = !current;
		this.room.memory.visuals.visFloodFill = !current;
		console.log(`[${this.room.name}] Base planner visuals ${!current ? 'enabled' : 'disabled'}`);
	}

	/** Force regeneration of base plan */
	public regenerateBasePlan(): void {
		delete this.room.memory.basePlan;
		console.log(`[${this.room.name}] Base plan cleared - will regenerate next tick`);
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
					let lastHarvesterAssigned = rMem.data?.lastHarvesterAssigned || 0;
					let sourceID: Id<Source> | undefined;
					let containerID: string | undefined;

					if (lastHarvesterAssigned === 0 && rMem.objects?.sources) {
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
			// Request Remote Harvesters
			/*else if (rMem.outposts && totalRemoteHarvesters < rMem.outposts.numSources) {
				const body = determineBodyParts('harvester', cap, this.room);
				if (body) {
					//const returnObj = this.room.counter?.next();
					//const sourceID = returnObj?.source;
					//const containerID = returnObj?.container;

					this.spawnManager.submitRequest({
						role: 'remoteharvester',
						priority: 50,
						body: body,
						memory: {
							role: 'remoteharvester',
							RFQ: 'remoteharvester',
							home: roomName,
							room: roomName,
							working: false,
							disable: false,
							rally: 'none',
							source: sourceID,
							bucket: containerID
						},
						roomName: roomName,
						urgent: false
					});
				}
			}*/
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
				// For new room, set quotas for harvesters, ensure source containers are placed
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

	/** Process construction tasks as created by BasePlanner */
	private handleBasePlan(plan: PlanResult): void {
		const mem = this.room.memory;
		const rcl = this.stats.controllerLevel;
		const now = Game.time;
		const debugMode = this.room.memory.settings?.basePlanning?.debug || false;

		// Initialize or reset plan
		if (!mem.buildQueue || mem.buildQueue.activeRCL !== rcl) {
			mem.buildQueue = {
				plannedAt: now,
				lastBuiltTick: 0,
				index: 0,
				activeRCL: rcl
			};
		}

		// Early return: Skip expensive room.find() calls if we've completed all structures for current RCL
		const plannedForCurrentRCL = plan.rclSchedule[rcl] || [];
		if (mem.buildQueue.index >= plannedForCurrentRCL.length) {
			// All structures for this RCL are complete - no need to process build queue
			// RCL upgrades will reset the build queue at line 679
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

				// Track error for batch logging
				placementErrors.push({
					structure: entry.structure,
					pos: { x: entry.pos.x, y: entry.pos.y },
					error: errorMsg
				});

				// Skip this item and move to next
				mem.buildQueue.index++;

				// Stop if we hit the construction site limit
				if (result === ERR_FULL) break;
			}
		}

		// Batch log placements and errors (only if debug mode is enabled)
		if (debugMode) {
			if (placedStructures.length > 0) {
				console.log(`[${this.room.name}] Placed ${placedStructures.length} construction sites for RCL${rcl}: ${placedStructures.join(', ')}`);
			}
			if (placementErrors.length > 0) {
				console.log(`[${this.room.name}] Failed to place ${placementErrors.length} structures:`);
				for (const err of placementErrors) {
					console.log(`  - ${err.structure}@${err.pos.x},${err.pos.y}: ${err.error}`);
				}
			}
		}

		// If we've finished the current RCL batch, log completion
		// Don't reset index - leave it at length to prevent repeated expensive room.find() calls
		if (mem.buildQueue.index >= plannedForRCL.length) {
			// Log only once when first completing the RCL, not every tick
			if (mem.buildQueue.index === plannedForRCL.length) {
				console.log(`[${this.room.name}] Finished building all RCL${rcl} structures.`);
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

		if (this.room.memory.visuals.visDistTrans && this.basePlanner?.dtGrid) {
			this.drawDistanceTransform(vis, this.basePlanner.dtGrid);
		}

		if (this.room.memory.visuals.visFloodFill && this.basePlanner?.floodGrid) {
			this.drawFloodFill(vis, this.basePlanner.floodGrid);
		}

		if (this.room.memory.visuals.visBasePlan && this.basePlan) {
			this.drawBaseLayout(vis, this.basePlan);
		}
	}

	private drawDistanceTransform(vis: RoomVisual, dist: number[][]): void {
		const max = Math.max(...dist.flat());
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
		const max = Math.max(...flood.flat());
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
		const placements = Object.values(plan.rclSchedule).flat();

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
