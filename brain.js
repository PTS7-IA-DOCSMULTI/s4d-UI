var request = require('request-promise');
const fs = require('fs');

ipcRenderer.on('openFile', (event, arg) => {
	//remove the extension 
	url = arg.substring(0, arg.length - 4);
	loadFile(url);
});

function loadFile(fileName) {

	settings = JSON.parse(fs.readFileSync('./settings.json', 'utf8'));

    var options = {
        method: 'POST',
        uri: 'http://127.0.0.1:5000/load_file',
        form: {
        	showName: fileName,
        	clustering_method: settings.clustering_method,
        	selection_method: settings.selection_method,
        	conditional_questioning: settings.conditional_questioning,
        	prioritize_separation2clustering: settings.prioritize_separation2clustering
        }
    }

    request(options).then(function(res) {
    	data = JSON.parse(res);
    	drawDendrogram(data.tree, data.threshold);
    	loadSegments(data.segments);
    	loadClusters(data.clusters);
    })
}

function getDERLog() {
	var options = {
        method: 'POST',
        uri: 'http://127.0.0.1:5000/der_log',
    }

    request(options).then(function (res) {
    	loadDERLog(JSON.parse(res));
    })
}