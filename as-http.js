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
var Transform = require('stream').Transform;
var util = require('util');

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

    var hres = new HTTPResponse();
    self.asHttpClient.forwardToTChannel(self.subChannel, hreq, hres, {streamed: true}, onComplete);
    function onComplete(err) {
        if (err) {
            self.done();
            self.logger.error(err);
            return self.logger.exit();
        }
        self.done();
        self.logger.log(hres.statusCode);
        self.logger.response(hres.body);
        self.logger.exit();
    }
};

function HTTPResponse() {
    var self = this;
    Transform.call(self);

    self.statusCode = 200;
    self.body = '';
    self.headers = {};
}

util.inherits(HTTPResponse, Transform);

HTTPResponse.prototype._transform = function _transform(chunk, encoding, next) {
    var self = this;
    self.push(chunk);
    self.body += chunk;
    next();
};

HTTPResponse.prototype.setHeader = function setHeader(name, value) {
    var self = this;
    self.headers[name.toLowerCase()] = value;
};

HTTPResponse.prototype.writeHead = function writeHead(statusCode, message, headers) {
    var self = this;
    if (headers === undefined && typeof message === 'object') {
        headers = message;
    }
    self.statusCode = statusCode;
    if (headers) {
        for (var name in headers) {
            if (headers.hasOwnProperty(name)) {
                self.setHeader(name, headers[name]);
            }
        }
    }
};
