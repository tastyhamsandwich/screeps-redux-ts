import { aiAlert, navRallyPoint } from '../common';
import { pathing } from '@constants';

/**
 * A creep whose role it is to locate energy and spend it upgrading the room controller level.
 * Requires standard worker parts (WORK, MOVE, and CARRY) to be effective.
 *
 * State machine:
 * - working: false -> Collect energy from containers/sources
 * - working: true  -> Upgrade controller
 */
const Upgrader = {
	run: (creep: Creep) => {

		const room: Room = creep.room;
		const cMem: CreepMemory = creep.memory;
		const rMem: RoomMemory = Game.rooms[cMem.home].memory;
		const pos: RoomPosition = creep.pos;

		cMem.disable ??= false;
		cMem.rally ??= 'none';
		cMem.working ??= false; // Initialize working flag if undefined

		// Initialize controller reference if needed
		if (!cMem.controller && room.controller) {
			cMem.controller = room.controller.id;
		}

		if (cMem.disable === true) {
			aiAlert(creep);
		} else {
			if (cMem.rally === 'none') {
				// State transition logic: toggle working flag based on energy levels
				if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
					cMem.working = false;
				}
				if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
					cMem.working = true;
				}

				// Harvest phase - collect energy
				if (!cMem.working) {
					const energySource = findEnergySource(creep);

					if (energySource) {
						const result = energySource instanceof Source
							? creep.harvest(energySource)
							: energySource instanceof Resource
							? creep.pickup(energySource)
							: creep.withdraw(energySource, RESOURCE_ENERGY);

						if (result === ERR_NOT_IN_RANGE) {
							creep.moveTo(energySource, pathing.upgraderPathing);
						} else if (result === OK) {
							// Successfully collected - check if we should transition to working
							if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
								cMem.working = true;
							}
						}
					}
				}
				// Work phase - upgrade controller
				else if (cMem.working) {
					if (cMem.controller) {
						const controllerObject = Game.getObjectById(cMem.controller) as StructureController;
						if (controllerObject) {
							const result = creep.upgradeController(controllerObject);
							if (result === ERR_NOT_IN_RANGE) {
								creep.moveTo(controllerObject, pathing.upgraderPathing);
							} else if (result === OK) {
								creep.say('🔋');
							} else if (result === ERR_NOT_ENOUGH_ENERGY) {
								// Out of energy while upgrading - transition back to harvest
								cMem.working = false;
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

/**
 * Finds the best energy source for the upgrader creep.
 * Priority: Controller container > Other containers > Dropped energy > Sources (RCL ≤ 2 only)
 */
function findEnergySource(creep: Creep): StructureContainer | Resource | Source | null {
	const room = creep.room;
	const pos = creep.pos;
	const rMem = room.memory;

	// Priority 1: Controller container (preferred for upgraders)
	if (rMem?.containers?.controller) {
		const controllerContainer = Game.getObjectById(rMem.containers.controller) as StructureContainer;
		if (controllerContainer && controllerContainer.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
			return controllerContainer;
		}
	}

	// Priority 2: Other containers with energy
	const containers = room.find(FIND_STRUCTURES, {
		filter: (s) => s.structureType === STRUCTURE_CONTAINER
			&& (s as StructureContainer).store.getUsedCapacity(RESOURCE_ENERGY) > creep.store.getCapacity() / 2
	}) as StructureContainer[];

	if (containers.length > 0) {
		const nearestContainer = pos.findClosestByRange(containers);
		if (nearestContainer) {
			return nearestContainer;
		}
	}

	// Priority 3: Dropped energy (minimum threshold)
	const droppedEnergy = room.find(FIND_DROPPED_RESOURCES, {
		filter: (r) => r.resourceType === RESOURCE_ENERGY
			&& r.amount >= creep.store.getCapacity() / 2
	});

	if (droppedEnergy.length > 0) {
		const closestPile = pos.findClosestByRange(droppedEnergy);
		if (closestPile) {
			return closestPile;
		}
	}

	// Priority 4: Sources (only at low RCL when infrastructure is limited)
	if (room.controller && room.controller.level <= 2) {
		const source = room.controller.pos.findClosestByRange(FIND_SOURCES_ACTIVE);
		if (source) {
			return source;
		}
	}

	return null;
}

export default Upgrader;
