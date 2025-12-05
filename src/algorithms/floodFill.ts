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
export function getPositionsByPathCost(roomName: string, startPositions: { x: number, y: number }[], options: any) {
	const ADJACENT_VECTORS = [
		{ x: 0, y: -1 }, // TOP
		{ x: 1, y: -1 }, // TOP_RIGHT
		{ x: 1, y: 0 }, // RIGHT
		{ x: 1, y: 1 }, // BOTTOM_RIGHT
		{ x: 0, y: 1 }, // BOTTOM
		{ x: -1, y: 1 }, // BOTTOM_LEFT
		{ x: -1, y: 0 }, // LEFT
		{ x: -1, y: -1 }, // TOP_LEFT
	];

	const defaultOptions = {
		costThreshold: 255,
		visual: false,
	};
	const mergedOptions = { ...defaultOptions, ...options };
	let { costMatrix, costThreshold, visual } = mergedOptions;

	if (costMatrix === undefined) {
		costMatrix = new PathFinder.CostMatrix();
	} else {
		costMatrix = costMatrix.clone();
	}

	const queue: {x, y}[] = [];

	const result: {x, y}[] = [];

	const terrain = Game.map.getRoomTerrain(roomName);

	const check = new PathFinder.CostMatrix();

	for (const pos of startPositions) {
		queue.push(pos);
		costMatrix.set(pos.x, pos.y, 0);
		check.set(pos.x, pos.y, 1);
	}

	const roomVisual = new RoomVisual(roomName);

	while (queue.length) {
		const current = queue.shift();
		const currentLevel = costMatrix.get(current!.x, current!.y);

		for (const vector of ADJACENT_VECTORS) {
			const x = current!.x + vector.x;
			const y = current!.y + vector.y;
			if (x < 0 || x > 49 || y < 0 || y > 49) {
				continue;
			}

			if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
				continue;
			}

			if (costMatrix.get(x, y) >= costThreshold) {
				continue;
			}

			if (check.get(x, y) > 0) {
				continue;
			}

			costMatrix.set(x, y, currentLevel + 1);

			check.set(x, y, 1);

			queue.push({ x, y });

			const pos = new RoomPosition(x, y, roomName);
			result.push(pos);

			if (visual) {
				roomVisual.text(currentLevel + 1, x, y);
			}
		}
	}

	return costMatrix;
}
