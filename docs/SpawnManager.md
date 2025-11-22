# SpawnManager Usage Guide

## Overview

The `SpawnManager` is a centralized spawning system that intelligently manages spawn requests across all rooms. It features:

- **Priority-based queue** with dynamic reordering
- **Predictive spawning** - automatically schedules replacements before creeps die
- **Energy forecasting** - prevents resource conflicts
- **Time-based scheduling** - avoids spawn time conflicts

## Architecture

```
RoomManager → SpawnManager → Spawn Structures
     ↓            ↓
 submitRequest   processQueue
                    ↓
              Spawns Creep
```

## How It Works

### 1. Predictive Spawning

The SpawnManager automatically tracks creeps in these roles:
- `harvester`
- `filler`
- `hauler`
- `reserver`

When a creep's `ticksToLive` drops below 1400, the SpawnManager schedules a replacement spawn:

```
scheduledTick = deathTick - spawnTime - bufferTime(100)
```

### 2. Priority System

Each role has a base priority (higher = more important):

| Role | Priority |
|------|----------|
| Harvester | 100 |
| Filler | 95 |
| Hauler | 90 |
| Defender | 85 |
| Upgrader | 70 |
| Builder | 65 |
| Repairer | 60 |
| Reserver | 55 |
| Remote Harvester | 50 |
| Remote Bodyguard | 45 |
| Remote Hauler | 40 |
| Scout | 30 |

### 3. Conflict Detection

Before accepting a spawn request, the SpawnManager checks:

**Time Conflicts:**
- Will this spawn overlap with a scheduled spawn?
- Does the scheduled spawn have higher priority?

**Energy Conflicts:**
- Will we have enough energy for both spawns?
- Uses energy forecasting: `income = min(workParts * 2, sources * 10)`

If conflicts exist with higher-priority spawns, the request is deferred and retried later.

### 4. Queue Management

The queue is sorted by:
1. **Urgent flag** (emergencies first)
2. **Priority** (higher first)
3. **Request time** (older first)

## Usage Examples

### Basic Spawn Request

```typescript
// In RoomManager or any other manager
this.spawnManager.submitRequest({
    role: 'harvester',
    priority: 100,  // Optional, defaults to role priority
    body: [WORK, WORK, WORK, MOVE],
    memory: {
        role: 'harvester',
        home: this.room.name,
        room: this.room.name
    },
    roomName: this.room.name,
    urgent: false  // Set to true for emergencies
});
```

### Emergency Spawn

```typescript
// When you have zero harvesters
this.spawnManager.submitRequest({
    role: 'harvester',
    priority: 100,
    body: [WORK, WORK, MOVE],  // Use available energy
    memory: { /* ... */ },
    roomName: this.room.name,
    urgent: true  // This bypasses normal queue order
});
```

### Getting Queue Status

```typescript
const status = this.spawnManager.getStatus();
console.log(`Queue length: ${status.queueLength}`);
console.log(`Scheduled spawns: ${status.scheduledSpawns}`);
console.log(`Energy income: ${status.energyIncome}/tick`);
console.log(`Next spawn: ${status.nextSpawn?.role}`);
```

### Inspecting the Queue

```typescript
const queue = this.spawnManager.getQueue();
for (const request of queue) {
    console.log(`${request.role} - Priority: ${request.priority}, Cost: ${request.energyCost}`);
}

const scheduled = this.spawnManager.getScheduledSpawns();
for (const spawn of scheduled) {
    console.log(`${spawn.role} scheduled for tick ${spawn.scheduledTick}`);
}
```

### Emergency Clear

```typescript
// In case something goes wrong
this.spawnManager.clearQueue();
```

## Integration with RoomManager

The `RoomManager` now uses `SpawnManager` instead of managing its own queue:

```typescript
// Old way (removed)
this.addSpawnRequest('harvester', 100, body, memory);
this.processSpawnQueue();

// New way (current)
this.spawnManager.submitRequest({
    role: 'harvester',
    priority: 100,
    body: body,
    memory: memory,
    roomName: this.room.name,
    urgent: false
});
// SpawnManager.run() handles processing
```

## Memory Structure

The SpawnManager stores its state in `room.memory.spawnManager`:

```typescript
interface SpawnManagerMemory {
    queue: SpawnRequest[];        // Current queue
    scheduled: ScheduledSpawn[];  // Predictive spawns
    deferred?: SpawnRequest[];    // Deferred requests
    lastProcessed: number;        // Last tick processed
}
```

## Benefits

1. **No Duplicate Spawns**: Predictive system prevents spawning multiple replacements
2. **Energy Efficiency**: Forecasting prevents energy starvation
3. **Priority Management**: Critical roles always spawn first
4. **Time Optimization**: Spawn scheduling prevents conflicts
5. **Flexibility**: Easy to add new roles or change priorities
6. **Debugging**: Full visibility into queue state and decisions

## Tips

- Set `urgent: true` only for true emergencies (0 harvesters, invasion)
- Higher priority doesn't guarantee immediate spawning if energy/time conflicts exist
- The system automatically retries deferred requests
- Predictive spawning only works for roles in `PREDICTIVE_ROLES` array
- Energy forecast assumes optimal harvesting (all work parts active)

## Future Enhancements

Potential improvements:
- Multi-spawn coordination (use multiple spawns simultaneously)
- Dynamic priority adjustment based on room state
- Cross-room spawn requests (support from allied rooms)
- Boost-aware spawning (factor in boost time)
- Visual debug overlay for queue state
