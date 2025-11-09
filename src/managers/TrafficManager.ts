export interface MoveIntent {
	creep: Creep;
	from: RoomPosition;
	to: RoomPosition;
	priority: number;
	opts?: MoveToOpts;
}

declare global {

	var TrafficIntents: MoveIntent[];
}

if (!global.TrafficIntents) global.TrafficIntents = [];
/** Traffic Manager for Screeps
 *
 * Coordinates creep movement with ignoreCreeps: true
 *
 * Supports intelligent swapping, pushing, and yielding.
 */
export default class TrafficManager {
	static run(): void {
		const intents: MoveIntent[] = global.TrafficIntents;
		if (!intents?.length) return;

		const byRoom: { [roomName: string]: MoveIntent[] } = {};
		for (const intent of intents) {
			(byRoom[intent.from.roomName] ||= []).push(intent);
		}

		for (const roomName in byRoom) {
			const roomIntents = byRoom[roomName];
			const occupied: { [key: string]: Creep } = {};

			for (const intent of roomIntents) {
				const key = intent.to.toString();
				const blocker = occupied[key];

				if (!blocker) {
					intent.creep.move(intent.creep.pos.getDirectionTo(intent.to));
					occupied[key] = intent.creep;
					continue;
				}

				// Try swapping if both want each other's tile
				if (blocker.memory?.moveIntent?.to?.x === intent.from.x &&
					blocker.memory?.moveIntent?.to?.y === intent.from.y &&
					blocker.memory?.moveIntent?.to?.roomName === intent.from.roomName) {

					const dirA = intent.creep.pos.getDirectionTo(intent.to);
					const dirB = blocker.pos.getDirectionTo(blocker.memory.moveIntent.to);
					intent.creep.move(dirA);
					blocker.move(dirB);
					continue;
				}

				// Otherwise, try to push
				const pushDir = blocker.pos.getDirectionTo(intent.to);
				const pushed = blocker.move(pushDir);
				if (pushed === OK) {
					intent.creep.move(intent.creep.pos.getDirectionTo(intent.to));
					continue;
				}
			}
		}

		// Clear after processing
		global.TrafficIntents = [];
	}
}

/*
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
*/
	/** Attempts to push a blocking creep aside into an open neighbor tile. Returns true if successful. */
	/*
	tryPush(blocker: Creep, pusher: Creep): boolean {
		const neighbors = blocker.pos.getAdjacentPositions();
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
*/
