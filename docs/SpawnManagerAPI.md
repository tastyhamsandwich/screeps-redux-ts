# SpawnManager

The `SpawnManager` class provides intelligent spawn queue management with priority-based scheduling, predictive spawn replacement, energy forecasting, and conflict resolution.

## Class Definition

```typescript
class SpawnManager {
    private room: Room;
    private spawnQueue: SpawnRequest[];
    private scheduledSpawns: ScheduledSpawn[];
    private energyForecast: EnergyForecast;
    
    constructor(room: Room);
    run(): void;
    submitRequest(request: Omit<SpawnRequest, 'id' | 'requestedAt' | 'estimatedSpawnTime' | 'energyCost'>): boolean;
    getStatus(): SpawnStatus;
    getQueue(): SpawnRequest[];
    getScheduledSpawns(): ScheduledSpawn[];
    clearQueue(): void;
}
```

## Interfaces

### SpawnRequest

```typescript
interface SpawnRequest {
    id: string;                      // Auto-generated unique ID
    role: string;                    // Creep role
    priority: number;                // Priority (higher = more important)
    body: BodyPartConstant[];        // Body configuration
    memory: CreepMemory;             // Initial memory
    roomName: string;                // Home room
    urgent: boolean;                 // Skip energy checks if true
    requestedAt: number;             // Game.time when requested
    estimatedSpawnTime?: number;     // Body length * 3
    energyCost?: number;             // Total energy cost
}
```

### ScheduledSpawn

```typescript
interface ScheduledSpawn {
    role: string;           // Role being spawned
    scheduledTick: number;  // When spawn will begin
    duration: number;       // Ticks to complete
    energyCost: number;     // Energy required
    priority: number;       // Priority level
}
```

### EnergyForecast

```typescript
interface EnergyForecast {
    currentEnergy: number;
    capacityAvailable: number;
    incomePerTick: number;
    projectedEnergy: (ticks: number) => number;
}
```

## Constructor

### `constructor(room: Room)`

Creates a SpawnManager instance for the specified room.

**Parameters:**
- `room: Room` - The room to manage spawning for

**Initialization:**
```typescript
constructor(room: Room) {
    this.room = room;
    this.spawnQueue = [];
    this.scheduledSpawns = [];
    this.energyForecast = this.calculateEnergyForecast();
    
    // Initialize memory
    if (!this.room.memory.spawnManager) {
        this.room.memory.spawnManager = {
            queue: [],
            scheduled: [],
            lastProcessed: Game.time
        };
    }
    
    this.loadFromMemory();
}
```

## Public Methods

### `run(): void`

Main execution method called every tick.

**Operations:**
1. Recalculate energy forecast
2. Update predictive spawns
3. Process spawn queue
4. Save state to memory

**Example:**
```typescript
const manager = new SpawnManager(room);
manager.run();  // Called by RoomManager
```

### `submitRequest(request): boolean`

Submits a spawn request to the manager.

**Parameters:**
```typescript
{
    role: string,
    priority: number,
    body: BodyPartConstant[],
    memory: CreepMemory,
    roomName: string,
    urgent: boolean
}
```

**Returns:** `true` if accepted, `false` if rejected

**Rejection Reasons:**
- Invalid body (empty, >50 parts, or too expensive)
- Conflicts with higher-priority scheduled spawn
- Invalid role

**Example:**
```typescript
const success = spawnManager.submitRequest({
    role: 'harvester',
    priority: 100,
    body: [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE],
    memory: {
        role: 'harvester',
        home: 'E25N25',
        room: 'E25N25',
        working: false
    },
    roomName: 'E25N25',
    urgent: false
});

if (success) {
    console.log('Harvester spawn request accepted');
} else {
    console.log('Harvester spawn request rejected');
}
```

### `getStatus(): SpawnStatus`

Returns current spawn manager status for debugging/visualization.

**Returns:**
```typescript
{
    queueLength: number,
    scheduledSpawns: number,
    nextSpawn: SpawnRequest | null,
    energyIncome: number
}
```

**Example:**
```typescript
const status = spawnManager.getStatus();
console.log(`Queue: ${status.queueLength} requests`);
console.log(`Scheduled: ${status.scheduledSpawns} spawns`);
console.log(`Next: ${status.nextSpawn?.role || 'none'}`);
console.log(`Income: ${status.energyIncome} energy/tick`);
```

### `getQueue(): SpawnRequest[]`

Returns a copy of the current spawn queue.

