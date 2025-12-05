export function getDistanceTransform(roomName: string, options: any = {}) {
	const defaultOptions = { innerPositions: undefined, visual: false };
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
				if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
					continue;
				}
				const cost = costs.get(x, y);

				if (cost === 0) {
					continue;
				}

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

