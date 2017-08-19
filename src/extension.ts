
import * as vscode from 'vscode';
var opn = require('opn');
import { StringDecoder } from 'string_decoder';
import { Readable } from "stream";

import { Docker } from './docker';
import { HtmlView } from './html-lite';

import { FileBrowserDocker } from './file-browser-docker';
import { FileBrowserLocal } from './file-browser-local';

import { DockerContainers } from "./tree-docker-containers";
import { DockerImages } from "./tree-docker-images";

import { AppInsightsClient } from "./appInsightsClient";

var docker: Docker = new Docker(vscode.workspace.rootPath, logHandler, closeHandler);
var html: HtmlView = HtmlView.getInstance();

var fs = require('fs');
var path = require('path');


var g_Config: object = {};
var g_availableImages = {};
var g_StatusBarItems = {};
var g_StoragePath = '';

var g_Terminals = {};

var g_FileBrowserDocker: FileBrowserDocker = null;
var g_FileBrowserLocal: FileBrowserLocal = null;
var copyPaste = require('copy-paste');

var out: vscode.OutputChannel = vscode.window.createOutputChannel("\u27a4 Docker Runner");


var dockerContainers: DockerContainers = null;
var dockerImages: DockerImages = null;

/**
 * Activate extension
 * 
 * @param context 
 */
export function activate(context: vscode.ExtensionContext) {

    AppInsightsClient.sendEvent('ExtensionActivated');

    dockerContainers = new DockerContainers(context, docker);
    vscode.window.registerTreeDataProvider("dockerContainers", dockerContainers);
    dockerImages = new DockerImages(context, docker);
    vscode.window.registerTreeDataProvider("dockerImages", dockerImages);

    g_StoragePath = context.extensionPath;
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

            queryContainers(true);            
         })

    });

    registerCommand(context, 'extension.installImageOptions', (...p:any[]) => {
        AppInsightsClient.sendEvent('DisplayInstallImageOptions');
        installImageOptions(p[0], p[1]);
    });

    registerCommand(context, 'extension.containerOptions', (...p:any[]) => {
        AppInsightsClient.sendEvent('DisplayContainerOptions');
        displayContainerOptions(p[0], p[1], p[2]);
    });

    registerCommand(context, 'extension.containerDelete', (...p:any[]) => {
        deleteContainer(p[0], p[1]);
    });

    registerCommand(context, 'extension.imageOptions', (...p:any[]) => {
        AppInsightsClient.sendEvent('DisplayImageOptions');
        displayImageOptions(p[0], p[1]);
    });

    registerCommand(context, 'extension.imageDelete', (...p:any[]) => {
        deleteImage(p[0], p[1]);
    });

    registerCommand(context, 'extension.fileOpen', (...p:any[]) => {
        AppInsightsClient.sendEvent('BrowseFileOpen');
        g_FileBrowserDocker.open(p[0]);
    });

    registerCommand(context, 'extension.fileOptions', (...p:any[]) => {
        AppInsightsClient.sendEvent('BrowseFileOptions');
        g_FileBrowserDocker.options(p[0]);
    });

    registerCommand(context, 'extension.fileDelete', (...p:any[]) => {
        AppInsightsClient.sendEvent('BrowseFileDelete');
        g_FileBrowserDocker.delete(p[0]);
    });

    registerCommand(context, 'extension.localFileOpen', (...p:any[]) => {
        AppInsightsClient.sendEvent('BrowseLocalFileOpen');
        g_FileBrowserLocal.open(p[0]);
    });

    registerCommand(context, 'extension.localFileOptions', (...p:any[]) => {
        AppInsightsClient.sendEvent('BrowseLocalFileOptions');
        g_FileBrowserLocal.options(p[0]);
    });

    registerCommand(context, 'extension.localFileDelete', (...p:any[]) => {
        AppInsightsClient.sendEvent('BrowseLocalFileDelete');
        g_FileBrowserLocal.delete(p[0]);
    });

    registerCommand(context, 'extension.htmlEvent', (...p:any[]) => {
        // parameters:
        //  1) document
        //  2) element id
        //  3) event type
        //  4) event param
        html.handleEvent(p[0], p[1], p[2], p[3]);
    });

    registerCommand(context, 'extension.showLocalImages', (...p:any[]) => {
        AppInsightsClient.sendEvent('ShowImagesDetails');
        queryImages(false);
    });

    registerCommand(context, 'extension.showLocalContainers', (...p:any[]) => {
        AppInsightsClient.sendEvent('ShowContainersDetails');
        queryContainers(false);
    });

    registerCommand(context, 'extension.searchImages', (...p:any[]) => {
        AppInsightsClient.sendEvent('SearchImages');
        searchImages();
    });

    registerCommand(context, 'extension.refreshContainers', (...p:any[]) => {
        AppInsightsClient.sendEvent('RefreshContainers');
        dockerContainers.refreshDockerTree();
    });

    registerCommand(context, 'extension.refreshImages', (...p:any[]) => {
        AppInsightsClient.sendEvent('RefreshImages');
        dockerImages.refreshDockerTree();
    });

    context.subscriptions.push(vscode.window.onDidCloseTerminal((closedTerminal: vscode.Terminal) => {
        //Executor.onDidCloseTerminal(closedTerminal);
    }));

    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(function(e: vscode.TextDocument) {
        if (e.fileName.endsWith("config.json")) {
            loadConfig();
        }
    }));

    var item = vscode.window.createStatusBarItem();

    item.text = "\u27a4 Docker Runner";
    item.command = "extension.openMainMenu";
    item.show();

    // show output channel
    out.show();

    // return our public API
    let api = {
        hello() {
            vscode.window.showInformationMessage('Hello from Docker Runner!');
        }
    }

    return api;
}

/**
 * Deactivate extension
 */
export function deactivate() {
}

/**
 * Display main menu
 */