**Returns:** Array of `SpawnRequest` objects

**Example:**
```typescript
const queue = spawnManager.getQueue();
queue.forEach(req => {
    console.log(`${req.role} - Priority ${req.priority} - Cost ${req.energyCost}`);
});
```

### `getScheduledSpawns(): ScheduledSpawn[]`

Returns a copy of scheduled spawns (predictive replacements).

**Returns:** Array of `ScheduledSpawn` objects

**Example:**
```typescript
const scheduled = spawnManager.getScheduledSpawns();
scheduled.forEach(s => {
    console.log(`${s.role} scheduled for tick ${s.scheduledTick}`);
});
```

### `clearQueue(): void`

Emergency function to clear the entire spawn queue and scheduled spawns.

**Warning:** Use with caution - this removes all pending spawn requests.

**Example:**
```typescript
spawnManager.clearQueue();
console.log('All spawn requests cleared');
```

## Private Methods

### Request Management

#### `validateRequest(request: SpawnRequest): boolean`

Validates a spawn request before accepting it.

**Validation Checks:**
- Body is not empty
- Body has ≤50 parts
- Energy cost ≤ room capacity
- Role is specified

**Returns:** `true` if valid

#### `checkScheduleConflict(request: SpawnRequest): ScheduledSpawn | null`

Checks if a spawn request conflicts with scheduled spawns.

**Conflict Types:**
1. **Time Conflict**: Spawn windows overlap
2. **Energy Conflict**: Not enough energy for both

**Resolution:**
- If scheduled spawn has higher/equal priority → reject request
- If request has higher priority → allow request

**Returns:** Conflicting `ScheduledSpawn` or `null`

**Example Logic:**
```typescript
// Time overlap check
const timeConflict = (
    (currentTick >= scheduled.scheduledTick && currentTick <= scheduledEnd) ||
    (ourEnd >= scheduled.scheduledTick && ourEnd <= scheduledEnd)
);

// Energy check
const energyAtScheduledTime = forecast.projectedEnergy(ticksUntilScheduled);
const energyAfterOurSpawn = energyAtScheduledTime - energyCost;
if (energyAfterOurSpawn < scheduled.energyCost) {
    // Check priorities
}
```

#### `sortQueue(): void`

Sorts spawn queue by priority and age.

**Sort Order:**
1. Urgent requests first
2. Higher priority
3. Older requests (FIFO for same priority)

**Example:**
```typescript
this.spawnQueue.sort((a, b) => {
    if (a.urgent && !b.urgent) return -1;
    if (!a.urgent && b.urgent) return 1;
    if (a.priority !== b.priority) return b.priority - a.priority;
    return a.requestedAt - b.requestedAt;
});
```

### Predictive Spawning

#### `updatePredictiveSpawns(): void`

Schedules replacement spawns for creeps nearing death.

**Predictive Roles:**
- harvester
- filler
- hauler
- reserver

**Logic:**
```typescript
const spawnTime = body.length * 3;
const deathTick = Game.time + creep.ticksToLive;
const scheduledSpawnTick = deathTick - spawnTime - SPAWN_BUFFER_TIME;
```

**Buffer Time:** 100 ticks before needed

**Features:**
- Prevents duplicate scheduling (checks if already scheduled)
- Only schedules if spawn time is in future
- Uses existing body configuration

**Example Output:**
```
[SpawnManager] E25N25: Scheduled harvester replacement in 350 ticks
```

### Spawn Processing

#### `processQueue(): void`

Processes the spawn queue and attempts to spawn creeps.

**Steps:**
1. Check for deferred requests to retry
2. Find available spawn
3. Get next request from queue
4. Check energy availability
5. Attempt spawn
6. Handle result

**Energy Logic:**
```typescript
if (energyAvailable < energyCost) {
    const ticksToAfford = Math.ceil(
        (energyCost - energyAvailable) / incomePerTick
    );
    
    if (ticksToAfford > 100 || request.urgent) {
        // Defer or skip
        return;
    }
}
```

#### `attemptSpawn(spawn: StructureSpawn, request: SpawnRequest): ScreepsReturnCode`

Attempts to spawn a creep from a request.

**Name Generation:**
```typescript
let name = `Col1_${roleShorthand}${countMod}`;
let result = spawn.spawnCreep(body, name, { memory });

while (result === ERR_NAME_EXISTS) {
    countMod++;
    name = `Col1_${roleShorthand}${countMod}`;
    result = spawn.spawnCreep(body, name, { memory });
}
```

