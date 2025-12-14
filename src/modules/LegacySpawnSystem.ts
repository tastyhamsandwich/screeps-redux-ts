/** Manages creep spawning for a room using a legacy round-robin scheduling system.
 *
 * Operates in two phases:
 * - **Bootstrap Phase**: Prioritizes spawning harvesters and fillers until energy production is sufficient
 * - **Normal Phase**: Cycles through haulers, upgraders, builders, repairers, and reservers
 *
 * Features:
 * - Throttles spawn assessments every 3 ticks to reduce CPU usage
 * - Uses Role For Quota (RFQ) system to track creep roles independently of identity
 * - Implements pending spawn tracking for creeps that couldn't spawn due to insufficient energy
 * - Validates cached sources before proceeding with spawn logic
 * - Uses cached spawn object IDs for improved performance
 * - Provides debug logging for spawn operations and state tracking
 *
 * @param room - The room to manage spawning for
 *
 * @remarks
 * - Requires room.memory.objects to be populated with cached spawn and source IDs
 * - Maintains round-robin index in room.memory.data.indices for fair role distribution
 * - Stores pending spawns in room.memory.data.pendingSpawn with a 100-tick timeout
 * - Spawned creeps receive role-specific memory configurations including source/container assignments for harvesters
 */

import { creepRoleCounts } from "@main";
import { PLAYER_USERNAME, LEGACY_SPAWN_CHECK_RATE } from '@functions/utils/constants';
import * as FUNC from '@functions/index';

/** Helper function to generate name suffix with current counter. */
const getNameSuffix = (role: string, counter: number): string => {
	try {
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
			case 'worker': return `_W${creepRoleCounts.worker + counter}`;
			case 'conveyor': return `_C${creepRoleCounts.conveyor + counter}`;
			case 'infantry': return `_Inf${creepRoleCounts.infantry + counter}`;
			default: return `_${counter}`;
		}
	} catch (e) {
		console.log(`Execution Error In Function: getNameSuffix(${role}, ${counter}) on Tick ${Game.time}. Error: ${e}`);
		return `_${counter}`;
	}
};

/** Calculate creep energy cost */
function calculateCreepCost(body: BodyPartConstant[]): number {
	try {
		return _.sum(body, p => BODYPART_COST[p]);
	} catch (e) {
		console.log(`Execution Error In Function: calculateCreepCost() on Tick ${Game.time}. Error: ${e}`);
		return 0;
	}
}

/** Attempts to spawn a creep with the specified role and memory configuration.
 *
 * Handles pending spawn resumption when energy becomes available, and manages
 * name collision resolution through counter incrementation.
 *
 * @param spawn - The spawn structure to use for spawning
 * @param role - The role to assign to the spawned creep
 * @param memory - Memory configuration object for the creep
 * @param room - The room where spawning occurs
 * @param colName - Colony name prefix for the creep name
 * @param capOverride - Optional energy capacity override (used for emergency harvesters)
 *
 * @returns A Screeps return code indicating spawn success or failure:
 * - OK: Creep spawned successfully or pending spawn resumed
 * - ERR_NOT_ENOUGH_ENERGY: Insufficient energy; spawn stored as pending
 * - Other error codes: Invalid name, invalid body, etc.
 *
 * @remarks
 * - Pending spawns are stored in room.memory.data.pendingSpawn with a 100-tick timeout
 * - If a pending spawn exists and has sufficient energy, it takes priority over new spawns
 * - Automatically increments name counter on ERR_NAME_EXISTS to resolve collisions
 * - Updates room statistics (creepsSpawned, creepPartsSpawned) on successful spawn
 * - Respects room.memory.data.spawnEnergyLimit if set (overrides capacity)
 */
