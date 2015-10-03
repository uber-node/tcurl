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

var timers = require('timers');
var test = require('tape');
var tcurl = require('../index.js');
var TChannel = require('tchannel');
var TChannelJSON = require('tchannel/as/json.js');

function echo(opts, req, head, body, cb) {
    cb(null, {
        ok: true,
        head: null,
        body: {
            opts: opts,
            head: head,
            body: body,
            serviceName: req.serviceName
       }
    });
}

test('getting an ok response', function t(assert) {
    var server = new TChannel({
        serviceName: 'server'
    });
    var opts = {
        isOptions: true
    };

    var hostname = '127.0.0.1';
    var port;
    var endpoint = 'echo';
    var head = {some: 'echo-head'};
    var body = {some: 'body'};
    var serviceName = 'server';

    var tchannelJSON = TChannelJSON();
    tchannelJSON.register(server, endpoint, opts, echo);

    function onServerListen() {
        port = server.address().port;
        onListening();
    }

    server.listen(0, hostname, onServerListen);

    function onListening() {
        var cmd = [
            '-p', hostname + ':' + port,
            serviceName,
            endpoint,
            '-2', JSON.stringify(head),
            '-3', JSON.stringify(body),
            '-J'
        ];

        tcurl.exec(cmd, {
            error: function error(err) {
                assert.ifError(err);
            },
            response: function response(res) {
                assert.deepEqual(res, {
                    ok: true,
                    head: null,
                    body: {
                        opts: {
                            isOptions: true
                        },
                        head: head,
                        body: body,
                        serviceName: serviceName
                    },
                    headers: {
                        'as': 'json'
                    }
                });
            },
            exit: function exit() {
                server.close();
                assert.end();
            }
        });
    }
});

function slowEcho(opts, req, head, body, cb) {
    timers.setTimeout(function slowReturn() {
        cb(null, {
            ok: true,
            head: null,
            body: {
                opts: opts,
                head: head,
                body: body,
                serviceName: req.serviceName
           }
        });
    }, 200);
}

test('timeouts work', function t(assert) {
    var server = new TChannel({
        serviceName: 'server'
    });
    var opts = {
        isOptions: true
    };

    var hostname = '127.0.0.1';
    var port;
    var endpoint = 'echo';
    var head = {some: 'echo-head'};
    var body = {some: 'body'};
    var serviceName = 'server';

    var tchannelJSON = TChannelJSON();
    tchannelJSON.register(server, endpoint, opts, slowEcho);

    function onServerListen() {
        port = server.address().port;
        onListening();
    }

    server.listen(0, hostname, onServerListen);

    function onListening() {
        var cmd = [
            '-p', hostname + ':' + port,
            serviceName,
            endpoint,
            '-2', JSON.stringify(head),
            '-3', JSON.stringify(body),
            '--timeout', 300,
            '-J'
        ];

        tcurl.exec(cmd, {
            error: function error(err) {
                assert.ifError(err);
            },
            response: function response(res) {
                assert.deepEqual(res, {
                    ok: true,
                    head: null,
                    body: {
                        opts: {
                            isOptions: true
                        },
                        head: head,
                        body: body,
                        serviceName: serviceName
                    },
                    headers: {
                        'as': 'json'
                    }
                });
            },
            exit: function exit() {
                server.close();
                assert.end();
            }
        });
    }
});
