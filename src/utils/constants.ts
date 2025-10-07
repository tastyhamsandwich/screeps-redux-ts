const cSet = Memory.globalSettings.creepSettings;

export const pathing: { [key: string]: MoveToOpts } = {
	builderPathing: {
		visualizePathStyle: { stroke: "#0000ff", opacity: 0.3, lineStyle: "dotted" },
		reusePath: cSet.builder.reusePathValue,
		ignoreCreeps: false //cSet.builder.ignoreCreeps
	},
	fillerPathing: {
		visualizePathStyle: { stroke: "#44ffaa", opacity: 0.3, lineStyle: "dotted" },
		reusePath: cSet.runner.reusePathValue,
		ignoreCreeps: false //cSet.filler.ignoreCreeps
	},
	porterPathing: {
		visualizePathStyle: { stroke: "#880088", opacity: 0.3, lineStyle: "dotted" },
		reusePath: cSet.runner.reusePathValue,
		ignoreCreeps: false //cSet.porter.ignoreCreeps
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
	remoteGuardPathing: {
		visualizePathStyle: { stroke: "#ff0000", opacity: 0.3, lineStyle: "dashed" },
		reusePath: cSet.remoteguard.reusePathValue,
		ignoreCreeps: false //cSet.remoteguard.ignoreCreeps
	},
	remoteHarvesterPathing: {
		visualizePathStyle: { stroke: "#98dd44", opacity: 0.5, lineStyle: "dashed" },
		reusePath: cSet.remoteharvester.reusePathValue,
		ignoreCreeps: false //cSet.remoteharvester.ignoreCreeps
	},
	remotePorterPathing: {
		visualizePathStyle: { stroke: "#880088", opacity: 0.3, lineStyle: "dotted" },
		reusePath: cSet.remoterunner.reusePathValue,
		ignoreCreeps: false //cSet.remoteporter.ignoreCreeps
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
	scoutPathing: {
		visualizePathStyle: { stroke: "#ff00ff", opacity: 0.5, lineStyle: "solid" },
		reusePath: cSet.scout.reusePathValue,
		ignoreCreeps: false //cSet.scout.ignoreCreeps
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
