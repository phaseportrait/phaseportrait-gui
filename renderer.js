require('codemirror/mode/python/python');
require('codemirror/addon/scroll/simplescrollbars');
const electron = require("electron");
const cm = require('codemirror');

window.onload = () => {
    var editor = cm.fromTextArea(document.getElementById('codemirror-container'), {
        mode: 'python',
        theme: 'material',
    });
}

electron.ipcRenderer.on("load-svg", (event, filename) => {
    document.getElementById("img").src = `${__dirname}/svg/${filename}`;
});

function plot() {
    const params = exampleParams;
    electron.ipcRenderer.send("request-plot", params);
}

const exampleParams = {
    dF: "def circle(x,y,*,w=0):\n\treturn -y, x*w",

    Range: {
        x_min: 0,
        x_max: 1,
        y_min: 0,
        y_max: 1,
    },

    dF_args: {
        w: 1,
    },

    dF_args_segunda_opción: {
        name: "w",
        value: 0,
    },

    MeshDim: 20,
    Density: 3,
    Polar: false,
    Title: "Never",
    xlabel: "gonna",
    ylabel: "give you up",
    color: "viridis",

    nullcline: {
        offset: 0,
        precision: 0.01,
    },
};