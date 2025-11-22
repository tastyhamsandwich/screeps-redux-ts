# Room Prototype Extensions

Custom methods added to the `Room` prototype for object caching, initialization, outpost management, and logistics coordination.

## Table of Contents
- [Object Caching](#object-caching)
- [Initialization](#initialization)
- [Source Management](#source-management)
- [Logistics](#logistics)
- [Outpost Management](#outpost-management)
- [Utility Methods](#utility-methods)
- [Accessor Properties](#accessor-properties)

---

## Object Caching

### `cacheObjects(): void`

Scans and caches all room structures and resources to memory for efficient access.

**Caches:**
- Sources, minerals, deposits
- Controller
- Spawns, extensions, towers
- Containers (categorized by location)
- Storage, terminal, links
- Labs, factory, observer
- Extractor, power spawn, nuker
- Keeper lairs, power banks, portals
- Invader cores, walls, ramparts

**Container Categorization:**
Containers are automatically categorized based on proximity:
- `sourceOne`: Within range 2 of first source
- `sourceTwo`: Within range 2 of second source
- `controller`: Within range 3 of controller
- `mineral`: Within range 2 of mineral

**Example:**
```typescript
room.cacheObjects();

// Access cached objects
const sources = room.memory.objects.sources; // [Id<Source>, Id<Source>]
const towers = room.memory.objects.towers;   // Id<StructureTower>[]
const storage = room.memory.objects.storage; // [Id<StructureStorage>]
```

**Memory Structure:**
```typescript
room.memory.objects = {
    sources: Id<Source>[],
    mineral: [Id<Mineral>],
    controller: [Id<StructureController>],
    spawns: Id<StructureSpawn>[],
    extensions: Id<StructureExtension>[],
    towers: Id<StructureTower>[],
    containers: Id<StructureContainer>[],
    storage: [Id<StructureStorage>],
    links: Id<StructureLink>[],
    labs: Id<StructureLab>[],
    terminal: [Id<StructureTerminal>],
    // ... and more
};

room.memory.containers = {
    sourceOne: Id<StructureContainer>,
    sourceTwo: Id<StructureContainer>,
    controller: Id<StructureContainer>,
    mineral: Id<StructureContainer>
};
```

**Logging Output:**
```
[E25N25]: Caching room objects...
[E25N25]: Cached 2 sources.
[E25N25]: Cached 1 mineral.
[E25N25]: Cached 1 controller.
[E25N25]: Cached 3 containers.
[E25N25]: Cached 1 storage.
[E25N25]: Caching objects for room 'E25N25' completed.
```

**Outpost Integration:**
If room is an outpost (has `hostColony` in memory), updates are propagated to host colony:
```typescript
if (this.memory.hostColony !== undefined) {
    Game.rooms[this.memory.hostColony].memory.outposts.list[this.name].sourceIDs = storageArray;
    Game.rooms[this.memory.hostColony].memory.outposts.list[this.name].controllerID = storageArray[0];
}
```

---

## Initialization

### `initRoom(): void`

Initializes room memory with default values and settings.

**Creates:**
- Default creep quotas
- Room settings (visual, repair, flags)
- Container references
- Outpost data structure
- Statistics tracking

**Example:**
```typescript
if (!room.memory.data) {
    room.initRoom();
}
```

**Default Quotas:**
```typescript
room.memory.quotas = {
    harvesters: 2,
    upgraders: 2,
    fillers: 2,
    haulers: 2,
    builders: 2,
    repairers: 1
};
```

**Default Settings:**
```typescript
const visualSettings = {
    progressInfo: {
        alignment: 'left',
        xOffset: 1,
        yOffsetFactor: 0.6,
        stroke: '#000000',
        fontSize: 0.6,
        color: ''
    }
};

const towerSettings = {
    creeps: true,
    walls: false,
    ramparts: false,
    roads: false,
    others: false,
    wallLimit: 10,
    rampartLimit: 10,
    maxRange: 10
};

const repairSettings = {
    walls: false,
    ramparts: false,
    roads: true,
    others: true,
    wallLimit: 10,
    rampartLimit: 10,
    towerSettings: towerSettings
};
```

**Statistics Initialization:**
```typescript
room.memory.stats = {
    energyHarvested: 0,
    controlPoints: 0,
    constructionPoints: 0,
    creepsSpawned: 0,
    creepPartsSpawned: 0,
    mineralsHarvested: { /* all minerals: 0 */ },
    controllerLevelReached: 0,
    npcInvadersKilled: 0,
    hostilePlayerCreepsKilled: 0,
    labStats: { /* lab statistics */ }
};
```

### `initFlags(): void`

Initializes room flag settings with default values.

**Flags:**
```typescript
room.memory.settings.flags = {
    craneUpgrades: false,
    repairRamparts: true,
    repairWalls: true,
    centralStorageLogic: false,
    dropHarvestingEnabled: false,
    haulersDoMinerals: false,
    towerRepairBasic: false,
    towerRepairDefenses: false,
    haulersPickupEnergy: false,
    harvestersFixAdjacent: false,
    repairBasics: true,
    upgradersSeekEnergy: true,
    sortConSites: false,
    closestConSites: false
};
```

**Example:**
```typescript
room.initFlags();
console.log(room.memory.settings.flags.repairRamparts); // true
```

---

## Source Management

### `getSourcePositions(sourceID): RoomPosition[]`

Returns walkable positions around a source.

**Signature:**
```typescript
getSourcePositions(sourceID: string): RoomPosition[]
```

**Parameters:**
- `sourceID` - ID of source to check

**Returns:** Array of walkable RoomPositions around the source

**Features:**
- Filters out wall terrain
- Calculates work parts needed per position
- Tracks assigned harvesters

**Example:**
```typescript
const source = room.find(FIND_SOURCES)[0];
const positions = room.getSourcePositions(source.id);

console.log(`Source has ${positions.length} walkable positions`);
// Output: "Source has 6 walkable positions"
```

**Implementation Details:**
```typescript
getSourcePositions(sourceID) {
    const source = this.find(FIND_SOURCES, {
        filter: s => s.id === sourceID
    })[0];
    
    if (!source) return [];
    
    const walkableSourcePos = source.pos.getWalkablePositions();
    const numberWalkablePositions = walkableSourcePos.length;
    const minimumWorkPartsPerPosition = 5 / numberWalkablePositions;
    
    // Find harvesters at positions
    const sourceHarvesters = [];
    for (const pos of walkableSourcePos) {
        const creep = pos.lookFor(LOOK_CREEPS).filter(
            c => c.my && c.memory.role === 'harvester'
        );
        if (creep.length) sourceHarvesters.push(creep[0]);
    }
    
    // Calculate missing work parts
    let missingWorkParts = 5;
    for (const creep of sourceHarvesters) {
        missingWorkParts -= creep.getActiveBodyparts(WORK);
    }
    
    return walkableSourcePos;
}
```

### `updateSourceAssignment(roomToUpdate, updateObject): boolean`

Updates source assignment data for a room or outpost.

**Signature:**
```typescript
updateSourceAssignment(
    roomToUpdate: string,
    updateObject: SourceAssignmentUpdate
): boolean
```

**Parameters:**
- `roomToUpdate` - Name of room to update
- `updateObject` - Update data

**Update Object Structure:**
```typescript
{
    source: Id<Source> | false,
    container: Id<StructureContainer> | false,
    pathLengthToStorage: number | false,
    pathToStorage: PathFinderPath | false,
    creepAssigned: string | false,
    creepDeathTick: number | false
}
```

**Example:**
```typescript
room.updateSourceAssignment('W5N5', {
    source: sourceId,
    container: containerId,
    pathLengthToStorage: 45,
    pathToStorage: pathObj,
    creepAssigned: 'Col1_RH1',
    creepDeathTick: Game.time + 1500
});
```

---

## Logistics

### `registerLogisticalPairs(): boolean`

Discovers and registers all logistical pairs (pickup→dropoff routes) in the room.

**Returns:** `true` if pairs registered, `false` if none available

**Pair Types:**
1. **Source → Storage** (local)
2. **Storage → Controller Container** (local)
3. **Mineral Container → Storage** (local, RCL 6+)
4. **Remote Source → Storage** (remote, if outposts exist)

**Features:**
- Calculates path lengths for each pair
- Prioritizes links over direct routes when available
- Updates hauler quota to match pair count

**Example:**
```typescript
room.registerLogisticalPairs();

// Access pairs
const pairs = room.memory.data.logisticalPairs;
pairs.forEach(pair => {
    console.log(`${pair.descriptor}: ${pair.distance} tiles`);
});

// Output:
// source to storage: 12 tiles
// source to storage: 15 tiles
// storage to upgrader: 18 tiles
```

**Logistical Pair Structure:**
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

**Path Calculation:**
```typescript
for (let i = 0; i < logisticalPairs.length; i++) {
    const pair = logisticalPairs[i];
    const startPos = Game.getObjectById(pair.source).pos;
    const endPos = Game.getObjectById(pair.destination).pos;
    
    if (startPos && endPos) {
        let pathObj = calcPath(startPos, endPos);
        logisticalPairs[i].distance = pathObj.length;
    }
}
```

**Quota Update:**
```typescript
this.setQuota('hauler', this.memory.data.logisticalPairs.length);
```

**Console Output:**
```
------------------------------------------------- REGISTERED LOGISTICAL PAIRS --------------------------------------------------
PAIR #1: OUTBOX> 5d2... | INBOX> 5d3... | CARGO> energy | LOCALITY> local | TYPE> source to storage
PAIR #2: OUTBOX> 5d4... | INBOX> 5d3... | CARGO> energy | LOCALITY> local | TYPE> source to storage
PAIR #3: OUTBOX> 5d3... | INBOX> 5d5... | CARGO> energy | LOCALITY> local | TYPE> storage to upgrader
```

### `setQuota(roleTarget, newTarget): void`

Sets the spawn quota for a specific creep role.

**Signature:**
```typescript
setQuota(roleTarget: CreepRole, newTarget: number): void
```

**Parameters:**
- `roleTarget` - Creep role (singular: 'harvester', 'builder', etc.)
- `newTarget` - New quota value

**Example:**
```typescript
room.setQuota('hauler', 4);
room.setQuota('upgrader', 3);
room.setQuota('builder', 2);

console.log(room.memory.quotas.haulers);   // 4
console.log(room.memory.quotas.upgraders); // 3
console.log(room.memory.quotas.builders);  // 2
```

**Logging:**
```
[E25N25]: Set role 'haulers' quota to 4 (was 2).
```

---

## Outpost Management

### `initOutpost(roomName): void`

Initializes an outpost entry in the room's outpost management system.

**Signature:**
```typescript
initOutpost(roomName: string): void
```

**Parameters:**
- `roomName` - Name of outpost room

**Creates:**
- Outpost memory structure
- Source assignment map
- Controller flag
- Host colony reference

**Example:**
```typescript
// In main colony (E25N25)
const colony = Game.rooms['E25N25'];
colony.initOutpost('W5N5');

// W5N5 now has:
Game.rooms['W5N5'].memory.hostColony; // 'E25N25'

// E25N25 now has:
colony.memory.outposts.list['W5N5']; // OutpostData object
colony.memory.outposts.array;         // ['W5N5']
```

**Outpost Structure:**
```typescript
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
```

**Source Assignment Map Creation:**
```typescript
for (let source of sourceIDs) {
    const sourceAssignment = {
        source: source,
        container: null,
        pathLengthToStorage: null,
        pathToStorage: null,
        creepAssigned: null,
        creepDeathTick: null
    };
    this.memory.outposts.list[roomName].sourceAssignmentMap.push(sourceAssignment);
}
```

**Flag Creation:**
```typescript
const controllerPos = Game.rooms[roomName].controller?.pos;
if (controllerPos) {
    const flag = Game.rooms[roomName].find(FIND_FLAGS, {
        filter: { name: roomName }
    });
    
    if (!flag.length) {
        Game.rooms[roomName].createFlag(
            controllerPos,
            roomName,
            COLOR_BLUE,
            COLOR_WHITE
        );
    }
}
```

---

## Utility Methods

### `link(): string`

Returns HTML-formatted room link for console logging.

**Returns:** Formatted string with clickable room link

**Example:**
```typescript
console.log(room.link() + 'Room initialized');
// Output: [E25N25]: Room initialized
// (E25N25 is clickable and navigates to room)
```

**Implementation:**
```typescript
link() {
    return `<span color='red'>[<a href="#!/room/${Game.shard.name}/${this.name}">${this.name}</a></span>]: `;
}
```

### `counter: OutpostSourceCounter`

Property that returns an OutpostSourceCounter instance for the room.

**Usage:**
```typescript
const returnObj = room.counter.next();
console.log(returnObj.source);    // Id<Source>
console.log(returnObj.container); // Id<StructureContainer>
```

**Implementation:**
```typescript
Object.defineProperty(Room.prototype, "counter", {
    get: function(this: Room): OutpostSourceCounter {
        if (!global.__outpostCounters.has(this.name)) {
            const counter = new OutpostSourceCounter(
                this,
                this.memory.outposts.counter
            );
            global.__outpostCounters.set(this.name, counter);
        }
        return global.__outpostCounters.get(this.name)!;
    },
    enumerable: false,
    configurable: false
});
```

---

## Usage Examples

### Complete Room Setup

```typescript
// Initialize new room
const room = Game.rooms['E25N25'];

if (!room.memory.data) {
    room.initRoom();
    room.initFlags();
    room.cacheObjects();
}

// Setup logistics
room.registerLogisticalPairs();

// Setup outpost
room.initOutpost('W5N5');
```

### Accessing Cached Objects

```typescript
// Get cached IDs
const sourceIDs = room.memory.objects.sources;
const towerIDs = room.memory.objects.towers;

// Get actual objects
const sources = sourceIDs.map(id => Game.getObjectById(id));
const towers = towerIDs.map(id => Game.getObjectById(id));

// Use cached containers
const controllerContainer = Game.getObjectById(
    room.memory.containers.controller
);
```

### Managing Logistics

```typescript
// Register pairs
room.registerLogisticalPairs();

// Check registered pairs
const pairs = room.memory.data.logisticalPairs;
console.log(`Room has ${pairs.length} logistical pairs`);

// Adjust hauler quota
room.setQuota('hauler', pairs.length);
```

### Outpost Management

```typescript
// Setup outpost
const colony = Game.rooms['E25N25'];
colony.initOutpost('W5N5');

// Access outpost data
const outpost = colony.memory.outposts.list['W5N5'];
console.log(`Outpost has ${outpost.sourceIDs.length} sources`);

// Update source assignment
colony.updateSourceAssignment('W5N5', {
    source: sourceId,
    container: containerId,
    pathLengthToStorage: 45,
    creepAssigned: 'Col1_RH1',
    creepDeathTick: Game.time + 1500
});
```

---

## Integration with RoomManager

RoomManager uses these methods extensively:

```typescript
class RoomManager {
    constructor(room: Room) {
        // Initialize if needed
        if (!room.memory.data) {
            room.initRoom();
        }
    }
    
    run() {
        // Cache objects periodically
        if (Game.time % 100 === 0) {
            this.room.cacheObjects();
        }
        
        // Register logistics
        if (!this.room.memory.data.logisticalPairs) {
            this.room.registerLogisticalPairs();
        }
    }
}
```

---

## Performance Considerations

1. **Cache Refresh**: Call `cacheObjects()` only when structures change (construction complete, destroyed)
2. **Logistics Registration**: Call `registerLogisticalPairs()` once during initialization or when storage is built
3. **Outpost Initialization**: Call `initOutpost()` only once per outpost
4. **Counter Access**: Counter property uses lazy initialization and caching

---

## Best Practices

### 1. Initialize Early

```typescript
// On first spawn or claim
if (!room.memory.data) {
    room.initRoom();
    room.initFlags();
    room.cacheObjects();
}
```

### 2. Refresh Cache Strategically

```typescript
// After construction completes
if (constructionSiteCompleted) {
    room.cacheObjects();
}

// Periodically (every 100 ticks)
if (Game.time % 100 === 0) {
    room.cacheObjects();
}
```

### 3. Use Cached Data

```typescript
// Good - uses cached ID
const tower = Game.getObjectById(room.memory.objects.towers[0]);

// Bad - searches every tick
const tower = room.find(FIND_MY_STRUCTURES, {
    filter: { structureType: STRUCTURE_TOWER }
})[0];
```

### 4. Register Logistics Once

```typescript
// During room initialization
if (!room.memory.data.logisticalPairs) {
    room.registerLogisticalPairs();
}

// Or when storage is built
if (room.storage && !room.memory.data.logisticalPairs) {
    room.registerLogisticalPairs();
}
```

---

## Accessor Properties

The Room prototype provides convenient getter/setter properties for quick access to common structures and references.

### `manager: RoomManager | undefined`

Gets the RoomManager instance for this room.

**Returns:** RoomManager if it exists, undefined otherwise

**Example:**
```typescript
const manager = room.manager;
if (manager) {
    const resources = manager.getResources();
}
```

### `sources: Source[]`

Gets or sets all sources in the room.

**Getter:** Returns array of Source objects from cached IDs

**Setter:** Accepts array of Sources and updates cache

**Example:**
```typescript
// Get all sources
const sources = room.sources;
console.log(`Room has ${sources.length} sources`);

// Set sources
room.sources = [source1, source2];
```

### `sourceOne: Source | null`

Gets the first source in the room.

**Returns:** First Source object or null if not found

**Example:**
```typescript
const source = room.sourceOne;
if (source) {
    console.log(`First source at ${source.pos}`);
}
```

### `sourceTwo: Source | null`

Gets the second source in the room (if available).

**Returns:** Second Source object or null if only one source or none

**Example:**
```typescript
const source = room.sourceTwo;
if (source) {
    console.log(`Second source at ${source.pos}`);
} else {
    console.log('Only one source in room');
}
```

### `containers: StructureContainer[]`

Gets or sets all containers in the room.

**Getter:** Returns array of StructureContainer objects

**Setter:** Accepts array of Containers and updates cache

**Example:**
```typescript
const containers = room.containers;
containers.forEach(c => console.log(c.store.getUsedCapacity()));
```

### `containerOne: StructureContainer | null`

Gets the container near the first source.

**Returns:** StructureContainer or null if not found

**Example:**
```typescript
const container = room.containerOne;
if (container && container.store.getFreeCapacity() > 0) {
    // Use container
}
```

### `containerTwo: StructureContainer | null`

Gets the container near the second source.

**Returns:** StructureContainer or null if not found

**Example:**
```typescript
const container = room.containerTwo;
if (container) {
    console.log(`Container 2 has ${container.store.getUsedCapacity()} energy`);
}
```

### `containerController: StructureContainer | null`

Gets the container near the controller.

**Returns:** StructureContainer or null if not found

**Example:**
```typescript
const controllerContainer = room.containerController;
if (controllerContainer) {
    // Haulers can bring energy here for upgraders
}
```

### `prestorage: StructureContainer | null`

Gets the prestorage container (used before storage is built).

**Returns:** StructureContainer or null if not found

**Example:**
```typescript
const prestorage = room.prestorage;
if (prestorage && prestorage.store.getUsedCapacity() > 0) {
    // Move energy to final storage
}
```

### `links: StructureLink[]`

Gets or sets all links in the room.

**Getter:** Returns array of StructureLink objects

**Setter:** Accepts array of Links and updates cache

**Example:**
```typescript
const links = room.links;
links.forEach(link => {
    if (link.store.getFreeCapacity() > 0) {
        // Use link
    }
});
```

### `linkOne: StructureLink | null`

Gets the link near the first source.

**Returns:** StructureLink or null if not found

**Example:**
```typescript
const sourceLink = room.linkOne;
if (sourceLink && sourceLink.cooldown === 0) {
    sourceLink.transferEnergy(room.linkController);
}
```

### `linkTwo: StructureLink | null`

Gets the link near the second source.

**Returns:** StructureLink or null if not found

### `linkController: StructureLink | null`

Gets the link near the controller.

**Returns:** StructureLink or null if not found

**Example:**
```typescript
const controllerLink = room.linkController;
if (controllerLink) {
    // Receive energy from source links
}
```

### `linkStorage: StructureLink | null`

Gets the link near the storage.

**Returns:** StructureLink or null if not found

**Example:**
```typescript
const storageLink = room.linkStorage;
if (storageLink && storageLink.store.getUsedCapacity() > 0) {
    // Send energy to other links
}
```

---

## Usage Patterns with Accessor Properties

### Quick Energy Check

```typescript
// Check all energy sources quickly
const sourceEnergy = room.sourceOne?.pos.findInRange(FIND_DROPPED_RESOURCES, 3) || [];
const containerEnergy = room.containerOne?.store.getUsedCapacity(RESOURCE_ENERGY) || 0;
const linkEnergy = room.linkOne?.store.getUsedCapacity(RESOURCE_ENERGY) || 0;

console.log(`Available energy: ${sourceEnergy.length * 100 + containerEnergy + linkEnergy}`);
```

### Link Transfer Chain

```typescript
// Automate link transfers
const sourceLink = room.linkOne;
const controllerLink = room.linkController;
const storageLink = room.linkStorage;

if (sourceLink && controllerLink && sourceLink.cooldown === 0) {
    sourceLink.transferEnergy(controllerLink);
}

if (storageLink && sourceLink && storageLink.cooldown === 0) {
    storageLink.transferEnergy(sourceLink);
}
```

### Container Status Check

```typescript
// Check all container conditions
const containers = [room.containerOne, room.containerTwo, room.containerController];

containers.forEach((container, index) => {
    if (container) {
        const usage = container.store.getUsedCapacity();
        const capacity = container.store.getCapacity();
        console.log(`Container ${index + 1}: ${usage}/${capacity}`);
    }
});
```