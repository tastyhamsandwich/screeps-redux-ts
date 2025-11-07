import { creepRoleCounts } from "@main";

/** Legacy version spawn management system which checks against role quotas and existing creep roles saved in their memory to determine spawn requirements.
 *
 * Priority is determined solely by ordering of the conditional statements, and thus is hard-coded. */
export const legacySpawnManager = {

	run: (room: Room) => {

		const roomName = room.name;

		// pull creep role caps from room memory, or set to default value if none are set
		let harvesterTarget: number = _.get(room.memory, ['quotas', 'harvesters'], 2);
		let fillerTarget: number = _.get(room.memory, ['quotas', 'fillers'], 2);
		let haulerTarget: number = _.get(room.memory, ['quotas', 'haulers'], 2);
		let upgraderTarget: number = _.get(room.memory, ['quotas', 'upgraders'], 2);
		let builderTarget: number = _.get(room.memory, ['quotas', 'builders'], 2);
		let repairerTarget: number = _.get(room.memory, ['quotas', 'repairers'], 0);
		let defenderTarget: number = _.get(room.memory, ['quotas', 'defenders'], 2);
		let reserverTarget: number = _.get(room.memory, ['quotas', 'reservers'], 1);

		let remoteharvesterTarget: number = _.get(room.memory, ['quotas', 'remoteharvesters'], 2);

		// pull current amount of creeps alive by RFQ (Role For Quota)
		// with RFQ, this separates execution code from identity, so reassigning
		// a creep to a new role won't make it spawn a replacement unless you change RFQ too)

		let harvesters: Creep[] = _.filter(Game.creeps, (creep) => (creep.memory.RFQ == 'harvester' || creep.memory.role == 'harvester') && creep.memory.home == roomName);
		let fillers: Creep[] = _.filter(Game.creeps, (creep) => (creep.memory.RFQ == 'filler' || creep.memory.role == 'filler') && creep.memory.home == roomName);
		let haulers: Creep[] = _.filter(Game.creeps, (creep) => (creep.memory.RFQ == 'hauler' || creep.memory.role == 'hauler') && creep.memory.home == roomName);
		let upgraders: Creep[] = _.filter(Game.creeps, (creep) => (creep.memory.RFQ == 'upgrader' || creep.memory.role == 'upgrader') && creep.memory.home == roomName);
		let builders: Creep[] = _.filter(Game.creeps, (creep) => (creep.memory.RFQ == 'builder' || creep.memory.role == 'builder') && creep.memory.home == roomName);
		let repairers: Creep[] = _.filter(Game.creeps, (creep) => (creep.memory.RFQ == 'repairer' || creep.memory.role == 'repairer') && creep.memory.home == roomName);
		let defenders: Creep[] = _.filter(Game.creeps, (creep) => (creep.memory.RFQ == 'defender' || creep.memory.role == 'defender') && creep.memory.home == roomName);
		let reservers: Creep[] = _.filter(Game.creeps, (creep) => (creep.memory.RFQ == 'reserver' || creep.memory.role == 'reserver') && creep.memory.home == roomName);

		let remoteharvesters: Creep[] = _.filter(Game.creeps, (creep) => (creep.memory.RFQ == 'remoteharvester' || creep.memory.role == 'remoteharvester') && creep.memory.home == roomName);

		const nameSuffix = {
			harvester: `_H${creepRoleCounts.harvester}`,
			filler: `_F${creepRoleCounts.filler}`,
			hauler: `_Hl${creepRoleCounts.hauler}`,
			upgrader: `_H${creepRoleCounts.upgrader}`,
			builder: `_B${creepRoleCounts.builder}`,
			repairer: `_Rep${creepRoleCounts.repairer}`,
			defender: `_Def${creepRoleCounts.defender}`,
			reserver: `_Rsv${creepRoleCounts.reserver}`,
			scout: `_Sct${creepRoleCounts.scout}`,
			remoteharvester: `_RH${creepRoleCounts.remoteharvester}`
		}

		const totalWorkParts = _.sum(harvesters, creep =>
			_.filter(creep.body, part => part.type === WORK).length
		);
		const spawns = room.find(FIND_MY_STRUCTURES, { filter: (i) => i.structureType === STRUCTURE_SPAWN });
		const harvesters_and_fillers_satisfied = (totalWorkParts >= (room.memory.objects.sources.length * 2) && fillers.length - fillerTarget === 0);
		const colName = `Col1`;

		if (spawns.length) {

			_.forEach(spawns, (spawnAny) => {
				// For every spawn in the room that we own
				const spawn = spawnAny as StructureSpawn;
				let cap = spawn.room.energyCapacityAvailable;

				// If we have no harvesters, stop using the room's energy capacity for
				// body measurements and use what we have right now to spawn a new harvester
				if (harvesters.length == 0) cap = spawn.room.energyAvailable;

				if (!spawn.spawning) {
					//! Spawn Harvesters and Fillers before anything else
					if (!harvesters_and_fillers_satisfied) {
						//# Spawn Harvesters
						if (needMoreHarvesters(spawn.room)) { // Determine if we have enough harvesters (by work parts per total sources in room)
							const body = spawn.determineBodyParts('harvester', cap);
							const ticksToSpawn = body.length * 3;
							let sourceID, containerID;
							let lastHarvesterAssigned = spawn.room.memory.data.lastHarvesterAssigned || 0; // tracker flag to determine which source info to use for harvester
							if (lastHarvesterAssigned === 0) {
								sourceID = spawn.room.memory.objects.sources[0];
								if (spawn.room.memory?.containers?.sourceOne) containerID = spawn.room.memory?.containers?.sourceOne;
							} else {
								sourceID = spawn.room.memory.objects.sources[1];
								if (spawn.room.memory?.containers?.sourceTwo) containerID = spawn.room.memory?.containers?.sourceTwo;
							}
							let countMod = 1;
							let name = `${colName}${nameSuffix.harvester}`;
							let result = spawn.spawnCreep(body, name, { memory: { role: 'harvester', RFQ: 'harvester', home: room.name, room: room.name, working: false, disable: false, rally: 'none', source: sourceID, bucket: containerID, tts: ticksToSpawn } });
							while (result == ERR_NAME_EXISTS) {
								countMod++;
								name = `${colName}${nameSuffix.harvester}`;
								result = spawn.spawnCreep(body, name, { memory: { role: 'harvester', RFQ: 'harvester', home: room.name, room: room.name, working: false, disable: false, rally: 'none', source: sourceID, bucket: containerID, tts: ticksToSpawn } });
							}
							if (result === OK) {
								console.log(`${spawn.name}: Spawning new Harvester ${name} in ${room.name}, assigned to source #${lastHarvesterAssigned + 1}`);
								lastHarvesterAssigned = (lastHarvesterAssigned + 1) % 2;
								spawn.room.memory.data.lastHarvesterAssigned = lastHarvesterAssigned;
							}
							else console.log(`${spawn.name}: Failed to spawn Harvester: ${result}`);
						}
						//# Spawn Fillers
						else if (spawn.room.controller!.level >= 2 && fillers.length < fillerTarget) {
							const body = spawn.determineBodyParts('filler', spawn.room.energyCapacityAvailable);
							let countMod = 1;
							let name = `${colName}${nameSuffix.filler}`;
							let result = spawn.spawnCreep(body, name, { memory: { role: 'filler', RFQ: 'filler', home: room.name, room: room.name, working: false, disable: false, rally: 'none' } });
							while (result == ERR_NAME_EXISTS) {
								countMod++;
								name = `${colName}${nameSuffix.filler}`;
								result = spawn.spawnCreep(body, name, { memory: { role: 'filler', RFQ: 'filler', home: room.name, room: room.name, working: false, disable: false, rally: 'none' } });
							}
							if (result === OK) console.log(`${spawn.name}: Spawning new Filler ${name} in ${room.name}`);
							else console.log(`${spawn.name}: Failed to spawn Filler: ${result}`);
						}
						//# Spawn Haulers
						else if (spawn.room.controller!.level >= 3 && spawn.room.storage && haulers.length < haulerTarget) {
							const body = spawn.determineBodyParts('hauler', spawn.room.energyCapacityAvailable);
							let countMod = 1;
							let name = `${colName}${nameSuffix.hauler}`;
							let result = spawn.spawnCreep(body, name, { memory: { role: 'hauler', RFQ: 'hauler', home: room.name, room: room.name, working: false, disable: false, rally: 'none' } });
							while (result == ERR_NAME_EXISTS) {
								countMod++;
								name = `${colName}${nameSuffix.hauler}`;
								result = spawn.spawnCreep(body, name, { memory: { role: 'hauler', RFQ: 'hauler', home: room.name, room: room.name, working: false, disable: false, rally: 'none' } });
							}
							if (result === OK) {
								console.log(`${spawn.name}: Spawning new Hauler ${name} in ${room.name}`);
								if (spawn.room.memory.data.logisticalPairs)
									Game.creeps[name].assignLogisticalPair();
								else {
									spawn.room.registerLogisticalPairs();
									Game.creeps[name].assignLogisticalPair();
								}
							}
							else console.log(`${spawn.name}: Failed to spawn Hauler: ${result}`);
						}
						//! Spawn other creep types if harvesters & fillers fulfilled
					} else {
						//# Spawn Upgraders
						if (upgraders.length < upgraderTarget) {
							const body = spawn.determineBodyParts('upgrader', spawn.room.energyCapacityAvailable);
							let countMod = 1;
							let name = `${colName}${nameSuffix.upgrader}`;
							let result = spawn.spawnCreep(body, name, { memory: { role: 'upgrader', RFQ: 'upgrader', home: room.name, room: room.name, working: false, disable: false, rally: 'none' } });
							while (result == ERR_NAME_EXISTS) {
								countMod++;
								let name = `${colName}${nameSuffix.upgrader}`;
								result = spawn.spawnCreep(body, name, { memory: { role: 'upgrader', RFQ: 'upgrader', home: room.name, room: room.name, working: false, disable: false, rally: 'none' } });
							}
							if (result === OK) console.log(`${spawn.name}: Spawning new Upgrader ${name} in ${room.name}`);
							else console.log(`${spawn.name}: Failed to spawn Upgrader: ${result}`);
						}
						//# Spawn Builders
						else if (builders.length < builderTarget) {
							const body = spawn.determineBodyParts('builder', spawn.room.energyCapacityAvailable);
							let countMod = 1;
							let name = `${colName}${nameSuffix.builder}`;
							let result = spawn.spawnCreep(body, name, { memory: { role: 'builder', RFQ: 'builder', home: room.name, room: room.name, working: false, disable: false, rally: 'none' } });
							while (result == ERR_NAME_EXISTS) {
								countMod++;
								name = `${colName}${nameSuffix.builder}`;
								result = spawn.spawnCreep(body, name, { memory: { role: 'builder', RFQ: 'builder', home: room.name, room: room.name, working: false, disable: false, rally: 'none' } });
							}
							if (result === OK) console.log(`${spawn.name}: Spawning new Builder ${name} in ${room.name}`);
							else console.log(`${spawn.name}: Failed to spawn Builder: ${result}`);
						}
						//# Spawn Repairers
						else if (repairers.length < repairerTarget) {
							const body = spawn.determineBodyParts('repairer', spawn.room.energyCapacityAvailable);
							let countMod = 1;
							let name = `${colName}${nameSuffix.repairer}`;
							let result = spawn.spawnCreep(body, name, { memory: { role: 'repairer', RFQ: 'repairer', home: room.name, room: room.name, working: false, disable: false, rally: 'none' } });
							while (result == ERR_NAME_EXISTS) {
								countMod++;
								name = `${colName}${nameSuffix.repairer}`;
								result = spawn.spawnCreep(body, name, { memory: { role: 'repairer', RFQ: 'repairer', home: room.name, room: room.name, working: false, disable: false, rally: 'none' } });
							}
							if (result === OK) console.log(`${spawn.name}: Spawning new Repairer ${name} in ${room.name}`);
							else console.log(`${spawn.name}: Failed to spawn Repairer: ${result}`);
						}
						//# Spawn Reservers
						else if (spawn.room.energyCapacityAvailable >= 800 && reservers.length < reserverTarget) {
							const body = spawn.determineBodyParts('reserver', spawn.room.energyCapacityAvailable);
							let countMod = 1;
							let name = `${colName}${nameSuffix.reserver}`;
							let result = spawn.spawnCreep(body, name, { memory: { role: 'reserver', RFQ: 'reserver', home: room.name, room: room.name, working: false, disable: false, rally: 'none' } });
							while (result === ERR_NAME_EXISTS) {
								countMod++;
								name = `${colName}${nameSuffix.reserver}`;
								result = spawn.spawnCreep(body, name, { memory: { role: 'reserver', RFQ: 'reserver', home: room.name, room: room.name, working: false, disable: false, rally: 'none' } });
							}
							if (result === OK) console.log(`${spawn.name}: Spawning new Reserver ${name} in ${room.name}`);
							else console.log(`${spawn.name}: Failed to spawn Reserver: ${result}`);
						}
					}
				}
			});
		}
	}
}

/** Helper method to determine if more harvesters are needed (from main.ts logic) */
function needMoreHarvesters(room: Room): boolean {
	const roomName = room.name;
	const harvesters = _.filter(Game.creeps, (c) => (c.memory.RFQ == 'harvester' || c.memory.role == 'harvester') && c.memory.home == roomName);

	const sources = room.find(FIND_SOURCES);
	let totalWorkParts = 0;

	for (const harvester of harvesters)
		totalWorkParts += harvester.body.filter(part => part.type === WORK).length;

	// Each source can support 5 WORK parts (generates 10 energy/tick), need at least that many
	const neededWorkParts = sources.length * 5;
	return totalWorkParts < neededWorkParts;
}
