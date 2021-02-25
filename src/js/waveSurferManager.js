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

var WaveSurfer = require('wavesurfer.js');
var RegionPlugin = require ('wavesurfer.js/dist/plugin/wavesurfer.regions.min.js');
const ipcRenderer = require('electron').ipcRenderer;
var url;
var wavesurfer;

ipcRenderer.on('fileNotFound', (event, arg) => {
    alert("File not found:\n" +  arg + "\n Make sure to put this file in the same folder than the audio file");
})

ipcRenderer.on('openFile', (event, arg) => {

    var playIcon = document.getElementById("play");
    playIcon.classList.remove("play");
    playIcon.classList.add("play");
    playIcon.classList.remove("pause");

    url = arg;
    // Second parameter is an array of pre-generated peaks
    // Empty array avoid displaying the waveform
    // wavesurfer.load(url, []);
    wavesurfer.load(url);
    document.title = "s4d-UI - " + url;
    document.getElementById("filename").innerHTML = '<span>' + url.split('\\').pop() + '</span>';
});

function displayTime() {
    let text = secondsToHms(wavesurfer.getCurrentTime()) + " - " + secondsToHms(wavesurfer.getDuration());
    document.getElementById("audioTime").innerHTML = text;
}

//duration must be in second
function secondsToHms(d) {
    d = Number(d);
    var h = Math.floor(d / 3600);
    var m = Math.floor(d % 3600 / 60);
    var s = Math.floor(d % 3600 % 60);

    let res =   (h < 10 ? "0" + h : h) + ":" +
                (m < 10 ? "0" + m : m) + ":" +
                (s < 10 ? "0" + s : s);

    while((res.startsWith("0") || res.startsWith(":")) && res.length > 4) {
        res = res.substring(1, res.length)
    }
    return res;
}

function playPause() {
    wavesurfer.playPause();
	var playIcon = document.getElementById("play");
	playIcon.classList.toggle("play");
	playIcon.classList.toggle("pause");
}

function toggleMute() {
    wavesurfer.toggleMute();
	var volumeIcon = document.getElementById("volume");
	volumeIcon.classList.toggle("up");
	volumeIcon.classList.toggle("off");
}

function stop() {
    wavesurfer.stop();
	var playIcon = document.getElementById("play");
	playIcon.classList.remove("play");
	playIcon.classList.add("play");
	playIcon.classList.remove("pause");
}

function drawWaveForm() {
    wavesurfer = WaveSurfer.create({
        container: '#waveform',
        plugins: [
            RegionPlugin.create({})
        ],
        waveColor: 'white',
        progressColor: 'white',
        scrollParent: true,
        partialRender: true,
        responsive: true,
        pixelRatio: 1,
        backend: 'MediaElement',
        cursorWidth: 2,
        cursorColor: "black"
    });

    wavesurfer.on('audioprocess', function() {
        displayTime();
    })

    wavesurfer.on('ready', function() {
        wavesurfer.zoom(0);
        displayTime();
    });

    wavesurfer.on('seek', function() {
        displayTime();
    })

    wavesurfer.on('zoom', function(d) {
        slider.value = d;
    })
    
    var slider = document.querySelector('#slider');
    slider.oninput = function () {
      var zoomLevel = Number(slider.value);
      wavesurfer.zoom(zoomLevel);
    };

    document.getElementById("zoom-out").onclick = function() {
        let slider = document.getElementById("slider");
        if (Number(slider.value) >= 1) {
            slider.value = Number(slider.value) - 1;
            wavesurfer.zoom(Number(slider.value));
        }
    }

    document.getElementById("zoom-in").onclick = function() {
        let slider = document.getElementById("slider");
        if (Number(slider.value) <= 49) {
            slider.value = Number(slider.value) + 1;
            wavesurfer.zoom(Number(slider.value));
        } 
    }

    //called when a region is resized
    wavesurfer.on('region-update-end', function(d) {
        for (i = 0; i < segments.length; i++) {
            let seg = segments[i];
            if (seg["data-id"] == d.id) {
                seg[3] = Math.round(d.start * 100);
                seg[4] = Math.round(d.end * 100);
                break;
            }
        }
        displaySegmentDetails();
    });

    // prevent regions of the same speaker from overlapping
    wavesurfer.on('region-updated', region => {

        if(region.attributes.nextRegion && region.end > region.attributes.nextRegion.start) {
          region.end = region.attributes.nextRegion.start
        }
        if(region.attributes.backRegion && region.start < region.attributes.backRegion.end) {
          region.start = region.attributes.backRegion.end
        }
    });

}

// display regions on waveform
function displayRegions() {
    //remove all regions on waveform
    wavesurfer.clearRegions();
    for(let i = 0; i < clustersToDisplay.length; i++) {
        let indexCluster = clusters.indexOf(clustersToDisplay[i])
        let color = colors[indexCluster]
        let segList = segLists[i];

        for(let j = 0; j < segList.length; j++) {
            let seg = segList[j];
            let options =
            {
                id: seg["data-id"],
                start: seg[3] / 100,
                end: seg[4] / 100,
                loop: false,
                drag: false,
                color: color,
                resize: true
            } 
            let region = wavesurfer.addRegion(options);
            seg.region = region; 
        }
    }

    let waveformHeight = document.getElementById('waveform').offsetHeight;
    let regionHeight = waveformHeight / clustersToDisplay.length;
    let regionTop = 100 / clustersToDisplay.length;
    var regions = document.getElementsByClassName("wavesurfer-region");
    for(let i = 0; i < regions.length; i++) {
        let groupId = regions[i].getAttribute('data-id').split('-')[0];
        regions[i].style.height = regionHeight + 'px';
        regions[i].style.top = regionTop * groupId * waveformHeight / 100 + 'px';                    
    }

   updateBoundaries();
}

function getNextRegionFromSameSpeaker(region) {
    var data  = region.id.split('-');
    var clusterId = parseInt(data[0]);
    var segment = parseInt(data[1]);

    return wavesurfer.regions.list[clusterId + "-" + (segment+1)]
}

function getBackRegionFromSameSpeaker(region) {
    var data  = region.id.split('-');
    var clusterId = parseInt(data[0]);
    var segment = parseInt(data[1]);

    if (segment > 0) {
        return wavesurfer.regions.list[clusterId + "-" + (segment-1)]
    }
}

//set next and back region for each region
function updateBoundaries() {
    for (id in wavesurfer.regions.list) {
        let region = wavesurfer.regions.list[id];
        region.attributes.nextRegion = getNextRegionFromSameSpeaker(region);
        region.attributes.backRegion = getBackRegionFromSameSpeaker(region);
    }
}
