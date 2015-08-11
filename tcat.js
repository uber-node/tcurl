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

// trivial tchannel listener interface, a la netcat

var console = require('console');
var process = require('process');

var minimist = require('minimist');
var TChannel = require('tchannel');

function main(args) {
    /*eslint no-console: 0 */
    var opts = minimist(args, {alias: {peer: ['p'], help: ['h']}});
    if (opts.help || opts.h) {
        displayHelp(0);
    }

    args = opts._.slice(2);
    if (args.length !== 2 || !opts.peer) {
        console.error('Must specify full endpoint.\n');
        displayHelp(1);
    }

    var host = opts.peer.split(':')[0];
    var port = opts.peer.split(':')[1];
    var service = args[0];
    var endpoint = args[1];

    if (!host || !port) {
        console.error('Invalid HostPort.\n');
        displayHelp(1);
    }

    var server = new TChannel();
    server
        .makeSubChannel({serviceName: service})
        .register(endpoint, onRequest);
    server.listen(+port, host);

    function onRequest(req, res, arg2, arg3) {
        res.headers.as = 'raw';
        console.log(arg2.toString());
        res.sendOk();
    }
}

function displayHelp(exitValue) {
    /*eslint no-process-exit: 0*/
    console.log('tcat -p <host:port> <service> <endpoint>');
    process.exit(exitValue);
}

if (require.main === module) {
    main(process.argv);
}
