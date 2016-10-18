//Given raw JSON data representing our music, returns an array of Match objects representing matching themes in our music.
function findThemes(parts, options) {	
	//Consolidate rests
	for(var i = 0; i < parts.length; i++) {
		parts[i] = consolidateRests(parts[i]);
	}
	
	var allMatches = [];
	for(var i = 0; i < parts.length; i++) {
		for(var j = i; j < parts.length; j++) {
			var matches = findMatches(parts[i], parts[j], i, j, options);
			allMatches.push.apply(allMatches, matches);
		}
	}
	return allMatches;
}

var matchIndex_a, matchIndex_b;
function findMatches(notes_a_raw, notes_b_raw, partNum_a, partNum_b, options) {
	var isSelfComparison = partNum_a == partNum_b;
	//"Remove Rests" option
	var notes_a, notes_b, indexMap_a, indexMap_b;
	if(options.includeRests) {
		notes_a = notes_a_raw;
		notes_b = notes_b_raw;
		indexMap_a = makeDummyIndex(notes_a.length);
		indexMap_b = makeDummyIndex(notes_b.length);
	}
	else {
		var results_a = removeRestsWithIndex(notes_a_raw);
		var results_b = removeRestsWithIndex(notes_b_raw);
		notes_a = results_a.notesWithoutRests;
		notes_b = results_b.notesWithoutRests;
		indexMap_a = results_a.indexMap;
		indexMap_b = results_b.indexMap;
	}
	//Build index for duration-based positions for arc anchors. Needs to be based off raw notes input
	var posIndex_a = buildPositionIndex(notes_a_raw);
	var posIndex_b = buildPositionIndex(notes_b_raw);
	
	var minLength = 2;
	if('minLength' in options)
		minLength = options.minLength;
	var maxLength = Math.min(notes_a.length, notes_b.length) - 1;
	if('maxLength' in options)
		maxLength = options.maxLength;
	
	var matches = [];
	matchIndex_a = new Array(notes_a.length);
	matchIndex_b = new Array(notes_b.length);
	for(var themeLength = maxLength; themeLength >= minLength; themeLength--) {
		//Iterate through all themes of this length in sequence A
		for(var a = 0; a < notes_a.length - themeLength + 1; a++) {
			aTheme = makeTheme(notes_a, posIndex_a, indexMap_a, a, themeLength, !options.includeRests, partNum_a);

			//Iterate through all themes of this length in sequence B
			var b_start = isSelfComparison ? a + 1 : 0;
			for(var b = b_start; b < notes_b.length - themeLength + 1; b++) {
				//Check to see if these positions are a subset of an already-existing match
				if(!isSubMatch(a, b, themeLength)) {
					bTheme = makeTheme(notes_b, posIndex_b, indexMap_b, b, themeLength, !options.includeRests, partNum_b);
					
					//Compare themes. If they're an exact match...
					if(compareThemes(aTheme, bTheme, options.comparisonOptions) == 0) {
						//Get display themes (uses the raw notes array)
						aDisplayTheme = makeTheme(notes_a_raw, posIndex_a, indexMap_a, a, themeLength, !options.includeRests, partNum_a);
						bDisplayTheme = makeTheme(notes_b_raw, posIndex_b, indexMap_b, b, themeLength, !options.includeRests, partNum_b);
						
						//Create match object, add to result list
						var newMatch = new Match([aTheme, bTheme], [aDisplayTheme, bDisplayTheme]);
						matches.push(newMatch); //TODO: allow for matches with more than two themes
						
						//Add match to the matrix
						for(var p = 0; p < themeLength; p++) {
							if(!matchIndex_a[a + p])
								matchIndex_a[a + p] = [];
							matchIndex_a[a + p].push(newMatch);
							if(!matchIndex_b[b + p])
								matchIndex_b[b + p] = [];
							matchIndex_b[b + p].push(newMatch);
						}
					}
				}
			}
		}
	}
	return matches;
}

