import { aiAlert, navRallyPoint } from '../common';
import { pathing } from '@constants';
import { repairProgress } from '@funcs/visual';

/**
 * A creep whose role it is to locate and repair damaged or decaying structures in a room, based on settings in the room settings memory. Requires standard worker parts (MOVE, CARRY, WORK)
 */
const Repairer = {
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

export default Repairer;
