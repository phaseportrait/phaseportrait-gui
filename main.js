'use strict';

const electron = require('electron');
const { app, BrowserWindow, ipcMain } = electron;
const spawn = require('child_process').spawn;
const fs = require('fs');
const path = require('path');

// Keep a global reference of the mainWindowdow object to avoid garbage collector
let mainWindow = null;

function createMainWindow() {
  // Create the browser mainWindow
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: __dirname + '/icon.png',
    resizeable: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  // Load the index page
  mainWindow.loadFile('index.html');

  // Open the DevTools
  mainWindow.webContents.openDevTools();

  // Dereference the mainWindow object when the mainWindow is closed.
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

function emptySVGDir() {
  fs.readdir('svg', (err, files) => {
    if (err) throw err;

    for (const file of files) {
      fs.unlink(path.join('svg', file), err => {
        if (err) throw err;
      });
    }
  });
}

app.on('ready', () => {
  emptySVGDir();
  createMainWindow();

  ipcMain.on('request-plot', (event, plotParams) => {
    console.log(plotParams);
    plot(plotParams);
  })
});

// disable menu
app.on('browser-window-created', (e, window) => {
  window.setMenu(null);
});

app.on('activate', () => {
  if (mainWindow === null) {
    createMainWindow();
  }
});

app.on('quit', () => {
  // do some additional cleanup
});


function runPythonScript(plot = true, plotParams = []) {
  return new Promise(function (success, nosuccess) {
    const script = spawn('python', [
      './pp-launcher.py',
      plot ? '--plot' : '--code',
      JSON.stringify(plotParams)
    ]);
    script.stdout.on('data', success);
    script.stderr.on('data', nosuccess);
  });
}

function updatePlotSVG(filename) {
  mainWindow.webContents.send('load-svg', filename)
}

function plot(params) {
  runPythonScript(true, params)
    .then((data) => {
      if (!data) return;
      console.log(data.toString());
      updatePlotSVG(data.toString());
    })
    .catch((error) => {
      console.log('error', error);
    });
}

function generateCode(params) {
  runPythonScript(false, params)
    .then((data) => {
      // TODO
    })
    .catch((error) => {
      console.log('error', error);
    });
}