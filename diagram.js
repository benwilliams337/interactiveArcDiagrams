var canvasWidth = 960;
var canvasHeight = 600;
var staffHeight = 200;
var scorePosY = canvasHeight * 0.9;

var svg;
var staffCanvas_l;
var staffCanvas_r;
var arcs;
var selectedParts;
var selectedLength = 2; //TODO: should 2 be the default?
var partColors;
var showColors = false;

function drawArcDiagram(containerId, partsListContainerId, staff1ContainerId, staff2ContainerId, data, numParts, useColors) {
	$("#divFileUpload").hide();
	$("#diagramTable").show();
	
	svg = d3.select("#" + containerId)
		.append("svg")
		.attr("width", canvasWidth)
		.attr("height", canvasHeight);
		
	var plot = svg.append("g")
		.attr("id", "plot");
	
	partColors = d3.scale.category10();
	showColors = useColors;
	drawArcs(data);
	
	//Part labels
	selectedParts = [];
	for(var i = 0; i < numParts; i++)
		selectedParts[i] = true;
	var partsList = d3.select("#" + partsListContainerId)
		.selectAll("div")
		.data(d3.range(numParts))
		.enter()
		.append('div')
		.html(function(d) {
			var result = "<label><input id='cbPart" + d + "' type='checkbox' onclick='onPartCheckboxClicked(this, " + d +
				");' checked>";
			if(showColors) {
				result += " <div style='display:inline-block; background-color:" + partColors(d) + "; border-radius: 5px; width:15px; height:15px;'></div> ";
			}
			result += "Part " + d + "</label>";
			return result;
		});
	
	staffCanvas_l = $("#" + staff1ContainerId);
	staffCanvas_r = $("#" + staff2ContainerId);
	
	var container = $("#" + containerId);
	container.append("<br/><span id='matchLengthDisplay'>2</span>"); //TODO: Add a class/styles
	lengthLabel = $("#matchLengthDisplay");
	
	var maxLength = d3.max(data, function(d) {
		return d.length;
	});
	var matchLengthSlider = d3.select("#" + containerId)
		.append("input")
		.attr("type", "range")
		.attr("min", 2)
		.attr("max", maxLength)
		.attr("value", selectedLength)
		.style("width", canvasWidth / 2)
		.on("input", function() {
			selectedLength = this.value;
			lengthLabel.html(selectedLength);
			arcs.style("visibility", arcVisibility);
		}); 
}

function onPartCheckboxClicked(cb, partNum) {
	for(var i = 0; i < selectedParts.length; i++) {
		selectedParts[i] = $("#cbPart" + i).is(':checked');
	}
	arcs.style("visibility", arcVisibility);
}

function arcVisibility(d) {
	for(var i = 0; i < d.themes.length; i++) {
		if(!selectedParts[d.themes[i].partNum])
			return "hidden";
	}
	return d.length >= selectedLength ? "visible" : "hidden";
}

function drawArcs(data) {
	arcs = d3.select("#plot").selectAll(".arc")
		.data(data)
		.enter()
		.append("path")
		.attr("class", "arc")
		.attr("d", computePath)
		.style("opacity", 0.2)
		.style("fill", arcFill)
		.on('mouseover', onMouseOver)
		.on('mouseout', onMouseOut)
		.on('click', onClick);
}

function arcFill(match) {
	if(!showColors)
		return "black";
	if(match.themes[0].partNum == match.themes[1].partNum)
		return partColors(match.themes[0].partNum);
	else {
		var color1 = partColors(match.themes[0].partNum);
		var color2 = partColors(match.themes[1].partNum);
		var interp = d3.interpolateRgb(color1, color2);
		return interp(0.5);
	}
}

function onMouseOver(match) {
	var arc = d3.select(this);
	if(match != selectedMatch) {
		arc.transition().duration(200)
			.style("opacity", 0.8);
	}

	if(selectedMatch == null) {
		renderNotesForMatch(match);
	}
}

function onMouseOut(match) {
	var arc = d3.select(this);
	if(match != selectedMatch) {
		arc.transition().duration(200)
			.style("opacity", 0.2);
	}
	
	if(selectedMatch == null) {
		clearNotes(staffCanvas_l);
		clearNotes(staffCanvas_r);
	}
}

var selectedMatch = null;
var selectedArc = null;
function onClick(match) {
	var arc = d3.select(this);
	var prevSelectedMatch = selectedMatch;
	
	//Properly deselect any previous arc
	if(selectedMatch != null) {
		if(match == selectedMatch) {
			//Return to hover state
			selectedArc.transition().duration(200)
				.style("opacity", 0.8)
				.style("fill", arcFill);
		}
		else {
			//Return to default state
			selectedArc.transition().duration(200)
				.style("opacity", 0.2)
				.style("fill", arcFill);
		}
		
	}
	
	if(match != prevSelectedMatch) {
		//Select new arc
		var arcData = arc.data();
		selectedMatch = arcData[0];
		selectedArc = arc;
		arc.transition().duration(200)
			.style("opacity", 1.0)
			.style("fill", showColors ? "black" : "blue");	
		renderNotesForMatch(match);
	}
	else {
		selectedMatch = null;
		selectedArc = null;
	}
}

function clearSelection() {
	selectedMatch = null;
	selectedArc = null;
	clearNotes(staffCanvas_l);
	clearNotes(staffCanvas_r);
}

function computePath(match) {
	var earlierPos = match.themes[0].startPos < match.themes[1].startPos ? 0 : 1;
	var laterPos = 1 - earlierPos;
	
	//Grab positions
	var startPos_a = percentToPixels(match.themes[earlierPos].startPos);
	var endPos_a = percentToPixels(match.themes[earlierPos].endPos);
	var startPos_b = percentToPixels(match.themes[laterPos].startPos);
	var endPos_b = percentToPixels(match.themes[laterPos].endPos);
	//Compute radius of outer and inner arcs
	var outerRadius = Math.abs(startPos_a - endPos_b) / 2;
	var innerRadius = Math.abs(endPos_a - startPos_b) / 2;
	
	var result = "";
	//Start point
	result += "M" + startPos_a + " " + scorePosY;
	//Outer arc
	result += "A" + outerRadius + " " + outerRadius + " 0,0,1," + endPos_b + " " + scorePosY;
	//Line to start of inner arc
	result += "L" + startPos_b + " " + scorePosY;
	//Inner arc
	result += "A" + innerRadius + " " + innerRadius + " 0,0,0," + endPos_a + " " + scorePosY;
	//Close
	result += "Z";
	
	return result;
}

function percentToPixels(percent) {
	return percent * canvasWidth;
}

function renderNotesForMatch(match) {
	renderNotes(staffCanvas_l, match.displayThemes[0].notes);
	renderNotes(staffCanvas_r, match.displayThemes[1].notes);
}

function renderNotes(staffCanvas, notes) {
	var notesAsHumdrum = notesToHumdrum(notes).replace(/^\s+/, ""); //Regex here trims any leading whitespace (probably not necessary, actually)
	var options = {
		inputFormat: "auto", //Options: kern, mei (not MIDI)
		adjustPageHeight: 1, //1 to chop off any unused vertical space
		//pageHeight: staffHeight, //Box dimensions
		//pageWidth:  canvasWidth / 2,
		pageWidth: 800,
		scale:  60, //Zoom
		border:  40, //Padding
		font: "Leipzig"
	};
	var staffSvg = verovioToolkit.renderData(notesAsHumdrum, JSON.stringify(options));
	staffCanvas.html(staffSvg);

	//console.log(notesAsHumdrum);
}

function clearNotes(staffCanvas) {
	staffCanvas.html("");
}