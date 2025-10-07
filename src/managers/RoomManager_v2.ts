interface RoomData {
	sourceOne?: { source: Id<Source>; container: Id<StructureContainer | ConstructionSite> };
	sourceTwo?: { source: Id<Source>; container: Id<StructureContainer | ConstructionSite> };
}

interface SpawnRequest {
	role: string;
	priority: number;
	body: BodyPartConstant[];
	memory: CreepMemory;
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

/**
 * Manages all logic and operations for a single room.
 */
export class RoomManager {
	private room: Room;
	private resources: RoomResources;
	private stats: RoomStats;
	private spawnQueue: SpawnRequest[];

	constructor(room: Room) {
		this.room = room;
		this.resources = this.scanResources();
		this.stats = this.gatherStats();
		this.spawnQueue = [];

		// Initialize room memory if needed
		if (!this.room.memory.data) {
			this.room.memory.data = {};
		}
	}

	/**
	 * Main run method - called every tick
	 */
	run(): void {
		// Update resources and stats
		this.resources = this.scanResources();
		this.stats = this.gatherStats();

		// Assess creep needs and populate spawn queue
		this.assessCreepNeeds();

		// Process spawn queue
		this.processSpawnQueue();

		// Assign tasks to worker creeps
		this.assignCreepTasks();

		// Manage towers
		this.manageTowers();

		// Manage links (if any)
		if (this.resources.links.length > 0) {
			this.manageLinks();
		}
	}

	/**
	 * Scans the room for all relevant structures and resources
	 */
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

	/**
	 * Gathers current room statistics
	 */
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

