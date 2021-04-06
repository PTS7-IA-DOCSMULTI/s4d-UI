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
const { settings } = require('cluster');
const { clearScreenDown } = require('readline');

var folderPath;
var shortFileName;
var extension;

var segments = [];
var clusters = [];
var colors = [];
var segmentsToDisplay = [];

var validateButton;
var flashRegionTimer;
var addClusterButton;
var deleteClusterBtn;
var helpButton;

window.onload = function() {
    validateButton = document.getElementById('validateButton');
    validateButton.onclick = function() {
        updateInitDiar(segments);
    }

    addClusterButton = document.getElementById('addClusterButton');
    addClusterButton.onclick = function() {
        let clusterName = addNewCluster();
        displaySpeakerNames();
        displayData();
        $("input[name='selectedSpeaker'][value=" + clusterName + "]").prop('checked', true);
        updateSelectedSpeaker();
        var scrollContainer = $('#scrollContainer');
        scrollContainer.scrollTop(scrollContainer.prop("scrollHeight"));
    }

    deleteClusterBtn = document.getElementById('deleteClusterBtn');
    deleteClusterBtn.onclick = function() {
        let clusterName = $("input[name='selectedSpeaker']:checked").val();
        deleteCluster(clusterName);
        displaySpeakerNames();
        displayData();
        $("input[name='selectedSpeaker'][value=" + clusters[0] + "]").prop('checked', true);
        updateSelectedSpeaker();
        $('#scrollContainer').scrollTop(0);
    }

    resetButton = document.getElementById('resetSegmentation');
    resetButton.onclick = function() {
        let audioPath = ipcRenderer.sendSync('get-audio-path');
        let url = path.join(folderPath, shortFileName)
        getInitDiar(url);
    }

    helpButton = document.getElementById('help');
    helpButton.onclick = function() {
        displayHelp();
    }

    ipcRenderer.on('saveFile', (event, arg) => {
        saveFile(arg);
    });

    initWavesurferButtons();
    initWavesurfer();
    let audioPath = ipcRenderer.sendSync('get-audio-path');
    wavesurferLoadFile(audioPath);
    folderPath = path.dirname(audioPath);
    extension = path.extname(audioPath)
    shortFileName = path.basename(audioPath, extension)
    url = path.join(folderPath, shortFileName)

    let userSegAlreadyExists = fs.existsSync(url + ".user_seg.mdtm")
    if (userSegAlreadyExists) {
        getSavedSegmentation(url);
    } else {
        getInitDiar(url);
    }
}


/**
  * Send a post request to get the initial diarization
  *
  * @param {string} fileName The path to the audio file to load
  */
function getInitDiar(fileName) {

    var options = {
        method: 'POST',
        uri: 'http://127.0.0.1:5000/get_init_diar',
        json: {
            show_name: fileName,
        }
    }

    request(options).then(function(res) {
        segments = res.segments
        findClusters();
        randomColorClusters();
        displaySpeakerNames();
        displayData();
    })
}

/** 
  * Send a post request to get the segmentation saved by the user
  *
  * @param {string} fileName The path to the audio file to load
  */
function getSavedSegmentation(fileName) {

  var options = {
      method: 'POST',
      uri: 'http://127.0.0.1:5000/get_user_seg',
      json: {
          show_name: fileName,
      }
  }

  request(options).then(function(res) {
      segments = res.segments
      findClusters();
      randomColorClusters();
      displaySpeakerNames();
      displayData();
  })
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
        form: {
            path: path
        }
    }

    // send path
    request(options);
}


/**
 * Send a post request to update the initial diar with the segmentation modified by the user
 * @param {Array} segments The segments modified by the user
 */
