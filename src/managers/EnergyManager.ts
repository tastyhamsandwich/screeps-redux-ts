import { calcBodyCost } from '@globals';

/**
 * Manages energy income and expenditure tracking for a room.
 * Tracks expected vs. realized income and calculates amortized energy metrics.
 */
export default class EnergyManager {
	private room: Room;

	constructor(room: Room) {
		this.room = room;
		this.initializeMemory();
	}

	/**
	 * Initialize energy management data in room memory if not already present
	 */
	private initializeMemory(): void {
		if (!this.room.memory.energyManagement) {
			this.room.memory.energyManagement = {
				lastStorageEnergy: 0,
				lastPrestorageEnergy: 0,
				lastRecalculation: Game.time,
				currentMetrics: {
					expectedIncome: 0,
					realizedIncome: 0,
					upgradeExpenditure: 0,
					constructionExpenditure: 0,
					spawnExpenditure: 0,
					totalExpenditure: 0,
					netIncome: 0,
					harvestWorkParts: 0,
					localHarvestWorkParts: 0,
					remoteHarvestWorkParts: 0
				},
				amortized1500: {
					periodTicks: 1500,
					avgIncomePerTick: 0,
					avgExpenditurePerTick: 0,
					avgNetPerTick: 0,
					isRunningDeficit: false,
					energyBalance: 0
				},
				amortized3000: {
					periodTicks: 3000,
					avgIncomePerTick: 0,
					avgExpenditurePerTick: 0,
					avgNetPerTick: 0,
					isRunningDeficit: false,
					energyBalance: 0
				}
			};
		}
	}

	/**
	 * Run energy management calculations (should be called once per tick)
	 */
	public run(): void {
		try {
			this.updateMetrics();
			this.calculateAmortization();
		} catch (e) {
			console.log(`Execution Error In Function: EnergyManager.run(${this.room.name}) on Tick ${Game.time}. Error: ${e}`);
		}
	}

	/**
	 * Update current energy metrics
	 */
	private updateMetrics(): void {
		try {
			const mem = this.room.memory.energyManagement!;
			const stats = this.room.memory.stats;

			// Calculate expected income from harvester WORK parts
			const harvestWorkParts = this.getHarvesterWorkParts();
			const localHarvestWorkParts = this.getLocalHarvesterWorkParts();
			const remoteHarvestWorkParts = this.getRemoteHarvesterWorkParts();
			const expectedIncome = harvestWorkParts * 2; // Each WORK part generates 2 energy per tick

			// Calculate realized income by tracking storage/prestorage changes
			const storageEnergy = this.room.storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0;
			const prestorageEnergy = this.room.prestorage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0;

			// Calculate energy deposited this tick
			const storageChange = storageEnergy - mem.lastStorageEnergy;
			const prestorageChange = prestorageEnergy - mem.lastPrestorageEnergy;
			const realizedIncome = Math.max(0, storageChange + prestorageChange);

			// Update storage tracking
			mem.lastStorageEnergy = storageEnergy;
			mem.lastPrestorageEnergy = prestorageEnergy;

			// Calculate expenditures
			const upgradeExpenditure = this.calculateUpgradeExpenditure(stats);
			const constructionExpenditure = this.calculateConstructionExpenditure(stats);
			const spawnExpenditure = this.calculateSpawnExpenditure(stats);
			const totalExpenditure = upgradeExpenditure + constructionExpenditure + spawnExpenditure;

			// Calculate net income
			const netIncome = expectedIncome - totalExpenditure;

			// Update metrics
			mem.currentMetrics = {
				expectedIncome,
				realizedIncome,
				upgradeExpenditure,
				constructionExpenditure,
				spawnExpenditure,
				totalExpenditure,
				netIncome,
				harvestWorkParts,
				localHarvestWorkParts,
				remoteHarvestWorkParts
			};
		} catch (e) {
			console.log(`Execution Error In Function: EnergyManager.updateMetrics(${this.room.name}) on Tick ${Game.time}. Error: ${e}`);
		}
	}

	/**
	 * Get total harvester WORK parts (local + remote)
	 */
	private getHarvesterWorkParts(): number {
		try {
			return this.getLocalHarvesterWorkParts() + this.getRemoteHarvesterWorkParts();
		} catch (e) {
			console.log(`Execution Error In Function: EnergyManager.getHarvesterWorkParts(${this.room.name}) on Tick ${Game.time}. Error: ${e}`);
			return 0;
		}
	}

