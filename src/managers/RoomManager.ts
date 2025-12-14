import DefenseManager from './DefenseManager';
import SpawnManager from './SpawnManager';
import EnergyManager from './EnergyManager';
import LinkManager from './LinkManager';
//import TaskManager from '../../unused/TaskManager';
import { STRUCTURE_PRIORITY, PLAYER_USERNAME } from '../functions/utils/constants';
import { legacySpawnManager } from '../modules/LegacySpawnSystem';
import { calcPathLength, log, getReturnCode, calcPath } from '../functions/utils/globals';
import { determineBodyParts } from '../functions/creep/body';
import RoomPlanningVisualizer from '@modules/PlanVisualizer';
import * as FUNC from '@functions/index';
import BasePlanner from '../modules/BasePlanner';

/** Manages all logic and operations for a single room. */
export default class RoomManager {
	private room: Room;
	public rooms: Room[];
	private resources: RoomResources;
	private stats: RoomManagerStats;
	private spawnManager: SpawnManager;
	private energyManager: EnergyManager;
	//private TaskManager: TaskManager;
	private level: number;
	private constructionSites: ConstructionSite[];
	private previousCSites: number;
	private currentCSites: number;
	private LegacySpawnManager;
	private basePlan: PlanResult | null = null;
	private basePlanner: BasePlanner | null = null;
	private haulerPairs: { start: string, end: string, length: number }[] | null = null;
	public PlanVisualizer: RoomPlanningVisualizer | null = null;
	private _spawns: Id<StructureSpawn>[];
	private _creeps: {[creepName: string]: Creep;}
	private _towers: Id<StructureTower>[] | undefined;

	constructor(room: Room) {
		this.room = room;
		this.room.initRoom();// Initialize all required room memory structures
		//this.initializeMemory(); // Partial initialization - other settings added as needed
		this.resources = this.scanResources();
		this.stats = this.gatherStats();
		this.spawnManager = new SpawnManager(room);
		this.energyManager = new EnergyManager(room);
		//this.TaskManager = new TaskManager(room);
		this.LegacySpawnManager = legacySpawnManager;
		this.PlanVisualizer = new RoomPlanningVisualizer(room);
		this.basePlanner = new BasePlanner(room);
		this._spawns = this.room.find(FIND_MY_SPAWNS).map((s) => s.id);
		this._creeps = Game.creeps;
		this._towers = this.room.memory.objects.towers;
		this.loadBasePlanFromMemory();
		this.rooms = [this.room];
		this.level = this.room.controller!.level;
		this.constructionSites = [];
		this.previousCSites = 0;
		this.currentCSites = 0;

		this.room.memory.data.flags.advSpawnSystem = false;
		this.room.memory.data.flags.initialized = true;
		this.room.memory.data.flags.dropHarvestingEnabled = false;
		this.room.memory.data.flags.bootstrappingMode = false;
		this.room.memory.data.flags.basePlanGenerated = false;

		Memory.globalData.numColonies++;
		//this.room.log(`Initialized: ${this.room.memory.data.flags.initialized}!`);
		this.room.log(`First Time Room Initialization Complete!`);
	}

	get spawns(): StructureSpawn[] {
		try {
			return this._spawns
				.map(id => Game.getObjectById(id))
				.filter((spawn): spawn is StructureSpawn => spawn !== null);
		} catch (e) {
			console.log(`Execution Error In Function: RoomManager.spawns(${this.room.name}) on Tick ${Game.time}. Error: ${e}`);
			return [];
		}
	}

	get towers(): StructureTower[] {
		try {
			if (!this._towers) return [];
			return this._towers
				.map(id => Game.getObjectById(id))
				.filter((tower): tower is StructureTower => tower !== null);
		} catch (e) {
			console.log(`Execution Error In Function: RoomManager.towers(${this.room.name}) on Tick ${Game.time}. Error: ${e}`);
			return [];
		}
	}

	get creeps(): Creep[] {
		try {
			return Object.values(Game.creeps).filter(creep => creep.memory.home === this.room.name);
		} catch (e) {
			console.log(`Execution Error In Function: RoomManager.creeps(${this.room.name}) on Tick ${Game.time}. Error: ${e}`);
			return [];
		}
	}

	get remotes(): { [roomName: string]: Room | undefined } {
		try {
			return new Proxy(this.room.memory.remoteRooms, {
				get: (target, prop: string) => {
					if (prop in target)
						return Game.rooms[prop];
					return undefined;
				}
			}) as unknown as { [roomName: string]: Room | undefined };
		} catch (e) {
			console.log(`Execution Error In Function: RoomManager.remotes(${this.room.name}) on Tick ${Game.time}. Error: ${e}`);
			return {};
		}
	}