function updateInitDiar(segments) {

    var jsonPath = path.join(__dirname, '..', 'settings.json');
    let settings = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    let vectors_type = settings.vectors_type;

    let system_config_path = path.join(__dirname, '../config/lium_baseline.yaml')
    let model_allies_path = path.join(__dirname, '../config/model_allies_baseline_' + vectors_type + 'v.p')
    let best_xtractor_path = path.join(__dirname, '../config/best_xtractor.pt')

    var options = {
        method: 'POST',
        uri: 'http://127.0.0.1:5000/update_init_diar',
        json: {
            segments: segments,
            system_config_path: system_config_path,
            model_allies_path: model_allies_path,
            show: shortFileName,
            root_folder: folderPath,
            tmp_dir: path.join(folderPath, "tmp"),
            mdtm_path: path.join(folderPath, shortFileName + ".user_seg.mdtm"),
            wav_file: path.join(folderPath, shortFileName + extension),
            best_xtractor_path: best_xtractor_path,
            clustering_method: settings.clustering_method,
            selection_method: settings.selection_method,
            conditional_questioning: ""+settings.conditional_questioning,
            prioritize_separation2clustering: ""+settings.prioritize_separation2clustering,
            vectors_type: vectors_type
        }
    }
    request(options).then(function (res) {
        ipcRenderer.sendSync('validate-segmentation');
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
 * Fill "clusters[]" with all the clusters found in the segments
 * 
 */
function findClusters() {
    clusters = [];
    for (let i = 0; i < segments.length; i++) {
        let cluster = segments[i][1]
        if (clusters.indexOf(cluster) == -1)
        clusters.push(cluster);
    }
}


/**
  * Draw a random color for each cluster
  * 
  */
function randomColorClusters() {
  colors = [];
  for (i = 0; i < clusters.length; i++) {
    let r = Math.floor(Math.random() * 256); 
    let g = Math.floor(Math.random() * 256); 
    let b = Math.floor(Math.random() * 256); 
    colors.push("rgba(" + r + ", " + g + ", " + b + ", 0.5)");
  }
}


/**
 * Update segments to display according to the selected speaker
 * 
 * @param {string} selectedSpeaker The speaker selected
 */
function updateSegmentsToDisplay(selectedSpeaker) {
    segmentsToDisplay = []
    for (let i = 0; i < segments.length; i++) {
        if (segments[i][1] == selectedSpeaker) {
            segmentsToDisplay.push(i)
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
  * Display a table of segments on the right panel.
  *
  * @param {Number[]} segsIndex The array containing the indexes of the segments to display.
  * Each index refers to a segment in the "segments" variable.
  */
function displaySegmentDetails(segsIndex) {
  
    let segTable = document.getElementById("segTable");
    segTable.innerHTML = "";    
  
    let table = document.createElement('table');
    table.setAttribute('border','0');
    table.setAttribute('width','100%');
  
    let header = table.createTHead();
    let headerRow = header.insertRow(0); 
    var thStartElement = document.createElement("TH");
    var thEndElement = document.createElement("TH");
    var thPlayElement = document.createElement("TH");
    headerRow.appendChild(thStartElement);
    headerRow.appendChild(thEndElement);
    headerRow.appendChild(thPlayElement);
    thStartElement.innerHTML = "<b>Start</b>";
    thEndElement.innerHTML = "<b>End</b>";
    thPlayElement.innerHTML = "<b>Play</b>";
  
    let tag = document.getElementById("speaker-tag2");
    let spkName = document.getElementById("spkname2");
  
    let tbody = table.createTBody();
    let j = 0;
  
    let clusterName = $("input[name='selectedSpeaker']:checked").val();
    let indexCluster = clusters.indexOf(clusterName);
    tag.style.backgroundColor = colors[indexCluster]
    tag.style.display = "";
    spkName.innerHTML = clusterName;
    
  
    for(let i = 0; i < segsIndex.length; i++) {
        //add a row for each segment
        let row = tbody.insertRow(j++);
  
        //event to flash the region when the mouse is on a row
        let hoverTimer;
        row.addEventListener("mouseenter", function( event ) {
          hoverTimer = setTimeout(function() {
            flashRegion(event.target);
            clearInterval(hoverTimer);
          }, 1000);
        });
        row.addEventListener("mouseleave", function( event ) {
          clearInterval(hoverTimer);
          clearInterval(flashRegionTimer);
        });
  
        //create elems to add
        let seg = segments[segsIndex[i]]
        let start = document.createTextNode(secondsToHms(seg[3] / 100));
        let end = document.createTextNode(secondsToHms(seg[4] / 100));
  
        let btns = document.createElement("DIV");
        btns.classList.add("single-button");
        let btn = document.createElement("BUTTON");
        btn.classList.add('action-button');
        btn.innerHTML = "<i class='play icon'></i>";
        btn.onclick = function() {
          isPlayingRegionOnly = true;
          wavesurfer.regions.list[segsIndex[i]].play();
          let playIcon = document.getElementById("play");
          playIcon.classList.remove("play");
          playIcon.classList.add("pause");
        };
        row.style["data-id"] = segsIndex[i];
        btns.appendChild(btn);
        //add elem to row
        row.insertCell(0).appendChild(start);
        row.insertCell(1).appendChild(end);
        row.insertCell(2).appendChild(btns);
  
    }
    //add elems to html page
    segTable.appendChild(table);
}


/**
  * Make a region of the waveform appears and disappears
  *
  * @param {Element} target The html region
  */
function flashRegion(target) {
    let segID = target.style["data-id"];
    let htmlRegion = wavesurfer.regions.list[segID].element;
    $(htmlRegion).fadeOut(800).fadeIn(800);
    flashRegionTimer = setInterval(function(){ 
        $(htmlRegion).fadeOut(800).fadeIn(800);
    }, 1600);
}


/**
 * Display all data
 * 
 */
function displayData() {
    displayClustersOverview();
    updateSelectedSpeaker();
    resizeWaveform();
    displayRegions();
}

/**
 * Create and html table with one speaker and one radio button per row
 * 
 */
function displaySpeakerNames() {
  
    let speakersTable = document.getElementById("speakers");
    speakersTable.innerHTML = "";    
  
    let table = document.createElement('table');
    table.setAttribute('border','0');
    table.setAttribute('width','200px');
  
    let tbody = table.createTBody();
    let j = 0;
  
    for(let i = 0; i < clusters.length; i++) {
        //add a row for each segment
        let row = tbody.insertRow(j++);
  
        //create elems to add
        let speakerName = document.createTextNode(clusters[i])
  
        var radiobox = document.createElement('input');
        radiobox.type = 'radio';
        radiobox.id = 'selectedSpeaker' + i;
        radiobox.value = clusters[i];
        radiobox.name = 'selectedSpeaker'
        radiobox.checked = (i == 0)
        
        //add elem to row
        row.insertCell(0).appendChild(radiobox);
        row.insertCell(1).appendChild(speakerName);

        row.onclick = function() {
            $("input[name='selectedSpeaker'][value=" + clusters[i] + "]").prop('checked', true);
            updateSelectedSpeaker();
            updateCanvas();
        }
  
    }
    //add elems to html page
    speakersTable.appendChild(table);
}


/**
 * Update the selected speaker and the display consequently
 */
function updateSelectedSpeaker() {
    let selectedSpeaker = $("input[name='selectedSpeaker']:checked").val();
    updateSegmentsToDisplay(selectedSpeaker);
    displaySegmentDetails(segmentsToDisplay);
}


/**
 * Add a new cluster in the list
 * 
 * @returns {String} The name of the new cluster
 */
function addNewCluster() {
    let i = 0;
    while(clusters.includes(String(i))) {
        i++;
    }
    clusters.push(String(i));
    let r = Math.floor(Math.random() * 256); 
    let g = Math.floor(Math.random() * 256); 
    let b = Math.floor(Math.random() * 256); 
    colors.push("rgba(" + r + ", " + g + ", " + b + ", 1)");

    return String(i);
}


/**
 * Delete a cluster and all its segments
 */
function deleteCluster(clusterName) {
    segments = segments.filter(s => s[1] != clusterName);
    let indexCluster = clusters.indexOf(clusterName);
    clusters.splice(indexCluster, 1);
    colors.splice(indexCluster, 1);
}


/**
 *  Display help for segmentation step
 * 
 */
function displayHelp() {
    let msg = "During the segmentation step, you can create new segments by dragging on the timeline, " +
    "delete or split a segment by right-clicking on it and change the borders of a segment. " +
    "When the segmentation is right for you, press 'validate segmentation' to load the clustering step. " +
    "You can use the reset button to undo all of your changes." 
    ipcRenderer.sendSync('display-information-msg', msg);
}


/**
 * Display the total number of segments and clusters
 */
function displayClustersOverview() {
    document.getElementById('nbClusterLabel').innerHTML = clusters.length
    document.getElementById('nbSegmentLabel').innerHTML = segments.length
}