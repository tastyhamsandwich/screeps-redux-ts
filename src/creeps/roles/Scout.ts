//const profiler = require('screeps-profiler');

import { aiAlert, navRallyPoint } from '../common';
import { pathing } from '@constants';

const Scout = {
	tickCount: 0,
	run: (creep: Creep) => {
		try {
			const room: Room = creep.room;
			const cMem: CreepMemory = creep.memory;
			const rMem: RoomMemory = Game.rooms[cMem.home].memory;
			const pos: RoomPosition = creep.pos;

			cMem.disable ??= false;
			cMem.rally ??= 'none';

			if (pos.x == 49) creep.move(LEFT);
			else if (pos.x == 0) creep.move(RIGHT);
			else if (pos.y == 49) creep.move(TOP);
			else if (pos.y == 0) creep.move(BOTTOM);

			if (cMem.disable === true) aiAlert(creep);
			else {
				if (cMem.rally !== 'none') navRallyPoint(creep);
				else {
					if (cMem.targetRoom) {
						if (creep.room.name !== cMem.targetRoom) {
							const targetPos = new RoomPosition(25, 25, cMem.targetRoom);
							creep.advMoveTo(targetPos, pathing.builderPathing, false);
						} else {
							const targetRoom = Game.rooms[cMem.targetRoom];
							if (!targetRoom.memory.objects) {
								targetRoom.cacheObjects();
								Game.rooms[cMem.home].memory.remoteRooms[cMem.targetRoom].scouted = true;
							}
							if (room.controller) {
								if (!pos.isNearTo(room.controller)) {
									creep.advMoveTo(room.controller, pathing.builderPathing, false);
								}
							} else {
								if (pos.x <= 1)
									creep.move(RIGHT);
								if (pos.x >= 48)
									creep.move(LEFT);
								if (pos.y <= 1)
									creep.move(BOTTOM);
								if (pos.y >= 48)
									creep.move(TOP);
							}
						}
					} else {
						if (Scout.tickCount % 5) creep.say('🥱');
						else creep.say('💤');
						Scout.tickCount++;
					}
				}
			}
		} catch (e) {
			console.log(`Execution Error In Function: Scout.run(creep) on Tick ${Game.time}. Error: ${e}`);
		}
	}
}

//profiler.registerObject(Scout, 'CreepScout');

export default Scout;
