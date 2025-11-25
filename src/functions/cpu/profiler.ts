/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/** Based on https://github.com/screepers/screeps-profiler */

import { showFileDownloadPopup } from "../client-abuse/download";
import { IS_SIM } from "../utils/constants";
import { sort } from "../utils/iterable";

type WithSymbol = Record<symbol, boolean>
interface ProfileMap {
	[fn: string]: [time: number, calls: number, subs: ProfileMap]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { performance } = global as any as { performance: { now: () => number } }
const getUsedCpu = IS_SIM ? () => performance.now() : () => Game.cpu.getUsed()

export class Profiler {
	constructor(private readonly getData: () => { map?: ProfileMap }, readonly dummy = false) {
		try {
			this.refreshData()
		} catch (e) {
			console.log(`Execution Error In Function: Profiler.constructor() on Tick ${Game.time}. Error: ${e}`);
		}
	}
	private refreshData() {
		try {
			const data = this.getData()
			data.map ??= {}
			this.data = data as typeof this.data
		} catch (e) {
			console.log(`Execution Error In Function: Profiler.refreshData() on Tick ${Game.time}. Error: ${e}`);
		}
	}
	private data!: {
		map: ProfileMap
		start?: number
		on?: 1
	}
	private readonly marker = Symbol()

	enable() {
		try {
			this.data.on = 1
		} catch (e) {
			console.log(`Execution Error In Function: Profiler.enable() on Tick ${Game.time}. Error: ${e}`);
		}
	}
	disable() {
		try {
			delete this.data.on
		} catch (e) {
			console.log(`Execution Error In Function: Profiler.disable() on Tick ${Game.time}. Error: ${e}`);
		}
	}

	private currentKey = "(tick)"

	wrapLoop(loop: () => void) {
		try {
			if (this.dummy) return loop

			this.refreshData()
			const fn = this.register(loop, "(loop)")
			return () => {
				if (!this.data.on) return fn()
				const start = IS_SIM ? getUsedCpu() : 0
				this.currentKey = "(tick)"
				const tick = this.get("(tick)")
				tick[1]++
				fn()
				tick[0] += getUsedCpu() - start
			}
		} catch (e) {
			console.log(`Execution Error In Function: Profiler.wrapLoop() on Tick ${Game.time}. Error: ${e}`);
			return loop;
		}
	}
	reset() {
		try {
			this.data.map = {}
			delete this.data.start
		} catch (e) {
			console.log(`Execution Error In Function: Profiler.reset() on Tick ${Game.time}. Error: ${e}`);
		}
	}

	registerObject(object: object, name: string) {
		try {
			if (!object) return // prevent profiling undefined

			const { prototype } = object as { prototype?: object }
			if (prototype) this.registerObject(prototype, name)

			const o = object as Record<string, () => void>
			for (const fnName of Object.getOwnPropertyNames(o)) {
				if (fnName === "constructor") continue // es6 class constructors need to be called with new
				if (fnName === "getUsed") continue // Let's avoid wrapping this... may lead to recursion issues and should be inexpensive.

				const key = `${name}.${fnName}`

				const descriptor = Object.getOwnPropertyDescriptor(o, fnName)
				if (!descriptor) continue

				const isFunction = typeof descriptor.value === "function"
				if (!isFunction || !descriptor.writable) continue

				o[fnName] = this.register(o[fnName], key)
			}
		} catch (e) {
			console.log(`Execution Error In Function: Profiler.registerObject(${name}) on Tick ${Game.time}. Error: ${e}`);
		}
	}

	register<F extends (...args: never[]) => unknown>(fn: F, name?: string) {
		try {
			if (this.dummy) return fn
			if ((fn as unknown as WithSymbol)[this.marker]) {
				console.log("Function already registered for profiler", fn)
				return fn
			}

			const key = name ?? fn.name
			if (!key) {
				console.log("No name of function to profile", fn)
				return fn
			}

			// eslint-disable-next-line @typescript-eslint/no-this-alias
			const p = this
			const f = fn
			function wrapped(this: F, ...args: never[]) {
				if (!p.data.on)
					return this && this.constructor === wrapped
						? new (f as unknown as new (...vs: unknown[]) => unknown)(...args)
						: f.apply(this, args)

				const parentKey = p.currentKey
				p.currentKey = key

				const start = getUsedCpu()
				const result =
					this && this.constructor === wrapped
						? new (f as unknown as new (...vs: unknown[]) => unknown)(...args)
						: f.apply(this, args)
				const end = getUsedCpu()

				p.currentKey = parentKey
				const time = end - start
				p.data.start ??= Game.time
				p.record(key, time)

				return result
			}
			; (wrapped as unknown as WithSymbol)[this.marker] = true
			return wrapped as F
		} catch (e) {
			console.log(`Execution Error In Function: Profiler.register() on Tick ${Game.time}. Error: ${e}`);
			return fn;
		}
	}

