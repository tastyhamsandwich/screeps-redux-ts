import { initGlobal } from './globals';

if (!Memory.globalSettings) initGlobal();
if (!Memory.globalSettings?.creepSettings) Memory.globalSettings!.creepSettings = {};
const cSet = Memory.globalSettings!.creepSettings;

export const STRUCTURE_PRIORITY: { [key in BuildableStructureConstant]?: number } = {
	[STRUCTURE_SPAWN]: 1,
	[STRUCTURE_STORAGE]: 2,
	[STRUCTURE_EXTENSION]: 3,
	[STRUCTURE_TOWER]: 4,
	[STRUCTURE_LINK]: 5,
	[STRUCTURE_TERMINAL]: 6,
	[STRUCTURE_FACTORY]: 7,
	[STRUCTURE_LAB]: 8,
	[STRUCTURE_NUKER]: 9,
	[STRUCTURE_OBSERVER]: 10,
	[STRUCTURE_POWER_SPAWN]: 11,
	[STRUCTURE_ROAD]: 12,
	[STRUCTURE_RAMPART]: 13,
	[STRUCTURE_WALL]: 14
};

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

export const pathing: { [key: string]: MoveToOpts } = {
	builderPathing: {
		visualizePathStyle: { stroke: "#0000ff", opacity: 0.3, lineStyle: "dotted" },
		reusePath: cSet.builder.reusePathValue || 3,
		ignoreCreeps: false //cSet.builder.ignoreCreeps
	},
	defenderPathing: {
		visualizePathStyle: { stroke: "#ff0000", opacity: 0.3, lineStyle: "dashed" },
		reusePath: cSet.defender.reusePathValue || 3,
		ignoreCreeps: false //cSet.defender.ignoreCreeps
	},
	fillerPathing: {
		visualizePathStyle: { stroke: "#44ffaa", opacity: 0.3, lineStyle: "dotted" },
		reusePath: cSet.hauler.reusePathValue || 3,
		ignoreCreeps: false //cSet.filler.ignoreCreeps
	},
	haulerPathing: {
		visualizePathStyle: { stroke: "#880088", opacity: 0.3, lineStyle: "dotted" },
		reusePath: cSet.hauler.reusePathValue || 3,
		ignoreCreeps: false //cSet.hauler.ignoreCreeps
	},
	harvesterPathing: {
		visualizePathStyle: { stroke: "#00ff00", opacity: 0.5, lineStyle: "dashed" },
		reusePath: cSet.harvester.reusePathValue || 3,
		ignoreCreeps: false //cSet.harvester.ignoreCreeps
	},
	remoteBuilderPathing: {
		visualizePathStyle: { stroke: "#ffff00", opacity: 0.3, lineStyle: "dotted" },
		reusePath: cSet.builder.reusePathValue || 3,
		ignoreCreeps: false //cSet.remotebuilder.ignoreCreeps
	},
	remoteHarvesterPathing: {
		visualizePathStyle: { stroke: "#98dd44", opacity: 0.5, lineStyle: "dashed" },
		reusePath: cSet.harvester.reusePathValue || 3,
		ignoreCreeps: false //cSet.remoteharvester.ignoreCreeps
	},
	remoteHaulerPathing: {
		visualizePathStyle: { stroke: "#880088", opacity: 0.3, lineStyle: "dotted" },
		reusePath: cSet.hauler.reusePathValue || 3,
		ignoreCreeps: false //cSet.remotehauler.ignoreCreeps
	},
	repairerPathing: {
		visualizePathStyle: { stroke: "#ff6600", opacity: 0.3, lineStyle: "dotted" },
		reusePath: cSet.repairer.reusePathValue || 3,
		ignoreCreeps: false //cSet.repairer.ignoreCreeps
	},
	reserverPathing: {
		visualizePathStyle: { stroke: "#ffffff", opacity: 0.3, lineStyle: "dashed" },
		reusePath: cSet.reserver.reusePathValue || 3,
		ignoreCreeps: false //cSet.reserver.ignoreCreeps
	},
	upgraderPathing: {
		visualizePathStyle: { stroke: "#ffff00", opacity: 0.3, lineStyle: "dotted" },
		reusePath: cSet.upgrader.reusePathValue || 3,
		ignoreCreeps: false //cSet.upgrader.ignoreCreeps
	},
	rallyPointPathing: {
		visualizePathStyle: { stroke: "#ffffff", opacity: 1.0, lineStyle: "solid" },
		reusePath: Memory.globalSettings!.reusePathValue || 3,
		ignoreCreeps: Memory.globalSettings!.ignoreCreeps
	},
	subordinatePathing: {
		visualizePathStyle: { stroke: '#880000', opacity: 1.0, lineStyle: "dashed" },
		reusePath: Memory.globalSettings!.reusePathValue || 3,
		ignoreCreeps: false
	}
};

