'use strict';

import * as vscode from 'vscode';

var fs = require('fs');
var Convert = require('ansi-to-html');
var convert = new Convert();


export class HtmlView implements vscode.TextDocumentContentProvider {

    /**
     * Get static instance of HtmlView object
     */
    public static getInstance() : HtmlView {
        return provider;
    }

    /**
     * Provide document for specific URI. This function is used by VSCode
     * @param uri 
     * @param token 
     */
    public provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken) : vscode.ProviderResult<string> {

        return this.m_InternalPages[uri.toString()];
    };

    /**
     * Used by VSCode
     */
	public onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();

	get onDidChange(): vscode.Event<vscode.Uri> { return this.onDidChangeEmitter.event; }

    /**
     * View HTML document
     * @param uri 
     * @param html 
     * @param title 
     * @param panel 
     */
    public preview(uri: string, html: string, title: string, panel: number, refreshOnly: boolean) {
        this.m_InternalPages[uri] = html; 

        var x = vscode.workspace.textDocuments;

        for (var d of x) {
            if (d.uri.toString() == uri) {
                console.log('FOUND');
                this.onDidChangeEmitter.fire(vscode.Uri.parse(uri));
                return; 
            }
        }

        // document not visible, so don't display it, user requested just refresh
        if (refreshOnly)
            return;

        // only call preview if document really changed
        vscode.commands.executeCommand('vscode.previewHtml', uri, panel, title);
    }

    /**
     * Setting current extension path.
     * It's used to load CSS, JS, and other relevant files.
     * @param path 
     */
    public setExtensionPath(path: string) {
        this.m_ExtensionPath = path;
    }


    /**
     * View AdaptiveCard as HTML
     * @param type 
     * @param title 
     * @param action
     * @param panel 
     */
    public createAdaptiveCardPreview(type: string, title: string, action: object, panel: number = 1, cb) {

        this.cb = cb;
        var script = fs.readFileSync(this.m_ExtensionPath + "/html/botchat.js", "utf8");
        var css1 = fs.readFileSync(this.m_ExtensionPath + "/html/botchat.css", "utf8");
        var css2 = fs.readFileSync(this.m_ExtensionPath + "/html/botchat-fullwindow.css", "utf8");
        
        var start = fs.readFileSync(this.m_ExtensionPath + "/html/single-start.html", "utf8");
        var end = fs.readFileSync(this.m_ExtensionPath + "/html/single-end.html", "utf8");
        
        

        var document = start + "\r\n<script>\r\n" + script + "\r\n\r\n var ACTIVITY = " + JSON.stringify(action) + ";\r\n </script>\r\n" +
                                         "<style>\r\n" + css1 + "\r\n" + css2 + "\r\n</style>\r\n" + end;
        
        //fs.writeFileSync(this.m_ExtensionPath + "/html/updated.html", this.m_CurrentDocument);

        this.preview('xxx://internal/' + type, document, title, panel, false);
    }
        
    /**
     * Handle event from the view.
     * 
     * @param r 
     */
    public handleEvent(r: string) {
        if (this.cb) this.cb(r);
    }

    // global variables -- not all of them should be global
    private m_InternalPages : {} = {};
    private m_ExtensionPath = '';

    // for now just single callback
    private cb = null;    
}

var provider = new HtmlView();
// Handle http:// and https://.
var registrationXxx = vscode.workspace.registerTextDocumentContentProvider('xxx', provider);
