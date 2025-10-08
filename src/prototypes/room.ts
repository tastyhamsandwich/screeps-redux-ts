import { log } from '../utils/globalFuncs';
import OutpostSourceCounter from '../classes/OutpostSourceCounter';

type SourceAssignmentUpdate = {
	source: Id<Source> | false,
	container: Id<StructureContainer> | false,
	pathLengthToStorage: number | false,
	pathToStorage: PathFinderPath | false,
	creepAssigned: string | false,
	creepDeathTick: number | false
}

declare global {

	// PROTODEF: Room Prototype Extension
	interface Room {
		getSourcePositions(sourceID: string): RoomPosition[];
		link(): string;
		cacheObjects(): void;
		newSpawnQueue(spawnOrder: SpawnOrder): void;
		initOutpost(roomName: string): void;
		initRoom(): void;
		initFlags(): void;
		updateSourceAssignment(roomToUpdate: string, updateObject: SourceAssignmentUpdate);
		roomSpawnQueue: SpawnOrder[];
		counter: OutpostSourceCounter;
	}

	var __outpostCounters: Map<string, OutpostSourceCounter>;
}

if (!global.__outpostCounters)
	global.__outpostCounters = new Map();

Object.defineProperty(Room.prototype, "counter", {
	get: function (this: Room): OutpostSourceCounter {
		if (!global.__outpostCounters.has(this.name)) {
			const counter = new OutpostSourceCounter(this, this.memory.outposts.counter);
			global.__outpostCounters.set(this.name, counter);
		}
		return global.__outpostCounters.get(this.name)!;
	},
	enumerable: false,
	configurable: false,
});

Room.prototype.getSourcePositions = function (sourceID: string): RoomPosition[] {

	const source = this.find(FIND_SOURCES, { filter: function(s) { return s.id === sourceID }})[0];
	if (!source) return [];
	const sourcePos: RoomPosition = source.pos;

	if (sourcePos) {
		const walkableSourcePos = sourcePos.getWalkablePositions();
		const numberWalkablePositions = walkableSourcePos.length;
		const minimumWorkPartsPerPosition = 5 / numberWalkablePositions;

		const sourceHarvesters: Creep[] = [];

		for (const pos of walkableSourcePos) {
			const creep: Creep[] = pos.lookFor(LOOK_CREEPS).filter((c) => c.my && c.memory.role === 'harvester');
			if (creep.length) sourceHarvesters.push(creep[0]);
		}

		let missingWorkParts = 5;

		for (const creep of sourceHarvesters) {
			const creepWorkParts = creep.getActiveBodyparts(WORK);
			missingWorkParts -= creepWorkParts;
		}
		return walkableSourcePos || [];
	}
	return [];
}

Room.prototype.link = function(): string {
	return `<span color='red'>[<a href="#!/room/${Game.shard.name}/${this.name}">${this.name}</a></span>]: `;
}


// Note: this function is flexible and accepts either a SpawnOrder object (legacy declaration) or positional parameters.
Room.prototype.newSpawnQueue = function(role: any, critical: boolean = false, maxEnergy?: number, name?: string): void {

	if (maxEnergy === undefined) maxEnergy = this.energyCapacityAvailable;
	const colonyNum = this.memory.data.colonyNumber;

	const spawnOrder = {
		role: role,
		body: [], // body can be determined later by the spawn using determineBodyParts
		memory: {
			role: role,
			home: this.name,
			room: this.name,
			working: false
		} as CreepMemory,
		name: name || `${role}_${Game.time}_${Math.floor(Math.random() * 1000)}`,
		critical: critical
	}

	if (!this.roomSpawnQueue) this.roomSpawnQueue = [];
	this.roomSpawnQueue.push(spawnOrder as SpawnOrder);
}

