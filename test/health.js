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

/* jshint maxparams:5 */

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

function badHealth(opts, req, head, body, cb) {
    return cb(null, {
        ok: true,
        body: {ok: false, message: 'having a bad day!'}
    });
}

function veryBadHealth(opts, req, head, body, cb) {
    var networkError = new Error('network failure');
    cb(networkError);
}

test('getting an ok', function t(assert) {
    var server = new TChannel({
        serviceName: 'server'
    });
    var opts = {
        isOptions: true
    };

    var hostname = '127.0.0.1';
    var port = 4040;
    var endpoint = 'Meta::health';
    var serviceName = 'server';
    asThrift.register(server, endpoint, opts, goodHealth);
    server.listen(port, hostname, onListening);
    function onListening() {
        var cmd = [
            '-p', hostname + ':' + port,
            serviceName,
            null,
            '--health'
        ];

        tcurl.exec(cmd, onResponse);

        function onResponse(msg) {
            assert.equals(msg, 'ok', 'should be ok');
            server.close();
            assert.end();
        }
    }
});

test('getting a notOk', function t(assert) {
    var server = new TChannel({
        serviceName: 'server'
    });
    var opts = {
        isOptions: true
    };

    var hostname = '127.0.0.1';
    var port = 4040;
    var endpoint = 'Meta::health';
    var serviceName = 'server';
    asThrift.register(server, endpoint, opts, badHealth);
    server.listen(port, hostname, onListening);
    function onListening() {
        var cmd = [
            '-p', hostname + ':' + port,
            serviceName,
            null,
            '--health'
        ];

        tcurl.exec(cmd, onResponse);

        function onResponse(msg) {
            assert.equals(msg, 'notOk\nhaving a bad day!', 'should be notOk');
            server.close();
            assert.end();
        }
    }
});

test('getting an error', function t(assert) {
    var server = new TChannel({
        serviceName: 'server'
    });
    var opts = {
        isOptions: true
    };

    var hostname = '127.0.0.1';
    var port = 4040;
    var endpoint = 'Meta::health';
    var serviceName = 'server';
    asThrift.register(server, endpoint, opts, veryBadHealth);
    server.listen(port, hostname, onListening);
    function onListening() {
        var cmd = [
            '-p', hostname + ':' + port,
            serviceName,
            null,
            '--health'
        ];

        tcurl.exec(cmd, onResponse);

        function onResponse(msg) {
            assert.equals(msg, 'notOk', 'should be notOk');
            server.close();
            assert.end();
        }
    }
});
