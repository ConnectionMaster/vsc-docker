
import * as vscode from 'vscode';
import * as cp from 'child_process';
var opn = require('opn');
import { StringDecoder } from 'string_decoder';
import { Readable } from "stream";

import { Docker } from './docker';
import { HtmlView } from './html';

var docker: Docker = new Docker(vscode.workspace.rootPath, executeCommand, printOutput);
var html: HtmlView = new HtmlView();

var fs = require('fs');
var path = require('path');


var g_Config = {};
var g_availableImages = {};
var g_internalHtml = "";
var g_StatusBarItems = {};
var g_StoragePath = '';

var g_Terminals = {};

var copyPaste = require('copy-paste');

var out: vscode.OutputChannel = vscode.window.createOutputChannel("DockerRunner");

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    g_StoragePath = context.storagePath;

    loadConfig();

    console.log('Congratulations, your extension "vsc-docker" is now active!');

    registerCommand(context, 'extension.openMainMenu', () => {
        displayMainMenu();
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


function displayMainMenu() {
    var items:string[] = [];

    for (var item in g_Config) {
        items.push(g_Config[item].description + ' [' +  item + ']')
    }

    items.push('Install Image');
    items.push('Remove Image');
    items.push('Edit Configuration');

    vscode.window.showQuickPick(items).then( selected => {
        if (selected == "Install Image") {

            vscode.window.showInputBox( { prompt: "Search string", value: 'xvsc'} ).then( (filter) => {
                var items:string[] = [];

                docker.search(filter, function (result: object) {
                    for (var item in result['rows']) {
                        items.push(result['rows'][item].description + ' [' +  result['rows'][item].name + ']');
                    }

                    if (items.length == 0) {
                        vscode.window.showInformationMessage('Not found!');
                    } else {
                        vscode.window.showQuickPick(items).then( selected => {
                            if (selected) {
                                g_Config[selected.split('[')[1].split(']')[0]] = { description: selected.split('[')[0].trim() };
                                saveConfig();

                                installImage(selected.split('[')[1].split(']')[0], selected.split('[')[0].trim());
                            }
                        });
                    }
                })
            } )

        } else if (selected == "Remove Image") {
            var items:string[] = [];

            for (var item in g_Config) {
                items.push(item);
            }

            if (items.length == 0) {
                vscode.window.showInformationMessage('Not found!');
            } else {
                vscode.window.showQuickPick(items).then( selected => {
                    if (selected) {
                        //removeImage(selected);
                    }
                });
            }
        } else if (selected == 'Edit Configuration') {
            vscode.workspace.openTextDocument(g_StoragePath + '/config.json').then( (document) => {
                vscode.window.showTextDocument(document);
            });
        } else {
            var name: string = selected.split('[')[1].split(']')[0];
            displayContainerMenu(name);
        }
    })
}

function displayContainerMenu(container: string) {
    var cc :any = g_Config[container];

    if (typeof cc == 'object') {
        if (cc.config.compatible) {
            executeCommand([ 'docker:menu' ], container);
        } else {
            executeCommand([ 'ide:menu', cc.menu ], container);
        }
    }
}

function registerCommand(context: vscode.ExtensionContext, name, func) {
    let disposable = vscode.commands.registerCommand(name, func);
    context.subscriptions.push(disposable);    
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


function printOutput(data: string) {
    out.append(data);
}

function executeCommand(json: any, container: string) {
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
                case 'bash':
                    startContainerFromTerminal(container);
                    break;

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

function startContainerFromTerminal(id: string) {
    var cn = ((id.indexOf('/') > 0) ? id.split('/')[1] : id);

    if (g_Terminals.hasOwnProperty(cn)) {
        // just show the terminal if it was already created for this container
        g_Terminals[cn].show();
    } else {
        // create a new terminal and show it
        g_Terminals[cn]  = vscode.window.createTerminal();
        g_Terminals[cn].show();

        // check if we already have this process isRunning

        docker.ps(false, function(result) {
            var exists: boolean = false;

            for (var i = 0; i < result.rows.length; i++) {
                if (result.rows[i].names == cn) {
                    exists = true;
                }
            }

            if (exists) {
                g_Terminals[cn].sendText('docker attach ' + cn, true);
            } else {
                g_Terminals[cn].sendText('docker run -i -t --name ' + cn + ' ' + id, true);
                docker.attach(cn, function(result) {
                    console.log("----- ATTACHED TO CONTAINER : " + result);
                });
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
