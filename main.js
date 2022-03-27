'use strict';

const electron = require('electron');
const {app, BrowserWindow, ipcMain} = electron;
const fs = require('fs');

let {PythonShell} = require('python-shell')

const logger = new console.Console(fs.createWriteStream(`${__dirname}/log.txt`));
const python_options = fs.createReadStream(`${__dirname}/python_settings.json`)

// Keep a global reference of the mainWindowdow object to avoid garbage collector
let mainWindow = null;

function createMainWindow() {
    // Create the browser mainWindow
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: __dirname + '/icons/phaseportrait_icon.ico',
        resizeable: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    });

    // Load the index page
    mainWindow.loadFile('index.html');

    // mainWindow.openDevTools()

    // Link handler
    mainWindow.webContents.setWindowOpenHandler(({url}) => {
        electron.shell.openExternal(url);
        return {action: 'deny'};
    });

    // Dereference the mainWindow object when the mainWindow is closed.
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function emptySVGDir() {
    fs.readdir(`${__dirname}/svg`, (err, files) => {
        if (err) throw err;
        for (const file of files) {
            if (file === 'default.svg') continue;
            fs.unlinkSync(`${__dirname}/svg/${file}`, err => {
                if (err) throw err;
            });
        }
    });
}

app.on('ready', () => {
    emptySVGDir();
    createMainWindow();

    ipcMain.on('request-plot', (event, plotParams) => {
        plot(plotParams);
    })
    ipcMain.on('request-code', (event, plotParams) => {
        generateCode(plotParams);
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
        let options = {
            args: [plot ? '--plot' : '--code',
                JSON.stringify(plotParams)]
        }
        PythonShell.run(`${__dirname}/phaseportrait-launcher.py`, options, (err, results) => {
            if (err) nosuccess(err);
            success(results)
        });
    });
}


function updatePlotSVG(filename) {
    mainWindow.webContents.send('load-svg', filename)
}

function showPythonCode(filename) {
    mainWindow.webContents.send('show-code', filename)
}

function showError(message) {
    mainWindow.webContents.send('show-error', message)
}

function plot(params) {
    runPythonScript(true, params)
        .then((data) => {
            if (data == 0) {
                throw Error('Error: Invalid function');
            }
            updatePlotSVG(data);
        })
        .catch((error) => {
            logger.log('error', error);
            showError(error);
        });
}

function generateCode(params) {
    runPythonScript(false, params)
        .then((data) => {
            showPythonCode(data.join('\n'))
        })
        .catch((error) => {
            logger.log('error', error);
            showError(error);
        });
}
