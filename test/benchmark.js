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

var test = require('tape');
var tcurl = require('../index.js');
var TChannel = require('tchannel');
var TChannelAsThrift = require('tchannel/as/thrift');
var fs = require('fs');
var path = require('path');
var thriftText = fs.readFileSync(
    path.join(__dirname, '../meta.thrift'), 'utf8'
);

var asThrift = new TChannelAsThrift({source: thriftText});

function goodHealth(opts, req, head, body, cb) {
    return cb(null, {
        ok: true,
        body: {ok: true}
    });
}

function veryBadHealth(opts, req, head, body, cb) {
    var networkError = new Error('network failure');
    cb(networkError);
}

test('getting 10 reponses', function t(assert) {
    var server = new TChannel({
        serviceName: 'server'
    });
    var opts = {
        isOptions: true
    };

    var hostname = '127.0.0.1';
    var port;
    var endpoint = 'Meta::health';
    var serviceName = 'server';
    asThrift.register(server, endpoint, opts, goodHealth);

    function onServerListen() {
        port = server.address().port;
        onListening();
    }

    server.listen(0, hostname, onServerListen);

    function onListening() {
        var cmd = [
            '-p', hostname + ':' + port,
            serviceName,
            '--health',
            '--rate', '10',
            '--requests', '10'
        ];

        tcurl.exec(cmd, {
            always: true,
            responseCount: 0,
            errorCount: 0,
            response: function response() {
                this.responseCount++;
            },
            error: function error(err) {
                assert.ifError(err);
                this.errorCount++;
            },
            exit: function exit() {
                assert.equal(this.responseCount, 10, 'expect responseCount to be 10');
                assert.equal(this.errorCount, 0, 'expect errorCount to be 0');
                server.close();
                assert.end();
            },
            log: function log() { }
        });
    }
});

test('getting 5 reponses and 5 errors', function t(assert) {
    var server = new TChannel({
        serviceName: 'server'
    });
    var opts = {
        isOptions: true
    };

    var hostname = '127.0.0.1';
    var port;
    var endpoint = 'Meta::health';
    var serviceName = 'server';

    var count = 0;
    asThrift.register(server, endpoint, opts, function handler(option, req, head, body, cb) {
        count++;
        if (count <= 5) {
            return goodHealth(option, req, head, body, cb);
        } else {
            return veryBadHealth(option, req, head, body, cb);
        }
    });

    function onServerListen() {
        port = server.address().port;
        onListening();
    }

    server.listen(0, hostname, onServerListen);

    function onListening() {
        var cmd = [
            '-p', hostname + ':' + port,
            serviceName,
            '--health',
            '--rate', '10',
            '--requests', '10'
        ];

        tcurl.exec(cmd, {
            always: true,
            responseCount: 0,
            errorCount: 0,
            response: function response() {
                this.responseCount++;
            },
            error: function error() {
                this.errorCount++;
            },
            exit: function exit() {
                assert.equal(this.responseCount, 5, 'expect responseCount to be 10');
                assert.equal(this.errorCount, 5, 'expect errorCount to be 0');
                server.close();
                assert.end();
            },
            log: function log() { }
        });
    }
});

test('time limit works', function t(assert) {
    var server = new TChannel({
        serviceName: 'server'
    });
    var opts = {
        isOptions: true
    };

    var hostname = '127.0.0.1';
    var port;
    var endpoint = 'Meta::health';
    var serviceName = 'server';
    asThrift.register(server, endpoint, opts, goodHealth);

    function onServerListen() {
        port = server.address().port;
        onListening();
    }

    server.listen(0, hostname, onServerListen);

    function onListening() {
        var cmd = [
            '-p', hostname + ':' + port,
            serviceName,
            '--health',
            '--rate', '10',
            '--time', '20'
        ];

        tcurl.exec(cmd, {
            always: true,
            responseCount: 0,
            errorCount: 0,
            response: function response() {
                this.responseCount++;
            },
            error: function error() {
                this.errorCount++;
            },
            exit: function exit() {
                assert.ok(this.responseCount > 0, 'expect responseCount to be larger than 0');
                assert.equal(this.errorCount, 0, 'expect errorCount to be 0');
                server.close();
                assert.end();
            },
            log: function log() { }
        });
    }
});

test('delay works', function t(assert) {
    var server = new TChannel({
        serviceName: 'server'
    });
    var opts = {
        isOptions: true
    };

    var hostname = '127.0.0.1';
    var port;
    var endpoint = 'Meta::health';
    var serviceName = 'server';
    asThrift.register(server, endpoint, opts, goodHealth);

    function onServerListen() {
        port = server.address().port;
        onListening();
    }

    server.listen(0, hostname, onServerListen);

    function onListening() {
        var cmd = [
            '-p', hostname + ':' + port,
            serviceName,
            '--health',
            '--rate', '10',
            '--requests', '21',
            '--delay', '30'
        ];

        var start = Date.now();
        tcurl.exec(cmd, {
            always: true,
            responseCount: 0,
            errorCount: 0,
            response: function response() {
                this.responseCount++;
            },
            error: function error() {
                this.errorCount++;
            },
            exit: function exit() {
                assert.equal(this.responseCount, 21, 'expect responseCount to be 21');
                assert.equal(this.errorCount, 0, 'expect errorCount to be 0');
                assert.ok(Date.now() > start + 60, 'should delay more than 60ms');
                server.close();
                assert.end();
            },
            log: function log() { }
        });
    }
});
