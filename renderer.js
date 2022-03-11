require('codemirror/mode/python/python');
require('codemirror/addon/scroll/simplescrollbars');
require('codemirror/addon/display/placeholder');
const electron = require("electron");
const cm = require('codemirror');

let editor;
let code_display;
const defaultFunction = 'def a(x, y, *, w=0):\n\treturn y, -x';

let dF_args_length = 0;
let dF_args = {};
let plot_visible = true;

window.onload = () => {
    editor = cm.fromTextArea(document.getElementById('codemirror-container'), {
        mode: 'python',
        theme: 'material',
        lineNumbers: true,
        placeholder: defaultFunction,
    });
    code_display = cm.fromTextArea(document.getElementById('codemirror-container-code-display'), {
        mode: 'python',
        theme: 'material',
        lineNumbers: true,
    });
}

electron.ipcRenderer.on("load-svg", (event, filename) => {
    // console.log(`${filename}`);
    if (!plot_visible) {
        document.getElementById("img").style.display = null;
        document.getElementById("code_div").style.display = 'none';
        plot_visible = !plot_visible;
    }
    document.getElementById("img").src = `${__dirname}/svg/${filename}`;
});

electron.ipcRenderer.on("show-code", (event, code) => {
    if (plot_visible) {
        document.getElementById("img").style.display = 'none';
        document.getElementById("code_div").style.display = null;
        plot_visible = !plot_visible;
    }
    code_display.setValue(code);
});


function add_dFarg(param_name, placeholder) {
    if (dF_args_length == 0) {
        document.getElementById('dF_args_div').style.display = null;
    }
    let param_div = document.createElement('div');
    param_div.id = `${param_name}_div`
    param_div.className = "container w-full flex gap-2 items-center";

    let param_div_name = document.createElement('div');
    param_div_name.className = "block uppercase tracking-wide text-gray-700 dark:text-gray-50 text-xs font-bold mb-1";
    param_div_name.innerHTML = param_name;
    param_div.append(param_div_name);

    let param_input = document.createElement('input');
    param_input.id = `${param_name}_value`;
    param_input.type = "number";
    param_input.value = String(placeholder);
    param_input.className = "appearance-none block w-full bg-gray-200 dark:bg-[#263238] text-gray-700 border border-gray-200 dark:border-gray-500 rounded py-3 px-4 mb-3 dark:text-gray-100 leading-tight focus:outline-none focus:bg-white focus:border-gray-500";
    param_div.append(param_input);

    document.getElementById('dF_args_containter').append(param_div)
}

function remove_dFarg(param_name) {
    document.getElementById(`${param_name}_div`)?.remove();
}

function update_dF_args() {
    dF_args_new = {};
    dF_args_regex = /(?<=\*\s*\,)[\sa-zA-Z0-9_=.,]*/;
    dF_args_match = params['dF'].match(dF_args_regex);
    if (dF_args_match) {
        dF_args_match[0] = dF_args_match[0].replace(/\s+/g, '');
        dF_args_match[0].split(',').forEach(parameter => {
            if (parameter.match(/=/)) {
                parameter_splited = parameter.split(/=/)
                dF_args_new[parameter_splited[0]] = Number(parameter_splited[1])
            } else {
                dF_args_new[parameter] = 0
            }
        });
    }
    Object.keys(dF_args_new).forEach(function (key) {
        if (key in dF_args) {
            dF_args_new[key] = Number(document.getElementById(`${key}_value`).value)
        } else {
            add_dFarg(key, dF_args[key]);
            dF_args_length += 1;
        }
    });
    Object.keys(dF_args).forEach(function (key) {
        if (!(key in dF_args_new)) {
            remove_dFarg(key);
            dF_args_length -= 1;
        }
    });
    if (dF_args_length == 0) {
        document.getElementById('dF_args_div').style.display = 'none'
    }

    dF_args = dF_args_new;

}

function update_params() {
    params = {};

    // dF
    dF = editor.getValue();
    params['dF'] = dF === '' ? defaultFunction : dF;

    // dF_args_new
    update_dF_args()
    params['dF_args'] = dF_args

    // Range
    x_min = document.getElementById('x_min').value ? Number(document.getElementById('x_min').value) : 0;
    x_max = document.getElementById('x_max').value ? Number(document.getElementById('x_max').value) : 1;
    y_min = document.getElementById('y_min').value ? Number(document.getElementById('y_min').value) : 0;
    y_max = document.getElementById('y_max').value ? Number(document.getElementById('y_max').value) : 1;
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

    Polar = Boolean(document.getElementById('Polar').checked)
    if (Polar) params['Polar'] = Polar

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
    if (document.getElementById('precision').value) {
        if (!offset) offset = 0;
        document.getElementById('offset').value
        params['nullcline'] = {
            offset,
            precision
        };
    }

    params['path'] = `${__dirname}/svg/`

    return params
}

function plot() {
    exit_code_display()
    params = update_params();
    electron.ipcRenderer.send("request-plot", params);
}

function get_python_code() {
    params = update_params();
    electron.ipcRenderer.send("request-code", params);
}

function toggleDarkMode() {
    const root = document.getElementsByTagName( 'html' )[0];
    if (root.classList.contains('dark')) root.classList.remove('dark')
    else root.classList.add('dark')
}

function toggleImageZoom() {
    const imageArea = document.getElementById('image-area');
    const formArea = document.getElementById('parameters_div');
    const creditsArea = document.getElementById('credits-area');

    if (imageArea.classList.contains('image-area--zoom')) {
        imageArea.classList.remove('image-area--zoom');
        formArea.style.display = 'flex';
        creditsArea.style.display = 'block';
    } else {
        imageArea.classList.add('image-area--zoom');
        formArea.style.display = 'none';
        creditsArea.style.display = 'none';
    }
}

function exit_code_display() {
    if (!plot_visible) {
        document.getElementById("img").style.display = null;
        document.getElementById("code_div").style.display = 'none';
        plot_visible = !plot_visible;
    }
}
