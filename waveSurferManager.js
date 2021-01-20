var WaveSurfer = require('wavesurfer.js');
var RegionPlugin = require ('wavesurfer.js/dist/plugin/wavesurfer.regions.min.js');
const ipcRenderer = require('electron').ipcRenderer;
var url;
var wavesurfer;

ipcRenderer.on('openFile', (event, arg) => {

    var playIcon = document.getElementById("play");
    playIcon.classList.remove("play");
    playIcon.classList.add("play");
    playIcon.classList.remove("pause");

    url = arg;
    // Second parameter is an array of pre-generated peaks
    // Empty array avoid displaying the waveform
    wavesurfer.load(url, []);
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
    return (h < 10 ? "0" + h : h) + ":" +
            (m < 10 ? "0" + m : m) + ":" +
            (s < 10 ? "0" + s : s);
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

function debug(){
	var debugIcon = document.getElementById("debug");
	debugIcon.classList.toggle("slash");
	
	var testDiv = document.getElementById("test-div");
	if (testDiv.style.display == "inline-block"){
		testDiv.style.display="none";
	}
	else {
		testDiv.style.display="inline-block";
	}
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
        waveColor: 'yellow',
        progressColor: 'yellow',
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
    })

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

    //called when a region is resized
    wavesurfer.on('region-update-end', function(d) {
        //todo
    });

}

// display regions on waveform
function displayRegions() {
    //remove all regions on waveform
    wavesurfer.clearRegions();
   // wavesurfer.zoom(0);
    for(let i = 0; i < speakers.length; i++) { 
        let color = drawRandomColor();
        for(let j = 0; j < speakers[i].segments.length; j++) {
            let seg = speakers[i].segments[j]; 
            let options = 
            {
                id: i + '-' + j,
                start: seg.start,
                end: seg.end,
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
    let nbSpeakers = speakers.length;
    let regionHeight = waveformHeight / nbSpeakers;
    let regionTop = 100 / nbSpeakers;
    var regions = document.getElementsByClassName("wavesurfer-region");
    for(let i = 0; i < regions.length; i++) {
        let groupId = regions[i].getAttribute('data-id').split('-')[0];
        regions[i].style.height = regionHeight + 'px';
        regions[i].style.top = regionTop * groupId * waveformHeight / 100 + 'px';
    }
}

function drawRandomColor() {
    let r = Math.floor(Math.random() * 256); 
    let g = Math.floor(Math.random() * 256); 
    let b = Math.floor(Math.random() * 256); 
    return "rgba(" + r + ", " + g + ", " + b + ", 1)";
}
