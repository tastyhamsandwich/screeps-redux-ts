import { PART_COST } from "@utils/constants";

/* declare global {
	interface Global {
		splitRoomName(roomName: string): [string, number, string, number];
		roomExitsTo(roomName: string, direction: DirectionConstant | number | string): string;
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
		log(): void;
		capitalize(string: string): string;
		tickTime: number;
		PART_COST: Record<BodyPartConstant, number>;
		pathing: { [key: string]: any };
	}
} */

let controllerPPTArray: number[] = [];
let controllerProgress: number = 0;

export function splitRoomName(roomName: string): [string, number, string, number] {
	const match = roomName.match(/([ENSW])(\d+)([ENSW])(\d+)/);
	if (!match) {
		throw new Error('Invalid room name format');
	}

	return [match[1], parseInt(match[2]), match[3], parseInt(match[4])];
}

export function roomExitsTo(roomName: string, direction: DirectionConstant | number | string): string {
	const validated = validateRoomName(roomName);

	if (!validated) {
		log(`Room name failed validation test. Check Room Name and try again.`, false);
		log(`Examples: (ExxSyy | WxxNyy) (E32N15 | E5S33 | W1S5 | W42N1)`, false);
		return '';
	}
	if (typeof direction === 'string')
		direction.toLowerCase();

	const splitName = splitRoomName(roomName);

	let newRoomNumber: number;

	switch (direction) {
		case TOP:
		case 'north':
		case 1:
			newRoomNumber = splitName[3] + 1;
			if (newRoomNumber > 60) {
				log(`Room number value would exceed hard limit of 60.`, false);
				return '';
			}
			if (splitName[2] === 'S' && splitName[3] === 0)
				return splitName[0] + splitName[1] + 'N' + 0;
			return splitName[0] + splitName[1] + splitName[2] + newRoomNumber;
		case LEFT:
		case 'west':
		case 7:
			newRoomNumber = splitName[1] - 1;
			if (newRoomNumber > 60) {
				log(`Room number value would exceed hard limit of 60.`, false);
				return '';
			}
			if (splitName[0] === 'E' && splitName[1] === 0)
				return 'W' + 0 + splitName[2] + splitName[3];
			return splitName[0] + newRoomNumber + splitName[2] + splitName[3];
		case BOTTOM:
		case 'south':
		case 5:
			newRoomNumber = splitName[3] - 1;
			if (newRoomNumber > 60) {
				log(`Room number value would exceed hard limit of 60.`, false);
				return '';
			}
			if (splitName[2] === 'N' && splitName[3] === 0)
				return splitName[0] + splitName[1] + 'S' + 0;
			return splitName[0] + splitName[1] + splitName[2] + newRoomNumber;
		case RIGHT:
		case 'east':
		case 3:
			newRoomNumber = splitName[1] + 1;
			if (newRoomNumber > 60) {
				log(`Room number value would exceed hard limit of 60.`, false);
				return '';
			}
			if (splitName[0] === 'W' && splitName[1] === 0)
				return 'E' + 0 + splitName[2] + splitName[3];
			return splitName[0] + newRoomNumber + splitName[2] + splitName[3];
		default:
			log(`Error parsing room name '${roomName}'`, false);
			return '';
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
				finalLog += `${room.link()}${logMsg[i]}\n`;
			else
				finalLog += `[<span color='green'>GLOBAL</span>]: ${logMsg[i]}\n`;
		}
		console.log(finalLog);
		return;
	} else if (typeof logMsg === 'string') {
		if (room)
			console.log(`${room.link()}${logMsg}`);
		else
			console.log(`[<span color='green'>GLOBAL</span>]: ${logMsg}`);
		return;
	}
}

/**
 * Creates a flag named after the room at room's center, or at controler if present
 * @author randomencounter
 * @param {string} room The name of the room to create the flag in
 * @return {string | null} Returns either the name of the flag or null if it failed
 */
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

/* export function determineBodyParts(role: string, maxEnergy: number, extras?: { [key: string]: any }): BodyPartConstant[] | undefined {

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
		case 'hauler':

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

} */

/** Initializes global data and settings, and zeroes out Memory first if parameter is true.
 * @param eraseAll Set to true to zero out game Memory
 */
