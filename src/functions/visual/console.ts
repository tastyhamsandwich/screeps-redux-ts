/** Displays room energy state and creep counts/spawn targets every X ticks in the console
 *
 * The tick refresh rate can be configured at Memory.globalSettings.consoleSpawnInterval (default = 25)
 * @example
 * [E25N25]: NRG amt/cap(%) <storage-nrg-amt> Tick: ticks-since-global-reset
 * [E25N25]: H: x/y, F: x/y, Haul: x/y, U: x/y, B: x/y, R: x/y
 * [E25N25]: Rsv: x/y, RH: x/y, RG: x/y, RHaul: x/y
*/
export function DisplayConsolePrompt(room: Room, creepCounts: CreepCount, creepQuotas: CreepQuota): void {
	const tickCount: number = global.tickCount;
	const tickInterval: number = Memory.globalSettings.consoleSpawnInterval;
	let storageInfo = '';
	if (room.storage)
		storageInfo = `<${room.storage.store[RESOURCE_ENERGY].toString()}>`;
	const energy: string = `NRG: ${room.energyAvailable}/${room.energyCapacityAvailable}(${(room.energyAvailable / room.energyCapacityAvailable * 100).toFixed(0)}%)`;
	if (tickInterval !== 0 && tickCount % tickInterval === 0) {
		room.log(`${energy} ${storageInfo} Tick: ${tickCount}`);
		room.log(`${energy} ${storageInfo} | H: ${creepCounts.harvesters}, F: ${creepCounts.fillers}/${creepQuotas.fillerTarget}, Hl: ${creepCounts.haulers}/${creepQuotas.haulerTarget}, U: ${creepCounts.upgraders}/${creepQuotas.upgraderTarget}, B: ${creepCounts.builders}/${creepQuotas.builderTarget}, Rep: ${creepCounts.repairers}/${creepQuotas.repairerTarget}, Def: ${creepCounts.defenders}/${creepQuotas.defenderTarget}, W: ${creepCounts.workers}/${creepQuotas.workerTarget}}`);
		//room.log(`Rsv: ${creepCounts.reservers}/${creepQuotas.reserverTarget}, RH: ${creepCounts.remoteharvesters}/${creepQuotas.remoteharvesterTarget}`);
	}
}

declare global {
	interface CreepCount {
		harvesters: number;
		fillers: number;
		haulers: number;
		upgraders: number;
		builders: number;
		repairers: number;
		defenders: number;
		reservers: number;
		remoteharvesters: number;
		conveyors?: number;
		workers: number;
		scouts?: number;
	}

	interface CreepQuota {
		harvesterTarget: number;
		fillerTarget: number;
		haulerTarget: number;
		upgraderTarget: number;
		builderTarget: number;
		repairerTarget: number;
		defenderTarget: number;
		reserverTarget: number;
		remoteharvesterTarget: number;
		conveyorTarget?: number;
		workerTarget: number;
		scoutTarget?: number;
	}
}
