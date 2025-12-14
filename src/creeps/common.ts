import { log, initGlobal } from '../functions/utils/globals';
import { pathing } from '../functions/utils/constants';
import * as FUNC from '@functions/index';
import '@protos/creep';

let cSet;

if (Memory.globalSettings === undefined || Memory.globalSettings.creepSettings === undefined)
	initGlobal();
else cSet = Memory.globalSettings.creepSettings;

/**
 * This function allows a creep to navigate a series of Game flags, stored in Creep Memory as either a
 * single string, or an array of strings, named rally. For no navigation, delete it/set it to 'none'.
 * @param {Creep} creep The creep executing the waypoint navigation
 */
export function navRallyPoint(creep: Creep): void {
	try {
		const cMem = creep.memory;
		const pos = creep.pos;

		if (cMem.rally instanceof Array) {
			if (cMem.rally.length == 1 && pos.isNearTo(Game.flags[cMem.rally[0]])) cMem.rally = 'none';
			else if (!pos.isNearTo(Game.flags[cMem.rally[0]]))
				creep.advMoveTo(Game.flags[cMem.rally[0]].pos, pathing.rallyPointPathing, true);
			else {
				if (cMem.rally.length > 1)
					creep.advMoveTo(Game.flags[cMem.rally[1]].pos, pathing.rallyPointPathing, true);
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
			else creep.advMoveTo(rally.pos, pathing.rallyPointPathing, true);
		}
	} catch (e) {
		console.log(`Execution Error In Function: navRallyPoint(creep) from creep ${creep.name} - ${creep.memory.role} on Tick ${Game.time}. Error: ${e}`);
	}
}

export function subordinateNavRally(creep: Creep, waypointArray: string[]): void {
	try {
		const cMem = creep.memory;
		const pos = creep.pos;
		let navigating = true;

		if (waypointArray instanceof Array) {
			while (navigating) {
				if (waypointArray.length == 1 && pos.inRangeTo(Game.flags[waypointArray[0]], 0)) navigating = false;
				else if (!pos.isNearTo(Game.flags[waypointArray[0]]))
					creep.advMoveTo(Game.flags[waypointArray[0]], pathing.subordinatePathing);
				else {
					if (waypointArray.length > 1)
						creep.advMoveTo(Game.flags[waypointArray[1]], pathing.rallyPointPathing);
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
			else creep.advMoveTo(rally, pathing.subordinatePathing);
		}
	} catch (e) {
		console.log(`Execution Error In Function: subordinateNavRally(creep, waypointArray) on Tick ${Game.time}. Error: ${e}`);
	}
}

/** Logs a 'WARNING' message every tick to advise the player that a given creep has their AI disabled.
 * @example @link {log}`Room [W7S11]: WARNING: Creep 'Jeffrey_The_Creep's AI is disabled.`
*/
export function aiAlert(creep: Creep): void {
	try {
		if (!Memory.globalSettings.alertDisabled)
			log('WARNING: Creep ' + creep.name + '\'s AI is disabled.', creep.room);
		creep.say('💤');
		return;
	} catch (e) {
		console.log(`Execution Error In Function: aiAlert(creep) on Tick ${Game.time}. Error: ${e}`);
	}
}

/** An extracted version of the Upgrader creep behavior function, for the purpose of allowing Builders and Repairers to fall back to upgrading
 * a room controller when they have no other tasks, without unwieldy code duplication. */
export function upgraderBehavior(creep: Creep): void {
	try {
		if (creep.memory.controller === undefined) {
			// Use the room's controller directly when available
			const controllerObj = creep.room.controller;
			const cMemControllerID: Id<StructureController> | undefined = controllerObj ? controllerObj.id : undefined;
			if (cMemControllerID) creep.memory.controller = cMemControllerID;
		}

		if (creep.memory.bucket === undefined) {
			if (creep.room.memory?.containers?.controller === undefined) {
				const bucket = creep.room.controller!.pos.findInRange(FIND_STRUCTURES, 3, { filter: (i) => i.structureType === STRUCTURE_CONTAINER })[0];
				if (bucket) creep.room.memory.containers.controller = (bucket as StructureContainer).id;
				else {
					const bucket = creep.room.find(FIND_STRUCTURES, { filter: (i) => i.structureType === STRUCTURE_CONTAINER });
					const closestBucket = creep.pos.findClosestByRange(bucket);
					if (closestBucket) creep.memory.bucket = closestBucket.id;
				}
			}	else creep.memory.bucket = creep.room.memory.containers.controller;
		}

		if (creep.ticksToLive! <= 10) {
			if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
				const bucket = Game.getObjectById(creep.memory.bucket as Id<StructureContainer>);
				if (bucket) {
					if (creep.transfer(bucket, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
						creep.advMoveTo(bucket, pathing.upgraderPathing);
				}
			}
			if (creep.ticksToLive! <= 2) {
				creep.say(`Goodbye cruel world!`);
			}
			return;
		}

		if (creep.store.getFreeCapacity() === 0) creep.memory.working = true;

		if (creep.store.getUsedCapacity() === 0) {
			const containers = creep.room.find(FIND_STRUCTURES, { filter: (i) => i.structureType === STRUCTURE_CONTAINER && i.store.getUsedCapacity() >= creep.store.getCapacity() });

			if (containers.length) {
				const nearestContainer = creep.pos.findClosestByRange(containers);
				if (nearestContainer) {
					const result = creep.withdraw(nearestContainer, RESOURCE_ENERGY);
					if (result === ERR_NOT_IN_RANGE)
						creep.advMoveTo(nearestContainer, pathing.builderPathing);
				}
			}
		}

		if (creep.memory.working) {
			if (creep.memory.controller) {
				const controllerObject: StructureController = Game.getObjectById(creep.memory.controller) as StructureController;
				if (controllerObject) {
					const result = creep.upgradeController(controllerObject)
					if (result === ERR_NOT_IN_RANGE) {
						creep.advMoveTo(controllerObject, { visualizePathStyle: { stroke: 'green', lineStyle: 'dashed', opacity: 0.3 } });
						return;
					}	else if (result === OK)	{
						creep.room.memory.stats.controlPoints += (creep.getActiveBodyparts(WORK));
					}
				}
			}
		}
		if (creep.memory.working == false) {
			if (creep.memory.bucket) {
				// Use the bucket to get energy if available
				const bucketObject: StructureContainer = Game.getObjectById(creep.memory.bucket) as StructureContainer;
				if (bucketObject && bucketObject.store.getUsedCapacity(RESOURCE_ENERGY) >= creep.store.getCapacity()) {
					const result = creep.withdraw(bucketObject, RESOURCE_ENERGY);
					if (result === ERR_NOT_IN_RANGE) {
						creep.advMoveTo(bucketObject, { visualizePathStyle: { stroke: 'yellow', lineStyle: 'dashed', opacity: 0.3 } });
						return;
					} else if (result === OK) {
						creep.memory.working = true;
						return;
					}

					// Otherwise, find a source to harvest (ideally this should be a last resort, and only at low room levels)
				} else if (creep.room.find(FIND_DROPPED_RESOURCES, { filter: (i) => i.resourceType === RESOURCE_ENERGY && i.amount >= creep.store.getCapacity() / 2 }).length) {
					const piles = creep.room.find(FIND_DROPPED_RESOURCES, { filter: (i) => i.resourceType === RESOURCE_ENERGY && i.amount >= creep.store.getCapacity() / 2 });
					if (piles.length) {
						const closestPile = creep.pos.findClosestByRange(piles);
						if (closestPile) {
							const result = creep.pickup(closestPile);
							if (result === ERR_NOT_IN_RANGE) {
								creep.advMoveTo(closestPile, pathing.upgraderPathing);
								return;
							} else if (result === OK) {
								creep.memory.working = true;
								return;
							}
						}
					}
				} else if (creep.room.controller!.level <= 2) {
					const source = creep.room.controller?.pos.findClosestByRange(FIND_SOURCES_ACTIVE);
					if (source) {
						if (creep.harvest(source) === ERR_NOT_IN_RANGE)
							creep.advMoveTo(source, { visualizePathStyle: { stroke: 'yellow', lineStyle: 'dashed', opacity: 0.3 } });
					}
				}
			}
		}
	} catch (e) {
		console.log(`Execution Error In Function: upgraderBehavior(creep) on Tick ${Game.time}. Error: ${e}`);
	}
}

export function builderBehavior(creep: Creep): void {
	try {
		const room = creep.room;
		const pos = creep.pos;
		const cMem = creep.memory;
		const rMem = creep.room.memory;

		// State transition logic: toggle working flag based on energy levels
		if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0)	cMem.working = false;
		if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0)	cMem.working = true;

		// Harvest phase - collect energy
		if (!cMem.working) {
			// Priority 0: Check for any piles of energy within a few tiles of location, and use the closest
			const piles = pos.findInRange(FIND_DROPPED_RESOURCES, 3, { filter: { resourceType: RESOURCE_ENERGY } });
			if (piles.length) {
				const nearestPile = pos.findClosestByRange(piles);
				if (nearestPile)
					if (creep.pickup(nearestPile) === ERR_NOT_IN_RANGE)
						creep.advMoveTo(nearestPile, pathing.builderPathing);
			} else {
				const energySource = findEnergySource(creep);

				if (energySource) {
					const result = creep.withdraw(energySource, RESOURCE_ENERGY);
					if (result === ERR_NOT_IN_RANGE)
						creep.advMoveTo(energySource, pathing.builderPathing);
					else if (result === OK) {
						// Successfully withdrew - check if we should transition to working
						if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0)
							cMem.working = true;
					}
				}
				// On any other error, keep trying next tick
			}
		}
		// Build phase - construct or upgrade
		else {
			if (cMem.buildTarget) {
				const target: ConstructionSite | null = Game.getObjectById(cMem.buildTarget as Id<ConstructionSite>);
				if (target) {
					if (creep.build(target) === ERR_NOT_IN_RANGE) {
						creep.advMoveTo(target, pathing.builderPathing);
						return;
					}
				} else delete cMem.buildTarget;
			}
			const cSites = room.find(FIND_CONSTRUCTION_SITES);
			if (cSites.length > 0) {
				const nearestCSite = pos.findClosestByRange(cSites);
				if (nearestCSite) {
					cMem.buildTarget = nearestCSite.id;
					const result = creep.build(nearestCSite);
					if (result === ERR_NOT_IN_RANGE)
						creep.advMoveTo(nearestCSite, pathing.builderPathing);
					else if (result === ERR_NOT_ENOUGH_ENERGY)
						cMem.working = false;
					else if (result === OK)
						rMem.stats.constructionPoints += creep.getActiveBodyparts(WORK) * 5;
				}
			} else {
				// No construction sites - upgrade controller instead
				if (rMem?.containers?.controller) cMem.bucket ??= rMem.containers.controller;
				cMem.controller ??= room.controller?.id;
				upgraderBehavior(creep);
			}
		}
	} catch (e) {
		console.log(`Execution Error In Function: Builder.run(creep) on Tick ${Game.time}. Error: ${e}`);
	}
}

export function exitMortalCoil(creep: Creep): void {
	try {
		const ttl = creep.ticksToLive;
		if (ttl && ttl <= 5) creep.say('☠️');
		if (creep.store.getUsedCapacity() > 0)
			console.log(`${creep.room.link()} ${FUNC.capitalize(creep.memory.role)} creep '${creep.name}' is expiring momentarily...`);
		return;
	} catch (e) {
		console.log(`Execution Error In Function: exitMortalCoil(creep) on Tick ${Game.time}. Error: ${e}`);
	}
}

/** Finds the best energy source for the builder creep.
 *
 * Priority: Storage (if sufficient) > Containers
 */
export function findEnergySource(creep: Creep): StructureStorage | StructureContainer | null | Ruin {
	try {
		const room = creep.room;
		const pos = creep.pos;

		const ruins = pos.findInRange(FIND_RUINS, 3, { filter: (s) => { s.store[RESOURCE_ENERGY] > 0 } });
		if (ruins.length) {
			const nearestRuin = pos.findClosestByRange(ruins);
			if (nearestRuin)
				return nearestRuin;
		}
		// Priority 1: Storage (if it has enough energy to justify using it)
		if (room.storage && room.storage.store.getUsedCapacity(RESOURCE_ENERGY) > (creep.store.getCapacity() + 1000)) {
			return room.storage;
		}

		// Priority 2: Containers with energy
		const containers = room.find(FIND_STRUCTURES, {
			filter: (s) => s.structureType === STRUCTURE_CONTAINER
				&& (s as StructureContainer).store.getUsedCapacity(RESOURCE_ENERGY) >= creep.store.getCapacity()
		}) as StructureContainer[];

		if (containers.length > 0) {
			// Find closest container with energy
			const nearestContainer = pos.findClosestByRange(containers);
			if (nearestContainer) {
				return nearestContainer;
			}
		}

		return null;
	} catch (e) {
		console.log(`Execution Error In Function: findEnergySource(creep) on Tick ${Game.time}. Error: ${e}`);
		return null;
	}
}
