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
	}
}

/** Finds the best energy source for the filler creep.
 *
 * Priority: Tombstones > Dropped Energy > Ruins > Storage > Prestorage > Containers > Towers
 */
function findEnergySource(creep: Creep): Tombstone | Resource | Ruin | AnyStoreStructure | null {
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

	// Priority 5: Prestorage Container (if built)
	if (room.prestorage && room.prestorage.store.getUsedCapacity(RESOURCE_ENERGY) >= creep.store.getCapacity())
		return Game.getObjectById(room.memory.containers.prestorage);

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
}

/** Withdraws resources from the target, handling different target types appropriately. */
function withdrawFromTarget(creep: Creep, target: Tombstone | Resource | Ruin | AnyStoreStructure): ScreepsReturnCode {
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
}

export default Filler;
