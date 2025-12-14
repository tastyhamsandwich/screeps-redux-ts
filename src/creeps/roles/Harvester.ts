//const profiler = require('screeps-profiler');
import Events from '@modules/EventSystem';
import { aiAlert, navRallyPoint } from '../common';
import { pathing } from '@constants';

/**
 * A creep whose role it is to navigate to a source, harvest energy, and deposit it in the container next to it (usually built by the harvester itself). A source requires 5 WORK parts
 * in order to be fully utilized. Harvesters can forego CARRY parts if there is a container underneath them for them to "drop-harvest" onto, otherwise they need inventory space in order
 * to properly transfer energy to an adjacent container or object.
 */
const Harvester = {
	run: function (creep: Creep) {
		try {
			const room: Room = creep.room;
			const cMem: CreepMemory = creep.memory;
			const rMem: RoomMemory = Game.rooms[cMem.home].memory;
			const pos: RoomPosition = creep.pos;

			cMem.disable ??= false;
			cMem.rally ??= 'none';
			cMem.returnEnergy ??= false;
			if (!cMem.source) creep.assignHarvestSource('local', true, false);

			if (cMem.disable) aiAlert(creep);
			else if (cMem.rally !== 'none') navRallyPoint(creep);
			else {
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

				//: BOOTSTRAPPING RUINS RAIDER LOGIC
				if (isBootstrap && !cMem.noRuins) {
					const spawn = room.find(FIND_MY_SPAWNS);
					const ruins = room.find(FIND_RUINS, { filter: (i) => i.store[RESOURCE_ENERGY] > 0 });
					if (!ruins.length) cMem.noRuins = true;
					if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
						if (spawn[0].store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
							if (ruins.length) {
								const closest = pos.findClosestByRange(ruins);
								if (closest) {
									if (creep.withdraw(closest, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
										creep.advMoveTo(closest, pathing.harvesterPathing);

								}
							}
						} else {
							const result = creep.transfer(spawn[0], RESOURCE_ENERGY)
							if (result === ERR_NOT_IN_RANGE)
								creep.advMoveTo(spawn[0], pathing.harvesterPathing);
						}
					}
				}

				//: DROP HARVESTING LOGIC
				if (creep.getActiveBodyparts(CARRY) === 0) {
					if (cMem.inPosition)
						creep.harvestEnergy();
					else {
						if (cMem.bucket || room.containerOne || room.containerTwo) {
							const container: StructureContainer | null = Game.getObjectById(cMem.bucket as Id<StructureContainer>);
							const contPos = (cMem.sourceNum === 1) ? room.containerOne.pos : room.containerTwo.pos;
							if (container || contPos) {
								if (container && !pos.isEqualTo(container))
									creep.advMoveTo(container, pathing.harvesterPathing);
								else if (contPos && !pos.isEqualTo(contPos))
									creep.advMoveTo(contPos, pathing.harvesterPathing);
								else {
									cMem.inPosition = true;
									creep.harvestEnergy();
								}
							}
						} else if (source) {
							if (!pos.isNearTo(source))
								creep.advMoveTo(source, pathing.harvesterPathing);
							else
								cMem.inPosition = true;
						}
					}
				} else { //: STATIC HARVESTING LOGIC
					// If currently building a container, prioritize finishing it
					if (cMem.buildingContainer) {
						buildContainer(creep);
						return;
					}
					if (creep.store.getFreeCapacity() < (creep.getActiveBodyparts(WORK) * 2)) {
						//: INVENTORY IS FULL LOGIC
						if (cMem.returnEnergy === true) {
							//: RETURN ENERGY LOGIC
							const spawns = creep.room.find(FIND_MY_SPAWNS);
							if (spawns.length > 0) {
								if (creep.transfer(spawns[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
									creep.advMoveTo(spawns[0], pathing.harvesterPathing);
									return;
								}
							}
						} else if (isBootstrap) {
							//: BOOTSTRAP-SPECIFIC UNLOADING LOGIC
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
						} else {
							//: NORMAL UNLOADING LOGIC
							if (cMem.bucket && cMem.bucket !== 'none') {
								//: PRE-DEFINED CONTAINER FOR DUMPING
								creep.unloadEnergy(cMem.bucket);
								creep.harvestEnergy();
							}	else {
								//: LOCATE A CONTAINER FOR DUMPING
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
					} else {
						//: EMPTY INVENTORY (HARVESTING) LOGIC
						// Move to source before harvesting
						const source = Game.getObjectById(cMem.source) as Source;
						const containerID = (cMem.sourceNum === 1) ? room.memory.containers.sourceOne : room.memory.containers.sourceTwo;
						const container: StructureContainer | null = Game.getObjectById(containerID);
						if (!source) creep.say('No src!');
						else if (creep.getActiveBodyparts(WORK) === 5 && container && // Harvesters with 5 WORK parts must be on the container spot
							!pos.isEqualTo(container.pos)) creep.advMoveTo(container, pathing.harvesterPathing);
						else if (creep.getActiveBodyparts(WORK) < 5 && container && // Harvesters with less than 5 WORK parts can be next to it
							!pos.isNearTo(container.pos)) creep.advMoveTo(container, pathing.harvesterPathing);
						else if (!pos.isNearTo(source)) creep.advMoveTo(source, pathing.harvesterPathing);
						else creep.harvestEnergy();
					}
				}
			}
		} catch (e) {
			console.log(`Execution Error In Function: Harvester.run(${creep.name}) on Tick ${Game.time}. Error: ${e}`);
		}
	},

	runremote: (creep: Creep) => {
		try {
			const room: Room = creep.room;
			const cMem: CreepMemory = creep.memory;
			const rMem: RoomMemory = Game.rooms[cMem.home].memory;
			const pos: RoomPosition = creep.pos;
			const bucket: StructureContainer | null = cMem.bucket ? Game.getObjectById(cMem.bucket as Id<StructureContainer>) : null;
			const assignedSource: Source | null = cMem.source ? Game.getObjectById(cMem.source as Id<Source>) : null;
			const homeStorage: StructureStorage | undefined = Game.rooms[cMem.home]?.storage;

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

					if (creep.getActiveBodyparts(CARRY) === 0) {
						const source = assignedSource as Source;
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
						const bucketEnergy = bucket?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0;
						const bucketCapacity = bucket?.store.getCapacity(RESOURCE_ENERGY) ?? 2000;
						const bucketFull = bucketEnergy >= 2000;
						const bucketBelow75 = bucket ? bucketEnergy < (bucketCapacity * 0.75) : false;

						if (bucket && bucketFull && homeStorage) {
							if (!cMem.remoteRoadPath || !Array.isArray(cMem.remoteRoadPath) || !cMem.remoteRoadPath.length) {
								const roadSearch = PathFinder.search(bucket.pos, { pos: homeStorage.pos, range: 1 });
								cMem.remoteRoadPath = roadSearch.path.map((step) => ({ x: step.x, y: step.y, roomName: step.roomName }));
								cMem.remoteRoadIndex = 0;
							}
						}

						if (bucketBelow75) {
							cMem.remoteRoadBuilding = false;
							cMem.remoteRoadIndex = 0;
						}

						const hasRoadPath = Array.isArray(cMem.remoteRoadPath) && cMem.remoteRoadPath.length > 0;
						const readyForRoadWork = hasRoadPath && bucket && !bucketBelow75;

						if (readyForRoadWork && /*(cMem.remoteRoadBuilding ||*/ creep.store.getFreeCapacity() === 0)/* && creep.store[RESOURCE_ENERGY] > 0)*/ {
							cMem.remoteRoadBuilding = true;
							const path = cMem.remoteRoadPath as Array<{ x: number; y: number; roomName: string }>;
							let stepIndex = typeof cMem.remoteRoadIndex === 'number' ? cMem.remoteRoadIndex : 0;
							if (stepIndex >= path.length) stepIndex = path.length - 1;

							const targetStep = path[stepIndex];
							const targetPos = new RoomPosition(targetStep.x, targetStep.y, targetStep.roomName);

							if (!pos.isEqualTo(targetPos)) {
								creep.advMoveTo(targetPos, pathing.harvesterPathing, true);
								cMem.remoteRoadIndex = stepIndex;
								return;
							}

							const hasRoad = pos.lookFor(LOOK_STRUCTURES).some((s) => s.structureType === STRUCTURE_ROAD);
							const roadSite = pos.lookFor(LOOK_CONSTRUCTION_SITES).find((s) => s.structureType === STRUCTURE_ROAD);

							if (hasRoad) {
								if (stepIndex < path.length - 1) cMem.remoteRoadIndex = stepIndex + 1;
							} else if (roadSite) {
								creep.build(roadSite);
							} else {
								const created = creep.room.createConstructionSite(pos, STRUCTURE_ROAD);
								if (created === OK) {
									const newSite = pos.lookFor(LOOK_CONSTRUCTION_SITES).find((s) => s.structureType === STRUCTURE_ROAD);
									if (newSite) creep.build(newSite);
								}
								cMem.remoteRoadIndex = stepIndex; // stay on this tile until we at least start the road
							}

							const nextIndex = cMem.remoteRoadIndex ?? stepIndex;
							if (nextIndex > stepIndex && path[nextIndex]) {
								const nextPos = new RoomPosition(path[nextIndex].x, path[nextIndex].y, path[nextIndex].roomName);
								if (!pos.isEqualTo(nextPos)) creep.advMoveTo(nextPos, pathing.harvesterPathing, true);
							}
							return;
						}

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
									const containers: StructureContainer[] = assignedSource!.pos.findInRange(FIND_STRUCTURES, 1, { filter: (i) => i.structureType === STRUCTURE_CONTAINER }) as StructureContainer[];
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
							const source = assignedSource as Source;
							if (!source) {
								if (creep.room.name !== cMem.targetRoom) {
									const roomPos = new RoomPosition(25,25,cMem.targetRoom);
									creep.advMoveTo(roomPos, pathing.harvesterPathing, true);
								}
							} else if (!pos.isNearTo(source))
								creep.advMoveTo(source, pathing.harvesterPathing, true);
							else creep.harvestEnergy();
						}
					}
				} else navRallyPoint(creep);
			} else aiAlert(creep);
		} catch (e) {
			console.log(`Execution Error In Function: Harvester.runremote(${creep.name}) on Tick ${Game.time}. Error: ${e}`);
		}
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
		const nearbyContainers = source.pos.findInRange(FIND_STRUCTURES, 1, {
			filter: (s) => s.structureType === STRUCTURE_CONTAINER
		});

		if (nearbySites.length === 0 && nearbyContainers.length === 0) {
			// Find the best position next to the source (where the harvester should stand)
			const walkablePositions = source.pos.getWalkablePositions();
			if (walkablePositions.length > 0) {

				const pathBack = PathFinder.search((Game.getObjectById(room.memory.objects.spawns![0]) as StructureSpawn).pos, {pos: source.pos, range: 1});
				const path = pathBack.path;
				const pbLen = pathBack.path.length;
				if (walkablePositions.includes(path[pbLen-1])) {
					room.createConstructionSite(path[pbLen-1].x, path[pbLen-1].y, STRUCTURE_CONTAINER);
					cMem.buildingContainer = true;
					return;
				} else {
					// Place container at current position if we're next to source, otherwise pick first walkable spot
					const containerPos = path[pbLen - 1].isNearTo(source) ? path[pbLen - 1] : creep.pos;
					room.createConstructionSite(containerPos.x, containerPos.y, STRUCTURE_CONTAINER);
					// Mark that we're building a container to prevent task abandonment
					cMem.buildingContainer = true;
				}
			}
		} else {
			if (nearbyContainers.length > 0) {
				if (!cMem.bucket)
					cMem.bucket = nearbyContainers[0].id;
				delete cMem.buildingContainer;
				return;
			}
			// Build the container site
			const site = nearbySites[0];
			if (creep.build(site) === ERR_NOT_IN_RANGE) {
				creep.advMoveTo(site, pathing.harvesterPathing);
			} else if (site.progress >= site.progressTotal) {
				//Events.emit("containerComplete", { room: room.name, pos: creep.pos })
				creep.room.cacheObjects();
				Game.rooms[cMem.home].manager?.manageContainers();
				cMem.buildingContainer = false;
				creep.log(`Finished building container for source #${cMem.sourceNum}!`);
			}
		}
	}
}

//profiler.registerObject(Harvester, 'Harvester');

export default Harvester;
