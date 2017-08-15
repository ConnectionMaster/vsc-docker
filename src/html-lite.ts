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

        var uriString: string = uri.toString();

        // TODO: detect failure to load page (e.g. google.com) and display error to user.
        if (!uriString.startsWith('xxx://internal')) {
            return "<iframe src=\"" + uri + "\" frameBorder=\"0\" width=\"1024\" height=\"1024\"/>";
        } else {
            return this.m_InternalPages[uriString];
        }
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
     * View text document as HTML
     * @param type 
     * @param text 
     * @param title 
     * @param panel 
     */
    public createPreviewFromText(type: string, text: string, title: string, panel: number = 1) {

        text = text.replace(/(\r\n|\n|\r)/gm,"<br/>");

        this.documentStart(title, type, true);
        this.documentParagraph(text);
        this.documentEnd();

        this.preview('xxx://internal/' + type, this.m_CurrentDocument, title, panel, false);
    }

    /**
     * Create HTML document from JSON object
     * @param type 
     * @param tabTitle 
     * @param o 
     * @param panel 
     * @param container 
     */
    public createPreviewFromObject(type: string, tabTitle: string, o: object, panel: number, container: string, refreshOnly: boolean) {

        this.documentStart(undefined, type, false);

        if (o.hasOwnProperty('panels')) {
            for (var i: number = 0; i < o['panels'].length; i++) {
                this.createPanel(o['panels'][i], type, i, container);
            }
        } else {
            this.createPanel(o, type, 0, container);
        }

        this.documentEnd();

        this.preview('xxx://internal/' + type, this.m_CurrentDocument, tabTitle, panel, refreshOnly);
    }

    /**
     * Create single panel in HTML document
     * @param o 
     * @param tab 
     * @param panel 
     * @param container 
     */
    private createPanel(o: object, tab: string, panel: number, container: string) {
        this.m_PanelData[tab + '_' + panel] = o;
        
        this.write('<div id="panel_' + panel + '" style="position:absolute;padding: 10px;" >');

        if (o.hasOwnProperty('title')) {
            this.write('<h2>' + o['title'] + '</h2>');
        }

        if (o.hasOwnProperty('description')) {
            this.write('<br/><br/>');
            this.documentParagraph(o['description']);
        }

        if (o.hasOwnProperty('headers')) {

            this.write('<br/><br/>');

            this.documentTableStart(panel, o['headers']);

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

                this.documentTableRowStart(panel, i);

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
        }

        // any action buttons?
        if (o.hasOwnProperty('actions')) {

            this.write('<br/><br/>');

            for (var i: number = 0; i < o['actions'].length; i++) {

                if (o['actions'][i].link[0].startsWith('command:')) {
                    var link: string = o['actions'][i].link[0];

                    this.documentButtonLink(o['actions'][i].name, encodeURI(link));
                } else {
                    var link: string = JSON.stringify([ o['actions'][i].link, container ]);

                    if (!link.startsWith('command:')) {
                        link = 'command:extension.handler?' + link;
                    }

                    this.documentButtonLink(o['actions'][i].name, encodeURI(link));
                }
            }
        }
        this.write('</div>');
    }

    /**
     * Start HTML Document
     * @param title 
     * @param type 
     */
    private documentStart(title: string, type: string, scroll: boolean) {
        this.m_GlobalLinks = '';
        this.m_CurrentDocument = '';
        var css = fs.readFileSync(this.m_ExtensionPath + '/html-lite.css')
        var script = "var documentId='" + type + "'\r\n" + fs.readFileSync(this.m_ExtensionPath + '/html-lite-script.js')

        this.write('<!DOCTYPE "html">');
        this.write("<html>");
        this.write("<head>");
        this.write("<title>" + title + "</title>");
        this.write("</head>");
        this.write('<style type="text/css">' + css + '</style>');
        this.write('<script>' + script + '</script>');
        this.write("<body id='xbodyx' onload='onPageLoaded();' onresize='onPageResize();' onfocusin='onDocumentGotFocus(event)' onfocusout='onDocumentLostFocus(event)'" + (scroll ? "" : " style='overflow:hidden'") + "><div id='muka'></div>");

        if (title) {
            this.write('<h2>' + title + '</h2>');
        }

        var link = encodeURI('command:extension.htmlEvent?' + JSON.stringify(['xdocumentx', 'xelementx', 'xeventx', 'xparamx'])); 

        this.m_GlobalLinks += "<a href='" + link + "' id='event_handler_a' ></a>";
    }

    /**
     * Finalise HTML document
     */
    private documentEnd() {
        this.write(this.m_GlobalLinks);
        this.write("</body>");
        this.write("</html>");
    }

    /**
     * Write text in paragraph
     * @param text 
     */
    private documentParagraph(text: string) {
        this.write('<p>' + text + '</p>');
    }

    /**
     * Start table
     * @param panel 
     * @param headers 
     */
    private documentTableStart(panel: number, headers) {
        this.write("<table id='panel_" + panel + "' cellspacing='0' width='100%' tabindex='1' onkeydown='tableKeyDown(event)' onkeyup='tableKeyUp();' onfocusin='tableGotFocus(" + panel + ");' onfocusout='tableLostFocus(" + panel + ")' >");

        this.documentTableRowStart(panel, -1);

        for (var i in headers) {
            if (typeof headers[i] == 'string') {
                this.write('<th>' + headers[i] + '</th>');
            } else {
                this.write('<th>*</th>');
            }
        }

        this.documentTableRowEnd();
    }

    /**
     * End table
     */
    private documentTableEnd() {
        this.write('</table>');
    }


    /**
     * Start table row
     * @param panel 
     * @param idx 
     */
    private documentTableRowStart(panel: number, idx: number) {

        if (idx >= 0) {
            this.write('<tr id="tr_' + panel + '_' + idx + '" tabindex="' + this.tabIndex++ + '" onclick="tableRowClick(event);" ondblclick="tableRowDoubleClick(event);" onmousedown="tableRowRightClick(event);" onfocus="tableRowFocus(event);" onfocusout="tableRowBlur(event)">');
        } else {
            this.write('<tr>');
        }
    }

    /**
     * End table row
     */
    private documentTableRowEnd() {
        this.write('</tr>');
    }

    /**
     * Write table cell
     * @param text 
     */
    private documentTableCell(text) {
        this.write('<td>' + convert.toHtml(text) + '</td>');
    }

    /**
     * Write table cell with link
     * @param text 
     * @param link 
     */
    private documentTableCellLink(text, link) {
        this.write('<td>');
        this.documentWriteLink(text, link);
        this.write('</td>');
    }

    /**
     * Write table cell button
     * @param text 
     * @param url 
     */
    private documentTableButton(text, url) {
        var js = 'window.location.href="' + url + '"';

        this.write("<td><button onclick='" + js + "'>" + text + "</button></td>");
    }

    /**
     * Create JS button
     * @param text 
     * @param js 
     */
    private documentButtonJs(text, js) {
        this.write("<button onclick='" + js + "'>" + text + "</button>");
    }

    private documentButtonLink(text, link) {

        this.documentButtonJs(text, 'document.getElementById("btn_' + this.m_NextBtn + '_a").click()');
        this.m_GlobalLinks += "<a href='" + link + "' id='btn_" + this.m_NextBtn + "_a' />"; 
        this.m_NextBtn++;       
    }

    private documentWriteLink(text, link) {
        this.write("<a href='" + link + "'>" + text + "</a>");
    }

    private write(s: string) {
        this.m_CurrentDocument += s;
    }

    /**
     * Handle event from the view.
     * 
     * @param tab 
     * @param element 
     * @param eventType 
     * @param eventParam 
     */
    public handleEvent(tab: string, element: string, eventType: string, eventParam: string) {
        console.log("Event: " + tab + " " + element + " " + eventType + " " + eventParam);

        if (eventType == 'DoubleClick') {
            this.executeCommand(tab, element, 'onDefault');
            this.executeCommand(tab, element, 'onAltSelect');
        } else if (eventType == 'RightClick') {
            this.executeCommand(tab, element, 'onOptions');
            this.executeCommand(tab, element, 'onSelect');
        } else if (eventType == 'KeyDown') {
            if (eventParam == 'Delete') {
                this.executeCommand(tab, element, 'onDelete');
            } else if (eventParam == 'Escape') {
                this.executeCommand(tab, element, 'onBack');
            }
        }
    }

    /**
     * Execute command
     * 
     * @param tab 
     * @param element 
     * @param type 
     */
    private executeCommand(tab: string, element: string, type: string) {
        // get panel id and element index from element
        var panel: number = 0;
        var idx: number = 0;

        var temp: string[] = element.split('_');
        panel = Number(temp[1]);
        idx = Number(temp[2]);

        // get OnDoubleClick
            // XXX - this should be made obsolete and removed
        // check if we have onAltSelect pattern
        var handler: any[] = undefined;
        if (this.m_PanelData[tab + '_' + panel].hasOwnProperty(type)) {
            handler = this.m_PanelData[tab + '_' + panel][type];
        }
        if (handler) {
            var command = handler[0];
            var params = [ command.split(':')[1] ];

            for (var x: number = 1; x < handler.length; x++) {
                if (handler[x][0] == '$') {
                    // XXX try to get value
                    var field: string = handler[x].substring(1);
                    var value: string = this.m_PanelData[tab + '_' + panel]['rows'][idx][field];

                    params.push(value);
                } else {
                    params.push(handler[x]);
                }
            }
            // XXX - execute command
            console.log('COMMAND: ' + params.toString());
            vscode.commands.executeCommand.apply(vscode.commands, params);
        }
    }


    // global variables -- not all of them should be global
    private m_InternalPages : {} = {};
    private m_CurrentDocument = '';
    private m_GlobalLinks = '';
    private m_ExtensionPath = '';
    private tabIndex = 1;
    private m_NextBtn: number = 0;
    private m_PanelData: object[] = [];

}

var provider = new HtmlView();
// Handle http:// and https://.
var registrationXxx = vscode.workspace.registerTextDocumentContentProvider('xxx', provider);

