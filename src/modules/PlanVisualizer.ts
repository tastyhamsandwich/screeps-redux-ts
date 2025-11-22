//const profiler = require('screeps-profiler');
/**
 * Room Planning Visualizer
 * Provides comprehensive visualization for base planning algorithms
 * @author randomencounter
 */

export default class RoomPlanningVisualizer {
	private room: Room;
	private visual: RoomVisual;

	/**
	 * Creates a new RoomPlanningVisualizer instance
	 * @param room - Room to visualize
	 * @author randomencounter
	 */
	constructor(room: Room) {
		this.room = room;
		this.visual = new RoomVisual(room.name);
	}

	/**
	 * Main entry point for visualization
	 * Checks room memory flags and renders appropriate overlays
	 * @param distanceTransform - Distance transform grid data
	 * @param floodFill - Flood fill grid data
	 * @param basePlan - Complete base plan with placements
	 * @author randomencounter
	 */
	public visualize(
		distanceTransform?: number[][],
		floodFill?: number[][],
		basePlan?: any
	): void {
		const visuals = this.room.memory.visuals || {};

		// Layer 1: Distance Transform
		if (visuals.basePlan.visDistTrans && distanceTransform) {
			this.drawDistanceTransform(distanceTransform);
		}

		// Layer 2: Flood Fill
		if (visuals.basePlan.visFloodFill && floodFill) {
			this.drawFloodFill(floodFill);
		}

		// Layer 3: Base Layout
		if (visuals.basePlan.visBasePlan && basePlan) {
			this.drawBasePlan(basePlan);
		}

		// Layer 4: Planning Info
		if (visuals.basePlan.visPlanInfo) {
			this.drawPlanningInfo(basePlan);
		}

		// Layer 5: Build Progress
		if (visuals.basePlan.buildProgress && basePlan) {
			this.drawBuildProgress(basePlan);
		}
	}

	/**
	 * Draw distance transform overlay
	 * Shows terrain openness with color gradient and numeric values
	 * @param grid - Distance transform grid
	 * @author randomencounter
	 */
	private drawDistanceTransform(grid: number[][]): void {
		const maxDist = Math.max(...flatten2D(grid));

		for (let x = 0; x < 50; x++) {
			for (let y = 0; y < 50; y++) {
				const dist = grid[x][y];
				if (dist <= 0) continue;

				// Color gradient from red (close to walls) to green (open)
				const ratio = dist / maxDist;
				const hue = ratio * 120; // 0 (red) to 120 (green)

				// Draw colored rectangle
				this.visual.rect(x - 0.5, y - 0.5, 1, 1, {
					fill: `hsl(${hue}, 100%, 40%)`,
					opacity: 0.3,
					stroke: undefined
				});

				// Show distance value for significant open areas
				if (dist >= 3) {
					this.visual.text(dist.toString(), x, y + 0.1, {
						color: '#fff',
						font: 0.4,
						align: 'center',
						backgroundPadding: 0.1,
						backgroundColor: '#00000080'
					});
				}
			}
		}

		// Legend
		this.drawLegend('Distance Transform', 1, [
			{ color: 'hsl(0, 100%, 40%)', label: 'Near Wall' },
			{ color: 'hsl(60, 100%, 40%)', label: 'Medium' },
			{ color: 'hsl(120, 100%, 40%)', label: 'Open Space' }
		]);
	}

	/**
	 * Draw flood fill overlay
	 * Shows accessibility from core with step count
	 * @param grid - Flood fill grid
	 * @author randomencounter
	 */
	private drawFloodFill(grid: number[][]): void {
		const flat = flatten2D(grid);
		const maxSteps = Math.max(...flat.filter(v => v < 255));

		for (let x = 0; x < 50; x++) {
			for (let y = 0; y < 50; y++) {
				const steps = grid[x][y];
				if (steps <= 0 || steps >= 255) continue;

				// Color gradient from blue (close to core) to yellow (far)
				const ratio = steps / maxSteps;
				const hue = 240 - (ratio * 60); // 240 (blue) to 180 (cyan)

				// Draw colored rectangle
				this.visual.rect(x - 0.5, y - 0.5, 1, 1, {
					fill: `hsl(${hue}, 100%, 40%)`,
					opacity: 0.25,
					stroke: undefined
				});

				// Show step count for close tiles
				if (steps <= 15) {
					this.visual.text(steps.toString(), x, y + 0.1, {
						color: '#0ff',
						font: 0.35,
						align: 'center'
					});
				}
			}
		}

		// Legend
		this.drawLegend('Flood Fill Map', 2, [
			{ color: 'hsl(240, 100%, 40%)', label: 'Core Area' },
			{ color: 'hsl(210, 100%, 40%)', label: 'Near Core' },
			{ color: 'hsl(180, 100%, 40%)', label: 'Periphery' }
		]);
	}

