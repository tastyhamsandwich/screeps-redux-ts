# TrafficManager

The `TrafficManager` provides centralized movement coordination for all creeps, enabling collision-free movement even when using `ignoreCreeps: true`. It resolves movement conflicts through direct movement, creep swapping, and pushing mechanisms.

## Overview

**Location:** [src/managers/TrafficManager.ts](src/managers/TrafficManager.ts)

**Purpose:**
- Allow creeps to move with `ignoreCreeps: true` while preventing actual collisions
- Enable creep swapping for efficient bidirectional traffic
- Push blocking creeps out of the way based on priorities
- Process movement intents submitted during creep AI execution

## How It Works

### Intent-Based Movement System

Instead of calling `creep.move()` directly, creeps submit movement intents to a global array:

```typescript
global.TrafficIntents.push({
    creep: creep,
    from: creep.pos,
    to: destination,
    priority: 1,
    opts: { /* optional MoveToOpts */ }
});
```

At the end of each tick, `TrafficManager.run()` processes all intents and resolves conflicts.

## Core Function

### `TrafficManager.run(): void`

Main execution method called once per tick after all creep AI execution.

**Called in:** [src/main.ts](src/main.ts) (after creep AI loop, before room processing)

**Process:**
1. Iterate through all movement intents in `global.TrafficIntents`
2. For each intent, determine movement strategy:
   - **Direct Movement**: If destination is clear, move directly
   - **Creep Swapping**: If two creeps want to swap positions
   - **Pushing**: If a creep is blocking, push it aside
3. Clear intents array for next tick

**Example:**
```typescript
// In main.ts
export const loop = () => {
    // ... creep AI execution ...

    // Resolve all movement intents
    TrafficManager.run();

    // ... room processing ...
};
```

## Movement Intent Interface

### MoveIntent

```typescript
interface MoveIntent {
    creep: Creep;               // The creep that wants to move
    from: RoomPosition;         // Current position
    to: RoomPosition;           // Destination position
    priority: number;           // Priority (higher = more important)
    opts?: MoveToOpts;          // Optional pathfinding options
}
```

**Priority Guidelines:**
- **100**: Emergency (e.g., fleeing from hostiles)
- **50**: High priority (e.g., haulers with full cargo)
- **10**: Normal priority (e.g., workers moving to tasks)
- **1**: Low priority (e.g., idle creeps)

## Movement Strategies

### 1. Direct Movement

**Condition:** Destination tile is empty or will be vacated this tick.

**Action:** Creep moves directly to destination.

**Example:**
```typescript
// Creep A wants to move from (10,10) to (11,10)
// (11,10) is empty
// Result: Creep A moves to (11,10)
```

### 2. Creep Swapping

**Condition:** Two creeps want to exchange positions.

**Action:** Both creeps move simultaneously.

**Example:**
```typescript
// Creep A at (10,10) wants to move to (11,10)
// Creep B at (11,10) wants to move to (10,10)
// Result: Creeps swap positions in one tick
```

**Benefits:**
- Prevents traffic jams in narrow corridors
- Enables efficient bidirectional movement
- No wasted ticks waiting

### 3. Pushing

**Condition:** A higher-priority creep wants to move to a position occupied by a lower-priority creep.

**Action:** The blocking creep is pushed to an adjacent tile.

**Example:**
```typescript
// Creep A (priority 50) wants to move to (11,10)
// Creep B (priority 10) is at (11,10) and not moving
// Result: Creep B is pushed to adjacent tile, Creep A moves to (11,10)
```

**Push Direction:**
- Prefers tiles that don't block other movement
- Avoids pushing into walls or sources
- Considers fatigue and movement costs

## Integration with Creep AI

### Using SmartNavigator

The recommended way to submit movement intents is via `creep.smartMoveTo()`:

```typescript
// In creep AI
creep.smartMoveTo(target, {
    reusePath: 5,
    visualizePathStyle: { stroke: '#ffaa00' }
});
```

**SmartNavigator handles:**
- Pathfinding with route caching
- Intent submission to TrafficManager
- Cross-room navigation
- Unseen room handling

### Manual Intent Submission

For custom movement logic:

```typescript
// Submit intent directly
global.TrafficIntents.push({
    creep: creep,
    from: creep.pos,
    to: targetPos,
    priority: 10,
    opts: { range: 1 }
});
```

**Important:** Don't call `creep.move()` after submitting an intent - TrafficManager will handle movement.

## Global Array

### global.TrafficIntents

Array of movement intents cleared each tick.

**Initialization:**
```typescript
// In main.ts or globals
if (!global.TrafficIntents) {
    global.TrafficIntents = [];
}
```

**Usage Pattern:**
```typescript
// During creep AI execution
for (const name in Game.creeps) {
    const creep = Game.creeps[name];
    // Creep AI submits intents
    creep.smartMoveTo(target);
}

// After all creep AI
TrafficManager.run();  // Processes and clears intents
```

## Advanced Features

### Priority-Based Resolution

Higher priority creeps get preferential treatment:

```typescript
// High-priority hauler
global.TrafficIntents.push({
    creep: hauler,
    from: hauler.pos,
    to: destination,
    priority: 50  // High priority
});

// Low-priority scout
global.TrafficIntents.push({
    creep: scout,
    from: scout.pos,
    to: destination,
    priority: 1   // Low priority
});

// Result: Hauler moves, scout waits or is pushed aside
```

### Conflict Detection

TrafficManager detects and resolves conflicts:

**Same Destination:**
- Multiple creeps want to move to the same tile
- Highest priority creep moves
- Others wait or find alternative routes

