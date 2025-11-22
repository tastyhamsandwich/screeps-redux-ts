# DefenseManager

The `DefenseManager` provides automated tower targeting and room defense with intelligent hostile prioritization and structure repair strategies.

## Overview

**Location:** [src/managers/DefenseManager.ts](src/managers/DefenseManager.ts)

**Purpose:**
- Automate tower targeting for hostile creeps
- Prioritize threats (healers, military creeps, invaders)
- Repair damaged structures efficiently
- Heal friendly creeps when no threats present
- Configure defense strategy per room

## Core Function

### `DefenseManager.run(room: Room): void`

Main execution method called by RoomManager each tick.

**Parameters:**
- `room: Room` - The room to manage defense for

**Process:**
1. Find all towers in room
2. For each tower:
   - Check for hostile creeps
   - If hostiles present, attack highest priority target
   - If no hostiles, heal damaged friendly creeps
   - If no healing needed, repair structures

**Example:**
```typescript
// Called by RoomManager
export class RoomManager {
    run() {
        // ... other operations ...
        DefenseManager.run(this.room);
    }
}
```

## Hostile Targeting Priority

DefenseManager uses a multi-tier priority system for hostile targeting:

### Priority 1: Healer Creeps

**Why First:** Healers keep enemy forces alive, making them the highest threat.

**Detection:**
```typescript
const healers = hostiles.filter(creep =>
    creep.getActiveBodyparts(HEAL) > 0
);
```

**Target Selection:** Closest healer to tower.

### Priority 2: Military Creeps

**Types:** Creeps with ATTACK, RANGED_ATTACK, or WORK parts.

**Detection:**
```typescript
const military = hostiles.filter(creep =>
    creep.getActiveBodyparts(ATTACK) > 0 ||
    creep.getActiveBodyparts(RANGED_ATTACK) > 0 ||
    creep.getActiveBodyparts(WORK) > 0
);
```

**Target Selection:** Closest military creep to tower.

**Rationale:** WORK parts can damage structures, making them a threat.

### Priority 3: NPC Invaders

**Detection:**
```typescript
const invaders = hostiles.filter(creep =>
    creep.owner.username === 'Invader'
);
```

**Target Selection:** Closest invader to tower.

**Rationale:** Only target if no player-owned hostiles present.

### Priority 4: Other Hostiles

**Types:** Any other hostile creeps (scouts, harvesters, etc.).

**Target Selection:** Closest hostile to tower.

## Tower Actions

### Attack

**Condition:** Hostile creeps present in room.

**Action:**
```typescript
tower.attack(targetHostile);
```

**Damage Calculation:**
- Maximum damage: 600 (at range 0-5)
- Minimum damage: 150 (at range 40+)
- Falloff: Linear between range 5-40

### Heal

**Condition:** No hostiles present, friendly creeps damaged.

**Action:**
```typescript
const damagedCreeps = room.find(FIND_MY_CREEPS, {
    filter: creep => creep.hits < creep.hitsMax
});

if (damagedCreeps.length > 0) {
    tower.heal(damagedCreeps[0]);
}
```

**Healing Amount:**
- Maximum heal: 400 (at range 0-5)
- Minimum heal: 100 (at range 40+)

### Repair

**Condition:** No hostiles, no damaged creeps, tower energy available.

**Priority Order:**
1. Roads (below 95% hits)
2. Critical structures (towers, spawns, extensions, containers, etc.)
3. Ramparts (below configured limit)
4. Walls (below configured limit)

**Implementation:**
```typescript
// Find structures needing repair
const targets = room.find(FIND_STRUCTURES, {
    filter: structure => {
        if (structure.structureType === STRUCTURE_ROAD) {
            return structure.hits < structure.hitsMax * 0.95;
        }
        if (structure.structureType === STRUCTURE_RAMPART) {
            return structure.hits < room.memory.settings.towerSettings.rampartLimit;
        }
        // ... other types
    }
});

// Repair closest target
if (targets.length > 0) {
    tower.repair(targets[0]);
}
```

## Configuration

### Room Settings

Configure tower behavior via room memory:

```typescript
room.memory.settings.towerSettings = {
    attackHostiles: boolean,      // Enable hostile targeting
    healCreeps: boolean,          // Enable friendly healing
    repairRoads: boolean,         // Repair roads
    repairCritical: boolean,      // Repair critical structures
    repairRamparts: boolean,      // Repair ramparts
    repairWalls: boolean,         // Repair walls
    rampartLimit: number,         // Max hits for ramparts
    wallLimit: number             // Max hits for walls
};
```

**Defaults:**
```typescript
{
    attackHostiles: true,
    healCreeps: true,
    repairRoads: true,
    repairCritical: true,
    repairRamparts: true,
    repairWalls: true,
    rampartLimit: 100000,   // 100k hits
    wallLimit: 100000       // 100k hits
}
```

### Enable/Disable Features

