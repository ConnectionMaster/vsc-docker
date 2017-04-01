'use strict';

import { Readable } from "stream";
import { StringDecoder } from 'string_decoder';

import * as cp from 'child_process';

export class Docker {

    constructor(rootPath: string, commandHandler, outputHandler, closeHandler) {
        this.m_RootPath = rootPath;
        this.m_CommandHandler = commandHandler;
        this.m_OutputHandler = outputHandler;
        this.m_CloseHandler = closeHandler;
    }

    private m_Containers = {};
    private m_RootPath: string = "";
    private m_CommandHandler = null;
    private m_OutputHandler = null;
    private m_CloseHandler = null;

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

        const stdout = this.collectData(child.stdout, 'utf8', id, true);
        const stderr = this.collectData(child.stderr, 'utf8', id, true);
        child.on('error', err => {
            console.log('CONTAINER ERROR');
        });

        child.on('close', code => {
            console.log('CONTAINER EXITED ' + code);

            // remove this container from container list
            delete this.m_Containers[id]; 

            // XXX - send notification, so terminal can be closed, etc...
            this.m_CloseHandler(id);
            if (code) {
            } else {
            }
        });

        cb(true);
    }

    public dir(id: string, path: string, cb) {
        this.exec(id, ['ls', '-al'], cb)        
    }

    public exec(id: string, command: any[], cb) {
        this.query(['exec', this.nameFromId(id)].concat(command), false, cb);
    }

    public execCmd(id: string, command: any, cb) {

        if (this.m_Containers[id].xvsc) {
            this.m_Containers[id].stdin.write(JSON.stringify(command) + '\n');
        } else {
            this.m_Containers[id].stdin.write(command + '\n');
        }
    }

    public info(cb) {
        this.query(['info'], false, cb);
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

    public pull(image: string, cb) {
        this.query(['pull', image], false, cb)
    }
    
    public push(image: string, cb) {
        this.query(['push', image], false, cb)
    }
    
    public rm(containers: string[], force: boolean, cb) {
        this.query(['rm'].concat(force ? [ '-f' ] : []).concat(containers), true, cb)
    }

    public history(name: string, cb) {
        this.query(['history', '--no-trunc', name], true, cb)
    }

    public rename(id, newName, cb) {
        this.query(['rename', id, newName], false, cb)
    }

    public pause(id, cb) {
        this.query(['pause', id], false, cb)
    }

    public unpause(id, cb) {
        this.query(['unpause', id], false, cb)
    }

    public start(id, cb) {
        this.query(['start', id], false, cb)
    }

    public restart(id, cb) {
        this.query(['restart', id], false, cb)
    }

    public diff(id, cb) {
        this.query(['diff', id], false, cb)
    }

    public top(id, cb) {
        this.query(['top', id, 'ps'], false, cb)
    }

    public logs(id, cb) {
        this.query(['logs', id], false, cb)
    }

    private query(params: string[], parse: boolean, cb) {
        // this function will call docker command, and parse output

        const child = cp.spawn('docker', params);
        const stdout = this.collectData(child.stdout, 'utf8', '', false);
        const stderr = this.collectData(child.stderr, 'utf8', '', false);
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
                        var r: string = stdout.join('');                        
                        cb(r ? r : true);
                    }
                }
            }
        });

    }


    private  collectData(stream: Readable, encoding: string, id: string, cmds: boolean): string[] {
        const data: string[] = [];
        const decoder = new StringDecoder(encoding);

        stream.on('data', (buffer: Buffer) => {
            var decoded: string = decoder.write(buffer);
            data.push(decoded);
            this.m_OutputHandler(decoded);

            // just make a single string...
            data[0] = data.join('');
            data.splice(1);

            if (cmds) {
                var cmdIdxStart: number = 0;

                while (cmdIdxStart < data[0].length) {
                    if ((data[0][cmdIdxStart] == '[') || (data[0][cmdIdxStart] == '{')) {
                        var cmdIdxEnd: number = data[0].indexOf('\n', cmdIdxStart);

                        if (cmdIdxEnd > 0) {
                            // pass command to handler
                            this.m_CommandHandler(JSON.parse(data[0].substring(cmdIdxStart, cmdIdxEnd)), id);

                            // remove JSON from buffer and continue the loop
                            data[0] = data[0].substr(cmdIdxEnd + 1);
                            cmdIdxStart = 0;
                        } else {
                            // exit here as seems like JSON is not complete yet
                            return;
                        }
                    } else {
                        cmdIdxStart++;
                    }
                }
            } 
        });
        return data;
    }
}
