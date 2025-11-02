import { log } from '../functions/utils/globals';
import { pathing } from '../functions/utils/constants';
import SmartNavigator from "@modules/SmartNavigator";

declare global {

	type RoomRoute = RoomPathStep[];
	interface RoomPathStep {
		room: string;
		exit: ExitConstant;
	}

	type Locality = 'local' | 'remote';
	interface Creep {
		smartMoveTo(target: RoomPosition | { pos: RoomPosition }, opts?: MoveToOpts): ScreepsReturnCode;
		advGet(target: Source | Id<Source> | Mineral | Id<Mineral> | Deposit | Id<Deposit> | AnyStoreStructure | Resource | Tombstone | Ruin | Id<AnyStoreStructure> | Id<Resource> | Id<Tombstone> | Id<Ruin>): ScreepsReturnCode;
		advGive(target: Creep | AnyStoreStructure | Id<AnyStoreStructure>, pathing?: MoveToOpts, resource?: ResourceConstant, canTravel?: boolean): ScreepsReturnCode;
		advHarvest(): void;
		advMoveTo(target: RoomObject | { pos: RoomPosition } | RoomPosition, pathFinder?: boolean, opts?: MoveToOpts): ScreepsReturnCode;
		reassignSource(locality: Locality, sourceTwo: boolean): boolean;
		assignHarvestSource(locality: Locality, simpleAssignment: boolean, returnID: boolean): Source | Id<Source>;
		harvestEnergy(): void;
		unloadEnergy(bucketID?: Id<AnyStoreStructure>): void;
		cacheLocalObjects(): void;
		cacheLocalOutpost(): void;
		executeDirective(): boolean;
		assignLogisticalPair(): boolean;
		hasWorked: boolean;
		movePriority?: number;
		stuckTicks?: number;
	}
}

const globalRouteCache: Record<string, RoomRoute | ERR_NO_PATH | ERR_INVALID_ARGS> = {};

// Prevent prototype augmentation from executing in non-Screeps (node/mocha) environments.
if (typeof Creep !== 'undefined') {

	Creep.prototype.smartMoveTo = function (target: RoomPosition | { pos: RoomPosition },
		opts: MoveToOpts = {}): ScreepsReturnCode {

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
	};

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
	Creep.prototype.advMoveTo = function (target: RoomObject | { pos: RoomPosition } | RoomPosition, pathFinder = false, opts: MoveToOpts = {}): ScreepsReturnCode {
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
	};

	Creep.prototype.reassignSource = function (locality: Locality = 'local', sourceTwo = false) {


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
		}

		this.memory.source = sourceID;
		this.memory.bucket = containerID;
		return true;
	}

	/**
	 * Set a creep's 'source' and 'bucket' memory values
	 * @param locality "local" or "remote", defaults to "local"
	 * @param simpleAssignment Which assignment algorithm to use. Currently only simpleAssignment = true works properly
	 * @param returnID If true, function returns a source ID, rather than the Source object directly
	 */
	Creep.prototype.assignHarvestSource = function (locality: Locality = "local", simpleAssignment = false, returnID = false): Source | Id<Source> {

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

	/**
	 * Advanced harvesting function, does not require parameters.
	 * Instead, it attempts to use a creep's memory value for 'source', or locate one on its own.
	 */
	Creep.prototype.harvestEnergy = function (): void {

		let locality: 'local' | 'remote' = 'local';

		if (this.memory.role === 'remoteharvester')
			locality = 'remote';

		if (this.memory.source === undefined)
			this.memory.source = this.assignHarvestSource(locality, true, true);

		const sourceId: Id<Source> = this.memory.source;
		const storedSource: Source | null = Game.getObjectById(sourceId);

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
				this.memory.pickupPos = Game.getObjectById(assignedPair.source)!.pos;
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
}
