'use strict';

const { spawn } = require('child_process');
const electron = require('electron');
const {app, BrowserWindow, ipcMain} = electron;
const fs = require('fs');
const { exit } = require('process');
const WebSocket = require('ws');

const DEBUG = false;
const DEBUG_RENDER = false;

let settings = require(`${__dirname}/settings.json`)


// Keep a global reference of the mainWindowdow object to avoid garbage collector
let mainWindow = null;
let python_server_process = null;
let phaseportrait_socket = null; 
// let mpl_websocket = null;
let FigId = null;
let ws_uri = "ws://127.0.0.1:8080/";

function createMainWindow() {
    console.log(settings);

    // Create the browser mainWindow
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: __dirname + '/icons/phaseportrait_icon.ico',
        resizeable: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        slashes: true
    });

    // Load the index page
    mainWindow.loadFile('index.html');

    if (DEBUG||DEBUG_RENDER)
        mainWindow.openDevTools();

    // Link handler
    mainWindow.webContents.setWindowOpenHandler(({url}) => {
        electron.shell.openExternal(url);
        return {action: 'deny'};
    });

    // Dereference the mainWindow object when the mainWindow is closed.
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
};

function launchPython() {
    
    if (!DEBUG) {
        console.log("Python launched on:" + settings["python"]);
        python_server_process = spawn(settings["python"],[`${__dirname}/phaseportrait-launcher.py`, `&>${__dirname}/python_log.log`])
        python_server_process.stdout.on('data', (data) => {
            if (DEBUG || DEBUG_RENDER)  console.log(String(data));
            FigId = String(data).split(',')[1];
            setupMPLWebSocket();

            if (phaseportrait_socket === null){
                setupPPWebSocket();
            };
            
            updatePlot();
        });
        python_server_process.on('error', (err) => {
            console.error('Failed to start subprocess.');
          });
    }
}


app.on('ready', () => {
    // emptySVGDir();
    createMainWindow();

    if (!DEBUG){
        launchPython();
    }
    else{
        setupPPWebSocket();
        setupMPLWebSocket();
        updatePlot();
    }

    ipcMain.on('request-plot', (event, plotParams) => {
        plot(plotParams);
    })
    ipcMain.on('request-code', (event, plotParams) => {
        generateCode(plotParams);
    })
    ipcMain.on('save-configuration', (event, settings) => {
        fs.writeFileSync("settings.json", JSON.stringify(settings), 'utf-8')
    })
    ipcMain.on('request-configuration', (e) => {
        fs.readFile("settings.json", (err, data) => {
            let settings = JSON.parse(data);
            if (DEBUG || DEBUG_RENDER)  console.log(settings);
            mainWindow.webContents.send('load-configuration', settings);
        });
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

app.on('window-all-closed', () => {
    // For MacOs
    if (process.platform !== 'darwin') {
      app.quit()
    }
});

function updatePlot() {
    mainWindow.webContents.send('load-plot', FigId);
};

function get_websocket_type() {
    if (typeof WebSocket !== 'undefined') {
        return WebSocket;
    } else if (typeof MozWebSocket !== 'undefined') {
        return MozWebSocket;
    } else {
        alert(
            'Your browser does not have WebSocket support. ' +
                'Please try Chrome, Safari or Firefox ≥ 6. ' +
                'Firefox 4 and 5 are also supported but you ' +
                'have to enable WebSockets in about:config.'
        );
    }
};

function setupMPLWebSocket() {
    let mpl_websocket_type = get_websocket_type();
    // mpl_websocket = new mpl_websocket_type(`${ws_uri}ws`);
};

function setupPPWebSocket(){
    let web_socket_type = get_websocket_type();
    phaseportrait_socket = new web_socket_type(`${ws_uri}pp`);
    // phaseportrait_socket.onerror = ...;
    // phaseportrait_socket.onopen = ...;
    // phaseportrait_socket.onmessage = ...;
    phaseportrait_socket.onclose = function(){
        setTimeout(setupPPWebSocket, 2000);
        
    };
    phaseportrait_socket.on("error", (err) => {
        // logger.log('error', error);
        launchPython();
        showError(err);
    });
};

function showPythonCode(message) {
    mainWindow.webContents.send('show-code', message);
};

function showError(message) {
    mainWindow.webContents.send('show-error', message);
};

function sendParamsToPython(plot = true, plotParams = []) {
    plotParams["phaseportrait_request"] = plot ? '--plot' : '--code';
    phaseportrait_socket.send(JSON.stringify(plotParams))
};

function plot(plotParams) {
    phaseportrait_socket.removeAllListeners("message");
    phaseportrait_socket.on("message", (data) => {
        if (DEBUG || DEBUG_RENDER) console.log(String(data));
        updatePlot(data.toString());
    });
    sendParamsToPython(true, plotParams);
};

function generateCode(codeParams) {
    phaseportrait_socket.removeAllListeners("message");
    phaseportrait_socket.on("message", (data) => {
        showPythonCode(data.toString());
    });
    sendParamsToPython(false, codeParams);
};