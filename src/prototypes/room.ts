import { log, roomExitsTo, calcPath } from '../functions/utils/globals';
import OutpostSourceCounter from '../classes/OutpostSourceCounter';

/** Gets all walkable positions around a source for optimal harvesting placement.
 * @param sourceID - The ID of the source to check positions for
 * @returns Array of RoomPositions that are walkable around the source
 */
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

/** Creates a clickable room link for console output */
Room.prototype.link = function(): string {
	return `<span color='red'>[<a href="#!/room/${Game.shard.name}/${this.name}">${this.name}</a></span>]: `;
}

/** Caches all room objects (sources, minerals, structures, etc.) into memory for faster access. Organizes objects by type and updates relevant container assignments.
 * @returns true when caching is complete
 */
Room.prototype.cacheObjects = function () {

	// Initialize memory structures
	if (!this.memory.objects) this.memory.objects = {};
	if (!this.memory.containers) this.memory.containers = { sourceOne: '', sourceTwo: '', controller: '', mineral: '' };

	log('Caching room objects...', this);

	// Helper function to cache objects
	const cacheObjectArray = (objects: (RoomObject & { id: Id<any> })[], key: string, logName: string, isSingular = false) => {
		if (objects.length === 0) return;

		const ids = objects.map(obj => obj.id);
		this.memory.objects[key] = isSingular ? [ids[0]] : ids;

		const count = isSingular ? 1 : objects.length;
		log(`Cached ${count} ${logName}${count > 1 ? 's' : ''}.`, this);
		return ids;
	};

	// Find and cache sources (sorted left-to-right, then top-to-bottom)
	const sources = this.find(FIND_SOURCES).sort((a, b) => {
		// Sort by X position first (left to right)
		if (a.pos.x !== b.pos.x) return a.pos.x - b.pos.x;
		// If X is same, sort by Y position (top to bottom)
		return a.pos.y - b.pos.y;
	});
	if (sources.length > 0) {
		const sourceIDs = cacheObjectArray(sources, 'sources', 'source');
		if (this.memory.hostColony && sourceIDs) {
			Game.rooms[this.memory.hostColony].memory.outposts.list[this.name].sourceIDs = sourceIDs;
		}
	}

	// Find and cache minerals
	const minerals = this.find(FIND_MINERALS);
	cacheObjectArray(minerals, 'mineral', 'mineral', true);

	// Find and cache deposits
	const deposits = this.find(FIND_DEPOSITS);
	cacheObjectArray(deposits, 'deposit', 'deposit', true);

	// Find and cache controller
	if (this.controller) {
		this.memory.objects.controller = [this.controller.id];
		log('Cached 1 controller.', this);
		if (this.memory.hostColony) {
			Game.rooms[this.memory.hostColony].memory.outposts.list[this.name].controllerID = this.controller.id;
		}
	}

	// Find structures more efficiently by type
	const spawns = this.find(FIND_MY_SPAWNS);
	cacheObjectArray(spawns, 'spawns', 'spawn');

	const extensions = this.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_EXTENSION }});
	cacheObjectArray(extensions, 'extensions', 'extension');

	const towers = this.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER }});
	cacheObjectArray(towers, 'towers', 'tower');

	// Cache containers with position-based assignment
	const containers = this.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_CONTAINER }}) as StructureContainer[];
	if (containers.length > 0) {
		// Reset container memory
		this.memory.containers = { sourceOne: '', sourceTwo: '', controller: '', mineral: '' };

		// Pre-cache positions for efficient lookup
		const sourcePositions = sources.length > 0 ? sources.map(s => ({ id: s.id, pos: s.pos })) : [];
		const controllerPos = this.controller?.pos;
		const mineralPos = minerals.length > 0 ? minerals[0].pos : undefined;

		// Assign containers based on proximity
		for (const container of containers) {
			const pos = container.pos;

			// Check if near sources (within range 2)
			let assigned = false;
			for (let i = 0; i < sourcePositions.length; i++) {
				if (pos.inRangeTo(sourcePositions[i].pos, 2)) {
					if (sourcePositions[i].id === this.memory.objects.sources?.[0])
						this.memory.containers.sourceOne = container.id;
					else if (sourcePositions[i].id === this.memory.objects.sources?.[1])
						this.memory.containers.sourceTwo = container.id;
					assigned = true;
					break;
				}
			}

			// Check if near controller (within range 3)
			if (!assigned && controllerPos && pos.inRangeTo(controllerPos, 3)) {
				this.memory.containers.controller = container.id;
				assigned = true;
			}

			// Check if near mineral (within range 2)
			if (!assigned && mineralPos && pos.inRangeTo(mineralPos, 2))
				this.memory.containers.mineral = container.id;
		}

		// Build ordered container array (sourceOne, sourceTwo, controller, mineral)
		const containerIDs = containers.map(c => c.id);
		const orderedContainers: Id<StructureContainer>[] = [];

		if (this.memory.containers.sourceOne) orderedContainers.push(this.memory.containers.sourceOne as Id<StructureContainer>);
		if (this.memory.containers.sourceTwo) orderedContainers.push(this.memory.containers.sourceTwo as Id<StructureContainer>);
		if (this.memory.containers.controller) orderedContainers.push(this.memory.containers.controller as Id<StructureContainer>);
		if (this.memory.containers.mineral) orderedContainers.push(this.memory.containers.mineral as Id<StructureContainer>);

		// Add any remaining containers not assigned to specific positions
		for (const id of containerIDs) {
			if (!orderedContainers.includes(id))
				orderedContainers.push(id);
		}

		this.memory.objects.containers = orderedContainers;

		// Update outpost info if applicable
		let updateInfo = '';
		if (this.memory.hostColony) {
			Game.rooms[this.memory.hostColony].memory.outposts.list[this.name].containerIDs = orderedContainers;
			updateInfo = "\n>>> NOTICE: Room is an outpost of a main colony. Updated outpost info with new container IDs.";
		}

		log(`Cached ${containers.length} container${containers.length > 1 ? 's' : ''}.${updateInfo}`, this);
	}

	// Cache remaining structures
	const storage = this.storage ? [this.storage] : [];
	cacheObjectArray(storage, 'storage', 'storage', true);

	const ramparts = this.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_RAMPART }});
	cacheObjectArray(ramparts, 'ramparts', 'rampart');

	const links = this.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_LINK }});
	cacheObjectArray(links, 'links', 'link');

	const extractor = this.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_EXTRACTOR }});
	cacheObjectArray(extractor, 'extractor', 'extractor', true);

	const labs = this.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_LAB }});
	cacheObjectArray(labs, 'labs', 'lab');

	const terminal = this.terminal ? [this.terminal] : [];
	cacheObjectArray(terminal, 'terminal', 'terminal', true);

	const factory = this.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_FACTORY }});
	cacheObjectArray(factory, 'factory', 'factory', true);

	const observer = this.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_OBSERVER }});
	cacheObjectArray(observer, 'observer', 'observer', true);

	const powerspawn = this.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_POWER_SPAWN }});
	cacheObjectArray(powerspawn, 'powerSpawn', 'power spawn', true);

	const nuker = this.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_NUKER }});
	cacheObjectArray(nuker, 'nuker', 'nuker', true);

	// Cache hostile/neutral structures
	const keeperlairs = this.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_KEEPER_LAIR }});
	cacheObjectArray(keeperlairs, 'keeperLairs', 'keeper lair');

	const invadercores = this.find(FIND_HOSTILE_STRUCTURES, { filter: { structureType: STRUCTURE_INVADER_CORE }});
	cacheObjectArray(invadercores, 'invaderCores', 'invader core');

	const powerbanks = this.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_POWER_BANK }});
	cacheObjectArray(powerbanks, 'powerBanks', 'power bank');

	const portals = this.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_PORTAL }});
	cacheObjectArray(portals, 'portals', 'portal');

	const walls = this.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_WALL }});
	cacheObjectArray(walls, 'walls', 'wall');

	log('Caching objects for room \'' + this.name + '\' completed.', this);
	return true;
}

