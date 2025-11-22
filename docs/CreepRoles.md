# Creep Roles Reference

Comprehensive documentation of all creep roles, their behaviors, body configurations, and usage patterns.

## Table of Contents
- [Harvester](#harvester)
- [Filler](#filler)
- [Hauler](#hauler)
- [Upgrader](#upgrader)
- [Builder](#builder)
- [Repairer](#repairer)
- [Reserver](#reserver)
- [Scout](#scout)

---

## Harvester

Navigates to sources, harvests energy, and deposits it in adjacent containers.

### Role Variants
- **Local Harvester**: `Harvester.run(creep)`
- **Remote Harvester**: `Harvester.runremote(creep)`

### Body Configuration

**Standard (650+ energy):**
```typescript
[WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE]
// Cost: 650, harvests 10 energy/tick
```

**Low Energy (<650):**
```typescript
// Allocates 2/3 budget to WORK, 1/3 to MOVE/CARRY
// Example at 400 energy:
[WORK, WORK, WORK, CARRY, MOVE]
// Cost: 400
```

### Key Features
- **Source Assignment**: Automatically assigns to sources based on work parts needed
- **Container Management**: Builds and repairs adjacent containers
- **Drop Harvesting**: Can operate without CARRY parts if container is underneath
- **Bootstrap Mode**: Delivers energy directly to spawns when no containers exist

### Memory Structure
```typescript
{
    role: 'harvester',
    home: 'E25N25',
    source: Id<Source>,           // Assigned source
    bucket: Id<StructureContainer>, // Container to deposit in
    returnEnergy: boolean,         // Deliver to spawn directly
    haveCalledDeathAction: boolean // Remote harvester cleanup
}
```

### Behavior Logic

**Local Harvester:**
```typescript
1. If on room edge, move inward
2. If TTL <= 2, unload energy and display skull
3. Determine if carrying capacity:
   a. No CARRY parts:
      - Move to source
      - Move to container if exists
      - Harvest when in position
   b. Has CARRY parts:
      - If full or near full (< WORK*2 free):
        - Bootstrap mode: Deliver to spawn
        - Normal mode: Unload to container
        - Build container if none exists
      - Otherwise: Harvest
```

**Remote Harvester:**
```typescript
- Same as local, but uses advMoveTo for cross-room travel
- Decrements outpost harvester count on death
- Uses remote pathing configuration
```

### Usage Example
```typescript
// In main loop
for (const name in Game.creeps) {
    const creep = Game.creeps[name];
    if (creep.memory.role === 'harvester') {
        CreepAI.Harvester.run(creep);
    } else if (creep.memory.role === 'remoteharvester') {
        CreepAI.Harvester.runremote(creep);
    }
}
```

### Performance Notes
- Requires 5 WORK parts per source for full utilization (10 energy/tick)
- Can operate with fewer parts if multiple harvesters on same source
- Container underneath position allows 0 CARRY parts (more WORK/MOVE)

---

## Filler

Transports energy from storage/containers to spawns and extensions.

### Body Configuration

**Standard (300 energy max):**
```typescript
// Pattern: CARRY, CARRY, MOVE (repeated)
[CARRY, CARRY, MOVE, CARRY, CARRY, MOVE]
// Cost: 300, capacity: 200
```

**Algorithm:**
```typescript
let maxCost = Math.min(maxEnergy, 300);
while (maxCost >= 50) {
    body.push(CARRY);
    maxCost -= 50;
    if (maxCost < 50) break;
    body.push(MOVE);
    maxCost -= 50;
    if (maxCost < 50) break;
    body.push(CARRY);
    maxCost -= 50;
}
```

### Key Features
- **Smart Source Selection**: Prioritizes storage, falls back to fullest container
- **Efficient Pathing**: Uses dedicated filler pathing configuration
- **Spawn Priority**: Always fills spawns/extensions first

### Memory Structure
```typescript
{
    role: 'filler',
    home: 'E25N25',
    pickup: Id<StructureStorage | StructureContainer>,
    disable: boolean,
    rally: string | string[]
}
```

### Behavior Logic
```typescript
1. If empty:
   - Try storage (if has >= creep capacity)
   - Otherwise find fullest container
   - Withdraw energy
   
2. If carrying energy:
   - Find spawns/extensions with free capacity
   - Transfer to nearest
   - Repeat until empty
```

### Usage Example
```typescript
// Spawn request
spawnManager.submitRequest({
    role: 'filler',
    priority: 95,
    body: [CARRY, CARRY, MOVE, CARRY, CARRY, MOVE],
    memory: {
        role: 'filler',
        home: roomName,
        working: false
    },
    roomName: roomName,
    urgent: false
});
```

### Performance Notes
- Limited to 300 energy cost for efficiency (4 CARRY, 2 MOVE)
- Higher carry-to-move ratio acceptable since paths are short
- Should spawn 2-3 for most rooms to handle energy spikes

---

## Hauler

Transports resources between logistical pairs (containers, storage, links).

### Body Configuration

**Dynamic (based on path length):**
```typescript
// Calculate carry/move based on route distance
const pathLen = logisticalPair.distance;
const carryParts = Math.ceil(pathLen / 5) * 2;
const moveParts = Math.ceil(carryParts / 2);

// Remote haulers get 1 WORK part for repairs
if (locality === 'remote') {
    body.push(WORK, MOVE);
}

// Example: 50-tile route
[CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, 
 CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
 CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
 CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, 
 MOVE, MOVE, MOVE, MOVE, MOVE, MOVE]
```

### Key Features
- **Logistical Pairs**: Assigned specific pickup→dropoff routes
- **Path Optimization**: Body sized to match route length
- **Remote Support**: Can repair containers when remote hauling
- **Cross-Room**: Uses advMoveTo for remote routes

### Memory Structure
```typescript
{
    role: 'hauler',
    home: 'E25N25',
    pickup: Id<Structure>,
    pickupPos: RoomPosition,
    dropoff: Id<Structure>,
    dropoffPos: RoomPosition,
    cargo: ResourceConstant,
    pathLength: number,
    locality: 'local' | 'remote',
    limiter: boolean  // For storage→upgrader pairs
}
```

### Behavior Logic
```typescript
1. If no pair assigned, call assignLogisticalPair()
2. If empty (or no cargo):
   - Navigate to pickup position
   - Withdraw resource when in range
3. If carrying cargo:
   - Navigate to dropoff position
   - Transfer resource when in range
```

### Usage Example
```typescript
// Automatically assigned by SpawnManager post-spawn
handlePostSpawn(request, creepName) {
    if (request.role === 'hauler') {
        const creep = Game.creeps[creepName];
        if (this.room.memory.data?.logisticalPairs) {
            creep.assignLogisticalPair();
        } else {
            this.room.registerLogisticalPairs();
            creep.assignLogisticalPair();
        }
    }
}
```

### Performance Notes
- Quota automatically set to match logistical pair count
- Body size scales with distance (efficient for all routes)
- Remote haulers slightly less efficient due to WORK part

---

## Upgrader

Upgrades the room controller using energy from containers or storage.

### Body Configuration

**Standard (50% WORK, 25% CARRY, 25% MOVE):**
```typescript
// Capped at 1400 energy
const maxEnergy = Math.min(energyAvailable, 1400);

// Allocate budgets
const workBudget = maxEnergy / 2;   // 50%
const carryBudget = maxEnergy / 4;  // 25%
const moveBudget = maxEnergy / 4;   // 25%

// Example at 800 energy:
[WORK, WORK, WORK, WORK,           // 400 (50%)
 CARRY, CARRY,                      // 100 (12.5%)
 MOVE, MOVE, MOVE, MOVE]            // 200 (25%)
```

### Key Features
- **Container Proximity**: Works from controller container
- **Auto-Energy Seeking**: Finds energy when container empty
- **Fallback Harvesting**: Can harvest directly at low RCL
- **Progress Tracking**: Contributes to room control point stats

### Memory Structure
```typescript
{
    role: 'upgrader',
    home: 'E25N25',
    controller: Id<StructureController>,
    bucket: Id<StructureContainer>,  // Controller container
    working: boolean
}
```

### Behavior Logic
```typescript
1. If empty:
   - working = false
   - Try containers with >= capacity
   - Withdraw from nearest
   
2. If full capacity:
   - working = true
   
3. If working:
   - Upgrade controller
   - Move to controller if not in range
   
4. If not working:
   - Try bucket (controller container)
   - Fallback: Pick up dropped energy
   - Fallback: Harvest from source (RCL ≤ 2 only)
```

### Usage Example
```typescript
// Builder falls back to upgrading when no construction
if (constructionSites.length === 0) {
    upgraderBehavior(creep);  // Uses upgrader logic
}
```

### Performance Notes
- Benefits from controller container (no travel time)
- Should have 2-3 upgraders minimum for continuous upgrading
- Can boost with controller container link for faster progression

---

## Builder

Constructs buildings and falls back to upgrading when no construction sites exist.

### Body Configuration

**Same as Upgrader:**
```typescript
// 50% WORK, 25% CARRY, 25% MOVE (max 1400 energy)
[WORK, WORK, WORK, WORK,
 CARRY, CARRY,
 MOVE, MOVE, MOVE, MOVE]
```

### Key Features
- **Construction Priority**: Builds sites before upgrading
- **Storage Integration**: Withdraws from storage when available
- **Auto-Upgrade Fallback**: Becomes upgrader when no sites
- **Progress Display**: Shows build progress visually

### Memory Structure
```typescript
{
    role: 'builder',
    home: 'E25N25',
    working: boolean,
    controller: Id<StructureController>,
    bucket: Id<StructureContainer>
}
```

### Behavior Logic
```typescript
1. If empty (< 1 energy):
   - working = false
   
2. If has >= 150 energy:
   - working = true
   
3. If not working:
   - Try storage (if has > capacity + 1000)
   - Otherwise try containers
   - Withdraw energy
   
4. If working:
   - Find construction sites
   - Build nearest site
   - If no sites: upgraderBehavior()
```

### Usage Example
```typescript
// Spawn when construction sites exist
if (constructionSites.length > 0 && builders.length < builderTarget) {
    spawnManager.submitRequest({
        role: 'builder',
        priority: 65,
        body: determineBodyParts('builder', capacity),
        // ...
    });
}
```

### Performance Notes
- Only spawn when construction sites exist
- Quota typically 1-2 builders
- Automatically becomes upgrader when idle (no waste)

---

## Repairer

Maintains structures based on configurable repair settings.

### Body Configuration

**Same as Upgrader/Builder:**
```typescript
// 50% WORK, 25% CARRY, 25% MOVE
[WORK, WORK, WORK, WORK,
 CARRY, CARRY,
 MOVE, MOVE, MOVE, MOVE]
```

### Key Features
- **Configurable Priorities**: Repair walls, ramparts, roads, others
- **Tower Filling**: Prioritizes filling empty towers
- **Damage Thresholds**: Only repairs below configured percentages
- **Progress Visualization**: Shows repair progress

### Memory Structure
```typescript
{
    role: 'repairer',
    home: 'E25N25',
    working: boolean
}
```

### Repair Settings
```typescript
room.memory.settings.repairSettings = {
    walls: boolean,        // Repair walls
    ramparts: boolean,     // Repair ramparts
    roads: boolean,        // Repair roads
    others: boolean,       // Repair other structures
    wallLimit: number,     // % threshold for walls
    rampartLimit: number,  // % threshold for ramparts
    towerSettings: {
        // Tower-specific settings
    }
}
```

### Behavior Logic
```typescript
1. If empty:
   - working = false
   - Try storage
   - Otherwise try containers
   
2. If has energy:
   - working = true
   
3. If working:
   a. Check for empty towers:
      - Fill towers (sorted by emptiest first)
   
   b. Otherwise repair based on settings:
      - Walls (if enabled, below limit)
      - Ramparts (if enabled, below limit)
      - Roads (if enabled, damaged)
      - Others (if enabled, damaged)
      - Navigate and repair nearest
```

### Usage Example
```typescript
// Configure repair settings
room.memory.settings.repairSettings = {
    walls: true,
    ramparts: true,
    roads: true,
    others: true,
    wallLimit: 50000,
    rampartLimit: 50000
};

// Repairer will maintain structures to these limits
```

### Performance Notes
- Quota typically 0-1 (spawn only when needed)
- Should prioritize tower filling over repairs
- Walls/ramparts should have reasonable limits (not max hits)

---

## Reserver

Reserves remote room controllers for outpost operations.

### Body Configuration

**Standard (1300+ energy):**
```typescript
[CLAIM, CLAIM, MOVE, MOVE]
// Cost: 1300, reserves for 2 ticks
```

**Minimum (650 energy):**
```typescript
[CLAIM, MOVE]
// Cost: 650, reserves for 1 tick
```

### Key Features
- **Outpost Assignment**: Round-robin assignment to outposts
- **Cross-Room Navigation**: Uses advMoveTo with PathFinder
- **Controller Targeting**: Navigates to controller or flag

### Memory Structure
```typescript
{
    role: 'reserver',
    home: 'E25N25',
    targetOutpost: string,           // Outpost room name
    controller: Id<StructureController>,
    disable: boolean,
    rally: string | string[]
}
```

### Behavior Logic
```typescript
1. If no targetOutpost:
   - Assign from outposts.array[reserverLastAssigned]
   - Increment and wrap reserverLastAssigned
   
2. If no controller ID:
   - Get from outpost data
   
3. If in target room:
   - Move to controller
   - Reserve controller
   - Display 📌 on success
   
4. If not in target room:
   - Navigate to outpost flag
```

### Usage Example
```typescript
// Initialize outposts
room.initOutpost('W5N5');
room.memory.outposts.array.push('W5N5');
room.memory.outposts.reserverLastAssigned = 0;

// Spawn reserver (RCL 3+)
if (room.controller.level >= 3 && reservers.length < 1) {
    spawnManager.submitRequest({
        role: 'reserver',
        priority: 55,
        body: [CLAIM, CLAIM, MOVE, MOVE],
        // ...
    });
}
```

### Performance Notes
- Requires RCL 3+ (800 energy minimum)
- Should have 1 reserver per outpost
- Each reserver maintains 1 room reservation
- Reservation lasts 5000 ticks, plan spawning accordingly

---

## Scout

Explores rooms and maintains vision.

### Body Configuration

**Standard:**
```typescript
[MOVE]
// Cost: 50
```

**Swamp Scout:**
```typescript
[MOVE, MOVE, MOVE, MOVE, MOVE]
// Cost: 250, faster in swamps
```

### Key Features
- **Minimal Cost**: Just 50 energy for standard
- **Rally Point Navigation**: Follows flag waypoints
- **Vision Maintenance**: Keeps rooms visible

### Memory Structure
```typescript
{
    role: 'scout',
    home: 'E25N25',
    rally: string | string[],
    disable: boolean
}
```

### Behavior Logic
```typescript
1. If on room edge, move inward
2. If disabled, display 💤
3. If rally point set:
   - Navigate to rally point
4. Otherwise:
   - Display 🥱 (every 5 ticks)
   - Display 💤 (other ticks)
```

### Usage Example
```typescript
// Spawn via spawn prototype method
Game.spawns['Spawn1'].spawnScout(['Flag1', 'Flag2', 'Flag3'], false);

// Or with swamp scout
Game.spawns['Spawn1'].spawnScout(['SwampFlag1'], true);
```

### Performance Notes
- Very cheap (50 energy)
- Useful for maintaining vision on remote rooms
- Can follow multi-flag waypoint routes
- Swamp variant trades cost for speed in swamps

---

## Role Comparison

### Energy Cost
```
Scout:       50-250
Harvester:   400-650
Filler:      200-300
Hauler:      Variable (path-based)
Upgrader:    400-1400
Builder:     400-1400
Repairer:    400-1400
Reserver:    650-1300
```

### Priority Order
```
1. Harvester     (100) - Energy generation
2. Filler        (95)  - Spawn energy
3. Hauler        (90)  - Logistics
4. Upgrader      (70)  - Progression
5. Builder       (65)  - Construction
6. Repairer      (60)  - Maintenance
7. Reserver      (55)  - Remote prep
8. Scout         (30)  - Exploration
```

### Typical Quotas (RCL 4+)
```
Harvesters: 2 (1 per source)
Fillers:    2-3
Haulers:    = logistical pairs (2-4)
Upgraders:  2-4
Builders:   0-2 (when sites exist)
Repairers:  0-1 (optional)
Reservers:  = outpost count (0-2)
Scouts:     0-1 (optional)
```

---

## Common Patterns

### Working State Pattern
```typescript
// Used by: Upgrader, Builder, Repairer
if (creep.store.getUsedCapacity() === 0)
    creep.memory.working = false;
if (creep.store.getFreeCapacity() === 0)
    creep.memory.working = true;

if (!creep.memory.working) {
    // Get energy
} else {
    // Do work
}
```

### Source Assignment Pattern
```typescript
// Used by: Harvester
if (!creep.memory.source) {
    creep.assignHarvestSource('local', true, true);
}
```

### Logistics Pattern
```typescript
// Used by: Hauler, Filler
if (!creep.memory.pickup) {
    creep.assignLogisticalPair();
}

if (creep.store[resource] === 0) {
    // Go to pickup
} else {
    // Go to dropoff
}
```

### Edge Movement Pattern
```typescript
// Used by: Harvester, Hauler
if (pos.x == 49) creep.move(LEFT);
else if (pos.x == 0) creep.move(RIGHT);
else if (pos.y == 49) creep.move(TOP);
else if (pos.y == 0) creep.move(BOTTOM);
```

---

## Best Practices

### 1. Assign Memory During Spawn
```typescript
// Good - memory set at spawn
memory: {
    role: 'harvester',
    source: sourceID,
    bucket: containerID
}

// Less efficient - assigned later
memory: {
    role: 'harvester'
}
// source/bucket assigned on first tick
```

### 2. Use Role-Specific Pathing
```typescript
// Good - optimized path settings
creep.moveTo(target, pathing.harvesterPathing);

// Less optimal - default settings
creep.moveTo(target);
```

### 3. Check Working State Before Actions
```typescript
// Good
if (creep.memory.working) {
    creep.upgradeController(controller);
}

// Bad - wastes CPU on failed actions
creep.upgradeController(controller);
```

### 4. Handle Death Gracefully
```typescript
if (creep.ticksToLive <= 2) {
    creep.unloadEnergy();
    // Cleanup memory if needed
}
```