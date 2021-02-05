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

    //called when a region is resized
    wavesurfer.on('region-update-end', function(d) {
        //todo
        
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
        let color = drawRandomColor();
        let cluster = segsToDisplay.filter(seg => seg[1] == clusters[clustersToDisplay[i]]);

        for(let j = 0; j < cluster.length; j++) {
            console.log('j: ' + j);
            let seg = cluster[j]; 
            let options =
            {
                id: i + '-' + j,
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

function drawRandomColor() {
    let r = Math.floor(Math.random() * 256); 
    let g = Math.floor(Math.random() * 256); 
    let b = Math.floor(Math.random() * 256); 
    return "rgba(" + r + ", " + g + ", " + b + ", 1)";
}

function getNextRegionFromSameSpeaker(region) {
    var data  = region.id.split('-');
    var clusterId = parseInt(data[0]);
    var segment = parseInt(data[1]);

    let segments = segsToDisplay.filter(seg => seg[1] == clusters[clustersToDisplay[clusterId]]);
    if (segments.length >= segment + 2) {
        return segments[segment + 1].region;
    }
}

function getBackRegionFromSameSpeaker(region) {
    var data  = region.id.split('-');
    var clusterId = parseInt(data[0]);
    var segment = parseInt(data[1]);

    if (segment > 0) {
        let segments = segsToDisplay.filter(seg => seg[1] == clusters[clustersToDisplay[clusterId]]);
        return segments[segment - 1].region;
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
