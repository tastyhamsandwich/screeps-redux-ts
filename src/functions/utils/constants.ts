const cSet = Memory.globalSettings.creepSettings;

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
		reusePath: cSet.builder.reusePathValue,
		ignoreCreeps: false //cSet.builder.ignoreCreeps
	},
	fillerPathing: {
		visualizePathStyle: { stroke: "#44ffaa", opacity: 0.3, lineStyle: "dotted" },
		reusePath: cSet.hauler.reusePathValue,
		ignoreCreeps: false //cSet.filler.ignoreCreeps
	},
	haulerPathing: {
		visualizePathStyle: { stroke: "#880088", opacity: 0.3, lineStyle: "dotted" },
		reusePath: cSet.hauler.reusePathValue,
		ignoreCreeps: false //cSet.hauler.ignoreCreeps
	},
	harvesterPathing: {
		visualizePathStyle: { stroke: "#00ff00", opacity: 0.5, lineStyle: "dashed" },
		reusePath: cSet.harvester.reusePathValue,
		ignoreCreeps: false //cSet.harvester.ignoreCreeps
	},
	remoteBuilderPathing: {
		visualizePathStyle: { stroke: "#ffff00", opacity: 0.3, lineStyle: "dotted" },
		reusePath: cSet.remotebuilder.reusePathValue,
		ignoreCreeps: false //cSet.remotebuilder.ignoreCreeps
	},
	remoteBodyguardPathing: {
		visualizePathStyle: { stroke: "#ff0000", opacity: 0.3, lineStyle: "dashed" },
		reusePath: cSet.remotebodyguard.reusePathValue,
		ignoreCreeps: false //cSet.remotebodyguard.ignoreCreeps
	},
	remoteHarvesterPathing: {
		visualizePathStyle: { stroke: "#98dd44", opacity: 0.5, lineStyle: "dashed" },
		reusePath: cSet.remoteharvester.reusePathValue,
		ignoreCreeps: false //cSet.remoteharvester.ignoreCreeps
	},
	remoteHaulerPathing: {
		visualizePathStyle: { stroke: "#880088", opacity: 0.3, lineStyle: "dotted" },
		reusePath: cSet.remotehauler.reusePathValue,
		ignoreCreeps: false //cSet.remotehauler.ignoreCreeps
	},
	repairerPathing: {
		visualizePathStyle: { stroke: "#ff6600", opacity: 0.3, lineStyle: "dotted" },
		reusePath: cSet.repairer.reusePathValue,
		ignoreCreeps: false //cSet.repairer.ignoreCreeps
	},
	reserverPathing: {
		visualizePathStyle: { stroke: "#ffffff", opacity: 0.3, lineStyle: "dashed" },
		reusePath: cSet.reserver.reusePathValue,
		ignoreCreeps: false //cSet.reserver.ignoreCreeps
	},
	upgraderPathing: {
		visualizePathStyle: { stroke: "#ffff00", opacity: 0.3, lineStyle: "dotted" },
		reusePath: cSet.upgrader.reusePathValue,
		ignoreCreeps: false //cSet.upgrader.ignoreCreeps
	},
	rallyPointPathing: {
		visualizePathStyle: { stroke: "#ffffff", opacity: 1.0, lineStyle: "solid" },
		reusePath: Memory.globalSettings.reusePathValue,
		ignoreCreeps: Memory.globalSettings.ignoreCreeps
	},
	subordinatePathing: {
		visualizePathStyle: { stroke: '#880000', opacity: 1.0, lineStyle: "dashed" },
		reusePath: Memory.globalSettings.reusePathValue,
		ignoreCreeps: false
	}
};
