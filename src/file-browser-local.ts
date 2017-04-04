
import { FileBrowser } from './file-browser';
var fs = require('fs');

export class FileBrowserLocal extends FileBrowser
{
    constructor(path: string = '/')
    {
         super(path);
    }

    dir()
    {
        var dir = {
            headers: ['name'],
            rows: [],            
            onSelect: ['command:extension.localFileOptions', '$name'],
            onAltSelect: ['command:extension.localFileOpen', '$name']
        };
        var dirs = fs.readdirSync(this.m_CurrentDirectory);

        dir.rows.push({ name: '.' });
        dir.rows.push({ name: '..' });

        for (var i: number = 0; i < dirs.length; i++) {
            dir.rows.push({ name: dirs[i] });
        }

        this.preview(dir);            
    }

    getViewerName(): string
    {
        return 'local-dir';
    }

    getViewerTitle(): string
    {
        return 'Local FS';
    }

    getPanel(): number
    {
        return 2;
    }

    getFullPath()
    {
        return this.m_CurrentDirectory;
    }

    copy(from: string, to: string)
    {
        // use FileBrowserDocker to perform copy operation
        this.m_OppositeBrowser.copy(from, to);   
    }
}