	/** Main run method - called every tick */
	run(): void {
		try {
			this.level = (this.room.controller) ? this.room.controller?.level : 0;
			const room = this.room;
			const roomMem = room.memory;
			roomMem.data ??= { flags: {}, indices: {} };
			const rmData = roomMem.data;
			const rcl = this.room.controller?.level ?? 0;
			const ready_for_remotes = Boolean(room.controller!.level >= 4 && room.storage && room.energyCapacityAvailable >= 1200);
			const conveyor_needed = Boolean(room.linkStorage && (room.linkController || room.linkOne || room.linkTwo) && room.storage && room.memory.quotas.conveyor === 0);
			const ready_for_drop_harvesting = Boolean(room.containerOne && room.containerTwo && room.energyCapacityAvailable >= 550 && !room.memory.data.flags.dropHarvestingEnabled);
			const storage_built = Boolean(room.storage && room.prestorage && room.controller && room.controller.level === 4 && room.prestorage.store.getUsedCapacity() === 0);
			const controller_upgraded = Boolean(this.room.controller && roomMem.data.controllerLevel !== rcl);

			if (controller_upgraded) {
				this.setRclTasks(rcl);
				this.handleRCLUpgrade();
			}
			if (storage_built)
				room.prestorage.destroy();
			if (ready_for_remotes)
				this.scanAdjacentRooms();
			if (conveyor_needed)
				room.setQuota('conveyor', 1);
			if (ready_for_drop_harvesting) {
				room.memory.data.flags.dropHarvestingEnabled = true;
			}

			// Ensure we have a base plan ready
			this.ensureBasePlanGenerated();

			// Update energy management metrics
			this.energyManager.run();

			// Assess creep needs and submit spawn requests if using advanced spawn manager
			if (rmData.flags.advSpawnSystem === false && rmData.pendingSpawn && room.energyAvailable === room.energyCapacityAvailable) {
				const spawns = room.find(FIND_MY_SPAWNS, { filter: i => !i.spawning });
				for (const spawn of spawns) {
					const result = spawn.retryPending();
					if (result === OK) break;
				}
			}

			// Assess need for bootstrapping mode
			this.updateBootstrapState();

			if (rmData.flags.advSpawnSystem) {
				this.spawnManager.run();
				this.assessCreepNeeds();
			} else {
				// Otherwise execute legacy spawn manager logic
				this.LegacySpawnManager.run(this.room);
			}

			// Display Tower Damage/Range Overlay if enabled
			FUNC.towerDamageOverlay(room);

			// Update resources and stats (throttled to every 10 ticks for performance)
			if (!rmData.lastResourceScan || Game.time - rmData.lastResourceScan >= 10) {
				this.resources = this.scanResources();
				this.stats = this.gatherStats();
				rmData.lastResourceScan = Game.time;
			}

			this.updateConstructionSites();
			if (this.currentCSites !== this.previousCSites)
				this.manageBuilderQuota();

			this.manageUpgraderQuota();

			// Run task management for workers
			//this.TaskManager.run();

			// Assign tasks to worker creeps
			this.assignCreepTasks();

			// Manage towers
			DefenseManager.run(this.room);

			// Manage hauler container pairs
			if (this.shouldManageContainers()) this.manageContainers();

			// Manage links (if any)
			if (this.resources.links.length > 0)
				LinkManager.run(room);

			// Display energy management statistics
			const energyVisual = new RoomVisual(this.room.name);
			this.energyManager.visualizeEnergyStats(energyVisual);

			// Handle RCL upgrades - detect level changes and place construction sites for new RCL
			this.handleRCLUpgrade();

			if (roomMem.visuals.enableVisuals)
				this.PlanVisualizer?.visualize(this.basePlan?.dtGrid, this.basePlan?.floodFill, this.basePlan);
		} catch (e) {
			console.log(`Execution Error In Function: RoomManager.run(${this.room.name}) on Tick ${Game.time}. Error: ${e}`);
		}
	}

	/** Sets current bootstrapping state in room memory */
	private updateBootstrapState(): void {
		try {
			const level = this.stats.controllerLevel;
			const hasContainer = this.resources.containers.length > 0;
			const creepCount = this.room.find(FIND_MY_CREEPS).length;

			if (!this.room.memory.data.flags) this.room.memory.data.flags = {};
			this.room.memory.data.flags.bootstrappingMode = (level === 1 && creepCount < 5 && !hasContainer);
		} catch (e) {
			console.log(`Execution Error In Function: RoomManager.updateBootstrapState(${this.room.name}) on Tick ${Game.time}. Error: ${e}`);
		}
	}

	refresh(): void {
		this.room = Game.rooms[this.room.name];
		//this.remotes = _.compact(_.map(this.remotes, remote => Game.rooms[remote.name]))
	}

	/** Scans the room for all relevant structures and resources */
	private scanResources(): RoomResources {
		try {
			this.room.cacheObjects();
			const objIDs = this.room.memory.objects;
			return {
				sources: (objIDs.sources) ? objIDs.sources!.map(id => Game.getObjectById(id)!) : [],
				minerals: this.room.find(FIND_MINERALS),
				controller: this.room.controller,
				containers: (objIDs.containers) ? objIDs.containers!.map(id => Game.getObjectById(id)!) : [],
				towers: (objIDs.towers) ? objIDs.towers!.map(id => Game.getObjectById(id)!) : [],
				spawns: (objIDs.spawns) ? objIDs.spawns!.map(id => Game.getObjectById(id)!) : [],
				links: (objIDs.links) ? objIDs.links!.map(id => Game.getObjectById(id)!) : [],
				storage: this.room.storage,
				terminal: this.room.terminal,
				labs: (objIDs.labs) ? objIDs.labs!.map(id => Game.getObjectById(id)!) : [],
				powerSpawn: (objIDs.powerSpawn) ? Game.getObjectById(objIDs.powerSpawn)! : undefined,
				nuker: (objIDs.nuker) ? Game.getObjectById(objIDs.nuker)! : undefined,
				observer: (objIDs.observer) ? Game.getObjectById(objIDs.observer)! : undefined,
				extractor: (objIDs.extractor) ? Game.getObjectById(objIDs.extractor)! : undefined,
			};
		} catch (e) {
			console.log(`Execution Error In Function: RoomManager.scanResources(${this.room.name}) on Tick ${Game.time}. Error: ${e}`);
			return {
				sources: [],
				minerals: [],
				controller: undefined,
				containers: [],
				towers: [],
				spawns: [],
				links: [],
				storage: undefined,
				terminal: undefined,
				labs: [],
				powerSpawn: undefined,
				nuker: undefined,
				observer: undefined,
				extractor: undefined
			};
		}
	}

	/** Toggle base planner visuals */
	public togglePlanVisuals(): void {
		try {
			if (!this.room.memory.visuals.basePlan) this.room.memory.visuals.basePlan = {};
			const current = this.room.memory.visuals.basePlan.visBasePlan ?? false;
			this.room.memory.visuals.basePlan.visBasePlan = !current;
			this.room.memory.visuals.basePlan.visDistTrans = !current;
			this.room.memory.visuals.basePlan.visFloodFill = !current;
			this.room.log(`Base planner visuals ${!current ? 'enabled' : 'disabled'}`);
		} catch (e) {
			this.room.log(`Execution Error In Function: RoomManager.togglePlanVisuals(${this.room.name}) on Tick ${Game.time}. Error: ${e}`);
		}
	}

