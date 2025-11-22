# System Architecture

## Overview

The Screeps Redux TypeScript bot employs a hierarchical, manager-based architecture that separates concerns and promotes code maintainability. The system is organized into distinct layers that handle different aspects of gameplay.

## Architecture Layers

### 1. Main Loop Layer (`main.ts`)

The entry point that orchestrates all operations:

```typescript
export const loop = () => {
    // Global initialization
    if (!Memory.globalSettings) global.initGlobal();
    
    // Tick timing calculation
    calcTickTime();
    
    // Creep memory cleanup
    for (const name in Memory.creeps) {
        if (!(name in Game.creeps)) {
            delete Memory.creeps[name];
        }
    }
    
    // Execute creep AI
    for (const name in Game.creeps) {
        const creep = Game.creeps[name];
        // Role-based dispatch to CreepAI modules
    }
    
    // Room management
    _.forEach(Game.rooms, room => {
        const manager = global.roomManagers[room.name] 
            || new RoomManager(room);
        manager.run();
    });
};
```

**Responsibilities:**
- Initialize global settings (via FUNC.initGlobal())
- Clean up memory for dead creeps (via FUNC.creepCleanup())
- Dispatch creeps to their role-specific AI modules
- Resolve movement intents via TrafficManager
- Instantiate and run RoomManagers for owned rooms
- Track construction site changes across rooms
- Cache room objects when needed
- Visualize RCL upgrade progress

### 2. Manager Layer

#### RoomManager (`managers/RoomManager.ts`)

The central controller for all room-level operations:

```typescript
class RoomManager {
    private room: Room;
    private resources: RoomResources;
    private stats: RoomStats;
    private spawnManager: SpawnManager;
    
    run(): void {
        // Update resources and stats
        // Run spawn manager
        // Update bootstrap state
        // Plan infrastructure
        // Assess creep needs
        // Assign creep tasks
        // Manage towers
        // Manage links
    }
}
```

**Responsibilities:**
- Resource scanning and tracking (throttled to 10-tick intervals)
- Base plan generation and management via BasePlanner module
- Infrastructure planning and construction queue processing
- Creep need assessment and spawn request submission
- Dynamic task assignment for workers (haul → fillTower → repair → build → upgrade)
- Tower management via DefenseManager
- Link energy transfer coordination
- Bootstrap state management for early game optimization
- Statistics tracking and visual debugging
- RCL upgrade handling and base plan regeneration

#### SpawnManager (`managers/SpawnManager.ts`)

Intelligent spawn queue system with priority scheduling:

```typescript
class SpawnManager {
    private spawnQueue: SpawnRequest[];
    private scheduledSpawns: ScheduledSpawn[];
    private energyForecast: EnergyForecast;
    
    run(): void {
        // Calculate energy forecast
        // Update predictive spawns
        // Process spawn queue
    }
}
```

**Responsibilities:**
- Priority-based spawn queue management with urgency flags
- Predictive spawn replacement (100-tick buffer before creep death)
- Energy forecasting to project energy availability
- Schedule conflict detection and management
- Deferred request handling for retry attempts
- Post-spawn initialization (e.g., logistics pair assignment)
- Queue sorting by priority and request age
- Role-based body composition via FUNC.determineBodyParts()

#### TrafficManager (`managers/TrafficManager.ts`)

Centralized movement coordination system:

```typescript
class TrafficManager {
    static run(): void {
        // Process all movement intents
        // Handle direct movement, swapping, and pushing
    }
}
```

**Responsibilities:**
- Process movement intents submitted by creeps (via global.TrafficIntents array)
- Direct movement when destination is clear
- Creep swapping when two creeps want to exchange positions
- Pushing blocking creeps out of the way based on priorities
- Allows creeps to move with `ignoreCreeps: true` while preventing collisions
- Priority-based intent processing

#### DefenseManager (`managers/DefenseManager.ts`)

Automated tower targeting and room defense:

