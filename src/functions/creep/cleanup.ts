import { log } from '@globals';

export function creepCleanup(countObj: { [key: string]: number }): void {
	for (let name in Memory.creeps) {
		if (!Game.creeps[name]) {
			const role = Memory.creeps[name].role;
			delete Memory.creeps[name];
			log(`Clearing nonexistent creep memory: ${name}`);
			// reset naming counter for type of creep that died
			switch (role) {
				case 'harvester':
					countObj.harvester = 1;
					break;
				case 'filler':
					countObj.filler = 1;
					break;
				case 'hauler':
					countObj.hauler = 1;
					break;
				case 'upgrader':
					countObj.upgrader = 1;
					break;
				case 'builder':
					countObj.builder = 1;
					break;
				case 'repairer':
					countObj.repairer = 1;
					break;
				case 'defender':
					countObj.defender = 1;
					break;
				case 'reserver':
					countObj.reserver = 1;
					break;
				case 'scout':
					countObj.scout = 1;
					break;
				case 'remoteharvester':
					countObj.remoteHarvester = 1;
					break;
			}
		}
	}
}
