import { determineBodyParts } from "@funcs/creep";
import { OnEvent } from "@modules/EventSystem";
import { legacySpawnManager } from "@modules/LegacySpawnSystem";

export class RemoteRoomCached {
	@OnEvent("remoteRoomCached", "normal")
	updateLogisitics({ roomName, hostRoom }) {
		const remoteHost = Game.rooms[hostRoom];
		const remoteRoom = Game.rooms[roomName];

		if (remoteHost.manager) {
			remoteHost.manager.manageContainers();
		}

		if (remoteRoom.memory.objects.invaderCores.length) {
			const body = determineBodyParts('infantry', Game.rooms[hostRoom].energyCapacityAvailable, Game.rooms[hostRoom]);
			const creepMemory = {
				role: 'infantry',
				RFQ: 'infantry',
				home: hostRoom,
				room: hostRoom,
				targetRoom: roomName,
				working: false,
				disable: false,
				rally: 'none',
				targetHostile: remoteRoom.memory.objects.invaderCores[0]
			};

			if (Game.rooms[hostRoom].memory.data.flags.advSpawnSystem) {
				remoteHost.manager?.getSpawnManager().submitRequest({role: 'infantry',
					priority: 55,
					body,
					memory: creepMemory,
					roomName: roomName,
					urgent: false
				});
			} else {
				legacySpawnManager.insertPending('infantry', body, Game.rooms[hostRoom], creepMemory);
			}
		}
	}
}
