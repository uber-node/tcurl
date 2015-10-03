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

var http = require('http');
var ReadySignal = require('ready-signal/counted');
var test = require('tape');
var tcurl = require('../index.js');
var TChannel = require('tchannel');
var TChannelAsHTTP = require('tchannel/as/http.js');

test('getting an ok response', function t(assert) {
    var hostname = '127.0.0.1';
    var serviceName = 'service';
    var body = 'Hello Server';
    var port;
    var httpPort;

    var server = new TChannel({});
    var asHttpServer = TChannelAsHTTP();
    var subServer = server.makeSubChannel({
        serviceName: serviceName,
        streamed: true
    });
    var httpServer = http.createServer(function onRequest(hreq, hres) {
        assert.equal(hreq.url, '/echo');

        assert.equals(hreq.headers.special, 'CQ', 'header should be CQ');
        hreq.on('data', function onData(chunk) {
            assert.equals(
                String(chunk),
                body,
                'body should equal');
        });
        hreq.on('end', function onData() {
          hres.writeHead(200, 'OK', {'Content-Type': 'text/plain'});
          hres.end('Hello Test');
      });
    });

    asHttpServer.setHandler(subServer, function onRequest(req, res) {
        asHttpServer.forwardToHTTP(
            subServer, {
                host: hostname,
                port: httpPort
            },
            req,
            res,
            function forwarded(err) {
                if (err) {
                    assert.end(err);
                }
            }
        );
    });

    var endpoint = '/echo';
    var method = 'POST';
    var head = {
        Accept: 'text/plain',
       'Accept-Language': 'en-US',
       special: 'CQ'
    };

    var ready = ReadySignal(2);

    function onServerListen() {
        port = server.address().port;
        ready.signal();
    }

    function onHttpServerListen() {
        httpPort = httpServer.address().port;
        ready.signal();
    }

    server.listen(0, hostname, onServerListen);
    httpServer.listen(0, hostname, onHttpServerListen);

    ready(onListening);

    function onListening() {
        var cmd = [
            '-p',
            hostname + ':' + port,
            serviceName,
            endpoint,
            '--http', method,
            '-2', JSON.stringify(head),
            '-3', JSON.stringify(body)
        ];

        tcurl.exec(cmd, {
            log: function log(statusCode) {
                this.statusCode = statusCode;
            },
            response: function response(res) {
                assert.equals(res.toString(), 'Hello Test', 'response should equal');
            },
            exit: function exit(err) {
                assert.equal(this.statusCode, 200, 'status code should be 200');
                server.close();
                httpServer.close();
                assert.end(err);
            }
        });
    }
});
