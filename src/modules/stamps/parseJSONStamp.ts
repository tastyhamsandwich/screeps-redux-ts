import { EncodedSymbols, stringToConstant } from '@modules/stamps/stringEncoded';

const STRUCTURE_TO_SYMBOL: Partial<Record<StructureConstant, EncodedSymbols>> = {
	[STRUCTURE_EXTENSION]: 'x',
	[STRUCTURE_TOWER]: 'T',
	[STRUCTURE_ROAD]: '-',
	[STRUCTURE_SPAWN]: 'S',
	[STRUCTURE_TERMINAL]: '^',
	[STRUCTURE_STORAGE]: '8',
	[STRUCTURE_LINK]: 'L',
	[STRUCTURE_CONTAINER]: 'C',
	[STRUCTURE_NUKER]: 'N',
	[STRUCTURE_OBSERVER]: 'O',
	[STRUCTURE_FACTORY]: 'F',
	[STRUCTURE_EXTRACTOR]: 'E',
	[STRUCTURE_POWER_SPAWN]: 'P',
	[STRUCTURE_LAB]: 'B',
	[STRUCTURE_WALL]: '%',
	[STRUCTURE_RAMPART]: 'R',
	[STRUCTURE_CONTROLLER]: '$',
};

const NAME_TO_STRUCTURE: Record<string, BuildableStructureConstant> = {
	extension: STRUCTURE_EXTENSION,
	road: STRUCTURE_ROAD,
	spawn: STRUCTURE_SPAWN,
	terminal: STRUCTURE_TERMINAL,
	storage: STRUCTURE_STORAGE,
	link: STRUCTURE_LINK,
	container: STRUCTURE_CONTAINER,
	nuker: STRUCTURE_NUKER,
	observer: STRUCTURE_OBSERVER,
	factory: STRUCTURE_FACTORY,
	extractor: STRUCTURE_EXTRACTOR,
	powerSpawn: STRUCTURE_POWER_SPAWN,
	powerspawn: STRUCTURE_POWER_SPAWN,
	lab: STRUCTURE_LAB,
	wall: STRUCTURE_WALL,
	rampart: STRUCTURE_RAMPART,
};

export function parseJSONStamp(rawStamp: Record<string, unknown>): ParsedStamp {
	const [stampName, stampBody] = Object.entries(rawStamp)[0] ?? [];
	if (!stampName || !stampBody || typeof stampBody !== 'object') {
		throw new Error('parseJSONStamp expected a JSON object with a single stamp definition');
	}

	const body = stampBody as RawStampBody;

	const stampWidth = toNumber(body.stampDims?.width);
	const stampHeight = toNumber(body.stampDims?.height);

	const centerPoint = body.centerPoint ? normalizePos(body.centerPoint) : undefined;
	const centerSquare = Array.isArray(body.centerSquare) ? body.centerSquare.map(p => normalizePos(p)) : undefined;

	const anchorPoint = body.anchorPoint
		? normalizePos(body.anchorPoint)
		: centerPoint && stampWidth > 0 && stampHeight > 0
			? {
				x: centerPoint.x - Math.floor(stampWidth / 2),
				y: centerPoint.y - Math.floor(stampHeight / 2),
			}
			: { x: 0, y: 0 };

	const origin = body.anchorPoint ? anchorPoint : centerPoint ?? anchorPoint;

	const placements = parseStructures(body.structures ?? {}, origin);

	// If centerSquare is provided, rotation/mirroring uses the square's midpoint rather than a single tile.
	const rotationOrigin = centerSquare?.length
		? calcBlockCenter(centerSquare)
		: centerPoint ?? { x: anchorPoint.x + stampWidth / 2, y: anchorPoint.y + stampHeight / 2 };

	const subStampsUsed = body.subStampsUsed ? parseSubStamps(body.subStampsUsed) : undefined;

	return {
		name: stampName,
		anchorPoint,
		stampWidth,
		stampHeight,
		centerPoint,
		centerSquare,
		rotationOrigin,
		placements,
		subStampsUsed,
	};
}

