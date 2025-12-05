type Pos = { x: number; y: number };

type RawOffset = { x?: number; y?: number; dx?: number; dy?: number; X?: number; Y?: number };

type RawSubStamp = {
	stamp: string;
	placedAt?: RawOffset;
	mirrorVert?: boolean;
	mirrorHoriz?: boolean;
	rotate90?: number;
	buildRoads?: boolean;
};

type RawStampBody = {
	anchorPoint?: Pos;
	centerPoint?: Pos;
	centerSquare?: Pos[];
	stampDims?: { width?: number; height?: number };
	structures?: Record<string, RawOffset[]>;
	subStampsUsed?: RawSubStamp[];
};

export interface ParsedStructurePlacement {
	structure: BuildableStructureConstant;
	pos: Pos;
	offset: { dx: number; dy: number };
}

export interface ParsedSubStamp {
	stamp: string;
	placedAt: Pos;
	mirrorVert: boolean;
	mirrorHoriz: boolean;
	rotate90: number;
	buildRoads: boolean;
}

export interface ParsedStamp {
	name: string;
	anchorPoint: Pos;
	stampWidth: number;
	stampHeight: number;
	centerPoint?: Pos;
	centerSquare?: Pos[];
	rotationOrigin: Pos;
	placements: ParsedStructurePlacement[];
	subStampsUsed?: ParsedSubStamp[];
}

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
