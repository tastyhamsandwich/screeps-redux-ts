import { calcBodyCost, getReturnCode, log } from "functions/utils/globals";
import { PART_COST } from 'functions/utils/constants';

const PART = {
	MOVE: 50,
	CARRY: 50,
	WORK: 100,
	ATTACK: 80,
	RANGED_ATTACK: 150,
	HEAL: 250,
	CLAIM: 600,
	TOUGH: 10
}

StructureSpawn.prototype.spawnList = [];

StructureSpawn.prototype.log = function (logMsg: string): void {
	console.log(`${this.room.link()}<span color='green'>${this.name}</span>: ${logMsg}`);
	return;
}
/**
 * Determine's the body plan to use when spawning a creep based on the provided role and max energy available
 * @author randomencounter
 * @param role The role of the creep to be determined
 * @param maxEnergy How much energy is available to be used in the calculation
 * @param extras An object including anthing additional that might be needed (currently unused)
 * @returns An array of BodyPartConstants that can be used as the input in a spawnCreep() function
 */
StructureSpawn.prototype.determineBodyParts = function (role: string, maxEnergy?: number, extras?: { [key: string]: any }): BodyPartConstant[] {

	if (maxEnergy ===  undefined) maxEnergy = this.room.energyCapacityAvailable;

	const bodyPartSegment: BodyPartConstant[] = [];
	const totalBodyParts: BodyPartConstant[] = [];

	switch (role) {
		case 'harvester':
			if (this.room.memory.data.flags.dropHarvestingEnabled) {
				if (maxEnergy >= 600) {
					totalBodyParts.push(WORK, WORK, WORK, WORK, WORK, MOVE, MOVE);
					return totalBodyParts;
				} else {
					let remainingCost = maxEnergy;

					const moveParts = [MOVE];
					remainingCost -= 50;
					const workParts: BodyPartConstant[] = []
					while (remainingCost >= 100) {
						workParts.push(WORK);
						remainingCost -= 100;
					}
					if (remainingCost >= 50)
						moveParts.push(MOVE);

					const totalBodyParts = workParts.concat(moveParts);

					return totalBodyParts;
				}
			} else {
				if (maxEnergy >= 650)
					totalBodyParts.push(WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE);
				else {
					let remainingCost = maxEnergy;

					totalBodyParts.push(MOVE);
					totalBodyParts.push(CARRY);
					remainingCost -= 100;

					while (remainingCost >= 100) {
						totalBodyParts.push(WORK);
						remainingCost -= 100;
					}
				}
				return totalBodyParts;
			}
		case 'remoteharvester':
			if (maxEnergy >= 650)
				totalBodyParts.push(WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE);
			else {
				let remainingCost = maxEnergy;

				totalBodyParts.push(MOVE);
				totalBodyParts.push(CARRY);
				remainingCost -= 100;

				while (remainingCost >= 100) {
					totalBodyParts.push(WORK);
					remainingCost -= 100;
				}
			}
			return totalBodyParts;
		case 'upgrader':
		case 'builder':
		case 'repairer':

			const workParts: BodyPartConstant[] = [];
			const carryParts: BodyPartConstant[] = [];
			const moveParts: BodyPartConstant[] = [];

			let remainingEnergy = maxEnergy;
			if (remainingEnergy >= 1400) remainingEnergy = 1400;

			// Budget out remaining energy, 50% for WORK, 25% for CARRY/MOVE
			let remainingWorkBudget  = (remainingEnergy / 2);
			let remainingMoveBudget  = (remainingEnergy / 4);
			let remainingCarryBudget = (remainingEnergy / 4);

			// Add WORK parts to array while there is still energy in the WORK budget
			while (remainingWorkBudget >= 100) {
				workParts.push(WORK);
				remainingWorkBudget -= 100;
			}

			// Any leftover energy is carried over into the CARRY budget
			remainingCarryBudget += remainingWorkBudget;

			// Add CARRY parts to array while there's energy in budget
			while (remainingCarryBudget >= 50) {
				carryParts.push(CARRY);
				remainingCarryBudget -= 50;
			}

			// Carry over leftover energy to MOVE budget
			remainingMoveBudget += remainingCarryBudget;

			// Add MOVE parts to array within budget again
			while (remainingMoveBudget >= 50) {
				moveParts.push(MOVE);
				remainingMoveBudget -= 50;
			}

			// Concatenate all 3 arrays into one array
			const partialParts = workParts.concat(carryParts);
			const bodyParts = partialParts.concat(moveParts);

			// Log cost & return array
			if (this.room.memory.data.debugSpawn)
				console.log(`${this.room.link()}${this.name}> Cost for '${role}' with ${bodyParts} is ${calcBodyCost(bodyParts)}`);
			return bodyParts;

		case 'defender': {

			let remainingEnergy = maxEnergy;

			let attackParts	: BodyPartConstant[] = [];
			let moveParts 	: BodyPartConstant[] = [];
			let toughParts	: BodyPartConstant[] = [];

			while (remainingEnergy >= 150) {
				attackParts.push(ATTACK);
				moveParts.push(MOVE);
				toughParts.push(TOUGH);
				toughParts.push(TOUGH);
			}

			if (remainingEnergy >= 100) {
				moveParts.push(MOVE);
				moveParts.push(MOVE);
			}
			if (remainingEnergy >= 50)
				moveParts.push(MOVE);

			const intermedParts: BodyPartConstant[] = moveParts.concat(toughParts);
			const bodyParts: BodyPartConstant[] = intermedParts.concat(attackParts);

			return bodyParts;
		}
		case 'filler': {

			// Limit fillers to max cost of 300, effectively 4 CARRY and 2 MOVE parts
			let maxCost = maxEnergy;
			if (maxEnergy >= 300)
				maxCost = 300;

			const carryParts: BodyPartConstant[] = [];
			const moveParts: BodyPartConstant[] = [];
			// While there's still at least 50 energy available, iterate loop
			// Check that we aren't at less than 50 after the first push to ensure we don't break budget
			while (maxCost >= 50) {
				carryParts.push(CARRY);
				maxCost -= 50;
				if (maxCost < 50) break;
				moveParts.push(MOVE);
				maxCost -= 50;
				if (maxCost < 50) break;
				carryParts.push(CARRY);
				maxCost -= 50;
			}

			// Concatenate the two arrays into one
			const bodyParts: BodyPartConstant[] = carryParts.concat(moveParts);

			// Log cost & return
			if (this.room.memory.data.debugSpawn)
				console.log(`${this.room.link()}${this.name}> Cost for '${role}' with ${bodyParts} is ${calcBodyCost(bodyParts)}`);
			return bodyParts;
			}
		case 'hauler': {

			const maxCarryCost: number = Math.round((maxEnergy / 3) * 2 / 50) * 50;
			const maxMoveCost: number = Math.ceil(maxEnergy / 3 / 50) * 50;
			let maxCarryParts: number = Math.floor(maxCarryCost / 50);
			let maxMoveParts: number = Math.floor(maxMoveCost / 50);

			let locality: string = 'local';
			let pathLen: number = 15;

			if (this.room.memory?.data?.logisticalPairs) {
				locality = this.room.memory?.data?.logisticalPairs[this.room.memory.data.pairCounter]?.locality;
				pathLen = this.room.memory?.data?.logisticalPairs[this.room.memory.data.pairCounter]?.distance;
			} else if (this.room.memory?.data?.haulerPairs) {
				if (this.room.memory?.data?.indices.haulerIndex === undefined) this.room.memory.data.indices.haulerIndex = 0;
				pathLen = this.room.memory?.data?.haulerPairs[this.room.memory.data.indices.haulerIndex].length;
			}

			const carryParts: number = Math.ceil(pathLen / 5) * 2;
			const moveParts: number = Math.ceil(carryParts / 2);
			let carryArray: BodyPartConstant[] = [];
			let moveArray: BodyPartConstant[] = [];

			if (maxCarryParts > carryParts) maxCarryParts = carryParts;
			if (maxMoveParts > moveParts) maxMoveParts = moveParts;

			for (let i = 0; i < maxCarryParts	; i++) carryArray.push(CARRY);
			for (let i = 0; i < maxMoveParts	; i++) 	moveArray.push(MOVE	);

			let currCarryCost: 	number = carryArray.length * 50;
			let currMoveCost: 	number = moveArray.length * 50;
			let partCost: 			number = currCarryCost + currMoveCost;

			if (maxEnergy - partCost >= 50) carryArray.push(CARRY);
			if (maxEnergy - partCost >= 100 && carryArray.length % 2 == 1) moveArray.push(MOVE);

			currCarryCost = carryArray.length * 50;
			currMoveCost 	= moveArray.length 	* 50;
			partCost 			= currCarryCost + currMoveCost;

			let bodyArray: BodyPartConstant[] = carryArray.concat(moveArray);
			let finalCost: number = bodyArray.length * 50;

			if (locality == 'remote') {
				let isEven = carryArray.length % 2;
				if (isEven) {
					if (maxEnergy - partCost >= 150) {
						bodyArray.push(WORK);
						bodyArray.push(MOVE);
						finalCost += 150;
					} else if (maxEnergy - partCost >= 50) {
						bodyArray.shift();
						bodyArray.push(WORK);
						finalCost += 50;
					} else {
						bodyArray.pop();
						bodyArray.shift();
						bodyArray.push(WORK);
					}
				} else {
					if (maxEnergy - partCost >= 100) {
						bodyArray.push(WORK);
						finalCost += 100;
					}
					else if (maxEnergy - partCost >= 50) {
						bodyArray.shift();
						bodyArray.push(WORK);
						finalCost += 50;
					}
				}
			}
			let finalCarry: number = 0;
			let finalMove: number = 0;
			let finalWork: number = 0;;

			_.forEach(bodyArray, (part: BodyPartConstant) => {
				if (part === CARRY) finalCarry++;
				else if (part === MOVE) finalMove++;
				else if (part === WORK) finalWork++;
			});

			return bodyArray;
		}
		case 'reserver':
			if (maxEnergy >= 1300) return [CLAIM, CLAIM, MOVE, MOVE];
			else if (maxEnergy >= 650) return [CLAIM, MOVE];
			else return [];
		case 'scout':
			return [MOVE,MOVE,MOVE];
		case 'conveyor':
			return [CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE];
		case 'worker':
		case 'worker':
		case 'worker-mixed': {
			// Balanced worker for all task types (1200 cap)
			const workerMax = Math.min(maxEnergy, 1200);
			const workBudget = Math.floor(workerMax * 0.40);   // 40% work
			const carryBudget = Math.floor(workerMax * 0.35);  // 35% carry
			const moveBudget = Math.floor(workerMax * 0.25);   // 25% move

			const mixedBody: BodyPartConstant[] = [];
			for (let i = 0; i < workBudget / 100; i++) mixedBody.push(WORK);
			for (let i = 0; i < carryBudget / 50; i++) mixedBody.push(CARRY);
			for (let i = 0; i < moveBudget / 50; i++) mixedBody.push(MOVE);

			log(`Cost for '${role}' with ${mixedBody} is ${calcBodyCost(mixedBody)}`);
			return mixedBody;
		}
		case 'worker-hauler': {
			// Logistics-focused: Max CARRY and MOVE, minimal WORK
			// Cap at 1100 to stay efficient for hauling
			const haulerMax = Math.min(maxEnergy, 1100);
			const haulerWorkBudget = Math.floor(haulerMax * 0.10);   // 10% work (just one WORK part for utility)
			const haulerCarryBudget = Math.floor(haulerMax * 0.50);  // 50% carry (prioritize cargo)
			const haulerMoveBudget = Math.floor(haulerMax * 0.40);   // 40% move (speed for logistics)

			const haulerBody: BodyPartConstant[] = [];
			for (let i = 0; i < haulerWorkBudget / 100; i++) haulerBody.push(WORK);
			for (let i = 0; i < haulerCarryBudget / 50; i++) haulerBody.push(CARRY);
			for (let i = 0; i < haulerMoveBudget / 50; i++) haulerBody.push(MOVE);

			log(`Cost for '${role}' with ${haulerBody} is ${calcBodyCost(haulerBody)}`);
			return haulerBody;
		}
		case 'worker-builder': {
			// Construction-focused: High WORK and CARRY, moderate MOVE
			// Cap at 1400 for extended work sessions
			const builderMax = Math.min(maxEnergy, 1400);
			const builderWorkBudget = Math.floor(builderMax * 0.45);   // 45% work (strong building power)
			const builderCarryBudget = Math.floor(builderMax * 0.35);  // 35% carry (good energy supply)
			const builderMoveBudget = Math.floor(builderMax * 0.20);   // 20% move (less mobility needed)

			const builderBody: BodyPartConstant[] = [];
			for (let i = 0; i < builderWorkBudget / 100; i++) builderBody.push(WORK);
			for (let i = 0; i < builderCarryBudget / 50; i++) builderBody.push(CARRY);
			for (let i = 0; i < builderMoveBudget / 50; i++) builderBody.push(MOVE);

			log(`Cost for '${role}' with ${builderBody} is ${calcBodyCost(builderBody)}`);
			return builderBody;
		}
		default:
			throw new Error("Invalid parameters passed.");
	}

}

