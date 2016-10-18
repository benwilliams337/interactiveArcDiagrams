var REST_VAL = -1000;

function parseHumdrum(fileText) {
	var parsed = processFileContents(fileText);
	var parts = [];
	
	var partIsKern = [];
	for(var i = 0; i < parsed.exinterp.length; i++) {
		partIsKern[i] = parsed.exinterp[i] == "**kern";
	}
	
	for(var i = 0; i < parsed.lines.length; i++) { //For each line
		var curLine = parsed.lines[i];
		if(curLine.hasfields && curLine.type == "data") {
			for(var j = 0; j < curLine.fields.length; j++) { //For each token on this line
				var curToken = curLine.fields[j];
				if(partIsKern[curToken.spine] && curToken.subspine == 0 && isNoteDataToken(curToken.text)) { //Currently only considering first subspine
					if(!parts[curToken.spine])
						parts[curToken.spine] = [];
					parts[curToken.spine].push(tokenToNote(curToken.text));
				}
			}
		}
	}
	
	return parts;
}

function isNoteDataToken(token) {
	return !(token == '' || token.startsWith('!') || token.startsWith('*') || token.startsWith('.') || token.startsWith('='))
}

function tokenToNote(token) {
	return new Note(kernToBase40(token), kernToDur(token), token);
}

function notesToHumdrum(notes) {
	var result = "**kern\r\n"

	//This is kind of a sloppy way of choosing our clef, but it'll do for now
	//If the average diatonic pitch is greater than middle c, use treble clef. Otherwise, use bass.
	var avgPitch = d3.mean(removeRests(notes), function(d) { return base40ToDiatonic(d.pitch); });
	var useTreble = (avgPitch >= 28);
	result += useTreble ? "*clefG2\r\n" : "*clefF4\r\n";

	for(var i = 0; i < notes.length; i++) {
		result += notes[i].kern;
		result += "\r\n"
	}

	return result;
}

//Adapted from Craig Sapp's Humextra
//https://github.com/craigsapp/humextra/blob/master/src-library/Convert.cpp
function kernToBase40(kern) {
	if(kern.startsWith('.'))
		return -1;
	
	for(var i = 0; i < kern.length; i++) {
		var curChar = kern.charAt(i);
		if((['a','b','c','d','e','f','g']).indexOf(curChar.toLowerCase()) != -1) {
			//Get base from pitch class
			var result = getBase40Base(curChar);
			
			//Get octave
			var octave = 0;
			while((i + octave) < kern.length && kern.charAt(i + octave) == curChar) {
				octave++;
			}
			
			//Apply octave
			result += (octave - 1) * 40 * ((curChar == curChar.toLowerCase()) ? 1 : -1);
			
			//Get accidental
			for(var curPos = i + octave; curPos < i + octave + 2; curPos++) {
				if(curPos < kern.length) {
					if(kern.charAt(curPos) == '-') result--;
					if(kern.charAt(curPos) == '#') result++;
				}
			}
			
			//Sanity check
			if(result > 0)
				return result;
			else {
				//error condition
				console.error("Base 40 result too low for pitch input " + kern);
				return;
			}
		}
		else if(curChar.toLowerCase() == 'r') {
			return REST_VAL;
		}
	}
}

var BASE_40_C = 2;
var BASE_40_D = 8;
var BASE_40_E = 14;
var BASE_40_F = 19;
var BASE_40_G = 25;
var BASE_40_A = 31;
var BASE_40_B = 37;
function getBase40Base(kernChar) {
	var root;
	switch(kernChar.toLowerCase()) {
		case "a": root = BASE_40_A; break;
		case "b": root = BASE_40_B; break;
		case "c": root = BASE_40_C; break;
		case "d": root = BASE_40_D; break;
		case "e": root = BASE_40_E; break;
		case "f": root = BASE_40_F; break;
		case "g": root = BASE_40_G; break;
		default: return;
	}
	var octaveMultiplier = ((kernChar == kernChar.toLowerCase()) ? 4 : 3);
	return octaveMultiplier * 40 + root;
}

function base40ToDiatonic(pitch) {
	if(pitch < 0)
		return REST_VAL;
	var chroma = pitch % 40;
	var octaveOffset = Math.floor(pitch / 40) * 7;
	
	switch (chroma) {
	case 0: case 1: case 2: case 3: case 4:
		return 0 + octaveOffset;
	case 6: case 7: case 8: case 9: case 10:
		return 1 + octaveOffset;
	case 12: case 13: case 14: case 15: case 16:
		return 2 + octaveOffset;
	case 17: case 18: case 19: case 20: case 21:
		return 3 + octaveOffset;
	case 23: case 24: case 25: case 26: case 27:
		return 4 + octaveOffset;
	case 29: case 30: case 31: case 32: case 33:
		return 5 + octaveOffset;
	case 35: case 36: case 37: case 38: case 39:
		return 6 + octaveOffset;
   }
   return -1;
}

