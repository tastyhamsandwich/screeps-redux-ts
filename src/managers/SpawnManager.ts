interface SpawnRequest {
	id: string;
	role: string;
	priority: number;
	body: BodyPartConstant[];
	memory: CreepMemory;
	roomName: string;
	urgent: boolean;
	requestedAt: number;
	estimatedSpawnTime?: number;
	energyCost?: number;
}

interface ScheduledSpawn {
	role: string;
	scheduledTick: number;
	duration: number;
	energyCost: number;
	priority: number;
}

interface EnergyForecast {
	currentEnergy: number;
	capacityAvailable: number;
	incomePerTick: number;
	projectedEnergy: (ticks: number) => number;
}

/** SpawnManager - Centralized spawning system that manages spawn requests across all rooms */
export default class SpawnManager {
	private room: Room = null as any;
	private spawnQueue: SpawnRequest[] = [];
	private scheduledSpawns: ScheduledSpawn[] = [];
	private energyForecast: EnergyForecast = null as any;

	// Role priority weights (higher = more important)
	private static ROLE_PRIORITIES: { [role: string]: number } = {
		'harvester': 100,
		'filler': 95,
		'hauler': 90,
		'defender': 85,
		'upgrader': 70,
		'builder': 65,
		'repairer': 60,
		'reserver': 55,
		'remoteharvester': 50,
		'remotebodyguard': 45,
		'remotehauler': 40,
		'scout': 30
	};

	// Roles that should have predictive spawning (spawn replacement before death)
	private static PREDICTIVE_ROLES = ['harvester', 'filler', 'hauler', 'reserver'];

	// Buffer time before creep death to spawn replacement (in ticks)
	private static SPAWN_BUFFER_TIME = 100;

	constructor(room: Room) {
		try {
			this.room = room;
			this.spawnQueue = [];
			this.scheduledSpawns = [];
			this.energyForecast = this.calculateEnergyForecast();

			// Initialize memory structure
			if (!this.room.memory.spawnManager) {
				this.room.memory.spawnManager = {
					queue: [],
					scheduled: [],
					lastProcessed: Game.time
				};
			}

			this.loadFromMemory();
		} catch (e) {
			console.log(`Execution Error In Function: SpawnManager.constructor(${room.name}) on Tick ${Game.time}. Error: ${e}`);
		}
	}

	/** Main run method - called every tick */
	run(): void {
		try {
			this.energyForecast = this.calculateEnergyForecast();
			this.updatePredictiveSpawns();
			this.processQueue();
			this.saveToMemory();
		} catch (e) {
			console.log(`Execution Error In Function: SpawnManager.run() on Tick ${Game.time}. Error: ${e}`);
		}
	}

	/** Submit a spawn request to the manager
	 * @returns true if request was accepted, false if rejected
	 */
	submitRequest(request: Omit<SpawnRequest, 'id' | 'requestedAt' | 'estimatedSpawnTime' | 'energyCost'>): boolean {
		try {
			const fullRequest: SpawnRequest = {
				...request,
				id: `${request.role}_${Game.time}_${Math.random().toString(36).substr(2, 9)}`,
				requestedAt: Game.time,
				estimatedSpawnTime: request.body.length * 3,
				energyCost: this.calculateBodyCost(request.body),
				priority: request.priority || SpawnManager.ROLE_PRIORITIES[request.role] || 50
			};

			// Validate request
			if (!this.validateRequest(fullRequest)) {
				console.log(`[SpawnManager] ${this.room.name}: Rejected request for ${request.role} - validation failed`);
				return false;
			}

			// Check if this would conflict with scheduled spawns
			const conflict = this.checkScheduleConflict(fullRequest);
			if (conflict) {
				console.log(`[SpawnManager] ${this.room.name}: Deferred request for ${request.role} - conflicts with scheduled ${conflict.role}`);
				// Store for later retry
				if (!this.room.memory.spawnManager.deferred)
					this.room.memory.spawnManager.deferred = [];
				this.room.memory.spawnManager.deferred.push(fullRequest);
				return false;
			}

			// Add to queue and sort by priority
			this.spawnQueue.push(fullRequest);
			this.sortQueue();

			console.log(`[SpawnManager] ${this.room.name}: Accepted request for ${request.role} (priority: ${fullRequest.priority})`);
			return true;
		} catch (e) {
			console.log(`Execution Error In Function: SpawnManager.submitRequest(${request.role}) on Tick ${Game.time}. Error: ${e}`);
			return false;
		}
	}

