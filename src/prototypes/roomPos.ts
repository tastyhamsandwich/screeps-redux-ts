// Will find room positions of creeps and organize them into an array
import { log } from '@functions/utils/globals';

declare global {
	// PROTODEF: Room Position Prototype Extension
	interface RoomPosition {
		getNearbyPositions(): RoomPosition[];
		getWalkablePositions(): RoomPosition[];
		getOpenPositions(): RoomPosition[];
		getNumOpenPositions(): number;
		link(): string;
		/** Returns the RoomPosition adjacent to this one in the given direction (1–8) or null if the position is off the room edge. */
		getAdjacentPosition(direction: DirectionConstant): RoomPosition | null;
		/** Returns the RoomPosition offset by (dx, dy), or null if out of bounds. */
		getAdjacentPosition(dx: number, dy: number): RoomPosition | null;
		/** Returns all valid (in-bounds) neighboring RoomPositions around this one — up to 8 total.
		 *
		 * The resulting array does not include the position itself.
		 */
		getAdjacentPositions(): RoomPosition[];
	}
}

/** Returns an array of RoomPositions from the caller's current RoomPosition */
RoomPosition.prototype.getNearbyPositions = function (): RoomPosition[] {

	const positions: RoomPosition[] = [];
	let startX = this.x - 1 || 1;
	let startY = this.y - 1 || 1;

	for (let x = startX; x <= this.x + 1 && x < 49; x++) {
		for (let y = startY; y <= this.y + 1 && y < 49; y++) {
			if (x !== this.x || y !== this.y)
				positions.push(new RoomPosition(x, y, this.roomName));
		}
	}
	return positions;
}

/** Returns an array of RoomPositions around the caller's RoomPosition that can be traversed. */
RoomPosition.prototype.getWalkablePositions = function (): RoomPosition[] {

	let nearbyPositions: RoomPosition[] = this.getNearbyPositions();
	const terrain = Game.map.getRoomTerrain(this.roomName);

	return _.filter(nearbyPositions, function (pos: RoomPosition) {
		return terrain.get(pos.x, pos.y) !== TERRAIN_MASK_WALL;
	});
}

/** Return sn array of RoomPOsitions around the caller's RoomPosition that are not currently blocked by something. */
RoomPosition.prototype.getOpenPositions = function (): RoomPosition[] {

	const walkablePositions = this.getWalkablePositions();

	let freePositions = _.filter(walkablePositions, function (pos) {
		return !pos.lookFor(LOOK_CREEPS).length;
	});

	return freePositions;
}

/** Returns just the number of unblocked tiles around the caller's RoomPosition. */
RoomPosition.prototype.getNumOpenPositions = function (): number {
	return this.getOpenPositions().length;
}

/** Invokes a console log output that provides the caller's current room and position in the header. */
RoomPosition.prototype.link = function (): string {
	return `[<a href="#!/room/${Game.shard.name}/${this.roomName}">${this.roomName}${this.x},${this.y}</a>]:`;
};

RoomPosition.prototype.getAdjacentPosition = function (a: number, b?: number): RoomPosition | null {
	// Offset version
	if (typeof b === "number") {
		const newX = this.x + a;
		const newY = this.y + b;
		if (newX < 0 || newX > 49 || newY < 0 || newY > 49) return null;
		return new RoomPosition(newX, newY, this.roomName);
	}

	// DirectionConstant version
	const dir = a as DirectionConstant;
	const dx: number[] = [0, 1, 1, 1, 0, -1, -1, -1];
	const dy: number[] = [-1, -1, 0, 1, 1, 1, 0, -1];

	if (dir < 1 || dir > 8) return null;

	const newX = this.x + dx[dir - 1];
	const newY = this.y + dy[dir - 1];
	if (newX < 0 || newX > 49 || newY < 0 || newY > 49) return null;

	return new RoomPosition(newX, newY, this.roomName);
};

RoomPosition.prototype.getAdjacentPositions = function (): RoomPosition[] {
	const positions: RoomPosition[] = [];
	for (let dx = -1; dx <= 1; dx++) {
		for (let dy = -1; dy <= 1; dy++) {
			if (dx === 0 && dy === 0) continue;
			const x = this.x + dx;
			const y = this.y + dy;
			if (x < 0 || x > 49 || y < 0 || y > 49) continue;
			positions.push(new RoomPosition(x, y, this.roomName));
		}
	}
	return positions;
};