Room.prototype.cacheObjects = function () {

	// declare storage array for objects to cache
	let storageArray: Id<any>[] = [];

	// search room for each object type
	const sources = this.find(FIND_SOURCES);
	const minerals = this.find(FIND_MINERALS);
	const deposits = this.find(FIND_DEPOSITS);
	const allStructures = this.find(FIND_STRUCTURES, {
		filter: (i) => i.structureType == STRUCTURE_CONTROLLER || i.structureType == STRUCTURE_SPAWN || i.structureType == STRUCTURE_EXTENSION || i.structureType == STRUCTURE_TOWER || i.structureType == STRUCTURE_CONTAINER || i.structureType == STRUCTURE_STORAGE || i.structureType == STRUCTURE_RAMPART || i.structureType == STRUCTURE_LINK || i.structureType == STRUCTURE_EXTRACTOR || i.structureType == STRUCTURE_LAB || i.structureType == STRUCTURE_TERMINAL || i.structureType == STRUCTURE_FACTORY || i.structureType == STRUCTURE_POWER_BANK || i.structureType == STRUCTURE_POWER_SPAWN || i.structureType == STRUCTURE_PORTAL || i.structureType == STRUCTURE_OBSERVER || i.structureType == STRUCTURE_KEEPER_LAIR || i.structureType == STRUCTURE_NUKER || i.structureType == STRUCTURE_WALL || i.structureType == STRUCTURE_INVADER_CORE
	});

	const controller = _.filter(allStructures, { structureType: STRUCTURE_CONTROLLER });
	const spawns = _.filter(allStructures, { structureType: STRUCTURE_SPAWN });
	const extensions = _.filter(allStructures, { structureType: STRUCTURE_EXTENSION });
	const towers = _.filter(allStructures, { structureType: STRUCTURE_TOWER });
	const containers = _.filter(allStructures, { structureType: STRUCTURE_CONTAINER });
	const storage = _.filter(allStructures, { structureType: STRUCTURE_STORAGE });
	const ramparts = _.filter(allStructures, { structureType: STRUCTURE_RAMPART });
	const links = _.filter(allStructures, { structureType: STRUCTURE_LINK });
	const extractor = _.filter(allStructures, { structureType: STRUCTURE_EXTRACTOR });
	const labs = _.filter(allStructures, { structureType: STRUCTURE_LAB });
	const terminal = _.filter(allStructures, { structureType: STRUCTURE_TERMINAL });
	const factory = _.filter(allStructures, { structureType: STRUCTURE_FACTORY });
	const observer = _.filter(allStructures, { structureType: STRUCTURE_OBSERVER });
	const powerspawn = _.filter(allStructures, { structureType: STRUCTURE_POWER_SPAWN });
	const nuker = _.filter(allStructures, { structureType: STRUCTURE_NUKER });
	const keeperlairs = _.filter(allStructures, { structureType: STRUCTURE_KEEPER_LAIR });
	const powerbanks = _.filter(allStructures, { structureType: STRUCTURE_POWER_BANK });
	const portals = _.filter(allStructures, { structureType: STRUCTURE_PORTAL });
	const invadercores = _.filter(allStructures, { structureType: STRUCTURE_INVADER_CORE });
	const walls = _.filter(allStructures, { structureType: STRUCTURE_WALL });

	// check if the 'objects' object exists in room memory & create it if not
	if (!this.memory.objects) this.memory.objects = {};

	log('Caching room objects...', this);
	// if sources are found, add their IDs to array and add array to room's 'objects' memory
	if (sources) {
		for (let i = 0; i < sources.length; i++)
			storageArray.push(sources[i].id);
		if (storageArray.length) {
			this.memory.objects.sources = storageArray;
			if (this.memory.hostColony !== undefined) {
				Game.rooms[this.memory.hostColony].memory.outposts.numSources += storageArray.length;
				Game.rooms[this.memory.hostColony].memory.outposts.list[this.name].sourceIDs = storageArray;
			}
			if (storageArray.length > 1)
				log('Cached ' + storageArray.length + ' sources.', this);
			else
				log('Cached 1 source.', this);
		}
		storageArray = [];
	}
	// if minerals are found, add their IDs to array and add array to room's 'objects' memory
	if (minerals) {
		for (let i = 0; i < minerals.length; i++)
			storageArray.push(minerals[i].id);
		if (storageArray.length) {
			this.memory.objects.mineral = [storageArray[0]];
			if (storageArray.length >= 1)
				log('Cached 1 mineral.', this);
		}
		storageArray = [];
	}
	// if deposits are found, add their IDs to array and add array to room's 'objects' memory
	if (deposits) {
		for (let i = 0; i < deposits.length; i++)
			storageArray.push(deposits[i].id);
		if (storageArray.length) {
			this.memory.objects.deposit = [storageArray[0]];
			if (storageArray.length > 1)
				log('Cached ' + storageArray.length + ' deposits.', this);
			else
				log('Cached 1 deposit.', this);
		}
		storageArray = [];
	}
	// if a controller is found, add its ID to array and add array to room's 'objects' memory
	if (controller) {
		for (let i = 0; i < controller.length; i++)
			storageArray.push(controller[i].id);
		if (storageArray.length) {
			this.memory.objects.controller = [storageArray[0]];
			if (this.memory.hostColony !== undefined) {
				Game.rooms[this.memory.hostColony].memory.outposts.list[this.name].controllerID = storageArray[0];
			}
			if (storageArray.length >= 1)
				log('Cached ' + storageArray.length + ' controllers.', this);
			else
				log('Cached 1 controller.', this);
		}
		storageArray = [];
	}
	// if a spawn is found, add its ID to array and add array to room's 'objects' memory
	if (spawns) {
		for (let i = 0; i < spawns.length; i++)
			storageArray.push(spawns[i].id);
		if (storageArray.length) {
			this.memory.objects.spawns = storageArray;
			if (storageArray.length > 1)
				log('Cached ' + storageArray.length + ' spawns.', this);
			else
				log('Cached 1 spawn.', this);
		}
		storageArray = [];
	}
	// if an extension is found, add its ID to array and add array to room's 'objects' memory
	if (extensions) {
		for (let i = 0; i < extensions.length; i++)
			storageArray.push(extensions[i].id);
		if (storageArray.length) {
			this.memory.objects.extensions = storageArray;
			if (storageArray.length > 1)
				log('Cached ' + storageArray.length + ' extensions.', this);
			else
				log('Cached 1 extension.', this);
		}
		storageArray = [];
	}
	// if towers are found, add their IDs to array and add array to room's 'objects' memory
	if (towers) {
		for (let i = 0; i < towers.length; i++)
			storageArray.push(towers[i].id);
		if (storageArray.length) {
			this.memory.objects.towers = storageArray;
			if (storageArray.length > 1)
				log('Cached ' + storageArray.length + ' towers.', this);
			else
				log('Cached 1 tower.', this);
		}
		storageArray = [];
	}
	// if containers are found, add their IDs to array and add array to room's 'objects' memory
	if (containers) {
		for (let i = 0; i < containers.length; i++) {
			storageArray.push(containers[i].id);
			// as we iterate through list of containers, check if that container is close to our first room source,
			// and if so, add it to memory.containers.sourceOne - do the same for sourceTwo
			const nearbySources = containers[i].pos.findInRange(FIND_SOURCES, 2);
			if (nearbySources.length == 1) {
				if (nearbySources[0].id === this.memory.objects.sources[0])
					this.memory.containers.sourceOne = containers[i].id;
				else if (nearbySources[0].id === this.memory.objects.sources[1])
					this.memory.containers.sourceTwo = containers[i].id;
			} else {
				// if not nearby any sources, check if container is nearby the controller, and add it to memory.containers.controller
				const nearbyController = containers[i].pos.findInRange(FIND_STRUCTURES, 3, { filter: { structureType: STRUCTURE_CONTROLLER }});
				if (nearbyController.length == 1)
					this.memory.containers.controller = containers[i].id;
				else {
					// finally, if container is nearby the room mineral, add it to memory.containrs.mineral
					const nearbyMineral = containers[i].pos.findInRange(FIND_MINERALS, 2);
					if (nearbyMineral.length == 1)
						this.memory.containers.mineral = containers[i].id;
				}
			}
		}
		// before we push the storageArray to the memory.objects.containers array,
		// ensure the ordering of items matches the ordering (sourceOne, sourceTwo, controller, mineral)
		if (storageArray.length) {
			let s1, s2, c, m;
			console.log(`Original containers list: ${storageArray}`);
			// populate the s1/s2/c/m IDs
			for (let i = 0; i < storageArray.length; i++) {
				if (storageArray[i] === this.memory.containers.sourceOne)
					s1 = storageArray[i];
				else if (storageArray[i] === this.memory.containers.sourceTwo)
					s2 = storageArray[i];
				else if (storageArray[i] === this.memory.containers.controller)
					c  = storageArray[i];
				else if (storageArray[i] === this.memory.containers.mineral)
					m  = storageArray[i];
			}
			// for each string found, remove entry in its position and replace
			if (s1) storageArray.splice(0, 1, s1);
			if (s2) storageArray.splice(1, 1, s2);
			if (c ) storageArray.splice(2, 1, c );
			if (m ) storageArray.splice(3, 1, m );

			// testing confirmation output
			let items = ``;
			for (let item of storageArray) items = items + `, ${item}`;
			console.log(`Edited containers list: ${items}`);
			console.log(`Memory containers list: ${this.memory.containers.sourceOne}, ${this.memory.containers.sourceTwo}, ${this.memory.containers.controller}, ${this.memory.containers.mineral}`);

			this.memory.objects.containers = storageArray;
			let updateInfo = '';
			if (this.memory.hostColony) {
				const hostRoom = this.memory.hostColony;
				this.memory.outposts.list[hostRoom].containerIDs = storageArray;
				this.memory.objects.containers = storageArray;
				updateInfo = "\n>>> NOTICE: Room is an outpost of a main colony. Updated outpost info with new container IDs.";
			}

			if (storageArray.length > 1)
				log('Cached ' + storageArray.length + ' containers.' + updateInfo, this);
			else
				log('Cached 1 container.', this);
		}
		storageArray = [];
	}
	// if storage is found, add its ID to array and add array to room's 'objects' memory
	if (storage) {
		for (let i = 0; i < storage.length; i++)
			storageArray.push(storage[i].id);
		if (storageArray.length) {
			this.memory.objects.storage = [storageArray[0]];
			if (storageArray.length >= 1)
				log('Cached 1 storage.', this);
		}
		storageArray = [];
	}
	// if ramparts are found, add their IDs to array and add array to room's 'objects' memory
	if (ramparts) {
		for (let i = 0; i < ramparts.length; i++)
			storageArray.push(ramparts[i].id);
		if (storageArray.length) {
			this.memory.objects.ramparts = storageArray;
			if (storageArray.length > 1)
				log('Cached ' + storageArray.length + ' ramparts.', this);
			else
				log('Cached 1 rampart.', this);
		}
		storageArray = [];
	}
	// if links are found, add their IDs to array and add array to room's 'objects' memory
	if (links) {
		for (let i = 0; i < links.length; i++)
			storageArray.push(links[i].id);
		if (storageArray.length) {
			this.memory.objects.links = storageArray;
			if (storageArray.length > 1)
				log('Cached ' + storageArray.length + ' links.', this);
			else
				log('Cached 1 link.', this);
		}
		storageArray = [];
	}
	// if extractors are found, add their IDs to array and add array to room's 'objects' memory
	if (extractor) {
		for (let i = 0; i < extractor.length; i++)
			storageArray.push(extractor[i].id);
		if (storageArray.length) {
			this.memory.objects.extractor = [storageArray[0]];
			if (storageArray.length >= 1)
				log('Cached 1 extractor.', this);
		}
		storageArray = [];
	}
	// if labs are found, add their IDs to array and add array to room's 'objects' memory
	if (labs) {
		for (let i = 0; i < labs.length; i++)
			storageArray.push(labs[i].id);
		if (storageArray.length) {
			this.memory.objects.labs = storageArray;
			if (storageArray.length > 1)
				log('Cached ' + storageArray.length + ' labs.', this);
			else
				log('Cached 1 lab.', this);
		}
		storageArray = [];
	}
	// if terminals are found, add their IDs to array and add array to room's 'objects' memory
	if (terminal) {
		for (let i = 0; i < terminal.length; i++)
			storageArray.push(terminal[i].id);
		if (storageArray.length) {
			this.memory.objects.terminal = [storageArray[0]];
			if (storageArray.length >= 1)
				log('Cached 1 terminal.', this);
		}
		storageArray = [];
	}
	// if factory are found, add their IDs to array and add array to room's 'objects' memory
	if (factory) {
		for (let i = 0; i < factory.length; i++)
			storageArray.push(factory[i].id);
		if (storageArray.length) {
			this.memory.objects.factory = [storageArray[0]];
			if (storageArray.length >= 1)
				log('Cached 1 factory.', this);
		}
		storageArray = [];
	}
	// if observers are found, add their IDs to array and add array to room's 'objects' memory
	if (observer) {
		for (let i = 0; i < observer.length; i++)
			storageArray.push(observer[i].id);
		if (storageArray.length) {
			this.memory.objects.observer = [storageArray[0]];
			if (storageArray.length >= 1)
				log('Cached 1 observer.', this);
		}
		storageArray = [];
	}
	// if power spawns are found, add their IDs to array and add array to room's 'objects' memory
	if (powerspawn) {
		for (let i = 0; i < powerspawn.length; i++)
			storageArray.push(powerspawn[i].id);
		if (storageArray.length) {
			this.memory.objects.powerSpawn = [storageArray[0]];
			if (storageArray.length >= 1)
				log('Cached 1 power spawn.', this);
		}
		storageArray = [];
	}
	// if nukers are found, add their IDs to array and add array to room's 'objects' memory
	if (nuker) {
		for (let i = 0; i < nuker.length; i++)
			storageArray.push(nuker[i].id);
		if (storageArray.length) {
			this.memory.objects.nuker = [storageArray[0]];
				log('Cached 1 nuker.', this);
		}
		storageArray = [];
	}
	// if source keeper lairs are found, add their IDs to array and add array to room's 'objects' memory
	if (keeperlairs) {
		for (let i = 0; i < keeperlairs.length; i++)
			storageArray.push(keeperlairs[i].id);
		if (storageArray.length) {
			this.memory.objects.keeperLairs = storageArray;
			if (storageArray.length > 1)
				log('Cached ' + storageArray.length + ' keeper lairs.', this);
			else
				log('Cached 1 keeper lair.', this);
		}
		storageArray = [];
	}
	// if invader cores are found, add their IDs to array and add array to room's 'objects' memory
	if (invadercores) {
		for (let i = 0; i < invadercores.length; i++)
			storageArray.push(invadercores[i].id);
		if (storageArray.length) {
			this.memory.objects.invaderCores = storageArray;
			if (storageArray.length > 1)
				log('Cached ' + storageArray.length + ' invader cores.', this);
			else
				log('Cached 1 invader core.', this);
		}
		storageArray = [];
	}
	// if power banks are found, add their IDs to array and add array to room's 'objects' memory
	if (powerbanks) {
		for (let i = 0; i < powerbanks.length; i++)
			storageArray.push(powerbanks[i].id);
		if (storageArray.length) {
			this.memory.objects.powerBanks = storageArray;
			if (storageArray.length > 1)
				log('Cached ' + storageArray.length + ' power banks.', this);
			else
				log('Cached 1 power bank.', this);
		}
		storageArray = [];
	}
	// if portals are found, add their IDs to array and add array to room's 'objects' memory
	if (portals) {
		for (let i = 0; i < portals.length; i++)
			storageArray.push(portals[i].id);
		if (storageArray.length) {
			this.memory.objects.portals = storageArray;
			if (storageArray.length > 1)
				log('Cached ' + storageArray.length + ' portals.', this);
			else
				log('Cached 1 portal.', this);
		}
		storageArray = [];
	}
	// if walls are found, add their IDs to array and add array to room's 'objects' memory
	if (walls) {
		for (let i = 0; i < walls.length; i++)
			storageArray.push(walls[i].id);
		if (storageArray.length) {
			this.memory.objects.walls = storageArray;
			if (storageArray.length > 1)
				log('Cached ' + storageArray.length + ' walls.', this);
			else
				log('Cached 1 wall.', this);
		}
		storageArray = [];
	}
	log('Caching objects for room \'' + this.name + '\' completed.', this);
	return true;
}

