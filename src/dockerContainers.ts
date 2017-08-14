import * as path from "path";
import * as vscode from "vscode";
import { AppInsightsClient } from "./appInsightsClient";
import { DockerTreeBase } from "./dockerTreeBase";
import { DockerContainer } from "./Model/DockerContainer";
import { Utility } from "./utility";

import { Docker } from "./docker"

export class DockerContainers extends DockerTreeBase<DockerContainer> implements vscode.TreeDataProvider<DockerContainer> {
    private containerStrings = [];

    constructor(context: vscode.ExtensionContext, docker: Docker) {
        super(context);
        this.docker = docker;
    }

    public searchContainer(): void {
        AppInsightsClient.sendEvent("searchContainer");
        const interval = Utility.getConfiguration().get<number>("autoRefreshInterval");
        let containerStrings = [];
        if (interval > 0 && this.containerStrings.length > 0) {
            this.containerStrings.forEach((containerString) => {
                const items = containerString.split(" ");
                containerStrings.push(`${items[1]} (${items[2]})`);
            });
        } else {
            //containerStrings = Executor.execSync("docker ps -a --format \"{{.Names}} ({{.Image}})\"").split(/[\r\n]+/g).filter((item) => item);
        }

        vscode.window.showQuickPick(containerStrings, { placeHolder: "Search Docker Container" }).then((containerString) => {
            if (containerString !== undefined) {
                const items = containerString.split(" ");
                this.getContainer(items[0]);
            }
        });
    }

    public getTreeItem(element: DockerContainer): vscode.TreeItem {
        return element;
    }

    public getChildren(element?: DockerContainer): Thenable<DockerContainer[]> {

        return new Promise((resolve,reject) => {
 
            try {
                this.docker.ps(true, (result) => {
                    const containers = [];
                    for (var c of result.rows) {
                        containers.push(new DockerContainer(c['container id'],
                                                            c['names'],
                                                            c['image'],
                                                            this.context.asAbsolutePath(path.join("resources", c['status'] === "Up" ? "container-on.png" : "container-off.png")),
                                                            {
                                                                command: "docker-explorer.getContainer",
                                                                title: "",
                                                                arguments: c['names']
                                                            }                            
                        ));
                    }

                    resolve(containers);
                })
            } catch (error) {
                if (!DockerTreeBase.isErrorMessageShown) {
                    vscode.window.showErrorMessage(`[Failed to list Docker Containers] ${error.stderr}`);
                    DockerTreeBase.isErrorMessageShown = true;
                }

                reject(new Error("Failed to query containers"));
            } finally {
                this.setAutoRefresh();
            }
        });
    }

    public getContainer(containerName: string): void {
//        Executor.runInTerminal(`docker ps -a --filter "name=${containerName}"`);
//        AppInsightsClient.sendEvent("getContainer");
    }

    public startContainer(containerName: string): void {
//        Executor.runInTerminal(`docker start ${containerName}`);
//        AppInsightsClient.sendEvent("startContainer");
    }

    public stopContainer(containerName: string): void {
//        Executor.runInTerminal(`docker stop ${containerName}`);
//        AppInsightsClient.sendEvent("stopContainer");
    }

    public restartContainer(containerName: string): void {
//        Executor.runInTerminal(`docker restart ${containerName}`);
//        AppInsightsClient.sendEvent("restartContainer");
    }

    public showContainerStatistics(containerName: string): void {
//        Executor.runInTerminal(`docker stats ${containerName}`);
//        AppInsightsClient.sendEvent("showContainerStatistics");
    }

    public showContainerLogs(containerName: string): void {
//        Executor.runInTerminal(`docker logs ${containerName}`);
//        AppInsightsClient.sendEvent("showContainerLogs");
    }

    public removeContainer(containerName: string): void {
//        Executor.runInTerminal(`docker rm ${containerName}`);
//        AppInsightsClient.sendEvent("removeContainer");
    }

    public executeCommandInContainer(containerName: string): void {
//        const command = Utility.getConfiguration().get<string>("executionCommand");
//        if (command) {
//            Executor.runInTerminal(`docker exec ${containerName} ${command}`);
//        } else {
//            Executor.runInTerminal(`docker exec ${containerName} `, false);
//        }
//        AppInsightsClient.sendEvent("executeCommandInContainer", command ? { executionCommand: command } : {});
    }

    public executeInBashInContainer(containerName: string): void {
//        Executor.runInTerminal(`docker exec -it ${containerName} bash`, true, containerName);
//        AppInsightsClient.sendEvent("executeInBashInContainer");
    }

    private docker: Docker = null;
}