export function initGlobal(eraseAll: boolean = false): boolean {

	// Set parameter flag to 'true' to ensure Game Memory is cleared prior to init
	//if (eraseAll) {
	//for (const key in Memory) {
	//		if (Object.prototype.hasOwnProperty.call(Memory, key))
	//			delete Memory[key];
	//}
	log(`Zeroed out Game Memory object in advance of Global Initialization!`);
	//} else log(`Executing Global Initialization without pre-clearing Game Memory.`);

	if (!Memory.globalSettings) {
		Memory.globalSettings = {
			consoleSpawnInterval: 25,
			alertDisabled: true,
			reusePathValue: 5,
			ignoreCreeps: true,
			basePlanner: {
				ANCHOR_RADIUS: 8
			},
			creepSettings: {
				builder: {
					reusePathValue: 3,
					ignoreCreeps: true
				},
				defender: {
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
				hauler: {
					reusePathValue: 3,
					ignoreCreeps: true
				},
				repairer: {
					reusePathValue: 3,
					ignoreCreeps: true
				},
				reserver: {
					reusePathValue: 3,
					ignoreCreeps: true
				},
				upgrader: {
					reusePathValue: 3,
					ignoreCreeps: true
				},
			}
		}
	}

	if (!Memory.globalSettings.debug) {
		Memory.globalSettings.debug = {
			suspendCreeps: {
				all: false,
				harvester: false,
				filler: false,
				hauler: false,
				upgrader: false,
				builder: false,
				repairer: false,
				defender: false,
				reserver: false,
				scout: false,
				remoteharvester: false,
				worker: false,
				conveyor: false,
				infantry: false
			},
			creepDebug: false,
			dataDebug: false,
			plannerDebug: false,
			spawnDebug: false,
			visualsDebug: false,
		}
	}

	if (!Memory.stats) {
		Memory.stats = {
			totalEnergyHarvested: 0,
		}
	}

	if (!Memory.globalData) {
		Memory.globalData = {
			numColonies: 0,
			onBirthInitComplete: true
		};
	}

	log(`Initialized global settings!`);
	return true;
}

/** Set the reuse value number and ignore creeps flag for a given creep role
 * @param role The Creep role to set for
 * @param reuseValue How many ticks between pathing regenerations
 * @param ignoreCreeps Whether or not the pathing will attempt to navigate around creeps
 * @example
 * setPathingOpts('harvester', 5, false);
 */
export function setPathingOpts(role: string, reuseValue: number = 3, ignoreCreeps: boolean = true): void {

	Memory.globalSettings.creepSettings[role].reusePathValue = reuseValue;
	Memory.globalSettings.creepSettings[role].ignoreCreeps = ignoreCreeps;

	log(`Pathing Settings for '${role}' now set to: Ignore Creeps (${ignoreCreeps}), Reuse Path Value (${reuseValue})`);
	return;
}

/**
 * Calculate the total energy cost of a body array.
 * @param {BodyPartConstant[] | undefined | null} body An array of parts to calculate the cost of.
 * @returns {number} Returns 0 for empty/undefined bodies and ignores unknown parts.
 * @example const bodyCost: number = calcBodyCost([MOVE,MOVE,WORK,WORK,CARRY])
 */
export function calcBodyCost(body: BodyPartConstant[] | undefined | null): number {
    if (!body || body.length === 0) return 0;
    return body.reduce((sum, part) => sum + (PART_COST[part] ?? 0), 0);
}

export function capitalize(string: string): string {
	if (typeof string !== 'string' || string.length === 0) {
		return string; // Handle non-string input or empty strings
	}
	return string.charAt(0).toUpperCase() + string.slice(1);
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

/**
 * Call in the loop for your colony rooms, it will show controller upgrade progress overlay
 *
 * Shows: Current Level, Progress/TotalNeeded (and %), Average Progress Per Tick, and estimated Time to Upgrade
 * @author randomencounter
 * @param {StructureController} controller Room controller used for calculations and visualization display
 * @return {void}
 * @example visualRCProgress(room.controller);
 */
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

	// Initialize settings if they don't exist
	if (!controller.room.memory.settings) {
		controller.room.memory.settings = {} as any;
	}
	if (!controller.room.memory.settings.visualSettings) {
		controller.room.memory.settings.visualSettings = {} as any;
	}
	if (!controller.room.memory.settings.visualSettings.progressInfo) {
		controller.room.memory.settings.visualSettings.progressInfo = {
			fontSize: 0.5,
			xOffset: 0,
			yOffsetFactor: 1,
			stroke: '#000000',
			alignment: 'center',
			color: lvlColor
		} as ProgressInfoSettings;
	}

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
 * Takes a number array as input and returns the average
 * @param {number[]} array The array used for calculation
 * @returns {number[]} The array's average value
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

export function getReturnCode(code: number): string {

	switch (code) {
		case 0:
			return 'OK';
		case -1:
			return 'ERR_NOT_OWNER';
		case -2:
			return 'ERR_NO_PATH';
		case -3:
			return 'ERR_NAME_EXISTS';
		case -4:
			return 'ERR_BUSY';
		case -5:
			return 'ERR_NOT_FOUND';
		case -6:
			return 'ERR_NOT_ENOUGH_RESOURCES';
		case -7:
			return 'ERR_INVALID_TARGET';
		case -8:
			return 'ERR_FULL';
		case -9:
			return 'ERR_NOT_IN_RANGE';
		case -10:
			return 'ERR_INVALID_ARGS';
		case -11:
			return 'ERR_TIRED';
		case -12:
			return 'ERR_NO_BODYPART';
		case -14:
			return 'ERR_RCL_NOT_ENOUGH';
		case -15:
			return 'ERR_GCL_NOT_ENOUGH';
		default:
			return 'UNKNOWN';
	}
}

/** Returns an incremented index value that wraps to zero based on an upper limit value.
 * @param index The index value to increment, typically also what you're calling the function against
 * @param wrapLimit The value that, once reached, causes the index to wrap back to zero
 * @returns The new index value, either index+1 or 0, typically
 * @example arrayIndex = zeroWrap(arrayIndex, array.length) // [a,b,c,d], before index = 3, after index = 0
 */
export function zeroWrap(index: number, wrapLimit: number): number {
	return (index + 1) % wrapLimit;
}
