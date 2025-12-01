/* export function drawVisuals(room: Room, spawns: StructureSpawn[], creepObject: CreepObject, tickCount: number) {

	const rMem = room.memory;

	//: PER SPAWN CREEP SPAWNING INFORMATION
	if (spawns.length) {
		for (let i = 0; i < spawns.length; i++) {
			if (spawns[i].spawning) {

				let spawningCreep = Game.creeps[spawns[i].spawning.name];
				if (Memory.miscData.rooms[room.name].spawnAnnounced) {
					console.log(spawns[i].room.link() + ': Spawning new creep: ' + spawningCreep.memory.role + ' (' + spawningCreep.name + ')');
					Memory.miscData.rooms[room.name].spawnAnnounced = true;
				}
				spawns[i].room.visual.text(spawningCreep.memory.role + ' - ' + spawns[i].spawning.remainingTime + '/' + spawns[i].spawning.needTime, spawns[i].pos.x, spawns[i].pos.y + 1.25, { stroke: '#111111', color: '#ff00ff', align: 'center', opacity: 0.8, font: 0.4 });
			} else
				Memory.miscData.rooms[room.name].spawnAnnounced = false;
		}


		//: CONSOLE-BASED CREEP CENSUS VS TARGETS & ENERGY CAPACITY

		const tickInterval: number = Memory.globalSettings.consoleSpawnInterval;
		let storageInfo = '';
		if (room.storage) storageInfo = `<${room.storage.store[RESOURCE_ENERGY].toString()}> `;
		else if (room.prestorage) storageInfo = `<${room.prestorage.store[RESOURCE_ENERGY].toString()}> `;
		const energy: string = 'NRG: ' + room.energyAvailable + '/' + room.energyCapacityAvailable + '(' + (room.energyAvailable / room.energyCapacityAvailable * 100).toFixed(0) + '%) ';
		const hInfo: string = (creepObject.targets.harvesterTarget) ? '| H:' + creepObject.creeps.harvesters.length + '(' + creepObject.targets.harvesterTarget + ') ' : '';
		const fInfo: string = (creepObject.targets.fillerTarget) ? '| C:' + creepObject.creeps.fillers.length + '(' + creepObject.targets.fillerTarget + ') ' : '';
		const hlInfo: string = (creepObject.targets.haulerTarget) ? '| Hl:' + creepObject.creeps.haulers.length + '(' + creepObject.targets.haulerTarget + ') ' : '';
		const bInfo: string = (creepObject.targets.builderTarget) ? '| B:' + creepObject.creeps.builders.length + '(' + creepObject.targets.builderTarget + ') ' : '';
		const uInfo: string = (creepObject.targets.upgraderTarget) ? '| U:' + creepObject.creeps.upgraders.length + '(' + creepObject.targets.upgraderTarget + ') ' : '';
		const rpInfo: string = (creepObject.targets.repairerTarget) ? '| Rp:' + creepObject.creeps.repairers.length + '(' + creepObject.targets.repairerTarget + ') ' : '';
		const rvInfo: string = (creepObject.targets.reserverTarget) ? '| Rv:' + creepObject.creeps.reservers.length + '(' + creepObject.targets.reserverTarget + ') ' : '';
		const rhInfo: string = (creepObject.targets.remoteharvesterTarget) ? '| RH:' + creepObject.creeps.remoteharvesters.length + '(' + creepObject.targets.remoteharvesterTarget + ') ' : '';
		const dInfo: string = (creepObject.targets.defenderTarget) ? '| D:' + creepObject.creeps.defender.length + '(' + creepObject.targets.defenderTarget + ')' : '';

		if (tickInterval !== 0 && tickCount % tickInterval === 0) {
			console.log(room.link() + energy + storageInfo + hInfo + fInfo + hlInfo + bInfo + uInfo + rpInfo + dInfo + rvInfo + rhInfo + ' Tick: ' + tickCount);
		}

		//: ROOM VISUALS - SPAWN INFO BOXES
		const rmFlgs: RoomFlags = rMem.settings.flags;
		const rmVis: VisualSettings = rMem.visuals.settings;

		if (rmVis && rmVis.spawnInfo) {
		const alignment: alignment = rmVis.spawnInfo.alignment;
		const spawnColor: string = rmVis.spawnInfo.color;
		const spawnFont: number = rmVis.spawnInfo.fontSize || 0.5;
		let spawnX: number = 49;
		if (alignment == 'left') spawnX = 0;

		//* BOTTOM RIGHT BOX
		room.visual.rect(
			41.75, 44.5, 7.5, 4.75,
			{
				fill: '#555555',
				stroke: '#aaaaaa',
				opacity: 0.3,
				strokeWidth: 0.2
			});
		// Harvesters, Fillers, Upgraders, Builders, Cranes
		room.visual.text(
			'H:' + creepObject.creeps.harvesters.length + '(' + creepObject.targets.harvesterTarget +
			') | F:' + creepObject.creeps.fillers.length + '(' + creepObject.targets.fillerTarget +
			') | U:' + creepObject.creeps.upgraders.length + '(' + creepObject.targets.upgraderTarget +
			') | B:' + creepObject.creeps.builders.length + '(' + creepObject.targets.builderTarget + ')',
			spawnX, 49,
			{
				align: alignment,
				color: spawnColor,
				font: spawnFont
			});

		// Runners, Repaireres, Rebooters, Reservers
		room.visual.text(
			'Hl:' + creepObject.creeps.runners.length + '(' + creepObject.targets.runnerTarget +
			') | Rp:' + creepObject.creeps.repairers.length + '(' + creepObject.targets.repairerTarget +
			') | Rv:' + creepObject.creeps.reservers.length + '(' + creepObject.targets.reserverTarget +
			') | RH:' + creepObject.creeps.remoteHarvesters.length + '(' + creepObject.targets.remoteHarvesterTarget + ')',
			spawnX, 47,
			{
				align: alignment,
				color: spawnColor,
				font: spawnFont
			});



		//* TOP RIGHT BOX
		room.visual.rect(
			41.75, 0, 7.5, 4.75,
			{
				fill: '#555555',
				stroke: '#aaaaaa',
				opacity: 0.3,
				strokeWidth: 0.2
			});
		// Harvesters, Fillers, Upgraders, Builders, Cranes
		room.visual.text(
			'H:' + creepObject.creeps.harvesters.length + '(' + creepObject.targets.harvesterTarget +
			') | F:' + creepObject.creeps.fillers.length + '(' + creepObject.targets.fillerTarget +
			') | U:' + creepObject.creeps.upgraders.length + '(' + creepObject.targets.upgraderTarget +
			') | B:' + creepObject.creeps.builders.length + '(' + creepObject.targets.builderTarget +
			') | Hl:' + creepObject.creeps.hauler.length + '(' + creepObject.targets.haulerTarget +
			') | Rv:' + creepObject.creeps.reserver.length + '(' + creepObject.targets.reserverTarget +
			') | RH:' + creepObject.creeps.remoteharvester.length + '(' + creepObject.targets.remoteHarvesterTarget + ')',
			spawnX, 0.5,
			{
				align: alignment,
				color: spawnColor,
				font: spawnFont
			});

		// Energy Available, Energy Capacity
		room.visual.text(
			'Energy: ' + room.energyAvailable + '('
			+ room.energyCapacityAvailable + ')',
			spawnX, 4.5,
			{
				align: alignment,
				color: spawnColor,
				font: spawnFont
			});

		//: ROOM VISUALS - ROOM FLAG SETTINGS BOX

		const xCoord: number = rmVis.roomFlags.displayCoords[0];
		const yCoord: number = rmVis.roomFlags.displayCoords[1];
		const fontSize: number = rmVis.roomFlags.fontSize || 0.4;
		const displayColor: string = rmVis.roomFlags.color;

		//* OUTER RECTANGLE
		room.visual.rect(
			xCoord - 0.15,
			yCoord - 1.2,
			13, 1.35,
			{
				fill: '#770000',
				stroke: '#aa0000',
				opacity: 0.3,
				strokeWidth: 0.1
			});

		//* TOP ROW FLAGS
		room.visual.text(
			'CSL(' + rmFlgs.centralStorageLogic +
			')  SCS(' + rmFlgs.sortConSites +
			')  CCS(' + rmFlgs.closestConSites +
			')  CU(' + rmFlgs.craneUpgrades +
			')   HFA(' + rmFlgs.harvestersFixAdjacent +
			')     RDM(' + rmFlgs.runnersDoMinerals + ')',
			xCoord, (yCoord - 0.6),
			{
				align: 'left',
				font: fontSize,
				color: displayColor
			});
		//* BOTTOM ROW FLAGS
		room.visual.text(
			'RPE(' + rmFlgs.runnersPickupEnergy +
			')   RB(' + rmFlgs.repairBasics +
			')   RR(' + rmFlgs.repairRamparts +
			')    RW(' + rmFlgs.repairWalls +
			')   TRB(' + rmFlgs.towerRepairBasic +
			')   TRD(' + rmFlgs.towerRepairDefenses + ')',
			xCoord, yCoord - 0.1,
			{
				align: 'left',
				font: fontSize,
				color: displayColor
			});
	}

	//: ROOM CONTROLLER UPGRADE PROGRESS
	if (room.controller!.level >= 1) FUNC.visualRCProgress(room.controller);
}

 */
