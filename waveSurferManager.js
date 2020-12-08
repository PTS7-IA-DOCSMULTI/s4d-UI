var WaveSurfer = require('wavesurfer.js');
var RegionPlugin = require ('wavesurfer.js/dist/plugin/wavesurfer.regions.min.js');

var wavesurfer; 

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
}

function toggleMute() {
    wavesurfer.toggleMute();
}

function stop() {
    wavesurfer.stop();
}

function seekAndCenter() {
    wavesurfer.seekAndCenter(
        wavesurfer.getCurrentTime() / wavesurfer.getDuration()
    );
    wavesurfer.play();
}

function drawWaveForm() {
    wavesurfer = WaveSurfer.create({
        container: '#waveform',
        plugins: [
            RegionPlugin.create({})
        ],
        waveColor: 'violet',
        progressColor: 'blue',
        scrollParent: true,
        partialRender: true,
        responsive: true
    });
    
    wavesurfer.load('./audio.wav');
    setInterval(displayTime, 500);

    wavesurfer.on('ready', function() {
        wavesurfer.zoom(1);
    })
    
    var slider = document.querySelector('#slider');

    slider.oninput = function () {
      var zoomLevel = Number(slider.value);
      wavesurfer.zoom(zoomLevel);
    };

    wavesurfer.on('region-click', function(d, event) {
        d.play();
        event.stopPropagation();
    });

    //called when a region is resized
    wavesurfer.on('region-update-end', function(d) {
        //todo
    });

}

// display regions on waveform
function loadPeriods(segments) {
    //remove all regions on waveform
    wavesurfer.clearRegions();

    wavesurfer.zoom(1);
    for(var i = 0; i < segments.length; i++) {
        var seg = segments[i].data;  
        var options = 
        {
            start: seg.start,
            end: seg.end,
            loop: false,
            drag: false,
            color: "rgba(255, 255, 255, 0.5)",
            resize: true
        } 
        wavesurfer.addRegion(options); 
    }

    var list = document.getElementsByClassName("wavesurfer-region");
    for(let i = 0; i < list.length; i++) {
        list[i].style.cursor = "pointer";
        list[i].style.zIndex = 10;
    }
}