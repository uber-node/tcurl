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

var fmt = require('util').format;
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

var minimistArgs = {
    boolean: ['raw'],
    alias: {
        h: 'help',
        p: 'peer',
        H: 'hostlist',
        t: 'thrift',
        2: ['arg2', 'head'],
        3: ['arg3', 'body'],
        j: ['J', 'json']
    },
    default: {
        head: '',
        body: ''
    }
};

if (require.main === module) {
    main(minimist(process.argv.slice(2), minimistArgs));
}

function execMain(str, cb) {
    main(minimist(str, minimistArgs), cb);
}

function help() {
    var helpMessage = [
        'tcurl [-H <hostlist> | -p host:port] <service> <endpoint> [options]',
        '  ',
        '  Options: ',
        // TODO @file; @- stdin.
        '    -2 [data]        send an arg2 blob',
        '    -3 [data]        send an arg3 blob',
        '    --shardKey       send ringpop shardKey transport header',
        '    --depth=n        configure inspect printing depth',
        '    -j               print JSON',
        '    -t [dir]         directory containing Thrift files',
        '    --http [method]  use tchannel as http with specified HTTP method',
        '    --raw            encode arg2 & arg3 raw',
        '    --health         query the Meta::health endpoint',
        '    --timeout [num]  set a query timeout'
    ].join('\n');
    console.log(helpMessage);
    return;
}

function parseArgs(argv) {
    var transportHeaders = argv.headers;
    var service = argv._[0];
    var endpoint = argv._[1];
    var health = argv.health;

    var uri = argv.hostlist ?
        JSON.parse(fs.readFileSync(argv.hostlist))[0] : argv.peer;

    var parsedUri = url.parse('tchannel://' + uri);

    if (parsedUri.hostname === 'localhost') {
        parsedUri.hostname = myLocalIp();
    }

    assert(parsedUri.hostname, 'host required');
    assert(parsedUri.port, 'port required');
    assert(health || endpoint, 'endpoint required');
    assert(service, 'service required');

    return {
        head: argv.head,
        body: argv.body,
        transportHeaders: transportHeaders,
        service: service,
        endpoint: endpoint,
        hostname: parsedUri.hostname,
        port: parsedUri.port,
        thrift: argv.thrift,
        http: argv.http,
        json: argv.json,
        raw: argv.raw,
        timeout: argv.timeout,
        depth: argv.depth,
        health: health,
        shardKey: argv.shardKey
    };
}

function main(argv, onResponse) {
    /*eslint no-console: 0 */
    if (argv.help || argv._.length === 0) {
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
            var thriftFilepath = path.join(opts.thrift, fileName);
            specs[serviceName] = fs.readFileSync(thriftFilepath, 'utf8');
        }
    });

    if (!specs[opts.service]) {
        throw new Error('Spec for service unavailable: ' + opts.service);
    }

    return specs[opts.service];
}

function tcurl(opts) {
    var logger = Logger(opts);

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

        if (opts.shardKey) {
            request.headers.shardKey = opts.shardKey;
        }

        if (opts.health) {
            var meta = new MetaClient({
                channel: client,
                logger: logger
            });
            meta.health(request, opts.onResponse);
        } else if (opts.thrift) {
            asThrift(opts, request, onResponse);
        } else if (opts.raw) {
            asRaw(opts, request, onResponse);
        } else if (opts.http) {
            asHTTP(opts, client, subChan, onResponse, logger);
        } else {
            asJSON(opts, request, onResponse);
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

function asThrift(opts, request, onResponse) {
    var spec = readThriftSpec(opts);

    if (opts.body) {
        opts.body = JSON.parse(opts.body);
    }
    if (opts.head) {
        opts.head = JSON.parse(opts.head);
    }

    var sender = new TChannelAsThrift({source: spec});

    // The following is a hack to produce a nice error message when
    // the endpoint does not exist. It is a temporary solution based
    // on the thriftify interface. How the existence of this endpoint
    // is checked and this error thrown will change when we move to
    // the thriftrw rewrite.
    try {
        sender.send(request, opts.endpoint, opts.head,
            opts.body, onResponse);
    } catch(e) {
        if (e.message ===
            fmt('type %s_args not found', opts.endpoint)) {
            var emsg = fmt('%s endpoint does not exist', opts.endpoint);
            onResponse(new Error(emsg));
        } else {
            throw e;
        }
    }
}

function asRaw(opts, request, onResponse) {
    request.headers.as = 'raw';
    request.send(opts.endpoint, opts.head, opts.body,
        onResponse);
}

function asHTTP(opts, client, subChan, onResponse, logger) {
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
}

function asJSON(opts, request, onResponse) {
    var sender = new TChannelAsJSON();

    if (opts.body) {
        opts.body = JSON.parse(opts.body);
    }
    if (opts.head) {
        opts.head = JSON.parse(opts.head);
    }
    sender.send(request, opts.endpoint, opts.head,
        opts.body, onResponse);
}
