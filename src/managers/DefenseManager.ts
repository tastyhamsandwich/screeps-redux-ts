"use strict";
import { getExitBounds, type BoundingBox } from '@funcs/room/utils';
import { getReturnCode } from '@globals';
import { get, inRange } from 'lodash';

const DefenseManager = {
	run: (room: Room) => {
		try {

			// Ensure there are towers cached in the room
			if (!room.memory.objects.towers) {
				room.cacheObjects();
				// If still no towers cached, there are none, so return
				if (!room.memory.objects.towers)
					return;
			}
			const towers: StructureTower[] = room.memory.objects.towers.map(tower => Game.getObjectById(tower)!);
			const towerSettings = room.memory.settings.repairSettings.towerSettings;
			// Still no towers? RETURN, MAN, RETURN!
			if (!towers.length) return;

			// Create a set of bounding boxes that define regions encompassing each exit
			// area of the room borders (to prevent wasted energy on peek-a-boo baiting)
			const exits = Object.keys(Game.map.describeExits(room.name));
			const exitBoundingBoxes: Array<BoundingBox | null> = [];
			if (exits.includes('1')) { // North exit
				const northernBoundingBoxes = getExitBounds(room.find(FIND_EXIT_TOP));
				exitBoundingBoxes.push(northernBoundingBoxes);
			}
			if (exits.includes('3')) { // East exit
				const easternBoundingBoxes = getExitBounds(room.find(FIND_EXIT_RIGHT));
				exitBoundingBoxes.push(easternBoundingBoxes);
			}
			if (exits.includes('5')) { // South exit
				const southernBoundingBoxes = getExitBounds(room.find(FIND_EXIT_BOTTOM));
				exitBoundingBoxes.push(southernBoundingBoxes);
			}
			if (exits.includes('7')) { // West exit
				const westernBoundingBoxes = getExitBounds(room.find(FIND_EXIT_LEFT));
				exitBoundingBoxes.push(westernBoundingBoxes);
			}

			// Get all hostile creeps in the room
			const allHostiles: Creep[] = room.find(FIND_HOSTILE_CREEPS);

			// Filter out hostiles that are within exit bounds
			const hostilesInRoom: Creep[] = allHostiles.filter(creep => {
				// Check if the creep is inside any of the bounding boxes (with padding)
				for (const box of exitBoundingBoxes) {
					if (box === null) continue;

					// Pad the bounding box by 2 tiles (move inward from exits)
					const paddedMinX = box.minX + 2;
					const paddedMaxX = box.maxX - 2;
					const paddedMinY = box.minY + 2;
					const paddedMaxY = box.maxY - 2;

					// If creep is inside this padded box, exclude it
					if (creep.pos.x >= paddedMinX && creep.pos.x <= paddedMaxX &&
						creep.pos.y >= paddedMinY && creep.pos.y <= paddedMaxY) {
						return false; // Exclude this creep
					}
				}
				return true; // Keep this creep
			});

			// If hostiles are found, filter into NPC Creeps and Player Creeps arrays
			if (hostilesInRoom.length) {
				const invaderHostiles = hostilesInRoom.filter((i) => i.owner.username === 'Invader');
				const playerHostiles = hostilesInRoom.filter((i) => i.owner.username !== 'Invader' && i.owner.username !== 'Source Keeper');

				// Make an array listing the usernames who control player-owned Creeps
				const enemyPlayerList: string[] = [];
				if (playerHostiles.length) {
					for (const hostile of playerHostiles) {
						if (!enemyPlayerList.includes(hostile.owner.username))
							enemyPlayerList.push(hostile.owner.username);
					}

					// Post the owners to console and room overlay
					// Generate string of enemy player names
					let enemyPlayerString = '';
					if (enemyPlayerList.length >= 1)
						enemyPlayerString = enemyPlayerList[0];
					if (enemyPlayerList.length > 1) {
						for (let i = 1; i < enemyPlayerList.length; i++)
							enemyPlayerString += `, ${enemyPlayerList[i]}`;
					}
					// Log it and display it
					room.log(`Enemy Hostiles Present! Owners: ` + enemyPlayerString, true);
					Game.map.visual.rect(new RoomPosition(1, 1, room.name), 11, 11,
						{ fill: 'transparent', stroke: '#ff0000' });
					Game.map.visual.text(enemyPlayerString, new RoomPosition(11.1, 11.1, room.name),
						{ align: 'left', color: '#cccccc', stroke: '#000000', strokeWidth: 0.1 });

					// Engage enemy players with available towers
					// TODO Expand targeting logic to discern specific creep types (i.e. healers) and prioritize targeting
					for (const tower of towers) {
						const maxRange = towerSettings.maxRange ?? 20;
						const inRangeHostiles = tower.pos.findInRange(playerHostiles, maxRange);
						if  (inRangeHostiles.length) {
							const closestInRangeHostile = tower.pos.findClosestByRange(inRangeHostiles);
							if (closestInRangeHostile) {
								const result = tower.attack(closestInRangeHostile);
								if (result === ERR_NOT_ENOUGH_ENERGY)
									room.log(`Tower at position x${tower.pos.x},y${tower.pos.y} does not have enough energy to engage ${closestInRangeHostile.owner.username}'s creep!`, true);
								break;
							}
						}
					}
					return;
				}

				// If Invader (NPC) creeps are present in room, announce and engage
				if (invaderHostiles.length) {
					room.log(`WARNING! ${invaderHostiles.length} Invader Creeps have been sighted, available towers are engaging!`, true);
					for (const tower of towers) {
						const maxRange = room.memory.settings.repairSettings.towerSettings.maxRange ?? 20;
						const inRangeInvaders = tower.pos.findInRange(invaderHostiles, maxRange);
						if (inRangeInvaders.length) {
							const closestInRangeInvader = tower.pos.findClosestByRange(inRangeInvaders);
							if (closestInRangeInvader) {
								const result = tower.attack(closestInRangeInvader);
								if (result === ERR_NOT_ENOUGH_ENERGY)
									room.log(`Tower at position x${tower.pos.x},y${tower.pos.y} does not have enough energy to engage Invaders!`, true);
								break;
							}
						}
					}
					return;
				}
			}

			// If there are no NPC invaders to deal with,
			// heal & repair according to room settings

			// If towers are allowed to heal hurt friendly Creeps
			if (towerSettings.creeps) {
				const damagedCreeps: Creep[] = room.find(FIND_MY_CREEPS, { filter: (i) => i.hits < i.hitsMax });
				if (damagedCreeps.length) {
					const towerMinEnergy = 350;
					for (const tower of towers) {
						// No healing if towers are under their minimum energy limit, in case of emergencies
						if (tower.store.getUsedCapacity(RESOURCE_ENERGY) <= 350) continue;

						const creepsInRange = tower.pos.findInRange(damagedCreeps, towerSettings.maxRange)
						console.log(creepsInRange);
						if (creepsInRange) {
							creepsInRange.sort((a, b) => a.hits - b.hits);
							const result = tower.heal(creepsInRange[0]);
							if (result === ERR_NOT_ENOUGH_ENERGY)
								room.log(`Tower at position x${tower.pos.x},y${tower.pos.y} lacks the energy to heal Creep '${creepsInRange[0].name}'`);
							if (result === OK)
								room.log(`Tower at position x${tower.pos.x},y${tower.pos.y} healing Creep '${creepsInRange[0].name}'`);
							break;
						}
					}
				}
				return;
			}

			// Otherwise, compile an array of damaged structures which
			// are whitelisted for turrets to perform repairs on
			let validTargets: AnyStructure[] = [];

			// Repair limit for walls and ramparts, expressed as a percentage of max health (10 = 10%)
			const rampartsMax: number = room.memory.settings.repairSettings.towerSettings.rampartLimit;
			const wallsMax: number = room.memory.settings.repairSettings.towerSettings.wallLimit;


			if (towerSettings.roads) { // Search for damaed roads
				const targets: StructureRoad[] = room.find(FIND_STRUCTURES, {
					filter: (i) => i.hits < i.hitsMax && i.structureType == STRUCTURE_ROAD });
				validTargets = validTargets.concat(targets);
			}
			if (towerSettings.others) { // Search for damaged anything that's not a road/wall/rampart
				const targets: AnyStructure[] = room.find(FIND_STRUCTURES, {
					filter: (i) => ((i.hits < i.hitsMax) && (i.structureType !== STRUCTURE_ROAD && i.structureType !== STRUCTURE_RAMPART && i.structureType !== STRUCTURE_WALL ))});
				validTargets = validTargets.concat(targets);
			}
			if (towerSettings.ramparts) { // Search for ramparts udner the rampart repair limit
				const ramparts = room.find(FIND_MY_STRUCTURES, {
					filter: (i) => (((i.hits / i.hitsMax) * 100) < rampartsMax) && i.structureType === STRUCTURE_RAMPART });
				validTargets = validTargets.concat(ramparts);
			}
			if (towerSettings.walls) { // Search for walls under the wall repair limit
				const walls = room.find(FIND_STRUCTURES, {
					filter: (i) => (((i.hits / i.hitsMax) * 100) < wallsMax) && i.structureType === STRUCTURE_WALL });
				validTargets = validTargets.concat(walls);
			}

			// Assuming there are structures that fit repair criteria, get repairin'
			if (validTargets.length) {
				const towerMinEnergy = 350; // No repairing if under 350 energy

				for (const tower of towers) {
					// If tower is low on energy, do not spend it on repairing structures in case of emergency
					if (tower.store.getUsedCapacity(RESOURCE_ENERGY) <= towerMinEnergy) continue;

					// Determine which structures are within max range setting of tower
					const inRangeTargets: AnyStructure[] = tower.pos.findInRange(validTargets, towerSettings.maxRange);

					// Sort those structures in order of most damage to least damaged
					if (inRangeTargets.length) {
						inRangeTargets.sort((a, b) => {
							const aUnder1000 = a.hits < 1000;
							const bUnder1000 = b.hits < 1000;

							// If only one is under 1000, prioritize it
							if (aUnder1000 && !bUnder1000) return -1;
							if (!aUnder1000 && bUnder1000) return 1;

							// Both under 1000 or both above: sort descending by value
							return (b.hits / b.hitsMax) - (a.hits / a.hitsMax);
						});

						// Select final target candidate and repair it

						const target: AnyStructure | null = tower.pos.findClosestByRange(inRangeTargets);
						if (target) {
							const result = tower.repair(target);
							if (result !== OK)
								room.log(`Tower at position x${tower.pos.x},y${tower.pos.y} encountered error when repairing ${target}: ${getReturnCode(result)}`);
						}
					}
				}
				return;
			}
		} catch (e) {
			console.log(`Execution Error In Function: DefenseManager(${room.name}) on Tick ${Game.time}. Error: ${e}`);
		}
	}
}

export default DefenseManager;