	/**
	 * Draw complete base plan with structure placements
	 * @param plan - Base plan with placements and schedule
	 * @author randomencounter
	 */
	private drawBasePlan(plan: any): void {
		if (!plan || !plan.placements) return;

		const rcl = this.room.controller?.level || 8;

		// Group placements by structure type for efficient rendering
		const placementsByType = new Map<string, any[]>();

		for (const placement of plan.placements) {
			const type = placement.structure;
			if (!placementsByType.has(type))
				placementsByType.set(type, []);
			placementsByType.get(type)!.push(placement);
		}

		// Draw each structure type
		for (const [type, placements] of placementsByType)
			this.drawStructureType(type as StructureConstant, placements, rcl);

		// Draw special areas
		if (plan.controllerArea)
			this.drawControllerArea(plan.controllerArea);

		if (plan.ramparts)
			this.drawRamparts(plan.ramparts);

		// Draw core marker
		if (plan.startPos)
			this.drawCoreMarker(plan.startPos);
	}

	/**
	 * Draw a specific structure type
	 * @param type - Structure type
	 * @param placements - Array of placements for this type
	 * @param rcl - Current RCL
	 * @author randomencounter
	 */
	private drawStructureType(type: StructureConstant, placements: any[], rcl: number): void {
		const style = this.getStructureStyle(type);

		for (const placement of placements) {
			const { x, y } = placement.pos;

			// Check if structure is available at current RCL
			const available = this.isAvailableAtRCL(type, rcl);
			const opacity = available ? style.opacity : style.opacity * 0.3;

			switch (style.shape) {
				case 'circle':
					this.visual.circle(x, y, {
						radius: style.size,
						fill: style.color,
						opacity: opacity,
						stroke: style.stroke || style.color,
						strokeWidth: 0.05
					});
					break;

				case 'rect':
					this.visual.rect(
						x - style.size,
						y - style.size,
						style.size * 2,
						style.size * 2,
						{
							fill: style.color,
							opacity: opacity,
							stroke: style.stroke || style.color,
							strokeWidth: 0.05
						}
					);
					break;

				case 'diamond':
					this.visual.poly([
						[x, y - style.size],
						[x + style.size, y],
						[x, y + style.size],
						[x - style.size, y]
					], {
						fill: style.color,
						opacity: opacity,
						stroke: style.stroke || style.color,
						strokeWidth: 0.05
					});
					break;

				case 'line':
					// Special case for roads
					this.visual.circle(x, y, {
						radius: 0.1,
						fill: style.color,
						opacity: opacity
					});
					break;
			}

			// Add label for important structures
			if (style.label) {
				this.visual.text(style.label, x, y + 0.05, {
					color: '#fff',
					font: style.labelSize || 0.4,
					align: 'center',
					opacity: available ? 1 : 0.3
				});
			}
		}
	}