```typescript
// Disable rampart repair
Game.rooms['E25N25'].memory.settings.towerSettings.repairRamparts = false;

// Set higher wall limit
Game.rooms['E25N25'].memory.settings.towerSettings.wallLimit = 500000;

// Disable hostile targeting (for testing)
Game.rooms['E25N25'].memory.settings.towerSettings.attackHostiles = false;
```

## Repair Priority System

### Critical Structures

High priority repair targets:
- **Towers** (ensures defensive capability)
- **Spawns** (ensures creep production)
- **Extensions** (enables energy capacity)
- **Containers** (maintains logistics)
- **Links** (energy distribution)
- **Storage** (resource storage)
- **Terminal** (trade capability)

### Roads

Medium priority:
- Only repair when below 95% hits
- Prevents excessive repair cycling
- Focuses on heavily damaged roads

### Ramparts & Walls

Configurable priority:
- Set maximum hits limit per room
- Prevents wasting energy on full HP ramparts
- Allows progressive fortification

**Example:**
```typescript
// Early game: Low limits
room.memory.settings.towerSettings.rampartLimit = 10000;
room.memory.settings.towerSettings.wallLimit = 10000;

// Late game: Higher limits
room.memory.settings.towerSettings.rampartLimit = 1000000;
room.memory.settings.towerSettings.wallLimit = 1000000;
```

## Integration with RoomManager

DefenseManager is called by RoomManager each tick:

```typescript
// In RoomManager.run()
export class RoomManager {
    run() {
        this.scanResources();
        this.gatherStats();
        // ... other operations ...

        // Manage towers
        DefenseManager.run(this.room);

        // ... remaining operations ...
    }
}
```

**Execution Order:**
1. RoomManager scans resources (finds towers)
2. RoomManager runs DefenseManager
3. DefenseManager processes all towers in room

## Usage Examples

### Basic Setup

```typescript
// DefenseManager runs automatically via RoomManager
// No manual setup required

// Access in console
const room = Game.rooms['E25N25'];
DefenseManager.run(room);  // Manual invocation (not needed normally)
```

### Configure Tower Behavior

```typescript
const room = Game.rooms['E25N25'];

// Set repair limits
room.memory.settings.towerSettings.rampartLimit = 500000;
room.memory.settings.towerSettings.wallLimit = 500000;

// Disable wall repair
room.memory.settings.towerSettings.repairWalls = false;

// Enable all features
room.memory.settings.towerSettings.attackHostiles = true;
room.memory.settings.towerSettings.healCreeps = true;
room.memory.settings.towerSettings.repairRoads = true;
room.memory.settings.towerSettings.repairCritical = true;
room.memory.settings.towerSettings.repairRamparts = true;
```

### Monitor Tower Activity

```typescript
// Check tower energy levels
const room = Game.rooms['E25N25'];
const towers = room.find(FIND_MY_STRUCTURES, {
    filter: { structureType: STRUCTURE_TOWER }
});

towers.forEach(tower => {
    console.log(`${tower.id}: ${tower.store[RESOURCE_ENERGY]}/${tower.store.getCapacity(RESOURCE_ENERGY)}`);
});
```

### Debug Hostile Targeting

```typescript
const room = Game.rooms['E25N25'];
const hostiles = room.find(FIND_HOSTILE_CREEPS);

console.log(`Total hostiles: ${hostiles.length}`);

const healers = hostiles.filter(h => h.getActiveBodyparts(HEAL) > 0);
console.log(`Healers: ${healers.length}`);

const military = hostiles.filter(h =>
    h.getActiveBodyparts(ATTACK) > 0 ||
    h.getActiveBodyparts(RANGED_ATTACK) > 0 ||
    h.getActiveBodyparts(WORK) > 0
);
console.log(`Military: ${military.length}`);

const invaders = hostiles.filter(h => h.owner.username === 'Invader');
console.log(`Invaders: ${invaders.length}`);
```

## Advanced Features

### Energy Management

Towers should maintain energy for defense:

```typescript
// In RoomManager or tower filling logic
const minimumEnergy = 200;  // Always keep some energy

const towers = room.find(FIND_MY_STRUCTURES, {
    filter: s => s.structureType === STRUCTURE_TOWER &&
                  s.store[RESOURCE_ENERGY] < minimumEnergy
});

// Prioritize filling low-energy towers
if (towers.length > 0) {
    // Assign fillers to refill towers
}
```

### Rampart/Wall Progression

Progressive fortification strategy:

```typescript
// Early game (RCL 3-4)
if (room.controller.level < 5) {
    room.memory.settings.towerSettings.rampartLimit = 10000;
    room.memory.settings.towerSettings.wallLimit = 10000;
}

// Mid game (RCL 5-6)
else if (room.controller.level < 7) {
    room.memory.settings.towerSettings.rampartLimit = 100000;
    room.memory.settings.towerSettings.wallLimit = 100000;
}

// Late game (RCL 7-8)
else {
    room.memory.settings.towerSettings.rampartLimit = 1000000;
    room.memory.settings.towerSettings.wallLimit = 1000000;
}
```

