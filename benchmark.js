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

var process = require('process');
var setTimeout = require('timers').setTimeout;
var BenchmarkLogger = require('./benchmark-logger');

function Benchmark(options) {
    if (!(this instanceof Benchmark)) {
        return new Benchmark(options);
    }

    var self = this;

    self.tcurl = options.tcurl;
    self.logger = options.logger;
    self.delegate = new BenchmarkLogger();
    if (self.logger.always) {
        self.delegate.logger = self.logger;
    }

    self.cmdOptions = options.cmdOptions;
    self.requests = options.cmdOptions.requests || 0;
    self.requestsLimit = self.requests !== 0;
    self.time = options.cmdOptions.time;

    if (self.time === undefined) {
        self.time = 0;
        if (self.requests === 0) {
            self.time = 30 * 1000;
        }
    }

    self.timeLimit = self.time !== 0;
    self.delay = options.cmdOptions.delay || 100;
    self.rate = options.cmdOptions.rate;
    if (typeof self.rate !== 'number' || self.rate <= 0) {
        self.logger.error('tcurl requires --rate to be a positive integer');
        self.logger.exit();
    }

    self.loop = 0;
}

Benchmark.prototype.run = function run(callback) {
    var self = this;
    self.tcurl.prepare(self.cmdOptions, self.delegate);
    self.stopTime = Date.now() + self.time;
    self.sendLoop(onComplete);

    function onComplete() {
        process.nextTick(callback);
    }
};

Benchmark.prototype.sendLoop = function sendLoop(callback) {
    var self = this;

    if (self.timeLimit && self.stopTime <= Date.now()) {
        return callback();
    }

    self.send(callback);
};

Benchmark.prototype.logResults = function logResults(errors, responses) {
    var self = this;

    var collection = {};
    var i;
    var type;
    var count;
    collection.succeeded = responses.length;
    for (i = 0; i < errors.length; i++) {
        type = errors[i].type || 'error.unkown';
        count = collection[type] || 0;
        count++;
        collection[type] = count;
    }

    self.logger.log('Loop ' + self.loop + ': ');
    self.logger.log('    succeeded: ' + (collection.succeeded || '0'));
    var keys = Object.keys(collection);
    for (i = 0; i < keys.length; i++) {
        if (keys[i] === 'succeeded') {
            continue;
        }

        self.logger.log('    ' + keys[i] + ': ' + collection[keys[i]]);
    }
};

Benchmark.prototype.collect = function collect(errors, responses, callback) {
    var self = this;

    self.loop++;

    self.logResults(errors, responses);

    // schedule next round
    self.requests -= self.rate;
    if (self.requestsLimit && self.rate > self.requests) {
        self.rate = self.requests;
    }

    if (!self.requestsLimit || self.requests > 0) {
        setTimeout(self.sendLoop.bind(self, callback), self.delay || 1);
    } else {
        callback();
    }
};

Benchmark.prototype.send = function send(callback) {
    var self = this;
    self.delegate.count = self.rate;
    self.delegate.collect = function collect(errors, responses) {
        self.collect(errors, responses, callback);
    };

    for (var i = 0; i < self.rate; i++) {
        var req = self.tcurl.createRequest(self.cmdOptions);
        self.tcurl.send(self.cmdOptions, req, self.delegate);
    }
};

module.exports = Benchmark;
