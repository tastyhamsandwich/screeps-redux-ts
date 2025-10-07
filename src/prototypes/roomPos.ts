// Will find room positions of creeps and organize them into an array
import { log } from '../utils/globalFuncs';

declare global {
	// PROTODEF: Room Position Prototype Extension
	interface RoomPosition {
		getNearbyPositions(): RoomPosition[];
		getWalkablePositions(): RoomPosition[];
		getOpenPositions(): RoomPosition[];
		getNumOpenPositions(): number;
		link(): string;
	}
}

RoomPosition.prototype.getNearbyPositions = function(): RoomPosition[] {

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

RoomPosition.prototype.getWalkablePositions = function(): RoomPosition[] {

  let nearbyPositions: RoomPosition[] = this.getNearbyPositions();
  const terrain = Game.map.getRoomTerrain(this.roomName);

  return _.filter(nearbyPositions, function(pos: RoomPosition) {
    return terrain.get(pos.x, pos.y) !== TERRAIN_MASK_WALL;
  });
}
RoomPosition.prototype.getOpenPositions = function(): RoomPosition[] {

  const walkablePositions = this.getWalkablePositions();

	let freePositions = _.filter(walkablePositions, function(pos) {
		return !pos.lookFor(LOOK_CREEPS).length;
	});

	return freePositions;
}

RoomPosition.prototype.getNumOpenPositions = function (): number {
	const freePos = this.getOpenPositions();
	return freePos.length;
}

RoomPosition.prototype.link = function (): string {
  return `[<a href="#!/room/${Game.shard.name}/${this.roomName}">${this.roomName}${this.x},${this.y}</a>]:`;
};