/**
 * Spawns a scout creep directly.
 * @param rally A string with the name of a flag (or array of strings) to be used for navigation
 * @param swampScout Set to true to spawn scout with 5 MOVE parts, defaults to false (and thus just one MOVE)
 * @param memory Any additional memory values that should be stored (standard values such as role, RFQ, disable, etc. are supplied automatically)
 * @returns Screeps Return Code from the result of the spawnCreep() function
 * @example const result = Game.spawns.Spawn1.spawnCreep(['Flag1','Flag2','Flag3'], true);
 */
StructureSpawn.prototype.spawnScout = function (rally: string | string[] = 'none', swampScout: boolean = false, memory = { }): { name: string, result: ScreepsReturnCode } {

	const baseMem = { role: 'scout', RFQ: 'scout', disable: false, rally, home: this.room.name, room: this.room.name};
	const finalMemory = { ...baseMem, ...memory};
	let countMod = 1;
	let name = `Col${1}_Sct${countMod}`;
	const body = [MOVE];
	if (swampScout) for (let i = 0; i < 4; i++) body.push(MOVE);

	let result = this.spawnCreep(body, name, { memory: finalMemory});

	while (result === ERR_NAME_EXISTS) {
		countMod++;
		name = `Col${1}_Sct${countMod}`;
		result = this.spawnCreep(body, name, { memory: finalMemory });
	}

	if (result === OK)
		console.log(`${this.room.link()}${this.name}> Spawning Scout in room ${this.room.name}`);
	else
		console.log(`${this.room.link()}${this.name}> Failed to spawn Scout in room ${this.room.name}: ${result}`);
	const output = {
		name,
		result
	}
	return output;
}

