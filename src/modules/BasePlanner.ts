
//@  BASE PLANNER for Screeps Bot. Produces a complete RCL8 plan using:
//@ - distance transform (getDistanceTransform() from ./src/modules/PlanningFunctions.ts)
//@ - floodfill (getPositionsByPathCost() from ./src/modules/PlanningFunctions.ts)
//@ - minCut (getMinCut() from ./src/modules/PlanningFunctions.ts)
/*
 * Output: PlanResult that contains tile assignments and rclSchedule mapping structures to RCLs.
 *
 * Notes/assumptions:
 * - Uses Screeps types (Room, RoomPosition, StructureConstant, etc.)
 * - Calls getDistanceTransform(), getPositionsByPathCost() -aka flood fill-, and getMinCut() from ./PlanningFunctions.ts
 * - If a dynamic lab placement cannot be derived, a predefined lab stamp is used.
 * - Road graph construction is simple A* on walkable tiles - can be replaced with improved pathing algorithms as needed.
 */

import { getDistanceTransform, getPositionsByPathCost, getMinCut } from './PlanningFunctions';

/* -------------------------
	 Configurable constants
	 ------------------------- */
const ROOM_SIZE = 50;
const START_MIN_DIST = 3; // distance transform threshold for a 5x5 open area (distance >= 3)
const UPGRADE_SQUARE_SIZE = 3;
const CORE_STAMP_SIZE = 5; // 5x5 core stamp
const LABS_COUNT = 10;
const LAB_INPUT_RANGE = 2; // source labs must be within range 2 of other labs
const MAX_SEARCH_RADIUS = 12; // radius around controller to search for base center
const EXTENSION_GRID_GAP = 2; // gap in grid between extension clusters
const RCL_MAX = 8;
const ROADS_AVAILABLE_RCL = 3; // RCL at which roads become available

/** Core Base Planner class, initialize new instance with room name as constructor input, then call .createPlan() to output a base plan object for the room.
 * @param room The room name (as a string) to build a plan for.
 *
 * Output will contain three important properties:
 * @returns .placements - This is an array, listing structure placements for entire base plan.
 * @returns .rclSchedule - This is a mapping of what structures to build at a given RCL.
 * @returns .tileUsageGrid - This is a 50x50 grid marking what structures to build on a given tile position.
 * @example import BasePlanner from './modules/BasePlanner';
 * const room = Game.rooms['W7S11'];
 * const planner = new BasePlanner(room);
 * const plan = planner.createPlan();
	 */

export default class BasePlanner {
	room: Room;
	controllerPos: Pos;
	sources: Pos[];
	mineralPos?: Pos;
	dtGrid: number[][]; // distance transform grid
	floodGrid: number[][]; // floodfill grid
	tileUsage: TileUsage[][];
	terrainGrid: string[][]; // cached terrain data

	constructor(room: Room) {
		this.room = room;
		// store positions
		this.controllerPos = rpToPos(room.controller!.pos);
		this.sources = room.find(FIND_SOURCES).map(s => rpToPos(s.pos));
		const mineral = room.find(FIND_MINERALS)[0];
		this.mineralPos = mineral ? rpToPos(mineral.pos) : undefined;

		// initialize grids
		this.dtGrid = Array.from({ length: ROOM_SIZE }, () => Array(ROOM_SIZE).fill(0));
		this.floodGrid = Array.from({ length: ROOM_SIZE }, () => Array(ROOM_SIZE).fill(Infinity));
		this.tileUsage = Array.from({ length: ROOM_SIZE }, () => Array(ROOM_SIZE).fill('empty' as TileUsage));

		// Cache terrain data once to avoid expensive lookFor() calls in simplePath()
		this.terrainGrid = Array.from({ length: ROOM_SIZE }, (_, y) =>
			Array.from({ length: ROOM_SIZE }, (_, x) =>
				new RoomPosition(x, y, this.room.name).lookFor(LOOK_TERRAIN)[0]
			)
		);

		// Mark sources, minerals, and controller as non-buildable
		for (const source of this.sources) {
			this.tileUsage[source.y][source.x] = 'wall'; // mark as unbuildable
		}
		if (this.mineralPos) {
			this.tileUsage[this.mineralPos.y][this.mineralPos.x] = 'mineral';
		}
		// Mark controller position as blocked
		this.tileUsage[this.controllerPos.y][this.controllerPos.x] = 'wall';
	}

	/** Main Entry Point:
	 * --
	 *
	 * returns a PlanResult describing an RCL8 plan and an RCL schedule. */
	createPlan(): PlanResult {
		// 1. Distance transform -> find open tiles
		this.computeDistanceTransform();

		// 2. Choose starting position (prefer near controller and sources)
		const baseCenter = this.chooseStartPosition();

		// 3. Place core stamp (spawn / storage / terminal) around baseCenter
		const placements: StructurePlacement[] = [];
		this.placeCoreStamp(baseCenter, placements);

		// 4. Designate controller upgrade area (3x3 within range 3 of controller)
		this.placeControllerUpgradeArea(baseCenter, placements);

		// 5. Floodfill to categorize accessibility
		this.computeFloodfill(Object.values(this.tileUsage).length ? baseCenter : baseCenter);

		// 6. Allocate tiles for main structures (extensions, labs, towers, factory, nuker, observer)
		this.allocateStructureTiles(baseCenter, placements);

		// 7. Labs placement (dynamic if possible, else stamp)
		this.placeLabs(baseCenter, placements);

		// 8. Infrastructure: roads, source containers & links, mineral container/extractor
		this.placeInfrastructure(placements);

		// 9. Optimize ramparts using minCut on the walkable graph
		this.placeRampartsAndConnect(placements);

		// 10. Tower placement already done in allocation step (but reevaluate)
		// 11. Create RCL schedule mapping structures to RCLs
		const rclSchedule = this.buildRclSchedule(placements);

		// 12. Validate structure counts
		const validationNotes = this.validateStructureCounts(placements);

		// finalize tileUsage grid
		const gridCopy = copyGrid(this.tileUsage);

		return {
			roomName: this.room.name,
			baseCenter,
			placements,
			tileUsageGrid: gridCopy,
			rclSchedule,
			notes: [
				`Base center chosen near controller at ${baseCenter.x},${baseCenter.y}.`,
				`Used distance transform threshold: ${START_MIN_DIST}.`,
				`Lab count target: ${LABS_COUNT}.`,
				...validationNotes
			]
		};
	}

