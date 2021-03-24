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

const electron = require('electron');
const path = require('path');
const url = require('url');
const net = require('net');
const { dialog } = require('electron');
const fs = require('fs');
const prompt = require('electron-prompt');
const contextMenu = require('electron-context-menu');

var settings;

const {app, BrowserWindow, Menu, ipcMain} = electron;

let mainWindow;
let shouldShowMenu = false;
let audioPath;

// Listen for app to be ready
app.on('ready', function(){
  // Create new window
  mainWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: true,
      spellcheck: true
    }
  });
  mainWindow.maximize();
  mainWindow.show();
  // Load html in window
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, '../html/segmentation.html'),
    protocol: 'file:',
    slashes:true
  }));
  // Quit app when closed
  mainWindow.on('closed', function(){
    app.quit();
  });

  // Build menu from template
  const mainMenu = Menu.buildFromTemplate(mainMenuTemplate);
  // Insert menu
  Menu.setApplicationMenu(mainMenu);

  initContextMenu();
});


// Create menu template
const mainMenuTemplate =  [
  // Each object is a dropdown
  {
    label: 'File',
    submenu: [
    {
      label: 'Open Audio',
      accelerator:process.platform == 'darwin' ? 'Command+O' : 'Ctrl+O',
      click(item, focusedWindow) {
        openFile();
      }
    },
    {
      label: 'Save to MDTM',
      accelerator:process.platform == 'darwin' ? 'Command+S' : 'Ctrl+S',
      click(item, focusedWindow) {
        saveFile();
      }
    }
    ]
  },
  {
    label: 'Settings',
    click(item, focusedWindow) {
        openSettings();
    }
  },
  {
    label: 'Developer Tools',
    submenu:[
    {
      role: 'reload'
    },
    {
      label: 'Toggle DevTools',
      accelerator:process.platform == 'darwin' ? 'Command+I' : 'Ctrl+I',
      click(item, focusedWindow){
        focusedWindow.toggleDevTools();
      }
    }
  ]
  } 
];

var openFile = function() {
  dialog.showOpenDialog({
    properties: [ 'openFile'], 
    filters: [
    { 
      name: 'Audio File (wav, mp3)',
      extensions: ['wav','mp3']
    }
    ]
  }).then(result => {
    if(!result.canceled) {
      // remove the extension of the audio file
      var url = result.filePaths[0].split('.');
      url.pop();
      url = url.join('.');

      // check if the folder of the selected audio file contains the required files
      var extensions = [".mdtm", ".first.mdtm", "_xv.h5", ".scores.h5", ".uem", ".ref.mdtm"]
      for (i = 0; i < extensions.length; i++) {
        let path = url + extensions[i];
        if (!fs.existsSync(path)) {
          mainWindow.webContents.send('fileNotFound', path);
          return;
        }
      }
      audioPath = result.filePaths[0]
      mainWindow.webContents.send('openFile', result.filePaths[0]);
    }
  }).catch(err => {
    console.log(err)
  })
};

var openSettings = function() {
  let settingsWindow;
  settingsWindow = new BrowserWindow({
    parent: mainWindow,
    modal: true,
    width: 900,
    height: 700,
    show: false,
    center: true,
    titre: 'Settings',
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true
    }
  });
  settingsWindow.show();
  // Load html in window
  settingsWindow.loadURL(url.format({
    pathname: path.join(__dirname, '../html/settings.html'),
    protocol: 'file:',
    slashes:true
  }));
  
  settingsWindow.on('closed', function(){
    settingsWindow = null;
  });

  settingsWindow.setMenu(null);
}

var saveFile = function() {
  dialog.showSaveDialog({
    filters: [
      { 
        name: 'MDTM File',
        extensions: ['mdtm']
      }
    ]
  }).then(result => {
    if(!result.canceled) {
      //send event to save the file to brain.js
      mainWindow.webContents.send('saveFile', result.filePath);
    }
  }).catch(err => {
    console.log(err)
  })
};

var openDER = function() {
  let derWindow;
  derWindow = new BrowserWindow({
   parent: mainWindow,
    modal: true,
    width: 500,
    height: 500,
    show: false,
    center: true,
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true
    }
  });
  derWindow.show();
  // Load html in window
  derWindow.loadURL(url.format({
    pathname: path.join(__dirname, '../html/der.html'),
    protocol: 'file:',
    slashes:true
  }));
  
  derWindow.on('closed', function(){
    derWindow = null;
  });

  derWindow.setMenu(null);
}

ipcMain.on('open-der', (event, arg) => {
  openDER();
  event.returnValue = null;
})

ipcMain.on('display-information-msg', (event, arg) => {

  const options = {
    type: 'info',
    title: 'Information',
    message: arg,
  };

  dialog.showMessageBox(null, options);
  event.returnValue = null;
})


ipcMain.on('rename-speaker', (event, arg) => {

  prompt({
    title: 'Rename speaker',
    label: 'Name',
    value: arg,
    inputAttrs: {
        type: 'text'
    },
    type: 'input',
    alwaysOnTop: true
  }, mainWindow)
  .then((r) => {
    event.returnValue = r;
  })
})


ipcMain.on('validate-segmentation', (event, arg) => {
  displayClusteringStep();
  event.returnValue = null;
})


// Create contextMenu template
const contextMenuTemplate =  [
  {
    label: 'Delete',
    click(item, focusedWindow) {
      mainWindow.webContents.send('delete-region');
    },
  },
  {
    label: 'Split',
    click(item, focusedWindow) {
      mainWindow.webContents.send('split-region');
    },
  }
]


function initContextMenu() {
  contextMenu({
    append: () => {return contextMenuTemplate},
    showInspectElement: false,
    showLookUpSelection: false,
    showSearchWithGoogle: false,
    showCopyImage: false,
    shouldShowMenu: function(event, parameters) {
      //get mouse position
      position = {
        x: parameters.x,
        y: parameters.y
      }
      // inform renderer of the right-click
      mainWindow.webContents.send('right-click', position);
      //display or not the menu
      return shouldShowMenu;
    } 
  });

  const dispose = contextMenu();
  dispose();
}


ipcMain.on('should-show-menu', (event, arg) => {
  shouldShowMenu = arg;
})

function displaySegmentationStep() {
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, '../html/segmentation.html'),
    protocol: 'file:',
    slashes:true
  }));
}


function displayClusteringStep() {
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, '../html/clustering.html'),
    protocol: 'file:',
    slashes:true
  }));
}

ipcMain.on('get-audio-path', (event, arg) => {
  event.returnValue = audioPath;
})




