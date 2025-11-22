import { calcBodyCost, capitalize } from "@globals";

let ticksRemaining = 0;
let startedSpawning: boolean | null = null;

export function displaySpawnInfo(spawn: StructureSpawn) {

	const boxSettings: PolyStyle = { fill: '#777777', opacity: 0.7, stroke: '#cccccc', strokeWidth: 0.1 };

	if (!spawn.spawning) {
		const displayBox = new RoomVisual(spawn.room.name).rect(spawn.pos.x - 1.9, spawn.pos.y - 1.5, 3.75, .75, boxSettings);
		startedSpawning = null;
		ticksRemaining = 0;
		return;
	} else {

		const mem = spawn.room.memory.visuals;
		const roomName: string = spawn.room.name;
		const spawnPos: RoomPosition = spawn.pos;
		const boxPos = { x: spawnPos.x - 2.5, y: spawnPos.y - 2.75 };
		const color: string = mem?.settings?.spawnInfo?.color || 'white';
		const textSettings: TextStyle = { color, font: 0.35, stroke: '#000000', strokeWidth: 0.15, align: 'center', opacity: 1 };

		const creepName: string = spawn.spawning!.name;
		const creep: Creep = Game.creeps[creepName];
		const role: string = creep.memory.role;
		const cost: number = calcBodyCost(creep.body.map(p => p.type));

		if (startedSpawning === null) {
			startedSpawning = true;
			ticksRemaining = creep.body.length * 3 || 50;
		}

		const displayBox: RoomVisual = new RoomVisual(roomName).rect(boxPos.x - .1, boxPos.y, 5.2, 2, boxSettings).text(`Creep: ${creepName} | Role: ${capitalize(role)}`, spawnPos.x, spawnPos.y - 2.2, textSettings).text(`Ticks: ${ticksRemaining} | Cost: ${cost}`, spawnPos.x, spawnPos.y - 1.6, textSettings);

		if (startedSpawning)
			ticksRemaining--;

		return;
	}
}
