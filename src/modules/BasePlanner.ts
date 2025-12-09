import { getDistanceTransform, getPositionsByPathCost, getMinCut } from './PlanningFunctions';
import { jsonToConstant } from '@modules/stamps/parseJSONStamp';
import { extensionParsedStamps } from '@modules/stamps/ExtensionStamps';

/**
 * Core 5x5 stamp template for base center
 * Positions are relative to center (0,0)
 * @author randomencounter
 */
const CORE_STAMP_5X5: StampTemplate = {
	size: 5,
	structures: [
		// Row 1 (y=-2)
		{ dx: -2, dy: -2, structure: STRUCTURE_LAB },
		{ dx: -1, dy: -2, structure: STRUCTURE_ROAD },
		{ dx: 0, dy: -2, structure: STRUCTURE_ROAD },
		{ dx: 1, dy: -2, structure: STRUCTURE_ROAD },
		{ dx: 2, dy: -2, structure: STRUCTURE_FACTORY },

		// Row 2 (y=-1)
		{ dx: -2, dy: -1, structure: STRUCTURE_ROAD },
		{ dx: -1, dy: -1, structure: STRUCTURE_SPAWN },
		{ dx: 0, dy: -1, structure: STRUCTURE_SPAWN },
		{ dx: 1, dy: -1, structure: STRUCTURE_SPAWN },
		{ dx: 2, dy: -1, structure: STRUCTURE_ROAD },

		// Row 3 (y=0) - Center row
		{ dx: -2, dy: 0, structure: STRUCTURE_ROAD },
		{ dx: -1, dy: 0, structure: STRUCTURE_TERMINAL },
		// Center position (0,0) kept empty
		{ dx: 1, dy: 0, structure: STRUCTURE_LINK },
		{ dx: 2, dy: 0, structure: STRUCTURE_ROAD },

		// Row 4 (y=1)
		{ dx: -2, dy: 1, structure: STRUCTURE_ROAD },
		{ dx: -1, dy: 1, structure: STRUCTURE_STORAGE },
		{ dx: 0, dy: 1, structure: STRUCTURE_ROAD },
		{ dx: 1, dy: 1, structure: STRUCTURE_POWER_SPAWN },
		{ dx: 2, dy: 1, structure: STRUCTURE_ROAD },

		// Row 5 (y=2)
		{ dx: -2, dy: 2, structure: STRUCTURE_EXTENSION },
		{ dx: -1, dy: 2, structure: STRUCTURE_ROAD },
		{ dx: 0, dy: 2, structure: STRUCTURE_NUKER },
		{ dx: 1, dy: 2, structure: STRUCTURE_ROAD },
		{ dx: 2, dy: 2, structure: STRUCTURE_EXTENSION }
	]
};

/**
 * Lab stamp configuration for optimal reaction capabilities
 * @author randomencounter
 */
const LAB_STAMP: StampTemplate = {
	size: 3,
	structures: [
		// Source labs (accessible to all others within range 2)
		{ dx: -1, dy: -1, structure: STRUCTURE_LAB, meta: { type: 'source' } },
		{ dx: 1, dy: -1, structure: STRUCTURE_LAB, meta: { type: 'source' } },
		// Reaction labs
		{ dx: -1, dy: 0, structure: STRUCTURE_LAB },
		{ dx: 0, dy: 0, structure: STRUCTURE_LAB },
		{ dx: 1, dy: 0, structure: STRUCTURE_LAB },
		{ dx: -1, dy: 1, structure: STRUCTURE_LAB },
		{ dx: 0, dy: 1, structure: STRUCTURE_LAB },
		{ dx: 1, dy: 1, structure: STRUCTURE_LAB },
		// Additional labs to complete the 10
		{ dx: 0, dy: -1, structure: STRUCTURE_LAB },
		{ dx: 0, dy: 2, structure: STRUCTURE_LAB }
	]
};

/**
 * Structure limits per RCL level
 * @author randomencounter
 */
const STRUCTURE_LIMITS: { [key in BuildableStructureConstant]?: number[] } = {
	[STRUCTURE_SPAWN]: [0, 1, 1, 1, 1, 1, 1, 2, 3],
	[STRUCTURE_EXTENSION]: [0, 0, 5, 10, 20, 30, 40, 50, 60],
	[STRUCTURE_ROAD]: [0, 0, 0, 2500, 2500, 2500, 2500, 2500, 2500],
	[STRUCTURE_WALL]: [0, 0, 0, 0, 0, 0, 0, 0, 0],
	[STRUCTURE_RAMPART]: [0, 0, 0, 0, 0, 0, 0, 0, 2500],
	[STRUCTURE_LINK]: [0, 0, 0, 0, 0, 2, 3, 4, 6],
	[STRUCTURE_STORAGE]: [0, 0, 0, 0, 1, 1, 1, 1, 1],
	[STRUCTURE_TOWER]: [0, 0, 0, 1, 1, 2, 2, 3, 6],
	[STRUCTURE_OBSERVER]: [0, 0, 0, 0, 0, 0, 0, 0, 1],
	[STRUCTURE_POWER_SPAWN]: [0, 0, 0, 0, 0, 0, 0, 0, 1],
	[STRUCTURE_EXTRACTOR]: [0, 0, 0, 0, 0, 0, 1, 1, 1],
	[STRUCTURE_LAB]: [0, 0, 0, 0, 0, 0, 3, 6, 10],
	[STRUCTURE_TERMINAL]: [0, 0, 0, 0, 0, 0, 1, 1, 1],
	[STRUCTURE_CONTAINER]: [5, 5, 5, 5, 5, 5, 5, 5, 5],
	[STRUCTURE_NUKER]: [0, 0, 0, 0, 0, 0, 0, 0, 1],
	[STRUCTURE_FACTORY]: [0, 0, 0, 0, 0, 0, 0, 1, 1]
};

type CachedStampTransform = {
	transform: StampTransformOptions;
	placements: Array<{ structure: BuildableStructureConstant; pos: Pos }>;
};

/**
 * Advanced base planner that uses distance transform, flood fill, and minimum cut algorithms
 * to generate optimized base layouts
 * @author randomencounter
 */
export default class BasePlanner {
	private room: Room;
	private terrain: RoomTerrain;
	public dtGrid: number[][] = [];
	public floodGrid: number[][] = [];
	private maxRCL: RCLLevel = 8;
	private startPos: RoomPosition | null = null;
	private controllerUpgradeArea: RoomPosition[] = [];
	private ramparts: RoomPosition[] = [];
	private structurePlacements: Map<string, StructurePlacement> = new Map();
	private extensionStampCatalog: ParsedStamp[] = extensionParsedStamps;
	private placementLookup: Map<string, StructurePlacement[]> = new Map();
	private extensionStampTransformCache: Map<string, CachedStampTransform[]> = new Map();

	/**
	 * Creates a new BasePlanner instance for the given room
	 * @param room - The room to plan
	 * @author randomencounter
	 */
	constructor(room: Room) {
		this.room = room;
		this.terrain = room.getTerrain();
	}

	/**
	 * Main entry point - creates a complete base plan following the 10-step process
	 * @returns Complete base plan with RCL-specific build orders
	 * @author randomencounter
	 */
	public createPlan(maxRCL: RCLLevel = 8): PlanResult {
		this.resetState();
		this.maxRCL = maxRCL;
		console.log(`${this.room.link()} Starting base planning...`);

		// Step 1: Generate distance transform
		this.generateDistanceTransform();

		// Step 2: Select optimal starting position
		this.selectStartingPosition();

		// Step 3: Place core structures using 5x5 stamp
		this.placeCoreStructures();

		// Step 4: Designate controller upgrade area
		this.designateControllerArea();

		// Step 5: Generate flood fill from core
		this.generateFloodFill();

		// Step 6: Allocate tiles for structures
		this.allocateTiles();

		// Step 7: Position labs
		this.positionLabs();

		// Step 8: Establish infrastructure (roads, containers, links)
		this.establishInfrastructure();

		// Step 9: Optimize ramparts using minimum cut
		this.optimizeRamparts();

		// Step 10: Place towers for optimal coverage
		this.placeTowers();

		// Step 11: Place remaining structures
		this.placeRemainingStructures();

		// Generate RCL-specific build schedule
		const schedule = this.generateRCLSchedule();

		console.log(`${this.room.link()} Base planning complete. Generated ${this.structurePlacements.size} placements.`);

		return {
			dtGrid: this.dtGrid,
			floodFill: this.floodGrid,

			startPos: this.startPos!,
			placements: Array.from(this.structurePlacements.values()),
			rclSchedule: schedule,
			ramparts: this.ramparts,
			controllerArea: this.controllerUpgradeArea,
			timestamp: Game.time,
			maxPlannedRCL: this.maxRCL
		};
	}

	/**
	 * Clears cached planning state so repeated runs don't accumulate placements
	 */
	private resetState(): void {
		this.dtGrid = [];
		this.floodGrid = [];
		this.startPos = null;
		this.controllerUpgradeArea = [];
		this.ramparts = [];
		this.structurePlacements.clear();
		this.placementLookup.clear();
		this.extensionStampTransformCache.clear();
	}

