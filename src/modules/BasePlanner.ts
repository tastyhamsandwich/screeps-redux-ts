import { getDistanceTransform } from '../algorithms/distanceTransform';
import { getPositionsByPathCost } from '../algorithms/floodFill';
import { getMinCut } from '../algorithms/minCut';
import { calcPath } from '../functions/utils/globals';
import { STRUCTURE_PRIORITY } from '../functions/utils/constants';

type Placement = StructurePlacement;

type CenterPoint = { x: number; y: number };

const CORE_STAMP: StampTemplate = {
	size: 5,
	structures: [
		// Keep the first spawn centered above core, additional spawns flank it
		{ dx: 2, dy: 1, structure: STRUCTURE_SPAWN },
		{ dx: 1, dy: 1, structure: STRUCTURE_SPAWN },
		{ dx: 3, dy: 1, structure: STRUCTURE_SPAWN },
    { dx: 0, dy: 4, structure: STRUCTURE_EXTENSION },
    { dx: 4, dy: 4, structure: STRUCTURE_EXTENSION },
    { dx: 3, dy: 2, structure: STRUCTURE_LINK },
    { dx: 1, dy: 3, structure: STRUCTURE_STORAGE },
    { dx: 3, dy: 3, structure: STRUCTURE_POWER_SPAWN },
    { dx: 1, dy: 2, structure: STRUCTURE_TERMINAL },
    { dx: 2, dy: 4, structure: STRUCTURE_NUKER },
    { dx: 4, dy: 0, structure: STRUCTURE_FACTORY },
    // Roads around core ring
    { dx: 1, dy: 0, structure: STRUCTURE_ROAD },
    { dx: 2, dy: 0, structure: STRUCTURE_ROAD },
    { dx: 3, dy: 0, structure: STRUCTURE_ROAD },
    { dx: 2, dy: 3, structure: STRUCTURE_ROAD },
    { dx: 1, dy: 4, structure: STRUCTURE_ROAD },
    { dx: 3, dy: 4, structure: STRUCTURE_ROAD },
    { dx: 0, dy: 3, structure: STRUCTURE_ROAD },
    { dx: 0, dy: 2, structure: STRUCTURE_ROAD },
    { dx: 0, dy: 1, structure: STRUCTURE_ROAD },
    { dx: 4, dy: 1, structure: STRUCTURE_ROAD },
    { dx: 4, dy: 2, structure: STRUCTURE_ROAD },
    { dx: 4, dy: 3, structure: STRUCTURE_ROAD }
  ]
};

const LAB_STAMP: StampTemplate = {
  size: 7,
  structures: [
    { dx: 2, dy: 3, structure: STRUCTURE_LAB },
    { dx: 2, dy: 4, structure: STRUCTURE_LAB },
    { dx: 3, dy: 4, structure: STRUCTURE_LAB },
    { dx: 3, dy: 5, structure: STRUCTURE_LAB },
    { dx: 4, dy: 5, structure: STRUCTURE_LAB },
    { dx: 3, dy: 2, structure: STRUCTURE_LAB },
    { dx: 4, dy: 2, structure: STRUCTURE_LAB },
    { dx: 4, dy: 3, structure: STRUCTURE_LAB },
    { dx: 5, dy: 3, structure: STRUCTURE_LAB },
    { dx: 5, dy: 4, structure: STRUCTURE_LAB },
    // Road ring
    { dx: 5, dy: 5, structure: STRUCTURE_ROAD },
    { dx: 4, dy: 4, structure: STRUCTURE_ROAD },
    { dx: 3, dy: 3, structure: STRUCTURE_ROAD },
    { dx: 2, dy: 2, structure: STRUCTURE_ROAD },
    { dx: 1, dy: 3, structure: STRUCTURE_ROAD },
    { dx: 3, dy: 1, structure: STRUCTURE_ROAD },
    { dx: 4, dy: 6, structure: STRUCTURE_ROAD },
    { dx: 6, dy: 4, structure: STRUCTURE_ROAD },
    { dx: 6, dy: 3, structure: STRUCTURE_ROAD },
    { dx: 5, dy: 2, structure: STRUCTURE_ROAD },
    { dx: 4, dy: 1, structure: STRUCTURE_ROAD },
    { dx: 1, dy: 4, structure: STRUCTURE_ROAD },
    { dx: 2, dy: 5, structure: STRUCTURE_ROAD },
    { dx: 3, dy: 6, structure: STRUCTURE_ROAD }
  ]
};