/** Initializes a room's quota list. */
Room.prototype.initQuotas = function (roleQuotaObject?): void {
	if (!this.memory.quotas) this.memory.quotas = {};

	this.memory.quotas = {
		harvesters: roleQuotaObject?.harvester || 2,
		upgraders: roleQuotaObject?.upgrader || 2,
		fillers: roleQuotaObject?.filler || 2,
		haulers: roleQuotaObject?.hauler || 0,
		builders: roleQuotaObject?.builder || 1,
		repairers: roleQuotaObject?.repairer || 1,
		defenders: roleQuotaObject?.defender || 0,
		reservers: roleQuotaObject?.reserver || 0,
		scouts: roleQuotaObject?.scout || 0,
		remoteharvesters: roleQuotaObject?.remoteharvester || 0,

	}

	log(`Quotas initialized: Harvesters (2), Upgraders (2), Fillers (2), Haulers (0), Builders (1), Defenders (0), Reservers (0), Scouts (0), Remote Harvesters (0)`);
}

/** Initializes a room with default memory structure and settings. Sets up quotas, visual settings, repair settings, and stats tracking. */
Room.prototype.initRoom = function () {
	this.initQuotas();

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

	if (!this.memory.containers) 	this.memory.containers = { sourceOne: '', sourceTwo: '', controller: '', mineral: ''};
	if (!this.memory.data) 				this.memory.data = { controllerLevel: 0, numCSites: 0, sourceData: { source: [], container: [], lastAssigned: 0 } };
	if (!this.memory.settings) 		this.memory.settings = { visualSettings: visualSettings, repairSettings: repairSettings,	flags: {}, basePlanner: { debug: false } };
	if (!this.memory.outposts) 		this.memory.outposts = { list: {}, array: [], reserverLastAssigned: 0, numSources: 0, numHarvesters: 0, counter: 0, guardCounter: 0 };
	if (!this.memory.stats) 			this.memory.stats = { energyHarvested: 0, controlPoints: 0, constructionPoints: 0, creepsSpawned: 0, creepPartsSpawned: 0,
				mineralsHarvested: mineralsHarvested, controllerLevelReached: 0, npcInvadersKilled: 0, hostilePlayerCreepsKilled: 0, labStats: labStats };
	if (!this.memory.flags) 			this.memory.flags = { advancedSpawnLogic: false, };
	if (!this.memory.visuals) 		this.memory.visuals = { visDistTrans: false, visBasePlan: false, visFloodFill: false, visBuildProgress: false, visPlanInfo: false, enableVisuals: false };

	this.cacheObjects();
}

