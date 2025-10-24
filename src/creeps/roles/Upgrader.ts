import { aiAlert, navRallyPoint } from '../common';
import { pathing } from '@constants';

/**
 * A creep whose role it is to locate energy and spend it upgrading the room controller level. Requires standard worker parts (WORK, MOVE, and CARRY) to be effective.
 */
const Upgrader = {
	run: (creep: Creep) => {

		const room: Room = creep.room;
		const cMem: CreepMemory = creep.memory;
		const rMem: RoomMemory = Game.rooms[cMem.home].memory;
		const pos: RoomPosition = creep.pos;

		cMem.disable ??= false;
		cMem.rally ??= 'none';
		if (rMem.containers.controller) cMem.bucket ??= rMem.containers.controller;

		if (cMem.disable === true) aiAlert(creep);
		else {
			if (cMem.rally === 'none') {
				if (cMem.controller === undefined) {
					// Use the room's controller directly when available
					const controllerObj = creep.room.controller;
					const cMemControllerID: Id<StructureController> | undefined = controllerObj ? controllerObj.id : undefined;
					if (cMemControllerID) cMem.controller = cMemControllerID;
				}

				if (cMem.bucket === undefined) {

					if (rMem?.containers?.controller === undefined) {
						const bucket = creep.room.find(FIND_STRUCTURES, { filter: (i) => i.structureType === STRUCTURE_CONTROLLER })[0].pos.findInRange(FIND_STRUCTURES, 3, { filter: (i) => i.structureType === STRUCTURE_CONTAINER })[0];
						if (bucket)
							rMem.containers.controller = bucket.id;
						else {
							const bucket = creep.room.find(FIND_STRUCTURES, { filter: (i) => i.structureType === STRUCTURE_CONTAINER });
							const closestBucket = pos.findClosestByRange(bucket);
							if (closestBucket)
								cMem.bucket = closestBucket.id;
						}
					}
					else
						cMem.bucket = creep.room.memory.containers.controller;
				}

				if (creep.store.getFreeCapacity() === 0)
					cMem.working = true;

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

				if (cMem.working) {
					if (cMem.controller) {
						const controllerObject: StructureController = Game.getObjectById(cMem.controller) as StructureController;
						if (controllerObject) {
							const result = creep.upgradeController(controllerObject)
							if (result === ERR_NOT_IN_RANGE)
								creep.moveTo(controllerObject, { visualizePathStyle: { stroke: 'green', lineStyle: 'dashed', opacity: 0.3 } });
							else if (result === OK)
								creep.say('🔋');
						}
					}
				}
				if (cMem.working == false) {
					if (cMem.bucket) {
						// Use the bucket to get energy if available
						const bucketObject: StructureContainer = Game.getObjectById(cMem.bucket) as StructureContainer;
						if (bucketObject && bucketObject.store.getUsedCapacity(RESOURCE_ENERGY) >= creep.store.getCapacity()) {
							if (creep.withdraw(bucketObject, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
								creep.moveTo(bucketObject, { visualizePathStyle: { stroke: 'yellow', lineStyle: 'dashed', opacity: 0.3 } });
							// Otherwise, find a source to harvest (ideally this should be a last resort, and only at low room levels)
						} else if (room.find(FIND_DROPPED_RESOURCES, { filter: (i) => i.resourceType === RESOURCE_ENERGY && i.amount >= creep.store.getCapacity() / 2 }).length) {
							const piles = room.find(FIND_DROPPED_RESOURCES, { filter: (i) => i.resourceType === RESOURCE_ENERGY && i.amount >= creep.store.getCapacity() / 2 });
							if (piles.length) {
								const closestPile = pos.findClosestByRange(piles);
								if (closestPile) {
									if (creep.pickup(closestPile) === ERR_NOT_IN_RANGE)
										creep.moveTo(closestPile, pathing.upgraderPathing);
								}
							}
						} else if (room.controller!.level <= 2) {
							const source = room.controller?.pos.findClosestByRange(FIND_SOURCES_ACTIVE);
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

export default Upgrader;
