import RoomDefense from './DefenseManager';
import SpawnManager from './SpawnManager';

import { log } from '@globals';
import { determineBodyParts } from '@funcs/creep/body';

interface RoomData {
	sourceOne?: { source: Id<Source>; container: Id<StructureContainer | ConstructionSite> };
	sourceTwo?: { source: Id<Source>; container: Id<StructureContainer | ConstructionSite> };
	controllerContainer?: Id<StructureContainer | ConstructionSite>;
	mineralContainer?: { mineral: Id<Mineral>; container: Id<StructureContainer | ConstructionSite> };
	lastHarvesterAssigned?: number;
	controllerLevel?: number;
	numCSites?: number;
	logisticalPairs?: any;
	enabledCapabilities: {
		room: { [key: string]: boolean };
		creep: { [key: string]: boolean };
	}
}

interface SpawnManagerMemory {
	queue: any[];
	scheduled: any[];
	deferred?: any[];
	lastProcessed: number;
}

interface RoomMemoryExtension {
	spawnManager?: SpawnManagerMemory;
}

interface RoomResources {
	sources: Source[];
	minerals: Mineral[];
	controller: StructureController | undefined;
	containers: StructureContainer[];
	towers: StructureTower[];
	spawns: StructureSpawn[];
	links: StructureLink[];
	storage: StructureStorage | undefined;
	terminal: StructureTerminal | undefined;
}

interface RoomStats {
	controllerLevel: number;
	energyAvailable: number;
	energyCapacityAvailable: number;
	constructionSites: ConstructionSite[];
	damagedStructures: Structure[];
}

/** Manages all logic and operations for a single room. */
export default class RoomManager {
	private room: Room;
	private resources: RoomResources;
	private stats: RoomStats;
	private spawnManager: SpawnManager;

	constructor(room: Room) {
		this.room = room;
		this.resources = this.scanResources();
		this.stats = this.gatherStats();
		this.spawnManager = new SpawnManager(room);

		// Initialize room memory if needed
		if (!this.room.memory.data) {
			this.room.memory.data = {};
		}
	}

	/** Main run method - called every tick */
	run(): void {

		// Update resources and stats
		this.resources = this.scanResources();
		this.stats = this.gatherStats();

		// Run spawn manager
		this.spawnManager.run();

		// Assess need for bootstrapping mode
		this.updateBootstrapState();

		// Infrastructure planning
		this.planSourceContainers(); // always safe to run
		if (this.stats.controllerLevel >= 2) {
			this.planControllerContainer();
			this.planExtensions();
		}
		if (this.stats.controllerLevel >= 6)
			this.planMineralContainer();

		// Assess creep needs and submit spawn requests
		this.assessCreepNeeds();

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

		// Pull creep role caps from room memory, or set to default value if none are set
		const harvesterTarget 			= _.get(rMem, ['quotas', 'harvesters'], 2);
		const fillerTarget 					= _.get(rMem, ['quotas', 'fillers'], 2);
		const upgraderTarget 				= _.get(rMem, ['quotas', 'upgraders'], 2);
		const builderTarget 				= _.get(rMem, ['quotas', 'builders'], 2);
		const repairerTarget 				= _.get(rMem, ['quotas', 'repairers'], 0);
		const reserverTarget 				= _.get(rMem, ['quotas', 'reservers'], 1);
		const haulerTarget 					= _.get(rMem, ['quotas', 'haulers'], 2);
		const remoteharvesterTarget = _.get(rMem, ['quotas', 'remoteharvesters'], 2);
		const remotebodyguardTarget = _.get(rMem, ['quotas', 'remotebodyguards'], 1);
		const remotehaulerTarget 		= _.get(rMem, ['quotas', 'remotehaulers'], 2);

		// Pull current amount of creeps alive by RFQ (Role For Quota)
		const harvesters 				= _.filter(Game.creeps, (c) => (c.memory.RFQ == 'harvester' 			|| c.memory.role == 'harvester') 			 && c.memory.home == roomName);
		const fillers 					= _.filter(Game.creeps, (c) => (c.memory.RFQ == 'filler' 					|| c.memory.role == 'filler') 				 && c.memory.home == roomName);
		const upgraders 				= _.filter(Game.creeps, (c) => (c.memory.RFQ == 'upgrader' 				|| c.memory.role == 'upgrader') 			 && c.memory.home == roomName);
		const builders 					= _.filter(Game.creeps, (c) => (c.memory.RFQ == 'builder' 				|| c.memory.role == 'builder') 				 && c.memory.home == roomName);
		const repairers 				= _.filter(Game.creeps, (c) => (c.memory.RFQ == 'repairer' 				|| c.memory.role == 'repairer') 			 && c.memory.home == roomName);
		const reservers 				= _.filter(Game.creeps, (c) => (c.memory.RFQ == 'reserver' 				|| c.memory.role == 'reserver') 			 && c.memory.home == roomName);
		const haulers 					= _.filter(Game.creeps, (c) => (c.memory.RFQ == 'hauler' 					|| c.memory.role == 'hauler') 				 && c.memory.home == roomName);
		const remoteharvesters 	= _.filter(Game.creeps, (c) => (c.memory.RFQ == 'remoteharvester' || c.memory.role == 'remoteharvester') && c.memory.home == roomName);
		const remotebodyguards 	= _.filter(Game.creeps, (c) => (c.memory.RFQ == 'remotebodyguard' || c.memory.role == 'remotebodyguard') && c.memory.home == roomName);
		const remotehaulers 		= _.filter(Game.creeps, (c) => (c.memory.RFQ == 'remotehauler' 		|| c.memory.role == 'remotehauler') 	 && c.memory.home == roomName);

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
		const totalRemoteBodyguards = remotebodyguards.length + countPendingRole('remotebodyguard');
		const totalRemoteHaulers = remotehaulers.length + countPendingRole('remotehauler');

		const harvesters_fillers_haulers_satisfied = (
			totalHarvesters >= (rMem.objects?.sources?.length || 2) &&
			totalFillers >= fillerTarget &&
			totalHaulers >= haulerTarget
		);

		// Use energyCapacityAvailable unless we have no harvesters (emergency)
		let cap = this.stats.energyCapacityAvailable;
		if (harvesters.length === 0) {
			cap = this.stats.energyAvailable;
		}

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
			else if (rMem.outposts && totalRemoteHarvesters < rMem.outposts.numSources) {
				const body = determineBodyParts('harvester', cap, this.room);
				if (body) {
					const returnObj = this.room.counter?.next();
					const sourceID = returnObj?.source;
					const containerID = returnObj?.container;

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
			}
		}
	}

