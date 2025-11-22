# BasePlanner Module

The `BasePlanner` module provides automated base layout generation using algorithmic placement techniques. It generates complete RCL1-8 base plans with optimal structure positioning using distance transforms and flood fill algorithms.

## Module Overview

**Location:** [src/modules/BasePlanner.ts](src/modules/BasePlanner.ts)

**Purpose:**
- Generate complete base layouts automatically
- Use stamp-based designs for core structures
- Optimize placement using distance transforms and flood fill
- Create RCL-aware construction schedules
- Cache plans in memory for performance

## Core Function

### `generatePlan(room: Room, rcl: number): PlanResult`

Generates a complete base plan for the specified room and RCL.

**Parameters:**
- `room: Room` - The room to generate a plan for
- `rcl: number` - The Room Controller Level (1-8)

**Returns:** `PlanResult`
```typescript
interface PlanResult {
    placements: StructurePlacement[];  // All structure placements
    rclSchedule: RCLSchedule;          // When to build each structure
    tileUsageGrid: number[][];         // 2D array tracking tile usage
    rcl: number;                       // RCL this plan was generated for
    generatedAt: number;               // Game.time of generation
    checksum: string;                  // Validation checksum
}
```

**Example:**
```typescript
const plan = BasePlanner.generatePlan(room, room.controller.level);
room.memory.basePlan = plan;
```

## Structure Placement Types

### Core Stamp (5x5)

The core stamp contains the central structures:
- **Spawns** (3 total, RCL 1, 7, 8)
- **Terminal** (1, RCL 6)
- **Storage** (1, RCL 4)
- **Links** (2 in core, RCL 5-6)
- **Observer** (1, RCL 8)
- **Nuker** (1, RCL 8)
- **Power Spawn** (1, RCL 8)
- **Factory** (1, RCL 7)

**Placement:**
- Located at optimal position using distance transform
- Centered in room away from exits and obstacles
- Surrounded by roads for efficient access

### Lab Stamp

Optimized lab layout for 10 labs:
- Compact configuration for boost production
- Efficient reagent transfer paths
- Integrated with core via roads

### Extensions

60 total extensions placed around the core:
- RCL 2: 5 extensions
- RCL 3: 10 extensions
- RCL 4: 20 extensions
- RCL 5: 30 extensions
- RCL 6: 40 extensions
- RCL 7: 50 extensions
- RCL 8: 60 extensions

**Placement Strategy:**
- Clustered around core stamp for efficient filling
- Uses flood fill algorithm to find optimal positions
- Spaced to allow road access

### Towers

6 towers distributed for coverage:
- RCL 3: 1 tower
- RCL 5: 2 towers
- RCL 7: 3 towers
- RCL 8: 6 towers

**Placement Strategy:**
- Positioned for maximum room coverage
- Near core for energy access
- Strategic defensive positions

### Roads

Comprehensive road network:
- Connecting core stamp to all major structures
- Paths to sources, controller, and mineral
- Optimized using pathfinding algorithms
- Minimize road count while maximizing coverage

### Containers

Automatic container placement:
- Source containers (1 per source, RCL 1+)
- Controller container (1, RCL 2+)
- Mineral container (1, RCL 6+)

## Algorithmic Techniques

### Distance Transform

Generates a distance field from obstacles (walls, exits).

**Purpose:**
- Find positions furthest from walls and exits
- Identify optimal core stamp location
- Maximize defensibility

**Implementation:**
```typescript
const distTransform = getDistanceTransform(room.name, {
    visual: room.memory.visuals?.visDistTrans
});
```

**Output:** CostMatrix where each tile's value represents distance to nearest obstacle.

### Flood Fill

Finds connected positions radiating from an origin.

**Purpose:**
- Place extensions around core
- Find positions for distributed structures
- Ensure accessibility

**Implementation:**
```typescript
const positions = getPositionsByPathCost(originPos, maxDistance);
```

**Output:** Array of RoomPosition sorted by pathfinding cost from origin.

### Minimum Cut (Min-Cut)

Calculates optimal defensive wall placement.

**Purpose:**
- Identify critical defensive positions
- Minimize wall count while maximizing protection
- Create chokepoints

**Implementation:**
```typescript
const minCut = getMinCut(room.name);
```

## RCL Schedule

The plan includes an RCL schedule that maps when to build each structure:

```typescript
interface RCLSchedule {
    [rcl: number]: {
        [structureType: string]: StructurePlacement[]
    }
}
```

**Example:**
```typescript
rclSchedule[1] = {
    spawn: [/* first spawn placement */],
    container: [/* source containers */]
};

rclSchedule[2] = {
    extension: [/* first 5 extensions */],
    container: [/* controller container */]
};
```

## Memory Caching

Base plans are cached in room memory for performance:

```typescript
interface BasePlanMemory {
    rcl: number;                      // RCL plan is for
    placements: StructurePlacement[]; // All structure placements
    rclSchedule: RCLSchedule;         // Build schedule
    generatedAt: number;              // Game.time of generation
    checksum: string;                 // Validation checksum
}
```

**Cache Invalidation:**
- RCL change triggers regeneration
- Manual deletion via `delete room.memory.basePlan`
- Checksum mismatch

## Visualization

The BasePlanner integrates with PlanVisualizer for debugging:

### Visual Modes

Toggle via room memory flags:
```typescript
room.memory.visuals.visDistTrans = true;  // Distance transform heatmap
room.memory.visuals.visFloodFill = true;  // Flood fill visualization
room.memory.visuals.visBasePlan = true;   // Base plan structures
```

**Or use convenience method:**
```typescript
room.toggleBasePlannerVisuals();
```

### Visual Output

**Distance Transform:**
- Blue → Green gradient
- Darker = closer to obstacles
- Brighter = further from obstacles

