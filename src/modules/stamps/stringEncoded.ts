export type EncodedSymbols = `x` | `e` | `T` | `.` | `-` | `S` | `^` | `8` | `L` | `C` | `N` | `O` | `F` | `E` | `P` | `B` | `%` | `R` | `$`;
                 //   ext  tower empty road  spawn  term  stor  link cntnr nuker  obsv  fact  ext  pspwn  lab   wall  ramp cntrlr

interface StringEncodedStamp {
	stamp: EncodedSymbols[],
	anchor: { x: number, y: number }
}

export const CrossFiveStamp: StringEncodedStamp = {
	stamp: ['..-..', '.-e-.', '-eee-', '.-e-.', '..-..' as EncodedSymbols] as EncodedSymbols[],
	anchor: { x: 0, y: 0 },
};

export function stringToConstant(string: string): Array<StructureConstant | null> {
	const constantArray: Array<StructureConstant | null> = [];
	for (let i = 0; i < string.length; i++) {
		switch (string[i]) {
			case 'x':
			case 'e':
				constantArray.push(STRUCTURE_EXTENSION);
				break;
			case 'T':
				constantArray.push(STRUCTURE_TOWER);
				break;
			case '.':
				constantArray.push(null);
				break;
			case '-':
				constantArray.push(STRUCTURE_ROAD);
				break;
			case 'S':
				constantArray.push(STRUCTURE_SPAWN);
				break;
			case '^':
				constantArray.push(STRUCTURE_TERMINAL);
				break;
			case '8':
				constantArray.push(STRUCTURE_STORAGE);
				break;
			case 'L':
				constantArray.push(STRUCTURE_LINK);
				break;
			case 'C':
				constantArray.push(STRUCTURE_CONTAINER);
				break;
			case 'N':
				constantArray.push(STRUCTURE_NUKER);
				break;
			case 'O':
				constantArray.push(STRUCTURE_OBSERVER);
				break;
			case 'F':
				constantArray.push(STRUCTURE_FACTORY);
				break;
			case 'E':
				constantArray.push(STRUCTURE_EXTRACTOR);
				break;
			case 'P':
				constantArray.push(STRUCTURE_POWER_SPAWN);
				break;
			case 'B':
				constantArray.push(STRUCTURE_LAB);
				break;
			case '%':
				constantArray.push(STRUCTURE_WALL);
				break;
			case 'R':
				constantArray.push(STRUCTURE_RAMPART);
				break;
			case '$':
				constantArray.push(STRUCTURE_CONTROLLER);
				break;
			default:
				constantArray.push(null);
				break;
		}
	}
	return constantArray;
}