	/** Validates a spawn request */
	private validateRequest(request: SpawnRequest): boolean {
		try {
			// Check if body is valid
			if (!request.body || request.body.length === 0 || request.body.length > 50)
				return false;

			// Check if we can eventually afford this
			if (request.energyCost! > this.room.energyCapacityAvailable)
				return false;

			// Check if role is supported
			if (!request.role)
				return false;

			return true;
		} catch (e) {
			console.log(`Execution Error In Function: SpawnManager.validateRequest() on Tick ${Game.time}. Error: ${e}`);
			return false;
		}
	}

	/** Checks if a spawn request conflicts with scheduled spawns */
	private checkScheduleConflict(request: SpawnRequest): ScheduledSpawn | null {
		try {
			const spawnTime = request.estimatedSpawnTime!;
			const energyCost = request.energyCost!;
			const currentTick = Game.time;

			// Check against all scheduled spawns
			for (const scheduled of this.scheduledSpawns) {
				// Skip if scheduled spawn is in the past
				if (scheduled.scheduledTick + scheduled.duration < currentTick)
					continue;

				// Check if our spawn would overlap with scheduled spawn
				const scheduledEnd = scheduled.scheduledTick + scheduled.duration;
				const ourEnd = currentTick + spawnTime;

				// Time overlap
				const timeConflict = (
					(currentTick >= scheduled.scheduledTick && currentTick <= scheduledEnd) ||
					(ourEnd >= scheduled.scheduledTick && ourEnd <= scheduledEnd) ||
					(currentTick <= scheduled.scheduledTick && ourEnd >= scheduledEnd)
				);

				if (timeConflict) {
					// If scheduled spawn has higher priority, reject this request
					if (scheduled.priority >= request.priority)
						return scheduled;
				}

				// Energy conflict - check if we have enough energy
				const ticksUntilScheduled = scheduled.scheduledTick - currentTick;
				if (ticksUntilScheduled > 0 && ticksUntilScheduled < spawnTime) {
					const energyAtScheduledTime = this.energyForecast.projectedEnergy(ticksUntilScheduled);
					const energyAfterOurSpawn = energyAtScheduledTime - energyCost;

					// If we won't have enough energy for the scheduled spawn, check priorities
					if (energyAfterOurSpawn < scheduled.energyCost && scheduled.priority >= request.priority) {
						return scheduled;
					}
				}
			}

			return null;
		} catch (e) {
			console.log(`Execution Error In Function: SpawnManager.checkScheduleConflict() on Tick ${Game.time}. Error: ${e}`);
			return null;
		}
	}

