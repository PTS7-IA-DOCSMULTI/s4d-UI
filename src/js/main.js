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

var settings;

const {app, BrowserWindow, Menu, ipcMain} = electron;

let mainWindow;

// Listen for app to be ready
app.on('ready', function(){
  // Create new window
  mainWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: true
    }
  });
  mainWindow.maximize();
  mainWindow.show();
  // Load html in window
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, '../html/index.html'),
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
});


// Create menu template
const mainMenuTemplate =  [
  // Each object is a dropdown
  {
    label: 'File',
    submenu: [
    {
      label: 'Open',
      accelerator:process.platform == 'darwin' ? 'Command+O' : 'Ctrl+O',
      click(item, focusedWindow) {
        showOpen();
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

var showOpen = function() {
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

