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
const { get } = require('request-promise');

var segments = [];
var clusters = [];
var currentColors = [];
var initialColors = [];
var clustersToDisplay = [];
var segmentsToDisplay = [];
var separationIndex;
var derTrack;
var renamingTable;
var leftNodeIsOneSpeaker;
var rightNodeIsOneSpeaker;
var leftNode;
var rightNode;

var nextQuestionButton;
var noButton;
var yesButton;
var derButton;
var spkname1;
var spkname2;


window.onload = function() {
    nextQuestionButton = document.getElementById('nextQuestionButton');
    noButton = document.getElementById('noButton');
    yesButton = document.getElementById('yesButton');
    derButton = document.getElementById('derButton');
    spkname1 = document.getElementById('spkname1');
    spkname2 = document.getElementById('spkname2');
    backButton = document.getElementById('backButton');
    saveButton = document.getElementById('saveButton');
    renameBtn1 = document.getElementById('renameBtn1');
    renameBtn2 = document.getElementById('renameBtn2');

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
    
    renameBtn1.onclick = function() {
        let currentName = spkname1.innerHTML
        let newName = ipcRenderer.sendSync('rename-speaker', currentName)
        if (newName && newName.replaceAll(' ', '')) {
            spkname1.innerHTML = newName
            let nodeId = selectedNode.__data__.data.node_id
            let cluster = nodeId >= clusters.length ? leftNode.data.cluster : getClusterFromNodeId(nodeId)
            renameSpeaker(cluster, newName);
        }
    }
    
    renameBtn2.onclick = function() {
        let currentName = spkname2.innerHTML
        let newName = ipcRenderer.sendSync('rename-speaker', currentName)
        if (newName && newName.replaceAll(' ', '')) {
            spkname2.innerHTML = newName
            let nodeId = selectedNode.__data__.data.node_id
            let cluster = nodeId >= clusters.length ? rightNode.data.cluster : getClusterFromNodeId(nodeId)
            renameSpeaker(cluster, newName);
        }
    }

    backButton.onclick = function() {
        ipcRenderer.send('show-segmentation');
    }

    saveButton.onclick = function() {
        ipcRenderer.send('save-file');
    }

    initWavesurfer();
    initDisplay();
    loadDataForUI();

    let audioPath = ipcRenderer.sendSync('get-audio-path');
    wavesurferOpenFile(audioPath);

    let jsonPath = path.join(__dirname, '..', 'settings.json');
    let settings = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    sortSegComboBox1 = document.getElementById('sortcmb1');
    sortSegComboBox1.value = settings.selection_method;
    sortSegComboBox2 = document.getElementById('sortcmb2');
    sortSegComboBox2.value = settings.selection_method;

    $(sortSegComboBox1).on('change', function (e) {
        let valueSelected = this.value;
        let nodeId = selectedNode.__data__.data["node_id"]
        sortSegComboBox2.value = this.value;
        getSegmentsFromNode(nodeId, valueSelected);
    });

    $(sortSegComboBox2).on('change', function (e) {
        let valueSelected = this.value;
        let nodeId = selectedNode.__data__.data["node_id"]
        sortSegComboBox1.value = this.value;
        getSegmentsFromNode(nodeId, valueSelected);
    });

    ipcRenderer.on('saveFile', (event, arg) => {
        saveFile(arg);
    });

}


/**
 * Initialize the renaming table with the default name of all clusters
 * 
 */
function initRenamingTable() {
    renamingTable = new Object();
    renamingTable.numberOfRenaming = 0;
    renamingTable.links = new Object();
    for (let i = 0; i < clusters.length; i++) {
        let clusterName = clusters[i]
        renamingTable.links[clusterName] = {
            isRenamed: false,
            newName: null
        }
    }
}


/**
  * Send a post request to get all the data from the diarization
  *
  */
function loadDataForUI() {

    var jsonPath = path.join(__dirname, '..', 'settings.json');
    settings = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    var options = {
        method: 'POST',
        uri: 'http://127.0.0.1:5000/load_data_for_ui',
    }

    request(options).then(function(res) {
        initDisplay();
        data = JSON.parse(res);
        loadData(data);
        derButton.style.display = "";
        updateDER(data.der_track);
        getNextQuestion();
    })
}