function base40ToAccidental(pitch) {
	if(pitch < 0)
		return 0;
	switch(pitch % 40) {
		case 0: case 6: case 12: case 17: case 23: case 29: case 35:
			return -2;
		case 1: case 7: case 13: case 18: case 24: case 30: case 36:
			return -1;
		case 2: case 8: case 14: case 19: case 25: case 31: case 37:
			return 0;
		case 3: case 9: case 15: case 20: case 26: case 32: case 38:
			return 1;
		case 4: case 10: case 16: case 21: case 27: case 33: case 39:
			return 2;
	}
	return 0;
}

function base40ToBase12(base40Val) {
	if(base40Val < 0)
		return REST_VAL;
	
	var octave = Math.floor(base40Val / 40) + 1;
	var pc = -1;
	switch(base40Val % 40) {
	  case  0:   pc = -2;   break;    // C--
      case  1:   pc = -1;   break;    // C-
      case  2:   pc =  0;   break;    // C
      case  3:   pc =  1;   break;    // C#
      case  4:   pc =  2;   break;    // C##
      case  5:   pc = -100;   break;    // X
      case  6:   pc =  0;   break;    // D--
      case  7:   pc =  1;   break;    // D-
      case  8:   pc =  2;   break;    // D
      case  9:   pc =  3;   break;    // D#
      case 10:   pc =  4;   break;    // D##
      case 11:   pc = -100;   break;    // X
      case 12:   pc =  2;   break;    // E--
      case 13:   pc =  3;   break;    // E-
      case 14:   pc =  4;   break;    // E
      case 15:   pc =  5;   break;    // E#
      case 16:   pc =  6;   break;    // E##
      case 17:   pc =  3;   break;    // F--
      case 18:   pc =  4;   break;    // F-
      case 19:   pc =  5;   break;    // F
      case 20:   pc =  6;   break;    // F#
      case 21:   pc =  7;   break;    // F##
      case 22:   pc = -100;   break;    // X
      case 23:   pc =  5;   break;    // G--
      case 24:   pc =  6;   break;    // G-
      case 25:   pc =  7;   break;    // G
      case 26:   pc =  8;   break;    // G#
      case 27:   pc =  9;   break;    // G##
      case 28:   pc = -100;   break;    // X
      case 29:   pc =  7;   break;    // A--
      case 30:   pc =  8;   break;    // A-
      case 31:   pc =  9;   break;    // A
      case 32:   pc = 10;   break;    // A#
      case 33:   pc = 11;   break;    // A##
      case 34:   pc = -100;   break;    // X
      case 35:   pc =  9;   break;    // B--
      case 36:   pc = 10;   break;    // B-
      case 37:   pc = 11;   break;    // B
      case 38:   pc = 12;   break;    // B#
      case 39:   pc = 13;   break;    // B##
	}
	
	if(pc <= -100) {
		return -100; //TODO: better error handling
	}
	var result = pc + octave * 12;
	if(result < 0)
		result += 12;
	if(result < 0)
		return -100; //TODO: better error handling
	return result;
}

function kernToDur(kern) {
	//Grace notes
	if(kern.toLowerCase().indexOf('q') != -1)
		return 0;
	
	//Count dots
	var dotCount = 0;
	for(var i = 0; i < kern.length; i++) {
		if(kern.charAt(i) == '.')
			dotCount++;
		if(kern.charAt(i) == ' ')
			break;
	}
	
	//"special rhythms"
	//TODO
	
	//Pull out number, convert to duration
	var regexMatches = kern.match(/\d+/);
	if(regexMatches == null) {
		console.error("Could not find duration for the following token: " + kern);
	}
	var num = regexMatches[0];
	var duration;
	if(parseInt(num) == 0) { //Repeated zeros have different rules
		duration = Math.pow(2, num.length + 2);
	}
	else {
		duration = 4 / parseInt(num);
	}
	
	//Apply dots
	var result = duration;
	for(var i = 0; i < dotCount; i++) {
		result += duration / Math.pow(2,i+1);
	}
	
	return result;
}


// Programmer:    Craig Stuart Sapp <craig@ccrma.stanford.edu>
/////////////////////////////
//
// processFileContents -- process the contents of a file (or standard input).
//

