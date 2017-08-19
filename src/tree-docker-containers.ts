import * as path from "path";
import * as vscode from "vscode";
import { AppInsightsClient } from "./appInsightsClient";
import { DockerTreeBase } from "./tree-base";
import { DockerContainer } from "./DockerContainer";

import { Docker } from "./docker"

export class DockerContainers extends DockerTreeBase<DockerContainer> implements vscode.TreeDataProvider<DockerContainer> {
    private containerStrings = [];

    constructor(context: vscode.ExtensionContext, docker: Docker) {
        super(context);
        this.docker = docker;
    }

    public getTreeItem(element: DockerContainer): vscode.TreeItem {
        return element;
    }

    public getChildren(element?: DockerContainer): Thenable<DockerContainer[]> {
        return new Promise((resolve,reject) => {
            this.docker.ps(true, (result) => {
                if (result)
                {
                    const containers = [];
                    for (var c of result.rows) {
                        containers.push(new DockerContainer(c['container id'],
                                                            c['names'],
                                                            c['image'],
                                                            this.context.asAbsolutePath(path.join("resources", c['status'].startsWith("Up") ? (c['status'].indexOf('Paused') < 0 ? "container-on.png" : "container-paused.png") : "container-off.png")),
                                                            {
                                                                command: "extension.containerOptions",
                                                                title: "",
                                                                arguments: [c['names'], c['status'], c['image']]
                                                            }                            
                        ));
                    }

                    this.setAutoRefresh();
                    resolve(containers);
                }
                else {
                    reject(new Error("container query failed"));
                }
            })
        });
    }

    private docker: Docker = null;
}
