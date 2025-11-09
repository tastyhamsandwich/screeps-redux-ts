import { aiAlert, navRallyPoint } from '../common';
import { pathing } from '@constants';
import { log } from '@globals';

const Reserver = {
	run: (creep: Creep) => {
		const room: Room = creep.room;
		const cMem: CreepMemory = creep.memory;
		const rMem: RoomMemory = Game.rooms[cMem.home].memory;
		const pos: RoomPosition = creep.pos;

		cMem.disable ??= false;
		cMem.rally ??= 'none';

		//# If no targetOutpost pre-defined, assign one to self based on reserverLastAssigned index in room's outposts memory
		//# Increment RLA index and wrap to zero if at length value of outposts array
		if (cMem.targetOutpost === undefined) {
			if (rMem?.outposts?.array && rMem.outposts.reserverLastAssigned !== undefined) {
				cMem.targetOutpost = rMem.outposts.array[rMem.outposts.reserverLastAssigned];
				rMem.outposts.reserverLastAssigned = (rMem.outposts.reserverLastAssigned + 1) % rMem.outposts.array.length;
			}
		}
		if (cMem.controller === undefined && cMem.targetOutpost) {
			const outpostData = Game.rooms[cMem.home]?.memory?.outposts?.list?.[cMem.targetOutpost];
			if (outpostData?.controllerID) {
				cMem.controller = outpostData.controllerID;
			}
		}
		//# If creep is at home room, has no rally point, and has a targetOutpost in memory, set rally point to target outpost flag
		//if (creep.room.name === cMem.home && cMem.rally === 'none' && cMem.targetOutpost !== undefined)
		//	cMem.rally = rMem.outposts.list[cMem.targetOutpost].controllerFlag;

		if (cMem.disable === true) {
			//! Disabled AI alert
			aiAlert(creep);
		} else {
			if (cMem.rally === 'none') {
				//# Once in outpost room and rally point is reached, find controller and start reserving it
				if (cMem.targetOutpost !== undefined) {
					if (room.name === cMem.targetOutpost && room.controller) {
						if (pos.isNearTo(room.controller)) {
							const result = creep.reserveController(room.controller);

							if (result === OK)
								creep.say('🔁');
							else
								log(`${creep.name}: Error reserving controller: ${result}`);
						} else {
							creep.advMoveTo(room.controller, true, pathing.reserverPathing);
						}
					} else {
						creep.advMoveTo(Game.flags[cMem.targetOutpost], true, pathing.reserverPathing);
					}
				}
			} else {
				//! Override default behavior and navigate to nav point
				navRallyPoint(creep);
			}
		}
	}
}

export default Reserver;
