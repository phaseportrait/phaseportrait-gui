require('codemirror/mode/python/python');
require('codemirror/addon/scroll/simplescrollbars');
require('codemirror/addon/display/placeholder');

const electron = require("electron");
const cm = require('codemirror');

let editor;
let code_display;
const defaultFunction = 'def a(x, y, *, w=-1):\n\treturn w*y, x';

let params = {};
let prev_params = {};
let dF_args = {};
let sliders = {};
let dF_args_length = 0;

let plot_visible = true;
let alertId = 0;

window.onload = () => {
    editor = cm.fromTextArea(document.getElementById('codemirror-container'), {
        mode: 'python',
        theme: 'material',
        lineNumbers: true,
        placeholder: defaultFunction,
    });
    editor.on("drop", (editor, e) => {return false;});

    code_display = cm.fromTextArea(document.getElementById('codemirror-container-code-display'), {
        mode: 'python',
        theme: 'material',
        lineNumbers: true,
    });

    editor.on('change', e => {
        update_dF_args(e.getValue());
    });

    let parameters_div = document.getElementById('parameters_div');
    document.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        let _file = e.dataTransfer.files[0];

        if (_file.type === "application/json"){
            // loadJSON(_file.path, (data)=>{dF_args=data[0];});  
            data = require(_file.path);
            set_params(data);
            plot(data);
        };
        return false;
    });
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setLoadingState(true);
    });
    document.addEventListener('dragenter', (event) => {
        setLoadingState(true);
    });
    document.addEventListener('dragleave', (event) => {
        setLoadingState(false);
    });
}

electron.ipcRenderer.on("load-plot", (event, filename) => {
    if (!plot_visible) {
        document.getElementById("code_div").style.display = 'none';
        plot_visible = !plot_visible;
    }
    let img = document.getElementById("img")
    // document.getElementById("img").src = `${__dirname}/svg/${filename}`;
    img.src = filename;
    img.style.display = 'flex';
    setLoadingState(false);
});

electron.ipcRenderer.on("show-code", (event, code) => {
    if (plot_visible) {
        document.getElementById("img").style.display = 'none';
        plot_visible = !plot_visible;
    }
    document.getElementById("code_div").style.display = 'flex';
    code_display.setValue(code);
    setLoadingState(false);
});

electron.ipcRenderer.on("show-error", (event, message) => {
    addAlert(message);
    document.getElementById('error').style.display = 'flex';
    setLoadingState(false);
});


function add_dFarg(param_name, placeholder, min, max) {
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

    let param_slider_min = document.createElement('input');
    param_slider_min.id = `${param_name}_slider_min`;
    param_slider_min.type = "number";
    param_slider_min.placeholder = String(min);
    param_slider_min.className = "appearance-none block w-full bg-gray-200 dark:bg-[#263238] text-gray-700 " +
        "border border-gray-200 dark:border-gray-500 rounded py-3 px-4 mb-3 dark:text-gray-100 leading-tight " +
        "focus:outline-none focus:bg-white focus:border-gray-500";
    param_div.append(param_slider_min);

    let param_input = document.createElement('input');
    param_input.id = `${param_name}_value`;
    param_input.type = "number";
    param_input.value = String(placeholder);
    param_input.placeholder = String(placeholder);
    param_input.className = "appearance-none block w-full bg-gray-200 dark:bg-[#263238] text-gray-700 " +
        "border border-gray-200 dark:border-gray-500 rounded py-3 px-4 mb-3 dark:text-gray-100 leading-tight " +
        "focus:outline-none focus:bg-white focus:border-gray-500";
    param_div.append(param_input);

    let param_slider_max = document.createElement('input');
    param_slider_max.id = `${param_name}_slider_max`;
    param_slider_max.type = "number";
    param_slider_max.placeholder = String(max);
    param_slider_max.className = "appearance-none block w-full bg-gray-200 dark:bg-[#263238] text-gray-700 " +
        "border border-gray-200 dark:border-gray-500 rounded py-3 px-4 mb-3 dark:text-gray-100 leading-tight " +
        "focus:outline-none focus:bg-white focus:border-gray-500";
    param_div.append(param_slider_max);

    document.getElementById('dF_args_container').append(param_div);
}