	/** Set individual base plan visualization layers */
	public setPlanVisuals(opts: { enable?: boolean; dist?: boolean; flood?: boolean; base?: boolean; info?: boolean; build?: boolean }): void {
		try {
			const visuals = this.room.memory.visuals ??= { basePlan: {} as any, enableVisuals: false } as any;
			visuals.basePlan ??= {} as any;
			if (opts.enable !== undefined) visuals.enableVisuals = opts.enable;
			if (opts.dist !== undefined) visuals.basePlan.visDistTrans = opts.dist;
			if (opts.flood !== undefined) visuals.basePlan.visFloodFill = opts.flood;
			if (opts.base !== undefined) visuals.basePlan.visBasePlan = opts.base;
			if (opts.info !== undefined) visuals.basePlan.visPlanInfo = opts.info;
			if (opts.build !== undefined) visuals.basePlan.buildProgress = opts.build;
			const summary = `enable=${visuals.enableVisuals} dist=${!!visuals.basePlan.visDistTrans} flood=${!!visuals.basePlan.visFloodFill} base=${!!visuals.basePlan.visBasePlan} info=${!!visuals.basePlan.visPlanInfo} build=${!!visuals.basePlan.buildProgress}`;
			console.log(`${this.room.link()} Updated plan visuals: ${summary}`);
		} catch (e) {
			console.log(`Execution Error In Function: RoomManager.setPlanVisuals(${this.room.name}) on Tick ${Game.time}. Error: ${e}`);
		}
	}

	/** Force regeneration of base plan */
	public regenerateBasePlan(): void {
		try {
			delete this.room.memory.basePlan;
			this.basePlan = null;
			this.room.log(`Base plan cleared - will regenerate next tick`);
		} catch (e) {
			console.log(`Execution Error In Function: RoomManager.regenerateBasePlan(${this.room.name}) on Tick ${Game.time}. Error: ${e}`);
		}
	}

	/** Force placement of construction sites for the current RCL according to rclSchedule */
	public forceConstructionSitePlacement(): { placed: number; failed: number; errors: string[] } {
		try {
			const room = this.room;
			const rcl = room.controller?.level ?? 0;
			room.log(`forceConstructionSitePlacement invoked for RCL${rcl}`);

			if (!this.basePlan) {
				room.log(`No base plan available - cannot force construction site placement`);
				return { placed: 0, failed: 0, errors: ['No base plan available'] };
			}

			const plannedForRCL = this.basePlan.rclSchedule[rcl] || [];
			room.log(`Planned entries for RCL${rcl}: ${plannedForRCL.length}`);

			if (plannedForRCL.length === 0) {
				room.log(`No structures scheduled for RCL${rcl}`);
				return { placed: 0, failed: 0, errors: [`No structures scheduled for RCL${rcl}`] };
			}

			// Get existing structures and construction sites
			const existingSites = room.find(FIND_CONSTRUCTION_SITES);
			const existingStructs = room.find(FIND_STRUCTURES);
			const existingPositions = new Set(
				[
					...existingStructs.map(s => `${s.pos.x},${s.pos.y},${s.structureType}`),
					...existingSites.map(s => `${s.pos.x},${s.pos.y},${s.structureType}`)
				]
			);

			let placed = 0;
			let failed = 0;
			const errors: string[] = [];

			// Sort by priority
			const toPlace = plannedForRCL
				.slice()
				.sort((a, b) => {
					const pa = STRUCTURE_PRIORITY[a.structure as BuildableStructureConstant] ?? 99;
					const pb = STRUCTURE_PRIORITY[b.structure as BuildableStructureConstant] ?? 99;
					return pa - pb;
				});

			for (const entry of toPlace) {
				const key = `${entry.pos.x},${entry.pos.y},${entry.structure}`;

				// Skip if already exists
				if (existingPositions.has(key)) continue;

				const pos = new RoomPosition(entry.pos.x, entry.pos.y, room.name);
				const result = room.createConstructionSite(pos, entry.structure as BuildableStructureConstant);
				console.log(`${room.link()} createConstructionSite(${entry.structure} @ ${entry.pos.x},${entry.pos.y}) -> ${result}`);

				if (result === OK) {
					placed++;
				} else {
					failed++;
					const errorMessages: Record<number, string> = {
						[ERR_INVALID_TARGET]: 'Invalid target location',
						[ERR_FULL]: 'Too many construction sites (max 100)',
						[ERR_INVALID_ARGS]: 'Invalid structure type or position',
						[ERR_RCL_NOT_ENOUGH]: 'Room Controller Level too low',
						[ERR_NOT_OWNER]: 'Not the owner of this room'
					};
					const errorMsg = errorMessages[result] || `Unknown error (${result})`;
					errors.push(`${entry.structure}@${entry.pos.x},${entry.pos.y}: ${errorMsg}`);
				}
			}

			room.log(`Force placement complete: ${placed} placed, ${failed} failed`);
			if (placed > 0) {
				room.log(`Placed ${placed} construction sites for RCL${rcl}`);
				if (room.memory.basePlan && room.memory.basePlan.scheduleSize)
					room.memory.basePlan.scheduleSize[rcl] -= placed;
			}
			if (errors.length > 0) room.log(`Placement errors: ${errors.join(', ')}`);

			return { placed, failed, errors };
		} catch (e) {
			console.log(`Execution Error In Function: RoomManager.forceConstructionSitePlacement(${this.room.name}) on Tick ${Game.time}. Error: ${e}`);
			return { placed: 0, failed: 0, errors: [`Execution error: ${e}`] };
		}
	}