/**
 * Attempts to execute a pending spawn stored in room.memory.data.pendingSpawn
 * @returns Screeps Return Code from the spawnCreep() attempt
 * @example const result = Game.spawns.Spawn1.retryPending();
 */
StructureSpawn.prototype.retryPending = function(): ScreepsReturnCode {
	const room = this.room;
	const pending = room.memory.data?.pendingSpawn;

	if (!pending) {
		return ERR_NOT_FOUND;
	}

	// Check if we have enough energy for the pending spawn
	if (room.energyAvailable < pending.cost) {
		return ERR_NOT_ENOUGH_ENERGY;
	}

	// Attempt to spawn the creep
	const result = this.spawnCreep(pending.body, pending.name, { memory: pending.memory });

	if (result === OK) {
		console.log(`${room.link()}${this.name}> Resuming pending spawn for ${pending.memory.role} (${pending.name})`);
		delete room.memory.data.pendingSpawn;
	} else {
		console.log(`${room.link()}${this.name}> Failed to retry pending ${pending.memory.role}: ${result}`);
	}

	return result;
}

/**
 * Clones an existing creep by spawning a new creep with the same body and memory settings (excluding RFQ)
 * @param creepName The name of the creep to clone
 * @returns Screeps Return Code from the spawnCreep() attempt
 * @example const result = Game.spawns.Spawn1.cloneCreep('Col1_Har1');
 */
