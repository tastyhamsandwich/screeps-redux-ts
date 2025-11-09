import { aiAlert, navRallyPoint } from '../common';
import { pathing } from '@constants';

const Hauler = {
	run: (creep: Creep) => {

		const room: Room = creep.room;
		const cMem: CreepMemory = creep.memory;
		const rMem: RoomMemory = Game.rooms[cMem.home].memory;
		const pos: RoomPosition = creep.pos;

		cMem.disable ??= false;
		cMem.rally ??= 'none';

		if (cMem.disable === true)
			aiAlert(creep);
		else {
			if (cMem.rally === 'none') {

				if 		(pos.x == 49) creep.move(LEFT);
				else if (pos.x == 0 ) creep.move(RIGHT);
				else if (pos.y == 49) creep.move(TOP);
				else if (pos.y == 0 ) creep.move(BOTTOM);

				if (creep.ticksToLive! <= 2) creep.say('☠️');

				if (!cMem.pickup && !cMem.dropoff) creep.assignLogisticalPair();

				if (cMem.cargo === undefined) cMem.cargo = 'energy';
				if (cMem.dropoff == 'none') if (room.storage) cMem.dropoff = room.storage.id;

				let pickupTarget;
				let dropoffTarget;

				if (cMem.pickup)  pickupTarget  = Game.getObjectById(cMem.pickup)  as AnyStoreStructure;
				if (cMem.dropoff) dropoffTarget = Game.getObjectById(cMem.dropoff) as AnyStoreStructure;

				const pickupPos = pickupTarget?.pos || (cMem.pickupPos? new RoomPosition(cMem.pickupPos.x, cMem.pickupPos.y, cMem.pickupPos.roomName): null);
				const dropoffPos = dropoffTarget?.pos || (cMem.dropoffPos? new RoomPosition(cMem.dropoffPos.x, cMem.dropoffPos.y, cMem.dropoffPos.roomName): null);

				if (creep.store[RESOURCE_ENERGY] == 0 || creep.store[cMem.cargo] == 0) {
					if (pickupPos) {
						if (pickupTarget && pos.isNearTo(pickupTarget)) {
							const piles = pos.findInRange(FIND_DROPPED_RESOURCES, 1);
							if (piles.length) {
								const closestPile = pos.findClosestByRange(piles);
								if (closestPile) creep.pickup(closestPile);
							} else creep.withdraw(pickupTarget, cMem.cargo);
						} else creep.advMoveTo(pickupPos, false, pathing.haulerPathing);
					}
				} else {
					if (dropoffPos) {
						if (dropoffTarget && pos.isNearTo(dropoffTarget)) {
							if (dropoffTarget.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
								const result = creep.transfer(dropoffTarget, RESOURCE_ENERGY);
								if (result === OK) creep.advMoveTo(pickupPos, false, pathing.haulerPathing);
							}
						}	else creep.advMoveTo(dropoffPos, false, pathing.haulerPathing);
					}
				}
			} else navRallyPoint(creep);
		}
	}
}

export default Hauler;
