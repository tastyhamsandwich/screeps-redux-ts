//const profiler = require('screeps-profiler');

import { aiAlert, navRallyPoint } from '../common';
import { pathing } from '@constants';

/**
 * A creep whose role it is to navigate to a source, harvest energy, and deposit it in the container next to it (usually built by the harvester itself). A source requires 5 WORK parts
 * in order to be fully utilized. Harvesters can forego CARRY parts if there is a container underneath them for them to "drop-harvest" onto, otherwise they need inventory space in order
 * to properly transfer energy to an adjacent container or object.
 */
const Harvester = {
	run: function (creep: Creep) {

		const room: Room = creep.room;
		const cMem: CreepMemory = creep.memory;
		const rMem: RoomMemory = Game.rooms[cMem.home].memory;
		const pos: RoomPosition = creep.pos;

		cMem.disable ??= false;
		cMem.rally ??= 'none';
		cMem.returnEnergy ??= false;
		if (!cMem.source) creep.assignHarvestSource('local', true, false);

		if (!cMem.disable) {
			if (cMem.rally == 'none') {

				if (pos.x == 49) creep.move(LEFT);
				else if (pos.x == 0) creep.move(RIGHT);
				else if (pos.y == 49) creep.move(TOP);
				else if (pos.y == 0) creep.move(BOTTOM);

				if (creep.ticksToLive! <= 2) {
					creep.unloadEnergy();
					creep.say('☠️');
				}

				const sourceID: Id<Source> = cMem.source;
				const isBootstrap = creep.room.memory.data.flags.bootstrappingMode;
				const source: Source = Game.getObjectById(sourceID)!;
				const container: StructureContainer | null = Game.getObjectById(cMem.bucket as Id<StructureContainer>);
				const contPos = (cMem.sourceNum === 1) ? room.containerOne.pos : room.containerTwo.pos;

				//: DROP HARVESTING LOGIC
				if (creep.getActiveBodyparts(CARRY) === 0) {
					if (cMem.inPosition)
						creep.harvestEnergy();
					else {
						if (container || contPos) {
							if (container && !pos.isEqualTo(container))
								creep.advMoveTo(container, pathing.harvesterPathing);
							else if (contPos && !pos.isEqualTo(contPos))
								creep.advMoveTo(contPos, pathing.harvesterPathing);
							else {
								cMem.inPosition = true;
								creep.harvestEnergy();
							}
						} else if (source) {
							if (!pos.isNearTo(source))
								creep.advMoveTo(source, pathing.harvesterPathing);
							else
								cMem.inPosition = true;
						}
					}
				//: STATIC HARVESTING LOGIC
				} else {
					// If currently building a container, prioritize finishing it
					if (cMem.buildingContainer) {
						buildContainer(creep);
						return;
					}

					//: INVENTORY IS FULL LOGIC
					if (creep.store.getFreeCapacity() < (creep.getActiveBodyparts(WORK) * 2)) {
						//: RETURN ENERGY LOGIC
						if (cMem.returnEnergy === true) {
							const spawns = creep.room.find(FIND_MY_SPAWNS);
							if (spawns.length > 0) {
								if (creep.transfer(spawns[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
									creep.advMoveTo(spawns[0], pathing.harvesterPathing);
									return;
								}
							}
						//: BOOTSTRAP-SPECIFIC UNLOADING LOGIC
						} else if (isBootstrap) {
							// During bootstrap, check if fillers exist
							const fillers = creep.room.find(FIND_MY_CREEPS, {
								filter: (c) => c.memory.role === 'filler' && c.memory.home === creep.room.name
							}).length >= 1;
							// If no fillers, return energy to spawn for early growth
							if (!fillers) {
								const spawns = creep.room.find(FIND_MY_SPAWNS);
								if (spawns.length > 0) {
									if (creep.transfer(spawns[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
										creep.advMoveTo(spawns[0], pathing.harvesterPathing);
										return;
									}
								}
							} else {
								// Fillers exist, prioritize building containers and unloading to them
								if (cMem.bucket && cMem.bucket !== 'none') {
									creep.unloadEnergy(cMem.bucket);
									creep.harvestEnergy();
								} else {
									const containers: StructureContainer[] = pos.findInRange(FIND_STRUCTURES, 1, { filter: (i) => i.structureType === STRUCTURE_CONTAINER }) as StructureContainer[];
									if (containers.length) {
										const target: StructureContainer = pos.findClosestByRange(containers)!;
										if (target) {
											cMem.bucket = target.id;
											if (!pos.isEqualTo(target)) creep.advMoveTo(target, pathing.harvesterPathing);
											else if (target.hits < target.hitsMax) creep.repair(target);
											else {
												creep.unloadEnergy();
												creep.harvestEnergy();
											}
										}
									} else buildContainer(creep);
								}
							}
						//: NORMAL UNLOADING LOGIC
						} else {
							//: PRE-DEFINED CONTAINER FOR DUMPING
							if (cMem.bucket && cMem.bucket !== 'none') {
								creep.unloadEnergy(cMem.bucket);
								creep.harvestEnergy();
							//: LOCATE A CONTAINER FOR DUMPING
							}	else {
								const containers: StructureContainer[] = pos.findInRange(FIND_STRUCTURES, 1, { filter: (i) => i.structureType === STRUCTURE_CONTAINER }) as StructureContainer[];
								if (containers.length) {
									const target: StructureContainer = pos.findClosestByRange(containers)!;
									if (target) {
										cMem.bucket = target.id;
										if (!pos.isEqualTo(target)) creep.advMoveTo(target, pathing.harvesterPathing);
										else if (target.hits < target.hitsMax) creep.repair(target);
										else {
											creep.unloadEnergy();
											creep.harvestEnergy();
										}
									}
								} else buildContainer(creep);
							}
						}
					//: EMPTY INVENTORY (HARVESTING) LOGIC
					} else {
						// Move to source before harvesting
						const source = Game.getObjectById(cMem.source) as Source;
						const containerID = (cMem.sourceNum === 1) ? room.memory.containers.sourceOne : room.memory.containers.sourceTwo;
						const container: StructureContainer | null = Game.getObjectById(containerID);
						if (!source) creep.say('No src!');
						else if (container && !pos.isEqualTo(container.pos)) creep.advMoveTo(container, pathing.harvesterPathing);
						else if (!pos.isNearTo(source)) creep.advMoveTo(source, pathing.harvesterPathing);
						else creep.harvestEnergy();
					}
				}
			} else navRallyPoint(creep);
		} else aiAlert(creep);
	},

	runremote: (creep: Creep) => {
		const room: Room = creep.room;
		const cMem: CreepMemory = creep.memory;
		const rMem: RoomMemory = Game.rooms[cMem.home].memory;
		const pos: RoomPosition = creep.pos;

		cMem.disable ??= false;
		cMem.rally ??= 'none';
		cMem.returnEnergy ??= false;
		cMem.haveCalledDeathAction ??= false;
		if (!cMem.source) creep.assignHarvestSource('remote', true, false);

		if (!cMem.disable) {
			if (cMem.rally == 'none') {
				if (pos.x == 49) creep.move(LEFT);
				else if (pos.x == 0) creep.move(RIGHT);
				else if (pos.y == 49) creep.move(TOP);
				else if (pos.y == 0) creep.move(BOTTOM);

				if (creep.ticksToLive! <= 2) {
					creep.unloadEnergy();
					creep.say('☠️');
					if (cMem.haveCalledDeathAction === false) {
						cMem.haveCalledDeathAction = true;
					}
				}

				let source: Source;
				if (creep.getActiveBodyparts(CARRY) === 0) {
					source = Game.getObjectById(cMem.source) as unknown as Source;
					if (!pos.isNearTo(source)) creep.advMoveTo(source, pathing.harvesterPathing, true);
					else {
						const containers: StructureContainer[] = source.pos.findInRange(FIND_STRUCTURES, 2, { filter: { structureType: STRUCTURE_CONTAINER } });
						if (containers.length) {
							const bucket = pos.findClosestByRange(containers);
							if (bucket) {
								cMem.bucket ??= bucket.id;
								if (!pos.isEqualTo(bucket))	creep.advMoveTo(bucket, pathing.harvesterPathing, true);
								else creep.harvestEnergy();
							}
						} else creep.harvestEnergy();
					}
				} else {
					if (creep.store.getFreeCapacity() == 0 || creep.store.getFreeCapacity() < (creep.getActiveBodyparts(WORK) * 2)) {
						if (cMem.returnEnergy === true) {
							const spawns = creep.room.find(FIND_MY_SPAWNS);
							if (spawns.length > 0) {
								if (creep.transfer(spawns[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
									creep.advMoveTo(spawns[0], pathing.harvesterPathing, true);
							}
						} else {
							if (cMem.bucket) creep.unloadEnergy(cMem.bucket);
							else {
								const containers: StructureContainer[] = pos.findInRange(FIND_STRUCTURES, 1, { filter: (i) => i.structureType === STRUCTURE_CONTAINER }) as StructureContainer[];
								if (containers.length) {
									console.log(`Found container)`);
									const target: StructureContainer = pos.findClosestByRange(containers)!;
									if (target) {
										cMem.bucket = target.id;
										if (!pos.isEqualTo(target)) creep.advMoveTo(target, pathing.harvesterPathing, true);
										else if (target.hits < target.hitsMax) creep.repair(target);
										else {
											creep.unloadEnergy();
											creep.harvestEnergy();
										}
									}
								} else {
									const nearbySites = pos.findInRange(FIND_CONSTRUCTION_SITES, 2);
									if (nearbySites.length == 0) room.createConstructionSite(pos.x, pos.y, STRUCTURE_CONTAINER);
									else {
										const buildersNearby = room.find(FIND_MY_CREEPS, { filter: (i) => i.memory.role == 'remotebuilder' || i.memory.role == 'builder' });
										if (buildersNearby.length > 0) {
											const mySite = pos.findInRange(FIND_CONSTRUCTION_SITES, 1);
											if (mySite.length) creep.build(mySite[0]);
											else {
												creep.unloadEnergy();
												creep.harvestEnergy();
											}
										} else creep.build(nearbySites[0]);
									}
								}
							}
						}
					} else {
						// Move to source before harvesting
						source = Game.getObjectById(cMem.source) as Source;
						if (!source) {
							creep.say('No src!');
						} else if (!pos.isNearTo(source)) {
							creep.advMoveTo(source, pathing.harvesterPathing, true);
						} else {
							creep.harvestEnergy();
						}
					}
				}
			} else navRallyPoint(creep);
		} else aiAlert(creep);
	}
}

function buildContainer(creep: Creep): void {
	const room = creep.room;
	const pos = creep.pos;
	const cMem = creep.memory;
	const source = Game.getObjectById(cMem.source) as Source;

	// Find best position next to source for container
	if (source) {
		// Move next to source if not already there
		if (!pos.isNearTo(source)) {
			creep.advMoveTo(source, pathing.harvesterPathing);
			return;
		}

		// Check for existing container construction site near source
		const nearbySites = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, {
			filter: (s) => s.structureType === STRUCTURE_CONTAINER
		});

		if (nearbySites.length === 0) {
			// Find the best position next to the source (where the harvester should stand)
			const walkablePositions = source.pos.getWalkablePositions();
			if (walkablePositions.length > 0) {

				const pathBack = PathFinder.search(source.pos, (Game.getObjectById(room.memory.objects.spawns[0]) as StructureSpawn).pos);
				if (walkablePositions.includes(pathBack[0])) {
					const containerPos = pathBack[0].pos.isNearTo(source) ? pathBack[1].pos : pathBack[0].pos;
					room.createConstructionSite(containerPos.x, containerPos.y, STRUCTURE_CONTAINER);
					cMem.buildingContainer = true;
					return;
				}
				// Place container at current position if we're next to source, otherwise pick first walkable spot
				const containerPos = pos.isNearTo(source) ? pos : walkablePositions[0];
				room.createConstructionSite(containerPos.x, containerPos.y, STRUCTURE_CONTAINER);
				// Mark that we're building a container to prevent task abandonment
				cMem.buildingContainer = true;
			}
		} else {
			// Build the container site
			const site = nearbySites[0];
			if (creep.build(site) === ERR_NOT_IN_RANGE) {
				creep.advMoveTo(site, pathing.harvesterPathing);
			} else if (site.progress >= site.progressTotal) {
				// Container is complete, clear the flag
				cMem.buildingContainer = false;
			}
		}
	}
}

//profiler.registerObject(Harvester, 'Harvester');

export default Harvester;
