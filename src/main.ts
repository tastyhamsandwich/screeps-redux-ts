import { ErrorMapper } from "functions/utils/ErrorMapper";
import RoomManager from "./managers/RoomManager_v2";
import OutpostSourceCounter from "classes/OutpostSourceCounter";
import roomDefense from './tower';
import { needMoreHarvesters, visualRCProgress, calcTickTime } from "./functions/utils/globalFuncs";
import { buildProgress, repairProgress } from 'functions/utils/visuals';
import * as CreepAI from 'creeps';

import 'prototypes/creep';
import 'prototypes/room';
import 'prototypes/roomPos';
import 'prototypes/spawn';
import { last } from "lodash";

declare global {

	// INTERFACE: Base Memory Extension
	interface Memory {
		uuid: number;
		log: any;
		stats: { [key: string]: number | string };
		globalData: { [key: string]: any };
		globalSettings: GlobalSettings;
		colonies: { [key: string]: any };
		time?: {
			lastTickTime?: number,
			lastTickMillis?: number,
			tickTimeCount?: number,
			tickTimeTotal?: number
		}
	}

	// INTERFACE: Room Memory Extension
	interface RoomMemory {
		objects: { [key: string]: Id<AnyStructure>[] | Id<AnyStructure> };
		sources: { [key: string]: string[] };
		containers: {
			sourceOne: string;
			sourceTwo: string;
			mineral: string;
			controller: string;
		};
		settings: RoomSettings;
		data: { [key: string]: any };
		stats: ColonyStats;
		availableCreeps: string[];
		outposts: {
			list: { [key: string]: OutpostData };
			array: string[];
			numSources: number;
			numHarvesters: number;
			reserverLastAssigned: number;
			counter: number;
		};
		quotas: { [key: string]: number };
		hostColony?: string;
		//orderQueue: WorkOrder[]
	}

	// INTERFACE: Creep Memory Extension
	interface CreepMemory {
		role: string;
		home: string;
		room: string;
		working?: boolean;
		[key: string]: any;
	}

	// INTERFACE: Spawn Memory extension
	interface SpawnMemory {
		spawnList: CreepRole[];
	}


	//! STANDARD INTERFACE DEFINITIONS
	interface SpawnOrder {
		role: CreepRole;
		body: BodyPartConstant[];
		memory: CreepMemory;
		name: string;
		critical: boolean;
	}

	interface GlobalSettings {
		consoleSpawnInterval: number;
		alertDisabled: boolean;
		reusePathValue: number;
		ignoreCreeps: boolean,
		creepSettings: {
			[key: string]: {
				reusePathValue: number;
				ignoreCreeps: boolean;
			}
		};
	}

	interface RoomFlags {
		boostUpgraders?: boolean;
		centralStorageLogic?: boolean;
		closestConSites?: boolean;
		craneUpgrades?: boolean;
		displayTowerRanges?: boolean;
		harvestersFixAdjacent?: boolean;
		haulersDoMinerals?: boolean;
		haulersPickupEnergy?: boolean;
		repairBasics?: boolean;
		repairRamparts?: boolean;
		repairWalls?: boolean;
		sortConSites?: boolean;
		towerRepairBasic?: boolean;
		towerRepairDefenses?: boolean;
		upgradersSeekEnergy?: boolean;
		doScience?: boolean;
		boostCreeps?: boolean;
		dropHarvestingEnabled?: boolean;
	}

	interface RoomSettings {
		repairSettings: RepairSettings;
		visualSettings: VisualSettings;
		flags: RoomFlags;
	}

	interface OutpostData {
		name: string;
		controllerFlag: string;
		sourceIDs: Id<Source>[];
		containerIDs: Id<StructureContainer>[];
		controllerID: Id<StructureController>;
		sourceAssignmentMap: SourceAssignment[];
	}

	interface SourceAssignment {
		source: Id<Source>;
		container: Id<StructureContainer> | null;
		pathLengthToStorage: number | null;
		pathToStorage: PathFinderPath | null;
		creepAssigned: string | null;
		creepDeathTick: number | null;
	}
	interface ColonyStats {
		energyHarvested: number,
		controlPoints: number,
		constructionPoints: number,
		creepsSpawned: number,
		creepPartsSpawned: number,
		mineralsHarvested: MineralStats,
		controllerLevelReached: number,
		npcInvadersKilled: number,
		hostilePlayerCreepsKilled: number,
		labStats: LabStats;
	}

	interface MineralStats {
		hydrogen: number;
		oxygen: number;
		utrium: number;
		lemergium: number;
		keanium: number;
		zynthium: number;
		catalyst: number;
		ghodium: number;
	}

	interface LabStats {
		compoundsMade: CompoundStats;
		creepsBoosted: number;
		boostsUsed: CompoundStats;
		energySpentBoosting: number;
	}

	interface CompoundStats {
		hydroxide: number;
		zynthiumKeanite: number;
		utriumLemergite: number;
		utriumHydride: number;
		utriumOxide: number;
		keaniumHydride: number;
		keaniumOxide: number;
		lemergiumHydride: number;
		lemergiumOxide: number;
		zynthiumHydride: number;
		zynthiumOxide: number;
		ghodiumHydride: number;
		ghodiumOxide: number;
		utriumAcid: number;
		utriumAlkalide: number;
		keaniumAcid: number;
		keaniumAlkalide: number;
		lemergiumAcid: number;
		lemergiumAlkalide: number;
		zynthiumAcid: number;
		zynthiumAlkalide: number;
		ghodiumAcid: number;
		ghodiumAlkalide: number;
		catalyzedUtriumAcid: number;
		catalyzedUtriumAlkalide: number;
		catalyzedKeaniumAcid: number;
		catalyzedKeaniumAlkalide: number;
		catalyzedLemergiumAcid: number;
		catalyzedLemergiumAlkalide: number;
		catalyzedZynthiumAcid: number;
		catalyzedZynthiumAlkalide: number;
		catalyzedGhodiumAcid: number;
		catalyzedGhodiumAlkalide: number;
	}

	interface RepairSettings {
		walls: boolean;
		ramparts: boolean;
		roads: boolean;
		others: boolean;
		wallLimit: number;
		rampartLimit: number;
		towerSettings: TowerRepairSettings;
	}

	interface TowerRepairSettings {
		creeps: boolean;
		walls: boolean;
		ramparts: boolean;
		roads: boolean;
		others: boolean;
		wallLimit: number;
		rampartLimit: number;
		maxRange: number;
	}
	interface VisualSettings {
		spawnInfo?: SpawnInfoSettings;
		roomFlags?: RoomFlagsSettings;
		progressInfo: ProgressInfoSettings;
		displayControllerUpgradeRange?: boolean;
		displayTowerRanges?: boolean;
	}

	interface SpawnInfoSettings {
		alignment?: alignment;
		color?: string;
		fontSize?: number;
	}
	interface RoomFlagsSettings {
		displayCoords?: number[];
		color?: string;
		fontSize?: number;
	}
	interface ProgressInfoSettings {
		alignment: alignment;
		xOffset: number;
		yOffsetFactor: number;
		stroke: string;
		fontSize: number;
		color: string;
	}

	//! TYPE DEFINITIONS
	type alignment = 'left' | 'right' | 'center';
	type CreepRole = "harvester" | "upgrader" | "builder" | "repairer" | "defender" | "filler" | "hauler"
	type RoomName = `${'W' | 'E'}${number}${'N' | 'S'}${number}`
	type LogisticsPair = {
		source: Id<StructureContainer | StructureStorage>;
		destination: Id<StructureContainer | StructureStorage | StructureLink>;
		resource: ResourceConstant;
		locality: 'local' | 'remote',
		descriptor: string,
		distance?: number,
	}


	// Syntax for adding properties to `global` (ex "global.log")
	namespace NodeJS {
		interface Global {
			tickTime: number;
		}
	}
}

