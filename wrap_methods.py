#!/usr/bin/env python3
"""
Script to wrap all methods in TypeScript class files with try/catch blocks
"""
import re
import sys

def wrap_roommanager_methods(content):
    """Wrap remaining unwrapped methods in RoomManager"""

    # Fix regenerateBasePlan first
    content = content.replace(
        """	/** Force regeneration of base plan */
	public regenerateBasePlan(): void {
		try {
		delete this.room.memory.basePlan;
		this.room.log(`Base plan cleared - will regenerate next tick`);
	}""",
        """	/** Force regeneration of base plan */
	public regenerateBasePlan(): void {
		try {
			delete this.room.memory.basePlan;
			this.room.log(`Base plan cleared - will regenerate next tick`);
		} catch (e) {
			console.log(`Execution Error In Function: RoomManager.regenerateBasePlan(${this.room.name}) on Tick ${Game.time}. Error: ${e}`);
		}
	}"""
    )

    # Pattern to find methods that need wrapping
    # Look for methods that don't have try { immediately after the opening brace
    patterns_to_wrap = [
        # gatherStats
        (r'(	/\*\* Gathers current room statistics \*/\n	private gatherStats\(\): RoomStats \{\n)',
         r'\1\t\ttry {\n'),
        # getRepairPriority
        (r'(	/\*\* Determines repair priority for structures \*/\n	private getRepairPriority\(structure: Structure\): number \{\n)',
         r'\1\t\ttry {\n'),
        # assessCreepNeeds
        (r'(	/\*\* Assesses which creeps are needed and submits spawn requests to SpawnManager \*/\n	private assessCreepNeeds\(\): void \{\n)',
         r'\1\t\ttry {\n'),
    ]

    for pattern, replacement in patterns_to_wrap:
        content = re.sub(pattern, replacement, content)

    return content

if __name__ == '__main__':
    filepath = r'c:\Programming\screeps-redux-ts - Copy\src\managers\RoomManager.ts'

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    modified = wrap_roommanager_methods(content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(modified)

    print(f"Wrapped methods in {filepath}")