function remove_dFarg(param_name) {
    document.getElementById(`${param_name}_div`)?.remove();
}

function update_dF_args(functionValue) {
    const dF_args_new = {};
    const sliders_new = {};
    const dF_args_regex = /(?<=\*\s*,)[^\\)]*/;

    if (!dF_args_regex.test(functionValue)) {
        Object.keys(dF_args).forEach(function (key) {
            if (!(key in dF_args_new)) {
                remove_dFarg(key);
                dF_args_length -= 1;
            }
        });
        if (dF_args_length === 0) {
            document.getElementById('dF_args_div').style.display = 'none'
        }
    
        dF_args = dF_args_new;
        sliders = sliders_new;
        return;
    }

    const dF_args_match = functionValue.match(dF_args_regex);
    if (dF_args_match) {
        const arguments = dF_args_match[0].replace(/\s+/g, '').split(',');
        arguments.forEach(parameter => {
            if (!parameter) return;
            if (parameter.match(/=/)) {
                const parameter_splited = parameter.split(/=/);
                dF_args_new[parameter_splited[0]] = Number(parameter_splited[1]);
            } else {
                dF_args_new[parameter] = 0;
            }
        });
    }
    Object.keys(dF_args_new).forEach(function (key) {
        if (key in dF_args) {
            dF_args_new[key] = Number(document.getElementById(`${key}_value`).value);
            sliders_new[key] = {};
            sliders_new[key]["min"] = document.getElementById(`${key}_slider_min`).value ? Number(document.getElementById(`${key}_slider_min`).value) : dF_args_new[key]-1;
            sliders_new[key]["max"] = document.getElementById(`${key}_slider_max`).value ? Number(document.getElementById(`${key}_slider_max`).value) : dF_args_new[key]+1;
        } else {
            add_dFarg(key, dF_args_new[key], dF_args_new[key]-1, dF_args_new[key]+1);
            dF_args_length += 1;
        }
    });
    Object.keys(dF_args).forEach(function (key) {
        if (!(key in dF_args_new)) {
            remove_dFarg(key);
            dF_args_length -= 1;
        }
    });
    if (dF_args_length === 0) {
        document.getElementById('dF_args_div').style.display = 'none'
    }

    dF_args = dF_args_new;
    sliders = sliders_new;
}

function update_params() {
    params = {};

    // dF
    params['dF'] = !!editor.getValue() ? editor.getValue() : defaultFunction;

    // if (params['dF'] === prev_params?['dF']:''){
    //     params = {};
    // }

    // dF_args_new
    update_dF_args(params['dF']);

    params['dF_args'] = dF_args;
    params['sliders'] = sliders;

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

    Polar = Boolean(document.getElementById('Polar').checked);
    if (Polar) params['Polar'] = Polar;

    xScale = document.getElementById('xScale').value;
    if (xScale) params['xScale'] = xScale;

    yScale = document.getElementById('yScale').value;
    if (yScale) params['yScale'] = yScale;

    Colorbar = Boolean(document.getElementById('Colorbar').value);
    if (Colorbar) params['Colorbar'] = Colorbar;

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

        params['nullcline'] = {
            offset,
            precision
        };
    }

    params['path'] = `${__dirname}/svg/`;

    prev_params = params;
    return params
}

function set_params(new_params) {
    // dF
    editor.setValue(new_params['dF']);

    // Range
    document.getElementById('x_min').value = new_params["Range"]["x_min"];
    document.getElementById('x_max').value = new_params["Range"]["x_max"];
    document.getElementById('y_min').value = new_params["Range"]["y_min"];
    document.getElementById('y_max').value = new_params["Range"]["y_max"];

    // Optionals
    if (!(new_params['MeshDim'] === undefined))
        document.getElementById('MeshDim').value = new_params['MeshDim'];

    if (!(new_params['Density'] === undefined))
        document.getElementById('Density').value = new_params['Density'];

    if (!(new_params['Polar'] === undefined))
        document.getElementById('Polar').checked = Boolean(new_params['Polar']);

    if (!(new_params['xScale'] === undefined))
        document.getElementById('xScale').value = new_params['xScale'];

    if (!(new_params['yScale'] === undefined))
        document.getElementById('yScale').value = new_params['yScale'];

    if (!(new_params['Colorbar'] === undefined))
        document.getElementById('Colorbar').checked = Boolean(new_params['Colorbar']);

    if (!(new_params['Title'] === undefined))
        document.getElementById('Title').value = new_params['Title'];

    if (!(new_params['xlabel'] === undefined))
        document.getElementById('xlabel').value = new_params['xlabel'];

    if (!(new_params['ylabel'] === undefined))
        document.getElementById('ylabel').value = new_params['ylabel'];

    if (!(new_params['color'] === undefined))
        document.getElementById('color').value = new_params['color'];

    // Nullclines
    if (new_params['nullcline']){
        document.getElementById('offset').value = Number(new_params['nullcline']['offset']);
        document.getElementById('precision').value = Number(new_params['nullcline']['precision']);
    }

    prev_params = new_params;
    return new_params
}

