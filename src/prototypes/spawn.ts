import { PART_COST, calcBodyCost, log } from "utils/globalFuncs";

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
        totalBodyParts.push(WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE);
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

			const body: BodyPartConstant[] = [];
			let remainingEnergy = maxEnergy;

			// Start with one of each (minimum requirement)
			body.push(WORK, CARRY, MOVE);
			remainingEnergy -= 200; // 100 + 50 + 50

			// For optimal ratio: 2 WORK per 1 CARRY and 1 MOVE
			// This costs: 200 (2 WORK) + 50 (CARRY) + 50 (MOVE) = 300 per unit
			while (remainingEnergy >= 300) {
				body.push(WORK, WORK, CARRY, MOVE);
				remainingEnergy -= 300;
			}

			// If we have leftover energy, try to add parts while maintaining ratio as best as possible
			// Priority: WORK > CARRY > MOVE
			while (remainingEnergy >= 100) {
				body.push(WORK);
				remainingEnergy -= 100;
			}

			while (remainingEnergy >= 50) {
				// Add CARRY and MOVE in pairs if possible
				if (remainingEnergy >= 100 && body.filter(p => p === CARRY).length < body.filter(p => p === MOVE).length + 1) {
					body.push(CARRY, MOVE);
					remainingEnergy -= 100;
				} else if (body.filter(p => p === CARRY).length > body.filter(p => p === MOVE).length) {
					body.push(MOVE);
					remainingEnergy -= 50;
				} else {
					body.push(CARRY);
					remainingEnergy -= 50;
				}
			}

			log(`Cost for '${role}' with ${body} is ${calcBodyCost(body)}`);

      return body;
    case 'defender':
      bodyPartSegment.push(TOUGH, ATTACK, MOVE);
      var segmentCost = 10 + 80 + 50;
      var maxSegments = maxEnergy / segmentCost;

      for (let i = 0; i < maxSegments; i++)
        totalBodyParts.push(...bodyPartSegment);

      return totalBodyParts;
    case 'filler':
			let maxCost = maxEnergy;
			while (maxCost > 0) {
				totalBodyParts.push(CARRY);
				maxCost -= 50;
				if (maxCost == 0) break;
				totalBodyParts.push(CARRY);
				maxCost -= 50;
				if (maxCost == 0) break;
				totalBodyParts.push(MOVE);
				maxCost -= 50;
			}
			log(`Cost for '${role}' with ${totalBodyParts} is ${calcBodyCost(totalBodyParts)}`);
      return totalBodyParts;
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
    default:
      throw new Error("Invalid parameters passed.");
  }

}