	/** 1: Distance Transform
	 -- */
	computeDistanceTransform() {
		// Use user-provided distanceTransform(room) which should return NxN numeric grid (0 for obstacles)
		// We'll adapt as needed; fallback to a built-in distance transform if the import fails.
		try {
			const costMatrix = getDistanceTransform(this.room.name); // returns CostMatrix
			// convert returned CostMatrix to a 2D
			const dt: number[][] = Array.from({ length: ROOM_SIZE }, (_, y) =>
				Array.from({ length: ROOM_SIZE }, (_, x) => costMatrix.get(x, y))
			);
			if (!dt || !dt.length) throw new Error('bad dt');
			this.dtGrid = dt;
		} catch (e) {
			// fallback: compute simple distance to nearest wall/obstacle
			const grid = Array.from({ length: ROOM_SIZE }, () => Array(ROOM_SIZE).fill(0));
			for (let y = 0; y < ROOM_SIZE; y++) {
				for (let x = 0; x < ROOM_SIZE; x++) {
					const pos = new RoomPosition(x, y, this.room.name);
					const obstacle =
						pos.lookFor(LOOK_TERRAIN)[0] === 'wall' || pos.lookFor(LOOK_STRUCTURES).some(s => s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART);
					grid[y][x] = obstacle ? 0 : 5; // naive
				}
			}
			this.dtGrid = grid;
		}
	}

	/** 2: Choose Starting Position
	 -- */
	chooseStartPosition(): Pos {
		// Check if an existing spawn exists (placed by player)
		const existingSpawn = this.room.find(FIND_MY_SPAWNS)[0];

		// If we have an existing spawn, center the base ONE TILE SOUTH of it
		if (existingSpawn) {
			const spawnPos = rpToPos(existingSpawn.pos);
			// Center point is one tile south (y+1) of the spawn
			const centerPos = { x: spawnPos.x, y: spawnPos.y + 1 };

			// Verify the center position is valid
			if (inBounds(centerPos.x, centerPos.y)) {
				// Mark the spawn position in tile usage
				this.tileUsage[spawnPos.y][spawnPos.x] = 'spawn';
				return centerPos;
			}

			// Fallback: if south is out of bounds, use spawn position directly
			this.tileUsage[spawnPos.y][spawnPos.x] = 'spawn';
			return spawnPos;
		}

		// No existing spawn - search for optimal position (for AI-placed colonies)
		const ctr = this.controllerPos;
		let best: { pos: Pos; score: number } | null = null;
		for (let dy = -MAX_SEARCH_RADIUS; dy <= MAX_SEARCH_RADIUS; dy++) {
			for (let dx = -MAX_SEARCH_RADIUS; dx <= MAX_SEARCH_RADIUS; dx++) {
				const x = ctr.x + dx;
				const y = ctr.y + dy;
				if (!inBounds(x, y)) continue;
				const dtVal = this.dtGrid[y][x] ?? 0;
				if (dtVal < START_MIN_DIST) continue; // not open enough
				// score: prefer proximity to controller and sources
				let score = 1000 - (Math.abs(dx) + Math.abs(dy)); // closeness to controller
				for (const s of this.sources) score -= manhattan({ x, y }, s) * 0.5; // prefer closeness to sources
				// penalize being too close to room edges
				const edgeDist = Math.min(x, y, ROOM_SIZE - 1 - x, ROOM_SIZE - 1 - y);
				score -= Math.max(0, 4 - edgeDist) * 10;
				if (!best || score > best.score) best = { pos: { x, y }, score };
			}
		}
		// fallback: controller tile itself (rare)
		if (!best) return this.controllerPos;
		return best.pos;
	}

	/** 3: Place Core 5x5 Stamp
	 -- */
	placeCoreStamp(center: Pos, placements: StructurePlacement[]) {
		// Check if an existing spawn exists (it will be one tile north of center if manually placed)
		const existingSpawn = this.room.find(FIND_MY_SPAWNS)[0];
		const hasExistingSpawn = !!existingSpawn;

		// Core stamp centered on 'center' position
		// If spawn exists, it's already marked and at position (center.x, center.y - 1)
		const half = Math.floor(CORE_STAMP_SIZE / 2);
		const originX = Math.max(0, Math.min(ROOM_SIZE - CORE_STAMP_SIZE, center.x - half));
		const originY = Math.max(0, Math.min(ROOM_SIZE - CORE_STAMP_SIZE, center.y - half));

		// Core layout pattern (5x5)
		// Row 2, col 2 (0-indexed: [1][2]) is the manually-placed spawn position
		// Center point is at row 3, col 3 (0-indexed: [2][2])
		const pattern: (StructureConstant | 'extension' | 'road' | null)[][] = [
			[STRUCTURE_LAB, 'road', 'road', 'road', STRUCTURE_FACTORY],
			['road', STRUCTURE_SPAWN, 'spawn', STRUCTURE_SPAWN, 'road'],
			['road', STRUCTURE_TERMINAL, null, STRUCTURE_LINK, 'road'],
			['road', STRUCTURE_STORAGE, 'road', STRUCTURE_POWER_SPAWN, 'road'],
			[STRUCTURE_EXTENSION, 'road', STRUCTURE_NUKER, 'road', STRUCTURE_EXTENSION]
		];

		for (let ry = 0; ry < CORE_STAMP_SIZE; ry++) {
			for (let rx = 0; rx < CORE_STAMP_SIZE; rx++) {
				const x = originX + rx;
				const y = originY + ry;
				if (!inBounds(x, y)) continue;

				const cell = pattern[ry][rx];
				if (!cell) continue;

				// Skip if this tile is already occupied (e.g., source, mineral, or existing spawn)
				if (this.tileUsage[y][x] !== 'empty') {
					// If it's the spawn cell and there's an existing spawn here, add it to placements
					if (cell === 'spawn' && hasExistingSpawn && this.tileUsage[y][x] === 'spawn') {
						placements.push({ structure: STRUCTURE_SPAWN, pos: { x, y } });
					}
					continue;
				}

				// Verify the tile is walkable
				const pos = new RoomPosition(x, y, this.room.name);
				if (pos.lookFor(LOOK_TERRAIN)[0] === 'wall') continue;

				if (cell === 'extension') {
					this.tileUsage[y][x] = 'extension';
					placements.push({ structure: STRUCTURE_EXTENSION, pos: { x, y } });
				} else if (cell === 'road') {
					this.tileUsage[y][x] = 'road';
					placements.push({ structure: 'road', pos: { x, y } });
				} else if (cell === 'spawn') {
					// Only place spawn if no existing spawn (AI placing new colony)
					if (!hasExistingSpawn) {
						this.tileUsage[y][x] = 'spawn';
						placements.push({ structure: STRUCTURE_SPAWN, pos: { x, y } });
					}
				} else if (cell === STRUCTURE_STORAGE) {
					this.tileUsage[y][x] = 'storage';
					placements.push({ structure: STRUCTURE_STORAGE, pos: { x, y } });
				} else if (cell === STRUCTURE_TERMINAL) {
					this.tileUsage[y][x] = 'terminal';
					placements.push({ structure: STRUCTURE_TERMINAL, pos: { x, y } });
				} else if (cell === STRUCTURE_LINK) {
					this.tileUsage[y][x] = 'link';
					placements.push({ structure: STRUCTURE_LINK, pos: { x, y } });
				} else if (cell === STRUCTURE_LAB) {
					this.tileUsage[y][x] = 'lab';
					placements.push({ structure: STRUCTURE_LAB, pos: { x, y } });
				} else if (cell === STRUCTURE_FACTORY) {
					this.tileUsage[y][x] = 'factory';
					placements.push({ structure: STRUCTURE_FACTORY, pos: { x, y } });
				} else if (cell === STRUCTURE_POWER_SPAWN) {
					this.tileUsage[y][x] = 'powerSpawn';
					placements.push({ structure: STRUCTURE_POWER_SPAWN, pos: { x, y } });
				} else if (cell === STRUCTURE_NUKER) {
					this.tileUsage[y][x] = 'nuker';
					placements.push({ structure: STRUCTURE_NUKER, pos: { x, y } });
				}
			}
		}
	}