**Swapping Detection:**
- Creep A wants to move to B's position
- Creep B wants to move to A's position
- Both move simultaneously

**Blocking:**
- Creep wants to move but destination is blocked
- If blocker has lower priority, push it aside
- Otherwise, wait

## Usage Examples

### Basic Movement

```typescript
// In Harvester.run()
export function run(creep: Creep) {
    const source = Game.getObjectById(creep.memory.source);
    if (!source) return;

    if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
        // Submit movement intent
        creep.smartMoveTo(source, { range: 1 });
    }
}

// TrafficManager.run() will handle the movement
```

### Priority-Based Movement

```typescript
// High-priority hauler delivering to spawn
if (creep.memory.role === 'hauler' && creep.store.getUsedCapacity() > 0) {
    global.TrafficIntents.push({
        creep: creep,
        from: creep.pos,
        to: spawn.pos,
        priority: 50,  // High priority
        opts: { range: 1 }
    });
}

// Low-priority builder
if (creep.memory.role === 'builder') {
    creep.smartMoveTo(constructionSite, { range: 3 });
    // Default priority: 10
}
```

### Cross-Room Movement

```typescript
// SmartNavigator handles cross-room pathfinding
creep.smartMoveTo(targetInRemoteRoom, {
    reusePath: 50,  // Longer reuse for remote paths
    maxOps: 2000    // Higher ops limit for long distances
});

// TrafficManager resolves movement in each room
```

## Performance Considerations

1. **Single Processing**: TrafficManager runs once per tick after all creep AI
2. **Intent Array**: Cleared each tick, no persistent state
3. **Conflict Resolution**: O(n²) worst case for n creeps in same area
4. **Memory Efficient**: No memory storage, all data in intents array

## Best Practices

### 1. Use SmartNavigator

```typescript
// Good - uses SmartNavigator
creep.smartMoveTo(target);

// Avoid - manual move without TrafficManager
creep.moveTo(target);
```

### 2. Set Appropriate Priorities

```typescript
// Critical: Fleeing from danger
priority: 100

// High: Haulers with cargo, healers
priority: 50

// Normal: Most workers
priority: 10

// Low: Scouts, idle creeps
priority: 1
```

### 3. Submit Intents During Creep AI

```typescript
// Correct order
for (const name in Game.creeps) {
    // Creep AI submits intents
    CreepAI[role].run(creep);
}
TrafficManager.run();  // Process all intents

// Wrong order
TrafficManager.run();  // Nothing to process yet
for (const name in Game.creeps) {
    CreepAI[role].run(creep);  // Intents submitted after processing
}
```

### 4. Don't Mix Movement Methods

```typescript
// Bad - mixing manual move with intents
creep.smartMoveTo(target);  // Submits intent
creep.move(TOP);            // Conflicts with intent

// Good - use one method
creep.smartMoveTo(target);  // TrafficManager handles it
```

## Debugging

### Visualize Movement

```typescript
// Enable path visualization in opts
creep.smartMoveTo(target, {
    visualizePathStyle: {
        stroke: '#ffaa00',
        lineStyle: 'dashed',
        opacity: 0.5
    }
});
```

### Log Intents

```typescript
// In main.ts before TrafficManager.run()
console.log(`Movement intents: ${global.TrafficIntents.length}`);
global.TrafficIntents.forEach(intent => {
    console.log(`${intent.creep.name}: ${intent.from} → ${intent.to} (priority: ${intent.priority})`);
});

TrafficManager.run();
```

### Check for Conflicts

```typescript
// Count intents per destination
const destinations = {};
global.TrafficIntents.forEach(intent => {
    const key = `${intent.to.x},${intent.to.y}`;
    destinations[key] = (destinations[key] || 0) + 1;
});

console.log('Destination conflicts:',
    Object.entries(destinations).filter(([_, count]) => count > 1)
);
```

## Integration with Other Systems

### SmartNavigator

- SmartNavigator submits intents to TrafficManager
- Handles pathfinding and route caching
- TrafficManager executes the movement

### Creep AI

- All creep roles use smartMoveTo()
- Intents submitted during AI execution
- TrafficManager resolves conflicts after AI

### RoomManager

- Doesn't directly interact with TrafficManager
- Creeps assigned tasks move via smartMoveTo()
- Movement handled automatically

## Common Issues

### Creeps Not Moving

**Symptoms:** Creeps idle even when submitting intents

**Solutions:**
1. Verify TrafficManager.run() is called each tick
2. Check intents are being submitted correctly
3. Ensure global.TrafficIntents array exists

### Creeps Colliding

**Symptoms:** Creeps occupy same position

**Solutions:**
1. Check for manual `creep.move()` calls bypassing TrafficManager
2. Verify all movement goes through smartMoveTo()
3. Ensure TrafficManager runs after all creep AI

### Traffic Jams

**Symptoms:** Creeps blocking each other

**Solutions:**
1. Use appropriate priorities for different roles
2. Design base layout with wider corridors
3. Enable creep swapping by using TrafficManager

### Performance Issues

**Symptoms:** High CPU usage from TrafficManager

**Solutions:**
1. Limit number of creeps in same area
2. Optimize pathfinding (reusePath, maxOps)
3. Use priority to reduce conflict resolution complexity

## Related Documentation

- [SmartNavigator](SmartNavigator.md) - Pathfinding integration
- [Creep Roles](CreepRoles.md) - How roles use movement
- [System Architecture](SystemArchitecture.md) - Overall flow
- [Main Loop](main.ts) - Integration point

## Future Enhancements

Potential improvements:
- Multi-tick path reservation
- Formation movement for military groups
- Traffic flow optimization for high-density areas
- Predictive conflict avoidance
