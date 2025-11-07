	module.exports = {
		getDistanceTransform,
		getPositionsByPathCost,
		getMinCut,
	}

	type InnerPositions = Array<RoomPosition | { x: number, y: number }>;
	interface DistTransOptions {
		innerPositions?: InnerPositions, visual?: boolean
	};

	/**
	 * Generate the distance trasform for a given Room
	 * @param {string} roomName
	 * @param {Object} options
	 * @param {[RoomPosition]} options.innerPositions - array of roomPositions or object with properties x, y
	 * @param {boolean} options.visual - if true, visualize the result with RoomVisual
	 * @returns {CostMatrix} costMatrix which tells you the distance
	 */
export function getDistanceTransform(roomName, options: DistTransOptions = {}) {
	const defaultOptions: DistTransOptions = { innerPositions: undefined, visual: false };
		const mergedOptions = { ...defaultOptions, ...options };
		const { innerPositions, visual } = mergedOptions;

		const BOTTOM_LEFT = [
			{ x: -1, y: 0 },
			{ x: 0, y: -1 },
			{ x: -1, y: -1 },
			{ x: -1, y: 1 },
		];

		const TOP_RIGHT = [
			{ x: 1, y: 0 },
			{ x: 0, y: +1 },
			{ x: 1, y: 1 },
			{ x: 1, y: -1 },
		];

		let costs = new PathFinder.CostMatrix();

		const terrain = new Room.Terrain(roomName);

		if (innerPositions === undefined) {
			for (let x = 0; x <= 49; x++) {
				for (let y = 0; y <= 49; y++) {
					if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
						costs.set(x, y, 0);
						continue;
					}
					if (x < 1 || x > 48 || y < 1 || y > 48) {
						costs.set(x, y, 0);
						continue;
					}
					costs.set(x, y, 1 << 8);
				}
			}
		} else {
			for (const pos of innerPositions) {
				costs.set(pos.x, pos.y, 1 << 8);
			}
		}

		for (let x = 0; x <= 49; x++) {
			for (let y = 0; y <= 49; y++) {
				const nearDistances = BOTTOM_LEFT.map(
					(vector) => costs.get(x + vector.x, y + vector.y) + 1 || 100
				);
				nearDistances.push(costs.get(x, y));
				costs.set(x, y, Math.min(...nearDistances));
			}
		}

		let maxDistance = 0;

		for (let x = 49; x >= 0; x--) {
			for (let y = 49; y >= 0; y--) {
				const nearDistances = TOP_RIGHT.map(
					(vector) => costs.get(x + vector.x, y + vector.y) + 1 || 100
				);
				nearDistances.push(costs.get(x, y));
				const distance = Math.min(...nearDistances);
				maxDistance = Math.max(maxDistance, distance);
				costs.set(x, y, distance);
			}
		}

		if (visual) {
			const roomVisual = new RoomVisual(roomName);

			for (let x = 49; x >= 0; x--) {
				for (let y = 49; y >= 0; y--) {
					if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
					const cost = costs.get(x, y);

					if (cost === 0) continue;

					const hue = 180 * (1 - cost / maxDistance);
					const color = `hsl(${hue},100%,60%)`;
					roomVisual.text(cost.toString(), x, y);
					roomVisual.rect(x - 0.5, y - 0.5, 1, 1, {
						fill: color,
						opacity: 0.4,
					});
				}
			}
		}

		return costs;
	}

	/**
	 * Use flood fill to get path costs for all the connected tiles from start positions
	 * @param {string} roomName - roomName to do flood fill
	 * @param {[RoomPosition]} startPositions - positions to start with
	 * @param {Object} options
	 * @param {CostMatrix} options.costMatrix - costMatrix for the room
	 * @param {number} options.costThreshold - threshold to block the tile. default is 255
	 * @param {boolean} options.visual - if true, visualize the result with RoomVisual
	 * @returns {CostMatrix} cost matrix that shows the path cost for each tile.
	 */
	export function getPositionsByPathCost(roomName, startPositions, options) {
		const ADJACENT_VECTORS = [
			{ x: 0,  y: -1 }, 	// TOP
			{ x: 1,  y: -1 }, 	// TOP_RIGHT
			{ x: 1,  y: 0  }, 	// RIGHT
			{ x: 1,  y: 1	 }, 	// BOTTOM_RIGHT
			{ x: 0,  y: 1  }, 	// BOTTOM
			{ x: -1, y: 1  }, 	// BOTTOM_LEFT
			{ x: -1, y: 0  }, 	// LEFT
			{ x: -1, y: -1 }, 	// TOP_LEFT
		];

		const defaultOptions = {
			costThreshold: 255,
			visual: false,
		};

		const mergedOptions = { ...defaultOptions, ...options };
		const queue: { x: number, y: number }[] = [];
		const result: RoomPosition[] = [];
		const terrain = Game.map.getRoomTerrain(roomName);
		const check = new PathFinder.CostMatrix();
		const roomVisual = new RoomVisual(roomName);

		let { costMatrix, costThreshold, visual } = mergedOptions;

		if (costMatrix === undefined) costMatrix = new PathFinder.CostMatrix();
		else costMatrix = costMatrix.clone();

		for (const pos of startPositions) {
			queue.push(pos);
			costMatrix.set(pos.x, pos.y, 0);
			check.set(pos.x, pos.y, 1);
		}

		while (queue.length) {
			const current: { x: number, y: number } = queue.shift()!;
			const currentLevel = costMatrix.get(current.x, current.y);

			for (const vector of ADJACENT_VECTORS) {
				const x = current.x + vector.x;
				const y = current.y + vector.y;
				if (x < 0 || x > 49 || y < 0 || y > 49) continue;

				if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;

				if (costMatrix.get(x, y) >= costThreshold) continue;

				if (check.get(x, y) > 0) continue;

				costMatrix.set(x, y, currentLevel + 1);

				check.set(x, y, 1);

				queue.push({ x, y });

				const pos = new RoomPosition(x, y, roomName);
				result.push(pos);

				if (visual) roomVisual.text(currentLevel + 1, x, y);
			}
		}

		return costMatrix;
	}

	/**
	 *
	 * @param {string} roomName - roomName to do mincut
	 * @param {Array} sources - positions to keep safe
	 * @param {CostMatrix} costMatrix - costMatrix to use. tiles with 255 cost are treated like wall
	 * @returns {[RoomPosition]} array of position of cuts
	 */
	export function getMinCut(roomName, sources, costMatrix) {
		// soucres: array of roomPositions, costMatrix: costMatrix which indicates cost of that position.
		// an array indicating whether a point is at the exit or near the exit

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

		const exitCoords: Array<{ [key: string]: number }> = [];

		for (let x = 1; x < 49; x++) {
			for (const y of [0, 49])
				if (terrain.get(x, y) !== TERRAIN_MASK_WALL) {
					exitCoords.push({ x, y });
				}
		}

		for (let y = 1; y < 49; y++) {
			for (const x of [0, 49])
				if (terrain.get(x, y) !== TERRAIN_MASK_WALL)
					exitCoords.push({ x, y });
		}

		const exit = new Uint8Array(MAX_NODE);

		for (const exitCoord of exitCoords) {
			const minX = Math.max(0, exitCoord.x - 2);
			const maxX = Math.min(49, exitCoord.x + 2);

			const minY = Math.max(0, exitCoord.y - 2);
			const maxY = Math.min(49, exitCoord.y + 2);

			for (let x = minX; x <= maxX; x++) {
				for (let y = minY; y <= maxY; y++) {
					const coord = { x, y };
					if (costMatrix.get(coord.x, coord.y) === 255)
						continue;
					exit[packPosToVertice(coord.x, coord.y) | OUT_NODE] = 1;
				}
			}
		}

		const sourceVertices = new Set();

		for (const coord of sources) {
			const vertice = packPosToVertice(coord.x, coord.y);

			if (exit[vertice]) {
				console.log(`Invalid source ${coord.x}, ${coord.y}`);
				return ERR_NOT_FOUND;
			}

			if (costMatrix.get(coord.x, coord.y) === 255) continue;

			sourceVertices.add(vertice);
		}

		// setup the capacity map, the keys are the encoded edges
		// 0-12 bits    - source node
		//   0-11 bits      - the packed location of the source node
		//   12 bit         - s-node or the d-node
		// 13-16 bits   - direction of the edge, 0-7 means the edge goes to another
		// location, while 8 means the edge goes from s-node to d-node or vice versa
		let capacityMap = new Int32Array(1 << 17);

		capacityMap.fill(0);

		for (let y = 0; y < 50; y++) {
			for (let x = 0; x < 50; x++) {
				if (costMatrix.get(x, y) === 255)
					continue;

				const vertice = packPosToVertice(x, y);
				capacityMap[vertice | INSIDE_EDGE] = costMatrix.get(x, y); // edge from a tile to itself

				for (let direction = 0; direction < EIGHT_DELTA.length; direction++) {
					const nextPoint = pointAdd({ x, y }, EIGHT_DELTA[direction]);
					if (!isPointInRoom(nextPoint))
						continue;

					if (costMatrix.get(nextPoint.x, nextPoint.y) === 255)
						continue;

					capacityMap[vertice | OUT_NODE | (direction << DIR_SHIFT)] = 10000; //almost infinite
				}
			}
		}

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
		console.log("iteration ends.");
		return ERR_NOT_FOUND;
	}

