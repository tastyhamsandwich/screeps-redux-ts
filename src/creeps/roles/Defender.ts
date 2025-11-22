//const profiler = require('screeps-profiler');

import { aiAlert, navRallyPoint, exitMortalCoil } from '../common';
import { pathing } from '@constants';

const Defender = {

	run: function (creep: Creep) {

		// Standard creep aliases
		const room: Room = creep.room;
		const cMem: CreepMemory = creep.memory;
		const rMem: RoomMemory = Game.rooms[cMem.home].memory
		const pos: RoomPosition = creep.pos;
		const TTL: number = creep.ticksToLive!;

		// Role-specific creep aliases
		const guardPost = cMem.guardPost;

		cMem.disable ??= false;
		cMem.rally ??= 'none';

		cMem.guardPost ??= cMem.home;

		if (!cMem.disable) {

			if (TTL <= 2) exitMortalCoil(creep);
			if (cMem.rally == 'none') {

				if 			(pos.x == 49) creep.move(LEFT);
				else if (pos.x == 0) 	creep.move(RIGHT);
				else if (pos.y == 49) creep.move(TOP);
				else if (pos.y == 0) 	creep.move(BOTTOM);

				if (room.name !== guardPost) {
					creep.advMoveTo(Game.flags[guardPost], pathing.remoteGuard);
				} else {
					if (cMem.target) {
						const targetId: Id<Creep> = cMem.target;
						const target: Creep | null = Game.getObjectById(targetId);
						if (target) {
							if (creep.attack(target) === ERR_NOT_IN_RANGE)
								creep.advMoveTo(target, pathing.remoteGuard);
						} else {
							delete cMem.target;
							const hostiles = room.find(FIND_HOSTILE_CREEPS);
							if (hostiles.length > 0) {
								const target = pos.findClosestByRange(hostiles);
								if (target) {
									cMem.target = target.id;
									if (creep.attack(target) === ERR_NOT_IN_RANGE)
										creep.advMoveTo(target, pathing.remoteGuard);
								}
							}
						}
					} else {
						const hostiles = room.find(FIND_HOSTILE_CREEPS);
						if (hostiles.length > 0) {
							const target = pos.findClosestByRange(hostiles);
							if (target) {
								cMem.target = target.id;
								if (creep.attack(target) === ERR_NOT_IN_RANGE)
									creep.advMoveTo(target, pathing.remoteGuard);
							}
						} else {
							if (!pos.isNearTo(Game.flags[guardPost]))
								creep.advMoveTo(Game.flags[guardPost], pathing.remoteGuard);
						}
					}
				}
			} else navRallyPoint(creep);
		} else aiAlert(creep);
	}
}

//profiler.registerObject(Defender, 'CreepDefender');

export default Defender;
