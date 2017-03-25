
import * as vscode from 'vscode';
var opn = require('opn');
import { StringDecoder } from 'string_decoder';
import { Readable } from "stream";

import { Docker } from './docker';
import { HtmlView } from './html';

var docker: Docker = new Docker(vscode.workspace.rootPath, cmdHandler, logHandler);
var html: HtmlView = HtmlView.getInstance();

var fs = require('fs');
var path = require('path');


var g_Config = {};
var g_availableImages = {};
var g_StatusBarItems = {};
var g_StoragePath = '';

var g_Terminals = {};

var copyPaste = require('copy-paste');

var out: vscode.OutputChannel = vscode.window.createOutputChannel("DockerRunner");

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    g_StoragePath = context.storagePath;
    html.setExtensionPath(context.extensionPath);

    loadConfig();

    console.log('Congratulations, your extension "vsc-docker" is now active!');

    registerCommand(context, 'extension.openMainMenu', () => {
        displayMainMenu();
    });

    registerCommand(context, 'extension.removeContainers', (...p:any[]) => {
        console.log("REMOVE CONTAINERS CALLED! " + JSON.stringify(p));

        docker.rm(p[0], true, function(result) {
            vscode.window.showInformationMessage('RESULT: ' + JSON.stringify(result));

            queryContainers();            
         })

    });
        
    registerCommand(context, 'extension.installImage', (...p:any[]) => {
            g_Config[p[0]] = { description: p[1] };
            saveConfig();

            installImage(p[0], p[1]);
    });

    registerCommand(context, 'extension.containerOptions', (...p:any[]) => {
        displayContainerOptions(p[0], p[1]);
    });

    registerCommand(context, 'extension.imageOptions', (...p:any[]) => {
        displayImageOptions(p[0], p[1]);
    });

    var item = vscode.window.createStatusBarItem();

    item.text = "Docker Runner";
    item.command = "extension.openMainMenu";
    item.show();

    // show output channel
    out.show();
}

// this method is called when your extension is deactivated
export function deactivate() {
}


function displayMainMenu() {
    var items:string[] = [];

    for (var item in g_Config) {
        items.push(g_Config[item].description + ' [' +  item + ']')
    }

    items.push('Edit Configuration');

    items.push('docker ...');

    vscode.window.showQuickPick(items).then( selected => {
        if (selected == 'Edit Configuration') {
            vscode.workspace.openTextDocument(g_StoragePath + '/config.json').then( (document) => {
                vscode.window.showTextDocument(document);
            });
        } else if (selected == 'docker ...') {
            items = [];
            items.push('search');
            items.push('ps');
            items.push('images');
            items.push('info');

            vscode.window.showQuickPick(items).then( selected => {
                switch (selected) {
                    case 'search':
                        vscode.window.showInputBox( { prompt: "Search string", value: 'xvsc'} ).then( (filter) => {
                            var items:string[] = [];

                            docker.search(filter, function (result: object) {

                                // add complex definition to the headers
                                result['title'] = 'Find Docker Images';
                                result['headers'].push(['Pull & Add', 'command:extension.installImage', '$name', '$description']);

                                // XXX - just for testing purposes here
                                html.createPreviewFromObject(result);
                            })
                        } )
                        break;
                    case 'ps':
                        queryContainers();
                        break;
                    case 'images':
                        queryImages();
                        break;
                    case 'info':
                        displayInfo();
                        break;
                }
            });            
        } else {
            var image: string = selected.split('[')[1].split(']')[0];
            displayContainerMenu(image);
        }
    })
}

function displayContainerMenu(image: string) {
    var cc :any = g_Config[image];

    if (typeof cc == 'object') {
        if (cc.config.compatible) {

            if (docker.isRunning(image)) {
                cmdHandler([ 'docker:menu' ], image);
            } else {
                startContainerFromTerminal(image, false, function() {
                    cmdHandler([ 'docker:menu' ], image);
                });
            }
        } else {
            cmdHandler([ 'ide:menu', cc.menu ], image);
        }
    }
}

enum ContainerState {
    Created,
    Running,
    Paused,
    Exited
}

