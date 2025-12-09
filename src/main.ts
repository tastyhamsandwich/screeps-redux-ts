
// Import Global Functions and VizFuncs
import * as FUNC from '@functions/index';
import { log } from '@globals';
import resetOnRespawn from '@utils/resetOnRespawn';

// Import Event Bus Module
import Events, { initializeDecoratedListeners } from '@modules/EventSystem';

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

initializeDecoratedListeners();

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
	worker: 1,
	conveyor: 1,
	infantry: 1
}
let tickCount = 0;

module.exports.loop = function() {
	try {
		resetOnRespawn();
		if (Memory?.globalData?.onBirthInitComplete === undefined || Memory?.globalData?.onBirthInitComplete === false)
			FUNC.initGlobal();

		FUNC.calcTickTime();

		// Automatically delete memory of missing creeps
		FUNC.creepCleanup(creepRoleCounts);

		// Execute specific role-based creep script for every creep, based on role assigned in CreepMemory

		const creepSuspend = (Memory.globalSettings.debug) ? Memory.globalSettings.debug.suspendCreeps : false;

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
						break;
					case 'worker':
						if (!creepSuspend.all || !creepSuspend.worker)
							CreepAI.Worker.run(creep);
						break;
					case 'infantry':
						if (!creepSuspend.all)
							CreepAI.Infantry.run(creep);
						break;
					default:
						break;
				}
			} catch (e) {
				console.log(`<span style="color: red;">[ERROR]:</span> Error logged by ${creep.name} with ${FUNC.capitalize(creep.memory.role)} logic: ${e}`);
			}
		}

		// Resolve all movement Intents created during Creep AI execution phase
		try {
			TrafficManager.run();
		} catch (e) {
			console.log(`Execution Error In Function: TrafficManager.run() on Tick ${Game.time}. Error: ${e}`);
		}

		//* Encompassing loop to run across every room where we have vision
		_.forEach(Game.rooms, room => {
			try {
				const roomName = room.name;
				const rMem = room.memory;
				rMem.data ??= { numCSites: 0 };

				const cSites: Array<ConstructionSite> = room.find(FIND_CONSTRUCTION_SITES, { filter: (i) => i.structureType !== STRUCTURE_ROAD });
				const numCSitesPrevious: number = rMem.data.numCSites ?? 0;
				rMem.data.numCSites = cSites.length;
				const numCSites: number = rMem.data.numCSites ?? 0;
				const remoteOfRoom = room.memory.remoteOfRoom;

				if (room.memory.objects === undefined) 	room.cacheObjects();
				if (numCSites < numCSitesPrevious) {
					room.cacheObjects();
					if (room.memory.remoteOfRoom)
						Events.emit('remoteRoomCached', { roomName: room.name, hostRoom: room.memory.remoteOfRoom });
				}

				if (remoteOfRoom) {
					const remoteBuildSites: Id<ConstructionSite<BuildableStructureConstant>>[] = Game.rooms[remoteOfRoom].memory.remoteRooms[room.name].cSites ?? [];
					for (const site of cSites) {
						if (!remoteBuildSites.includes(site.id))
							remoteBuildSites.push(site.id);
					}
					const cSiteIDs = cSites.map(c => c.id);
					for (const siteID of remoteBuildSites) {
						if (!cSiteIDs.includes(siteID)) {
							const index = remoteBuildSites.indexOf(siteID);
							if (index >= 0)
								delete Game.rooms[remoteOfRoom].memory.remoteRooms[room.name].cSites![index];
						}
					}
				}
				_.forEach(cSites, function (cSite: ConstructionSite) {
					try {
						if (cSite.progress > 0) FUNC.buildProgress(cSite, room);
					} catch (e) {
						console.log(`Execution Error In Function: buildProgress(cSite, room) on Tick ${Game.time}. Error: ${e}`);
					}
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
				// Initialize hostile creeps logging tracking in room memory if not present
				rMem.data.hostileLogging ??= { logCount: 0, lastLogTick: 0 };

				// Log first 5 times, then only every 50 ticks
				const shouldLog = rMem.data.hostileLogging.logCount < 5 ||
								  (tickCount - rMem.data.hostileLogging.lastLogTick >= 50);

				if (shouldLog) {
					log(`: -----------------HOSTILE CREEPS PRESENT----------------- `, room);
					log(`OWNED BY: ${hostileNameString}`);
					rMem.data.hostileLogging.logCount++;
					rMem.data.hostileLogging.lastLogTick = tickCount;
				}

				if (room.memory.visuals && room.memory.visuals.redAlertOverlay)
					room.visual.rect(-1, -1, 51, 51, { fill: '#440000', stroke: '#ff0000', opacity: 0.2, strokeWidth: 0.2 });
			}

				//* From here, only rooms where we own the controller have this code ran
				if (room.controller && room.controller.my) {
					try {
						// Initialize Room Manager instances for controlled rooms
						if (!global.roomManagers) global.roomManagers = {};
						if (!global.roomManagers[roomName]) global.roomManagers[roomName] = new RoomManager(room);

						const RoomManagerInstance = global.roomManagers[roomName];
						RoomManagerInstance.run();

						if (room.controller.level >= 1)
							FUNC.visualRCProgress(room.controller);

						FUNC.displayEnergyCapacity(room);
						FUNC.displayEnergyStorage(room);

						if (room.controller) {
							const controllerLevel = room.controller.level;
							const storedLevel = room.memory.data.controllerLevel;

							if (Memory.globalSettings.debug && Memory.globalSettings.debug.dataDebug)
								room.log(`Update C.Level: ${room.controller!.level !== room.memory.data.controllerLevel} | Update C.StatsLevel: ${room.controller!.level > room.memory.stats.controllerLevelReached}`);
							if (storedLevel !== controllerLevel) {
								room.memory.data.controllerLevel = room.controller.level;
								room.manager?.clearRCL();
								room.log(`Updated Controller Level! (was ${room.controller!.level - 1}, now ${room.controller!.level})`);
							}
							if (controllerLevel > storedLevel) {
								room.memory.stats.controllerLevelReached = room.controller.level;
								room.log(`New highest controller for the room reached!`);
							}
						}

					} catch (e) {
						console.log(`Execution Error In Function: RoomManager.run(${roomName}) on Tick ${Game.time}. Error: ${e}`);
					}
				} //* end of if (room.controller && room.controller.my) {}
			} catch (e) {
				console.log(`Execution Error In Function: roomLoop(${room.name}) on Tick ${Game.time}. Error: ${e}`);
			}
		}) //* end of _.forEach(Game.rooms, room => {}) loop

		tickCount++;
		global.tickCount = tickCount;
	} catch (e) {
		console.log(`Execution Error In Function: mainLoop() on Tick ${Game.time}. Error: ${e}`);
	}

}; //* End of entire main loop
