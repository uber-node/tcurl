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

/*eslint no-console: [0] */
/*eslint no-process-exit: [0] */
/*eslint max-params: [2, 7] */
/*eslint max-statements: [2, 40] */
'use strict';

var TChannel = require('tchannel');
var TChannelAsThrift = require('tchannel/as/thrift');
var TChannelAsJSON = require('tchannel/as/json');
var myLocalIp = require('my-local-ip');
var DebugLogtron = require('debug-logtron');
var rc = require('rc');
var rcUtils = require('rc/lib/utils');
var camelCaseKeys = require('camelcase-keys');
var traverse = require('traverse');
var extend = require('xtend');

var fmt = require('util').format;
var console = require('console');
var process = require('process');
var spawn = require('child_process').spawn;
var fs = require('fs');
var path = require('path');
var url = require('url');
var assert = require('assert');

var safeJsonParse = require('safe-json-parse/tuple');

var Logger = require('./logger');
var Benchmark = require('./benchmark');
var HealthLogger = require('./health-logger');
var TCurlAsHttp = require('./as-http');

var shon = require('shon/parse');
var ShonCursor = require('shon/cursor');
var ShonIterator = require('shon/iterator');
var ShonDelegate = require('shon/delegate');

var packageJson = require('./package.json');

module.exports = main;

var command = require('./tcurl.json');
var healthCommand = require('./health.json');

// delegate implements error(message, err), response(res), exit()
function main(argv, delegate) {

    var args = ['tcurl'].concat(argv);
    var cursor = new ShonCursor(args, 1);
    var iterator = new ShonIterator(cursor);
    var shonDelegate = new ShonDelegate({
        cursor: cursor,
        logUsage: help
    });
    var config = shon(command, iterator, shonDelegate);

    if (config === null) {
        return shonDelegate.end();
    }

    if (shonDelegate.trumped === 'help') {
        return help();
    } else if (shonDelegate.trumped === 'man') {
        return man();
    } else if (shonDelegate.trumped === 'version') {
        delegate = delegate || new Logger();
        return delegate.log(packageJson.version);
    } else if (shonDelegate.trumped === 'health') {
        cursor = new ShonCursor(args, 1);
        iterator = new ShonIterator(cursor);
        shonDelegate = new ShonDelegate({
            cursor: cursor,
            logUsage: help
        });
        config = shon(healthCommand, iterator, shonDelegate);
        if (config === null) {
            return shonDelegate.end();
        }
        delegate = delegate || new HealthLogger();
        config.thrift = path.join(__dirname, 'meta.thrift');
        config.endpoint = 'Meta::health';
    }

    config = extend(
        rc('tcurl', {}, config),
        env(),
        config
    );

    config = parseArgs(config);

    var tcurl = new TCurl();

    delegate = delegate || new Logger();

    if (config.rate) {
        var benchmark = new Benchmark({
            tcurl: tcurl,
            cmdOptions: config,
            logger: delegate
        });
        return benchmark.run(function done() {
            tcurl.client.close();
            delegate.exit();
        });
    }

    return tcurl.request(config, delegate);
}

function env() {
    var envConf = rcUtils.env('TCURL_');
    return traverse(envConf).map(camelcaseObjectKeys);

    function camelcaseObjectKeys(value) {
        if (typeof value === 'object') {
            this.update(camelCaseKeys(value));
        }
    }
}

main.exec = function execMain(str, delegate) {
    main(str, delegate);
};

function help() {
    console.log(fs.readFileSync(path.join(__dirname, 'usage.txt').trim(), 'utf8'));
}

function man() {
    var options = {
        cwd: process.cwd(),
        /*eslint no-process-env: [0] */
        env: process.env,
        setsid: false,
        customFds: [0, 1, 2]
    };

    spawn('man', [path.join(__dirname, 'man', 'tcurl.1')], options);
}

