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

    var hostname = 'localhost';
    var port = 4040;
    var endpoint = 'echo';
    var head = {some: 'echo-head'};
    var body = {some: 'body'};
    var serviceName = 'server';

    var tchannelJSON = TChannelJSON();
    tchannelJSON.register(server, endpoint, opts, echo);

    server.listen(port, hostname, onListening);
    function onListening() {
        tcurl({
            hostname: hostname,
            port: port,
            head: head,
            endpoint: endpoint,
            service: serviceName,
            body: body,
            json: true,
            onResponse: onResponse
        });

        function onResponse(err, resp) {
            assert.ifError(err);
            assert.deepEqual(resp, {
                ok: true,
                head: null,
                body: {
                    opts: {
                        isOptions: true
                    },
                    head: head,
                    body: body,
                    serviceName: serviceName
                }
            });

            server.close();
            assert.end();
        }
    }
});
