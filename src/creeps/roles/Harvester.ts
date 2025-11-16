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

				const isBootstrap = creep.room.memory.flags.bootstrap;

				if (creep.getActiveBodyparts(CARRY) === 0) {
						const source: Source = Game.getObjectById(sourceID)!;
					if (!pos.isNearTo(source)) creep.advMoveTo(source, pathing.harvesterPathing);
					else {
						const containers: StructureContainer[] = source.pos.findInRange(FIND_STRUCTURES, 2, { filter: { structureType: STRUCTURE_CONTAINER } });
						if (containers.length) {
							const bucket = pos.findClosestByRange(containers);
							if (bucket) {
								if (cMem.bucket === undefined) cMem.bucket = bucket.id;
								if (!pos.isEqualTo(bucket))	creep.advMoveTo(bucket, pathing.harvesterPathing);
								else creep.harvestEnergy();
							}
						} else creep.harvestEnergy();
					}
				} else {
					if (creep.store.getFreeCapacity() == 0 || creep.store.getFreeCapacity() < (creep.getActiveBodyparts(WORK) * 2)) {
						if (cMem.returnEnergy === true) {
							const spawns = creep.room.find(FIND_MY_SPAWNS);
							if (spawns.length > 0) {
								if (creep.transfer(spawns[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
									creep.advMoveTo(spawns[0], pathing.harvesterPathing);
									return;
								}
							}
						} else {
							if (isBootstrap) {
								// Count harvesters in the room
								const harvesterCount = creep.room.find(FIND_MY_CREEPS, {
									filter: (c) => c.memory.role === 'harvester' && c.memory.home === creep.room.name
								}).length;

								// Once we have 4+ harvesters, focus on building containers
								if (harvesterCount >= 4) {
									buildContainer(creep);
									return;
								}

								// Otherwise, haul energy to spawn/extensions
								const spawn: StructureSpawn | StructureExtension | null = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
									filter: (s) =>
										(s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
										s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
								});
								if (spawn) {
									if (creep.transfer(spawn, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
										creep.advMoveTo(spawn, pathing.harvesterPathing);
									}
								} else buildContainer(creep);
								return;
							}
							if (cMem.bucket) {
								creep.unloadEnergy(cMem.bucket);
								creep.harvestEnergy();
							}	else {
								const containers: StructureContainer[] = pos.findInRange(FIND_STRUCTURES, 1, { filter: (i) => i.structureType === STRUCTURE_CONTAINER }) as StructureContainer[];
								if (containers.length) {
									console.log(`Found container`);
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
						// Move to source before harvesting
						const source = Game.getObjectById(cMem.source) as Source;
						if (!source) creep.say('No src!');
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
						Game.rooms[cMem.home].memory.outposts.numHarvesters--;
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
	const source = Game.getObjectById(creep.memory.source) as Source;

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
				// Place container at current position if we're next to source, otherwise pick first walkable spot
				const containerPos = pos.isNearTo(source) ? pos : walkablePositions[0];
				room.createConstructionSite(containerPos.x, containerPos.y, STRUCTURE_CONTAINER);
			}
		} else {
			// Build the container site
			const site = nearbySites[0];
			if (creep.build(site) === ERR_NOT_IN_RANGE) {
				creep.advMoveTo(site, pathing.harvesterPathing);
			}
		}
	}
}
export default Harvester;
