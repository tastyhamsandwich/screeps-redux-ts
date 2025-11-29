//const profiler = require('screeps-profiler');

import { aiAlert, navRallyPoint } from '../common';
import { pathing } from '@constants';
import { getReturnCode } from '@globals';

const Conveyor = {
	run: (creep: Creep) => {
		try {
			const room: Room = creep.room;
			const cMem: CreepMemory = creep.memory;
			const rMem: RoomMemory = Game.rooms[cMem.home].memory;
			const pos: RoomPosition = creep.pos;

			cMem.disable ??= false;
			cMem.rally ??= 'none';
			if (rMem.basePlan?.data.startPos)
				cMem.homePos ??= rMem.basePlan?.data.startPos;
			else {
				const spawn = room.find(FIND_MY_SPAWNS)[0];
				if (spawn) {
					const pos = { x: spawn.pos.x, y: spawn.pos.y, roomName: room.name };
					cMem.homePos ??= pos;
				}
			}

			if (pos.x == 49) creep.move(LEFT);
			else if (pos.x == 0) creep.move(RIGHT);
			else if (pos.y == 49) creep.move(TOP);
			else if (pos.y == 0) creep.move(BOTTOM);

			if (cMem.disable)
				aiAlert(creep);
			else if (cMem.rally !== 'none')
				navRallyPoint(creep);
			else {
				const homePos = new RoomPosition(cMem.homePos.x, cMem.homePos.y, cMem.homePos.roomName);
				if (!pos.isEqualTo(homePos)) {
					creep.advMoveTo(homePos, pathing.workerPathing);
					return;
				}

				const linkController = room.linkController;
				const linkStorage = room.linkStorage;
				const linkOne = room.linkOne;
				const linkTwo = room.linkTwo;

				//: Moving Energy from Storage Link to Storage
				if (rMem.data.storageLinkFilled > 0) {
					if (cMem.unloadingStorageLink && creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
						if (room.storage) {
							rMem.data.storageLinkFilled -= creep.store.getUsedCapacity(RESOURCE_ENERGY);
							creep.transfer(room.storage, RESOURCE_ENERGY);
							if (rMem.data.storageLinkFilled <= 0) {
								delete rMem.data.storageLinkFilled;
								delete cMem.unloadingStorageLink;
							}
						}
					}
					if (cMem.unloadingStorageLink && creep.store.getUsedCapacity() === 0) {
						creep.withdraw(room.linkStorage, RESOURCE_ENERGY);
					}
				}

				//: Transferring Energy from Storage Link to Controller Link
				if (linkController && linkStorage) {
					if (cMem.controllerXfer) {
						if (linkStorage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
							if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0)
								if (room.storage)
									creep.withdraw(room.storage, RESOURCE_ENERGY);
						} else {
							if (linkStorage.cooldown === 0) {
								const result = linkStorage.transferEnergy(linkController);
								if (result === OK) {
									delete cMem.controllerXfer;
								} else {
									creep.log(`Error initiating energy transfer from linkStorage to linkController: ${getReturnCode(result)}`)
								}
							}
						}
					}
					if (linkController.store.getUsedCapacity(RESOURCE_ENERGY) <= 100) {
						cMem.controllerXfer = true;
						if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
							if (room.storage)
								creep.withdraw(room.storage, RESOURCE_ENERGY);
					}
				}
				if (creep.store.getFreeCapacity() > 0 && linkStorage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
					const result = creep.withdraw(linkStorage, RESOURCE_ENERGY);
					if (result === OK) {
						cMem.unloadingStorageLink = true;
					}
				}
			}
		} catch (e) {
			console.log(`Execution Error In Function: Conveyor.run(creep) on Tick ${Game.time}. Error: ${e}`);
		}
	}
}

function controllerXfer(creep: Creep) {
	try {
		const room = creep.room;
		const linkStorage = room.linkStorage;
		const linkController = room.linkController;

		if (linkStorage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
			if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
				creep.withdraw(room.storage!, RESOURCE_ENERGY);
			else creep.transfer(linkStorage, RESOURCE_ENERGY);
		}
		if (linkStorage.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
			const cooldown = linkStorage.cooldown;
			const availableRoom = linkController.store.getFreeCapacity(RESOURCE_ENERGY);
			if (!cooldown) {
				const result = linkStorage.transferEnergy(linkController, availableRoom);
				if (result === OK)
					delete creep.memory.loadingLink;

				else
					creep.log(`Failed to transfer energy to controller link! Reason: ${getReturnCode(result)}`);
			}
		}
	} catch (e) {
		console.log(`Execution Error In Function: controllerXfer(creep) on Tick ${Game.time}. Error: ${e}`);
	}
}

function linkSourceXfer(creep: Creep, link: StructureLink) {
	try {
		const room = creep.room;
		const linkStorage = creep.room.linkStorage;

		if (linkStorage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
			if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0)
				creep.withdraw(linkStorage, RESOURCE_ENERGY);
			else
				creep.transfer(room.storage!, RESOURCE_ENERGY);
		}

		if (linkStorage.store.getFreeCapacity(RESOURCE_ENERGY) >= link.store.getUsedCapacity(RESOURCE_ENERGY)) {
			const cooldown = link.cooldown;

			if (!cooldown) {
				const result = link.transferEnergy(linkStorage);

				if (result === OK)
					delete creep.memory.sourceXfer;
				else {
					const linkNum = (link.id === room.linkOne.id) ? '1' : (link.id === room.linkTwo.id) ? '2' : '?';
					creep.log(`Failed to transfer energy from source link #${linkNum}: Reason: ${getReturnCode(result)}`);
				}
			}
		}
	} catch (e) {
		console.log(`Execution Error In Function: linkSourceXfer(creep, link) on Tick ${Game.time}. Error: ${e}`);
	}
}

//profiler.registerObject(Conveyor, 'CreepConveyor');

export default Conveyor;