const MAX_POS = 1 << 12;
const POS_MASK = MAX_POS - 1;

const OUT_NODE = 1 << 12;

const MAX_NODE = 1 << 13;
const NODE_MASK = MAX_NODE - 1;

const INSIDE_EDGE = 1 << 16;

const DIR_SHIFT = 13;

const EIGHT_DELTA = [
	{ x: 0, y: -1 }, // TOP
	{ x: 1, y: -1 }, // TOP_RIGHT
	{ x: 1, y: 0 }, // RIGHT
	{ x: 1, y: 1 }, // BOTTOM_RIGHT
	{ x: 0, y: 1 }, // BOTTOM
	{ x: -1, y: 1 }, // BOTTOM_LEFT
	{ x: -1, y: 0 }, // LEFT
	{ x: -1, y: -1 }, // TOP_LEFT
];

function getBlockingFlow(sourceVertices, exit, capacityMap, levels) {
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

function getDFS(nodeNow, exit, capacityMap, levels, maxFlow, checkIndex) {
	if (exit[nodeNow]) return maxFlow;
	const adjacentsEdges = getEdgesFrom(nodeNow);
	for (
		;
		checkIndex[nodeNow] < getEdgesFrom(nodeNow).length;
		checkIndex[nodeNow]++
	) {
		const edge = adjacentsEdges[checkIndex[nodeNow]];
		const nextNode = getEdgeEndNode(edge);
		if (capacityMap[edge] && levels[nextNode] - levels[nodeNow] == 1) {
			let newMaxFlow = getDFS(
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

function getLevels(sourceVertices, exit, capacityMap, roomName) {
	let connected = false;

	const costs = new PathFinder.CostMatrix();
	const cuts: RoomPosition[] = [];
	const outsides: RoomPosition[] = [];
	const insides: RoomPosition[] = [];

	const queue: RoomPosition[] = [];
	const levels = new Int16Array(MAX_NODE);

	levels.fill(-1);

	for (const sourceVertice of sourceVertices) {
		// make vertices to nodes
		levels[sourceVertice] = 0;
		queue.push(sourceVertice);
	}
	while (queue.length) {
		const nodeNow: any = queue.shift()!;
		for (const edge of getEdgesFrom(nodeNow)) {
			const nextNode: any = getEdgeEndNode(edge);
			if (capacityMap[edge] > 0 && levels[nextNode] === -1) {
				levels[nextNode] = levels[nodeNow] + 1;
				queue.push(nextNode);
				if (exit[nextNode])
					connected = true;
			}
		}
	}

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

function getEdgesFrom(node) {
	const result: any[] = [];
	for (let i = 0; i <= 8; i++)
		result.push(node | (i << DIR_SHIFT));
	return result;
}

function getEdgeEndNode(edge) {
	if (edge & INSIDE_EDGE) {
		// inner tile edge
		return (edge ^ OUT_NODE) & NODE_MASK;
	}
	const fromVertice = edge & POS_MASK;
	const pos = parseVerticeToPos(fromVertice);
	const direction = edge >> DIR_SHIFT;
	const newPoint = pointAdd(pos, EIGHT_DELTA[direction]);
	return (
		packPosToVertice(newPoint.x, newPoint.y) | ((edge & OUT_NODE) ^ OUT_NODE)
	);
}

function getReverseEdge(edge) {
	if (edge & INSIDE_EDGE) {
		return edge ^ OUT_NODE;
	}
	const direction = ((edge >> DIR_SHIFT) + 4) % 8;
	return getEdgeEndNode(edge) | (direction << DIR_SHIFT);
}

function packPosToVertice(x, y) {
	return (y << 6) | x;
}

function parseVerticeToPos(vertice) {
	return { x: vertice & 0x3f, y: vertice >> 6 };
}

function isPointInRoom(pos) {
	return pos.x >= 0 && pos.x <= 49 && pos.y >= 0 && pos.y <= 49;
}

function pointAdd(pos, vector) {
	return { x: pos.x + vector.x, y: pos.y + vector.y };
}
