import { creepRoleCounts } from "@main";
import * as FUNC from '@functions/index';

const pendingSpawns: {
	[roomName: string]: { role: string; body: BodyPartConstant[]; name: string; memory: CreepMemory; cost: number };
} = {};

// Helper function to generate name suffix with current counter
const getNameSuffix = (role: string, counter: number): string => {
	switch (role) {
		case 'harvester': return `_H${creepRoleCounts.harvester + counter}`;
		case 'filler': return `_F${creepRoleCounts.filler + counter}`;
		case 'hauler': return `_Hl${creepRoleCounts.hauler + counter}`;
		case 'upgrader': return `_U${creepRoleCounts.upgrader + counter}`;
		case 'builder': return `_B${creepRoleCounts.builder + counter}`;
		case 'repairer': return `_Rep${creepRoleCounts.repairer + counter}`;
		case 'defender': return `_Def${creepRoleCounts.defender + counter}`;
		case 'reserver': return `_Rsv${creepRoleCounts.reserver + counter}`;
		case 'scout': return `_Sct${creepRoleCounts.scout + counter}`;
		case 'remoteharvester': return `_RH${creepRoleCounts.remoteharvester + counter}`;
		default: return `_${counter}`;
	}
};

/** Calculate creep energy cost */
function calculateCreepCost(body: BodyPartConstant[]): number {
	return _.sum(body, p => BODYPART_COST[p]);
}

function trySpawnCreep(spawn: StructureSpawn,	role: string,	memory: CreepMemory, room: Room, colName: string,	capOverride?: number): ScreepsReturnCode {

	// Determine energy capacity (override for emergency harvesters)
	let cap = capOverride ?? room.energyCapacityAvailable;
	const body = spawn.determineBodyParts(role, cap);
	const cost = calculateCreepCost(body);
	const pending = room.memory.data.pendingSpawn;

	// If we already have a pending spawn and enough energy, try to resume it
	if (pending && room.energyAvailable >= pending.cost) {
		const result = spawn.spawnCreep(pending.body, pending.name, { memory: pending.memory });
		if (result === OK) {
			console.log(`${room.link()}${spawn.name}> Resuming pending spawn for ${pending.memory.role} (${pending.name})`);
			delete room.memory.data.pendingSpawn;
			return OK;

		}
		if (room.memory.data.debugSpawn)
			console.log(`${room.link()}${spawn.name}> Pending Spawn Result: ${FUNC.getReturnCode(result)}`);
		return result;
	}

	// If we already have a pending spawn but not enough energy yet, don't log again
	if (pending && pending.role === role)
		return ERR_NOT_ENOUGH_ENERGY;

	// If we don't have a pending spawn, create one
	let counter = 0;
	let name = `${colName}${getNameSuffix(role, counter)}`;
	let result = spawn.spawnCreep(body, name, { memory });

	while (result === ERR_NAME_EXISTS) {
		counter++;
		name = `${colName}${getNameSuffix(role, counter)}`;
		result = spawn.spawnCreep(body, name, { memory });
	}

	if (result === OK) {
		console.log(`${room.link()}${spawn.name}> Spawning ${role} ${name} in ${room.name}`);
		return OK;
	} else if (result === ERR_NOT_ENOUGH_ENERGY) {
		room.memory.data.pendingSpawn = { role, body, name, memory, cost };
		console.log(`${room.link()}${spawn.name}> Not enough energy for ${role} (${cost}). Waiting until room energy >= ${cost}`);
		return result;
	} else {
		console.log(`${room.link()}${spawn.name}> Failed to spawn ${(FUNC.capitalize(role))}: ${FUNC.getReturnCode(result)}`);
		return result;
	}
}

/** Legacy version spawn management system which checks against role quotas and existing creep roles saved in their memory to determine spawn requirements.
 *
 * Priority is determined solely by ordering of the conditional statements, and thus is hard-coded. */
