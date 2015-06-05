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

var http = require('http');
var ReadySignal = require('ready-signal/counted');
var TChannelAsHTTP = require('tchannel/as/http');
var TChannel = require('tchannel');

module.exports = TCurlAsHttp;

function TCurlAsHttp(options) {
    if (!(this instanceof TCurlAsHttp)) {
        return new TCurlAsHttp(options);
    }

    var self = this;
    self.host = '127.0.0.1';
    self.port = 8000;
    self.proxyPort = 8080;

    self.remoteHostPort = options.remoteHostPort;
    self.serviceName = options.serviceName;
    self.logger = options.logger;

    self.method = options.method;
    self.headers = options.headers;
    self.path = options.endpoint;
    self.body = options.body;
    self.onResponse = options.onResponse;
}

TCurlAsHttp.prototype.send = function send() {
    var self = this;

    self.client = TChannel();
    var asHttpClient = TChannelAsHTTP();
    var subClient = self.client.makeSubChannel({
        serviceName: self.serviceName,
        peers: [self.remoteHostPort],
        requestDefaults: {
            serviceName: self.serviceName
        }
    });

    self.proxy = http.createServer(
        function onForwarding(hreq, hres) {
            asHttpClient.forwardToTChannel(subClient, hreq, hres);
        });

    var ready = ReadySignal(2);
    self.client.listen(self.port, self.host, ready.signal);
    self.proxy.listen(self.proxyPort, self.host, ready.signal);
    ready(function onReady(err) {
        if (err) {
            if (self.onResponse) {
                self.onResponse(err, null);
            } else {
                throw err;
            }
        }

        self.start();
    });
};

TCurlAsHttp.prototype.start = function start() {
    var self = this;
    var options = {
        hostname: self.host,
        port: self.proxyPort,
        path: self.endpoint,
        method: self.method,
        headers: self.headers
    };

    var hreq = http.request(options, onRes);
    if (self.body) {
        hreq.write(self.body);
    }
    hreq.end();

    function onRes(res) {
        var str = '';

        self.logger.display('log', res.statusCode);

        // another chunk of data has been recieved, so append it to `str`
        res.on('data', function onData(chunk) {
            str += chunk;
        });

        // the whole response has been recieved, so we just print it out here
        res.on('end', function onEnd() {
            self.logger.display('log', str);
            self.client.close();
            self.proxy.close();

            if (self.onResponse) {
                self.onResponse(null, str);
            }
        });
    }
};