	/**
	 * Get visual style for structure type
	 * @param type - Structure type
	 * @returns Visual style configuration
	 * @author randomencounter
	 */
	private getStructureStyle(type: StructureConstant): any {
		const styles: { [key: string]: any } = {
			[STRUCTURE_SPAWN]: {
				shape: 'circle',
				size: 0.5,
				color: '#00f',
				opacity: 0.7,
				label: 'S',
				labelSize: 0.5
			},
			[STRUCTURE_EXTENSION]: {
				shape: 'circle',
				size: 0.35,
				color: '#ff0',
				opacity: 0.5,
				label: 'E',
				labelSize: 0.3
			},
			[STRUCTURE_TOWER]: {
				shape: 'circle',
				size: 0.45,
				color: '#f00',
				opacity: 0.6,
				label: 'T',
				labelSize: 0.4
			},
			[STRUCTURE_STORAGE]: {
				shape: 'rect',
				size: 0.45,
				color: '#fa0',
				opacity: 0.7,
				label: 'St',
				labelSize: 0.35
			},
			[STRUCTURE_LINK]: {
				shape: 'diamond',
				size: 0.4,
				color: '#0ff',
				opacity: 0.6,
				label: 'L',
				labelSize: 0.35
			},
			[STRUCTURE_LAB]: {
				shape: 'circle',
				size: 0.4,
				color: '#f0f',
				opacity: 0.5,
				label: 'Lab',
				labelSize: 0.25
			},
			[STRUCTURE_TERMINAL]: {
				shape: 'rect',
				size: 0.4,
				color: '#0ff',
				opacity: 0.6,
				label: 'Tm',
				labelSize: 0.3
			},
			[STRUCTURE_CONTAINER]: {
				shape: 'rect',
				size: 0.35,
				color: '#888',
				opacity: 0.4,
				label: 'C',
				labelSize: 0.3
			},
			[STRUCTURE_ROAD]: {
				shape: 'line',
				size: 0.1,
				color: '#666',
				opacity: 0.3
			},
			[STRUCTURE_RAMPART]: {
				shape: 'rect',
				size: 0.5,
				color: '#0f0',
				stroke: '#0f0',
				opacity: 0.2
			},
			[STRUCTURE_FACTORY]: {
				shape: 'rect',
				size: 0.45,
				color: '#fff',
				opacity: 0.6,
				label: 'F',
				labelSize: 0.4
			},
			[STRUCTURE_POWER_SPAWN]: {
				shape: 'rect',
				size: 0.45,
				color: '#f0f',
				opacity: 0.6,
				label: 'PS',
				labelSize: 0.3
			},
			[STRUCTURE_NUKER]: {
				shape: 'circle',
				size: 0.5,
				color: '#f00',
				opacity: 0.7,
				label: 'N',
				labelSize: 0.4
			},
			[STRUCTURE_OBSERVER]: {
				shape: 'circle',
				size: 0.4,
				color: '#88f',
				opacity: 0.5,
				label: 'O',
				labelSize: 0.35
			},
			[STRUCTURE_EXTRACTOR]: {
				shape: 'rect',
				size: 0.45,
				color: '#888',
				opacity: 0.4,
				label: 'X',
				labelSize: 0.4
			}
		};

		return styles[type] || {
			shape: 'circle',
			size: 0.3,
			color: '#999',
			opacity: 0.3
		};
	}

	/**
	 * Draw controller upgrade area
	 * @param area - Array of positions in controller area
	 * @author randomencounter
	 */
	private drawControllerArea(area: RoomPosition[]): void {
		for (const pos of area) {
			this.visual.rect(pos.x - 0.45, pos.y - 0.45, 0.9, 0.9, {
				fill: '#ff0',
				opacity: 0.15,
				stroke: '#ff0',
				strokeWidth: 0.05
			});
		}

		// Label the center
		if (area.length > 4) {
			const center = area[4]; // Center of 3x3
			this.visual.text('CTRL', center.x, center.y - 1.5, {
				color: '#ff0',
				font: 0.5,
				align: 'center'
			});
		}
	}

	/**
	 * Draw rampart positions
	 * @param ramparts - Array of rampart positions
	 * @author randomencounter
	 */
	private drawRamparts(ramparts: RoomPosition[]): void {
		for (const pos of ramparts) {
			this.visual.rect(pos.x - 0.5, pos.y - 0.5, 1, 1, {
				fill: 'transparent',
				stroke: '#0f0',
				strokeWidth: 0.1,
				opacity: 0.8,
				lineStyle: 'dashed'
			});
		}
	}

