
import { Docker } from './docker';
import { FileBrowser } from './file-browser';

export class FileBrowserDocker extends FileBrowser
{
    constructor(docker: Docker, containerId: string, path: string = '/')
    {
        super(path);
        this.m_Docker = docker;
        this.m_ContainerId = containerId;
    }

    dir()
    {
        var __this: FileBrowserDocker = this;
        this.m_Docker.dir(this.m_ContainerId, this.m_CurrentDirectory, function(dir) {

            dir['onSelect'] = ['command:extension.fileOptions', '$name', '$access'];
            dir['onAltSelect'] = ['command:extension.fileOpen', '$name', '$access'];

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

    private m_Docker: Docker = null;
    private m_ContainerId: string = '';
}