**Post-Spawn Actions:**
- Logs spawn success
- Calls `handlePostSpawn()` for role-specific initialization
- Adds to scheduled spawns list

**Returns:** Screeps return code

#### `handlePostSpawn(request: SpawnRequest, creepName: string): void`

Handles post-spawn initialization for specific roles.

**Role-Specific Actions:**

**Harvester:**
```typescript
const lastAssigned = room.memory.data.lastHarvesterAssigned || 0;
room.memory.data.lastHarvesterAssigned = (lastAssigned + 1) % 2;
```

**Remote Harvester:**
```typescript
room.memory.outposts.numHarvesters++;
```

**Hauler:**
```typescript
const creep = Game.creeps[creepName];
if (room.memory.data.logisticalPairs) {
    creep.assignLogisticalPair();
} else {
    room.registerLogisticalPairs();
    creep.assignLogisticalPair();
}
```

#### `retryDeferredRequests(): void`

Retries previously deferred requests that may now be feasible.

**Logic:**
- Only retry requests <100 ticks old
- Recheck for conflicts
- Re-defer if still conflicting
- Add to queue if clear

### Energy Forecasting

#### `calculateEnergyForecast(): EnergyForecast`

Calculates energy income and projections.

**Calculation:**
```typescript
// Get total work parts from all harvesters
let totalWorkParts = 0;
for (const harvester of harvesters) {
    totalWorkParts += harvester.body.filter(p => p.type === WORK).length;
}

// Each WORK harvests 2 energy/tick, sources limited to 10/tick
const incomePerTick = Math.min(totalWorkParts * 2, sources.length * 10);

// Projection function
projectedEnergy: (ticks: number) => {
    const projected = currentEnergy + (incomePerTick * ticks);
    return Math.min(projected, capacityAvailable);
}
```

**Returns:**
```typescript
{
    currentEnergy: 300,
    capacityAvailable: 550,
    incomePerTick: 10,
    projectedEnergy: (ticks) => Math.min(300 + 10*ticks, 550)
}
```

### Utility Methods

#### `calculateBodyCost(body: BodyPartConstant[]): number`

Calculates total energy cost of a body configuration.

```typescript
return body.reduce((cost, part) => cost + BODYPART_COST[part], 0);
```

#### `getRoleShorthand(role: string): string`

Returns abbreviated role names for creep naming.

**Mappings:**
```typescript
{
    'harvester': 'H',
    'filler': 'F',
    'hauler': 'Hauler',
    'upgrader': 'U',
    'builder': 'B',
    'repairer': 'R',
    'reserver': 'Rsv',
    'remoteharvester': 'RH',
    'remotebodyguard': 'RG',
    'remotehauler': 'RHaul',
    'defender': 'Def',
    'scout': 'Scout'
}
```

### Persistence

#### `saveToMemory(): void`

Saves current queue state to Memory.

```typescript
this.room.memory.spawnManager.queue = this.spawnQueue;
this.room.memory.spawnManager.scheduled = this.scheduledSpawns;
this.room.memory.spawnManager.lastProcessed = Game.time;
```

#### `loadFromMemory(): void`

Loads queue state from Memory on initialization.

```typescript
if (this.room.memory.spawnManager.queue)
    this.spawnQueue = this.room.memory.spawnManager.queue;
if (this.room.memory.spawnManager.scheduled)
    this.scheduledSpawns = this.room.memory.spawnManager.scheduled;
```

## Priority System

### Role Priorities

```typescript
private static ROLE_PRIORITIES: { [role: string]: number } = {
    'harvester': 100,      // Critical - energy generation
    'filler': 95,          // High - spawn energy supply
    'hauler': 90,          // High - logistics
    'defender': 85,        // High - defense
    'upgrader': 70,        // Medium - progression
    'builder': 65,         // Medium - construction
    'repairer': 60,        // Medium - maintenance
    'reserver': 55,        // Medium - remote prep
    'remoteharvester': 50, // Low - expansion
    'remotebodyguard': 45, // Low - remote defense
    'remotehauler': 40,    // Low - remote logistics
    'scout': 30            // Lowest - exploration
};
```

### Priority Modifiers

Priorities can be adjusted when submitting requests:

```typescript
spawnManager.submitRequest({
    role: 'harvester',
    priority: 150,  // Override default (100) for emergency
    // ...
});
```

## Usage Examples

### Basic Integration

