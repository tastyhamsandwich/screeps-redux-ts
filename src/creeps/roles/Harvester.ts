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

				let source: Source;

				const isBootstrap = creep.room.memory.flags.bootstrap;

				if (creep.getActiveBodyparts(CARRY) === 0) {
					source = Game.getObjectById(cMem.source) as unknown as Source;
					if (!pos.isNearTo(source)) creep.moveTo(source, pathing.harvesterPathing);
					else {
						const containers: StructureContainer[] = source.pos.findInRange(FIND_STRUCTURES, 2, { filter: { structureType: STRUCTURE_CONTAINER } });
						if (containers.length) {
							const bucket = pos.findClosestByRange(containers);
							if (bucket) {
								if (cMem.bucket === undefined) cMem.bucket = bucket.id;
								if (!pos.isEqualTo(bucket))	creep.moveTo(bucket, pathing.harvesterPathing);
								else creep.harvestEnergy();
							}
						} else creep.harvestEnergy();
					}
				} else {
					if (creep.store.getFreeCapacity() == 0 || creep.store.getFreeCapacity() < (creep.getActiveBodyparts(WORK) * 2)) {
						if (cMem.returnEnergy === true) {
							if (creep.transfer(Game.spawns['Spawn1'], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
								creep.moveTo(Game.spawns['Spawn1'], pathing.harvesterPathing);
								return;
							}
						} else {
							if (isBootstrap) {
								const spawn = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
									filter: (s) =>
										(s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
										s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
								});
								if (spawn) {
									(creep.transfer(spawn, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
									creep.moveTo(spawn, pathing.harvesterPathing);
								}
								return;
							}
							if (cMem.bucket) creep.unloadEnergy(cMem.bucket);
							else {
								const containers: StructureContainer[] = pos.findInRange(FIND_STRUCTURES, 3, { filter: (i) => { i.structureType === STRUCTURE_CONTAINER } });
								if (containers.length) {
									const target: StructureContainer = pos.findClosestByRange(containers)!;
									if (target) {
										cMem.bucket = target.id;
										if (!pos.isEqualTo(target)) creep.moveTo(target, pathing.harvesterPathing);
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
					} else creep.harvestEnergy();
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
					if (!pos.isNearTo(source)) creep.advMoveTo(source, true, pathing.harvesterPathing);
					else {
						const containers: StructureContainer[] = source.pos.findInRange(FIND_STRUCTURES, 2, { filter: { structureType: STRUCTURE_CONTAINER } });
						if (containers.length) {
							const bucket = pos.findClosestByRange(containers);
							if (bucket) {
								cMem.bucket ??= bucket.id;
								if (!pos.isEqualTo(bucket))	creep.advMoveTo(bucket, true, pathing.harvesterPathing);
								else creep.harvestEnergy();
							}
						} else creep.harvestEnergy();
					}
				} else {
					if (creep.store.getFreeCapacity() == 0 || creep.store.getFreeCapacity() < (creep.getActiveBodyparts(WORK) * 2)) {
						if (cMem.returnEnergy === true) {
							if (creep.transfer(Game.spawns['Spawn1'], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
								creep.advMoveTo(Game.spawns['Spawn1'], true, pathing.harvesterPathing);
						} else {
							if (cMem.bucket) creep.unloadEnergy(cMem.bucket);
							else {
								const containers: StructureContainer[] = pos.findInRange(FIND_STRUCTURES, 3, { filter: (i) => { i.structureType === STRUCTURE_CONTAINER } });
								if (containers.length) {
									const target: StructureContainer = pos.findClosestByRange(containers)!;
									if (target) {
										cMem.bucket = target.id;
										if (!pos.isEqualTo(target)) creep.advMoveTo(target, true, pathing.harvesterPathing);
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
					} else creep.harvestEnergy();
				}
			} else navRallyPoint(creep);
		} else aiAlert(creep);
	}
}

export default Harvester;
