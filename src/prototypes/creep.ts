import { log } from '../functions/utils/globals';
import { pathing } from '../functions/utils/constants';
import * as FUNC from '@functions/index';
import SmartNavigator from "@modules/SmartNavigator";

const globalRouteCache: Record<string, RoomRoute | ERR_NO_PATH | ERR_INVALID_ARGS> = {};

Object.defineProperty(Creep.prototype, 'storeSize', {
	get: function () {
		if (!this._storeSize) {
			this._storeSize = this.getActiveBodyparts(CARRY) * 50;
		}
		return this._storeSize;
	},
	enumerable: false,
	configurable: true
});

Creep.prototype.log = function (message: string, critical: boolean = false): void {
	try {
		if (!critical) return console.log(`${this.room.link()}<span style="color: green;">${this.name}></span> ${message}`);
		else return console.log(`${this.room.link()}<span style="color: green;">${this.name}></span><span style="color: red;"> ${message}</span>`);
	} catch (e) {
		console.log(`Execution Error In Function: Creep.log(message, critical) on Tick ${Game.time}. Error: ${e}`);
	}
}

Creep.prototype.smartMoveTo = function (target: RoomPosition | { pos: RoomPosition },
	opts: MoveToOpts = {}): ScreepsReturnCode {
	try {
		const pos = target instanceof RoomPosition ? target : target.pos;

		// Get next navigation step (may be exit toward unseen room)
		const next = SmartNavigator.getNextStep(this, pos);
		if (!next) return ERR_NO_PATH;

		// Record intent for TrafficManager
		this.memory.moveIntent = { to: next };
		global.TrafficIntents.push({
			creep: this,
			from: this.pos,
			to: next,
			priority: 50,
			opts
		});

		return OK;
	} catch (e) {
		console.log(`Execution Error In Function: Creep.smartMoveTo(target, opts) on Tick ${Game.time}. Creep: ${this.name}. Error: ${e}`);
		return ERR_NO_PATH;
	}
};

Creep.prototype.advGet = function (target: Source | Id<Source> | Mineral | Id<Mineral> | Deposit | Id<Deposit> | AnyStoreStructure | Resource | Tombstone | Ruin | Id<AnyStoreStructure> | Id<Resource> | Id<Tombstone> | Id<Ruin>): ScreepsReturnCode {
	try {
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
	} catch (e) {
		console.log(`Execution Error In Function: Creep.advGet(target) on Tick ${Game.time}. Creep: ${this.name}. Error: ${e}`);
		return ERR_INVALID_ARGS;
	}
}

