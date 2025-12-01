
/** Interface for defining all possible event types and their respective payloads. */
export interface EventMap {
	creepSpawned: { name: string; body: BodyPartConstant[] };
	roomUnderAttack: { roomName: string; hostileCount: number };
	energyThreshold: { roomName: string; energy: number };
	invaderCorePresent: { roomName: string; roomPos: RoomPosition };
	controllerLevelUpgraded: { roomName: string; newLevel: number };
	storageBuilt: { roomName: string, roomPos: RoomPosition };
}

export type Priority = "low" | "normal" | "high";

/** Event Bus module for Screeps Bot
 *
 * Defines a variety of event listeners (on, once, off) as well as a method for firing events (emit).
 *
 * Create actual event types and their respective payloads in the EventMap interface.
 */
export class EventBus<E extends Record<string, any>> {
	private listeners: {
		[K in keyof E]?: Array<{
			priority: Priority;
			handler: (payload: E[K]) => void;
		}>;
	} = {};

	private onceListeners: {
		[K in keyof E]?: Array<(payload: E[K]) => void>;
	} = {};

	constructor() {
		if (!Memory.__onceEvents) Memory.__onceEvents = {};
	}

	on<K extends keyof E>(
		event: K,
		handler: (payload: E[K]) => void,
		priority: Priority = "normal"
	) {
		if (!this.listeners[event]) this.listeners[event] = [];
		this.listeners[event]!.push({ priority, handler });

		this.listeners[event]!.sort((a, b) =>
			a.priority === b.priority ? 0 :
				a.priority === "high" ? -1 :
					b.priority === "low" ? -1 : 1
		);
	}

	once<K extends keyof E>(event: K, handler: (payload: E[K]) => void) {
		if (!this.onceListeners[event]) this.onceListeners[event] = [];
		this.onceListeners[event]!.push(handler);
	}

	/**
	 * Once-permanent event (persists across global resets)
	 */
	oncePermanent<K extends keyof E>(event: K, handler: (payload: E[K]) => void) {
		if (Memory.__onceEvents[event as string]) return; // already fired

		this.once(event, payload => {
			handler(payload);
			Memory.__onceEvents[event as string] = true;
		});
	}

	emit<K extends keyof E>(event: K, payload: E[K]) {
		// persistent listeners
		const list = this.listeners[event];
		if (list) {
			for (const { handler } of list) {
				handler(payload);
			}
		}

		// one-time listeners
		const once = this.onceListeners[event];
		if (once) {
			for (const fn of once) fn(payload);
			this.onceListeners[event] = [];
		}
	}
}

/** Game-wide Events singleton.
 * @example
 * const hostiles = room.find(FIND_HOSTILE_CREEPS);
 * if (hostiles.length > 0) {
 * 	Events.emit("roomUnderAttack", {
 * 		roomName: room.name,
 * 		hostileCount: hostiles.length
 * 	});
 * }
 */
 const Events = new EventBus<EventMap>();

 /** Array of all registered event listeners. */
const listenerRegistry: Array<() => void> = [];

/** Persistent listener decorator
 *
 * @example
 * // Don't include '.' before the @ decorator, it is shown only for JSDoc compatability
 * export class CombatSystem {
 * .@OnEvent("roomUnderAttack")
 * handleAttack({ roomName, hostileCount }) {
 * 	console.log(`⚔ Room ${roomName} under attack by ${hostileCount} creeps.`);
 * }
 */
export function OnEvent<K extends keyof EventMap>(event: K,	priority: Priority = "normal") {
	return function (target: any, key: string, descriptor: PropertyDescriptor) {
		const handler = descriptor.value;
		listenerRegistry.push(() => {
			const instance = new target.constructor();
			Events.on(event, payload => handler.call(instance, payload), priority);
		});
	};
}

/** One-time listener decorator
 *
 * @example
 * // Don't include '.' before the @ decorator, it is shown only for JSDoc compatability
 * export class TutorialSystem {
 * 	.@OnceEvent("creepSpawned")
 * 	onFirstCreep({ name }) {
 * 		console.log(`🎉 First creep spawned: ${name}`);
 * 		Game.notify(`First creep spawned: ${name}`);
 * 	}
 * }
 */
export function OnceEvent<K extends keyof EventMap>(event: K) {
	return function (target: any, key: string, descriptor: PropertyDescriptor) {
		const handler = descriptor.value;
		listenerRegistry.push(() => {
			const instance = new target.constructor();
			Events.once(event, payload => handler.call(instance, payload));
		});
	};
}

export function OncePermanent<K extends keyof EventMap>(event: K) {
	return function (target: any, key: string, descriptor: PropertyDescriptor) {
		const handler = descriptor.value;
		listenerRegistry.push(() => {
			const instance = new target.constructor();
			Events.oncePermanent(event, payload => handler.call(instance, payload));
		});
	};
}

/** Initialize all decorated listeners.
 *
 * Call me at the top of main.ts.
 */
export function initializeDecoratedListeners() {
	for (const init of listenerRegistry) {
		init();
	}
 }

 export default Events;

