
import { FileBrowser } from './file-browser';
var fs = require('fs');

export class FileBrowserLocal extends FileBrowser
{
    constructor(path: string = '/')
    {
         super(path, false);
    }

    delete(name: string) {
        if (name[0] == '[') {
            name = name.substr(1, name.length - 2);
        }

        try {
            fs.unlinkSync(this.m_CurrentDirectory + '/' + name);
        } catch (e) {
            console.log(e);
        }

        this.refresh();
    }

    dir()
    {
        var dir = {
            headers: ['name', 'size', 'date'],
            rows: [],            
            onOptions: ['command:extension.localFileOptions', '$name'],
            onDefault: ['command:extension.localFileOpen', '$name'],
            onBack: ['command:extension.localFileOpen', '..'],
            onDelete: [ 'command:extension.localFileDelete', '$name']
        };
        var dirs = fs.readdirSync(this.m_CurrentDirectory);

        dir.rows.push({ name: '.', isDirectory: true, size: '', date: '' });
        dir.rows.push({ name: '..', isDirectory: true, size: '', date: '' });

        for (var i: number = 0; i < dirs.length; i++) {

            var stats = fs.statSync(this.m_CurrentDirectory + '/' + dirs[i]);

            if (stats.isDirectory()) {
                dir.rows.push({ name: dirs[i], isDirectory: true, size: stats.size.toString(), date: stats.mtime.toString() });
            }
        }

        for (var i: number = 0; i < dirs.length; i++) {

            var stats = fs.statSync(this.m_CurrentDirectory + '/' + dirs[i]);

            if (!stats.isDirectory()) {
                dir.rows.push({ name: dirs[i], isDirectory: false, size: stats.size.toString(), date: stats.mtime.toString() });
            }
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