	/**
	 * Step 1: Generate distance transform to identify open spaces
	 * @author randomencounter
	 */
	private generateDistanceTransform(): void {
		const distMatrix = getDistanceTransform(this.room.name, { visual: false });

		// Convert PathFinder.CostMatrix to 2D array for easier manipulation
		this.dtGrid = [];
		for (let x = 0; x < 50; x++) {
			this.dtGrid[x] = [];
			for (let y = 0; y < 50; y++) {
				this.dtGrid[x][y] = distMatrix.get(x, y);
			}
		}
	}

	/**
	 * Step 2: Select optimal starting position for base center
	 * Prioritizes positions with distance ≥ 3 near controller and sources
	 * @author randomencounter
	 */
	private selectStartingPosition(): void {
		const controller = this.room.controller;
		if (!controller) throw new Error('Room has no controller');

		// Check if there's already a player-placed spawn
		const existingSpawns = this.room.find(FIND_MY_SPAWNS);
		if (existingSpawns.length > 0) {
			// Use one tile below the first spawn as the center point
			// This aligns the player's spawn with the middle spawn position (dx: 0, dy: -1) in the core stamp
			const playerSpawn = existingSpawns[0];
			this.startPos = new RoomPosition(playerSpawn.pos.x, playerSpawn.pos.y + 1, this.room.name);
			console.log(`${this.room.link()} Using existing spawn at ${playerSpawn.pos} - center point set to ${this.startPos}`);
			return;
		}

		const sources = this.room.find(FIND_SOURCES);
		const candidates: { pos: RoomPosition; score: number }[] = [];

		// Find all positions with sufficient open space (distance >= 3)
		for (let x = 3; x < 47; x++) {
			for (let y = 3; y < 47; y++) {
				if (this.dtGrid[x][y] >= 3) {
					const pos = new RoomPosition(x, y, this.room.name);

					// Score based on proximity to controller and sources
					let score = 0;

					// Controller proximity (heavily weighted)
					const controllerDist = pos.getRangeTo(controller);
					score += Math.max(0, 50 - controllerDist * 2);

					// Source proximity
					for (const source of sources) {
						const sourceDist = pos.getRangeTo(source);
						score += Math.max(0, 30 - sourceDist);
					}

					// Prefer positions not too close to edges
					const edgeDist = Math.min(x, y, 49 - x, 49 - y);
					score += edgeDist * 2;

					// Ensure we can fit a 5x5 stamp
					if (this.canPlaceStamp(pos, 5)) {
						candidates.push({ pos, score });
					}
				}
			}
		}

		// Select best candidate
		candidates.sort((a, b) => b.score - a.score);
		if (candidates.length === 0) {
			throw new Error('No suitable starting position found');
		}

		this.startPos = candidates[0].pos;
		console.log(`${this.room.link()} Selected starting position: ${this.startPos}`);
	}

	/**
	 * Check if a stamp of given size can be placed at position
	 * @param center - Center position for stamp
	 * @param size - Size of the stamp (e.g., 5 for 5x5)
	 * @returns true if stamp can be placed
	 * @author randomencounter
	 */
	private canPlaceStamp(center: RoomPosition, size: number): boolean {
		const offset = Math.floor(size / 2);
		for (let dx = -offset; dx <= offset; dx++) {
			for (let dy = -offset; dy <= offset; dy++) {
				const x = center.x + dx;
				const y = center.y + dy;
				if (x < 1 || x > 48 || y < 1 || y > 48) return false;
				if (this.terrain.get(x, y) === TERRAIN_MASK_WALL) return false;
			}
		}
		return true;
	}

	/**
	 * Step 3: Place core structures using the 5x5 stamp
	 * @author randomencounter
	 */
	private placeCoreStructures(): void {
		if (!this.startPos) return;

		// Try different rotations/mirrors if needed
		const rotations = [0, 90, 180, 270];
		const mirrors = [false, true];

		for (const rotation of rotations) {
			for (const mirror of mirrors) {
				if (this.tryPlaceStamp(this.startPos, CORE_STAMP_5X5, rotation, mirror)) {
					console.log(`${this.room.link()} Core stamp placed with rotation ${rotation}, mirror ${mirror}`);
					return;
				}
			}
		}

		console.log(`${this.room.link()} Warning: Could not place full core stamp, placing partial`);
		// Place as much as possible
		this.tryPlaceStamp(this.startPos, CORE_STAMP_5X5, 0, false, true);
	}

	/**
	 * Try to place a stamp at the given position with rotation and mirroring
	 * @param center - Center position
	 * @param stamp - Stamp template to place
	 * @param rotation - Rotation in degrees (0, 90, 180, 270)
	 * @param mirror - Whether to mirror horizontally
	 * @param partial - Allow partial placement if some positions are blocked
	 * @returns true if stamp was successfully placed
	 * @author randomencounter
	 */
	private tryPlaceStamp(
		center: RoomPosition,
		stamp: StampTemplate,
		rotation: number,
		mirror: boolean,
		partial: boolean = false
	): boolean {
		const placements: StructurePlacement[] = [];

		for (const template of stamp.structures) {
			let { dx, dy } = template;

			// Apply mirroring
			if (mirror) dx = -dx;

			// Apply rotation
			const rad = (rotation * Math.PI) / 180;
			const rotX = Math.round(dx * Math.cos(rad) - dy * Math.sin(rad));
			const rotY = Math.round(dx * Math.sin(rad) + dy * Math.cos(rad));

			const x = center.x + rotX;
			const y = center.y + rotY;

			// Check if position is valid
			if (x < 1 || x > 48 || y < 1 || y > 48) {
				if (!partial) return false;
				continue;
			}

			if (this.terrain.get(x, y) === TERRAIN_MASK_WALL) {
				if (!partial) return false;
				continue;
			}

			// Skip roads for initial placement at low RCL
			if (template.structure === STRUCTURE_ROAD) {
				placements.push({
					pos: { x, y },
					structure: template.structure,
					priority: 10,
					meta: template.meta
				});
			} else {
				placements.push({
					pos: { x, y },
					structure: template.structure,
					priority: this.getStructurePriority(template.structure),
					meta: template.meta
				});
			}
		}

		// Commit placements
		for (const placement of placements) {
			const key = `${placement.pos.x},${placement.pos.y}`;
			this.structurePlacements.set(key, placement);
			this.registerPlacementInLookup(placement);
		}

		return true;
	}

	/**
	 * Step 4: Designate controller upgrade area
	 * Uses pathfinding to find optimal position between controller and core
	 * Searches along the path from controller to core center, finding positions with all 8 surrounding
	 * tiles walkable and within range 3 of controller. Falls back to requiring only 7, 6, etc. positions
	 * if necessary to guarantee a solution.
	 * @author randomencounter
	 */
	private designateControllerArea(): void {
		const controller = this.room.controller;
		if (!controller || !this.startPos) return;

		// Create path from controller to core center
		const path = controller.pos.findPathTo(this.startPos, {
			ignoreCreeps: true,
			ignoreRoads: true
		});

		// Try progressively relaxed walkability requirements: 8 down to 1 surrounding positions
		for (let requiredWalkable = 8; requiredWalkable >= 1; requiredWalkable--) {
			// Iterate through path steps from controller toward core
			for (const step of path) {
				const centerPos = new RoomPosition(step.x, step.y, this.room.name);
				const positions: RoomPosition[] = [];
				let walkableCount = 0;
				let inRangeCount = 0;

				// Check all 8 surrounding positions (excluding center)
				for (let dx = -1; dx <= 1; dx++) {
					for (let dy = -1; dy <= 1; dy++) {
						if (dx === 0 && dy === 0) continue; // Skip center position

						const x = centerPos.x + dx;
						const y = centerPos.y + dy;

						// Check bounds
						if (x < 1 || x > 48 || y < 1 || y > 48) continue;

						// Check terrain
						if (this.terrain.get(x, y) === TERRAIN_MASK_WALL) continue;

						const pos = new RoomPosition(x, y, this.room.name);
						walkableCount++;
						positions.push(pos);

						// Check if within range 3 of controller
						if (pos.getRangeTo(controller) <= 3) {
							inRangeCount++;
						}
					}
				}

				// Accept this position if we have enough walkable tiles AND all are in range 3
				if (walkableCount >= requiredWalkable && inRangeCount === walkableCount) {
					this.controllerUpgradeArea = positions;

					// Place container one tile to the left of center (will be upgraded to link later at RCL 5)
					const key = `${centerPos.x - 1},${centerPos.y}`;
					this.structurePlacements.set(key + '_container', {
						pos: { x: centerPos.x - 1, y: centerPos.y },
						structure: STRUCTURE_CONTAINER,
						priority: 1,
						meta: { type: 'controller', upgradeTo: STRUCTURE_LINK }
					});

					console.log(`${this.room.link()} Controller area designated at ${centerPos} with ${positions.length} walkable surrounding positions`);
					return;
				}

				// If we've gone past range 3 of controller, no point continuing with this requirement level
				if (inRangeCount === 0) {
					break; // Exit inner loop, try next requirement level
				}
			}
		}

		console.log(`${this.room.link()} Warning: Could not find suitable controller area`);
	}

