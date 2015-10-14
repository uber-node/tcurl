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
var PassThrough = require('readable-stream').PassThrough;
var TChannelAsHTTP = require('tchannel/as/http');

module.exports = TCurlAsHttp;

function TCurlAsHttp(options) {
    if (!(this instanceof TCurlAsHttp)) {
        return new TCurlAsHttp(options);
    }

    var self = this;

    self.remoteHostPort = options.remoteHostPort;
    self.serviceName = options.serviceName;
    self.logger = options.logger;
    self.channel = options.channel;
    self.subChannel = options.subChannel;

    self.asHttpClient = TChannelAsHTTP();
    self.method = options.method;
    self.headers = options.headers;
    self.endpoint = options.endpoint;
    self.body = options.body;
    self.done = options.done;
    self.delegate = options.delegate;
}

TCurlAsHttp.prototype.send = function send() {
    var self = this;

    var hreq = PassThrough();
    hreq.end(self.body);
    hreq.url = self.endpoint;
    hreq.method = self.method;
    hreq.headers = self.headers;

    var req = self.subChannel.request({
        streamed: true,
        hasNoParent: true
    });
    self.asHttpClient.channel = self.subChannel.topChannel;
    self.asHttpClient.sendRequest(req, hreq, null, null, onSent);

    function onSent(err, head, stream, body) {
        if (err) {
            self.done();
            self.logger.error(err);
            return self.logger.exit();
        }

        self.logger.log(head.statusCode);

        if (body) {
            onBodyEnd();
        } else {
            body = '';
            stream.on('data', onData);
            stream.on('end', onBodyEnd);
        }

        function onData(chunk) {
            body += chunk;
        }

        function onBodyEnd() {
            self.done();
            self.logger.response(body);
            self.logger.exit();
        }
    }
};
