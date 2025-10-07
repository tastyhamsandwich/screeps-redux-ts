import { log } from '../utils/globalFuncs';
import { pathing } from '../utils/constants';

declare global {
	interface Creep {
		advGet(target: Source | Id<Source> | Mineral | Id<Mineral> | Deposit | Id<Deposit> | AnyStoreStructure | Resource | Tombstone | Ruin | Id<AnyStoreStructure> | Id<Resource> | Id<Tombstone> | Id<Ruin>): ScreepsReturnCode;
		advGive(target: Creep | AnyStoreStructure | Id<AnyStoreStructure>, pathing?: MoveToOpts, resource?: ResourceConstant, canTravel?: boolean): ScreepsReturnCode;
		advHarvest(): void;
		reassignSource(sourceTwo: boolean): boolean;
		assignHarvestSource(simpleAssignment: boolean, returnID: boolean): Source | Id<Source>;
		harvestEnergy(): void;
		unloadEnergy(bucketID?: Id<AnyStoreStructure>): void;
		cacheLocalObjects(): void;
		cacheLocalOutpost(): void;
		executeDirective(): boolean;
		hasWorked: boolean;
	}
}

// Prevent prototype augmentation from executing in non-Screeps (node/mocha) environments.
if (typeof Creep !== 'undefined') {

	Creep.prototype.advGet = function (target: Source | Id<Source> | Mineral | Id<Mineral> | Deposit | Id<Deposit> | AnyStoreStructure | Resource | Tombstone | Ruin | Id<AnyStoreStructure> | Id<Resource> | Id<Tombstone> | Id<Ruin>): ScreepsReturnCode {

		let finalTarget;
		let result;
		if (typeof target === 'string') {
			finalTarget = Game.getObjectById(target);

			if (!finalTarget) return ERR_INVALID_TARGET;
		}

		if (finalTarget instanceof Resource) {
			result = this.pickup(finalTarget);
			if (result === ERR_NOT_IN_RANGE) {
				this.moveTo(finalTarget, pathing);
				return result;
			} else return result;
		} else if (finalTarget instanceof Source || finalTarget instanceof Mineral || finalTarget instanceof Deposit) {
			result = this.harvest(finalTarget);
			if (result === ERR_NOT_IN_RANGE) {
				this.moveTo(finalTarget, pathing);
				return result;
			} else return result;
		} else {
			result = this.withdraw(finalTarget, RESOURCE_ENERGY);
			if (result === ERR_NOT_IN_RANGE) {
				this.moveTo(finalTarget, pathing);
				return result;
			} else if (result === ERR_NOT_ENOUGH_RESOURCES) {
				let r = 0;
				const finalTargetResources = Object.keys(finalTarget.store) as ResourceConstant[];
				let result = this.withdraw(finalTarget, finalTargetResources[r]);
				while (result === ERR_NOT_ENOUGH_RESOURCES) {
					r++;
					result = this.withdraw(finalTarget, finalTargetResources[r]);
				}
				if (result === ERR_NOT_IN_RANGE) {
					this.moveTo(finalTarget, pathing);
					return result;
				} else return result;
			}
		}
		return result;
	}

	Creep.prototype.advGet = function (target: Source | Id<Source> | Mineral | Id<Mineral> | Deposit | Id<Deposit> | AnyStoreStructure | Resource | Tombstone | Ruin | Id<AnyStoreStructure> | Id<Resource> | Id<Tombstone> | Id<Ruin>, pathing?: MoveToOpts, resource?: ResourceConstant, canTravel?: boolean): ScreepsReturnCode {

		let finalTarget;
		if (canTravel === undefined)
			canTravel = true;

		if (typeof target === 'string') {
			finalTarget = Game.getObjectById(finalTarget);

			if (!finalTarget) return ERR_INVALID_TARGET;
		}

		if (!resource) {
			if (finalTarget instanceof StructureContainer || finalTarget instanceof StructureStorage || finalTarget instanceof StructureLink || finalTarget instanceof StructureLab || finalTarget instanceof Tombstone || finalTarget instanceof Ruin) {
				const finalTargetResources = Object.keys(finalTarget.store) as ResourceConstant[];
				resource = finalTargetResources[0];
			} else if (finalTarget instanceof Resource) {
				resource = finalTarget.resourceType;
			} else {
				return ERR_INVALID_ARGS;
			}
		}

		if (finalTarget instanceof Resource) {
			if (this.pickup(finalTarget) === ERR_NOT_IN_RANGE) {
				if (canTravel)
					this.moveTo(finalTarget, pathing);
				else
					return ERR_NOT_IN_RANGE;
			} else return OK;
		} else if (finalTarget instanceof Source || finalTarget instanceof Mineral || finalTarget instanceof Deposit) {
			if (this.harvest(finalTarget) === ERR_NOT_IN_RANGE) {
				if (canTravel)
					this.moveTo(finalTarget, pathing);
				else
					return ERR_NOT_IN_RANGE;
			} else return OK;
		} else {
			if (this.withdraw(finalTarget, resource) === ERR_NOT_IN_RANGE) {
				if (canTravel) {
					this.moveTo(finalTarget, pathing);
					return OK
				}
				else
					return ERR_NOT_IN_RANGE;
			} else return OK;
		}
		return OK;
	}

	Creep.prototype.advGive = function (target: Creep | AnyStoreStructure | Id<AnyStoreStructure>, pathing?: MoveToOpts, resource?: ResourceConstant, canTravel?: boolean): ScreepsReturnCode {

		let finalTarget;
		if (canTravel === undefined)
			canTravel = true;

		if (typeof target === 'string') {
			finalTarget = Game.getObjectById(target) as unknown as Id<AnyStoreStructure>;

			if (!target) return ERR_INVALID_TARGET;
		}

		if (!resource) {
			const targetResources = Object.keys(this.store) as ResourceConstant[];
			resource = targetResources[0];
		} else
			return ERR_INVALID_ARGS;

		if (this.transfer(finalTarget, resource) === ERR_NOT_IN_RANGE) {
			if (canTravel)
				this.moveTo(finalTarget, pathing);
			else
				return ERR_NOT_IN_RANGE;
		} else return OK;
		return OK;
	}

	Creep.prototype.advHarvest = function () {

		if (!this.memory.source)
			this.memory.source = this.assignHarvestSource(true, true);

		const source = Game.getObjectById(this.memory.source) as Source;

		if (this.harvest(source) === ERR_NOT_IN_RANGE)
			this.moveTo(source);
		else if (this.harvest(source) === OK) {
			this.hasWorked = true;
			const energyHarvested = Math.min(this.getActiveBodyparts(WORK) * HARVEST_POWER, source.energy);
			(Memory.stats.energyHarvested as number) += energyHarvested;

			this.say('⛏️' + energyHarvested)
		}
	}

	Creep.prototype.reassignSource = function (sourceTwo = false) {

		const homeRoom = Game.rooms[this.memory.home];

		let sourceID;
		let containerID;

		if (!sourceTwo) {
			if (homeRoom.memory.data.sourceData) {
				if (homeRoom.memory.data.sourceData.source.length)
					sourceID = homeRoom.memory.data.sourceData.source[0];
				if (homeRoom.memory.data.sourceData.container.length)
					containerID = homeRoom.memory.data.sourceData.container[0];

			} else {
				if (homeRoom.memory.objects)
					sourceID = homeRoom.memory.objects.sources[0];
				if (homeRoom.memory.containers.sourceOne)
					containerID = homeRoom.memory.containers.sourceOne;

			}
		} else {
			if (homeRoom.memory.data.sourceData) {
				if (homeRoom.memory.data.sourceData.source.length > 1)
					sourceID = homeRoom.memory.data.sourceData.source[1];
				if (homeRoom.memory.data.sourceData.container.length > 1)
					containerID = homeRoom.memory.data.sourceData.container[1];

			} else {
				if (homeRoom.memory.objects.sources.length > 1) {
					if (homeRoom.memory.objects)
						sourceID = homeRoom.memory.objects.sources[1];
					if (homeRoom.memory.containers.sourceTwo)
						containerID = homeRoom.memory.containers.sourceTwo;

				} else {
					return false;
				}
			}
		}

		this.memory.source = sourceID;
		this.memory.bucket = containerID;
		return true;
	}

	Creep.prototype.assignHarvestSource = function (simpleAssignment = false, returnID = false): Source | Id<Source> {

		const room = this.room;

		if (simpleAssignment) {
			const numHarvesters = this.room.find(FIND_MY_CREEPS, { filter: (i) => i.memory.role === 'harvester'}).length;

			let sourceID;
			let source;
			if (numHarvesters % 2)
				source = this.room.find(FIND_SOURCES)[0];
			else
				source = this.room.find(FIND_SOURCES)[1];

				sourceID = source.id;
				this.memory.source = sourceID;

				if (returnID)
					return sourceID;
				else
					return source;

		} else {

			const sourceOne = room.find(FIND_SOURCES)[0] || null;
			const sourceTwo = room.find(FIND_SOURCES)[1] || null;

			let workPartsNeededOnOne = 5;
			const sourceOneCreeps: Creep[] = room.find(FIND_CREEPS).filter((c) => c.my && c.memory.role === 'harvester' && c.memory.source === sourceOne.id);

			for (const creep of sourceOneCreeps)
				workPartsNeededOnOne -= creep.getActiveBodyparts(WORK);

			if (workPartsNeededOnOne >= 0) {
				this.memory.source = sourceOne.id;
				if (returnID)
					return sourceOne.id;
				else
					return sourceOne;
			}
			else {

				let workPartsNeededOnTwo = 5;

				const sourceTwoCreeps: Creep[] = room.find(FIND_CREEPS).filter((c) => c.my && c.memory.role === 'harvester' && c.memory.source === sourceTwo.id);

				for (const creep of sourceTwoCreeps)
					workPartsNeededOnTwo -= creep.getActiveBodyparts(WORK);

				if (workPartsNeededOnTwo >= 0) {
					this.memory.source = sourceTwo.id;
					if (returnID)
						return sourceTwo.id;
					else
						return sourceTwo;
				}
				else {
					if (returnID)
						return sourceOne.id;
					else
						return sourceOne;
				}
			}
		}
	}

	Creep.prototype.harvestEnergy = function (): void {

		const storedSource: Source = (this.memory.source !== undefined) ? Game.getObjectById(this.memory.source) as unknown as Source : this.assignHarvestSource(true, false) as unknown as Source;

		if (storedSource) {
			if (this.pos.isNearTo(storedSource)) {
				if (storedSource.energy == 0) {
					if (this.store.getUsedCapacity() > 0) {
						this.unloadEnergy();
						this.harvest(storedSource);
					} else this.say('🚬');
				} else this.harvest(storedSource);
			} else {
				if (this.room.name === storedSource.room.name)
					this.moveTo(storedSource, pathing.harvesterPathing);
				else
					this.moveTo(Game.flags[storedSource.room.name]);
			}
		}
	}

	Creep.prototype.unloadEnergy = function (bucketID?: Id<AnyStoreStructure>): void {

		if (this.spawning) return;

		if (bucketID) {
			const bucket = Game.getObjectById(bucketID);
			if (bucket)
				if (bucket.hits == bucket.hitsMax) {
					this.say('⛏️');
					this.transfer(bucket, RESOURCE_ENERGY);
				}
				else {
					this.say('🔧');
					this.repair(bucket);
				}
				return;
		} else {
			if (this.memory.bucket) {
				const id: Id<AnyStoreStructure> = this.memory.bucket;
				const target = Game.getObjectById(id);

				if (target && target.hits == target.hitsMax) {
					this.say('⛏️');
					this.transfer(target, RESOURCE_ENERGY);
				}
				else {
					this.say('🔧');
					this.repair(target as Structure<StructureConstant>);
				}
				return;
			} else {
				const sourceTarget: Source = Game.getObjectById(this.memory.source) as unknown as Source;
				const sourceContainers: Array<StructureLink | StructureStorage | StructureContainer> = sourceTarget.pos.findInRange(FIND_STRUCTURES, 3, { filter: (obj) => (obj.structureType == STRUCTURE_LINK || obj.structureType == STRUCTURE_STORAGE || obj.structureType == STRUCTURE_CONTAINER)/* && obj.pos.isNearTo(this)*/ });
				const nearbyObj: StructureLink | StructureContainer | StructureStorage = sourceContainers[0];

				if (!nearbyObj) {
					if (this.drop(RESOURCE_ENERGY) === OK) {
						this.say('🗑️');
						console.log(`${this.room.link()}Harvester '${this.name}' dropped energy.`);
					}
					return;
				} else {
					this.memory.bucket = nearbyObj.id;
					if (nearbyObj.hits == nearbyObj.hitsMax) {
						if (this.pos.isNearTo(nearbyObj)) {
							this.say('⛏️');
							this.transfer(nearbyObj, RESOURCE_ENERGY);
						} else
							this.moveTo(nearbyObj);
					}
					else {
						this.say('🔧');
						this.repair(nearbyObj);
					}
					return;
				}
			}
		}
	}

	Creep.prototype.cacheLocalObjects = function (): void {
		this.room.cacheObjects();
	}

	Creep.prototype.cacheLocalOutpost = function (): void {

		this.room.cacheObjects();
		const newOutpost = Game.rooms[this.memory.home].memory.outposts[this.room.name];

		if (newOutpost === undefined)
			Game.rooms[this.memory.home].initOutpost(this.room.name);

		newOutpost.sourceIDs = this.room.memory.objects.sources;

		if (this.room.memory.objects.containers.length)
			newOutpost.containerIDs = this.room.memory.objects.containers;

		let controllerPos;
		if (this.room.controller)
			controllerPos = this.room.controller.pos;

		const controllerFlag = this.room.find(FIND_FLAGS, { filter: { name: this.room.name }});

		if (!controllerFlag.length) {
			this.room.createFlag({pos: controllerPos}, this.room.name, COLOR_BLUE, COLOR_WHITE);
			newOutpost.controllerFlag = this.room.name;
		} else {
			newOutpost.controllerFlag = controllerFlag[0].name;
		}


	}

	Creep.prototype.executeDirective = function (): boolean {
		// TODO: Implement directive execution logic here

		const directiveType: string = this.memory.directive?.type;

		switch (directiveType) {
			case 'build':
				const hasWorkParts = this.getActiveBodyparts(WORK) > 0;

				if (!hasWorkParts) {
					console.log(`[${this.room.name}]: No work parts available`);
					return false;
				}

			case 'upgrade':
				break;

			case 'harvest':
				break;

			case 'haul':
				break;

			case 'defend':
				break;

			case 'attack':
				break;

			case 'deposit':
				break;

			case 'rally':
				break;

			case 'repair':
				break;

			case 'boost':
				break;



		}


		return false;
	}

}
