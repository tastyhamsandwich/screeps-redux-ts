import { parseJSONStamp } from '@modules/stamps/parseJSONStamp';

type JsonStamp = Record<string, unknown>;

// Converted from JSON stamp definitions to typed objects for easier import/use in TS
export const CrossFiveStamp: JsonStamp = {
	CrossFiveStamp: {
		centerPoint: { x: 2, y: 2 },
		stampDims: { width: 5, height: 5 },
		structures: {
			extension: [
				{ dx: 0, dy: 0 },
				{ x: 0, y: -1 },
				{ dx: -1, dy: 0 },
				{ dx: 1, dy: 0 },
				{ dx: 0, dy: 1 }
			],
			road: [
				{ dx: 0, dy: -2 },
				{ dx: 1, dy: -1 },
				{ dx: 0, dy: 2 },
				{ dx: 1, dy: 1 },
				{ dx: 2, dy: 0 },
				{ dx: -1, dy: -1 },
				{ dx: -2, dy: 0 },
				{ dx: -1, dy: 1 }
			]
		}
	}
};

export const DiagFiveStamp: JsonStamp = {
	DiagFiveStamp: {
		centerPoint: { x: 2, y: 2 },
		stampDims: { width: 5, height: 5 },
		structures: {
			extension: [
				{ dx: -1, dy: -1 },
				{ dx: -1, dy: 0 },
				{ dx: 0, dy: 0 },
				{ dx: 0, dy: 1 },
				{ dx: 1, dy: 1 }
			],
			road: [
				{ dx: 0, dy: 1 },
				{ dx: -2, dy: 0 },
				{ dx: -2, dy: -1 },
				{ dx: 1, dy: 2 },
				{ dx: 0, dy: 2 },
				{ dx: -1, dy: 1 },
				{ dx: 2, dy: 1 },
				{ dx: -1, dy: -2 },
				{ dx: 1, dy: 0 },
				{ dx: 0, dy: -1 }
			]
		}
	}
};

export const DiagTenStamp: JsonStamp = {
	DiagTenStamp: {
		anchorPoint: { x: 0, y: 0 },
		centerSquare: [
			{ x: 2, y: 2 },
			{ x: 3, y: 2 },
			{ x: 2, y: 3 },
			{ x: 3, y: 3 }
		],
		stampDims: { width: 6, height: 6 },
		structures: {
			extension: [
				{ x: 1, y: 2 },
				{ x: 1, y: 3 },
				{ x: 2, y: 3 },
				{ x: 2, y: 4 },
				{ x: 3, y: 4 },
				{ x: 2, y: 1 },
				{ x: 3, y: 1 },
				{ x: 3, y: 2 },
				{ x: 4, y: 2 },
				{ x: 4, y: 3 }
			],
			road: [
				{ x: 0, y: 3 },
				{ x: 0, y: 2 },
				{ x: 1, y: 1 },
				{ x: 2, y: 2 },
				{ x: 3, y: 3 },
				{ x: 4, y: 4 },
				{ x: 3, y: 5 },
				{ x: 2, y: 5 },
				{ x: 1, y: 4 },
				{ x: 2, y: 0 },
				{ x: 3, y: 0 },
				{ x: 4, y: 1 },
				{ x: 5, y: 2 },
				{ x: 5, y: 3 }
			]
		}
	}
};

export const DiagThreeStamp: JsonStamp = {
	DiagThreeStamp: {
		anchorPoint: { x: 0, y: 0 },
		stampDims: { width: 4, height: 4 },
		structures: {
			extension: [
				{ dx: 1, dy: 1 },
				{ dx: 2, dy: 1 },
				{ dx: 1, dy: 2 }
			],
			road: [
				{ dx: 0, dy: 1 },
				{ dx: 1, dy: 0 },
				{ dx: 2, dy: 0 },
				{ dx: 3, dy: 1 },
				{ dx: 2, dy: 2 },
				{ dx: 1, dy: 3 },
				{ dx: 0, dy: 2 }
			]
		}
	}
};

export const JustTwoStamp: JsonStamp = {
	JustTwoStamp: {
		centerPoint: { x: 1, y: 1 },
		stampDims: { width: 4, height: 3 },
		structures: {
			extension: [
				{ dx: 1, dy: 1 },
				{ dx: 2, dy: 1 }
			],
			road: [
				{ dx: 1, dy: 2 },
				{ dx: 0, dy: 1 },
				{ dx: 1, dy: 0 },
				{ dx: 2, dy: 0 },
				{ dx: 3, dy: 1 },
				{ dx: 2, dy: 2 }
			]
		}
	}
};

