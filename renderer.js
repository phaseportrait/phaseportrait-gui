var electron = require('electron')

electron.ipcRenderer.on('load-svg', (event, filename) => {
    document.getElementById('img').src = `${__dirname}/svg/${filename}`
});