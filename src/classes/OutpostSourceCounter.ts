export default class OutpostSourceCounter {
	private room: Room
	private counter: number = 0;
	private totalLength: number;
	private lastArraySnapshot: string = "";

	constructor(room: Room, prevCounter: number) {
		this.room = room;
		this.counter = prevCounter;
		this.recalculateIfNeeded();
		this.totalLength = this.calculateTotalLength();
	}

	// Detects if the outpost list has changed since last calculation
	private recalculateIfNeeded(): void {
		const outposts = this.room.memory.outposts;
		if (!outposts?.array) {
			this.totalLength = 0;
			return;
		}

		// stringify just the names; enough to detect change
		const arraySignature = JSON.stringify(outposts.array);

		if (arraySignature !== this.lastArraySnapshot) {
			this.totalLength = outposts.array.reduce((sum, outpostName) => {
				const listEntry = outposts.list?.[outpostName];
				return sum + (listEntry?.sourceIDs?.length ?? 0);
			}, 0);
			this.lastArraySnapshot = arraySignature;
		}
	}

	// Calculate total sources across all outposts
	private calculateTotalLength(): number {
		const outposts = this.room.memory.outposts;
		if (!outposts?.array?.length) return 0;

		return outposts.array.reduce((sum: number, outpostName: string) => {
			const listEntry = outposts.list[outpostName];
			return sum + (listEntry?.sourceIDs?.length ?? 0);
		}, 0);
	}

	// Advance counter and wrap around
	public next(): {outpostName: string, source: string, container: string} | null {
		if (this.totalLength === 0) return null;

		const outposts = this.room.memory.outposts;
		const memoryCounter = outposts.counter ?? 0;

		if (!outposts?.array?.length) return null;
		this.recalculateIfNeeded();

		const wrappedCounter = memoryCounter % this.totalLength;
		let runningTotal = 0;

		for (let i = 0; i < outposts.array.length; i++) {
			const outpostName = outposts.array[i];
			const sourceIDs = outposts.list[outpostName]?.sourceIDs ?? [];
			const containerIDs = outposts.list[outpostName]?.containerIDs ?? [];

			if (wrappedCounter < runningTotal + sourceIDs.length) {
				const itemIndex = wrappedCounter - runningTotal;
				const resultSource = sourceIDs[itemIndex];
				const resultContainer = containerIDs[itemIndex];

				// persist new counter
				outposts.counter = (memoryCounter + 1) % this.totalLength;

				return { outpostName: outpostName, source: resultSource, container: resultContainer };
			}

			runningTotal += sourceIDs.length;
		}

		return null;
	}

	// optional helper: reset or get debug info
	public reset() {
		this.counter = 0;
	}

	public info() {
		this.recalculateIfNeeded();
		return {
			totalLength: this.totalLength,
			counter: this.room.memory.outposts?.counter ?? 0,
		};
	}
}
