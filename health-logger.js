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

/* global console */
/* eslint no-console: [0] */

var util = require('util');
var Logger = require('./logger');
var EXIT_CODES = require('./exit-codes');

module.exports = HealthLogger;

function HealthLogger() {
    var self = this;
    self.deemed = null;
    Logger.call(self);
}

util.inherits(HealthLogger, Logger);

HealthLogger.prototype.deem = function deem(verdict) {
    var self = this;
    if (self.deemed !== null) {
        return;
    }
    self.deemed = verdict;
    console.log(verdict);
};

HealthLogger.prototype.error = function error(err) {
    var self = this;
    self.deem('NOT OK');
    Logger.prototype.error.call(self, err);
    self.exitCode = EXIT_CODES.ERROR;
};

HealthLogger.prototype.response = function response(res, opts) {
    var self = this;
    var msg;
    if (self.exitCode === 0 && res && res.ok && res.body && res.body.ok) {
        self.deem('OK');
    } else {
        self.deem('NOT OK');
        self.exitCode = EXIT_CODES.HEALTH_NOT_OK;
        msg = 'NOT OK';
        if (res && res.body && res.body.message) {
            console.log(res.body.message);
        }
    }
};
