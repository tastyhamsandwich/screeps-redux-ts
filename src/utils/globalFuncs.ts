import { PART_COST } from "./constants";

let controllerPPTArray: number[] = [];
let controllerProgress: number = 0;

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

/**
 * Calculate the total energy cost of a body array.
 * Returns 0 for empty/undefined bodies and ignores unknown parts.
 */
export function calcBodyCost(body: BodyPartConstant[] | undefined | null): number {
    if (!body || body.length === 0) return 0;
    return body.reduce((sum, part) => sum + (PART_COST[part] ?? 0), 0);
}



export function needMoreHarvesters(room: Room): boolean {
	const numSources = room.find(FIND_SOURCES).length;
	const harvesters = room.find(FIND_MY_CREEPS, {
		filter: (c) => c.memory.role === 'harvester',
	});

	// Get active WORK part count for each harvester
	const harvesterWorkParts = harvesters
		.map(c => c.getActiveBodyparts(WORK))
		.sort((a, b) => b - a); // strongest first

	let sourcesSatisfied = 0;
	let currentHarvester = 0;

	while (sourcesSatisfied < numSources && currentHarvester < harvesterWorkParts.length) {
		let remainingWorkNeeded = 5;

		while (remainingWorkNeeded > 0 && currentHarvester < harvesterWorkParts.length) {
			remainingWorkNeeded -= harvesterWorkParts[currentHarvester];
			currentHarvester++;
		}

		if (remainingWorkNeeded <= 0) {
			sourcesSatisfied++;
		} else {
			// ran out of harvesters for this source
			return true;
		}
	}

	return sourcesSatisfied < numSources;
}

export function visualRCProgress(controller: StructureController): void {

	function add(acc: number, a: number) { return acc + a; }
	let lvlColor: string = '#dddddd';

	switch (controller.level) {
		case 1:
			lvlColor = '#002700';
			break;
		case 2:
			lvlColor = '#228600';
			break;
		case 3:
			lvlColor = '#00ffaa';
			break;
		case 4:
			lvlColor = '#22dddd';
			break;
		case 5:
			lvlColor = '#8000ff';
			break;
		case 6:
			lvlColor = '#dd00bb';
			break;
		case 7:
			lvlColor = '#dd7700';
			break;
		case 8:
			lvlColor = '#dd0000';
			break;
	}

	const cont: StructureController = controller;
	const rmName: string = controller.room.name;
	const rmSettingsPInfo: ProgressInfoSettings = controller.room.memory.settings.visualSettings.progressInfo;


	if (controllerPPTArray.length > cont.level * 12) {
		const array: number[] = controllerPPTArray;
		const newArr: number[] = avgArray(array);
		controllerPPTArray = newArr;
	}

	const progress: number = cont.progress;
	let progressLastTick: number;

	if (controllerProgress !== 0)
		progressLastTick = progress - controllerProgress;
	else
		progressLastTick = 0;

	if (!(progressLastTick == 0 && controllerPPTArray.length == 0) && progress !== 0)
		controllerPPTArray.push(progressLastTick);

	controllerProgress = progress;

	const sum: number = controllerPPTArray.reduce(add, 0);
	const arrLen: number = controllerPPTArray.length;

	const avgProgressPerTick: number = parseInt((sum / arrLen).toFixed(2));
	const progressRemaining: number = cont.progressTotal - cont.progress;
	const ticksRemaining: number = parseInt((progressRemaining / avgProgressPerTick).toFixed(0));
	const currentTickDuration: number = parseFloat(Memory.time!.lastTickTime!.toFixed(2));
	const secondsRemaining: number = ticksRemaining * currentTickDuration;
	const fontSize: number = rmSettingsPInfo.fontSize;
	const xOffset: number = rmSettingsPInfo.xOffset;
	const yOffsetFactor: number = rmSettingsPInfo.yOffsetFactor;
	const stroke: string = rmSettingsPInfo.stroke;
	const alignment: alignment = rmSettingsPInfo.alignment;
	const days: number = Math.floor(secondsRemaining / (3600 * 24));
	const hours: number = Math.floor(secondsRemaining % (3600 * 24) / 3600);
	const minutes: number = Math.floor(secondsRemaining % 3600 / 60);
	const seconds: number = Math.floor(secondsRemaining % 60);

	cont.room.visual.text(
		('L' + cont.level + ' - ' + ((cont.progress / cont.progressTotal) * 100).toFixed(2)) + '%',
		cont.pos.x + xOffset,
		cont.pos.y - (yOffsetFactor * 2),
		{ align: alignment, opacity: 0.8, color: lvlColor, font: fontSize, stroke: stroke });

	cont.room.visual.text(
		(cont.progress + '/' + cont.progressTotal) + ' - Avg: +' + avgProgressPerTick,
		cont.pos.x + xOffset,
		cont.pos.y - yOffsetFactor,
		{ align: alignment, opacity: 0.8, color: lvlColor, font: fontSize - .1, stroke: stroke });

	if (secondsRemaining)
		cont.room.visual.text(
			days + 'd ' + hours + 'h ' + minutes + 'm ' + seconds + 's (' + ticksRemaining + ' ticks)',
			cont.pos.x + xOffset,
			cont.pos.y,
			{ align: alignment, opacity: 0.8, color: lvlColor, font: fontSize - .1, stroke: stroke });
	else
		cont.room.visual.text('Unknown time remaining',
			cont.pos.x + xOffset,
			cont.pos.y,
			{ align: alignment, opacity: 0.8, color: '#000000', font: fontSize - .1, stroke: '#ffaa00' });
}

