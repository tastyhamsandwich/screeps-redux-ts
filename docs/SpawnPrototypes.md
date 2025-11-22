# Spawn Prototype Extensions

Custom methods added to the `StructureSpawn` prototype for body part determination, creep spawning, and utility functions.

## Table of Contents
- [Body Determination](#body-determination)
- [Spawning Methods](#spawning-methods)
- [Utility Methods](#utility-methods)
- [Usage Patterns](#usage-patterns)

---

## Body Determination

### `determineBodyParts(role: string, maxEnergy?: number, extras?: {[key: string]: any}): BodyPartConstant[]`

Determines the optimal body composition for a creep based on its role and available energy.

**Parameters:**
- `role` - Creep role type
- `maxEnergy` - Available energy (defaults to room's energyCapacityAvailable)
- `extras` - Optional additional parameters (currently unused)

**Returns:** Array of BodyPartConstant values

**Supported Roles:**
- `harvester` - Optimized for energy harvesting
- `remoteharvester` - For remote source harvesting
- `upgrader` - For controller upgrade work
- `builder` - For construction work
- `repairer` - For repair work
- `defender` - For combat defense
- `filler` - For energy filling
- `hauler` - For logistics and transport
- `reserver` - For controller reservation
- `scout` - For exploration
- `conveyor` - For energy transport chains

**Example:**
```typescript
// Get optimal body for harvester with 1200 energy
const body = spawn.determineBodyParts('harvester', 1200);
// Returns: [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE]

// Use default energy capacity
const body = spawn.determineBodyParts('upgrader');

// With extras (for future expansion)
const body = spawn.determineBodyParts('builder', 1000, { extraFlag: true });
```

**Special Cases:**

**Harvester Logic:**
- If `dropHarvestingEnabled` flag is true, uses drop harvesting (no CARRY parts)
- Otherwise uses standard carry-based harvesting
- Balances WORK, CARRY, and MOVE parts based on available energy

**Hauler Logic:**
- Calculates based on logistical pair distances
- Adds WORK parts for remote pairs
- Optimizes CARRY/MOVE ratio for path length

---

## Spawning Methods

### `spawnScout(rally?: string | string[], swampScout?: boolean, memory?: {}): ScreepsReturnCode`

Spawns a scout creep for exploration and navigation.

**Parameters:**
- `rally` - Flag name(s) for navigation (default: 'none')
- `swampScout` - Spawn with extra MOVE parts for swamp terrain (default: false)
- `memory` - Optional memory properties to merge with defaults

**Returns:** Screeps return code (OK on success)

**Features:**
- Automatically handles name conflicts by appending counter
- Logs success/failure to console
- Supports navigation through rally flags
- Configurable movement speed for different terrains

**Example:**
```typescript
// Basic scout
spawn.spawnScout('target_room');

// Scout with extra movement for swamps
spawn.spawnScout('target_room', true);

// Scout with multiple rally points
spawn.spawnScout(['flag1', 'flag2', 'flag3'], false);

// Scout with custom memory
spawn.spawnScout('room', false, { RFQ: 'custom_scout' });
```

**Console Output:**
```
[E25N25]: Spawn1> Spawning Scout in room E25N25
```

### `spawnEmergencyHarvester(): ScreepsReturnCode`

Spawns a minimal emergency harvester to handle energy shortages.

**Returns:** Screeps return code (OK on success)

**Features:**
- Minimal body (2 WORK, 1 CARRY, 1 MOVE)
- Automatically increments counter to avoid name conflicts
- Uses emergency harvester naming convention
- Logs operation to console

**Body Composition:**
- `WORK` x2 - Harvesting capability
- `CARRY` x1 - Basic carrying capacity
- `MOVE` x1 - Movement

**Example:**
```typescript
// Spawn emergency harvester when in critical state
if (spawn.room.energyAvailable < 300) {
    spawn.spawnEmergencyHarvester();
}
```

**Console Output:**
```
[E25N25]: Spawn1> Spawning Emergency Harvester 'EmergencyHarvester1'
```

**Use Cases:**
- Recovering from collapse (no energy)
- Emergency bootstrap when spawn is starved
- Quick creep replacement before main system kicks in

### `spawnFiller(maxEnergy: number): ScreepsReturnCode`

Spawns a filler creep to help fill spawns and extensions.

**Parameters:**
- `maxEnergy` - Maximum energy to use (will be limited to 300 max)

**Returns:** Screeps return code (OK on success)

**Features:**
- Limited to max cost of 300 (4 CARRY, 2 MOVE)
- Handles name conflicts by using timestamp fallback
- Automatically tracks spawn stats
- Updates room statistics on success

**Body Composition:**
- `CARRY` parts - Up to 4 (200 cost)
- `MOVE` parts - Up to 2 (100 cost)
- Maximum total cost: 300

**Example:**
```typescript
// Spawn filler when extensions need energy
if (spawn.room.extensions.some(ext => ext.store.getFreeCapacity() > 0)) {
    spawn.spawnFiller(spawn.room.energyAvailable);
}
```

**Console Output:**
```
[E25N25]: Spawn1> Spawning emergency filler, Filler1
[E25N25]: Spawn1> Error spawning emergency filler: ERR_NOT_ENOUGH_ENERGY
```

**Name Handling:**
- First attempt: `Filler{counter}`
- Fallback on conflict: `Filler{Game.time}`

### `retryPending(): ScreepsReturnCode`

Attempts to execute a pending spawn stored in `room.memory.data.pendingSpawn`.

**Returns:** Screeps return code (OK on success, ERR_NOT_FOUND if no pending spawn)

**Features:**
- Checks for pending spawn in room memory
- Validates sufficient energy available
- Clears pending spawn on successful spawn
- Logs success/failure to console

**Requirements:**
- `room.memory.data.pendingSpawn` must contain:
  - `body` - BodyPartConstant array
  - `name` - Creep name string
  - `memory` - CreepMemory object
  - `cost` - Energy cost of the body

**Example:**
```typescript
// Store pending spawn when not enough energy
room.memory.data.pendingSpawn = {
    body: [WORK, WORK, CARRY, MOVE],
    name: 'BuilderPending1',
    memory: { role: 'builder', home: room.name },
    cost: 300
};

// Later, retry when energy available
if (room.energyAvailable >= 300) {
    const result = spawn.retryPending();
    if (result === OK) {
        console.log('Pending spawn succeeded');
    }
}
```

**Console Output:**
```
[E25N25]: Spawn1> Resuming pending spawn for builder (BuilderPending1)
[E25N25]: Spawn1> Failed to retry pending builder: ERR_NOT_ENOUGH_ENERGY
```

**Return Codes:**
- `OK` - Spawn successful, pending cleared
- `ERR_NOT_FOUND` - No pending spawn stored
- `ERR_NOT_ENOUGH_ENERGY` - Not enough energy for pending spawn
- `ERR_NAME_EXISTS` - Pending creep name already taken
- Other spawn error codes

### `cloneCreep(creepName: string): ScreepsReturnCode`

Spawns a new creep with the same body and memory as an existing creep.

**Parameters:**
- `creepName` - Name of the creep to clone

**Returns:** Screeps return code (OK on success)

**Features:**
- Clones exact body composition
- Copies all memory properties except RFQ field
- Appends 'C' to source creep name
- Validates source creep exists and has body parts
- Logs operation to console

**Example:**
```typescript
// Clone an existing harvester
const result = spawn.cloneCreep('Col1_Harvester1');
if (result === OK) {
    console.log('Clone successful - new creep: Col1_Harvester1C');
}

// Useful for scaling up specific roles
if (Game.creeps['Col1_Harvester1'].ticksToLive > 500) {
    spawn.cloneCreep('Col1_Harvester1');
}
```

**Console Output:**
```
[E25N25]: Spawn1> Successfully cloned Col1_Harvester1 as Col1_Harvester1C (harvester)
[E25N25]: Spawn1> Clone failed: Source creep 'NonExistent' not found
[E25N25]: Spawn1> Clone failed: Source creep has no body parts
```

**Return Codes:**
- `OK` - Clone successful
- `ERR_NOT_FOUND` - Source creep doesn't exist
- `ERR_INVALID_ARGS` - Source creep has no body parts
- `ERR_NOT_ENOUGH_ENERGY` - Not enough energy to spawn clone
- `ERR_NAME_EXISTS` - Clone name already taken

**Memory Handling:**
```typescript
// Original memory
{
    role: 'harvester',
    RFQ: 'special_request',  // This is EXCLUDED
    source: sourceID,        // This is COPIED
    bucket: containerID      // This is COPIED
}

// Cloned memory (RFQ removed)
{
    role: 'harvester',
    source: sourceID,
    bucket: containerID
}
```

---

## Usage Patterns

### Role-Based Spawning

```typescript
// Determine body and spawn based on role
function spawnCreepByRole(spawn: StructureSpawn, role: string, memory: CreepMemory) {
    const body = spawn.determineBodyParts(role);
    const cost = calcBodyCost(body);

    if (spawn.room.energyAvailable >= cost) {
        let counter = 1;
        let result = spawn.spawnCreep(body, `${role}${counter}`, { memory });

        while (result === ERR_NAME_EXISTS) {
            counter++;
            result = spawn.spawnCreep(body, `${role}${counter}`, { memory });
        }

        return result;
    }

    return ERR_NOT_ENOUGH_ENERGY;
}

// Usage
spawnCreepByRole(spawn, 'harvester', { role: 'harvester', home: room.name });
```

### Emergency Recovery Pattern

```typescript
// Handle emergency spawning sequence
function emergencySpawn(spawn: StructureSpawn) {
    // 1. Try to spawn emergency harvester first
    const eh = spawn.spawnEmergencyHarvester();
    if (eh === OK) return OK;

    // 2. Try to spawn filler
    const filler = spawn.spawnFiller(spawn.room.energyAvailable);
    if (filler === OK) return OK;

    // 3. Store pending spawn for later
    const body = spawn.determineBodyParts('harvester', spawn.room.energyCapacityAvailable);
    spawn.room.memory.data.pendingSpawn = {
        body,
        name: `Pending_${Game.time}`,
        memory: { role: 'harvester', home: spawn.room.name },
        cost: calcBodyCost(body)
    };

    return ERR_BUSY;
}
```

### Backup Creep System

```typescript
// Clone high-value creeps to maintain capacity
function backupCreep(spawn: StructureSpawn, creepName: string) {
    const creep = Game.creeps[creepName];

    if (!creep) return ERR_NOT_FOUND;

    // Only backup if creep has > 500 ticks left
    if (creep.ticksToLive < 500) {
        return spawn.cloneCreep(creepName);
    }

    return ERR_BUSY;
}

// Usage
_.forEach(importantCreeps, creepName => backupCreep(spawn, creepName));
```

### Scout Deployment Pattern

```typescript
// Deploy scouts to multiple rooms
function deployScouts(spawn: StructureSpawn, targetRooms: string[]) {
    let deployed = 0;

    for (const roomName of targetRooms) {
        const result = spawn.spawnScout(roomName, false);
        if (result === OK) {
            deployed++;
        } else {
            console.log(`Failed to spawn scout to ${roomName}: ${result}`);
            break;  // Stop if we run out of energy
        }
    }

    return deployed;
}
```

---

## Best Practices

### 1. Always Check Return Code

```typescript
// Good
const result = spawn.spawnEmergencyHarvester();
if (result === OK) {
    console.log('Emergency harvester spawned');
} else {
    console.log(`Failed: ${result}`);
}

// Bad - ignoring result
spawn.spawnEmergencyHarvester();
```

### 2. Use determineBodyParts for Flexibility

```typescript
// Good - adapts to available energy
const body = spawn.determineBodyParts('harvester', spawn.room.energyAvailable);

// Bad - hardcoded body
const body = [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE];
```

### 3. Handle Name Conflicts

```typescript
// Good - built into spawnScout/spawnFiller/spawnEmergencyHarvester
spawn.spawnScout('room');

// Acceptable - manual handling
let counter = 1;
let result = spawn.spawnCreep(body, `MyRole${counter}`, { memory });
while (result === ERR_NAME_EXISTS) {
    counter++;
    result = spawn.spawnCreep(body, `MyRole${counter}`, { memory });
}
```

### 4. Manage Pending Spawns

```typescript
// Good - using retryPending
if (!room.memory.data.pendingSpawn) {
    // Store pending if needed
}

// Retry each tick
spawn.retryPending();
```

### 5. Clone for Backup

```typescript
// Good - backup critical creeps
const criticalCreeps = ['Col1_Harvester1', 'Col1_Hauler1', 'Col1_Upgrader1'];
criticalCreeps.forEach(name => {
    if (Game.creeps[name]?.ticksToLive > 500) {
        spawn.cloneCreep(name);
    }
});
```

---

## Performance Tips

1. **Body Determination**: Caching is recommended for frequently-called roles
2. **Emergency Spawning**: Use minimal bodies to conserve energy and spawn quickly
3. **Name Counters**: Track counters in room memory to improve performance
4. **Pending Queue**: Consider centralizing pending spawns in SpawnManager instead of individual spawns

---

## Integration with RoomManager

The RoomManager typically handles spawn requests through SpawnManager, but these prototype methods are useful for:

- Emergency recovery when SpawnManager is unavailable
- Minimal bootstrap spawning
- Ad-hoc creep spawning for testing/debugging
- Backup cloning operations

