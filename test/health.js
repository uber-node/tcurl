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

/*global console */
/*eslint no-console: [0] */
/*eslint max-params: [2, 5] */

var test = require('tape');
var tcurl = require('../index.js');
var TChannel = require('tchannel');
var TChannelAsThrift = require('tchannel/as/thrift');
var fs = require('fs');
var spawn = require('child_process').spawn;
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

        tcurl.exec(cmd, {
            responded: false,
            response: function response(res) {
                this.responded = true;
            },
            error: function error(err) {
                assert.ifError(err);
            },
            exit: function exit() {
                assert.ok(this.responded, 'expect response');
                server.close();
                assert.end();
            }
        });
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

        tcurl.exec(cmd, {
            error: function error(err) {
                assert.ifError(err);
            },
            response: function response(res) {
                this.ok = res.body.ok;
                assert.equals(res.body.ok, false, 'NOT OK');
                assert.equals(res.body.message, 'having a bad day!', 'should be notOk');
            },
            exit: function exit() {
                assert.equal(this.ok, false, 'exits with error');
                server.close();
                assert.end();
            }
        });
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

        tcurl.exec(cmd, {
            erred: false,
            responded: false,
            error: function error() {
                this.erred = true;
            },
            response: function response(res) {
                this.responded = true;
            },
            exit: function exit() {
                assert.equals(this.erred, true, 'should exit with error');
                assert.equals(this.responded, false, 'should not respond');
                server.close();
                assert.end();
            }
        });
    }
});

test('test healthy endpoint with subprocess', function t(assert) {

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
            path.join(__dirname, '..', 'index.js'),
            '-p', hostname + ':' + port,
            serviceName,
            null,
            '--health'
        ];

        var proc = spawn('node', cmd);
        proc.stdout.setEncoding('utf-8');
        proc.stdout.on('data', onStdout);
        proc.stderr.setEncoding('utf-8');
        proc.stderr.on('data', onStderr);
        proc.on('exit', onExit);

        function onStdout(line) {
            assert.equal(line, 'OK\n', 'expected stdout');
        }
        function onStderr(line) {
            console.error(line);
            assert.fail('no stderr expected');
        }

        function onExit(code) {
            server.close();
            assert.equal(code, 0, 'exits with status 0');
            assert.end();
        }

    }
});

test('test un-healthy endpoint with subprocess', function t(assert) {

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
            path.join(__dirname, '..', 'index.js'),
            '-p', hostname + ':' + port,
            serviceName,
            null,
            '--health'
        ];

        var proc = spawn('node', cmd);
        proc.stdout.setEncoding('utf-8');
        proc.stdout.on('data', onStdout);
        proc.stderr.setEncoding('utf-8');
        proc.stderr.on('data', onStderr);
        proc.on('exit', onExit);

        function onStdout(line) {
            assert.equal(line, 'NOT OK\nhaving a bad day!\n', 'expected stdout');
        }
        function onStderr(line) {
            console.error(line);
            assert.fail('no stderr expected');
        }

        function onExit(code) {
            server.close();
            assert.equal(code, 124, 'exits with status 124');
            assert.end();
        }

    }
});

test('test non-existent service with subprocess', function t(assert) {
    var hostname = '127.0.0.1';
    var port = 4040;
    var serviceName = 'server';

    var cmd = [
        path.join(__dirname, '..', 'index.js'),
        '-p', hostname + ':' + port,
        serviceName,
        null,
        '--health'
    ];

    var proc = spawn('node', cmd);
    proc.stdout.setEncoding('utf-8');
    proc.stdout.on('data', onStdout);
    proc.on('exit', onExit);

    function onStdout(line) {
        assert.equal(line, 'NOT OK\n', 'expected stdout');
    }

    function onExit(code) {
        assert.equal(code, 125, 'exits with status 125');
        assert.end();
    }
});