function displayContainerOptions(id: string, status: string) {
    var items:string[] = [];

    var state: ContainerState = ContainerState.Running;

    if (status.indexOf('Created') >= 0) {
        state = ContainerState.Created;
    } else if (status.indexOf('Exited') >= 0) {
        state = ContainerState.Exited;
    } else if (status.indexOf('Paused') >= 0) {
        state = ContainerState.Paused;
    }

    // XXX - when container can be started?
    items.push('Start');

    if (state != ContainerState.Paused) {
        if (state == ContainerState.Exited) {
            items.push('Remove');
        } else {
            items.push('Kill & Remove');
        }

        // XXX - container can be restarted only when not paused -- and what else?
        items.push('Restart');
    }

    if (state == ContainerState.Running) {
        items.push('Pause');
    } else if (state == ContainerState.Paused) {
        items.push('Unpause');
    }

    items.push('Rename');


    items.push('Diff');
    items.push('Top');

    vscode.window.showQuickPick(items).then( selected => {
        if (selected == 'Remove') {
            docker.rm([ id ], false, function(result) {
                if (result) {
                    vscode.window.showInformationMessage('Container removed');
                } else {
                    vscode.window.showErrorMessage('Operation failed');
                }
                queryContainers();            
            })
        } else if (selected == 'Kill & Remove') {
            docker.rm([ id ], true, function(result) {
                if (result) {
                    vscode.window.showInformationMessage('Container removed');
                } else {
                    vscode.window.showErrorMessage('Operation failed');
                }
                queryContainers();            
            })
        } else if (selected == 'Rename') {
            vscode.window.showInputBox({ prompt: 'New name'}).then( (newName) => {
                docker.rename(id, newName, function(result) {
                    if (result) {
                        vscode.window.showInformationMessage('Container renamed');
                    } else {
                        vscode.window.showErrorMessage('Operation failed');
                    }
                    queryContainers();            
                })
            })

        } else if (selected == 'Pause') {
            docker.pause(id, function(result) {
                if (result) {
                    vscode.window.showInformationMessage('Container paused');
                } else {
                    vscode.window.showErrorMessage('Operation failed');
                }
                queryContainers();                            
            })
        } else if (selected == 'Unpause') {
            docker.unpause(id, function(result) {
                if (result) {
                    vscode.window.showInformationMessage('Container unpaused');
                } else {
                    vscode.window.showErrorMessage('Operation failed');
                }
                queryContainers();                            
            })
        } else if (selected == 'Start') {
            docker.start(id, function(result) {
                if (result) {
                    vscode.window.showInformationMessage('Container started');
                } else {
                    vscode.window.showErrorMessage('Operation failed');
                }
                queryContainers();                            
            })
        } else if (selected == 'Restart') {
            docker.restart(id, function(result) {
                if (result) {
                    vscode.window.showInformationMessage('Container restarted');
                } else {
                    vscode.window.showErrorMessage('Operation failed');
                }
                queryContainers();                            
            })
        } else if (selected == 'Diff') {
            docker.diff(id, function (result: object) {
                html.createPreviewFromText(result.toString(), "Diff");
            })

        } else if (selected == 'Top') {
            docker.top(id, function (result: object) {
                html.createPreviewFromText(result.toString(), "Diff");
            })

        }
    })
}

function displayImageOptions(name: string, repository: string) {
    var items:string[] = [];

    items.push('Pull');
    items.push('Push');
    items.push('Load');
    items.push('Save');
    items.push('History');
    items.push('Remove');

    vscode.window.showQuickPick(items).then( selected => {
        if (selected == 'History') {
            docker.history(name, function (result: object) {

                // add complex definition to the headers
                result['title'] = 'History of ' + name;

                // XXX - just for testing purposes here
                html.createPreviewFromObject(result);
            })
        } else if (selected == 'Remove') {
            docker.rmi([ name ], function(result) {
                vscode.window.showInformationMessage('RESULT: ' + JSON.stringify(result));

                queryImages();            
            })
        } else if (selected == 'Pull') {
            docker.pull(repository, function(result) {
                if (result) {
                    vscode.window.showInformationMessage('Pull completed!');
                } else {
                    vscode.window.showErrorMessage('Pull failed');
                }

                queryImages();
            })
        } else if (selected == 'Push') {
            docker.push(repository, function(result) {
                if (result) {
                    vscode.window.showInformationMessage('Push completed!');
                } else {
                    vscode.window.showErrorMessage('Push failed');
                }

                queryImages();
            })
        }
    })
}

function registerCommand(context: vscode.ExtensionContext, name, func) {
    let disposable = vscode.commands.registerCommand(name, func);
    context.subscriptions.push(disposable);    
}

function displayInfo() {
    docker.info(function (result: object) {

        html.createPreviewFromText(result.toString(), 'Info');
    })       
}