function isSubMatch(a, b, length) {
	//If no matches have used the first position, we're done here
	if(!matchIndex_a[a])
		return false;
	
	//Grab all matches from first position
	var canidateMatches = matchIndex_a[a];
	
	for(var i = 0; i < canidateMatches.length; i++)
	{
		var curCanidate = canidateMatches[i];
		var failed = false;
		
		//For all positions of theme a...
		for(var a_pos = a; a_pos < a + length; a_pos++) {
			//Check if each canidate still exists in this position. If it doesn't, move on to next canidate
			if(!matchIndex_a[a_pos] || matchIndex_a[a_pos].indexOf(curCanidate) == -1) {
				failed = true;
				break;
			}	
		}
		
		if(!failed) {
			//Repeat for theme b
			for(var b_pos = b; b_pos < b + length; b_pos++) {
				//Check if each canidate still exists in this position. If it doesn't, move on to next canidate
				if(!matchIndex_b[b_pos] || matchIndex_b[b_pos].indexOf(curCanidate) == -1) {
					failed = true;
					break;
				}	
			}
			
			//If we still haven't failed, we've found a containing match, return true
			if(!failed)
				return true;
		}
	}
	//If we get here, we've failed all canidates. Return false.
	return false;
}

//Same as makeTheme, except takes start/end indices instead of start and a length
function makeTheme(notes, posIndex, indexMap, startIndex, length, removeTrailingRests, partNum) {
	// var start = indexMap[startIndex];
	// var end = indexMap[startIndex + length];
	// if(removeTrailingRests) {
	// 	while(notes[end - 1].pitch < 0) {
	// 		end--;
	// 	}
	// }
	// var temp = notes.slice(start, end);
	// return new Theme(
	// 	temp,
	// 	posIndex[start],
	// 	posIndex[end],
	// 	end - start,
	// 	start,
	// 	end,
	// 	partNum
	// );
	// return {
	// 	notes: notes.slice(start, end),
	// 	startPos: posIndex[start],
	// 	endPos: posIndex[end],
	// 	length: end - start,
	// 	startIndex: start,
	// 	endIndex: end,
	// 	partNum: partNum
	// };
	var start = indexMap[startIndex];
	var end = indexMap[startIndex + length];
	var temp = notes.slice(start, end);
	return timingTemp(notes, posIndex, indexMap, startIndex, length, removeTrailingRests, partNum, temp);
}

function timingTemp(notes, posIndex, indexMap, startIndex, length, removeTrailingRests, partNum, slicedNotes) {
	var start = indexMap[startIndex];
	var end = indexMap[startIndex + length];
	if(removeTrailingRests) {
		while(notes[end - 1].pitch < 0) {
			end--;
		}
	}
	return new Theme(
		slicedNotes,
		posIndex[start],
		posIndex[end],
		end - start,
		start,
		end,
		partNum
	);
}

//For now, checks themes for exact equivalence in both pitch and rhythm
function compareThemes(aTheme, bTheme, options) {
	//Reject themes with uneven lengths
	if(aTheme.notes.length != bTheme.notes.length)
		return -9999;
	
	//Handle relative pitch comparisons (easiest to tackle in its own loop)
	if(options.comparePitch && !options.useAbsPitch) {
		//var aNotesNoRests = removeRests(aTheme.notes);
		//var bNotesNoRests = removeRests(bTheme.notes);
		//if(aNotesNoRests.length != bNotesNoRests.length) //If the themes had differing numbers of rests, they can't be the same sequence of intervals
		//	return -9999;
			
		var matchIncludesNonRestInterval = false;
		for(var i = 0; i < aTheme.notes.length - 1; i++) {
			var aCur = base40ToBase12(aTheme.notes[i].pitch);
			var aNext = base40ToBase12(aTheme.notes[i + 1].pitch);
			var bCur = base40ToBase12(bTheme.notes[i].pitch);
			var bNext = base40ToBase12(bTheme.notes[i + 1].pitch);
			
			//We don't look at intervals containing rests, except to ensure that a match must include at least one interval that does not involve a rest
			//TODO: This logic isn't quite right. Intervals should be checked for equality across rests
			if(!((aCur < 0 && bCur < 0 ) || (aNext < 0 && bNext < 0))) {
				matchIncludesNonRestInterval = true;
				if(aNext - aCur != bNext - bCur)
					return -9999;
			}
		}
		
		//If all intervals found included a rest, don't report this as a match.
		if(!matchIncludesNonRestInterval)
			return -9999;
	}
	
	//Compare absolute pitch and rhythm
	for(var i = 0; i < aTheme.notes.length; i++)
	{
		var aNote = aTheme.notes[i];
		var bNote = bTheme.notes[i];
		if(options.comparePitch && options.useAbsPitch && aNote.pitch != bNote.pitch) {
			return -9999;
		}
		if(options.compareRhythm && aNote.dur != bNote.dur)
			return -9999;
	}
	return 0;
}

