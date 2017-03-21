'use strict';

import * as vscode from 'vscode';

var fs = require('fs');

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

    public setExtensionPath(path: string) {
        this.m_ExtensionPath = path;
    }

    public createPreviewFromObject(o : object) {

        this.documentStart('xxx');

        this.documentTableStart(o['headers']);

        for (var i: number = 0; i < o['rows'].length; i++) {
            this.responseTableRowStart();

            for (var j: number = 0; j < o['headers'].length; j++) {
                this.responseTableCell(o['rows'][i][o['headers'][j]]);
            } 

            this.responseTableRowEnd();
        }

        this.responseTableEnd();

        this.documentEnd();

        this.preview(this.m_CurrentDocument);
    }

    private m_CurrentDocument = '';
    private m_ExtensionPath = '';

    private documentStart(title) {
        this.m_CurrentDocument = '';
        var css = fs.readFileSync(this.m_ExtensionPath + '/css.txt')
        var script = fs.readFileSync(this.m_ExtensionPath + '/script.js')

        this.write('<!DOCTYPE "html">');
        this.write("<html>");
        this.write("<head>");
        this.write("<title>" + title + "</title>");
        this.write("</head>");
        this.write(css);
        this.write('<script>' + script + '</script>');
        this.write("<body>");

        this.write('<h1 id="buka">' + title + '</h1>');
    }

    private documentEnd() {
        this.write("</body>");
        this.write("</html>");
    }

    private documentTableStart(headers) {
        this.write("<table cellspacing='0'>");

        this.responseTableRowStart();

        for (var i in headers) {
            this.write('<th>' + headers[i] + '</th>');
        }

        this.responseTableRowEnd();
    }

    private responseTableEnd() {
        this.write('</table>');
    }

    private responseTableRowStart() {
        this.write('<tr>');
    }

    private responseTableRowEnd() {
        this.write('</tr>');
    }

    private responseTableCell(text) {
        this.write('<td>' + text + '</td>');
    }

    private responseTableButton(text, url) {
        var js = 'window.location.href="' + url + '"';

        this.write("<td><button onclick='" + js + "'>" + text + "</button></td>");
    }

    private responseButtonJs(text, js) {
        this.write("<button onclick='" + js + "'>" + text + "</button>");
    }

    private responseWriteLink(text, link) {
        this.write("<a href='" + link + "'>" + text + "</a>");
    }

    private write(s: string) {
        this.m_CurrentDocument += s;
    }
}