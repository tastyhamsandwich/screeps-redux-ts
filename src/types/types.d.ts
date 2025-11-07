import RoomManager from '@managers/RoomManager';

declare global {

	// MAIN.TS INTERFACES
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
		buildQueue?: {
			plannedAt: number;
			lastBuiltTick: number;
			index: number;
			activeRCL: number;
		};
		basePlan?: {
			lastGenerated: number;
			rclAtGeneration: number;
			checksum: string;
			data: PlanResult;
		};
		visuals: {
			[key: string]: any;
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

	interface Room {
		getSourcePositions(sourceID: string): RoomPosition[];
		link(): string;
		cacheObjects(): void;
		initOutpost(roomName: string): void;
		initQuotas(): void;
		initRoom(): void;
		initFlags(): void;
		updateSourceAssignment(roomToUpdate: string, updateObject: SourceAssignmentUpdate);
		registerLogisticalPairs(): void;
		setQuota(roleTarget: CreepRole, newTarget: number);
		toggleBasePlannerVisuals(): void;
	}

	type SourceAssignmentUpdate = {
		source: Id<Source> | false,
		container: Id<StructureContainer> | false,
		pathLengthToStorage: number | false,
		pathToStorage: PathFinderPath | false,
		creepAssigned: string | false,
		creepDeathTick: number | false
	}

	type LogisticsPair = {
		source: string | Id<StructureContainer | StructureStorage>;
		destination: Id<StructureContainer | StructureStorage | StructureLink>;
		resource: ResourceConstant;
		locality: 'local' | 'remote',
		descriptor: string,
		distance?: number,
	}

	type Locality = 'local' | 'remote';

	interface Creep {
		smartMoveTo(target: RoomPosition | { pos: RoomPosition }, opts?: MoveToOpts): ScreepsReturnCode;
		advGet(target: Source | Id<Source> | Mineral | Id<Mineral> | Deposit | Id<Deposit> | AnyStoreStructure | Resource | Tombstone | Ruin | Id<AnyStoreStructure> | Id<Resource> | Id<Tombstone> | Id<Ruin>): ScreepsReturnCode;
		advGive(target: Creep | AnyStoreStructure | Id<AnyStoreStructure>, pathing?: MoveToOpts, resource?: ResourceConstant, canTravel?: boolean): ScreepsReturnCode;
		advHarvest(): void;
		advMoveTo(target: RoomObject | { pos: RoomPosition } | RoomPosition, pathFinder?: boolean, opts?: MoveToOpts): ScreepsReturnCode;
		reassignSource(locality: Locality, sourceTwo: boolean): boolean;
		assignHarvestSource(locality: Locality, simpleAssignment: boolean, returnID: boolean): Source | Id<Source>;
		harvestEnergy(): void;
		unloadEnergy(bucketID?: Id<AnyStoreStructure>): void;
		cacheLocalObjects(): void;
		cacheLocalOutpost(): void;
		executeDirective(): boolean;
		assignLogisticalPair(): boolean;
		hasWorked: boolean;
		movePriority?: number;
		stuckTicks?: number;
	}

	type RoomRoute = RoomPathStep[];

	interface RoomPathStep {
		room: string;
		exit: ExitConstant;
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
		[key: string]: any;
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
			tickCount: number;
		}
	}

	// ROOM MANAGER INTERFACES
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

	// BASE PLANNER INTERFACES
	type Pos = { x: number; y: number };
	type TileUsage =
		| 'spawn'
		| 'storage'
		| 'terminal'
		| 'extension'
		| 'container'
		| 'link'
		| 'road'
		| 'lab'
		| 'tower'
		| 'factory'
		| 'nuker'
		| 'observer'
		| 'extractor'
		| 'rampart'
		| 'powerSpawn'
		| 'controllerUpgradeArea'
		| 'empty'
		| 'mineral'
		| 'wall';

	export interface StructurePlacement {
		structure: StructureConstant | 'container' | 'road';
		pos: Pos;
	}

	export interface PlanResult {
		roomName: string;
		baseCenter: Pos; // the chosen starting position
		placements: StructurePlacement[]; // final placements for RCL8
		tileUsageGrid: TileUsage[][]; // 50x50 grid of usage (y then x)
		rclSchedule: Record<number, StructurePlacement[]>; // map RCL -> placements to enable at that RCL
		notes?: string[];
	}


}

export {}
