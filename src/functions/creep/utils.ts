/** Clear Memory.creeps out of missing {@link Creep} */
export function deleteDeadCreepsMemory(): void {
	try {
		for (const name in Memory.creeps) {
			if (!(name in Game.creeps)) {
				// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
				delete Memory.creeps[name]
			}
		}
	} catch (e) {
		console.log(`Execution Error In Function: deleteDeadCreepsMemory() on Tick ${Game.time}. Error: ${e}`);
	}
}
