
// Import Global Functions and VizFuncs
import { visualRCProgress, calcTickTime } from "@globals";
import { buildProgress, repairProgress } from '@funcs/visual/progress';

// Import Manager Daemons
import RoomManager from "@managers/RoomManager";
import TrafficManager from '@managers/TrafficManager';

// Import all Creep Role AI functions
import CreepAI from './creeps/index';

// Import Prototype Extensions
import 'prototypes/creep';
import 'prototypes/room';
import 'prototypes/roomPos';
import 'prototypes/spawn';

declare global {

	interface Global {
		roomManagers: { [roomName: string]: RoomManager };
	}

	// INTERFACE: Base Memory Extension
	interface Memory {
		uuid: number;
		log: any;
		stats: { [key: string]: number | string };
		globalData: { [key: string]: any };
		globalSettings: { [key: string]: any };
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
			guardCounter: number;
		};
		quotas: { [key: string]: number };
		hostColony?: string;
		remoteSources?: { [key: string]: RemoteSourceData };
		flags: RoomFlags;
		spawnManager: {
			queue: SpawnRequest[];
			scheduled: ScheduledSpawn[];
			deferred?: SpawnRequest[];
			lastProcessed: number;
		}
	}

	// INTERFACE: Creep Memory Extension
	interface CreepMemory {
		role: string;
		home: string;
		room: string;
		working?: boolean;
		moveIntent?: { to: RoomPosition };
		[key: string]: any;
	}

	// INTERFACE: Spawn Memory extension
	interface SpawnMemory {
		spawnList: CreepRole[];
	}

	//! STANDARD INTERFACE DEFINITIONS
	interface SpawnRequest {
		id: string;
		role: string;
		priority: number;
		body: BodyPartConstant[];
		memory: CreepMemory;
		roomName: string;
		urgent: boolean;
		requestedAt: number;
		estimatedSpawnTime?: number;
		energyCost?: number;
	}

	interface ScheduledSpawn {
		role: string;
		scheduledTick: number;
		duration: number;
		energyCost: number;
		priority: number;
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
		bootstrap?: boolean;
		closestConSites?: boolean;
		displayTowerRanges?: boolean;
		haulersPickupEnergy?: boolean;
		advancedSpawnLogic?: boolean;
		managerInitialized?: boolean;
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

	interface RemoteSourceData {
		pos: { x: number, y: number, roomName: string };
		assignedHarvester: string | null;
		containerId: string | null;
		containerPos: { x: number, y: number, roomName: string } | null;
		lastChecked: number;
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
			roomManagers: { [roomName: string]: RoomManager };
			splitRoomName(roomName: string): [string, number, string, number];
			roomExitsTo(roomName: string, direction: DirectionConstant | number | string): string;
			calcPath(startPos: RoomPosition, endPos: RoomPosition): { path: RoomPosition[], length: number, ops: number, cost: number, incomplete: boolean };
			calcPathLength(startPos: RoomPosition, endPos: RoomPosition): number;
			asRoomPosition(value: RoomPosition | { pos?: RoomPosition } | undefined | null): RoomPosition | null;
			log(logMsg: string | string[], room: Room | false): void;
			createRoomFlag(room: string): string | null;
			validateRoomName(roomName: string): RoomName;
			randomInt(min: number, max: number): number;
			randomColor(): ColorConstant;
			randomColorAsInt(): number;
			determineBodyParts(role: string, maxEnergy: number, extras?: { [key: string]: any }): BodyPartConstant[] | undefined;
			initGlobal(override?: boolean): boolean;
			calcBodyCost(body: BodyPartConstant[] | undefined | null): number;
			PART_COST: Record<BodyPartConstant, number>;
			pathing: { [key: string]: any };
			log(): void;
			tickTime: number;
			tickCount:  number;
		}
	}
}