/**
  * Send a post request to answer a clustering question from the system
  *
  * @param {Boolean} answer The boolean that indicates if the two nodes should be group or not
  */
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


/**
  * Send a post request to get the next question from the system
  *
  */
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


/**
  * Update the der track.
  *
  * @param {Object} der_track The new der track
  */
function updateDER(der_track) {
    derTrack = der_track
    der_log = der_track.der_log;
    document.getElementById('derButton').innerHTML = "DER: " +  der_log[der_log.length - 1].toFixed(2) + "%";
}


/**
  * Send a post request to save the current diarization
  *
  * @param {string} path The path were the MDTM file should be saved
  */
function saveFile(path) {
    var options = {
        method: 'POST',
        uri: 'http://127.0.0.1:5000/save_file',
        json: {
            path: path,
            new_cluster_labels: getNewClusterLabels()
        }
    }

    // send path
    request(options);
}

/**
  * Rename a speaker
  *
  * @param {string} defaultClusterName The default name of the cluster to rename
  * @param {string} newName The new name of the speaker
  */
function renameSpeaker(defaultClusterName, newName) {
    renamingTable.links[defaultClusterName] = {
        isRenamed: true,
        newName: newName,
        renamingNumber: ++renamingTable.numberOfRenaming
    }
    // sort nodes by id
    nameNodesUpward(sortedNodes);
    nameNodesDownward(sortedNodes, sortedNodes.length - 1, null);
    updateRenamingTable(sortedNodes);
    displaySegmentDetails(segmentsToDisplay.slice(0, separationIndex), 1, !leftNodeIsOneSpeaker);
    displaySegmentDetails(segmentsToDisplay.slice(separationIndex, segmentsToDisplay.length), 2, !rightNodeIsOneSpeaker);
    if(document.getElementById("question").innerHTML) {
        displayQuestion();
    }    
}


/**
  * Send a post request to get the segments corresponding to the clicked node
  *
  * @param {Number} nodeId The id of the clicked node
  * @param {string} selectionMethod The method that should be used to sort the segments
  */
function getSegmentsFromNode(nodeId, selectionMethod) {
     var options = {
         method: 'POST',
         uri: 'http://127.0.0.1:5000/get_segments_from_node',
         form: {
            node_id: nodeId,
            selection_method: selectionMethod
        }
     }
 
     // get the segments
     request(options).then(function (res) {
         data = JSON.parse(res);
         if (data.segs1 && data.segs2) {
             loadSegmentsToDisplay(data.segs1, data.segs2, data.node_id);
         } else if (data.segs) {
             loadSegmentsToDisplay(data.segs, [], data.node_id);
         }
     })
 }


 /**
  * Send a post request to shutdown the flask server
  *
  */
 function shutdownServer() {
    var options = {
        method: 'POST',
        uri: 'http://127.0.0.1:5000/shutdown',
    }

    request(options).then(function (res) {
        console.log("Server down")
    })
}


/**
  * Load the segments in the global variable
  * 
  * @param {Array} segs The array of segments to load
  */
function loadSegments(segs) {
    segments = segs;
}


/**
  * Update the display with default display
  * 
  */
function updateDisplay() {
    nextQuestionButton.style.display = "";
    noButton.style.display = "none";
    yesButton.style.display = "none";
    removeHighlight();
    clearInterval(flashNodeTimer);
    questionNode = null;
    document.getElementById("question").innerHTML = "";
}


/**
  * Load the diarization data
  * 
  * @param {Object} data The object containing the segments, the clusters and the tree
  */
function loadData(data) {
    loadSegments(data.segments)
    clusters = data.clusters;
    randomColorClusters();
    if(!renamingTable) {
        initRenamingTable();
    }
    drawDendrogram(data.tree);
}


/**
  * Draw a random color for each cluster
  * 
  */
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


/**
  * Display the text of the question
  * 
  */