	/**
	 * Step 5: Generate flood fill from core structures
	 * @author randomencounter
	 */
	private generateFloodFill(): void {
		if (!this.startPos) return;

		// Use core position as start for flood fill
		const floodMatrix = getPositionsByPathCost(
			this.room.name,
			[this.startPos],
			{ visual: false }
		);

		// Convert to 2D array
		this.floodGrid = [];
		for (let x = 0; x < 50; x++) {
			this.floodGrid[x] = [];
			for (let y = 0; y < 50; y++) {
				this.floodGrid[x][y] = floodMatrix.get(x, y);
			}
		}
	}

	/**
	 * Step 6: Allocate tiles for various structures using grid layout
	 * @author randomencounter
	 */
	private allocateTiles(): void {
		if (!this.startPos) return;

		// Allocate extensions in RCL-grouped clusters
		this.allocateExtensionsByRCLGroup();

		// Reserve space for labs (will be positioned in step 7)
		// Reserve space for towers (will be positioned in step 10)
		// Reserve space for other structures (will be positioned in step 11)
	}

	/**
	 * Allocate extensions using stamp catalog (rotations/mirrors) and road alignment scoring.
	 * Prefers larger stamps first, then best road overlap, while limiting cross-stamp adjacency.
	 * Extensions cannot have more than 2 existing (previous-stamp) cardinally adjacent extensions.
	 * Stamps are rotated/flipped to find fits before falling back to smaller stamps.
	 * RCL 2: 5, RCL 3: 5, RCL 4: 10, RCL 5: 10, RCL 6: 10, RCL 7: 10, RCL 8: 10 (total 60)
	 */
	private allocateExtensionsByRCLGroup(): void {
		if (!this.startPos) return;

		const extensionsPerRCL: { [key: number]: number } = {
			2: 5,
			3: 5,
			4: 10,
			5: 10,
			6: 10,
			7: 10,
			8: 10
		};

		// Cache existing placements for scoring
		const existingExtensions = this.collectPositionsByStructure(STRUCTURE_EXTENSION);
		const existingRoads = this.collectPositionsByStructure(STRUCTURE_ROAD);
		const placementLookup = this.buildPlacementLookup();
		this.placementLookup = placementLookup;

		const initialExtensions = existingExtensions.size;
		let placedTotal = initialExtensions;
		const catalog = this.extensionStampCatalog
			.map(stamp => ({
				stamp,
				extCount: stamp.placements.filter(p => p.structure === STRUCTURE_EXTENSION).length
			}))
			.sort((a, b) => b.extCount - a.extCount);

		for (const rcl of [2, 3, 4, 5, 6, 7, 8]) {
			if (rcl > this.maxRCL) break;
			let remaining = extensionsPerRCL[rcl];
			if (remaining <= 0) continue;

			let safety = 0;
			while (remaining > 0 && safety++ < 100) {
				const candidate = this.findBestExtensionStampPlacement(
					catalog,
					remaining,
					existingExtensions,
					existingRoads,
					placementLookup,
					rcl
				);

				if (!candidate) break;

				// Commit extensions
				for (const pos of candidate.extensions) {
					const key = `${pos.x},${pos.y}`;
					const placement: StructurePlacement = {
						pos,
						structure: STRUCTURE_EXTENSION,
						priority: 3,
						meta: { minRCL: rcl }
					};
					this.structurePlacements.set(key, placement);
					this.registerPlacementInLookup(placement, placementLookup);
					existingExtensions.add(key);
					placedTotal++;
					remaining--;
					if (remaining <= 0) break;
				}

				// Commit roads (only if not already blocked by other structures)
				for (const pos of candidate.roads) {
					const key = `${pos.x},${pos.y}`;
					if (this.hasBlockingStructure(pos, placementLookup)) continue;
					if (this.hasRoadAt(pos, existingRoads, placementLookup)) continue;
					const roadPlacement: StructurePlacement = {
						pos,
						structure: STRUCTURE_ROAD,
						priority: Math.max(9, 11 - rcl),
						meta: { minRCL: rcl }
					};
					this.structurePlacements.set(key + '_road', roadPlacement);
					this.registerPlacementInLookup(roadPlacement, placementLookup);
					existingRoads.add(key);
				}
			}

			if (remaining > 0) {
				console.log(`${this.room.link()} Warning: could not place ${extensionsPerRCL[rcl] - remaining} / ${extensionsPerRCL[rcl]} extensions for RCL${rcl}`);
			}
		}

		console.log(`${this.room.link()} Placed ${placedTotal - initialExtensions} extensions in RCL-grouped clusters`);
	}

