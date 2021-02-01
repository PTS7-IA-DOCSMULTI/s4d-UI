const ipcRenderer = require('electron').ipcRenderer;
const remote = require('electron').remote;
const fs = require('fs');

var settings;

//get settings
window.addEventListener('load', function () {
	//load settings
 	settings = JSON.parse(fs.readFileSync('./settings.json', 'utf8'));
 	
 	//fill settings
	document.getElementById("clustering").value = settings.clustering_method;
	document.getElementById("selection").value = settings.selection_method;
	document.getElementById("conditionnal").checked = settings.conditional_questioning;
	document.getElementById("prioritize").checked = settings.prioritize_separation2clustering;
})

function cancel() {
	remote.getCurrentWindow().close();
}

function validate() {
	settings.clustering_method = document.getElementById("clustering").value;
	settings.selection_method = document.getElementById("selection").value;
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
}

function save() {
	//third parameter is for pretty print
	let data = JSON.stringify(settings, null, 4);
	fs.writeFileSync("./settings.json", data);
}