/** Disables all BasePlanner room visuals */
Room.prototype.toggleBasePlannerVisuals = function (): void {
	this.memory.visuals.visDistTrans = !this.memory.visuals.visDistTrans;
	this.memory.visuals.visFloodFill = !this.memory.visuals.visFloodFill;
	this.memory.visuals.visBasePlan  = !this.memory.visuals.visBasePlan;
	this.memory.visuals.visBuildProgress = !this.memory.visuals.visBuildProgress;
	this.memory.visuals.visPlanInfo = !this.memory.visuals.visBuildProgress;
	log(`Base Planner visuals are now set to '${this.memory.visuals.visDistTrans}'`);
}

/** Gets the RoomManager instance for this room (if it exists) */
Object.defineProperty(Room.prototype, 'manager', {
	get: function(this: Room) {
		if (!global.roomManagers) return undefined;
		return global.roomManagers[this.name];
	},
	enumerable: false,
	configurable: true
});

/** Initializes an outpost room with necessary memory structures.
 * @param roomName - The name of the room to initialize as an outpost
 */
Room.prototype.initOutpost = function (roomName): void {
	if (this.memory.outposts === undefined) this.memory.outposts = { list: {}, array: [], reserverLastAssigned: 0, numSources: 0, numHarvesters: 0, counter: 0, guardCounter: 0 };

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

/** Initializes room flags with default settings. Sets up various behavior flags for creeps and structures. */
Room.prototype.initFlags = function () {

	const flagSettings = this.memory.settings.flags;

	if (!this.memory.settings.flags)
		this.memory.settings.flags = {};

	if (flagSettings.haulersPickupEnergy === undefined)
		flagSettings.haulersPickupEnergy = false;

	if (flagSettings.closestConSites === undefined)
		flagSettings.closestConSites = false;

	log(`Room flags initialized: haulersPickupEnergy(${flagSettings.haulersPickupEnergy}), closestConSites(${flagSettings.closestConSites})`, this);
	return;
}

/** Updates source assignments in a room's memory.
 * @param roomToUpdate - Name of the room to update assignments for
 * @param updateObject - Object containing the assignment updates
 * @returns true if the update was successful
 */
Room.prototype.updateSourceAssignment = function(roomToUpdate, updateObject: SourceAssignmentUpdate): boolean {
	let assignmentMap: SourceAssignment[] = [];

	const roomIsOutpost = Game.rooms[roomToUpdate].memory.hostColony ? true : false
	if (roomIsOutpost) assignmentMap = Game.rooms[this.memory.hostColony!].memory.outposts.list[this.name].sourceAssignmentMap;
	else assignmentMap = Game.rooms[this.name].memory.outposts.list[roomToUpdate].sourceAssignmentMap;

	for (let map of assignmentMap) {
		if (updateObject.source) 							map.source = updateObject.source;
		if (updateObject.container) 					map.container = updateObject.container;
		if (updateObject.pathLengthToStorage) map.pathLengthToStorage = updateObject.pathLengthToStorage;
		if (updateObject.pathToStorage) 			map.pathToStorage = updateObject.pathToStorage;
		if (updateObject.creepAssigned) 			map.creepAssigned = updateObject.creepAssigned;
		if (updateObject.creepDeathTick) 			map.creepDeathTick = updateObject.creepDeathTick;
	}
	return true;
}

/** Discovers and registers all possible resource transfer routes in the room.
 * Creates pairs of source/destination structures for haulers to work between
 * @returns true if valid pairs were registered, false otherwise
 */
Room.prototype.registerLogisticalPairs = function (): boolean {

	//* Discover all resource locations, and any links in the room
	const sources: Source[] = this.find(FIND_SOURCES);
	const minerals: Mineral[] = this.find(FIND_MINERALS);
	const linkDrops: StructureLink[] = this.find(FIND_STRUCTURES, { filter: (i) => i.structureType == STRUCTURE_LINK && (i.pos.x <= 2 || i.pos.x >= 47 || i.pos.y <= 2 || i.pos.y >= 47) });
	const extractor: StructureExtractor[] = this.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_EXTRACTOR } });
	let extractorBuilt: boolean = false;
	const mineralContainers: StructureContainer[] =  minerals[0].pos.findInRange(FIND_STRUCTURES, 2, { filter: { structureType: STRUCTURE_CONTAINER } });
	let mineralOutbox;
	let energyInbox: Id<StructureContainer>;
	let logisticalPairs: LogisticsPair[] = [];

	if (extractor.length)
		extractorBuilt = true;

	if (mineralContainers.length)
		mineralOutbox = mineralContainers[0].id;

	//* If there is a container by the controller, put it's ID in the energyInbox
	const energyInboxArray: StructureContainer[] | undefined = this.controller?.pos.findInRange(FIND_STRUCTURES, 3, { filter: { structureType: STRUCTURE_CONTAINER } });
	if (energyInboxArray && energyInboxArray.length > 0) energyInbox = energyInboxArray[0].id;

	//* Capture the room storage ID, if it exists
	let storage: Id<StructureStorage>;
	if (this.storage) storage = this.storage.id;

	//* Find any containers by energy sources, put their IDs in the energyOutboxes
	let sourceBoxes: Array<StructureContainer> = [];
	if (this.memory.containers.sourceOne) {
		const sourceOneBox: StructureContainer | null = Game.getObjectById(this.memory.containers.sourceOne);
		if (sourceOneBox)	sourceBoxes.push(sourceOneBox);
	}
	if (this.memory.containers.sourceTwo) {
		const sourceTwoBox: StructureContainer | null = Game.getObjectById(this.memory.containers.sourceTwo);
		if (sourceTwoBox)	sourceBoxes.push(sourceTwoBox);
	}

	if (sourceBoxes.length == 0 && !sourceBoxes) this.memory.data.noPairs = true;
	else if (this.memory.data.noPairs) delete this.memory.data.noPairs;

	//* Ensure that our found energyInbox conforms to the room's container memory
	if (energyInboxArray && this.memory.containers.controller !== energyInboxArray[0].id)
		this.memory.containers.controller = energyInboxArray[0].id;

	//* For room's with a storage built
	if (this.storage) {
		//* Build the local source to storage pairs
		for (let i = 0; i < sourceBoxes.length; i++) {
			const onePair: LogisticsPair = { source: sourceBoxes[i].id, destination: this.storage.id, resource: 'energy', locality: 'local', descriptor: 'source to storage' };
			if (onePair.source && onePair.destination) logisticalPairs.push(onePair);
			else log('Malformed Pair: ' + onePair, this);
		}

		// DEPRECATED CODE BLOCK FOR PROCESSING "REMOTE LINKS"
		//(links built along room borders for transferring from remote sources from other rooms to the room storage, typically)
		/*
		if (this.memory.outposts) {
			if (this.memory.data.linkRegistry) {
				const remoteLinks = this.memory.data.linkRegistry.remotes;
				if (remoteLinks.north) {
					const northContainers = Game.rooms[roomExitsTo(this.name, 1)].memory.objects.containers;
					for (let i = 0; i < northContainers.length; i++) {
						const remotePair: LogisticsPair = { source: northContainers[i], destination: remoteLinks.north, resource: 'energy', locality: 'remote', descriptor: 'north source to homelink' };
						logisticalPairs.push(remotePair);
					}
				}
				if (remoteLinks.east) {
					const eastContainers = Game.rooms[roomExitsTo(this.name, 3)].memory.objects.containers;
					for (let i = 0; i < eastContainers.length; i++) {
						const remotePair: LogisticsPair = { source: eastContainers[i], destination: remoteLinks.east, resource: 'energy', locality: 'remote', descriptor: 'east source to homelink' };
						logisticalPairs.push(remotePair);
					}
				}
				if (remoteLinks.south) {
					const southContainers = Game.rooms[roomExitsTo(this.name, 5)].memory.objects.containers;
					for (let i = 0; i < southContainers.length; i++) {
						const remotePair: LogisticsPair = { source: southContainers[i], destination: remoteLinks.south, resource: 'energy', locality: 'remote', descriptor: 'south source to homelink' };
						logisticalPairs.push(remotePair);
					}
				}
				if (remoteLinks.west) {
					const westContainers = Game.rooms[roomExitsTo(this.name, 7)].memory.objects.containers;
					for (let i = 0; i < westContainers.length; i++) {
						const remotePair: LogisticsPair = { source: westContainers[i], destination: remoteLinks.west, resource: 'energy', locality: 'remote', descriptor: 'west source to homelink' };
					}
				}
			} else {
				if (Game.rooms[roomExitsTo(this.name, 1)].memory.objects.containers) {
					for (let i = 0; i < Game.rooms[roomExitsTo(this.name, 1)].memory.objects.containers.length; i++) {
						const remotePair: LogisticsPair = { source: Game.rooms[roomExitsTo(this.name, 1)].memory.objects.containers[i], destination: this.storage.id, resource: 'energy', locality: 'remote', descriptor: 'north source to storage' };
						logisticalPairs.push(remotePair);
					}
				}
				if (Game.rooms[roomExitsTo(this.name, 3)].memory.objects.containers) {
					for (let i = 0; i < Game.rooms[roomExitsTo(this.name, 3)].memory.objects.containers.length; i++) {
						const remotePair: LogisticsPair = { source: Game.rooms[roomExitsTo(this.name, 3)].memory.objects.containers[i], destination: this.storage.id, resource: 'energy', locality: 'remote', descriptor: 'east source to storage' };
						logisticalPairs.push(remotePair);
					}
				}
				if (Game.rooms[roomExitsTo(this.name, 5)].memory.objects.containers) {
					for (let i = 0; i < Game.rooms[roomExitsTo(this.name, 5)].memory.objects.containers.length; i++) {
						const remotePair: LogisticsPair = { source: Game.rooms[roomExitsTo(this.name, 5)].memory.objects.containers[i], destination: this.storage.id, resource: 'energy', locality: 'remote', descriptor: 'south source to storage' };
						logisticalPairs.push(remotePair);
					}
				}
				if (Game.rooms[roomExitsTo(this.name, 7)].memory.objects.containers) {
					for (let i = 0; i < Game.rooms[roomExitsTo(this.name, 7)].memory.objects.containers.length; i++) {
						const remotePair: LogisticsPair = { source: Game.rooms[roomExitsTo(this.name, 7)].memory.objects.containers[i], destination: this.storage.id, resource: 'energy', locality: 'remote', descriptor: 'west source to storage' };
						logisticalPairs.push(remotePair);
					}
				}
			}
		} */

		//* Build the storage to upgrader box pair
		if (energyInboxArray && energyInboxArray.length > 0) {
			const onePairStoU: LogisticsPair = { source: this.storage.id, destination: energyInboxArray[0].id, resource: 'energy', locality: 'local', descriptor: 'storage to upgrader' };
			if (onePairStoU.source && onePairStoU.destination) logisticalPairs.push(onePairStoU);
			else log('Malformed Pair: ' + onePairStoU, this);
			this.memory.containers.controller = energyInboxArray[0].id;
		}

		//* Build the extractor box to storage pair
		if (extractorBuilt && typeof mineralOutbox === 'string') {
			log('mineralOutbox: ' + mineralOutbox, this);
			log('storage: ' + this.storage.id, this);
			const minType: MineralConstant = minerals[0].mineralType;
			const onePair: LogisticsPair = { source: mineralOutbox, destination: this.storage.id, resource: minType, locality: 'local', descriptor: 'extractor to storage' };
			if (onePair.source && onePair.destination) logisticalPairs.push(onePair);
			else log('Malformed Pair: ' + onePair, this);
		}
		//* For rooms without storage
	} else {
		//* Build the local source to upgrader box pairs
		for (let i = 0; i < sourceBoxes.length; i++) {
			const onePair: LogisticsPair = { source: sourceBoxes[i].id, destination: energyInboxArray![0].id, resource: 'energy', locality: 'local', descriptor: 'source to upgrader' };
			if (onePair.source && onePair.destination) logisticalPairs.push(onePair);
			else log('Malformed Pre-Storage Pair: ' + onePair, this);
		}
	}

	//* Calculate the path lengths for each pair and append
	for (let i = 0; i < logisticalPairs.length; i++) {
		const pair: LogisticsPair = logisticalPairs[i];
		const startPos: StructureStorage | StructureContainer = Game.getObjectById(pair.source)!;
		const endPos = Game.getObjectById(pair.destination);

		if (startPos && endPos) {
			let pathObj = calcPath(startPos.pos, endPos.pos);
			let pathLen: number = pathObj.length;
			logisticalPairs[i].distance = pathLen;
		}
	}

	// DEPRECATED/UNUSED CODE BLOCK FOR SPLITTING LONG ROUTES INTO TWO PAIRS TO TRICK THE SPAWN LOGIC INTO PUTTING MLTIPLE HAULERS ON THE ROUTE
	/*
	let finalizedPairs: LogisticsPair[] = [];
	for (let i = 0; i < logisticalPairs.length; i++) {
	  if (logisticalPairs[i].distance >= 60) {
		let clonedHalfPair: LogisticsPair = logisticalPairs[i];
		clonedHalfPair.distance = Math.ceil(clonedHalfPair.distance / 2);
		finalizedPairs.push(clonedHalfPair);
		finalizedPairs.push(clonedHalfPair);
	  } else {
		const clonedPair: LogisticsPair = logisticalPairs[i];
		finalizedPairs.push(clonedPair);
	  }
	}
	*/

	//* Ensure data objects exist
	if (!this.memory.data) this.memory.data = {};
	if (!this.memory.data.logisticalPairs) this.memory.data.logisticalPairs = [];
	if (!this.memory.data.pairCounter) this.memory.data.pairCounter = 0;

	//* Clear the pair paths if they exist already
	if (this.memory.data.pairPaths) {
		delete this.memory.data.pairPaths;
		this.memory.data.pairPaths = [];
	}
	//* Ensure the pair paths do exist, though
	if (!this.memory.data.pairPaths) this.memory.data.pairPaths = [];

	//* Prepare the pair report
	let pairReport: string[];
	if (logisticalPairs.length > 1) {
		pairReport = ['------------------------------------------------- REGISTERED LOGISTICAL PAIRS --------------------------------------------------'];
		for (let i = 0; i < logisticalPairs.length; i++)
			pairReport.push(' PAIR #' + (i + 1) + ': OUTBOX> ' + logisticalPairs[i].source + ' | INBOX> ' + logisticalPairs[i].destination + ' | CARGO> ' + logisticalPairs[i].resource + ' | LOCALITY> ' + logisticalPairs[i].locality + ' | TYPE> ' + logisticalPairs[i].descriptor + '');
	} else pairReport = ['No pairs available to register properly.'];

	//* Push those pairs to memory then set the hauler spawn target to match the number of pairs
	this.memory.data.logisticalPairs = logisticalPairs;

	this.setQuota('hauler', this.memory.data.logisticalPairs.length);
	log(pairReport, this);
	if (logisticalPairs.length > 1) return true;
	else return false;
}

/** Sets the target number of creeps for a specific role.
 * @param roleTarget - The role to set the quota for
 * @param newTarget - The new target number of creeps
 */
Room.prototype.setQuota = function (roleTarget: CreepRole, newTarget: number) {

	const pluralRoleTarget: string = roleTarget + 's';
	const oldTarget = this.memory.quotas[pluralRoleTarget];
	this.memory.quotas[pluralRoleTarget] = newTarget;

	log('Set role \'' + pluralRoleTarget + '\' quota to ' + newTarget + ' (was ' + oldTarget + ').', this);
	return;
}
