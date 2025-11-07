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

	// declare storage array for objects to cache
	let storageArray: Id<any>[] = [];

	// search room for each object type
	const sources = 			this.find(FIND_SOURCES);
	const minerals = 			this.find(FIND_MINERALS);
	const deposits = 			this.find(FIND_DEPOSITS);
	const allStructures = this.find(FIND_STRUCTURES,
		{	filter: (i) =>
			i.structureType == STRUCTURE_CONTROLLER 	|| i.structureType == STRUCTURE_SPAWN 			||
			i.structureType == STRUCTURE_EXTENSION 		|| i.structureType == STRUCTURE_TOWER 			||
			i.structureType == STRUCTURE_CONTAINER 		|| i.structureType == STRUCTURE_STORAGE 		||
			i.structureType == STRUCTURE_RAMPART 			|| i.structureType == STRUCTURE_LINK 				||
			i.structureType == STRUCTURE_EXTRACTOR 		|| i.structureType == STRUCTURE_LAB 				||
			i.structureType == STRUCTURE_TERMINAL 		|| i.structureType == STRUCTURE_FACTORY 		||
			i.structureType == STRUCTURE_POWER_BANK 	|| i.structureType == STRUCTURE_POWER_SPAWN ||
			i.structureType == STRUCTURE_PORTAL 			|| i.structureType == STRUCTURE_OBSERVER 		||
			i.structureType == STRUCTURE_KEEPER_LAIR 	|| i.structureType == STRUCTURE_NUKER 			||
			i.structureType == STRUCTURE_WALL 				|| i.structureType == STRUCTURE_INVADER_CORE
	});

	const controller = 		_.filter(allStructures, { structureType: STRUCTURE_CONTROLLER 	});
	const spawns = 				_.filter(allStructures, { structureType: STRUCTURE_SPAWN 				});
	const extensions = 		_.filter(allStructures, { structureType: STRUCTURE_EXTENSION 		});
	const towers = 				_.filter(allStructures, { structureType: STRUCTURE_TOWER 				});
	const containers = 		_.filter(allStructures, { structureType: STRUCTURE_CONTAINER 		});
	const storage = 			_.filter(allStructures, { structureType: STRUCTURE_STORAGE 			});
	const ramparts = 			_.filter(allStructures, { structureType: STRUCTURE_RAMPART 			});
	const links = 				_.filter(allStructures, { structureType: STRUCTURE_LINK 				});
	const extractor = 		_.filter(allStructures, { structureType: STRUCTURE_EXTRACTOR 		});
	const labs = 					_.filter(allStructures, { structureType: STRUCTURE_LAB 					});
	const terminal = 			_.filter(allStructures, { structureType: STRUCTURE_TERMINAL 		});
	const factory = 			_.filter(allStructures, { structureType: STRUCTURE_FACTORY 			});
	const observer = 			_.filter(allStructures, { structureType: STRUCTURE_OBSERVER 		});
	const powerspawn = 		_.filter(allStructures, { structureType: STRUCTURE_POWER_SPAWN 	});
	const nuker = 				_.filter(allStructures, { structureType: STRUCTURE_NUKER 				});
	const keeperlairs = 	_.filter(allStructures, { structureType: STRUCTURE_KEEPER_LAIR 	});
	const powerbanks = 		_.filter(allStructures, { structureType: STRUCTURE_POWER_BANK 	});
	const portals = 			_.filter(allStructures, { structureType: STRUCTURE_PORTAL 			});
	const invadercores = 	_.filter(allStructures, { structureType: STRUCTURE_INVADER_CORE });
	const walls = 				_.filter(allStructures, { structureType: STRUCTURE_WALL 				});

	// check if the 'objects' object exists in room memory & create it if not
	if (!this.memory.objects) this.memory.objects = {};

	log('Caching room objects...', this);
	// if sources are found, add their IDs to array and add array to room's 'objects' memory
	if (sources) {
		for (let i = 0; i < sources.length; i++) storageArray.push(sources[i].id);
		if (storageArray.length) {
			this.memory.objects.sources = storageArray;
			if (this.memory.hostColony !== undefined)	Game.rooms[this.memory.hostColony].memory.outposts.list[this.name].sourceIDs = storageArray;
			if (storageArray.length > 1) log('Cached ' + storageArray.length + ' sources.', this);
			else log('Cached 1 source.', this);
		}
		storageArray = [];
	}
	// if minerals are found, add their IDs to array and add array to room's 'objects' memory
	if (minerals) {
		for (let i = 0; i < minerals.length; i++)	storageArray.push(minerals[i].id);
		if (storageArray.length) {
			this.memory.objects.mineral = [storageArray[0]];
			if (storageArray.length >= 1)	log('Cached 1 mineral.', this);
		}
		storageArray = [];
	}
	// if deposits are found, add their IDs to array and add array to room's 'objects' memory
	if (deposits) {
		for (let i = 0; i < deposits.length; i++)	storageArray.push(deposits[i].id);
		if (storageArray.length) {
			this.memory.objects.deposit = [storageArray[0]];
			if (storageArray.length > 1) log('Cached ' + storageArray.length + ' deposits.', this);
			else log('Cached 1 deposit.', this);
		}
		storageArray = [];
	}
	// if a controller is found, add its ID to array and add array to room's 'objects' memory
	if (controller) {
		for (let i = 0; i < controller.length; i++)	storageArray.push(controller[i].id);
		if (storageArray.length) {
			this.memory.objects.controller = [storageArray[0]];
			if (this.memory.hostColony !== undefined) {
				Game.rooms[this.memory.hostColony].memory.outposts.list[this.name].controllerID = storageArray[0];
			}
			if (storageArray.length >= 1)	log('Cached ' + storageArray.length + ' controllers.', this);
			else log('Cached 1 controller.', this);
		}
		storageArray = [];
	}
	// if a spawn is found, add its ID to array and add array to room's 'objects' memory
	if (spawns) {
		for (let i = 0; i < spawns.length; i++) storageArray.push(spawns[i].id);
		if (storageArray.length) {
			this.memory.objects.spawns = storageArray;
			if (storageArray.length > 1) log('Cached ' + storageArray.length + ' spawns.', this);
			else log('Cached 1 spawn.', this);
		}
		storageArray = [];
	}
	// if an extension is found, add its ID to array and add array to room's 'objects' memory
	if (extensions) {
		for (let i = 0; i < extensions.length; i++)	storageArray.push(extensions[i].id);
		if (storageArray.length) {
			this.memory.objects.extensions = storageArray;
			if (storageArray.length > 1) log('Cached ' + storageArray.length + ' extensions.', this);
			else log('Cached 1 extension.', this);
		}
		storageArray = [];
	}
	// if towers are found, add their IDs to array and add array to room's 'objects' memory
	if (towers) {
		for (let i = 0; i < towers.length; i++)	storageArray.push(towers[i].id);
		if (storageArray.length) {
			this.memory.objects.towers = storageArray;
			if (storageArray.length > 1) log('Cached ' + storageArray.length + ' towers.', this);
			else log('Cached 1 tower.', this);
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
				Game.rooms[hostRoom].memory.outposts.list[this.name].containerIDs = storageArray;
				this.memory.objects.containers = storageArray;
				updateInfo = "\n>>> NOTICE: Room is an outpost of a main colony. Updated outpost info with new container IDs.";
			}

			if (storageArray.length > 1) log('Cached ' + storageArray.length + ' containers.' + updateInfo, this);
			else log('Cached 1 container.' + updateInfo, this);
		}
		storageArray = [];
	}
	// if storage is found, add its ID to array and add array to room's 'objects' memory
	if (storage) {
		for (let i = 0; i < storage.length; i++)
			storageArray.push(storage[i].id);
		if (storageArray.length) {
			this.memory.objects.storage = [storageArray[0]];
			if (storageArray.length >= 1)	log('Cached 1 storage.', this);
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
			if (storageArray.length > 1) log('Cached ' + storageArray.length + ' links.', this);
			else log('Cached 1 link.', this);
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

/** Initializes a room's quota list. */
Room.prototype.initQuotas = function (): void {
	if (!this.memory.quotas) this.memory.quotas = {};

	this.memory.quotas = {
		harvesters: 2,
		upgraders: 2,
		fillers: 2,
		haulers: 0,
		builders: 1,
		repairers: 1,
		defenders: 0,
		reservers: 0,
		scouts: 0,
		remoteharvesters: 0,
	}

	log(`Quotas initialized: Harvesters (2), Upgraders (2), Fillers (2), Haulers (0), Builders (1), Defenders (0), Reservers (0), Scouts (0), Remote Harvesters (0)`);
}

/** Initializes a room with default memory structure and settings. Sets up quotas, visual settings, repair settings, and stats tracking. */
Room.prototype.initRoom = function () {
	if (!this.memory.quotas) this.initQuotas();

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
	if (!this.memory.settings) 		this.memory.settings = { visualSettings: visualSettings, repairSettings: repairSettings,	flags: {}, basePlanner: {} };
	if (!this.memory.outposts) 		this.memory.outposts = { list: {}, array: [], reserverLastAssigned: 0, numSources: 0, numHarvesters: 0, counter: 0, guardCounter: 0 };
	if (!this.memory.stats) 			this.memory.stats = { energyHarvested: 0, controlPoints: 0, constructionPoints: 0, creepsSpawned: 0, creepPartsSpawned: 0,
				mineralsHarvested: mineralsHarvested, controllerLevelReached: 0, npcInvadersKilled: 0, hostilePlayerCreepsKilled: 0, labStats: labStats };
	if (!this.memory.flags) 			this.memory.flags = { advancedSpawnLogic: false, };
	if (!this.memory.visuals) 		this.memory.visuals = {};

	this.cacheObjects();
}

/** Disables all BasePlanner room visuals */
Room.prototype.toggleBasePlannerVisuals = function (): void {
	this.memory.visuals.visDistTrans = !this.memory.visuals.visDistTrans;
	this.memory.visuals.visFloodFill = !this.memory.visuals.visFloodFill;
	this.memory.visuals.visBasePlan  = !this.memory.visuals.visBasePlan;
	log(`Base Planner visuals are now set to '${this.memory.visuals.visDistTrans}'`);
}

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
