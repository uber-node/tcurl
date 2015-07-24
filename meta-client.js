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

var TChannelAsThrift = require('tchannel/as/thrift');
var fs = require('fs');
var path = require('path');
var process = require('process');

module.exports = MetaClient;

function MetaClient(options) {
    if (!(this instanceof MetaClient)) {
        return new MetaClient(options);
    }

    var self = this;

    self.channel = options.channel;
    self.logger = options.logger;
    var spec = fs.readFileSync(path.join(__dirname, 'meta.thrift'), 'utf8');
    self.asThrift = new TChannelAsThrift({source: spec});
}

MetaClient.prototype.health = function health(req, cb) {
    var self = this;
    self.asThrift.send(req, 'Meta::health', null, {}, onResponse);
    function onResponse(err, resp) {
        var msg;
        var isHealthy = null;

        if (err || !resp || !resp.ok || !resp.body.ok) {
            msg = 'notOk';
            isHealthy = false;
            if (resp && resp.body && resp.body.message) {
                msg += '\n' + resp.body.message;
            }
        } else {
            msg = 'ok';
            isHealthy = true;
        }

        self.logger.log('log', msg);
        self.channel.close();
        if (cb) {
            cb(msg);
        } else {
            /*eslint no-process-exit: 0*/
            process.exit(isHealthy ? 0 : 1);
        }
    }
};
