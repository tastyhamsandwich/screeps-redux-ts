/**
 * Generate string for a clickable link to the given room
 * @param roomName name of the target room
 * @param text string to display as button
 * @param onClick addition script
 * @returns an html link string
 */
export function getLinkToRoom(roomName: string, text: string, onClick = "") {
	try {
		return `<a href="#!/room/${Game.shard.name}/${roomName}" onClick="${onClick}">${htmlEscape(
			text
		)}</a>`
	} catch (e) {
		console.log(`Execution Error In Function: getLinkToRoom(${roomName}) on Tick ${Game.time}. Error: ${e}`);
		return "";
	}
}

/**
 * Generate string for a clickable link to the given game object
 * @param it target game object
 * @param text string to display as button
 * @param memWatch optionally add a memory watch
 * @returns an html link string
 */
export function getLinkToObject(
	it: _HasRoomPosition & _HasId,
	text: string,
	memWatch?: string | undefined | false
) {
	try {
		return getLinkToRoom(
			it.pos.roomName,
			text,
			selectById(it.id) + (memWatch ? addWatch(memWatch) : "")
		)
	} catch (e) {
		console.log(`Execution Error In Function: getLinkToObject(${it.id}) on Tick ${Game.time}. Error: ${e}`);
		return "";
	}
}
const selectById = (id: string) =>
	`angular.element('body').injector().get('RoomViewPendingSelector').set('${id}'):`
const addWatch = (memWatch: string) =>
	`angular.element($('section.memory')).scope().Memory.addWatch('${memWatch}');angular.element($('section.memory')).scope().Memory.selectedObjectWatch='${memWatch}';`

/**
 * Generate string for a clickable link to the given creep
 * @param it target creep
 * @param text optional string to display as button
 * @returns an html link string
 */
export function getLinkToCreep(it: Creep, text?: string | undefined) {
	try {
		return getLinkToObject(it, text ?? `[Creep ${it.name} #${it.id}]`, it.my && `creeps.${it.name}`)
	} catch (e) {
		console.log(`Execution Error In Function: getLinkToCreep(${it.name}) on Tick ${Game.time}. Error: ${e}`);
		return "";
	}
}

/**
 * Generate string for a clickable link to the given spawn
 * @param it target spawn
 * @param text optional string to display as button
 * @returns an html link string
 */
export function getLinkToSpawn(it: StructureSpawn, text?: string | undefined) {
	try {
		return getLinkToObject(it, text ?? `[Spawn ${it.name} #${it.id}]`, it.my && `spawns.${it.name}`)
	} catch (e) {
		console.log(`Execution Error In Function: getLinkToSpawn(${it.name}) on Tick ${Game.time}. Error: ${e}`);
		return "";
	}
}

/**
 * Generate string for a clickable link to the given flag
 * @param it target flag
 * @param text optional string to display as button
 * @returns an html link string
 */
export function getLinkToFlag(it: Flag, text?: string | undefined) {
	try {
		return getLinkToRoom(
			it.pos.roomName,
			text ?? `[Flag ${it.name}]`,
			selectById(it.name) + addWatch(`flags.${it.name}`)
		)
	} catch (e) {
		console.log(`Execution Error In Function: getLinkToFlag(${it.name}) on Tick ${Game.time}. Error: ${e}`);
		return "";
	}
}

/**
 * Convert string to html safe characters
 * @param s string to escape
 * @returns string without bad html characters
 */
export function htmlEscape(s: string) {
	try {
		const lookup: Record<string, string> = {
			"&": "&amp;",
			'"': "&quot;",
			"'": "&apos;",
			"<": "&lt;",
			">": "&gt;",
		}
		return s.replace(/[&"'<>]/g, (c) => lookup[c])
	} catch (e) {
		console.log(`Execution Error In Function: htmlEscape() on Tick ${Game.time}. Error: ${e}`);
		return s;
	}
}
