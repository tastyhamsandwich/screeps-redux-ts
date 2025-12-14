import { RoomName } from "../position/types"

/**
 * Correctly typed `Game.rooms[name]`.
 * @param name target room name
 * @returns a room if visible
 */
export function getRoom(name: RoomName | string): Room | undefined {
	return Game.rooms[name]
}

/**
 * Find neighbor rooms without need for visibility.
 * @param origin starting room
 * @param dist optional: number of rooms from starting point
 * @param pred optional: condition for a room to be visited
 * @returns a set of neighbor room names excluding {@link origin}
 */
export function describeAdjacentRooms(
	origin: RoomName,
	dist = 1,
	pred: (r: RoomName, dist: number, from: RoomName) => boolean = () => true
) {
	const res = new Set([origin])
	let q = [origin]
	for (let i = 1; i <= dist; i++) {
		const nq: RoomName[] = []
		for (const from of q) {
			const exits = Game.map.describeExits(from)
			for (const exit in exits) {
				const to = exits[exit as ExitKey] as RoomName | undefined
				if (!to || res.has(to) || !pred(to, i, from)) continue
				res.add(to)
				nq.push(to)
			}
		}
		q = nq
	}
	res.delete(origin)
	return res
}

/**
 * Guess sources capacity based on room ownership.
 * @param room a room (maybe partial)
 * @returns a number of energy units
 */
export function getRoomSourcesCapacity(room: RoomOwnershipData) {
	if (!room.controller) return SOURCE_ENERGY_KEEPER_CAPACITY
	if (room.controller.owner || room.controller.reservation) return SOURCE_ENERGY_CAPACITY
	return SOURCE_ENERGY_NEUTRAL_CAPACITY
}
interface RoomOwnershipData {
	controller?: { owner?: object; reservation?: object }
}

export type BoundingBox = {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
}

/** Compute bounding box around a set of exit tiles.
 *
 * Returns null if no exits given.
 * @author randomencounter
 */
export function getExitBounds(exits: RoomPosition[]): BoundingBox | null {
	if (!exits.length) return null;

	let minX = 49, maxX = 0, minY = 49, maxY = 0;
	for (const pos of exits) {
		if (pos.x < minX) minX = pos.x;
		if (pos.x > maxX) maxX = pos.x;
		if (pos.y < minY) minY = pos.y;
		if (pos.y > maxY) maxY = pos.y;
	}
	return { minX, maxX, minY, maxY };
}
