import { ErrorMapper } from "utils/ErrorMapper";
import RoomManager from "./managers/roomManager";
import { needMoreHarvesters, visualRCProgress, calcTickTime } from "./utils/globalFuncs";
import { buildProgress, repairProgress } from 'utils/visuals';
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
		miscData: MiscData;
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
		objects: { [key: string]: string[] | string };
		sources: { [key: string]: string[] };
		containers: {
			sourceOne: string;
			sourceTwo: string;
			mineral: string;
			controller: string;
		};
		settings: RoomSettings;
		data: { [key: string]: any };
		stats: { [key: string]: number | string };
		availableCreeps: string[];
		outpostOfRoom?: RoomName;
		outposts: { [key: string]: any };
		quotas: { [key: string]: number };
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

	interface SpawnOrder {
		role: CreepRole;
		body: BodyPartConstant[];
		memory: CreepMemory;
		name: string;
		critical: boolean;
	}

	interface MiscData {
		[key: string]: any;
		rooms: { [key: string]: any };
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
		runnersDoMinerals?: boolean;
		runnersPickupEnergy?: boolean;
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

	interface RepairSettings {
		walls: boolean;
		ramparts: boolean;
		roads: boolean;
		others: boolean;
		wallLimit: number;
		rampartLimit: number;
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

	type alignment = 'left' | 'right' | 'center';

	type CreepRole = "harvester" | "upgrader" | "builder" | "repairer" | "defender" | "filler" | "porter"

	type RoomName = `${'W' | 'E'}${number}${'N' | 'S'}${number}`

	// Syntax for adding properties to `global` (ex "global.log")
	namespace NodeJS {
		interface Global {
			log(): void;
			tickTime: number;
		}
	}
}
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
			case 'porter':
				// TODO: Implement porter AI
				//CreepAI.Porter.run(creep);
				break;
			case 'defender':
				// TODO: Implement defender AI
				//CreepAI.Defender.run(creep);
				break;
			default:
				break;
		}
	}


	//! Encompassing loop to run across every room where we have vision
	_.forEach(Game.rooms, room => {

		const roomName = room.name;
		const rMem = room.memory;


		const cSites: Array<ConstructionSite> = room.find(FIND_CONSTRUCTION_SITES, { filter: (i) => i.structureType !== STRUCTURE_ROAD })
		const numCSitesPrevious: number = rMem.data.numCSites || 0;
		rMem.data.numCSites = cSites.length;
		const numCSites: number = rMem.data.numCSites;

		if (room.memory.objects === undefined)
			room.cacheObjects();
		if (numCSites < numCSitesPrevious)
			room.cacheObjects();

		_.forEach(cSites, function (cSite: ConstructionSite) {
			if (cSite.progress > 0) buildProgress(cSite, room);
		});

		//! From here, only rooms where we own the controller have this code ran
		if (room.controller && room.controller.my) {

			new RoomManager(room.name);

			if (room.controller.level !== room.memory.data.controllerLevel)
				room.memory.data.controllerLevel = room.controller.level;


			// pull creep role caps from room memory, or set to default value if none are set
			let harvesterTarget: number = _.get(room.memory, ['quotas', 'harvesters'], 2);
			let fillerTarget: number = _.get(room.memory, ['quotas', 'fillers'], 2);
			let upgraderTarget: number = _.get(room.memory, ['quotas', 'upgraders'], 2);
			let builderTarget: number = _.get(room.memory, ['quotas', 'builders'], 2);
			let repairerTarget: number = _.get(room.memory, ['quotas', 'repairers'], 0);
			let runnerTarget: number = _.get(room.memory, ['quotas', 'runners'], 2);

			// pull current amount of creeps alive by RFQ (Role For Quota)
			// with RFQ, this separates execution code from identity, so reassigning
			// a creep to a new role won't make it spawn a replacement unless you change RFQ too)

			let harvesters: Creep[] = _.filter(Game.creeps, (creep) => (creep.memory.RFQ == 'harvester' || creep.memory.role == 'harvester') && creep.memory.home == roomName);
			let fillers: Creep[] = _.filter(Game.creeps, (creep) => (creep.memory.RFQ == 'filler' || creep.memory.role == 'filler') && creep.memory.home == roomName);
			let upgraders: Creep[] = _.filter(Game.creeps, (creep) => (creep.memory.RFQ == 'upgrader' || creep.memory.role == 'upgrader') && creep.memory.home == roomName);
			let builders: Creep[] = _.filter(Game.creeps, (creep) => (creep.memory.RFQ == 'builder' || creep.memory.role == 'builder') && creep.memory.home == roomName);
			let repairers: Creep[] = _.filter(Game.creeps, (creep) => (creep.memory.RFQ == 'repairer' || creep.memory.role == 'repairer') && creep.memory.home == roomName);
			let runners: Creep[] = _.filter(Game.creeps, (creep) => (creep.memory.RFQ == 'runner' || creep.memory.role == 'runner') && creep.memory.home == roomName);

			const spawns = room.find(FIND_MY_STRUCTURES, {filter: (i) => i.structureType === STRUCTURE_SPAWN });

			if (spawns.length) {

				_.forEach(spawns, (spawnAny) => {
					// For every spawn in the room that we own
					const spawn = spawnAny as StructureSpawn;
					let cap = spawn.room.energyCapacityAvailable;

					// If we have no harvesters, stop using the room's energy capacity for body measurements and use what we have right now to spawn a new harvester
					if (harvesters.length == 0)
						cap = spawn.room.energyAvailable;
					if (!spawn.spawning) {

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
								console.log(`${spawn.name} spawning new harvester ${name} in ${room.name}, assigned to source #${lastHarvesterAssigned + 1}`);
								lastHarvesterAssigned = (lastHarvesterAssigned + 1) % 2;
								spawn.room.memory.data.lastHarvesterAssigned = lastHarvesterAssigned;
							}
							else
								console.log(`${spawn.name} failed to spawn harvester: ${result}`);
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
								console.log(`${spawn.name} spawning new filler ${name} in ${room.name}`);
							else
								console.log(`${spawn.name} failed to spawn filler: ${result}`);
						}
						//# Spawn Upgraders
						else if (upgraders.length < upgraderTarget) {
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
								console.log(`${spawn.name} spawning new upgrader ${name} in ${room.name}`);
							else
								console.log(`${spawn.name} failed to spawn upgrader: ${result}`);
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
								console.log(`${spawn.name} spawning new builder ${name} in ${room.name}`);
							else
								console.log(`${spawn.name} failed to spawn builder: ${result}`);
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
								console.log(`${spawn.name} spawning new repairer ${name} in ${room.name}`);
							else
								console.log(`${spawn.name} failed to spawn repairer: ${result}`);
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
				console.log(room.link() + `H: ${harvesters.length}, F: ${fillers.length}/${fillerTarget}, U: ${upgraders.length}/${upgraderTarget}, B: ${builders.length}/${builderTarget}`);
			}

			if (room.controller.level >= 1) visualRCProgress(room.controller);
		} //! end of if (room.controller && room.controller.my) {}

	}) //! end of _.forEach(Game.rooms, room => {}) loop

	tickCount++;

}); //! End of entire main loop (wrapped in ErrorMapper)
