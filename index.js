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

var TChannel = require('tchannel');
var TChannelAsThrift = require('tchannel/as/thrift');
var TChannelAsJSON = require('tchannel/as/json');
var thriftify = require('thriftify');
var minimist = require('minimist');
var myLocalIp = require('my-local-ip');
var DebugLogtron = require('debug-logtron');

var console = require('console');
var process = require('process');
var util = require('util');
var fs = require('fs');
var path = require('path');
var url = require('url');
var assert = require('assert');

module.exports = tcurl;

if (require.main === module) {
    main(minimist(process.argv.slice(2)));
}

function help() {
    console.log('tcurl -p host:port <service> <endpoint> [options]');
    console.log('  ');
    console.log('  Options: ');
    // TODO @file; @- stdin.
    console.log('    -2 [data] send an arg2 blob');
    console.log('    -3 [data] send an arg3 blob');
    console.log('    --depth=n configure inspect printing depth');
    console.log('    -j print JSON');
    console.log('    -J [indent] print JSON with indentation');
    console.log('    -t [dir] directory containing Thrift files');
    return;
}

function parseArgs(argv) {
    var body = argv['3'] || argv.arg3 || '';
    var head = argv['2'] || argv.arg2 || '';

    var uri = argv.p || argv.peer;
    var thrift = argv.t || argv.thrift;
    var json = argv.j || argv.J;
    var service = argv._[0];
    var endpoint = argv._[1];
    var parsedUri = url.parse('tchannel://' + uri);

    if (parsedUri.hostname === 'localhost') {
        parsedUri.hostname = myLocalIp();
    }

    assert(parsedUri.hostname, 'host required');
    assert(parsedUri.port, 'port required');
    assert(endpoint, 'endpoint required');
    assert(service, 'service required');

    return {
        head: head,
        body: body,
        service: service,
        endpoint: endpoint,
        hostname: parsedUri.hostname,
        port: parsedUri.port,
        thrift: thrift,
        json: json,
        depth: argv.depth
    };
}

function main(argv) {
    /*eslint no-console: 0 */
    if (argv.h || argv.help || argv._.length === 0) {
        return help();
    }

    var opts = parseArgs(argv);
    tcurl(opts);
}

function tcurl(opts) {
    var spec;
    if (opts.thrift) {
        var specs = {};
        var files = fs.readdirSync(opts.thrift);
        files.forEach(function eachFile(file) {
            var match = /([^\/]+)\.thrift$/.exec(file);
            if (match) {
                var serviceName = match[1];
                var fileName = match[0];
                specs[serviceName] =
                    thriftify.readSpecSync(path.join(opts.thrift, fileName));
            }
        });

        spec = specs[opts.service];
        if (!spec) {
            throw new Error('Spec for service unavailable: ' + opts.service);
        }
    }

    var client = TChannel({
        logger: DebugLogtron('tcurl')
    });

    client.on('listening', onListen);
    client.listen(0, '127.0.0.1');

    function onListen() {
        client.removeListener('listening', onListen);

        var request = client.request({
            host: opts.hostname + ':' + opts.port,
            timeout: opts.timeout || 5000,
            serviceName: opts.service
        });
        var sender;
        if (opts.thrift) {
            sender = new TChannelAsThrift({spec: spec});
        } else {
            sender = new TChannelAsJSON();
        }
        sender.send(request, opts.endpoint, opts.head,
            opts.body, onResponse);
    }

    function onResponse(err, resp) {
        if (opts.onResponse) {
            opts.onResponse(err, resp);
            client.quit();
            return;
        }

        if (err) {
            console.error(err);
            console.error(err.message);
            /*eslint no-process-exit: 0*/
            process.exit(1);
        }

        if (!resp.ok) {
            console.error('Got call response not ok');
            display('error', resp.body);
            process.exit(1);
        }

        display('log', resp.body);
        client.quit();
    }

    function display(level, value) {
        if (opts.json) {
            log(level, JSON.stringify(value, null, opts.json));
        } else {
            log(level, util.inspect(value, {
                depth: opts.depth || 2
            }));
        }
    }

    function log(level, message) {
        if (level === 'error') {
            console.error(message);
        } else {
            console.log(message);
        }
    }
}

module.exports = tcurl;