/** Is game running in single room simulation */
export const IS_SIM = !!Game.rooms.sim as boolean || !!Game.rooms['sim'];
/** Is game running on the official server */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
export const IS_MMO = !!Game.shard?.name?.startsWith("shard")

/** The name of the account running the code  */
// LEGACY METHOD: export const PLAYER_USERNAME = _.find({ ...Game.structures, ...Game.creeps, ...Game.constructionSites }).owner.username;
export const PLAYER_USERNAME = (
	Object.values(Game.spawns)[0] ||
	Object.values(Game.rooms).find((r) => r.controller?.my)?.controller ||
	Object.values(Game.creeps)[0]
).owner.username;

/** username for the Invader NPCs */
export const INVADER_USERNAME = "Invader"
/** username for Source Keeper NPCs */
export const SOURCE_KEEPER_USERNAME = "Source Keeper"
/** username for the Caravan NPCs & unclaimed ruins */
export const CARAVAN_USERNAME = "Screeps"

/** An array of all minerals */
export const MINERALS_ALL = Object.keys(MINERAL_MIN_AMOUNT) as MineralConstant[]
/** An array of all lab's mineral compounds */
export const COMPOUNDS_ALL = Object.keys(REACTION_TIME) as MineralCompoundConstant[]

/** A map of {@link ScreepsReturnCode} to their string names */
export const RETURN_CODES: Record<ScreepsReturnCode, string> = {
	[OK]: "Ok",
	[ERR_NOT_OWNER]: "Error: Not owner",
	[ERR_NO_PATH]: "Error: No path",
	[ERR_BUSY]: "Error: Busy",
	[ERR_NAME_EXISTS]: "Error: Name exists",
	[ERR_NOT_FOUND]: "Error: Not found",
	[ERR_NOT_ENOUGH_RESOURCES]: "Error: Not enough resources",
	[ERR_INVALID_TARGET]: "Error: Invalid target",
	[ERR_FULL]: "Error: Full",
	[ERR_NOT_IN_RANGE]: "Error: Not in range",
	[ERR_INVALID_ARGS]: "Error: Invalid args",
	[ERR_TIRED]: "Error: Tired",
	[ERR_NO_BODYPART]: "Error: No bodypart",
	[ERR_RCL_NOT_ENOUGH]: "Error: Not enough RCL",
	[ERR_GCL_NOT_ENOUGH]: "Error: Not enough GCL",
}

