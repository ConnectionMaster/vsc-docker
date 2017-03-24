'use strict';

import { Readable } from "stream";
import { StringDecoder } from 'string_decoder';

import * as cp from 'child_process';

export class Docker {

    constructor(rootPath: string, commandHandler, outputHandler) {
        this.m_RootPath = rootPath;
        this.m_CommandHandler = commandHandler;
        this.m_OutputHandler = outputHandler;
    }

    private m_Containers = {};
    private m_RootPath: string = "";
    private m_CommandHandler = null;
    private m_OutputHandler = null;

    public nameFromId(id: string) {
        return id.replace('/', '_');
    }

    public searchImages(filter: string): object {

        console.log("SEARCH IMAGES CALLED");

        return null;
    }

    public isRunning(id: string): boolean {
        return this.m_Containers.hasOwnProperty(id);
    }

    public attach(id: string, xvsc: boolean, cb) {
        if (this.m_Containers.hasOwnProperty(id)) {
            cb(true);
            return;
        }

        var src = '/src';
        // check if we are mapping something here


        // XXX - must get current local directory
        const child = cp.spawn('docker', ['exec', '-i', this.nameFromId(id)].concat(xvsc ? [ 'cmd.sh', 'vscode' ] : [ 'bash' ]));
        this.m_Containers[id] = child;
        child['xvsc'] = xvsc;

        const stdout = this.collectData(child.stdout, 'utf8', id);
        const stderr = this.collectData(child.stderr, 'utf8', id);
        child.on('error', err => {
        });

        child.on('close', code => {
            if (code) {
            } else {
            }
        });

        cb(true);
    }

    public exec(id: string, command: any, cb) {

        if (this.m_Containers[id].xvsc) {
            this.m_Containers[id].stdin.write('\r\n>>>CMD>>>\r\n' + JSON.stringify(command) + '\r\n<<<CMD<<<\r\n');
        } else {
            this.m_Containers[id].stdin.write(command + '\n');
        }
    }

    public ps(all: boolean, cb) {
        this.query(['ps'].concat(all ? [ '-a'] : []), true, cb);
    }

    public images(cb) {
        this.query(['images'], true, cb);
    }

    public getConfig(id, cb) {
        this. query(['run', id, 'config'], false, cb);
    }

    public search(filter: string, cb) {
        this.query(['search', filter], true, cb)
    }

    public rmi(images: string[], cb) {
        this.query(['rmi', '-f'].concat(images), true, cb)
    }

    public rm(containers: string[], cb) {
        this.query(['rm'].concat(containers), true, cb)
    }

    private query(params: string[], parse: boolean, cb) {
        // this function will call docker command, and parse output

        const child = cp.spawn('docker', params);
        const stdout = this.collectData(child.stdout, 'utf8', '');
        const stderr = this.collectData(child.stderr, 'utf8', '');
        child.on('error', err => {
            cb(false);
        });

        child.on('close', code => {
            if (code) {
                cb(false);
            } else {
                if (parse) {
                    var lines: string[] = stdout.join('').split(/\r?\n/);
                    var parsed: object[] = [];

                    // first line is a header, parse write
                    var header: string = lines.shift();
                    var startIdx: number = 0;
                    var headerIdx: number[] = [];
                    var headers: string[] = [];


                    while (startIdx < header.length) {
                        var endIdx: number = header.indexOf('  ', startIdx);
                        if (endIdx < 0) endIdx = header.length;
                        
                        // store data about header
                        headers.push(header.substring(startIdx, endIdx).trim().toLowerCase());
                        headerIdx.push(startIdx);

                        while (endIdx < header.length && header[endIdx] == ' ') endIdx++;
                        startIdx = endIdx;
                    }

                    // what's the longest?
                    headerIdx.push(256);

                    for (var i: number = 0; i < lines.length; i++) {
                        if (lines[i].trim() != '') {
                            var o: object = {};

                            for (var hidx: number = 0; hidx < headers.length; hidx++) {
                                o[headers[hidx]] = lines[i].substring(headerIdx[hidx], headerIdx[hidx + 1]).trim();
                            }

                            parsed.push(o);
                        }
                    }

                    cb({ headers: headers, rows: parsed});
                } else {
                    try {
                        var out = JSON.parse(stdout.join(''));
                        cb(out);
                    } catch (e) {
                        cb(false);
                    }
                }
            }
        });

    }


    private  collectData(stream: Readable, encoding: string, id: string): string[] {
        const data: string[] = [];
        const decoder = new StringDecoder(encoding);

        stream.on('data', (buffer: Buffer) => {
            var decoded: string = decoder.write(buffer);
            data.push(decoded);
            this.m_OutputHandler(decoded);

            // just make a single string...
            data[0] = data.join('');
            data.splice(1);

            while (true) {
                var cmdIdxStart: number = data[0].indexOf('>>>CMD>>>');

                if (cmdIdxStart > 0) {
                    cmdIdxStart += 9;
                    var cmdIdxEnd: number = data[0].indexOf('<<<CMD<<<', cmdIdxStart);

                    if (cmdIdxEnd > 0) {
                        // pass command to handler
                        this.m_CommandHandler(JSON.parse(data[0].substring(cmdIdxStart, cmdIdxEnd)), id);

                        data[0] = data[0].substr(cmdIdxEnd + 9);
                    } else {
                        break;
                    }
                } else {
                    break;
                }
            }
        });
        return data;
    }
}