	/** Detects RCL level-ups and initiates construction site placement for new RCL */
	private handleRCLUpgrade(): void {
		try {
			const room = this.room;
			const controller = room.controller;
			if (!controller) return;

			const currentRCL = controller.level;
			const previousRCL = room.memory.data.controllerLevel ?? 0;
			// No change detected
			if (currentRCL === previousRCL) return;

			// Update stored controller level
			room.memory.data.controllerLevel = currentRCL;
			this.stats.controllerLevel = currentRCL;

			// Log the upgrade
			if (currentRCL > previousRCL) {
				room.log(`Controller upgraded: RCL${previousRCL} -> RCL${currentRCL}`);
				room.log(`Base plan present: ${!!this.basePlan}. RCL schedule entries: ${this.basePlan?.rclSchedule?.[currentRCL]?.length ?? 0}`);
				if (currentRCL > room.memory.stats.controllerLevelReached) {
					room.memory.stats.controllerLevelReached = currentRCL;
				}

				// Reset build queue to process new RCL structures
				room.memory.buildQueue = {
					plannedAt: Game.time,
					lastBuiltTick: 0,
					index: 0,
					activeRCL: currentRCL,
					failedPlacements: []
				};

				room.log(`RCL${currentRCL} build queue initialized. Ready to place construction sites.`);

				this.ensureBasePlanGenerated();
				const placementResult = this.forceConstructionSitePlacement();
				if (placementResult.placed > 0) room.log(`Placed ${placementResult.placed} planned sites for RCL${currentRCL}`);
				if (placementResult.failed > 0) room.log(`Failed to place ${placementResult.failed} planned sites: ${placementResult.errors.join(', ')}`);
			}
		} catch (e) {
			this.room.log(`Execution Error In Function: RoomManager.handleRCLUpgrade(${this.room.name}) on Tick ${Game.time}. Error: ${e}`);
		}
	}

	/** Gathers current room statistics */
	private gatherStats(): RoomManagerStats {
		try {
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
		} catch (e) {
			this.room.log(`Execution Error In Function: RoomManager.gatherStats(${this.room.name}) on Tick ${Game.time}. Error: ${e}`);
			return {
				controllerLevel: 0,
				energyAvailable: 0,
				energyCapacityAvailable: 0,
				constructionSites: [],
				damagedStructures: []
			};
		}
	}

	/** Determines repair priority for structures */
	private getRepairPriority(structure: Structure): number {
		try {
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
		} catch (e) {
			console.log(`Execution Error In Function: RoomManager.getRepairPriority(${this.room.name}) on Tick ${Game.time}. Error: ${e}`);
			return 0;
		}
	}

	/** Assesses which creeps are needed and submits spawn requests to SpawnManager */
	private assessCreepNeeds(): void {
		try {
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
			/*// Request Reservers
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
			}*/
			// Request Workers (dynamically managed by TaskManager)
			/*
			const workers = creepsByRole['worker'] || [];
			const workerQuota = this.TaskManager.getWorkerQuota();
			const totalWorkers = workers.length + countPendingRole('worker');

			if (totalWorkers < workerQuota) {
				const preferredType = this.TaskManager.getPreferredWorkerType();
				const body = determineBodyParts(preferredType, cap, this.room);
				if (body) {
					this.spawnManager.submitRequest({
						role: 'worker',
						priority: 75,
						body: body,
						memory: {
							role: 'worker',
							RFQ: 'worker',
							home: roomName,
							room: roomName,
							working: false,
							disable: false,
							rally: 'none',
							preferredType: preferredType.split('-')[1] || 'mixed' // Store the variant hint
						},
						roomName: roomName,
						urgent: false
					});
				}
			}*/

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
						const body = determineBodyParts('remoteharvester', cap, this.room); // reuse harvester body; customize later if needed
						if (!body) break;
						this.room.log(`Submitting request to spawn remote harvester`);
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
		} catch (e) {
			console.log(`Execution Error In Function: RoomManager.assessCreepNeeds(${this.room.name}) on Tick ${Game.time}. Error: ${e}`);
		}
	}

	/** Helper method to determine if more harvesters are needed (from main.ts logic) */
	private needMoreHarvesters(): boolean {
		try {
			const roomName = this.room.name;
			const harvesters = _.filter(Game.creeps, (c) => (c.memory.RFQ == 'harvester' || c.memory.role == 'harvester') && c.memory.home == roomName);

			const sources = this.resources.sources;
			let totalWorkParts = 0;

			for (const harvester of harvesters)
				totalWorkParts += harvester.body.filter(part => part.type === WORK).length;

			// Each source can support 5 WORK parts (generates 10 energy/tick), need at least that many
			const neededWorkParts = sources.length * 5;
			return totalWorkParts < neededWorkParts;
		} catch (e) {
			console.log(`Execution Error In Function: RoomManager.needMoreHarvesters(${this.room.name}) on Tick ${Game.time}. Error: ${e}`);
			return false;
		}
	}

