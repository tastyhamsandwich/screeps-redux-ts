import { aiAlert, navRallyPoint, upgraderBehavior } from "../common";
import { pathing } from "@constants";

/**
 * A creep whose role it is to locate energy and spend it building structures around the room. Requires worker parts to be effective.
 */
const Builder = {
	run: (creep: Creep) => {

		const room: Room = creep.room;
		const cMem: CreepMemory = creep.memory;
		const rMem: RoomMemory = Game.rooms[cMem.home].memory;
		const pos: RoomPosition = creep.pos;

		cMem.disable ??= false;
		cMem.rally ??= 'none';

		if (cMem.disable === true) {
			aiAlert(creep);
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
					} else {
						if (rMem.containers.controller) cMem.bucket ??= rMem.containers.controller;
						cMem.controller ??= room.controller?.id;
						upgraderBehavior(creep);
					}
				}
			}
		}
	},

	runremote: function (creep: Creep) {


	}
}

export default Builder;
