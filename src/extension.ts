'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as cp from 'child_process';
var opn = require('opn');
import { StringDecoder } from 'string_decoder';
import { Readable } from "stream";

var fs = require('fs');
var path = require('path');


var g_installedImages = {};
var g_availableImages = {};
var g_internalHtml = "";
var g_containers = {};
var g_StatusBarItems = {};
var g_StoragePath = '';

var copyPaste = require('copy-paste');

var out: vscode.OutputChannel = vscode.window.createOutputChannel("DockerRunner");

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    g_StoragePath = context.storagePath;

    loadInstalledImages();

    console.log('Congratulations, your extension "vsc-docker" is now active!');

    registerCommand(context, 'extension.init', () => {
    });

    registerCommand(context, 'extension.openMainMenu', () => {
        var items:string[] = [];
 
        for (var item in g_installedImages) {
            items.push(g_installedImages[item].description + ' [' +  item + ']')
        }

        items.push("Install Image");
        items.push("Remove Image");

        vscode.window.showQuickPick(items).then( selected => {
            if (selected == "Install Image") {

                vscode.window.showInputBox( { prompt: "Search string", value: 'xvsc'} ).then( (filter) => {
                    var items:string[] = [];

                    searchImages(filter, function (images: any[]) {
                        for (var item in images) {
                            items.push(images[item] + ' [' +  item + ']');
                        }

                        if (items.length == 0) {
                            vscode.window.showInformationMessage('Not found!');
                        } else {
                            vscode.window.showQuickPick(items).then( selected => {
                                if (selected) {
                                    g_installedImages[selected.split('[')[1].split(']')[0]] = { description: selected.split('[')[0].trim() };
                                    saveInstalledImages();

                                    installImage(selected.split('[')[1].split(']')[0], selected.split('[')[0].trim());
                                }
                            });
                        }
                    })
                } )

            } else if (selected == "Remove Image") {
                var items:string[] = [];

                for (var item in g_installedImages) {
                    items.push(item);
                }

                if (items.length == 0) {
                    vscode.window.showInformationMessage('Not found!');
                } else {
                    vscode.window.showQuickPick(items).then( selected => {
                        if (selected) {
                            removeImage(selected);
                        }
                    });
                }
            } else {
                var name: string = selected.split('[')[1].split(']')[0];
                startContainer(name, function() {
                    executeCommand([ 'docker:menu' ], name);
                });
            }
        })
    });

    checkDockerInstall().then(installed => {
        if (installed) {
            //queryInstalledImages();
            //queryCompatibleImages();
        } else {
            vscode.window.showInformationMessage('Docker is not installed!!');
        }

    });


    var item = vscode.window.createStatusBarItem();

    item.text = "Docker Runner";
    item.command = "extension.openMainMenu";
    item.show();

    var BrowserContentProvider = (function () {
        function BrowserContentProvider() {
        }
        BrowserContentProvider.prototype.provideTextDocumentContent = function (uri, token) {
            // TODO: detect failure to load page (e.g. google.com) and display error to user.
            if (uri != 'http://internal') {
                return "<iframe src=\"" + uri + "\" frameBorder=\"0\" width=\"1024\" height=\"1024\"/>";
            } else {
                return g_internalHtml;
            }
        };
        return BrowserContentProvider;
    }());

    var provider = new BrowserContentProvider();
    // Handle http:// and https://.
    var registrationHTTPS = vscode.workspace.registerTextDocumentContentProvider('https', provider);
    var registrationHTTP = vscode.workspace.registerTextDocumentContentProvider('http', provider);

    // show output channel
    out.show();
}

// this method is called when your extension is deactivated
export function deactivate() {
}

function registerCommand(context: vscode.ExtensionContext, name, func) {
    let disposable = vscode.commands.registerCommand(name, func);
    context.subscriptions.push(disposable);    
}

function checkDockerInstall(): Promise<boolean> {
    return new Promise(resolve => {
        cp.exec('docker --help', err => {
            resolve(!err);
        });
    });
}

function installImage(id: string, description: string) {
    const child = cp.spawn('docker', ['pull', id]);
    const stdout = collectData(child.stdout, 'utf8', '');
    const stderr = collectData(child.stderr, 'utf8', '');
    child.on('error', err => {
        vscode.window.showErrorMessage('Failed to install image!');
    });

    child.on('close', code => {
        if (code) {
            vscode.window.showErrorMessage('Failed to install image!');
        } else {

            vscode.window.showInformationMessage('Image installed successfully!');
        }
    });
}

