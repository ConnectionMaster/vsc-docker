'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as cp from 'child_process';
import { StringDecoder } from 'string_decoder';
import { Readable } from "stream";

var g_installedImages:string[] = [];
var g_availableImages:string[] = [];
var g_menuItems = {};

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

    let disposable2 = vscode.commands.registerCommand('extension.openMainMenu', () => {
        var items:string[] = [];

        for (var item in g_menuItems) {
            items.push(item);
        }

        items.push("Install Image");
        items.push("Remove Image");

        vscode.window.showQuickPick(items).then( selected => {
            if (selected == "Install Image") {
                // XXX - remove installed images from available images
                // XXX - check if any available images that are not installed
                vscode.window.showQuickPick(g_availableImages).then( selected => {
                    installImage(selected);
                });
            } else if (selected == "Remove Image") {
                vscode.window.showQuickPick(g_installedImages).then( selected => {
                    removeImage(selected);
                });
            }
        })
    });

    context.subscriptions.push(disposable1);
    context.subscriptions.push(disposable2);

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
            g_installedImages = [];

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
            g_installedImages = [];

            queryInstalledImages();
        }
    });
}

function queryCompatibleImages() {
    const child = cp.spawn('docker', ['search', 'xvsc']);
    const stdout = collectData(child.stdout, 'utf8');
    const stderr = collectData(child.stderr, 'utf8');
    child.on('error', err => {
        g_installedImages = [];
    });

    child.on('close', code => {
        if (code) {
            g_availableImages = [];
        } else {

            g_availableImages = [];
            var lines: string[] = stdout.join('').split(/\r?\n/);
            for (var element of lines) {
                if (!element.startsWith("NAME")) {
                    var i: string = element.split(" ")[0]
                    g_availableImages.push(i);                    
                }
            }
        }
    });
}

function queryInstalledImages() {
    const child = cp.spawn('docker', ['images']);
    const stdout = collectData(child.stdout, 'utf8');
    const stderr = collectData(child.stderr, 'utf8');
    child.on('error', err => {
        g_installedImages = [];
    });

    child.on('close', code => {
        if (code) {
            g_installedImages = [];
        } else {

            g_installedImages = [];
            var lines: string[] = stdout.join('').split(/\r?\n/);
            for (var element of lines) {
                if (element.indexOf("xvsc") >= 0) {
                    g_installedImages.push(element.split(" ")[0]);                    
                }
            }

            // query all capabilities for installed docker images
            queryAllCapabilities();
        }
    });
}

function queryAllCapabilities() {
    g_menuItems = [];
    for (var element of g_installedImages) {
        queryCapabilities(element);
    }
}

function queryCapabilities(image: string) {
    const child = cp.spawn('docker', ['run', image]);
    const stdout = collectData(child.stdout, 'utf8');
    const stderr = collectData(child.stderr, 'utf8');
    child.on('error', err => {
        g_installedImages = [];
    });

    child.on('close', code => {
        if (code) {
        } else {
            try {
                var capabilities = JSON.parse(stdout.join(''));
                for (var element in capabilities) {
                    g_menuItems[element] = capabilities[element]
                }
            } catch (e) {}
        }
    });
}

function collectData(stream: Readable, encoding: string): string[] {
    const data: string[] = [];
    const decoder = new StringDecoder(encoding);
    stream.on('data', (buffer: Buffer) => {
        data.push(decoder.write(buffer));
    });
    return data;
}