	/**
	 * Draw core/center marker
	 * @param pos - Core position
	 * @author randomencounter
	 */
	private drawCoreMarker(pos: RoomPosition): void {
		// Outer ring
		this.visual.circle(pos.x, pos.y, {
			radius: 0.8,
			fill: 'transparent',
			stroke: '#00f',
			strokeWidth: 0.1,
			opacity: 0.5
		});

		// Inner circle
		this.visual.circle(pos.x, pos.y, {
			radius: 0.2,
			fill: '#00f',
			opacity: 0.3
		});

		// Crosshair
		this.visual.line(pos.x - 1, pos.y, pos.x + 1, pos.y, {
			color: '#00f',
			width: 0.05,
			opacity: 0.3
		});
		this.visual.line(pos.x, pos.y - 1, pos.x, pos.y + 1, {
			color: '#00f',
			width: 0.05,
			opacity: 0.3
		});

		// Label
		this.visual.text('CORE', pos.x, pos.y - 1.5, {
			color: '#00f',
			font: 0.6,
			align: 'center',
			opacity: 0.8
		});
	}

	/**
	 * Draw planning information overlay
	 * @param plan - Base plan
	 * @author randomencounter
	 */
	private drawPlanningInfo(plan: any): void {
		if (!plan) return;

		let y = 1;
		const x = 1;
		const lineHeight = 0.8;

		// Title
		this.visual.text('Base Planning Info', x, y, {
			color: '#fff',
			font: 0.7,
			align: 'left'
		});
		y += lineHeight;

		// Core position
		if (plan.startPos) {
			this.visual.text(`Core: ${plan.startPos.x},${plan.startPos.y}`, x, y, {
				color: '#0ff',
				font: 0.5,
				align: 'left'
			});
			y += lineHeight;
		}

		// Structure counts
		const counts = this.countStructures(plan);
		for (const [type, count] of counts) {
			const style = this.getStructureStyle(type as StructureConstant);
			this.visual.text(`${type}: ${count}`, x, y, {
				color: style.color,
				font: 0.4,
				align: 'left'
			});
			y += lineHeight * 0.7;

			if (y > 48) break; // Prevent overflow
		}

		// Timestamp
		if (plan.timestamp) {
			this.visual.text(`Generated: ${Game.time - plan.timestamp} ticks ago`, x, 49, {
				color: '#888',
				font: 0.4,
				align: 'left'
			});
		}
	}

	/**
	 * Draw build progress for current RCL
	 * @param plan - Base plan with RCL schedule
	 * @author randomencounter
	 */
	private drawBuildProgress(plan: any): void {
		if (!plan || !plan.rclSchedule) return;

		const rcl = this.room.controller?.level || 1;
		const schedule = plan.rclSchedule[rcl] || [];

		// Count built vs planned
		const built = this.countBuiltStructures();
		const planned = this.countPlannedStructures(schedule);

		// Draw progress bar
		const barWidth = 10;
		const barHeight = 0.5;
		const barX = 39;
		const barY = 1;

		// Background
		this.visual.rect(barX, barY, barWidth, barHeight, {
			fill: '#333',
			opacity: 0.8
		});

		// Progress
		const progress = Math.min(1, built / Math.max(1, planned));
		this.visual.rect(barX, barY, barWidth * progress, barHeight, {
			fill: '#0f0',
			opacity: 0.8
		});

		// Text
		this.visual.text(`RCL${rcl}: ${built}/${planned}`, barX + barWidth / 2, barY + 1.2, {
			color: '#fff',
			font: 0.5,
			align: 'center'
		});

		// Show next structures to build
		const nextToBuild = this.getNextToBuild(schedule);
		if (nextToBuild.length > 0) {
			let y = barY + 2.5;
			this.visual.text('Next:', barX, y, {
				color: '#ccc',
				font: 0.4,
				align: 'left'
			});

			y += 0.6;
			for (const structure of nextToBuild.slice(0, 3)) {
				this.visual.text(`• ${structure}`, barX, y, {
					color: '#aaa',
					font: 0.35,
					align: 'left'
				});
				y += 0.5;
			}
		}
	}