export const KnightFourStamp: JsonStamp = {
	KnightFourStamp: {
		centerPoint: { x: 1, y: 2 },
		stampDims: { width: 4, height: 5 },
		structures: {
			extension: [
				{ dx: 1, dy: 1 },
				{ dx: 1, dy: 2 },
				{ dx: 1, dy: 3 },
				{ dx: 2, dy: 3 }
			],
			road: [
				{ dx: 1, dy: 4 },
				{ dx: 0, dy: 3 },
				{ dx: 0, dy: 2 },
				{ dx: 0, dy: 1 },
				{ dx: 1, dy: 0 },
				{ dx: 2, dy: 1 },
				{ dx: 2, dy: 2 },
				{ dx: 3, dy: 3 },
				{ dx: 2, dy: 4 }
			]
		}
	}
};

export const SingleOneStamp: JsonStamp = {
	SingleOneStamp: {
		centerPoint: { x: 1, y: 1 },
		stampDims: { width: 3, height: 3 },
		structures: {
			extension: [{ dx: 0, dy: 0 }],
			road: [
				{ dx: 0, dy: 1 },
				{ dx: -1, dy: 0 },
				{ dx: 0, dy: -1 },
				{ dx: 1, dy: 0 }
			]
		}
	}
};

export const StickFiveStamp: JsonStamp = {
	StickFiveStamp: {
		centerPoint: { x: 3, y: 1 },
		stampDims: { width: 6, height: 4 },
		structures: {
			extension: [
				{ dx: -1, dy: 0 },
				{ dx: 0, dy: 0 },
				{ dx: 0, dy: 1 },
				{ dx: 1, dy: 0 },
				{ dx: -2, dy: 0 }
			],
			road: [
				{ dx: -2, dy: 1 },
				{ dx: -3, dy: 0 },
				{ dx: -2, dy: -1 },
				{ dx: -1, dy: -1 },
				{ dx: 0, dy: -1 },
				{ dx: 1, dy: -1 },
				{ dx: 2, dy: 0 },
				{ dx: 1, dy: 1 },
				{ dx: 0, dy: 2 },
				{ dx: -1, dy: 1 }
			]
		}
	}
};

export const WrapFiveStamp: JsonStamp = {
	WrapFiveStamp: {
		centerPoint: { x: 2, y: 1 },
		stampDims: { width: 5, height: 4 },
		structures: {
			extension: [
				{ dx: -1, dy: 1 },
				{ dx: -1, dy: 0 },
				{ dx: 0, dy: 0 },
				{ dx: 1, dy: 0 },
				{ dx: 1, dy: 1 }
			],
			road: [
				{ dx: -1, dy: 2 },
				{ dx: 0, dy: 1 },
				{ dx: 1, dy: 2 },
				{ dx: -2, dy: 1 },
				{ dx: -2, dy: 0 },
				{ dx: -1, dy: -1 },
				{ dx: 0, dy: -2 },
				{ dx: 1, dy: -2 },
				{ dx: 2, dy: 0 },
				{ dx: 2, dy: 1 }
			]
		}
	}
};

export const DoglegFiveStamp: JsonStamp = {
	DoglegFiveStamp: {
		centerPoint: { x: 2, y: 2 },
		stampDims: { width: 5, height: 5 },
		structures: {
			extension: [
				{ dx: -1, dy: -1 },
				{ dx: 0, 	dy: -1 },
				{ dx: 0, 	dy: 0	 },
				{ dx: 0, 	dy: 1	 },
				{ dx: 1, 	dy: 1	 }
			],
			road: [
				{ dx: -2, dy: -1	},
				{ dx: -1, dy: 0 	},
				{ dx: -1, dy: 1 	},
				{ dx: 0, 	dy: 2 	},
				{ dx: 1, 	dy: 2 	},
				{ dx: 2, 	dy: 1 	},
				{ dx: 1, 	dy: 0 	},
				{ dx: 1, 	dy: -1	},
				{ dx: 0, 	dy: -2	},
				{ dx: -1, dy: -2	}
			]
		}
	}
}

export const extensionRawStamps: JsonStamp[] = [
	CrossFiveStamp,
	DiagFiveStamp,
	DiagTenStamp,
	DiagThreeStamp,
	JustTwoStamp,
	KnightFourStamp,
	SingleOneStamp,
	StickFiveStamp,
	WrapFiveStamp,
	DoglegFiveStamp
];

export const extensionParsedStamps: ParsedStamp[] = extensionRawStamps.map(stamp => parseJSONStamp(stamp));
