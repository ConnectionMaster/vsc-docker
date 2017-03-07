'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as cp from 'child_process';
import { StringDecoder } from 'string_decoder';
import { Readable } from "stream";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "vsc-docker" is now active!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand('extension.sayHello', () => {
        // The code you place here will be executed every time your command is executed

        // Display a message box to the user
        vscode.window.showInformationMessage('Hello World! XXX');
    });

    context.subscriptions.push(disposable);

    checkDockerInstall().then(installed => {
        if (installed) {
            queryCompatibleImages().then(images => {
                vscode.window.showInformationMessage(images[1]);
            });
        } else {
            vscode.window.showInformationMessage('Docker is not installed!!');
        }

    });

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

function queryCompatibleImages(): Promise<string[]> {
    return new Promise((resolve, reject) => {
        const child = cp.spawn('docker', `search xvsc`.split(' '));
        const stdout = collectData(child.stdout, 'utf8');
        const stderr = collectData(child.stderr, 'utf8');
        child.on('error', err => {
            reject(err);
        });

        child.on('close', code => {
            if (code) {
                reject(stderr.join('') || code);
            } else {
                resolve(stdout.join('').split(/\r?\n/));
            }
        });
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