function displayQuestion() {
  let intituleQuestion = document.getElementById("question");
  let spk1 = document.getElementById("spkname1");
  let spk2 = document.getElementById("spkname2");
  intituleQuestion.innerHTML = "Are <b>" + spk1.textContent + "</b> and <b>" + spk2.textContent + "</b> the same speaker ?";
}


/**
  * Load the question
  * 
  * @param {Object} question The question object sent by the system
  */
function loadQuestion(question) {
  // first find the node concerned by the question
  let node = findParentNode(question.node[0], question.node[1]);
  //highlight the node
  highlightNode(node.children[0]);
  flashNode(node.children[0]);

  //load segments to display
  loadSegmentsToDisplay(question.segs1, question.segs2, node.__data__.data.node_id)
  displayQuestion();
}


/**
  * Load the segments to display
  * 
  * @param {Array} segList1 The first array of segments to display
  * @param {Array} segList2 The second array of segments to display
  * @param {string} nodeId The id of the selected node
  */
function loadSegmentsToDisplay(segList1, segList2, nodeId) {
    findSegmentsToDisplay(segList1, segList2);
    setClustersToDisplay();
    let children = findChildrenNodes(nodeId);
    if (children) {
        leftNode = children[0];
        rightNode = children[1];
    }
    findIfChildrenIsOneSpeaker(nodeId);
    displaySegmentDetails(segmentsToDisplay.slice(0, separationIndex), 1, !leftNodeIsOneSpeaker);
    displaySegmentDetails(segmentsToDisplay.slice(separationIndex, segmentsToDisplay.length), 2, !rightNodeIsOneSpeaker);
    displayRegions();
    getClusterFromNodeId(nodeId);
}


/**
  * Process the two segment lists and get for each segment its index in "segments[]".
  * Each index is added in "segmentsToDisplay[]"
  * "separationIndex" is the index that marks the separation between the two segment lists.
  * 
  * @param {Array} segList1 The first array of segments to display
  * @param {Array} segList2 The second array of segments to display
  */
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


/**
  * Check if two arrays are equals
  * 
  * @param {Array} a1 The first array
  * @param {Array} a2 The second array
  * @returns {Boolean} Return true if arrays are equals, false otherwise
  */
function arraysEqual(a1,a2) {
    return JSON.stringify(a1)==JSON.stringify(a2);
}


/**
  * Calculate the clusters to display according to the segments to display
  * 
  */
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


/**
  * Save the diarization error rate log in a file
  * 
  * @param {Object} der The der object to save
  */
function saveDERToFile(der) {
    //third parameter is for pretty print
    let data = JSON.stringify(der, null, 4);
    var jsonPath = path.join(__dirname, '..', 'der.json');
    fs.writeFileSync(jsonPath, data);
}


/**
  * Reset the display
  * 
  */
function initDisplay() {
    nextQuestionButton.style.display = "none";
    noButton.style.display = "none";
    yesButton.style.display = "none";
    derButton.style.display = "none";
    displaySegmentDetails([], 1);
    displaySegmentDetails([], 2);
    $(window).resize();
}


/**
 * Return the new name of a speaker.
 * 
 * @param {string} defaultClusterName The default name of the cluster
 * @returns The new name of the speaker if sets, the old name otherwise
 */
function getSpeakerNewName(defaultClusterName) {
    let newName = renamingTable.links[defaultClusterName].newName;
    return newName ? newName : defaultClusterName;
}


/**
 * Return the name of a cluster for a given node
 * @param {Number} nodeId The if of the node 
 * @returns {string The name of the cluster}
 */
function getClusterFromNodeId(nodeId) {
    if (nodeId < clusters.length) {
        return clusters[nodeId];
    }
}


/**
 * Return an object with the old name and the new name of each initial cluster
 * @returns {Object} The object with the old name and the new name
 */
function getNewClusterLabels() {
    newClusterLabels = new Object;
    for (let i = 0; i < clusters.length; i++) {
        oldName = clusters[i];
        newName = renamingTable.links[oldName].newName;
        newClusterLabels[oldName] = newName;
    }
    return newClusterLabels
}