function trySpawnCreep(spawn: StructureSpawn,	role: string,	memory: CreepMemory, room: Room, colName: string,	capOverride?: number): ScreepsReturnCode {
	try {
		// Determine energy capacity (override for emergency harvesters)
		let cap = capOverride ?? room.energyCapacityAvailable;
		if (room.memory.data.spawnEnergyLimit && room.memory.data.spawnEnergyLimit > 0)
			cap = room.memory.data.spawnEnergyLimit;
		const body = spawn.determineBodyParts(role, cap);
		const cost = calculateCreepCost(body);
		const pending = room.memory.data.pendingSpawn;

		// If we already have a pending spawn and enough energy, try to resume it
		if (pending && room.energyAvailable >= pending.cost) {
			const result = spawn.spawnCreep(pending.body, pending.name, { memory: pending.memory });
			if (result === OK) {
				if (role === 'reserver') {
					Game.rooms[room.name].memory.remoteRooms[pending.memory.targetRoom].creepAssignments.reserver = pending.name;
				}
				if (role === 'remoteharvester') {
					const sourceNum = (pending.memory.sourceNum === 1) ? 'sourceOne' : 'sourceTwo';
					Game.rooms[room.name].memory.remoteRooms[pending.memory.targetRoom].creepAssignments[sourceNum] = pending.name;
				}
				spawn.log(`Resuming pending spawn for ${pending.memory.role} (${pending.name})`);
				delete room.memory.data.pendingSpawn;
				room.memory.stats.creepsSpawned++;
				room.memory.stats.creepPartsSpawned += pending.body.length;  // Use pending.body.length, not current body
				room.memory.stats.energySpentOnSpawns = (room.memory.stats.energySpentOnSpawns ?? 0) + pending.cost;
				return OK;
			}
			if (room.memory.data.debugSpawn)
				spawn.log(`Pending Spawn Result: ${FUNC.getReturnCode(result)}`);
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
			if (role === 'reserver') {
				Game.rooms[room.name].memory.remoteRooms[pending.memory.targetRoom].creepAssignments.reserver = pending.name;
			}
			if (role === 'remoteharvester') {
				const sourceNum = (pending.memory.sourceNum === 1) ? 'sourceOne' : 'sourceTwo';
				Game.rooms[room.name].memory.remoteRooms[pending.memory.targetRoom].creepAssignments[sourceNum] = pending.name;
			}
			spawn.log(`Spawning ${role} ${name} in ${room.name}`);
			room.memory.stats.creepsSpawned++;
			room.memory.stats.creepPartsSpawned += body.length;
			room.memory.stats.energySpentOnSpawns = (room.memory.stats.energySpentOnSpawns ?? 0) + cost;
			return OK;
		} else if (result === ERR_NOT_ENOUGH_ENERGY) {
			const time = Game.time;
			room.memory.data.pendingSpawn = { role, body, name, memory, cost, time };
			spawn.log(`Not enough energy for ${role} (${cost}). Waiting until room energy >= ${cost}`);
			return result;
		} else {
			spawn.log(`Failed to spawn ${(FUNC.capitalize(role))}: ${FUNC.getReturnCode(result)}`);
			return result;
		}
	} catch (e) {
		console.log(`Execution Error In Function: trySpawnCreep(${role}) on Tick ${Game.time}. Error: ${e}`);
		return ERR_NOT_ENOUGH_ENERGY;
	}
}

/** Get the next role to spawn using round-robin scheduling.
 * Switches between bootstrap phase (harvesters/fillers) and normal phase (other roles)
 * Returns the next role that needs spawning, or null if none are needed */