	/**
	 * Determines repair priority for structures
	 */
	private getRepairPriority(structure: Structure): number {
		const hitsPercent = structure.hits / structure.hitsMax;

		// Critical structures get highest priority
		if (structure.structureType === STRUCTURE_TOWER) return 100 - hitsPercent * 100;
		if (structure.structureType === STRUCTURE_SPAWN) return 95 - hitsPercent * 100;
		if (structure.structureType === STRUCTURE_EXTENSION) return 80 - hitsPercent * 100;
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

	/**
	 * Assesses which creeps are needed and adds spawn requests to queue
	 */
	private assessCreepNeeds(): void {
		const creeps = this.room.find(FIND_MY_CREEPS);
		const creepsByRole = this.groupCreepsByRole(creeps);

		// Count creeps by role
		const harvesterCount = creepsByRole['harvester']?.length || 0;
		const haulerCount = creepsByRole['hauler']?.length || 0;
		const builderCount = creepsByRole['builder']?.length || 0;
		const upgraderCount = creepsByRole['upgrader']?.length || 0;
		const repairerCount = creepsByRole['repairer']?.length || 0;

		// Determine needs based on room state
		const sourceCount = this.resources.sources.length;
		const hasContainer = this.resources.containers.length > 0;

		// Emergency: need at least one harvester
		if (harvesterCount === 0) {
			this.addSpawnRequest('harvester', 100, this.getHarvesterBody(), { role: 'harvester', home: this.room.name, room: this.room.name });
		}

		// Need harvesters for each source
		if (harvesterCount < sourceCount) {
			this.addSpawnRequest('harvester', 90, this.getHarvesterBody(), { role: 'harvester', home: this.room.name, room: this.room.name });
		}

		// Need haulers if we have containers
		if (hasContainer && haulerCount < Math.max(2, sourceCount)) {
			this.addSpawnRequest('hauler', 85, this.getHaulerBody(), { role: 'hauler', home: this.room.name, room: this.room.name });
		}

		// Need builders if there are construction sites
		if (this.stats.constructionSites.length > 0 && builderCount < 2) {
			this.addSpawnRequest('builder', 70, this.getWorkerBody(), { role: 'builder', home: this.room.name, room: this.room.name });
		}

		// Need repairers if there are damaged structures
		if (this.stats.damagedStructures.length > 3 && repairerCount < 1) {
			this.addSpawnRequest('repairer', 65, this.getWorkerBody(), { role: 'repairer', home: this.room.name, room: this.room.name });
		}

		// Always need upgraders
		const desiredUpgraders = this.stats.controllerLevel < 4 ? 2 : 3;
		if (upgraderCount < desiredUpgraders) {
			this.addSpawnRequest('upgrader', 60, this.getWorkerBody(), { role: 'upgrader', home: this.room.name, room: this.room.name });
		}
	}

	/**
	 * Groups creeps by their role
	 */
	private groupCreepsByRole(creeps: Creep[]): Record<string, Creep[]> {
		const grouped: Record<string, Creep[]> = {};

		for (const creep of creeps) {
			const role = creep.memory.role;
			if (!grouped[role]) {
				grouped[role] = [];
			}
			grouped[role].push(creep);
		}

		return grouped;
	}

	/**
	 * Adds a spawn request to the queue if it doesn't already exist
	 */
	private addSpawnRequest(role: string, priority: number, body: BodyPartConstant[], memory: CreepMemory): void {
		// Check if we already have a request for this role
		const existingRequest = this.spawnQueue.find(req => req.role === role);
		if (existingRequest) return;

		this.spawnQueue.push({ role, priority, body, memory });
		this.spawnQueue.sort((a, b) => b.priority - a.priority);
	}

	/**
	 * Processes the spawn queue and spawns creeps
	 */
	private processSpawnQueue(): void {
		if (this.spawnQueue.length === 0) return;

		const availableSpawn = this.resources.spawns.find(spawn => !spawn.spawning);
		if (!availableSpawn) return;

		const request = this.spawnQueue[0];

		// Check if we can afford this creep
		const cost = this.calculateBodyCost(request.body);
		if (this.stats.energyAvailable < cost) return;

		const name = `${request.role}_${Game.time}`;
		const result = availableSpawn.spawnCreep(request.body, name, { memory: request.memory });

		if (result === OK) {
			console.log(`${this.room.name}: Spawning ${request.role} (${name})`);
			this.spawnQueue.shift(); // Remove the request from queue
		}
	}

	/**
	 * Assigns tasks to worker creeps based on room needs
	 */
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

	/**
	 * Assigns dynamic tasks to worker creeps based on priorities
	 */
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

	/**
	 * Manages tower operations (defense and repair)
	 */
	private manageTowers(): void {
		for (const tower of this.resources.towers) {
			// Priority 1: Attack hostile creeps
			const hostiles = this.room.find(FIND_HOSTILE_CREEPS);
			if (hostiles.length > 0) {
				const target = tower.pos.findClosestByRange(hostiles);
				if (target) {
					tower.attack(target);
					continue;
				}
			}

			// Priority 2: Heal damaged friendly creeps
			const damagedCreeps = this.room.find(FIND_MY_CREEPS, {
				filter: (c) => c.hits < c.hitsMax
			});
			if (damagedCreeps.length > 0) {
				const target = tower.pos.findClosestByRange(damagedCreeps);
				if (target) {
					tower.heal(target);
					continue;
				}
			}

			// Priority 3: Repair critical structures (if tower has enough energy)
			if (tower.store.getUsedCapacity(RESOURCE_ENERGY) > 500) {
				const criticalStructure = this.stats.damagedStructures.find(
					s => s.hits < s.hitsMax * 0.3 && s.pos.getRangeTo(tower) < 20
				);
				if (criticalStructure) {
					tower.repair(criticalStructure);
				}
			}
		}
	}

	/**
	 * Manages link energy transfers
	 */
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

	/**
	 * Generates a harvester body based on available energy
	 */
	private getHarvesterBody(): BodyPartConstant[] {
		const energy = this.stats.energyCapacityAvailable;

		if (energy >= 550) {
			return [WORK, WORK, WORK, WORK, WORK, MOVE];
		} else if (energy >= 350) {
			return [WORK, WORK, WORK, MOVE];
		} else {
			return [WORK, WORK, MOVE];
		}
	}

	/**
	 * Generates a hauler body based on available energy
	 */
	private getHaulerBody(): BodyPartConstant[] {
		const energy = this.stats.energyCapacityAvailable;

		if (energy >= 600) {
			return [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
		} else if (energy >= 400) {
			return [CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
		} else {
			return [CARRY, CARRY, MOVE, MOVE];
		}
	}

	/**
	 * Generates a worker body (builder/repairer/upgrader) based on available energy
	 */
	private getWorkerBody(): BodyPartConstant[] {
		const energy = this.stats.energyCapacityAvailable;

		if (energy >= 800) {
			return [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
		} else if (energy >= 550) {
			return [WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
		} else if (energy >= 350) {
			return [WORK, WORK, CARRY, CARRY, MOVE, MOVE];
		} else {
			return [WORK, CARRY, MOVE, MOVE];
		}
	}

	/**
	 * Calculates the energy cost of a body configuration
	 */
	private calculateBodyCost(body: BodyPartConstant[]): number {
		return body.reduce((cost, part) => cost + BODYPART_COST[part], 0);
	}

	/**
	 * Gets the current room resources (for external access)
	 */
	getResources(): RoomResources {
		return this.resources;
	}

	/**
	 * Gets the current room stats (for external access)
	 */
	getStats(): RoomStats {
		return this.stats;
	}

	/**
	 * Gets the current spawn queue (for external access)
	 */
	getSpawnQueue(): SpawnRequest[] {
		return this.spawnQueue;
	}
}
