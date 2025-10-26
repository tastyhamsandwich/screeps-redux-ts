import { aiAlert, navRallyPoint } from '../common';
import { pathing } from '@constants';

export const Bodyguard = {

	run: function (creep: Creep) {

	},

	runremote: function (creep: Creep) {

		// Standard creep aliases
		const room: Room = creep.room;
		const cMem: CreepMemory = creep.memory;
		const rMem: RoomMemory = Game.rooms[cMem.homeRoom].memory
		const pos: RoomPosition = creep.pos;
		const TTL = creep.ticksToLive!;

		// Role-specific creep aliases
		const outpostRoom = cMem.outpostRoom;
		const homeOutpost = Game.rooms[cMem.home].memory.outposts;

		cMem.disable ??= false;
		cMem.rally ??= 'none';

		cMem.guardPost ??= homeOutpost.list[homeOutpost.guardCounter];

		if (cMem.guardPost === undefined) global.log(`-- [${creep.name}]: I was never given a guardpost assignment, falling back to home room for safety. Please assign a proper room for me to patrol!`, creep.room);
		cMem.guardPost ??= cMem.home;

		homeOutpost.guardCounter++;

		if (homeOutpost.guardCounter >= homeOutpost.array.length)	homeOutpost.guardCounter = 0;

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
			} else //: I HAVE A RALLY POINT, LET'S BOOGY!
				navRallyPoint(creep);
		} else //: AI DISABLED ALERT
			aiAlert(creep);
	}
}
