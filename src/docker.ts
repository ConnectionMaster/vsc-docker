'use strict';

import { Readable } from "stream";
import { StringDecoder } from 'string_decoder';

import * as cp from 'child_process';

export class Docker {

    public searchImages(filter: string): object {

        console.log("SEARCH IMAGES CALLED");

        return null;
    }

    public ps(cb) {
        this.query(['ps', '-a'], cb);
    }

    private query(params: string[], cb) {
        // this function will call docker command, and parse output

        const child = cp.spawn('docker', params);
        const stdout = this.collectData(child.stdout, 'utf8', '');
        const stderr = this.collectData(child.stderr, 'utf8', '');
        child.on('error', err => {

        });

        child.on('close', code => {
            if (code) {
                // XXX - error occured here
            } else {
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

                cb(parsed);
            }
        });

    }


    private  collectData(stream: Readable, encoding: string, container: string): string[] {
        const data: string[] = [];
        const decoder = new StringDecoder(encoding);

        stream.on('data', (buffer: Buffer) => {
            var decoded: string = decoder.write(buffer);
            data.push(decoded);
            //out.append(decoded);

            // just make a single string...
            data[0] = data.join('');
            data.splice(1);

            while (true) {
                var cmdIdxStart: number = data[0].indexOf('>>>CMD>>>');

                if (cmdIdxStart > 0) {
                    cmdIdxStart += 9;
                    var cmdIdxEnd: number = data[0].indexOf('<<<CMD<<<', cmdIdxStart);

                    if (cmdIdxEnd > 0) {

              //          executeCommand(data[0].substring(cmdIdxStart, cmdIdxEnd), container);
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