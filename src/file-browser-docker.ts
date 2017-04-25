
import { Docker } from './docker';
import { FileBrowser } from './file-browser';
import * as vscode from 'vscode';

export class FileBrowserDocker extends FileBrowser
{
    constructor(docker: Docker, containerId: string, path: string = '/')
    {
        super(path, true);
        this.m_Docker = docker;
        this.m_ContainerId = containerId;
    }

    delete(name: string) {
        var __this: FileBrowserDocker = this;
        this.m_Docker.rmdir(this.m_ContainerId, this.m_CurrentDirectory + '/' + name, function(result) {
            __this.refresh();
        })
    }

    dir()
    {
        var __this: FileBrowserDocker = this;
        this.m_Docker.dir(this.m_ContainerId, this.m_CurrentDirectory, function(dir) {

            for (var i: number = 0; i < dir.rows.length; i++) {
                dir.rows[i].isDirectory = (dir.rows[i].access[0] == 'd'); 
            }

            dir['onOptions'] = ['command:extension.fileOptions', '$name'],
            dir['onDefault'] = ['command:extension.fileOpen', '$name'],
            dir['onBack'] = ['command:extension.fileOpen', '..'],
            dir['onDelete'] = [ 'command:extension.fileDelete', '$name']

            __this.preview(dir);            
        })
        
    }

    getViewerName(): string
    {
        return 'docker-dir';
    }

    getViewerTitle(): string
    {
        return this.m_ContainerId +  ' FS';
    }

    getPanel(): number
    {
        return 1;
    }

    getFullPath()
    {
        return this.m_ContainerId + ':' +  this.m_CurrentDirectory;
    }

    copy(from: string, to: string)
    {
        var __this: FileBrowserDocker = this;
        this.m_Docker.cp(from, to, function(result) {
            if (result) {
                vscode.window.showInformationMessage('Files copied!');
                __this.m_OppositeBrowser.refresh();
            } else {
                vscode.window.showErrorMessage('Operation failed!');
            }
        });
    }

    private m_Docker: Docker = null;
    private m_ContainerId: string = '';
}