	/** 4: Place 3x3 Controller Upgrade Area (Drop Container -> Link)
	 -- */
	placeControllerUpgradeArea(center: Pos, placements: StructurePlacement[]) {
		// Attempt to find a 3x3 square near the core stamp where every tile is within range 3 of controller
		// Search ring around center
		const ctr = this.controllerPos;
		const candidates: Pos[] = [];
		for (let dy = -5; dy <= 5; dy++) {
			for (let dx = -5; dx <= 5; dx++) {
				const ox = center.x + dx;
				const oy = center.y + dy;
				if (!inBounds(ox, oy)) continue;
				// 3x3 origin candidate
				const ok = (() => {
					for (let ry = 0; ry < UPGRADE_SQUARE_SIZE; ry++) {
						for (let rx = 0; rx < UPGRADE_SQUARE_SIZE; rx++) {
							const x = ox + rx;
							const y = oy + ry;
							if (!inBounds(x, y)) return false;
							if (this.dtGrid[y][x] < 1) return false; // blocking
							// must be within range 3 of controller
							const range = Math.max(Math.abs(x - ctr.x), Math.abs(y - ctr.y));
							if (range > 3) return false;
						}
					}
					return true;
				})();
				if (ok) candidates.push({ x: ox, y: oy });
			}
		}
		// choose the candidate nearest to core center
		if (candidates.length === 0) {
			// Fallback: find any walkable tile within range 3 of controller for container
			let fallbackContainer: Pos | null = null;
			for (let dy = -3; dy <= 3; dy++) {
				for (let dx = -3; dx <= 3; dx++) {
					const x = ctr.x + dx;
					const y = ctr.y + dy;
					if (!inBounds(x, y)) continue;
					const range = Math.max(Math.abs(dx), Math.abs(dy));
					if (range > 3 || range < 1) continue; // Must be within range 3 but not on controller
					if (this.tileUsage[y][x] !== 'empty') continue;
					if (this.dtGrid[y][x] < 1) continue; // Must be walkable
					// Verify it's actually walkable terrain
					const pos = new RoomPosition(x, y, this.room.name);
					if (pos.lookFor(LOOK_TERRAIN)[0] === 'wall') continue;
					fallbackContainer = { x, y };
					break;
				}
				if (fallbackContainer) break;
			}

			if (fallbackContainer) {
				this.tileUsage[fallbackContainer.y][fallbackContainer.x] = 'controllerUpgradeArea';
				placements.push({ structure: 'container', pos: fallbackContainer });
			}
			return;
		}
		candidates.sort((a, b) => manhattan(a, center) - manhattan(b, center));
		const chosen = candidates[0];
		// Mark all 3x3 tiles as upgrade area
		for (let ry = 0; ry < UPGRADE_SQUARE_SIZE; ry++) {
			for (let rx = 0; rx < UPGRADE_SQUARE_SIZE; rx++) {
				const x = chosen.x + rx;
				const y = chosen.y + ry;
				if (!inBounds(x, y)) continue;
				this.tileUsage[y][x] = 'controllerUpgradeArea';
			}
		}
		// place a container at center of the 3x3, and a link candidate location (same tile or neighboring)
		const centerTile = { x: chosen.x + 1, y: chosen.y + 1 };
		placements.push({ structure: 'container', pos: centerTile }); // early game container
		// link should be placed later when available; schedule it at higher RCL
		// Find a valid tile for the link adjacent to the container
		const linkNeighbors = [
			{ x: centerTile.x + 1, y: centerTile.y },
			{ x: centerTile.x - 1, y: centerTile.y },
			{ x: centerTile.x, y: centerTile.y + 1 },
			{ x: centerTile.x, y: centerTile.y - 1 }
		];
		for (const linkPos of linkNeighbors) {
			if (!inBounds(linkPos.x, linkPos.y)) continue;
			if (this.tileUsage[linkPos.y][linkPos.x] === 'controllerUpgradeArea' || this.tileUsage[linkPos.y][linkPos.x] === 'empty') {
				if (this.dtGrid[linkPos.y][linkPos.x] >= 1) {
					placements.push({ structure: STRUCTURE_LINK, pos: linkPos });
					break;
				}
			}
		}
	}

	/** 5: Floodfill for Accessibility
	 -- */
	computeFloodfill(seed: Pos) {
		try {
			const ff = getPositionsByPathCost(this.room.name, [seed], {}); // expects numeric grid with distances
			if (ff && ff.length) {
				this.floodGrid = ff;
				// optionally use floodGrid to weight placements
			}
		} catch (e) {
			// fallback: simple BFS from seed across walkable tiles
			const dist = Array.from({ length: ROOM_SIZE }, () => Array<number>(ROOM_SIZE).fill(Infinity));
			const queue: Pos[] = [{ x: seed.x, y: seed.y }];
			dist[seed.y][seed.x] = 0;
			while (queue.length) {
				const cur = queue.shift()!;
				const d = dist[cur.y][cur.x];
				const neighbors = [
					{ x: cur.x + 1, y: cur.y },
					{ x: cur.x - 1, y: cur.y },
					{ x: cur.x, y: cur.y + 1 },
					{ x: cur.x, y: cur.y - 1 }
				];
				for (const n of neighbors) {
					if (!inBounds(n.x, n.y)) continue;
					if (dist[n.y][n.x] <= d + 1) continue;
					const tilePos = new RoomPosition(n.x, n.y, this.room.name);
					if (tilePos.lookFor(LOOK_TERRAIN)[0] === 'wall') continue;
					dist[n.y][n.x] = d + 1;
					queue.push(n);
				}
			}
			this.floodGrid = dist;
		}
	}

