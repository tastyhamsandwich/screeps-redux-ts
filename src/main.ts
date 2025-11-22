//const profiler = require('screeps-profiler');

// Import Global Functions and VizFuncs
import * as FUNC from '@functions/index';

// Import Manager Daemons
import RoomManager 					from "@managers/RoomManager";
import TrafficManager 			from '@managers/TrafficManager';

// Import all Creep Role AI functions
import CreepAI from '@creeps/index';

// Import Prototype Extensions
import '@prototypes/index';

// polyfill for .flat()
if (!(Array.prototype as any).flat) {
	(Array.prototype as any).flat = function (depth = 1) {
		let arr = this;
		for (let d = 0; d < depth; d++) {
			arr = arr.reduce((acc: any[], val: any) => acc.concat(val), []);
		}
		return arr;
	};
}

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

//profiler.enable();

module.exports.loop = function() {
	//profiler.wrap(function() {
		if (Object.keys(Game.spawns).length === 0)
			FUNC.initGlobal(true);
		else if (Memory.globalData.onBirthInitComplete === undefined || Memory?.globalData?.onBirthInitComplete === false)
			FUNC.initGlobal();

		FUNC.calcTickTime();

		// Automatically delete memory of missing creeps
		FUNC.creepCleanup(creepRoleCounts);

		// Execute specific role-based creep script for every creep, based on role assigned in CreepMemory
		const creepSuspend = Memory.globalSettings.debug.suspendCreeps;

		for (const name in Game.creeps) {
			const creep = Game.creeps[name];
			try {
				switch (creep.memory.role) {
					case 'harvester':
						if (!creepSuspend.all || !creepSuspend.harvester)
							CreepAI.Harvester.run(creep);
						break;
					case 'upgrader':
						if (!creepSuspend.all || !creepSuspend.upgrader)
							CreepAI.Upgrader.run(creep);
						break;
					case 'builder':
						if (!creepSuspend.all || !creepSuspend.builder)
							CreepAI.Builder.run(creep);
						break;
					case 'repairer':
						if (!creepSuspend.all || !creepSuspend.repairer)
							CreepAI.Repairer.run(creep);
						break;
					case 'filler':
						if (!creepSuspend.all || !creepSuspend.filler)
							CreepAI.Filler.run(creep);
						break;
					case 'hauler':
						if (!creepSuspend.all || !creepSuspend.hauler)
							CreepAI.Hauler.run(creep);
						break;
					case 'defender':
						if (!creepSuspend.all || !creepSuspend.defender)
							CreepAI.Defender.run(creep);
						break;
					case 'reserver':
						if (!creepSuspend.all || !creepSuspend.reserver)
							CreepAI.Reserver.run(creep);
						break;
					case 'remoteharvester':
						if (!creepSuspend.all || !creepSuspend.remoteharvester)
							CreepAI.Harvester.runremote(creep);
						break;
					case 'scout':
						if (!creepSuspend.all || !creepSuspend.scout)
							CreepAI.Scout.run(creep);
						break;
					case 'conveyor':
						if (!creepSuspend.all || !creepSuspend.conveyor)
							CreepAI.Conveyor.run(creep);
					case 'worker':
						if (!creepSuspend.all || !creepSuspend.worker)
							CreepAI.Worker.run(creep);
					default:
						break;
				}
			} catch (e) {
				console.log(`<span style="color: red;">[ERROR]:</span> Error logged by ${creep.name} with ${FUNC.capitalize(creep.memory.role)} logic: ${e}`);
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
				if (cSite.progress > 0) FUNC.buildProgress(cSite, room);
			});

			const hostiles: Array<Creep> = room.find(FIND_HOSTILE_CREEPS);
			let hostileNameString = '';

			// Initialize tracking in room memory if not present
			rMem.data.hostileTracking ??= { invaderCount: 0, playerCreepCount: 0 };

			// Count current hostile creeps by type
			let currentInvaderCount = 0;
			let currentPlayerCreepCount = 0;
			const hostileOwners: string[] = [];

			for (let i = 0; i < hostiles.length; i++) {
				const hostileOwner: string = hostiles[i].owner.username;
				if (!hostileOwners.includes(hostileOwner)) {
					hostileOwners.push(hostileOwner);
					if (!hostileNameString.length) hostileNameString = `${hostileOwner}`;
					else hostileNameString += `, ${hostileOwner}`;
				}
				if (hostileOwner === 'Invader')
					currentInvaderCount++;
				else
					currentPlayerCreepCount++;
			}

			// Compare current counts to previous counts to detect kills
			if (currentInvaderCount < rMem.data.hostileTracking.invaderCount) {
				const killed = rMem.data.hostileTracking.invaderCount - currentInvaderCount;
				room.memory.stats.npcInvadersKilled += killed;
			}

			if (currentPlayerCreepCount < rMem.data.hostileTracking.playerCreepCount) {
				const killed = rMem.data.hostileTracking.playerCreepCount - currentPlayerCreepCount;
				room.memory.stats.hostilePlayerCreepsKilled += killed;
			}

			// Update tracking for next tick
			rMem.data.hostileTracking.invaderCount = currentInvaderCount;
			rMem.data.hostileTracking.playerCreepCount = currentPlayerCreepCount;

			if (hostileOwners.length > 0) {
				FUNC.log(`: -----------------HOSTILE CREEPS PRESENT----------------- `, room);
				FUNC.log(`OWNED BY: ${hostileNameString}`);
				if (room.memory.visuals.redAlertOverlay)
					room.visual.rect(-1, -1, 51, 51, { fill: '#440000', stroke: '#ff0000', opacity: 0.2, strokeWidth: 0.2 });
			}

			//* From here, only rooms where we own the controller have this code ran
			if (room.controller && room.controller.my) {
				// Initialize Room Manager instances for controlled rooms
				if (!global.roomManagers) global.roomManagers = {};
				if (!global.roomManagers[roomName]) global.roomManagers[roomName] = new RoomManager(room);

				const RoomManagerInstance = global.roomManagers[roomName];
				RoomManagerInstance.run();

				if (room.controller && room.controller.level !== room.memory.data.controllerLevel) {
					const newLevel = room.controller.level;
					room.memory.data.controllerLevel = newLevel;
					if (newLevel > room.memory.stats.controllerLevelReached)
						room.memory.stats.controllerLevelReached = newLevel;
				}

				if (room.controller && room.controller.level >= 1)
					FUNC.visualRCProgress(room.controller);

				FUNC.displayEnergyCapacity(room);
				FUNC.displayEnergyStorage(room);

			} //* end of if (room.controller && room.controller.my) {}
		}) //* end of _.forEach(Game.rooms, room => {}) loop

		tickCount++;
		global.tickCount = tickCount;

//}); //* End of profiler.wrap({})
}; //* End of entire main loop