StructureSpawn.prototype.cloneCreep = function(creepName: string): ScreepsReturnCode {
	const sourceCreep = Game.creeps[creepName];
	const room = this.room;

	if (!sourceCreep) {
		console.log(`${room.link()}${this.name}> Clone failed: Source creep '${creepName}' not found`);
		return ERR_NOT_FOUND;
	}

	// Create new creep name by appending 'C'
	const newCreepName = creepName + 'C';

	// Copy memory from source creep, excluding RFQ
	const clonedMemory: any = {};
	for (const key in sourceCreep.memory) {
		if (key !== 'RFQ') {
			clonedMemory[key] = sourceCreep.memory[key];
		}
	}

	// Clone the exact body parts from the source creep
	const body: BodyPartConstant[] = [...sourceCreep.body.map(part => part.type)];
	const role = sourceCreep.memory.role || 'harvester';

	if (body.length === 0) {
		console.log(`${room.link()}${this.name}> Clone failed: Source creep has no body parts`);
		return ERR_INVALID_ARGS;
	}

	// Attempt to spawn the cloned creep
	const result = this.spawnCreep(body, newCreepName, { memory: clonedMemory });

	if (result === OK) {
		console.log(`${room.link()}${this.name}> Successfully cloned ${creepName} as ${newCreepName} (${role})`);
	} else {
		console.log(`${room.link()}${this.name}> Failed to clone ${creepName}: ${result}`);
	}

	return result;
}