/**
 * Automatic base planner that stamps a 5x5 core, lab cluster, extensions, roads, and defenses.
 * Inspired by Overmind/CommunePlanner, but tailored for this codebase and using bundled algorithms.
 */
export default class BasePlanner {
	private room: Room;
	private terrain: RoomTerrain;
	private reserved = new Set<string>();
	private placementCounter = 0;

  constructor(room: Room) {
    this.room = room;
    this.terrain = new Room.Terrain(room.name);
  }

	public plan(): PlanResult | null {
		const controller = this.room.controller;
		if (!controller) return null;
		this.room.memory.data ??= {} as any;
		this.room.log('BasePlanner.plan invoked');

		const dt = getDistanceTransform(this.room.name);
		const startPos = this.chooseCore(dt);
		if (!startPos) {
			this.room.log('BasePlanner failed to find a viable 5x5 core location', true);
			return null;
		}
		this.room.log(`BasePlanner chose startPos at ${startPos.x},${startPos.y}`);
		this.room.memory.data.centerPoint = { x: startPos.x, y: startPos.y } as CenterPoint;

    const dtGrid = this.costMatrixToGrid(dt);

    const placements: Placement[] = [];

    this.stampStructure(CORE_STAMP, startPos, placements, true);

    const controllerArea = this.planControllerArea(startPos, placements);

    const baseCostMatrix = this.buildWalkableMatrix();
    const floodFill = getPositionsByPathCost(this.room.name, [startPos], { costMatrix: baseCostMatrix, costThreshold: 254 });
    const floodGrid = this.costMatrixToGrid(floodFill);

    this.planSourcesAndMineral(startPos, placements);

    this.placeExtensions(floodGrid, placements);

    this.placeLabs(startPos, placements);

    this.placeTowers(startPos, placements);

    this.placeObserver(startPos, placements);

    const ramparts = this.planRamparts(startPos);

    const rclSchedule = this.buildRclSchedule(placements, ramparts);

    return {
      startPos,
      placements,
      rclSchedule,
      ramparts,
      controllerArea,
      timestamp: Game.time,
      dtGrid,
      floodFill: floodGrid
    };
  }

	private chooseCore(dt: CostMatrix): RoomPosition | null {
		// Prefer player-placed spawn: center is one tile south of the first spawn
		const existingSpawn = this.room.find(FIND_MY_SPAWNS)[0];
		if (existingSpawn) {
			const centerX = existingSpawn.pos.x;
			const centerY = Math.min(49, existingSpawn.pos.y + 1);
			if (this.areaIsWalkable(centerX - 2, centerY - 2, 5)) {
				return new RoomPosition(centerX, centerY, this.room.name);
			}
		}

		// If center was pre-chosen for remote expansion, honor it
		const storedCenter = (this.room.memory.data as any)?.centerPoint as CenterPoint | undefined;
		if (storedCenter && this.areaIsWalkable(storedCenter.x - 2, storedCenter.y - 2, 5)) {
			return new RoomPosition(storedCenter.x, storedCenter.y, this.room.name);
		}

		let best: { pos: RoomPosition; score: number } | null = null;
		const sources = this.room.find(FIND_SOURCES);
		const controller = this.room.controller;

		for (let x = 2; x <= 47; x++) {
			for (let y = 2; y <= 47; y++) {
				const centerVal = dt.get(x, y);
				if (centerVal < 3) continue;
				if (!this.areaIsWalkable(x - 2, y - 2, 5)) continue;

				const pos = new RoomPosition(x, y, this.room.name);

				const distCtrl = controller ? Math.max(1, pos.getRangeTo(controller)) : 25;
				const distSources = sources.reduce((acc, s) => acc + pos.getRangeTo(s), 0) / Math.max(1, sources.length);

				// Prefer open space (high dt) and proximity to controller/sources
				const score = distCtrl * 2 + distSources + (10 - centerVal) * 3;

				if (!best || score < best.score) best = { pos, score };
			}
		}

		return best?.pos ?? null;
	}