export function jsonToString(parsedStamp: ParsedStamp, opts?: StampTransformOptions): string[] {
	const includeRoads = opts?.buildRoads ?? true;
	const width = parsedStamp.stampWidth;
	const height = parsedStamp.stampHeight;
	const grid: string[][] = Array.from({ length: height }, () => Array(width).fill('.'));

	for (const placement of parsedStamp.placements) {
		const structure = coerceStructureConstant(placement.structure);
		if (!structure) continue;
		if (!includeRoads && structure === STRUCTURE_ROAD) continue;
		const symbol = STRUCTURE_TO_SYMBOL[structure];
		if (!symbol) continue;

		const transformed = transformPosition(placement.pos, parsedStamp.rotationOrigin, opts);
		const gx = Math.round(transformed.x - parsedStamp.anchorPoint.x);
		const gy = Math.round(transformed.y - parsedStamp.anchorPoint.y);
		if (gx < 0 || gy < 0 || gx >= width || gy >= height) continue;

		grid[gy][gx] = symbol;
	}

	return grid.map(row => row.join(''));
}

export function jsonToConstant(parsedStamp: ParsedStamp, opts?: StampTransformOptions): Array<{ structure: BuildableStructureConstant; pos: Pos }> {
	const anchor = opts?.anchor ?? { x: 0, y: 0 };
	const includeRoads = opts?.buildRoads ?? true;
	const rows = jsonToString(parsedStamp, opts);
	const placements: Array<{ structure: BuildableStructureConstant; pos: Pos }> = [];

	rows.forEach((row, y) => {
		const constants = stringToConstant(row);
		constants.forEach((structure, x) => {
			if (!structure) return;
			if (!includeRoads && structure === STRUCTURE_ROAD) return;
			if (!isBuildable(structure)) return;
			placements.push({
				structure: structure as BuildableStructureConstant,
				pos: { x: anchor.x + x, y: anchor.y + y }
			});
		});
	});

	return placements;
}

export function placeJSONStamp(
	room: Room,
	parsedStamp: ParsedStamp,
	anchor: Pos,
	opts?: StampTransformOptions & { allowRoadOverlap?: boolean; debug?: boolean }
): { placed: number; failed: number; errors: string[] } {
	const placements = jsonToConstant(parsedStamp, { ...opts, anchor, buildRoads: opts?.buildRoads ?? true });
	const allowRoadOverlap = opts?.allowRoadOverlap ?? true;

	const seen = new Set<string>();
	let placed = 0;
	let failed = 0;
	const errors: string[] = [];

	for (const placement of placements) {
		const key = `${placement.pos.x},${placement.pos.y},${placement.structure}`;
		if (seen.has(key) && (placement.structure !== STRUCTURE_ROAD || !allowRoadOverlap)) continue;
		seen.add(key);

		if (!inRoomBounds(placement.pos)) {
			failed++;
			errors.push(`${placement.structure}@${placement.pos.x},${placement.pos.y}: out of bounds`);
			continue;
		}

		if (placement.structure === STRUCTURE_ROAD) {
			const existingRoad = room.lookForAt(LOOK_STRUCTURES, placement.pos.x, placement.pos.y).some(s => s.structureType === STRUCTURE_ROAD);
			const roadSite = room.lookForAt(LOOK_CONSTRUCTION_SITES, placement.pos.x, placement.pos.y).some(s => s.structureType === STRUCTURE_ROAD);
			if (existingRoad || roadSite) continue;
		}

		const existingSite = room.lookForAt(LOOK_CONSTRUCTION_SITES, placement.pos.x, placement.pos.y).some(s => s.structureType === placement.structure);
		const existingStruct = room.lookForAt(LOOK_STRUCTURES, placement.pos.x, placement.pos.y).some(s => s.structureType === placement.structure);
		if (existingSite || existingStruct) continue;

		const pos = new RoomPosition(placement.pos.x, placement.pos.y, room.name);
		const result = room.createConstructionSite(pos, placement.structure);
		if (result === OK) {
			placed++;
			if (opts?.debug && room.log) room.log(`Stamp site ${placement.structure} @ ${pos.x},${pos.y} placed`);
		} else {
			failed++;
			errors.push(`${placement.structure}@${placement.pos.x},${placement.pos.y} -> ${result}`);
		}
	}

	return { placed, failed, errors };
}

