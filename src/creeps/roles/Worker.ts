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
						const haulFrom:  AnyStoreStructure = Game.getObjectById(assignedTask.haulFrom as Id<AnyStoreStructure>)!;
						const haulTo: 	 AnyStoreStructure = Game.getObjectById(assignedTask.haulTo 	as Id<AnyStoreStructure>)!;
						const cargoManifest: CargoManifest = assignedTask.cargoManifest;
						const entries: 		 ManifestEntries = Object.entries(cargoManifest) as ManifestEntry[];
						const [cargoType, cargoAmount] 		 = entries[0];

						// initialize flags for task state machine logic
						cMem.emptyingInventory 	= false;
						cMem.enrouteToPickup 		= false;
						cMem.enrouteToDropoff 	= false;

						// check if creep already has something in inventory
						if (creep.store.getUsedCapacity() > 0 &&
								creep.store.getFreeCapacity() < cargoAmount)
							cMem.emptyingInventory = true;
						else cMem.enrouteToPickup = true;

						// if items carried already take up too much room for the
						// cargo requirements, drop them off at storage first
						if (cMem.emptyingInventory) {
							if (creep.store.getUsedCapacity() !== 0) {
								if (room.storage) {
									if (!pos.isNearTo(room.storage))
										creep.advMoveTo(room.storage, pathing.workerPathing);
									else {
										const resources = Object.keys(creep.store);
										for (const resource of resources) {
											const result = creep.transfer(room.storage, resource as ResourceConstant);
											if (result === OK) continue;
											else {
												creep.log(`Error unloading original inventory: ${getReturnCode(result)}`);
												return;
											}
										}
									}
								} // TODO : else find another place to drop the resources
							} else {
								// once store is emptied, set state machine flags to next phase
							 	cMem.enrouteToPickup = true;
								cMem.emptyingInventory = false;
							}
						}

						// if we are set to navigate to pickup location
						if (cMem.enrouteToPickup) {
							if (!haulFrom) return; // check if we are next to pickup structure, move to it if not
							if (!pos.isNearTo(haulFrom.pos)) creep.advMoveTo(haulFrom.pos, pathing.workerPathing);
							else { // amount to withdraw = amount on manifest, if less than whats in storage.
								const amount = (cargoAmount < haulFrom.store[cargoType]) ? // get max worker can carry, if less than required
									cargoAmount : (creep.store.getCapacity() < haulFrom.store[cargoType]) ?
										creep.store.getCapacity() : haulFrom.store[cargoType];
								const result = creep.withdraw(haulFrom, cargoType, amount);
								if (result === OK) { // once resources are picked up, set state machine flags to next phase
									cMem.enrouteToDropoff = true;
									cMem.enrouteToPickup = false;
								} else {
									creep.log(`Error picking up cargo from initial haul point: ${getReturnCode(result)}`);
									return;
								}
							}
						}

						// if we are set to navigate to dropoff location
						if (cMem.enrouteToDropoff) {
							if (!haulTo) return; // check if we are next to dropoff structure, move to it if not
							if (!pos.isNearTo(haulTo.pos)) creep.advMoveTo(haulTo.pos, pathing.workerPathing);
							else { // amount to deposit = amount carried,
								const amount = creep.store[cargoType];
								const result = creep.transfer(haulTo, cargoType, amount);
								if (result === OK) {
									if (cargoAmount - amount > 0) cMem.cargoRemaining -= amount;
									else cMem.cargoRemaining = 0;
								}
								if (cMem.cargoRemaining > 0) {
									cMem.enrouteToDropoff = false;
									cMem.enrouteToPickup = true;
								} else {
									delete cMem.enrouteToDropoff;
									delete cMem.enrouteToPickup;
									delete cMem.emptyingInventory;
									cMem.hasTask = false;
									cMem.availableForTasking = true;
								}
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
