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

function Logger() {
}

Logger.prototype.displayResponse =
function displayResponse(level, message, opts, value) {
    var self = this;

    if (opts.json) {
        self.display(level, {
            message: message,
            response: value
        }, opts);
    } else {
        self.display(level, message, opts);
        self.display(level, value, opts);
    }
};

Logger.prototype.display =
function display(level, message, opts, fields) {
    var self = this;
    if (!fields) {
        self._display(level, message, opts);
        return;
    }

    if (opts.json) {
        self.display(level, {
            message: message,
            fields: fields
        }, opts);
    } else {
        self.display('error', message, opts);
        self.display('error', fields, opts);
    }
};

Logger.prototype._display = function _display(level, value, opts) {
    var self = this;
    if (opts.json) {
        self.log(level, JSON.stringify(value, null, opts.json));
    } else if (opts.raw) {
        self.log(level, String(value));
    } else {
        self.log(level, util.inspect(value, {
            depth: opts.depth || 2
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
