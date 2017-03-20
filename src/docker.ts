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

    private g_containers = {};
    private m_RootPath: string = "";
    private m_CommandHandler = null;
    private m_OutputHandler = null;

    public startContainer(name, cb) {

        if (this.g_containers.hasOwnProperty(name)) {
            cb(true);
            return;
        }

        const child = cp.spawn('docker', ['rm', '-f', name.split('/')[1]]);
        child.on('close', code => {

            var src = '/src';
            var cfg = undefined;
            // check if we are mapping something here


            // XXX - must get current local directory
            const child = cp.spawn('docker', ['run', "--name", name.split('/')[1], "-i", '-v', this.m_RootPath + ':' + src, name, 'vscode']);
            this.g_containers[name] = child;

            const stdout = this.collectData(child.stdout, 'utf8', name);
            const stderr = this.collectData(child.stderr, 'utf8', name);
            child.on('error', err => {
            });

            child.on('close', code => {
                if (code) {
                } else {
                }
            });

            cb(cfg);
        })        
    }

    public searchImages(filter: string): object {

        console.log("SEARCH IMAGES CALLED");

        return null;
    }

    public exec(container: string, command: any[], cb) {
        var _this: Docker = this;

        this.startContainer(container, function(result) {
            // XXX - old way of doing things
            _this.g_containers[container].stdin.write('\r\n>>>CMD>>>\r\n' + JSON.stringify(command) + '\r\n<<<CMD<<<\r\n');
        })
    }

    public ps(cb) {
        this.query(['ps', '-a'], true, cb);
    }

    public images(cb) {
        this.query(['images'], true, cb);
    }

    public getConfig(container, cb) {
        this. query(['run', container, 'config'], false, cb);
    }

    public search(filter: string, cb) {
        this.query(['search', filter], true, cb)
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

                    headerIdx.push(startIdx);

                    for (var i: number = 1; i < lines.length; i++) {
                        var o: object = {};

                        for (var hidx: number = 0; hidx < headers.length; hidx++) {
                            o[headers[hidx]] = lines[i].substring(headerIdx[hidx], headerIdx[hidx + 1]).trim();
                        }

                        parsed.push(o);
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


    private  collectData(stream: Readable, encoding: string, container: string): string[] {
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
                        this.m_CommandHandler(JSON.parse(data[0].substring(cmdIdxStart, cmdIdxEnd)), container);

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