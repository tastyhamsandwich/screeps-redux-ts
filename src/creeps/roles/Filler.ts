import { aiAlert, navRallyPoint } from '../common';
import { pathing } from '@constants';

/**
 * A creep whose role it is to locate energy and ferry it to the spawns and extensions in a room, ensuring there is a continuous supply of energy available for creep spawning.
 * Requires MOVE and CARRY parts to be effective.
 */
const Filler = {
	run: function (creep: Creep) {

		const room: Room = creep.room;
		const cMem: CreepMemory = creep.memory;
		const rMem: RoomMemory = Game.rooms[cMem.home].memory
		const pos: RoomPosition = creep.pos;

		cMem.disable ??= false;
		cMem.rally ??= 'none';
		if (room.storage && !cMem.pickup) cMem.pickup = room.storage.id;
		if (!room.storage && !cMem.pickup) {

			const containers: StructureContainer[] = creep.room.find(FIND_STRUCTURES, { filter: (i) => i.structureType === STRUCTURE_CONTAINER });
			if (containers.length > 1)
				containers.sort((a, b) => b.store.getUsedCapacity(RESOURCE_ENERGY) - a.store.getUsedCapacity(RESOURCE_ENERGY));
			cMem.pickup = containers[0].id;
		}

		if (cMem.disable === true) {
			aiAlert(creep);
		} else {
			if (cMem.rally !== 'none') {
				navRallyPoint(creep);
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

export default Filler;