Room.prototype.initRoom = function () {
	if (this.memory.quotas) this.memory.quotas = {
		harvesters: 2,
		upgraders: 2,
		fillers: 2,
		porters: 2,
		builders: 2,
		repairers: 1,
	};

	const visualSettings: VisualSettings = { progressInfo: { alignment: 'left', xOffset: 1, yOffsetFactor: 0.6, stroke: '#000000', fontSize: 0.6, color: '' } };
	const towerSettings: TowerRepairSettings = { creeps: true, walls: false, ramparts: false, roads: false, others: false, wallLimit: 10, rampartLimit: 10, maxRange: 10 };
	const repairSettings: RepairSettings = { walls: false, ramparts: false, roads: true, others: true, wallLimit: 10, rampartLimit: 10, towerSettings: towerSettings };
	const mineralsHarvested: MineralStats = { hydrogen: 0, oxygen: 0, utrium: 0, lemergium: 0, keanium: 0, zynthium: 0, catalyst: 0, ghodium: 0 };
	const compoundStats: CompoundStats = { hydroxide: 0, zynthiumKeanite: 0, utriumLemergite: 0, utriumHydride: 0, utriumOxide: 0, keaniumHydride: 0, keaniumOxide: 0,
		lemergiumHydride: 0, lemergiumOxide: 0, zynthiumHydride: 0, zynthiumOxide: 0, ghodiumHydride: 0, ghodiumOxide: 0, utriumAcid: 0, utriumAlkalide: 0, keaniumAcid: 0,
		keaniumAlkalide: 0, lemergiumAcid: 0, lemergiumAlkalide: 0, zynthiumAcid: 0, zynthiumAlkalide: 0, ghodiumAcid: 0, ghodiumAlkalide: 0, catalyzedUtriumAcid: 0,
		catalyzedUtriumAlkalide: 0, catalyzedKeaniumAcid: 0, catalyzedKeaniumAlkalide: 0, catalyzedLemergiumAcid: 0, catalyzedLemergiumAlkalide: 0, catalyzedZynthiumAcid: 0,
		catalyzedZynthiumAlkalide: 0, catalyzedGhodiumAcid: 0, catalyzedGhodiumAlkalide: 0 };
	const labStats: LabStats = { compoundsMade: compoundStats, creepsBoosted: 0, boostsUsed: compoundStats, energySpentBoosting: 0 };

	if (!this.memory.containers) this.memory.containers = { sourceOne: '', sourceTwo: '', controller: '', mineral: ''};
	if (!this.memory.data) this.memory.data = { controllerLevel: 0, numCSites: 0, sourceData: { source: [], container: [], lastAssigned: 0 } };
	if (!this.memory.settings) this.memory.settings = { visualSettings: visualSettings, repairSettings: repairSettings,	flags: {} };
	if (!this.memory.outposts) this.memory.outposts = { list: {}, array: [], reserverLastAssigned: 0, numSources: 0, numHarvesters: 0, counter: 0 };
	if (!this.memory.stats) this.memory.stats = { energyHarvested: 0, controlPoints: 0, constructionPoints: 0, creepsSpawned: 0, creepPartsSpawned: 0,
		mineralsHarvested: mineralsHarvested, controllerLevelReached: 0, npcInvadersKilled: 0, hostilePlayerCreepsKilled: 0, labStats: labStats };
}

