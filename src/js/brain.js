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

var request = require('request-promise');
var fs = require('fs');
var path = require('path');

var segments = [];
var clusters = [];
var colors = [];
var segLists = [];
var clustersToDisplay = [];
var derTrack;

/*
 * Display initialisation
 *
*/

nextQuestionButton = document.getElementById('nextQuestionButton');
noButton = document.getElementById('noButton');
yesButton = document.getElementById('yesButton');
derButton = document.getElementById('derButton');

window.onload = function() {
    nextQuestionButton.style.display = "none";
    noButton.style.display = "none";
    yesButton.style.display = "none";
    derButton.style.display = "none";
    displaySegmentDetails();
    $(window).resize();
}

nextQuestionButton.onclick = function() {
    getNextQuestion();
    nextQuestionButton.style.display = "none";
}

noButton.onclick = function() {
    answerQuestion(false);
    updateDisplay();
}

yesButton.onclick = function() {
    answerQuestion(true);
    updateDisplay();
}

derButton.onclick = function() {
    alert(derTrack.der_log)
}

/*
 * POST REQUESTS
 * Post requests are used to communicate with the server
*/

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
        loadData(data);
        derButton.style.display = "";
        updateDER(data.der_track);
        getNextQuestion();
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
        loadSegments(data.segments);
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
            noButton.style.display = "";
            yesButton.style.display = "";
        } 
    })
}

function updateDER(der_track) {
    derTrack = der_track
    der_log = der_track.der_log;
    document.getElementById('derButton').innerHTML = "DER: " +  der_log[der_log.length - 1].toFixed(2) + "%";
}

function saveFile(path) {
    var options = {
        method: 'POST',
        uri: 'http://127.0.0.1:5000/save_file',
        form: {
            path: path
        }
    }

    // send path
    request(options);
}

// send all segments to the server to update the diarization
function updateDiar(segments) {
    var options = {
        method: 'POST',
        uri: 'http://127.0.0.1:5000/update_diar',
        json: segments
    }
    request(options)
}

/*
 * IPC RENDERER
 * ipcRenderer is used to communicate with main.js
*/

ipcRenderer.on('openFile', (event, arg) => {
    //remove the extension 
    url = arg.split('.');
    url.pop();
    url = url.join('.');
    loadFile(url);
});

ipcRenderer.on('saveFile', (event, arg) => {
    saveFile(arg);
});

/*
 * Others methods
 *
*/

function loadSegments(segs) {
    segments = segs;
}


function updateDisplay() {
    nextQuestionButton.style.display = "";
    noButton.style.display = "none";
    yesButton.style.display = "none";
    removeHighlight();
}


function loadData(data) {
    loadSegments(data.segments)
    clusters = data.clusters;
    randomColorClusters();
    drawDendrogram(data.tree);
}


function randomColorClusters() {
  colors = [];
  for (i = 0; i < clusters.length; i++) {
    let r = Math.floor(Math.random() * 256); 
    let g = Math.floor(Math.random() * 256); 
    let b = Math.floor(Math.random() * 256); 
    colors.push("rgba(" + r + ", " + g + ", " + b + ", 1)");
  } 
}


function displayQuestion() {
  let intituleQuestion = document.getElementById("question");
  let spk1 = document.getElementById("spkname1");
  let spk2 = document.getElementById("spkname2");
  intituleQuestion.innerHTML = "Are <b>" + spk1.textContent + "</b> and <b>" + spk2.textContent + "</b> the same speaker ?";
}


// Load the question sent by the system
function loadQuestion(question) {
  // first find the node concerned by the question
  let node = findParentNode(question.node[0], question.node[1]);
  //highlight the node
  highlightNode(node);

  //load segments to display
  segLists = [];
  segLists.push(question.segs1);
  segLists.push(question.segs2);
  generateIdForSegments();
  clustersToDisplay.push(segLists[0][0][1])
  clustersToDisplay.push(segLists[1][0][1])
  displaySegmentDetails();
  displayRegions();
  displayQuestion();
}

function generateIdForSegments() {
  for(let i = 0; i < segLists.length; i++) {
    for(let j = 0; j < segLists[i].length; j++) {
        let seg = segLists[i][j]; 
        seg["data-id"] = i + '-' + j;
    }
  }
}

