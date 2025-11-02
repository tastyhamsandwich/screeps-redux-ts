import { aiAlert, navRallyPoint } from '../common';
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
		const outpostRoom = cMem.outpostRoom;

		cMem.disable ??= false;
		cMem.rally ??= 'none';

		cMem.guardPost ??= cMem.home;

		if (!cMem.disable) {

			if (TTL <= 2) creep.say('☠️');
			if (cMem.rally == 'none') {

				if 			(pos.x == 49) creep.move(LEFT);
				else if (pos.x == 0) 	creep.move(RIGHT);
				else if (pos.y == 49) creep.move(TOP);
				else if (pos.y == 0) 	creep.move(BOTTOM);

				if (room.name !== outpostRoom) {
					creep.moveTo(Game.flags[outpostRoom], pathing.remoteGuard);
				} else {
					const hostiles = room.find(FIND_HOSTILE_CREEPS);
					if (hostiles.length > 0) {
						const target = pos.findClosestByRange(hostiles);
						if (target) {
							if (creep.rangedAttack(target) == ERR_NOT_IN_RANGE)
								creep.moveTo(target, pathing.remoteGuard);
						}
					} else {
						if (!pos.isNearTo(Game.flags[outpostRoom]))
							creep.moveTo(Game.flags[outpostRoom], pathing.remoteGuard);
					}
				}
			} else navRallyPoint(creep);
		} else aiAlert(creep);
	}
}

export default Defender;
