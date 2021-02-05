var request = require('request-promise')

var values = ""

document.getElementById('send').addEventListener('click', () => {
    
    values = document.getElementById('value').value 
    var options = {
        method: 'POST',
        uri: 'http://127.0.0.1:5000/',
        form: {value: values}
    }

    request(options).then(function (innerHTML) {
    	document.getElementById('res').innerHTML = innerHTML;
    })
})

window.addEventListener('load', (event) => {
  	getDendrogram();
  	getSegments();
  	getClusters();
});

function getDendrogram() {
	var options = {
        method: 'POST',
        uri: 'http://127.0.0.1:5000/dendrogram',
    }

    request(options).then(function (res) {
    	tree = JSON.parse(res)
    	//need to get the threshold here
    	threshold = 30;
    	drawDendrogram(tree, threshold);
    })
}

function getSegments() {
	var options = {
        method: 'POST',
        uri: 'http://127.0.0.1:5000/segments',
    }

    request(options).then(function (res) {
    	loadSegments(JSON.parse(res));
    })
}

function getClusters() {
	var options = {
        method: 'POST',
        uri: 'http://127.0.0.1:5000/clusters',
    }

    request(options).then(function (res) {
    	loadClusters(JSON.parse(res));
    })
}