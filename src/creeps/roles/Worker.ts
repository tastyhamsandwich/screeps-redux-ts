import { aiAlert, navRallyPoint } from '../common';
import { pathing } from '@constants';
import { getReturnCode } from '@globals';

const Worker = {
	run: (creep: Creep) => {

		const room: Room 					= creep.room;
		const cMem: CreepMemory 	= creep.memory;
		const rMem: RoomMemory 		= Game.rooms[cMem.home].memory;
		const pos : RoomPosition 	= creep.pos;

		cMem.disable 	??= false;
		cMem.rally 		??= 'none';
		cMem.hasTask	??= false;
		cMem.availableForTasking ??= true;

		if 			(pos.x == 49) creep.move(LEFT	 );
		else if (pos.x == 0 )	creep.move(RIGHT );
		else if (pos.y == 49) creep.move(TOP	 );
		else if (pos.y == 0 )	creep.move(BOTTOM);

		if (cMem.disable)
			aiAlert(creep);
		else if (cMem.rally !== 'none')
			navRallyPoint(creep);
		else {
			const hasTask = cMem.hasTask ?? false;

			if (hasTask) {
				const assignedTask: TaskAssignment = cMem.task;
				switch (assignedTask.type) {

					case 'haul': { //: LOGISTICS TASK
						// get objects from the task object passed to creep
						const haulFrom: AnyStoreStructure = Game.getObjectById(assignedTask.haulFrom as Id<AnyStoreStructure>)!;
						const haulTo: AnyStoreStructure = Game.getObjectById(assignedTask.haulTo as Id<AnyStoreStructure>)!;
						const cargoManifest: CargoManifest = assignedTask.cargoManifest;

						// Normalise manifest to entries [resource, amount]
						const entries = Object.entries(cargoManifest) as [ResourceConstant, number][];
						const totalNeeded = entries.reduce((s, [, amt]) => s + (amt || 0), 0);

						// initialize flags for task state machine logic
						cMem.emptyingInventory = false;
						cMem.enrouteToPickup = false;
						cMem.enrouteToDropoff = false;
						cMem.cargoRemaining ??= totalNeeded;

						// If creep is carrying something and lacks room for at least one item,
						// send it to deposit first (preserve previous behavior but simpler)
						if (creep.store.getUsedCapacity() > 0 && creep.store.getFreeCapacity() === 0) {
							cMem.emptyingInventory = true;
						} else {
							cMem.enrouteToPickup = true;
						}

						// EMPTY INVENTORY FIRST (send to room.storage if available)
						if (cMem.emptyingInventory) {
							if (creep.store.getUsedCapacity() !== 0) {
								if (room.storage) {
									if (!pos.isNearTo(room.storage)) {
										creep.advMoveTo(room.storage, pathing.workerPathing);
										return;
									} else {
										const resources = Object.keys(creep.store) as ResourceConstant[];
										for (const resource of resources) {
											const amount = creep.store[resource] ?? 0;
											if (amount <= 0) continue;
											const result = creep.transfer(room.storage, resource, amount);
											if (result === OK) continue;
											else {
												creep.log(`Error unloading original inventory: ${getReturnCode(result)}`);
												return;
											}
										}
									}
								} // TODO: else find another place to drop the resources
							} else {
								// once store is emptied, set state machine flags to next phase
								cMem.enrouteToPickup = true;
								cMem.emptyingInventory = false;
							}
						}

						// PICKUP PHASE: collect manifest items in order until creep is full or manifest satisfied
						if (cMem.enrouteToPickup) {
							if (!haulFrom) return;
							if (!pos.isNearTo(haulFrom.pos)) {
								creep.advMoveTo(haulFrom.pos, pathing.workerPathing);
								return;
							} else {
								// At the source - attempt to withdraw items for each manifest entry sequentially
								let collectedThisRun = 0;
								for (const [resource, manifestAmount] of entries) {
									if (creep.store.getFreeCapacity() <= 0) break; // no room left
									if (!manifestAmount || manifestAmount <= 0) continue;

									const availableAtSource = (haulFrom.store as Partial<Record<string, number>>)[resource] ?? 0;
									if (availableAtSource <= 0) continue;

									// withdraw up to manifestAmount, availableAtSource, and remaining free capacity
									const toTake = Math.min(manifestAmount, availableAtSource, creep.store.getFreeCapacity());
									if (toTake <= 0) continue;

									const res = creep.withdraw(haulFrom, resource, toTake);
									if (res === ERR_NOT_IN_RANGE) {
										// shouldn't happen because we checked nearTo, but handle defensively
										creep.advMoveTo(haulFrom.pos, pathing.workerPathing);
										return;
									} else if (res === OK) {
										collectedThisRun += toTake;
										// reduce remaining manifest counter stored in memory so further logic can observe
										cMem.cargoRemaining = (cMem.cargoRemaining || totalNeeded) - collectedThisRun;
										// continue to next manifest entry if free capacity remains
									} else {
										// handle unexpected error conservatively: log and abort this tick
										creep.log(`Error withdrawing ${resource}: ${getReturnCode(res)}`);
										return;
									}
								} // end for entries

								// After attempting to pick items, go to dropoff if we collected anything or manifest is satisfied
								if (creep.store.getUsedCapacity() > 0) {
									cMem.enrouteToDropoff = true;
									cMem.enrouteToPickup = false;
								} else {
									// Nothing picked up this tick (no available resources). Leave creep available for re-assignment.
									cMem.hasTask = false;
									cMem.availableForTasking = true;
								}
							}
						}

						// DROPOFF PHASE: transfer entire inventory to haulTo (deposit all carried resources)
						if (cMem.enrouteToDropoff) {
							if (!haulTo) return;
							if (!pos.isNearTo(haulTo.pos)) {
								creep.advMoveTo(haulTo.pos, pathing.workerPathing);
								return;
							} else {
								// Transfer everything the creep carries (all resource types)
								const carriedResources = Object.keys(creep.store) as ResourceConstant[];
								for (const resource of carriedResources) {
									const amount = creep.store[resource] ?? 0;
									if (amount <= 0) continue;
									const result = creep.transfer(haulTo, resource, amount);
									if (result === ERR_NOT_IN_RANGE) {
										creep.advMoveTo(haulTo.pos, pathing.workerPathing);
										return;
									} else if (result === OK) {
										// reduce cargoRemaining by amount if we are tracking it
										if (typeof cMem.cargoRemaining === 'number') {
											cMem.cargoRemaining = Math.max(0, cMem.cargoRemaining - amount);
										}
										continue;
									} else {
										creep.log(`Error transferring ${resource} to dropoff: ${getReturnCode(result)}`);
										return;
									}
								} // end transfer loop

								// After depositing all carried inventory, clear task flags and make creep available again
								delete cMem.enrouteToDropoff;
								delete cMem.enrouteToPickup;
								delete cMem.emptyingInventory;
								cMem.hasTask = false;
								cMem.availableForTasking = true;
							}
						}

						break;
					}
					case 'build':
						break;

					case 'fill':

					case 'repair':
						break;

					case 'upgrade':
						break;

					case 'harvest':
						break;

					case 'gather':
						break;

					default:
						break;
				}
			}
		}
	}
}

export default Worker;
