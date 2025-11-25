
/**
 * A system for managing creep movement and traffic coordination in Screeps.
 *
 * @module TrafficManager
 *
 * @description
 * The TrafficManager provides centralized movement coordination for creeps, allowing them to move with
 * `ignoreCreeps: true` while still handling creep-to-creep collisions intelligently. It processes movement
 * intents submitted by creeps and resolves potential conflicts using the following strategies:
 *
 * - Direct movement when destination is clear
 * - Creep swapping when two creeps want to swap positions
 * - Pushing blocking creeps out of the way when possible
 *
 * @example
 * ```typescript
 * % Submit a move intent
 * global.TrafficIntents.push({
 *   creep: creep,
 *   from: creep.pos,
 *   to: destination,
 *   priority: 1
 * });
 *
 * % Process all intents
 * TrafficManager.run();
 * ```
 *
 * @typedef {Object} MoveIntent - Represents a single creep's movement request
 * @property {Creep} creep - The creep that wants to move
 * @property {RoomPosition} from - Starting position
 * @property {RoomPosition} to - Desired destination
 * @property {number} priority - Movement priority (higher numbers get precedence)
 * @property {MoveToOpts} [opts] - Optional movement options
 */
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
		try {
			const intents: MoveIntent[] = global.TrafficIntents;
			if (!intents?.length) return;

			const byRoom: { [roomName: string]: MoveIntent[] } = {};
			for (const intent of intents) (byRoom[intent.from.roomName] ||= []).push(intent);

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
		} catch (e) {
			console.log(`Execution Error In Function: TrafficManager.run() on Tick ${Game.time}. Error: ${e}`);
		}
	}
}