function displayMainMenu() {

    if (!docker.isInstalled()) {
        AppInsightsClient.sendEvent('MainMenuDockerNotInstalled');
        vscode.window.showErrorMessage('Docker seems to be not available!');
        return;
    }

    AppInsightsClient.sendEvent('MainMenuDockerInstalled');

    var items:string[] = [];

    items.push('Local Images (detailed)');
    items.push('Local Containers (detailed)');
    items.push('Find Images in DockerHub');
    items.push('Edit Configuration');
    items.push('Info');
    items.push('________________');
    items.push('Login to Azure Container Registry');
    items.push('Login to DockerHub');
    items.push('Use Remote Docker Machine');

   vscode.window.showQuickPick(items).then( selected => {
        if (selected == 'Edit Configuration') {
            saveConfig();
            vscode.workspace.openTextDocument(g_StoragePath + '/config.json').then( (document) => {
                vscode.window.showTextDocument(document);
            });
        } else if (selected == 'Find Images in DockerHub') {
            searchImages();
        } else if (selected == 'Local Containers (detailed)') {
            queryContainers(false);
        } else if (selected == 'Local Images (detailed)') {
            queryImages(false);
        } else if (selected == 'Info') {
            displayInfo();
        } else if (selected == 'Login to Azure Container Registry') {
            vscode.window.showInformationMessage('Not implemented -- click Request if you want implementation to be prioritised',  "Request", "Abandon").then((value) => {
                if (value == 'Request') {
                    AppInsightsClient.sendEvent('AcrRequest');
                } else if (value == 'Abandon') {
                    AppInsightsClient.sendEvent('AcrAbandon');
                } else {
                    AppInsightsClient.sendEvent('AcrUndecided');
                }
            });                
        } else if (selected == 'Login to DockerHub') {
            vscode.window.showInformationMessage('Not implemented -- click Request if you want implementation to be prioritised',  "Request", "Abandon").then((value) => {
                if (value == 'Request') {
                    AppInsightsClient.sendEvent('DockerHubRequest');
                } else if (value == 'Abandon') {
                    AppInsightsClient.sendEvent('DockerHubAbandon');
                } else {
                    AppInsightsClient.sendEvent('DockerHubUndecided');
                }
            });                
        } else if (selected == 'Use Remote Docker Machine') {
            vscode.window.showInformationMessage('Not implemented -- click Request if you want implementation to be prioritised',  "Request", "Abandon").then((value) => {
                if (value == 'Request') {
                    AppInsightsClient.sendEvent('RemoteDockerMachineRequest');
                } else if (value == 'Abandon') {
                    AppInsightsClient.sendEvent('RemoteDockerMachineAbandon');
                } else {
                    AppInsightsClient.sendEvent('RemoteDockerMachineUndecided');
                }
            });                
        }
    })
}

enum ContainerState {
    Created,
    Running,
    Paused,
    Exited
}

/**
 * Display container options
 * 
 * @param id 
 * @param status 
 */
function displayContainerOptions(id: string, status: string, image: string) {
    var items:string[] = [];

    var state: ContainerState = ContainerState.Running;

    if (status.indexOf('Created') >= 0) {
        state = ContainerState.Created;
    } else if (status.indexOf('Exited') >= 0) {
        state = ContainerState.Exited;
    } else if (status.indexOf('Paused') >= 0) {
        state = ContainerState.Paused;
    }

    if ((state == ContainerState.Created) || (state == ContainerState.Exited)) {
        items.push('Start');
    }

    if (state != ContainerState.Paused) {
        if (state == ContainerState.Exited) {
            items.push('Remove');
        } else {
            items.push('Stop');
            items.push('Stop & Remove');
        }

        // XXX - container can be restarted only when not paused -- and what else?
        items.push('Restart');
    }

    if (state == ContainerState.Running) {
        items.push('Terminal');
        items.push('Pause');
    } else if (state == ContainerState.Paused) {
        items.push('Unpause');
    }

    items.push('Rename');


    items.push('Diff');
    items.push('Top');
    items.push('Logs');
    items.push('Browse');

    var divider: boolean = false;
    
    for (var item of g_Config['commands'])
    {
        if ((item['image'] == '*') || (item['image'] == image)) {
            if (!divider) {
                items.push('________________');
                divider = true;                
            }
            items.push(item['name']);
        }
    }

    vscode.window.showQuickPick(items).then( selected => {
        if (selected == 'Remove') {
            docker.rm([ id ], false, function(result) {
                if (result) {
                    AppInsightsClient.sendEvent('ContainerRemoveSuccess');
                    vscode.window.showInformationMessage('Container removed');
                } else {
                    AppInsightsClient.sendEvent('ContainerRemoveFailed');
                    vscode.window.showErrorMessage('Operation failed');
                }
                queryContainers(true);            
            })
        } else if (selected == 'Stop') {
            docker.stop([ id ], function(result) {
                if (result) {
                    AppInsightsClient.sendEvent('ContainerStopSuccess');
                    vscode.window.showInformationMessage('Container stopped');
                } else {
                    AppInsightsClient.sendEvent('ContainerStopFailed');
                    vscode.window.showErrorMessage('Operation failed');
                }
                queryContainers(true);            
            })
        } else if (selected == 'Stop & Remove') {
            docker.rm([ id ], true, function(result) {
                if (result) {
                    AppInsightsClient.sendEvent('ContainerStopRemoveSuccess');
                    vscode.window.showInformationMessage('Container removed');
                } else {
                    AppInsightsClient.sendEvent('ContainerStopRemoveFailed');
                    vscode.window.showErrorMessage('Operation failed');
                }
                queryContainers(true);            
            })
        } else if (selected == 'Rename') {
            vscode.window.showInputBox({ prompt: 'New name'}).then( (newName) => {
                docker.rename(id, newName, function(result) {
                    if (result) {
                        AppInsightsClient.sendEvent('ContainerRenameSuccess');
                        vscode.window.showInformationMessage('Container renamed');
                    } else {
                        AppInsightsClient.sendEvent('ContainerRenameFailed');
                        vscode.window.showErrorMessage('Operation failed');
                    }
                    queryContainers(true);            
                })
            })

        } else if (selected == 'Pause') {
            docker.pause(id, function(result) {
                if (result) {
                    AppInsightsClient.sendEvent('ContainerPauseSuccess');
                    vscode.window.showInformationMessage('Container paused');
                } else {
                    AppInsightsClient.sendEvent('ContainerPauseFailed');
                    vscode.window.showErrorMessage('Operation failed');
                }
                queryContainers(true);                            
            })
        } else if (selected == 'Unpause') {
            docker.unpause(id, function(result) {
                if (result) {
                    AppInsightsClient.sendEvent('ContainerUnpauseSuccess');
                    vscode.window.showInformationMessage('Container unpaused');
                } else {
                    AppInsightsClient.sendEvent('ContainerUnpauseFailed');
                    vscode.window.showErrorMessage('Operation failed');
                }
                queryContainers(true);                            
            })
        } else if (selected == 'Start') {
            docker.start(id, function(result) {
                if (result) {
                    AppInsightsClient.sendEvent('ContainerStartSuccess');
                    vscode.window.showInformationMessage('Container started');
                } else {
                    AppInsightsClient.sendEvent('ContainerStartFailed');
                    vscode.window.showErrorMessage('Operation failed');
                }
                queryContainers(true);                            
            })
        } else if (selected == 'Restart') {
            docker.restart(id, function(result) {
                if (result) {
                    AppInsightsClient.sendEvent('ContainerRestartSuccess');
                    vscode.window.showInformationMessage('Container restarted');
                } else {
                    AppInsightsClient.sendEvent('ContainerRestartFailed');
                    vscode.window.showErrorMessage('Operation failed');
                }
                queryContainers(true);                            
            })
        } else if (selected == 'Diff') {
            docker.diff(id, function (result: object) {
                AppInsightsClient.sendEvent('ContainerDiffCompleted');
                html.createPreviewFromText('docker', result.toString(), "Diff");
            })

        } else if (selected == 'Top') {
            docker.top(id, function (result: object) {
                AppInsightsClient.sendEvent('ContainerTopCompleted');
                html.createPreviewFromText('docker', result.toString(), "Top");
            })

        } else if (selected == 'Logs') {
            docker.logs(id, function (result: object) {
                AppInsightsClient.sendEvent('ContainerLogsCompleted');
                html.createPreviewFromText('docker', result.toString(), "Logs");
            })

        } else if (selected == 'Browse') {
            AppInsightsClient.sendEvent('ContainerBrowseStarted');
            g_FileBrowserDocker = new FileBrowserDocker(docker, id, '/');
            g_FileBrowserDocker.open('');

            var localPath: string = vscode.workspace.rootPath.split('\\').join('/');
            
            g_FileBrowserLocal = new FileBrowserLocal(localPath);
            g_FileBrowserLocal.open('');

            g_FileBrowserDocker.setOppositeBrowser(g_FileBrowserLocal);
            g_FileBrowserLocal.setOppositeBrowser(g_FileBrowserDocker);
        } else if (selected == 'Terminal') {
            showTerminal(id);
        } else {
            for (var item of g_Config['commands']) {
                if (item['name'] == selected) {
                    // XXX - execute item['command']
                }
            }
        }
    })
}

