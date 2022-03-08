'use strict';

const electron = require('electron');
const { app, BrowserWindow, ipcMain } = electron;
// const spawn = require('child_process').spawn;
const fs = require('fs');

let {PythonShell} = require('python-shell')


// TODO: quitar?
const myConsole = new console.Console(fs.createWriteStream(`${__dirname}/log.txt`));
const python_options = fs.createReadStream(`${__dirname}/python_settings.json`)

// Keep a global reference of the mainWindowdow object to avoid garbage collector
let mainWindow = null;

function createMainWindow() {
	// Create the browser mainWindow
	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		icon: __dirname + '/phaseportrait_icon.png',
		resizeable: true,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
		}
	});

	// Load the index page
	mainWindow.loadFile('index.html');

	// Open the DevTools
	// TODO: quitar esto
	// mainWindow.webContents.openDevTools();

	// Link handler
	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		electron.shell.openExternal(url);
		return { action: 'deny' };
	});

	// Dereference the mainWindow object when the mainWindow is closed.
	mainWindow.on('closed', () => {
		mainWindow = null;
	});
};

function emptySVGDir() {
	fs.readdir(`${__dirname}/svg`, (err, files) => {
		if (err) throw err;
		for (const file of files) {
			if (file === 'default.svg') continue;
			// fs.unlinkSync(path.join('svg', file), err => {
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
		// myConsole.log(plotParams);
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


// function runPythonScript(plot = true, plotParams = []) {
// 	return new Promise(function (success, nosuccess) {
// 		const script = spawn('python', [
// 			`${__dirname}/pp-launcher.py`,
// 			plot ? '--plot' : '--code',
// 			JSON.stringify(plotParams)
// 		]);
// 		script.stdout.on('data', success);
// 		script.stderr.on('data', nosuccess);
// 	});
// }

function runPythonScript(plot = true, plotParams = []) {
	return new Promise(function (success, nosuccess) {
		let options = {
			args: [plot ? '--plot' : '--code',
				JSON.stringify(plotParams)]
		}
		PythonShell.run(`${__dirname}/phaseportrait-launcher.py`, options, function (err, results) {
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

function plot(params) {
	runPythonScript(true, params)
		.then((data) => {
			if (data==0) return;
			// myConsole.log(data);
			updatePlotSVG(data);
		})
		.catch((error) => {
			myConsole.log('error', error);
		});
}

function generateCode(params) {
	runPythonScript(false, params)
		.then((data) => {
			showPythonCode(data.join('\n'))
		})
		.catch((error) => {
			myConsole.log('error', error);
		});
}