import * as vscode from "vscode";

export class DockerTreeBase<T> {
    protected static isErrorMessageShown = false;
    public _onDidChangeTreeData: vscode.EventEmitter<T | undefined> = new vscode.EventEmitter<T | undefined>();
    public readonly onDidChangeTreeData: vscode.Event<T | undefined> = this._onDidChangeTreeData.event;
    private _debounceTimer: NodeJS.Timer;

    constructor(protected context: vscode.ExtensionContext) {
    }

    public refreshDockerTree(): void {
        DockerTreeBase.isErrorMessageShown = false;
        this._onDidChangeTreeData.fire();
    }

    protected setAutoRefresh(): void {
        const interval = 60000; // needs to go to config
        if (interval > 0) {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = setTimeout(() => {
                this._onDidChangeTreeData.fire();
            }, interval);
        }
    }
}