	/** Helper method to determine if more harvesters are needed (from main.ts logic) */
	private needMoreHarvesters(): boolean {
		const roomName = this.room.name;
		const harvesters = _.filter(Game.creeps, (c) => (c.memory.RFQ == 'harvester' || c.memory.role == 'harvester') && c.memory.home == roomName);

		const sources = this.resources.sources;
		let totalWorkParts = 0;

		for (const harvester of harvesters) {
			totalWorkParts += harvester.body.filter(part => part.type === WORK).length;
		}

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

	/** Finds valid terrain positions near a given RoomPos for placing a container. */
	private findContainerSpotsNear(pos: RoomPosition, range: number): RoomPosition[] {
		const spots: RoomPosition[] = [];

		for (let dx = -range; dx <= range; dx++) {
			for (let dy = -range; dy <= range; dy++) {
				if (dx === 0 && dy === 0) continue;

				const p = new RoomPosition(pos.x + dx, pos.y + dy, pos.roomName);

				// Skip walls
				if (p.lookFor(LOOK_TERRAIN)[0] === 'wall') continue;

				// Skip existing structures or construction sites
				if (p.lookFor(LOOK_STRUCTURES).length > 0) continue;
				if (p.lookFor(LOOK_CONSTRUCTION_SITES).length > 0) continue;

				spots.push(p);
			}
		}

		return spots;
	}

	/**
 * Ensures there is a container near the controller (for upgraders).
 */
	private planControllerContainer(): void {
		const controller = this.room.controller;
		if (!controller) return;

		const data = (this.room.memory.data ||= {});

		// Skip if we already have a valid record
		if (data.controllerContainer) {
			const obj = Game.getObjectById(data.controllerContainer);
			if (obj && (obj as StructureContainer | ConstructionSite).pos) return;
		}

		// Look for an existing container or site
		const existing = controller.pos.findInRange(FIND_STRUCTURES, 3, {
			filter: s => s.structureType === STRUCTURE_CONTAINER
		})[0] as StructureContainer | undefined;

		if (existing) {
			data.controllerContainer = existing.id;
			return;
		}

		const site = controller.pos.findInRange(FIND_CONSTRUCTION_SITES, 3, {
			filter: s => s.structureType === STRUCTURE_CONTAINER
		})[0] as ConstructionSite | undefined;

		if (site) {
			data.controllerContainer = site.id;
			return;
		}

		// Find a suitable empty position near the controller
		const openSpots = this.findContainerSpotsNear(controller.pos, 3);
		if (openSpots.length > 0) {
			const pos = openSpots[0];
			const result = this.room.createConstructionSite(pos, STRUCTURE_CONTAINER);
			if (result === OK) {
				data.controllerContainer = this.room.lookForAt(LOOK_CONSTRUCTION_SITES, pos.x, pos.y)[0]?.id;
				console.log(`${this.room.name}: Planned controller container at ${pos.x},${pos.y}`);
			}
		}
	}

	/** Ensures there is a container near the room's mineral deposit (RCL >= 6). */
	private planMineralContainer(): void {
		const mineral = this.resources.minerals[0];
		if (!mineral || (this.room.controller?.level ?? 0) < 6) return;

		const data = (this.room.memory.data ||= {});

		if (data.mineralContainer?.container) {
			const obj = Game.getObjectById(data.mineralContainer.container);
			if (obj && (obj as StructureContainer | ConstructionSite).pos) return;
		}

		const existing = mineral.pos.findInRange(FIND_STRUCTURES, 2, {
			filter: s => s.structureType === STRUCTURE_CONTAINER
		})[0] as StructureContainer | undefined;

		if (existing) {
			data.mineralContainer = { mineral: mineral.id, container: existing.id };
			return;
		}

		const site = mineral.pos.findInRange(FIND_CONSTRUCTION_SITES, 2, {
			filter: s => s.structureType === STRUCTURE_CONTAINER
		})[0] as ConstructionSite | undefined;

		if (site) {
			data.mineralContainer = { mineral: mineral.id, container: site.id };
			return;
		}

		const openSpots = this.findContainerSpotsNear(mineral.pos, 2);
		if (openSpots.length > 0) {
			const pos = openSpots[0];
			const result = this.room.createConstructionSite(pos, STRUCTURE_CONTAINER);
			if (result === OK) {
				data.mineralContainer = { mineral: mineral.id, container: this.room.lookForAt(LOOK_CONSTRUCTION_SITES, pos.x, pos.y)[0]?.id };
				console.log(`${this.room.name}: Planned mineral container at ${pos.x},${pos.y}`);
			}
		}
	}

	/** Plans extension construction sites around spawns, respecting RCL limits. */
	private planExtensions(): void {
		if (!this.room.controller?.my) return;

		const spawns = this.resources.spawns;
		if (spawns.length === 0) return;

		const spawn = spawns[0]; // assume main spawn
		const rcl = this.stats.controllerLevel;
		const maxExtensions = CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][rcl];

		// Count existing and in-progress extensions
		const existingExtensions = this.room.find(FIND_STRUCTURES, {
			filter: s => s.structureType === STRUCTURE_EXTENSION
		}).length;
		const plannedExtensions = this.room.find(FIND_CONSTRUCTION_SITES, {
			filter: s => s.structureType === STRUCTURE_EXTENSION
		}).length;

		const total = existingExtensions + plannedExtensions;
		if (total >= maxExtensions) return;

		// Place extensions in expanding rings around spawn
		const spots = this.findOpenPositionsAround(spawn.pos, 2, 8);

		for (const pos of spots) {
			if (this.isBuildableTile(pos)) {
				const result = this.room.createConstructionSite(pos, STRUCTURE_EXTENSION);
				if (result === OK) {
					console.log(`${this.room.name}: Planned extension at ${pos.x},${pos.y}`);
					break; // place one per tick for safety
				}
			}
		}
	}

