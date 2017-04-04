'use strict';

import * as vscode from 'vscode';

var fs = require('fs');
var Convert = require('ansi-to-html');
var convert = new Convert();


export class HtmlView implements vscode.TextDocumentContentProvider {

    public static getInstance() : HtmlView {
        return provider;
    }

    public provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken) : vscode.ProviderResult<string> {

        var uriString: string = uri.toString();

        // TODO: detect failure to load page (e.g. google.com) and display error to user.
        if (!uriString.startsWith('xxx://internal')) {
            return "<iframe src=\"" + uri + "\" frameBorder=\"0\" width=\"1024\" height=\"1024\"/>";
        } else {
            return this.m_InternalPages[uriString];
        }
    };


	public onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();

	get onDidChange(): vscode.Event<vscode.Uri> { return this.onDidChangeEmitter.event; }

    private m_InternalPages : {} = {};



    public preview(uri: string, html: string, title: string, panel: number) {
        this.m_InternalPages[uri] = html; 

        var x = vscode.workspace.textDocuments;

        for (var d of x) {
            if (d.uri.toString() == uri) {
                console.log('FOUND');
                this.onDidChangeEmitter.fire(vscode.Uri.parse(uri));
                return; 
            }
        }

        // only call preview if document really changed
        vscode.commands.executeCommand('vscode.previewHtml', uri, panel, title);
    }

    public setExtensionPath(path: string) {
        this.m_ExtensionPath = path;
    }

    public createPreviewFromText(type: string, text: string, title: string, panel: number = 1) {

        text = text.replace(/(\r\n|\n|\r)/gm,"<br/>");

        this.documentStart(title);
        this.documentParagraph(text);
        this.documentEnd();

        this.preview('xxx://internal/' + type, this.m_CurrentDocument, title, panel);
    }

    public createPreviewFromObject(type: string, tabTitle: string, o: object, panel: number = 1) {

        this.documentStart(o['title']);

        this.documentTableStart(o['headers']);

        var onSelect: any[] = undefined;
        var onAltSelect: any[] = undefined;

        // check if we have onSelect pattern
        if (o.hasOwnProperty('onSelect')) {
            onSelect = o['onSelect'];
        }

        // check if we have onAltSelect pattern
        if (o.hasOwnProperty('onAltSelect')) {
            onAltSelect = o['onAltSelect'];
        }

        for (var i: number = 0; i < o['rows'].length; i++) {
            var link = '';
            var altLink = '';

            // prepare onclick for this row here
            if (onSelect) {
                var command = onSelect[0];
                var params = [];

                for (var x: number = 1; x < onSelect.length; x++) {
                    if (onSelect[x][0] == '$') {
                        // XXX try to get value
                        var field: string = onSelect[x].substring(1);
                        var value: string = o['rows'][i][field];

                        params.push(value);
                    } else {
                        params.push(onSelect[x]);
                    }
                }
                link = encodeURI(command + '?' + JSON.stringify(params));
            }

            // prepare onclick for this row here
            if (onAltSelect) {
                var command = onAltSelect[0];
                var params = [];

                for (var x: number = 1; x < onAltSelect.length; x++) {
                    if (onAltSelect[x][0] == '$') {
                        // XXX try to get value
                        var field: string = onAltSelect[x].substring(1);
                        var value: string = o['rows'][i][field];

                        params.push(value);
                    } else {
                        params.push(onAltSelect[x]);
                    }
                }
                altLink = encodeURI(command + '?' + JSON.stringify(params));
            }


            this.documentTableRowStart(i, link, altLink);

            for (var j: number = 0; j < o['headers'].length; j++) {

                if (typeof o['headers'][j] == 'string') {
                    this.documentTableCell(o['rows'][i][o['headers'][j]]);
                } else {
                    var def = o['headers'][j];
                    var command = def[1];
                    var params = [];

                    for (var x: number = 2; x < def.length; x++) {
                        if (def[x][0] == '$') {
                            // XXX try to get value
                            var field: string = def[x].substring(1);
                            var value: string = o['rows'][i][field];

                            params.push(value);
                        } else {
                            params.push(def[x]);
                        }
                    }

                    // generate link
                    var link: string = encodeURI(command + '?' + JSON.stringify(params));

                    this.documentTableCellLink(def[0], link);
                } 
            }

            this.documentTableRowEnd();
        }

        this.documentTableEnd();

        

        this.documentEnd();

        this.preview('xxx://internal/' + type, this.m_CurrentDocument, tabTitle, panel);
    }

    private m_CurrentDocument = '';
    private m_GlobalLinks = '';
    private m_ExtensionPath = '';

    private documentStart(title: string) {
        this.m_GlobalLinks = '';
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
        this.write("<body onload='onPageLoaded();'>");

        if (title) {
            this.write('<h2>' + title + '</h2>');
        }
   }

    private documentEnd() {
        this.write(this.m_GlobalLinks);
        this.write("<p id='para'>...</p>");
        this.write("</body>");
        this.write("</html>");
    }

    private documentParagraph(text: string) {
        this.write('<p>' + text + '</p>');
    }

    private tabIndex = 1;

    private documentTableStart(headers) {
        this.write("<table cellspacing='0' tabindex='1' onkeydown='tableKeyDown(event)' onkeyup='tableKeyUp();' onfocusin='tableGotFocus();' onfocusout='tableLostFocus(event)' >");

        this.documentTableRowStart(-1, '', '');

        for (var i in headers) {
            if (typeof headers[i] == 'string') {
                this.write('<th>' + headers[i] + '</th>');
            } else {
                this.write('<th>*</th>');
            }
        }

        this.documentTableRowEnd();
    }

    private documentTableEnd() {
        this.write('</table>');
    }


    private documentTableRowStart(idx, link, altLink) {

        if (idx >= 0) {
            this.write('<tr id="tr_' + idx + '" tabindex="' + this.tabIndex++ + '" onclick="tableRowClick(event);" onfocus="tableRowFocus(event)" onfocusout="tableRowBlur(event)">');
        } else {
            this.write('<tr>');
        }

        this.m_GlobalLinks += "<a href='" + link + "' id='tr_" + idx + "_a' />";
        this.m_GlobalLinks += "<a href='" + altLink + "' id='tr_" + idx + "_a_alt' />";
    }

    private documentTableRowEnd() {
        this.write('</tr>');
    }

    private documentTableCell(text) {
        this.write('<td>' + convert.toHtml(text) + '</td>');
    }

    private documentTableCellLink(text, link) {
        this.write('<td>');
        this.documentWriteLink(text, link);
        this.write('</td>');
    }

    private documentTableButton(text, url) {
        var js = 'window.location.href="' + url + '"';

        this.write("<td><button onclick='" + js + "'>" + text + "</button></td>");
    }

    private documentButtonJs(text, js) {
        this.write("<button onclick='" + js + "'>" + text + "</button>");
    }

    private documentWriteLink(text, link) {
        this.write("<a href='" + link + "'>" + text + "</a>");
    }

    private write(s: string) {
        this.m_CurrentDocument += s;
    }
}

var provider = new HtmlView();
// Handle http:// and https://.
var registrationXxx = vscode.workspace.registerTextDocumentContentProvider('xxx', provider);