/**
 * Delete container
 * 
 * @param id 
 * @param status 
 */
function deleteContainer(id: string, status: string) {
    vscode.window.showWarningMessage('Do you want to delete "' + id + '"?', 'Delete').then ( result => {
        if (result == 'Delete') {
            docker.rm([ id ], true, function(result) {
                if (result) {
                    vscode.window.showInformationMessage('Container removed');
                } else {
                    vscode.window.showErrorMessage('Operation failed');
                }
                queryContainers(true);            
            })
        }
    })
}

/**
 * Display image options
 * 
 * @param name 
 * @param repository 
 */
function displayImageOptions(name: string, repository: string) {
    var items:string[] = [];

    items.push('Run');
    items.push('Pull');
    items.push('Push');
    items.push('Load');
    items.push('Save');
    items.push('History');
    items.push('Remove');

    // [TODO] add more options from configuration here

    vscode.window.showQuickPick(items).then( selected => {
        if (selected == 'History') {
            docker.history(name, function (result: object) {

            AppInsightsClient.sendEvent('ImageHistory');
                // add complex definition to the headers
                result['title'] = 'History of ' + name;

                // XXX - just for testing purposes here
                html.createPreviewFromObject('docker', 'History', result, 1, null, false);
            })
        } else if (selected == 'Remove') {
            docker.rmi([ name ], function(result) {
                if (result) {
                    AppInsightsClient.sendEvent('ImageRemoveSuccess');
                    vscode.window.showInformationMessage('Image removed!');                    
                } else {
                    AppInsightsClient.sendEvent('ImageRemoveFailure');
                    vscode.window.showErrorMessage('Removing image failed!');
                }

                queryImages(true);

                if (g_Config.hasOwnProperty(repository)) {
                    delete g_Config[repository];
                    saveConfig();
                }
            })
        } else if (selected == 'Pull') {
            docker.pull(repository, function(result) {
                if (result) {
                    AppInsightsClient.sendEvent('ImagePullSuccess');
                    vscode.window.showInformationMessage('Pull completed!');
                } else {
                    AppInsightsClient.sendEvent('ImagePullFailure');
                    vscode.window.showErrorMessage('Pull failed');
                }

                queryImages(true);
            })
        } else if (selected == 'Push') {
            docker.push(repository, function(result) {
                if (result) {
                    AppInsightsClient.sendEvent('ImagePushSuccess');
                    vscode.window.showInformationMessage('Push completed!');
                } else {
                    AppInsightsClient.sendEvent('ImagePushFailure');
                    vscode.window.showErrorMessage('Push failed');
                }

                queryImages(true);
            })
        } else if (selected == 'Save') {
            vscode.window.showInformationMessage('Not implemented yet!');
        } else if (selected == 'Load') {
            vscode.window.showInformationMessage('Not implemented yet!');
        } else if (selected == 'Run') {
            AppInsightsClient.sendEvent('RunFromImage');
            startContainerFromTerminal(repository, true, function () {
                AppInsightsClient.sendEvent('RunFromImageAttached');
                queryContainers(true);                
            });
        }
    })
}

/**
 * Delete image
 * 
 * @param name 
 * @param repository 
 */
