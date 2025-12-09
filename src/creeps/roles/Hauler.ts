//const profiler = require('screeps-profiler');

import { assign } from 'lodash';
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

		if (cMem.disable) aiAlert(creep);
		else {
			if (cMem.rally === 'none') {

				if 		(pos.x == 49) creep.move(LEFT);
				else if (pos.x == 0 ) creep.move(RIGHT);
				else if (pos.y == 49) creep.move(TOP);
				else if (pos.y == 0 ) creep.move(BOTTOM);

				if (creep.ticksToLive! <= 2) creep.say('☠️');
				if (cMem.RFQ === 'hauler_dying' && cMem.announcedDeath !== true ) {
					creep.log(`Not enough TTL to complete rest of journey, peacefully awaiting the end...`);
					cMem.announcedDeath = true;
				}

				if (!cMem.pickup && !cMem.dropoff) {
					if (rMem.data.logisticalPairs)
						creep.assignLogisticalPair();
					else if (rMem.data.haulerPairs)
						assignHaulRoute(creep);
				}

				if (cMem.cargo === undefined) cMem.cargo = 'energy';
				if (cMem.dropoff == 'none') if (room.storage) cMem.dropoff = room.storage.id;

				let pickupTarget: AnyStoreStructure | undefined;
				let dropoffTarget: AnyStoreStructure | undefined;

				if (cMem.pickup) pickupTarget = Game.getObjectById(cMem.pickup) as AnyStoreStructure;
				if (cMem.dropoff) dropoffTarget = Game.getObjectById(cMem.dropoff) as AnyStoreStructure;

				if (room.storage && cMem.dropoff === room.storage.id)
					cMem.depositingStorage = true;
				else if (room.prestorage && cMem.dropoff === room.prestorage.id)
					cMem.depositingPrestorage = true;

				const pickupRoom = cMem.targetRoom;
				const dropoffRoom = cMem.dropoffRoom ?? cMem.targetRoom; // Default to targetRoom for backwards compatibility

				if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0 || creep.store[cMem.cargo] == 0) {
					// PICKUP PHASE
					const inPickupRoom = creep.room.name === pickupRoom;
					if (!inPickupRoom) {
						// Navigate to pickup room (even without visibility)
						const pickupTravelPos = new RoomPosition(25, 25, pickupRoom);
						creep.advMoveTo(pickupTravelPos, pathing.haulerPathing, true);
					} else {
						// We're in the pickup room, interact with pickup target
						if (pickupTarget) {
							if (pos.isNearTo(pickupTarget)) {
								// Check for dropped resources first
								const piles = pos.findInRange(FIND_DROPPED_RESOURCES, 1);
								if (piles.length) {
									const closestPile = pos.findClosestByRange(piles);
									if (closestPile) creep.pickup(closestPile);
								} else {
									creep.withdraw(pickupTarget, cMem.cargo);
								}
							} else {
								// Move to pickup target
								creep.advMoveTo(pickupTarget.pos, pathing.haulerPathing, true);
							}
						}
					}
				} else {
					// DROPOFF PHASE
					if (creep.ticksToLive && creep.ticksToLive < creep.memory.pathLength) {
						cMem.RFQ = 'hauler_dying';
						return;
					}
					const inDropoffRoom = creep.room.name === dropoffRoom;
					if (!inDropoffRoom) {
						// Navigate to dropoff room (even without visibility)
						const dropoffTravelPos = new RoomPosition(25, 25, dropoffRoom);
						creep.advMoveTo(dropoffTravelPos, pathing.haulerPathing, true);
					} else {
						// We're in the dropoff room, interact with dropoff target
						if (dropoffTarget) {
							if (pos.isNearTo(dropoffTarget)) {
								if (dropoffTarget.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
									const xferAmount = (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= dropoffTarget.store.getFreeCapacity(RESOURCE_ENERGY)) ?
										creep.store.getUsedCapacity(RESOURCE_ENERGY) : dropoffTarget.store.getFreeCapacity(RESOURCE_ENERGY);
									const result = creep.transfer(dropoffTarget, RESOURCE_ENERGY);
									if (result === OK) {
										rMem.stats.energyDeposited += xferAmount;
									}
								}
							} else {
								// Move to dropoff target
								creep.advMoveTo(dropoffTarget.pos, pathing.haulerPathing, true);
							}
						}
					}
				}
			} else navRallyPoint(creep);
		}
	}
}

function assignHaulRoute(creep: Creep): void {
	if (creep.room.memory.data.indices.haulerIndex === undefined)
		creep.room.memory.data.indices.haulerIndex = 0;

	const routeArray = creep.room.memory.data.haulerPairs;
	if (!routeArray || routeArray.length === 0) return;

	// Ensure index is always inside [0, routeArray.length-1]
	const idx = creep.room.memory.data.indices.haulerIndex % routeArray.length;

	const routeInfo = routeArray[idx];
	if (!routeInfo) return;

	creep.memory.pickup = routeInfo.start;
	creep.memory.dropoff = routeInfo.end;
	creep.memory.pathLength = routeInfo.length;
	creep.memory.targetRoom = routeInfo.room;
	creep.memory.dropoffRoom = routeInfo.dropoffRoom ?? routeInfo.room; // Separate room for dropoff if provided

	// Advance index for the next hauler (wraps to zero automatically)
	creep.room.memory.data.indices.haulerIndex = (idx + 1) % routeArray.length;
}

//profiler.registerObject(Hauler, 'CreepHauler');

export default Hauler;