	/** 6: Allocate Tiles for Essential Structures
	 -- */
	allocateStructureTiles(center: Pos, placements: StructurePlacement[]) {
		// Extensions: place in organized + shaped blocks (5 extensions per block)
		// Core stamp already has 16 extensions, so we need 44 more for a total of 60
		const extTargets = 44; // additional extensions needed (60 total - 16 from core stamp)
		const extPositions: Pos[] = [];

		// Place extension blocks in a grid pattern around the core
		// Each block is a + shape (5 extensions) with roads around it
		this.placeExtensionBlocks(center, extTargets, placements, extPositions);

		// Towers: place 3-6 towers distributed to maximize coverage
		const towerCount = 6; // RCL8
		const towerPositions = this.pickTowerPositions(center, towerCount);
		for (const t of towerPositions) {
			this.tileUsage[t.y][t.x] = 'tower';
			placements.push({ structure: STRUCTURE_TOWER, pos: t });
		}

		// Additional Spawns: place 2 more spawns (total 3 for RCL8) near the core area
		// Screeps allows 1 spawn at RCL1, 2 at RCL7, and 3 at RCL8
		const additionalSpawns = 2; // We already have 1 spawn from core stamp
		let spawnCount = 0;
		for (let r = 3; r <= 8 && spawnCount < additionalSpawns; r++) {
			for (let dy = -r; dy <= r; dy++) {
				for (let dx = -r; dx <= r; dx++) {
					if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // ring only
					const x = center.x + dx;
					const y = center.y + dy;
					if (!inBounds(x, y)) continue;
					if (this.tileUsage[y][x] !== 'empty') continue;
					if (this.dtGrid[y][x] < 2) continue; // Prefer more open areas for spawns
					// Verify walkable terrain
					const pos = new RoomPosition(x, y, this.room.name);
					if (pos.lookFor(LOOK_TERRAIN)[0] === 'wall') continue;
					// Place spawn
					this.tileUsage[y][x] = 'spawn';
					placements.push({ structure: STRUCTURE_SPAWN, pos: { x, y } });
					spawnCount++;
					if (spawnCount >= additionalSpawns) break;
				}
				if (spawnCount >= additionalSpawns) break;
			}
		}

		// Factory, Nuker, Observer: place them in less critical tiles but within base bounds
		const optionalStructures: StructureConstant[] = [STRUCTURE_FACTORY, STRUCTURE_NUKER, STRUCTURE_OBSERVER];
		const optionalNames: TileUsage[] = ['factory', 'nuker', 'observer'];
		let optIndex = 0;
		const optMaxRadius = 10;
		for (let r = 0; r <= optMaxRadius && optIndex < optionalStructures.length; r++) {
			for (let dy = -r; dy <= r; dy++) {
				for (let dx = -r; dx <= r; dx++) {
					const x = center.x + dx;
					const y = center.y + dy;
					if (!inBounds(x, y)) continue;
					if (this.tileUsage[y][x] !== 'empty') continue;
					if (this.dtGrid[y][x] < 1) continue;
					// place optional structure
					const s = optionalStructures[optIndex];
					this.tileUsage[y][x] = optionalNames[optIndex];
					placements.push({ structure: s, pos: { x, y } });
					optIndex++;
					if (optIndex >= optionalStructures.length) break;
				}
				if (optIndex >= optionalStructures.length) break;
			}
		}

		// Place extractor + container at mineral if present
		if (this.mineralPos) {
			const m = this.mineralPos;
			// Place extractor on the mineral itself
			placements.push({ structure: STRUCTURE_EXTRACTOR, pos: { x: m.x, y: m.y } });
			// find nearest open tile adjacent to mineral for container
			const neighbors = [
				{ x: m.x + 1, y: m.y },
				{ x: m.x - 1, y: m.y },
				{ x: m.x, y: m.y + 1 },
				{ x: m.x, y: m.y - 1 }
			];
			for (const n of neighbors) {
				if (!inBounds(n.x, n.y)) continue;
				if (this.tileUsage[n.y][n.x] !== 'empty') continue; // Skip if already used
				const posObj = new RoomPosition(n.x, n.y, this.room.name);
				if (posObj.lookFor(LOOK_TERRAIN)[0] === 'wall') continue;
				if (this.dtGrid[n.y][n.x] < 1) continue; // Must be walkable
				this.tileUsage[n.y][n.x] = 'container';
				placements.push({ structure: STRUCTURE_CONTAINER, pos: n }); // container
				break;
			}
		}
	}

