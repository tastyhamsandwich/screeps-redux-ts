import { aiAlert, navRallyPoint } from '../common';
import { pathing } from '@constants';

const Scout = {
	tickCount: 0,
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

		if (cMem.disable === true) aiAlert(creep);
		else {
			if (cMem.rally !== 'none') navRallyPoint(creep);
			else {
				if (cMem.targetRoom) {
					const targetPos = new RoomPosition(25, 25, cMem.targetRoom);
					creep.advMoveTo(targetPos, pathing.builderPathing, false);
				} else {
					if (Scout.tickCount % 5) creep.say('🥱');
					else creep.say('💤');
					Scout.tickCount++;
				}
			}
		}
	}
}

export default Scout;
