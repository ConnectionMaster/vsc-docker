import * as path from "path";
import * as vscode from "vscode";
import { AppInsightsClient } from "./appInsightsClient";
import { DockerTreeBase } from "./dockerTreeBase";
import { ACRHierachy } from "./Model/ACRHierachy";
import { DockerImage } from "./Model/DockerImage";
import { Utility } from "./utility";

import { Docker } from "./docker"

export class DockerImages extends DockerTreeBase<DockerImage> implements vscode.TreeDataProvider<DockerImage> {
    constructor(context: vscode.ExtensionContext, docker: Docker) {
        super(context);
        this.docker = docker;
    }

    public getTreeItem(element: DockerImage): vscode.TreeItem {
        return element;
    }

    public getChildren(element?: DockerImage): Thenable<DockerImage[]> {
        return new Promise((resolve,reject) => {
            this.docker.images((result) => {
                if (result)
                {
                    const images = [];
                    for (var c of result.rows) {
                        images.push(new DockerImage(c['image id'],
                                                    c['repository'],
                                                    c['tag'],
                                                    this.context.asAbsolutePath(path.join("resources", "image.png")),
                                                    {
                                                        command: "extension.imageOptions",
                                                        title: "",
                                                        arguments: [c['image id'], c['repository']]
                                                    }                            
                        ));
                    }

                    this.setAutoRefresh();
                    resolve(images);
                }
                else {
                    reject(new Error("image query failed"));
                }
            })
        });
    }

    private docker: Docker = null;
}