**Flood Fill:**
- Red → Green gradient
- Shows position cost from origin
- Helps visualize extension placement

**Base Plan:**
- Structure shapes with labels
- Color-coded by type
- Shows planned positions before construction

## Integration with RoomManager

RoomManager handles base plan execution:

### Plan Generation

```typescript
// In RoomManager.run()
if (!room.memory.basePlan || room.memory.basePlan.rcl !== rcl) {
    const plan = BasePlanner.generatePlan(room, rcl);
    room.memory.basePlan = plan;
    room.memory.buildQueue = { index: 0, activeRCL: rcl };
}
```

### Construction Queue Processing

```typescript
// Process build queue (limited by CPU bucket)
const maxSitesThisTick = Game.cpu.bucket > 5000 ? 5 :
                          Game.cpu.bucket > 2000 ? 3 : 1;

for (let i = 0; i < maxSitesThisTick; i++) {
    const placement = plan.placements[buildQueue.index];
    if (!placement) break;

    room.createConstructionSite(
        placement.x,
        placement.y,
        placement.structureType
    );

    buildQueue.index++;
}
```

## Usage Examples

### Basic Usage

```typescript
// Generate plan for current RCL
const plan = BasePlanner.generatePlan(room, room.controller.level);

// Cache in memory
room.memory.basePlan = plan;

// Access placements
console.log(`Total structures: ${plan.placements.length}`);
console.log(`RCL schedule:`, JSON.stringify(plan.rclSchedule));
```

### Force Regeneration

```typescript
// Delete cached plan to force regeneration
delete room.memory.basePlan;

// Next tick, RoomManager will regenerate
```

### Enable Visualization

```typescript
// Toggle all visualizations
room.memory.visuals.visDistTrans = true;
room.memory.visuals.visFloodFill = true;
room.memory.visuals.visBasePlan = true;

// Or use convenience method
room.toggleBasePlannerVisuals();
```

### Access RCL Schedule

```typescript
const plan = room.memory.basePlan;

// Get structures to build at RCL 5
const rcl5Structures = plan.rclSchedule[5];

console.log(`RCL 5 Extensions: ${rcl5Structures.extension?.length || 0}`);
console.log(`RCL 5 Towers: ${rcl5Structures.tower?.length || 0}`);
```

### Manual Plan Execution

```typescript
const plan = room.memory.basePlan;

// Get next structure to build
const nextPlacement = plan.placements[room.memory.buildQueue.index];

if (nextPlacement) {
    room.createConstructionSite(
        nextPlacement.x,
        nextPlacement.y,
        nextPlacement.structureType
    );

    room.memory.buildQueue.index++;
}
```

## Console Commands

### Regenerate Base Plan

```typescript
// Force regeneration
Game.rooms['E25N25'].memory.basePlan = undefined;

// Or use RoomManager method
global.roomManagers['E25N25'].regenerateBasePlan();
```

### Toggle Visuals

```typescript
// Toggle all visuals
Game.rooms['E25N25'].toggleBasePlannerVisuals();

// Toggle specific visual
Game.rooms['E25N25'].memory.visuals.visBasePlan = true;
```

### Inspect Plan

```typescript
const plan = Game.rooms['E25N25'].memory.basePlan;

// Count structures by type
const counts = {};
plan.placements.forEach(p => {
    counts[p.structureType] = (counts[p.structureType] || 0) + 1;
});

console.log(JSON.stringify(counts, null, 2));
```

## Performance Considerations

1. **Plan Caching**: Plans are cached in memory to avoid regeneration every tick
2. **Checksum Validation**: Ensures plan integrity without full regeneration
3. **Throttled Construction**: CPU bucket-based limits prevent excessive construction site creation
4. **Algorithmic Efficiency**: Distance transform and flood fill are optimized for performance
5. **Visual Throttling**: Visualizations only drawn when flags are enabled

## Best Practices

### When to Regenerate

Only regenerate plans when:
- RCL changes
- Room layout significantly changes (rare)
- Manual request for optimization

**Don't** regenerate every tick - use cached plans.

### Handling Obstacles

BasePlanner automatically handles:
- Existing structures (keeps them in place)
- Source keeper lairs
- Natural walls
- Exit tiles (avoids placing near exits)

### Construction Site Limits

Game limit: 100 construction sites across all rooms.

**Strategy:**
- Process build queue gradually
- Throttle based on CPU bucket
- Prioritize critical structures (spawns, towers)

### Visual Debugging

Use visuals during development:
- Verify stamp placement
- Check extension distribution
- Validate road networks

Disable in production for performance.

## Related Documentation

- [RoomManager](RoomManagerAPI.md) - Executes base plans
- [PlanningFunctions](PlanningFunctions.md) - Core algorithms
- [PlanVisualizer](PlanVisualizer.md) - Visualization system
- [System Architecture](SystemArchitecture.md) - Overall design

## Troubleshooting

### Plan Not Generating

**Symptoms:** `room.memory.basePlan` is undefined

**Solutions:**
1. Check RoomManager is running for the room
2. Verify room is owned (has controller)
3. Check for errors in console

### Structures Not Building

**Symptoms:** Plan exists but no construction sites

**Solutions:**
1. Check construction site limit (100 max)
2. Verify CPU bucket is sufficient
3. Check `room.memory.buildQueue.index`

### Visual Not Showing

**Symptoms:** Visual flags enabled but nothing renders

**Solutions:**
1. Verify flags: `room.memory.visuals.visBasePlan`
2. Check if plan exists in memory
3. Ensure room has vision

### Suboptimal Placement

**Symptoms:** Structures in bad positions

**Solutions:**
1. Regenerate plan after major room changes
2. Check for obstacles blocking optimal positions
3. Verify distance transform is calculating correctly
