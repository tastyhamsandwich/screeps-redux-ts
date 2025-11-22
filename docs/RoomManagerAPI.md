# RoomManager

The `RoomManager` class is the central controller for all room-level operations, coordinating infrastructure planning, creep spawning, resource management, and defense.

## Class Definition

```typescript
class RoomManager {
    private room: Room;
    private resources: RoomResources;
    private stats: RoomStats;
    private spawnManager: SpawnManager;
    
    constructor(room: Room);
    run(): void;
    getResources(): RoomResources;
    getStats(): RoomStats;
    getSpawnManager(): SpawnManager;
}
```

## Constructor

### `constructor(room: Room)`

Creates a new RoomManager instance for the specified room.

**Parameters:**
- `room: Room` - The room to manage

**Example:**
```typescript
const manager = new RoomManager(Game.rooms['E25N25']);
```

**Initialization:**
- Scans room resources
- Gathers room statistics
- Creates SpawnManager instance
- Initializes room memory if needed

## Public Methods

### `run(): void`

Main execution method called every tick. Orchestrates all room operations.

**Operations performed (in order):**
1. Update resources and stats
2. Run spawn manager
3. Update bootstrap state
4. Plan source containers (all RCLs)
5. Plan controller container (RCL 2+)
6. Plan extensions (RCL 2+)
7. Plan mineral container (RCL 6+)
8. Assess creep needs and submit spawn requests
9. Assign tasks to worker creeps
10. Manage towers
11. Manage links
12. Draw planning visuals

**Example:**
```typescript
_.forEach(Game.rooms, room => {
    if (!global.roomManagers[room.name]) {
        global.roomManagers[room.name] = new RoomManager(room);
    }
    global.roomManagers[room.name].run();
});
```

### `getResources(): RoomResources`

Returns current room resources snapshot.

**Returns:**
```typescript
{
    sources: Source[],
    minerals: Mineral[],
    controller: StructureController | undefined,
    containers: StructureContainer[],
    towers: StructureTower[],
    spawns: StructureSpawn[],
    links: StructureLink[],
    storage: StructureStorage | undefined,
    terminal: StructureTerminal | undefined
}
```

### `getStats(): RoomStats`

Returns current room statistics.

**Returns:**
```typescript
{
    controllerLevel: number,
    energyAvailable: number,
    energyCapacityAvailable: number,
    constructionSites: ConstructionSite[],
    damagedStructures: Structure[]
}
```

### `getSpawnManager(): SpawnManager`

Returns the SpawnManager instance for this room.

**Returns:** `SpawnManager`

## Private Methods

### Resource Management

#### `scanResources(): RoomResources`

Scans the room for all relevant structures and resources.

**Finds:**
- All sources
- All minerals
- Controller
- Containers, towers, spawns, links
- Storage and terminal

**Called:** Every tick in `run()`

#### `gatherStats(): RoomStats`

Gathers current room statistics including damaged structures.

**Features:**
- Prioritizes critical structures (towers, spawns, extensions)
- Sorts damaged structures by repair priority
- Excludes walls from damage scan

### Infrastructure Planning

#### `planSourceContainers(): void`

Ensures each source has a container or construction site planned nearby (range 2).

**Logic:**
1. Check existing container references in memory
2. Search for existing containers near sources
3. Search for existing construction sites
4. If none found, plan new container at optimal position

**Example memory update:**
```typescript
room.memory.data.sourceOne = {
    source: sourceId,
    container: containerId
};
```

#### `planControllerContainer(): void`

Ensures a container exists near the controller (range 3) for upgraders.

**Requirements:** RCL 2+

**Storage location:** `room.memory.data.controllerContainer`

#### `planMineralContainer(): void`

Ensures a container exists near the mineral deposit (range 2).

**Requirements:** RCL 6+ and mineral extractor

**Storage location:** `room.memory.data.mineralContainer`

#### `planExtensions(): void`

Plans extension construction sites around spawns.

**Logic:**
1. Check current extension count vs RCL limits
2. Find open positions in expanding rings around spawn (range 2-8)
3. Place one construction site per tick

**RCL Extension Limits:**
- RCL 2: 5 extensions
- RCL 3: 10 extensions
- RCL 4: 20 extensions
- RCL 5: 30 extensions
- RCL 6: 40 extensions
- RCL 7: 50 extensions
- RCL 8: 60 extensions

### Creep Management

#### `assessCreepNeeds(): void`

Evaluates current creep populations and submits spawn requests to SpawnManager.

**Priority Order:**
1. **Harvesters** (Priority 100) - Until sources fully staffed
2. **Fillers** (Priority 95) - Fill spawn energy needs
3. **Haulers** (Priority 90) - Storage logistics
4. **Upgraders** (Priority 70) - Controller upgrading
5. **Builders** (Priority 65) - Construction sites exist
6. **Repairers** (Priority 60) - Repair quota
7. **Reservers** (Priority 55) - Remote reservation
8. **Remote Harvesters** (Priority 50) - Outpost mining

**Emergency Handling:**
- If zero harvesters, uses `energyAvailable` instead of `energyCapacityAvailable`
- Marks as urgent to skip energy checks

**Deduplication:**
- Counts both alive creeps and pending spawns in queue/scheduled
- Prevents duplicate spawn requests

#### `assignWorkerTask(creep: Creep): void`

Assigns dynamic tasks to worker creeps based on room needs.

**Task Priority:**
1. Withdraw energy (if empty)
2. Haul to spawns/extensions (if needed)
3. Fill towers (if below 200 energy)
4. Critical repairs (below 30% health)
5. Build construction sites
6. General repairs
7. Upgrade controller (fallback)