	/**
	 * Get local harvester WORK parts
	 */
	private getLocalHarvesterWorkParts(): number {
		try {
			const harvesters = Object.values(Game.creeps).filter(
				creep => creep.memory.home === this.room.name &&
						 (creep.memory.role === 'harvester' || creep.memory.RFQ === 'harvester')
			);

			return harvesters.reduce((total, harvester) => {
				const workParts = harvester.body.filter(part => part.type === WORK).length;
				return total + workParts;
			}, 0);
		} catch (e) {
			console.log(`Execution Error In Function: EnergyManager.getLocalHarvesterWorkParts(${this.room.name}) on Tick ${Game.time}. Error: ${e}`);
			return 0;
		}
	}

	/**
	 * Get remote harvester WORK parts
	 */
	private getRemoteHarvesterWorkParts(): number {
		try {
			const remoteharvesters = Object.values(Game.creeps).filter(
				creep => creep.memory.home === this.room.name &&
						 (creep.memory.role === 'remoteharvester' || creep.memory.RFQ === 'remoteharvester')
			);

			return remoteharvesters.reduce((total, harvester) => {
				const workParts = harvester.body.filter(part => part.type === WORK).length;
				return total + workParts;
			}, 0);
		} catch (e) {
			console.log(`Execution Error In Function: EnergyManager.getRemoteHarvesterWorkParts(${this.room.name}) on Tick ${Game.time}. Error: ${e}`);
			return 0;
		}
	}

	/**
	 * Calculate energy expenditure on upgrades
	 * Base cost is 1 energy per control point
	 */
	private calculateUpgradeExpenditure(stats: ColonyStats): number {
		try {
			const ticksSinceLastRecalc = Game.time - (this.room.memory.energyManagement?.lastRecalculation ?? Game.time);
			if (ticksSinceLastRecalc <= 0) return 0;

			// Control points earned since last recalculation
			const controlPointsEarned = stats.controlPoints;

			// Base cost: 1 energy per control point
			// At higher RCLs, the cost scales but we use a simplified model
			const baseCost = controlPointsEarned;

			// Scale by RCL level (costs increase at higher levels, but estimate as 1:1 for simplicity)
			const rcl = this.room.controller?.level ?? 0;
			const scaleFactor = rcl >= 8 ? 1.5 : 1.0;

			return Math.ceil(baseCost * scaleFactor);
		} catch (e) {
			console.log(`Execution Error In Function: EnergyManager.calculateUpgradeExpenditure(${this.room.name}) on Tick ${Game.time}. Error: ${e}`);
			return 0;
		}
	}

	/**
	 * Calculate energy expenditure on construction
	 * Cost is 1 energy per construction point
	 */
	private calculateConstructionExpenditure(stats: ColonyStats): number {
		try {
			// Construction points are a 1:1 mapping with construction work points
			// Each work point = 1 progress, which costs 1 energy
			return stats.constructionPoints;
		} catch (e) {
			console.log(`Execution Error In Function: EnergyManager.calculateConstructionExpenditure(${this.room.name}) on Tick ${Game.time}. Error: ${e}`);
			return 0;
		}
	}

	/**
	 * Calculate energy expenditure on creep spawning
	 */
	private calculateSpawnExpenditure(stats: ColonyStats): number {
		try {
			// Use tracked energySpentOnSpawns if available, otherwise estimate from body parts
			if (stats.energySpentOnSpawns !== undefined && stats.energySpentOnSpawns > 0) {
				return stats.energySpentOnSpawns;
			}

			// Fallback: estimate based on average creep body cost
			// Average creep costs around 300-500 energy; use 400 as baseline
			const avgCreepCost = 400;
			return stats.creepsSpawned * avgCreepCost;
		} catch (e) {
			console.log(`Execution Error In Function: EnergyManager.calculateSpawnExpenditure(${this.room.name}) on Tick ${Game.time}. Error: ${e}`);
			return 0;
		}
	}