Spawn.prototype.spawnEmergencyHarvester = function(): ScreepsReturnCode {
	let name = 'EmergencyHarvester';
	let counter = 1;
	let result = this.spawnCreep([WORK,WORK,MOVE,CARRY], `${name}${counter}`, {
		memory: { role: 'harvester', RFQ: 'eharvester', home: this.room.name,
			room: this.room.name, disable: false, rally: 'none' }});

	while (result === ERR_NAME_EXISTS) {
		counter++;
		result = this.spawnCreep([WORK, WORK, MOVE, CARRY], `${name}${counter}`, {
			memory: {
				role: 'harvester', RFQ: 'eharvester', home: this.room.name,
				room: this.room.name, disable: false, rally: 'none'
			}
		});
	}

	if (result === OK) console.log(`Spawning Emergency Harvester '${name}`);
	else console.log(`Error spawning Emergency Harvester: ${getReturnCode(result)}`);
	return result;
}

Spawn.prototype.spawnFiller = function(maxEnergy: number): ScreepsReturnCode {

		// Limit fillers to max cost of 300, effectively 4 CARRY and 2 MOVE parts
		let maxCost = maxEnergy;
		if(maxEnergy >= 300)
		maxCost = 300;

	const carryParts: BodyPartConstant[] = [];
	const moveParts: BodyPartConstant[] = [];
	// While there's still at least 50 energy available, iterate loop
	// Check that we aren't at less than 50 after the first push to ensure we don't break budget
	while (maxCost >= 50) {
		carryParts.push(CARRY);
		maxCost -= 50;
		if (maxCost < 50) break;
		moveParts.push(MOVE);
		maxCost -= 50;
		if (maxCost < 50) break;
		carryParts.push(CARRY);
		maxCost -= 50;
	}

	// Concatenate the two arrays into one
	const bodyParts: BodyPartConstant[] = carryParts.concat(moveParts);

	// Log cost & return
	if (this.room.memory.data.debugSpawn)
		console.log(`${this.room.link()}${this.name}> Cost for 'filler' with ${bodyParts} is ${calcBodyCost(bodyParts)}`);
	let counter = 1;
	let name = `Filler${counter}`
	const bodyCost = calcBodyCost(bodyParts);
	const result = this.spawnCreep(bodyParts, name, { memory: { role: 'filler', RFQ: 'filler', home: this.room.name, room: this.room.name, working: false, disable: false, rally: 'none' }})
	switch (result) {
		case OK:
			this.room.memory.stats.creepsSpawned++;
			this.room.memory.stats.creepPartsSpawned += bodyParts.length;
			this.room.memory.stats.energySpentOnSpawns = (this.room.memory.stats.energySpentOnSpawns ?? 0) + bodyCost;
			console.log(`${this.room.link()}${this.name}> Spawning emergency filler, ${name}`);
			break;
		case ERR_NAME_EXISTS:
			const secondResult = this.spawnCreep(bodyParts, `Filler${Game.time}`, { memory: { role: 'filler', RFQ: 'filler', home: this.room.name, room: this.room.name, working: false, disable: false, rally: 'none' } });
				if (secondResult === OK) {
					this.room.memory.stats.creepsSpawned++;
					this.room.memory.stats.creepPartsSpawned += bodyParts.length;
					this.room.memory.stats.energySpentOnSpawns = (this.room.memory.stats.energySpentOnSpawns ?? 0) + bodyCost;
					console.log(`${this.room.link()}${this.name}> Spawning emergency filler, ${name}`);
					return secondResult;
				}
				break;
		default:
			console.log(`${this.room.link()}${this.name}> Error spawning emergency filler: ${result}`);
			break;
	}
	return result;
	}