function parseArgs(argv) {
    var service = argv.service;
    var endpoint = argv.endpoint;
    var health = argv.health;

    // Prefer peer specified at the command line over peerlist
    var peers;
    if (argv.peers.length) {
        peers = argv.peers;
    } else if (argv.hostlist) {
        peers = parsePeerlist(argv.hostlist);
        if (peers === null) {
            return null;
        }
    } else {
        console.error('Must specify at least one peer with -p|--peer or -P|--peerlist');
        help();
        process.exit(-1);
    }

    var ip;
    function normalizePeer(address) {
        if (!ip) {
            ip = myLocalIp();
        }
        var parsedUri = url.parse('tchannel://' + address);
        if (parsedUri.hostname === 'localhost') {
            parsedUri.hostname = ip;
        }
        assert(parsedUri.hostname, 'host required');
        assert(parsedUri.port, 'port required');
        return parsedUri.hostname + ':' + parsedUri.port;
    }

    peers = peers.map(normalizePeer);

    if (!health && !endpoint) {
        console.error('Please specify an endpoint or --health');
        return null;
    }

    if (!service) {
        console.error('Please specify a service');
        return null;
    }

    var argScheme;
    if (argv.raw) {
        argScheme = 'raw';
    } else if (argv.http) {
        argScheme = 'http';
    } else if (argv.json) {
        argScheme = 'json';
    } else if (argv.thrift || health || endpoint.indexOf('::') >= 0) {
        argScheme = 'thrift';
    } else {
        argScheme = 'json';
    }

    return {
        body: argv.body,
        head: argv.head,
        jsonHead: argv.jsonHead,
        jsonBody: argv.jsonBody,
        shardKey: argv.shardKey,
        routingDelegate: argv.routingDelegate,
        service: service,
        endpoint: endpoint,
        peers: peers,
        argScheme: argScheme,
        thrift: argv.thrift,
        strict: argv.strict,
        http: argv.http,
        raw: argv.raw,
        timeout: argv.timeout,
        health: health,
        time: argv.time,
        requests: argv.requests,
        delay: argv.delay,
        rate: argv.rate
    };
}

function parsePeerlist(peerlist) {
    var text;
    try {
        text = fs.readFileSync(peerlist, 'utf-8');
    } catch (err) {
        console.error('Could not read peer list', peerlist);
        console.error(err.message);
        return null;
    }
    var json;
    try {
        json = JSON.parse(text);
    } catch (err) {
        console.error('Could not parse peer list', peerlist);
        console.error(err.message);
        return null;
    }
    return json;
}

function TCurl(opts) {
    if (!(this instanceof TCurl)) {
        return new TCurl(opts);
    }

    var self = this;
    self.subChannel = null;
    self.client = null;
}

TCurl.prototype.parseJsonArgs = function parseJsonArgs(opts, delegate) {
    if (opts.raw) {
        return null;
    }

    var tuple = null;
    if (opts.head) {
        opts.jsonHead = opts.head;
    } else if (opts.jsonHead) {
        tuple = safeJsonParse(opts.jsonHead);
        opts.jsonHead = tuple[1] || opts.jsonHead;
    }
    if (tuple && tuple[0]) {
        delegate.error('Failed to parse arg2 (i.e., head) as JSON');
        delegate.error(tuple[0]);
    }

    tuple = null;
    if (opts.body) {
        opts.jsonBody = opts.body;
    } else if (opts.jsonBody) {
        tuple = safeJsonParse(opts.jsonBody);
        opts.jsonBody = tuple[1] || opts.jsonBody;
    }
    if (tuple && tuple[0]) {
        delegate.error('Failed to parse arg3 (i.e., body) as JSON');
        delegate.error(tuple[0]);
    }

    return null;
};

TCurl.prototype.findThriftEntryPoint = function findThriftEntryPoint(opts, delegate) {
    var self = this;
    if (opts.thrift == null) {
        return null;
    }
    opts.thrift = path.resolve(opts.thrift);
    var files;
    try {
        files = fs.readdirSync(opts.thrift);
    } catch (err) {
        if (err.code === 'ENOTDIR') {
            return opts.thrift;
        }
        return null;
    }
    var basename = opts.service + '.thrift';
    if (files.indexOf(basename) >= 0) {
        return path.join(opts.thrift, basename);
    }
    return null;
};

TCurl.prototype.prepare = function prepare(opts, delegate) {
    var self = this;

    // May report errors for arg2, arg3, or both
    self.parseJsonArgs(opts, delegate);
    if (delegate.exitCode) {
        return delegate.exit();
    }

    self.client = TChannel({
        logger: DebugLogtron('tcurl'),
        trace: true
    });

    self.subChannel = self.client.makeSubChannel({
        serviceName: opts.service,
        peers: opts.peers,
        requestDefaults: {
            serviceName: opts.service,
            headers: {
                cn: 'tcurl'
            }
        }
    });
};

TCurl.prototype.createRequest = function createRequest(opts) {
    var self = this;
    var headers = {};
    if (opts.shardKey) {
        headers.sk = opts.shardKey;
    }
    if (opts.routingDelegate) {
        headers.rd = opts.routingDelegate;
    }
    return self.subChannel.request({
        timeout: opts.timeout || 100,
        hasNoParent: true,
        serviceName: opts.service,
        headers: headers
    });
};

