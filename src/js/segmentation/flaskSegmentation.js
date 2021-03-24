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

var folderPath;
var shortFileName;
var extension;

var segments = [];
var clusters = [];
var colors = [];
var segmentsToDisplay = [];

var validateButton;
var flashRegionTimer;

/*
 * Display initialisation
 *
*/

window.onload = function() {
    validateButton = document.getElementById('validateButton');
    validateButton.onclick = function() {
        validateSegmentation();
    }
}

/*
 * POST REQUESTS
 * Post requests are used to communicate with the server
*/

function loadFile(fileName) {

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
        displayData();
    })
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

 function shutdownServer() {
    var options = {
        method: 'POST',
        uri: 'http://127.0.0.1:5000/shutdown',
    }

    request(options).then(function (res) {
        console.log("Server down")
    })
}

/*
 * IPC RENDERER
 * ipcRenderer is used to communicate with main.js
*/

ipcRenderer.on('openFile', (event, arg) => {
    folderPath = path.dirname(arg);
    extension = path.extname(arg)
    shortFileName = path.basename(arg, extension)
    url = path.join(folderPath, shortFileName)
    loadFile(url);
});

ipcRenderer.on('saveFile', (event, arg) => {
    saveFile(arg);
});

/*
 * Others methods
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


function randomColorClusters() {
  colors = [];
  for (i = 0; i < clusters.length; i++) {
    let r = Math.floor(Math.random() * 256); 
    let g = Math.floor(Math.random() * 256); 
    let b = Math.floor(Math.random() * 256); 
    colors.push("rgba(" + r + ", " + g + ", " + b + ", 1)");
  }
}


function updateSegmentsToDisplay(selectedSpeaker) {
    segmentsToDisplay = []
    for (let i = 0; i < segments.length; i++) {
        if (segments[i][1] == selectedSpeaker) {
            segmentsToDisplay.push(i)
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


function validateSegmentation() {
    updateInitDiar(segments);
}


//display node information on right panel
function displaySegmentDetails(segsIndex) {
  
    let segTable = document.getElementById("segTable2");
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
  
    if (segsIndex.length > 0) {
      let firstSeg = segments[segsIndex[0]];
      let indexCluster = clusters.indexOf(firstSeg[1]);
      let color = colors[indexCluster];
      tag.style.backgroundColor = color ? color : "rgba(71,71,71,255)";
      tag.style.display = "";
      let name = firstSeg[1];
      spkName.innerHTML = name;
    } else {
      tag.style.display = "none";
      spkName.innerHTML = "Speaker";
    }
  
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

function flashRegion(target) {
    let segID = target.style["data-id"];
    let htmlRegion = wavesurfer.regions.list[segID].element;
    $(htmlRegion).fadeOut(800).fadeIn(800);
    flashRegionTimer = setInterval(function(){ 
        $(htmlRegion).fadeOut(800).fadeIn(800);
    }, 1600);
}

function displayData() {
    displaySpeakerNames();
    updateSelectedSpeaker();
    displayRegions();
}


function displaySpeakerNames() {
  
    let speakersTable = document.getElementById("speakers");
    speakersTable.innerHTML = "";    
  
    let table = document.createElement('table');
    table.setAttribute('border','0');
    table.setAttribute('width','10%');
  
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

        radiobox.addEventListener('change', function() {
            updateSelectedSpeaker();
        });
        
        //add elem to row
        row.insertCell(0).appendChild(radiobox);
        row.insertCell(1).appendChild(speakerName);
  
    }
    //add elems to html page
    speakersTable.appendChild(table);
}


function updateSelectedSpeaker() {
    let selectedSpeaker = $("input[name='selectedSpeaker']:checked").val();
    updateSegmentsToDisplay(selectedSpeaker);
    displaySegmentDetails(segmentsToDisplay);
}