function getNextRoleToSpawn(
	room: Room,
	spawn: StructureSpawn,
	creepCount: { [key: string]: Creep[] },
	creepTargets: { [key: string]: number },
	harvesters_and_fillers_satisfied: boolean
): string | null {
	try {
		let roleConfigs;
		let currentIndex;

		if (!harvesters_and_fillers_satisfied) {
			// Bootstrap phase: cycle between harvesters and fillers
			roleConfigs = [
				{
					name: 'harvester',
					count: creepCount.harvesters.length,
					target: creepTargets.harvesterTarget,
					check: () => needMoreHarvesters(room, creepCount.harvesters)
				},
				{
					name: 'filler',
					count: creepCount.fillers.length,
					target: creepTargets.fillerTarget,
					check: () => spawn.room.controller!.level >= 2 || creepCount.harvesters.length >= creepTargets.harvesterTarget
				}
			];
			currentIndex = (room.memory.data as any).indices.lastBootstrapRoleIndex ?? -1;
		} else {
			// Normal phase: cycle through other roles
			roleConfigs = [
				{
					name: 'hauler',
					count: creepCount.haulers.length,
					target: creepTargets.haulerTarget,
					check: () => spawn.room.storage || room.memory.data.haulerPairs
				},
				{
					name: 'upgrader',
					count: creepCount.upgraders.length,
					target: creepTargets.upgraderTarget,
					check: () => true
				},
				{
					name: 'builder',
					count: creepCount.builders.length,
					target: creepTargets.builderTarget,
					check: () => room.memory.data.numCSites! > 0
				},
				{
					name: 'repairer',
					count: creepCount.repairers.length,
					target: creepTargets.repairerTarget,
					check: () => room.find(FIND_STRUCTURES, { filter: (s) => { // Check if there are any roads or containers
						return ((s.structureType === STRUCTURE_CONTAINER ||			 // that have less than 80% of their full health
							s.structureType === STRUCTURE_ROAD) &&
							s.hits / s.hitsMax > 0.80 ) }}).length > 0
				},
				{
					name: 'reserver',
					count: creepCount.reservers.length,
					target: creepTargets.reserverTarget,
					check: () => spawn.room.energyCapacityAvailable >= 800
				},
				{
					name: 'conveyor',
					count: creepCount.conveyors.length,
					target: creepTargets.conveyorTarget,
					check: () => room.storage && room.linkStorage && (room.linkOne || room.linkTwo || room.linkController)
				},
				{
					name: 'worker',
					count: creepCount.workers.length,
					target: creepTargets.workerTarget,
					check: () => true
				},
				{
					name: 'infantry',
					count: creepCount.infantry.length,
					target: creepTargets.infantryTarget,
					check: () => true
				}
			];
			currentIndex = (room.memory.data as any).indices.lastNormalRoleIndex ?? -1;
		}

		// Try each role in round-robin order
		for (let i = 0; i < roleConfigs.length; i++) {
			const roleIndex = (currentIndex + 1 + i) % roleConfigs.length;
			const roleConfig = roleConfigs[roleIndex];

			if (roleConfig.count < roleConfig.target && roleConfig.check()) {
				const indexKey = !harvesters_and_fillers_satisfied ? 'lastBootstrapRoleIndex' : 'lastNormalRoleIndex';
				(room.memory.data.indices as any)[indexKey] = roleIndex;
				return roleConfig.name;
			}
		}

		return null;
	} catch (e) {
		console.log(`Execution Error In Function: getNextRoleToSpawn() on Tick ${Game.time}. Error: ${e}`);
		return null;
	}
}

/** Legacy version spawn management system which checks against role quotas and existing creep roles saved in their memory to determine spawn requirements.
 *
 * Uses round-robin scheduling to spawn roles evenly in two phases: bootstrap (harvesters/fillers) and normal (other roles). */
