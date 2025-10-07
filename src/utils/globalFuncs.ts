declare global {
	interface Global {
		calcPath(startPos: RoomPosition, endPos: RoomPosition): { path: RoomPosition[], length: number, ops: number, cost: number, incomplete: boolean };
		calcPathLength(startPos: RoomPosition, endPos: RoomPosition): number;
		asRoomPosition(value: RoomPosition | { pos?: RoomPosition } | undefined | null): RoomPosition | null;
		log(logMsg: string | string[], room: Room | false): void;
		createRoomFlag(room: string): string | null;
		validateRoomName(roomName: string): RoomName;
		randomInt(min: number, max: number): number;
		randomColor(): ColorConstant;
		randomColorAsInt(): number;
		determineBodyParts(role: string, maxEnergy: number, extras?: { [key: string]: any }): BodyPartConstant[] | undefined;
		initGlobal(override: boolean): boolean;
		calcBodyCost(body: BodyPartConstant[] | undefined | null): number;
		PART_COST: Record<BodyPartConstant, number>;
		pathing: {[key: string]: any};
	}
}

export function calcPath(startPos: RoomPosition, endPos: RoomPosition): { path: RoomPosition[], length: number, ops: number, cost: number, incomplete: boolean } {

	let goal = { pos: endPos, range: 1 };

	let ret: PathFinderPath = PathFinder.search(
		startPos, goal,
		{
			plainCost: 2,
			swampCost: 10,

			roomCallback: function (roomName) {

				let room: Room = Game.rooms[roomName];
				if (!room) return false;

				let costs: CostMatrix = new PathFinder.CostMatrix;

				room.find(FIND_STRUCTURES).forEach(function (struct) {
					if (struct.structureType === STRUCTURE_ROAD) {
						// Favor roads over plain tiles
						costs.set(struct.pos.x, struct.pos.y, 1);
					} else if (struct.structureType !== STRUCTURE_CONTAINER &&
						(struct.structureType !== STRUCTURE_RAMPART ||
							!struct.my)) {

						// Can't walk through non-walkable buildings
						costs.set(struct.pos.x, struct.pos.y, 255);
					}
				});

				return costs;
			}
		}
	);
	const returnObj = {
		path: ret.path,
		length: ret.path.length,
		ops: ret.ops,
		cost: ret.cost,
		incomplete: ret.incomplete
	}

	return returnObj;
}

export function calcPathLength(startPos: RoomPosition, endPos: RoomPosition): number {
	return calcPath(startPos, endPos).length;
}

export function asRoomPosition(value: RoomPosition | { pos?: RoomPosition } | undefined | null): RoomPosition | null {
	if (!value) return null;

	// If it looks like a RoomPosition (has numeric x and y and roomName)
	const isRoomPos = (v: any): v is RoomPosition =>
		v && typeof v.x === 'number' && typeof v.y === 'number' && typeof v.roomName === 'string';

	if (isRoomPos(value)) return value as RoomPosition;

	if ((value as any).pos && isRoomPos((value as any).pos)) return (value as any).pos as RoomPosition;

	return null;
}

export function log(logMsg: string | string[], room: Room | false = false): void {
	if (logMsg instanceof Array) {
		let finalLog: string = '';
		for (let i = 0; i < logMsg.length; i++) {
			if (room)
				finalLog += room.link() + logMsg[i] + '\n';
			else
				finalLog += '[GENERAL]: ' + logMsg[i] + '\n';
		}
		console.log(finalLog);
		return;
	} else if (typeof logMsg === 'string') {
		if (room)
			console.log(room.link() + logMsg);
		else
			console.log('[GENERAL]: ' + logMsg);
		return;
	}
}

export function createRoomFlag(room: string): string | null { // creates a flag named after room at room's center, or at controller if present

	let flagX: number;
	let flagY: number;

	if (Game.rooms[room] !== undefined && Game.rooms[room].controller !== undefined) {
		const rm = Game.rooms[room];
		if (rm && rm.controller) {
			flagX = rm.controller.pos.x;
			flagY = rm.controller.pos.y;
		} else {
			flagX = 25;
			flagY = 25;
		}
	} else {
		flagX = 25;
		flagY = 25;
	}

	const flag = Game.rooms[room].createFlag(flagX, flagY, Game.rooms[room].name, randomColor(), randomColor());
	switch (flag) {
		default:
			log('Flag succesfully created.', Game.rooms[room]);
			return Game.rooms[room].name;
		case ERR_NAME_EXISTS:
			log('Error: A flag with that name already exists.', Game.rooms[room]);
			return null;
		case ERR_INVALID_ARGS:
			log('Error: The location or the name is incorrect.', Game.rooms[room]);
			return null;
	}
}