TCurl.prototype.send = function send(opts, request, delegate) {
    var self = this;

    if (opts.argScheme === 'thrift') {
        self.asThrift(opts, request, delegate, done);
    } else if (opts.argScheme === 'http') {
        self.asHTTP(opts, self.client, self.subChannel, delegate, done);
    } else if (opts.argScheme === 'json') {
        self.asJSON(opts, request, delegate, done);
        // TODO fix argument order for each of these
    } else {
        self.asRaw(opts, request, delegate, done);
    }

    function done() {
        if (!opts.rate) {
            self.client.close();
        }
    }
};

TCurl.prototype.request = function tcurlRequest(opts, delegate) {
    var self = this;
    self.prepare(opts, delegate);
    self.send(opts, self.createRequest(opts), delegate);
};

TCurl.prototype.asThrift = function asThrift(opts, request, delegate, done) {
    var self = this;

    var entryPoint = self.findThriftEntryPoint(opts, delegate);

    if (entryPoint === null) {
        delegate.error('Must specify a thrift file with -t|--thrift for Thrift endpoints');
        delegate.error('or specify --json for JSON endpoints that contain ::');
        done();
        return delegate.exit();
    }

    var sender;
    try {
        sender = new TChannelAsThrift({
            entryPoint: entryPoint,
            strict: opts.strict
        });
    } catch (err) {
        if (err.name === 'SyntaxError') {
            // TODO works for now: does not work with include support unless
            // errors are annotated with the source file name.
            delegate.error(opts.thrift + ':' + err.line + ':' + err.column + ': Thrift Syntax Error');
            delegate.error(err.message);
        } else {
            delegate.error('Error parsing Thrift IDL');
            delegate.error(err);
            delegate.error('Consider using --no-strict to bypass mandatory optional/required fields');
        }
        done();
        return delegate.exit();
    }

    // The following is a hack to produce a nice error message when
    // the endpoint does not exist. It is a temporary solution based
    // on the thriftify interface. How the existence of this endpoint
    // is checked and this error thrown will change when we move to
    // the thriftrw rewrite.
    try {
        sender.send(request, opts.endpoint, opts.jsonHead,
            opts.jsonBody, onResponse);
    } catch (err) {
        // TODO untangle this mess
        if (err.message === fmt('type %s_args not found', opts.endpoint)) {
            delegate.error(fmt('%s endpoint does not exist', opts.endpoint));
        } else if (err.message.lastIndexOf('Got unexpected unserializable thrift', 0) === 0) {
            delegate.error('Invalid body for Thrift request');
            delegate.log(err);
        } else {
            delegate.error('Error response received for the as-thrift request.');
            delegate.error(err);
        }
        done();
        return delegate.exit();
    }

    function onResponse(err, res, arg2, arg3) {
        done();
        self.onResponse(err, res, request, arg2, arg3, opts, delegate);
    }
};

TCurl.prototype.asRaw = function asRaw(opts, request, delegate, done) {
    var self = this;
    request.headers.as = 'raw';
    var body = opts.jsonBody == null ? opts.body : opts.jsonBody;
    request.send(opts.endpoint, null, body,
        onResponse);

    function onResponse(err, res, arg2, arg3) {
        done();
        self.onResponse(err, res, request, arg2, arg3, opts, delegate);
    }
};

TCurl.prototype.asHTTP = function asHTTP(opts, client, subChan, delegate, done) {
    var asHttp = TCurlAsHttp({
        channel: client,
        subChannel: subChan,
        method: opts.http,
        endpoint: opts.endpoint,
        headers: opts.jsonHead,
        body: opts.jsonBody,
        done: done,
        logger: delegate
    });
    asHttp.send();
};

TCurl.prototype.asJSON = function asJSON(opts, request, delegate, done) {
    var self = this;
    var sender = new TChannelAsJSON();

    var body = opts.jsonBody == null ? {} : opts.jsonBody;

    sender.send(request, opts.endpoint, opts.jsonHead, body, onResponse);

    function onResponse(err, res, arg2, arg3) {
        done();
        self.onResponse(err, res, request, arg2, arg3, opts, delegate);
    }
};

TCurl.prototype.onResponse = function onResponse(err, res, request, arg2, arg3, opts, delegate) {
    if (typeof delegate.handleReponse === 'function') {
        delegate.handleReponse(err, res, arg2, arg3, opts);
    }

    if (err) {
        delegate.error(err);
        return delegate.exit();
    }

    if (arg2 !== undefined && res) {
        res.head = arg2;
    }
    if (arg3 !== undefined && res) {
        res.jsonBody = arg3;
    }

    delegate.response(res, request, opts);
    return delegate.exit();
};

if (require.main === module) {
    main(process.argv.slice(2));
}