//! GLOBAL HEAP VARIABLES
let tickCount = 0;

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = () => {

	if (!Memory.globalSettings) global.initGlobal();

	calcTickTime();

	// PURPOSE Generate pixels with extra CPU time
	if (Game.shard.name === 'shard3') {
		if (Game.cpu.bucket >= 10000) {
			Game.cpu.generatePixel()
			console.log('[GENERAL]: CPU Bucket at limit, generating pixel...');
		}
	}

	// Automatically delete memory of missing creeps
	for (const name in Memory.creeps) {
		if (!(name in Game.creeps))	delete Memory.creeps[name];
	}

	// Execute specific role-based creep script for every creep, based on role assigned in CreepMemory
	for (const name in Game.creeps) {
		const creep = Game.creeps[name];
		switch (creep.memory.role) {
			case 'harvester':
				try {
					CreepAI.Harvester.run(creep);
				} catch (e) {
					console.log(`Error with Harvester logic: ${e}`);
				}
				break;
			case 'upgrader':
				try {
					CreepAI.Upgrader.run(creep);
				} catch (e) {
					console.log(`Error with Upgrader logic: ${e}`);
				}
				break;
			case 'builder':
				try {
					CreepAI.Builder.run(creep);
				} catch (e) {
					console.log(`Error with Builder logic: ${e}`);
				}
				break;
			case 'repairer':
				try {
					CreepAI.Repairer.run(creep);
				} catch (e) {
					console.log(`Error with Repairer logic: ${e}`);
				}
				break;
			case 'filler':
				try {
					CreepAI.Filler.run(creep);
				} catch (e) {
					console.log(`Error with Filler logic: ${e}`);
				}
				break;
			case 'hauler':
				try {
					CreepAI.Hauler.run(creep);
				} catch (e) {
					console.log(`Error with Hauler logic: ${e}`);
				}
				break;
			case 'defender':
				try {
					CreepAI.Defender.run(creep);
				} catch (e) {
					console.log(`Error with Defender logic: ${e}`);
				}
				break;
			case 'reserver':
				try {
					CreepAI.Reserver.run(creep);
				} catch (e) {
					console.log(`Error with Reserver logic: ${e}`);
				}
				break;
			case 'remoteharvester':
				try {
					CreepAI.Harvester.runremote(creep);
				} catch (e) {
					console.log(`Error with Remote Harvester logic: ${e}`);
				}
				break;
			case 'scout':
				try {
					CreepAI.Scout.run(creep);
				} catch (e) {
					console.log(`Error with Scout logic: ${e}`);
				}
				break;
			default:
				break;
		}
	}

	// Resolve all movement Intents created during Creep AI execution phase
	TrafficManager.run();

	//* Encompassing loop to run across every room where we have vision
	_.forEach(Game.rooms, room => {

		const roomName = room.name;
		const rMem = room.memory;

		if (rMem.data === undefined) rMem.data = { numCSites: 0};

		const cSites: Array<ConstructionSite> = room.find(FIND_CONSTRUCTION_SITES, { filter: (i) => i.structureType !== STRUCTURE_ROAD });
		const numCSitesPrevious: number = rMem.data.numCSites || 0;
		rMem.data.numCSites = cSites.length;
		const numCSites: number = rMem.data.numCSites || 0;

		if (room.memory.objects === undefined) room.cacheObjects();
		if (numCSites < numCSitesPrevious) room.cacheObjects();

		_.forEach(cSites, function (cSite: ConstructionSite) {
			if (cSite.progress > 0) buildProgress(cSite, room);
		});

		//* From here, only rooms where we own the controller have this code ran
		if (room.controller && room.controller.my) {

			// Initialize Room Manager instances for controlled rooms
			if (!global.roomManagers) global.roomManagers = {};
			if (!global.roomManagers[roomName]) global.roomManagers[roomName] = new RoomManager(room);
			const RoomManagerInstance = global.roomManagers[roomName];
			RoomManagerInstance.run();

			if (room.controller.level !== room.memory.data.controllerLevel) {
				const newLevel = room.controller.level;
				room.memory.data.controllerLevel = room.controller.level;

				switch (newLevel) {
					case 1:
						// TODO RCL1: Handle creation of initial containers and roads
						break;
					case 2:
						// TODO RCL2: Handle creation of first 5 extensions
						break;
					case 3:
						// TODO RCL3: Handle creation of next 5 extensions, first tower, and potential transition to remote mining
						rMem.quotas.reserver = 1;
						rMem.quotas.remoteharvester = 2;
						rMem.quotas.remotebodyguard = 1;
						rMem.quotas.remotehauler = 2;
						break;
					case 4:
						// TODO RCL4: Handle creation of storage and next 10 extensions,
						break;
					case 5:
						// TODO RCL5: Handle creation of next 10 extensions, 2 links, and 2nd tower
						break;
					case 6:
						// TODO RCL6: Handle creation of terminal, first 3 labs, mineral extarctor, third link, and next 10 extensions
						break;
					case 7:
						// TODO RCL7: Handle creation of factory, next 3 labs, third tower, fourth link, next 10 extensions (which now hold 100 each), and second spawn
						break;
					case 8:
						// TODO RCL8: Handle creation of nuker, final 4 labs, powerSpawn, observer, 3 more towers, final 2 links, third spawn, and final 10 extensions (which now all hold 200 each)
						break;
					default:
						//# This should never happen
						console.log(`Unknown Exception occured in main colony room loop!`);
						break;
				}
			}

			if (room.controller.level >= 1) visualRCProgress(room.controller);
		} //* end of if (room.controller && room.controller.my) {}
	}) //* end of _.forEach(Game.rooms, room => {}) loop

	tickCount++;
	global.tickCount = tickCount;

}; //* End of entire main loop