	/** Assigns tasks to worker creeps based on room needs */
	private assignCreepTasks(): void {
		try {
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
	} catch (e) {
			console.log(`Execution Error In Function: RoomManager.assignCreepTasks() on Tick ${Game.time}. Error: ${e}`);
			return;
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
	/* private manageTowers(): void {
		const towers = this.room.memory.objects.towers?.map(id => Game.getObjectById(id));
		if (towers)
			for (const tower of towers) if (tower) DefenseManager(tower);
	} */

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
	getStats(): RoomManagerStats {
		return this.stats;
	}

	/** Gets the SpawnManager instance (for external access) */
	getSpawnManager(): SpawnManager {
		return this.spawnManager;
	}

	/** Gets the EnergyManager instance (for external access) */
	getEnergyManager(): EnergyManager {
		return this.energyManager;
	}



	/** Determine if there is a need to update or create new hauler route pair information. */
	private shouldManageContainers(debug: boolean = false): boolean {
		const cont = this.room.memory.containers || {};
		const ids = [
			cont.sourceOne || '',
			cont.sourceTwo || '',
			cont.prestorage || '',
			cont.controller || '',
			(this.room.storage && this.room.storage.id) || ''
		].join('|');

		if (debug) {
			this.room.log(`Stored Hash: ${this.room.memory.data._lastContainerHash}`);
			this.room.log(`Current Hash: ${ids}`);
		}

		// simple change-detection "hash" stored in memory
		if (this.room.memory.data._lastContainerHash !== ids) {
			this.room.memory.data._lastContainerHash = ids;
			return true;
		}
		return false;
	}

	/** Create/update hauler route pairs. */
	public manageContainers(): void {

		const locality = 'local';
		const pairArray: { start: Id<StructureStorage | StructureContainer>, end: Id<StructureContainer | StructureStorage>, length: number, room: string, dropoffRoom: string, locality: string }[] = [];

		//: Local ContainerOne -> Storage/Prestorage Pair
		if (this.room.containerOne && (this.room.prestorage || this.room.storage)) {
			const sourceOneContainer: StructureContainer = this.room.containerOne;
			const storageCont = (this.room.storage) ? this.room.storage : (this.room.prestorage) ? this.room.prestorage : null;
			if (storageCont) {
				const start = this.room.memory.containers.sourceOne;
				const end = storageCont.id;
				const length = calcPathLength(sourceOneContainer.pos, storageCont.pos);
				const room = this.room.name;
				const dropoffRoom = this.room.name;
				const pair = { start, end, length, room, dropoffRoom, locality };
				pairArray.push(pair);
			}
		}
		//: Local ContainerTwo -> Storage/Prestorage Pair
		if (this.room.containerTwo && (this.room.prestorage || this.room.storage)) {
			const sourceTwoContainer: StructureContainer = this.room.containerTwo;
			const storageCont = (this.room.storage) ? this.room.storage : this.room.prestorage;
			if (storageCont) {
				const start = this.room.memory.containers.sourceTwo;
				const end = storageCont.id;
				const length = calcPathLength(sourceTwoContainer.pos, storageCont.pos);
				const room = this.room.name;
				const dropoffRoom = room;
				const pair = { start, end, length, room, dropoffRoom, locality };
				pairArray.push(pair);
			}
		}
		//: Local Storage/Prestorage -> Controller Pair
		if ((this.room.storage || this.room.prestorage) && this.room.memory.containers.controller) {
			const controllerContainer: StructureContainer = this.room.containerController;
			const storage: StructureStorage | StructureContainer = (this.room.storage) ? this.room.storage : this.room.prestorage;
			const pathLength = calcPathLength(storage.pos, controllerContainer.pos);
			const pair = { start: storage.id, end: this.room.memory.containers.controller, length: pathLength, room: this.room.name, dropoffRoom: this.room.name, locality };
			pairArray.push(pair);
		}/* else if (this.room.memory.containers.controller && this.room.memory.containers.prestorage) {
			const controllerContainer: StructureContainer = Game.getObjectById(this.room.memory.containers.controller)!;
			const prestorageContainer: StructureContainer = Game.getObjectById(this.room.memory.containers.prestorage)!;
			const pathLength = calcPathLength(prestorageContainer.pos, controllerContainer.pos);
			const pair = { start: this.room.memory.containers.prestorage, end: this.room.memory.containers.controller, length: pathLength, room: this.room.name, dropoffRoom: this.room.name, locality };
			pairArray.push(pair);
		}*/

		//: Remote Rooms hauling pairs
		if (this.room.memory.remoteRooms && Object.keys(this.room.memory.remoteRooms).length && (this.room.storage || this.room.prestorage)) {
			const remoteRooms = this.room.memory.remoteRooms;
			const storageCont = (this.room.storage) ? this.room.storage : this.room.prestorage;
			for (const room in remoteRooms) {
				if (Game.rooms[room]) {
					Game.rooms[room].cacheObjects();
					if (Game.rooms[room].memory.containers) {
						if (Game.rooms[room].memory.containers.sourceOne) {
							const start = Game.rooms[room].containerOne.id;
							const end = storageCont.id;
							const length = calcPathLength(Game.rooms[room].containerOne.pos, storageCont.pos);
							const dropoffRoom = this.room.name;
							const locality = 'remote';
							const pair = { start, end, length, room, dropoffRoom, locality };
							pairArray.push(pair);
						}
						if (Game.rooms[room].memory.containers.sourceTwo) {
							const start = Game.rooms[room].containerTwo.id;
							const end = storageCont.id;
							const length = calcPathLength(Game.rooms[room].containerTwo.pos, storageCont.pos);
							const dropoffRoom = this.room.name;
							const locality = 'remote';
							const pair = { start, end, length, room, dropoffRoom, locality };
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

	/** Scan adjacent rooms (exits) for visible rooms, cache their objects
 * and request scouts for non-visible rooms (throttled). */
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
				remoteRoom.memory.remoteOfRoom = this.room.name;
				if (!remoteRoom.memory.objects)
					remoteRoom.cacheObjects();
				remoteRooms[rName].lastScanned = now;
				remoteRooms[rName].sources = remoteRoom.memory.objects.sources;
				if (!remoteRooms[rName].containers)
					remoteRooms[rName].containers = {};
				remoteRooms[rName].controllerId = remoteRoom.controller?.id;
				remoteRooms[rName].controllerOwner = remoteRoom.controller?.owner?.username;
				remoteRooms[rName].reservation = remoteRoom.controller?.reservation ? {
					username: remoteRoom.controller!.reservation!.username,
					ticksToEnd: remoteRoom.controller!.reservation!.ticksToEnd
				} : null;
				remoteRooms[rName].creepAssignments = { sourceOne: '', haulerOne: '', reserver: '', guard: '' };
				if (remoteRooms[rName].sources.length > 1) {
					remoteRooms[rName].creepAssignments.sourceTwo = '';
					remoteRooms[rName].creepAssignments.haulerTwo = '';
				}
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
					if (scouts.length < Object.keys(remoteRooms).length) {
						const freeSpawn = () => {
							const spawns = this.room.find(FIND_MY_SPAWNS);
							for (const spawn of spawns) {
								if (!spawn.spawning) return spawn;
								else continue;
							}
							return;
						}
						const spawn = freeSpawn();
						if (spawn) {
							const {name, result} = spawn!.spawnScout('none', false, { targetRoom: rName } );
							this.room.log(`Attempted to spawn scout: ${getReturnCode(result)}`)
						if (result === OK)
							this.room.memory.remoteRooms[rName].scoutAssigned = name;
					}
				}
			}
		}
		this.room.memory.remoteRooms = remoteRooms;
		this.room.memory.quotas.reservers = remoteRooms.length;
	}
}

	/** Returns true if there is a pending or scheduled scout spawn targeting `roomName` */
	private isScoutPendingFor(targetRoom: string): boolean {
		const queue = this.spawnManager.getQueue();
		const scheduled = this.spawnManager.getScheduledSpawns();
		const inQueue = queue.some((req: any) => req.role === 'scout' && req.memory?.targetRoom === targetRoom);
		const inScheduled = scheduled.some((s: any) => s.role === 'scout' && s.memory?.targetRoom === targetRoom);
		return inQueue || inScheduled;
	}

	public clearRCL(): boolean {
		this.room.memory.data.controllerLevel = 0;
		const isZero = this.room.memory.data.controllerLevel === 0;
		this.room.log(`Cleared stored RCL in Room Data!`);
		return isZero;
	}

	private initializeMemory() {
		try {
			const visualSettings: VisualSettings = { progressInfo: { alignment: 'left', xOffset: 1, yOffsetFactor: 0.6, stroke: '#000000', fontSize: 0.6, color: '' } };
			const progressInfo = { alignment: 'left', xOffset: 1, yOffsetFactor: 0.6, stroke: '#000000', fontSize: 0.6, color: '' };
			const roomFlags = { displayCoords: [0, 49], color: '#ff0033', fontSize: 0.4 };
			const spawnInfo = { alignment: 'right', color: 'white', fontSize: 0.4 };
			const towerSettings: TowerRepairSettings = { creeps: true, walls: false, ramparts: false, roads: false, others: false, wallLimit: 10, rampartLimit: 10, maxRange: 10 };
			const repairSettings: RepairSettings = { walls: false, ramparts: false, roads: true, others: true, wallLimit: 10, rampartLimit: 10, towerSettings: towerSettings };
			const upkeepCosts: UpkeepStats = { roadUpkeepPaid: 0, containerUpkeepPaid: 0, rampartUpkeepPaid: 0 };
			const linkStats: LinkStats = {
				controllerLink: { energySent: 0, energyFeesPaid: 0, timesFired: 0 }, sourceLinkOne: { energySent: 0, energyFeesPaid: 0, timesFired: 0 },
				sourceLinkTwo: { energySent: 0, energyFeesPaid: 0, timesFired: 0 }, storageLink: { energySent: 0, energyFeesPaid: 0, timesFired: 0 }, otherLinks: { energySent: 0, energyFeesPaid: 0, timesFired: 0 }
			};
			const mineralsHarvested: MineralStats = { hydrogen: 0, oxygen: 0, utrium: 0, lemergium: 0, keanium: 0, zynthium: 0, catalyst: 0, ghodium: 0 };
			const compoundStats: CompoundStats = {
				hydroxide: 0, zynthiumKeanite: 0, utriumLemergite: 0, utriumHydride: 0, utriumOxide: 0, keaniumHydride: 0, keaniumOxide: 0,
				lemergiumHydride: 0, lemergiumOxide: 0, zynthiumHydride: 0, zynthiumOxide: 0, ghodiumHydride: 0, ghodiumOxide: 0, utriumAcid: 0, utriumAlkalide: 0, keaniumAcid: 0,
				keaniumAlkalide: 0, lemergiumAcid: 0, lemergiumAlkalide: 0, zynthiumAcid: 0, zynthiumAlkalide: 0, ghodiumAcid: 0, ghodiumAlkalide: 0, catalyzedUtriumAcid: 0,
				catalyzedUtriumAlkalide: 0, catalyzedKeaniumAcid: 0, catalyzedKeaniumAlkalide: 0, catalyzedLemergiumAcid: 0, catalyzedLemergiumAlkalide: 0, catalyzedZynthiumAcid: 0,
				catalyzedZynthiumAlkalide: 0, catalyzedGhodiumAcid: 0, catalyzedGhodiumAlkalide: 0
			};
			const labStats: LabStats = { compoundsMade: compoundStats, creepsBoosted: 0, boostsUsed: compoundStats, energySpentBoosting: 0 };
			const roomDataFlags = {
				dropHarvestingEnabled: false,
				basePlanGenerated: false,
				bootstrappingMode: false,
				initialized: true,
				advSpawnSystem: false
			};
			const roomDataIndices = {
				nextHarvesterAssigned: 0,
				haulerIndex: 0,
				lastBootstrapRoleIndex: 0,
				lastNormalRoleIndex: 0
			};
			const roomData = {
				flags: roomDataFlags,
				indices: roomDataIndices,
				controllerLevel: 0,
				numCSites: 0,
				spawnEnergyLimit: 0
			};

			this.room.log(`Initializing memory objects...`);
			if (!this.room.memory.containers) {
				this.room.memory.containers = {
					sourceOne: '' as Id<StructureContainer>,
					sourceTwo: '' as Id<StructureContainer>,
					controller: '' as Id<StructureContainer>,
					mineral: '' as Id<StructureContainer>,
					prestorage: '' as Id<StructureContainer>
				};
			}
			if (this.room.memory.containers) this.room.log(`...<memory>.containers initialized!`);

			if (!this.room.memory.links) {
				this.room.memory.links = {
					sourceOne: '' as Id<StructureLink>,
					sourceTwo: '' as Id<StructureLink>,
					controller: '' as Id<StructureLink>,
					storage: '' as Id<StructureLink>,
					remotes: []
				};
			}
			if (this.room.memory.links) this.room.log(`...<memory>.links initialized!`);

			if (!this.room.memory.data) {
				this.room.memory.data = roomData;
			}
			if (this.room.memory.data) this.room.log(`...<memory>.data initialized!`);

			if (!this.room.memory.settings) {
				this.room.memory.settings = {
					visualSettings: visualSettings,
					repairSettings: repairSettings,
					flags: {},
					basePlanning: {
						debug: false
					}
				};
			}
			if (this.room.memory.settings) this.room.log(`...<memory>.settings initialized!`);

			if (!this.room.memory.stats) {
				this.room.memory.stats = {
					energyHarvested: 0,
					energyDeposited: 0,
					controlPoints: 0,
					constructionPoints: 0,
					creepsSpawned: 0,
					creepPartsSpawned: 0,
					upkeepCosts: upkeepCosts,
					controllerLevelReached: 0,
					npcInvadersKilled: 0,
					hostilePlayerCreepsKilled: 0,
					mineralsHarvested: mineralsHarvested,
					labStats: labStats,
					linkStats: linkStats
				};
			}
			if (this.room.memory.stats) this.room.log(`...<memory>.stats initialized!`);

			if (!this.room.memory.visuals) {
				this.room.memory.visuals = {
					settings: {
						spawnInfo: spawnInfo,
						roomFlags: roomFlags,
						progressInfo: progressInfo,
						displayTowerRanges: false,
						displayControllerUpgradeRange: false
					},
					basePlan: {
						visDistTrans: false,
						visBasePlan: false,
						visFloodFill: false,
						visPlanInfo: false,
						buildProgress: false,
					},
					enableVisuals: false,
					redAlertOverlay: true,
					showPlanning: false
				};
			}
			if (this.room.memory.visuals) this.room.log(`...<memory>.visuals initialized!`);

			if (!this.room.memory.remoteRooms) this.room.memory.remoteRooms = {};
			if (this.room.memory.remoteRooms) this.room.log(`...<memory>.remoteRooms initialized!`);

			this.room.log(`Room Memory fully initialized, caching objects...`);
			this.room.cacheObjects();
			this.room.log(`Initializing spawning quotas...`);
			this.room.initQuotas();
			this.room.log(`Memory Initialization, Spawn Quotas, and Object Caching sequence complete!`);
		} catch (e) {
			console.log(`Execution Error In Function: RoomManager.initializeMemory(${this.room.name}) on Tick ${Game.time}. Error: ${e}`);
		}
	}

	/** Load a stored base plan and rehydrate RoomPositions */
	private loadBasePlanFromMemory(): void {
		try {
			const memPlan = this.room.memory.basePlan?.data as PlanResult | undefined;
			if (!memPlan) return;
			this.basePlan = this.hydratePlan(memPlan);
			this.room.memory.basePlan!.centerPoint = { x: this.basePlan.startPos.x, y: this.basePlan.startPos.y } as any;
		} catch (e) {
			console.log(`Execution Error In Function: RoomManager.loadBasePlanFromMemory(${this.room.name}) on Tick ${Game.time}. Error: ${e}`);
		}
	}

	/** Ensure a base plan exists in memory and on this instance */
	private ensureBasePlanGenerated(): void {
		try {
			const controllerLevel = this.room.controller?.level ?? 0;
			const targetMaxRCL = Math.min(8, (controllerLevel || 0) + 1) as RCLLevel;

			// If we already have a plan that goes far enough, reuse it
			if (this.basePlan && (this.basePlan as any).maxPlannedRCL >= targetMaxRCL) return;
			if (this.room.memory.basePlan?.data) {
				const hydrated = this.hydratePlan(this.room.memory.basePlan.data as PlanResult);
				if ((hydrated as any).maxPlannedRCL >= targetMaxRCL) {
					this.basePlan = hydrated;
					return;
				}
			}

			if (!this.basePlanner) this.basePlanner = new BasePlanner(this.room);
			const plan = this.basePlanner.createPlan(targetMaxRCL);
			if (!plan) return;

			this.basePlan = plan;
			this.savePlanToMemory(plan);
			this.room.memory.data.flags.basePlanGenerated = true;
			this.room.log(`Generated base plan at (${plan.startPos.x},${plan.startPos.y}) for RCL<=${plan.maxPlannedRCL}`);
		} catch (e) {
			console.log(`Execution Error In Function: RoomManager.ensureBasePlanGenerated(${this.room.name}) on Tick ${Game.time}. Error: ${e}`);
		}
	}

	private hydratePlan(raw: PlanResult): PlanResult {
		const startPos = new RoomPosition((raw.startPos as any).x, (raw.startPos as any).y, this.room.name);
		const controllerArea = (raw.controllerArea || []).map((p: any) => new RoomPosition(p.x, p.y, this.room.name));
		const ramparts = (raw.ramparts || []).map((p: any) => new RoomPosition(p.x, p.y, this.room.name));
		return { ...raw, startPos, controllerArea, ramparts };
	}

	private savePlanToMemory(plan: PlanResult): void {
		const serialized: PlanResult = {
			...plan,
			startPos: { x: plan.startPos.x, y: plan.startPos.y, roomName: this.room.name } as any,
			controllerArea: plan.controllerArea.map(p => ({ x: p.x, y: p.y, roomName: p.roomName } as any)),
			ramparts: plan.ramparts.map(p => ({ x: p.x, y: p.y, roomName: p.roomName } as any)),
			maxPlannedRCL: plan.maxPlannedRCL
		};

		this.room.memory.basePlan = {
			lastGenerated: Game.time,
			rclAtGeneration: this.room.controller?.level ?? 0,
			checksum: `${plan.startPos.x},${plan.startPos.y}-${Game.time}`,
			data: serialized
		};
	}

	private updateConstructionSites(): void {
		this.previousCSites = this.constructionSites.length ?? 0;
		this.constructionSites = this.room.find(FIND_MY_CONSTRUCTION_SITES);
		this.currentCSites = this.constructionSites.length ?? 0;
	}

	private manageBuilderQuota(): void {
		const quotas = this.room.memory.quotas;
		const numCSites = this.currentCSites;

		if (numCSites > 3 && quotas.builders !== 3 && quotas.builders < 3) {
			this.room.setQuota('builder', 3);
			this.room.log(`Updated Builder quota based on moderate amount of CSites.`);
		}
		else if (numCSites > 5 && quotas.builders !== 5 && quotas.builders < 5) {
			this.room.setQuota('builder', 5);
			this.room.log(`Updated Builder quota based on large number of CSites.`);
		}
		else if (numCSites === 0 && quotas.builders !== 0) {
			this.room.setQuota('builder', 0);
			this.room.log(`Updated Builder quota based on lack of CSites.`);
		}
		else if (quotas.builders > 1) {
			this.room.setQuota('builder', 1);
			this.room.log(`Updated Builder quota based on low number of CSites.`);
		}
		else return;
	}

	private manageUpgraderQuota(): void {
		// TODO update live energy income/expenditure analysis into algorithm
		const quotas = this.room.memory.quotas;
		const numCSites = this.currentCSites;
		if (numCSites === 0 && quotas.builders < 3 && quotas.upgraders !== 5) {
			this.room.setQuota('upgrader', 5);
			this.room.log(`Updated Upgrader quota based on lack of CSites.`);
		}
		else if (numCSites > 3 && quotas.builders > 1 && quotas.upgraders !== 2) {
			this.room.setQuota('upgrader', 2);
			this.room.log(`Updated Upgrader quota based on large number of CSites.`);
		}
		else if (numCSites < 3 && numCSites > 0 && quotas.upgraders !== 3) {
			this.room.setQuota('upgrader', 3);
			this.room.log(`Updated Upgrader quota based on low number of CSites.`);
		}
		else return;
	}

	private assessRemoteHarvesterNeeds(): void {
		let numRemoteSources = 0;
		const rooms = Object.keys(this.room.memory.remoteRooms);
		for (let i = 0; i < rooms.length; i++)
			numRemoteSources += this.room.memory.remoteRooms[rooms[i]].sources.length;
		if (this.room.memory.quotas.remoteharvesters !== numRemoteSources)
			this.room.setQuota('remoteharvester', numRemoteSources);
		return;
	}

	/** Attempt to place construciton sites for designated RCL schedule. If no parameter is provided, defaults to current RCL. Returns if no RCL schedule is present.
	 * @param rcl The RCL to use for base plan placements
	 * @example
	 * // Places structures acording to RCL 5 building list
	 * Game.rooms.W1N1.manager.attemptBaseUpgrades(5);
	 * // Places structures using the current RCL
	 * Game.rooms.E2S2.manager.attemptBaseUpgrades();
	 */
	public attemptBaseUpgrades(rcl: number = this.room.memory.data.controllerLevel!): void {

		// Object shape
		type structureEntry = {
			pos: {x: number, y: number},
			structure: string,
			priority?: number,
			meta?: { [key: string]: any }
		}

		// Return if no base plan
		if (!this.room.memory.basePlan) return;

		// Save RCL Schedule to working object
		const structureList: structureEntry[] = this.room.memory.basePlan.data.rclSchedule[rcl];

		// Helper method for converting structure as string to BuildableStructureConstant
		const structureStringToConstant = (string: string): BuildableStructureConstant => {
			switch (string) {
				case 'road':
					return STRUCTURE_ROAD;
				case 'extension':
					return STRUCTURE_EXTENSION;
				case 'spawn':
					return STRUCTURE_SPAWN;
				case 'tower':
					return STRUCTURE_TOWER;
				case 'storage':
					return STRUCTURE_STORAGE;
				case 'link':
					return STRUCTURE_LINK;
				case 'terminal':
					return STRUCTURE_TERMINAL;
				case 'lab':
					return STRUCTURE_LAB;
				case 'container':
					return STRUCTURE_CONTAINER;
				case 'nuker':
					return STRUCTURE_NUKER;
				case 'factory':
					return STRUCTURE_FACTORY;
				case 'observer':
					return STRUCTURE_OBSERVER;
				case 'powerSpawn':
					return STRUCTURE_POWER_SPAWN;
				case 'extractor':
					return STRUCTURE_EXTRACTOR;
				case 'rampart':
					return STRUCTURE_RAMPART;
				case 'constructedWall':
					return STRUCTURE_WALL;
				default:
					throw new Error(`Unknown structure type: ${string}`);
			}
		}

		// Sort by priority, low numbers built before higher ones
		structureList.sort((a, b) => {
			const aPri = a.priority ?? 10;
			const bPri = b.priority ?? 10;
			return aPri - bPri
		});

		const totalSites = structureList.length;
		let placedSuccessfully = 0;
		let placedWithErrors = 0;

		// Attempt to place construction sites and count successes/failures
		for (const structEntry of structureList) {
			const structPos = new RoomPosition(structEntry.pos.x, structEntry.pos.y, this.room.name);
			const structConst = structureStringToConstant(structEntry.structure);
			const cSite = this.room.createConstructionSite(structPos, structConst);

			if (cSite === OK) {
				placedSuccessfully++;
			} else {
				this.room.log(`Error placing cSite for '${structConst}' at positon x${structPos.x},y${structPos.y}: ${getReturnCode(cSite)}`);
				placedWithErrors++;
			}
		}

		this.room.log(`All consruction sites placed according to RCL Schedule for RCL${rcl}. ${placedSuccessfully} placed sucessfully, ${placedWithErrors} encoutnered errors.`);
		return;
	}

	/** Sets what tasks need to be prioritized based on new RCL */
	private setRclTasks(rcl: number): void {
		switch (rcl) {
			case 0:
				break;
			case 1:
				// For new room, set quotas for harvesters (they will build their own containers)
				// Then built, and focus energy into upgrader output
				this.room.log(`Setting creep role quotas for early, low-tech spawn system.`);
				this.room.setQuota('harvester', 4) // Ensures 80% utilization per source
				this.room.setQuota('filler', 1);
				this.room.setQuota('hauler', 0);
				this.room.setQuota('builder', 1);
				this.room.setQuota('upgrader', 3);
				this.room.log(`Quotas: Harvesters (4)  Fillers (1)  Haulers (0)  Builders (1)  Upgraders (3)`);
				break;
			case 2:
				this.room.setQuota('filler', 2);
				this.room.log(`Quotas: Fillers (2)`);
				break;
			case 3:
				this.room.setQuota('repairer', 1);
				this.room.log(`Quotas: Repairers (1)`);
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
}
