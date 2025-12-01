import RoomManager from '@managers/RoomManager';
import { EventMap } from '@modules/EventSystem';

declare global {
namespace NodeJS {

	//# GLOBAL CONTEXT INTERFACE
	interface Global {
		adjustPathingValues(role: string, reuseValue: number, ignoreCreeps: boolean): void;
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
		capitalize(string: string): string;
		log(): void;
		zeroWrap(index: number, wrapLimit: number): number;
		PART_COST: Record<BodyPartConstant, number>;
		pathing: { [key: string]: any };
		roomManagers: { [roomName: string]: RoomManager };
		tickTime: number;
		tickCount: number;
		RoomVis: {
			toggle(roomName: string, layer: string): void;
			enableAll(roomName: string): void;
			disableAll(roomName: string): void;
			status(roomName: string): void;
		}
	}
}

	//# MEMORY INTERFACES
	interface Memory {
		__onceEvents: { [K in keyof EventMap]?: boolean; };
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

	interface RoomMemory {
		objects: {
			sources?: Id<Source>[];
			spawns?: Id<StructureSpawn>[];
			towers?: Id<StructureTower>[];
			controller?: Id<StructureController>[];
			containers?: Id<StructureContainer>[];
			links?: Id<StructureLink>[];
			labs?: Id<StructureLab>[];
			storage?: Id<StructureStorage>;
			extensions?: Id<StructureExtension>[];
			walls?: Id<StructureWall>[];
			ramparts?: Id<StructureRampart>[];
			terminal?: Id<StructureTerminal>;
			extractor?: Id<StructureExtractor>;
			[key: string]: any;
		 };
		sources: { [key: string]: string[] };
		containers: {
			sourceOne: Id<StructureContainer>;
			sourceTwo: Id<StructureContainer>;
			mineral: Id<StructureContainer>;
			controller: Id<StructureContainer>;
			prestorage: Id<StructureContainer>;
		};
		links: {
			sourceOne: Id<StructureLink>;
			sourceTwo: Id<StructureLink>;
			controller: Id<StructureLink>;
			storage: Id<StructureLink>;
			remotes?: Id<StructureLink>[];
		};
		settings: RoomSettings;
		data: { [key: string]: any };
		stats: ColonyStats;
		energyManagement?: EnergyManagementData;
		availableCreeps: string[];
		remoteRooms: {
			[key: string]: RemoteRoom
		};
		quotas: { [key: string]: number };
		hostileTracking: {
			invaderCount: number;
			playerCreepCount: number;
		};
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
			failedPlacements?: Array<{pos: {x: number, y: number}, structure: string, error: string}>;
		};
		basePlan?: {
			lastGenerated: number;
			rclAtGeneration: number;
			checksum: string;
			data: PlanResult;
			placedStructures?: {
				struct: BuildableStructureConstant;
				x: number;
				y: number;
			}[]
		};
		visuals: {
			settings?: { [key: string]: any };
			enableVisuals: boolean;
			basePlan: {
				visDistTrans?: boolean;
				visFloodFill?: boolean;
				visBasePlan?: boolean;
				visPlanInfo?: boolean;
				buildProgress?: boolean;
			};
			redAlertOverlay?: boolean;
			showPlanning?: boolean;
		};
		remoteOfRoom?: string;
	}

	interface CreepMemory {
		role: string;
		home: string;
		room: string;
		working?: boolean;
		moveIntent?: { to: RoomPosition };
		[key: string]: any;
	}

	interface SpawnMemory {
		spawnList: CreepRole[];
	}

	//# PROTOTYPE EXTENSION INTERFACES
	interface Room {
		log(message: string, critical?: boolean): void;
		getSourcePositions(sourceID: string): RoomPosition[];
		link(): string;
		cacheObjects(): void;
		initQuotas(): void;
		enableDropHarvesting(): void;
		initRoom(): void;
		initFlags(): void;
		registerLogisticalPairs(): void;
		setQuota(roleTarget: CreepRole, newTarget: number);
		toggleBasePlannerVisuals(): void;
		readonly manager?: RoomManager;
		sources: Id<Source>[];
		sourceOne: Source;
		sourceTwo: Source;
		containers: Id<StructureContainer>[];
		containerOne: StructureContainer;
		containerTwo: StructureContainer;
		containerController: StructureContainer;
		prestorage: StructureContainer;
		links: Id<StructureLink>[];
		linkOne: StructureLink;
		linkTwo: StructureLink;
		linkController: StructureLink;
		linkStorage: StructureLink;
		spawns: StructureSpawn[];
	}

	interface Creep {
		log(message: string, critical?: boolean): void;
		smartMoveTo(target: RoomPosition | { pos: RoomPosition }, opts?: MoveToOpts): ScreepsReturnCode;
		advGet(target: Source | Id<Source> | Mineral | Id<Mineral> | Deposit | Id<Deposit> | AnyStoreStructure | Resource | Tombstone | Ruin | Id<AnyStoreStructure> | Id<Resource> | Id<Tombstone> | Id<Ruin>): ScreepsReturnCode;
		advGive(target: Creep | AnyStoreStructure | Id<AnyStoreStructure>, pathing?: MoveToOpts, resource?: ResourceConstant, canTravel?: boolean): ScreepsReturnCode;
		advHarvest(): void;
		advMoveTo(target: RoomObject | { pos: RoomPosition } | RoomPosition, opts?: MoveToOpts, pathFinder?: boolean): ScreepsReturnCode;
		reassignSource(locality: Locality, sourceTwo: boolean): boolean;
		assignHarvestSource(locality: Locality, simpleAssignment: boolean, returnID: boolean): Source | Id<Source>;
		harvestEnergy(): void;
		unloadEnergy(bucketID?: Id<AnyStoreStructure>): void;
		cacheLocalObjects(): void;
		executeDirective(): boolean;
		assignLogisticalPair(): boolean;
		hasWorked: boolean;
		movePriority?: number;
		stuckTicks?: number;
	}

	interface StructureSpawn {
		spawnList: CreepRole[];
		log(logMsg: string): void;
		determineBodyParts(role: string, maxEnergy?: number, extras?: { [key: string]: any }): BodyPartConstant[];
		spawnScout(rally: string | string[], swampScout: boolean, memory: { [key: string]: any }): { name: string, result: ScreepsReturnCode };
		retryPending(): ScreepsReturnCode;
		cloneCreep(creepName: string): ScreepsReturnCode;
		spawnEmergencyHarvester(): ScreepsReturnCode;
		spawnFiller(maxEnergy: number): ScreepsReturnCode;
	}

	//# PATHING INTERFACES
	type RoomRoute = RoomPathStep[];

	interface RoomPathStep {
		room: string;
		exit: ExitConstant;
	}

	//# SPAWN MANAGEMENT INTERFACES
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

	interface PendingSpawn {
		role: CreepRole;
		body: BodyPartConstant[];
		name: string;
		memory: { [key: string]: any };
		cost: number;
		time: number;
	}
	interface ScheduledSpawn {
		role: string;
		scheduledTick: number;
		duration: number;
		energyCost: number;
		priority: number;
	}

	//# REMOTES INTERFACES

	interface RemoteRoom {
		lastScanned: number;
		sources: Id<Source>[];
		containers: Id<StructureContainer>[];
		reservation: any;
		scouted?: boolean;
		controllerOwner?: string;
		controllerId?: Id<StructureController>;
		scoutAssigned?: string
		cSites?: Id<ConstructionSite>[];
		creepAssignments?: {
			sourceOne?: string;
			sourceTwo?: string;
			reserver?: string;
			haulerOne?: string;
			haulerTwo?: string;
			guard?: string;
		}
	}

	//# STATISTICS INTERFACES
	interface ColonyStats {
		energyHarvested: number,
		energyDeposited: number,
		controlPoints: number,
		constructionPoints: number,
		creepsSpawned: number,
		creepPartsSpawned: number,
		energySpentOnSpawns?: number,
		mineralsHarvested?: MineralStats,
		controllerLevelReached: number,
		npcInvadersKilled: number,
		hostilePlayerCreepsKilled: number,
		labStats?: LabStats;
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

	type SourceAssignmentUpdate = {
		source: Id<Source> | false,
		container: Id<StructureContainer> | false,
		pathLengthToStorage: number | false,
		pathToStorage: PathFinderPath | false,
		creepAssigned: string | false,
		creepDeathTick: number | false
	}

	//# ENERGY MANAGEMENT INTERFACES
	interface EnergyMetrics {
		expectedIncome: number;
		realizedIncome: number;
		upgradeExpenditure: number;
		constructionExpenditure: number;
		spawnExpenditure: number;
		structureUpkeepExpenditure: number;
		totalExpenditure: number;
		netIncome: number;
		harvestWorkParts: number;
		localHarvestWorkParts: number;
		remoteHarvestWorkParts: number;
		roadCount: number;
		swampRoadCount: number;
		tunnelCount: number;
		rampartCount: number;
		containerCount: number;
		remoteContainerCount: number;
	}

	interface AmortizedEnergyMetrics {
		periodTicks: number;
		avgIncomePerTick: number;
		avgExpenditurePerTick: number;
		avgNetPerTick: number;
		isRunningDeficit: boolean;
		energyBalance: number;
	}

	interface EnergyManagementData {
		lastStorageEnergy: number;
		lastPrestorageEnergy: number;
		lastRecalculation: number;
		currentMetrics: EnergyMetrics;
		amortized1500: AmortizedEnergyMetrics;
		amortized3000: AmortizedEnergyMetrics;
	}

	//# LOGISTICS INTERACES
	type LogisticsPair = {
		source: string | Id<StructureContainer | StructureStorage>;
		destination: Id<StructureContainer | StructureStorage | StructureLink>;
		resource: ResourceConstant;
		locality: 'local' | 'remote',
		descriptor: string,
		distance?: number,
	}

	type Locality = 'local' | 'remote';

	//# SETTINGS INTERACES
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
		[key: string]: any;
	}

	interface RoomSettings {
		[key: string]: any;
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
		[key: string]: any;
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

	//# OTHER/GENERAL TYPEDEFS
	type alignment = 'left' | 'right' | 'center';
	type CreepRole = "harvester" | "upgrader" | "builder" | "repairer" | "defender" | "filler" | "hauler" | "remoteharvester" | "reserver" | "scout" | "conveyor" | "worker" | "infantry"
	type RoomName = `${'W' | 'E'}${number}${'N' | 'S'}${number}`;

	//# ROOM MANAGER INTERFACES
	interface RoomData {
		sourceOne?: { source: Id<Source>; container: Id<StructureContainer | ConstructionSite> };
		sourceTwo?: { source: Id<Source>; container: Id<StructureContainer | ConstructionSite> };
		controllerContainer?: Id<StructureContainer | ConstructionSite>;
		mineralContainer?: { mineral: Id<Mineral>; container: Id<StructureContainer | ConstructionSite> };
		nextHarvesterAssigned?: number;
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

	//# BASE PLANNER INTERFACES
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

	interface StructurePlacement {
		structure: StructureConstant | 'container' | 'road';
		pos: Pos;
	}

	interface PlanResult {
		startPos: RoomPosition;
		placements: StructurePlacement[];
		rclSchedule: RCLSchedule;
		ramparts: RoomPosition[];
		controllerArea: RoomPosition[];
		timestamp: number;
		dtGrid: number[][];
		floodFill: number[][];
	}

	interface StampTemplate {
		size: number;
		structures: {
			dx: number;
			dy: number;
			structure: StructureConstant;
			meta?: any;
		}[];
	}

	interface StructurePlacement {
		pos: { x: number; y: number };
		structure: StructureConstant;
		priority: number;
		meta?: any;
	}

	interface RoomData {
		basePlanGenerated?: boolean;
		[key: string]: any;
	}

	interface RCLSchedule {
		[rcl: number]: StructurePlacement[];
	}

	type RCLLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

	type InnerPositions = Array<RoomPosition | { x: number; y: number }>;

	interface DistTransOptions {
		innerPositions?: InnerPositions;
		visual?: boolean;
	}

	interface FloodFillOptions {
		costMatrix?: CostMatrix;
		costThreshold?: number;
		visual?: boolean;
	}

	//# WORK ASSIGNMENT INTERFACES

	type ManifestEntry = [ResourceConstant, number];
	type ManifestEntries = ManifestEntry[];
	type CargoManifest = Partial<Record<ResourceConstant, number>>;
	type TaskAssignment = HaulTask | BuildTask | RepairTask | FillTask | UpgradeTask | HarvestTask | GatherTask;

	interface HaulTask {
		type: 'haul';
		haulFrom: Id<AnyStoreStructure | Tombstone | Ruin>;
		haulTo: Id<AnyStoreStructure>;
		cargoManifest: CargoManifest;
	}

	interface BuildTask {
		type: 'build';
		buildTarget: Id<ConstructionSite>;
		buildingType: AnyStructure;
	}

	interface RepairTask {
		type: 'repair';
		repairTarget: Id<AnyStructure>;
		repairAmount: number;
	}

	interface FillTask {
		type: 'fill';
		fillableStructures: Id<StructureExtension | StructureSpawn>[];
		fillingEnergySource: Id<AnyStoreStructure>;
	}

	interface UpgradeTask {
		type: 'upgrade';
		targetController: Id<StructureController>;
		targetRoom: string;
		energyBudget: number
	}

	interface HarvestTask {
		type: 'harvest';
		targetSource: Id<Source | StructureExtractor>;
		targetRoom: string;
		harvestQuota: number;
	}

	interface GatherTask {
		type: 'gather';
		gatherTargets: Id<Resource | Tombstone | Ruin> |
									 Id<Resource | Tombstone | Ruin>[];
		dropoffTarget: Id<AnyStoreStructure>;
		cargoManifest: CargoManifest;
	}

	//# TASK MANAGER INTERFACES

	interface TaskProgress {
		cargoTransferred?: Partial<Record<ResourceConstant, number>>;
		repairAmount?: number;
		buildAmount?: number;
		harvestAmount?: number;
		upgradeAmount?: number;
		filledAmount?: number;
	}

	type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';
	type WorkerType = 'hauler' | 'builder' | 'mixed';

	type TaskObject = TaskAssignment & {
		taskId: string;
		priority: boolean;
		createdAt: number;
		assignedCreeps: string[];
		status: TaskStatus;
		progress: TaskProgress;
	};

	interface WorkerInfo {
		creep: Creep;
		type: WorkerType;
		available: boolean;
		currentTaskId?: string;
		typeDetectedAt: number;
	}

	interface TaskManagerMemory {
		queue: TaskObject[];
		workerAssignments: { [creepName: string]: string };
		workerTypes: { [creepName: string]: { type: WorkerType; detectedAt: number } };
		workerQuota: number;
		lastScanned: number;
		stats: {
			tasksCompleted: number;
			tasksCreatedThisTick: number;
			totalCargoMoved: number;
			totalEnergyTransferred: number;
		};
	}

	//# CUSTOM RETURN CODES
	const enum CUSTOM_RETURN_CODES {
		OK_BUT_INCOMPLETE = 100,
		STILL_IN_PROGRESS = 101,
	}

	type ExtendedReturnCode = ScreepsReturnCode | CUSTOM_RETURN_CODES;

}

export {}
