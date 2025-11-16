import { aiAlert, navRallyPoint, upgraderBehavior } from "../common";
import { pathing } from "@constants";

/**
 * A creep whose role it is to locate energy and spend it building structures around the room.
 * Requires WORK, CARRY, and MOVE parts to be effective.
 *
 * State machine:
 * - working: false -> Withdraw energy from storage/containers
 * - working: true  -> Build construction sites or upgrade controller
 */
const Builder = {
	run: (creep: Creep) => {

		const room: Room = creep.room;
		const cMem: CreepMemory = creep.memory;
		const rMem: RoomMemory = Game.rooms[cMem.home].memory;
		const pos: RoomPosition = creep.pos;

		cMem.disable ??= false;
		cMem.rally ??= 'none';
		cMem.working ??= false; // Initialize working flag if undefined

		if (cMem.disable === true) {
			aiAlert(creep);
		} else {
			if (cMem.rally !== 'none') {
				navRallyPoint(cMem.rally);
			} else {
				// State transition logic: toggle working flag based on energy levels
				if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0)	cMem.working = false;
				if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0)	cMem.working = true;

				// Harvest phase - collect energy
				if (!cMem.working) {
					const energySource = findEnergySource(creep);

					if (energySource) {
						const result = creep.withdraw(energySource, RESOURCE_ENERGY);
						if (result === ERR_NOT_IN_RANGE)
							creep.advMoveTo(energySource, pathing.builderPathing);
						else if (result === OK) {
							// Successfully withdrew - check if we should transition to working
							if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
								cMem.working = true;
							}
						}
						// On any other error, keep trying next tick
					}
				}
				// Build phase - construct or upgrade
				else {
					const cSites = room.find(FIND_CONSTRUCTION_SITES);
					if (cSites.length > 0) {
						const nearestCSite = pos.findClosestByRange(cSites);
						if (nearestCSite) {
							const result = creep.build(nearestCSite);
							if (result === ERR_NOT_IN_RANGE) {
								creep.advMoveTo(nearestCSite, pathing.builderPathing);
							} else if (result === ERR_NOT_ENOUGH_ENERGY) {
								// Out of energy while building - transition back to harvest
								cMem.working = false;
							} else if (result === OK) {
								rMem.stats.constructionPoints += creep.getActiveBodyparts(WORK) * 5;
							}
						}
					} else {
						// No construction sites - upgrade controller instead
						if (rMem?.containers?.controller) cMem.bucket ??= rMem.containers.controller;
						cMem.controller ??= room.controller?.id;
						upgraderBehavior(creep);
					}
				}
			}
		}
	},

	runremote: function (creep: Creep) {
		// Remote builder logic placeholder
	}
}

/**
 * Finds the best energy source for the builder creep.
 * Priority: Storage (if sufficient) > Containers
 */
function findEnergySource(creep: Creep): StructureStorage | StructureContainer | null {
	const room = creep.room;
	const pos = creep.pos;

	// Priority 1: Storage (if it has enough energy to justify using it)
	if (room.storage && room.storage.store.getUsedCapacity(RESOURCE_ENERGY) > (creep.store.getCapacity() + 1000)) {
		return room.storage;
	}

	// Priority 2: Containers with energy
	const containers = room.find(FIND_STRUCTURES, {
		filter: (s) => s.structureType === STRUCTURE_CONTAINER
			&& (s as StructureContainer).store.getUsedCapacity(RESOURCE_ENERGY) > 0
	}) as StructureContainer[];

	if (containers.length > 0) {
		// Find closest container with energy
		const nearestContainer = pos.findClosestByRange(containers);
		if (nearestContainer) {
			return nearestContainer;
		}
	}

	return null;
}

export default Builder;
