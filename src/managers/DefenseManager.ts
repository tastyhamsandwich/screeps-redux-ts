//const profiler = require('screeps-profiler');

export default function DefenseManager(tower: StructureTower) {
	const room = tower.room;

	if (tower) {
		const topLeft = new RoomPosition(tower.pos.x - 5, tower.pos.y - 5, room.name); // RoomPos for visual overlay
		// Find hostile creeps that have advanced beyond the edge of the room borders (to prevent wasted energy on peek-a-boo bait attacks)
		const hostilesInRoom: Creep[] = tower.room.find(FIND_HOSTILE_CREEPS, { filter: (i) => ((i.pos.x <= 5 && i.pos.y >= 4) || (i.pos.x >= 4 && i.pos.y <= 5)) && i.owner.username !== 'Invader' });

		if (hostilesInRoom.length) {

			// If we have hostiles present within the borders, post the owner to console and room overlay
			console.log(tower.room.link() + 'Owner Name: ' + hostilesInRoom[0].owner.username + ' | ' + hostilesInRoom);
			Game.map.visual.rect(topLeft, 11, 11, { fill: 'transparent', stroke: '#ff0000' });

			// Filter hostile creeps for military targets - those with ATTACK, RANGED_ATTACK, and WORK parts
			const attackHostiles = hostilesInRoom.filter(
				(creep) => {
					if (creep.getActiveBodyparts(ATTACK) > 0 || creep.getActiveBodyparts(RANGED_ATTACK) > 0 || creep.getActiveBodyparts(WORK) > 0) return creep;
					return false;
				});

			// Also create a list of hostiles with HEAL parts - fuckin' medics!
			const healHostiles = hostilesInRoom.filter(
				(creep) => {
					if (creep.getActiveBodyparts(HEAL) > 0) return creep;
					return false;
				});

			if (healHostiles.length) {

				// If we detect healer hostiles, post advisory in console
				console.log(tower.room.link() + 'Healer Hostiles: ' + healHostiles);
				const closestHealer = tower.pos.findClosestByRange(healHostiles);

				// Attack the nearest healer first
				if (closestHealer) {
					tower.attack(closestHealer);
					return;
				}
			}
			if (attackHostiles.length) {

				// If no more / no healers, print advisory to console regarding standard hostiles
				console.log(tower.room.link() + 'Attack Hostiles: ' + attackHostiles);
				const closestAttacker = tower.pos.findClosestByRange(attackHostiles);

				// Engage hostiles
				if (closestAttacker) {
					tower.attack(closestAttacker);
					return;
				}
			}
		}

		// If no player-owned hostiles, search for NPC invader creeps to engage
		const invaderHostiles = tower.room.find(FIND_HOSTILE_CREEPS, { filter: (i) => i.owner.username === 'Invader' });
		if (invaderHostiles.length) {

			// If we find NPC invaders, print advisory and draw overlay
			console.log(invaderHostiles[0].owner.username + ' | ' + invaderHostiles);
			Game.map.visual.rect(topLeft, 11, 11, { fill: 'transparent', stroke: '#ff0000' });

			const closestInvader = tower.pos.findClosestByRange(invaderHostiles);

			// Find nearest NPC invader and engage
			if (closestInvader) {
				tower.attack(closestInvader);
				return;
			}
			return;
		}

		// If no NPC invaders to deal with, check room settings for heal/repair settings and provide services if allowed
		const towerSettings = tower.room.memory.settings.repairSettings.towerSettings;
		if (towerSettings.creeps) {
			const damagedCreeps: Creep[] = tower.room.find(FIND_MY_CREEPS, { filter:  (i) => { i.hits < i.hitsMax }});
			if (damagedCreeps.length) {
				const creepsInRange = tower.pos.findInRange(damagedCreeps, towerSettings.maxRange)
				if (creepsInRange) {
					creepsInRange.sort((a, b) => b.hits - a.hits);
					tower.heal(creepsInRange[0]);
					return;
				}
			}
		}

		let ramparts: Array<StructureRampart> = [];
		let walls: Array<StructureWall> = [];
		let validTargets: Array<AnyStructure> = [];

		const rampartsMax: number = tower.room.memory.settings.repairSettings.towerSettings.rampartLimit;
		const wallsMax: number = tower.room.memory.settings.repairSettings.towerSettings.wallLimit;

		// search for roads, spawns, extensions, or towers under 95%
		if (towerSettings.roads) {
			let targets: Array<AnyStructure> = tower.room.find(FIND_STRUCTURES, {
				filter: (i) => (i.hits < (i.hitsMax * 0.95)) && (i.structureType == STRUCTURE_ROAD) });
			validTargets = validTargets.concat(targets);
		}
		if (towerSettings.others) {
			let targets: Array<AnyStructure> = tower.room.find(FIND_STRUCTURES, {
				filter: (i) => (i.hits / i.hitsMax <= 0.95) &&
					(i.structureType == STRUCTURE_TOWER || i.structureType == STRUCTURE_SPAWN || i.structureType == STRUCTURE_EXTENSION || i.structureType == STRUCTURE_CONTAINER || i.structureType == STRUCTURE_EXTRACTOR || i.structureType == STRUCTURE_LAB || i.structureType == STRUCTURE_LINK || i.structureType == STRUCTURE_STORAGE || i.structureType == STRUCTURE_TERMINAL) });
			validTargets = validTargets.concat(targets);
		}
		if (towerSettings.ramparts) {
			ramparts = tower.room.find(FIND_STRUCTURES, {
				filter: (i) => (((i.hits / i.hitsMax * 100) <= rampartsMax) && (i.structureType == STRUCTURE_RAMPART)) });
			validTargets = validTargets.concat(ramparts);
		}
		if (towerSettings.walls) {
			walls = tower.room.find(FIND_STRUCTURES, {
				filter: (i) => (i.structureType == STRUCTURE_WALL && ((i.hits / i.hitsMax * 100) <= wallsMax)) })
			validTargets = validTargets.concat(walls);
		}

		if (validTargets.length) {
			const inRangeTargets: AnyStructure[] = tower.pos.findInRange(validTargets, towerSettings.maxRange);
			inRangeTargets.sort((a, b) => {
				const aUnder1000 = a.hits < 1000;
				const bUnder1000 = b.hits < 1000;

				// If only one is under 1000, prioritize it
				if (aUnder1000 && !bUnder1000) return -1;
				if (!aUnder1000 && bUnder1000) return 1;

				// Both under 1000 or both above: sort descending by value
				return (b.hits / b.hitsMax) - (a.hits / a.hitsMax);
			});
			tower.repair(inRangeTargets[0]);
		}
	}
}

// DefenseManager = profiler.registerFN(DefenseManager, 'DefenseManager');