**Storage:** `creep.memory.task`

#### `needMoreHarvesters(): boolean`

Determines if additional harvesters are needed based on work parts per source.

**Logic:**
```typescript
// Each source needs 5 WORK parts (generates 10 energy/tick)
const neededWorkParts = sources.length * 5;
const totalWorkParts = harvesters.reduce((sum, h) => 
    sum + h.getActiveBodyparts(WORK), 0);
return totalWorkParts < neededWorkParts;
```

### Structure Management

#### `manageTowers(): void`

Delegates tower operations to `RoomDefense()` function.

**Calls:** `RoomDefense(tower)` for each tower

#### `manageLinks(): void`

Transfers energy from source links to sink links.

**Link Classification:**
- **Source Links**: Within range 2 of a source
- **Sink Links**: All other links (typically near controller/storage)

**Transfer Logic:**
```typescript
if (sourceLink.energy > 700 && sinkLink.freeCapacity > 400) {
    sourceLink.transferEnergy(sinkLink);
}
```

#### `getRepairPriority(structure: Structure): number`

Calculates repair priority for structures.

**Priority Scale (higher = more urgent):**
- Towers: 100 - (hits%)
- Spawns: 95 - (hits%)
- Extensions: 80 - (hits%)
- Containers: 70 - (hits%) if below 50%
- Roads: 60 - (hits%) if below 50%
- Others: 50 - (hits%)

### Visualization

#### `drawPlanningVisuals(): void`

Draws planned structures and status indicators using RoomVisual.

**Displays:**
- Extension sites (yellow circles)
- Existing extensions (green circles)
- Planned containers (colored by type)
  - Controller: cyan
  - Sources: purple
- Spawn center marker

### Bootstrap Mode

#### `updateBootstrapState(): void`

Determines if room should operate in bootstrap mode.

**Bootstrap Conditions:**
```typescript
RCL === 1 && 
creepCount < 5 && 
!hasContainer
```

**Effects when enabled:**
- Harvesters deliver directly to spawns
- Modified spawning priorities
- Simpler body configurations

**Storage:** `room.memory.flags.bootstrap`

## Memory Structure

### Room Memory Layout

```typescript
interface RoomMemory {
    data?: {
        sourceOne?: {
            source: Id<Source>;
            container: Id<StructureContainer | ConstructionSite>;
        };
        sourceTwo?: {
            source: Id<Source>;
            container: Id<StructureContainer | ConstructionSite>;
        };
        controllerContainer?: Id<StructureContainer | ConstructionSite>;
        mineralContainer?: {
            mineral: Id<Mineral>;
            container: Id<StructureContainer | ConstructionSite>;
        };
        lastHarvesterAssigned?: number;
        controllerLevel?: number;
        numCSites?: number;
        logisticalPairs?: LogisticsPair[];
    };
    quotas: {
        harvesters: number;
        fillers: number;
        haulers: number;
        upgraders: number;
        builders: number;
        repairers: number;
        reservers: number;
        // ... remote roles
    };
    flags: RoomFlags;
    spawnManager: {
        queue: SpawnRequest[];
        scheduled: ScheduledSpawn[];
        deferred?: SpawnRequest[];
        lastProcessed: number;
    };
}
```

## Usage Examples

### Basic Setup

```typescript
// In main loop
if (!global.roomManagers) global.roomManagers = {};

_.forEach(Game.rooms, room => {
    if (!global.roomManagers[room.name]) {
        global.roomManagers[room.name] = new RoomManager(room);
    }
    global.roomManagers[room.name].run();
});
```

### Accessing Room Data

```typescript
const manager = global.roomManagers['E25N25'];

// Get current resources
const resources = manager.getResources();
console.log(`Towers: ${resources.towers.length}`);
console.log(`Energy: ${resources.storage?.store[RESOURCE_ENERGY]}`);

// Get room stats
const stats = manager.getStats();
console.log(`RCL: ${stats.controllerLevel}`);
console.log(`Construction sites: ${stats.constructionSites.length}`);
```

### Spawn Management Integration

```typescript
const manager = global.roomManagers['E25N25'];
const spawnManager = manager.getSpawnManager();

// Check spawn status
const status = spawnManager.getStatus();
console.log(`Queue length: ${status.queueLength}`);
console.log(`Next spawn: ${status.nextSpawn?.role}`);
```

### Manual Infrastructure Planning

```typescript
const manager = global.roomManagers['E25N25'];

// Access private methods via manager instance
// (These are called automatically by run())

// Force re-planning of containers
manager['planSourceContainers']();
manager['planControllerContainer']();

// Check what's been planned
const data = Game.rooms['E25N25'].memory.data;
console.log(`Source 1 container: ${data.sourceOne?.container}`);
```

## Performance Considerations

1. **Resource Scanning**: Done once per tick, cached in `this.resources`
2. **Stat Gathering**: Damaged structures sorted by priority once per tick
3. **Memory Access**: Frequently accessed data cached in class properties
4. **Visual Drawing**: Only draws when structures exist to display
5. **Spawn Requests**: Deduplicates by checking queue and scheduled spawns

## Integration with Other Systems

### SpawnManager
- RoomManager submits spawn requests
- SpawnManager handles queue, conflicts, and scheduling
- Post-spawn callbacks handled by SpawnManager

### Defense System
- RoomManager calls `RoomDefense()` for each tower
- Tower behavior configured via room settings

### Creep AI
- RoomManager assigns tasks via `creep.memory.task`
- Creep AI modules read task and execute
- Worker creeps check task between actions

### Infrastructure Planning
- Plans structures based on RCL
- Creates construction sites automatically
- Tracks in room memory for persistence