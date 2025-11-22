# Creep Prototype Extensions

Custom methods added to the `Creep` prototype to provide advanced functionality for movement, resource management, and task assignment.

## Table of Contents
- [Movement](#movement)
- [Resource Management](#resource-management)
- [Harvesting](#harvesting)
- [Source Assignment](#source-assignment)
- [Logistics](#logistics)
- [Caching](#caching)
- [Directives](#directives)

---

## Movement

### `advMoveTo(target, pathFinder?, opts?): ScreepsReturnCode`

Advanced movement function supporting both local and cross-room navigation with optional PathFinder usage.

**Signature:**
```typescript
advMoveTo(
    target: RoomObject | { pos: RoomPosition } | RoomPosition,
    pathFinder?: boolean,
    opts?: MoveToOpts
): ScreepsReturnCode
```

**Parameters:**
- `target` - Destination (RoomObject, object with pos, or RoomPosition)
- `pathFinder` - Use PathFinder for cross-room (default: false)
- `opts` - MoveToOpts configuration

**Features:**
- **Local navigation**: Standard `moveTo()` for same-room movement
- **Cross-room basic**: Finds exit direction, moves to nearest exit
- **Cross-room PathFinder**: Calculates multi-room route with cost modifiers
- **Route caching**: Caches routes in heap, refreshes every 200 ticks

**Returns:** Standard Screeps return code

**Example:**
```typescript
// Local movement
creep.advMoveTo(source);

// Cross-room with PathFinder
creep.advMoveTo(Game.flags['RemoteRoom'], true, {
    plainCost: 2,
    swampCost: 10
});

// Cross-room basic (no PathFinder)
creep.advMoveTo(Game.flags['RemoteRoom'], false);
```

**Implementation Details:**
```typescript
// Local navigation
if (this.room.name === targetPos.roomName) {
    return this.moveTo(targetPos, opts);
}

// Cross-room without PathFinder
const exitDir = Game.map.findExit(this.room, targetPos.roomName);
const exit = this.pos.findClosestByRange(exitDir as FindConstant);
return this.moveTo(exit, opts);

// Cross-room with PathFinder
const route = Game.map.findRoute(this.room.name, targetPos.roomName, {
    routeCallback(roomName) {
        const room = Game.rooms[roomName];
        if (room?.controller?.owner && !room.controller.my) {
            return 5; // Higher cost for hostile rooms
        }
        return 1;
    }
});
```

---

## Resource Management

### `advGet(target, pathing?, resource?, canTravel?): ScreepsReturnCode`

Smart resource acquisition from various sources (structures, resources, tombstones, ruins).

**Signature:**
```typescript
advGet(
    target: Source | Mineral | Deposit | AnyStoreStructure | Resource | Tombstone | Ruin | Id<any>,
    pathing?: MoveToOpts,
    resource?: ResourceConstant,
    canTravel?: boolean
): ScreepsReturnCode
```

**Parameters:**
- `target` - Object or ID to get resource from
- `pathing` - Movement options
- `resource` - Specific resource type (auto-detected if omitted)
- `canTravel` - Whether to move to target (default: true)

**Behavior:**
- **Resource**: `pickup()`
- **Source/Mineral/Deposit**: `harvest()`
- **Structure/Tombstone/Ruin**: `withdraw()`

**Example:**
```typescript
// Pickup dropped energy
creep.advGet(droppedEnergy);

// Harvest from source
creep.advGet(source);

// Withdraw from container
creep.advGet(container, pathing.haulerPathing, RESOURCE_ENERGY);

// Withdraw without moving
creep.advGet(storage, undefined, undefined, false);
```

### `advGive(target, pathing?, resource?, canTravel?): ScreepsReturnCode`

Smart resource transfer to creeps or structures.

**Signature:**
```typescript
advGive(
    target: Creep | AnyStoreStructure | Id<AnyStoreStructure>,
    pathing?: MoveToOpts,
    resource?: ResourceConstant,
    canTravel?: boolean
): ScreepsReturnCode
```

**Parameters:**
- `target` - Creep or structure to transfer to
- `pathing` - Movement options
- `resource` - Resource type (auto-detected if omitted)
- `canTravel` - Whether to move to target (default: true)

**Example:**
```typescript
// Transfer energy to spawn
creep.advGive(spawn, pathing.fillerPathing);

// Transfer specific resource
creep.advGive(terminal, undefined, RESOURCE_UTRIUM);

// Transfer without moving
creep.advGive(tower, undefined, RESOURCE_ENERGY, false);
```

---

## Harvesting

### `advHarvest(): void`

Automated harvesting with source assignment and statistics tracking.

**Features:**
- Auto-assigns source if not set
- Moves to source if not in range
- Tracks energy harvested in room stats
- Displays harvest amount as emoji

**Example:**
```typescript
// In creep AI
if (creep.store.getFreeCapacity() > 0) {
    creep.advHarvest();
}
```

**Implementation:**
```typescript
advHarvest() {
    let locality: 'local' | 'remote' = 
        this.memory.role === 'remoteharvester' ? 'remote' : 'local';
    
    if (!this.memory.source) {
        this.memory.source = this.assignHarvestSource(locality, true, true);
    }
    
    const source = Game.getObjectById(this.memory.source);
    const result = this.harvest(source);
    
    if (result === ERR_NOT_IN_RANGE) {
        this.moveTo(source, pathing.harvesterPathing);
    } else if (result === OK) {
        this.hasWorked = true;
        const energyHarvested = Math.min(
            this.getActiveBodyparts(WORK) * HARVEST_POWER,
            source.energy
        );
        this.room.memory.stats.energyHarvested += energyHarvested;
        this.say('⛏️' + energyHarvested);
    }
}
```

### `harvestEnergy(): void`

Legacy harvesting method (still used by older creep AI).

**Features:**
- Auto-assigns source if not set
- Moves to source (local or cross-room)
- Handles case when source is empty

**Example:**
```typescript
// In Harvester AI
if (creep.store.getFreeCapacity() > 0) {
    creep.harvestEnergy();
}
```

### `unloadEnergy(bucketID?): void`

Unloads energy to containers, links, or storage.

**Signature:**
```typescript
unloadEnergy(bucketID?: Id<AnyStoreStructure>): void
```

**Parameters:**
- `bucketID` - Optional container/structure ID to unload to

**Behavior:**
1. If `bucketID` provided: Transfer or repair that structure
2. If `creep.memory.bucket` set: Use that container
3. Otherwise: Find nearest container near source
4. Fallback: Drop energy on ground

**Example:**
```typescript
// Unload to specific container
creep.unloadEnergy(containerID);

// Unload to assigned container (in memory)
creep.unloadEnergy();
```

**Implementation:**
```typescript
unloadEnergy(bucketID?) {
    if (bucketID) {
        const bucket = Game.getObjectById(bucketID);
        if (bucket.hits == bucket.hitsMax) {
            this.transfer(bucket, RESOURCE_ENERGY);
        } else {
            this.repair(bucket);
        }
        return;
    }
    
    // ... find bucket logic
    
    if (!nearbyObj) {
        this.drop(RESOURCE_ENERGY);
    }
}
```

---

## Source Assignment

### `assignHarvestSource(locality, simpleAssignment, returnID): Source | Id<Source>`

Assigns a harvest source to the creep.

**Signature:**
```typescript
assignHarvestSource(
    locality: 'local' | 'remote',
    simpleAssignment: boolean,
    returnID: boolean
): Source | Id<Source>
```

**Parameters:**
- `locality` - 'local' or 'remote' source
- `simpleAssignment` - Use simple alternating assignment (true) or work-parts calculation (false)
- `returnID` - Return source ID (true) or Source object (false)

**Simple Assignment:**
Alternates between sources based on harvester count:
```typescript
const numHarvesters = room.find(FIND_MY_CREEPS, {
    filter: i => i.memory.role === 'harvester'
}).length;

if (numHarvesters % 2) {
    source = room.find(FIND_SOURCES)[0];
} else {
    source = room.find(FIND_SOURCES)[1];
}
```

**Work Parts Assignment:**
Assigns based on available work parts needed per source (5 WORK per source):
```typescript
let workPartsNeededOnOne = 5;
const sourceOneCreeps = room.find(FIND_CREEPS).filter(
    c => c.my && c.memory.role === 'harvester' && c.memory.source === sourceOne.id
);

for (const creep of sourceOneCreeps) {
    workPartsNeededOnOne -= creep.getActiveBodyparts(WORK);
}

if (workPartsNeededOnOne >= 0) {
    return sourceOne;
}
```

**Example:**
```typescript
// Simple assignment
const sourceID = creep.assignHarvestSource('local', true, true);
creep.memory.source = sourceID;

// Work parts calculation
const source = creep.assignHarvestSource('local', false, false);
```

### `reassignSource(locality, sourceTwo): boolean`

Reassigns a creep to a different source.

**Signature:**
```typescript
reassignSource(
    locality: 'local' | 'remote',
    sourceTwo: boolean
): boolean
```

**Parameters:**
- `locality` - 'local' or 'remote'
- `sourceTwo` - Assign to second source (true) or first source (false)

**Returns:** `true` if successful, `false` if failed

**Example:**
```typescript
// Reassign to second source
creep.reassignSource('local', true);

// Reassign to first source
creep.reassignSource('local', false);
```

---

## Logistics

### `assignLogisticalPair(): boolean`

Assigns a pickup/dropoff pair to a hauler from room's registered pairs.

**Returns:** `true` if successful, `false` if no pairs available

**Assigns to Memory:**
```typescript
{
    pickup: Id<Structure>,
    pickupPos: RoomPosition,
    dropoff: Id<Structure>,
    dropoffPos: RoomPosition,
    cargo: ResourceConstant,
    pathLength: number,
    locality: 'local' | 'remote',
    limiter: boolean  // true for storage→upgrader pairs
}
```

**Example:**
```typescript
// Called automatically by SpawnManager for haulers
const creep = Game.creeps['Col1_Hauler1'];
const success = creep.assignLogisticalPair();

if (success) {
    console.log(`Assigned: ${creep.memory.pickup} → ${creep.memory.dropoff}`);
}
```

**Implementation:**
```typescript
assignLogisticalPair() {
    if (!this.room.memory.data.logisticalPairs) {
        this.room.registerLogisticalPairs();
    }
    
    if (!this.room.memory.data.pairCounter) {
        this.room.memory.data.pairCounter = 0;
    }
    
    const assignedPair = this.room.memory.data.logisticalPairs[
        this.room.memory.data.pairCounter
    ];
    
    this.room.memory.data.pairCounter++;
    if (this.room.memory.data.pairCounter >= 
        this.room.memory.data.logisticalPairs.length) {
        this.room.memory.data.pairCounter = 0;
    }
    
    if (assignedPair) {
        this.memory.pickup = assignedPair.source;
        this.memory.dropoff = assignedPair.destination;
        // ... assign other properties
        return true;
    }
    return false;
}
```

---

## Caching

### `cacheLocalObjects(): void`

Caches room objects to room memory.

**Delegates to:** `room.cacheObjects()`

**Example:**
```typescript
creep.cacheLocalObjects();
// Equivalent to:
creep.room.cacheObjects();
```

### `cacheLocalOutpost(): void`

Caches outpost information to host colony memory.

**Actions:**
1. Caches room objects
2. Creates outpost entry in host colony
3. Stores source and container IDs
4. Creates or finds controller flag

**Example:**
```typescript
// Remote harvester in outpost room
const creep = Game.creeps['Col1_RH1'];
creep.cacheLocalOutpost();
```

---

## Directives

### `executeDirective(): boolean`

Executes a directive stored in creep memory (WIP).

**Planned Directive Types:**
- `build` - Build construction sites
- `upgrade` - Upgrade controller
- `harvest` - Harvest resources
- `haul` - Transport resources
- `defend` - Defensive actions
- `attack` - Offensive actions
- `deposit` - Deposit resources
- `rally` - Navigate to rally point
- `repair` - Repair structures
- `boost` - Get boosted at lab

**Example (planned):**
```typescript
creep.memory.directive = {
    type: 'build',
    target: constructionSiteID,
    priority: 80
};

creep.executeDirective();
```

**Current Status:** Partially implemented, returns `false`

---

## Properties

### `hasWorked: boolean`

Flag indicating if creep has performed work this tick (used for tracking).

**Set by:**
- `advHarvest()` when successfully harvesting

**Example:**
```typescript
creep.advHarvest();
if (creep.hasWorked) {
    console.log(`${creep.name} harvested this tick`);
}
```

---

## Usage in Creep AI

### Harvester Example

```typescript
export const Harvester = {
    run: (creep: Creep) => {
        if (!creep.memory.source) {
            creep.assignHarvestSource('local', true, false);
        }
        
        if (creep.store.getFreeCapacity() === 0) {
            creep.unloadEnergy();
        } else {
            creep.harvestEnergy();
        }
    }
};
```

### Hauler Example

```typescript
export const Hauler = {
    run: (creep: Creep) => {
        if (!creep.memory.pickup) {
            creep.assignLogisticalPair();
        }
        
        const pickupPos = new RoomPosition(
            creep.memory.pickupPos.x,
            creep.memory.pickupPos.y,
            creep.memory.pickupPos.roomName
        );
        
        if (creep.store[RESOURCE_ENERGY] === 0) {
            creep.advMoveTo(pickupPos, false, pathing.haulerPathing);
            
            const pickupTarget = Game.getObjectById(creep.memory.pickup);
            if (pickupTarget && creep.pos.isNearTo(pickupTarget)) {
                creep.withdraw(pickupTarget, RESOURCE_ENERGY);
            }
        } else {
            const dropoffPos = new RoomPosition(
                creep.memory.dropoffPos.x,
                creep.memory.dropoffPos.y,
                creep.memory.dropoffPos.roomName
            );
            creep.advMoveTo(dropoffPos, false, pathing.haulerPathing);
            
            const dropoffTarget = Game.getObjectById(creep.memory.dropoff);
            if (dropoffTarget && creep.pos.isNearTo(dropoffTarget)) {
                creep.transfer(dropoffTarget, RESOURCE_ENERGY);
            }
        }
    }
};
```

### Builder Example

```typescript
export const Builder = {
    run: (creep: Creep) => {
        if (creep.store.getUsedCapacity() === 0) {
            creep.memory.working = false;
        }
        if (creep.store.getUsedCapacity() >= 150) {
            creep.memory.working = true;
        }
        
        if (!creep.memory.working) {
            // Get energy from storage or container
            if (creep.room.storage && 
                creep.room.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 1000) {
                creep.advGet(creep.room.storage);
            }
        } else {
            // Build construction sites
            const sites = creep.room.find(FIND_CONSTRUCTION_SITES);
            if (sites.length) {
                const nearest = creep.pos.findClosestByRange(sites);
                if (nearest) {
                    if (creep.build(nearest) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(nearest, pathing.builderPathing);
                    }
                }
            }
        }
    }
};
```

---

## Performance Considerations

1. **Route Caching**: Cross-room routes cached in global heap for 200 ticks
2. **Source Assignment**: Simple assignment (O(1)) vs work parts calculation (O(n))
3. **Resource Type Detection**: Auto-detection iterates through store keys
4. **Movement**: Local movement uses standard pathfinding, cross-room uses exit finding

---

## Best Practices

### 1. Use advMoveTo for Cross-Room Movement

```typescript
// Good - handles room boundaries
creep.advMoveTo(Game.flags['RemoteRoom'], true);

// Bad - breaks at room boundaries
creep.moveTo(Game.flags['RemoteRoom']);
```

### 2. Let advGet Auto-Detect Resources

```typescript
// Good - automatically finds resource type
creep.advGet(container);

// Acceptable - explicit resource type
creep.advGet(container, pathing, RESOURCE_ENERGY);
```

### 3. Assign Sources Early

```typescript
// Good - assign in creep spawn memory
memory: {
    role: 'harvester',
    source: sourceID,
    bucket: containerID
}

// Acceptable - assign on first tick
if (!creep.memory.source) {
    creep.assignHarvestSource('local', true, true);
}
```

### 4. Use Logistical Pairs for Haulers

```typescript
// Good - structured logistics
creep.assignLogisticalPair();

// Bad - hardcoded targets
creep.memory.pickup = 'specific-container-id';
```

---

## Error Handling

### Invalid Target Handling

```typescript
advGet(target) {
    let finalTarget;
    if (typeof target === 'string') {
        finalTarget = Game.getObjectById(target);
        if (!finalTarget) return ERR_INVALID_TARGET;
    }
    // ...
}
```

### Movement Failure Handling

```typescript
advMoveTo(target, pathFinder, opts) {
    // Local navigation
    if (this.room.name === targetPos.roomName) {
        return this.moveTo(targetPos, opts);
    }
    
    // Cross-room - find exit
    const exitDir = Game.map.findExit(this.room, targetPos.roomName);
    if (typeof exitDir !== 'number') return exitDir; // Error code
    
    const exit = this.pos.findClosestByRange(exitDir);
    if (!exit) return ERR_NO_PATH;
    
    return this.moveTo(exit, opts);
}
```

### Source Assignment Fallback

```typescript
assignHarvestSource(locality, simpleAssignment, returnID) {
    // ... assignment logic
    
    // Fallback to first source if all full
    if (returnID) {
        return sourceOne.id;
    } else {
        return sourceOne;
    }
}
```

---

## Common Patterns

### Energy Collection Pattern

```typescript
// Harvest when empty, work when full
if (creep.store.getUsedCapacity() === 0) {
    creep.memory.working = false;
}
if (creep.store.getFreeCapacity() === 0) {
    creep.memory.working = true;
}

if (!creep.memory.working) {
    creep.harvestEnergy();
} else {
    // Do work (build, upgrade, repair, etc.)
}
```

### Container Management Pattern

```typescript
// Harvest to container, repair if needed
if (!creep.memory.bucket) {
    const containers = source.pos.findInRange(
        FIND_STRUCTURES, 2,
        { filter: { structureType: STRUCTURE_CONTAINER }}
    );
    if (containers.length) {
        creep.memory.bucket = containers[0].id;
    }
}

if (creep.memory.bucket) {
    const bucket = Game.getObjectById(creep.memory.bucket);
    if (bucket.hits < bucket.hitsMax) {
        creep.repair(bucket);
    } else {
        creep.unloadEnergy(creep.memory.bucket);
    }
}
```

### Cross-Room Navigation Pattern

```typescript
// Navigate to remote room with target
if (creep.room.name !== targetRoom) {
    creep.advMoveTo(Game.flags[targetRoom], true, pathing.remotePathing);
} else {
    // Do work in target room
}
```

---

## Integration with Room Prototype

Many creep methods interact with room prototype extensions:

### Source Assignment → Room Source Data

```typescript
// Creep gets source from room data
if (room.memory.data.sourceData) {
    sourceID = room.memory.data.sourceData.source[0];
    containerID = room.memory.data.sourceData.container[0];
}
```

### Logistics → Room Pair Registration

```typescript
// Creep gets pair from room's registered pairs
assignLogisticalPair() {
    if (!this.room.memory.data.logisticalPairs) {
        this.room.registerLogisticalPairs();
    }
    const pair = this.room.memory.data.logisticalPairs[index];
    // ... assign to memory
}
```

### Caching → Room Object Cache

```typescript
// Creep triggers room cache update
cacheLocalObjects() {
    this.room.cacheObjects();
}
```

---

## Migration Guide

### From Standard Methods to Extensions

**Movement:**
```typescript
// Before
if (creep.room.name === target.pos.roomName) {
    creep.moveTo(target);
} else {
    const exit = Game.map.findExit(creep.room, target.pos.roomName);
    creep.moveTo(creep.pos.findClosestByRange(exit));
}

// After
creep.advMoveTo(target, false);
```

**Resource Transfer:**
```typescript
// Before
if (creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
    creep.moveTo(container);
}

// After
creep.advGet(container);
```

**Harvesting:**
```typescript
// Before
const source = Game.getObjectById(creep.memory.source);
if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
    creep.moveTo(source);
}

// After
creep.harvestEnergy();
// or
creep.advHarvest();
```

---

## Future Enhancements

### Planned Features

1. **Directive System**: Full implementation of `executeDirective()`
2. **Smart Pathfinding**: Automatic cost matrix for roads and ramparts
3. **Combat Extensions**: Attack, heal, and defense methods
4. **Resource Optimization**: Multi-resource hauling
5. **Task Queueing**: Priority-based task queue per creep

### Potential Additions

```typescript
// Planned methods
creep.advAttack(target);
creep.advHeal(target);
creep.advRangedAttack(target);
creep.advDefend(pos);
creep.queueTask(task);
creep.executeTaskQueue();
```