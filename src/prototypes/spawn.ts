import { calcBodyCost, log } from "functions/utils/globals";
import { PART_COST } from 'functions/utils/constants';

// PROTODEF: Spawn Structure Prototype Extension
declare global {
	interface StructureSpawn {
		spawnList: CreepRole[];
		determineBodyParts(role: string, maxEnergy?: number, extras?: { [key: string]: any }): BodyPartConstant[],
	}
}

StructureSpawn.prototype.spawnList = [];

StructureSpawn.prototype.determineBodyParts = function (role: string, maxEnergy?: number, extras?: { [key: string]: any }): BodyPartConstant[] {


  if (maxEnergy ===  undefined) maxEnergy = this.room.energyCapacityAvailable;

  const bodyPartSegment: BodyPartConstant[] = [];
  const totalBodyParts: BodyPartConstant[] = [];

  switch (role) {
    case 'harvester':

      if (maxEnergy >= 650)
        totalBodyParts.push(WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE);
      else {
				let remainingCost = this.room.energyCapacityAvailable;

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
		if (remainingEnergy >= 600) remainingEnergy = 600;

		// Budget out remaining energy, 50% for WORK, 25% for CARRY/MOVE
		let remainingWorkBudget  = (remainingEnergy / 3) * 2;
		let remainingMoveBudget  = (remainingEnergy / 6) * 2;
		let remainingCarryBudget = (remainingEnergy / 6) * 2;

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

		  const locality: string = this.room.memory.data.logisticalPairs[this.room.memory.data.pairCounter].locality;
		  const pathLen: number = this.room.memory.data.logisticalPairs[this.room.memory.data.pairCounter].distance;
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
		if (maxEnergy >= 1400)
			return [CLAIM, CLAIM, MOVE, MOVE];
		else if (maxEnergy >= 700)
			return [CLAIM, MOVE];
		else
			return [];
    default:
      throw new Error("Invalid parameters passed.");
  }

}
