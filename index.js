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
var minimist = require('minimist');
var myLocalIp = require('my-local-ip');
var DebugLogtron = require('debug-logtron');

var console = require('console');
var process = require('process');
var fs = require('fs');
var path = require('path');
var url = require('url');
var assert = require('assert');

var Logger = require('./log');
var TCurlAsHttp = require('./as-http');
var MetaClient = require('./meta-client');

main.exec = execMain;

module.exports = main;

if (require.main === module) {
    main(minimist(process.argv.slice(2), {
        boolean: ['raw']
    }));
}

function execMain(str, cb) {
    main(minimist(str, {
        boolean: ['raw']
    }), cb);
}

function help() {
    console.log(
        'tcurl [-H <hostlist> | -p host:port] <service> <endpoint> [options]'
    );
    console.log('  ');
    console.log('  Options: ');
    // TODO @file; @- stdin.
    console.log('    --headers [data] send transport headers');
    console.log('    -2 [data] send an arg2 blob');
    console.log('    -3 [data] send an arg3 blob');
    console.log('    --depth=n configure inspect printing depth');
    console.log('    -j print JSON');
    console.log('    -J [indent] print JSON with indentation');
    console.log('    -t [dir] directory containing Thrift files');
    console.log('    --http method');
    console.log('    --raw encode arg2 & arg3 raw');
    console.log('    --health');
    console.log('    --timeout [num]');
    return;
}

function parseArgs(argv) {
    var transportHeaders = argv.headers;
    var body = argv['3'] || argv.arg3 || '';
    var head = argv['2'] || argv.arg2 || '';

    var uri = argv.p || argv.peer;
    var hostlist = argv.H || argv.hostlist;
    var thrift = argv.t || argv.thrift;
    var http = argv.http;
    var json = argv.j || argv.J;
    var service = argv._[0];
    var endpoint = argv._[1];
    var health = argv.health;

    if (hostlist) {
        uri = JSON.parse(fs.readFileSync(hostlist))[0];
    }

    var parsedUri = url.parse('tchannel://' + uri);

    if (parsedUri.hostname === 'localhost') {
        parsedUri.hostname = myLocalIp();
    }

    assert(parsedUri.hostname, 'host required');
    assert(parsedUri.port, 'port required');
    assert(health || endpoint, 'endpoint required');
    assert(service, 'service required');

    return {
        transportHeaders: transportHeaders,
        head: head,
        body: body,
        service: service,
        endpoint: endpoint,
        hostname: parsedUri.hostname,
        port: parsedUri.port,
        thrift: thrift,
        http: http,
        json: json,
        raw: argv.raw,
        timeout: argv.timeout,
        depth: argv.depth,
        health: health
    };
}

function main(argv, onResponse) {
    /*eslint no-console: 0 */
    if (argv.h || argv.help || argv._.length === 0) {
        return help();
    }

    var opts = parseArgs(argv);
    opts.onResponse = onResponse;
    tcurl(opts);
}

function readThriftSpec(opts) {
    try {
        return fs.readFileSync(opts.thrift, 'utf8');
    } catch(err) {
        if (err.code !== 'EISDIR') {
            throw err;
        }
    }

    return readThriftSpecDir(opts);
}

function readThriftSpecDir(opts) {
    var specs = {};
    var files = fs.readdirSync(opts.thrift);
    files.forEach(function eachFile(file) {
        var match = /([^\/]+)\.thrift$/.exec(file);
        if (match) {
            var serviceName = match[1];
            var fileName = match[0];
            specs[serviceName] =
                fs.readFileSync(path.join(opts.thrift, fileName), 'utf8');
        }
    });

    if (!specs[opts.service]) {
        throw new Error('Spec for service unavailable: ' + opts.service);
    }

    return specs[opts.service];
}

function tcurl(opts) {
    var logger = Logger(opts);
    var spec;

    if (opts.thrift) {
        spec = readThriftSpec(opts);
    }

    var client = TChannel({
        logger: DebugLogtron('tcurl')
    });

    var subChan = client.makeSubChannel({
        serviceName: opts.service,
        peers: [opts.hostname + ':' + opts.port],
        requestDefaults: {
            serviceName: opts.service,
            headers: {
                cn: 'tcurl'
            }
        }
    });

    client.on('listening', onListen);
    client.listen(0, '127.0.0.1');

    function onListen() {
        client.removeListener('listening', onListen);

        client.waitForIdentified({
            host: opts.hostname + ':' + opts.port
        }, onIdentified);
    }

    function onIdentified(err) {
        if (err) {
            return onResponse(err);
        }

        var request = subChan.request({
            timeout: opts.timeout || 100,
            hasNoParent: true,
            serviceName: opts.service,
            headers: opts.transportHeaders
        });

        if (opts.headers) {
            opts.headers = JSON.parse(opts.headers);
        }
        var sender;
        if (opts.health) {
            var meta = new MetaClient({
                channel: client,
                logger: logger
            });
            meta.health(request, opts.onResponse);
        } else if (opts.thrift) {
            if (opts.body) {
                opts.body = JSON.parse(opts.body);
            }
            if (opts.head) {
                opts.head = JSON.parse(opts.head);
            }

            sender = new TChannelAsThrift({source: spec});
            sender.send(request, opts.endpoint, opts.head,
                opts.body, onResponse);
        } else if (opts.raw) {
            request.headers.as = 'raw';
            request.send(opts.endpoint, opts.head, opts.body,
                onResponse);
        } else if (opts.http) {
            var ashttp = TCurlAsHttp({
                channel: client,
                subChannel: subChan,
                method: opts.http,
                path: opts.endpoint,
                headers: JSON.parse(opts.head),
                body: JSON.parse(opts.body),
                onResponse: onResponse,
                logger: logger
            });
            ashttp.send();
        } else {
            sender = new TChannelAsJSON();

            if (opts.body) {
                opts.body = JSON.parse(opts.body);
            }
            if (opts.head) {
                opts.head = JSON.parse(opts.head);
            }
            sender.send(request, opts.endpoint, opts.head,
                opts.body, onResponse);
        }
    }

    function onResponse(err, resp, arg2, arg3) {
        if (arg2 !== undefined && resp) {
            resp.head = arg2;
        }
        if (arg3 !== undefined && resp) {
            resp.body = arg3;
        }

        if (opts.onResponse) {
            opts.onResponse(err, resp, arg2, arg3);
            client.quit();
            return;
        }

        if (err) {
            logger.log('error', err);
            logger.log('error', err.message);
            /*eslint no-process-exit: 0*/
            process.exit(1);
        }

        if (!resp.ok) {
            logger.log('error', 'Got call response not ok');
            logger.log('error', resp.body);
            process.exit(1);
        } else {
            logger.display('log', 'Got call response ok');
        }

        logger.display('log', resp.body);
        client.quit();
    }
}
