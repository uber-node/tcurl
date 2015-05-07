#!/usr/bin/env node

// Copyright (c) 2015 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.


'use strict';

var parseArgs = require('minimist');
var TChannel = require('tchannel');
var console = require('console');
var process = require('process');
var myLocalIp = require('my-local-ip');
var url = require('url');
var DebugLogtron = require('debug-logtron');

if (require.main === module) {
    main(parseArgs(process.argv.slice(2)));
}

function main(argv) {
    /*eslint no-console: 0, max-statements: [2, 20] */
    if (argv.h || argv.help || argv._.length === 0) {
        console.log('tcurl [options] host:port');
        console.log('  ');
        console.log('  Options: ');
        console.log('    -d [data] send a body');
        return;
    }

    var body = argv.d || '';

    var uri = argv._[0];
    var parsedUri = url.parse('tchannel://' + uri);

    var client = TChannel({
        logger: DebugLogtron('tcurl')
    });

    if (parsedUri.hostname === 'localhost') {
        parsedUri.hostname = myLocalIp();
    }

    client.listen(0, myLocalIp());

    client.once('listening', onListen);

    function onListen() {
        client.send({
            host: parsedUri.hostname + ':' + parsedUri.port
        }, parsedUri.pathname || '/', null, body, onResponse);
    }

    function onResponse(err, res1, res2) {
        if (err) {
            throw err;
        }

        console.log(JSON.parse(String(res2)));
        client.quit();
    }
}