	/** 7: Lab Placement
	 -- */
	placeLabs(center: Pos, placements: StructurePlacement[]) {
		// Try dynamic placement: a 3x4-ish stamp where two "source" labs are near a loader
		// Fallback to pre-defined stamp (common 10-lab layout)
		const labsPlaced: Pos[] = [];
		// Strategy: search for a 10-tile cluster within range ~6 of center with walkable tiles and floodGrid low values
		for (let r = 1; r <= 10 && labsPlaced.length < LABS_COUNT; r++) {
			for (let dy = -r; dy <= r; dy++) {
				for (let dx = -r; dx <= r; dx++) {
					const baseX = center.x + dx;
					const baseY = center.y + dy;
					if (!inBounds(baseX, baseY)) continue;
					// attempt to place a standard 2x5 stamp starting at this base
					const stamp: Pos[] = [];
					const stampW = 5;
					const stampH = 2;
					let ok = true;
					for (let sy = 0; sy < stampH; sy++) {
						for (let sx = 0; sx < stampW; sx++) {
							const x = baseX + sx;
							const y = baseY + sy;
							if (!inBounds(x, y)) {
								ok = false;
								break;
							}
							if (this.tileUsage[y][x] !== 'empty') {
								ok = false;
								break;
							}
							if (this.dtGrid[y][x] < 1) {
								ok = false;
								break;
							}
							stamp.push({ x, y });
						}
						if (!ok) break;
					}
					if (!ok) continue;
					// if stamp would fit, use it
					for (const p of stamp) {
						this.tileUsage[p.y][p.x] = 'lab';
						placements.push({ structure: STRUCTURE_LAB, pos: p });
						labsPlaced.push(p);
						if (labsPlaced.length >= LABS_COUNT) break;
					}
					if (labsPlaced.length >= LABS_COUNT) break;
				}
				if (labsPlaced.length >= LABS_COUNT) break;
			}
			if (labsPlaced.length >= LABS_COUNT) break;
		}

		if (labsPlaced.length < LABS_COUNT) {
			// fallback: place a canonical lab stamp near the base center manually (predefined shape)
			const fallbackStamp: Pos[] = [
				{ x: center.x + 2, y: center.y - 2 },
				{ x: center.x + 3, y: center.y - 2 },
				{ x: center.x + 1, y: center.y - 1 },
				{ x: center.x + 2, y: center.y - 1 },
				{ x: center.x + 3, y: center.y - 1 },
				{ x: center.x + 1, y: center.y },
				{ x: center.x + 2, y: center.y },
				{ x: center.x + 3, y: center.y },
				{ x: center.x + 1, y: center.y + 1 },
				{ x: center.x + 2, y: center.y + 1 }
			];
			for (const p of fallbackStamp) {
				if (!inBounds(p.x, p.y)) continue;
				if (this.tileUsage[p.y][p.x] !== 'empty') continue;
				this.tileUsage[p.y][p.x] = 'lab';
				placements.push({ structure: STRUCTURE_LAB, pos: p });
			}
		}

		// Ensure two source labs exist with the "input" role (we scheduled two labs close to a loader)
		// Mark two labs as 'link input' by scheduling them to be near the lab input loader (not encoded here)
	}

	/** 8: Infrastructure: Roads, Source Containers & Links
	 --	*/
	placeInfrastructure(placements: StructurePlacement[]) {
		// Place container + link at each energy source
		for (const s of this.sources) {
			// find tile adjacent to source for container/link
			const neighbors = this.shuffle([
				{ x: s.x + 1, y: s.y },
				{ x: s.x - 1, y: s.y },
				{ x: s.x, y: s.y + 1 },
				{ x: s.x, y: s.y - 1 }
			]);
			for (const n of neighbors) {
				if (!inBounds(n.x, n.y)) continue;
				// Skip if this tile is already used
				if (this.tileUsage[n.y][n.x] !== 'empty') continue;
				const posObj = new RoomPosition(n.x, n.y, this.room.name);
				if (posObj.lookFor(LOOK_TERRAIN)[0] === 'wall') continue;
				// Ensure minimum distance from walls (dt >= 1)
				if (this.dtGrid[n.y][n.x] < 1) continue;
				// mark container and place it
				this.tileUsage[n.y][n.x] = 'container';
				placements.push({ structure: STRUCTURE_CONTAINER, pos: n });

				// link near container but not on same tile; try to put link 1 tile outward towards controller
				const dirX = Math.sign(this.controllerPos.x - n.x) || 1;
				const dirY = Math.sign(this.controllerPos.y - n.y) || 1;
				const linkPos = { x: n.x + dirX, y: n.y + dirY };

				if (inBounds(linkPos.x, linkPos.y) &&
						this.tileUsage[linkPos.y][linkPos.x] === 'empty' &&
						this.dtGrid[linkPos.y][linkPos.x] >= 1) {
					this.tileUsage[linkPos.y][linkPos.x] = 'link';
					placements.push({ structure: STRUCTURE_LINK, pos: linkPos });
				} else {
					// try other neighbors (excluding the container position and the source)
					for (const alt of neighbors) {
						if (!inBounds(alt.x, alt.y)) continue;
						if (posEq(alt, n)) continue; // Skip container position
						if (this.tileUsage[alt.y][alt.x] === 'empty' && this.dtGrid[alt.y][alt.x] >= 1) {
							this.tileUsage[alt.y][alt.x] = 'link';
							placements.push({ structure: STRUCTURE_LINK, pos: alt });
							break;
						}
					}
				}
				break;
			}
		}

		// Get key structure positions for road network
		const spawn = placements.find(p => p.structure === STRUCTURE_SPAWN);
		const storage = placements.find(p => p.structure === STRUCTURE_STORAGE);
		const spawnPos = spawn ? spawn.pos : (storage ? storage.pos : this.controllerPos);
		const storagePos = storage ? storage.pos : spawnPos;

		// Get container positions
		const sourceContainers = placements.filter(p => p.structure === STRUCTURE_CONTAINER);
		const controllerContainer = placements.find(p =>
			p.structure === STRUCTURE_CONTAINER &&
			manhattan(p.pos, this.controllerPos) <= 3
		);

		// Helper function to place roads along a path
		const placeRoadsOnPath = (path: Pos[], skipFirst = true, skipLast = true) => {
			const startIdx = skipFirst ? 1 : 0;
			const endIdx = skipLast ? path.length - 1 : path.length;

			for (let i = startIdx; i < endIdx; i++) {
				const step = path[i];
				// Only place roads on empty tiles or upgrade existing roads
				if (this.tileUsage[step.y][step.x] !== 'empty' && this.tileUsage[step.y][step.x] !== 'road') continue;

				// Verify we're not placing on walls
				const posObj = new RoomPosition(step.x, step.y, this.room.name);
				if (posObj.lookFor(LOOK_TERRAIN)[0] === 'wall') continue;

				// Ensure tile is walkable (dt >= 1)
				if (this.dtGrid[step.y][step.x] < 1) continue;

				// Ensure we're not on a source or mineral
				let isSourceOrMineral = false;
				for (const src of this.sources) {
					if (posEq(step, src)) {
						isSourceOrMineral = true;
						break;
					}
				}
				if (this.mineralPos && posEq(step, this.mineralPos)) {
					isSourceOrMineral = true;
				}
				if (isSourceOrMineral) continue;

				if (this.tileUsage[step.y][step.x] === 'empty') {
					this.tileUsage[step.y][step.x] = 'road';
					placements.push({ structure: 'road', pos: step });
				}
			}
		};

		// 1. Roads from spawn to each source container
		for (const container of sourceContainers) {
			// Skip controller container (handled separately)
			if (controllerContainer && posEq(container.pos, controllerContainer.pos)) continue;

			const path = this.simplePath(spawnPos, container.pos);
			placeRoadsOnPath(path, true, true);
		}

		// 2. Roads from spawn to controller (via controller container if exists)
		if (controllerContainer) {
			const path = this.simplePath(spawnPos, controllerContainer.pos);
			placeRoadsOnPath(path, true, true);
		} else {
			// Direct path to controller upgrade area
			const path = this.simplePath(spawnPos, this.controllerPos);
			placeRoadsOnPath(path, true, true);
		}

		// 3. Roads from storage to source containers (for hauling efficiency)
		if (storage) {
			for (const container of sourceContainers) {
				// Skip controller container
				if (controllerContainer && posEq(container.pos, controllerContainer.pos)) continue;

				const path = this.simplePath(storagePos, container.pos);
				placeRoadsOnPath(path, true, true);
			}

			// Roads from storage to controller container
			if (controllerContainer) {
				const path = this.simplePath(storagePos, controllerContainer.pos);
				placeRoadsOnPath(path, true, true);
			}
		}

		// 4. Roads to mineral container if it exists
		if (this.mineralPos) {
			const mineralContainer = placements.find(p =>
				p.structure === STRUCTURE_CONTAINER &&
				manhattan(p.pos, this.mineralPos!) <= 2
			);
			if (mineralContainer) {
				const path = this.simplePath(storagePos, mineralContainer.pos);
				placeRoadsOnPath(path, true, true);
			}
		}

		// Extension blocks already have perimeter roads from placeExtensionBlocks()
		// No additional extension road connections needed here
	}

