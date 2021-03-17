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
const { ipcRenderer } = require('electron');

var segments = [];
var clusters = [];
var currentColors = [];
var initialColors = [];
var clustersToDisplay = [];
var segmentsToDisplay = [];
var separationIndex;
var derTrack;

/*
 * Display initialisation
 *
*/

nextQuestionButton = document.getElementById('nextQuestionButton');
noButton = document.getElementById('noButton');
yesButton = document.getElementById('yesButton');
derButton = document.getElementById('derButton');
spkname1 = document.getElementById('spkname1');
spkname2 = document.getElementById('spkname2');

window.onload = function() {
    nextQuestionButton.style.display = "none";
    noButton.style.display = "none";
    yesButton.style.display = "none";
    derButton.style.display = "none";
    displaySegmentDetails([], 1);
    displaySegmentDetails([], 2);
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
    saveDERToFile(derTrack)
    ipcRenderer.sendSync('open-der', derTrack)
}

spkname1.onclick = function() {
    let currentName = spkname1.innerHTML
    let newName = ipcRenderer.sendSync('testprompt', currentName)
    if (newName && newName.replaceAll(' ', '')) {
        spkname1.innerHTML = newName
    }
}

spkname2.onclick = function() {
    let currentName = spkname2.innerHTML
    let newName = ipcRenderer.sendSync('testprompt', currentName)
    if (newName && newName.replaceAll(' ', '')) {
        spkname2.innerHTML = newName
    }
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
            ipcRenderer.sendSync('display-information-msg', question.error);
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

// ask the server to send the segments corresponding to the clicked node
function getSegmentsFromNode(nodeId) {
     var options = {
         method: 'POST',
         uri: 'http://127.0.0.1:5000/get_segments_from_node',
         form: {
            node_id: nodeId
        }
     }
 
     // get the segments
     request(options).then(function (res) {
         data = JSON.parse(res);
         if (data.segs1 && data.segs2) {
             loadSegmentsToDisplay(data.segs1, data.segs2);
         } else if (data.segs) {
             loadSegmentsToDisplay(data.segs, []);
         }
         
     })
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
    clearInterval(flashNodeTimer);
    questionNode = null;
    document.getElementById("question").innerHTML = "";
}


function loadData(data) {
    loadSegments(data.segments)
    clusters = data.clusters;
    randomColorClusters();
    drawDendrogram(data.tree);
}


function randomColorClusters() {
  initialColors = [];
  for (i = 0; i < clusters.length; i++) {
    let r = Math.floor(Math.random() * 256); 
    let g = Math.floor(Math.random() * 256); 
    let b = Math.floor(Math.random() * 256); 
    initialColors.push("rgba(" + r + ", " + g + ", " + b + ", 1)");
  }
  //clone initialColors
  currentColors = [...initialColors]
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
  highlightNode(node.children[0]);
  flashNode(node.children[0]);

  //load segments to display
  loadSegmentsToDisplay(question.segs1, question.segs2)
  displayQuestion();
}

function loadSegmentsToDisplay(segList1, segList2) {
    findSegmentsToDisplay(segList1, segList2);
    setClustersToDisplay();
    displaySegmentDetails(segmentsToDisplay.slice(0, separationIndex), 1);
    displaySegmentDetails(segmentsToDisplay.slice(separationIndex, segmentsToDisplay.length), 2);
    displayRegions();
}


function findSegmentsToDisplay(segList1, segList2) {
    separationIndex = segList1.length;
    segmentsToDisplay = [];
    segs = segList1.concat(segList2)
    for (let i = 0; i < segs.length; i++) {
        for (let j = 0; j < segments.length; j++) {
            if (arraysEqual(segments[j],segs[i])) {
                segmentsToDisplay.push(j);
                break;
            }
        }
        if (segmentsToDisplay.length <= i) {
            segmentsToDisplay.push(-1)
        }
    }
}


function arraysEqual(a1,a2) {
    return JSON.stringify(a1)==JSON.stringify(a2);
}


function getSegIndex(segment) {
    for (let i = 0; i < segments.length; i++) {
        if (arraysEqual(segments[i], segment)) {
            return i;
        }
    }
    return -1;
}


function setClustersToDisplay() {
    clustersToDisplay = [];
    for (let i = 0; i < segmentsToDisplay.length; i++) {
        seg = segments[segmentsToDisplay[i]];
        clusterId = seg[1]
        if (!clustersToDisplay.includes(clusterId)) {
            clustersToDisplay.push(clusterId)
        }
    }
}


function saveDERToFile(der) {
    //third parameter is for pretty print
    let data = JSON.stringify(der, null, 4);
    var jsonPath = path.join(__dirname, '..', 'der.json');
    fs.writeFileSync(jsonPath, data);
}