export function validateRoomName(roomName: string): roomName is RoomName {
	let pattern = /^[EW]([1-9]|[1-5]\d|60)[NS]([1-9]|[1-5]\d|60)$/;
	return pattern.test(roomName);
}

export function randomInt(min: number = 1, max: number = 100): number { // Random integer between min & max, inclusive
	return Math.floor(Math.random() * (max - min + 1) + min)
}

export function randomColor(): ColorConstant { // Random color returned as CONSTANT
	const colorInt = randomInt(1, 10);

	switch (colorInt) {
		case 1:
			return COLOR_RED;
		case 2:
			return COLOR_PURPLE;
		case 3:
			return COLOR_BLUE;
		case 4:
			return COLOR_CYAN;
		case 5:
			return COLOR_GREEN;
		case 6:
			return COLOR_YELLOW;
		case 7:
			return COLOR_ORANGE;
		case 8:
			return COLOR_BROWN;
		case 9:
			return COLOR_GREY;
		case 10:
		default:
			return COLOR_WHITE;
	}
}

export function randomColorAsInt(): number { // Random color returned as INTEGER
	return randomInt(1, 10);
}

export function determineBodyParts(role: string, maxEnergy: number, extras?: { [key: string]: any }): BodyPartConstant[] | undefined {

	const bodyPartSegment: BodyPartConstant[] = [];
	const totalBodyParts: BodyPartConstant[] = [];

	switch (role) {
		case 'harvester':

			if (maxEnergy >= 650)
				totalBodyParts.push(WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE);
			else {
				const workPartCost = maxEnergy / 3 * 2;
				const moveCarryPartCost = maxEnergy / 3;

				const workParts = Math.floor(workPartCost / 100);
				const moveCarryParts = Math.floor(moveCarryPartCost / 100);
				const moveParts = Math.floor(moveCarryParts / 2);
				const carryParts = Math.floor(moveCarryParts / 2);

				for (let i = 0; i < workParts; i++)
					totalBodyParts.push(WORK);

				for (let i = 0; i < moveParts; i++)
					totalBodyParts.push(MOVE);

				for (let i = 0; i < carryParts; i++)
					totalBodyParts.push(CARRY);
			}
			return totalBodyParts;
		case 'upgrader':
		case 'builder':
		case 'repairer':

			const workPartCost = maxEnergy / 2;
			const carryPartCost = maxEnergy / 4;
			const movePartCost = maxEnergy / 4;

			const workParts = Math.floor(workPartCost / 100);
			const carryParts = Math.floor(carryPartCost / 100);
			const moveParts = Math.floor(movePartCost / 100);

			for (let i = 0; i < workParts; i++)
				totalBodyParts.push(WORK);

			for (let i = 0; i < carryParts; i++)
				totalBodyParts.push(CARRY);

			for (let i = 0; i < moveParts; i++)
				totalBodyParts.push(MOVE);

			return totalBodyParts;
		case 'defender':
			bodyPartSegment.push(TOUGH, ATTACK, MOVE);
			var segmentCost = 10 + 80 + 50;
			var maxSegments = maxEnergy / segmentCost;

			for (let i = 0; i < maxSegments; i++)
				totalBodyParts.push(...bodyPartSegment);

			return totalBodyParts;
		case 'filler':
			bodyPartSegment.push(CARRY, CARRY, MOVE);
			var segmentCost = bodyPartSegment.length * 50;
			var maxSegments = maxEnergy / segmentCost;

			for (let i = 0; i < maxSegments; i++)
				totalBodyParts.push(...bodyPartSegment);

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

export function initGlobal(override: boolean = false): boolean {

	if (!Memory.globalSettings) {

		Memory.globalSettings = {
			consoleSpawnInterval: 25,
			alertDisabled: true,
			reusePathValue: 5,
			ignoreCreeps: true,
			creepSettings: {
				builder: {
					reusePathValue: 3,
					ignoreCreeps: true
				},
				filler: {
					reusePathValue: 3,
					ignoreCreeps: true
				},
				harvester: {
					reusePathValue: 3,
					ignoreCreeps: true
				},
				upgrader: {
					reusePathValue: 3,
					ignoreCreeps: true
				}
			}
		}

		return true;
	} else
		return false;
}

export const PART_COST: Record<BodyPartConstant, number> = {
	[MOVE]: 50,
	[WORK]: 100,
	[CARRY]: 50,
	[ATTACK]: 80,
	[RANGED_ATTACK]: 150,
	[HEAL]: 250,
	[CLAIM]: 600,
	[TOUGH]: 10
};

/**
 * Calculate the total energy cost of a body array.
 * Returns 0 for empty/undefined bodies and ignores unknown parts.
 */
export function calcBodyCost(body: BodyPartConstant[] | undefined | null): number {
    if (!body || body.length === 0) return 0;
    return body.reduce((sum, part) => sum + (PART_COST[part] ?? 0), 0);
}

const cSet = Memory.globalSettings.creepSettings;

export const pathing: { [key: string]: MoveToOpts } = {
	builderPathing: {
		visualizePathStyle: { stroke: "#0000ff", opacity: 0.3, lineStyle: "dotted" },
		reusePath: cSet.builder.reusePathValue,
		ignoreCreeps: false //cSet.builder.ignoreCreeps
	},
	runnerPathing: {
		visualizePathStyle: { stroke: "#880088", opacity: 0.3, lineStyle: "dotted" },
		reusePath: cSet.runner.reusePathValue,
		ignoreCreeps: false //cSet.runner.ignoreCreeps
	},
	claimerPathing: {
		visualizePathStyle: { stroke: "#00ffff", opacity: 0.5, lineStyle: "solid" },
		reusePath: cSet.claimer.reusePathValue,
		ignoreCreeps: false //cSet.claimer.ignoreCreeps
	},
	/*collectorPathing: {
		visualizePathStyle: { stroke: "#8833dd", opacity: 0.5, lineStyle: "dotted" },
		reusePath: cSet.collector.reusePathValue,
		ignoreCreeps: false //cSet.collector.ignoreCreeps
	},*/
	cranePathing: {
		visualizePathStyle: { stroke: "#00ffff", opacity: 0.3, lineStyle: "solid" },
		reusePath: cSet.crane.reusePathValue,
		ignoreCreeps: false //cSet.crane.ignoreCreeps
	},
	harvesterPathing: {
		visualizePathStyle: { stroke: "#00ff00", opacity: 0.5, lineStyle: "dashed" },
		reusePath: cSet.harvester.reusePathValue,
		ignoreCreeps: false //cSet.harvester.ignoreCreeps
	},
	healerPathing: {
		visualizePathStyle: { stroke: "#00ff00", opacity: 0.5, lineStyle: "solid" },
		reusePath: cSet.healer.reusePathValue,
		ignoreCreeps: false //cSet.healer.ignoreCreeps
	},
	invaderPathing: {
		visualizePathStyle: { stroke: "#ff0000", opacity: 0.5, lineStyle: "solid" },
		reusePath: cSet.invader.reusePathValue,
		ignoreCreeps: false //cSet.invader.ignoreCreeps
	},
	minerPathing: {
		visualizePathStyle: { stroke: "#00ff00", opacity: 0.3, lineStyle: "solid" },
		reusePath: cSet.miner.reusePathValue,
		ignoreCreeps: false //cSet.miner.ignoreCreeps
	},
	providerPathing: {
		visualizePathStyle: { stroke: "#ff0033", opacity: 0.3, lineStyle: "dotted" },
		reusePath: cSet.provider.reusePathValue,
		ignoreCreeps: false //cSet.provider.ignoreCreeps
	},
	rangerPathing: {
		visualizePathStyle: { stroke: "#ff0000", opacity: 0.5, lineStyle: "solid" },
		reusePath: cSet.ranger.reusePathValue,
		ignoreCreeps: false //cSet.ranger.ignoreCreeps
	},
	rebooterPathing: {
		visualizePathStyle: { stroke: "#ffffff", opacity: 0.5, lineStyle: "solid" },
		reusePath: cSet.rebooter.reusePathValue,
		ignoreCreeps: false //cSet.rebooter.ignoreCreeps
	},
	remoteBuilderPathing: {
		visualizePathStyle: { stroke: "#ffff00", opacity: 0.3, lineStyle: "dotted" },
		reusePath: cSet.remotebuilder.reusePathValue,
		ignoreCreeps: false //cSet.remotebuilder.ignoreCreeps
	},
	remoteGuardPathing: {
		visualizePathStyle: { stroke: "#ff0000", opacity: 0.3, lineStyle: "dashed" },
		reusePath: cSet.remoteguard.reusePathValue,
		ignoreCreeps: false //cSet.remoteguard.ignoreCreeps
	},
	remoteHarvesterPathing: {
		visualizePathStyle: { stroke: "#98dd44", opacity: 0.5, lineStyle: "dashed" },
		reusePath: cSet.remoteharvester.reusePathValue,
		ignoreCreeps: false //cSet.remoteharvester.ignoreCreeps
	},
	remoteLogisticianPathing: {
		visualizePathStyle: { stroke: "#ffffff", opacity: 0.5, lineStyle: "dotted" },
		reusePath: cSet.remotelogistician.reusePathValue,
		ignoreCreeps: false //cSet.remotelogistician.ignoreCreeps
	},
	remoteRunnerPathing: {
		visualizePathStyle: { stroke: "#880088", opacity: 0.3, lineStyle: "dotted" },
		reusePath: cSet.remoterunner.reusePathValue,
		ignoreCreeps: false //cSet.remoterunner.ignoreCreeps
	},
	repairerPathing: {
		visualizePathStyle: { stroke: "#ff6600", opacity: 0.3, lineStyle: "dotted" },
		reusePath: cSet.repairer.reusePathValue,
		ignoreCreeps: false //cSet.repairer.ignoreCreeps
	},
	reserverPathing: {
		visualizePathStyle: { stroke: "#ffffff", opacity: 0.3, lineStyle: "dashed" },
		reusePath: cSet.reserver.reusePathValue,
		ignoreCreeps: false //cSet.reserver.ignoreCreeps
	},
	scientistPathing: {
		visualizePathStyle: { stroke: "#ffffff", opacity: 0.8, lineStyle: "solid" },
		reusePath: cSet.scientist.reusePathValue,
		ignoreCreeps: false //cSet.scientist.ignoreCreeps
	},
	scoutPathing: {
		visualizePathStyle: { stroke: "#ff00ff", opacity: 0.5, lineStyle: "solid" },
		reusePath: cSet.scout.reusePathValue,
		ignoreCreeps: false //cSet.scout.ignoreCreeps
	},
	upgraderPathing: {
		visualizePathStyle: { stroke: "#ffff00", opacity: 0.3, lineStyle: "dotted" },
		reusePath: cSet.upgrader.reusePathValue,
		ignoreCreeps: false //cSet.upgrader.ignoreCreeps
	},
	warriorPathing: {
		visualizePathStyle: { stroke: "#ff0000", opacity: 0.5, lineStyle: "solid" },
		reusePath: cSet.warrior.reusePathValue,
		ignoreCreeps: false //cSet.warrior.ignoreCreeps
	},
	rallyPointPathing: {
		visualizePathStyle: { stroke: "#ffffff", opacity: 1.0, lineStyle: "solid" },
		reusePath: Memory.globalSettings.reusePathValue,
		ignoreCreeps: Memory.globalSettings.ignoreCreeps
	},
	subordinatePathing: {
		visualizePathStyle: { stroke: '#880000', opacity: 1.0, lineStyle: "dashed" },
		reusePath: Memory.globalSettings.reusePathValue,
		ignoreCreeps: false
	}
};
6
export function needMoreHarvesters(room: Room): boolean {

	const numSources = room.find(FIND_SOURCES).length;
	const harvesters = room.find(FIND_MY_CREEPS, { filter: (i) => i.memory.role === 'harvester'});
	let numWorkParts = 0;
	_.forEach (harvesters, harvester => {
		const numParts = harvester.getActiveBodyparts(WORK);
		numWorkParts += numParts;
	})

	const requiredWorkPartsPerSource = 5;
	const totalRequiredWorkParts = numSources * requiredWorkPartsPerSource;

	return (numWorkParts >= totalRequiredWorkParts) ? false : true;
}
