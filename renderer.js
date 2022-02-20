require('codemirror/mode/python/python');
require('codemirror/addon/scroll/simplescrollbars');
require('codemirror/addon/display/placeholder');
const electron = require("electron");
const cm = require('codemirror');

let editor;
const defaultFunction = 'def a(x, y, *, w=0):\n\treturn x, -y';

window.onload = () => {
    editor = cm.fromTextArea(document.getElementById('codemirror-container'), {
        mode: 'python',
        theme: 'material',
        lineNumbers: true,
        placeholder: defaultFunction,
    });
}

electron.ipcRenderer.on("load-svg", (event, filename) => {
    document.getElementById("img").src = `${__dirname}/svg/${filename}`;
});

function plot() {
    params = {};

    // dF
    dF = editor.getValue();
    params['dF'] = dF ?? defaultFunction;

    // Range
    x_min = document.getElementById('x_min').value? Number(document.getElementById('x_min').value) : 0;
    x_max = document.getElementById('x_max').value? Number(document.getElementById('x_max').value) : 1;
    y_min = document.getElementById('y_min').value? Number(document.getElementById('y_min').value) : 0;
    y_max = document.getElementById('y_max').value? Number(document.getElementById('y_max').value) : 1;
    params['Range'] = {
        x_min,
        x_max,
        y_min,
        y_max
    };

    // Optionals
    MeshDim = Number(document.getElementById('MeshDim').value);
    if (MeshDim) params['MeshDim'] = MeshDim;

    Density = Number(document.getElementById('Density').value);
    if (Density) params['Density'] = Density;

    // Polar = Boolean(document.getElementById('Polar').value)
    // if (Polar) params['Polar'] = Polar

    Title = document.getElementById('Title').value;
    if (Title) params['Title'] = Title;

    xlabel = document.getElementById('xlabel').value;
    if (xlabel) params['xlabel'] = xlabel;

    ylabel = document.getElementById('ylabel').value;
    if (ylabel) params['ylabel'] = ylabel;

    color = document.getElementById('color').value;
    if (color) params['color'] = color;

    // Nullclines
    offset = Number(document.getElementById('offset').value);
    precision = Number(document.getElementById('precision').value);
    if (document.getElementById('offset').value && document.getElementById('precision').value){
        params['nullcline'] = {
            offset,
            precision
        };
    }

    // console.log(params);

    electron.ipcRenderer.send("request-plot", params);
}
