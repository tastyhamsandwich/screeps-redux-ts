//const profiler = require('screeps-profiler');
export default class SmartNavigator {
	static getNextStep(creep: Creep, target: RoomPosition): RoomPosition | null {
		// If destination is in same visible room:
		if (creep.room.name === target.roomName) return target;

		// If destination room not visible:
		if (!Game.rooms[target.roomName]) {
			// Retrieve or build cached route
			if (!creep.memory._travel || creep.memory._travel.dest !== target.roomName) {
				const route = Game.map.findRoute(creep.room.name, target.roomName);
				if (route === ERR_NO_PATH) return null;

				creep.memory._travel = {
					dest: target.roomName,
					route: route.map(r => r.room),
					index: 0
				};
			}

			const travel = creep.memory._travel;

			// Advance index when we’ve entered the next room in the route
			if (travel.route[travel.index] === creep.room.name && travel.index < travel.route.length - 1)
				travel.index++;

			const nextRoom = travel.route[travel.index];
			const exitDir = Game.map.findExit(creep.room.name, nextRoom) as ExitConstant;
			const exitPos = creep.pos.findClosestByRange(exitDir);

			return exitPos ?? null;
		}

		// If both rooms visible (rare case)
		return target;
	}

	static invalidateRoute(creep: Creep): void {
		delete creep.memory._travel;
	}
}

declare global {
	interface CreepMemory {
		_travel?: {
			dest: string;
			route: string[];
			index: number;
		};
	}
}

//profiler.registerClass(SmartNavigator, 'SmartNavigator');
