# Screeps Event Listener System with Decorators (Updated)

## Overview
This document explains how to use the event-driven architecture in RandomBot using the event decorator syntax, including:
- `@OnEvent()` for persistent listeners
- `@OnceEvent()` for one-time listeners
- Automatic listener discovery
- Fully customizable event types and payloads

---

# 1. EventMap Definition

```ts
export interface EventMap {
    creepSpawned: { name: string; body: BodyPartConstant[] };
    roomUnderAttack: { roomName: string; hostileCount: number };
    energyThreshold: { roomName: string; energy: number };
}
```

---

# 2. EventBus with Decorator Support

```ts
export class EventBus<E extends Record<string, any>> {
    private listeners: {
        [K in keyof E]?: Array<(payload: E[K]) => void>
    } = {};

    private onceListeners: {
        [K in keyof E]?: Array<(payload: E[K]) => void>
    } = {};

    on<K extends keyof E>(event: K, listener: (payload: E[K]) => void): void {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event]!.push(listener);
    }

    once<K extends keyof E>(event: K, listener: (payload: E[K]) => void): void {
        if (!this.onceListeners[event]) this.onceListeners[event] = [];
        this.onceListeners[event]!.push(listener);
    }

    emit<K extends keyof E>(event: K, payload: E[K]): void {
        const persistent = this.listeners[event];
        if (persistent) {
            for (const fn of persistent) {
                fn(payload);
            }
        }

        const onceList = this.onceListeners[event];
        if (onceList) {
            for (const fn of onceList) {
                fn(payload);
            }
            this.onceListeners[event] = [];
        }
    }
}

export const Events = new EventBus<EventMap>();
```

---

# 3. Decorator Implementation (OnEvent + OnceEvent)

```ts
const registeredListeners: Array<() => void> = [];

export function OnEvent<K extends keyof EventMap>(event: K) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const method = descriptor.value;

        registeredListeners.push(() => {
            const instance = new target.constructor();
            Events.on(event, (payload: EventMap[K]) => method.call(instance, payload));
        });
    };
}

export function OnceEvent<K extends keyof EventMap>(event: K) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const method = descriptor.value;

        registeredListeners.push(() => {
            const instance = new target.constructor();
            Events.once(event, (payload: EventMap[K]) => method.call(instance, payload));
        });
    };
}

export function initializeDecoratedListeners() {
    for (const init of registeredListeners) init();
}
```

---

# 4. Examples

## 4.1 Combat System Using @OnEvent

```ts
// combatSystem.ts
import { OnEvent } from "./listenerDecorator";

export class CombatSystem {
    @OnEvent("roomUnderAttack")
    handleAttack({ roomName, hostileCount }) {
        console.log(`⚔ Room ${roomName} under attack (${hostileCount} hostiles)`);
        Game.notify(`⚠️ Room ${roomName} is under attack!`);
    }
}
```

---

## 4.2 Spawn Logging Using @OnEvent

```ts
// spawnLogger.ts
import { OnEvent } from "./listenerDecorator";

export class SpawnLogger {
    @OnEvent("creepSpawned")
    onSpawn({ name, body }) {
        console.log(`Creep spawned: ${name} (${body.length} parts)`);
    }
}
```

---

## 4.3 One-time Listener Using @OnceEvent

```ts
// tutorialSystem.ts
import { OnceEvent } from "./listenerDecorator";

export class TutorialSystem {
    @OnceEvent("creepSpawned")
    onFirstSpawn({ name }) {
        console.log(`🎉 First creep spawned: ${name}`);
        Game.notify(`First creep spawned: ${name}`);
    }
}
```

This listener triggers **once**, then automatically unregisters itself.

---

# 5. Initialization in main.ts

```ts
import { initializeDecoratedListeners } from "./listenerDecorator";

initializeDecoratedListeners();

export const loop = () => {
    // primary execution loop
};
```

---

# 6. Emitting Events

```ts
import { Events } from "./eventBus";

function spawnCreep(spawn, name, body) {
    if (spawn.spawnCreep(body, name) === OK) {
        Events.emit("creepSpawned", { name, body });
    }
}
```

---

# 7. Advantages

| Feature | Benefit |
|--------|---------|
| `@OnEvent()` | Clean persistent listeners |
| `@OnceEvent()` | Auto-disposing one-time listeners |
| Automatic listener discovery | No manual registration |
| Customizable EventMap | Easily extensible with custom events |

---

# 8. Future Extensions
Further development will likely see this system expanded to support:

- Listener priority levels
- Event replay across ticks
- Logging / debugging tooling
- Directory auto-scanning for listeners