	/**
	 * Calculate amortized energy metrics over given time periods
	 */
	private calculateAmortization(): void {
		try {
			const mem = this.room.memory.energyManagement!;
			const stats = this.room.memory.stats;
			const metrics = mem.currentMetrics;

			// Calculate total stats accumulated since start of room
			const totalControlPoints = stats.controlPoints;
			const totalConstructionPoints = stats.constructionPoints;
			const totalEnergyHarvested = stats.energyHarvested;

			// Current room age (estimate from controller level progress)
			// For a more accurate measure, we can use the last recalculation time
			const roomAge = Game.time - (mem.lastRecalculation ?? Game.time);
			const periodAge = Math.max(1, roomAge); // Ensure at least 1 tick

			// Calculate amortization for 1500 tick period (1 creep lifetime)
			const amort1500Income = metrics.expectedIncome * 1500;
			const amort1500Upgrade = this.calculateUpgradeExpenditure(stats) * 1500;
			const amort1500Construction = this.calculateConstructionExpenditure(stats) * 1500;
			const amort1500Spawn = this.calculateSpawnExpenditure(stats) * 1500;
			const amort1500Expenditure = amort1500Upgrade + amort1500Construction + amort1500Spawn;

			mem.amortized1500 = {
				periodTicks: 1500,
				avgIncomePerTick: amort1500Income / 1500,
				avgExpenditurePerTick: amort1500Expenditure / 1500,
				avgNetPerTick: (amort1500Income - amort1500Expenditure) / 1500,
				isRunningDeficit: (amort1500Income - amort1500Expenditure) / 1500 < 0,
				energyBalance: amort1500Income - amort1500Expenditure
			};

			// Calculate amortization for 3000 tick period (2 creep lifetimes)
			const amort3000Income = metrics.expectedIncome * 3000;
			const amort3000Upgrade = this.calculateUpgradeExpenditure(stats) * 3000;
			const amort3000Construction = this.calculateConstructionExpenditure(stats) * 3000;
			const amort3000Spawn = this.calculateSpawnExpenditure(stats) * 3000;
			const amort3000Expenditure = amort3000Upgrade + amort3000Construction + amort3000Spawn;

			mem.amortized3000 = {
				periodTicks: 3000,
				avgIncomePerTick: amort3000Income / 3000,
				avgExpenditurePerTick: amort3000Expenditure / 3000,
				avgNetPerTick: (amort3000Income - amort3000Expenditure) / 3000,
				isRunningDeficit: (amort3000Income - amort3000Expenditure) / 3000 < 0,
				energyBalance: amort3000Income - amort3000Expenditure
			};

			mem.lastRecalculation = Game.time;
		} catch (e) {
			console.log(`Execution Error In Function: EnergyManager.calculateAmortization(${this.room.name}) on Tick ${Game.time}. Error: ${e}`);
		}
	}

	/**
	 * Get current energy metrics
	 */
	public getMetrics(): EnergyMetrics {
		return this.room.memory.energyManagement?.currentMetrics ?? {
			expectedIncome: 0,
			realizedIncome: 0,
			upgradeExpenditure: 0,
			constructionExpenditure: 0,
			spawnExpenditure: 0,
			totalExpenditure: 0,
			netIncome: 0,
			harvestWorkParts: 0,
			localHarvestWorkParts: 0,
			remoteHarvestWorkParts: 0
		};
	}

	/**
	 * Get amortized metrics for 1500 tick period
	 */
	public getAmortized1500(): AmortizedEnergyMetrics {
		return this.room.memory.energyManagement?.amortized1500 ?? {
			periodTicks: 1500,
			avgIncomePerTick: 0,
			avgExpenditurePerTick: 0,
			avgNetPerTick: 0,
			isRunningDeficit: false,
			energyBalance: 0
		};
	}

	/**
	 * Get amortized metrics for 3000 tick period
	 */
	public getAmortized3000(): AmortizedEnergyMetrics {
		return this.room.memory.energyManagement?.amortized3000 ?? {
			periodTicks: 3000,
			avgIncomePerTick: 0,
			avgExpenditurePerTick: 0,
			avgNetPerTick: 0,
			isRunningDeficit: false,
			energyBalance: 0
		};
	}

	/**
	 * Check if colony is running an energy deficit over 1500 ticks
	 */
	public isRunningDeficit1500(): boolean {
		return this.getAmortized1500().isRunningDeficit;
	}

	/**
	 * Check if colony is running an energy deficit over 3000 ticks
	 */
	public isRunningDeficit3000(): boolean {
		return this.getAmortized3000().isRunningDeficit;
	}

	/**
	 * Get estimated energy balance over 1500 ticks
	 */
	public getEnergyBalance1500(): number {
		return this.getAmortized1500().energyBalance;
	}

	/**
	 * Get estimated energy balance over 3000 ticks
	 */
	public getEnergyBalance3000(): number {
		return this.getAmortized3000().energyBalance;
	}
}
