var electron = require('electron')

electron.ipcRenderer.on('load-svg', (event, filename) => {
    document.getElementById('img').src = `${__dirname}/svg/${filename}`
});

function plot() {
    const params = [];
    electron.ipcRenderer.send('request-plot', params);
}