function queryImages() {
    docker.images(function (result: object) {

        // add complex definition to the headers
        result['title'] = 'Docker Images';
        result['headers'].push(['More...', 'command:extension.imageOptions', '$image id', '$repository']);

        html.createPreviewFromObject(result);
    })       
}

function queryContainers() {
    docker.ps(true, function (result: object) {

        // add complex definition to the headers
        result['title'] = 'Containers';
        result['headers'].push(['More...', 'command:extension.containerOptions', '$container id', '$status']);

        html.createPreviewFromObject(result);
    })
}

function installImage(id: string, description: string) {

    docker.getConfig(id, function(config) {
        if (config) {
            vscode.window.showInformationMessage("Installed Visual Studio Code compatible image!");
            g_Config[id].config = config;
            g_Config[id].config.compatible = true;
        } else {
            vscode.window.showInformationMessage("Installed generic image!");

            g_Config[id].config = {};
            g_Config[id].config.compatible = false;
        }

        g_Config[id].menu = {
            items: [ "Bash", "Execute" ],
            commands: [ "ide:bash", "ide:execute"] 
        };

        saveConfig();
    });
}


function logHandler(data: string) {
    out.append(data);
}

function cmdHandler(json: any, container: string) {
    try {
        // XXX - stupid thing! made this to make sure this function won't damage original JSON
        // XXX - have to figure out how to do this properly in JS
        var params = (typeof json == 'string') ? JSON.parse(json) : JSON.parse(JSON.stringify(json));
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
                    vscode.window.showInputBox({ prompt: params[0].label, value: params[0].default}).then( (text) => {
                        var command: any[] = params[0].command;
                        command.push(text);
                        cmdHandler(command, container) 
                    })
                    break;
                case 'menu':
                    vscode.window.showQuickPick(params[0].items).then( (selected) => {
                        if (selected)
                        {
                            var index: number = params[0].items.indexOf(selected);
                            cmdHandler(params[0].commands[index], container) 
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
                    html.preview(params[0], 'Info');
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
                case 'bash':
                    startContainerFromTerminal(container, true, function() {});
                    break;
                case 'execute':
                    vscode.window.showInputBox( { prompt: "Enter command", value: ''} ).then( (cmd) => {
                        docker.exec(container, cmd, function() {});
                    });
            }
        } else if (cmdPrefix == 'docker') {
            docker.exec(container, params, function(result) {});
        }

        vscode.commands.executeCommand(cmd, params);
    } catch (e) {
        console.log("Parsing JSON failed:");
        console.log(json);
    }
}

function startContainerFromTerminal(id: string, view: boolean, cb) {
    var name = docker.nameFromId(id);

    if (g_Terminals.hasOwnProperty(name)) {
        // just show the terminal if it was already created for this container
        if (view) g_Terminals[name].show();
    } else {
        // create a new terminal and show it
        g_Terminals[name]  = vscode.window.createTerminal();
        if (view) g_Terminals[name].show();

        // check if we already have this process isRunning

        docker.ps(false, function(result) {
            var exists: boolean = false;

            for (var i = 0; i < result.rows.length; i++) {
                if (result.rows[i].names == name) {
                    exists = true;
                }
            }

            if (exists) {
                g_Terminals[name].sendText('docker attach ' + name, true);
                docker.attach(id, g_Config[id].config.compatible, function(result) {
                    console.log("----- ATTACHED TO CONTAINER : " + result);
                    cb();
                });
            } else {
                var src = '/src';

                if (g_Config[id].config.src) {
                    src = g_Config[id].config.src;
                }

                g_Terminals[name].sendText('docker run -i -t --name ' + name + ' -v ' + vscode.workspace.rootPath + ':' + src + ' ' + id, true);

                setTimeout(function() {
                    docker.attach(id, g_Config[id].config.compatible, function(result) {
                        console.log("----- ATTACHED TO CONTAINER : " + result);
                        cb();
                    });
                }, 3000)
            }
        });
    }

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

function loadConfig() {
    try {
        g_Config = JSON.parse(fs.readFileSync(g_StoragePath + '/config.json'));
    } catch (e) {
        console.log('--- FAILED ---');
        g_Config = {};
    }
}

function saveConfig() {
    fs.mkdirParent(g_StoragePath, undefined, function () {
        fs.writeFileSync(g_StoragePath + '/config.json', JSON.stringify(g_Config, null, 2));
    })
}
