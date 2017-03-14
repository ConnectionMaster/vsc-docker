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
var g_menuItems = {};
var g_internalHtml = "";
var g_containers = {};

var copyPaste = require('copy-paste');

var out: vscode.OutputChannel = vscode.window.createOutputChannel("Docker for IoT");

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "vsc-docker" is now active!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable1 = vscode.commands.registerCommand('extension.init', () => {
        // The code you place here will be executed every time your command is executed

        // Display a message box to the user
        vscode.window.showInformationMessage('Docker for IoT is ready!');
    });

    let disposablex = vscode.commands.registerCommand('DockerExt.launchExternalBrowser', (uri) => {

        opn(uri);    
    });

    let disposable2 = vscode.commands.registerCommand('extension.openMainMenu', () => {
        var items:string[] = [];

        for (var item in g_installedImages) {
            items.push(item);
        }

        items.push("Install Image");
        items.push("Remove Image");

        vscode.window.showQuickPick(items).then( selected => {
            if (selected == "Install Image") {

                var items:string[] = [];

                for (var item in g_availableImages) {
                    if (!g_installedImages[item]) {
                        items.push(item);
                    }
                }

                if (items.length == 0) {
                    vscode.window.showInformationMessage('Not found!');
                } else {
                    vscode.window.showQuickPick(items).then( selected => {
                        if (selected) {
                            installImage(selected);
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

                startContainer(selected, function() {
                    vscode.commands.executeCommand("DockerExt.containerCommand", [selected, "menu"]);
                });
            }
        })
    });

    let disposable3 = vscode.commands.registerCommand('DockerExt.showQuickPick', (p) => {
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

    let disposable4 = vscode.commands.registerCommand('DockerExt.displayInput', (p) => {
    });

    let disposable5 = vscode.commands.registerCommand('DockerExt.previewHtml', (p) => {
        g_internalHtml = p; 
        vscode.commands.executeCommand('vscode.previewHtml', 'http://internal'); 
    });

    let disposable6 = vscode.commands.registerCommand('DockerExt.showInformationMessage', (p) => {
        vscode.window.showInformationMessage(p);
    });

    let disposable7 = vscode.commands.registerCommand('DockerExt.showErrorMessage', (p) => {
        vscode.window.showErrorMessage(p.message);
    });

    let disposable8 = vscode.commands.registerCommand('DockerExt.containerCommand', (p) => {
        // p must be an array, first is docker name, second is parameter
        var container = p[0];
        p.shift();
        p[0] = 'command:' + p[0];
        g_containers[container].stdin.write('\r\n>>>CMD>>>\r\n' + JSON.stringify(p) + '\r\n<<<CMD<<<\r\n');
    });

    context.subscriptions.push(disposable1);
    context.subscriptions.push(disposable2);
    context.subscriptions.push(disposable3);
    context.subscriptions.push(disposable4);
    context.subscriptions.push(disposable5);
    context.subscriptions.push(disposable6);
    context.subscriptions.push(disposable7);
    context.subscriptions.push(disposable8);

    checkDockerInstall().then(installed => {
        if (installed) {
            queryInstalledImages();
            queryCompatibleImages();
        } else {
            vscode.window.showInformationMessage('Docker is not installed!!');
        }

    });


    var item = vscode.window.createStatusBarItem();

    item.text = "Docker for IoT";
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
            for (var element of lines) {
                if (!element.startsWith("NAME") && element.length != 0) {
                    var i: string = element.split(" ")[0]
                    g_availableImages[i] = true;                    
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

            // query all capabilities for installed docker images
            queryAllCapabilities();
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
                if (element.indexOf("Exited") >= 0) {
                    var split: string[] = element.split(" ");
                    var name = split[split.length - 1];

                    const child = cp.spawn('docker', ['rm', name]);
                }
            }

            // query all capabilities for installed docker images
            queryAllCapabilities();
        }
    });
}

function queryAllCapabilities() {
    g_menuItems = {};
    for (var element in g_installedImages) {
        queryCapabilities(element);
    }
}

function queryCapabilities(image: string) {
    const child = cp.spawn('docker', ['run', image, 'capabilities']);
    const stdout = collectData(child.stdout, 'utf8');
    const stderr = collectData(child.stderr, 'utf8');
    child.on('error', err => {
        g_installedImages = {};
    });

    child.on('close', code => {
        if (code) {
        } else {
            try {
                var capabilities = JSON.parse(stdout.join(''));
                for (var element in capabilities) {
                    g_menuItems[element] = [image, capabilities[element]];
                }
            } catch (e) {}
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

        var enterTheCode = decoded.indexOf('enter the code ');
        var toAuthenticate = decoded.indexOf(' to authenticate');

        if (enterTheCode >= 0 && toAuthenticate >= 0) {
            // copy token to clipboard

            copyPaste.copy(decoded.substring(enterTheCode + 15, toAuthenticate));
        }

        while (true) {
            var cmdIdxStart: number = data[0].indexOf('>>>CMD>>>');

            if (cmdIdxStart > 0) {
                cmdIdxStart += 9;
                var cmdIdxEnd: number = data[0].indexOf('<<<CMD<<<', cmdIdxStart);

                if (cmdIdxEnd > 0) {

                    // get commands and parameters from JSON
                    var tmp = data[0].substring(cmdIdxStart, cmdIdxEnd);
                    var params = JSON.parse(tmp);
                    var cmd = params[0].split(':')[1];

                    // remove everything from buffer
                    data[0] = data[0].substr(cmdIdxEnd + 9);

                    vscode.commands.executeCommand(cmd, params[1]);
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
        const child = cp.spawn('docker', ['run', "-p", "127.0.0.1:888:80", "--name", name.split('/')[1], "-i", name, 'http']);
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
}
