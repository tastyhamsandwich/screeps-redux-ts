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
}

export function subordinateNavRally(creep: Creep, waypointArray: string[]): void {

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
}

/** Logs a 'WARNING' message every tick to advise the player that a given creep has their AI disabled.
 * @example @link {log}`Room [W7S11]: WARNING: Creep 'Jeffrey_The_Creep's AI is disabled.`
*/
export function aiAlert(creep: Creep): void {
	if (!Memory.globalSettings.alertDisabled)
		log('WARNING: Creep ' + creep.name + '\'s AI is disabled.', creep.room);
	creep.say('💤');
	return;
}

/** An extracted version of the Upgrader creep behavior function, for the purpose of allowing Builders and Repairers to fall back to upgrading
 * a room controller when they have no other tasks, without unwieldy code duplication. */
export function upgraderBehavior(creep: Creep): void {
	if (creep.memory.controller === undefined) {
		// Use the room's controller directly when available
		const controllerObj = creep.room.controller;
		const cMemControllerID: Id<StructureController> | undefined = controllerObj ? controllerObj.id : undefined;
		if (cMemControllerID) creep.memory.controller = cMemControllerID;
	}

	if (creep.memory.bucket === undefined) {
		if (creep.room.memory?.containers?.controller === undefined) {
			const bucket = creep.room.find(FIND_STRUCTURES, { filter: (i) => i.structureType === STRUCTURE_CONTROLLER })[0].pos.findInRange(FIND_STRUCTURES, 3, { filter: (i) => i.structureType === STRUCTURE_CONTAINER })[0];
			if (bucket) creep.room.memory.containers.controller = bucket.id;
			else {
				const bucket = creep.room.find(FIND_STRUCTURES, { filter: (i) => i.structureType === STRUCTURE_CONTAINER });
				const closestBucket = creep.pos.findClosestByRange(bucket);
				if (closestBucket) creep.memory.bucket = closestBucket.id;
			}
		}	else creep.memory.bucket = creep.room.memory.containers.controller;
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
					creep.say('🔋');
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
}

export function exitMortalCoil(creep: Creep): void {
	const ttl = creep.ticksToLive;
	if (ttl && ttl <= 5) creep.say('☠️');
	if (creep.store.getUsedCapacity() > 0)
		console.log(`${creep.room.link()} ${FUNC.capitalize(creep.memory.role)} creep '${creep.name}' is expiring momentarily...`);
	return;
}
