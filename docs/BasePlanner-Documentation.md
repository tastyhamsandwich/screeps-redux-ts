# BasePlanner Class Documentation

## Overview

The **BasePlanner** class is an automated base layout generator for Screeps that uses advanced algorithms to create optimized room layouts. It follows an 11-step process to place all structures from RCL 1-8, incorporating algorithmic placement based on distance transforms, flood fills, and minimum cut algorithms.

**Location:** `src/modules/BasePlanner.ts`

---

## Table of Contents

1. [Main Entry Point](#main-entry-point-createplan)
2. [The 11-Step Planning Process](#the-11-step-planning-process)
3. [RCL Schedule Generation](#rcl-schedule-generation)
4. [Helper Functions](#helper-functions)
5. [Key Data Structures](#key-data-structures)
6. [Visualization](#visualization)

---

## Main Entry Point: `createPlan()`

This is the orchestrator method that executes the entire planning process.

```typescript
public createPlan(): PlanResult
```

### Process Flow
The method executes all 11 planning steps in sequence and returns a complete base plan.

### Returns: `PlanResult`
```typescript
{
  dtGrid: number[][];              // Distance transform grid (50x50)
  floodFill: number[][];           // Flood fill grid from core
  startPos: RoomPosition;          // Center point of the base
  placements: StructurePlacement[]; // All structure placements
  rclSchedule: RCLSchedule;        // RCL-specific build schedule
  ramparts: RoomPosition[];        // Rampart positions from min-cut
  controllerArea: RoomPosition[];  // Controller upgrade workspace
  timestamp: number;               // Game time when plan was generated
}
```

### Execution Order
1. Generate distance transform
2. Select starting position
3. Place core structures
4. Designate controller area
5. Generate flood fill
6. Allocate tiles
7. Position labs
8. Establish infrastructure
9. Optimize ramparts
10. Place towers
11. Place remaining structures
12. Generate RCL schedule

---

## The 11-Step Planning Process

### Step 1: `generateDistanceTransform()`

**Purpose:** Identifies open spaces in the room by calculating distance from each tile to the nearest wall.

**What It Does:**
1. Calls `getDistanceTransform()` from PlanningFunctions.ts
2. Converts the returned `CostMatrix` to a 2D array for easier access
3. Stores result in `this.dtGrid`

**Distance Transform Algorithm:**
- Two-pass algorithm to calculate minimum distance to walls
- First pass: bottom-left to top-right
- Second pass: top-right to bottom-left (refine distances)
- Result: Each tile contains its distance to nearest wall (0 = wall, higher = more open space)

**Key Function Called:** `getDistanceTransform(roomName, options)`
```typescript
function getDistanceTransform(roomName: string, options?: {
  innerPositions?: { x: number; y: number }[];
  visual?: boolean;
}): CostMatrix
```

**Inputs:**
- `roomName` - The room to analyze
- `options.innerPositions` - Optional starting positions (default: undefined)
- `options.visual` - Whether to visualize with RoomVisual (false for performance)

**Output:** `CostMatrix` where each value = distance to nearest wall/edge

---

### Step 2: `selectStartingPosition()`

**Purpose:** Finds the optimal center point for the base core.

**Positioning Strategy:**

**Case 1: Existing Spawn**
- If player has already placed a spawn, use one tile below it as center
- Aligns with core stamp design where center is between the 3 spawns

**Case 2: Algorithmic Selection**
1. Identify all positions with distance ≥ 3 from walls
2. Validate position can fit a 5x5 stamp
3. Score each position:
   - **Controller proximity:** `score += max(0, 50 - controllerDist * 2)` (heavily weighted)
   - **Source proximity:** `score += max(0, 30 - sourceDist)` for each source
   - **Edge distance:** `score += edgeDist * 2` (prefer room center)
4. Select highest scoring position

**Scoring Example:**
```
Position closer to controller (+50 points)
Each closer source (+30 points each)
Further from edges (+2 points per tile)
Result: Best connected position
```

**Inputs Used:**
- `this.dtGrid` (distance transform)
- Room controller
- Room sources

**Output:** Sets `this.startPos` to selected RoomPosition

**Helper Function: `canPlaceStamp(center, size)`**
```typescript
private canPlaceStamp(center: RoomPosition, size: number): boolean
```
- Checks 360° around center for stamp size
- Returns false if any tile is outside bounds or a wall
- Used to validate candidate positions

---

### Step 3: `placeCoreStructures()`

**Purpose:** Places the critical 5x5 core stamp containing spawns, storage, terminal, and other vital structures.

**Core Stamp Layout:**

The CORE_STAMP_5X5 template defines relative positions (dx, dy) from center:

```
[-2,-2]Lab    [-1,-2]Road   [0,-2]Road    [1,-2]Road    [2,-2]Factory
[-2,-1]Road   [-1,-1]Spawn  [0,-1]Spawn   [1,-1]Spawn   [2,-1]Road
[-2, 0]Road   [-1, 0]Term   [0, 0]EMPTY   [1, 0]Link    [2, 0]Road
[-2, 1]Road   [-1, 1]Store  [0, 1]Road    [1, 1]PwrSpn  [2, 1]Road
[-2, 2]Ext    [-1, 2]Road   [0, 2]Nuker   [1, 2]Road    [2, 2]Ext
```

**Placement Algorithm:**
1. Try different orientations:
   - 4 rotations: 0°, 90°, 180°, 270°
   - 2 mirrors: normal, horizontally flipped
2. First successful placement is used
3. Falls back to partial placement if needed

**Stamp Placement Helper: `tryPlaceStamp()`**

```typescript
private tryPlaceStamp(
  center: RoomPosition,
  stamp: StampTemplate,
  rotation: number,      // 0, 90, 180, 270
  mirror: boolean,       // true/false
  partial: boolean = false
): boolean
```

**Process:**
1. For each structure in stamp template:
   - Apply horizontal mirror: `if (mirror) dx = -dx`
   - Apply rotation: rotate (dx, dy) by angle using matrix math
   - Calculate new position: `x = center.x + rotX, y = center.y + rotY`
2. Validate each position:
   - Within bounds (1-48)
   - Not a wall
   - If invalid and not partial: return false (placement failed)
3. Create placement objects with priority:
   - Roads: priority 10
   - Other structures: structure-specific priority
4. Add all placements to `this.structurePlacements` Map
5. Return success/failure

**Output:** Populates `this.structurePlacements` Map with core structure positions

---

### Step 4: `designateControllerArea()`

**Purpose:** Finds a 3x3 workspace near the controller for upgraders to work efficiently.

**Constraints:**
- All 9 tiles must be within range 3 of controller
- All 9 tiles must be walkable (no walls)
- Prefer positions between core and controller
- Prioritize closeness to core (reduces road distance)

**Scoring Algorithm:**

For each candidate 3x3 area:
```typescript
score = 0;

// Primary: Proximity to core (higher = closer = better)
score += (20 - coreDistance) * 10;

// Secondary: Distance to controller
if (controllerDistance <= 2) {
  score += (3 - controllerDistance) * 5;
} else {
  score -= 50; // Penalty if too far
}

// Tertiary: Being on path from core to controller
const onPath = (coreToArea > 0 && coreToArea < coreToCtrllr);
if (onPath) score += 15;
```

**Search Strategy:**
- Search in expanding ranges: 6, 8, 10 tiles from core
- Stop at first good candidate (range 6 is preferred)

**Placement:**
- Container placed at center (3x3 position [4] = center)
- Metadata: `{ type: 'controller', upgradeTo: STRUCTURE_LINK }`
- Container will upgrade to link at RCL 5

**Output:**
- Sets `this.controllerUpgradeArea` array (9 positions)
- Adds container placement to map

---

### Step 5: `generateFloodFill()`

**Purpose:** Calculates path distances from core to all tiles, used for structure placement prioritization.

**What It Does:**
1. Calls `getPositionsByPathCost()` with core position as start
2. Converts result to 2D array stored in `this.floodGrid`
3. Lower values = closer to core

**Key Function Called: `getPositionsByPathCost()`**

```typescript
function getPositionsByPathCost(
  roomName: string,
  startPositions: RoomPosition[],
  options?: {
    costMatrix?: CostMatrix;
    costThreshold?: number;
    visual?: boolean;
  }
): CostMatrix
```

**Algorithm: Breadth-First Flood Fill**
1. Initialize queue with all start positions (cost = 0)
2. Mark start positions as visited in check matrix
3. While queue has items:
   - Pop first position
   - For each of 8 adjacent tiles:
     - Skip if outside bounds
     - Skip if wall
     - Skip if cost ≥ threshold (default 255)
     - Skip if already visited
     - Set cost = current cost + 1
     - Mark visited
     - Add to queue
4. Result: Every reachable tile has path distance from start

**Inputs:**
- `roomName` - Room to analyze
- `startPositions` - Array with core center position
- `options.costThreshold` - Tiles with cost ≥ this are blocked (default 255)

**Output:** `CostMatrix` with path distances from core

**Result Grid:**
- 0 = starting position
- 1-254 = path distance from core
- 255 = unreachable (wall/blocked)

---

### Step 6: `allocateTiles()`

**Purpose:** Prepares available tiles for structure placement and delegates extension placement.

**Process:**
1. Collect all available tiles:
   - Not a wall
   - Not already used (checked against `structurePlacements`)
   - Valid flood fill distance (0 < distance < 255)
2. Sort tiles by flood fill distance (closer to core first)
3. Call `allocateExtensions()` to place all 60 extensions

**Output:** Populates extension placements via `allocateExtensions()`

---

### Step 6a: `allocateExtensions(availableTiles)`

**Purpose:** Place all 60 extensions using an intelligent diagonal spine pattern.

**Algorithm Overview:**

The extension placement uses three strategies:

**1. Diagonal Spine Generation**
- Creates a weaving pattern starting from storage
- Uses 4 diagonal directions: NE, SE, SW, NW
- Maximum spine length: 40 positions
- Switches direction every 4 steps for variety

**2. Perpendicular Extension Placement**
- For each spine position, place extensions perpendicular to spine direction
- Alternates left/right sides to create weaving pattern
- Places 2-3 extensions per spine position
- Places roads on spine for creep navigation (priority 11)

**3. Fill Remaining Slots**
- Uses grid pattern with spacing of 2 tiles
- Covers areas not reached by spine
- Fills gaps for remaining extensions

**Helper Function: `generateDiagonalSpine()`**

```typescript
private generateDiagonalSpine(
  start: RoomPosition,
  spine: RoomPosition[],
  used: Set<string>
): void
```

**Process:**
1. Start at storage position
2. Move diagonally in sequence: NE → SE → SW → NW → (repeat)
3. Switch direction every 4 steps (with variety)
4. Stop at boundaries or wall
5. Track used positions

**Result:** Weaving diagonal path of ~40 positions

**Helper Function: `placePerpendicularExtensions()`**

```typescript
private placePerpendicularExtensions(
  spinePos: RoomPosition,
  prevPos: RoomPosition,
  nextPos: RoomPosition,
  side: number,        // -1 or 1
  count: number,
  used: Set<string>
): RoomPosition[]
```

**Process:**
1. Calculate spine direction vector: `(nextX - prevX, nextY - prevY)`
2. Rotate 90° for perpendicular: `perpDx = -dy, perpDy = dx`
3. Normalize perpendicular vector
4. Place extensions at distances 1, 2, 3 along perpendicular
5. Return valid positions

**Helper Function: `fillRemainingExtensions()`**

```typescript
private fillRemainingExtensions(
  availableTiles: { pos: RoomPosition; distance: number }[],
  count: number,
  used: Set<string>
): RoomPosition[]
```

**Process:**
1. Iterate through available tiles sorted by distance
2. Place extension at current position
3. For each position, add adjacent extensions at offsets:
   - (2, 0), (0, 2), (2, 2), (-2, 0), (0, -2)
   - Spacing of 2 creates distributed layout
4. Return all placed positions

**Output:**
- Returns array of 60 extension positions
- Adds placement entries for each extension
- Extensions sorted by allocation priority (RCL 2-4)

---

### Step 7: `positionLabs()`

**Purpose:** Places the 10-lab stamp for optimal chemical reaction capability.

**Lab Stamp Layout:**

```
[-1,-1]Lab(source) [0,-1]Lab [1,-1]Lab(source)
[-1, 0]Lab         [0, 0]Lab [1, 0]Lab
[-1, 1]Lab         [0, 1]Lab [1, 1]Lab
                   [0, 2]Lab
```

- **Source labs (2):** Top corners, feed reagents to others
- **Reaction labs (8):** Can be fed by source labs within range 2
- All labs within range 2 of each other for optimal reactions

**Placement Strategy:**
1. Search within 10 tiles of core
2. Check for 3x3 space without conflicts:
   - Allow roads to overlap
   - Reject other structures
3. Score by proximity to core:
   - Closer = better (proximity bonus for logistics)
4. Use stamp rotation/mirroring if needed

**Output:** Adds 10 lab placements to map

---

### Step 8: `establishInfrastructure()`

**Purpose:** Creates the road network connecting critical facilities with prioritized RCL-based construction order.

**Priority-Based Infrastructure:**

**Priority 1 (RCL 2):** Storage to Sources
- Goal: Enable energy harvesting
- Roads to nearest walkable position around each source
- Allows haulers to collect energy efficiently

**Priority 2 (RCL 3):** Storage to Controller
- Goal: Enable controller upgrades
- Roads to center of 3x3 controller area
- Critical for RCL progression

**Priority 3 (RCL 6):** Storage to Mineral
- Goal: Enable mineral extraction
- Places container at mineral position
- Places extractor on mineral
- Roads to mineral container

**Helper Function: `createRoadPathWithPriority()`**

```typescript
private createRoadPathWithPriority(
  from: RoomPosition,
  to: RoomPosition,
  rclPriority: number  // Which RCL level these roads should be built at
): void
```

**Process:**
1. Calculate path from `from` to `to`:
   - Uses `findPathTo()` with ignoreCreeps and ignoreRoads
   - Swamp cost: 2, Plain cost: 2 (equal weighting)
2. For each tile in path:
   - Map RCL to priority value:
     - RCL 1-2 → priority 9 (highest priority)
     - RCL 3-4 → priority 11
     - RCL 5-6 → priority 12
   - Add road placement with metadata `{ minRCL: rclPriority }`

**Output:** Road placements with RCL-based metadata for construction scheduling

---

### Step 9: `optimizeRamparts()`

**Purpose:** Uses minimum cut algorithm to find optimal defensive rampart positions.

**Defensive Strategy:**
- Protect spawns (energy generation)
- Protect storage (resource cache)
- Protect controller (progression)

**Positions Protected:**
1. All 3 spawns from core stamp
2. Storage location
3. Controller (if exists)

**Key Function Called: `getMinCut()`**

```typescript
function getMinCut(
  roomName: string,
  sources: RoomPosition[],    // Positions to protect
  costMatrix?: CostMatrix     // Optional cost matrix
): RoomPosition[] | number
```

**Algorithm: Max-Flow Min-Cut (Ford-Fulkerson Method)**

This algorithm finds the minimum number of tiles that must be ramparted to separate protected areas from room exits.

**Setup Phase:**
1. Find all exit tiles (room edges)
2. Mark tiles near exits (within 2 range)
3. Validate sources aren't already at exits
4. Build capacity graph with inside/outside edges

**Graph Structure:**
- Nodes: Each tile is split into 2 nodes (inside/outside)
- Edges:
  - Inside edge: represents tile defense (capacity = terrain cost)
  - Outside edges: connections between tiles (capacity = 10000)

**Flow Algorithm:**
1. Initialize all source vertices (set level 0)
2. While flow exists:
   - **BFS Phase** (`getLevels`):
     - Build level graph from sources toward exits
     - If no path to exits: minimum cut found
     - Return cut positions
   - **DFS Phase** (`getBlockingFlow`, `getDFS`):
     - Find augmenting paths using DFS
     - Reduce capacities along path (capacity -= flow)
     - Increase reverse capacities (backflow)

**Helper Functions:**

```typescript
function getLevels(
  sourceVertices: Set<number>,
  exit: Uint8Array,
  capacityMap: Int32Array,
  roomName: string
): { levels: Int16Array; cuts: RoomPosition[]; ... }
```
- BFS to assign level to each node based on distance from sources
- Returns cut positions when sources disconnected from exits

```typescript
function getBlockingFlow(
  sourceVertices: Set<number>,
  exit: Uint8Array,
  capacityMap: Int32Array,
  levels: Int16Array
): void
```
- Uses DFS to find augmenting paths level-by-level

```typescript
function getDFS(
  nodeNow: number,
  exit: Uint8Array,
  capacityMap: Int32Array,
  levels: Int16Array,
  maxFlow: number,
  checkIndex: Uint8Array
): number
```
- Finds single augmenting path with DFS

**Output:** Array of `RoomPosition` forming minimal rampart perimeter

**Rampart Placement:**
1. Place rampart structures at cut positions
2. Also place roads on ramparts for mobility

---

### Step 10: `placeTowers()`

**Purpose:** Positions 6 towers (RCL 8 maximum) for optimal coverage.

**Placement Constraints:**
- Minimum 5 tiles from core (avoid core interference)
- Can't overlap existing structures
- Can't be on walls

**Scoring Algorithm:**

For each candidate position:

```typescript
score = 0;

// Rampart coverage (highest priority)
for (const rampart of this.ramparts) {
  const range = pos.getRangeTo(rampart);
  if (range <= 20) {
    score += (20 - range) * 2;  // Towers have 20 range
  }
}

// Core structure protection (secondary)
score += max(0, 25 - coreDistance);

// Storage accessibility (refilling)
const storageRange = pos.getRangeTo(storage);
score += max(0, 10 - storageRange);

// Penalty for blocking main paths
const dx = |pos.x - core.x|;
const dy = |pos.y - core.y|;
if (dx === 0 || dy === 0) {
  score -= 5;  // Don't place on cardinal axes
}
```

**Placement:**
1. Score all valid positions
2. Sort by score (highest first)
3. Place top 6 positions

**Output:** 6 tower placements positioned for coverage

---

### Step 11: `placeRemainingStructures()`

**Purpose:** Places miscellaneous structures (observer, additional spawns, additional links).

**Structures Placed:**

1. **Observer (1 total)**
   - Placed within 15 tiles of core
   - Used for scouting remote rooms

2. **Additional Spawns**
   - Core stamp provides 3 spawns
   - Additional spawns placed if count < 3 (failsafe)

3. **Additional Links (total 6)**
   - Core provides 1 link
   - Controller upgrade provides 1 link (RCL 5)
   - Source upgrades provide 2 links (RCL 6)
   - Remaining slots filled near core

**Helper Function: `placeStructureNearCore()`**

```typescript
private placeStructureNearCore(
  structure: StructureConstant,
  maxRange: number
): void
```

**Process:**
1. Search in expanding rings from core
2. For each ring distance 3 to maxRange:
   - Check only perimeter positions (efficiency)
   - Skip walls and existing structures
   - Place at first available position
   - Return immediately after placing

---

## RCL Schedule Generation

### Main Function: `generateRCLSchedule()`

**Purpose:** Organizes all placements into RCL-appropriate build order.

**Returns:** `RCLSchedule` object
```typescript
{
  1: StructurePlacement[],
  2: StructurePlacement[],
  // ...
  8: StructurePlacement[]
}
```

**Algorithm:**

1. **Group by Type:**
   - Create Map<StructureConstant, StructurePlacement[]>
   - All placements of same type grouped

2. **Sort by Priority:**
   - Within each type, sort by placement priority (lower = build first)

3. **Assign to RCL Levels:**
   ```typescript
   for each structure type:
     get limits array from STRUCTURE_LIMITS
     sort placements by priority

     for each placement:
       get minRCL from metadata (default 1)
       for rcl = minRCL to 8:
         if assignedCount[rcl] < limit[rcl]:
           add placement to schedule[rcl]
           increment assignedCount[rcl..8]
           break (placed)
   ```

4. **Special Container Handling:**
   - Containers marked with `upgradeTo` metadata handled specially
   - Container placed at early RCL
   - Upgrade structure placed at appropriate RCL
   - Examples:
     - Controller container → link at RCL 5
     - Source containers → links at RCL 6
     - Storage container → storage at RCL 4

### Helper Function: `handleContainerUpgrades()`

```typescript
private handleContainerUpgrades(schedule: RCLSchedule): void
```

**Process:**
1. Find all containers with `upgradeTo` metadata
2. Add container to RCL 1
3. Add upgrade structure to appropriate RCL:
   - STRUCTURE_LINK: RCL 5 or 6
   - STRUCTURE_STORAGE: RCL 4
4. Check structure limits before adding

**Output:** Updated schedule with container upgrades properly sequenced

---

## Helper Functions

### Position Helpers

**`getPlacementByType(type)`**
```typescript
private getPlacementByType(type: StructureConstant): StructurePlacement | null
```
- Searches `structurePlacements` Map
- Returns first placement matching structure type
- Returns null if not found

**`findNearestOpenPosition(target, range)`**
```typescript
private findNearestOpenPosition(
  target: RoomPosition,
  range: number
): RoomPosition | null
```
- Finds all open tiles within range of target
- Filters out walls and existing placements
- Sorts by distance to target
- Returns closest position or null

**`canPlaceStamp(center, size)`**
- Validates stamp can fit at position
- Checks all tiles within size radius
- Returns false if any tile is wall or out of bounds

### Priority Helpers

**`getStructurePriority(structure)`**
```typescript
private getStructurePriority(structure: StructureConstant): number
```

Returns priority value (0 = highest priority):
- **Priority 0:** SPAWN, STORAGE
- **Priority 1:** CONTAINER
- **Priority 2:** EXTENSION, TOWER
- **Priority 3:** LINK, TERMINAL
- **Priority 4:** LAB
- **Priority 5:** EXTRACTOR
- **Priority 6:** FACTORY, POWER_SPAWN
- **Priority 7:** NUKER, OBSERVER
- **Priority 8:** RAMPART
- **Priority 10:** ROAD (lowest)

---

## Key Data Structures

### `StructurePlacement`
```typescript
interface StructurePlacement {
  pos: { x: number; y: number };      // Tile position
  structure: StructureConstant;       // Type (STRUCTURE_SPAWN, etc.)
  priority: number;                   // Build priority (0-10)
  meta?: {
    type?: string;                    // e.g., "controller", "mineral"
    minRCL?: number;                  // Minimum RCL to build this
    upgradeTo?: StructureConstant;    // Container upgrade target
  }
}
```

### `StampTemplate`
```typescript
interface StampTemplate {
  size: number;                       // 3, 5, etc.
  structures: {
    dx: number;                       // Relative x from center
    dy: number;                       // Relative y from center
    structure: StructureConstant;
    meta?: any;
  }[];
}
```

### `RCLSchedule`
```typescript
interface RCLSchedule {
  [rcl: number]: StructurePlacement[];  // Key 1-8
}
```

### `STRUCTURE_LIMITS`
```typescript
const STRUCTURE_LIMITS: {
  [STRUCTURE_SPAWN]: [0, 1, 1, 1, 1, 1, 1, 2, 3],
  [STRUCTURE_EXTENSION]: [0, 0, 5, 10, 20, 30, 40, 50, 60],
  [STRUCTURE_ROAD]: [0, 0, 0, 2500, 2500, 2500, 2500, 2500, 2500],
  // ... (per structure type)
}
```

Maps structure type to array of limits per RCL (index 0-8).

---

## Visualization

### Master Control: `drawPlanningVisuals()`

```typescript
private drawPlanningVisuals(): void
```

Checks `room.memory.visuals` flags and calls appropriate visualization functions:
- `visDistTrans` - Shows distance transform
- `visFloodFill` - Shows flood fill
- `visBasePlan` - Shows base layout

### Visualization Functions

**`drawDistanceTransform(visual)`**
- Colors each tile by distance (green = far, red = close to wall)
- Shows numeric values for distance ≥ 3
- Opacity: 0.3

**`drawFloodFill(visual)`**
- Colors by flood fill cost (blue = close to core, red = far)
- Shows numeric values for cost ≤ 10
- Opacity: 0.25

**`drawBaseLayout(visual)`**
- Draws circles for each structure (color by type)
- Shows structure symbol (S=spawn, E=extension, etc.)
- Highlights controller area in yellow
- Outlines ramparts in green
- Opacity: 0.5 for main structures

**`getStructureColor(structure)`**
- Returns color string for visualization
- Examples: SPAWN=#00f (blue), EXTENSION=#ff0 (yellow)

**`getStructureSymbol(structure)`**
- Returns single character or abbreviation
- S=spawn, E=extension, T=tower, Lab=lab, etc.

---

## Utility Export: `computePlanChecksum(plan)`

```typescript
export function computePlanChecksum(plan: PlanResult): string
```

**Purpose:** Creates a hash to detect plan changes.

**Algorithm:**
1. Stringify the placements array
2. Simple hash function:
   ```typescript
   hash = ((hash << 5) - hash) + charCode;  // For each character
   hash = hash & hash;  // Convert to 32-bit
   ```
3. Convert to hex string

**Returns:** Hex string like "1a2b3c4d"

**Use Case:** Stored in `room.memory.basePlan.checksum` to detect if base layout has changed during gameplay.

---

## Planning Functions (PlanningFunctions.ts)

### `getDistanceTransform(roomName, options)`

**Two-Pass Distance Transform Algorithm**

This computes the distance from each walkable tile to the nearest wall using a mathematical approach.

**Pass 1 (Bottom-Left to Top-Right):**
- For each position (x, y):
  - Look at neighbors: (-1,0), (0,-1), (-1,-1), (-1,+1)
  - Compute minimum: min(neighbor.distance + 1, current.distance)

**Pass 2 (Top-Right to Bottom-Left):**
- For each position (x, y):
  - Look at neighbors: (+1,0), (0,+1), (+1,+1), (+1,-1)
  - Compute minimum: min(neighbor.distance + 1, current.distance)
  - Refines distances from previous pass

**Result:** Accurate distance values for all tiles.

### `getPositionsByPathCost(roomName, startPositions, options)`

**Breadth-First Flood Fill Algorithm**

Expands from start positions, assigning path cost to each reachable tile.

**Process:**
1. Initialize queue with start positions (cost 0)
2. While queue not empty:
   - Dequeue position (current)
   - For each 8 adjacent tile:
     - If valid (walkable, in bounds, not visited):
       - Set cost = current.cost + 1
       - Enqueue
       - Mark visited
3. Result: Cost matrix showing path distance from start

### `getMinCut(roomName, sources, costMatrix)`

**Maximum Flow / Minimum Cut Algorithm**

Finds the minimum set of tiles needed to rampart to isolate sources from exits.

**Algorithm Steps:**
1. Build flow network with all tiles
2. Mark exit tiles and nearby tiles
3. Loop until flow found:
   - **Level Graph Construction (BFS):**
     - Assign levels to nodes based on distance from sources
     - If no path to exits: minimum cut found
   - **Blocking Flow Search (DFS):**
     - Find augmenting paths using DFS
     - Reduce capacities, increase back-edge capacities
     - Repeat until no more paths

**Returns:** Array of RoomPosition forming the minimum cut

---

## Key Algorithms Summary

| Algorithm | Purpose | Time Complexity |
|-----------|---------|---|
| Distance Transform | Identify open spaces | O(width × height) |
| Flood Fill (BFS) | Path cost from core | O(width × height) |
| Diagonal Spine | Extension pattern | O(max spine length) |
| Min-Cut (Max-Flow) | Find rampart positions | O(iterations × edges) |
| Scoring/Selection | Optimal placement | O(positions × criteria) |

---

## Memory Structures

Plans are cached in room memory:

```typescript
room.memory.basePlan = {
  lastGenerated: number;      // Game tick generated
  rclAtGeneration: number;    // Room RCL when generated
  checksum: string;           // Plan hash for change detection
  data: PlanResult;           // Full plan including placements
}
```

This allows the plan to be reused across ticks without regeneration.

---

## Example: Base Generation Flow

```
Game Tick Occurs
├─ Room.createPlan() called
├─ Step 1: Generate distance transform (identify open spaces)
├─ Step 2: Select center point (core location)
├─ Step 3: Place 5x5 core stamp (spawns, storage, terminal, etc.)
├─ Step 4: Designate controller upgrade area (3x3 workspace)
├─ Step 5: Generate flood fill (distance from core)
├─ Step 6: Allocate extension positions (60 total)
├─ Step 7: Position labs (10-lab stamp)
├─ Step 8: Establish roads (prioritized by RCL)
├─ Step 9: Optimize ramparts (min-cut algorithm)
├─ Step 10: Place towers (6 total, optimal coverage)
├─ Step 11: Place remaining structures (observer, links)
└─ Generate RCL schedule (organize builds by level)
   └─ Cache plan in room.memory.basePlan
   └─ Return PlanResult to caller
```

---

## Integration with Game Loop

In [src/main.ts](src/main.ts), BasePlanner is used in RoomManager:

```typescript
// BasePlanner generates plan on demand
const basePlan = new BasePlanner(room).createPlan();

// Plan cached in room memory
room.memory.basePlan = {
  lastGenerated: Game.time,
  rclAtGeneration: room.controller.level,
  checksum: computePlanChecksum(basePlan),
  data: basePlan
};

// Later: Use plan to guide construction
const placements = basePlan.placements;
const schedule = basePlan.rclSchedule;
```

---

## Performance Notes

- **Initialization:** ~5-10ms per room (depends on terrain complexity)
- **Caching:** Plan stored in memory and reused
- **Regeneration:** Triggered on RCL upgrade or manual deletion
- **Visualization:** Optional and disabled by default for performance

---

## Further Reading

- [BasePlanner.ts](src/modules/BasePlanner.ts) - Full source code
- [PlanningFunctions.ts](src/modules/PlanningFunctions.ts) - Algorithm implementations
- [Room Prototype Extensions](src/prototypes/room.ts) - Integration points
