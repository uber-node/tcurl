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

var safeJsonParse = require('safe-json-parse/tuple');

var Logger = require('./log');
var TCurlAsHttp = require('./as-http');
var Meta = require('./meta');

var packageJson = require('./package.json');

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

// calls callback with (err, res, tcurl, opts) or logs/exits
function main(argv, callback) {
    if (argv.help || argv._.length === 0) {
        return help();
    }

    var opts = parseArgs(argv);
    var tcurl = new TCurl();
    callback = callback || function exit(err, res) {
        tcurl.exit(err, res, opts);
    };

    if (opts.health) {
        return Meta.health(tcurl, opts, callback);
    } else {
        return tcurl.request(opts, callback);
    }
}

main.exec = function execMain(str, callback) {
    main(minimist(str, minimistArgs), callback);
};

function help() {
    var helpMessage = [
        'tcurl [-H <hostlist> | -p host:port] <service> <endpoint> [options]',
        '  ',
        '  Version: ' + packageJson.version,
        '  Options: ',
        // TODO @file; @- stdin.
        '    -2 [data] send an arg2 blob',
        '    -3 [data] send an arg3 blob',
        '    --shardKey send ringpop shardKey transport header',
        '    --depth=n configure inspect printing depth',
        '    -j print JSON',
        '    -J [indent] print JSON with indentation',
        '    -t [dir] directory containing Thrift files',
        '    --http method',
        '    --raw encode arg2 & arg3 raw',
        '    --health',
        '    --timeout [num]'
    ].join('\n');
    console.log(helpMessage);
    return;
}

function parseArgs(argv) {
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
        shardKey: argv.shardKey,
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
        health: health
    };
}

function TCurl(opts) {
    var self = this;
    opts = opts || {};
    self.logger = opts.logger || new Logger(opts);
}

TCurl.prototype.reportError = function reportError(message, err, opts) {
    var self = this;
    self.logger.display('error', message, opts, {
        error: {
            message: err.message,
            type: err.type,
            arguments: err.arguments,
            name: err.name
        }
    });
};

TCurl.prototype.parseJsonArgs = function parseJsonArgs(opts) {
    var self = this;

    if (opts.raw) {
        return null;
    }

    var tuple = null;
    if (opts.body) {
        tuple = safeJsonParse(opts.body);
        opts.body = tuple[1] || opts.body;
    }
    if (tuple && tuple[0]) {
        return self.jsonParseError(
            'Failed to JSON parse arg3 (i.e. request body).',
            opts.body,
            tuple[0],
            opts);
    }

    tuple = null;
    if (opts.head) {
        tuple = safeJsonParse(opts.head);
        opts.head = tuple[1] || opts.head;
    }
    if (tuple && tuple[0]) {
        return self.jsonParseError(
            'Failed to JSON parse arg2 (i.e. request head).',
            opts.head,
            tuple[0],
            opts
        );
    }

    return null;
};

TCurl.prototype.jsonParseError = function jsonParseError(message, source, err) {
    var effect = new Error(message + ' It should be JSON formatted.');
    effect.source = source;
    effect.cause = err;
    return effect;
};

TCurl.prototype.readThrift = function readThrift(opts) {
    var self = this;
    try {
        return fs.readFileSync(opts.thrift, 'utf8');
    } catch (err) {
        if (err.code !== 'EISDIR') {
            self.reportError('Failed to read thrift file "' +
                opts.thrift + '"', err, opts);
            return null;
        }
    }
    return self.readThriftDir(opts);
};

TCurl.prototype.readThriftDir = function readThriftDir(opts) {
    var self = this;

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
        var err = new Error('Spec for service "' +
            opts.service + '" unavailable in directory "' + opts.thrift + '"');
        self.reportError(err.message, err, opts);
        return null;
    }

    return sources[opts.service];
};

TCurl.prototype.exit = function exit(err, res, opts) {
    var self = this;

    if (err && err.exitCode !== undefined) {
        process.exit(err.exitCode);
    }

    if (err) {
        self.logger.displayResponse('error',
            'Got an error response', opts, err);
        process.exit(1);
    } else if (!res.ok) {
        self.logger.displayResponse('error',
            'Got call response not ok', opts, res.body);
        process.exit(1);
    } else {
        self.logger.displayResponse('log',
            'Got call response ok', opts, res.body);
        process.exit(0);
    }
};

TCurl.prototype.request = function tcurlRequest(opts, callback) {
    var self = this;

    var parseErr = self.parseJsonArgs(opts);
    if (parseErr) {
        return callback(parseErr, null);
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

    client.waitForIdentified({
        host: opts.hostname + ':' + opts.port
    }, onIdentified);

    function onIdentified(err) {
        if (err) {
            return onResponse(err);
        }

        var headers = opts.shardKey ? {sk: opts.shardKey} : {};

        var request = subChan.request({
            timeout: opts.timeout || 100,
            hasNoParent: true,
            serviceName: opts.service,
            headers: headers
        });

        if (opts.thrift) {
            self.asThrift(opts, request, onResponse);
        } else if (opts.raw) {
            self.asRaw(opts, request, onResponse);
        } else if (opts.http) {
            self.asHTTP(opts, client, subChan, onResponse);
        } else {
            self.asJSON(opts, request, onResponse);
        }
    }

    function onResponse(err, res, arg2, arg3) {
        client.quit();

        if (arg2 !== undefined && res) {
            res.head = arg2;
        }
        if (arg3 !== undefined && res) {
            res.body = arg3;
        }

        callback(err, res);
    }
};

TCurl.prototype.asThrift = function asThrift(opts, request, onResponse) {
    var self = this;

    var source = self.readThrift(opts);

    if (source === null) {
        return onResponse({exitCode: 1}, null, self, opts);
    }

    var sender = new TChannelAsThrift({source: source});

    // The following is a hack to produce a nice error message when
    // the endpoint does not exist. It is a temporary solution based
    // on the thriftify interface. How the existence of this endpoint
    // is checked and this error thrown will change when we move to
    // the thriftrw rewrite.
    try {
        sender.send(request, opts.endpoint, opts.head,
            opts.body, onResponse);
    } catch (e) {
        if (e.message ===
            fmt('type %s_args not found', opts.endpoint)) {
            var emsg = fmt('%s endpoint does not exist', opts.endpoint);
            onResponse(new Error(emsg));
        } else {
            var msg = e.message || '';
            self.reportError('Error response received for the as-thrift request. ' + msg, e, opts);
            return onResponse(e);
        }
    }
};

TCurl.prototype.asRaw = function asRaw(opts, request, onResponse) {
    request.headers.as = 'raw';
    request.send(opts.endpoint, opts.head, opts.body,
        onResponse);
};

TCurl.prototype.asHTTP = function asHTTP(opts, client, subChan, onResponse) {
    var self = this;
    var asHttp = TCurlAsHttp({
        channel: client,
        subChannel: subChan,
        method: opts.http,
        endpoint: opts.endpoint,
        headers: opts.head,
        body: opts.body,
        onResponse: onResponse,
        logger: self.logger
    });
    asHttp.send();
};

TCurl.prototype.asJSON = function asJSON(opts, request, onResponse) {
    var sender = new TChannelAsJSON();
    sender.send(request, opts.endpoint, opts.head,
        opts.body, onResponse);
};

if (require.main === module) {
    main(minimist(process.argv.slice(2), minimistArgs));
}