	private stampStructure(template: StampTemplate, center: RoomPosition, placements: Placement[], reserveOnly = false): void {
		const anchorX = center.x - Math.floor(template.size / 2);
		const anchorY = center.y - Math.floor(template.size / 2);

		for (const entry of template.structures) {
			const x = anchorX + entry.dx;
			const y = anchorY + entry.dy;
			if (!this.inRoom(x, y) || this.terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
			const key = this.key(x, y);
			if (this.reserved.has(key)) continue;
			this.reserved.add(key);
			if (reserveOnly) {
				placements.push({ structure: entry.structure, pos: { x, y }, priority: this.priority(entry.structure), meta: { order: this.placementCounter++ } });
			}
		}
	}

  private planControllerArea(core: RoomPosition, placements: Placement[]): RoomPosition[] {
    const controller = this.room.controller;
    if (!controller) return [];

    const candidates: RoomPosition[] = [];
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -3; dy <= 3; dy++) {
        const x = controller.pos.x + dx;
        const y = controller.pos.y + dy;
        if (!this.inRoom(x, y)) continue;
        if (this.terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
        const pos = new RoomPosition(x, y, this.room.name);
        if (pos.getRangeTo(controller) > 3) continue;
        if (pos.getRangeTo(core) > 15) continue;
        if (this.reserved.has(this.key(x, y))) continue;
        candidates.push(pos);
      }
    }

    candidates.sort((a, b) => a.getRangeTo(controller) - b.getRangeTo(controller) || a.getRangeTo(core) - b.getRangeTo(core));

    const center = candidates[0];
    if (!center) return [];

    const area: RoomPosition[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const x = center.x + dx;
        const y = center.y + dy;
        if (!this.inRoom(x, y) || this.terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
        const key = this.key(x, y);
        this.reserved.add(key);
        area.push(new RoomPosition(x, y, this.room.name));
      }
    }

    // Controller container (early RCL) and link (RCL5) at center tile
    placements.push({ structure: STRUCTURE_CONTAINER, pos: { x: center.x, y: center.y }, priority: this.priority(STRUCTURE_CONTAINER) });
    placements.push({ structure: STRUCTURE_LINK, pos: { x: center.x, y: center.y }, priority: this.priority(STRUCTURE_LINK) + 1 });

    // Road from core to controller area center
    const path = calcPath(core, center).path;
    for (const step of path) {
      const key = this.key(step.x, step.y);
      if (this.terrain.get(step.x, step.y) === TERRAIN_MASK_WALL || this.reserved.has(key)) continue;
      this.reserved.add(key);
      placements.push({ structure: STRUCTURE_ROAD, pos: { x: step.x, y: step.y }, priority: this.priority(STRUCTURE_ROAD) });
    }

    return area;
  }

  private planSourcesAndMineral(core: RoomPosition, placements: Placement[]): void {
    const storagePos = this.findPlacement(STRUCTURE_STORAGE, placements) || core;

    const sources = this.room.find(FIND_SOURCES);
    for (const source of sources) {
      this.placeHarvestPoint(core, storagePos, source.pos, placements, true);
    }

    const mineral = this.room.find(FIND_MINERALS)[0];
    if (mineral) {
      this.placeHarvestPoint(core, storagePos, mineral.pos, placements, false);
      placements.push({ structure: STRUCTURE_EXTRACTOR, pos: { x: mineral.pos.x, y: mineral.pos.y }, priority: this.priority(STRUCTURE_EXTRACTOR) });
    }
  }

  private placeHarvestPoint(core: RoomPosition, storagePos: RoomPosition, target: RoomPosition, placements: Placement[], includeLink: boolean): void {
    const adj = this.getWalkableAdjacent(target).sort((a, b) => a.getRangeTo(storagePos) - b.getRangeTo(storagePos));
    const containerSpot = adj[0];
    if (!containerSpot) return;
    const key = this.key(containerSpot.x, containerSpot.y);
    if (!this.reserved.has(key)) {
      this.reserved.add(key);
      placements.push({ structure: STRUCTURE_CONTAINER, pos: { x: containerSpot.x, y: containerSpot.y }, priority: this.priority(STRUCTURE_CONTAINER) });
    }

    if (includeLink) {
      const linkSpot = adj.find(p => p.getRangeTo(target) <= 2 && p.getRangeTo(storagePos) <= containerSpot.getRangeTo(storagePos) + 2);
      if (linkSpot && !this.reserved.has(this.key(linkSpot.x, linkSpot.y))) {
        this.reserved.add(this.key(linkSpot.x, linkSpot.y));
        placements.push({ structure: STRUCTURE_LINK, pos: { x: linkSpot.x, y: linkSpot.y }, priority: this.priority(STRUCTURE_LINK) });
      }
    }

    // Road from storage/core to container
    const path = calcPath(storagePos, containerSpot).path;
    for (const step of path) {
      const skey = this.key(step.x, step.y);
      if (this.terrain.get(step.x, step.y) === TERRAIN_MASK_WALL || this.reserved.has(skey)) continue;
      this.reserved.add(skey);
      placements.push({ structure: STRUCTURE_ROAD, pos: { x: step.x, y: step.y }, priority: this.priority(STRUCTURE_ROAD) });
    }
  }

