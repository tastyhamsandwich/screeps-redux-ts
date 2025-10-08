import OutpostSourceCounter from '../classes/OutpostSourceCounter';

declare global {

	interface Global {
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
		initGlobal(override: boolean): boolean;
		calcBodyCost(body: BodyPartConstant[] | undefined | null): number;
		PART_COST: Record<BodyPartConstant, number>;
		pathing: { [key: string]: any };
	}

	// PROTODEF: Room Prototype Extension
	interface Room {
		counter: OutpostSourceCounter;
		getSourcePositions(sourceID: string): RoomPosition[];
		link(): string;
		cacheObjects(): void;
		newSpawnQueue(spawnOrder: SpawnOrder): void;
		initOutpost(roomName: string): void;
		initRoom(): void;
		initFlags(): void;
		roomSpawnQueue: SpawnOrder[];
	}

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
		outposts: { list: {[key: string]: OutpostData };
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

	interface SpawnOrder {
		role: CreepRole;
		body: BodyPartConstant[];
		memory: CreepMemory;
		name: string;
		critical: boolean;
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

	interface OutpostData {
		name: string;
		controllerFlag: string;
		sourceIDs: Id<Source>[];
		containerIDs: Id<StructureContainer>[];
		controllerID: Id<StructureController>;
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

export {};