	/**
	 * Draw a legend for visualizations
	 * @param title - Legend title
	 * @param position - Position index (1, 2, 3, etc.)
	 * @param items - Legend items with color and label
	 * @author randomencounter
	 */
	private drawLegend(title: string, position: number, items: Array<{ color: string; label: string }>): void {
		const x = 35;
		const y = 47 - (position * 3);

		// Title
		this.visual.text(title, x, y, {
			color: '#fff',
			font: 0.5,
			align: 'left',
			opacity: 0.9
		});

		// Items
		let offsetY = 0.7;
		for (const item of items) {
			// Color box
			this.visual.rect(x, y + offsetY, 0.5, 0.4, {
				fill: item.color,
				opacity: 0.8
			});

			// Label
			this.visual.text(item.label, x + 0.7, y + offsetY + 0.2, {
				color: '#ccc',
				font: 0.35,
				align: 'left',
				opacity: 0.8
			});

			offsetY += 0.6;
		}
	}

	/**
	 * Check if structure type is available at given RCL
	 * @param type - Structure type
	 * @param rcl - Room control level
	 * @returns true if available
	 * @author randomencounter
	 */
	private isAvailableAtRCL(type: StructureConstant, rcl: number): boolean {
		const limits = CONTROLLER_STRUCTURES[type];
		return limits && limits[rcl] > 0;
	}

	/**
	 * Count structures in plan by type
	 * @param plan - Base plan
	 * @returns Map of structure counts
	 * @author randomencounter
	 */
	private countStructures(plan: any): Map<string, number> {
		const counts = new Map<string, number>();

		if (!plan || !plan.placements) return counts;

		for (const placement of plan.placements) {
			const type = placement.structure;
			counts.set(type, (counts.get(type) || 0) + 1);
		}

		return counts;
	}

	/**
	 * Count built structures in room
	 * @returns Number of built structures
	 * @author randomencounter
	 */
	private countBuiltStructures(): number {
		return this.room.find(FIND_STRUCTURES, {
			filter: s => s.structureType !== STRUCTURE_ROAD &&
				s.structureType !== STRUCTURE_WALL &&
				s.structureType !== STRUCTURE_KEEPER_LAIR &&
				s.structureType !== STRUCTURE_CONTROLLER
		}).length;
	}

	/**
	 * Count planned structures in schedule
	 * @param schedule - RCL schedule array
	 * @returns Number of planned structures
	 * @author randomencounter
	 */
	private countPlannedStructures(schedule: any[]): number {
		return schedule.filter(p =>
			p.structure !== STRUCTURE_ROAD &&
			p.structure !== STRUCTURE_RAMPART
		).length;
	}

	/**
	 * Get next structures to build
	 * @param schedule - RCL schedule
	 * @returns Array of structure types to build next
	 * @author randomencounter
	 */
	private getNextToBuild(schedule: any[]): string[] {
		const built = new Set<string>();
		const structures = this.room.find(FIND_STRUCTURES);

		for (const s of structures) {
			built.add(`${s.pos.x},${s.pos.y},${s.structureType}`);
		}

		const toBuild: string[] = [];
		for (const placement of schedule) {
			const key = `${placement.pos.x},${placement.pos.y},${placement.structure}`;
			if (!built.has(key))
				toBuild.push(placement.structure);
			if (toBuild.length >= 5) break;
		}

		return toBuild;
	}

	/**
	 * Toggle visualization layer
	 * @param layer - Layer name to toggle
	 * @author randomencounter
	 */
	public static toggleLayer(room: Room, layer: string): void {
		if (!room.memory.visuals.basePlan)
			room.memory.visuals = {
				basePlan: {
					visDistTrans: false,
					visBasePlan: false,
					visFloodFill: false,
					visPlanInfo: false
				},
				enableVisuals: false,
			};

		const key = `vis${layer}`;
		(room.memory.visuals.basePlan as Record<string, boolean>)[key] = !room.memory.visuals[key];

		console.log(`[${room.name}] Visualization '${layer}' is now ${room.memory.visuals.basePlan[key] ? 'ON' : 'OFF'}`);
	}