  private placeExtensions(floodGrid: number[][], placements: Placement[]): void {
    const limit = CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][8] || 60;
    let count = placements.filter(p => p.structure === STRUCTURE_EXTENSION).length;

    const coords: Array<{ x: number; y: number; cost: number }> = [];
    for (let x = 1; x < 49; x++) {
      for (let y = 1; y < 49; y++) {
        const cost = floodGrid[x]?.[y];
        if (cost === undefined || cost === 0 || cost >= 200) continue;
        coords.push({ x, y, cost });
      }
    }

    coords.sort((a, b) => a.cost - b.cost);

    for (const c of coords) {
      if (count >= limit) break;
      if (this.terrain.get(c.x, c.y) === TERRAIN_MASK_WALL) continue;
      const key = this.key(c.x, c.y);
      if (this.reserved.has(key)) continue;
      this.reserved.add(key);
      placements.push({ structure: STRUCTURE_EXTENSION, pos: { x: c.x, y: c.y }, priority: this.priority(STRUCTURE_EXTENSION) });
      count++;
    }
  }

  private placeLabs(core: RoomPosition, placements: Placement[]): void {
    const anchor = this.findStampAnchor(LAB_STAMP, core, 5);
    if (!anchor) return;
    this.stampStructure(LAB_STAMP, anchor, placements, true);
  }

	private placeTowers(core: RoomPosition, placements: Placement[]): void {
		const desired = CONTROLLER_STRUCTURES[STRUCTURE_TOWER][8] || 6;
		let count = placements.filter(p => p.structure === STRUCTURE_TOWER).length;
		const offsets = [
			{ dx: -3, dy: 0 },
			{ dx: 3, dy: 0 },
			{ dx: 0, dy: -3 },
			{ dx: 0, dy: 3 },
			{ dx: -4, dy: -2 },
			{ dx: 4, dy: 2 }
		];

		for (const off of offsets) {
			if (count >= desired) break;
			const x = core.x + off.dx;
			const y = core.y + off.dy;
			if (!this.inRoom(x, y) || this.terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
			const key = this.key(x, y);
			if (this.reserved.has(key)) continue;
			this.reserved.add(key);
			placements.push({ structure: STRUCTURE_TOWER, pos: { x, y }, priority: this.priority(STRUCTURE_TOWER) });
			count++;
		}

		// Fallback: if no tower placed yet (e.g., offsets blocked), scan nearby tiles
		if (count < desired) {
			for (let radius = 2; radius <= 7 && count < desired; radius++) {
				for (let dx = -radius; dx <= radius && count < desired; dx++) {
					for (let dy = -radius; dy <= radius && count < desired; dy++) {
						if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue; // ring only
						const x = core.x + dx;
						const y = core.y + dy;
						if (!this.inRoom(x, y) || this.terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
						const key = this.key(x, y);
						if (this.reserved.has(key)) continue;
						this.reserved.add(key);
						placements.push({ structure: STRUCTURE_TOWER, pos: { x, y }, priority: this.priority(STRUCTURE_TOWER) });
						count++;
					}
				}
			}
		}
	}

  private placeObserver(core: RoomPosition, placements: Placement[]): void {
    const x = Math.min(48, core.x + 5);
    const y = Math.min(48, core.y + 5);
    if (!this.inRoom(x, y) || this.terrain.get(x, y) === TERRAIN_MASK_WALL) return;
    const key = this.key(x, y);
    if (this.reserved.has(key)) return;
    this.reserved.add(key);
    placements.push({ structure: STRUCTURE_OBSERVER, pos: { x, y }, priority: this.priority(STRUCTURE_OBSERVER) });
  }

  private planRamparts(core: RoomPosition): RoomPosition[] {
    const sources = this.room.find(FIND_SOURCES).map(s => s.pos);
    const protect: RoomPosition[] = [core];
    if (this.room.controller) protect.push(this.room.controller.pos);
    protect.push(...sources);

    const cuts = getMinCut(this.room.name, protect);
    if (!Array.isArray(cuts)) return [];
    for (const cut of cuts) {
      this.reserved.add(this.key(cut.x, cut.y));
    }
    return cuts;
  }

	private buildRclSchedule(placements: Placement[], ramparts: RoomPosition[]): RCLSchedule {
		const schedule: RCLSchedule = {};
		for (let rcl = 1; rcl <= 8; rcl++) schedule[rcl] = [];

    // Include ramparts as placements for RCL 6+
    const placementWithRamparts: Placement[] = placements.slice();
    for (const rampart of ramparts) {
      placementWithRamparts.push({ structure: STRUCTURE_RAMPART, pos: { x: rampart.x, y: rampart.y }, priority: this.priority(STRUCTURE_RAMPART) });
    }

    const byType = new Map<StructureConstant, Placement[]>();
    for (const placement of placementWithRamparts) {
      const arr = byType.get(placement.structure as StructureConstant) ?? [];
      arr.push(placement);
      byType.set(placement.structure as StructureConstant, arr);
    }

		for (const [type, list] of byType.entries()) {
			const limit = this.structureLimit(type);
			let placedCount = 0;
			const ordered = list.sort((a, b) => a.priority - b.priority || ((a.meta?.order ?? 0) - (b.meta?.order ?? 0)));
			for (let rcl = 1; rcl <= 8; rcl++) {
				const allowed = limit[rcl] ?? 0;
				while (placedCount < Math.min(allowed, ordered.length)) {
					schedule[rcl]!.push(ordered[placedCount]);
					placedCount++;
				}
			}
    }

    // Sort each level by STRUCTURE_PRIORITY so spawns/storage go first
    for (let rcl = 1; rcl <= 8; rcl++) {
      schedule[rcl] = schedule[rcl]!.sort((a, b) => this.priority(a.structure) - this.priority(b.structure));
    }

    return schedule;
  }

  private findStampAnchor(template: StampTemplate, near: RoomPosition, maxRadius: number): RoomPosition | null {
    for (let radius = 2; radius <= maxRadius; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          const x = near.x + dx;
          const y = near.y + dy;
          if (!this.areaIsWalkable(x - Math.floor(template.size / 2), y - Math.floor(template.size / 2), template.size)) continue;
          if (!this.inRoom(x, y)) continue;
          return new RoomPosition(x, y, this.room.name);
        }
      }
    }
    return null;
  }

  private buildWalkableMatrix(): CostMatrix {
    const cm = new PathFinder.CostMatrix();
    for (let x = 0; x < 50; x++) {
      for (let y = 0; y < 50; y++) {
        cm.set(x, y, this.terrain.get(x, y) === TERRAIN_MASK_WALL ? 255 : 1);
      }
    }
    return cm;
  }

  private getWalkableAdjacent(pos: RoomPosition): RoomPosition[] {
    const out: RoomPosition[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const x = pos.x + dx;
        const y = pos.y + dy;
        if (!this.inRoom(x, y) || this.terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
        out.push(new RoomPosition(x, y, this.room.name));
      }
    }
    return out;
  }

  private areaIsWalkable(x: number, y: number, size: number): boolean {
    for (let dx = 0; dx < size; dx++) {
      for (let dy = 0; dy < size; dy++) {
        const px = x + dx;
        const py = y + dy;
        if (!this.inRoom(px, py) || this.terrain.get(px, py) === TERRAIN_MASK_WALL) return false;
      }
    }
    return true;
  }

  private costMatrixToGrid(cm: CostMatrix): number[][] {
    const grid: number[][] = Array.from({ length: 50 }, () => Array(50).fill(0));
    for (let x = 0; x < 50; x++) {
      for (let y = 0; y < 50; y++) {
        grid[x][y] = cm.get(x, y);
      }
    }
    return grid;
  }

  private priority(structure: StructureConstant): number {
    return STRUCTURE_PRIORITY[structure] ?? 50;
  }

  private key(x: number, y: number): string {
    return `${x},${y}`;
  }

  private inRoom(x: number, y: number): boolean {
    return x >= 0 && x <= 49 && y >= 0 && y <= 49;
  }

  private findPlacement(structure: StructureConstant, placements: Placement[]): RoomPosition | null {
    const match = placements.find(p => p.structure === structure);
    return match ? new RoomPosition(match.pos.x, match.pos.y, this.room.name) : null;
  }

	private structureLimit(structure: StructureConstant): { [rcl: number]: number } {
		// Roads are deferred until RCL3 so source/storage/controller paths unlock together
		if (structure === STRUCTURE_ROAD) return { 1: 0, 2: 0, 3: 1000, 4: 2000, 5: 3000, 6: 3500, 7: 4000, 8: 4500 };
		if (structure === STRUCTURE_RAMPART) return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 300, 7: 300, 8: 300 };
		const limits = CONTROLLER_STRUCTURES[structure];
		const out: { [rcl: number]: number } = {};
		for (let rcl = 1; rcl <= 8; rcl++) out[rcl] = (limits && limits[rcl]) || 0;
		return out;
	}
}
