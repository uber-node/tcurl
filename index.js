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
/*eslint max-params: [2, 6] */
'use strict';

var TChannel = require('tchannel');
var TChannelAsThrift = require('tchannel/as/thrift');
var TChannelAsJSON = require('tchannel/as/json');
var minimist = require('minimist');
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
var HealthLogger = require('./health-logger');
var TCurlAsHttp = require('./as-http');

module.exports = main;

var minimistArgs = {
    string: ['thrift', 'json', 'head', 'body'],
    boolean: ['raw', 'json', 'strict'],
    alias: {
        p: 'peer',
        H: 'hostlist',
        t: 'thrift',
        j: 'json',
        2: 'head',
        3: 'body',
        arg2: 'head',
        arg3: 'body'
    },
    default: {
        head: '',
        body: '',
        strict: true
    }
};

// delegate implements error(message, err), response(res), exit()
function main(argv, delegate) {

    argv = minimist(argv, minimistArgs);

    var conf = extend(
        rc('tcurl', {}, argv),
        env(),
        argv
    );

    if (conf.help) {
        return printFullHelp();
    } else if (conf.h || conf._.length === 0) {
        return help();
    }

    var opts = parseArgs(conf);
    var tcurl = new TCurl();

    if (opts.health) {
        delegate = delegate || new HealthLogger();
        opts.thrift = path.join(__dirname, 'meta.thrift');
        opts.endpoint = 'Meta::health';
    } else {
        delegate = delegate || new Logger();
    }

    return tcurl.request(opts, delegate);
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
    console.log('usage: tcurl [--help] [-H] [-p] [-t]');
    console.log('             [-2 | --arg2 | --head] [-3 | --arg3 | --body]');
    console.log('             [--shardKey] [--no-strict]  [--timeout]');
    console.log('             [--http] [--raw] [--health]');
}

function printFullHelp() {
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
    var service = argv._[0];
    var endpoint = argv._[1];
    var health = argv.health;

    // Prefer peer specified at the command line over hostlist
    var peers = argv.peer || !argv.hostlist ?
        [argv.peer] : JSON.parse(fs.readFileSync(argv.hostlist));

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

    assert(health || endpoint, 'endpoint required');
    assert(service, 'service required');

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
        head: argv.head,
        body: argv.body,
        shardKey: argv.shardKey,
        service: service,
        endpoint: endpoint,
        peers: peers,
        argScheme: argScheme,
        thrift: argv.thrift,
        strict: argv.strict,
        http: argv.http,
        raw: argv.raw,
        timeout: argv.timeout,
        health: health
    };
}

function TCurl(opts) {
}

TCurl.prototype.parseJsonArgs = function parseJsonArgs(opts, delegate) {
    if (opts.raw) {
        return null;
    }

    var tuple = null;
    if (opts.head) {
        tuple = safeJsonParse(opts.head);
        opts.head = tuple[1] || opts.head;
    }
    if (tuple && tuple[0]) {
        delegate.error('Failed to parse arg2 (i.e., head) as JSON');
        delegate.error(tuple[0]);
    }

    tuple = null;
    if (opts.body) {
        tuple = safeJsonParse(opts.body);
        opts.body = tuple[1] || opts.body;
    }
    if (tuple && tuple[0]) {
        delegate.error('Failed to parse arg3 (i.e., body) as JSON');
        delegate.error(tuple[0]);
    }

    return null;
};

TCurl.prototype.readThrift = function readThrift(opts, delegate) {
    var self = this;
    try {
        return fs.readFileSync(opts.thrift, 'utf8');
    } catch (err) {
        if (err.code !== 'EISDIR') {
            delegate.error('Failed to read thrift file "' + opts.thrift + '"');
            delegate.error(err);
            return null;
        }
    }
    return self.readThriftDir(opts);
};

TCurl.prototype.readThriftDir = function readThriftDir(opts, delegate) {
    var sources = {};
    var files = fs.readdirSync(opts.thrift);
    files.forEach(function eachFile(file) {
        var match = /([^\/]+)\.thrift$/.exec(file);
        if (match) {
            var serviceName = match[1];
            var fileName = match[0];
            var thriftFilepath = path.join(opts.thrift, fileName);
            sources[serviceName] = fs.readFileSync(thriftFilepath, 'utf8');
        }
    });

    if (!sources[opts.service]) {
        delegate.error('Spec for service "' +
            opts.service + '" unavailable in directory "' + opts.thrift + '"');
        return null;
    }

    return sources[opts.service];
};

