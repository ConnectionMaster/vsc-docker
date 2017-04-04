
import { HtmlView } from './html';

export abstract class FileBrowser
{
    constructor(path: string = '/')
    {
        this.m_CurrentDirectory = path;
    }

    public open(name: string)
    {
        if (name != '.') {
            var newPath: string = ('/' != this.m_CurrentDirectory) ? this.m_CurrentDirectory : '';
            
            if (name != '..') {
                newPath += '/' + name;
            } else {
                if (newPath == '') {
                    newPath = '/';
                } else {
                    var temp: string[] = newPath.split('/'); //
                    temp.pop();
                    newPath = (temp.length > 1) ? temp.join('/') : '/';
                }
            }

            this.m_CurrentDirectory = newPath;

            this.dir();
        }
    }

    abstract dir();
    abstract getViewerName(): string;
    abstract getPanel(): number;

    protected preview(dir: any)
    {
        var html: HtmlView = HtmlView.getInstance();
        html.createPreviewFromObject(this.getViewerName(), dir, this.getPanel());
    }

    public getPath() : string
    {
        return this.m_CurrentDirectory;
    }

    protected m_CurrentDirectory: string = '';
}
