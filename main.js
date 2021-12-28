"use strict";

const electron = require("electron");
const { app, BrowserWindow } = electron;
const spawn = require("child_process").spawn;

// Keep a global reference of the mainWindowdow object to avoid garbage collector
let mainWindow = null;

let runPythonScript = new Promise(function (success, nosuccess) {
  const script = spawn('python', ['./test.py']);

  script.stdout.on('data', (data) => {
    success(data);
  });
  script.stderr.on('data', (data) => {
    nosuccess(data);
  });
});


const createMainWindow = () => {
  // Create the browser mainWindow
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: __dirname + "/icon.png",
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
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
};

app.on("ready", () => {
  createMainWindow();
  setTimeout(plot, 2000);
});

// disable menu
app.on("browser-window-created", (e, window) => {
  window.setMenu(null);
});

app.on("activate", () => {
  if (mainWindow === null) {
    createMainWindow();
  }
});

app.on("quit", () => {
  // do some additional cleanup
});

function updatePlotSVG(filename) {
  mainWindow.webContents.send('load-svg', filename)
}

function plot() {
  runPythonScript
    .then((data) => {
      console.log(data.toString());
      if (data !== null) updatePlotSVG(data.toString());
    })
    .catch((error) => {
      console.log('error', error);
    });
}