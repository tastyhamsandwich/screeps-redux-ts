import { ACTION_BODYPART, ACTION_POWER, ActionConstant, MOVE_FATIGUE_POWER } from "./constants"
import { log, calcBodyCost } from '@globals';

/**
 * Compute the energy cost of a creep body
 * @param body Array of bodyparts {@link Creep.body}
 * @returns Energy cost of this body
 */
export function getBodyCost(body: readonly (BodyPartDefinition | BodyPartConstant)[]) {
	let sum = 0
	for (const b of body) sum += BODYPART_COST[typeof b == "string" ? b : b.type]
	return sum
}

/**
 * Count the number of bodyparts of a given type
 * @param body Array of bodyparts {@link Creep.body}
 * @param type Expected type
 * @param active Count only active bodyparts
 * @returns Number of bodyparts
 */
export function getBodyparts(
	body: readonly BodyPartDefinition[],
	type: BodyPartConstant,
	active = false
) {
	let count = 0
	for (let i = body.length; i-- > 0;) {
		if (active && body[i].hits <= 0) break
		if (body[i].type == type) count += 1
	}
	return count
}
/**
 * Count the number of active bodyparts of a given type
 * @param body Array of bodyparts {@link Creep.body}
 * @param type Expected type
 * @returns Number of active bodyparts
 */
export const getActiveBodyparts = (body: readonly BodyPartDefinition[], type: BodyPartConstant) =>
	getBodyparts(body, type, true)

/**
 * Compute the number of bodyparts of a given action taking boosts into account
 * @param body Array of bodyparts {@link Creep.body}
 * @param action Expected boosts to use
 * @param active Count only active bodyparts
 * @returns An equivalent number of unboosted bodyparts
 */
export function getBodypartsBoostEquivalent(
	body: readonly BodyPartDefinition[],
	action: ActionConstant,
	active = false
) {
	const type = ACTION_BODYPART[action]
	let total = 0
	for (let i = body.length; i-- > 0;) {
		const x = body[i]
		if (active && x.hits <= 0) {
			break
		}
		if (x.type == type) {
			if (x.boost !== undefined) {
				const boost = (BOOSTS[type] as BoostsBodypartType)[x.boost][action]
				total += boost > 1 ? boost : 2 - boost
			} else {
				total += 1
			}
		}
	}
	return total
}
/**
 * Compute the number of active bodyparts of a given action taking boosts into account
 * @param body Array of bodyparts {@link Creep.body}
 * @param action Expected boosts to use
 * @returns An equivalent number of active unboosted bodyparts
 */
export const getActiveBodypartsBoostEquivalent = (
	body: readonly BodyPartDefinition[],
	action: ActionConstant
) => getBodypartsBoostEquivalent(body, action, true)

type BoostsBodypartType = Record<string, Record<ActionConstant, number>>

/**
 * Gets the move efficiency of a creep based on it's number of move parts and boost relative to it's size.
 * @param creep target creep or powerCreep
 * @param usedCapacity override the amount of capacity the creep is using
 * @returns the amount of terrain fatigue the creep can handle
 */
export function getMoveEfficiency(creep: AnyCreep, usedCapacity = creep.store.getUsedCapacity()) {
	if (!("body" in creep)) return Infinity // no fatigue! PowerCreep!
	let activeMoveParts = 0
	let nonMoveParts = 0
	for (const b of creep.body) {
		switch (b.type) {
			case MOVE:
				activeMoveParts += b.hits > 0 ? (b.boost ? BOOSTS[b.type][b.boost].fatigue : 1) : 0
				break
			case CARRY:
				if (usedCapacity > 0 && b.hits > 0) {
					usedCapacity -= b.boost
						? BOOSTS[b.type][b.boost].capacity * CARRY_CAPACITY
						: CARRY_CAPACITY
					nonMoveParts += 1
				}
				break
			default:
				nonMoveParts += 1
				break
		}
	}
	if (nonMoveParts) return (activeMoveParts * MOVE_FATIGUE_POWER) / nonMoveParts
	if (activeMoveParts) return Infinity
	return 0
}

/**
 * Compute the power of active bodyparts for a given action
 * @param body Array of bodyparts {@link Creep.body}
 * @param action expected action
 * @returns power for the given action
 */
export function getBodypartsPower(
	body: readonly BodyPartDefinition[],
	action: keyof typeof ACTION_POWER
) {
	return getActiveBodypartsBoostEquivalent(body, action) * ACTION_POWER[action]
}

export function determineBodyParts(role: string, maxEnergy: number, room: Room, extras?: { [key: string]: any }): BodyPartConstant[] {

	const bodyPartSegment: BodyPartConstant[] = [];
	const totalBodyParts: BodyPartConstant[] = [];

	switch (role) {
		case 'harvester':

			if (maxEnergy >= 650)
				totalBodyParts.push(WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE);
			else if (maxEnergy === 300) {
				return [WORK, WORK, MOVE, CARRY];
			} else {
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
			log(`Cost for '${role}' with ${bodyParts} is ${calcBodyCost(bodyParts)}`);
			return bodyParts;

		case 'defender':
			return [];
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
			log(`Cost for '${role}' with ${bodyParts} is ${calcBodyCost(bodyParts)}`);
				return bodyParts;
			}
		case 'hauler': {

			const maxCarryCost: number = Math.round((maxEnergy / 3) * 2 / 50) * 50;
			const maxMoveCost: number = Math.ceil(maxEnergy / 3 / 50) * 50;
			let maxCarryParts: number = Math.floor(maxCarryCost / 50);
			let maxMoveParts: number = Math.floor(maxMoveCost / 50);

			const locality: string = room.memory.data.logisticalPairs[room.memory.data.pairCounter].locality;
			const pathLen: number = room.memory.data.logisticalPairs[room.memory.data.pairCounter].distance;
			const carryParts: number = Math.ceil(pathLen / 5) * 2;
			const moveParts: number = Math.ceil(carryParts / 2);
			let carryArray: BodyPartConstant[] = [];
			let moveArray: BodyPartConstant[] = [];

			if (maxCarryParts > carryParts) maxCarryParts = carryParts;
			if (maxMoveParts > moveParts) maxMoveParts = moveParts;

			for (let i = 0; i < maxCarryParts; i++) carryArray.push(CARRY);
			for (let i = 0; i < maxMoveParts; i++) moveArray.push(MOVE);

			let currCarryCost: number = carryArray.length * 50;
			let currMoveCost: number = moveArray.length * 50;
			let partCost: number = currCarryCost + currMoveCost;

			if (maxEnergy - partCost >= 50) carryArray.push(CARRY);
			if (maxEnergy - partCost >= 100 && carryArray.length % 2 == 1) moveArray.push(MOVE);

			currCarryCost = carryArray.length * 50;
			currMoveCost = moveArray.length * 50;
			partCost = currCarryCost + currMoveCost;

			let bodyArray: BodyPartConstant[] = carryArray.concat(moveArray);
			let finalCost: number = bodyArray.length * 50;

			if (locality == 'remote') {
				let isEven = carryArray.length % 2;
				if (isEven) {
					if (maxEnergy - partCost >= 150) {
						bodyArray.push(WORK);
						bodyArray.push(MOVE);
						finalCost += 150
					} else if (maxEnergy - partCost >= 50) {
						bodyArray.shift();
						bodyArray.push(WORK);
						finalCost += 50
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
			if (maxEnergy >= 1300)
				return [CLAIM, CLAIM, MOVE, MOVE];
			else if (maxEnergy >= 650)
				return [CLAIM, MOVE];
			else
				return [];
			default:
				throw new Error("Invalid parameters passed.");
	}

}