function removeImage(id: string) {
    const child = cp.spawn('docker', ['rmi', '-f', id]);
    const stdout = collectData(child.stdout, 'utf8', '');
    const stderr = collectData(child.stderr, 'utf8', '');
    child.on('error', err => {
        vscode.window.showErrorMessage('Failed to remove image!');
    });

    child.on('close', code => {
        if (code) {
            vscode.window.showErrorMessage('Failed to remove image!');
        } else {

            vscode.window.showInformationMessage('Image removed successfully!');

            delete g_installedImages['id'];
            saveInstalledImages();
        }
    });
}

function searchImages(filter: string, cb) {
    var available = {};
    const child = cp.spawn('docker', ['search', filter]);
    const stdout = collectData(child.stdout, 'utf8', '');
    const stderr = collectData(child.stderr, 'utf8', '');
    
    child.on('error', err => {
        available = {};
    });

    child.on('close', code => {
        if (code) {
            available = {};
            cb(available);
        } else {

            available = {};
            var lines: string[] = stdout.join('').split(/\r?\n/);
            var descriptionPos = 0;
            var starsPos = 0;
            for (var element of lines) {
                if (element.startsWith("NAME")) {
                    descriptionPos = element.indexOf("DESCRIPTION");
                    starsPos = element.indexOf("STARS");
                }
                else if (element.length != 0) {
                    
                    var name: string = element.substring(0, descriptionPos).trim();
                    var description: string = element.substring(descriptionPos, starsPos).trim();
                    available[name] = description;                    
                }
            }

            cb(available);
        }
    });
}

function queryInstalledImages() {

    // synchronisation should be handled in a better way
    removeStoppedContainers();

    const child = cp.spawn('docker', ['images']);
    const stdout = collectData(child.stdout, 'utf8', '');
    const stderr = collectData(child.stderr, 'utf8', '');
    child.on('error', err => {
        g_installedImages = {};
    });

    child.on('close', code => {
        if (code) {
            g_installedImages = {};
        } else {

            g_installedImages = {};
            var lines: string[] = stdout.join('').split(/\r?\n/);
            for (var element of lines) {
                if ((element.indexOf("xvsc") >= 0) && (element.indexOf(" latest ") >= 0)) {
                    var i: string = element.split(" ")[0];

                    g_installedImages[i] = true;                    
                }
            }
        }
    });
}

function removeStoppedContainers() {
    const child = cp.spawn('docker', ['ps', '-a']);
    const stdout = collectData(child.stdout, 'utf8', '');
    const stderr = collectData(child.stderr, 'utf8', '');
    child.on('error', err => {
    });

    child.on('close', code => {
        if (code) {
        } else {
            var lines: string[] = stdout.join('').split(/\r?\n/);
            for (var element of lines) {
                if ((element.indexOf("Exited") >= 0) || (element.indexOf("Created") >= 0)) {
                    var split: string[] = element.split(" ");
                    var name = split[split.length - 1];

                    const child = cp.spawn('docker', ['rm', name]);
                }
            }
       }
    });
}

function collectData(stream: Readable, encoding: string, container: string): string[] {
    const data: string[] = [];
    const decoder = new StringDecoder(encoding);

    stream.on('data', (buffer: Buffer) => {
        var decoded: string = decoder.write(buffer);
        data.push(decoded);
        out.append(decoded);

        // just make a single string...
        data[0] = data.join('');
        data.splice(1);

        while (true) {
            var cmdIdxStart: number = data[0].indexOf('>>>CMD>>>');

            if (cmdIdxStart > 0) {
                cmdIdxStart += 9;
                var cmdIdxEnd: number = data[0].indexOf('<<<CMD<<<', cmdIdxStart);

                if (cmdIdxEnd > 0) {

                    executeCommand(data[0].substring(cmdIdxStart, cmdIdxEnd), container);
                    data[0] = data[0].substr(cmdIdxEnd + 9);
                } else {
                    break;
                }
            } else {
                break;
            }
        }
    });
    return data;
}

