
/**
 *
 * @param {string} roomName - roomName to do mincut
 * @param {Array} sources - positions to keep safe
 * @param {CostMatrix} costMatrix - costMatrix to use. tiles with 255 cost are treated like wall
 * @returns {[RoomPosition]} array of position of cuts
 */
export function getMinCut(
	roomName: string,
	sources: RoomPosition[],
	costMatrix?: CostMatrix
): RoomPosition[] | number {
	const terrain = Game.map.getRoomTerrain(roomName);

	if (costMatrix === undefined) {
		costMatrix = new PathFinder.CostMatrix();
		for (let x = 0; x < 50; x++) {
			for (let y = 0; y < 50; y++) {
				if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
					costMatrix.set(x, y, 255);
					continue;
				}
				costMatrix.set(x, y, 1);
			}
		}
	}

	// Find all exit tiles
	const exitCoords: Array<{ x: number; y: number }> = [];

	for (let x = 1; x < 49; x++) {
		for (const y of [0, 49]) {
			if (terrain.get(x, y) !== TERRAIN_MASK_WALL) {
				exitCoords.push({ x, y });
			}
		}
	}

	for (let y = 1; y < 49; y++) {
		for (const x of [0, 49]) {
			if (terrain.get(x, y) !== TERRAIN_MASK_WALL) {
				exitCoords.push({ x, y });
			}
		}
	}

	const exit = new Uint8Array(MAX_NODE);

	// Mark tiles near exits
	for (const exitCoord of exitCoords) {
		const minX = Math.max(0, exitCoord.x - 2);
		const maxX = Math.min(49, exitCoord.x + 2);
		const minY = Math.max(0, exitCoord.y - 2);
		const maxY = Math.min(49, exitCoord.y + 2);

		for (let x = minX; x <= maxX; x++) {
			for (let y = minY; y <= maxY; y++) {
				if (costMatrix.get(x, y) === 255) continue;
				exit[packPosToVertice(x, y) | OUT_NODE] = 1;
			}
		}
	}

	// Validate source positions
	const sourceVertices = new Set<number>();

	for (const coord of sources) {
		const vertice = packPosToVertice(coord.x, coord.y);

		if (exit[vertice]) {
			console.log(`Invalid source ${coord.x}, ${coord.y}`);
			return ERR_NOT_FOUND;
		}

		if (costMatrix.get(coord.x, coord.y) === 255) continue;
		sourceVertices.add(vertice);
	}

	// Setup capacity map
	const capacityMap = new Int32Array(1 << 17);
	capacityMap.fill(0);

	for (let y = 0; y < 50; y++) {
		for (let x = 0; x < 50; x++) {
			if (costMatrix.get(x, y) === 255) continue;

			const vertice = packPosToVertice(x, y);
			capacityMap[vertice | INSIDE_EDGE] = costMatrix.get(x, y);

			for (let direction = 0; direction < EIGHT_DELTA.length; direction++) {
				const nextPoint = pointAdd({ x, y }, EIGHT_DELTA[direction]);
				if (!isPointInRoom(nextPoint)) continue;
				if (costMatrix.get(nextPoint.x, nextPoint.y) === 255) continue;

				capacityMap[vertice | OUT_NODE | (direction << DIR_SHIFT)] = 10000;
			}
		}
	}

	// Run max-flow min-cut algorithm
	let i = 0;
	let levels: Int16Array;

	while (i < 50) {
		const result = getLevels(sourceVertices, exit, capacityMap, roomName);
		levels = result.levels;
		const cuts = result.cuts;

		if (cuts.length) return cuts;

		getBlockingFlow(sourceVertices, exit, capacityMap, levels);
		i++;
	}

	console.log("Minimum cut iteration limit reached");
	return ERR_NOT_FOUND;
}

// Constants for minimum cut algorithm
const MAX_POS = 1 << 12;
const POS_MASK = MAX_POS - 1;
const OUT_NODE = 1 << 12;
const MAX_NODE = 1 << 13;
const NODE_MASK = MAX_NODE - 1;
const INSIDE_EDGE = 1 << 16;
const DIR_SHIFT = 13;

const EIGHT_DELTA = [
	{ x: 0, y: -1 },  // TOP
	{ x: 1, y: -1 },  // TOP_RIGHT
	{ x: 1, y: 0 },   // RIGHT
	{ x: 1, y: 1 },   // BOTTOM_RIGHT
	{ x: 0, y: 1 },   // BOTTOM
	{ x: -1, y: 1 },  // BOTTOM_LEFT
	{ x: -1, y: 0 },  // LEFT
	{ x: -1, y: -1 }, // TOP_LEFT
];

/**
 * Get blocking flow for max-flow algorithm
 * @author randomencounter
 */
function getBlockingFlow(
	sourceVertices: Set<number>,
	exit: Uint8Array,
	capacityMap: Int32Array,
	levels: Int16Array
): void {
	const checkIndex = new Uint8Array(MAX_NODE);
	checkIndex.fill(0);

	for (const sourceVertice of sourceVertices) {
		while (true) {
			const maxFlow = getDFS(
				sourceVertice,
				exit,
				capacityMap,
				levels,
				10000,
				checkIndex
			);
			if (maxFlow === 0) break;
		}
	}
}

