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

var console = require('console');
var util = require('util');
module.exports = Logger;

function Logger(options) {
    if (!(this instanceof Logger)) {
        return new Logger(options);
    }

    var self = this;
    self.options = {};
    self.options.json = options.json;
    self.options.raw = options.raw;
    self.options.depth = options.depth;
}

Logger.prototype.displayResponse =
function displayResponse(level, message, value) {
    var self = this;

    if (self.options.json) {
        self.display(level, {
            message: message,
            response: value
        });
    } else {
        self.display(level, message);
        self.display(level, value);
    }
};

Logger.prototype.display =
function display(level, message, fields) {
    var self = this;
    if (!fields) {
        self._display(level, message);
        return;
    }

    if (self.options.json) {
        self.display(level, {
            message: message,
            fields: fields
        });
    } else {
        self.display('error', message);
        self.display('error', fields);
    }
};

Logger.prototype._display = function _display(level, value) {
    var self = this;
    if (typeof value === 'string') {
        self.log(level, value);
    } else if (self.options.json) {
        self.log(level, JSON.stringify(value, null, self.options.json));
    } else if (self.options.raw) {
        self.log(level, String(value));
    } else {
        self.log(level, util.inspect(value, {
            depth: self.options.depth || 2
        }));
    }
};

Logger.prototype.log = function log(level, message) {
    /*eslint no-console: 0*/
    if (level === 'error') {
        console.error(message);
    } else {
        console.log(message);
    }
};
