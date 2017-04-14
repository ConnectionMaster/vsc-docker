
import { HtmlView } from './html';
import * as vscode from 'vscode';

export abstract class FileBrowser
{
    constructor(path: string = '/')
    {
        this.m_CurrentDirectory = path;
    }

    public setOppositeBrowser(browser: FileBrowser)
    {
        this.m_OppositeBrowser = browser;

        this.refreshHtml();
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

    public options(name: string)
    {
        var items:string[] = [];

        items.push('Open');
        items.push('Copy');

        vscode.window.showQuickPick(items).then( selected => {
            if (selected == 'Copy') {
                this.copy(this.getFullPath() + '/' + name, this.m_OppositeBrowser.getFullPath());
                this.m_OppositeBrowser.refresh();
            } else if (selected == 'Open') {
                this.open(name);
            }
        })
        
    }

    abstract dir();
    abstract getViewerName(): string;
    abstract getViewerTitle(): string;
    abstract getPanel(): number;
    abstract copy(from: string, to: string);
    abstract getFullPath();

    protected preview(dir: any)
    {
        dir['title'] = this.m_CurrentDirectory;
        this.m_CurrentContent = dir;
        this.refreshHtml();

    }

    protected refreshHtml() {
        if (this.m_OppositeBrowser && this.m_CurrentContent && this.m_OppositeBrowser.m_CurrentContent) {
            var html: HtmlView = HtmlView.getInstance();
            var o: {} = { title: 'File Browser', panels: [this.m_CurrentContent, this.m_OppositeBrowser.m_CurrentContent] };
            html.createPreviewFromObject(this.getViewerName(), this.getViewerTitle(), o, 1, '');
        }
    }

    public getPath() : string
    {
        return this.m_CurrentDirectory;
    }

    public refresh()
    {
        this.dir();
    }

    protected m_CurrentDirectory: string = '';
    protected m_OppositeBrowser: FileBrowser;
    private m_CurrentContent: any;
}
