var request = require('request-promise');
var fs = require('fs');
var path = require('path');

var derTrack;

nextQuestionButton = document.getElementById('nextQuestionButton');
falseButton = document.getElementById('falseButton');
trueButton = document.getElementById('trueButton');
derButton = document.getElementById('derButton');

window.onload = function() {
    nextQuestionButton.style.display = "none";
    falseButton.style.display = "none";
    trueButton.style.display = "none";
    derButton.style.display = "none";
}

nextQuestionButton.onclick = function() {
    getNextQuestion();
    nextQuestionButton.style.display = "none";
}

falseButton.onclick = function() {
    answerQuestion(false);
    updateDisplay();
}

trueButton.onclick = function() {
    answerQuestion(true);
    updateDisplay();
}

derButton.onclick = function() {
    alert(derTrack.der_log)
}

function updateDisplay() {
    nextQuestionButton.style.display = "";
    falseButton.style.display = "none";
    trueButton.style.display = "none";
    removeHighlight();
}

ipcRenderer.on('openFile', (event, arg) => {
	//remove the extension 
    url = arg.split('.');
    url.pop();
    url = url.join('.');
	loadFile(url);
});

function loadFile(fileName) {

    var jsonPath = path.join(__dirname, '..', 'settings.json');
    settings = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

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
    	drawDendrogram(data.tree);
    	loadSegments(data.segments);
    	loadClusters(data.clusters);
        nextQuestionButton.style.display = "";
        derButton.style.display = "";
        updateDER(data.der_track);
    })
}

function answerQuestion(answer) {
    var options = {
        method: 'POST',
        uri: 'http://127.0.0.1:5000/answer_question',
        form: {
            is_same_speaker: answer
        }
    }

    // send answer
    request(options).then(function (res) {
        // get the new DER and dendrogram
        data = JSON.parse(res);
        updateDER(data.der_track)
        drawDendrogram(data.tree);
    })
}

function getNextQuestion() {
    var options = {
        method: 'POST',
        uri: 'http://127.0.0.1:5000/next_question',
    }

    // get the question
    request(options).then(function (res) {
        question = JSON.parse(res)
        if (question.error) {
            alert(question.error)
        } else {
            loadQuestion(question);
            falseButton.style.display = "";
            trueButton.style.display = "";
        } 
    })
}

function updateDER(der_track) {
    derTrack = der_track
    der_log = der_track.der_log;
    document.getElementById('der').innerHTML = "(DER: " +  der_log[der_log.length - 1].toFixed(2) + "%)";
}