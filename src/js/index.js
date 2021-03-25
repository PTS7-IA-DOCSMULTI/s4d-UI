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

var openFileButton;

window.onload = function() {
    openFileButton = document.getElementById('openFileButton');
    loadSegButton = document.getElementById('loadSegButton');
    filePathText = document.getElementById('filePath');
    openIcon = document.getElementById('openIcon');

    openFileButton.onclick = function() {
        ipcRenderer.send('open-file');        
    }

    openIcon.onclick = function() {
        ipcRenderer.send('open-file');        
    }

    loadSegButton.onclick = function() {
        ipcRenderer.send('show-segmentation');        
    }

    let res = ipcRenderer.sendSync('get-open-file-result');
 
    if(res.audioPath) {
        filePathText.innerHTML = res.audioPath
        loadSegButton.parentElement.style.visibility = 'visible'
    } else {
        loadSegButton.parentElement.style.visibility = 'hidden'
        filePathText.innerHtml = "No selected file"
        if(res.errorMsg) alert(res.errorMsg);
    }
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


ipcRenderer.on('saveFile', (event, arg) => {
    saveFile(arg);
});

