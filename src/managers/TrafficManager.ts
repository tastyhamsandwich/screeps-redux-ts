export interface MoveIntent {
	creep: Creep;
	from: RoomPosition;
	to: RoomPosition;
	priority: number;
}

declare global {
	interface Creep {
		smartMoveTo(target: RoomPosition | { pos: RoomPosition }, opts?: MoveToOpts): ScreepsReturnCode;
		movePriority?: number;
		stuckTicks?: number;
	}

	var TrafficIntents: MoveIntent[];
}

Creep.prototype.smartMoveTo = function (
	this: Creep,
	target: RoomPosition | { pos: RoomPosition },
	opts: MoveToOpts = {}
): ScreepsReturnCode {
	const dest = target instanceof RoomPosition ? target : target.pos;
	opts.ignoreCreeps = true;

	const result = this.moveTo(dest, opts);

	// Record movement intent for Traffic Manager
	if (result === OK || result === ERR_TIRED) {
		const dir = this.pos.getDirectionTo(dest);
		const nextPos = this.pos.getAdjacentPosition(dir);
		if (nextPos) {
			global.TrafficIntents.push({
				creep: this,
				from: this.pos,
				to: nextPos,
				priority: this.movePriority ?? 1
			});
		}
	}

	return result;
};

/** Traffic Manager for Screeps
 *
 * Coordinates creep movement with ignoreCreeps: true
 *
 * Supports intelligent swapping, pushing, and yielding.
 */
const TrafficManager = {
	run(): void {
		if (!global.TrafficIntents) global.TrafficIntents = [];

		const grouped = _.groupBy(global.TrafficIntents, i => `${i.to.roomName}:${i.to.x}:${i.to.y}`);

		for (const key in grouped) {
			const intents = grouped[key];
			if (intents.length <= 1) continue;
			this.resolveCollision(intents);
		}

		global.TrafficIntents = [];
	},

	resolveCollision(intents: MoveIntent[]): void {
		intents.sort((a, b) => b.priority - a.priority);

		// Handle swap first
		if (intents.length === 2) {
			const [a, b] = intents;
			if (a.to.isEqualTo(b.from) && b.to.isEqualTo(a.from)) {
				a.creep.move(a.from.getDirectionTo(a.to));
				b.creep.move(b.from.getDirectionTo(b.to));
				return;
			}
		}

		// Handle push / yield
		for (const intent of intents) {
			const blocking = intent.to.lookFor(LOOK_CREEPS)[0];
			if (!blocking) {
				intent.creep.move(intent.creep.pos.getDirectionTo(intent.to));
				continue;
			}

			const blockingIntent = global.TrafficIntents.find(i => i.creep.id === blocking.id);

			// Case 1: Blocker has its own destination and it's walkable
			if (blockingIntent && this.isWalkable(blockingIntent.to)) {
				blocking.move(blocking.pos.getDirectionTo(blockingIntent.to));
				intent.creep.move(intent.creep.pos.getDirectionTo(intent.to));
				continue;
			}

			// Case 2: Blocker has no intent — try pushing it aside
			if (!blockingIntent) {
				const pushed = this.tryPush(blocking, intent.creep);
				if (pushed) {
					intent.creep.move(intent.creep.pos.getDirectionTo(intent.to));
					continue;
				}
			}

			// Case 3: Can't move or push → yield and maybe repath
			intent.creep.stuckTicks = (intent.creep.stuckTicks ?? 0) + 1;
			if (intent.creep.stuckTicks > 3) {
				delete intent.creep.memory._move;
				intent.creep.moveTo(intent.to, { ignoreCreeps: false });
				intent.creep.stuckTicks = 0;
			}
		}
	},

	/** Attempts to push a blocking creep aside into an open neighbor tile. Returns true if successful. */
	tryPush(blocker: Creep, pusher: Creep): boolean {
		const neighbors = blocker.pos.getNeighbors();
		for (const pos of neighbors) {
			if (!this.isWalkable(pos)) continue;
			if (pos.lookFor(LOOK_CREEPS).length > 0) continue;

			blocker.move(blocker.pos.getDirectionTo(pos));
			return true;
		}
		return false;
	},

	isWalkable(pos: RoomPosition): boolean {
		const terrain = Game.map.getRoomTerrain(pos.roomName);
		if (terrain.get(pos.x, pos.y) === TERRAIN_MASK_WALL) return false;
		const structures = pos.lookFor(LOOK_STRUCTURES);
		for (const s of structures) {
			if ((OBSTACLE_OBJECT_TYPES as unknown as StructureConstant[]).includes(s.structureType as StructureConstant)) return false;
		}
		return true;
	}
}

export default TrafficManager;
