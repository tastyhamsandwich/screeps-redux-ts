# Colony System Documentation

The Colony system provides a unified interface for managing rooms and their resources across your main colony room and any remote mining rooms.

## Overview

A Colony consists of:
- **Main Room**: The room where your controller is claimed
- **Remote Rooms**: Any rooms being reserved for remote mining
- **Sources**: All sources from main + remote rooms, indexed to match their containers
- **Minerals**: All minerals from main + remote rooms
- **Containers**: All containers near sources, indexed to match their adjacent sources
- **Creeps**: All creeps spawned by the colony (based on `creep.memory.home`)

## Access Patterns

### Accessing Colonies

```javascript
// Access colonies via Game.colonies (read-only view)
Game.colonies['W8N3']

// Access colonies via global (for internal use)
global.colonies['W8N3']
```

### From Creeps

```javascript
// Get the colony a creep belongs to
const creep = Game.creeps['MyHarvester'];
const colony = creep.colony;

// Access colony resources
if (colony) {
    console.log(`${creep.name} belongs to colony ${colony.name}`);
    console.log(`Colony has ${colony.sources.length} sources`);
}
```

### From Rooms

```javascript
// Get colony from main room
const room = Game.rooms['W8N3'];
const colony = room.colony;

// Get colony from remote room
const remoteRoom = Game.rooms['W7N3'];
const colony = remoteRoom.colony; // Returns the colony that manages this remote
```

## Properties

### `colony.name: string`
The name of the main room (e.g., 'W8N3')

### `colony.mainRoom: Room`
Reference to the main colony room

### `colony.sources: Source[]`
All sources in the colony (main + remotes), indexed to match their containers

**Example:**
```javascript
// Access source and its adjacent container
const colony = Game.colonies['W8N3'];
for (let i = 0; i < colony.sources.length; i++) {
    const source = colony.sources[i];
    const container = colony.containers[i];
    console.log(`Source ${source.id} has container ${container?.id || 'none'}`);
}
```

### `colony.containers: StructureContainer[]`
All containers near sources (within range 2), indexed to match their adjacent sources

### `colony.minerals: Mineral[]`
All minerals in the colony (main + remotes)

### `colony.creeps: { [name: string]: Creep }`
Hash of all creeps spawned by this colony (where `creep.memory.home === colony.name`)

**Example:**
```javascript
const colony = Game.colonies['W8N3'];
for (const name in colony.creeps) {
    const creep = colony.creeps[name];
    console.log(`${name}: ${creep.memory.role}`);
}
```

### `colony.rooms: Room[]`
All rooms in the colony (main room + all remote rooms with vision)

### `colony.remoteRooms: Room[]`
Only the remote rooms (excludes main room)

## Methods

### `colony.refresh(): void`
Refreshes all colony data. Called automatically each tick by main loop.

### `colony.addRemoteRoom(roomName: string): void`
Adds a remote room to this colony's management

**Example:**
```javascript
const colony = Game.colonies['W8N3'];
colony.addRemoteRoom('W7N3');
```

### `colony.removeRemoteRoom(roomName: string): void`
Removes a remote room from this colony

**Example:**
```javascript
const colony = Game.colonies['W8N3'];
colony.removeRemoteRoom('W7N3');
```

## Usage Examples

### Listing All Sources and Containers
```javascript
const colony = Game.colonies['W8N3'];
console.log(`Colony ${colony.name} resources:`);
console.log(`- ${colony.sources.length} sources`);
console.log(`- ${colony.containers.filter(c => c).length} containers`);
console.log(`- ${colony.minerals.length} minerals`);
console.log(`- ${Object.keys(colony.creeps).length} creeps`);
```

### Harvester Assignment by Colony
```javascript
// Assign harvesters to sources across entire colony
const colony = Game.colonies['W8N3'];
for (let i = 0; i < colony.sources.length; i++) {
    const source = colony.sources[i];
    const container = colony.containers[i];

    // Find harvesters assigned to this source
    const harvesters = Object.values(colony.creeps).filter(c =>
        c.memory.role === 'harvester' &&
        c.memory.sourceId === source.id
    );

    console.log(`Source ${i}: ${harvesters.length} harvesters assigned`);
}
```

### Energy Statistics Across Colony
```javascript
const colony = Game.colonies['W8N3'];

// Calculate total energy in containers
let totalEnergy = 0;
for (const container of colony.containers) {
    if (container) {
        totalEnergy += container.store[RESOURCE_ENERGY];
    }
}

console.log(`Total energy in containers: ${totalEnergy}`);
```

### Finding Remote Harvesters
```javascript
const colony = Game.colonies['W8N3'];

// Get all remote harvesters for this colony
const remoteHarvesters = Object.values(colony.creeps).filter(c =>
    c.memory.role === 'remoteharvester'
);

console.log(`${colony.name} has ${remoteHarvesters.length} remote harvesters`);
```

## Implementation Notes

- Colonies are automatically created for each owned room in [main.ts](src/main.ts)
- Colony data is refreshed every tick to stay current with game state
- The `colony` property on Creeps and Rooms is a getter that references `global.colonies`
- Remote rooms automatically link to their host colony via `room.memory.hostColony`
- Containers are matched to sources based on proximity (range ≤ 2)
- If a source has no nearby container, the corresponding entry in `colony.containers` will be `null`

## Performance Considerations

- Colony refresh happens once per tick per owned room
- The refresh operation finds all sources, minerals, containers, and creeps
- Container-to-source mapping is calculated each tick (cached lookups could be added if needed)
- Accessing `creep.colony` or `room.colony` is a lightweight getter (just a hash lookup)

## Integration with Existing Systems

The Colony system integrates seamlessly with:
- **RoomManager**: Continues to manage individual room logic
- **SpawnManager**: Creeps reference their colony via `memory.home`
- **Outpost System**: Uses `room.memory.outposts.array` to find remote rooms
- **TrafficManager**: Creeps can use `creep.colony` for navigation decisions

## Future Enhancements

Potential additions:
- Cached container-to-source mapping for better performance
- Colony-level statistics and metrics
- Multi-colony coordination logic
- Colony templates and build orders
