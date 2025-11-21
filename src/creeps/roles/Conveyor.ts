import { aiAlert, navRallyPoint } from '../common';
import { pathing } from '@constants';
import { getReturnCode } from '@globals';

const Conveyor = {
	run: (creep: Creep) => {

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

			if (cMem.loadingLink) {
				controllerXfer(creep);
				return;
			}

			if (cMem.sourceXfer) {
				if (linkOne && linkOne.store.getUsedCapacity(RESOURCE_ENERGY) > 100)
					linkSourceXfer(creep, linkOne);
				if (linkTwo && linkTwo.store.getUsedCapacity(RESOURCE_ENERGY) > 100)
					linkSourceXfer(creep, linkTwo);
				return;
			}

			if (cMem.fillingSpawns) {
				const spawns = pos.findInRange(FIND_MY_SPAWNS, 1, { filter: (s) => s.store.getFreeCapacity(RESOURCE_ENERGY) > 0 });
				if (spawns.length) {
					const result = creep.transfer(spawns[0], RESOURCE_ENERGY);
					if (result === OK)
						delete cMem.fillingSpawns;
					else
						creep.log(`Error filling spawn! Reason: ${getReturnCode(result)}`);
				}
				return;
			}

			if (linkStorage && linkOne && room.storage) {
				if (linkOne.store.getUsedCapacity(RESOURCE_ENERGY) > 100)
					cMem.sourceXfer = true;
				return;
			}

			if (linkStorage && linkTwo && room.storage) {
				if (linkTwo.store.getUsedCapacity(RESOURCE_ENERGY) > 100)
					cMem.sourceXfer = true;
				return;
			}

			if (linkStorage && linkController && room.storage) {
				if (linkController.store.getUsedCapacity(RESOURCE_ENERGY) < 100) {
					if (room.storage.store.getUsedCapacity(RESOURCE_ENERGY) >= 2000) {
						cMem.loadingLink = true;
						return;
					}
				}
			}

			const spawns = pos.findInRange(FIND_MY_SPAWNS, 1, { filter: (s) => s.store.getFreeCapacity(RESOURCE_ENERGY) > 0 });
			if (spawns.length) {
				if (creep.store.getUsedCapacity(RESOURCE_ENERGY) < spawns[0].store.getFreeCapacity(RESOURCE_ENERGY)) {
					const energyNeeded = spawns[0].store.getFreeCapacity(RESOURCE_ENERGY);
					const amountToWithdraw = energyNeeded - creep.store[RESOURCE_ENERGY];
					creep.withdraw(room.storage!, RESOURCE_ENERGY, amountToWithdraw);
					cMem.fillingSpawns = true;
					return;
				}
			}

			if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0)
				creep.transfer(room.storage!, RESOURCE_ENERGY);
		}
	}
}

function controllerXfer(creep: Creep) {
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
}

function linkSourceXfer(creep: Creep, link: StructureLink) {
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
}

export default Conveyor;
