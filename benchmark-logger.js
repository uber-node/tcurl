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

module.exports = BenchmarkLogger;

function BenchmarkLogger() {
    var self = this;
    self.errors = [];
    self.responses = [];
}

BenchmarkLogger.prototype.log = function log(message) {
    var self = this;
    if (self.logger) {
        self.logger.log(message);
    }
};

BenchmarkLogger.prototype.error = function error(err) {
    var self = this;
    if (self.logger) {
        self.logger.error(err);
    }
};

BenchmarkLogger.prototype.response = function response(res, opts) {
    var self = this;
    if (self.logger) {
        self.logger.response(res, opts);
    }
};

BenchmarkLogger.prototype.handleReponse = function handleReponse(err, res) {
    var self = this;
    if (err) {
        self.errors.push(err);
    }

    if (res) {
        self.responses.push(res);
    }

    if (self.count === self.errors.length + self.responses.length) {
        self.collect(self.errors, self.responses);
        self.errors = [];
        self.responses = [];
    }
};

BenchmarkLogger.prototype.exit = function exit() {
};