	/** 9: Rampart Placement Using MinCut
		 -- */
	placeRampartsAndConnect(placements: StructurePlacement[]) {
		// call user-provided minCut which returns an array of edges or tile set for the cut
		// expected signature: minCut(room, baseCenter) -> Pos[] (wall tiles for rampart)
		try {
			// Create sources array from spawn positions and storage
			const sources = placements
				.filter(p => p.structure === STRUCTURE_SPAWN || p.structure === STRUCTURE_STORAGE)
				.map(p => new RoomPosition(p.pos.x, p.pos.y, this.room.name));
			const costMatrix = new PathFinder.CostMatrix();
			const cut = getMinCut(this.room.name, sources, costMatrix); // returns array of positions to rampart
			if (Array.isArray(cut) && cut.length) {
				for (const p of cut) {
					if (!inBounds(p.x, p.y)) continue;
					if (this.tileUsage[p.y][p.x] === 'empty' || this.tileUsage[p.y][p.x] === 'road') {
						this.tileUsage[p.y][p.x] = 'rampart';
						placements.push({ structure: STRUCTURE_RAMPART, pos: p });
						// connect with roads along inner side: simple placement of road inward direction
						const inward = { x: Math.min(Math.max(1, p.x - 1), ROOM_SIZE - 2), y: Math.min(Math.max(1, p.y - 1), ROOM_SIZE - 2) };
						if (this.tileUsage[inward.y][inward.x] === 'empty') {
							this.tileUsage[inward.y][inward.x] = 'road';
							placements.push({ structure: 'road', pos: inward });
						}
					}
				}
			}
		} catch (e) {
			// fallback: simple ring-of-ramparts at radius 8 around center
			const center = this.tileUsage.reduce((best, row, y) => {
				for (let x = 0; x < row.length; x++) if (row[x] === 'spawn') return { x, y };
				return best;
			}, this.controllerPos);
			const r = 8;
			for (let a = 0; a < 360; a += 8) {
				const rad = (a * Math.PI) / 180;
				const x = Math.round(center.x + r * Math.cos(rad));
				const y = Math.round(center.y + r * Math.sin(rad));
				if (!inBounds(x, y)) continue;
				if (this.tileUsage[y][x] === 'empty') {
					this.tileUsage[y][x] = 'rampart';
					placements.push({ structure: STRUCTURE_RAMPART, pos: { x, y } });
				}
			}
		}
	}

	/** Helper: Place Extension Blocks in + Shaped Patterns
	 -- */
	placeExtensionBlocks(center: Pos, targetCount: number, placements: StructurePlacement[], extPositions: Pos[]) {
		// Each block is a + shape: center + 4 cardinal directions = 5 extensions
		// Blocks are separated by roads for efficient movement
		// Pattern:  . E .
		//           E E E
		//           . E .
		// Where E = extension, . = road or empty

		const blockSpacing = 4; // 4 tiles between block centers (includes road perimeter)

		// Try to place blocks in a grid pattern around the center
		const maxSearchRadius = 15;
		let placed = 0;

		// Search in expanding rings around center
		for (let ring = 2; ring <= maxSearchRadius && placed < targetCount; ring += blockSpacing) {
			// Try positions at regular intervals in this ring
			const positions: Pos[] = [];

			// Generate candidate positions in a grid pattern
			for (let dy = -ring; dy <= ring; dy += blockSpacing) {
				for (let dx = -ring; dx <= ring; dx += blockSpacing) {
					positions.push({ x: center.x + dx, y: center.y + dy });
				}
			}

			// Try to place blocks at these positions
			for (const basePos of positions) {
				if (placed >= targetCount) break;

				// Try to place a + block at this position
				const blockPlaced = this.tryPlaceExtensionBlock(basePos, placements, extPositions);
				if (blockPlaced) {
					placed += 5; // Each block has 5 extensions
				}
			}
		}

		// If we still need more extensions, try a more flexible spiral search
		if (placed < targetCount) {
			for (let r = 3; r <= maxSearchRadius && placed < targetCount; r++) {
				for (let dy = -r; dy <= r; dy++) {
					for (let dx = -r; dx <= r; dx++) {
						if (placed >= targetCount) break;
						const basePos = { x: center.x + dx, y: center.y + dy };
						const blockPlaced = this.tryPlaceExtensionBlock(basePos, placements, extPositions);
						if (blockPlaced) placed += 5;
					}
					if (placed >= targetCount) break;
				}
			}
		}
	}