function deleteImage(name: string, repository: string) {
    vscode.window.showWarningMessage('Do you want to delete "' + name + '"?', 'Delete').then ( result => {
        if (result == 'Delete') {
            docker.rmi([ name ], function(result) {
                if (result) {
                    vscode.window.showInformationMessage('Image removed!');                    
                } else {
                    vscode.window.showErrorMessage('Removing image failed!');
                }

                queryImages(true);

                if (g_Config.hasOwnProperty(repository)) {
                    delete g_Config[repository];
                    saveConfig();
                }
            })
        }
    })
}

function registerCommand(context: vscode.ExtensionContext, name, func) {
    let disposable = vscode.commands.registerCommand(name, func);
    context.subscriptions.push(disposable);    
}

/**
 * Display general Docker information
 */
function displayInfo() {
    docker.info(function (result: object) {
        if (result) {
            html.createPreviewFromText('info', result.toString(), 'Info');
        } else {
            vscode.window.showErrorMessage('Operation failed!');                
        }
    })       
}

/**
 * Query local images
 */
function queryImages(refreshOnly: boolean) {
    docker.images(function (result: object) {
        if (result) {
            // add complex definition to the headers
            result['title'] = 'Local Images';

            result['onSelect'] = ['command:extension.imageOptions', '$image id', '$repository'];
            result['onDelete'] = ['command:extension.imageDelete', '$image id', '$repository'];

            result['actions'] = [ {name: 'Refresh', link: [ 'command:extension.showLocalImages' ] } ];

            html.createPreviewFromObject('images','Images', result, 1, null, refreshOnly);
        } else {
            vscode.window.showErrorMessage('Operation failed!');                
        }
    })       

    dockerImages.refreshDockerTree();    

}

/**
 * Query local containers
 */
function queryContainers(refreshOnly: boolean) {
    docker.ps(true, function (result: object) {

        if (result) {
            // add complex definition to the headers
            result['title'] = 'Containers';
            result['onSelect'] = ['command:extension.containerOptions', '$names', '$status', '$image'];
            result['onDelete'] = ['command:extension.containerDelete', '$names', '$status'];

            result['actions'] = [ {name: 'Refresh', link: ['command:extension.showLocalContainers' ] } ];

            html.createPreviewFromObject('containers', 'Containers', result, 1, '', refreshOnly);
        } else {
            vscode.window.showErrorMessage('Operation failed!');                
        }
    })

    dockerContainers.refreshDockerTree();    
}

/**
 * Search images in Docker Hub
 */
function searchImages() {
    vscode.window.showInputBox( { prompt: "Search string" } ).then( (filter) => {
        var items:string[] = [];

        docker.search(filter, function (result: object) {

            if (result) {
                // add complex definition to the headers
                result['title'] = 'Search Docker Hub';
                result['onSelect'] = ['command:extension.installImageOptions', '$name', '$description'];

                // XXX - just for testing purposes here
                html.createPreviewFromObject('docker', 'Search', result, 1, null, false);
            } else {
                vscode.window.showErrorMessage('Search failed!');                
            }
        })
    } )
}

function installImageOptions(id: string, description: string) {

    var items:string[] = [];

    items.push('Pull');

    // [TODO] this option is disabled for timebeing
    //items.push('Pull & Pin to the Menu');

    vscode.window.showQuickPick(items).then( selected => {
        if (selected == 'Pull') {
            installImage(id, description, false);
        } else if (selected == 'Pull & Pin to the Menu') {
            installImage(id, description, true);
        }
    });
}
 

function installImage(id: string, description: string, pin: boolean) {

    docker.pull(id, function(result) {
        if (result) {
            if (pin) {
                docker.getConfig(id, function(config) {
                    if (config) {
                        vscode.window.showInformationMessage("Installed Visual Studio Code compatible image!");
                        g_Config[id] = {};
                        g_Config[id].config = config;
                        g_Config[id].config.compatible = true;
                    } else {
                        vscode.window.showInformationMessage("Installed generic image!");

                        g_Config[id] = {};
                        g_Config[id].config = {};
                        g_Config[id].config.compatible = false;
                        g_Config[id].description = description;
                    }

                    g_Config[id].config.run = "-i -t --rm --name $default-name -v $workspace:$src " + id + " sh"

                    g_Config[id].menu = {
                        items: [ "Shell", "Execute" ],
                        commands: [ ["ide:bash"], ["ide:execute"]] 
                    };

                    saveConfig();
                });
            } else {

                // make sure image list is refreshed
                queryImages(true);

                vscode.window.showInformationMessage("Image pulled!");
            }            
        } else {
            vscode.window.showErrorMessage('Failed to pull image!');
        }
    })
}

function logHandler(data: string) {
    out.append(data);
}

function closeHandler(id: string) {
    // remove terminal
    if (g_Terminals.hasOwnProperty(id)) {
        g_Terminals[id].dispose();
        delete g_Terminals[id];
    }
}