function plot(_params=false) {
    exit_code_display()
    params = (!_params)? update_params(): _params;

    setLoadingState(true);
    electron.ipcRenderer.send("request-plot", params);
}


function get_python_code() {
    params = update_params();
    setLoadingState(true);
    electron.ipcRenderer.send("request-code", params);
}

function setLoadingState(isLoading) {
    if (isLoading) {
        document.getElementById('img').style.display = 'none';
        document.getElementById('code_div').style.display = 'none';
        document.getElementById('error').style.display = 'none';
    }
    else{
        
        if (plot_visible) {
            document.getElementById('img').style.display = 'flex';
        }
        else{
            document.getElementById('code_div').style.display = 'flex';
        }
    }
    document.getElementById('loader').style.display = isLoading ? 'flex' : 'none';
}

function toggleDarkMode() {
    const root = document.getElementsByTagName('html')[0];
    if (root.classList.contains('dark')) root.classList.remove('dark')
    else root.classList.add('dark')
}

function toggleFullScreenMode() {
    const imageArea = document.getElementById('image-area');
    const formArea = document.getElementById('parameters_div');
    const creditsArea = document.getElementById('credits-area');
    const resultCode = document.getElementById('result-code');

    if (imageArea.classList.contains('image-area--zoom')) {
        imageArea.classList.remove('image-area--zoom');
        formArea.style.display = 'flex';
        creditsArea.style.display = 'flex';
        resultCode.classList.remove('code-display--full-screen');
    } else {
        imageArea.classList.add('image-area--zoom');
        formArea.style.display = 'none';
        creditsArea.style.display = 'none';
        resultCode.classList.add('code-display--full-screen');
    }
}

function exit_code_display() {
    if (!plot_visible) {
        document.getElementById("img").style.display = null;
        document.getElementById("code_div").style.display = 'none';
        plot_visible = !plot_visible;
    }
}

function addAlert(message) {
    const alerts = document.getElementById('alerts');
    const alertsContainer = document.getElementById('alerts-container');
    const newAlertId = alertId++;

    const newAlert = `
    <div id="alert-${newAlertId}" class="
        flex bg-red-100 text-red-700 px-4 py-3 relative
        dark:bg-red-300 dark:text-red-900 rounded-md
    ">
        <span class="block flex-1 sm:inline pr-1">${message}</span>
        <span onclick="removeAlert('alert-${newAlertId}')" class="cursor-pointer">
            <svg class="fill-current h-6 w-6 text-red-500 hover:text-red-700 dark:text-red-600 dark:hover:text-red-900"
                viewBox="0 0 20 20"><title>Close</title><path
                d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1
                1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1
                1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
        </span>
    </div>`;

    alerts.innerHTML = newAlert + alerts.innerHTML;
    alertsContainer.style.display = 'flex';
}

function removeAlert(id) {
    const alerts = document.getElementById('alerts');
    const alertsContainer = document.getElementById('alerts-container');

    document.getElementById(id).remove();
    if (!alerts.innerHTML.trim()) {
        alertsContainer.style.display = 'none';
    }
}

function removeAllAlerts() {
    const alerts = document.getElementById('alerts');
    const alertsContainer = document.getElementById('alerts-container');

    alertsContainer.style.display = 'none';
    alerts.innerHTML = '';
}