	private get(key: string, map = this.data.map) {
		try {
			return (map[key] ??= [0, 0, {}])
		} catch (e) {
			console.log(`Execution Error In Function: Profiler.get(${key}) on Tick ${Game.time}. Error: ${e}`);
			return [0, 0, {}] as [number, number, ProfileMap];
		}
	}
	/**
	 * Manually add profiling timings
	 * @param key profiled function name
	 * @param time cpu usage
	 * @param parentKey override parent function name
	 */
	record(key: string, time: number, parentKey = this.currentKey) {
		try {
			if (!this.data.on) return
			const root = this.get(key)
			root[0] += time
			root[1]++
			const parent = this.get(parentKey)
			const sub = this.get(key, parent[2])
			sub[0] += time
			sub[1]++
		} catch (e) {
			console.log(`Execution Error In Function: Profiler.record(${key}) on Tick ${Game.time}. Error: ${e}`);
		}
	}

	getCallgrind() {
		try {
			const elapsedTicks = Game.time - (this.data.start ?? Game.time) + 1
			const tick = this.get("(tick)")
			const totalTime = tick[0]
			tick[1] = elapsedTicks
			const root = this.get("(root)")
			root[0] = totalTime
			root[1] = 1
			const rootTick = this.get("(tick)", root[2])
			rootTick[0] = totalTime
			rootTick[1] = elapsedTicks
			let body = `events: ns\nsummary: ${Math.round(totalTime * 1000000)}\n`
			for (const key in this.data.map) {
				const [time, , subs] = this.data.map[key]
				let callsBody = ""
				let callsTime = 0
				for (const callName in subs) {
					const [callTime, calls] = subs[callName]
					const ns = Math.round(callTime * 1000000)
					callsBody += `cfn=${callName}\ncalls=${calls} 1\n1 ${ns}\n`
					callsTime += callTime
				}
				body += `\nfn=${key}\n1 ${Math.round((time - callsTime) * 1000000)}\n${callsBody}`
			}
			return body
		} catch (e) {
			console.log(`Execution Error In Function: Profiler.getCallgrind() on Tick ${Game.time}. Error: ${e}`);
			return "";
		}
	}
	callgrind() {
		try {
			showFileDownloadPopup(`callgrind.out.${Game.time}`, this.getCallgrind())
		} catch (e) {
			console.log(`Execution Error In Function: Profiler.callgrind() on Tick ${Game.time}. Error: ${e}`);
		}
	}

	getOutput(maxStats?: number) {
		try {
			if (this.data.start === undefined) return "Profiler not active."

			const elapsedTicks = Game.time - this.data.start + 1
			const totalTime = this.get("(tick)")[0]

			const stats = sort(Object.entries(this.data.map), ([, [time, calls]]) => -time / calls)
			if (maxStats) stats.length = maxStats

			return [
				"calls\t\ttime\t\tavg\t\tfunction",
				...stats.map(
					([name, [time, calls]]) =>
						`${calls}\t\t${time.toFixed(2)}\t\t${(time / calls).toFixed(3)}\t\t${name}`
				),
				`Ticks: ${elapsedTicks}\tTime: ${totalTime.toFixed(2)}\tPer tick: ${(
					totalTime / elapsedTicks
				).toFixed(3)}`,
			].join("\n")
		} catch (e) {
			console.log(`Execution Error In Function: Profiler.getOutput() on Tick ${Game.time}. Error: ${e}`);
			return "Error generating profiler output";
		}
	}
	output(maxStats?: number) {
		try {
			console.log(this.getOutput(maxStats))
		} catch (e) {
			console.log(`Execution Error In Function: Profiler.output() on Tick ${Game.time}. Error: ${e}`);
		}
	}
}
