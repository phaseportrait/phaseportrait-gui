'use strict';

const { spawn } = require('child_process');
const electron = require('electron');
const {app, BrowserWindow, ipcMain} = electron;
const fs = require('fs');

const WebSocket = require('ws');

let {PythonShell} = require('python-shell')

const logger = new console.Console(fs.createWriteStream(`${__dirname}/log.txt`));
const python_options = fs.createReadStream(`${__dirname}/python_settings.json`)

// Keep a global reference of the mainWindowdow object to avoid garbage collector
let mainWindow = null;
let python_server_process = null;
let phaseportrait_socket = null; 

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
        },
        // TODO: no tengo ni idea de qué es esto
        slashes: true
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

    python_server_process = spawn('python',[`${__dirname}/phaseportrait-launcher.py`])
    python_server_process.stdout.on('data', (data) => {
        console.log(String(data));
        if (phaseportrait_socket === null){
            setupPPWebSocket()
        };
        
    });
    // setupPPWebSocket()
    
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

app.on('window-all-closed', () => {
    // For MacOs
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })



// TODO: cambio provisional para hacer una primera prueba
function updatePlot() {
    // mainWindow.webContents.send('load-plot', filename)
    mainWindow.webContents.send('load-plot', "http://127.0.0.1:8080/")
    
}

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

function setupPPWebSocket(){
    let web_socket_type = get_websocket_type();
    phaseportrait_socket = new web_socket_type('ws://127.0.0.1:8080/pp');
    // phaseportrait_socket.onerror = ...;
    // phaseportrait_socket.onopen = ...;
    // phaseportrait_socket.onmessage = ...;
    phaseportrait_socket.onclose = function(){
        setTimeout(setupPPWebSocket, 1000);
    };
}

function showPythonCode(message) {
    mainWindow.webContents.send('show-code', message)
}

function showError(message) {
    mainWindow.webContents.send('show-error', message)
}

function plot(params) {
    // TODO: hacer que envíe info al servidor de python con lo que se quiere plotear

    params["phaseportrait_request"] = '--plot'

    phaseportrait_socket.send(JSON.stringify(params))
        // .then((data) => {
            
        //     if (data == 0) {
        //         throw Error('Error: Invalid function');
        //     }
            
        // })
        // .catch((error) => {
        //     logger.log('error', error);
        //     showError(error);
        // });
    updatePlot();
}

function generateCode(params) {
    params["phaseportrait_request"] = '--code'

    phaseportrait_socket.on('message', (event, data) => {
        // TODO: arreglar
        showPythonCode(String(data).join('\n'));
    });

    phaseportrait_socket.send(JSON.stringify(params))
        // .then((data) => {
        //     showPythonCode(data.join('\n'))
        // })
        // .catch((error) => {
        //     logger.log('error', error);
        //     showError(error);
        // }); 
}