	/** Updates predictive spawns based on existing creeps */
	private updatePredictiveSpawns(): void {
		try {
			// Clear old scheduled spawns
			this.scheduledSpawns = this.scheduledSpawns.filter(
				s => s.scheduledTick > Game.time - 50
			);

			// Check all creeps that should have predictive spawning
			const creeps = this.room.find(FIND_MY_CREEPS, {
				filter: c => c.memory.home === this.room.name &&
					SpawnManager.PREDICTIVE_ROLES.includes(c.memory.role)
			});

			for (const creep of creeps) {
				// Skip if creep is very young
				if (!creep.ticksToLive || creep.ticksToLive > 1400)
					continue;

				// Calculate when to spawn replacement
				const body = creep.body.map(p => p.type);
				const spawnTime = body.length * 3;
				const deathTick = Game.time + (creep.ticksToLive || 1500);
				const scheduledSpawnTick = deathTick - spawnTime - SpawnManager.SPAWN_BUFFER_TIME;

				// Check if we already have this scheduled
				const alreadyScheduled = this.scheduledSpawns.some(
					s => s.role === creep.memory.role &&
						Math.abs(s.scheduledTick - scheduledSpawnTick) < 50
				);

				if (!alreadyScheduled && scheduledSpawnTick > Game.time) {
					const energyCost = this.calculateBodyCost(body);
					this.scheduledSpawns.push({
						role: creep.memory.role,
						scheduledTick: scheduledSpawnTick,
						duration: spawnTime,
						energyCost: energyCost,
						priority: SpawnManager.ROLE_PRIORITIES[creep.memory.role] || 50
					});
					console.log(`[SpawnManager] ${this.room.name}: Scheduled ${creep.memory.role} replacement in ${scheduledSpawnTick - Game.time} ticks`);
				}
			}
		} catch (e) {
			console.log(`Execution Error In Function: SpawnManager.updatePredictiveSpawns() on Tick ${Game.time}. Error: ${e}`);
		}
	}

	/** Processes the spawn queue and attempts to spawn */
	private processQueue(): void {
		try {
			if (this.spawnQueue.length === 0) {
				// Check deferred requests
				this.retryDeferredRequests();
				return;
			}

			const availableSpawn = this.room.find(FIND_MY_STRUCTURES, {
				filter: s => s.structureType === STRUCTURE_SPAWN && !(s as StructureSpawn).spawning
			})[0] as StructureSpawn | undefined;

			if (!availableSpawn) return;

			const request = this.spawnQueue[0];

			// Check if we can afford this
			if (this.room.energyAvailable < request.energyCost!) {
				// Check if we should wait or skip
				const ticksToAfford = Math.ceil(
					(request.energyCost! - this.room.energyAvailable) / this.energyForecast.incomePerTick
				);

				if (ticksToAfford > 100 || request.urgent) {
					console.log(`[SpawnManager] ${this.room.name}: Insufficient energy for ${request.role}, deferring...`);
					return;
				}
			}

			// Attempt to spawn
			const result = this.attemptSpawn(availableSpawn, request);

			if (result === OK) {
				// Remove from queue
				this.spawnQueue.shift();

				// Add to scheduled spawns (for tracking)
				this.scheduledSpawns.push({
					role: request.role,
					scheduledTick: Game.time,
					duration: request.estimatedSpawnTime!,
					energyCost: request.energyCost!,
					priority: request.priority
				});
			} else if (result === ERR_NOT_ENOUGH_ENERGY) // Wait for more energy
				return;
			else {
				// Other error, remove from queue
				console.log(`[SpawnManager] ${this.room.name}: Failed to spawn ${request.role}: ${result}`);
				this.spawnQueue.shift();
			}
		} catch (e) {
			console.log(`Execution Error In Function: SpawnManager.processQueue() on Tick ${Game.time}. Error: ${e}`);
		}
	}

	/** Attempts to spawn a creep from a request */
	private attemptSpawn(spawn: StructureSpawn, request: SpawnRequest): ScreepsReturnCode {
		try {
			let countMod = 1;
			const roleShorthand = this.getRoleShorthand(request.role);
			let name = `Col1_${roleShorthand}${countMod}`;
			let result = spawn.spawnCreep(request.body, name, { memory: request.memory });

			while (result === ERR_NAME_EXISTS) {
				countMod++;
				name = `Col1_${roleShorthand}${countMod}`;
				result = spawn.spawnCreep(request.body, name, { memory: request.memory });
			}

			if (result === OK) {
				console.log(`[SpawnManager] ${spawn.name}: Spawning ${request.role} ${name} (cost: ${request.energyCost}, time: ${request.estimatedSpawnTime})`);

				// Handle post-spawn logic
				this.handlePostSpawn(request, name);
			}

			return result;
		} catch (e) {
			console.log(`Execution Error In Function: SpawnManager.attemptSpawn(${request.role}) on Tick ${Game.time}. Error: ${e}`);
			return ERR_NOT_ENOUGH_ENERGY;
		}
	}