//! GLOBAL HEAP VARIABLES
let tickCount = 0;

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {

	calcTickTime();

	// PURPOSE Generate pixels with extra CPU time
	if (Game.shard.name === 'shard3') {
		if (Game.cpu.bucket == 10000) {
			Game.cpu.generatePixel()
			console.log('[GENERAL]: CPU Bucket at limit, generating pixel...');
		}
	}

	// Automatically delete memory of missing creeps
	for (const name in Memory.creeps) {
		if (!(name in Game.creeps)) {
			delete Memory.creeps[name];
		}
	}

	//! Execute specific role-based creep script for every creep, based on role assigned in memory
	for (const name in Game.creeps) {
		const creep = Game.creeps[name];
		switch (creep.memory.role) {
			case 'harvester':
				CreepAI.Harvester.run(creep);
				break;
			case 'upgrader':
				CreepAI.Upgrader.run(creep);
				break;
			case 'builder':
				CreepAI.Builder.run(creep);
				break;
			case 'repairer':
				CreepAI.Repairer.run(creep);
				break;
			case 'filler':
				CreepAI.Filler.run(creep);
				break;
			case 'hauler':
				CreepAI.Hauler.run(creep);
				break;
			case 'defender':
				// TODO: Implement defender AI
				//CreepAI.Defender.run(creep);
				break;
			case 'reserver':
				CreepAI.Reserver.run(creep);
			case 'remoteharvester':
				CreepAI.Harvester.runremote(creep);
			default:
				break;
		}
	}


	//! Encompassing loop to run across every room where we have vision
	_.forEach(Game.rooms, room => {

		const roomName = room.name;
		const rMem = room.memory;

		if (rMem.data === undefined)
			rMem.data = { numCSites: 0};

		const cSites: Array<ConstructionSite> = room.find(FIND_CONSTRUCTION_SITES, { filter: (i) => i.structureType !== STRUCTURE_ROAD })
		const numCSitesPrevious: number = rMem.data.numCSites || 0;
		rMem.data.numCSites = cSites.length;
		const numCSites: number = rMem.data.numCSites || 0;

		if (room.memory.objects === undefined)
			room.cacheObjects();
		if (numCSites < numCSitesPrevious)
			room.cacheObjects();

		_.forEach(cSites, function (cSite: ConstructionSite) {
			if (cSite.progress > 0) buildProgress(cSite, room);
		});

		//! From here, only rooms where we own the controller have this code ran
		if (room.controller && room.controller.my) {

			new RoomManager(room);

			roomDefense(room);

			if (room.controller.level !== room.memory.data.controllerLevel) {
				const newLevel = room.controller.level;
				room.memory.data.controllerLevel = room.controller.level;

				switch (newLevel) {
					case 1:
						//# Handle creation of initial containers and roads
						break;
					case 2:
						//# Handle creation of first 5 extensions
						break;
					case 3:
						//# Handle creation of next 5 extensions, first tower, and potential transition to remote mining
						rMem.quotas.reserver = 1;
						rMem.quotas.remoteharvester = 2;
						rMem.quotas.remotebodyguard = 1;
						rMem.quotas.remotehauler = 2;
						break;
					case 4:
						//# Handle creation of storage and next 10 extensions,
						break;
					case 5:
						//# Handle creation of next 10 extensions, 2 links, and 2nd tower
						break;
					case 6:
						//# Handle creation of terminal, first 3 labs, mineral extarctor, third link, and next 10 extensions
						break;
					case 7:
						//# Handle creation of factory, next 3 labs, third tower, fourth link, next 10 extensions (which now hold 100 each), and second spawn
						break;
					case 8:
						//# Handle creation of nuker, final 4 labs, powerSpawn, observer, 3 more towers, final 2 links, third spawn, and final 10 extensions (which now all hold 200 each)
						break;
					default:
						break;
				}
			}

			// pull creep role caps from room memory, or set to default value if none are set
			let harvesterTarget: number = _.get(room.memory,  ['quotas', 'harvesters'] , 2);
			let fillerTarget: 	 number = _.get(room.memory,  ['quotas', 'fillers'	 ] , 2);
			let upgraderTarget:  number = _.get(room.memory,  ['quotas', 'upgraders' ] , 2);
			let builderTarget: 	 number = _.get(room.memory,  ['quotas', 'builders'  ] , 2);
			let repairerTarget:  number = _.get(room.memory,  ['quotas', 'repairers' ] , 0);
			let reserverTarget:  number = _.get(room.memory,  ['quotas', 'reservers' ] , 1);
			let haulerTarget: 	 number = _.get(room.memory,  ['quotas', 'haulers'	 ] , 2);

			let remoteharvesterTarget: number = _.get(room.memory, ['quotas', 'remoteharvesters'], 2);
			let remotebodyguardTarget: number = _.get(room.memory, ['quotas', 'remotebodyguards'], 1);
			let remotehaulerTarget:    number = _.get(room.memory, ['quotas', 'remotehaulers'	], 2);

			// pull current amount of creeps alive by RFQ (Role For Quota)
			// with RFQ, this separates execution code from identity, so reassigning
			// a creep to a new role won't make it spawn a replacement unless you change RFQ too)

			let harvesters: Creep[] = _.filter(Game.creeps, (creep) => (creep.memory.RFQ == 'harvester' || creep.memory.role == 'harvester') && creep.memory.home == roomName);
			let fillers: 	Creep[]	= _.filter(Game.creeps, (creep) => (creep.memory.RFQ == 'filler' 	|| creep.memory.role == 'filler') 	 && creep.memory.home == roomName);
			let upgraders: 	Creep[]	= _.filter(Game.creeps, (creep) => (creep.memory.RFQ == 'upgrader' 	|| creep.memory.role == 'upgrader')  && creep.memory.home == roomName);
			let builders: 	Creep[]	= _.filter(Game.creeps, (creep) => (creep.memory.RFQ == 'builder' 	|| creep.memory.role == 'builder') 	 && creep.memory.home == roomName);
			let repairers: 	Creep[]	= _.filter(Game.creeps, (creep) => (creep.memory.RFQ == 'repairer' 	|| creep.memory.role == 'repairer')  && creep.memory.home == roomName);
			let reservers: 	Creep[]	= _.filter(Game.creeps, (creep) => (creep.memory.RFQ == 'reserver' 	|| creep.memory.role == 'reserver')  && creep.memory.home == roomName);
			let haulers: 	Creep[]	= _.filter(Game.creeps, (creep) => (creep.memory.RFQ == 'hauler' 	|| creep.memory.role == 'hauler') 	 && creep.memory.home == roomName);

			let remoteharvesters: Creep[] = _.filter(Game.creeps, (creep) => (creep.memory.RFQ == 'remoteharvester' || creep.memory.role == 'remoteharvester') && creep.memory.home == roomName);
			let remotebodyguards: Creep[] = _.filter(Game.creeps, (creep) => (creep.memory.RFQ == 'remotebodyguard' || creep.memory.role == 'remotebodyguard') && creep.memory.home == roomName);
			let remotehaulers: 	  Creep[] = _.filter(Game.creeps, (creep) => (creep.memory.RFQ == 'remotehauler' 	|| creep.memory.role == 'remotehauler')    && creep.memory.home == roomName);

			const spawns = room.find(FIND_MY_STRUCTURES, {filter: (i) => i.structureType === STRUCTURE_SPAWN });

			const harvesters_fillers_haulers_satisfied = (harvesters.length >= room.memory.objects.sources.length && fillers.length - fillerTarget === 0 && haulers.length - haulerTarget === 0);

			if (spawns.length) {

				_.forEach(spawns, (spawnAny) => {
					// For every spawn in the room that we own
					const spawn = spawnAny as StructureSpawn;
					let cap = spawn.room.energyCapacityAvailable;

					// If we have no harvesters, stop using the room's energy capacity for body measurements and use what we have right now to spawn a new harvester
					if (harvesters.length == 0)
						cap = spawn.room.energyAvailable;
					if (!spawn.spawning) {

						//! Spawn Harvesters and Fillers before anything else
						if (!harvesters_fillers_haulers_satisfied) {
							//# Spawn Harvesters
							if (needMoreHarvesters(spawn.room)) { // Determine if we have enough harvesters (by work parts per total sources in room)
								const body = spawn.determineBodyParts('harvester', cap);
								const ticksToSpawn = body.length * 3; // unused atm, will later be used to coordinate spawn times more accurately
								let sourceID;
								let containerID;
								let lastHarvesterAssigned = spawn.room.memory.data.lastHarvesterAssigned || 0; // tracker flag to determine which source info to use for harvester
								if (lastHarvesterAssigned === 0) {
									sourceID = spawn.room.memory.objects.sources[0];
									containerID = spawn.room.memory.containers.sourceOne;
								} else {
									sourceID = spawn.room.memory.objects.sources[1];
									containerID = spawn.room.memory.containers.sourceTwo;
								}
								let countMod = 1;
								let name = `Col${1}_H${harvesters.length + countMod}`;
								let result = spawn.spawnCreep(body, name, { memory: { role: 'harvester', RFQ: 'harvester', home: room.name, room: room.name, working: false, disable: false, rally: 'none', source: sourceID, bucket: containerID } });
								while (result == ERR_NAME_EXISTS) {
									countMod++;
									name = `Col${1}_H${harvesters.length + countMod}`;
									result = spawn.spawnCreep(body, name, { memory: { role: 'harvester', RFQ: 'harvester', home: room.name, room: room.name, working: false, disable: false, rally: 'none', source: sourceID, bucket: containerID } });
								}
								if (result === OK) {
									console.log(`${spawn.name}: Spawning new Harvester ${name} in ${room.name}, assigned to source #${lastHarvesterAssigned + 1}`);
									lastHarvesterAssigned = (lastHarvesterAssigned + 1) % 2;
									spawn.room.memory.data.lastHarvesterAssigned = lastHarvesterAssigned;
								}
								else
									console.log(`${spawn.name}: Failed to spawn Harvester: ${result}`);
							}
							//# Spawn Fillers
							else if (fillers.length < fillerTarget) {
								const body = spawn.determineBodyParts('filler', spawn.room.energyCapacityAvailable);
								let countMod = 1;
								let name = `Col${1}_F${fillers.length + countMod}`;
								let result = spawn.spawnCreep(body, name, { memory: { role: 'filler', RFQ: 'filler', home: room.name, room: room.name, working: false, disable: false, rally: 'none' } });
								while (result == ERR_NAME_EXISTS) {
									countMod++;
									name = `Col${1}_F${fillers.length + countMod}`;
									result = spawn.spawnCreep(body, name, { memory: { role: 'filler', RFQ: 'filler', home: room.name, room: room.name, working: false, disable: false, rally: 'none' } });
								}
								if (result === OK)
									console.log(`${spawn.name}: Spawning new Filler ${name} in ${room.name}`);
								else
									console.log(`${spawn.name}: Failed to spawn Filler: ${result}`);
							}
							//# Spawn Haulers

							else if (spawn.room.storage && haulers.length < haulerTarget) {
								console.log(`inside hauler logic`);
								const body = spawn.determineBodyParts('hauler', spawn.room.energyCapacityAvailable);
								let countMod = 1;
								let name = `Col${1}_Hauler${haulers.length + countMod}`;
								let result = spawn.spawnCreep(body, name, { memory: { role: 'hauler', RFQ: 'hauler', home: room.name, room: room.name, working: false, disable: false, rally: 'none' } });
								while (result == ERR_NAME_EXISTS) {
									countMod++;
									name = `Col${1}_Hauler${haulers.length + countMod}`;
									result = spawn.spawnCreep(body, name, { memory: { role: 'hauler', RFQ: 'hauler', home: room.name, room: room.name, working: false, disable: false, rally: 'none' } });
								}
								if (result === OK) {
									console.log(`${spawn.name}: Spawning new Hauler ${name} in ${room.name}`);
									if (spawn.room.memory.data.logisticalPairs)
										Game.creeps[name].assignLogisticalPair();
									else {
										spawn.room.registerLogisticalPairs();
										Game.creeps[name].assignLogisticalPair();
									}
								}
								else
									console.log(`${spawn.name}: Failed to spawn Hauler: ${result}`);
							}

						//! Spawn other creep types if harvesters & fillers fulfilled
						} else {
							//# Spawn Upgraders
							if (upgraders.length < upgraderTarget) {
								const body = spawn.determineBodyParts('upgrader', spawn.room.energyCapacityAvailable);
								let countMod = 1;
								let name = `Col${1}_U${upgraders.length + countMod}`;
								let result = spawn.spawnCreep(body, name, { memory: { role: 'upgrader', RFQ: 'upgrader', home: room.name, room: room.name,	 working: false, disable: false, rally: 'none' } });
								while (result == ERR_NAME_EXISTS) {
									countMod++;
									name = `Col${1}_U${upgraders.length + countMod}`;
									result = spawn.spawnCreep(body, name, { memory: { role: 'upgrader', RFQ: 'upgrader', home: room.name, room: room.name, working: false, disable: false, rally: 'none' } });
								}
								if (result === OK)
									console.log(`${spawn.name}: Spawning new Upgrader ${name} in ${room.name}`);
								else
									console.log(`${spawn.name}: Failed to spawn Upgrader: ${result}`);
							}
							//# Spawn Builders
							else if (builders.length < builderTarget)  {
								const body = spawn.determineBodyParts('builder', spawn.room.energyCapacityAvailable);
								let countMod = 1;
								let name = `Col${1}_B${builders.length + countMod}`;
								let result = spawn.spawnCreep(body, name, { memory: { role: 'builder', RFQ: 'builder', home: room.name, room: room.name, working: false, disable: false, rally: 'none' } });
								while (result == ERR_NAME_EXISTS) {
									countMod++;
									name = `Col${1}_B${builders.length + countMod}`;
									result = spawn.spawnCreep(body, name, { memory: { role: 'builder', RFQ: 'builder', home: room.name, room: room.name, working: false, disable: false, rally: 'none' } });
								}
								if (result === OK)
									console.log(`${spawn.name}: Spawning new Builder ${name} in ${room.name}`);
								else
									console.log(`${spawn.name}: Failed to spawn Builder: ${result}`);
							}
							//# Spawn Repairers
							else if (repairers.length < repairerTarget) {
								const body = spawn.determineBodyParts('repairer', spawn.room.energyCapacityAvailable);
								let countMod = 1;
								let name = `Col${1}_R${repairers.length + countMod}`;
								let result = spawn.spawnCreep(body, name, { memory: { role: 'repairer', RFQ: 'repairer', home: room.name, room: room.name, working: false, disable: false, rally: 'none' } });
								while (result == ERR_NAME_EXISTS) {
									countMod++;
									name = `Col${1}_R${repairers.length + countMod}`;
									result = spawn.spawnCreep(body, name, { memory: { role: 'repairer', RFQ: 'repairer', home: room.name, room: room.name, working: false, disable: false, rally: 'none' } });
								}
								if (result === OK)
									console.log(`${spawn.name}: Spawning new Repairer ${name} in ${room.name}`);
								else
									console.log(`${spawn.name}: Failed to spawn Repairer: ${result}`);
							}

							else if (spawn.room.energyCapacityAvailable >= 800 && reservers.length < reserverTarget) {
								const body = spawn.determineBodyParts('reserver', spawn.room.energyCapacityAvailable);
								let countMod = 1;
								let name = `Col${1}_Rsv${reservers.length + countMod}`;
								let result = spawn.spawnCreep(body, name, { memory: { role: 'reserver', RFQ: 'reserver', home: room.name, room: room.name, working: false, disable: false, rally: 'none' } });
								while (result === ERR_NAME_EXISTS) {
									countMod++;
									name = `Col${1}_Rsv${reservers.length + countMod}`;
									result = spawn.spawnCreep(body, name, { memory: { role: 'reserver', RFQ: 'reserver', home: room.name, room: room.name, working: false, disable: false, rally: 'none' } });
								}
								if (result === OK)
									console.log(`${spawn.name}: Spawning new Reserver ${name} in ${room.name}`);
								else
									console.log(`${spawn.name}: Failed to spawn Reserver: ${result}`);
							}

							else if (spawn.room.memory.outposts.numHarvesters < spawn.room.memory.outposts.numSources) { // Determine if we have enough harvesters (by work parts per total sources in room)
								const body = spawn.determineBodyParts('harvester', cap);
								const ticksToSpawn = body.length * 3; // unused atm, will later be used to coordinate spawn times more accurately

								const returnObj = spawn.room.counter.next();
								const sourceID = returnObj?.source;
								const containerID = returnObj?.container;

								let countMod = 1;
								let name = `Col${1}_RH${remoteharvesters.length + countMod}`;
								let result = spawn.spawnCreep(body, name, { memory: { role: 'remoteharvester', RFQ: 'remoteharvester', home: room.name, room: room.name, working: false, disable: false, rally: 'none', source: sourceID, bucket: containerID } });
								while (result == ERR_NAME_EXISTS) {
									countMod++;
									name = `Col${1}_RH${remoteharvesters.length + countMod}`;
									result = spawn.spawnCreep(body, name, { memory: { role: 'remoteharvester', RFQ: 'remoteharvester', home: room.name, room: room.name, working: false, disable: false, rally: 'none', source: sourceID, bucket: containerID } });
								}
								if (result === OK) {
									console.log(`${spawn.name}: Spawning new Remote Harvester ${name} in ${room.name}, assigned to source #${(spawn.room.memory.outposts.counter % 2) + 1}`);
									spawn.room.memory.outposts.numHarvesters++;
								}
								else
									console.log(`${spawn.name}: Failed to spawn Remote Harvester: ${result}`);
							}
						}
					}
				});
			} //! end of if (spawns.length) {}

			// Show some basic energy and quota information every few ticks in the console
			const tickInterval: number = Memory.globalSettings.consoleSpawnInterval;
			let storageInfo = '';
			if (room.storage)
				storageInfo = '<' + room.storage.store[RESOURCE_ENERGY].toString() + '> ';
			const energy: string = 'NRG: ' + room.energyAvailable + '/' + room.energyCapacityAvailable + '(' + (room.energyAvailable / room.energyCapacityAvailable * 100).toFixed(0) + '%) ';
			if (tickInterval !== 0 && tickCount % tickInterval === 0) {
				console.log(room.link() + energy + storageInfo + ' Tick: ' + tickCount);
				console.log(room.link() + `H: ${harvesters.length}, F: ${fillers.length}/${fillerTarget}, Haul: ${haulers.length}/${haulerTarget}, U: ${upgraders.length}/${upgraderTarget}, B: ${builders.length}/${builderTarget}, R: ${repairers.length}/${repairerTarget}, Rsv: ${reservers.length}/${reserverTarget}`);
				console.log(room.link() + `RH: ${remoteharvesters.length}/${remoteharvesterTarget}, RG: ${remotebodyguards.length}/${remotebodyguardTarget}, RHaul: ${remotehaulers.length}/${remotehaulerTarget}`);
			}

			if (room.controller.level >= 1) visualRCProgress(room.controller);
		} //! end of if (room.controller && room.controller.my) {}

	}) //! end of _.forEach(Game.rooms, room => {}) loop

	tickCount++;

}); //! End of entire main loop (wrapped in ErrorMapper)