function executeCommand(json: any, container: string) {
    try {
        var params = (typeof json == 'string') ? JSON.parse(json) : json;
        var cmd = params[0];
        var cmdPrefix: string = cmd.split(':')[0];
        var cmdPostfix: string = cmd.split(':')[1];

        if (cmdPrefix == 'ide') {
            params.splice(0, 1);
            switch (cmdPostfix) {
                case 'info':
                    vscode.window.showInformationMessage(params[0]);
                    break;
                case 'error':
                    vscode.window.showErrorMessage(params[0]);
                    break;
                case 'input':
                    vscode.window.showInputBox({ prompt: params[0].label}).then( (text) => {
                        var command: any[] = params[0].command;
                        command.push(text);
                        executeCommand(command, container) 
                    })
                    break;
                case 'menu':
                    vscode.window.showQuickPick(params[0].items).then( (selected) => {
                        if (selected)
                        {
                            var index: number = params[0].items.indexOf(selected);
                            executeCommand(params[0].commands[index], container) 
                        }
                    })
                    break;
                case 'clipboard':
                    copyPaste.copy(params[0]);
                    break;
                case 'openurl':
                    opn(params[0]);    
                    break;
                case 'html':
                    g_internalHtml = params[0]; 
                    vscode.commands.executeCommand('vscode.previewHtml', 'http://internal'); 
                    break;
                case 'status':
                    var name: string = params[0].name;
                    var command: string = params[0].command;

                    if (!g_StatusBarItems.hasOwnProperty('name')) {
                        g_StatusBarItems['name'] = vscode.window.createStatusBarItem();
                        g_StatusBarItems['name'].show();
                    }

                    if (params[0].hasOwnProperty('text')) {
                        g_StatusBarItems['name'].text = params[0].text;
                    }

                    if (params[0].hasOwnProperty('command')) {
                        g_StatusBarItems['name'].command = params[0].command;
                    }
                    break;
            }
        } else if (cmdPrefix == 'docker') {
            g_containers[container].stdin.write('\r\n>>>CMD>>>\r\n' + JSON.stringify(params) + '\r\n<<<CMD<<<\r\n');
        }

        vscode.commands.executeCommand(cmd, params);
    } catch (e) {
        console.log("Parsing JSON failed:");
        console.log(json);
    }
}



function startContainer(name: string, cb) {

    if (g_containers.hasOwnProperty(name)) {
        cb();
        return;
    }

    const child = cp.spawn('docker', ['rm', '-f', name.split('/')[1]]);
    child.on('close', code => {

        const child = cp.spawn('docker', ['run', name, 'config']);
        const config = collectData(child.stdout, 'utf8', '');

        child.on('close', code => {
            var src = '/src';

            // check if we are mapping something here

            try {
                var cfg = JSON.parse(config.join());
                
                if (cfg.hasOwnProperty('src')) {
                    src = cfg['src'];
                }
                
            } catch (e) {}

            // XXX - must get current local directory
            const child = cp.spawn('docker', ['run', "--name", name.split('/')[1], "-i", '-v', vscode.workspace.rootPath + ':' + src, name, 'vscode']);
            g_containers[name] = child;

            const stdout = collectData(child.stdout, 'utf8', name);
            const stderr = collectData(child.stderr, 'utf8', name);
            child.on('error', err => {
            });

            child.on('close', code => {
                if (code) {
                } else {
                }
            });

            cb();
        })
    })
}

 
fs.mkdirParent = function(dirPath, mode, callback) {
  //Call the standard fs.mkdir
  fs.mkdir(dirPath, mode, function(error) {
    //When it fail in this way, do the custom steps
    if (error && error.errno === 34) {
      //Create all the parents recursively
      fs.mkdirParent(path.dirname(dirPath), mode, callback);
      //And then the directory
      fs.mkdirParent(dirPath, mode, callback);
    }
    //Manually run the callback since we used our own callback to do all these
    callback && callback(error);
  });
};

function loadInstalledImages() {

    console.log("------------ LOADING FROM: " + g_StoragePath + '/config.json');
    try {
        g_installedImages = JSON.parse(fs.readFileSync(g_StoragePath + '/config.json'));
    } catch (e) {
        console.log('--- FAILED ---');
        g_installedImages = {};
    }
}

function saveInstalledImages() {
    fs.mkdirParent(g_StoragePath, undefined, function () {
        fs.writeFileSync(g_StoragePath + '/config.json', JSON.stringify(g_installedImages));
    })
}