### Multi-Tower Focus Fire

For maximum effectiveness, all towers should target the same enemy:

```typescript
// In DefenseManager (pseudocode)
const primaryTarget = findHighestPriorityHostile(room);

towers.forEach(tower => {
    if (primaryTarget) {
        tower.attack(primaryTarget);
    }
});
```

**Benefit:** Concentrated fire eliminates threats faster.

## Performance Considerations

1. **Single Scan**: Hostiles scanned once per tick, reused for all towers
2. **Priority Caching**: Priority calculations cached per tick
3. **Efficient Filtering**: Uses lodash for optimized filtering
4. **Conditional Repair**: Only repairs when enabled in settings

## Best Practices

### 1. Maintain Tower Energy

```typescript
// Always keep towers above 200 energy
const lowTowers = room.find(FIND_MY_STRUCTURES, {
    filter: s => s.structureType === STRUCTURE_TOWER &&
                  s.store[RESOURCE_ENERGY] < 200
});

// Prioritize filling these towers
```

### 2. Set Appropriate Limits

```typescript
// Don't repair ramparts/walls to max hits (30M)
// Set reasonable limits based on RCL
room.memory.settings.towerSettings.rampartLimit =
    room.controller.level * 100000;  // 100k per RCL
```

### 3. Focus Fire on Threats

```typescript
// Let DefenseManager handle targeting
// All towers will focus on highest priority threat
// Don't override with manual targeting
```

### 4. Balance Defense and Economy

```typescript
// If energy is scarce, reduce repair activity
if (room.storage && room.storage.store[RESOURCE_ENERGY] < 50000) {
    room.memory.settings.towerSettings.repairWalls = false;
    room.memory.settings.towerSettings.repairRamparts = false;
}
```

## Debugging

### Visualize Tower Ranges

```typescript
// Show tower ranges
room.memory.settings.visualSettings.displayTowerRanges = true;

// In visualization code
towers.forEach(tower => {
    room.visual.circle(tower.pos, {
        radius: 20,
        fill: 'transparent',
        stroke: '#ff0000',
        strokeWidth: 0.1
    });
});
```

### Log Tower Actions

```typescript
// In DefenseManager
console.log(`[${room.name}] Tower ${tower.id}:`);

if (targetHostile) {
    console.log(`  Attacking ${targetHostile.name} (${targetHostile.owner.username})`);
}
else if (damagedCreep) {
    console.log(`  Healing ${damagedCreep.name}`);
}
else if (repairTarget) {
    console.log(`  Repairing ${repairTarget.structureType} at ${repairTarget.pos}`);
}
```

### Monitor Hostile Threats

```typescript
// Track hostile encounters
if (hostiles.length > 0) {
    console.log(`[ALERT] ${hostiles.length} hostiles in ${room.name}`);
    hostiles.forEach(h => {
        console.log(`  ${h.name} (${h.owner.username}): ${h.body.length} parts`);
    });
}
```

## Integration with Other Systems

### RoomManager

- RoomManager calls DefenseManager.run() each tick
- RoomManager provides tower list via resource scanning
- Tower repair integrates with room settings

### Creep Roles

- Defender creeps complement tower defense
- Healers can assist injured creeps
- Builders/repairers handle non-critical repairs

### BasePlanner

- BasePlanner positions towers for optimal coverage
- Ramparts and walls placed using min-cut algorithm
- Tower placement considers room geometry

## Common Issues

### Towers Not Attacking

**Symptoms:** Hostiles present but towers idle

**Solutions:**
1. Check `attackHostiles` setting is enabled
2. Verify towers have energy
3. Ensure DefenseManager.run() is being called
4. Check hostiles are actually in room (not just adjacent)

### Excessive Repair Energy Use

**Symptoms:** Towers constantly repairing, draining energy

**Solutions:**
1. Set appropriate rampart/wall limits
2. Disable unnecessary repair (roads, walls)
3. Only enable repair when energy is abundant
4. Lower repair priority in tower settings

### Ramparts Not Repairing

**Symptoms:** Ramparts below limit but not being repaired

**Solutions:**
1. Enable `repairRamparts` in settings
2. Check rampartLimit is higher than current hits
3. Ensure towers have energy
4. Verify no hostiles present (attack takes priority)

### Towers Running Out of Energy

**Symptoms:** Towers frequently empty

**Solutions:**
1. Increase filler creep quota
2. Prioritize tower filling in task assignment
3. Add more haulers for energy logistics
4. Check for energy shortage in room

## Related Documentation

- [RoomManager](RoomManagerAPI.md) - Calls DefenseManager
- [Tower Management](tower.md) - Legacy tower system
- [System Architecture](SystemArchitecture.md) - Overall design
- [Creep Roles - Defender](CreepRoles.md#defender) - Combat creeps

## Future Enhancements

Potential improvements:
- Predictive targeting (leading moving targets)
- Multi-tower focus fire coordination
- Threat assessment scoring system
- Emergency mode for low energy
- Rampart/wall health progression automation