export const legacySpawnManager = {
	run: (room: Room) => {
		try {
			const roomName = room.name;
		const debugSpawn = Memory.globalSettings?.debug?.spawnDebug || false;

		if (debugSpawn) console.log(`${room.link()}Legacy Spawn Manager: Starting spawn check`);

		// Throttle spawn assessments to prevent excessive CPU usage (every 3 ticks for legacy system)
		if (!room.memory.data) room.memory.data = {};
		if (!room.memory.data.spawnCheckRate) room.memory.data.spawnCheckRate = LEGACY_SPAWN_CHECK_RATE;
		if (room.memory.data.lastSpawnCheck && Game.time - room.memory.data.lastSpawnCheck < 3) {
			if (debugSpawn) room.log(`Legacy Spawn Manager: Throttled (last check: ${room.memory.data.lastSpawnCheck}, current: ${Game.time})`);
			return;
		}

		//! EVERYTHING PAST THIS POINT IS EXECUTED ONCE EVERY THREE TICKS ONLY
		room.memory.data.lastSpawnCheck = Game.time;
		if (debugSpawn) room.log(`Legacy Spawn Manager: Passed throttle check`);

		// pull creep role caps from room memory, or set to default value if none are set
		let harvesterTarget: 	number = _.get(room.memory, ['quotas', 'harvesters'	], 2);
		let fillerTarget: 		number = _.get(room.memory, ['quotas', 'fillers'		], 2);
		let haulerTarget:			number = _.get(room.memory, ['quotas', 'haulers'		], 2);
		let upgraderTarget: 	number = _.get(room.memory, ['quotas', 'upgraders'	], 2);
		let builderTarget: 		number = _.get(room.memory, ['quotas', 'builders'		], 2);
		let repairerTarget: 	number = _.get(room.memory, ['quotas', 'repairers'	], 0);
		let defenderTarget: 	number = _.get(room.memory, ['quotas', 'defenders'	], 2);
		let infantryTarget:		number = _.get(room.memory, ['quotas', 'infantry'		], 0);
		let reserverTarget: 	number = _.get(room.memory, ['quotas', 'reservers'	], 1);
		let conveyorTarget:		number = _.get(room.memory, ['quotas', 'conveyors'	], 0);
		let workerTarget: 		number = _.get(room.memory, ['quotas', 'workers'		], 0);

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
		let infantry:					Creep[] = creepsByRole['infantry'				] || [];
		let reservers: 				Creep[] = creepsByRole['reserver'				] || [];
		let remoteharvesters: Creep[] = creepsByRole['remoteharvester'] || [];
		let conveyors:				Creep[] = creepsByRole['conveyor'				] || [];
		let workers:					Creep[] = creepsByRole['worker'					] || [];

		const totalWorkParts = _.sum(harvesters, creep =>
			_.filter(creep.body, part => part.type === WORK).length
		);

		// Use cached spawn IDs instead of expensive room.find()
		const spawnIds = room.memory.objects?.spawns || [];
		const spawns = (Array.isArray(spawnIds) ? spawnIds : [spawnIds])
			.map((id: any) => Game.getObjectById(id as Id<StructureSpawn>))
			.filter((s): s is StructureSpawn => s !== null && s.my);

		if (!spawns.length)	room.cacheObjects();

		// Safety check: ensure sources are cached before spawning
		if (!room.memory.objects?.sources || room.memory.objects.sources.length === 0) {
			if (debugSpawn) room.log(`Legacy Spawn Manager: No sources cached, skipping spawn logic this tick`);
			return;
		}

		if (debugSpawn) room.log(`Legacy Spawn Manager: Sources cached (${room.memory.objects.sources.length}), spawns found (${spawns.length})`);
		const harvesters_and_fillers_satisfied = Boolean(((totalWorkParts >= (room.memory.objects.sources.length * 5) || harvesters.length >= harvesterTarget) && fillers.length >= fillerTarget));

		if (harvesters_and_fillers_satisfied)
			new RoomVisual(roomName).text('✅', 1,1,{color: 'green', align: 'left', });
		else
			new RoomVisual(roomName).text('⏳', 1,1,{color: 'red', align: 'left', });

		const colName = `Col1`;

		if (debugSpawn) room.log(`Legacy Spawn Manager: Harvesters=${harvesters.length}, WorkParts=${totalWorkParts}, Satisfied=${harvesters_and_fillers_satisfied}`);

		if (spawns.length) {

			const creepCounts = {
				harvesters,
				fillers,
				haulers,
				upgraders,
				builders,
				repairers,
				reservers,
				conveyors,
				workers,
				defenders,
				infantry,
				remoteharvesters
			}

			const creepTargets = {
				harvesterTarget,
				fillerTarget,
				haulerTarget,
				upgraderTarget,
				builderTarget,
				repairerTarget,
				reserverTarget,
				conveyorTarget,
				workerTarget,
				defenderTarget,
				infantryTarget,
				remoteharvesterTarget
			}

			_.forEach(spawns, (spawnAny) => {
				// For every spawn in the room that we own
				const spawn = spawnAny as StructureSpawn;
				let cap = spawn.room.energyCapacityAvailable;

				// If we have no harvesters, stop using the room's energy capacity for
				// body measurements and use what we have right now to spawn a new harvester
				if (harvesters.length == 0) cap = spawn.room.energyAvailable;

				if (debugSpawn) console.log(`${room.link()}${spawn.name}: Spawning=${spawn.spawning}, Cap=${cap}`);

				if (!spawn.spawning) {
					// Check for pending spawn request (stored in room memory)
					const pending = room.memory.data.pendingSpawn;

					if (pending) {
						const timeSincePending = Game.time - pending.time;

						// Absolute timeout: clear pending spawn if it's been stuck for 100 ticks
						if (timeSincePending >= 100) {
							spawn.log(`TIMEOUT: Clearing pending spawn for ${pending.memory.role} (${pending.name}) after ${timeSincePending} ticks`);
							delete room.memory.data.pendingSpawn;
						}
						// Retry after 50 ticks
						else if (timeSincePending >= 50) {
							const result = spawn.retryPending();
							if (result !== OK && result !== ERR_NOT_ENOUGH_ENERGY) {
								if (debugSpawn)
									spawn.log(`Retry for pending ${pending.memory.role} failed: ${FUNC.getReturnCode(result)}`);
							}
							return; // Skip other spawn logic this tick
						}
						// Check if we have enough energy every tick
						else if (room.energyAvailable >= pending.cost) {
							const result = spawn.retryPending();
							if (result === OK)
								spawn.log(`Resumed pending spawn for ${pending.memory.role} (${pending.name}) after ${timeSincePending} ticks`);
							else if (result !== ERR_NOT_ENOUGH_ENERGY)
								spawn.log(`Failed to resume pending ${pending.memory.role}: ${FUNC.getReturnCode(result)}`);
							return; // Skip other spawn logic this tick
						}
						// Pending spawn exists but not enough energy yet
						else {
							if (debugSpawn && timeSincePending % 10 === 0)
								spawn.log(`Pending ${pending.memory.role} waiting for energy (${room.energyAvailable}/${pending.cost}, age: ${timeSincePending}t)`);
							return; // Skip other spawn logic this tick
						}
					}

					// Get the next role to spawn using round-robin scheduling
					const nextRole = getNextRoleToSpawn(
						room,
						spawn,
						creepCounts,
						creepTargets,
						harvesters_and_fillers_satisfied
					);

					if (nextRole) {
						if (debugSpawn) spawn.log(`Attempting to spawn ${nextRole} via round-robin`);

						// Handle role-specific spawning logic
						switch (nextRole) {
							case 'harvester': {
								const nextAssigned = (room.memory.data.indices.nextHarvesterAssigned % 2) + 1;
								const sourceID = (nextAssigned === 1) ? room.sourceOne.id : room.sourceTwo.id;
								let containerID = 'none';
								if (!room.memory.data.flags.dropHarvestingEnabled && (room.containerOne && room.containerTwo))
									containerID = (nextAssigned === 1) ? room.containerOne.id : room.containerTwo.id;
								const sourceNum = (nextAssigned === 1) ? 1 : 2;
								room.memory.data.indices.nextHarvesterAssigned++;
								trySpawnCreep(spawn, 'harvester', { role: 'harvester', RFQ: 'harvester', home: room.name, room: room.name, working: false, disable: false, rally: 'none', source: sourceID, bucket: containerID, sourceNum: sourceNum }, room, colName, cap);
								return;
							}
							case 'filler':
								trySpawnCreep(spawn, 'filler', { role: 'filler', RFQ: 'filler', home: room.name, room: room.name, working: false, disable: false, rally: 'none' }, room, colName);
								return;
							case 'hauler':
								trySpawnCreep(spawn, 'hauler', { role: 'hauler', RFQ: 'hauler', home: room.name, room: room.name, working: false, disable: false, rally: 'none' }, room, colName);
								return;
							case 'upgrader':
								trySpawnCreep(spawn, 'upgrader', { role: 'upgrader', RFQ: 'upgrader', home: room.name, room: room.name, working: false, disable: false, rally: 'none' }, room, colName);
								return;
							case 'builder':
								trySpawnCreep(spawn, 'builder', { role: 'builder', RFQ: 'builder', home: room.name, room: room.name, working: false, disable: false, rally: 'none' }, room, colName);
								return;
							case 'repairer':
								trySpawnCreep(spawn, 'repairer', { role: 'repairer', RFQ: 'repairer', home: room.name, room: room.name, working: false, disable: false, rally: 'none' }, room, colName);
								return;
							case 'reserver':
								const rooms = Object.keys(room.memory.remoteRooms);
								let roomAssignment;
								for (let i=0; i < rooms.length; i++) {
									if (!room.memory.remoteRooms[rooms[i]].creepAssignments.reserver) {
										roomAssignment = rooms[i];
										break;
									} else continue;
								}
								trySpawnCreep(spawn, 'reserver', { role: 'reserver', RFQ: 'reserver', home: room.name, room: room.name, working: false, disable: false, rally: 'none', targetRoom: roomAssignment }, room, colName);
								return;
							case 'conveyor':
								trySpawnCreep(spawn, 'conveyor', { role: 'conveyor', RFQ: 'conveyor', home: room.name, room: room.name, disable: false, rally: 'none'}, room, colName);
								return;
							case 'worker':
								trySpawnCreep(spawn, 'worker', { role: 'worker', RFQ: 'worker', home: room.name, room: room.name, disable: false, rally: 'none'}, room, colName);
								return;
							case 'infantry':
								trySpawnCreep(spawn, 'infantry', { role: 'infantry', RFQ: 'infantry', home: room.name, room: room.name, disable: false, rally: 'none'}, room, colName);
								return;
							case 'remoteharvester': {
								const rooms = Object.keys(room.memory.remoteRooms);
								let sourceAssignment = '';
								let sourceNum = 0;
								let targetRoom = '';
								for (let i=0; i < rooms.length; i++) {
									const remoteRoom = room.memory.remoteRooms[rooms[i]];
									if (!remoteRoom.creepAssignments.sourceOne) {
										sourceAssignment = remoteRoom.sources[0];
										sourceNum = 1;
										targetRoom = rooms[i];
										break;
									} else if (remoteRoom.sources.length > 1) {
										if (!remoteRoom.creepAssignments.sourceTwo) {
											sourceAssignment = remoteRoom.sources[1];
											sourceNum = 2;
											targetRoom = rooms[i];
											break;
										}
									}
									continue;
								}
								trySpawnCreep(spawn, 'remoteharvester', { role: 'remoteharvester', RFQ: 'remoteharvester', home: room.name, room: room.name, targetRoom: '', source: sourceAssignment, sourceNum: sourceNum, disable: false, rally: 'none'}, room, colName);
							}
						}
					}
					// If round-robin didn't select a role, attempt remote/reserver spawning using cached remoteRooms
					if (!nextRole) {
						try {
							const remoteRooms = room.memory.remoteRooms || {};
							const sourceEntries: { roomName: string, sourceId: string }[] = [];

							for (const rName of Object.keys(remoteRooms)) {
								const info = remoteRooms[rName];
								if (!info || !info.sources) continue;

								// Skip rooms owned by other players
								if (info.controllerOwner && info.controllerOwner !== PLAYER_USERNAME) continue;

								for (const sid of info.sources) {
									sourceEntries.push({ roomName: rName, sourceId: sid });
								}
							}

							// Determine sources already assigned to existing remote harvesters
							const assignedSourceIds = _.compact(_.map(remoteharvesters, c => c.memory && c.memory.source)) as string[];
							const unassignedSources = sourceEntries.filter(se => !assignedSourceIds.includes(se.sourceId));

							if (unassignedSources.length > 0) {
								const target = unassignedSources[0];
								trySpawnCreep(spawn, 'remoteharvester', {
									role: 'remoteharvester',
									RFQ: 'remoteharvester',
									home: room.name,
									room: room.name,
									targetRoom: target.roomName,
									source: target.sourceId,
									working: false,
									disable: false,
									rally: 'none'
								}, room, colName);
								return;
							}

							// Next: look for rooms that need a reserver
							const roomsNeedingReserve: string[] = [];
							for (const rName of Object.keys(remoteRooms)) {
								const info = remoteRooms[rName];
								if (!info || !info.controllerId) continue;

								const reservation = info.reservation;
								const reservedByUs = reservation && reservation.username === PLAYER_USERNAME;
								if (!reservedByUs || (reservation && reservation.ticksToEnd < 500)) {
									roomsNeedingReserve.push(rName);
								}
							}

							if (roomsNeedingReserve.length > 0) {
								const targetRoom = roomsNeedingReserve[0];
								trySpawnCreep(spawn, 'reserver', {
									role: 'reserver',
									RFQ: 'reserver',
									home: room.name,
									room: room.name,
									targetRoom,
									working: false,
									disable: false,
									rally: 'none'
								}, room, colName);
								return;
							}
						} catch (err) {
							console.log(`${room.link()} Legacy Remote spawn error: ${err}`);
						}
					}
				}
			});

			const creepCountsDisp = {
				harvesters: creepCounts.harvesters.length,
				fillers: creepCounts.fillers.length,
				haulers: creepCounts.haulers.length,
				upgraders: creepCounts.upgraders.length,
				builders: creepCounts.builders.length,
				repairers: creepCounts.repairers.length,
				workers: creepCounts.workers.length,
				conveyors: creepCounts.conveyors.length,
				defenders: creepCounts.defenders.length,
				infantry: creepCounts.infantry.length,
				reservers: creepCounts.reservers.length,
				remoteharvesters: creepCounts.remoteharvesters.length,
			}

			// Display console information regarding creep counts and energy state
			FUNC.DisplayConsolePrompt(room, creepCountsDisp, creepTargets);
		}
		} catch (e) {
			console.log(`Execution Error In Function: legacySpawnManager.run() on Tick ${Game.time}. Error: ${e}`);
		}
	},
	insertPending: (role: CreepRole, body: BodyPartConstant[], room: Room, memory) => {

		const cost = calculateCreepCost(body);
		const colName = 'Col1';

		let counter = 0;
		let name = `${colName}${getNameSuffix(role, counter)}`;
		let result = room.spawns[0].spawnCreep(body, name, { dryRun: true, memory: memory });

		while (result === ERR_NAME_EXISTS) {
			counter++;
			name = `${colName}${getNameSuffix(role, counter)}`;
			result = room.spawns[0].spawnCreep(body, name, { dryRun: true, memory: memory });
		}

		const newPending: PendingSpawn = {
			role,
			body,
			name,
			memory,
			cost,
			time: Game.time
		}

		if (room.memory.data.pendingSpawn) delete room.memory.data.pendingSpawn;

		room.memory.data.pendingSpawn = newPending;
	}
}

/** Helper method to determine if more harvesters are needed (from main.ts logic) */
function needMoreHarvesters(room: Room, harvesters: Creep[]): boolean {
	try {
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
	} catch (e) {
		console.log(`Execution Error In Function: needMoreHarvesters(${room.name}) on Tick ${Game.time}. Error: ${e}`);
		return false;
	}
}