	private findBestExtensionStampPlacement(
		catalog: { stamp: ParsedStamp; extCount: number }[],
		remaining: number,
		existingExtensions: Set<string>,
		existingRoads: Set<string>,
		lookup: Map<string, StructurePlacement[]>,
		rcl: number
	): { extensions: Pos[]; roads: Pos[] } | null {
		if (!this.startPos) return null;

		const searchRadius = Memory.globalSettings?.basePlanner?.ANCHOR_RADIUS ?? 8;
		const anchors: Pos[] = [];
		for (let x = Math.max(1, this.startPos.x - searchRadius); x <= Math.min(48, this.startPos.x + searchRadius); x++) {
			for (let y = Math.max(1, this.startPos.y - searchRadius); y <= Math.min(48, this.startPos.y + searchRadius); y++) {
				const flood = this.floodGrid?.[x]?.[y];
				if (flood === undefined || flood >= 255) continue;
				if (this.terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
				anchors.push({ x, y });
			}
		}

		// check closer anchors first
		anchors.sort((a, b) => {
			const da = Math.abs(a.x - this.startPos!.x) + Math.abs(a.y - this.startPos!.y);
			const db = Math.abs(b.x - this.startPos!.x) + Math.abs(b.y - this.startPos!.y);
			return da - db;
		});

		const MAX_ANCHORS = 200;
		if (anchors.length > MAX_ANCHORS) anchors.length = MAX_ANCHORS;

		const transforms: StampTransformOptions[] = [];
		for (let rot = 0; rot < 4; rot++) {
			transforms.push({ rotate90: rot as 0 | 1 | 2 | 3, mirrorHoriz: false, mirrorVert: false });
		}

		for (const entry of catalog) {
			if (entry.extCount <= 0 || entry.extCount > remaining) continue;

			const cachedTransforms = this.getCachedStampTransforms(entry.stamp, transforms);
			let best: {
				extensions: Pos[];
				roads: Pos[];
				roadOverlap: number;
				newRoads: number;
			} | null = null;

			for (const anchor of anchors) {
				for (const cached of cachedTransforms) {
					const evaluated = this.evaluateExtensionStampPlacement(
						cached.placements,
						anchor,
						existingExtensions,
						existingRoads,
						lookup
					);
					if (!evaluated) continue;

					if (
						!best ||
						evaluated.roadOverlap > best.roadOverlap ||
						(evaluated.roadOverlap === best.roadOverlap && evaluated.newRoads < best.newRoads)
					) {
						best = evaluated;
					}
				}
			}

			if (best) {
				return { extensions: best.extensions, roads: best.roads };
			}
		}

		return null;
	}

	private evaluateExtensionStampPlacement(
		placements: Array<{ structure: BuildableStructureConstant; pos: Pos }>,
		anchor: Pos,
		existingExtensions: Set<string>,
		existingRoads: Set<string>,
		lookup: Map<string, StructurePlacement[]>
	): { extensions: Pos[]; roads: Pos[]; roadOverlap: number; newRoads: number } | null {
		const extensions: Pos[] = [];
		const roads: Pos[] = [];
		let roadOverlap = 0;
		let newRoads = 0;

		for (const placement of placements) {
			const x = anchor.x + placement.pos.x;
			const y = anchor.y + placement.pos.y;

			// Bounds and terrain
			if (x < 1 || x > 48 || y < 1 || y > 48) return null;
			if (this.terrain.get(x, y) === TERRAIN_MASK_WALL) return null;

			const key = `${x},${y}`;
			const absolutePos = { x, y };
			const planned = this.findPlannedStructureAt(absolutePos, lookup);

			if (placement.structure === STRUCTURE_EXTENSION) {
				// avoid conflicts
				if (planned) return null;
				if (existingRoads.has(key)) return null;

				// adjacency to previous stamps: no more than 2 cardinal neighbors already placed
				if (this.countAdjacentExtensions(absolutePos, existingExtensions) > 2) return null;

				extensions.push({ x, y });
			} else if (placement.structure === STRUCTURE_ROAD) {
				if (planned && planned.structure !== STRUCTURE_ROAD) return null;
				if (existingRoads.has(key)) {
					roadOverlap++;
				} else {
					newRoads++;
					roads.push({ x, y });
				}
			} else {
				// Only extension/road stamps are allowed in this flow
				if (planned) return null;
			}
		}

		if (extensions.length === 0) return null;

		return { extensions, roads, roadOverlap, newRoads };
	}

	private getCachedStampTransforms(stamp: ParsedStamp, transforms: StampTransformOptions[]): CachedStampTransform[] {
		const transformKey = transforms
			.map(t => `${t.rotate90 ?? 0}-${t.mirrorHoriz ? 1 : 0}-${t.mirrorVert ? 1 : 0}`)
			.join('|');
		const key = `${stamp.name ?? 'stamp'}|${stamp.stampWidth ?? 0}x${stamp.stampHeight ?? 0}|${transformKey}`;
		const cached = this.extensionStampTransformCache.get(key);
		if (cached) return cached;

		const computed = transforms.map(transform => ({
			transform,
			placements: jsonToConstant(stamp, { ...transform, anchor: { x: 0, y: 0 }, buildRoads: true })
		}));

		this.extensionStampTransformCache.set(key, computed);
		return computed;
	}

	private countAdjacentExtensions(pos: Pos, existingExtensions: Set<string>): number {
		const adj = [
			`${pos.x + 1},${pos.y}`,
			`${pos.x - 1},${pos.y}`,
			`${pos.x},${pos.y + 1}`,
			`${pos.x},${pos.y - 1}`
		];
		let total = 0;
		for (const k of adj) {
			if (existingExtensions.has(k)) total++;
		}
		return total;
	}

	private buildPlacementLookup(): Map<string, StructurePlacement[]> {
		const lookup = new Map<string, StructurePlacement[]>();
		for (const placement of this.structurePlacements.values()) {
			this.registerPlacementInLookup(placement, lookup);
		}
		return lookup;
	}

	private registerPlacementInLookup(placement: StructurePlacement, lookup: Map<string, StructurePlacement[]> = this.placementLookup): void {
		const key = this.positionKey(placement.pos);
		const list = lookup.get(key) ?? [];
		list.push(placement);
		lookup.set(key, list);
	}

	private positionKey(pos: Pos): string {
		return `${pos.x},${pos.y}`;
	}

	private collectPositionsByStructure(structure: StructureConstant): Set<string> {
		const set = new Set<string>();
		for (const placement of this.structurePlacements.values()) {
			if (placement.structure === structure) {
				set.add(`${placement.pos.x},${placement.pos.y}`);
			}
		}
		return set;
	}

	private hasBlockingStructure(pos: Pos, lookup?: Map<string, StructurePlacement[]>): boolean {
		const blocking = this.findPlannedStructureAt(pos, lookup);
		return Boolean(blocking && blocking.structure !== STRUCTURE_ROAD);
	}

	private hasRoadAt(pos: Pos, roadSet: Set<string>, lookup?: Map<string, StructurePlacement[]>): boolean {
		const key = `${pos.x},${pos.y}`;
		if (roadSet.has(key)) return true;
		if (lookup) {
			const arr = lookup.get(key);
			if (arr && arr.some(p => p.structure === STRUCTURE_ROAD)) return true;
		}
		const planned = this.findPlannedStructureAt(pos, lookup);
		return planned?.structure === STRUCTURE_ROAD;
	}

	private findPlannedStructureAt(pos: Pos, lookup?: Map<string, StructurePlacement[]>): StructurePlacement | null {
		if (lookup) {
			const key = this.positionKey(pos);
			const existing = lookup.get(key);
			if (existing && existing.length > 0) {
				const nonRoad = existing.find(p => p.structure !== STRUCTURE_ROAD);
				return nonRoad ?? existing[0];
			}
		} else {
			for (const placement of this.structurePlacements.values()) {
				if (placement.pos.x === pos.x && placement.pos.y === pos.y) {
					return placement;
				}
			}
		}
		return null;
	}
	/* private allocateExtensionsByRCLGroup(): void {
		if (!this.startPos) return;

		// Extensions per RCL level (how many to build at each RCL)
		const extensionsPerRCL: { [key: number]: number } = {
			2: 5,
			3: 5,
			4: 10,
			5: 10,
			6: 10,
			7: 10,
			8: 10
		};

		// Find a corner of the core stamp to start placing extensions
		// Prefer a corner that doesn't conflict with labs or other structures
		const startCorner = this.findExtensionStartCorner();
		if (!startCorner) {
			console.log(`${this.room.link()} Warning: Could not find suitable starting corner for extensions`);
			return;
		}

		const used = new Set<string>();
		let placed = 0;

		// Place extensions in RCL-grouped clusters
		for (const rcl of [2, 3, 4, 5, 6, 7, 8]) {
			const extensionsForThisRCL = extensionsPerRCL[rcl];

			if (extensionsForThisRCL <= 0) continue;

			// Create a new cluster expanding outward from the core
			const clusterOrigin = this.findClusterOrigin(startCorner, used);
			const extensionsPlaced = this.placeExtensionCluster(
				clusterOrigin,
				extensionsForThisRCL,
				rcl,
				used
			);

			placed += extensionsPlaced;
		}

		console.log(`${this.room.link()} Placed ${placed} extensions in RCL-grouped clusters`);
	} */

	private placeExtensionPattern(
		origin: RoomPosition,
		pattern: { name: string; coords: { dx: number; dy: number }[] },
		rcl: number,
		used: Set<string>
	): number {
		if (!this.startPos) return 0;

		// Helpers: rotate/mirror transforms
		const transforms = [
			{ rot: 0, mirror: false },
			{ rot: 90, mirror: false },
			{ rot: 180, mirror: false },
			{ rot: 270, mirror: false },
			{ rot: 0, mirror: true },
			{ rot: 90, mirror: true },
			{ rot: 180, mirror: true },
			{ rot: 270, mirror: true }
		];

		// Check pattern fit for each transform and small offsets around origin (to make clusters adapt)
		for (const t of transforms) {
			for (let ox = -1; ox <= 1; ox++) {
				for (let oy = -1; oy <= 1; oy++) {
					const candidatePositions: { x: number; y: number }[] = [];

					let ok = true;
					for (const rc of pattern.coords) {
						let dx = rc.dx;
						let dy = rc.dy;

						// mirror horizontally if requested
						if (t.mirror) dx = -dx;

						// rotate
						let rx = dx;
						let ry = dy;
						const deg = t.rot;
						if (deg === 90) { rx = -dy; ry = dx; }
						else if (deg === 180) { rx = -dx; ry = -dy; }
						else if (deg === 270) { rx = dy; ry = -dx; }

						const x = origin.x + ox + rx;
						const y = origin.y + oy + ry;

						// bounds check & terrain check
						if (x < 1 || x > 48 || y < 1 || y > 48) { ok = false; break; }
						if (this.terrain.get(x, y) === TERRAIN_MASK_WALL) { ok = false; break; }

						const key = `${x},${y}`;
						if (this.structurePlacements.has(key) || used.has(key)) {
							ok = false; break;
						}

						// floodGrid check - prefer finite reachable positions (lower numeric cost is better)
						const floodVal = this.floodGrid?.[x]?.[y];
						const dtVal = this.dtGrid?.[x]?.[y];

						// accept if floodVal is defined and below a threshold OR dtVal >= 2 (enough open space)
						if ((floodVal === undefined || floodVal === 0 || floodVal >= 255) && (dtVal === undefined || dtVal < 2)) {
							// unreachable or cramped
							ok = false; break;
						}

						candidatePositions.push({ x, y });
					}

					if (!ok || candidatePositions.length === 0) continue;

					// Commit placements: extensions
					for (const pos of candidatePositions) {
						const key = `${pos.x},${pos.y}`;
						this.structurePlacements.set(key, {
							pos: { x: pos.x, y: pos.y },
							structure: STRUCTURE_EXTENSION,
							priority: 3,
							meta: { minRCL: rcl }
						});
						used.add(key);
					}

					// Place road ring: place roads on any adjacent walkable tiles around the cluster
					for (const pos of candidatePositions) {
						const adj = [
							{ x: pos.x + 1, y: pos.y },
							{ x: pos.x - 1, y: pos.y },
							{ x: pos.x, y: pos.y + 1 },
							{ x: pos.x, y: pos.y - 1 },
							// diagonals optional
							{ x: pos.x + 1, y: pos.y + 1 },
							{ x: pos.x - 1, y: pos.y + 1 },
							{ x: pos.x + 1, y: pos.y - 1 },
							{ x: pos.x - 1, y: pos.y - 1 }
						];

						for (const a of adj) {
							if (a.x < 1 || a.x > 48 || a.y < 1 || a.y > 48) continue;
							if (this.terrain.get(a.x, a.y) === TERRAIN_MASK_WALL) continue;

							const roadKey = `${a.x},${a.y}`;
							// don't overwrite higher-priority planned structures (spawns/storage)
							if (this.structurePlacements.has(roadKey)) continue;

							// Use lower build priority for roads tied to extension's RCL
							this.structurePlacements.set(roadKey + '_road', {
								pos: { x: a.x, y: a.y },
								structure: STRUCTURE_ROAD,
								priority: Math.max(9, 11 - rcl), // early roads get higher priority
								meta: { minRCL: rcl }
							});
						}
					}

					return candidatePositions.length;
				}
			}
		}

		// nothing placed
		return 0;
	}

	/**
	 * Find a suitable corner of the core stamp to start extension placement
	 * Avoids areas reserved for labs
	 * @returns Starting corner position or null
	 * @author randomencounter
	 */
	private findExtensionStartCorner(): RoomPosition | null {
		if (!this.startPos) return null;

		// Try different corners relative to the core center
		// Prefer lower-right or lower-left to keep extensions away from lab areas
		const corners = [
			{ dx: 4, dy: 4 },   // Lower-right
			{ dx: -4, dy: 4 },  // Lower-left
			{ dx: 4, dy: -4 },  // Upper-right
			{ dx: -4, dy: -4 }  // Upper-left
		];

		for (const corner of corners) {
			const x = this.startPos.x + corner.dx;
			const y = this.startPos.y + corner.dy;

			if (x < 2 || x > 47 || y < 2 || y > 47) continue;
			if (this.terrain.get(x, y) === TERRAIN_MASK_WALL) continue;

			const key = `${x},${y}`;
			if (!this.structurePlacements.has(key)) {
				return new RoomPosition(x, y, this.room.name);
			}
		}

		return null;
	}

	/**
	 * Find the origin position for a new extension cluster
	 * Keeps all clusters close to the core, near the starting corner
	 * Searches nearby spaces to find available positions for the next cluster
	 * @param initialCorner - Initial starting corner
	 * @param used - Set of already used positions
	 * @returns Origin position for the cluster
	 * @author randomencounter
	 */
	private findClusterOrigin(
		initialCorner: RoomPosition,
		used: Set<string>
	): RoomPosition | null {
		if (!this.startPos) return null;

		// Keep all extension clusters close to core, within 3-8 tiles
		// Search in expanding rings around the initial corner
		for (let searchRadius = 0; searchRadius <= 8; searchRadius++) {
			for (let dx = -searchRadius; dx <= searchRadius; dx++) {
				for (let dy = -searchRadius; dy <= searchRadius; dy++) {
					// Only check perimeter of current search radius
					if (searchRadius > 0 && Math.abs(dx) !== searchRadius && Math.abs(dy) !== searchRadius) {
						continue;
					}

					const x = initialCorner.x + dx;
					const y = initialCorner.y + dy;

					if (x < 2 || x > 47 || y < 2 || y > 47) continue;
					if (this.terrain.get(x, y) === TERRAIN_MASK_WALL) continue;

					const key = `${x},${y}`;
					if (!this.structurePlacements.has(key) && !used.has(key)) {
						return new RoomPosition(x, y, this.room.name);
					}
				}
			}
		}

		return null;
	}

	/**
	 * Place a cluster of extensions in a zigzag pattern
	 * Creates organized groups of 2-3 extensions placed vertically, then offset
	 * @param origin - Starting position for the cluster
	 * @param count - Number of extensions to place in this cluster
	 * @param rcl - RCL level for priority assignment
	 * @param used - Set of already used positions
	 * @returns Number of extensions actually placed
	 * @author randomencounter
	 */
	private placeExtensionCluster(
		origin: RoomPosition | null,
		count: number,
		rcl: number,
		used: Set<string>
	): number {
		if (!origin) return 0;

		let placed = 0;
		let current = origin;

		// Create a zigzag pattern: 2 vertical, offset right, 2 vertical, offset down, repeat
		let columnCount = 0;

		while (placed < count && columnCount < 30) {
			// Try to place 2-3 extensions in a vertical column
			const columnSize = placed % 2 === 0 ? 2 : 3; // Alternate 2 and 3 per column
			let columnPlaced = 0;

			for (let i = 0; i < columnSize && placed < count; i++) {
				const checkPos = new RoomPosition(current.x, current.y + i, this.room.name);

				if (
					checkPos.x < 1 || checkPos.x > 48 ||
					checkPos.y < 1 || checkPos.y > 48 ||
					this.terrain.get(checkPos.x, checkPos.y) === TERRAIN_MASK_WALL
				) {
					continue;
				}

				const key = `${checkPos.x},${checkPos.y}`;
				if (!this.structurePlacements.has(key) && !used.has(key)) {
					// Place extension with RCL-based priority
					this.structurePlacements.set(key, {
						pos: { x: checkPos.x, y: checkPos.y },
						structure: STRUCTURE_EXTENSION,
						priority: 3,
						meta: { minRCL: rcl }
					});
					used.add(key);
					placed++;
					columnPlaced++;
				}
			}

			// Move to next column position (offset to the right and down slightly)
			if (columnPlaced > 0) {
				current = new RoomPosition(current.x + 2, current.y + 1, this.room.name);
			} else {
				// If we couldn't place anything, try searching around
				let found = false;
				for (let searchDist = 1; searchDist <= 3 && !found; searchDist++) {
					for (let dx = -searchDist; dx <= searchDist; dx++) {
						for (let dy = -searchDist; dy <= searchDist; dy++) {
							const newPos = new RoomPosition(current.x + dx, current.y + dy, this.room.name);
							if (
								newPos.x < 1 || newPos.x > 48 ||
								newPos.y < 1 || newPos.y > 48 ||
								this.terrain.get(newPos.x, newPos.y) === TERRAIN_MASK_WALL
							) {
								continue;
							}

							const key = `${newPos.x},${newPos.y}`;
							if (!this.structurePlacements.has(key) && !used.has(key)) {
								current = newPos;
								found = true;
								break;
							}
						}
						if (found) break;
					}
				}

				if (!found) break; // No more space available
			}

			columnCount++;
		}

		return placed;
	}


	/**
	 * Step 7: Position labs for optimal reaction capabilities
	 * @author randomencounter
	 */
	private positionLabs(): void {
		if (!this.startPos) return;
		if (this.maxRCL < 6) return;

		// Find suitable location for lab stamp
		let bestPos: RoomPosition | null = null;
		let bestScore = -Infinity;

		for (let x = this.startPos.x - 10; x <= this.startPos.x + 10; x++) {
			for (let y = this.startPos.y - 10; y <= this.startPos.y + 10; y++) {
				if (x < 3 || x > 46 || y < 3 || y > 46) continue;

				const pos = new RoomPosition(x, y, this.room.name);
				if (!this.canPlaceStamp(pos, 3)) continue;

				// Check for conflicts with existing placements
				let hasConflict = false;
				for (let dx = -2; dx <= 2; dx++) {
					for (let dy = -2; dy <= 2; dy++) {
						const key = `${x + dx},${y + dy}`;
						if (this.structurePlacements.has(key)) {
							const existing = this.structurePlacements.get(key);
							if (existing && existing.structure !== STRUCTURE_ROAD) {
								hasConflict = true;
								break;
							}
						}
					}
					if (hasConflict) break;
				}

				if (!hasConflict) {
					const score = -pos.getRangeTo(this.startPos);
					if (score > bestScore) {
						bestScore = score;
						bestPos = pos;
					}
				}
			}
		}

		if (bestPos) {
			// Place lab stamp
			this.tryPlaceStamp(bestPos, LAB_STAMP, 0, false, true);
			console.log(`${this.room.link()} Labs positioned at ${bestPos}`);
		}
	}

	/**
	 * Step 8: Establish infrastructure (roads, containers, links)
	 * Prioritizes roads in this order:
	 * 1. Spawn/Storage to source containers (RCL 2-3)
	 * 2. Spawn/Storage to controller container (RCL 3)
	 * 3. Mineral container and extractor (RCL 6)
	 * 4. Extension paths (RCL 4+)
	 * @author randomencounter
	 */
	private establishInfrastructure(): void {
		if (!this.startPos) return;

		const sources = this.room.find(FIND_SOURCES);
		const mineral = this.room.find(FIND_MINERALS)[0];
		const storage = this.getPlacementByType(STRUCTURE_STORAGE);

		// PRIORITY 1: Create roads from storage to sources (critical at RCL 2-3)
		// These are essential for early game energy flow
		for (const source of sources) {
			// Find nearest position to source for road path
			const nearPos = this.findNearestOpenPosition(source.pos, 1);
			if (nearPos && storage) {
				// Create road path to source, mark with RCL 2 priority
				this.createRoadPathWithPriority(
					new RoomPosition(storage.pos.x, storage.pos.y, this.room.name),
					nearPos,
					2 // RCL 2 priority
				);
			}
		}

		// PRIORITY 2: Create roads to controller (critical at RCL 3)
		// Required for efficient controller upgrades
		if (this.room.controller && storage && this.controllerUpgradeArea.length > 0) {
			const controllerContainer = this.controllerUpgradeArea[4]; // Center of 3x3
			if (controllerContainer) {
				this.createRoadPathWithPriority(
					new RoomPosition(storage.pos.x, storage.pos.y, this.room.name),
					controllerContainer,
					1 // RCL 3 priority
				);
			}
		}

		// PRIORITY 3: Create roads to mineral (lower priority, RCL 6)
		if (mineral && storage) {
			const nearPos = this.findNearestOpenPosition(mineral.pos, 1);
			if (nearPos) {
				// Place container at mineral position
				const key = `${nearPos.x},${nearPos.y}`;
				this.structurePlacements.set(key + '_mineral_container', {
					pos: { x: nearPos.x, y: nearPos.y },
					structure: STRUCTURE_CONTAINER,
					priority: 2,
					meta: { type: 'mineral', minRCL: 6 }
				});

				// Place extractor on mineral
				this.structurePlacements.set(`${mineral.pos.x},${mineral.pos.y}_extractor`, {
					pos: { x: mineral.pos.x, y: mineral.pos.y },
					structure: STRUCTURE_EXTRACTOR,
					priority: 5,
					meta: { minRCL: 6 }
				});

				// Create road path with RCL 6 priority
				this.createRoadPathWithPriority(
					new RoomPosition(storage.pos.x, storage.pos.y, this.room.name),
					nearPos,
					5 // RCL 6 priority
				);
			}
		}
	}

	/**
	 * Helper: Create road path between two positions with RCL-based priority
	 * Lower RCL number = higher build priority
	 * @param from - Starting position
	 * @param to - Ending position
	 * @param rclPriority - RCL level at which these roads should be built (1-8)
	 * @author randomencounter
	 */
	private createRoadPathWithPriority(
		from: RoomPosition,
		to: RoomPosition,
		rclPriority: number
	): void {
		const path = from.findPathTo(to, {
			ignoreCreeps: true,
			ignoreRoads: true,
			swampCost: 2,
			plainCost: 2
		});

		for (const step of path) {
			const key = `${step.x},${step.y}`;
			if (!this.structurePlacements.has(key)) {
				// Map RCL to priority (lower RCL = higher priority in building)
				// RCL 1-3 get priority 9-10
				// RCL 4-6 get priority 11-12
				// RCL 7-8 get priority 13
				let roadPriority = 10;
				if (rclPriority <= 2) roadPriority = 9;
				else if (rclPriority <= 4) roadPriority = 11;
				else roadPriority = 12;

				this.structurePlacements.set(key + '_road', {
					pos: { x: step.x, y: step.y },
					structure: STRUCTURE_ROAD,
					priority: roadPriority,
					meta: { minRCL: rclPriority }
				});
			}
		}
	}

	/**
	 * Step 9: Optimize ramparts using minimum cut algorithm
	 * @author randomencounter
	 */
	private optimizeRamparts(): void {
		if (!this.startPos) return;
		if (this.maxRCL < 3) return;

		// Get core positions to protect
		const coresToProtect: RoomPosition[] = [];

		// Add spawn positions
		for (const [_, placement] of this.structurePlacements) {
			if (placement.structure === STRUCTURE_SPAWN) {
				coresToProtect.push(
					new RoomPosition(placement.pos.x, placement.pos.y, this.room.name)
				);
			}
		}

		// Add storage position
		const storage = this.getPlacementByType(STRUCTURE_STORAGE);
		if (storage) {
			coresToProtect.push(
				new RoomPosition(storage.pos.x, storage.pos.y, this.room.name)
			);
		}

		// Add controller if it exists
		if (this.room.controller) {
			coresToProtect.push(this.room.controller.pos);
		}

		if (coresToProtect.length > 0) {
			// Use minimum cut to find optimal rampart positions
			const result = getMinCut(this.room.name, coresToProtect, undefined);

			if (Array.isArray(result)) {
				this.ramparts = result;

				// Place ramparts
				for (const pos of result) {
					const key = `${pos.x},${pos.y}_rampart`;
					this.structurePlacements.set(key, {
						pos: { x: pos.x, y: pos.y },
						structure: STRUCTURE_RAMPART,
						priority: 8,
						meta: { minRCL: 3 }
					});

					// Also place roads on ramparts for mobility
					const roadKey = `${pos.x},${pos.y}_rampart_road`;
					if (!this.structurePlacements.has(roadKey)) {
						this.structurePlacements.set(roadKey, {
							pos: { x: pos.x, y: pos.y },
							structure: STRUCTURE_ROAD,
							priority: 9,
							meta: { minRCL: 3 }
						});
					}
				}

				console.log(`${this.room.link()} Placed ${result.length} ramparts using minimum cut`);
			}
		}
	}

	/**
	 * Step 10: Place towers for optimal coverage
	 * Towers are positioned to maximize rampart coverage while avoiding core area
	 * @author randomencounter
	 */
	private placeTowers(): void {
		if (!this.startPos) return;
		if (this.maxRCL < 3) return;

		const towerCount = 6; // RCL 8 max
		const towers: RoomPosition[] = [];

		// Calculate coverage scores for available positions
		const candidates: { pos: RoomPosition; score: number }[] = [];

		// Minimum distance from core center to prevent tower placement in core
		const CORE_EXCLUSION_RADIUS = 5;

		for (let x = 2; x < 48; x++) {
			for (let y = 2; y < 48; y++) {
				const key = `${x},${y}`;
				if (this.structurePlacements.has(key)) continue;
				if (this.terrain.get(x, y) === TERRAIN_MASK_WALL) continue;

				const pos = new RoomPosition(x, y, this.room.name);

				// Exclude core area - towers should not be placed near center
				const coreDistance = pos.getRangeTo(this.startPos);
				if (coreDistance < CORE_EXCLUSION_RADIUS) {
					continue;
				}

				// Calculate coverage score
				let score = 0;

				// Coverage of ramparts (highest priority)
				for (const rampart of this.ramparts) {
					const range = pos.getRangeTo(rampart);
					if (range <= 20) {
						score += (20 - range) * 2;
					}
				}

				// Coverage of core structures (secondary priority)
				score += Math.max(0, 25 - coreDistance);

				// Proximity to storage for refilling (tertiary priority)
				const storage = this.getPlacementByType(STRUCTURE_STORAGE);
				if (storage) {
					const storageRange = pos.getRangeTo(
						new RoomPosition(storage.pos.x, storage.pos.y, this.room.name)
					);
					score += Math.max(0, 10 - storageRange);
				}

				// Prefer positions that are not directly blocking movement paths
				// Penalty for being exactly on cardinal directions from core
				const dx = Math.abs(pos.x - this.startPos.x);
				const dy = Math.abs(pos.y - this.startPos.y);
				if (dx === 0 || dy === 0) {
					score -= 5; // Small penalty for being on main axes
				}

				candidates.push({ pos, score });
			}
		}

		// Sort by score and place towers
		candidates.sort((a, b) => b.score - a.score);

		for (let i = 0; i < Math.min(towerCount, candidates.length); i++) {
			const tower = candidates[i];
			const key = `${tower.pos.x},${tower.pos.y}`;

			this.structurePlacements.set(key, {
				pos: { x: tower.pos.x, y: tower.pos.y },
				structure: STRUCTURE_TOWER,
				priority: 2,
				meta: { minRCL: 3 }
			});

			towers.push(tower.pos);
		}

		console.log(`${this.room.link()} Placed ${towers.length} towers at distance > ${CORE_EXCLUSION_RADIUS} from core`);
	}

	/**
	 * Step 11: Place remaining structures (factory, nuker, observer)
	 * @author randomencounter
	 */
	private placeRemainingStructures(): void {
		if (this.maxRCL < 4) return; // nothing beyond early game

		// Observer - place anywhere within base
		if (this.maxRCL >= 8) this.placeStructureNearCore(STRUCTURE_OBSERVER, 15);

		// Additional spawns
		if (this.maxRCL >= 5) this.placeAdditionalSpawns();

		// Additional links
		if (this.maxRCL >= 5) this.placeAdditionalLinks();
	}

	/**
	 * Generate RCL-specific build schedule
	 * @returns Build schedule organized by RCL level
	 * @author randomencounter
	 */
	private generateRCLSchedule(): RCLSchedule {
		const schedule: RCLSchedule = {
			1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: []
		};

		// Count structures by type
		const structureCounts: Map<BuildableStructureConstant, StructurePlacement[]> = new Map();

		for (const [_, placement] of this.structurePlacements) {
			if (placement.meta?.minRCL && placement.meta.minRCL > this.maxRCL) continue;
			const type = placement.structure as BuildableStructureConstant;
			if (!structureCounts.has(type)) {
				structureCounts.set(type, []);
			}
			structureCounts.get(type)!.push(placement);
		}

		// Assign structures to RCL levels based on limits and priority
		for (const [type, placements] of structureCounts) {
			// Sort by priority
			placements.sort((a, b) => a.priority - b.priority);

			const limits = STRUCTURE_LIMITS[type];
			if (!limits) {
				console.log(`${this.room.link()} WARNING: No structure limits found for ${type}`);
				continue;
			}
			// Skip structures whose earliest allowable RCL is above our planning horizon
			const earliestAllowed = limits.findIndex(lim => lim > 0);
			if (earliestAllowed > this.maxRCL && earliestAllowed !== -1) {
				continue;
			}

			// Track how many of this structure type have been assigned to each RCL
			const assignedPerRCL: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0]; // index 0-8

			for (const placement of placements) {
				const minRCL = placement.meta?.minRCL || 1;
				if (minRCL > this.maxRCL) continue;

				// Find the earliest RCL where this can be placed
				let placed = false;
				for (let rcl = minRCL; rcl <= 8; rcl++) {
					if (rcl > this.maxRCL) break;
					const limit = limits[rcl];
					const alreadyAssigned = assignedPerRCL[rcl];

					// Check if we can add this structure at this RCL
					if (alreadyAssigned < limit) {
						schedule[rcl as RCLLevel].push(placement);
						// Update counts for this and all subsequent RCLs
						for (let r = rcl; r <= 8; r++) {
							assignedPerRCL[r]++;
						}
						placed = true;
						break;
					}
				}

				if (!placed) {
					console.log(`${this.room.link()} WARNING: Could not place ${type} at any RCL (minRCL: ${minRCL}, total needed: ${placements.length})`);
				}
			}

			// Log diagnostic info for extensions specifically
			if (type === STRUCTURE_EXTENSION) {
				console.log(`${this.room.link()} Extension scheduling: ${placements.length} total extensions generated`);
				for (let rcl = 1; rcl <= 8; rcl++) {
					if (schedule[rcl as RCLLevel].filter(p => p.structure === STRUCTURE_EXTENSION).length > 0) {
						console.log(`${this.room.link()}   RCL${rcl}: ${schedule[rcl as RCLLevel].filter(p => p.structure === STRUCTURE_EXTENSION).length} extensions (limit: ${limits[rcl]})`);
					}
				}
			}
		}

		// Special handling for containers that upgrade to links/storage
		this.handleContainerUpgrades(schedule);

		if (this.room.memory.basePlan) {
			this.room.memory.basePlan.scheduleSize = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };

			for (let i = 1; i <= 8; i++) {
				const rclGroup = Object.values(schedule);
				this.room.memory.basePlan.scheduleSize[i] = rclGroup.length;
			}
		}
		return schedule;
	}

	/**
	 * Handle special cases where containers upgrade to other structures
	 * @param schedule - RCL schedule to modify
	 * @author randomencounter
	 */
	private handleContainerUpgrades(schedule: RCLSchedule): void {
		// Find containers marked for upgrade
		for (const [key, placement] of this.structurePlacements) {
			if (placement.structure === STRUCTURE_CONTAINER && placement.meta?.upgradeTo) {
				const upgradeTo = placement.meta.upgradeTo;

				// Add container at RCL 1
				schedule[1].push(placement);

				// Add upgrade structure at appropriate RCL
				if (upgradeTo === STRUCTURE_LINK) {
					// Controller link at RCL 5, source links at RCL 6
					const rcl = placement.meta.type === 'controller' ? 5 : 6;
					if (rcl > this.maxRCL) continue;
					const limits = STRUCTURE_LIMITS[STRUCTURE_LINK];

					if (limits && limits[rcl] > 0) {
						schedule[rcl as RCLLevel].push({
							pos: placement.pos,
							structure: STRUCTURE_LINK,
							priority: placement.priority,
							meta: placement.meta
						});
					}
				} else if (upgradeTo === STRUCTURE_STORAGE && STRUCTURE_LIMITS[STRUCTURE_STORAGE]) {
					// Storage at RCL 4
					if (STRUCTURE_LIMITS[STRUCTURE_STORAGE][4] > 0 && this.maxRCL >= 4) {
						schedule[4].push({
							pos: placement.pos,
							structure: STRUCTURE_STORAGE,
							priority: 0,
							meta: placement.meta
						});
					}
				}
			}
		}

		// Handle storage location with container placeholder
		const storage = this.getPlacementByType(STRUCTURE_STORAGE);
		if (storage) {
			if (this.maxRCL < 1) return;
			// Place container one tile to the right of storage location for RCL 1-3
			const containerPlacement: StructurePlacement = {
				pos: { x: storage.pos.x + 1, y: storage.pos.y },
				structure: STRUCTURE_CONTAINER,
				priority: 0,
				meta: { type: 'storage_placeholder' }
			};

			// Add to RCL 1 if not already there
			if (!schedule[1].some(p => p.pos.x === storage.pos.x + 1 && p.pos.y === storage.pos.y)) {
				schedule[1].push(containerPlacement);
			}
		}
	}

	/**
	 * Helper: Get structure priority for build order
	 * @param structure - Structure type
	 * @returns Priority value (lower = higher priority)
	 * @author randomencounter
	 */
	private getStructurePriority(structure: StructureConstant): number {
		const priorities: { [key: string]: number } = {
			[STRUCTURE_SPAWN]: 0,
			[STRUCTURE_STORAGE]: 0,
			[STRUCTURE_CONTAINER]: 1,
			[STRUCTURE_EXTENSION]: 2,
			[STRUCTURE_TOWER]: 2,
			[STRUCTURE_LINK]: 3,
			[STRUCTURE_TERMINAL]: 3,
			[STRUCTURE_LAB]: 4,
			[STRUCTURE_EXTRACTOR]: 5,
			[STRUCTURE_FACTORY]: 6,
			[STRUCTURE_POWER_SPAWN]: 6,
			[STRUCTURE_NUKER]: 7,
			[STRUCTURE_OBSERVER]: 7,
			[STRUCTURE_RAMPART]: 8,
			[STRUCTURE_ROAD]: 10
		};

		return priorities[structure] ?? 10;
	}

	/**
	 * Helper: Find placement by structure type
	 * @param type - Structure type to find
	 * @returns First placement of given type or null
	 * @author randomencounter
	 */
	private getPlacementByType(type: StructureConstant): StructurePlacement | null {
		for (const [_, placement] of this.structurePlacements) {
			if (placement.structure === type) {
				return placement;
			}
		}
		return null;
	}

	/**
	 * Helper: Find nearest open position to target
	 * @param target - Target position
	 * @param range - Range from target
	 * @returns Nearest open position or null
	 * @author randomencounter
	 */
	private findNearestOpenPosition(target: RoomPosition, range: number): RoomPosition | null {
		const positions: RoomPosition[] = [];

		for (let dx = -range; dx <= range; dx++) {
			for (let dy = -range; dy <= range; dy++) {
				if (dx === 0 && dy === 0) continue;

				const x = target.x + dx;
				const y = target.y + dy;

				if (x < 1 || x > 48 || y < 1 || y > 48) continue;
				if (this.terrain.get(x, y) === TERRAIN_MASK_WALL) continue;

				const key = `${x},${y}`;
				if (!this.structurePlacements.has(key)) {
					positions.push(new RoomPosition(x, y, this.room.name));
				}
			}
		}

		// Sort by distance to target
		positions.sort((a, b) => a.getRangeTo(target) - b.getRangeTo(target));

		return positions[0] || null;
	}


	/**
	 * Helper: Place a structure near the core
	 * @param structure - Structure type to place
	 * @param maxRange - Maximum range from core
	 * @author randomencounter
	 */
	private placeStructureNearCore(structure: StructureConstant, maxRange: number): void {
		if (!this.startPos) return;
		if (structure === STRUCTURE_OBSERVER && this.maxRCL < 8) return;
		if (structure === STRUCTURE_POWER_SPAWN && this.maxRCL < 8) return;
		if (structure === STRUCTURE_NUKER && this.maxRCL < 8) return;
		if (structure === STRUCTURE_FACTORY && this.maxRCL < 7) return;
		if (structure === STRUCTURE_TERMINAL && this.maxRCL < 6) return;
		if (structure === STRUCTURE_LINK && this.maxRCL < 5) return;
		if (structure === STRUCTURE_TOWER && this.maxRCL < 3) return;

		for (let range = 3; range <= maxRange; range++) {
			for (let dx = -range; dx <= range; dx++) {
				for (let dy = -range; dy <= range; dy++) {
					// Only check perimeter
					if (Math.abs(dx) !== range && Math.abs(dy) !== range) continue;

					const x = this.startPos.x + dx;
					const y = this.startPos.y + dy;

					if (x < 1 || x > 48 || y < 1 || y > 48) continue;
					if (this.terrain.get(x, y) === TERRAIN_MASK_WALL) continue;

					const key = `${x},${y}`;
					if (!this.structurePlacements.has(key)) {
						this.structurePlacements.set(key, {
							pos: { x, y },
							structure,
							priority: this.getStructurePriority(structure)
						});
						return;
					}
				}
			}
		}
	}

	/**
	 * Helper: Place additional spawns at appropriate RCL levels
	 * @author randomencounter
	 */
	private placeAdditionalSpawns(): void {
		// Already have 3 spawns from core stamp, but verify they're placed correctly
		const spawnPlacements = Array.from(this.structurePlacements.values())
			.filter(p => p.structure === STRUCTURE_SPAWN);

		// If we somehow have less than 3 spawns, try to place more near core
		const spawnsNeeded = 3 - spawnPlacements.length;
		for (let i = 0; i < spawnsNeeded; i++) {
			this.placeStructureNearCore(STRUCTURE_SPAWN, 10);
		}
	}

	/**
	 * Helper: Place additional links at appropriate locations
	 * @author randomencounter
	 */
	private placeAdditionalLinks(): void {
		// We should already have:
		// - 1 link from core stamp
		// - 1 controller link (container upgrade)
		// - 2 source links (container upgrades)
		// Need to place 2 more for RCL 8 (total of 6)

		// Place additional links near labs or other important areas
		const linkCount = Array.from(this.structurePlacements.values())
			.filter(p => p.structure === STRUCTURE_LINK ||
				(p.structure === STRUCTURE_CONTAINER && p.meta?.upgradeTo === STRUCTURE_LINK))
			.length;

		const additionalLinks = 6 - linkCount;
		for (let i = 0; i < additionalLinks; i++) {
			this.placeStructureNearCore(STRUCTURE_LINK, 12);
		}
	}

	/**
	 * Draws planning visualizations
	 * @param room - Room to visualize
	 * @author randomencounter
	 */
	private drawPlanningVisuals(): void {
		if (this.room.memory.visuals?.showPlanning) {
			const visual = new RoomVisual(this.room.name);

			// Draw distance transform
			if (this.room.memory.visuals.basePlan.visDistTrans && this.dtGrid) {
				this.drawDistanceTransform(visual);
			}

			// Draw flood fill
			if (this.room.memory.visuals.basePlan.visFloodFill && this.floodGrid) {
				this.drawFloodFill(visual);
			}

			// Draw base layout
			if (this.room.memory.visuals.basePlan.visBasePlan) {
				this.drawBaseLayout(visual);
			}
		}
	}

	/**
	 * Draw distance transform visualization
	 * @param visual - Room visual to draw on
	 * @author randomencounter
	 */
	private drawDistanceTransform(visual: RoomVisual): void {
		const flatDt = this.dtGrid.reduce((acc, row) => acc.concat(row), [] as number[]);
		const max = Math.max(...flatDt);

		for (let x = 0; x < 50; x++) {
			for (let y = 0; y < 50; y++) {
				const val = this.dtGrid[x][y];
				if (val <= 0) continue;

				const intensity = val / max;
				const hue = 120 * intensity; // Green to red

				visual.rect(x - 0.5, y - 0.5, 1, 1, {
					fill: `hsl(${hue}, 100%, 50%)`,
					opacity: 0.3
				});

				if (val >= 3) {
					visual.text(val.toString(), x, y, {
						color: '#000',
						font: 0.4,
						align: 'center'
					});
				}
			}
		}
	}

	/**
	 * Draw flood fill visualization
	 * @param visual - Room visual to draw on
	 * @author randomencounter
	 */
	private drawFloodFill(visual: RoomVisual): void {
		const flatFlood = this.floodGrid.reduce((acc, row) => acc.concat(row), [] as number[]);
		const max = Math.max(...flatFlood.filter(v => v < 255));

		for (let x = 0; x < 50; x++) {
			for (let y = 0; y < 50; y++) {
				const val = this.floodGrid[x][y];
				if (val <= 0 || val >= 255) continue;

				const intensity = 1 - (val / max);
				const hue = 240 * intensity; // Blue to red

				visual.rect(x - 0.5, y - 0.5, 1, 1, {
					fill: `hsl(${hue}, 100%, 50%)`,
					opacity: 0.25
				});

				if (val <= 10) {
					visual.text(val.toString(), x, y, {
						color: '#fff',
						font: 0.3,
						align: 'center'
					});
				}
			}
		}
	}

	/**
	 * Draw base layout visualization
	 * @param visual - Room visual to draw on
	 * @author randomencounter
	 */
	private drawBaseLayout(visual: RoomVisual): void {
		for (const [_, placement] of this.structurePlacements) {
			const color = this.getStructureColor(placement.structure);
			const symbol = this.getStructureSymbol(placement.structure);

			visual.circle(placement.pos.x, placement.pos.y, {
				fill: color,
				opacity: 0.5,
				radius: 0.4
			});

			visual.text(symbol, placement.pos.x, placement.pos.y, {
				color: '#000',
				font: 0.5,
				align: 'center'
			});
		}

		// Highlight controller area
		for (const pos of this.controllerUpgradeArea) {
			visual.rect(pos.x - 0.45, pos.y - 0.45, 0.9, 0.9, {
				fill: '#ff0',
				opacity: 0.2,
				stroke: '#ff0'
			});
		}

		// Highlight ramparts
		for (const pos of this.ramparts) {
			visual.rect(pos.x - 0.5, pos.y - 0.5, 1, 1, {
				fill: 'transparent',
				stroke: '#0f0',
				strokeWidth: 0.1,
				opacity: 0.8
			});
		}
	}

	/**
	 * Get color for structure type
	 * @param structure - Structure type
	 * @returns Color string
	 * @author randomencounter
	 */
	private getStructureColor(structure: StructureConstant): string {
		const colors: { [key: string]: string } = {
			[STRUCTURE_SPAWN]: '#00f',
			[STRUCTURE_EXTENSION]: '#ff0',
			[STRUCTURE_ROAD]: '#666',
			[STRUCTURE_WALL]: '#333',
			[STRUCTURE_RAMPART]: '#0f0',
			[STRUCTURE_LINK]: '#0ff',
			[STRUCTURE_STORAGE]: '#fa0',
			[STRUCTURE_TOWER]: '#f00',
			[STRUCTURE_OBSERVER]: '#f0f',
			[STRUCTURE_POWER_SPAWN]: '#f0f',
			[STRUCTURE_EXTRACTOR]: '#888',
			[STRUCTURE_LAB]: '#fff',
			[STRUCTURE_TERMINAL]: '#0ff',
			[STRUCTURE_CONTAINER]: '#888',
			[STRUCTURE_NUKER]: '#f00',
			[STRUCTURE_FACTORY]: '#fff'
		};

		return colors[structure] ?? '#999';
	}



	private extensionPatterns: { name: string; coords: { dx: number; dy: number }[] }[] = [
		// single
		{ name: 'single', coords: [{ dx: 0, dy: 0 }] },

		// plus (center + four cardinal neighbors) => size 5
		{
			name: 'plus5',
			coords: [
				{ dx: 0, dy: 0 },
				{ dx: 0, dy: -1 },
				{ dx: 0, dy: 1 },
				{ dx: -1, dy: 0 },
				{ dx: 1, dy: 0 }
			]
		},

		// small line of three (vertical)
		{
			name: 'line3',
			coords: [
				{ dx: 0, dy: -1 },
				{ dx: 0, dy: 0 },
				{ dx: 0, dy: 1 }
			]
		},

		// zigzag 3 (L-ish)
		{
			name: 'zig3',
			coords: [
				{ dx: 0, dy: 0 },
				{ dx: 1, dy: 0 },
				{ dx: 1, dy: 1 }
			]
		},

		// small pent (approx compact 5)
		{
			name: 'compact5',
			coords: [
				{ dx: 0, dy: 0 },
				{ dx: 1, dy: 0 },
				{ dx: -1, dy: 0 },
				{ dx: 0, dy: 1 },
				{ dx: 0, dy: -1 }
			]
		},

		// size 6 (plus + one extra)
		{
			name: 'plus6',
			coords: [
				{ dx: 0, dy: 0 },
				{ dx: 0, dy: -1 },
				{ dx: 0, dy: 1 },
				{ dx: -1, dy: 0 },
				{ dx: 1, dy: 0 },
				{ dx: 1, dy: -1 }
			]
		},

		// size 7 (bigger compact group)
		{
			name: 'cluster7',
			coords: [
				{ dx: 0, dy: 0 },
				{ dx: 1, dy: 0 },
				{ dx: -1, dy: 0 },
				{ dx: 0, dy: 1 },
				{ dx: 0, dy: -1 },
				{ dx: 1, dy: -1 },
				{ dx: -1, dy: 1 }
			]
		}
	];

	/**
	 * Get symbol for structure type
	 * @param structure - Structure type
	 * @returns Symbol character
	 * @author randomencounter
	 */
	private getStructureSymbol(structure: StructureConstant): string {
		const symbols: { [key: string]: string } = {
			[STRUCTURE_SPAWN]: 'S',
			[STRUCTURE_EXTENSION]: 'E',
			[STRUCTURE_ROAD]: '·',
			[STRUCTURE_WALL]: 'W',
			[STRUCTURE_RAMPART]: 'R',
			[STRUCTURE_LINK]: 'L',
			[STRUCTURE_STORAGE]: 'St',
			[STRUCTURE_TOWER]: 'T',
			[STRUCTURE_OBSERVER]: 'O',
			[STRUCTURE_POWER_SPAWN]: 'P',
			[STRUCTURE_EXTRACTOR]: 'X',
			[STRUCTURE_LAB]: 'Lab',
			[STRUCTURE_TERMINAL]: 'Tm',
			[STRUCTURE_CONTAINER]: 'C',
			[STRUCTURE_NUKER]: 'N',
			[STRUCTURE_FACTORY]: 'F'
		};

		return symbols[structure] ?? '?';
	}
}