TCurl.prototype.request = function tcurlRequest(opts, delegate) {
    var self = this;

    // May report errors for arg2, arg3, or both
    self.parseJsonArgs(opts, delegate);
    if (delegate.exitCode) {
        return delegate.exit();
    }

    var client = TChannel({
        logger: DebugLogtron('tcurl')
    });

    var subChan = client.makeSubChannel({
        serviceName: opts.service,
        peers: opts.peers,
        requestDefaults: {
            serviceName: opts.service,
            headers: {
                cn: 'tcurl'
            }
        }
    });

    var peer = subChan.peers.choosePeer();
    // TODO: the host option should be called peer, hostPort, or address
    client.waitForIdentified({host: peer.hostPort}, onIdentified);

    function onIdentified(err) {
        if (err) {
            delegate.error(err);
            return delegate.exit();
        }

        var headers = opts.shardKey ? {sk: opts.shardKey} : {};

        var request = subChan.request({
            timeout: opts.timeout || 100,
            hasNoParent: true,
            serviceName: opts.service,
            headers: headers
        });

        if (opts.argScheme === 'thrift') {
            self.asThrift(opts, request, delegate, done);
        } else if (opts.argScheme === 'http') {
            self.asHTTP(opts, client, subChan, delegate, done);
        } else if (opts.argScheme === 'json') {
            self.asJSON(opts, request, delegate, done);
            // TODO fix argument order for each of these
        } else {
            self.asRaw(opts, request, delegate, done);
        }
    }

    function done() {
        client.quit();
    }
};

TCurl.prototype.asThrift = function asThrift(opts, request, delegate, done) {
    var self = this;

    var source = self.readThrift(opts, delegate);

    if (source === null) {
        done();
        return delegate.exit();
    }

    var sender;
    try {
        sender = new TChannelAsThrift({source: source, strict: opts.strict});
    } catch (err) {
        delegate.error('Error parsing Thrift IDL');
        delegate.error(err);
        delegate.error('Consider using --no-strict to bypass mandatory optional/required fields');
        done();
        return delegate.exit();
    }

    // The following is a hack to produce a nice error message when
    // the endpoint does not exist. It is a temporary solution based
    // on the thriftify interface. How the existence of this endpoint
    // is checked and this error thrown will change when we move to
    // the thriftrw rewrite.
    try {
        sender.send(request, opts.endpoint, opts.head,
            opts.body, onResponse);
    } catch (err) {
        // TODO untangle this mess
        if (err.message === fmt('type %s_args not found', opts.endpoint)) {
            delegate.error(fmt('%s endpoint does not exist', opts.endpoint));
            done();
            return delegate.exit();
        } else {
            delegate.error('Error response received for the as-thrift request.');
            delegate.error(err);
            done();
            return delegate.exit();
        }
    }

    function onResponse(err, res, arg2, arg3) {
        done();
        self.onResponse(err, res, arg2, arg3, opts, delegate);
    }
};

TCurl.prototype.asRaw = function asRaw(opts, request, delegate, done) {
    var self = this;
    request.headers.as = 'raw';
    request.send(opts.endpoint, opts.head, opts.body,
        onResponse);

    function onResponse(err, res, arg2, arg3) {
        done();
        self.onResponse(err, res, arg2, arg3, opts, delegate);
    }
};

TCurl.prototype.asHTTP = function asHTTP(opts, client, subChan, delegate, done) {
    var asHttp = TCurlAsHttp({
        channel: client,
        subChannel: subChan,
        method: opts.http,
        endpoint: opts.endpoint,
        headers: opts.head,
        body: opts.body,
        done: done,
        logger: delegate
    });
    asHttp.send();
};

TCurl.prototype.asJSON = function asJSON(opts, request, delegate, done) {
    var self = this;
    var sender = new TChannelAsJSON();
    sender.send(request, opts.endpoint, opts.head,
        opts.body, onResponse);

    function onResponse(err, res, arg2, arg3) {
        done();
        self.onResponse(err, res, arg2, arg3, opts, delegate);
    }
};

TCurl.prototype.onResponse = function onResponse(err, res, arg2, arg3, opts, delegate) {
    if (err) {
        delegate.error(err);
        return delegate.exit();
    }

    if (arg2 !== undefined && res) {
        res.head = arg2;
    }
    if (arg3 !== undefined && res) {
        res.body = arg3;
    }

    delegate.response(res, opts);
    return delegate.exit();
};

if (require.main === module) {
    main(process.argv.slice(2));
}