	/** Returns an array of positions in concentric rings around a center position. */
	private findOpenPositionsAround(center: RoomPosition, minRange: number, maxRange: number): RoomPosition[] {
		const positions: RoomPosition[] = [];

		for (let r = minRange; r <= maxRange; r++) {
			for (let dx = -r; dx <= r; dx++) {
				for (let dy = -r; dy <= r; dy++) {
					if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // perimeter only
					const pos = new RoomPosition(center.x + dx, center.y + dy, center.roomName);
					positions.push(pos);
				}
			}
		}
		return positions;
	}

	/** Checks whether a given position is suitable for construction. */
	private isBuildableTile(pos: RoomPosition): boolean {
		if (pos.lookFor(LOOK_TERRAIN)[0] === 'wall') return false;
		if (pos.lookFor(LOOK_STRUCTURES).length > 0) return false;
		if (pos.lookFor(LOOK_CONSTRUCTION_SITES).length > 0) return false;
		return true;
	}

	/** Manages tower operations (defense and repair) */
	private manageTowers(): void {
		for (const tower of this.resources.towers) {
			RoomDefense(tower);
		}
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

			if (nearSource) {
				sourceLinks.push(link);
			} else {
				sinkLinks.push(link);
			}
		}

		// Transfer energy from full source links to empty sink links
		for (const sourceLink of sourceLinks) {
			if (sourceLink.store.getUsedCapacity(RESOURCE_ENERGY) > 700) {
				const emptySink = sinkLinks.find(
					link => link.store.getFreeCapacity(RESOURCE_ENERGY) > 400
				);
				if (emptySink) {
					sourceLink.transferEnergy(emptySink);
				}
			}
		}
	}

	private updateRoomContainers(): void {
		if (!this.room.memory.objects) this.room.cacheObjects();

		const sources = this.room.find(FIND_SOURCES);

		for (let source of sources) {
			const containers = source.pos.findInRange(FIND_STRUCTURES, 2, { filter: { structureType: STRUCTURE_CONTAINER }});

			if (!this.room.memory.containers.sourceOne) {
				if (source.id === this.room.memory.objects.sources[0])
					this.room.memory.containers.sourceOne = containers[0].id;
				else if (this.room.memory.objects.sources.length > 1 && source.id === this.room.memory.objects.sources[1])
					this.room.memory.containers.sourceTwo = containers[0].id;
			}
		}
	}

	private findSourceContainers(): StructureContainer[] | boolean {
		const sources = this.room.find(FIND_SOURCES);
		let allContainers: StructureContainer[] = [];

		for (let source of sources) {
			const nearbyContainers: StructureContainer[] = source.pos.findInRange(FIND_STRUCTURES, 2, { filter: { structureType: STRUCTURE_CONTAINER }});
			allContainers = allContainers.concat(nearbyContainers);
		}

		return (allContainers.length) ? allContainers : false;
	}

	/** Calculates the energy cost of a body configuration */
	private calculateBodyCost(body: BodyPartConstant[]): number {
		return body.reduce((cost, part) => cost + BODYPART_COST[part], 0);
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

	/** Ensures each source has a container (or construction site) planned near it. */
	private planSourceContainers(): void {
		if (!this.room.controller?.my) return; // only plan in owned rooms

		const data = (this.room.memory.data ||= {});
		const spawn = this.resources.spawns[0];
		if (!spawn) return; // Need a spawn to calculate optimal positions

		for (const [index, source] of this.resources.sources.entries()) {
			const key = index === 0 ? 'sourceOne' : 'sourceTwo';

			// If we already have a valid container reference, skip
			const existingId = data[key]?.container;
			if (existingId) {
				const obj = Game.getObjectById(existingId);
				if (obj && (obj as StructureContainer | ConstructionSite).pos) continue;
			}

			// Look for an existing container nearby
			const existingContainer = source.pos.findInRange(FIND_STRUCTURES, 2, {
				filter: s => s.structureType === STRUCTURE_CONTAINER
			})[0] as StructureContainer | undefined;

			if (existingContainer) {
				data[key] = { source: source.id, container: existingContainer.id };
				continue;
			}

			// Look for an existing construction site nearby
			const site = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 2, {
				filter: s => s.structureType === STRUCTURE_CONTAINER
			})[0] as ConstructionSite | undefined;

			if (site) {
				data[key] = { source: source.id, container: site.id };
				continue;
			}

			// Otherwise, plan a new container position optimized for spawn distance
			const openSpots = this.findContainerSpotsNear(source.pos, 1);
			if (openSpots.length > 0) {
				// Find the spot closest to spawn using PathFinder
				const bestSpot = this.findClosestSpotToSpawn(openSpots, spawn.pos);
				if (bestSpot) {
					const result = this.room.createConstructionSite(bestSpot, STRUCTURE_CONTAINER);
					if (result === OK) {
						console.log(`${this.room.name}: Planned container at ${bestSpot.x},${bestSpot.y} for source ${source.id} (optimized for spawn distance)`);
					}
				}
			}
		}
	}

	/** Finds the position from a list that has the shortest path distance to the spawn. */
	private findClosestSpotToSpawn(positions: RoomPosition[], spawnPos: RoomPosition): RoomPosition | null {
		if (positions.length === 0) return null;
		if (positions.length === 1) return positions[0];

		let bestPos: RoomPosition | null = null;
		let shortestPathLength = Infinity;

		for (const pos of positions) {
			const result = PathFinder.search(spawnPos, { pos, range: 0 }, {
				plainCost: 2,
				swampCost: 10,
				roomCallback: (roomName) => {
					const room = Game.rooms[roomName];
					if (!room) return false;

					const costs = new PathFinder.CostMatrix();

					// Avoid structures
					room.find(FIND_STRUCTURES).forEach(struct => {
						if (struct.structureType !== STRUCTURE_ROAD && struct.structureType !== STRUCTURE_CONTAINER) {
							costs.set(struct.pos.x, struct.pos.y, 0xff);
						}
					});

					// Prefer roads
					room.find(FIND_STRUCTURES, {
						filter: s => s.structureType === STRUCTURE_ROAD
					}).forEach(road => {
						costs.set(road.pos.x, road.pos.y, 1);
					});

					return costs;
				}
			});

			if (!result.incomplete && result.path.length < shortestPathLength) {
				shortestPathLength = result.path.length;
				bestPos = pos;
			}
		}

		return bestPos;
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
}