```typescript
class DefenseManager {
    static run(room: Room): void {
        // Manage all towers in room
        // Target hostiles or repair structures
    }
}
```

**Responsibilities:**
- Multi-priority hostile targeting:
  1. Healer creeps first (combat medics)
  2. Military creeps with ATTACK/RANGED_ATTACK/WORK parts
  3. NPC Invaders if no player hostiles
- Creep healing when no hostiles present
- Structure repair with configurable priorities:
  - Roads (below 95% hits)
  - Critical structures (towers, spawns, extensions, containers, etc.)
  - Ramparts and walls (with configurable hit limits)
- Tower range and damage calculations

### 3. Module Layer

#### BasePlanner (`modules/BasePlanner.ts`)

Automated base layout generator:

```typescript
class BasePlanner {
    static generatePlan(room: Room, rcl: number): PlanResult {
        // Generate base layout using algorithmic placement
        // Returns placements, rclSchedule, tileUsageGrid
    }
}
```

**Responsibilities:**
- Stamp-based base layout generation:
  - 5x5 core stamp (spawns, terminal, storage, links, observer, nuker, power spawn, factory)
  - Lab stamp (10 labs in optimized configuration)
- Distance transform and flood fill algorithms for optimal placement
- RCL-aware construction scheduling (RCL1-8)
- Road network generation and optimization
- Extension placement (60 total, placed around core)
- Tower placement (6 towers)
- Memory caching with checksums for plan validation
- Regeneration on RCL changes or manual request

#### SmartNavigator (`modules/SmartNavigator.ts`)

Advanced pathfinding and navigation:

```typescript
class SmartNavigator {
    static smartMoveTo(creep: Creep, target: RoomPosition, opts?: MoveToOpts): ScreepsReturnCode {
        // Intelligent movement with unseen room handling
        // Submits intents to TrafficManager
    }
}
```

**Responsibilities:**
- Cross-room pathfinding with route caching
- Unseen room handling
- Integration with TrafficManager for collision avoidance
- Path serialization and caching

#### PlanningFunctions (`modules/PlanningFunctions.ts`)

Core algorithmic functions:

```typescript
// Distance transform from obstacles
getDistanceTransform(roomName: string, options?: DistanceTransformOptions): CostMatrix

// Find positions by pathfinding cost
getPositionsByPathCost(origin: RoomPosition, max: number): RoomPosition[]

// Minimum cut algorithm for structure placement
getMinCut(roomName: string): MinCutResult
```

### 4. Creep AI Layer (`creeps/`)

Role-specific behavior implementations (9 roles):

```typescript
export const Harvester = {
    run: (creep: Creep) => { /* ... */ },
    runremote: (creep: Creep) => { /* ... */ }
};

export const Builder = {
    run: (creep: Creep) => { /* ... */ }
};

// Additional roles: Filler, Hauler, Upgrader,
// Repairer, Defender, Reserver, Scout
```

**Responsibilities:**
- Execute role-specific behaviors
- Handle state management (working/not working)
- Submit movement intents to TrafficManager via smartMoveTo()
- Perform actions (harvest, build, repair, etc.)
- Handle rally points and disable flags
- Execute dynamic tasks assigned by RoomManager

### 5. Logistics System

Implemented through:
- `Room.registerLogisticalPairs()` - Creates pickup/dropoff pairs
- Dynamic task assignment in RoomManager (haul → fillTower → repair → build → upgrade)
- Hauler AI with path-based body sizing
- Creep task memory structure

### 6. Prototype Extensions Layer

Extends native Screeps objects with custom functionality:

**Creep Prototype** (`prototypes/creep.ts`):
- `smartMoveTo(target, opts)` - Submits movement intent to TrafficManager
- `advGet(target, pathing, resource, canTravel)` - Smart resource gathering with fallback logic
- `moveIntent` - Property tracking current movement intent