Creep.prototype.advGet = function (target: Source | Mineral | Deposit | AnyStoreStructure | Resource | Tombstone | Ruin , pathing?: MoveToOpts, resource?: ResourceConstant, canTravel?: boolean): ScreepsReturnCode {
	try {
		let finalTarget;
		if (canTravel === undefined)
			canTravel = true;

		if (!resource) {
			if (finalTarget instanceof StructureContainer || finalTarget instanceof StructureStorage || finalTarget instanceof StructureLink || finalTarget instanceof StructureLab || finalTarget instanceof StructureTower || finalTarget instanceof Tombstone || finalTarget instanceof Ruin) {
				const finalTargetResources = Object.keys(finalTarget.store) as ResourceConstant[];
				resource = finalTargetResources[0];
			} else if (finalTarget instanceof Resource) {
				resource = finalTarget.resourceType;
			} else {
				this.log(`Error: Invalid args`);
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
	} catch (e) {
		console.log(`Execution Error In Function: Creep.advGet(target, pathing, resource, canTravel) on Tick ${Game.time}. Creep: ${this.name}. Error: ${e}`);
		return ERR_INVALID_ARGS;
	}
}

Creep.prototype.advGive = function (target: Creep | AnyStoreStructure | Id<AnyStoreStructure>, pathing?: MoveToOpts, resource?: ResourceConstant, canTravel?: boolean): ScreepsReturnCode {
	try {
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
	} catch (e) {
		console.log(`Execution Error In Function: Creep.advGive(target, pathing, resource, canTravel) on Tick ${Game.time}. Creep: ${this.name}. Error: ${e}`);
		return ERR_INVALID_ARGS;
	}
}

Creep.prototype.advHarvest = function () {
	try {
		let locality: 'local' | 'remote' = 'local';

		if (this.memory.role === 'remoteharvester')
			locality = 'remote';

		if (!this.memory.source)
			this.memory.source = this.assignHarvestSource(locality, true, true);

		const source = Game.getObjectById(this.memory.source) as Source;

		const result = this.harvest(source);
		if (result === ERR_NOT_IN_RANGE)
			this.moveTo(source, pathing.harvesterPathing);
		else if (result === OK) {
			this.hasWorked = true;
			const energyHarvested = Math.min(this.getActiveBodyparts(WORK) * HARVEST_POWER, source.energy);
			this.room.memory.stats.energyHarvested += energyHarvested;

			this.say('⛏️' + energyHarvested)
		}
		else log(`${this.room.link()}, ${this.name}: Harvest failed, result: ${result}`);
	} catch (e) {
		console.log(`Execution Error In Function: Creep.advHarvest() on Tick ${Game.time}. Creep: ${this.name}. Error: ${e}`);
	}
}

/**
 * Advanced movement funcion that allows creeps to navigate locally via direct movement, or cross-room based on destination room direction, and as such
 * does not rely on having sight in the destination location. Can optionally enable PathFinder based mvoement. Caches exit routes in heap, recaching every 100 ticks
 * or when needed.
 * @param target RoomObject, RoomPosition, or pos: RoomPosition property where creep is going
 * @param pathFinder Boolean flag to use PathFinder for cross-room navigation, avoiding hostile rooms and other dangers. Local navigation does not make sure of this either way.
 * @param opts MoveToOpts array that can be passed to PathFinder or other default movement functions
 * @returns Returns standard ScreepsReturnCode
 */
Creep.prototype.advMoveTo = function (target: RoomObject | { pos: RoomPosition } | RoomPosition, opts: MoveToOpts = {}, pathFinder = false): ScreepsReturnCode {
	try {
		const targetPos = target instanceof RoomPosition ? target : target.pos;

		// local navigation
		if (this.room.name === targetPos.roomName) {
			return this.moveTo(targetPos, opts);
		}

		// cross-room navigation without PathFinder
		if (!pathFinder) {
			const exitDir = Game.map.findExit(this.room, targetPos.roomName);
			if (typeof exitDir !== 'number') return exitDir; // error code

			const exit = this.pos.findClosestByRange(exitDir as FindConstant);
			if (!exit) return ERR_NO_PATH;

			return this.moveTo(exit, opts);
		}

		// multi-room navigation with PathFinder
		const routeKey = `${this.room.name}->${targetPos.roomName}`;
		let route = globalRouteCache[routeKey];

		// if route missing or outdated, recalculate
		if (!route || Game.time % 200 === 0) {
			route = Game.map.findRoute(this.room.name, targetPos.roomName, {
				routeCallback(roomName) {
					// Example of optional cost modifiers (e.g., avoid enemy rooms)
					const room = Game.rooms[roomName];
					if (room && room.controller && room.controller.owner && !room.controller.my) {
						return 5; // Higher cost for hostile rooms
					}
					return 1;
				},
			});
			globalRouteCache[routeKey] = route;
		}

		if (route === ERR_NO_PATH || route === ERR_INVALID_ARGS) {
			return route;
		}

		// Get next step in the route
		const nextRoom = route[0]?.room;
		if (!nextRoom) return ERR_NO_PATH;

		// Move toward the exit leading to next room
		const exitDir = Game.map.findExit(this.room, nextRoom);
		if (typeof exitDir !== 'number') return exitDir;

		//if (exitDir < 0) return ERR_INVALID_TARGET; // error code
		const exit = this.pos.findClosestByRange(exitDir as FindConstant);

		if (!exit) return ERR_NO_PATH;

		return this.moveTo(exit, opts);
	} catch (e) {
		console.log(`Execution Error In Function: Creep.advMoveTo(target, opts, pathFinder) on Tick ${Game.time}. Creep: ${this.name}. Error: ${e}`);
		return ERR_NO_PATH;
	}
};

Creep.prototype.reassignSource = function (locality: Locality = 'local', sourceTwo = false) {
	try {
		const homeRoom = Game.rooms[this.memory.home];

		let sourceID;
		let containerID;

		if (locality === 'local') {
			if (!sourceTwo) {
				if (homeRoom.memory.data.sourceData) {
					if (homeRoom.memory.data.sourceData.source.length)
						sourceID = homeRoom.memory.data.sourceData.source[0];
					if (homeRoom.memory.data.sourceData.container.length)
						containerID = homeRoom.memory.data.sourceData.container[0];

				} else {
					if (homeRoom.memory.objects)
						sourceID = homeRoom.memory.objects.sources![0];
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
					if (homeRoom.memory.objects.sources!.length > 1) {
						if (homeRoom.memory.objects)
							sourceID = homeRoom.memory.objects.sources![1];
						if (homeRoom.memory.containers.sourceTwo)
							containerID = homeRoom.memory.containers.sourceTwo;

					} else {
						return false;
					}
				}
			}
		}
		if (locality === 'remote') {
			if (!sourceTwo) {
				if (homeRoom.memory.data.sourceData) {
					if (homeRoom.memory.data.sourceData.source.length)
						sourceID = homeRoom.memory.data.sourceData.source[0];
					if (homeRoom.memory.data.sourceData.container.length)
						containerID = homeRoom.memory.data.sourceData.container[0];

				} else {
					if (homeRoom.memory.objects)
						sourceID = homeRoom.memory.objects.sources![0];
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
					if (homeRoom.memory.objects.sources!.length > 1) {
						if (homeRoom.memory.objects)
							sourceID = homeRoom.memory.objects.sources![1];
						if (homeRoom.memory.containers.sourceTwo)
							containerID = homeRoom.memory.containers.sourceTwo;

					} else {
						return false;
					}
				}
			}
		}

		this.memory.source = sourceID;
		this.memory.bucket = containerID;
		return true;
	} catch (e) {
		console.log(`Execution Error In Function: Creep.reassignSource(locality, sourceTwo) on Tick ${Game.time}. Creep: ${this.name}. Error: ${e}`);
		return false;
	}
}

/**
 * Set a creep's 'source' and 'bucket' memory values
 * @param locality "local" or "remote", defaults to "local"
 * @param simpleAssignment Which assignment algorithm to use. Currently only simpleAssignment = true works properly
 * @param returnID If true, function returns a source ID, rather than the Source object directly
 */
Creep.prototype.assignHarvestSource = function (locality: Locality = "local", simpleAssignment = false, returnID = false): Source | Id<Source> {
	try {
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
	} catch (e) {
		console.log(`Execution Error In Function: Creep.assignHarvestSource(locality, simpleAssignment, returnID) on Tick ${Game.time}. Creep: ${this.name}. Error: ${e}`);
		return this.room.find(FIND_SOURCES)[0]?.id;
	}
}

/**
 * Advanced harvesting function, does not require parameters.
 * Instead, it attempts to use a creep's memory value for 'source', or locate one on its own.
 */
Creep.prototype.harvestEnergy = function (): void {
	try {
		const locality = (this.memory.role === 'remoteharvester') ? 'remote' : 'local';

		if (this.memory.source === undefined)
			this.memory.source = this.assignHarvestSource(locality, true, true);

		this.room.memory.stats ??= { energyHarvested: 0, energyDeposited: 0, constructionPoints: 0, controlPoints: 0, controllerLevelReached: 0, creepsSpawned: 0, creepPartsSpawned: 0, npcInvadersKilled: 0, hostilePlayerCreepsKilled: 0 };
		const sourceId: Id<Source> = this.memory.source;
		const storedSource: Source | null = Game.getObjectById(sourceId);

		if (storedSource) {
			if (this.pos.isNearTo(storedSource)) {
				if (storedSource.energy == 0) {
					if (this.store.getUsedCapacity() > 0) {
						this.unloadEnergy();
						this.harvest(storedSource);
						this.room.memory.stats.energyHarvested += (this.getActiveBodyparts(WORK) * 2);
					} else this.say('🚬');
				} else {
					this.harvest(storedSource);
					this.room.memory.stats.energyHarvested += (this.getActiveBodyparts(WORK) * 2);
				}
			} else {
				if (this.room.name === storedSource.room.name)
					this.moveTo(storedSource, pathing.harvesterPathing);
				else
					this.moveTo(Game.flags[storedSource.room.name]);
			}
		}
	} catch (e) {
		console.log(`Execution Error In Function: Creep.harvestEnergy() on Tick ${Game.time}. Creep: ${this.name}. Error: ${e}`);
	}
}

Creep.prototype.unloadEnergy = function (bucketID?: Id<AnyStoreStructure>): void {
	try {
		if (this.spawning) return;

		const memBucket: Id<AnyStoreStructure> = this.memory?.bucket;
		let memBucketObj: AnyStoreStructure | null = Game.getObjectById(memBucket);
		if (this.memory.bucket)
			memBucketObj = Game.getObjectById(memBucket);

		const bucket: AnyStoreStructure | null = (bucketID) ? Game.getObjectById(bucketID) : memBucketObj;

		if (bucket) {
			if (bucket.hits == bucket.hitsMax) {
				const result = this.transfer(bucket, RESOURCE_ENERGY);
				if (result === OK) {
					this.say('⬇️');
					return;
				} else if (result === ERR_NOT_IN_RANGE) {
					this.moveTo(bucket, pathing.harvesterPathing);
					this.say('⏩');
					return;
				} else {
					if (Memory.globalSettings.debug && Memory.globalSettings.debug.creepDebug)
						console.log(`${this.room.link()}${this.name}: ERROR: ${FUNC.getReturnCode(result)}`);
				}
			}
			else {
				this.say('🔧');
				this.repair(bucket);
			}
			return;
		} else {
			const sourceTarget: Source = Game.getObjectById(this.memory.source) as unknown as Source;
			const sourceContainers: Array<StructureLink | StructureStorage | StructureContainer> = sourceTarget.pos.findInRange(FIND_STRUCTURES, 3, { filter: (obj) => (obj.structureType == STRUCTURE_LINK || obj.structureType == STRUCTURE_STORAGE || obj.structureType == STRUCTURE_CONTAINER)/* && obj.pos.isNearTo(this)*/ });
			const nearbyObj: StructureLink | StructureContainer | StructureStorage = sourceContainers[0];

			if (!nearbyObj) {
				if (this.drop(RESOURCE_ENERGY) === OK) {
					this.say('🗑️');
					console.log(`${this.room.link()} Harvester '${this.name}' dropped energy.`);
				}
				return;
			} else {
				this.memory.bucket = nearbyObj.id;
				if (nearbyObj.hits == nearbyObj.hitsMax) {
					if (this.pos.isNearTo(nearbyObj)) {
						this.say('⬇️');
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
	} catch (e) {
		console.log(`Execution Error In Function: Creep.unloadEnergy(bucketID) on Tick ${Game.time}. Creep: ${this.name}. Error: ${e}`);
	}
}

Creep.prototype.cacheLocalObjects = function (): void {
	try {
		this.room.cacheObjects();
	} catch (e) {
		console.log(`Execution Error In Function: Creep.cacheLocalObjects() on Tick ${Game.time}. Creep: ${this.name}. Error: ${e}`);
	}
}

Creep.prototype.executeDirective = function (): boolean {
	try {
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
	} catch (e) {
		console.log(`Execution Error In Function: Creep.executeDirective() on Tick ${Game.time}. Creep: ${this.name}. Error: ${e}`);
		return false;
	}
}

Creep.prototype.assignLogisticalPair = function (): boolean {

	try {
		if (!this.room.memory.data) this.room.initRoom();
		if (this.room.memory.data.logisticalPairs === undefined) this.room.registerLogisticalPairs();
		if (this.room.memory.data.pairCounter === undefined) this.room.memory.data.pairCounter = 0;

		const assignedPair: LogisticsPair = this.room.memory.data.logisticalPairs[this.room.memory.data.pairCounter];

		this.room.memory.data.pairCounter += 1;

		if (this.room.memory.data.pairCounter >= this.room.memory.data.logisticalPairs.length)
			this.room.memory.data.pairCounter = 0;

		if (this.room.memory.data.logisticalPairs.length == 0) {
			console.log(this.room.link() + 'No pairs available to assign. Set \'none\'.');
			return false;
		} else if (!assignedPair) {
			console.log(this.room.link() + 'No pairs to assign.');
			return false;
		}
		else if (assignedPair) {
			this.memory.pickup = assignedPair.source;
			const pickupObject = Game.getObjectById(assignedPair.source);
			this.memory.pickupPos = pickupObject instanceof RoomObject ? pickupObject.pos : undefined;
			this.memory.dropoff = assignedPair.destination;
			this.memory.dropoffPos = Game.getObjectById(assignedPair.destination)!.pos;
			this.memory.cargo = assignedPair.resource;
			this.memory.pathLength = assignedPair.distance;
			this.memory.locality = assignedPair.locality;
			if (assignedPair.descriptor === 'storage to upgrader')
				this.memory.limiter = true;
			else
				this.memory.limiter = false;

			console.log(this.room.link() + 'Assigned pair (PICKUP: ' + assignedPair.source + ') | (DROPOFF: ' + assignedPair.destination + ') | (CARGO: ' + assignedPair.resource + ') | (LOCALITY: ' + assignedPair.locality + ')');
			return true;
		} else {
			console.log(this.room.link() + 'Unable to assign pair for creep \'' + this.name + '\'.');
			return false;
		}
	} catch (e: any) {
		console.log(e);
		console.log(e.stack);
		return false;
	}
}
