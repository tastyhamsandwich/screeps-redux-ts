import { calcBodyCost, log } from "functions/utils/globals";
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

// PROTODEF: Spawn Structure Prototype Extension
declare global {
	interface StructureSpawn {
		spawnList: CreepRole[];
		determineBodyParts(role: string, maxEnergy?: number, extras?: { [key: string]: any }): BodyPartConstant[];
		spawnScout(rally: string | string[], swampScout: boolean): ScreepsReturnCode;
		retryPending(): ScreepsReturnCode;
		cloneCreep(creepName: string): ScreepsReturnCode;
	}
}

StructureSpawn.prototype.spawnList = [];

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
		default:
			throw new Error("Invalid parameters passed.");
	}

}

/**
 * Spawns a scout creep directly.
 * @param rally A string with the name of a flag (or array of strings) to be used for navigation
 * @param swampScout Set to true to spawn scout with 5 MOVE parts, defaults to false (and thus just one MOVE)
 * @returns Screeps Return Code from the result of the spawnCreep() function
 * @example const result = Game.spawns.Spawn1.spawnCreep(['Flag1','Flag2','Flag3'], true);
 */
StructureSpawn.prototype.spawnScout = function(rally: string | string[] = 'none', swampScout: boolean = false): ScreepsReturnCode {

	let countMod = 1;
	let name = `Col${1}_Sct${countMod}`;
	const body = [MOVE];
	if (swampScout) for (let i = 0; i < 4; i++) body.push(MOVE);

	let result = this.spawnCreep(body, name, { memory: { role: 'scout', RFQ: 'scout', disable: false, rally: rally, home: this.room.name, room: this.room.name}});

	while (result === ERR_NAME_EXISTS) {
		countMod++;
		name = `Col${1}_Sct${countMod}`;
		result = this.spawnCreep(body, name, { memory: { role: 'scout', RFQ: 'scout', disable: false, rally: rally, home: this.room.name, room: this.room.name } });
	}

	if (result === OK)
		console.log(`${this.name}: Spawning Scout in room ${this.room.name}`);
	else
		console.log(`${this.name}: Failed to spawn Scout in room ${this.room.name}: ${result}`);

	return result;
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
