/** Show some basic energy and quota information every few ticks in the console
 * @example
 * [E25N25]: NRG amt/cap(%) <storage-nrg-amt> Tick: ticks-since-global-reset
 *
 * [E25N25]: H: x/y, F: x/y, Haul: x/y, U: x/y, B: x/y, R: x/y
 *
 * [E25N25]: Rsv: x/y, RH: x/y, RG: x/y, RHaul: x/y
*/
export function DisplayConsolePrompt(room: Room, creepCounts: { [key: string]: number }, creepQuotas: { [key: string]: number }): void {
	const tickCount: number = global.tickCount;
	const tickInterval: number = Memory.globalSettings.consoleSpawnInterval;
	let storageInfo = '';
	if (room.storage)
		storageInfo = '<' + room.storage.store[RESOURCE_ENERGY].toString() + '> ';
	const energy: string = 'NRG: ' + room.energyAvailable + '/' + room.energyCapacityAvailable + '(' + (room.energyAvailable / room.energyCapacityAvailable * 100).toFixed(0) + '%) ';
	if (tickInterval !== 0 && tickCount % tickInterval === 0) {
		console.log(room.link() + energy + storageInfo + ' Tick: ' + tickCount);
		console.log(room.link() + `H: ${creepCounts.harvesters}, F: ${creepCounts.fillers}/${creepQuotas.fillers}, Haul: ${creepCounts.haulers}/${creepQuotas.haulers}, U: ${creepCounts.upgraders}/${creepQuotas.upgraders}, B: ${creepCounts.builders}/${creepQuotas.builders}, R: ${creepCounts.repairers}/${creepQuotas.repairers}`);
		console.log(room.link() + `Rsv: ${creepCounts.reservers}/${creepQuotas.reservers}, RH: ${creepCounts.remoteharvesters}/${creepQuotas.remoteharvesters}, RG: ${creepCounts.remotebodyguards}/${creepQuotas.remotebodyguards}, RHaul: ${creepCounts.remotehaulers}/${creepQuotas.remotehaulers}`);
	}
}