```typescript
// In RoomManager constructor
this.spawnManager = new SpawnManager(room);

// In RoomManager.run()
this.spawnManager.run();
```

### Submitting Spawn Requests

```typescript
// From RoomManager.assessCreepNeeds()
if (needMoreHarvesters()) {
    const body = determineBodyParts('harvester', capacity, room);
    
    this.spawnManager.submitRequest({
        role: 'harvester',
        priority: 100,
        body: body,
        memory: {
            role: 'harvester',
            RFQ: 'harvester',
            home: roomName,
            room: roomName,
            working: false,
            disable: false,
            rally: 'none',
            source: sourceID,
            bucket: containerID
        },
        roomName: roomName,
        urgent: harvesters.length === 0  // Emergency
    });
}
```

### Monitoring Queue Status

```typescript
// Console command
const manager = global.roomManagers['E25N25'].getSpawnManager();
const status = manager.getStatus();

console.log(`=== Spawn Status ===`);
console.log(`Queue: ${status.queueLength}`);
console.log(`Scheduled: ${status.scheduledSpawns}`);
console.log(`Income: ${status.energyIncome}/tick`);

if (status.nextSpawn) {
    console.log(`Next: ${status.nextSpawn.role} (${status.nextSpawn.energyCost} energy)`);
}
```

### Viewing Queue Details

```typescript
const queue = spawnManager.getQueue();

console.log('=== Spawn Queue ===');
queue.forEach((req, i) => {
    const age = Game.time - req.requestedAt;
    console.log(`${i+1}. ${req.role} - P${req.priority} - ${req.energyCost}E - ${age} ticks old`);
});
```

### Emergency Queue Clear

```typescript
// If spawn queue becomes corrupted or stuck
const manager = global.roomManagers['E25N25'].getSpawnManager();
manager.clearQueue();
console.log('Spawn queue cleared - will rebuild next tick');
```

## Advanced Features

### Conflict Resolution Example

```typescript
// Scenario: Upgrader request conflicts with scheduled harvester replacement

// Scheduled: Harvester (Priority 100) at tick 15,000
// Request: Upgrader (Priority 70) at tick 14,950

// Check reveals:
// - Time conflict: Upgrader would still be spawning when harvester needs to start
// - Energy conflict: Not enough energy for both
// - Resolution: Upgrader deferred, harvester takes precedence
```

### Predictive Spawning Timeline

```typescript
// Creep lifecycle:
// Born: tick 10,000
// TTL: 1,500
// Death: tick 11,500

// Spawn calculation:
// Body: [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE]
// Spawn time: 8 parts * 3 = 24 ticks
// Buffer: 100 ticks
// Schedule spawn: 11,500 - 24 - 100 = 11,376

// Result: Replacement ready by tick 11,400 (100 tick safety margin)
```

### Energy Forecasting Example

```typescript
// Current state:
// - Energy: 300/550
// - Harvesters: 2 with 5 WORK each = 10 WORK total
// - Income: 10 WORK * 2 = 20 energy/tick (limited by 2 sources * 10 = 20)

// Projections:
// +10 ticks: 300 + (20 * 10) = 500
// +50 ticks: 300 + (20 * 50) = 1300 → capped at 550
```

## Performance Considerations

1. **Queue Sorting**: Only sorts when new requests added
2. **Memory Persistence**: Queue saved to Memory every tick
3. **Conflict Checking**: O(n) where n = scheduled spawns
4. **Energy Forecasting**: Cached, recalculated once per tick
5. **Predictive Scheduling**: Only checks creeps with predictive roles

## Debugging

### Console Commands

```typescript
// View spawn manager state
global.roomManagers['E25N25'].getSpawnManager().getStatus()

// View full queue
global.roomManagers['E25N25'].getSpawnManager().getQueue()

// View scheduled spawns
global.roomManagers['E25N25'].getSpawnManager().getScheduledSpawns()

// Clear queue (emergency)
global.roomManagers['E25N25'].getSpawnManager().clearQueue()
```

### Common Issues

**Issue: Requests always rejected**
- Check body cost vs room capacity
- Verify role priority isn't conflicting with scheduled spawns
- Check energy forecast - may not have enough income

**Issue: Spawns not happening**
- Check if spawn is busy
- Verify energy available
- Check queue with `getQueue()` to see if requests present

**Issue: Duplicate creeps spawning**
- Predictive spawning may be scheduling too early
- Check `SPAWN_BUFFER_TIME` constant (default 100)