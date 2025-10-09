import { log, initGlobal } from './functions/utils/globals';
import { pathing } from './functions/utils/constants';
import { buildProgress, repairProgress } from './functions/visual/progress';
import './functions/utils/globals';
import 'prototypes/creep';

/**
 * A creep whose role it is to navigate to a source, harvest energy, and deposit it in the container next to it (usually built by the harvester itself). A source requires 5 WORK parts
 * in order to be fully utilized. Harvesters can forego CARRY parts if there is a container underneath them for them to "drop-harvest" onto, otherwise they need inventory space in order
 * to properly transfer energy to an adjacent container or object.
 */
export const Harvester = {
	run: function (creep: Creep) {

		const room: Room = creep.room;
		const cMem: CreepMemory = creep.memory;
		const rMem: RoomMemory = Game.rooms[cMem.home].memory;
		const pos: RoomPosition = creep.pos;

		if (cMem.disable === undefined) cMem.disable = false;
		if (cMem.rally === undefined) cMem.rally = 'none';
		if (cMem.returnEnergy === undefined) cMem.returnEnergy = false;
		if (!cMem.source) creep.assignHarvestSource('local', true, false);

		if (!cMem.disable) {

			if (cMem.rally == 'none') {

				if (pos.x == 49) creep.move(LEFT);
				else if (pos.x == 0) creep.move(RIGHT);
				else if (pos.y == 49) creep.move(TOP);
				else if (pos.y == 0) creep.move(BOTTOM);

				if (creep.ticksToLive! <= 2) {
					creep.unloadEnergy();
					creep.say('☠️');
				}

				let source: Source;
				if (creep.getActiveBodyparts(CARRY) === 0) {


					source = Game.getObjectById(cMem.source) as unknown as Source;
					if (!pos.isNearTo(source))
						creep.moveTo(source, pathing.harvesterPathing);
					else {
						const containers: StructureContainer[] = source.pos.findInRange(FIND_STRUCTURES, 2, { filter: { structureType: STRUCTURE_CONTAINER } });
						if (containers.length) {
							const bucket = pos.findClosestByRange(containers);
							if (bucket) {
								if (cMem.bucket === undefined)
									cMem.bucket = bucket.id;
								if (!pos.isEqualTo(bucket))
									creep.moveTo(bucket, pathing.harvesterPathing);
								else
									creep.harvestEnergy();
							}
						} else
							creep.harvestEnergy();
					}
				} else {
					if (creep.store.getFreeCapacity() == 0 || creep.store.getFreeCapacity() < (creep.getActiveBodyparts(WORK) * 2)) {
						if (cMem.returnEnergy === true) {
							if (creep.transfer(Game.spawns['Spawn1'], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
								creep.moveTo(Game.spawns['Spawn1'], pathing.harvesterPathing);
						} else {
							if (cMem.bucket) {
								creep.unloadEnergy(cMem.bucket);
							} else {
								const containers: StructureContainer[] = pos.findInRange(FIND_STRUCTURES, 3, { filter: (i) => { i.structureType === STRUCTURE_CONTAINER } });
								if (containers.length) {
									const target: StructureContainer = pos.findClosestByRange(containers)!;
									if (target) {
										cMem.bucket = target.id;
										if (!pos.isNearTo(target)) creep.moveTo(target, pathing.harvesterPathing);
										else if (target.hits < target.hitsMax) creep.repair(target);
										else {
											creep.unloadEnergy();
											creep.harvestEnergy();
										}
									}
								} else {
									const nearbySites = pos.findInRange(FIND_CONSTRUCTION_SITES, 2);
									if (nearbySites.length == 0) room.createConstructionSite(pos.x, pos.y, STRUCTURE_CONTAINER);
									else {
										const buildersNearby = room.find(FIND_MY_CREEPS, { filter: (i) => i.memory.role == 'remotebuilder' || i.memory.role == 'builder' });
										if (buildersNearby.length > 0) {
											const mySite = pos.findInRange(FIND_CONSTRUCTION_SITES, 1);
											if (mySite.length)
												creep.build(mySite[0]);
											else {
												creep.unloadEnergy();
												creep.harvestEnergy();
											}
										} else {
											creep.build(nearbySites[0]);
										}
									}
									//creep.unloadEnergy();
									//creep.harvestEnergy();
								}
							}
						}
					} else creep.harvestEnergy();
				}
			} else //: I HAVE A RALLY POINT, LET'S BOOGY!
				navRallyPoint(creep);
		} else //: AI DISABLED ALERT
			aiAlert(creep);
	},

	runremote: (creep: Creep) => {
		const room: Room = creep.room;
		const cMem: CreepMemory = creep.memory;
		const rMem: RoomMemory = Game.rooms[cMem.home].memory;
		const pos: RoomPosition = creep.pos;

		if (cMem.disable === undefined) cMem.disable = false;
		if (cMem.rally === undefined) cMem.rally = 'none';
		if (cMem.returnEnergy === undefined) cMem.returnEnergy = false;
		if (cMem.haveCalledDeathAction === undefined) cMem.haveCalledDeathAction = false;
		if (!cMem.source) creep.assignHarvestSource('remote', true, false);

		if (!cMem.disable) {
			if (cMem.rally == 'none') {
				if (pos.x == 49) creep.move(LEFT);
				else if (pos.x == 0) creep.move(RIGHT);
				else if (pos.y == 49) creep.move(TOP);
				else if (pos.y == 0) creep.move(BOTTOM);

				if (creep.ticksToLive! <= 2) {
					creep.unloadEnergy();
					creep.say('☠️');
					if (cMem.haveCalledDeathAction === false) {
						Game.rooms[cMem.home].memory.outposts.numHarvesters--;
						cMem.haveCalledDeathAction = true;
					}
				}

				let source: Source;
				if (creep.getActiveBodyparts(CARRY) === 0) {
					source = Game.getObjectById(cMem.source) as unknown as Source;
					if (!pos.isNearTo(source))
						creep.advMoveTo(source, true, pathing.harvesterPathing);
					else {
						const containers: StructureContainer[] = source.pos.findInRange(FIND_STRUCTURES, 2, { filter: { structureType: STRUCTURE_CONTAINER } });
						if (containers.length) {
							const bucket = pos.findClosestByRange(containers);
							if (bucket) {
								if (cMem.bucket === undefined)
									cMem.bucket = bucket.id;
								if (!pos.isEqualTo(bucket))
									creep.advMoveTo(bucket, true, pathing.harvesterPathing);
								else
									creep.harvestEnergy();
							}
						} else
							creep.harvestEnergy();
					}
				} else {
					if (creep.store.getFreeCapacity() == 0 || creep.store.getFreeCapacity() < (creep.getActiveBodyparts(WORK) * 2)) {
						if (cMem.returnEnergy === true) {
							if (creep.transfer(Game.spawns['Spawn1'], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
								creep.advMoveTo(Game.spawns['Spawn1'], true, pathing.harvesterPathing);
						} else {
							if (cMem.bucket) {
								creep.unloadEnergy(cMem.bucket);
							} else {
								const containers: StructureContainer[] = pos.findInRange(FIND_STRUCTURES, 3, { filter: (i) => { i.structureType === STRUCTURE_CONTAINER } });
								if (containers.length) {
									const target: StructureContainer = pos.findClosestByRange(containers)!;
									if (target) {
										cMem.bucket = target.id;
										if (!pos.isNearTo(target)) creep.advMoveTo(target, true, pathing.harvesterPathing);
										else if (target.hits < target.hitsMax) creep.repair(target);
										else {
											creep.unloadEnergy();
											creep.harvestEnergy();
										}
									}
								} else {
									const nearbySites = pos.findInRange(FIND_CONSTRUCTION_SITES, 2);
									if (nearbySites.length == 0) room.createConstructionSite(pos.x, pos.y, STRUCTURE_CONTAINER);
									else {
										const buildersNearby = room.find(FIND_MY_CREEPS, { filter: (i) => i.memory.role == 'remotebuilder' || i.memory.role == 'builder' });
										if (buildersNearby.length > 0) {
											const mySite = pos.findInRange(FIND_CONSTRUCTION_SITES, 1);
											if (mySite.length)
												creep.build(mySite[0]);
											else {
												creep.unloadEnergy();
												creep.harvestEnergy();
											}
										} else {
											creep.build(nearbySites[0]);
										}
									}
								}
							}
						}
					} else creep.harvestEnergy();
				}
			} else //: I HAVE A RALLY POINT, LET'S BOOGY!
				navRallyPoint(creep);
		} else //: AI DISABLED ALERT
			aiAlert(creep);
	}
}

/**
 * A creep whose role it is to locate energy and spend it building structures around the room. Requires worker parts to be effective.
 */
export const Builder = {
	run: (creep: Creep) => {

		const room: Room = creep.room;
		const cMem: CreepMemory = creep.memory;
		const rMem: RoomMemory = Game.rooms[cMem.home].memory;
		const pos: RoomPosition = creep.pos;

		if (cMem.disable === undefined) cMem.disable = false;
		if (cMem.rally === undefined) cMem.rally = 'none';

		if (cMem.disable === true) {

		} else {
			if (cMem.rally !== 'none') {
				navRallyPoint(cMem.rally);
			} else {
				if (creep.store.getUsedCapacity() === 0)
					creep.memory.working = false;
				if (creep.store.getUsedCapacity() >= 150)
					creep.memory.working = true;

				if (!creep.memory.working) {
					if (room.storage && room.storage.store.getUsedCapacity(RESOURCE_ENERGY) > (creep.store.getCapacity() + 1000)) {
						if (creep.withdraw(room.storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
							creep.moveTo(room.storage, pathing.builderPathing);
					} else {
						const containers = room.find(FIND_STRUCTURES, { filter: (i) => i.structureType === STRUCTURE_CONTAINER });

						if (containers.length) {
							const nearestContainer = pos.findClosestByRange(containers);

							if (nearestContainer) {
								const result = creep.withdraw(nearestContainer, RESOURCE_ENERGY);
								if (result === ERR_NOT_IN_RANGE)
									creep.moveTo(nearestContainer, pathing.builderPathing);
								else if (result === ERR_NOT_ENOUGH_RESOURCES)
									creep.memory.working = true;
							}
						}
					}
				} else {
					const cSites = room.find(FIND_CONSTRUCTION_SITES);

					if (cSites.length) {
						const nearestCSite = pos.findClosestByRange(cSites);

						if (nearestCSite) {
							const result = creep.build(nearestCSite);
							if (result === ERR_NOT_IN_RANGE)
								creep.moveTo(nearestCSite, pathing.builderPathing);
							else if (result === ERR_NOT_ENOUGH_ENERGY)
								creep.memory.working = false;
						}
					}
				}
			}
		}
	},

	runremote: function (creep: Creep) {


	}
}

/**
 * A creep whose role it is to locate energy and ferry it to the spawns and extensions in a room, ensuring there is a continuous supply of energy available for creep spawning.
 * Requires MOVE and CARRY parts to be effective.
 */
export const Filler = {
	run: function (creep: Creep) {

		const room: Room = creep.room;
		const cMem: CreepMemory = creep.memory;
		const rMem: RoomMemory = Game.rooms[cMem.home].memory
		const pos: RoomPosition = creep.pos;

		if (cMem.disable === undefined) cMem.disable = false;
		if (cMem.rally === undefined) cMem.rally = 'none';
		if (room.storage && !cMem.pickup) cMem.pickup = room.storage.id;
		if (!room.storage && !cMem.pickup) {

			const containers: StructureContainer[] = creep.room.find(FIND_STRUCTURES, { filter: (i) => i.structureType === STRUCTURE_CONTAINER });
			if (containers.length > 1)
				containers.sort((a, b) => b.store.getUsedCapacity(RESOURCE_ENERGY) - a.store.getUsedCapacity(RESOURCE_ENERGY));
			cMem.pickup = containers[0].id;
		}

		if (cMem.disable === true) {
			return;
		} else {
			if (cMem.rally !== 'none') {

			} else {
				if (creep.store.getUsedCapacity() === 0) {
					let target;
					if (room.storage && room.storage.store.getUsedCapacity(RESOURCE_ENERGY) >= creep.store.getCapacity())
						target = room.storage;
					else {
						const containers: StructureContainer[] = room.find(FIND_STRUCTURES, { filter: function(i) { return i.structureType === STRUCTURE_CONTAINER }});
						if (containers.length && containers.length > 1)
							containers.sort((a,b) => b.store.getUsedCapacity(RESOURCE_ENERGY) - a.store.getUsedCapacity(RESOURCE_ENERGY));
						target = containers[0];
					}

					if (target) {
						if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
							creep.moveTo(target, pathing.haulerPathing);
					}
				}

				if (creep.store.getUsedCapacity() > 0) {
					const targets = creep.room.find(FIND_MY_STRUCTURES, { filter: (i) => (i.structureType === STRUCTURE_SPAWN || i.structureType === STRUCTURE_EXTENSION) && i.store.getFreeCapacity(RESOURCE_ENERGY) > 0 });
					if (targets.length) {
						const nearestTarget = pos.findClosestByRange(targets);

						if (nearestTarget) {
							if (creep.transfer(nearestTarget, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
								creep.moveTo(nearestTarget, pathing.haulerPathing);
						}
					}
				}
			}
		}
	}
}

export const Hauler = {
	run: (creep: Creep) => {

		const room: Room = creep.room;
		const cMem: CreepMemory = creep.memory;
		const rMem: RoomMemory = Game.rooms[cMem.home].memory;
		const pos: RoomPosition = creep.pos;

		if (cMem.disable === undefined) cMem.disable = false;
		if (cMem.rally === undefined) cMem.rally = 'none';

		if (cMem.disable === true)
			aiAlert(creep);
		else {
			if (cMem.rally === 'none') {

				if 		(pos.x == 49) creep.move(LEFT);
				else if (pos.x == 0 ) creep.move(RIGHT);
				else if (pos.y == 49) creep.move(TOP);
				else if (pos.y == 0 ) creep.move(BOTTOM);

				if (creep.ticksToLive! <= 2) creep.say('☠️');

				if (!cMem.pickup && !cMem.dropoff) creep.assignLogisticalPair();

				if (cMem.cargo === undefined) cMem.cargo = 'energy';
				if (cMem.dropoff == 'none') if (room.storage) cMem.dropoff = room.storage.id;

				let pickupTarget;
				let dropoffTarget;

				if (cMem.pickup)  pickupTarget  = Game.getObjectById(cMem.pickup)  as AnyStoreStructure;
				if (cMem.dropoff) dropoffTarget = Game.getObjectById(cMem.dropoff) as AnyStoreStructure;

				if (creep.store[RESOURCE_ENERGY] == 0 || creep.store[cMem.cargo] == 0) {
					if (cMem.pickup) {

						if (pickupTarget) {
							if (pos.isNearTo(pickupTarget)) {
								const piles = pos.findInRange(FIND_DROPPED_RESOURCES, 1);

								if (piles.length) {
									const closestPile = pos.findClosestByRange(piles);
									if (closestPile) creep.pickup(closestPile);
								} else {
									creep.withdraw(pickupTarget, cMem.cargo);
								}
							} else {
								creep.advMoveTo(pickupTarget, false, pathing.haulerPathing);
							}
						}
					}
				} else {
					if (dropoffTarget) {
						if (pos.isNearTo(dropoffTarget)) {
							if (dropoffTarget.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
								const result = creep.transfer(dropoffTarget, RESOURCE_ENERGY);
								if (result === OK)
									creep.advMoveTo(pickupTarget, false, pathing.haulerPathing);
							}
						}
						else creep.advMoveTo(dropoffTarget, false, pathing.haulerPathing);
					}
				}
			} else navRallyPoint(creep);
		}
	}
}
/**
 * A creep whose role it is to locate and repair damaged or decaying structures in a room, based on settings in the room settings memory. Requires standard worker parts (MOVE, CARRY, WORK)
 */
export const Repairer = {
	run: (creep: Creep) => {

		const room: Room = creep.room;
		const cMem: CreepMemory = creep.memory;
		const rMem: RoomMemory = Game.rooms[cMem.home].memory;
		const pos: RoomPosition = creep.pos;

		if (cMem.disable === undefined) cMem.disable = false;
		if (cMem.rally === undefined) cMem.rally = 'none';

		if (cMem.disable === true)
			aiAlert(creep);
		else {
			if (cMem.rally === 'none') {
				//! Find energy reserves
				if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
					creep.memory.working = false;
					if (room.storage && room.storage.store.getUsedCapacity(RESOURCE_ENERGY) >= creep.store.getCapacity() + 1000) {
						if (creep.withdraw(room.storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
							creep.moveTo(room.storage, pathing.repairerPathing);
					} else {
						const containers = room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_CONTAINER } });
						if (containers.length) {
							const nearestContainer = pos.findClosestByRange(containers);
							if (nearestContainer) {
								if (creep.withdraw(nearestContainer, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
									creep.moveTo(nearestContainer, pathing.repairerPathing);
							}
						}
					}
				} else creep.memory.working = true;

				//! Fill towers & repair stuff
				if (creep.memory.working === true) {
					const emptyTowers: StructureTower[] = creep.room.find(FIND_MY_STRUCTURES, { filter: (i) => { return i.structureType === STRUCTURE_TOWER && i.store.getFreeCapacity(RESOURCE_ENERGY) > 0 }});
					if (emptyTowers.length) { // Find owned towers with less-than-full stores
						emptyTowers.sort((a, b) => b.store.getFreeCapacity(RESOURCE_ENERGY) - a.store.getFreeCapacity(RESOURCE_ENERGY)); // Sort by emptiest to fullest
						const result = creep.transfer(emptyTowers[0], RESOURCE_ENERGY);
						if (result === ERR_NOT_IN_RANGE) {
							creep.moveTo(emptyTowers[0], pathing.repairerPathing); // Move to & fill up
							creep.say('🏃‍♂️');
						} else if (result === OK) {
							creep.say('⚡')
						} else {
							creep.say('🤔');
							console.log(`${creep.name}: Transfer to tower failed, result: ${result}`);
						}
					} else {

						let allSites: AnyStructure[] = [];
						//# if walls are set to repairable, find any under the repair limit threshold and add to main set
						if (room.memory.settings.repairSettings.walls === true) {
							const damagedSites = room.find(FIND_STRUCTURES, { filter: function (i) { return i.structureType === STRUCTURE_WALL && (i.hits / i.hitsMax) * 100 <= room.memory.settings.repairSettings.wallLimit } });
							allSites = allSites.concat(damagedSites);
						}

						//# if ramparts are set to repairable, find any under the repair limit threshold and add to main set
						if (room.memory.settings.repairSettings.ramparts === true) {
							const damagedSites = room.find(FIND_MY_STRUCTURES, { filter: function (i) { return i.structureType === STRUCTURE_RAMPART && (i.hits / i.hitsMax) * 100 <= room.memory.settings.repairSettings.rampartLimit } });
							allSites = allSites.concat(damagedSites);
						}

						//# if roads are repairable, find and add
						if (room.memory.settings.repairSettings.roads === true) {
							const damagedRoads = room.find(FIND_STRUCTURES, { filter: function (i) { return i.structureType === STRUCTURE_ROAD && i.hits < i.hitsMax } });
							allSites = allSites.concat(damagedRoads);
						}

						//# if other structure types are repairable, find and add
						if (room.memory.settings.repairSettings.others === true) {
							const damagedSites = room.find(FIND_STRUCTURES, { filter: function (i) { return (i.structureType !== STRUCTURE_ROAD && i.structureType !== STRUCTURE_RAMPART && i.structureType !== STRUCTURE_WALL) && i.hits < i.hitsMax } });
							allSites = allSites.concat(damagedSites);
						}

						//# locate closest repairable, navigate to it, and repair
						const nearestSite = pos.findClosestByRange(allSites);
						if (nearestSite) {
							const result = creep.repair(nearestSite);
							if (result === ERR_NOT_IN_RANGE) // move to if not in range
								creep.moveTo(nearestSite, pathing.repairerPathing);
							else if (result === OK) // display repair progress visual
								repairProgress(nearestSite, room);
							else console.log(`${creep.name}: Repair result - ${result}`); // log return code if not OK or ENIR
						}
					}
				}
			}
		}
	}
}

export const Reserver = {
	run: (creep: Creep) => {
		const room: Room = creep.room;
		const cMem: CreepMemory = creep.memory;
		const rMem: RoomMemory = Game.rooms[cMem.home].memory;
		const pos: RoomPosition = creep.pos;

		if (cMem.disable === undefined) cMem.disable = false;
		if (cMem.rally === undefined) cMem.rally = 'none';

		//# If no targetOutpost pre-defined, assign one to self based on reserverLastAssigned index in room's outposts memory
		//# Increment RLA index and wrap to zero if at length value of outposts array
		if (cMem.targetOutpost === undefined) {
			cMem.targetOutpost = rMem.outposts.array[rMem.outposts.reserverLastAssigned];
			rMem.outposts.reserverLastAssigned = (rMem.outposts.reserverLastAssigned + 1) % rMem.outposts.array.length;
		}
		if (cMem.controller === undefined) {
			cMem.controller = Game.rooms[cMem.home].memory.outposts.list[cMem.targetOutpost].controllerID;
		}
		//# If creep is at home room, has no rally point, and has a targetOutpost in memory, set rally point to target outpost flag
		//if (creep.room.name === cMem.home && cMem.rally === 'none' && cMem.targetOutpost !== undefined)
		//	cMem.rally = rMem.outposts.list[cMem.targetOutpost].controllerFlag;

		if (cMem.disable === true) {
			//! Disabled AI alert
			aiAlert(creep);
		} else {
			if (cMem.rally === 'none') {
				//# Once in outpost room and rally point is reached, find controller and start reserving it
				if (cMem.targetOutpost !== undefined) {
					if (room.name === cMem.targetOutpost && room.controller) {
						if (pos.isNearTo(room.controller)) {
							const result = creep.reserveController(room.controller);

							if (result === OK)
								creep.say('🔁');
							else
								log(`${creep.name}: Error reserving controller: ${result}`);
						} else {
							creep.advMoveTo(room.controller, true, pathing.reserverPathing);
						}
					} else {
						creep.advMoveTo(Game.rooms[cMem.targetOutpost].controller!.pos, true, pathing.reserverPathing);
					}
				}
			} else {
				//! Override default behavior and navigate to nav point
				navRallyPoint(creep);
			}
		}
	}
}

/**
 * A creep whose role it is to locate energy and spend it upgrading the room controller level. Requires standard worker parts (WORK, MOVE, and CARRY) to be effective.
 */
export const Upgrader = {
	run: (creep: Creep) => {

		const room: Room = creep.room;
		const cMem: CreepMemory = creep.memory;
		const rMem: RoomMemory = Game.rooms[cMem.home].memory;
		const pos: RoomPosition = creep.pos;

		if (cMem.disable === undefined) cMem.disable = false;
		if (cMem.rally === undefined) cMem.rally = 'none';

		if (cMem.disable === true) {
			aiAlert(creep);
		} else {
			if (cMem.rally === 'none') {
				if (creep.memory.controller === undefined) {
					// Use the room's controller directly when available
					const controllerObj = creep.room.controller;
					const cMemControllerID: Id<StructureController> | undefined = controllerObj ? controllerObj.id : undefined;
					if (cMemControllerID) creep.memory.controller = cMemControllerID;
				}

				if (creep.memory.bucket === undefined) {

					if (creep.room.memory?.containers?.controller === undefined) {
						const bucket = creep.room.find(FIND_STRUCTURES, { filter: (i) => i.structureType === STRUCTURE_CONTROLLER })[0].pos.findInRange(FIND_STRUCTURES, 3, { filter: (i) => i.structureType === STRUCTURE_CONTAINER })[0];
						if (bucket)
							creep.room.memory.containers.controller = bucket.id;
						else {
							const bucket = creep.room.find(FIND_STRUCTURES, { filter: (i) => i.structureType === STRUCTURE_CONTAINER });
							const closestBucket = pos.findClosestByRange(bucket);
							if (closestBucket)
								creep.memory.bucket = closestBucket.id;
						}
					}
					else
						creep.memory.bucket = creep.room.memory.containers.controller;
				}

				if (creep.store.getFreeCapacity() === 0)
					creep.memory.working = true;

				if (creep.store.getUsedCapacity() === 0) {
					const containers = room.find(FIND_STRUCTURES, { filter: (i) => i.structureType === STRUCTURE_CONTAINER && i.store.getUsedCapacity() >= creep.store.getCapacity() });

					if (containers.length) {
						const nearestContainer = pos.findClosestByRange(containers);

						if (nearestContainer) {
							const result = creep.withdraw(nearestContainer, RESOURCE_ENERGY);
							if (result === ERR_NOT_IN_RANGE)
								creep.moveTo(nearestContainer, pathing.builderPathing);
						}
					}
				}

				if (creep.memory.working) {
					if (creep.memory.controller) {
						const controllerObject: StructureController = Game.getObjectById(creep.memory.controller) as StructureController;
						if (controllerObject) {
							const result = creep.upgradeController(controllerObject)
							if (result === ERR_NOT_IN_RANGE)
								creep.moveTo(controllerObject, { visualizePathStyle: { stroke: 'green', lineStyle: 'dashed', opacity: 0.3 } });
							else if (result === OK)
								creep.say('🔋');
						}
					}
				}
				if (creep.memory.working == false) {
					if (creep.memory.bucket) {
						// Use the bucket to get energy if available
						const bucketObject: StructureContainer = Game.getObjectById(creep.memory.bucket) as StructureContainer;
						if (bucketObject && bucketObject.store.getUsedCapacity(RESOURCE_ENERGY) >= creep.store.getCapacity()) {
							if (creep.withdraw(bucketObject, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
								creep.moveTo(bucketObject, { visualizePathStyle: { stroke: 'yellow', lineStyle: 'dashed', opacity: 0.3 } });
							// Otherwise, find a source to harvest (ideally this should be a last resort, and only at low room levels)
						} else if (creep.room.find(FIND_DROPPED_RESOURCES, { filter: (i) => i.resourceType === RESOURCE_ENERGY && i.amount >= creep.store.getCapacity() / 2 }).length) {
							const piles = creep.room.find(FIND_DROPPED_RESOURCES, { filter: (i) => i.resourceType === RESOURCE_ENERGY && i.amount >= creep.store.getCapacity() / 2 });
							if (piles.length) {
								const closestPile = pos.findClosestByRange(piles);
								if (closestPile) {
									if (creep.pickup(closestPile) === ERR_NOT_IN_RANGE)
										creep.moveTo(closestPile, pathing.upgraderPathing);
								}
							}
						} else if (creep.room.controller!.level <= 2) {
							const source = creep.room.controller?.pos.findClosestByRange(FIND_SOURCES_ACTIVE);
							if (source) {
								if (creep.harvest(source) === ERR_NOT_IN_RANGE)
									creep.moveTo(source, { visualizePathStyle: { stroke: 'yellow', lineStyle: 'dashed', opacity: 0.3 } });
							}
						}
					}
				}
			} else {
				navRallyPoint(creep);
			}
		}
	}
}

let cSet;

if (Memory.globalSettings === undefined || Memory.globalSettings.creepSettings === undefined)
	initGlobal();
else
	cSet = Memory.globalSettings.creepSettings;

// const cSet = Memory.globalSettings.creepSettings;


/**
 * This function allows a creep to navigate a series of Game flags, stored in Creep Memory as either a
 * single string, or an array of strings, named rallyPoint. For no navigation, delete it/set it to 'none'.
 * @param {Creep} creep The creep executing the waypoint navigation
 * @returns void;
 */

function navRallyPoint(creep: Creep): void {

	const cMem = creep.memory;
	const pos = creep.pos;

	if (cMem.rally instanceof Array) {
		if (cMem.rally.length == 1 && pos.isNearTo(Game.flags[cMem.rally[0]])) cMem.rally = 'none';
		else if (!pos.isNearTo(Game.flags[cMem.rally[0]]))
			creep.advMoveTo(Game.flags[cMem.rally[0]].pos, true, pathing.rallyPointPathing);
		else {
			if (cMem.rally.length > 1)
				creep.advMoveTo(Game.flags[cMem.rally[1]].pos, true, pathing.rallyPointPathing);
			log('Creep \'' + creep.name + '\' reached rally point \'' + cMem.rally[0] + '\'', creep.room);
			const nextWaypoint = cMem.rally.shift();
			if (nextWaypoint === 'undefined') {
				delete cMem.rally;
				cMem.rally = 'none';
			}
		}
	} else {
		const rally = Game.flags[cMem.rally];
		if (pos.isNearTo(rally)) {
			log('Creep \'' + creep.name + '\' reached rally point \'' + cMem.rally + '\'', creep.room);
			cMem.rally = 'none';
		}
		else creep.advMoveTo(rally.pos, true, pathing.rallyPointPathing);
	}
}

function subordinateNavRally(creep: Creep, waypointArray: string[]): void {

	const cMem = creep.memory;
	const pos = creep.pos;
	let navigating = true;

	if (waypointArray instanceof Array) {
		while (navigating) {
			if (waypointArray.length == 1 && pos.inRangeTo(Game.flags[waypointArray[0]], 0)) navigating = false;
			else if (!pos.isNearTo(Game.flags[waypointArray[0]]))
				creep.moveTo(Game.flags[waypointArray[0]], pathing.subordinatePathing);
			else {
				if (waypointArray.length > 1)
					creep.moveTo(Game.flags[waypointArray[1]], pathing.rallyPointPathing);
				log('Creep \'' + creep.name + '\' reached rally point \'' + waypointArray[0] + '\'', creep.room);
				const nextWaypoint = waypointArray.shift();
				if (nextWaypoint === 'undefined') {
					navigating = false;
					return;
				}
			}
		}
	} else {
		const rally = Game.flags[waypointArray];
		if (pos.isNearTo(rally)) {
			log('Creep \'' + creep.name + '\' reached rally point \'' + waypointArray + '\'', creep.room);
			return;
		}
		else creep.moveTo(rally, pathing.subordinatePathing);
	}
}

function aiAlert(creep: Creep): void {
	if (!Memory.globalSettings.alertDisabled)
		log('WARNING: Creep ' + creep.name + '\'s AI is disabled.', creep.room);
	creep.say('💤');
	return;
}
