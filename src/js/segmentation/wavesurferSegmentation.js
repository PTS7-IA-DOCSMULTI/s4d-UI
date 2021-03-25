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
var MinimapPlugin = require ('wavesurfer.js/dist/plugin/wavesurfer.minimap.min.js');
const ipcRendererWaveSurfer = require('electron').ipcRenderer;
var url;
var wavesurfer;
var regionCreated;
var isPlayingRegionOnly = false;
var shouldShowMenu = false;
var rightClickData;

ipcRendererWaveSurfer.on('right-click', (event, arg) => {
    let element = document.elementFromPoint(arg.x, arg.y)
    if (element && element.tagName.toLowerCase() == 'region') {
        rightClickData = {
            region: element,
            x: arg.x,
            y: arg.y
        }
    } else {
        rightClickData = null;
    }
});

ipcRendererWaveSurfer.on('delete-region', (event, arg) => {
    deleteRegion(rightClickData.region)
});

ipcRendererWaveSurfer.on('split-region', (event, arg) => {
    splitRegion(rightClickData.region, rightClickData.x)
});


window.addEventListener('mousemove', e => {
    let element = document.elementFromPoint(e.x, e.y)
    let elemIsRegion = (element && element.tagName.toLowerCase() == 'region')
    if (shouldShowMenu != elemIsRegion) {
        shouldShowMenu = elemIsRegion
        ipcRendererWaveSurfer.send('should-show-menu', shouldShowMenu)
    }  
  });

function displayTime() {
    let text = secondsToHms(wavesurfer.getCurrentTime()) + " - " + secondsToHms(wavesurfer.getDuration());
    document.getElementById("audioTime").innerHTML = text;
}

function wavesurferLoadFile(filename) {

    wavesurfer.pause();

    var playIcon = document.getElementById("play");
    playIcon.classList.remove("play");
    playIcon.classList.add("play");
    playIcon.classList.remove("pause");

    url = filename;
    // Second parameter is an array of pre-generated peaks
    // Empty array avoid displaying the waveform
    // wavesurfer.load(url, []);
    wavesurfer.load(url);
    document.title = "s4d-UI - " + url;
    document.getElementById("filename").innerHTML = '<span>' + url.split('\\').pop() + '</span>';
};

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
    isPlayingRegionOnly = false;
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
	playIcon.classList.add("play");
	playIcon.classList.remove("pause");
}

function setDragSelection(dragSelection) {
    if (dragSelection) {
        wavesurfer.enableDragSelection(true);
    } else {
        wavesurfer.disableDragSelection();
    }
}