function parseStructures(structures: Record<string, RawOffset[]>, origin: Pos): ParsedStructurePlacement[] {
	const placements: ParsedStructurePlacement[] = [];

	for (const [structureName, coords] of Object.entries(structures)) {
		if (!Array.isArray(coords)) continue;

		for (const coord of coords) {
			const offset = normalizeOffset(coord);
			placements.push({
				structure: structureName as BuildableStructureConstant,
				pos: { x: origin.x + offset.dx, y: origin.y + offset.dy },
				offset,
			});
		}
	}

	return placements;
}

function parseSubStamps(subStamps: RawSubStamp[]): ParsedSubStamp[] {
	return subStamps.map(sub => ({
		stamp: sub.stamp,
		placedAt: normalizePos(sub.placedAt ?? { x: 0, y: 0 }),
		mirrorVert: Boolean(sub.mirrorVert),
		mirrorHoriz: Boolean(sub.mirrorHoriz),
		rotate90: toNumber(sub.rotate90),
		buildRoads: Boolean(sub.buildRoads),
	}));
}

function normalizePos(pos: RawOffset): Pos {
	return {
		x: toNumber(pos.x ?? pos.X),
		y: toNumber(pos.y ?? pos.Y),
	};
}

function normalizeOffset(offset: RawOffset): { dx: number; dy: number } {
	return {
		dx: toNumber(offset.dx ?? offset.x ?? offset.X),
		dy: toNumber(offset.dy ?? offset.y ?? offset.Y),
	};
}

function calcBlockCenter(points: Pos[]): Pos {
	const xs = points.map(p => p.x);
	const ys = points.map(p => p.y);
	return {
		x: (Math.min(...xs) + Math.max(...xs)) / 2,
		y: (Math.min(...ys) + Math.max(...ys)) / 2,
	};
}

function toNumber(value: number | string | undefined, fallback = 0): number {
	if (typeof value === 'number') return value;
	if (typeof value === 'string') {
		const parsed = parseFloat(value);
		return Number.isFinite(parsed) ? parsed : fallback;
	}
	return fallback;
}

function transformPosition(pos: Pos, origin: Pos, opts?: StampTransformOptions): Pos {
	let x = pos.x;
	let y = pos.y;
	if (opts?.mirrorHoriz) x = origin.x - (x - origin.x);
	if (opts?.mirrorVert) y = origin.y - (y - origin.y);
	const rotations = ((opts?.rotate90 ?? 0) % 4 + 4) % 4;
	for (let i = 0; i < rotations; i++) {
		const relX = x - origin.x;
		const relY = y - origin.y;
		x = origin.x + relY;
		y = origin.y - relX;
	}
	return { x, y };
}

function coerceStructureConstant(structure: BuildableStructureConstant | string): BuildableStructureConstant | null {
	const normalized = typeof structure === 'string' ? structure : (structure as any).toString();
	return NAME_TO_STRUCTURE[normalized] ?? NAME_TO_STRUCTURE[normalized.toLowerCase()] ?? (structure as BuildableStructureConstant) ?? null;
}

function inRoomBounds(pos: Pos): boolean {
	return pos.x >= 0 && pos.x <= 49 && pos.y >= 0 && pos.y <= 49;
}

function isBuildable(structure: StructureConstant): structure is BuildableStructureConstant {
	return structure !== STRUCTURE_CONTROLLER;
}