	/** Try to place a single + shaped extension block at the given position
	 -- Returns true if block was successfully placed */
	tryPlaceExtensionBlock(basePos: Pos, placements: StructurePlacement[], extPositions: Pos[]): boolean {
		// + pattern positions relative to base (center of +)
		const pattern: Pos[] = [
			{ x: 0, y: 0 },   // center
			{ x: 1, y: 0 },   // right
			{ x: -1, y: 0 },  // left
			{ x: 0, y: 1 },   // down
			{ x: 0, y: -1 }   // up
		];

		// Check if all 5 positions are valid and empty
		const absolutePositions: Pos[] = [];
		for (const offset of pattern) {
			const pos = { x: basePos.x + offset.x, y: basePos.y + offset.y };

			// Check bounds
			if (!inBounds(pos.x, pos.y)) return false;

			// Check if already used
			if (this.tileUsage[pos.y][pos.x] !== 'empty') return false;

			// Check terrain
			const roomPos = new RoomPosition(pos.x, pos.y, this.room.name);
			if (roomPos.lookFor(LOOK_TERRAIN)[0] === 'wall') return false;

			// Check distance transform (prefer open areas)
			if (this.dtGrid[pos.y][pos.x] < 1) return false;

			absolutePositions.push(pos);
		}

		// All positions valid - place the extensions
		for (const pos of absolutePositions) {
			this.tileUsage[pos.y][pos.x] = 'extension';
			placements.push({ structure: STRUCTURE_EXTENSION, pos });
			extPositions.push(pos);
		}

		// Place roads around the perimeter of the block for access
		this.placeRoadsAroundExtensionBlock(basePos, placements);

		return true;
	}

	/** Place roads around an extension block for access */
	placeRoadsAroundExtensionBlock(blockCenter: Pos, placements: StructurePlacement[]) {
		// Place roads at the corners and edges around the + block
		// This creates a perimeter for creeps to access all extensions
		const perimeterOffsets: Pos[] = [
			{ x: -1, y: -1 }, { x: 0, y: -2 }, { x: 1, y: -1 },  // top row
			{ x: -2, y: 0 },                    { x: 2, y: 0 },   // middle (left and right)
			{ x: -1, y: 1 },  { x: 0, y: 2 },  { x: 1, y: 1 }    // bottom row
		];

		for (const offset of perimeterOffsets) {
			const pos = { x: blockCenter.x + offset.x, y: blockCenter.y + offset.y };

			// Check bounds
			if (!inBounds(pos.x, pos.y)) continue;

			// Only place road if tile is empty (don't overwrite existing structures)
			if (this.tileUsage[pos.y][pos.x] !== 'empty') continue;

			// Check terrain
			const roomPos = new RoomPosition(pos.x, pos.y, this.room.name);
			if (roomPos.lookFor(LOOK_TERRAIN)[0] === 'wall') continue;

			// Check distance transform
			if (this.dtGrid[pos.y][pos.x] < 1) continue;

			// Place road
			this.tileUsage[pos.y][pos.x] = 'road';
			placements.push({ structure: 'road', pos });
		}
	}

	/** 10: Validate Structure Counts
	 -- */
	validateStructureCounts(placements: StructurePlacement[]): string[] {
		const notes: string[] = [];

		// Screeps maximum structure counts at RCL8
		const maxCounts: Record<string, number> = {
			[STRUCTURE_SPAWN]: 3,
			[STRUCTURE_EXTENSION]: 60,
			[STRUCTURE_TOWER]: 6,
			[STRUCTURE_STORAGE]: 1,
			[STRUCTURE_TERMINAL]: 1,
			[STRUCTURE_LAB]: 10,
			[STRUCTURE_LINK]: 6,
			[STRUCTURE_FACTORY]: 1,
			[STRUCTURE_NUKER]: 1,
			[STRUCTURE_OBSERVER]: 1,
			[STRUCTURE_EXTRACTOR]: 1,
			'container': 5,
			'road': Infinity,
			[STRUCTURE_RAMPART]: Infinity
		};

		// Count each structure type
		const counts: Record<string, number> = {};
		for (const p of placements) {
			const type = p.structure as string;
			counts[type] = (counts[type] || 0) + 1;
		}

		// Validate against max counts
		for (const [type, count] of Object.entries(counts)) {
			const max = maxCounts[type];
			if (max !== undefined && max !== Infinity && count > max) {
				notes.push(`WARNING: ${type} count (${count}) exceeds maximum (${max})`);
			} else if (max !== undefined && max !== Infinity) {
				notes.push(`${type}: ${count}/${max}`);
			}
		}

		return notes;
	}

	/** 11: Tower Placement Helper: Maximize Coverage (Greedy)
	 -- */
	pickTowerPositions(center: Pos, count: number): Pos[] {
		// Greedy maximize min coverage: pick positions that decrease the maximum distance-to-any-base-edge
		// For simplicity: pick tiles around center within radius 6 that are empty and high floodGrid accessibility
		const candidates: Pos[] = [];
		for (let y = Math.max(0, center.y - 8); y <= Math.min(ROOM_SIZE - 1, center.y + 8); y++) {
			for (let x = Math.max(0, center.x - 8); x <= Math.min(ROOM_SIZE - 1, center.x + 8); x++) {
				if (this.tileUsage[y][x] !== 'empty') continue;
				if (this.dtGrid[y][x] < 1) continue;
				candidates.push({ x, y });
			}
		}
		const chosen: Pos[] = [];
		while (chosen.length < count && candidates.length > 0) {
			// score candidate by min distance to existing chosen (diversity) and accessibility
			candidates.sort((a, b) => {
				const aScore =
					Math.min(...chosen.map(c => manhattan(a, c)).concat([100])) +
					(this.floodGrid[a.y][a.x] || 0) * -0.5 -
					Math.abs(a.x - center.x) * 0.1;
				const bScore =
					Math.min(...chosen.map(c => manhattan(b, c)).concat([100])) +
					(this.floodGrid[b.y][b.x] || 0) * -0.5 -
					Math.abs(b.x - center.x) * 0.1;
				return bScore - aScore;
			});
			// pick top candidate
			const pick = candidates.shift()!;
			chosen.push(pick);
			// remove candidates too close
			for (let i = candidates.length - 1; i >= 0; i--) {
				if (manhattan(candidates[i], pick) <= 2) candidates.splice(i, 1);
			}
		}
		return chosen;
	}