Room.prototype.initOutpost = function (roomName): void {
	if (this.memory.outposts === undefined) this.memory.outposts = { list: {}, array: [], reserverLastAssigned: 0, numSources: 0, numHarvesters: 0, counter: 0 };

	const sourceIDs: Id<Source>[] = [];
	const containerIDs: Id<StructureContainer>[] = [];
	const controllerID: Id<StructureController> = Game.rooms[roomName].memory.objects.controller as Id<StructureController>;
	const outpostMemoryObject = {
		name: roomName,
		controllerFlag: roomName,
		sourceIDs: sourceIDs,
		containerIDs: containerIDs,
		controllerID: controllerID,
		sourceAssignmentMap: []
	}

	for (let source of sourceIDs) {
		const sourceAssignment = {
			source: source,
			container: null,
			pathLengthToStorage: null,
			pathToStorage: null,
			creepAssigned: null,
			creepDeathTick: null,
		};
		this.memory.outposts.list[this.name].sourceAssignmentMap.push(sourceAssignment);
	}

	Game.rooms[roomName].memory.hostColony = this.name;
	this.memory.outposts.list[roomName] = outpostMemoryObject;
	this.memory.outposts.array.push(roomName);
}
Room.prototype.initFlags = function () {

	if (!this.memory.settings.flags)
		this.memory.settings.flags = {};

	if (this.memory.settings.flags.craneUpgrades === undefined)
		this.memory.settings.flags.craneUpgrades = false;

	if (this.memory.settings.flags.repairRamparts === undefined)
		this.memory.settings.flags.repairRamparts = true;

	if (this.memory.settings.flags.repairWalls === undefined)
		this.memory.settings.flags.repairWalls = true;

	if (this.memory.settings.flags.centralStorageLogic === undefined)
		this.memory.settings.flags.centralStorageLogic = false;

	if (this.memory.settings.flags.dropHarvestingEnabled === undefined)
		this.memory.settings.flags.dropHarvestingEnabled = false;

	if (this.memory.settings.flags.runnersDoMinerals === undefined)
		this.memory.settings.flags.runnersDoMinerals = false;

	if (this.memory.settings.flags.towerRepairBasic === undefined)
		this.memory.settings.flags.towerRepairBasic = false;

	if (this.memory.settings.flags.towerRepairDefenses === undefined)
		this.memory.settings.flags.towerRepairDefenses = false;

	if (this.memory.settings.flags.runnersPickupEnergy === undefined)
		this.memory.settings.flags.runnersPickupEnergy = false;

	if (this.memory.settings.flags.harvestersFixAdjacent === undefined)
		this.memory.settings.flags.harvestersFixAdjacent = false;

	if (this.memory.settings.flags.repairBasics === undefined)
		this.memory.settings.flags.repairBasics = true;

	if (this.memory.settings.flags.upgradersSeekEnergy === undefined)
		this.memory.settings.flags.upgradersSeekEnergy = true;

	if (this.memory.settings.flags.sortConSites === undefined)
		this.memory.settings.flags.sortConSites = false;

	if (this.memory.settings.flags.closestConSites === undefined)
		this.memory.settings.flags.closestConSites = false;

	log('Room flags initialized: craneUpgrades(' + this.memory.settings.flags.craneUpgrades + ') centralStorageLogic(' + this.memory.settings.flags.centralStorageLogic + ') dropHarvestingEnabled(' + this.memory.settings.flags.dropHarvestingEnabled + ') repairRamparts(' + this.memory.settings.flags.repairRamparts + ') repairWalls(' + this.memory.settings.flags.repairWalls + ') runnersDoMinerals(' + this.memory.settings.flags.runnersDoMinerals + ') towerRepairBasic(' + this.memory.settings.flags.towerRepairBasic + ') towerRepairDefenses(' + this.memory.settings.flags.towerRepairDefenses + ') runnersPickupEnergy(' + this.memory.settings.flags.runnersPickupEnergy + ') harvestersFixAdjacent(' + this.memory.settings.flags.harvestersFixAdjacent + ') repairBasics(' + this.memory.settings.flags.repairBasics + ') upgradersSeekEnergy(' + this.memory.settings.flags.upgradersSeekEnergy + ')', this);
	return;
}


Room.prototype.updateSourceAssignment = function(roomToUpdate, updateObject: SourceAssignmentUpdate): boolean {
	let assignmentMap: SourceAssignment[] = [];

	const roomIsOutpost = Game.rooms[roomToUpdate].memory.hostColony ? true : false
	if (roomIsOutpost)
		assignmentMap = Game.rooms[this.memory.hostColony!].memory.outposts.list[this.name].sourceAssignmentMap;
	else
		assignmentMap = Game.rooms[this.name].memory.outposts.list[roomToUpdate].sourceAssignmentMap;

	for (let map of assignmentMap) {
		if (updateObject.source) map.source = updateObject.source;
		if (updateObject.container) map.container = updateObject.container;
		if (updateObject.pathLengthToStorage) map.pathLengthToStorage = updateObject.pathLengthToStorage;
		if (updateObject.pathToStorage) map.pathToStorage = updateObject.pathToStorage;
		if (updateObject.creepAssigned) map.creepAssigned = updateObject.creepAssigned;
		if (updateObject.creepDeathTick) map.creepDeathTick = updateObject.creepDeathTick;
	}
	return true;
}