function processFileContents(data) {
	var lines = data.split("\n");
	var jhumdrum = {};
	jhumdrum.lines = [];  // array of data lines in file
	jhumdrum.ref = {};    // parsed reference records
	var token;
	var fields;
	for (var i=0; i<lines.length; i++) {
		if ((i == lines.length - 1) && lines[i].match(/^$/)) {
			continue; // ignore empty entry at end of data split.
		}
		var lineobj = {};
		jhumdrum.lines.push(lineobj);
		lineobj.hasfields = 0;
		lineobj.text = lines[i];
		lineobj.type = "unknown";
		lineobj.fields = [];
		var matches;
		if (matches = lines[i].match(/^$/)) {
			lineobj.type = "empty";
			token = {};
			lineobj.fields.push(token);
			token.text = lines[i];
			continue;
		}
		if (matches = lines[i].match(/^!!!\s*([^\s]+)\s*:\s(.*)\s*$/)) {
			lineobj.type = "reference";
			token = {};
			lineobj.fields.push(token);
			token.text = lines[i];
			lineobj.refkey = matches[1];
			lineobj.refval = matches[2];
			jhumdrum.ref[matches[1]] = matches[2];
			continue;
		}
		if (matches = lines[i].match(/^!!/)) {
			lineobj.type = "globalcomment";
			token = {};
			lineobj.fields.push(token);
			token.text = lines[i];
			continue;
		}
		// at this point there are multiple data fields on a line, separated
		// by (single) tab characters.
		lineobj.hasfields = 1;
		fields = lines[i].split(/\t/);
		for (var j=0; j<fields.length; j++) {
			token = {};
			token.text = fields[j];
			lineobj.fields.push(token);
		}

		if (matches = lines[i].match(/^!/)) {
			lineobj.type = "localcomment";
			continue;
		}
		if (matches = lines[i].match(/^=/)) {
			lineobj.type = "barline";
			continue;
		}

		if (matches = lines[i].match(/^\*/)) {
			lineobj.type   = "interpretation";
			lineobj.itype  = "unknown";
			lineobj.manipulator = 0;
			if (lines[i].match(/^(\*\t?)+$/)) {
				lineobj.itype = "null";
			} else if (lines[i].match(/^(\*-\t?)+$/)) {
				lineobj.itype = "dataend";
				lineobj.manipulator = 1;
			} else if (lines[i].match(/^\*\*/)) {
				lineobj.itype = "datastart";
				lineobj.manipulator = 1;
			} else if (lines[i].match(/(\*\^|\*v|\*\+|\*x)/)) {
				lineobj.itype = "manipulator";
				lineobj.manipulator = 1;
			}
			continue;
		}

		// only data lines left
		lineobj.type = "data";
	}

	var status = analyzeSpines(jhumdrum);
	return jhumdrum;
}



//////////////////////////////
//
// analyzeSpines -- process the spine structure of a Humdrum file.
//

function analyzeSpines(jhum) {
	var i, j;
	var spinestates = [];
	var foundfields = 0;
	var lines = jhum.lines;
	var fields;
	var state;
	for (i=0; i<lines.length; i++) {
		if (lines[i].hasfields == 0) {
			continue;
		}
		if ((foundfields == 0) && (lines[i].itype !== "datastart")) {
			console.log("Error on line ", i+1, 
				": must start with exclusive interpretation");
         console.log("LINE:", lines[i].text);
         console.log("DATATYPE:", lines[i].itype);
			return 0;
		}
		fields = lines[i].fields;
		if (foundfields == 0) {
         jhum.exinterp = [];
			for (j=0; j<fields.length; j++) {
				fields[j].spine = j;
				spinestates.push(j);
            jhum.exinterp.push(fields[j].text);
			}
         foundfields = 1;
			continue;
		}
		if ((!lines[i].manipulator) || (lines[i].itype === "dataend")) {
			for (j=0; j<fields.length; j++) {
				fields[j].spine = spinestates[j];
			}
			if (lines[i].itype === "dataend") {
				spinestates = [];
				foundfields = 0;
			}
			continue;
		}
		// spine manipulator on interpretation line so deal with them one
		// at a time.  Only implementing *^ and *v.
		var k = 0;
		for (j=0; j<fields.length; j++) {
			if (fields[j].text === "*") {
				// null interpretation (skip over it)
				fields[j].spine = spinestates[k++];
				continue;
			}
			if (fields[j].text === "*^") {
				// spine split
				fields[j].spine = spinestates[k];
				spinestates.splice(k, 0, fields[j].spine);
				k += 2;
				continue;
			}
			if (fields[j].text === "*v") {
				// spine merge
				fields[j].spine = spinestates[k];
				var jj = j+1;
				while ((jj < fields.length) && (fields[jj].text === "*v")) {
				   fields[jj++].spine = spinestates[k];
				   spinestates.splice(k+1, 1);
				}
            k++;
				continue;
			}
			console.log("Warning: ignoring unknown manipulator: ", 
					fields[j].text);
		}
	}
	
	return analyzeSubspines(jhum);
}



//////////////////////////////
//
// analyzeSubspines -- enumerate the subspines on a line.
//

function analyzeSubspines(jhum) {
	var lines = jhum.lines;
	for (var i=0; i<lines.length; i++) {
		if (!lines[i].hasfields) {
			continue;
		}
		var counters = {};
		var fields = lines[i].fields;
		for (var j=0; j<fields.length; j++) {
         var spine = fields[j].spine;
         if (counters.hasOwnProperty(spine)) {
            fields[j].subspine = counters[spine]++;
         } else {
            fields[j].subspine = 0;
            counters[spine] = 1;
         }
		}
	}
	return 1;
}