	/**
	 * Enable all visualization layers
	 * @param room - Room to enable visualizations for
	 * @author randomencounter
	 */
	public static enableAll(room: Room): void {
		if (!room.memory.visuals.basePlan)
			room.memory.visuals.basePlan = {};

		room.memory.visuals.basePlan.visDistTrans = true;
		room.memory.visuals.basePlan.visFloodFill = true;
		room.memory.visuals.basePlan.visBasePlan = true;
		room.memory.visuals.basePlan.visPlanInfo = true;
		room.memory.visuals.basePlan.buildProgress = true;

		console.log(`[${room.name}] All visualizations enabled`);
	}

	/**
	 * Disable all visualization layers
	 * @param room - Room to disable visualizations for
	 * @author randomencounter
	 */
	public static disableAll(room: Room): void {
		if (!room.memory.visuals.basePlan)
			room.memory.visuals.basePlan = {};

		room.memory.visuals.basePlan.visDistTrans = false;
		room.memory.visuals.basePlan.visFloodFill = false;
		room.memory.visuals.basePlan.visBasePlan = false;
		room.memory.visuals.basePlan.visPlanInfo = false;
		room.memory.visuals.basePlan.buildProgress = false;

		console.log(`[${room.name}] All visualizations disabled`);
	}
}

// Extend Room Memory interface
interface RoomMemory {
	visuals?: {
		visDistTrans?: boolean;
		visFloodFill?: boolean;
		visBasePlan?: boolean;
		visPlanInfo?: boolean;
		buildProgress?: boolean;
		[key: string]: any;
	};
	[key: string]: any;
}

// Export visualization helper functions for console use
global.RoomVis = {
	/**
	 * Toggle a visualization layer for a room
	 * @example RoomVis.toggle('W1N1', 'DistTrans')
	 * @author randomencounter
	 */
	toggle: (roomName: string, layer: string) => {
		const room = Game.rooms[roomName];
		if (!room) {
			console.log(`Room ${roomName} not visible`);
			return;
		}
		RoomPlanningVisualizer.toggleLayer(room, layer);
	},

	/**
	 * Enable all visualizations for a room
	 * @example RoomVis.enableAll('W1N1')
	 * @author randomencounter
	 */
	enableAll: (roomName: string) => {
		const room = Game.rooms[roomName];
		if (!room) {
			console.log(`Room ${roomName} not visible`);
			return;
		}
		RoomPlanningVisualizer.enableAll(room);
	},

	/**
	 * Disable all visualizations for a room
	 * @example RoomVis.disableAll('W1N1')
	 * @author randomencounter
	 */
	disableAll: (roomName: string) => {
		const room = Game.rooms[roomName];
		if (!room) {
			console.log(`Room ${roomName} not visible`);
			return;
		}
		RoomPlanningVisualizer.disableAll(room);
	},

	/**
	 * Show visualization status for a room
	 * @example RoomVis.status('W1N1')
	 * @author randomencounter
	 */
	status: (roomName: string) => {
		const room = Game.rooms[roomName];
		if (!room) {
			console.log(`Room ${roomName} not visible`);
			return;
		}

		const visuals = room.memory.visuals || {};
		room.log(`[${roomName}] Visualization Status:`);
		room.log(`  Distance Transform: ${visuals.basePlan.visDistTrans ? 'ON' : 'OFF'}`);
		room.log(`  Flood Fill: ${visuals.basePlan.visFloodFill ? 'ON' : 'OFF'}`);
		room.log(`  Base Plan: ${visuals.basePlan.visBasePlan ? 'ON' : 'OFF'}`);
		room.log(`  Plan Info: ${visuals.basePlan.visPlanInfo ? 'ON' : 'OFF'}`);
		room.log(`  Build Progress: ${visuals.basePlan.buildProgress ? 'ON' : 'OFF'}`);
	}
};

function flatten2D<T>(grid: T[][]): T[] {
	const out: T[] = [];
	for (let i = 0; i < grid.length; i++) {
		const row = grid[i];
		for (let j = 0; j < row.length; j++) {
			out.push(row[j]);
		}
	}
	return out;
}

//profiler.registerClass(RoomPlanningVisualizer, 'RoomPlanningVisualizer');
