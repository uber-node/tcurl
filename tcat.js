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

/*eslint no-console: 0 */
// tchannel listener interface, a la netcat

var console = require('console');
var process = require('process');
var ChildProcess = require('child_process');

var TChannel = require('tchannel');

var Command = require('shon/command');
var command = new Command('tcat', {
    peer: '[-p|--peer] <peer> The host:port pair to listen on',
    // hyperbahn: '[-H|--hyperbahn <hostlist>] Hyperbahn host list to advertise',
    // thrift: '[-t|--thrift] <file or dir> File or directory with Thrift IDL files',
    // interactive: '[-i|--interactive] Use interactive stream mode',
    service: '<service>',
    endpoint: '<endpoint>',
    command: '[<command>]',
    args: '<arg>....',
    help: '[-h|--help]*'
});

command.peer.converter = function convertAddress(peer, logger) {
    var index = peer.lastIndexOf(':');
    if (index < 0) {
        logger.error('Expected colon in host:port pair for peer');
        return null;
    }
    var host = peer.slice(0, index);
    var port = +peer.slice(index + 1);
    if (port !== port) {
        logger.error('Expected a numeric port in host:port for peer');
        return null;
    }
    return {host: host, port: port};
};

function main(args) {
    var config = command.exec();
    if (config === 'help') {
        command._logUsage();
        return;
    }

    var server = new TChannel();
    server
        .makeSubChannel({serviceName: config.service})
        .register(config.endpoint, onRequest);
    server.listen(config.peer.port, config.peer.host, onListening);

    function onListening() {
        console.log(JSON.stringify({message: 'listening', address: server.hostPort}));
    }

    function onRequest(req, res, arg2, arg3) {
        console.log(JSON.stringify(req.extendLogInfo({message: 'request'})));
        // TODO env inferred from arg2, argscheme dependent
        var child = ChildProcess.spawn(config.command || 'cat', config.args, {
            stdio: ['pipe', 'pipe', process.stderr]
        });
        child.stdio[0].end(arg3);
        readString(child.stdio[1], onOutput);

        function onOutput(err, arg3Res) {
            if (err) {
                res.sendError(err);
                return;
            }
            console.log(JSON.stringify(req.extendLogInfo({message: 'response', arg2: arg2.toString('utf-8'), arg3: arg3Res})));
            res.headers.as = req.headers.as;
            res.sendOk(arg2, arg3Res);
        }
    }
}

function readString(stream, callback) {
    stream.setEncoding('utf-8');
    stream.on('data', onData);
    stream.on('end', onEnd);
    stream.on('eerror', onError);
    var done = false;
    var all = '';
    function onData(data) {
        all += data;
    }
    function onEnd() {
        if (done) {
            return;
        }
        done = true;
        callback(null, all);
    }
    function onError(err) {
        if (done) {
            return;
        }
        done = true;
        callback(err);
    }
    function cancel() {
        stream.removeListener('data', onData);
        stream.removeListener('end', onEnd);
        stream.removeListener('error', onError);
        done = true;
        stream = null;
    }
    return {cancel: cancel};
}

if (require.main === module) {
    main(process.argv);
}
