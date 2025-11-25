//const profiler = require('screeps-profiler');
import { aiAlert, navRallyPoint } from '../common';
import { pathing } from '@constants';

/**
 * A creep whose role it is to locate energy and ferry it to the spawns and extensions in a room,
 * ensuring there is a continuous supply of energy available for creep spawning.
 * Requires MOVE and CARRY parts to be effective.
 *
 * Resource collection priority:
 * 1. Tombstones (all resources if storage exists, energy only otherwise)
 * 2. Dropped energy resources
 * 3. Ruins (all resources if storage exists, energy only otherwise)
 * 4. Storage / Prestorage
 * 5. Containers
 * 6. Towers
 */
const Filler = {
	run: function (creep: Creep) {
		try {
			const cMem: CreepMemory = creep.memory;
			const pos: RoomPosition = creep.pos;

			cMem.disable ??= false;
			cMem.rally ??= 'none';

			if (cMem.disable) aiAlert(creep);
			else if (cMem.rally !== 'none') navRallyPoint(creep);
			else {
				// Withdraw phase - when empty, find resources
				if (creep.store.getUsedCapacity() === 0) {
					const target = findEnergySource(creep);

					if (target) {
						const result = withdrawFromTarget(creep, target);
						if (result === ERR_NOT_IN_RANGE)
							creep.advMoveTo(target, pathing.haulerPathing);
					}
				}

				// Transfer phase - when carrying resources, deliver to spawns/extensions
				if (creep.store.getUsedCapacity() > 0) {
					const targets = creep.room.find(FIND_MY_STRUCTURES, {
						filter: (i) => (i.structureType === STRUCTURE_SPAWN || i.structureType === STRUCTURE_EXTENSION)
							&& i.store.getFreeCapacity(RESOURCE_ENERGY) > 0
					});

					if (targets.length) {
						const nearestTarget = pos.findClosestByRange(targets);

						if (nearestTarget) {
							if (creep.transfer(nearestTarget, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
								creep.advMoveTo(nearestTarget, pathing.haulerPathing);
						}
					}
				}
			}
		} catch (e) {
			console.log(`Execution Error In Function: Filler.run(creep) on Tick ${Game.time}. Error: ${e}`);
		}
	}
}

/** Finds the best energy source for the filler creep.
 *
 * Priority: Tombstones > Dropped Energy > Ruins > Storage > Prestorage > Containers > Towers
 */
function findEnergySource(creep: Creep): Tombstone | Resource | Ruin | AnyStoreStructure | null {
	try {
		const room = creep.room;
		const hasStorage = room.storage !== undefined;

		// Priority 1: Tombstones with resources
		const tombstones = room.find(FIND_TOMBSTONES, {
			filter: (t) => {
				if (hasStorage) {
					// If storage exists, collect all resources
					return t.store.getUsedCapacity() > 0;
				} else {
					// Without storage, only collect energy to avoid filling containers with unusable resources
					return t.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
				}
			}
		});

		if (tombstones.length > 0) {
			// Sort by total resources (prioritize fuller tombstones)
			tombstones.sort((a, b) => b.store.getUsedCapacity() - a.store.getUsedCapacity());
			return tombstones[0];
		}

		// Priority 2: Dropped energy resources
		const droppedEnergy = room.find(FIND_DROPPED_RESOURCES, {
			filter: (r) => r.resourceType === RESOURCE_ENERGY && r.amount >= 50 // Minimum threshold to avoid wasting time
		});

		if (droppedEnergy.length > 0) {
			// Sort by amount (prioritize larger piles)
			droppedEnergy.sort((a, b) => b.amount - a.amount);
			return droppedEnergy[0];
		}

		// Priority 3: Ruins with resources
		const ruins = room.find(FIND_RUINS, {
			filter: (r) => {
				if (hasStorage) {
					// If storage exists, collect all resources
					return r.store.getUsedCapacity() > 0;
				} else {
					// Without storage, only collect energy
					return r.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
				}
			}
		});

		if (ruins.length > 0) {
			// Sort by total resources (prioritize fuller ruins)
			ruins.sort((a, b) => b.store.getUsedCapacity() - a.store.getUsedCapacity());
			return ruins[0];
		}

		// Priority 4: Storage (if available and has sufficient energy)
		if (room.storage && room.storage.store.getUsedCapacity(RESOURCE_ENERGY) >= creep.store.getCapacity()) {
			return room.storage;
		}

		// Priority 5A Prestorage Container (if built)
		if (room.prestorage && room.prestorage.store.getUsedCapacity(RESOURCE_ENERGY) >= creep.store.getCapacity())
			return room.prestorage;

		// Priority 5B: Source Containers (if built)
		const containerOne = room.containerOne ?? null;
		const containerTwo = room.containerTwo ?? null;
		if (containerOne && !containerTwo) {
			if (containerOne.store.getUsedCapacity(RESOURCE_ENERGY) > 100)
				return containerOne;
		} else if (containerTwo && !containerOne) {
			if (containerTwo.store.getUsedCapacity(RESOURCE_ENERGY) > 100)
				return containerTwo;
		} else if (containerOne && containerTwo) {
			if (containerOne.store.getUsedCapacity(RESOURCE_ENERGY) > containerTwo.store.getUsedCapacity(RESOURCE_ENERGY))
				return containerOne;
			else
				return containerTwo;
		}

		// Priority 5C: Controller Container (if built)
		if (room.containerController && room.containerController.store.getUsedCapacity(RESOURCE_ENERGY) > 100)
			return room.containerController;

		// Priority 6: Containers (with null safety)
		const containers = room.find(FIND_STRUCTURES, {
			filter: (s) => s.structureType === STRUCTURE_CONTAINER
				&& (s as StructureContainer).store.getUsedCapacity(RESOURCE_ENERGY) > 0
		}) as StructureContainer[];

		if (containers.length > 0) {
			// Sort by energy amount (prioritize fuller containers)
			containers.sort((a, b) => b.store.getUsedCapacity(RESOURCE_ENERGY) - a.store.getUsedCapacity(RESOURCE_ENERGY));
			return containers[0];
		}

		// Priority 7: Towers with energy
		const towers: StructureTower[] = room.find(FIND_MY_STRUCTURES, { filter: (s) => s.structureType === STRUCTURE_TOWER && s.store.getUsedCapacity(RESOURCE_ENERGY) > 0});
		if (towers.length) {
			const nearestTower = creep.pos.findClosestByRange(towers);
			if (nearestTower) {
				return nearestTower;
			}
		}
		return null;
	} catch (e) {
		console.log(`Execution Error In Function: findEnergySource(creep) on Tick ${Game.time}. Error: ${e}`);
		return null;
	}
}

/** Withdraws resources from the target, handling different target types appropriately. */
function withdrawFromTarget(creep: Creep, target: Tombstone | Resource | Ruin | AnyStoreStructure): ScreepsReturnCode {
	try {
		// Handle dropped resources (pickup instead of withdraw)
		if (target instanceof Resource) {
			return creep.pickup(target);
		}

		// For tombstones and ruins, withdraw the most abundant resource
		if (target instanceof Tombstone || target instanceof Ruin) {
			const hasStorage = creep.room.storage !== undefined;

			// Find the resource type with the most quantity
			let maxResource: ResourceConstant = RESOURCE_ENERGY;
			let maxAmount = target.store.getUsedCapacity(RESOURCE_ENERGY);

			if (hasStorage) {
				// Check all resource types if storage exists
				for (const resourceType in target.store) {
					const amount = target.store[resourceType as ResourceConstant] || 0;
					if (amount > maxAmount) {
						maxAmount = amount;
						maxResource = resourceType as ResourceConstant;
					}
				}
			}

			return creep.withdraw(target, maxResource);
		}

		// For structures (storage, containers), always withdraw energy
		return creep.withdraw(target, RESOURCE_ENERGY);
	} catch (e) {
		console.log(`Execution Error In Function: withdrawFromTarget(creep, target) on Tick ${Game.time}. Error: ${e}`);
		return ERR_INVALID_TARGET;
	}
}

//profiler.registerObject(Filler, 'CreepFiller');

export default Filler;
