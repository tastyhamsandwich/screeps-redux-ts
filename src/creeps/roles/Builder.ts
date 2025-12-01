//const profiler = require('screeps-profiler');

import { aiAlert, navRallyPoint, upgraderBehavior, findEnergySource } from "../common";
import { pathing } from "@constants";

/**
 * A creep whose role it is to locate energy and spend it building structures around the room.
 * Requires WORK, CARRY, and MOVE parts to be effective.
 *
 * State machine:
 * - working: false -> Withdraw energy from storage/containers
 * - working: true  -> Build construction sites or upgrade controller
 */
const Builder = {
	run: (creep: Creep) => {
		try {
			const room: Room = creep.room;
			const cMem: CreepMemory = creep.memory;
			const rMem: RoomMemory = Game.rooms[cMem.home].memory;
			const pos: RoomPosition = creep.pos;

			cMem.disable ??= false;
			cMem.rally ??= 'none';
			cMem.working ??= false; // Initialize working flag if undefined

			if (cMem.disable === true) {
				aiAlert(creep);
			} else {
				if (cMem.rally !== 'none') {
					navRallyPoint(cMem.rally);
				} else {
					// State transition logic: toggle working flag based on energy levels
					if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0)	cMem.working = false;
					if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0)	cMem.working = true;

					// Harvest phase - collect energy
					if (!cMem.working) {
						// Priority 0: Check for any piles of energy within a few tiles of location, and use the closest
						const piles = pos.findInRange(FIND_DROPPED_RESOURCES, 3, { filter: { resourceType: RESOURCE_ENERGY } });
						if (piles.length) {
							const nearestPile = pos.findClosestByRange(piles);
							if (nearestPile)
								if (creep.pickup(nearestPile) === ERR_NOT_IN_RANGE)
									creep.advMoveTo(nearestPile, pathing.builderPathing);
						} else {
							const energySource = findEnergySource(creep);

							if (energySource) {
								const result = creep.withdraw(energySource, RESOURCE_ENERGY);
								if (result === ERR_NOT_IN_RANGE)
									creep.advMoveTo(energySource, pathing.builderPathing);
								else if (result === OK) {
									// Successfully withdrew - check if we should transition to working
									if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0)
										cMem.working = true;
								}
							}
							// On any other error, keep trying next tick
						}
					}
					// Build phase - construct or upgrade
					else {
						if (cMem.buildTarget) {
							const target: ConstructionSite | null = Game.getObjectById(cMem.buildTarget as Id<ConstructionSite>);
							if (target) {
								if (creep.build(target) === ERR_NOT_IN_RANGE) {
									creep.advMoveTo(target, pathing.builderPathing);
									return;
								}
							} else delete cMem.buildTarget;
						}
						const cSites = room.find(FIND_CONSTRUCTION_SITES);
						if (cSites.length > 0) {
							const nearestCSite = pos.findClosestByRange(cSites);
							if (nearestCSite) {
								cMem.buildTarget = nearestCSite.id;
								const result = creep.build(nearestCSite);
								if (result === ERR_NOT_IN_RANGE)
									creep.advMoveTo(nearestCSite, pathing.builderPathing);
								else if (result === ERR_NOT_ENOUGH_ENERGY)
									cMem.working = false;
								else if (result === OK)
									rMem.stats.constructionPoints += creep.getActiveBodyparts(WORK) * 5;
							}
						} else {
							// No construction sites - upgrade controller instead
							if (rMem?.containers?.controller) cMem.bucket ??= rMem.containers.controller;
							cMem.controller ??= room.controller?.id;
							upgraderBehavior(creep);
						}
					}
				}
			}
		} catch (e) {
			console.log(`Execution Error In Function: Builder.run(creep) on Tick ${Game.time}. Error: ${e}`);
		}
	},

	runremote: function (creep: Creep) {
		try {
			// Remote builder logic placeholder
		} catch (e) {
			console.log(`Execution Error In Function: Builder.runremote(creep) on Tick ${Game.time}. Error: ${e}`);
		}
	}
}

//profiler.registerObject(Builder, 'CreepBuilder');

export default Builder;
