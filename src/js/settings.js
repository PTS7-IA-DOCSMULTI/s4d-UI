/*
 © Copyright 2020-2021 Florian Plaut, Nicolas Poupon, Adrien Puertolas, Alexandre Flucha
 * 
 * This file is part of S4D-UI.
 *
 * S4D-UI is an interface for S4D to allow human supervision of the diarization
 * S4D-UI home page: https://github.com/PTS7-IA-DOCSMULTI/s4d-UI
 * S4D home page: http://www-lium.univ-lemans.fr/s4d/
 * SIDEKIT home page: http://www-lium.univ-lemans.fr/sidekit/
 *
 * S4D-UI is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * S4D-UI is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with S4D-UI.  If not, see <http://www.gnu.org/licenses/>.
*/

const ipcRenderer = require('electron').ipcRenderer;
const remote = require('electron').remote;
const fs = require('fs');
var path = require('path');

var settings;

//get settings
window.addEventListener('load', function () {
	//load settings
 	var jsonPath = path.join(__dirname, '..', 'settings.json');
    settings = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
 	
 	//fill settings
	document.getElementById("clustering").value = settings.clustering_method;
	document.getElementById("selection").value = settings.selection_method;
	document.getElementById("vectors").value = settings.vectors_type;
	document.getElementById("conditionnal").checked = settings.conditional_questioning;
	document.getElementById("prioritize").checked = settings.prioritize_separation2clustering;
})

function cancel() {
	remote.getCurrentWindow().close();
}

function validate() {
	settings.clustering_method = document.getElementById("clustering").value;
	settings.selection_method = document.getElementById("selection").value;
	settings.vectors_type = document.getElementById("vectors").value;
	settings.conditional_questioning = document.getElementById("conditionnal").checked;
	settings.prioritize_separation2clustering = document.getElementById("prioritize").checked;
	save();
	remote.getCurrentWindow().close();
}

function reset() {
	document.getElementById("clustering").value = "complete";
	document.getElementById("selection").value = "longest";
	document.getElementById("conditionnal").checked = false;
	document.getElementById("prioritize").checked = false;
	document.getElementById("vectors").value = "i";
}

function save() {
	//third parameter is for pretty print
	let data = JSON.stringify(settings, null, 4);
	var jsonPath = path.join(__dirname, '..', 'settings.json');
	fs.writeFileSync(jsonPath, data);
}