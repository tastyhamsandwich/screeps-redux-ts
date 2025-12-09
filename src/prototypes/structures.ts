import { PLAYER_USERNAME } from "@constants";

Object.defineProperty(Structure.prototype, 'isWalkable', {
	get() {
		return this.structureType == STRUCTURE_ROAD ||
			this.structureType == STRUCTURE_CONTAINER ||
			(this.structureType == STRUCTURE_RAMPART && (<StructureRampart>this.my ||
				<StructureRampart>this.isPublic));
	},
	configurable: true,
});

// Container prototypes ================================================================================================

Object.defineProperty(StructureContainer.prototype, 'energy', {
	get() {
		return this.store[RESOURCE_ENERGY];
	},
	configurable: true,
});

Object.defineProperty(StructureContainer.prototype, 'isFull', { // if this container-like object is full
	get() {
		return _.sum(this.store) >= this.storeCapacity;
	},
	configurable: true,
});
Object.defineProperty(StructureContainer.prototype, 'isEmpty', { // if this container-like object is empty
	get() {
		return _.sum(this.store) == 0;
	},
	configurable: true,
});

// Controller prototypes ===============================================================================================

Object.defineProperty(StructureController.prototype, 'reservedByMe', {
	get: function () {
		return this.reservation && this.reservation.username == PLAYER_USERNAME;
	},
	configurable: true,
});

StructureController.prototype.needsReserving = function (reserveBuffer: number): boolean {
	return !this.reservation || (this.reservedByMe && this.reservation.ticksToEnd < reserveBuffer);
};

// Extension prototypes ================================================================================================

Object.defineProperty(StructureExtension.prototype, 'isFull', { // if this container-like object is full
	get() {
		return this.energy >= this.energyCapacity;
	},
	configurable: true,
});

Object.defineProperty(StructureExtension.prototype, 'isEmpty', { // if this container-like object is empty
	get() {
		return this.energy == 0;
	},
	configurable: true,
});

// Link prototypes =====================================================================================================

Object.defineProperty(StructureLink.prototype, 'isFull', { // if this container-like object is full
	get() {
		return this.energy >= this.energyCapacity;
	},
	configurable: true,
});

Object.defineProperty(StructureLink.prototype, 'isEmpty', { // if this container-like object is empty
	get() {
		return this.energy == 0;
	},
	configurable: true,
});


// Nuker prototypes ====================================================================================================

// PowerSpawn prototypes ===============================================================================================

// Spawn prototypes ====================================================================================================

Object.defineProperty(StructureSpawn.prototype, 'isFull', { // if this container-like object is full
	get() {
		return this.energy >= this.energyCapacity;
	},
	configurable: true,
});

Object.defineProperty(StructureSpawn.prototype, 'isEmpty', { // if this container-like object is empty
	get() {
		return this.energy == 0;
	},
	configurable: true,
});


// Storage prototypes ==================================================================================================

Object.defineProperty(StructureStorage.prototype, 'energy', {
	get() {
		return this.store[RESOURCE_ENERGY];
	},
	configurable: true,
});

Object.defineProperty(StructureStorage.prototype, 'isFull', { // if this container-like object is full
	get() {
		return _.sum(this.store) >= this.storeCapacity;
	},
	configurable: true,
});

Object.defineProperty(StructureStorage.prototype, 'isEmpty', { // if this container-like object is empty
	get() {
		return _.sum(this.store) == 0;
	},
	configurable: true,
});


// Terminal prototypes =================================================================================================

Object.defineProperty(StructureTerminal.prototype, 'energy', {
	get() {
		return this.store[RESOURCE_ENERGY];
	},
	configurable: true,
});

Object.defineProperty(StructureTerminal.prototype, 'isFull', { // if this container-like object is full
	get() {
		return _.sum(this.store) >= this.storeCapacity;
	},
	configurable: true,
});

Object.defineProperty(StructureTerminal.prototype, 'isEmpty', { // if this container-like object is empty
	get() {
		return _.sum(this.store) == 0;
	},
	configurable: true,
});

// Tower prototypes

Object.defineProperty(StructureTower.prototype, 'isFull', { // if this container-like object is full
	get() {
		return this.energy >= this.energyCapacity;
	},
	configurable: true,
});

Object.defineProperty(StructureTower.prototype, 'isEmpty', { // if this container-like object is empty
	get() {
		return this.energy == 0;
	},
	configurable: true,
});

// Tombstone prototypes ================================================================================================
Object.defineProperty(Tombstone.prototype, 'energy', {
	get() {
		return this.store[RESOURCE_ENERGY];
	},
	configurable: true,
});
