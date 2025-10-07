export function buildProgress(cSite: ConstructionSite, room: Room): void {
	const progPercent: number = parseInt(((cSite.progress / cSite.progressTotal) * 100).toFixed(1));
	let boxWidth: number = 1.2;
	let boxX: number = .6;
	let progColor: string = '#cccccc';
	let boxColor: string = '#666666';
	if (progPercent >= 90) {
		progColor = '#00ff00';
		boxColor = '#00aa00';
	}
	else if (progPercent >= 80) {
		progColor = '#008800';
		boxColor = '#005500';
	}
	else if (progPercent >= 70) {
		progColor = '#004400';
		boxColor = '#002200';
	}
	else if (progPercent >= 60) {
		progColor = '#ffff00';
		boxColor = '#aaaa00';
	}
	else if (progPercent >= 50) {
		progColor = '#aaaa00';
		boxColor = '#888800';
	}
	else if (progPercent >= 40) {
		progColor = '#999900';
		boxColor = '#555500';
	}
	else if (progPercent >= 30) {
		progColor = '#ff8800';
		boxColor = '#aa5500';
	}
	else if (progPercent >= 20) {
		progColor = '#ff5500';
		boxColor = '#884400';
	}
	else if (progPercent >= 10) {
		progColor = '#aa2200';
		boxColor = '#882200';
	}
	else if (progPercent < 10 && progPercent > 0) {
		progColor = '#ff0000';
		boxColor = '#880000';
		boxWidth = .95;
		boxX = .475
	}
	room.visual.rect(cSite.pos.x - boxX, cSite.pos.y + .65, boxWidth, .5, { fill: boxColor, opacity: 0.5, stroke: progColor, strokeWidth: 0.05, lineStyle: 'solid' });
	room.visual.rect(cSite.pos.x - boxX + 0.05, cSite.pos.y + .68, boxWidth - .1, .43, { fill: 'transparent', opacity: 0.8, stroke: '#000000', strokeWidth: 0.025, lineStyle: 'solid' });
	room.visual.text(((cSite.progress / cSite.progressTotal) * 100).toFixed(1) + '%', cSite.pos.x, cSite.pos.y + 1.025, { stroke: '#000000', strokeWidth: 0.055, color: progColor, font: 0.35 })
}

export function repairProgress(building: AnyStructure, room: Room): void {
	const repPercent: number = parseInt(((building.hits / building.hitsMax) * 100).toFixed(1));
	let boxWidth: number = 1.2;
	let boxX: number = .6;
	let repColor: string = '#aaaaaa';
	let boxColor: string = '#666666';
	if (repPercent >= 90) {
		repColor = '#00ff00';
		boxColor = '#00aa00';
	}
	else if (repPercent >= 80) {
		repColor = '#008800';
		boxColor = '#005500';
	}
	else if (repPercent >= 70) {
		repColor = '#004400';
		boxColor = '#002200';
	}
	else if (repPercent >= 60) {
		repColor = '#ffff00';
		boxColor = '#aaaa00';
	}
	else if (repPercent >= 50) {
		repColor = '#aaaa00';
		boxColor = '#888800';
	}
	else if (repPercent >= 40) {
		repColor = '#999900';
		boxColor = '#555500';
	}
	else if (repPercent >= 30) {
		repColor = '#ff8800';
		boxColor = '#aa5500';
	}
	else if (repPercent >= 20) {
		repColor = '#ff5500';
		boxColor = '#884400';
	}
	else if (repPercent >= 10) {
		repColor = '#aa2200';
		boxColor = '#882200';
	}
	else if (repPercent < 10) {
		repColor = '#ff0000';
		boxColor = '#880000';
		boxWidth = .95;
		boxX = .475
	}

	room.visual.rect(building.pos.x - boxX, building.pos.y + .65, boxWidth, .5, { fill: boxColor, opacity: 0.5, stroke: repColor, strokeWidth: 0.05, lineStyle: 'solid' });
	room.visual.rect(building.pos.x - boxX + 0.05, building.pos.y + .68, boxWidth - .1, .43, { fill: 'transparent', opacity: 0.8, stroke: '#000000', strokeWidth: 0.025, lineStyle: 'solid' });
	room.visual.text(repPercent + '%', building.pos.x, building.pos.y + 1.025, { stroke: '#000000', strokeWidth: 0.025, color: repColor, font: 0.35 });
}

export function drawBox(x: number, y: number, width: number, height: number, opacity: number = 0.5, stroke = '#bbbbbb', strokeWidth = 0.05, lineStyle = 'solid'): void {

}
