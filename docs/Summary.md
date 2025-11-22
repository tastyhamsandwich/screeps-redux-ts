# Screeps Redux TypeScript Bot

Welcome to the comprehensive documentation for the Screeps Redux TypeScript bot, a sophisticated AI implementation for the game [Screeps](https://screeps.com/).

## Overview

This bot features a manager-based architecture that provides efficient room management, intelligent spawning systems, and automated infrastructure planning. Built with TypeScript, it leverages strong typing and modern design patterns for maintainable, scalable code.

## Key Features

### 🏗️ **Manager Architecture**
- **RoomManager**: Centralized room operations and resource management
- **SpawnManager**: Intelligent spawn queue system with priority-based scheduling and predictive spawning
- **TrafficManager**: Centralized movement coordination with creep swapping and pushing
- **DefenseManager**: Automated tower targeting and defensive prioritization
- **BasePlanner**: Algorithmic base layout generation with RCL-aware construction

### 🤖 **Creep Roles**
- **Harvester**: Source mining with container-based energy collection (local and remote variants)
- **Hauler**: Dynamic logistics between containers, storage, and links
- **Filler**: Spawn/extension energy distribution
- **Upgrader**: Controller upgrading with container support
- **Builder**: Construction site management
- **Repairer**: Structure maintenance based on configurable priorities
- **Defender**: Combat and defensive operations
- **Reserver**: Remote room controller reservation
- **Scout**: Room exploration and vision maintenance

### 🛡️ **Defense System**
- Multi-priority hostile targeting (healers, military creeps, NPC invaders)
- Automated tower targeting with configurable priorities
- Intelligent structure repair with damage thresholds
- Visual alerts for hostile presence

### 🔧 **Infrastructure Planning**
- Automated base layout generation using distance transforms and flood fill algorithms
- RCL-aware construction scheduling with build queues
- Stamp-based design (5x5 core stamp with spawns/terminal/storage, lab stamp)
- Automatic road network generation
- Container placement optimization near sources, controllers, and minerals
- Construction site progress visualization with detailed visuals

### 📊 **Advanced Features**
- Predictive spawn replacement with 100-tick buffer before creep death
- Energy forecasting for spawn scheduling with conflict detection
- Intent-based movement system with collision resolution
- Logistical pair registration for haulers with path-based body sizing
- Remote mining and outpost management
- Statistics tracking (energy harvested, control points, etc.)
- Visual progress indicators for construction and repairs
- Dynamic task assignment system (haul → fillTower → repair → build → upgrade)
- Memory-based caching for optimal performance
- Base plan visualization with multiple debug modes

## Documentation Structure

### Getting Started
- [Installation & Setup](Installation-&-Setup)
- [Configuration](Configuration)
- [Quick Start Guide](Quick-Start-Guide)

### Architecture
- [System Architecture](System-Architecture)
- [Manager System](Manager-System)
- [Memory Structure](Memory-Structure)

### API Reference
- [Creep Roles](Creep-Roles)
- [Prototype Extensions](Prototype-Extensions)
  - [Creep Extensions](Creep-Prototype-Extensions)
  - [Room Extensions](Room-Prototype-Extensions)
  - [RoomPosition Extensions](RoomPosition-Prototype-Extensions)
  - [Spawn Extensions](Spawn-Prototype-Extensions)

### Managers
- [RoomManager](RoomManagerAPI.md)
- [SpawnManager](SpawnManagerAPI.md)
- [TrafficManager](TrafficManager.md)
- [DefenseManager](DefenseManager.md)

### Modules
- [BasePlanner](BasePlanner.md)
- [SmartNavigator](SmartNavigator.md)
- [PlanningFunctions](PlanningFunctions.md)

### Utilities
- [Global Functions](Global-Functions)
- [Constants](Constants)
- [Visualization](Visualization)

### Advanced Topics
- [Remote Mining](Remote-Mining)
- [Outpost Management](Outpost-Management)
- [Performance Optimization](Performance-Optimization)

## Quick Example

```typescript
// The main loop automatically handles all operations
export const loop = () => {
    // Initialize global settings if needed
    if (!Memory.globalSettings) FUNC.initGlobal();

    // Calculate tick timing
    FUNC.calcTickTime();

    // Clean up memory of dead creeps
    FUNC.creepCleanup(creepRoleCounts);

    // Execute creep AI based on roles
    for (const name in Game.creeps) {
        const creep = Game.creeps[name];
        switch (creep.memory.role) {
            case 'harvester':
                CreepAI.Harvester.run(creep);
                break;
            // ... other roles
        }
    }

    // Resolve all movement intents via TrafficManager
    TrafficManager.run();

    // Process all visible rooms
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];

        // Cache room objects when needed
        if (room.memory.data?.cacheNeedsUpdate) {
            room.cacheObjects();
        }

        // For owned rooms: run RoomManager
        if (room.controller?.my) {
            if (!global.roomManagers[room.name]) {
                global.roomManagers[room.name] = new RoomManager(room);
            }
            global.roomManagers[room.name].run();
        }
    }
};
```

## Contributing

Contributions are welcome! Please see [Contributing Guidelines](Contributing) for more information.

## License

This project is open source. See the repository for license details.

---

**Version**: 2.0
**Branch**: auto-base-planner
**Last Updated**: January 2025