const adjectives: string[] = [
    "aback","abaft","abandoned","abashed","aberrant","abhorrent","abiding","abject","ablaze","able","abnormal","aboard","aboriginal","abortive","abounding","abrasive","abrupt","absent","absorbed","absorbing","abstracted","absurd","abundant","abusive","acceptable","accessible","accidental","accurate","acid","acidic","acoustic","acrid","actually","ad hoc","adamant","adaptable","addicted","adhesive","adjoining","adorable","adventurous","afraid","aggressive","agonizing","agreeable","ahead","ajar","alcoholic","alert","alike","alive","alleged","alluring","aloof","amazing","ambiguous","ambitious","amuck","amused","amusing","ancient","angry","animated","annoyed","annoying","anxious","apathetic","aquatic","aromatic","arrogant","ashamed","aspiring","assorted","astonishing","attractive","auspicious","automatic","available","average","awake","aware","awesome","awful","axiomatic",
    "bad","barbarous","bashful","bawdy","beautiful","befitting","belligerent","beneficial","bent","berserk","best","better","bewildered","big","billowy","bitter","bizarre","black","bloody","blue","blushing","boiling","boorish","bored","boring","bouncy","boundless","brainy","brash","brave","brawny","breakable","breezy","brief","bright","bright","broad","broken","brown","bumpy","burly","bustling","busy",
    "cagey","calculating","callous","calm","capable","capricious","careful","careless","caring","cautious","ceaseless","certain","changeable","charming","cheap","cheerful","chemical","chief","childlike","chilly","chivalrous","chubby","chunky","clammy","classy","clean","clear","clever","cloistered","cloudy","closed","clumsy","cluttered","coherent","cold","colorful","colossal","combative","comfortable","common","complete","complex","concerned","condemned","confused","conscious","cooing","cool","cooperative","coordinated","courageous","cowardly","crabby","craven","crazy","creepy","crooked","crowded","cruel","cuddly","cultured","cumbersome","curious","curly","curved","curvy","cut","cute","cute","cynical",
    "daffy","daily","damaged","damaging","damp","dangerous","dapper","dark","dashing","dazzling","dead","deadpan","deafening","dear","debonair","decisive","decorous","deep","deeply","defeated","defective","defiant","delicate","delicious","delightful","demonic","delirious","dependent","depressed","deranged","descriptive","deserted","detailed","determined","devilish","didactic","different","difficult","diligent","direful","dirty","disagreeable","disastrous","discreet","disgusted","disgusting","disillusioned","dispensable","distinct","disturbed","divergent","dizzy","domineering","doubtful","drab","draconian","dramatic","dreary","drunk","dry","dull","dusty","dusty","dynamic","dysfunctional",
    "eager","early","earsplitting","earthy","easy","eatable","economic","educated","efficacious","efficient","eight","elastic","elated","elderly","electric","elegant","elfin","elite","embarrassed","eminent","empty","enchanted","enchanting","encouraging","endurable","energetic","enormous","entertaining","enthusiastic","envious","equable","equal","erect","erratic","ethereal","evanescent","evasive","even","excellent","excited","exciting","exclusive","exotic","expensive","extra","exuberant","exultant",
    "fabulous","faded","faint","fair","faithful","fallacious","false","familiar","famous","fanatical","fancy","fantastic","far","fascinated","fast","fat","faulty","fearful","fearless","feeble","feigned","female","fertile","festive","few","fierce","filthy","fine","finicky","first","five","fixed","flagrant","flaky","flashy","flat","flawless","flimsy","flippant","flowery","fluffy","fluttering","foamy","foolish","foregoing","forgetful","fortunate","four","frail","fragile","frantic","free","freezing","frequent","fresh","fretful","friendly","frightened","frightening","full","fumbling","functional","funny","furry","furtive","future","futuristic","fuzzy",
    "gabby","gainful","gamy","gaping","garrulous","gaudy","general","gentle","giant","giddy","gifted","gigantic","glamorous","gleaming","glib","glistening","glorious","glossy","godly","good","goofy","gorgeous","graceful","grandiose","grateful","gratis","gray","greasy","great","greedy","green","grey","grieving","groovy","grotesque","grouchy","grubby","gruesome","grumpy","guarded","guiltless","gullible","gusty","guttural",
    "habitual","half","hallowed","halting","handsome","handsomely","handy","hanging","hapless","happy","hard","harmonious","harsh","hateful","heady","healthy","heartbreaking","heavenly","heavy","hellish","helpful","helpless","hesitant","hideous","high","highfalutin","hilarious","hissing","historical","holistic","hollow","homeless","homely","honorable","horrible","hospitable","hot","huge","hulking","humdrum","humorous","hungry","hurried","hurt","hushed","husky","hypnotic","hysterical",
    "icky","icy","idiotic","ignorant","ill","illegal","illustrious","imaginary","immense","imminent","impartial","imperfect","impolite","important","imported","impossible","incandescent","incompetent","inconclusive","industrious","incredible","inexpensive","infamous","innate","innocent","inquisitive","insidious","instinctive","intelligent","interesting","internal","invincible","irate","irritating","itchy",
    "jaded","jagged","jazzy","jealous","jittery","jobless","jolly","joyous","judicious","juicy","jumbled","jumpy","juvenile",
    "kaput","keen","kind","kindhearted","kindly","knotty","knowing","knowledgeable","known",
    "labored","lackadaisical","lacking","lame","lamentable","languid","large","last","late","laughable","lavish","lazy","lean","learned","left","legal","lethal","level","lewd","light","like","likeable","limping","literate","little","lively","lively","living","lonely","long","longing","loose","lopsided","loud","loutish","lovely","loving","low","lowly","lucky","ludicrous","lumpy","lush","luxuriant","lying","lyrical",
    "macabre","macho","maddening","madly","magenta","magical","magnificent","majestic","makeshift","male","malicious","mammoth","maniacal","many","marked","massive","married","marvelous","material","materialistic","mature","mean","measly","meaty","medical","meek","mellow","melodic","melted","merciful","mere","messy","mighty","military","milky","mindless","miniature","minor","miscreant","misty","mixed","moaning","modern","moldy","momentous","motionless","mountainous","muddled","mundane","murky","mushy","mute","mysterious",
    "naive","nappy","narrow","nasty","natural","naughty","nauseating","near","neat","nebulous","necessary","needless","needy","neighborly","nervous","new","next","nice","nifty","nimble","nine","nippy","noiseless","noisy","nonchalant","nondescript","nonstop","normal","nostalgic","nosy","noxious","null","numberless","numerous","nutritious","nutty",
    "oafish","obedient","obeisant","obese","obnoxious","obscene","obsequious","observant","obsolete","obtainable","oceanic","odd","offbeat","old","omniscient","one","onerous","open","opposite","optimal","orange","ordinary","organic","ossified","outgoing","outrageous","outstanding","oval","overconfident","overjoyed","overrated","overt","overwrought",
    "painful","painstaking","pale","paltry","panicky","panoramic","parallel","parched","parsimonious","past","pastoral","pathetic","peaceful","penitent","perfect","periodic","permissible","perpetual","petite","petite","phobic","physical","picayune","pink","piquant","placid","plain","plant","plastic","plausible","pleasant","plucky","pointless","poised","polite","political","poor","possessive","possible","powerful","precious","premium","present","pretty","previous","pricey","prickly","private","probable","productive","profuse","protective","proud","psychedelic","psychotic","public","puffy","pumped","puny","purple","purring","pushy","puzzled","puzzling",
    "quack","quaint","quarrelsome","questionable","quick","quickest","quiet","quirky","quixotic","quizzical",
    "rabid","racial","ragged","rainy","rambunctious","rampant","rapid","rare","raspy","ratty","ready","real","rebel","receptive","recondite","red","redundant","reflective","regular","relieved","remarkable","reminiscent","repulsive","resolute","resonant","responsible","rhetorical","rich","right","righteous","rightful","rigid","ripe","ritzy","roasted","robust","romantic","roomy","rotten","rough","round","royal","ruddy","rude","rural","rustic","ruthless",
    "sable","sad","safe","salty","same","sassy","satisfying","savory","scandalous","scarce","scared","scary","scattered","scientific","scintillating","scrawny","screeching","second","secret","secretive","sedate","seemly","selective","selfish","separate","serious","shaggy","shaky","shallow","sharp","shiny","shivering","shocking","short","shrill","shut","shy","sick","silent","silent","silky","silly","simple","simplistic","sincere","six","skillful","skinny","sleepy","slim","slimy","slippery","sloppy","slow","small","smart","smelly","smiling","smoggy","smooth","sneaky","snobbish","snotty","soft","soggy","solid","somber","sophisticated","sordid","sore","sore","sour","sparkling","special","spectacular","spicy","spiffy","spiky","spiritual","spiteful","splendid","spooky","spotless","spotted","spotty","spurious","squalid","square","squealing","squeamish","staking","stale","standing","statuesque","steadfast","steady","steep","stereotyped","sticky","stiff","stimulating","stingy","stormy","straight","strange","striped","strong","stupendous","stupid","sturdy","subdued","subsequent","substantial","successful","succinct","sudden","sulky","super","superb","superficial","supreme","swanky","sweet","sweltering","swift","symptomatic","synonymous",
    "taboo","tacit","tacky","talented","tall","tame","tan","tangible","tangy","tart","tasteful","tasteless","tasty","tawdry","tearful","tedious","teeny","telling","temporary","ten","tender","tense","tense","tenuous","terrible","terrific","tested","testy","thankful","therapeutic","thick","thin","thinkable","third","thirsty","thirsty","thoughtful","thoughtless","threatening","three","thundering","tidy","tight","tightfisted","tiny","tired","tiresome","toothsome","torpid","tough","towering","tranquil","trashy","tremendous","tricky","trite","troubled","truculent","true","truthful","two","typical",
    "ubiquitous","ugliest","ugly","ultra","unable","unaccountable","unadvised","unarmed","unbecoming","unbiased","uncovered","understood","undesirable","unequal","unequaled","uneven","unhealthy","uninterested","unique","unkempt","unknown","unnatural","unruly","unsightly","unsuitable","untidy","unused","unusual","unwieldy","unwritten","upbeat","uppity","upset","uptight","used","useful","useless","utopian","utter","uttermost",
    "vacuous","vagabond","vague","valuable","various","vast","vengeful","venomous","verdant","versed","victorious","vigorous","violent","violet","vivacious","voiceless","volatile","voracious","vulgar",
    "wacky","waggish","waiting","wakeful","wandering","wanting","warlike","warm","wary","wasteful","watery","weak","wealthy","weary","wet","whimsical","whispering","white","whole","wholesale","wicked","wide","wiggly","wild","willing","windy","wiry","wise","wistful","witty","woebegone","womanly","wonderful","wooden","woozy","workable","worried","worthless","wrathful","wretched","wrong","wry",
    "xenophobic","yellow","yielding","young","youthful","yummy","zany","zealous","zesty","zippy","zonked"
]



