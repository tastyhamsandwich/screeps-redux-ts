/**
 * Optimized check for {@link Structure.isActive}.
 * If using default getMaxLevel, you should call {@link isStructureActive.update} in your loop.
 * @param getMaxLevel optional: function to get the maximum level this controller ever got
 * @returns whether {@link Structure.isActive}
 */
export function isStructureActive(
	getMaxLevel: (controller: StructureController) => number = (c) =>
		(c.room.memory)[maxRclKey] || 0
) {
	return (s: Structure) =>
		!s.room.controller || s.room.controller.level == getMaxLevel(s.room.controller) || s.isActive()
}
/** Write maximum controller level in Game.rooms[name].memory.#mRCL */
isStructureActive.update = function () {
	for (const name in Game.rooms) {
		const room = Game.rooms[name]
		const level = room.controller?.level
		if (level) {
			const memory = room.memory;
			memory[maxRclKey] = Math.max(memory[maxRclKey], level)
		}
	}
}
const maxRclKey = "#mRCL"
