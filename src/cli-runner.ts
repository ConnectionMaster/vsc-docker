'use strict';

import { Readable } from "stream";
import { StringDecoder } from 'string_decoder';

import * as cp from 'child_process';

export class CliRunner {

    /**
     * Constructor
     * 
     * @param outputHandler 
     */
    constructor(outputHandler) {
        this.m_OutputHandler = outputHandler;
    }

    /**
     * Execute command
     * 
     * @param params 
     * @param parse 
     * @param suppressOutput
     * @param cb 
     */
    public execute(params: string[], parse: boolean, suppressOutput: boolean, cb) {

        if (!suppressOutput) {
            this.m_OutputHandler("Docker", '\n\u27a4 docker ' + params.join(' ') + '\n\n');
        }

        const child = cp.spawn('docker', params);
        const stdout = this.collectData(child.stdout, 'utf8', 'Docker', suppressOutput);
        const stderr = this.collectData(child.stderr, 'utf8', 'Docker', suppressOutput);
        child.on('error', err => {
            cb(false);
        });

        child.on('close', code => {
            if (code) {
                cb(false);
            } else {
                // XXX - this parsing is only for 
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

    /**
     * Collect data
     * 
     * @param stream 
     * @param encoding 
     * @param id 
     * @param cmds 
     */

    public  collectData(stream: Readable, encoding: string, id: string, suppressOutput: boolean = false): string[] {
        const data: string[] = [];
        const decoder = new StringDecoder(encoding);

        stream.on('data', (buffer: Buffer) => {
            var decoded: string = decoder.write(buffer);
            data.push(decoded);

            // just make a single string...
            data[0] = data.join('');
            data.splice(1);

            if (!suppressOutput) {
                this.m_OutputHandler(id, decoded);
            }
        });
        return data;
    }

    private m_OutputHandler = null;
}