const MULT_CREEP_FATIGUE_REDUCTION = -2;
const MAX_BUCKET = 10000;
const CREEP_HITS_PER_PART = 100;
const CONSTRUCTION_SITE_STOMP_RATIO = 0.5;
const RANGED_MASS_ATTACK_POWER = { 1: 10, 2: 4, 3: 1 };
const MAX_CPU_PER_TICK = 500;
const CREEP_ACTION_RANGES = {
	attack: 1,
	attackController: 1,
	build: 3,
	claimController: 1,
	dismantle: 1,
	generateSafeMode: 1,
	harvest: 1,
	heal: 1,
	pickup: 1,
	pull: 1,
	rangedAttack: 3,
	rangedHeal: 3,
	rangedMassAttack: 3,
	repair: 3,
	reserveController: 1,
	transfer: 1,
	upgradeController: 3,
	withdraw: 1
};
const MEMORY_SIZE = 2097152;
const MEMORY_INTERSHARD_SIZE = 1024;
const MEMORY_RAW_SEGMENT_SIZE = 100 * 1024;
const MEMORY_RAW_TOTAL_SIZE = 10240;
const POWER_CREEP_HITS_PER_LEVEL = 1000;
const TERRAIN_MASK_PLAIN = 0;
const CREEP_BUILD_RANGE = 3;
const CREEP_RANGED_ATTACK_RANGE = 3;
const CREEP_UPGRADE_RANGE = 3;
const CREEP_REPAIR_RANGE = 3;
const CREEP_RANGED_HEAL_RANGE = 3;
const CREEP_HARVEST_RANGE = 1;
const CREEP_WITHDRAW_RANGE = 1;
const CONST_COST = 0.2;
const LAB_REACT_RANGE = 2;
const LAB_BOOST_RANGE = 1;
const MARKET_MAX_DEALS_PER_TICK = 10;
const CONTROLLER_SIGN_MAX_LENGTH = 100;
const CREEP_NAME_MAX_LENGTH = 100;
const POWER_CREEP_NAME_MAX_LENGTH = 100;
const FLAG_NAME_MAX_LENGTH = 60;
const SPAWN_NAME_MAX_LENGTH = 100;
const SAY_MAX_LENGTH = 10;
const MOVE_POWER = 2;
const ROOM_VIS_MAX_SIZE = 512000;
const MAP_VIS_MAX_SIZE = 1024000;
const ROOM_BOUNDARY_VALUES = { minX: 0, minY: 0, maxX: 49, maxY: 49 };

const SOURCE_GOAL_OWNED = SOURCE_ENERGY_CAPACITY / ENERGY_REGEN_TIME;
const SOURCE_GOAL_NEUTRAL = SOURCE_ENERGY_NEUTRAL_CAPACITY / ENERGY_REGEN_TIME;
const SOURCE_GOAL_KEEPER = SOURCE_ENERGY_KEEPER_CAPACITY / ENERGY_REGEN_TIME;

const SOURCE_HARVEST_PARTS = SOURCE_ENERGY_CAPACITY / HARVEST_POWER / ENERGY_REGEN_TIME;
const SOURCE_HARVEST_PARTS_NEUTRAL = SOURCE_ENERGY_NEUTRAL_CAPACITY / HARVEST_POWER / ENERGY_REGEN_TIME;
const SOURCE_HARVEST_PARTS_KEEPER = SOURCE_ENERGY_KEEPER_CAPACITY / HARVEST_POWER / ENERGY_REGEN_TIME;

const SOURCE_CARRY_PARTS_PER_DISTANCE_OWNED = SOURCE_GOAL_OWNED / CARRY_CAPACITY;
const SOURCE_CARRY_PARTS_PER_DISTANCE_NEUTRAL = SOURCE_GOAL_NEUTRAL / CARRY_CAPACITY;
const SOURCE_CARRY_PARTS_PER_DISTANCE_KEEPER = SOURCE_GOAL_KEEPER / CARRY_CAPACITY;

const RAMPART_UPKEEP = RAMPART_DECAY_AMOUNT / REPAIR_POWER / RAMPART_DECAY_TIME;
const ROAD_UPKEEP = ROAD_DECAY_AMOUNT / REPAIR_POWER / ROAD_DECAY_TIME;
const ROAD_UPKEEP_SWAMP = (ROAD_DECAY_AMOUNT * CONSTRUCTION_COST_ROAD_SWAMP_RATIO) / REPAIR_POWER / ROAD_DECAY_TIME;
const ROAD_UPKEEP_TUNNEL = (ROAD_DECAY_AMOUNT * CONSTRUCTION_COST_ROAD_WALL_RATIO) / REPAIR_POWER / ROAD_DECAY_TIME;
const CONTAINER_UPKEEP = CONTAINER_DECAY / REPAIR_POWER / CONTAINER_DECAY_TIME_OWNED;
const REMOTE_CONTAINER_UPKEEP = CONTAINER_DECAY / REPAIR_POWER / CONTAINER_DECAY_TIME;

const IS_PTR = !!(Game.shard && Game.shard.ptr);