function initWavesurfer() {
    wavesurfer = WaveSurfer.create({
        container: '#waveform',
        plugins: [
            RegionPlugin.create({
                dragSelection: true
            })/*,
            MinimapPlugin.create({
 
            })*/
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

    //called when a region is resized
    wavesurfer.on('region-update-end', function(region) {

        if (region.id.toString().startsWith("wavesurfer")) {
            generateSegmentCreatedByUser(region);
        } else {
            seg = segments[region.id]
            seg[3] = Math.round(region.start * 100);
            seg[4] = Math.round(region.end * 100);
            displaySegmentDetails(segmentsToDisplay);
        }
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

    wavesurfer.on('region-created', region => {
        if (region.id.toString().startsWith("wavesurfer")) {
            regionCreated = region
            document.addEventListener('mousemove', colorRegionCreatedByUser, false);
        } 
    });

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
}


// display regions on waveform
function displayRegions() {
    //remove all regions displayed on waveform
    wavesurfer.clearRegions();
    //remove remaining regions
    wavesurfer.regions.list = {}
    
    for(let i = 0; i < clusters.length; i++) {
        let color = colors[i]
        
        for (let j = 0; j < segments.length; j++) {
            let seg = segments[j];
            if (seg[1] == clusters[i]) {
                let options =
                {
                    id: j,
                    start: seg[3] / 100,
                    end: seg[4] / 100,
                    loop: false,
                    drag: false,
                    color: color,
                    resize: true
                } 
                let region = wavesurfer.addRegion(options);
                region.element.style.groupId = i;
            }
        }
    }

    let waveformHeight = document.getElementById('waveform').offsetHeight;
    let regionHeight = waveformHeight / clusters.length;
    let regionTop = 100 / clusters.length;
    var regions = document.getElementsByClassName("wavesurfer-region");
    for(let i = 0; i < regions.length; i++) {
        regions[i].style.height = regionHeight + 'px';
        regions[i].style.top = regionTop * regions[i].style.groupId * waveformHeight / 100 + 'px';                    
    }

   updateBoundaries();

   dragSelection = Object.keys(wavesurfer.regions.list).length > 0
   setDragSelection(dragSelection)
}

function getNextRegionFromSameSpeaker(region) {
    seg = segments[region.id];
    sameSpeakerSegments = segments.filter( s => s[1] == seg[1]);
    indexOfSeg = sameSpeakerSegments.indexOf(seg);
    indexOfNextSeg = indexOfSeg + 1;
    nextSeg = sameSpeakerSegments[indexOfNextSeg];
    nextSegId = segments.indexOf(nextSeg);
   
    return wavesurfer.regions.list[nextSegId]
}

function getBackRegionFromSameSpeaker(region) {
    seg = segments[region.id];
    sameSpeakerSegments = segments.filter( s => s[1] == seg[1]);
    indexOfSeg = sameSpeakerSegments.indexOf(seg);
    indexOfBackSeg = indexOfSeg - 1;
    backSeg = sameSpeakerSegments[indexOfBackSeg];
    backSegId = segments.indexOf(backSeg);
   
    return wavesurfer.regions.list[backSegId]
}

//set next and back region for each region
function updateBoundaries() {
    for (id in wavesurfer.regions.list) {
        let region = wavesurfer.regions.list[id];
        region.attributes.nextRegion = getNextRegionFromSameSpeaker(region);
        region.attributes.backRegion = getBackRegionFromSameSpeaker(region);
    }
}

function colorRegionCreatedByUser(mouseEvent) {

    document.removeEventListener('mousemove', colorRegionCreatedByUser);

    mouseY = mouseEvent.pageY;
    waveform = document.getElementById('waveform');
    scrollContainer = document.getElementById('scrollContainer');

    let waveformTop = scrollContainer.offsetTop;
    let waveformScroll = scrollContainer.scrollTop;
    let waveformHeight = waveform.offsetHeight;
    let mouseRelativePos = mouseY - waveformTop + waveformScroll;

    iCluster = Math.trunc((mouseRelativePos/waveformHeight) * clusters.length);

    let regionHeight = waveformHeight / clusters.length;
    let regionTop = 100 / clusters.length;

    regionCreated.element.style.height = regionHeight + 'px';
    regionCreated.element.style.top = regionTop * iCluster * waveformHeight / 100 + 'px';

    cluster = clusters[iCluster];
    let indexCluster = clusters.indexOf(cluster)
    let color = colors[indexCluster]
    regionCreated.color = color;
    regionCreated.element.style.backgroundColor = color;
    regionCreated.loop = false;
    regionCreated.drag = false;
    regionCreated.resize = true;
    regionCreated.style.groupId = iCluster;

    //set next and back region
    regionCreated.attributes.nextRegion = getNextRegionForNewRegion(regionCreated)
    regionCreated.attributes.backRegion = getBackRegionForNewRegion(regionCreated)
}

function generateSegmentCreatedByUser(region) {

    //create the segment
    showName = segments[0][0];
    cluster = clusters[region.style.groupId];
    speaker = "speaker";
    start = Math.round(region.start * 100);
    end = Math.round(region.end * 100);
    u = "U";
    seg = [showName, cluster, speaker, start, end, u];

    // add the segment in segments
    segId = segments.push(seg);
    region.id = segId;

    //resort segment by time because the new segment position is not correct
    segments.sort((a, b) => a[3] - b [3])
    displayData();
    displayRegions();
}

function deleteRegion(region) {
    let id = region.getAttribute('data-id');
    //remove segment
    segments.splice(id, 1)

    displayData();
    displayRegions(); 

}

function splitRegion(region, x) {
    // duplicate the segment
    let id = region.getAttribute('data-id');
    let duplicatedSeg = [...segments[id]]
   
    // compute boundaries of segments
    let rect = region.getBoundingClientRect();
    let percentage = (x - rect.left) / (rect.right - rect.left)
    let startTime = Number(duplicatedSeg[3])
    let endTime = Number(duplicatedSeg[4])
    let time = Math.round((endTime - startTime) * percentage + startTime)

    // update boundaries
    duplicatedSeg[3] = time
    segments[id][4] = time

    // add the duplicated segment in segments
    segId = segments.push(duplicatedSeg);

    segments.sort((a, b) => a[3] - b [3])

    displayData();
    displayRegions();
}

function resizeWaveform(){
    let speakers = document.getElementById("speakers")
    let table = speakers.childNodes[0]
    let height = parseFloat($(table).css('height'))
    wavesurfer.setHeight(height)
}

window.addEventListener('resize', function(event){
    resizeWaveform();
    displayRegions();
});


function getNextRegionForNewRegion(newRegion) {
    indexCluster = newRegion.style.groupId;
    sameSpeakerSegments = segments.filter( s => s[1] == clusters[indexCluster]);
    start = newRegion.start * 100;
    nextRegion = null
    for (let i = sameSpeakerSegments.length - 1; i >= 0; i--) {
        if (sameSpeakerSegments[i][3] > start) {
            seg = sameSpeakerSegments[i];
            index = segments.indexOf(seg)
            nextRegion = wavesurfer.regions.list[index]
        } else {
            break;
        }
    }
    return nextRegion;
}


function getBackRegionForNewRegion(newRegion) {
    indexCluster = newRegion.style.groupId;
    sameSpeakerSegments = segments.filter( s => s[1] == clusters[indexCluster]);
    start = newRegion.start * 100;
    backRegion = null
    for (let i = 0; i < sameSpeakerSegments.length; i++) {
        if (sameSpeakerSegments[i][3] < start) {
            seg = sameSpeakerSegments[i];
            index = segments.indexOf(seg)
            backRegion = wavesurfer.regions.list[index]
        } else {
            break;
        }
    }
    return backRegion;
}
