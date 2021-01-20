const electron = require('electron');
const path = require('path');
const url = require('url');
const net = require('net');
const { dialog } = require('electron')

var client;
var selectionMethod = 'longest';

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
    pathname: path.join(__dirname, 'index.html'),
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
    submenu: [
    {
      label: 'Selection Method',
      click(item, focusedWindow) {
        changeMode();
      }
    }
    ]
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
      mainWindow.webContents.send( 'openFile', result.filePaths[0] );
    }
  }).catch(err => {
    console.log(err)
  })
};

var changeMode = function() {
  let changeModeWindow;
  changeModeWindow = new BrowserWindow({
    parent: mainWindow,
    modal: true,
    width: 300,
    height: 400,
    show: false,
    center: true,
    titre: 'Change Option Mode',
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true
    }
  });
  changeModeWindow.show();
  // Load html in window
  changeModeWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'changeSelectionMethod.html'),
    protocol: 'file:',
    slashes:true
  }));
  
  changeModeWindow.on('closed', function(){
    changeModeWindow = null;
  });

  changeModeWindow.setMenu(null);

  ipcMain.on('requestSelectionMethod', function(event) {
    event.returnValue = selectionMethod;
  })

  ipcMain.on('selectionMethodChanged', function(event, args) {
    selectionMethod = args;
  })
}

