import { aiAlert, navRallyPoint } from '../common';
import { pathing } from '@constants';
import * as CONSTANT from '@constants';

const Infantry = {
	run: (creep: Creep) => {
		try {
			const room: Room = creep.room;
			const cMem: CreepMemory = creep.memory;
			const rMem: RoomMemory = Game.rooms[cMem.home].memory;
			const pos: RoomPosition = creep.pos;

			cMem.disable ??= false;
			cMem.rally ??= 'none';

			if (!cMem.disable) {
				if (cMem.rally == 'none') {

					if (pos.x == 49) creep.move(LEFT);
					else if (pos.x == 0) creep.move(RIGHT);
					else if (pos.y == 49) creep.move(TOP);
					else if (pos.y == 0) creep.move(BOTTOM);

					const rangeParts = creep.getActiveBodyparts(RANGED_ATTACK);
					const meleeParts = creep.getActiveBodyparts(ATTACK);
					const healParts = creep.getActiveBodyparts(HEAL);

					if (creep.room.name !== cMem.targetRoom) {
						const travelPoint = new RoomPosition(25, 25, cMem.targetRoom);
						creep.advMoveTo(travelPoint, pathing.defenderPathing, true);
						return;
					}

					if (healParts)
						if (creep.hits < creep.hitsMax) creep.heal(creep);

					const hostiles = room.find(FIND_HOSTILE_CREEPS);
					if (hostiles.length || cMem.targetHostile) {
						const nearestHostile = (cMem.targetHostile) ? Game.getObjectById(cMem.targetHostile) as Creep : pos.findClosestByRange(hostiles);
						if (nearestHostile) {
							if (cMem.targetHostile !== nearestHostile.id)
								cMem.targetHostile = nearestHostile.id;

							if (rangeParts) {
								const distance = pos.getRangeTo(nearestHostile);

								// Always attack if in range
								if (distance <= CONSTANT.CREEP_RANGED_ATTACK_RANGE)
									creep.rangedAttack(nearestHostile);

								// Maintain distance
								if (distance > CONSTANT.CREEP_RANGED_ATTACK_RANGE)
									creep.advMoveTo(nearestHostile.pos, pathing.defenderPathing, true);
								else if (distance < CONSTANT.CREEP_RANGED_ATTACK_RANGE) {
									// Move away to maintain distance - try moving away, fallback to staying put and attacking
									const direction = pos.getDirectionTo(nearestHostile);
									const oppositeDir = ((direction > 4) ? direction - 4 : direction + 4) as DirectionConstant;

									// Try to move directly away from target
									const moveResult = creep.move(oppositeDir);
									// If movement fails (e.g., wall in the way), creep tries diagonal directions away from target, and then perpendicular moves
									if (moveResult !== OK) {
										// Wrap direction values to stay within 1-8: (((value - 1 + offset) % 8) + 8) % 8 + 1
										const diagDirOne = (((oppositeDir % 8) + 8) % 8) + 1 as DirectionConstant; // +1
										const diagDirTwo = (((oppositeDir - 2) % 8) + 8) % 8 + 1 as DirectionConstant; // -1
										const diagMoveOneResult = creep.move(diagDirOne);
										if (diagMoveOneResult !== OK) {
											const diagMoveTwoResult = creep.move(diagDirTwo);
											if (diagMoveTwoResult !== OK) {
												const perpDirOne = (((oppositeDir + 1) % 8) + 8) % 8 + 1 as DirectionConstant; // +2
												const perpDirTwo = (((oppositeDir - 3) % 8) + 8) % 8 + 1 as DirectionConstant; // -2
												const perpMoveOneResult = creep.move(perpDirOne);
												if (perpMoveOneResult !== OK) {
													const perpMoveTwoResult = creep.move(perpDirTwo);
													if (perpMoveTwoResult !== OK) {
														// Well we're just fucked now, aren't we?
														if (pos.isNearTo(nearestHostile)) creep.attack(nearestHostile);
														else creep.rangedAttack(nearestHostile);
													}
												}
											}
										}
									}
								}
							}
							if (meleeParts) {
								// Engage enemy at melee distance
								const distance = pos.getRangeTo(nearestHostile);

								// Attack if adjacent
								if (distance <= CONSTANT.CREEP_ACTION_RANGES.attack)
									creep.attack(nearestHostile);
								else
									creep.advMoveTo(nearestHostile.pos, pathing.defenderPathing, true);
							}
						}
					}
				}
			}
		} catch (e) {
			console.log(`Execution Error In Function: Infantry.run(creep) on Tick ${Game.time}. Error: ${e}`);
		}
	}
}

export default Infantry;