	/** 12: Build RCL Schedule
	-- */
	buildRclSchedule(placements: StructurePlacement[]): Record<number, StructurePlacement[]> {
		// Determine typical RCL unlocks:
		// - RCL1: spawn (1), container(s) (none automatically placed), small roads
		// - RCL2..RCL3: more extensions
		// - RCL4..RCL5: storage/links/containers, towers
		// - RCL6..RCL8: labs, spawns, extensions, factory, nuker, observer, terminal
		// We'll map structures by rough typical progression. You can tweak exact mapping later.
		const schedule: Record<number, StructurePlacement[]> = {};
		for (let r = 1; r <= RCL_MAX; r++) schedule[r] = [];

		// Helper: push placement into earliest suitable RCL by structure type
		function earliestRclFor(struct: StructureConstant | 'container' | 'road' | 'rampart' | 'link') {
			switch (struct) {
				case STRUCTURE_SPAWN:
					return 1;
				case 'road':
					return ROADS_AVAILABLE_RCL;
				case 'container':
					return 2; // Containers available at RCL2
				case STRUCTURE_EXTENSION:
					return 2;
				case STRUCTURE_TOWER:
					return 3; // First tower at RCL3
				case STRUCTURE_STORAGE:
					return 4;
				case STRUCTURE_LINK:
					return 5;
				case STRUCTURE_TERMINAL:
					return 6;
				case STRUCTURE_LAB:
					return 6; // Labs at RCL6
				case STRUCTURE_FACTORY:
					return 7;
				case STRUCTURE_NUKER:
					return 8;
				case STRUCTURE_OBSERVER:
					return 8;
				case STRUCTURE_RAMPART:
					return 2; // Ramparts available at RCL2
				case STRUCTURE_EXTRACTOR:
					return 6;
				default:
					return 6;
			}
		}

		// Add all structures except extensions, towers, and spawns to their earliest RCL
		for (const p of placements) {
			// Skip extensions, towers, and spawns - they'll be distributed separately
			if (p.structure === STRUCTURE_EXTENSION || p.structure === STRUCTURE_TOWER || p.structure === STRUCTURE_SPAWN) continue;
			const r = earliestRclFor(p.structure as any);
			schedule[r].push(p);
		}

		// Distribute spawns across RCLs
		// Screeps spawn progression: 1 at RCL1, 2 at RCL7, 3 at RCL8
		const allSpawns = placements.filter(pl => pl.structure === STRUCTURE_SPAWN);
		if (allSpawns.length > 0) schedule[1].push(allSpawns[0]); // First spawn at RCL1
		if (allSpawns.length > 1) schedule[7].push(allSpawns[1]); // Second spawn at RCL7
		if (allSpawns.length > 2) schedule[8].push(allSpawns[2]); // Third spawn at RCL8

		// Distribute extensions across RCLs progressively
		// Screeps extension progression: 0,5,10,20,30,40,50,60 at RCLs 1-8
		const allExtensions = placements.filter(pl => pl.structure === STRUCTURE_EXTENSION);
		const extPerRcl: Record<number, number> = {
			1: 0,
			2: 5,
			3: 10,
			4: 20,
			5: 30,
			6: 40,
			7: 50,
			8: 60
		};
		let assignedExt = 0;
		for (let r = 2; r <= 8; r++) {
			const target = Math.min(extPerRcl[r], allExtensions.length);
			while (assignedExt < target && assignedExt < allExtensions.length) {
				schedule[r].push(allExtensions[assignedExt]);
				assignedExt++;
			}
		}

		// Distribute towers across RCLs progressively
		// Screeps tower progression: 1,2,3,6 at RCLs 3,5,7,8
		const allTowers = placements.filter(pl => pl.structure === STRUCTURE_TOWER);
		const towerPerRcl: Record<number, number> = {
			3: 1,
			5: 2,
			7: 3,
			8: 6
		};
		let assignedTowers = 0;
		for (const r of [3, 5, 7, 8]) {
			const target = Math.min(towerPerRcl[r], allTowers.length);
			while (assignedTowers < target && assignedTowers < allTowers.length) {
				schedule[r].push(allTowers[assignedTowers]);
				assignedTowers++;
			}
		}

		return schedule;
	}

	/* -------------------------
		 Utilities: Pathfinding & Shuffle
		 ------------------------- */
	simplePath(from: Pos, to: Pos): Pos[] {
		// Use PathFinder to find a proper path avoiding walls and obstacles
		const fromPos = new RoomPosition(from.x, from.y, this.room.name);
		const toPos = new RoomPosition(to.x, to.y, this.room.name);

		// Create a cost matrix that avoids walls and obstacles
		const costMatrix = new PathFinder.CostMatrix();
		for (let y = 0; y < ROOM_SIZE; y++) {
			for (let x = 0; x < ROOM_SIZE; x++) {
				// Use cached terrain instead of expensive lookFor() call
				const terrain = this.terrainGrid[y][x];
				if (terrain === 'wall') {
					costMatrix.set(x, y, 255); // Impassable
				} else if (terrain === 'swamp') {
					costMatrix.set(x, y, 5); // Prefer plains over swamps
				}
				// Avoid placing roads on existing structures (except roads)
				const usage = this.tileUsage[y][x];
				if (usage !== 'empty' && usage !== 'road') {
					costMatrix.set(x, y, 255); // Don't path through structures
				}
			}
		}

		// Find path using PathFinder
		const result = PathFinder.search(fromPos, { pos: toPos, range: 1 }, {
			plainCost: 2,
			swampCost: 10,
			roomCallback: (roomName) => {
				if (roomName === this.room.name) return costMatrix;
				return false;
			}
		});

		// Convert path to Pos[] format
		const path: Pos[] = result.path.map(p => ({ x: p.x, y: p.y }));

		// Fallback to straight line if PathFinder fails
		if (result.incomplete || path.length === 0) {
			const fallbackPath: Pos[] = [];
			let cx = from.x;
			let cy = from.y;
			const steps = Math.max(Math.abs(to.x - cx), Math.abs(to.y - cy));
			for (let i = 0; i < steps; i++) {
				if (cx < to.x) cx++;
				else if (cx > to.x) cx--;
				if (cy < to.y) cy++;
				else if (cy > to.y) cy--;
				if (inBounds(cx, cy)) fallbackPath.push({ x: cx, y: cy });
			}
			return fallbackPath;
		}

		return path;
	}

	shuffle<T>(arr: T[]) {
		for (let i = arr.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[arr[i], arr[j]] = [arr[j], arr[i]];
		}
		return arr.slice();
	}
}


/* -------------------------
	 Helpers
	 ------------------------- */

function inBounds(x: number, y: number) {
	return x >= 0 && x < ROOM_SIZE && y >= 0 && y < ROOM_SIZE;
}
function copyGrid<T>(g: T[][]): T[][] {
	return g.map(row => row.slice());
}
function posEq(a: Pos, b: Pos) {
	return a.x === b.x && a.y === b.y;
}
function manhattan(a: Pos, b: Pos) {
	return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Convert RoomPosition -> Pos convenience if user passes RoomPosition objects in later use */
function rpToPos(rp: RoomPosition): Pos {
	return { x: rp.x, y: rp.y };
}

export function computePlanChecksum(plan: PlanResult): string {
	const str = JSON.stringify(plan.rclSchedule);
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = (hash << 5) - hash + str.charCodeAt(i);
		hash |= 0;
	}
	return hash.toString();
}