//A Match object can contain any number of themes, so long as each 
//theme is a match (for whatever requirements we've set) with every 
//other theme in that Match object. However, each arc can only connect
//two themes. This function takes an array of match objects, and
//decomposes any matches with more than two themes into equivalent match
//objects with only two themes. Rules by which this is accomplished can vary.
function decomposeMatches(matches) {
	var result = [];
	//TODO
	return matches;
}

function consolidateRests(notes) {
	var result = [];
	
	var accumRest = null;
	for(var i = 0; i < notes.length; i++) {
		var curNote = notes[i];
		if(curNote.pitch < 0) {
			if(accumRest == null) {
				accumRest = curNote;
			}
			else {
				accumRest.dur += curNote.dur;
			}
		}
		else {
			if(accumRest != null) {
				result.push(accumRest);
				accumRest = null;
			}
			result.push(curNote);
		}
	}
	if(accumRest != null)
		result.push(accumRest);
	
	return result;
}

function removeRests(notes) {
	var result = [];
	for(var i = 0; i < notes.length; i++) {
		if(notes[i].pitch >= 0)
			result.push(notes[i]);
	}
	return result;
}

function removeRestsWithIndex(notes) {
	var noRests = removeRests(notes);
	var indexes = [];
	var curNoRestsIndex = 0;
	for(var i = 0; i < notes.length; i++) {
		if(notes[i].pitch >= 0) {
			indexes[curNoRestsIndex] = i;
			curNoRestsIndex++;
		}
	}
	indexes[curNoRestsIndex] = notes.length;
	return {
		notesWithoutRests: noRests,
		indexMap: indexes
	};
}

function makeDummyIndex(length) {
	var result = [];
	for(var i = 0; i <= length; i++) {
		result[i] = i;
	}
	return result;
}

function buildPositionIndex(notes) {
	var result = [];
	var curPos = 0;
	
	//Find total duration
	var totalDur = d3.sum(notes, function(d) { return d.dur });
	
	for(var i = 0; i < notes.length; i++) {
		result[i] = curPos / totalDur;
		curPos += notes[i].dur;
	}
	result[notes.length] = 1.0;
	return result;
}

var slicedNotes;
function preSliceNotes(parts) {
	slicedNotes = new Array();
	for(var partNum = 0; partNum < parts.length; partNum++) {
		slicedNotes[partNum] = new Array();
		for(var i = 0; i < parts[partNum].length; i++) {
			slicedNotes[partNum][i] = new Array();
			for(var j = 0; j < parts[partNum].length; j++) {
				slicedNotes[partNum][i][j] = parts[partNum].slice(i, j);
			}
		}
	}
}

function Note(pitch, dur, kern) {
	this.pitch = pitch;
	this.dur = dur;
	this.kern = kern;
}

function Theme(notes, startPos, endPos, length, startIndex, endIndex, partNum) {
	this.notes = notes;
	this.startPos = startPos;
	this.endPos = endPos;
	this.length = length;
	this.startIndex = startIndex;
	this.endIndex = endIndex;
	this.partNum = partNum;
}

function Match(themes, displayThemes) {
	this.themes = themes;
	this.displayThemes = displayThemes;
	this.length = themes[0].length;
}