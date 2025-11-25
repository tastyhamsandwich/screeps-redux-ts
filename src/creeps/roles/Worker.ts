//const profiler = require('screeps-profiler');

import { aiAlert, navRallyPoint } from '../common';
import { pathing } from '@constants';
import { getReturnCode } from '@globals';

const Worker = {
	run: (creep: Creep) => {
		try {
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
					case 'gather': { //: GATHER DROPPED RESOURCES
						const gatherTask = assignedTask as GatherTask;
						const targetId = Array.isArray(gatherTask.gatherTargets)
							? gatherTask.gatherTargets[0]
							: gatherTask.gatherTargets;
						const target = Game.getObjectById(targetId as Id<Resource>);
						const dropoff = Game.getObjectById(gatherTask.dropoffTarget as Id<AnyStoreStructure>);

						if (!target || !dropoff) {
							cMem.hasTask = false;
							cMem.availableForTasking = true;
							return;
						}

						// State machine: pickup -> dropoff
						cMem.gatherPickupPhase ??= true;

						if (cMem.gatherPickupPhase) {
							// Move to resource
							if (!pos.isNearTo(target)) {
								creep.advMoveTo(target.pos, pathing.workerPathing);
								return;
							}

							// Pick up resource
							const pickupResult = creep.pickup(target);
							if (pickupResult === OK) {
								// Track progress
								cMem.taskProgress = cMem.taskProgress || {};
								cMem.taskProgress[target.resourceType] = (cMem.taskProgress[target.resourceType] || 0) + target.amount;

								// Move to dropoff phase
								cMem.gatherPickupPhase = false;
								return;
							} else if (pickupResult === ERR_NOT_IN_RANGE) {
								creep.advMoveTo(target.pos, pathing.workerPathing);
								return;
							} else {
								// Target disappeared or other error
								cMem.hasTask = false;
								cMem.availableForTasking = true;
								return;
							}
						}

						// Dropoff phase
						if (!cMem.gatherPickupPhase && creep.store.getUsedCapacity() > 0) {
							if (!pos.isNearTo(dropoff)) {
								creep.advMoveTo(dropoff.pos, pathing.workerPathing);
								return;
							}

							// Transfer all cargo to dropoff
							const resources = Object.keys(creep.store) as ResourceConstant[];
							for (const resource of resources) {
								const amount = creep.store[resource] ?? 0;
								if (amount <= 0) continue;
								const result = creep.transfer(dropoff, resource, amount);
								if (result !== OK && result !== ERR_NOT_IN_RANGE) {
									creep.log(`Error transferring ${resource}: ${getReturnCode(result)}`);
									return;
								}
							}

							// Task complete
							delete cMem.gatherPickupPhase;
							cMem.hasTask = false;
							cMem.availableForTasking = true;
						}
						break;
					}

					case 'build': { //: BUILD TASK
						const buildTask = assignedTask as BuildTask;
						const site = Game.getObjectById(buildTask.buildTarget as Id<ConstructionSite>);

						if (!site) {
							cMem.hasTask = false;
							cMem.availableForTasking = true;
							return;
						}

						// Check if creep has WORK parts (builder type)
						const hasWorkParts = creep.body.some(p => p.type === WORK);
						if (!hasWorkParts) {
							// This worker is a pure hauler, can't build
							cMem.hasTask = false;
							cMem.availableForTasking = true;
							return;
						}

						// Harvest phase: get energy if needed
						if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
							// Find nearest container or storage with energy
							const source = room.storage || room.find(FIND_STRUCTURES, {
								filter: s => s instanceof StructureContainer && (s as StructureContainer).store.getUsedCapacity(RESOURCE_ENERGY) > 0
							})[0];

							if (!source) {
								cMem.hasTask = false;
								cMem.availableForTasking = true;
								return;
							}

							if (!pos.isNearTo(source)) {
								creep.advMoveTo(source.pos, pathing.workerPathing);
								return;
							}

							const withdrawResult = creep.withdraw(source as AnyStoreStructure, RESOURCE_ENERGY);
							if (withdrawResult !== OK && withdrawResult !== ERR_NOT_IN_RANGE) {
								cMem.hasTask = false;
								cMem.availableForTasking = true;
								return;
							}
							return;
						}

						// Build phase
						if (!pos.isNearTo(site)) {
							creep.advMoveTo(site.pos, pathing.workerPathing);
							return;
						}

						const buildResult = creep.build(site);
						if (buildResult === OK) {
							// Track progress
							cMem.taskProgress = cMem.taskProgress || {};
							cMem.taskProgress.buildAmount = (cMem.taskProgress.buildAmount || 0) + 5; // Approximate work power
						} else if (buildResult === ERR_NOT_IN_RANGE) {
							creep.advMoveTo(site.pos, pathing.workerPathing);
						} else if (buildResult === ERR_NOT_ENOUGH_ENERGY) {
							// Go refill and try again
							delete cMem.buildEnergyFull;
						} else {
							// Site completed or other error
							cMem.hasTask = false;
							cMem.availableForTasking = true;
						}
						break;
					}

					case 'repair': { //: REPAIR TASK
						const repairTask = assignedTask as RepairTask;
						const target = Game.getObjectById(repairTask.repairTarget as Id<AnyStructure>);

						if (!target || target.hits >= target.hitsMax) {
							cMem.hasTask = false;
							cMem.availableForTasking = true;
							return;
						}

						// Check if creep has WORK parts
						const hasWorkParts = creep.body.some(p => p.type === WORK);
						if (!hasWorkParts) {
							cMem.hasTask = false;
							cMem.availableForTasking = true;
							return;
						}

						// Get energy if needed
						if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
							const source = room.storage || room.find(FIND_STRUCTURES, {
								filter: s => s instanceof StructureContainer && (s as StructureContainer).store.getUsedCapacity(RESOURCE_ENERGY) > 0
							})[0];

							if (!source) {
								cMem.hasTask = false;
								cMem.availableForTasking = true;
								return;
							}

							if (!pos.isNearTo(source)) {
								creep.advMoveTo(source.pos, pathing.workerPathing);
								return;
							}

							creep.withdraw(source as AnyStoreStructure, RESOURCE_ENERGY);
							return;
						}

						// Repair phase
						if (!pos.isNearTo(target)) {
							creep.advMoveTo(target.pos, pathing.workerPathing);
							return;
						}

						const repairResult = creep.repair(target);
						if (repairResult === OK) {
							// Track progress
							cMem.taskProgress = cMem.taskProgress || {};
							cMem.taskProgress.repairAmount = (cMem.taskProgress.repairAmount || 0) + 100; // Approximate work power
						} else if (repairResult === ERR_NOT_IN_RANGE) {
							creep.advMoveTo(target.pos, pathing.workerPathing);
						} else if (repairResult === ERR_NOT_ENOUGH_ENERGY) {
							// Go refill
						} else {
							// Target is fully repaired or error
							cMem.hasTask = false;
							cMem.availableForTasking = true;
						}
						break;
					}

					case 'fill': { //: FILL SPAWNS/EXTENSIONS TASK
						const fillTask = assignedTask as FillTask;
						const source = Game.getObjectById(fillTask.fillingEnergySource as Id<AnyStoreStructure>);

						if (!source || source.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
							cMem.hasTask = false;
							cMem.availableForTasking = true;
							return;
						}

						// State: pickup -> dropoff
						cMem.fillPickupPhase ??= true;

						if (cMem.fillPickupPhase) {
							// Get energy from source
							if (!pos.isNearTo(source)) {
								creep.advMoveTo(source.pos, pathing.workerPathing);
								return;
							}

							const amount = Math.min(
								creep.store.getFreeCapacity(),
								source.store.getUsedCapacity(RESOURCE_ENERGY)
							);
							const withdrawResult = creep.withdraw(source, RESOURCE_ENERGY, amount);
							if (withdrawResult === OK && creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
								cMem.fillPickupPhase = false;
								return;
							} else if (withdrawResult !== OK && withdrawResult !== ERR_NOT_IN_RANGE) {
								cMem.hasTask = false;
								cMem.availableForTasking = true;
								return;
							}
							return;
						}

						// Dropoff phase: fill spawns/extensions
						const targets = fillTask.fillableStructures.map(id => Game.getObjectById(id)).filter(s => s !== null) as AnyStructure[];
						const toBeFilled = targets.filter(s => {
							if (s instanceof StructureSpawn) return s.energy < s.energyCapacity;
							if (s instanceof StructureExtension) return s.energy < s.energyCapacity;
							return false;
						});

						if (toBeFilled.length === 0 || creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
							delete cMem.fillPickupPhase;
							cMem.hasTask = false;
							cMem.availableForTasking = true;
							return;
						}

						// Fill closest structure first
						let closest = toBeFilled[0];
						let minDist = pos.getRangeTo(closest);
						for (const target of toBeFilled) {
							const dist = pos.getRangeTo(target);
							if (dist < minDist) {
								minDist = dist;
								closest = target;
							}
						}

						if (!pos.isNearTo(closest)) {
							creep.advMoveTo(closest.pos, pathing.workerPathing);
							return;
						}

						const transferResult = creep.transfer(closest as StructureSpawn | StructureExtension, RESOURCE_ENERGY);
						if (transferResult === OK) {
							cMem.taskProgress = cMem.taskProgress || {};
							cMem.taskProgress.filledAmount = (cMem.taskProgress.filledAmount || 0) + 1;
						} else if (transferResult !== ERR_NOT_IN_RANGE) {
							delete cMem.fillPickupPhase;
							cMem.hasTask = false;
							cMem.availableForTasking = true;
						}
						break;
					}

					case 'upgrade': { //: UPGRADE CONTROLLER TASK
						const upgradeTask = assignedTask as UpgradeTask;
						const controller = Game.getObjectById(upgradeTask.targetController as Id<StructureController>);

						if (!controller) {
							cMem.hasTask = false;
							cMem.availableForTasking = true;
							return;
						}

						// Check if creep has WORK parts
						const hasWorkParts = creep.body.some(p => p.type === WORK);
						if (!hasWorkParts) {
							cMem.hasTask = false;
							cMem.availableForTasking = true;
							return;
						}

						// Get energy if needed
						if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
							const source = room.storage || room.find(FIND_STRUCTURES, {
								filter: s => s instanceof StructureContainer && (s as StructureContainer).store.getUsedCapacity(RESOURCE_ENERGY) > 0
							})[0];

							if (!source) {
								cMem.hasTask = false;
								cMem.availableForTasking = true;
								return;
							}

							if (!pos.isNearTo(source)) {
								creep.advMoveTo(source.pos, pathing.workerPathing);
								return;
							}

							creep.withdraw(source as AnyStoreStructure, RESOURCE_ENERGY);
							return;
						}

						// Upgrade phase
						if (!pos.inRangeTo(controller, 3)) {
							creep.advMoveTo(controller.pos, pathing.workerPathing);
							return;
						}

						const upgradeResult = creep.upgradeController(controller);
						if (upgradeResult === OK) {
							cMem.taskProgress = cMem.taskProgress || {};
							cMem.taskProgress.upgradeAmount = (cMem.taskProgress.upgradeAmount || 0) + 1;
						} else if (upgradeResult === ERR_NOT_IN_RANGE) {
							creep.advMoveTo(controller.pos, pathing.workerPathing);
						} else if (upgradeResult === ERR_NOT_ENOUGH_ENERGY) {
							// Go refill
						} else {
							cMem.hasTask = false;
							cMem.availableForTasking = true;
						}
						break;
					}

					case 'harvest':
						break;

					default:
						break;
				}
			}
		}
		} catch (e) {
			console.log(`Execution Error In Function: Worker.run(creep) on Tick ${Game.time}. Error: ${e}`);
		}
	}
}

//profiler.registerObject(Worker, 'CreepWorker');

export default Worker;
