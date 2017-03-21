'use strict';

import * as vscode from 'vscode';

var g_internalHtml = "";

var BrowserContentProvider = (function () {
    function BrowserContentProvider() {
    }
    BrowserContentProvider.prototype.provideTextDocumentContent = function (uri, token) {
        // TODO: detect failure to load page (e.g. google.com) and display error to user.
        if (uri != 'http://internal') {
            return "<iframe src=\"" + uri + "\" frameBorder=\"0\" width=\"1024\" height=\"1024\"/>";
        } else {
            return g_internalHtml;
        }
    };
    return BrowserContentProvider;
}());

var provider = new BrowserContentProvider();
// Handle http:// and https://.
var registrationHTTPS = vscode.workspace.registerTextDocumentContentProvider('https', provider);
var registrationHTTP = vscode.workspace.registerTextDocumentContentProvider('http', provider);


export class HtmlView {
    public preview(html: string) {
        g_internalHtml = html; 
        vscode.commands.executeCommand('vscode.previewHtml', 'http://internal'); 
    }
}