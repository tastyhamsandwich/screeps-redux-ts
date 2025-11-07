
// Import Global Functions and VizFuncs
import { visualRCProgress, calcTickTime 	} from "@globals";
import { buildProgress, 	 repairProgress } from '@functions/visual/progress';

// Import Manager Daemons
import RoomManager 					from "@managers/RoomManager";
import TrafficManager 			from '@managers/TrafficManager';

// Import all Creep Role AI functions
import CreepAI from '@creeps/index';

// Import Prototype Extensions
import '@prototypes/index';

//! GLOBAL HEAP VARIABLES

// creep role counts for naming purposes
export const creepRoleCounts: { [key: string]: any } = {
	harvester: 1,
	filler: 1,
	hauler: 1,
	upgrader: 1,
	builder: 1,
	repairer: 1,
	defender: 1,
	reserver: 1,
	scout: 1,
	remoteharvester: 1,
}
let tickCount = 0;
Memory.globalData.numColonies ??= 0;

module.exports.loop = function() {

	if (!Memory.globalSettings) global.initGlobal();

	calcTickTime();

	// Generate pixels with extra CPU time
	if (Game.shard.name === 'shard3') {
		if (Game.cpu.bucket >= 10000) {
			Game.cpu.generatePixel()
			console.log('[GENERAL]: CPU Bucket at limit, generating pixel...');
		}
	}

	// Automatically delete memory of missing creeps
	for (const name in Memory.creeps) if (!(name in Game.creeps))	delete Memory.creeps[name];

	// Execute specific role-based creep script for every creep, based on role assigned in CreepMemory
	for (const name in Game.creeps) {
		const creep = Game.creeps[name];
		switch (creep.memory.role) {
			case 'harvester':
				try {
					CreepAI.Harvester.run(creep);
				} catch (e) {
					console.log(`Error with Harvester logic: ${e}`);
				}
				break;
			case 'upgrader':
				try {
					CreepAI.Upgrader.run(creep);
				} catch (e) {
					console.log(`Error with Upgrader logic: ${e}`);
				}
				break;
			case 'builder':
				try {
					CreepAI.Builder.run(creep);
				} catch (e) {
					console.log(`Error with Builder logic: ${e}`);
				}
				break;
			case 'repairer':
				try {
					CreepAI.Repairer.run(creep);
				} catch (e) {
					console.log(`Error with Repairer logic: ${e}`);
				}
				break;
			case 'filler':
				try {
					CreepAI.Filler.run(creep);
				} catch (e) {
					console.log(`Error with Filler logic: ${e}`);
				}
				break;
			case 'hauler':
				try {
					CreepAI.Hauler.run(creep);
				} catch (e) {
					console.log(`Error with Hauler logic: ${e}`);
				}
				break;
			case 'defender':
				try {
					CreepAI.Defender.run(creep);
				} catch (e) {
					console.log(`Error with Defender logic: ${e}`);
				}
				break;
			case 'reserver':
				try {
					CreepAI.Reserver.run(creep);
				} catch (e) {
					console.log(`Error with Reserver logic: ${e}`);
				}
				break;
			case 'remoteharvester':
				try {
					CreepAI.Harvester.runremote(creep);
				} catch (e) {
					console.log(`Error with Remote Harvester logic: ${e}`);
				}
				break;
			case 'scout':
				try {
					CreepAI.Scout.run(creep);
				} catch (e) {
					console.log(`Error with Scout logic: ${e}`);
				}
				break;
			default:
				break;
		}
	}

	// Resolve all movement Intents created during Creep AI execution phase
	TrafficManager.run();

	//* Encompassing loop to run across every room where we have vision
	_.forEach(Game.rooms, room => {

		const roomName = room.name;
		const rMem = room.memory;

		rMem.data ??= { numCSites: 0 };

		const cSites: Array<ConstructionSite> = room.find(FIND_CONSTRUCTION_SITES, { filter: (i) => i.structureType !== STRUCTURE_ROAD });
		const numCSitesPrevious: number = rMem.data.numCSites || 0;
		rMem.data.numCSites = cSites.length;
		const numCSites: number = rMem.data.numCSites || 0;

		if (room.memory.objects === undefined) 	room.cacheObjects();
		if (numCSites < numCSitesPrevious) 			room.cacheObjects();

		_.forEach(cSites, function (cSite: ConstructionSite) {
			if (cSite.progress > 0) buildProgress(cSite, room);
		});

		//* From here, only rooms where we own the controller have this code ran
		if (room.controller && room.controller.my) {
			// Initialize Room Manager instances for controlled rooms
			if (!global.roomManagers) global.roomManagers = {};
			if (!global.roomManagers[roomName]) global.roomManagers[roomName] = new RoomManager(room);

			const RoomManagerInstance = global.roomManagers[roomName];
			RoomManagerInstance.run();

			if (room.controller.level !== room.memory.data.controllerLevel) {
				const newLevel = room.controller.level;
				room.memory.data.controllerLevel = room.controller.level;

/* 				switch (newLevel) {
					case 1:
						// TODO RCL1: Handle creation of initial containers and roads
						break;
					case 2:
						// TODO RCL2: Handle creation of first 5 extensions
						break;
					case 3:
						// TODO RCL3: Handle creation of next 5 extensions, first tower, and potential transition to remote mining
						rMem.quotas.reserver = 1;
						rMem.quotas.remoteharvester = 2;
						rMem.quotas.remotebodyguard = 1;
						rMem.quotas.remotehauler = 2;
						break;
					case 4:
						// TODO RCL4: Handle creation of storage and next 10 extensions,
						break;
					case 5:
						// TODO RCL5: Handle creation of next 10 extensions, 2 links, and 2nd tower
						break;
					case 6:
						// TODO RCL6: Handle creation of terminal, first 3 labs, mineral extarctor, third link, and next 10 extensions
						break;
					case 7:
						// TODO RCL7: Handle creation of factory, next 3 labs, third tower, fourth link, next 10 extensions (which now hold 100 each), and second spawn
						break;
					case 8:
						// TODO RCL8: Handle creation of nuker, final 4 labs, powerSpawn, observer, 3 more towers, final 2 links, third spawn, and final 10 extensions (which now all hold 200 each)
						break;
					default:
						//# This should never happen
						console.log(`Unknown Exception occured in main colony room loop!`);
						break;
				} */
			}

			if (room.controller.level >= 1) visualRCProgress(room.controller);
		} //* end of if (room.controller && room.controller.my) {}
	}) //* end of _.forEach(Game.rooms, room => {}) loop

	tickCount++;
	global.tickCount = tickCount;

}; //* End of entire main loop