const nouns: string[] = [
    "a","ability","abroad","abuse","access","accident","account","act","action","active","activity","actor","ad","addition","address","administration","adult","advance","advantage","advertising","advice","affair","affect","afternoon","age","agency","agent","agreement","air","airline","airport","alarm","alcohol","alternative","ambition","amount","analysis","analyst","anger","angle","animal","annual","answer","anxiety","anybody","anything","anywhere","apartment","appeal","appearance","apple","application","appointment","area","argument","arm","army","arrival","art","article","aside","ask","aspect","assignment","assist","assistance","assistant","associate","association","assumption","atmosphere","attack","attempt","attention","attitude","audience","author","average","award","awareness",
    "baby","back","background","bad","bag","bake","balance","ball","band","bank","bar","base","baseball","basis","basket","bat","bath","bathroom","battle","beach","bear","beat","beautiful","bed","bedroom","beer","beginning","being","bell","belt","bench","bend","benefit","bet","beyond","bicycle","bid","big","bike","bill","bird","birth","birthday","bit","bite","bitter","black","blame","blank","blind","block","blood","blow","blue","board","boat","body","bone","bonus","book","boot","border","boss","bother","bottle","bottom","bowl","box","boy","boyfriend","brain","branch","brave","bread","break","breakfast","breast","breath","brick","bridge","brief","brilliant","broad","brother","brown","brush","buddy","budget","bug","building","bunch","burn","bus","business","button","buy","buyer",
    "cabinet","cable","cake","calendar","call","calm","camera","camp","campaign","can","cancel","cancer","candidate","candle","candy","cap","capital","car","card","care","career","carpet","carry","case","cash","cat","catch","category","cause","celebration","cell","chain","chair","challenge","champion","championship","chance","change","channel","chapter","character","charge","charity","chart","check","cheek","chemical","chemistry","chest","chicken","child","childhood","chip","chocolate","choice","church","cigarette","city","claim","class","classic","classroom","clerk","click","client","climate","clock","closet","clothes","cloud","club","clue","coach","coast","coat","code","coffee","cold","collar","collection","college","combination","combine","comfort","comfortable","command","comment","commercial","commission","committee","common","communication","community","company","comparison","competition","complaint","complex","computer","concentrate","concept","concern","concert","conclusion","condition","conference","confidence","conflict","confusion","connection","consequence","consideration","consist","constant","construction","contact","contest","context","contract","contribution","control","conversation","convert","cook","cookie","copy","corner","cost","count","counter","country","county","couple","courage","course","court","cousin","cover","cow","crack","craft","crash","crazy","cream","creative","credit","crew","criticism","cross","cry","culture","cup","currency","current","curve","customer","cut","cycle",
    "dad","damage","dance","dare","dark","data","database","date","daughter","day","dead","deal","dealer","dear","death","debate","debt","decision","deep","definition","degree","delay","delivery","demand","department","departure","dependent","deposit","depression","depth","description","design","designer","desire","desk","detail","development","device","devil","diamond","diet","difference","difficulty","dig","dimension","dinner","direction","director","dirt","disaster","discipline","discount","discussion","disease","dish","disk","display","distance","distribution","district","divide","doctor","document","dog","door","dot","double","doubt","draft","drag","drama","draw","drawer","drawing","dream","dress","drink","drive","driver","drop","drunk","due","dump","dust","duty",
    "ear","earth","ease","east","eat","economics","economy","edge","editor","education","effect","effective","efficiency","effort","egg","election","elevator","emergency","emotion","emphasis","employ","employee","employer","employment","end","energy","engine","engineer","engineering","entertainment","enthusiasm","entrance","entry","environment","equal","equipment","equivalent","error","escape","essay","establishment","estate","estimate","evening","event","evidence","exam","examination","example","exchange","excitement","excuse","exercise","exit","experience","expert","explanation","expression","extension","extent","external","extreme","eye",
    "face","fact","factor","fail","failure","fall","familiar","family","fan","farm","farmer","fat","father","fault","fear","feature","fee","feed","feedback","feel","feeling","female","few","field","fight","figure","file","fill","film","final","finance","finding","finger","finish","fire","fish","fishing","fix","flight","floor","flow","flower","fly","focus","fold","following","food","foot","football","force","forever","form","formal","fortune","foundation","frame","freedom","friend","friendship","front","fruit","fuel","fun","function","funeral","funny","future",
    "gain","game","gap","garage","garbage","garden","gas","gate","gather","gear","gene","general","gift","girl","girlfriend","give","glad","glass","glove","go","goal","god","gold","golf","good","government","grab","grade","grand","grandfather","grandmother","grass","great","green","grocery","ground","group","growth","guarantee","guard","guess","guest","guidance","guide","guitar","guy",
    "habit","hair","half","hall","hand","handle","hang","harm","hat","hate","head","health","hearing","heart","heat","heavy","height","hell","hello","help","hide","high","highlight","highway","hire","historian","history","hit","hold","hole","holiday","home","homework","honey","hook","hope","horror","horse","hospital","host","hotel","hour","house","housing","human","hunt","hurry","hurt","husband",
    "ice","idea","ideal","if","illegal","image","imagination","impact","implement","importance","impress","impression","improvement","incident","income","increase","independence","independent","indication","individual","industry","inevitable","inflation","influence","information","initial","initiative","injury","insect","inside","inspection","inspector","instance","instruction","insurance","intention","interaction","interest","internal","international","internet","interview","introduction","investment","invite","iron","island","issue","it","item",
    "jacket","job","join","joint","joke","judge","judgment","juice","jump","junior","jury",
    "keep","key","kick","kid","kill","kind","king","kiss","kitchen","knee","knife","knowledge",
    "lab","lack","ladder","lady","lake","land","landscape","language","laugh","law","lawyer","lay","layer","lead","leader","leadership","leading","league","leather","leave","lecture","leg","length","lesson","let","letter","level","library","lie","life","lift","light","limit","line","link","lip","list","listen","literature","living","load","loan","local","location","lock","log","long","look","loss","love","low","luck","lunch",
    "machine","magazine","mail","main","maintenance","major","make","male","mall","man","management","manager","manner","manufacturer","many","map","march","mark","market","marketing","marriage","master","match","mate","material","math","matter","maximum","maybe","meal","meaning","measurement","meat","media","medicine","medium","meet","meeting","member","membership","memory","mention","menu","mess","message","metal","method","middle","midnight","might","milk","mind","mine","minimum","minor","minute","mirror","miss","mission","mistake","mix","mixture","mobile","mode","model","mom","moment","money","monitor","month","mood","morning","mortgage","most","mother","motor","mountain","mouse","mouth","move","movie","mud","muscle","music",
    "nail","name","nasty","nation","national","native","natural","nature","neat","necessary","neck","negative","negotiation","nerve","net","network","news","newspaper","night","nobody","noise","normal","north","nose","note","nothing","notice","novel","number","nurse",
    "object","objective","obligation","occasion","offer","office","officer","official","oil","one","opening","operation","opinion","opportunity","opposite","option","orange","order","ordinary","organization","original","other","outcome","outside","oven","owner",
    "pace","pack","package","page","pain","paint","painting","pair","panic","paper","parent","park","parking","part","particular","partner","party","pass","passage","passenger","passion","past","path","patience","patient","pattern","pause","pay","payment","peace","peak","pen","penalty","pension","people","percentage","perception","performance","period","permission","permit","person","personal","personality","perspective","phase","philosophy","phone","photo","phrase","physical","physics","piano","pick","picture","pie","piece","pin","pipe","pitch","pizza","place","plan","plane","plant","plastic","plate","platform","play","player","pleasure","plenty","poem","poet","poetry","point","police","policy","politics","pollution","pool","pop","population","position","positive","possession","possibility","possible","post","pot","potato","potential","pound","power","practice","preference","preparation","presence","present","presentation","president","press","pressure","price","pride","priest","primary","principle","print","prior","priority","private","prize","problem","procedure","process","produce","product","profession","professional","professor","profile","profit","program","progress","project","promise","promotion","prompt","proof","property","proposal","protection","psychology","public","pull","punch","purchase","purple","purpose","push","put",
    "quality","quantity","quarter","queen","question","quiet","quit","quote",
    "race","radio","rain","raise","range","rate","ratio","raw","reach","reaction","read","reading","reality","reason","reception","recipe","recognition","recommendation","record","recording","recover","red","reference","reflection","refrigerator","refuse","region","register","regret","regular","relation","relationship","relative","release","relief","remote","remove","rent","repair","repeat","replacement","reply","report","representative","republic","reputation","request","requirement","research","reserve","resident","resist","resolution","resolve","resort","resource","respect","respond","response","responsibility","rest","restaurant","result","return","reveal","revenue","review","revolution","reward","rice","rich","ride","ring","rip","rise","risk","river","road","rock","role","roll","roof","room","rope","rough","round","routine","row","royal","rub","ruin","rule","run","rush",
    "sad","safe","safety","sail","salad","salary","sale","salt","sample","sand","sandwich","satisfaction","save","savings","scale","scene","schedule","scheme","school","science","score","scratch","screen","screw","script","sea","search","season","seat","second","secret","secretary","section","sector","security","selection","self","sell","senior","sense","sensitive","sentence","series","serve","service","session","set","setting","sex","shake","shame","shape","share","she","shelter","shift","shine","ship","shirt","shock","shoe","shoot","shop","shopping","shot","shoulder","show","shower","sick","side","sign","signal","signature","significance","silly","silver","simple","sing","singer","single","sink","sir","sister","site","situation","size","skill","skin","skirt","sky","sleep","slice","slide","slip","smell","smile","smoke","snow","society","sock","soft","software","soil","solid","solution","somewhere","son","song","sort","sound","soup","source","south","space","spare","speaker","special","specialist","specific","speech","speed","spell","spend","spirit","spiritual","spite","split","sport","spot","spray","spread","spring","square","stable","staff","stage","stand","standard","star","start","state","statement","station","status","stay","steak","steal","step","stick","still","stock","stomach","stop","storage","store","storm","story","strain","stranger","strategy","street","strength","stress","stretch","strike","string","strip","stroke","structure","struggle","student","studio","study","stuff","stupid","style","subject","substance","success","suck","sugar","suggestion","suit","summer","sun","supermarket","support","surgery","surprise","surround","survey","suspect","sweet","swim","swimming","swing","switch","sympathy","system",
    "table","tackle","tale","talk","tank","tap","target","task","taste","tax","tea","teach","teacher","teaching","team","tear","technology","telephone","television","tell","temperature","temporary","tennis","tension","term","test","text","thanks","theme","theory","thing","thought","throat","ticket","tie","till","time","tip","title","today","toe","tomorrow","tone","tongue","tonight","tool","tooth","top","topic","total","touch","tough","tour","tourist","towel","tower","town","track","trade","tradition","traffic","train","trainer","training","transition","transportation","trash","travel","treat","tree","trick","trip","trouble","truck","trust","truth","try","tune","turn","twist","two","type",
    "uncle","understanding","union","unique","unit","university","upper","upstairs","use","user","usual",
    "vacation","valuable","value","variation","variety","vast","vegetable","vehicle","version","video","view","village","virus","visit","visual","voice","volume",
    "wait","wake","walk","wall","war","warning","wash","watch","water","wave","way","weakness","wealth","wear","weather","web","wedding","week","weekend","weight","weird","welcome","west","western","wheel","whereas","while","white","whole","wife","will","win","wind","window","wine","wing","winner","winter","wish","witness","woman","wonder","wood","word","work","worker","working","world","worry","worth","wrap","writer","writing",
    "yard","year","yellow","yesterday","you","young","youth","zone"
]

