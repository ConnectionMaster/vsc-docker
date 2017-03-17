'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as cp from 'child_process';
var opn = require('opn');
import { StringDecoder } from 'string_decoder';
import { Readable } from "stream";

var g_installedImages = {};
var g_availableImages = {};
var g_internalHtml = "";
var g_containers = {};
var g_StatusBarItems = {};

var copyPaste = require('copy-paste');

var out: vscode.OutputChannel = vscode.window.createOutputChannel("DockerExt");

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "vsc-docker" is now active!');

    registerCommand(context, 'extension.init', () => {
    });

    registerCommand(context, 'DockerExt.launchExternalBrowser', (uri) => {
        opn(uri);    
    });

    registerCommand(context, 'extension.openMainMenu', () => {
        var items:string[] = [];

        for (var item in g_installedImages) {
            items.push(g_availableImages[item] + ' [' +  item + ']')
        }

        items.push("Install Image");
        items.push("Remove Image");

        vscode.window.showQuickPick(items).then( selected => {
            if (selected == "Install Image") {
                var items:string[] = [];

                for (var item in g_availableImages) {
                    if (!g_installedImages[item]) {
                        items.push(g_availableImages[item] + ' [' +  item + ']');
                    }
                }

                if (items.length == 0) {
                    vscode.window.showInformationMessage('Not found!');
                } else {
                    vscode.window.showQuickPick(items).then( selected => {
                        if (selected) {
                            installImage(selected.split('[')[1].split(']')[0]);
                        }
                    });
                }
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
                    vscode.commands.executeCommand("DockerExt.containerCommand", [name, "menu"]);
                });
            }
        })
    });

    registerCommand(context, 'DockerExt.showQuickPick', (p) => {
        vscode.window.showQuickPick(p.items).then( (selected) => {
            if (selected)
            {
                var index: number = p.items.indexOf(selected);
                var command: string = p.commands[index][0];
                p.commands[index].shift();
                vscode.commands.executeCommand(command, p.commands[index]) 
            }
        })
    });

    registerCommand(context, 'DockerExt.displayInput', (p) => {
        vscode.window.showInputBox({ prompt: p.label}).then( (text) => {
            var command: string = p.command[0];
            p.command.shift();
            p.command.push(text);
            vscode.commands.executeCommand(command, p.command) 
        })
    });

    registerCommand(context, 'DockerExt.previewHtml', (p) => {
        g_internalHtml = p; 
        vscode.commands.executeCommand('vscode.previewHtml', 'http://internal'); 
    });

    registerCommand(context, 'DockerExt.showInformationMessage', (p) => {
        vscode.window.showInformationMessage(p);
    });

    registerCommand(context, 'DockerExt.showErrorMessage', (p) => {
        vscode.window.showErrorMessage(p);
    });

    registerCommand(context, 'DockerExt.containerCommand', (p) => {
        // p must be an array, first is docker name, second is parameter
        var container = p[0];
        p.shift();
        p[0] = 'command:' + p[0];
        g_containers[container].stdin.write('\r\n>>>CMD>>>\r\n' + JSON.stringify(p) + '\r\n<<<CMD<<<\r\n');
    });

    registerCommand(context, 'DockerExt.copyToClipboard', (p) => {
        copyPaste.copy(p);
    });

    registerCommand(context, 'DockerExt.updateStatusBar', (p) => {

        var name: string = p.name;
        var command: string = p.command;

        if (!g_StatusBarItems.hasOwnProperty('name')) {
            g_StatusBarItems['name'] = vscode.window.createStatusBarItem();
            g_StatusBarItems['name'].show();
        }

        if (p.hasOwnProperty('text')) {
            g_StatusBarItems['name'].text = p.text;
        }

        if (p.hasOwnProperty('command')) {
            g_StatusBarItems['name'].command = p.command;
        }
    });
    

    checkDockerInstall().then(installed => {
        if (installed) {
            queryInstalledImages();
            queryCompatibleImages();
        } else {
            vscode.window.showInformationMessage('Docker is not installed!!');
        }

    });


    var item = vscode.window.createStatusBarItem();

    item.text = "DockerExt";
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

