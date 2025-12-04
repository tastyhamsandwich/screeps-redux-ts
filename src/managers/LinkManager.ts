const LinkManager = {
	run: (room: Room) => {

		const rMem = room.memory;

		// Register remote (room edge) links
		if (rMem.objects.links && rMem.links.remotes && !rMem.links.remotes.length) {
			const registeredLinks = Object.entries(rMem.links);
			if (rMem.objects.links.length !== registeredLinks.length) {
				for (let i = 0; i < rMem.objects.links.length; i++) {
					const link = Game.getObjectById(rMem.objects.links[i]);
					if (link) {
						if (room.linkOne) if (link.id === room.linkOne.id) continue;
						if (room.linkStorage) if (link.id === room.linkStorage.id) continue;
						if (room.linkTwo) if (link.id === room.linkTwo.id) continue;
						if (room.linkController) if (link.id === room.linkController.id) continue;
						if (!room.memory.links.remotes) room.memory.links.remotes = [];
							room.memory.links.remotes.push(link.id);
					}
				}
			}
		}

		if (rMem.links.remotes && rMem.links.remotes.length) {
			const remoteLinkIDs: Id<StructureLink>[] = rMem.links.remotes;

			for (const remoteLinkID of remoteLinkIDs) {
				const remoteLink = Game.getObjectById(remoteLinkID);

				if (room.linkStorage && remoteLink) {
					if ((remoteLink.store.getUsedCapacity(RESOURCE_ENERGY) > 100) && remoteLink.cooldown == 0 && (room.linkStorage.store.getFreeCapacity(RESOURCE_ENERGY) >= remoteLink.store.getUsedCapacity(RESOURCE_ENERGY))) {
						const xferAmount = remoteLink.store.getUsedCapacity(RESOURCE_ENERGY);
						const result = remoteLink.transferEnergy(room.linkStorage);
						if (result === OK)
							room.memory.data.storageLinkFilled = xferAmount;
					}
				}
			}
		}
		if (room.linkStorage && room.linkOne) {
			if ((room.linkOne.store.getFreeCapacity(RESOURCE_ENERGY) < 100) && room.linkOne.cooldown == 0 && (room.linkStorage.store.getFreeCapacity(RESOURCE_ENERGY) >= room.linkOne.store.getUsedCapacity(RESOURCE_ENERGY))) {
				const xferAmount = room.linkOne.store.getUsedCapacity(RESOURCE_ENERGY);
				const result = room.linkOne.transferEnergy(room.linkStorage);
				if (result === OK)
					room.memory.data.storageLinkFilled = xferAmount;
			}
		}
		if (room.linkStorage && room.linkTwo) {
			if ((room.linkTwo.store.getFreeCapacity(RESOURCE_ENERGY) < 100) && room.linkTwo.cooldown == 0 && (room.linkStorage.store.getFreeCapacity(RESOURCE_ENERGY) >= room.linkTwo.store.getUsedCapacity(RESOURCE_ENERGY))) {
				const xferAmount = room.linkTwo.store.getUsedCapacity(RESOURCE_ENERGY);
				const result = room.linkTwo.transferEnergy(room.linkStorage);
				if (result === OK)
					room.memory.data.storageLinkFilled = xferAmount;
			}
		}
		if (room.linkStorage && room.linkController) {
			if ((room.linkStorage.store[RESOURCE_ENERGY] > 99) && room.linkStorage.cooldown == 0 && room.linkController.store[RESOURCE_ENERGY] < 401)
				room.linkStorage.transferEnergy(room.linkController);
		}
	}
}

export default LinkManager;