	/** Handles post-spawn logic for specific roles */
	private handlePostSpawn(request: SpawnRequest, creepName: string): void {
		try {
			if (request.role === 'harvester') {
				const nextHarvesterAssigned = this.room.memory.data?.indices.nextHarvesterAssigned || 0;
				if (this.room.memory.data)
					this.room.memory.data.indices.nextHarvesterAssigned = (nextHarvesterAssigned + 1) % 2;
			/*else if (request.role === 'hauler') {
				// Assign logistical pair for hauler
				const creep = Game.creeps[creepName];
				if (creep && this.room.memory.data?.logisticalPairs)
					creep.assignLogisticalPair();
				else if (creep) {
					this.room.registerLogisticalPairs();
					creep.assignLogisticalPair();
				}*/
			}
		} catch (e) {
			console.log(`Execution Error In Function: SpawnManager.handlePostSpawn(${request.role}, ${creepName}) on Tick ${Game.time}. Error: ${e}`);
		}
	}

	/** Retries deferred requests that may now be feasible */
	private retryDeferredRequests(): void {
		try {
			if (!this.room.memory.spawnManager.deferred || this.room.memory.spawnManager.deferred.length === 0) {
				return;
			}

			const deferred = this.room.memory.spawnManager.deferred;
			this.room.memory.spawnManager.deferred = [];

			for (const request of deferred) {
				// Only retry if not too old
				if (Game.time - request.requestedAt < 100) {
					const conflict = this.checkScheduleConflict(request);
					if (!conflict) {
						this.spawnQueue.push(request);
						console.log(`[SpawnManager] ${this.room.name}: Retrying deferred ${request.role}`);
					} else
						this.room.memory.spawnManager.deferred.push(request);
				}
			}

			if (this.spawnQueue.length > 0)
				this.sortQueue();
		} catch (e) {
			console.log(`Execution Error In Function: SpawnManager.retryDeferredRequests() on Tick ${Game.time}. Error: ${e}`);
		}
	}

	/** Sorts the spawn queue by priority and urgency */
	private sortQueue(): void {
		try {
			this.spawnQueue.sort((a, b) => {
				// Urgent requests first
				if (a.urgent && !b.urgent) return -1;
				if (!a.urgent && b.urgent) return 1;

				// Then by priority
				if (a.priority !== b.priority) return b.priority - a.priority;

				// Finally by request time (older first)
				return a.requestedAt - b.requestedAt;
			});
		} catch (e) {
			console.log(`Execution Error In Function: SpawnManager.sortQueue() on Tick ${Game.time}. Error: ${e}`);
		}
	}

	/** Calculates energy forecast for the room */
	private calculateEnergyForecast(): EnergyForecast {
		try {
			const sources = this.room.find(FIND_SOURCES);
			const harvesters = _.filter(Game.creeps, c =>
				(c.memory.role === 'harvester' || c.memory.RFQ === 'harvester') &&
				c.memory.home === this.room.name
			);

			// Calculate total work parts
			let totalWorkParts = 0;
			for (const harvester of harvesters)
				totalWorkParts += harvester.body.filter(p => p.type === WORK).length;

			// Each work part harvests 2 energy per tick, but sources are limited to 10/tick
			const incomePerTick = Math.min(totalWorkParts * 2, sources.length * 10);

			return {
				currentEnergy: this.room.energyAvailable,
				capacityAvailable: this.room.energyCapacityAvailable,
				incomePerTick: incomePerTick,
				projectedEnergy: (ticks: number) => {
					const projected = this.room.energyAvailable + (incomePerTick * ticks);
					return Math.min(projected, this.room.energyCapacityAvailable);
				}
			};
		} catch (e) {
			console.log(`Execution Error In Function: SpawnManager.calculateEnergyForecast() on Tick ${Game.time}. Error: ${e}`);
			return {
				currentEnergy: 0,
				capacityAvailable: 0,
				incomePerTick: 0,
				projectedEnergy: () => 0
			};
		}
	}

