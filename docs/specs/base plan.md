# Base Planning Logic

This document outlines the advanced algorithms that will be required to be used in developing and implementing a completely automated structured base layout from the beginning. This will

## Process Steps

### 1. Distance Transform
- Use distance transform algorithm to identify open spaces
- Target positions with distance ≥ 3 (needs 5x5 square)
- Functions located in `./src/modules/RoomPlanner.ts`

### 2. Starting Position Selection
- Choose optimal open area for base
- Prioritize proximity to:
	- Controller
	- Energy sources
- Maintain flexibility when needed

### 3. Core Structure Placement
- Place initial structures:
	- Spawn
	- Storage
	- Terminal
- Use 5x5 stamp around starting position
- Implement "fast filler" stamp for extensions

### 4. Controller Upgrade Area
- Allocate 3x3 area near core structures
- Requirements:
	- All positions within range 3 of controller
	- Initial drop container placement
	- Later upgraded to link
	- Used by upgrader creeps

### 5. Floodfill Implementation
- Apply floodfill algorithm for tile accessibility
- Lower numbers indicate core structure proximity
- Reference `./src/modules/RoomPlanner.ts`

### 6. Tile Allocation
- Assign spaces for:
	- Extensions
	- Labs
	- Towers
	- Factory
	- Nuker
	- Observer
- Implement grid layout (similar to "commie bot")

### 7. Lab Positioning
- Identify 10 suitable tiles
- Ensure two "source" labs accessible within range 2
- Optional: Use predefined lab stamp

### 8. Infrastructure Setup
- Create roads connecting:
	- Storage to energy sources
	- Storage to minerals
- Place at each source:
	- Container
	- Link
- Place at mineral:
	- Container
	- Extractor

### 9. Rampart Optimization
- Use minimum cut algorithm
- Connect ramparts with roads
- Reference RoomPlanner.ts for implementation

### 10. Tower Placement
- Maximize coverage area
- Prioritize minimum damage over base boundaries

### 11. Additional Structure Placement
- Position remaining structures:
	- Factory
	- Nuker
	- Observer
	- Extensions

## RCL-Specific Structure Planning
Include build order information for:
- Extensions
- Links
- Labs
- Spawns
- Towers
- Other RCL-dependent structures

## Room Visualization Options
A powerful visualization layer that takes the planner from “functional” to “developer-friendly.” and provides a flexible Room Planning Visualizer which works seamlessly with the existing RoomManager and uses RoomVisual to render three types of overlays.
- Colorized distance map showing terrain openness.
- Flood fill heatmap showing accessibility zones.
- Final layout visualization with intuitive shapes and colors.
- All toggled individually via Room Memory, without CPU waste when disabled.
## References
- [Base Planning Guide](https://sy-harabi.github.io/Automating-base-planning-in-screeps/)
- [Example Layouts](https://i.imgur.com/UUhs8PT.png)