**Room Prototype** (`prototypes/room.ts`):
- `cacheObjects()` - Scans and caches sources, minerals, deposits, controller, structures
- `initRoom()` - Initializes room memory structures
- `initOutpost(roomName)` - Initializes remote room data
- `initQuotas()` - Sets up creep quotas
- `initFlags()` - Initializes room flags
- `registerLogisticalPairs()` - Creates pickup/dropoff pairs
- `updateSourceAssignment(roomToUpdate, updateObject)` - Updates remote source assignments
- `setQuota(roleTarget, newTarget)` - Sets creep role quotas
- `getSourcePositions(sourceID)` - Finds walkable positions around sources
- `toggleBasePlannerVisuals()` - Toggles visualization flags
- `link()` - Creates clickable room link for console
- `manager` - Readonly accessor for RoomManager instance

**Spawn Prototype** (`prototypes/spawn.ts`):
- `determineBodyParts(role, cap)` - Calculates optimal body composition

**RoomPosition Prototype** (`prototypes/roomPos.ts`):
- `getWalkablePositions()` - Returns walkable positions around a tile

### 7. Utility Layer (FUNC Namespace)

All utility functions are exported via the `FUNC` global namespace for organized access.

#### Core Utilities (`functions/utils/`)
- `splitRoomName(roomName)` - Parse room coordinates
- `roomExitsTo(roomName, direction)` - Get adjacent room names
- `calcPath/calcPathLength()` - Pathfinding wrappers
- `asRoomPosition()` - Coerce to RoomPosition
- `log(msg, room)` - Logging with room context
- `createRoomFlag(room)` - Flag creation
- `validateRoomName()` - Room name validation
- `randomInt/randomColor/randomColorAsInt()` - Random utilities
- `initGlobal(override)` - Global initialization
- `calcBodyCost()` - Body composition cost calculation
- `capitalize()` - String utilities

#### Creep Functions (`functions/creep/`)
- `determineBodyParts(role, maxEnergy, room)` - Calculates optimal body composition per role
- `creepCleanup(roleCounts)` - Removes memory of dead creeps
- Various creep utilities

#### Room Functions (`functions/room/`)
- Room analysis and operations
- Terrain manipulation
- Routing utilities
- Object finding

#### Structure Functions (`functions/structure/`)
- Structure utilities and management
- Active structure operations
- Controller utilities
- Tower management

#### Position Functions (`functions/position/`)
- Position utilities and matrix operations
- WorldPosition class for advanced position handling
- Matrix utilities:
  - `distanceTransform()` - Distance field generation
  - Matrix operations and transformations

#### Memory Functions (`functions/memory/`)
- Global and room memory management
- Memory constants and codecs
- Base32768 encoding/decoding for memory compression

#### Cache Functions (`functions/cache/`)
- Caching utilities for room objects
- Performance optimization helpers

#### CPU Functions (`functions/cpu/`)
- CPU profiling and monitoring
- `adjustedCpuLimit()` - Dynamic CPU limit adjustment

#### Visual Functions (`functions/visual/`)
- `buildProgress()` - Construction progress bars
- `repairProgress()` - Repair progress indicators
- `drawStructureVisual()` - Structure rendering
- `drawRoadsVisual()` - Road visualization
- `drawResourceVisual()` - Resource rendering
- Console output utilities

## Data Flow

```
┌─────────────────────────────────────────┐
│           Main Loop (main.ts)           │
│  1. Init global settings                │
│  2. Cleanup dead creep memory           │
│  3. Execute all creep AI                │
│  4. Resolve TrafficManager intents      │
│  5. Process all rooms                   │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴────────┐
       │                │
  ┌────▼─────┐    ┌─────▼──────────┐
  │  Creep   │    │  RoomManager   │
  │   AI     │    │  (per room)    │
  │          │    └────────┬───────┘
  │  Submit  │             │
  │Movement  │    ┌────────┼────────────────┐
  │ Intents  │    │        │                │
  └────┬─────┘    │        │                │
       │     ┌────▼────┐ ┌─▼─────────┐ ┌────▼────────┐
       │     │  Spawn  │ │  Defense  │ │BasePlanner  │
       │     │ Manager │ │  Manager  │ │   Module    │
       │     └─────────┘ └───────────┘ └─────────────┘
       │
  ┌────▼──────────┐
  │   Traffic     │
  │   Manager     │
  │ (collision    │
  │  resolution)  │
  └───────────────┘
```