/**
 * Compute a checksum for a plan result to detect changes
 * @param plan - Plan result to checksum
 * @returns Checksum string
 * @author randomencounter
 */
export function computePlanChecksum(plan: PlanResult): string {
	let hash = 0;
	const str = JSON.stringify(plan.placements);

	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash; // Convert to 32-bit integer
	}

	return hash.toString(16);
}



// Type definitions

/* interface StampTemplate {
	size: number;
	structures: {
		dx: number;
		dy: number;
		structure: StructureConstant;
		meta?: any;
	}[];
}

interface StructurePlacement {
	pos: { x: number; y: number };
	structure: StructureConstant;
	priority: number;
	meta?: any;
}

interface PlanResult {
	startPos: RoomPosition;
	placements: StructurePlacement[];
	rclSchedule: RCLSchedule;
	ramparts: RoomPosition[];
	controllerArea: RoomPosition[];
	timestamp: number;
}

interface RCLSchedule {
	[rcl: number]: StructurePlacement[];
}

type RCLLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

// Add to Memory interface
interface RoomMemory {
	basePlan?: {
		lastGenerated: number;
		rclAtGeneration: number;
		checksum: string;
		data: PlanResult;
	};
	visuals: {
		showPlanning?: boolean;
		visDistTrans?: boolean;
		visFloodFill?: boolean;
		visBasePlan?: boolean;
	};
}

interface RoomData {
	basePlanGenerated?: boolean;
	[key: string]: any;
}
 */