/**
 * Depth-first search for max-flow algorithm
 * @author randomencounter
 */
function getDFS(
	nodeNow: number,
	exit: Uint8Array,
	capacityMap: Int32Array,
	levels: Int16Array,
	maxFlow: number,
	checkIndex: Uint8Array
): number {
	if (exit[nodeNow]) return maxFlow;

	const adjacentsEdges = getEdgesFrom(nodeNow);

	for (; checkIndex[nodeNow] < adjacentsEdges.length; checkIndex[nodeNow]++) {
		const edge = adjacentsEdges[checkIndex[nodeNow]];
		const nextNode = getEdgeEndNode(edge);

		if (capacityMap[edge] && levels[nextNode] - levels[nodeNow] === 1) {
			const newMaxFlow = getDFS(
				nextNode,
				exit,
				capacityMap,
				levels,
				Math.min(maxFlow, capacityMap[edge]),
				checkIndex
			);

			if (newMaxFlow > 0) {
				capacityMap[edge] -= newMaxFlow;
				capacityMap[getReverseEdge(edge)] += newMaxFlow;
				return newMaxFlow;
			}
		}
	}

	return 0;
}

function getLevels(
	sourceVertices: Set<number>,
	exit: Uint8Array,
	capacityMap: Int32Array,
	roomName: string
): { levels: Int16Array; cuts: RoomPosition[]; insides: RoomPosition[]; outsides: RoomPosition[]; costs: CostMatrix } {
	let connected = false;

	const costs = new PathFinder.CostMatrix();
	const cuts: RoomPosition[] = [];
	const outsides: RoomPosition[] = [];
	const insides: RoomPosition[] = [];

	const queue: number[] = [];
	const levels = new Int16Array(MAX_NODE);
	levels.fill(-1);

	// Initialize source vertices
	for (const sourceVertice of sourceVertices) {
		levels[sourceVertice] = 0;
		queue.push(sourceVertice);
	}

	// BFS to calculate levels
	while (queue.length) {
		const nodeNow = queue.shift()!;

		for (const edge of getEdgesFrom(nodeNow)) {
			const nextNode = getEdgeEndNode(edge);

			if (capacityMap[edge] > 0 && levels[nextNode] === -1) {
				levels[nextNode] = levels[nodeNow] + 1;
				queue.push(nextNode);

				if (exit[nextNode]) {
					connected = true;
				}
			}
		}
	}

	// If not connected, we found the cut
	if (!connected) {
		for (let y = 0; y < 50; y++) {
			for (let x = 0; x < 50; x++) {
				const node = packPosToVertice(x, y);
				const pos = new RoomPosition(x, y, roomName);
				costs.set(x, y, levels[node]);

				if (levels[node] === -1) {
					outsides.push(pos);
					continue;
				}

				if (levels[node | OUT_NODE] === -1) {
					cuts.push(pos);
					continue;
				}

				insides.push(pos);
			}
		}
	}

	return { levels, cuts, insides, outsides, costs };
}

/**
 * Get all edges from a node
 * @author randomencounter
 */
function getEdgesFrom(node: number): number[] {
	const result: number[] = [];
	for (let i = 0; i <= 8; i++) {
		result.push(node | (i << DIR_SHIFT));
	}
	return result;
}

/**
 * Get the end node of an edge
 * @author randomencounter
 */
function getEdgeEndNode(edge: number): number {
	if (edge & INSIDE_EDGE) {
		// Inner tile edge
		return (edge ^ OUT_NODE) & NODE_MASK;
	}

	const fromVertice = edge & POS_MASK;
	const pos = parseVerticeToPos(fromVertice);
	const direction = edge >> DIR_SHIFT;
	const newPoint = pointAdd(pos, EIGHT_DELTA[direction]);

	return packPosToVertice(newPoint.x, newPoint.y) | ((edge & OUT_NODE) ^ OUT_NODE);
}

/**
 * Get the reverse edge
 * @author randomencounter
 */
function getReverseEdge(edge: number): number {
	if (edge & INSIDE_EDGE) {
		return edge ^ OUT_NODE;
	}

	const direction = ((edge >> DIR_SHIFT) + 4) % 8;
	return getEdgeEndNode(edge) | (direction << DIR_SHIFT);
}

/**
 * Pack position to vertex ID
 * @author randomencounter
 */
function packPosToVertice(x: number, y: number): number {
	return (y << 6) | x;
}

/**
 * Parse vertex ID to position
 * @author randomencounter
 */
function parseVerticeToPos(vertice: number): { x: number; y: number } {
	return {
		x: vertice & 0x3f,
		y: vertice >> 6
	};
}

/**
 * Check if point is within room bounds
 * @author randomencounter
 */
function isPointInRoom(pos: { x: number; y: number }): boolean {
	return pos.x >= 0 && pos.x <= 49 && pos.y >= 0 && pos.y <= 49;
}

/**
 * Add two points/vectors
 * @author randomencounter
 */
function pointAdd(pos: { x: number; y: number }, vector: { x: number; y: number }): { x: number; y: number } {
	return {
		x: pos.x + vector.x,
		y: pos.y + vector.y
	};
}