export const legacySpawnManager = {

	run: (room: Room) => {

		const roomName = room.name;
		const debugSpawn = Memory.globalSettings?.debug?.spawnDebug || false;

		if (debugSpawn) console.log(`${room.link()}Legacy Spawn Manager: Starting spawn check`);

		// Throttle spawn assessments to prevent excessive CPU usage (every 3 ticks for legacy system)
		if (!room.memory.data) room.memory.data = {};
		if (room.memory.data.lastSpawnCheck && Game.time - room.memory.data.lastSpawnCheck < 3) {
			if (debugSpawn) console.log(`${room.link()}Legacy Spawn Manager: Throttled (last check: ${room.memory.data.lastSpawnCheck}, current: ${Game.time})`);
			return;
		}

		room.memory.data.lastSpawnCheck = Game.time;
		if (debugSpawn) console.log(`${room.link()}Legacy Spawn Manager: Passed throttle check`);

		// pull creep role caps from room memory, or set to default value if none are set
		let harvesterTarget: 	number = _.get(room.memory, ['quotas', 'harvesters'	], 2);
		let fillerTarget: 		number = _.get(room.memory, ['quotas', 'fillers'		], 2);
		let haulerTarget:			number = _.get(room.memory, ['quotas', 'haulers'		], 2);
		let upgraderTarget: 	number = _.get(room.memory, ['quotas', 'upgraders'	], 2);
		let builderTarget: 		number = _.get(room.memory, ['quotas', 'builders'		], 2);
		let repairerTarget: 	number = _.get(room.memory, ['quotas', 'repairers'	], 0);
		let defenderTarget: 	number = _.get(room.memory, ['quotas', 'defenders'	], 2);
		let reserverTarget: 	number = _.get(room.memory, ['quotas', 'reservers'	], 1);

		let remoteharvesterTarget: number = _.get(room.memory, ['quotas', 'remoteharvesters'], 2);

		// Pull current amount of creeps alive by RFQ (Role For Quota) - Single pass optimization
		// With RFQ, this separates execution code from identity, so reassigning
		// a creep to a new role won't make it spawn a replacement unless you change RFQ too
		const creepsByRole = _.groupBy(
			_.filter(Game.creeps, c => c.memory.home === roomName),
			c => c.memory.RFQ || c.memory.role
		);
		let harvesters: 			Creep[] = creepsByRole['harvester'			] || [];
		let fillers: 					Creep[] = creepsByRole['filler'					] || [];
		let haulers: 					Creep[] = creepsByRole['hauler'					] || [];
		let upgraders: 				Creep[] = creepsByRole['upgrader'				] || [];
		let builders: 				Creep[] = creepsByRole['builder'				] || [];
		let repairers: 				Creep[] = creepsByRole['repairer'				] || [];
		let defenders: 				Creep[] = creepsByRole['defender'				] || [];
		let reservers: 				Creep[] = creepsByRole['reserver'				] || [];
		let remoteharvesters: Creep[] = creepsByRole['remoteharvester'] || [];

		const totalWorkParts = _.sum(harvesters, creep =>
			_.filter(creep.body, part => part.type === WORK).length
		);

		// Use cached spawn IDs instead of expensive room.find()
		const spawnIds = room.memory.objects?.spawns || [];
		const spawns = (Array.isArray(spawnIds) ? spawnIds : [spawnIds])
			.map((id: any) => Game.getObjectById(id as Id<StructureSpawn>))
			.filter((s): s is StructureSpawn => s !== null && s.my);

		if (!spawns.length)
			room.cacheObjects();

		// Safety check: ensure sources are cached before spawning
		if (!room.memory.objects?.sources || room.memory.objects.sources.length === 0) {
			if (debugSpawn) console.log(`${room.link()}Legacy Spawn Manager: No sources cached, skipping spawn logic this tick`);
			return;
		}

		if (debugSpawn) console.log(`${room.link()}Legacy Spawn Manager: Sources cached (${room.memory.objects.sources.length}), spawns found (${spawns.length})`);

		const harvesters_and_fillers_satisfied = ((totalWorkParts >= (room.memory.objects.sources.length * 5) || harvesters.length >= harvesterTarget) && fillers.length >= fillerTarget);
		const containersBuilt = (room.memory.containers.sourceOne && room.memory.containers.sourceTwo && room.memory.containers.controller);

		if (harvesters_and_fillers_satisfied)
			new RoomVisual(roomName).circle(1,1,{fill: 'white'});
		else
			new RoomVisual(roomName).rect(1,1,1,1,{fill: 'white'});

		const colName = `Col1`;

		if (debugSpawn) console.log(`${room.link()}Legacy Spawn Manager: Harvesters=${harvesters.length}, WorkParts=${totalWorkParts}, Satisfied=${harvesters_and_fillers_satisfied}`);

		if (spawns.length) {

			_.forEach(spawns, (spawnAny) => {
				// For every spawn in the room that we own
				const spawn = spawnAny as StructureSpawn;
				let cap = spawn.room.energyCapacityAvailable;

				// If we have no harvesters, stop using the room's energy capacity for
				// body measurements and use what we have right now to spawn a new harvester
				if (harvesters.length == 0) cap = spawn.room.energyAvailable;

				if (debugSpawn) console.log(`${room.link()}${spawn.name}: Spawning=${spawn.spawning}, Cap=${cap}`);

				if (!spawn.spawning) {
					// Check for pending spawn request
					const pending = pendingSpawns[room.name];
					if (pending && room.energyAvailable >= pending.cost) {
						const { role, body, name, memory } = pending;
						const result = spawns[0].spawnCreep(body, name, { memory });
						if (result === OK) {
							console.log(`${room.link()} ${spawns[0].name}: Resumed pending spawn for ${role} (${name})`);
							delete pendingSpawns[room.name];
						} else if (result !== ERR_BUSY)
							console.log(`${room.link()} ${spawns[0].name}: Retry for pending ${role} failed: ${result}`);
						return; // Skip other spawn logic this tick
					}

					//! Spawn Harvesters and Fillers before anything else
					if (!harvesters_and_fillers_satisfied) {
						if (debugSpawn) console.log(`${room.link()}${spawn.name}: Not satisfied, checking harvester needs`);
						//# Spawn Harvesters
						if (needMoreHarvesters(room, harvesters)) {
							if (debugSpawn) console.log(`${room.link()}${spawn.name}: Need more harvesters, attempting spawn`);
							const lastAssigned = room.memory.data.lastHarvesterAssigned ?? 0;635555555555555555555555555555555555555555555555555555555555555555555555555555555555554444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444
							const sourceID = room.memory.objects.sources[lastAssigned] || undefined;
							const containerID = lastAssigned === 0 ? room.memory?.containers?.sourceOne : room.memory?.containers?.sourceTwo;
							const sourceNum = lastAssigned === 0 ? 1 : 2;
							room.memory.data.lastHarvesterAssigned = (lastAssigned + 1) % 2;
							trySpawnCreep( spawn, 'harvester', { role: 'harvester', RFQ: 'harvester', home: room.name, room: room.name, working: false, disable: false, rally: 'none', source: sourceID, bucket: containerID,	sourceNum: sourceNum }, room, colName, cap);
							return;
						}
						//# Spawn Fillers
						else if ((spawn.room.controller!.level >= 2 && fillers.length < fillerTarget) || (harvesters.length >= harvesterTarget && fillers.length < fillerTarget)) {
							trySpawnCreep( spawn, 'filler', { role: 'filler', RFQ: 'filler', home: room.name, room: room.name, working: false, disable: false, rally: 'none' }, room, colName);
							return;
						}
						//! Spawn other creep types if harvesters & fillers fulfilled
					} else {
						//# Spawn Haulers
						if ((spawn.room.storage || containersBuilt) && haulers.length < haulerTarget) {
							trySpawnCreep(spawn, 'hauler', { role: 'hauler', RFQ: 'hauler', home: room.name, room: room.name, working: false, disable: false, rally: 'none' }, room, colName);
							return;
						}
						//# Spawn Upgraders
						if (upgraders.length < upgraderTarget) {
							trySpawnCreep( spawn, 'upgrader', { role: 'upgrader', RFQ: 'upgrader', home: room.name, room: room.name, working: false, disable: false, rally: 'none' }, room, colName);
							return;
						}
						//# Spawn Builders
						else if (room.memory.data.numCSites > 0 && builders.length < builderTarget) {
							trySpawnCreep( spawn, 'builder', { role: 'builder', RFQ: 'builder', home: room.name, room: room.name, working: false, disable: false, rally: 'none' }, room, colName);
							return;
						}
						//# Spawn Repairers
						else if (repairers.length < repairerTarget) {
							trySpawnCreep( spawn, 'repairer', { role: 'repairer', RFQ: 'repairer', home: room.name, room: room.name, working: false, disable: false, rally: 'none' }, room, colName);
							return;
						}
						//# Spawn Reservers
						else if (spawn.room.energyCapacityAvailable >= 800 && reservers.length < reserverTarget) {
							trySpawnCreep(spawn, 'reserver', { role: 'reserver', RFQ: 'reserver', home: room.name, room: room.name, working: false, disable: false, rally: 'none' }, room, colName);
							return;
						}
					}
				}
			});
		}
	}
}

/** Helper method to determine if more harvesters are needed (from main.ts logic) */
function needMoreHarvesters(room: Room, harvesters: Creep[]): boolean {
	// Use cached source count instead of expensive room.find()
	const numSources = room.memory.objects?.sources?.length || 0;
	const harvesterQuota = _.get(room.memory, ['quotas', 'harvesters'], 2);

	// Check quota first - if we have enough harvesters by quota, don't spawn more
	if (harvesters.length >= harvesterQuota) return false;

	let totalWorkParts = 0;

	for (const harvester of harvesters)
		totalWorkParts += harvester.body.filter(part => part.type === WORK).length;

	// Each source can support 5 WORK parts (generates 10 energy/tick), need at least that many
	const neededWorkParts = numSources * 5;
	return totalWorkParts < neededWorkParts;
}