export function towerDamageOverlay(room: Room): void {
	if (!room.memory?.visuals?.settings?.displayTowerRanges) return;

	//: TOWER DAMAGE BOX DISPLAYS
	_.forEach(room.memory.objects.towers!, function (towerID) {
		const tower: StructureTower | null = Game.getObjectById(towerID)!;
		tower.room.visual.rect(-0.5, -0.5, 51, 51, { fill: '#550000', opacity: 0.25, stroke: '#880000' });
		tower.room.visual.rect(tower.pos.x - 19.5, tower.pos.y - 19.5, 39, 39, { fill: '#aa3e00', opacity: 0.15, stroke: '#ff8800' });
		tower.room.visual.rect(tower.pos.x - 15.5, tower.pos.y - 15.5, 31, 31, { fill: '#aaaa00', opacity: 0.2, stroke: '#ffff00' });
		tower.room.visual.rect(tower.pos.x - 10.5, tower.pos.y - 10.5, 21, 21, { fill: '#003300', opacity: 0.2, stroke: '#008800' });
		tower.room.visual.rect(tower.pos.x - 5.5, tower.pos.y - 5.5, 11, 11, { fill: '#4476ff', opacity: 0.25, stroke: '#00e1ff' });
	});
}

export function displayEnergyStorage(room: Room) {
	//: DISPLAY ENERGY ABOVE ROOM STORAGE
	const displayItem = (room.storage) ? room.storage : (room.prestorage) ? room.prestorage : null;
	if (displayItem === null) return;

	if (displayItem)
		room.visual.text(
			' Storage: ' + displayItem.store[RESOURCE_ENERGY],
			displayItem.pos.x,
			displayItem.pos.y - 1,
			{
				align: 'center',
				opacity: 0.8,
				font: 0.4,
				stroke:
					'#000000',
				color: '#ffff00'
			});
}

export function displayEnergyCapacity(room: Room) {

	const rMem = room.memory;
	const rmFlgs: RoomFlags = rMem.settings.flags;
	const rmVis: VisualSettings = rMem.visuals.settings!;

	if (rmVis && rmVis.spawnInfo) {
		const alignment: alignment = rmVis.spawnInfo.alignment;
		const spawnColor: string = rmVis.spawnInfo.color;
		const spawnFont: number = rmVis.spawnInfo.fontSize || 0.5;
		const spawn: StructureSpawn = Game.getObjectById(room.memory.objects.spawns![0])!;
		let spawnX = spawn.pos.x;
		// Energy Available, Energy Capacity
		/* room.visual.rect(
			41.75, 44.5, 7.5, 4.75,
			{
				fill: '#555555',
				stroke: '#aaaaaa',
				opacity: 0.3,
				strokeWidth: 0.2
			}); */
		room.visual.text(
			'Energy: ' + room.energyAvailable + '('
			+ room.energyCapacityAvailable + ')',
			spawnX, spawn.pos.y - 1,
			{
				align: 'center',
				color: spawnColor,
				font: spawnFont,
				stroke: '#000000',
				strokeWidth: 0.2
			});
	}
}
