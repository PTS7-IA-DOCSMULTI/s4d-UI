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
const ipcRendererWaveSurfer = require('electron').ipcRenderer;
var url;
var wavesurfer;
var isPlayingRegionOnly = false;

window.addEventListener('resize', function(event){
    resizeWaveform();
    displayRegions();
});


/**
 * Load the audio file with wavesurfer
 * 
 * @param {string} audioFilePath The path to the audio file
 */
function wavesurferOpenFile(audioFilePath) {

    wavesurfer.pause();

    var playIcon = document.getElementById("play");
    playIcon.classList.remove("play");
    playIcon.classList.add("play");
    playIcon.classList.remove("pause");

    url = audioFilePath;
    // Second parameter is an array of pre-generated peaks
    // Empty array avoid displaying the waveform
    // wavesurfer.load(url, []);
    wavesurfer.load(url);
    document.title = "s4d-UI - " + url;
    document.getElementById("filename").innerHTML = '<span>' + url.split('\\').pop() + '</span>';
}


/**
 * Display the current position in the audio file and the duration
 * 
 */
function displayTime() {
    let text = secondsToHms(wavesurfer.getCurrentTime()) + " - " + secondsToHms(wavesurfer.getDuration());
    document.getElementById("audioTime").innerHTML = text;
}


/**
 * Format time in second to the format 'hh:mm:ss'.
 * Do not display hours if hours is equals to 0.
 * 
 * @param {Number} d The duration in second
 * @returns {string} The formatted time
 */
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


/**
 * Switch wavesurfer play/pause status
 * 
 */
function playPause() {
    wavesurfer.playPause();
	var playIcon = document.getElementById("play");
	playIcon.classList.toggle("play");
	playIcon.classList.toggle("pause");
    isPlayingRegionOnly = false;
}


/**
 * Switch wavesurfer mute/unmute status
 * 
 */
function toggleMute() {
    wavesurfer.toggleMute();
	var volumeIcon = document.getElementById("volume");
	volumeIcon.classList.toggle("up");
	volumeIcon.classList.toggle("off");
}


/**
 * Stop audio playback and set cursor at the beginning of the audio
 * 
 */
function stop() {
    wavesurfer.stop();
	var playIcon = document.getElementById("play");
	playIcon.classList.add("play");
	playIcon.classList.remove("pause");
}

/**
 * Initialize the wavesurfer object
 * 
 */
function initWavesurfer() {
    wavesurfer = WaveSurfer.create({
        container: '#waveform',
        plugins: [
            RegionPlugin.create({
                dragSelection: false
            })
        ],
        waveColor: 'white',
        progressColor: 'white',
        scrollParent: true,
        partialRender: true,
        responsive: true,
        pixelRatio: 1,
        backend: 'MediaElement',
        cursorWidth: 2,
        cursorColor: "black",
        normalize: false
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

    wavesurfer.on('region-out', function() {

        setTimeout(function(){
            if (isPlayingRegionOnly && !wavesurfer.isPlaying()) {
                var playIcon = document.getElementById("play");
                playIcon.classList.add("play");
                playIcon.classList.remove("pause"); 
            }
            isPlayingRegionOnly = false;
        }, 200);
    })

    wavesurfer.on('waveform-ready', function() {
        let slider = document.getElementById("slider");
        let zoomLevel = Number(slider.value);
        let maxZoom = slider.getAttribute("max");
        // play with zoom levels to update the display and get the waveform
        wavesurfer.zoom(maxZoom);
        wavesurfer.zoom(0);
        wavesurfer.zoom(zoomLevel);
    })

    resizeWaveform();
}


/**
 * Display regions on the waveform according to the segments in "segmentsToDisplay[]"
 * 
 */
function displayRegions() {
    //remove all regions displayed on waveform
    wavesurfer.clearRegions();
    //remove remaining regions
    wavesurfer.regions.list = {}

    for(let i = 0; i < clustersToDisplay.length; i++) {
        let indexCluster = clusters.indexOf(clustersToDisplay[i])
        let color = currentColors[indexCluster]
        
        for (let j = 0; j < segmentsToDisplay.length; j++) {
            let seg = segments[segmentsToDisplay[j]];
            if (seg[1] == clustersToDisplay[i]) {
                let options =
                {
                    id: segmentsToDisplay[j],
                    start: seg[3] / 100,
                    end: seg[4] / 100,
                    loop: false,
                    drag: false,
                    color: color,
                    resize: false
                } 
                let region = wavesurfer.addRegion(options);
                region.element.style.groupId = i;
            }
        }
    }

    let waveformHeight = document.getElementById('waveform').offsetHeight;
    let regionHeight = waveformHeight / clustersToDisplay.length;
    let regionTop = 100 / clustersToDisplay.length;
    var regions = document.getElementsByClassName("wavesurfer-region");
    for(let i = 0; i < regions.length; i++) {
        regions[i].style.height = regionHeight + 'px';
        regions[i].style.top = regionTop * regions[i].style.groupId * waveformHeight / 100 + 'px';                    
    }
}


/**
 * Resize waveform according to the size of the window
 * 
 */
function resizeWaveform(){
    var waveform = document.getElementById("waveform");
    var shadowBlock = waveform.parentElement.parentElement;
    var headerBlock = shadowBlock.childNodes[1]
    var contentBlock = shadowBlock.childNodes[3]
    var paddingTop = parseFloat($(contentBlock).css('padding-top'))
    var paddingBottom = parseFloat($(contentBlock).css('padding-bottom'))
    var height = shadowBlock.clientHeight - headerBlock.clientHeight - paddingTop - paddingBottom
    wavesurfer.setHeight(height)
}
