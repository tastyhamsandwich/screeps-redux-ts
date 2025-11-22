//const profiler = require('screeps-profiler');

import { aiAlert, navRallyPoint } from '../common';
import { pathing } from '@constants';

const Reserver = {
	run: (creep: Creep) => {
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

		if (cMem.disable) aiAlert(creep);
		else if (cMem.rally !== 'none') navRallyPoint(creep);
		else {
			if (cMem.targetRoom) {
				const targetRoom = Game.rooms[cMem.targetRoom];
				if (targetRoom?.controller !== undefined) {
					const targetPos = new RoomPosition(targetRoom.controller?.pos.x, targetRoom.controller?.pos.y, cMem.targetRoom);

					if (!pos.isNearTo(targetRoom?.controller))
						creep.advMoveTo(targetPos, pathing.reserverPathing, false);
					else {
						const result = creep.reserveController(targetRoom?.controller);
						if (result === ERR_NOT_IN_RANGE)
							creep.advMoveTo(targetPos, pathing.reserverPathing, true);
						else if (result === OK)
							return;
					}
				} else {
					const interimTargetPos = new RoomPosition(25, 25, cMem.targetRoom);
					creep.advMoveTo(interimTargetPos, pathing.reserverPathing, false);
				}
			}
		}
	}
}

//profiler.registerObject(Reserver, 'CreepReserver');

export default Reserver;
