import { calcBodyCost, log } from "utils/globalFuncs";
import { PART_COST } from 'utils/constants';

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
    case 'porter':

      const pickupPos: RoomPosition = (Game.getObjectById(extras?.pickup)! as unknown as Structure).pos;
      const dropoffPos: RoomPosition = (Game.getObjectById(extras?.dropoff)! as unknown as Structure).pos;

      const path = PathFinder.search(pickupPos, dropoffPos).path;

      const pathLength = path.length;
      const energyGeneratedRoundTrip = pathLength * 5 * 2;

      const carryPartsNeeded = Math.ceil(energyGeneratedRoundTrip / 50);
      const movePartsNeeded = Math.ceil(carryPartsNeeded / 2);

      for (let i = 0; i < carryPartsNeeded; i++)
        totalBodyParts.push(CARRY);

      for (let i = 0; i < movePartsNeeded; i++)
        totalBodyParts.push(MOVE);

      return totalBodyParts;
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