## Memory Structure

The bot uses a structured memory hierarchy:

```typescript
Memory {
    globalSettings: GlobalSettings,
    globalData: {
        numColonies: number,
        onBirthInitComplete: boolean,
        // ... other cross-room data
    },
    stats: { [key: string]: number | string },
    time: {
        lastTickTime?: number,
        lastTickMillis?: number,
        tickTimeCount?: number,
        tickTimeTotal?: number
    },
    rooms: {
        [roomName]: {
            objects: { /* cached structure/resource IDs by type */ },
            containers: {
                sourceOne: Id<StructureContainer>,
                sourceTwo: Id<StructureContainer>,
                mineral: Id<StructureContainer>,
                controller: Id<StructureContainer>
            },
            data: {
                controllerLevel: number,
                advSpawnSystem: boolean,
                basePlanGenerated: boolean,
                bootstrap: boolean,
                cacheNeedsUpdate: boolean,
                // ... other runtime data
            },
            basePlan: {
                rcl: number,
                placements: StructurePlacement[],
                rclSchedule: RCLSchedule,
                generatedAt: number,
                checksum: string
            },
            buildQueue: {
                index: number,
                activeRCL: number
            },
            visuals: {
                visDistTrans: boolean,
                visFloodFill: boolean,
                visBasePlan: boolean
            },
            quotas: { [role: string]: number },
            spawnManager: {
                queue: SpawnRequest[],
                scheduled: ScheduledSpawn[],
                deferred: SpawnRequest[],
                lastProcessed: number
            },
            stats: ColonyStats,
            outposts: OutpostData,
            settings: RoomSettings,
            flags: RoomFlags
        }
    },
    creeps: {
        [creepName]: {
            role: string,
            RFQ: string,  // "Role For Quota"
            home: string,
            room: string,
            working: boolean,
            moveIntent: MoveIntent,
            task: CreepTask,
            // ... role-specific properties
        }
    }
}
```

## Design Patterns

### Manager Pattern
Centralized control through RoomManager and SpawnManager classes that encapsulate complex logic.

### Strategy Pattern
Role-based creep AI with interchangeable behavior implementations.

### Observer Pattern
RoomManager observes room state and triggers appropriate responses.

### Factory Pattern
Dynamic body part generation based on role and available energy.

### Prototype Pattern
Extension of native Screeps objects with custom methods.

## Performance Considerations

1. **Object Caching**: Structure IDs cached in memory to reduce `find()` calls
2. **Route Caching**: Cross-room paths cached in heap with 200-tick refresh
3. **Lazy Initialization**: Managers created only when needed
4. **Efficient Filtering**: Uses lodash for optimized collections
5. **Visual Throttling**: Progress bars only drawn when actively updating

## Bootstrap Mode

The bot includes special handling for early game (RCL 1):

```typescript
private updateBootstrapState(): void {
    const level = this.stats.controllerLevel;
    const hasContainer = this.resources.containers.length > 0;
    const creepCount = this.room.find(FIND_MY_CREEPS).length;
    
    this.room.memory.flags.bootstrap = 
        (level === 1 && creepCount < 5 && !hasContainer);
}
```

In bootstrap mode:
- Harvesters deliver energy directly to spawns
- Body parts optimized for immediate needs
- Container construction prioritized

## Extension Points

The architecture supports easy extension:

1. **New Creep Roles**: Add to `creeps.ts` and update main loop dispatch
2. **New Managers**: Create class implementing `run()` method
3. **New Prototype Methods**: Add to appropriate prototype file
4. **New Infrastructure**: Extend RoomManager planning methods
5. **New Statistics**: Add to `ColonyStats` interface