	/** Calculates body cost */
	private calculateBodyCost(body: BodyPartConstant[]): number {
		try {
			return body.reduce((cost, part) => cost + BODYPART_COST[part], 0);
		} catch (e) {
			console.log(`Execution Error In Function: SpawnManager.calculateBodyCost() on Tick ${Game.time}. Error: ${e}`);
			return 0;
		}
	}

	/** Gets role shorthand for naming */
	private getRoleShorthand(role: string): string {
		try {
			const shorthands: { [key: string]: string } = {
				'harvester': 'H',
				'filler': 'F',
				'hauler': 'Hauler',
				'upgrader': 'U',
				'builder': 'B',
				'repairer': 'R',
				'reserver': 'Rsv',
				'remoteharvester': 'RH',
				'remotebodyguard': 'RG',
				'remotehauler': 'RHaul',
				'defender': 'Def',
				'scout': 'Scout'
			};
			return shorthands[role] || role.charAt(0).toUpperCase();
		} catch (e) {
			console.log(`Execution Error In Function: SpawnManager.getRoleShorthand(${role}) on Tick ${Game.time}. Error: ${e}`);
			return "X";
		}
	}

	/** Saves queue state to memory */
	private saveToMemory(): void {
		try {
			this.room.memory.spawnManager.queue = this.spawnQueue;
			this.room.memory.spawnManager.scheduled = this.scheduledSpawns;
			this.room.memory.spawnManager.lastProcessed = Game.time;
		} catch (e) {
			console.log(`Execution Error In Function: SpawnManager.saveToMemory() on Tick ${Game.time}. Error: ${e}`);
		}
	}

	/** Loads queue state from memory */
	private loadFromMemory(): void {
		try {
			if (this.room.memory.spawnManager.queue)
				this.spawnQueue = this.room.memory.spawnManager.queue;
			if (this.room.memory.spawnManager.scheduled)
				this.scheduledSpawns = this.room.memory.spawnManager.scheduled;
		} catch (e) {
			console.log(`Execution Error In Function: SpawnManager.loadFromMemory() on Tick ${Game.time}. Error: ${e}`);
		}
	}

	/** Gets current queue status (for debugging/visualization) */
	getStatus(): {
		queueLength: number;
		scheduledSpawns: number;
		nextSpawn: SpawnRequest | null;
		energyIncome: number;
	} {
		try {
			return {
				queueLength: this.spawnQueue.length,
				scheduledSpawns: this.scheduledSpawns.length,
				nextSpawn: this.spawnQueue[0] || null,
				energyIncome: this.energyForecast.incomePerTick
			};
		} catch (e) {
			console.log(`Execution Error In Function: SpawnManager.getStatus() on Tick ${Game.time}. Error: ${e}`);
			return { queueLength: 0, scheduledSpawns: 0, nextSpawn: null, energyIncome: 0 };
		}
	}

	/** Clears the entire queue (emergency use) */
	clearQueue(): void {
		try {
			this.spawnQueue = [];
			this.scheduledSpawns = [];
			this.room.memory.spawnManager.queue = [];
			this.room.memory.spawnManager.scheduled = [];
			console.log(`[SpawnManager] ${this.room.name}: Queue cleared`);
		} catch (e) {
			console.log(`Execution Error In Function: SpawnManager.clearQueue() on Tick ${Game.time}. Error: ${e}`);
		}
	}

	/** Gets a copy of the current queue (for external inspection) */
	getQueue(): SpawnRequest[] {
		try {
			return [...this.spawnQueue];
		} catch (e) {
			console.log(`Execution Error In Function: SpawnManager.getQueue() on Tick ${Game.time}. Error: ${e}`);
			return [];
		}
	}

	/** Gets a copy of scheduled spawns (for external inspection) */
	getScheduledSpawns(): ScheduledSpawn[] {
		try {
			return [...this.scheduledSpawns];
		} catch (e) {
			console.log(`Execution Error In Function: SpawnManager.getScheduledSpawns() on Tick ${Game.time}. Error: ${e}`);
			return [];
		}
	}
}
