# Complete API Index

Comprehensive index of all classes, interfaces, methods, and prototypes in the Screeps Redux TypeScript bot.

## Quick Navigation

- [Classes](#classes)
- [Interfaces](#interfaces)
- [Prototype Extensions](#prototype-extensions)
- [Global Functions](#global-functions)
- [Constants](#constants)
- [Type Definitions](#type-definitions)

---

## Classes

### RoomManager
**Location:** `managers/RoomManager.ts`

Central controller for all room-level operations.

**Constructor:**
- `constructor(room: Room)`

**Public Methods:**
- `run(): void`
- `getResources(): RoomResources`
- `getStats(): RoomManagerStats`
- `getSpawnManager(): SpawnManager`

**Private Methods:**
- `scanResources(): RoomResources`
- `gatherStats(): RoomManagerStats`
- `planSourceContainers(): void`
- `planControllerContainer(): void`
- `planMineralContainer(): void`
- `planExtensions(): void`
- `assessCreepNeeds(): void`
- `assignWorkerTask(creep: Creep): void`
- `needMoreHarvesters(): boolean`
- `manageTowers(): void`
- `manageLinks(): void`
- `getRepairPriority(structure: Structure): number`
- `updateBootstrapState(): void`
- `drawPlanningVisuals(): void`

### SpawnManager
**Location:** `managers/SpawnManager.ts`

Intelligent spawn queue management with priority scheduling.

**Constructor:**
- `constructor(room: Room)`

**Public Methods:**
- `run(): void`
- `submitRequest(request: Partial<SpawnRequest>): boolean`
- `getStatus(): SpawnStatus`
- `getQueue(): SpawnRequest[]`
- `getScheduledSpawns(): ScheduledSpawn[]`
- `clearQueue(): void`

**Private Methods:**
- `validateRequest(request: SpawnRequest): boolean`
- `checkScheduleConflict(request: SpawnRequest): ScheduledSpawn | null`
- `sortQueue(): void`
- `updatePredictiveSpawns(): void`
- `processQueue(): void`
- `attemptSpawn(spawn: StructureSpawn, request: SpawnRequest): ScreepsReturnCode`
- `handlePostSpawn(request: SpawnRequest, creepName: string): void`
- `retryDeferredRequests(): void`
- `calculateEnergyForecast(): EnergyForecast`
- `calculateBodyCost(body: BodyPartConstant[]): number`
- `getRoleShorthand(role: string): string`
- `saveToMemory(): void`
- `loadFromMemory(): void`

---

## Interfaces

### Core Interfaces

#### SpawnRequest
```typescript
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
```

#### ScheduledSpawn
```typescript
interface ScheduledSpawn {
    role: string;
    scheduledTick: number;
    duration: number;
    energyCost: number;
    priority: number;
}
```

#### LogisticsPair
```typescript
interface LogisticsPair {
    source: Id<StructureContainer | StructureStorage>;
    destination: Id<StructureContainer | StructureStorage | StructureLink>;
    resource: ResourceConstant;
    locality: 'local' | 'remote';
    descriptor: string;
    distance?: number;
}
```

### Memory Interfaces

#### Memory
```typescript
interface Memory {
    uuid: number;
    log: any;
    stats: { [key: string]: number | string };
    globalData: { [key: string]: any };
    globalSettings: GlobalSettings;
    colonies: { [key: string]: any };
    time?: {
        lastTickTime?: number;
        lastTickMillis?: number;
        tickTimeCount?: number;
        tickTimeTotal?: number;
    };
}
```

#### RoomMemory
```typescript
interface RoomMemory {
    objects: { [key: string]: Id<AnyStructure>[] | Id<AnyStructure> };
    sources: { [key: string]: string[] };
    containers: {
        sourceOne: string;
        sourceTwo: string;
        mineral: string;
        controller: string;
        prestorage: string;  // Prestorage container (before main storage)
    };
    links: {
        sourceOne: string;   // Link near first source
        sourceTwo: string;   // Link near second source
        controller: string;  // Link near controller
        storage: string;     // Link near storage
    };
    settings: RoomSettings;
    data: { [key: string]: any };
    stats: RoomStats;
    availableCreeps: string[];
    outposts: {
        list: { [key: string]: OutpostData };
        array: string[];
        numSources: number;
        numHarvesters: number;
        reserverLastAssigned: number;
        counter: number;
        guardCounter: number;  // Counter for guard creep placement
    };
    quotas: { [key: string]: number };
    hostColony?: string;
    remoteSources?: { [key: string]: RemoteSourceData };
    flags: RoomFlags;
    hostileTracking: {
        invaderCount: number;        // Number of NPC invaders in room
        playerCreepCount: number;    // Number of hostile player creeps
    };
    spawnManager: {
        queue: SpawnRequest[];
        scheduled: ScheduledSpawn[];
        deferred?: SpawnRequest[];
        lastProcessed: number;
    };
    buildQueue?: {
        plannedAt: number;
        [key: string]: any;
    };
}
```

#### CreepMemory
```typescript
interface CreepMemory {
    role: string;
    home: string;
    room: string;
    working?: boolean;
    [key: string]: any;  // Flexible for role-specific properties
}
```

### Settings Interfaces

#### GlobalSettings
```typescript
interface GlobalSettings {
    consoleSpawnInterval: number;
    alertDisabled: boolean;
    reusePathValue: number;
    ignoreCreeps: boolean;
    creepSettings: {
        [key: string]: {
            reusePathValue: number;
            ignoreCreeps: boolean;
        };
    };
}
```

#### RoomSettings
```typescript
interface RoomSettings {
    repairSettings: RepairSettings;
    visualSettings: VisualSettings;
    flags: RoomFlags;
}
```

#### RoomFlags
```typescript
interface RoomFlags {
    bootstrap?: boolean;
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
```

### Statistics Interfaces

#### RoomStats
```typescript
interface RoomStats {
    energyHarvested: number;
    controlPoints: number;
    constructionPoints: number;
    creepsSpawned: number;
    creepPartsSpawned: number;
    mineralsHarvested: MineralStats;
    controllerLevelReached: number;
    npcInvadersKilled: number;
    hostilePlayerCreepsKilled: number;
    labStats: LabStats;
}
```

---

## Prototype Extensions

### Creep Prototype
**Location:** `prototypes/creep.ts`

#### Movement
- `advMoveTo(target: RoomObject | {pos: RoomPosition} | RoomPosition, pathFinder?: boolean, opts?: MoveToOpts): ScreepsReturnCode`

#### Resource Management
- `advGet(target: Source | Mineral | Deposit | AnyStoreStructure | Resource | Tombstone | Ruin | Id<any>, pathing?: MoveToOpts, resource?: ResourceConstant, canTravel?: boolean): ScreepsReturnCode`
- `advGive(target: Creep | AnyStoreStructure | Id<AnyStoreStructure>, pathing?: MoveToOpts, resource?: ResourceConstant, canTravel?: boolean): ScreepsReturnCode`

#### Harvesting
- `advHarvest(): void`
- `harvestEnergy(): void`
- `unloadEnergy(bucketID?: Id<AnyStoreStructure>): void`

#### Source Assignment
- `assignHarvestSource(locality: 'local' | 'remote', simpleAssignment: boolean, returnID: boolean): Source | Id<Source>`
- `reassignSource(locality: 'local' | 'remote', sourceTwo: boolean): boolean`

#### Logistics
- `assignLogisticalPair(): boolean`

#### Caching
- `cacheLocalObjects(): void`
- `cacheLocalOutpost(): void`

#### Directives
- `executeDirective(): boolean`

#### Properties
- `hasWorked: boolean`

### Room Prototype
**Location:** `prototypes/room.ts`

#### Object Caching
- `cacheObjects(): void`

#### Initialization
- `initRoom(): void`
- `initFlags(): void`
- `initOutpost(roomName: string): void`

#### Source Management
- `getSourcePositions(sourceID: string): RoomPosition[]`
- `updateSourceAssignment(roomToUpdate: string, updateObject: SourceAssignmentUpdate): boolean`

#### Logistics
- `registerLogisticalPairs(): boolean`
- `setQuota(roleTarget: CreepRole, newTarget: number): void`

#### Utility
- `link(): string`

#### Properties (Accessor Properties)
- `manager: RoomManager | undefined` - Gets the RoomManager instance for this room
- `sources: Source[]` - Gets/sets all sources in the room
- `sourceOne: Source | null` - Gets first source
- `sourceTwo: Source | null` - Gets second source (if available)
- `containers: StructureContainer[]` - Gets/sets all containers
- `containerOne: StructureContainer | null` - Gets container near first source
- `containerTwo: StructureContainer | null` - Gets container near second source
- `containerController: StructureContainer | null` - Gets controller container
- `prestorage: StructureContainer | null` - Gets prestorage container
- `links: StructureLink[]` - Gets/sets all links
- `linkOne: StructureLink | null` - Gets link near first source
- `linkTwo: StructureLink | null` - Gets link near second source
- `linkController: StructureLink | null` - Gets controller link
- `linkStorage: StructureLink | null` - Gets storage link
- `counter: OutpostSourceCounter` - OutpostSourceCounter instance for the room

### RoomPosition Prototype
**Location:** `prototypes/roomPos.ts`

- `getNearbyPositions(): RoomPosition[]`
- `getWalkablePositions(): RoomPosition[]`
- `getOpenPositions(): RoomPosition[]`
- `getNumOpenPositions(): number`
- `link(): string`

### Spawn Prototype
**Location:** `prototypes/spawn.ts`

#### Body Determination
- `determineBodyParts(role: string, maxEnergy?: number, extras?: {[key: string]: any}): BodyPartConstant[]`

#### Spawning Methods
- `spawnScout(rally: string | string[], swampScout?: boolean, memory?: {}): ScreepsReturnCode`
- `spawnEmergencyHarvester(): ScreepsReturnCode`
- `spawnFiller(maxEnergy: number): ScreepsReturnCode`
- `retryPending(): ScreepsReturnCode`
- `cloneCreep(creepName: string): ScreepsReturnCode`

#### Properties
- `spawnList: CreepRole[]`

---

## Global Functions
**Location:** `functions/utils/globals.ts`

### Room Navigation
- `splitRoomName(roomName: string): [string, number, string, number]`
- `roomExitsTo(roomName: string, direction: DirectionConstant | number | string): string`
- `validateRoomName(roomName: string): RoomName`

### Pathfinding
- `calcPath(startPos: RoomPosition, endPos: RoomPosition): {path: RoomPosition[], length: number, ops: number, cost: number, incomplete: boolean}`
- `calcPathLength(startPos: RoomPosition, endPos: RoomPosition): number`

### Position Utilities
- `asRoomPosition(value: RoomPosition | {pos?: RoomPosition} | undefined | null): RoomPosition | null`

### Logging
- `log(logMsg: string | string[], room: Room | false): void`

### Game Objects
- `createRoomFlag(room: string): string | null`

### Random Generation
- `randomInt(min: number, max: number): number`
- `randomColor(): ColorConstant`
- `randomColorAsInt(): number`

### Body Calculation
- `determineBodyParts(role: string, maxEnergy: number, extras?: {[key: string]: any}): BodyPartConstant[] | undefined`
- `calcBodyCost(body: BodyPartConstant[] | undefined | null): number`

### Initialization
- `initGlobal(override?: boolean): boolean`

### Creep Assessment
- `needMoreHarvesters(room: Room): boolean`

### Visualization
- `visualRCProgress(controller: StructureController): void`

### Time Utilities
- `calcTickTime(tickSamples?: number): string`
- `secondsToDhms(seconds: number): string`

---

## Constants
**Location:** `functions/utils/constants.ts`

### Body Part Costs
```typescript
PART_COST: Record<BodyPartConstant, number> = {
    [MOVE]: 50,
    [WORK]: 100,
    [CARRY]: 50,
    [ATTACK]: 80,
    [RANGED_ATTACK]: 150,
    [HEAL]: 250,
    [CLAIM]: 600,
    [TOUGH]: 10
}
```

### Pathing Configurations
```typescript
pathing: {
    builderPathing: MoveToOpts,
    fillerPathing: MoveToOpts,
    haulerPathing: MoveToOpts,
    harvesterPathing: MoveToOpts,
    remoteBuilderPathing: MoveToOpts,
    remoteBodyguardPathing: MoveToOpts,
    remoteHarvesterPathing: MoveToOpts,
    remoteHaulerPathing: MoveToOpts,
    repairerPathing: MoveToOpts,
    reserverPathing: MoveToOpts,
    upgraderPathing: MoveToOpts,
    rallyPointPathing: MoveToOpts,
    subordinatePathing: MoveToOpts
}
```

### Environment Constants
- `IS_SIM: boolean` - Running in simulation
- `IS_MMO: boolean` - Running on official server
- `PLAYER_USERNAME: string` - Account username
- `INVADER_USERNAME: string` - "Invader"
- `SOURCE_KEEPER_USERNAME: string` - "Source Keeper"
- `CARAVAN_USERNAME: string` - "Screeps"

### Resource Lists
- `MINERALS_ALL: MineralConstant[]` - All minerals
- `COMPOUNDS_ALL: MineralCompoundConstant[]` - All compounds

### Return Codes
```typescript
RETURN_CODES: Record<ScreepsReturnCode, string>
```

---

## Type Definitions

### Basic Types
```typescript
type alignment = 'left' | 'right' | 'center';
type CreepRole = "harvester" | "upgrader" | "builder" | "repairer" |
                 "defender" | "filler" | "hauler";
type RoomName = `${'W' | 'E'}${number}${'N' | 'S'}${number}`;
type Locality = 'local' | 'remote';
```

### Complex Types

#### RoomRoute
```typescript
type RoomRoute = RoomPathStep[];

interface RoomPathStep {
    room: string;
    exit: ExitConstant;
}
```

#### SourceAssignmentUpdate
```typescript
type SourceAssignmentUpdate = {
    source: Id<Source> | false;
    container: Id<StructureContainer> | false;
    pathLengthToStorage: number | false;
    pathToStorage: PathFinderPath | false;
    creepAssigned: string | false;
    creepDeathTick: number | false;
}
```

---

## Creep AI Modules
**Location:** `creeps.ts`

### Harvester
- `Harvester.run(creep: Creep): void`
- `Harvester.runremote(creep: Creep): void`

### Builder
- `Builder.run(creep: Creep): void`
- `Builder.runremote(creep: Creep): void`

### Filler
- `Filler.run(creep: Creep): void`

### Hauler
- `Hauler.run(creep: Creep): void`

### Repairer
- `Repairer.run(creep: Creep): void`

### Reserver
- `Reserver.run(creep: Creep): void`

### Scout
- `Scout.run(creep: Creep): void`
- `Scout.tickCount: number`

### Upgrader
- `Upgrader.run(creep: Creep): void`

---

## Defense System
**Location:** `tower.ts`

### RoomDefense
**Function:** `RoomDefense(tower: StructureTower): void`

**Priority Order:**
1. Player-owned hostiles (healers prioritized)
2. NPC invaders
3. Damaged creeps (healing)
4. Structure repair (configurable)

---

## Visualization System
**Location:** `functions/visual/`

### Progress Indicators
- `buildProgress(cSite: ConstructionSite, room: Room): void`
- `repairProgress(building: AnyStructure, room: Room): void`

### Structure Drawing
- `drawStructureVisual(v: RoomVisual, x: number, y: number, type: StructureConstant, opts?: StructureStyle): void`
- `drawRoadsVisual(v: RoomVisual, roads: Points, opts?: RoadsStyle): void`
- `drawResourceVisual(v: RoomVisual, x: number, y: number, type: ResourceConstant, opts?: ResourceStyle): ScreepsReturnCode`

---

## Usage Patterns

### Initialization Pattern
```typescript
// Global initialization
if (!Memory.globalSettings) global.initGlobal();

// Room initialization
if (!room.memory.data) {
    room.initRoom();
    room.initFlags();
    room.cacheObjects();
}

// Manager initialization
if (!global.roomManagers[roomName]) {
    global.roomManagers[roomName] = new RoomManager(room);
}
```

### Spawn Request Pattern
```typescript
const manager = room.getSpawnManager();

manager.submitRequest({
    role: 'harvester',
    priority: 100,
    body: [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE],
    memory: {
        role: 'harvester',
        home: roomName,
        room: roomName,
        working: false,
        source: sourceID,
        bucket: containerID
    },
    roomName: roomName,
    urgent: false
});
```

### Creep AI Pattern
```typescript
for (const name in Game.creeps) {
    const creep = Game.creeps[name];
    switch (creep.memory.role) {
        case 'harvester':
            CreepAI.Harvester.run(creep);
            break;
        case 'upgrader':
            CreepAI.Upgrader.run(creep);
            break;
        // ... other roles
    }
}
```

### Room Manager Pattern
```typescript
_.forEach(Game.rooms, room => {
    if (!global.roomManagers[room.name]) {
        global.roomManagers[room.name] = new RoomManager(room);
    }
    global.roomManagers[room.name].run();
});
```

### Logistics Pattern
```typescript
// Register pairs once
if (!room.memory.data.logisticalPairs) {
    room.registerLogisticalPairs();
}

// Assign to haulers
if (!creep.memory.pickup) {
    creep.assignLogisticalPair();
}
```

---

## Console Commands

### Room Management
```typescript
// Initialize room
Game.rooms['E25N25'].initRoom()

// Cache objects
Game.rooms['E25N25'].cacheObjects()

// Register logistics
Game.rooms['E25N25'].registerLogisticalPairs()

// Set quota
Game.rooms['E25N25'].setQuota('hauler', 4)
```

### Spawn Management
```typescript
// Get status
global.roomManagers['E25N25'].getSpawnManager().getStatus()

// View queue
global.roomManagers['E25N25'].getSpawnManager().getQueue()

// Clear queue (emergency)
global.roomManagers['E25N25'].getSpawnManager().clearQueue()
```

### Creep Commands
```typescript
// Assign source
Game.creeps['Col1_H1'].assignHarvestSource('local', true, true)

// Assign logistics
Game.creeps['Col1_Hauler1'].assignLogisticalPair()

// Cache outpost
Game.creeps['Col1_RH1'].cacheLocalOutpost()
```

### Global Functions
```typescript
// Calculate path
global.calcPath(creep.pos, target.pos)

// Calculate body cost
global.calcBodyCost([WORK, WORK, MOVE, CARRY])

// Determine body parts
global.determineBodyParts('harvester', 800)

// Room navigation
global.roomExitsTo('E25N25', TOP)
global.splitRoomName('E25N25')
```

---

## Memory Access Patterns

### Room Objects
```typescript
// Cached IDs
const sourceIDs = room.memory.objects.sources;
const towerIDs = room.memory.objects.towers;

// Container references
const controllerContainer = room.memory.containers.controller;
const sourceOneContainer = room.memory.containers.sourceOne;
const prestorageContainer = room.memory.containers.prestorage;

// Link references (NEW)
const sourceLink = room.memory.links.sourceOne;
const controllerLink = room.memory.links.controller;
const storageLink = room.memory.links.storage;

// Quick access via Room properties (recommended)
const sourceOne = room.sourceOne;
const sourceTwo = room.sourceTwo;
const containerOne = room.containerOne;
const linkController = room.linkController;
```

### Room Settings
```typescript
// Repair settings
const repairWalls = room.memory.settings.repairSettings.walls;
const wallLimit = room.memory.settings.repairSettings.wallLimit;

// Visual settings
const progressInfo = room.memory.settings.visualSettings.progressInfo;

// Flags
const bootstrap = room.memory.flags.bootstrap;
```

### Room Statistics
```typescript
// Energy stats
const energyHarvested = room.memory.stats.energyHarvested;

// Control points
const controlPoints = room.memory.stats.controlPoints;

// Mineral stats
const uraniumHarvested = room.memory.stats.mineralsHarvested.utrium;
```

### Room Threats (NEW)
```typescript
// Hostile tracking
const invaders = room.memory.hostileTracking.invaderCount;
const playerCreeps = room.memory.hostileTracking.playerCreepCount;

if (invaders > 0 || playerCreeps > 0) {
    console.log(`Room is under attack! Invaders: ${invaders}, Player creeps: ${playerCreeps}`);
}
```

### Outpost Management (UPDATED)
```typescript
// Outpost counters
const pairCounter = room.memory.outposts.counter;
const guardCounter = room.memory.outposts.guardCounter;

// These track rotation through logistics pairs and guard placements
console.log(`Next logistics pair index: ${pairCounter}`);
console.log(`Guard placement counter: ${guardCounter}`);
```

### Build Queue (NEW)
```typescript
// Planned construction (optional)
if (room.memory.buildQueue) {
    const plannedAt = room.memory.buildQueue.plannedAt;
    console.log(`Build plan created at tick ${plannedAt}`);
}
```

### Creep Memory
```typescript
// Basic properties
const role = creep.memory.role;
const home = creep.memory.home;
const working = creep.memory.working;

// Harvester properties
const source = creep.memory.source;
const bucket = creep.memory.bucket;

// Hauler properties
const pickup = creep.memory.pickup;
const dropoff = creep.memory.dropoff;
const cargo = creep.memory.cargo;

// Reserver properties
const targetOutpost = creep.memory.targetOutpost;
const controller = creep.memory.controller;
```

---

## Performance Tips

### 1. Use Cached Objects
```typescript
// Good
const tower = Game.getObjectById(room.memory.objects.towers[0]);

// Bad
const tower = room.find(FIND_MY_STRUCTURES, {
    filter: { structureType: STRUCTURE_TOWER }
})[0];
```

### 2. Minimize find() Calls
```typescript
// Good - cache in manager
this.resources = this.scanResources(); // Once per tick

// Bad - multiple finds per tick
room.find(FIND_SOURCES); // Called multiple times
```

### 3. Use Efficient Pathfinding
```typescript
// Good - reuse paths
creep.moveTo(target, { reusePath: 5 });

// Good - use cached routes
creep.advMoveTo(target, true);

// Bad - recalculate every tick
creep.moveTo(target);
```

### 4. Batch Operations
```typescript
// Good - process all creeps of same role together
const harvesters = _.filter(Game.creeps, c => c.memory.role === 'harvester');
harvesters.forEach(h => CreepAI.Harvester.run(h));

// Less efficient - role checking in loop
for (const name in Game.creeps) {
    if (Game.creeps[name].memory.role === 'harvester') {
        // ...
    }
}
```

---

## Common Error Codes

### Spawn Errors
- `ERR_NOT_ENOUGH_ENERGY` - Insufficient energy
- `ERR_NAME_EXISTS` - Creep name already taken
- `ERR_BUSY` - Spawn currently spawning
- `ERR_INVALID_ARGS` - Invalid body or memory

### Movement Errors
- `ERR_NO_PATH` - No path to target
- `ERR_NOT_IN_RANGE` - Too far from target
- `ERR_TIRED` - Creep fatigued

### Resource Errors
- `ERR_NOT_ENOUGH_RESOURCES` - Structure empty
- `ERR_FULL` - Structure full
- `ERR_INVALID_TARGET` - Invalid target object

---

## Migration Guide

### From Legacy Code

#### Old Spawn System → SpawnManager
```typescript
// Old
spawn.spawnCreep(body, name, { memory });

// New
spawnManager.submitRequest({
    role: 'harvester',
    priority: 100,
    body: body,
    memory: memory,
    roomName: roomName,
    urgent: false
});
```

#### Old Movement → advMoveTo
```typescript
// Old
if (creep.room.name === target.pos.roomName) {
    creep.moveTo(target);
} else {
    // Manual cross-room logic
}

// New
creep.advMoveTo(target, true);
```

#### Old Resource Transfer → advGet/advGive
```typescript
// Old
if (creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
    creep.moveTo(container);
}

// New
creep.advGet(container);
```

---

## Debugging

### Enable Logging
```typescript
// Disable alert spam
Memory.globalSettings.alertDisabled = true;

// Adjust console spawn interval
Memory.globalSettings.consoleSpawnInterval = 10; // Every 10 ticks
```

### Inspect Manager State
```typescript
// Room resources
global.roomManagers['E25N25'].getResources()

// Room stats
global.roomManagers['E25N25'].getStats()

// Spawn status
global.roomManagers['E25N25'].getSpawnManager().getStatus()
```

### Check Memory
```typescript
// Room memory
JSON.stringify(Game.rooms['E25N25'].memory, null, 2)

// Creep memory
JSON.stringify(Game.creeps['Col1_H1'].memory, null, 2)

// Global settings
JSON.stringify(Memory.globalSettings, null, 2)
```

---

## Further Reading

- [System Architecture](System-Architecture) - Overall design
- [RoomManager](RoomManager) - Room management details
- [SpawnManager](SpawnManager) - Spawning system details
- [Spawn Prototype Extensions](SpawnPrototypes) - Spawn prototype methods (NEW)
- [Creep Roles](Creep-Roles) - Individual role documentation
- [Creep Prototype Extensions](Creep-Prototype-Extensions) - Creep methods
- [Room Prototype Extensions](Room-Prototype-Extensions) - Room methods and accessor properties
- [Defense System](Defense-System) - Tower management
- [Logistics System](Logistics-System) - Hauler coordination
