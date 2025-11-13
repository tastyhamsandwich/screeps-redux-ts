import { aiAlert, navRallyPoint } from '../common';
import { pathing } from '@constants';
import { repairProgress } from '@funcs/visual';

/**
 * A creep whose role it is to locate and repair damaged or decaying structures in a room,
 * based on settings in the room settings memory.
 * Requires standard worker parts (MOVE, CARRY, WORK)
 *
 * State machine:
 * - working: false -> Withdraw energy from storage/containers
 * - working: true  -> Fill towers and repair structures
 */
const Repairer = {
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
						const result = creep.withdraw(energySource, RESOURCE_ENERGY);
						if (result === ERR_NOT_IN_RANGE) {
							creep.moveTo(energySource, pathing.repairerPathing);
						} else if (result === OK) {
							// Successfully withdrew - check if we should transition to working
							if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
								cMem.working = true;
							}
						}
					}
				}
				// Work phase - fill towers and repair structures
				else if (cMem.working) {
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
						// Repair structures based on room settings
						const allSites = findRepairableStructures(room);

						// Locate closest repairable structure, navigate to it, and repair
						const nearestSite = pos.findClosestByRange(allSites);
						if (nearestSite) {
							const result = creep.repair(nearestSite);
							if (result === ERR_NOT_IN_RANGE) {
								creep.moveTo(nearestSite, pathing.repairerPathing);
							} else if (result === OK) {
								repairProgress(nearestSite, room);
							} else if (result === ERR_NOT_ENOUGH_ENERGY) {
								// Out of energy while repairing - transition back to harvest
								cMem.working = false;
							} else {
								console.log(`${creep.name}: Repair result - ${result}`);
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
 * Finds the best energy source for the repairer creep.
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
		const nearestContainer = pos.findClosestByRange(containers);
		if (nearestContainer) {
			return nearestContainer;
		}
	}

	return null;
}

/**
 * Finds all repairable structures based on room repair settings.
 * Returns structures that need repair according to configured thresholds.
 */
function findRepairableStructures(room: Room): AnyStructure[] {
	let allSites: AnyStructure[] = [];

	// Safe access to repair settings with defaults
	const repairSettings = room.memory.settings?.repairSettings;
	if (!repairSettings) {
		return allSites; // No repair settings configured
	}

	// If walls are set to repairable, find any under the repair limit threshold
	if (repairSettings.walls === true) {
		const wallLimit = repairSettings.wallLimit || 0;
		const damagedWalls = room.find(FIND_STRUCTURES, {
			filter: (i) => i.structureType === STRUCTURE_WALL
				&& (i.hits / i.hitsMax) * 100 <= wallLimit
		});
		allSites = allSites.concat(damagedWalls);
	}

	// If ramparts are set to repairable, find any under the repair limit threshold
	if (repairSettings.ramparts === true) {
		const rampartLimit = repairSettings.rampartLimit || 0;
		const damagedRamparts = room.find(FIND_MY_STRUCTURES, {
			filter: (i) => i.structureType === STRUCTURE_RAMPART
				&& (i.hits / i.hitsMax) * 100 <= rampartLimit
		});
		allSites = allSites.concat(damagedRamparts);
	}

	// If roads are repairable, find and add
	if (repairSettings.roads === true) {
		const damagedRoads = room.find(FIND_STRUCTURES, {
			filter: (i) => i.structureType === STRUCTURE_ROAD && i.hits < i.hitsMax
		});
		allSites = allSites.concat(damagedRoads);
	}

	// If other structure types are repairable, find and add
	if (repairSettings.others === true) {
		const damagedOthers = room.find(FIND_STRUCTURES, {
			filter: (i) => i.structureType !== STRUCTURE_ROAD
				&& i.structureType !== STRUCTURE_RAMPART
				&& i.structureType !== STRUCTURE_WALL
				&& i.hits < i.hitsMax
		});
		allSites = allSites.concat(damagedOthers);
	}

	return allSites;
}

export default Repairer;