function installImage(id: string) {
    const child = cp.spawn('docker', ['pull', id]);
    const stdout = collectData(child.stdout, 'utf8');
    const stderr = collectData(child.stderr, 'utf8');
    child.on('error', err => {
        vscode.window.showErrorMessage('Failed to install image!');
    });

    child.on('close', code => {
        if (code) {
            vscode.window.showErrorMessage('Failed to install image!');
        } else {

            vscode.window.showInformationMessage('Image installed successfully!');
            g_installedImages = {};

            queryInstalledImages();
        }
    });
}

function removeImage(id: string) {
    const child = cp.spawn('docker', ['rmi', '-f', id]);
    const stdout = collectData(child.stdout, 'utf8');
    const stderr = collectData(child.stderr, 'utf8');
    child.on('error', err => {
        vscode.window.showErrorMessage('Failed to remove image!');
    });

    child.on('close', code => {
        if (code) {
            vscode.window.showErrorMessage('Failed to remove image!');
        } else {

            vscode.window.showInformationMessage('Image removed successfully!');
            g_installedImages = {};

            queryInstalledImages();
        }
    });
}

function queryCompatibleImages() {
    const child = cp.spawn('docker', ['search', 'xvsc']);
    const stdout = collectData(child.stdout, 'utf8');
    const stderr = collectData(child.stderr, 'utf8');
    child.on('error', err => {
        g_installedImages = {};
    });

    child.on('close', code => {
        if (code) {
            g_availableImages = {};
        } else {

            g_availableImages = {};
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
                    g_availableImages[name] = description;                    
                }
            }
        }
    });
}

function queryInstalledImages() {

    // synchronisation should be handled in a better way
    removeStoppedContainers();

    const child = cp.spawn('docker', ['images']);
    const stdout = collectData(child.stdout, 'utf8');
    const stderr = collectData(child.stderr, 'utf8');
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
    const stdout = collectData(child.stdout, 'utf8');
    const stderr = collectData(child.stderr, 'utf8');
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

function collectData(stream: Readable, encoding: string): string[] {
    const data: string[] = [];
    const decoder = new StringDecoder(encoding);

    stream.on('data', (buffer: Buffer) => {
        var decoded: string = decoder.write(buffer);
        data.push(decoded);
        out.append(decoded);

        // just make a single string...
        data[0] = data.join();
        data.splice(1);

        while (true) {
            var cmdIdxStart: number = data[0].indexOf('>>>CMD>>>');

            if (cmdIdxStart > 0) {
                cmdIdxStart += 9;
                var cmdIdxEnd: number = data[0].indexOf('<<<CMD<<<', cmdIdxStart);

                if (cmdIdxEnd > 0) {

                    try {

                        // get commands and parameters from JSON
                        var tmp = data[0].substring(cmdIdxStart, cmdIdxEnd);
                        var params = JSON.parse(tmp);
                        var cmd = params[0].split(':')[1];
                        vscode.commands.executeCommand(cmd, params[1]);
                    } catch (e) {
                        console.log("Parsing JSON failed:");
                        console.log(data[0].substring(cmdIdxStart, cmdIdxEnd));
                    }
                        
                    // remove everything from buffer
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

function startContainer(name: string, cb) {

    if (g_containers.hasOwnProperty(name)) {
        cb();
        return;
    }

    const child = cp.spawn('docker', ['rm', '-f', name.split('/')[1]]);
    child.on('close', code => {

        const child = cp.spawn('docker', ['run', name, 'config']);
        const config = collectData(child.stdout, 'utf8');

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

            const stdout = collectData(child.stdout, 'utf8');
            const stderr = collectData(child.stderr, 'utf8');
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