function getRandomName(): string {
    var rand1: number = Math.floor(Math.random()*adjectives.length);
    var rand2: number = Math.floor(Math.random()*nouns.length);
    return adjectives[rand1] + "_" + nouns[rand2];
}

function showTerminal(id: string) {
    if (g_Terminals.hasOwnProperty(id)) {
        // just show the terminal if it was already created for this container
        if (id) g_Terminals[id].show();
    } else {

        // create a new terminal and show it
        g_Terminals[id]  = vscode.window.createTerminal(id);
        g_Terminals[id].show();
        g_Terminals[id].sendText('docker attach ' + id, true);
    }
}


function startContainerFromTerminal(id: string, view: boolean, cb) {
    var name = getRandomName();

    //if (g_Terminals.hasOwnProperty(name)) {
    //    // just show the terminal if it was already created for this container
    //    if (view) g_Terminals[name].show();
    //} else {

        //var cc :any = g_Config[id];
        //var params: string = cc.config.run;

        var params: string =  "-i -t --rm --name $default-name -v $workspace:$src " + id + " bash";

        // create a new terminal and show it
        g_Terminals[name]  = vscode.window.createTerminal(name);
        if (view) g_Terminals[name].show();

        // check if we already have this process isRunning

        docker.ps(false, function(result) {
            var exists: boolean = false;

            if (result) {
                for (var i = 0; i < result.rows.length; i++) {
                    if (result.rows[i].names == name) {
                        exists = true;
                    }
                }
            }

            if (exists) {
                g_Terminals[name].sendText('docker attach ' + name, true);
                docker.attach(id, /*g_Config[id].config.compatible*/ false, function(result) {
                    cb();
                });
            } else {
                var src = '/src';

                //if (g_Config[id].config.src) {
                //    src = g_Config[id].config.src;
                //}

                params = params.replace('$default-name', name);
                params = params.replace('$workspace', vscode.workspace.rootPath);
                params = params.replace('$src', src);


                g_Terminals[name].sendText('docker run ' + params, true);

                setTimeout(function() {
                    docker.attach(id, /*g_Config[id].config.compatible*/ false, function(result) {
                        cb();
                    });
                }, 3000)
            }
        });
    //}

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

/**
 * Load config.json file
 */
function loadConfig() {
    try {
        g_Config = JSON.parse(fs.readFileSync(g_StoragePath + '/config.json'));
    } catch (e) {
        console.log('--- FAILED ---');
        g_Config = {};
    }
}

/**
 * Save config.json file
 */
function saveConfig() {
    fs.mkdirParent(g_StoragePath, undefined, function () {
        fs.writeFileSync(g_StoragePath + '/config.json', JSON.stringify(g_Config, null, 2));
    })
}
