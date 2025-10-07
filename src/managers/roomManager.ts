export default class RoomManager {

	roomName: string;
	room: Room;
	level: number;
	energyCapacity: number;
	creeps?: Creep[];
	creepData?: {
		localHarvesterOne: {
			creep: Creep,
			ttl: number,
			workParts: number,
			carryParts: number,
		},
		localHarvesterTwo: {
			creep: Creep,
			ttl: number,
			workParts: number,
			carryParts: number,
		}
	}
	controller: StructureController;
	sourceOne?: Source;
	sourceTwo?: Source;
	mineral?: Mineral;
	cSites?: ConstructionSite[];
	containers?: StructureContainer[];
	storage?: StructureStorage;
	towers?: StructureTower[];
	spawns?: StructureSpawn[];
	extensions?: StructureExtension[];
	terminal?: StructureTerminal;
	links?: StructureLink[];
	remotes?: Room[];
	settings: { [key: string]: any };

	constructor(roomName: string) {
		this.roomName = roomName;
		this.room = Game.rooms[roomName];
		this.controller = this.room.controller as StructureController;
		this.level = this.controller.level;
		this.energyCapacity = this.room.energyCapacityAvailable;
		this.sourceOne = this.room.find(FIND_SOURCES)[0];
		this.sourceTwo = this.room.find(FIND_SOURCES)[1];
		this.mineral = this.room.find(FIND_MINERALS)[0];
		this.cSites = this.room.find(FIND_CONSTRUCTION_SITES);
		this.containers = this.room.find(FIND_STRUCTURES, { filter: (s) => s.structureType === STRUCTURE_CONTAINER });
		this.towers = this.room.find(FIND_STRUCTURES, { filter: (s) => s.structureType === STRUCTURE_TOWER });
		this.spawns = this.room.find(FIND_STRUCTURES, { filter: (s) => s.structureType === STRUCTURE_SPAWN });
		this.extensions = this.room.find(FIND_STRUCTURES, { filter: (s) => s.structureType === STRUCTURE_EXTENSION });
		this.links = this.room.find(FIND_STRUCTURES, { filter: (s) => s.structureType === STRUCTURE_LINK });

		if (this.room.storage)
			this.storage = this.room.storage as StructureStorage;
		if (this.room.terminal)
			this.terminal = this.room.terminal as StructureTerminal;

		this.settings = {};
		//this.room.memory.settings = this.settings;
		//this.room.memory.data = {};

		if (Memory.globalData === undefined) Memory.globalData = {};
		if (Memory.globalData.colonies === undefined) Memory.globalData.colonies = {};
		if (Memory.globalData.colonies[this.roomName] === undefined) Memory.globalData.colonies[this.roomName] = {};
		if (Memory.globalData.colonyArray === undefined) Memory.globalData.colonyArray = [];
		if (!Memory.globalData.colonyArray.includes(this.roomName)) Memory.globalData.colonyArray.push(this.roomName);
  }


}