/**
 *  Takes a number array as input and returns the average
 * @param array The array used for calculation
 * @returns The array's average value
 */
function avgArray(array: number[]): number[] {

	function add(acc: number, a: number): number { return acc + a; }

	const sum: number = array.reduce(add, 0);
	const arrLen: number = array.length;
	const avg: number = parseInt((sum / arrLen).toFixed(2));
	const newArr: number[] = [avg];

	return newArr;
}

/**
 *  Converts raw seconds into days/hours/minutes/seconds
 * @param seconds The number of seconds to convert
 * @returns The string value of "Xd Xh Xm Xs"
 */
export function secondsToDhms(seconds: number) {
	seconds = Number(seconds);
	var d: number = Math.floor(seconds / (3600 * 24));
	var h: number = Math.floor(seconds % (3600 * 24) / 3600);
	var m: number = Math.floor(seconds % 3600 / 60);
	var s: number = Math.floor(seconds % 60);

	var dDisplay: string = d > 0 ? d + (d == 1 ? " day, " : " days, ") : "";
	var hDisplay: string = h > 0 ? h + (h == 1 ? " hour, " : " hours, ") : "";
	var mDisplay: string = m > 0 ? m + (m == 1 ? " minute, " : " minutes, ") : "";
	var sDisplay: string = s > 0 ? s + (s == 1 ? " second" : " seconds") : "";
	return dDisplay + hDisplay + mDisplay + sDisplay;
}

Object.assign(exports, {

	POLYBLUEDOTTED3: {
		stroke: '#0000ff',
		strokeWidth: 0.1,
		lineStyle: 'dashed'
	}
})

export function calcTickTime(tickSamples: number = 1000): string { // Call this from 1st line of main loop. Can adjust samples used for calculation from there.
	let millis: number = Date.now();

	// Set some sane defaults
	if (typeof Memory.time == "undefined") Memory.time = {};
	if (typeof Memory.time.lastTickMillis == "undefined") Memory.time.lastTickMillis = millis - 1010;
	if (typeof Memory.time.lastTickTime == "undefined") Memory.time.lastTickTime = 1.01;
	if (typeof Memory.time.tickTimeCount == "undefined") Memory.time.tickTimeCount = 0;
	if (typeof Memory.time.tickTimeTotal == "undefined") Memory.time.tickTimeTotal = 0;

	let lastTickMillis: number = Number(Memory.time.lastTickMillis);
	let tickTimeCount: number = Number(Memory.time.tickTimeCount);
	let tickTimeTotal: number = Number(Memory.time.tickTimeTotal);

	if (tickTimeCount >= (tickSamples - 1)) {
		tickTimeTotal += millis - lastTickMillis;
		tickTimeCount++;
		let tickTime: number = (tickTimeTotal / tickTimeCount) / 1000;
		log("Calculated tickTime as " + tickTime + " from " + tickTimeCount + "samples.");
		Memory.time.lastTickTime = tickTime;
		Memory.time.tickTimeTotal = millis - lastTickMillis;
		Memory.time.tickTimeCount = 1;
		Memory.time.lastTickMillis = millis;
	} else {
		global.tickTime = Number(Memory.time.lastTickTime);
		tickTimeTotal += millis - lastTickMillis;
		Memory.time.tickTimeTotal = tickTimeTotal;
		tickTimeCount++;
		Memory.time.tickTimeCount = tickTimeCount;
		Memory.time.lastTickMillis = millis;
	}
	return 'Done';
}
