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

var path = require('path');
var Thrift = require('thriftrw/thrift').Thrift;
var recursive = require('recursive-readdir');
var parallel = require('run-parallel');
var fs = require('fs');

module.exports.Services = Services;

function Services(idlPath) {
    this.path = idlPath;
    this.services = null;
    this.files = null;
    this.thrifts = {};
    this.functions = {};
}

Services.prototype.list = function list(cb) {
    var self = this;

    recursive(this.path, function (err, files) {
      var services = files.reduce(function acc(memo, file){
        var parts = file.split(path.sep);
        var filename = parts.pop();
        var service = parts.pop();
        if (/\.thrift$/.test(filename)) {
            if (!memo[service]) {
                memo[service] = [];
            }
            memo[service].push(file);
        }
        return memo;
      }, {});

      self.files = services;
      self.services = Object.keys(services);

      self.functions = self.services.reduce(function onServiceName(memo, serviceName) {
        memo[serviceName] = {};
        return memo;
      }, {});

      cb(null, self.services);
    });
}

Services.prototype.listThrifts = function listThrifts(serviceName, cb) {
    var self = this;

    if (self.thrifts[serviceName]) {
        return getServiceNames(self.thrifts[serviceName]);
    }

    if (!self.services) {
        self.list(loadThrifts);
    } else {
        loadThrifts();
    }

    function loadThrifts(err) {
        if (err) {
            return cb(err);
        }
        var tasks = self.files[serviceName].reduce(makeTaskAcc, {});
        parallel(tasks, onThrifts);
    }

    function onThrifts(err, thrifts) {
        if (err) {
            return cb(err);
        }
        self.thrifts[serviceName] = thrifts;
        readThriftServiceNamesAndFunctions(thrifts);

        cb(err, Object.keys(self.functions[serviceName]));
    }

    function makeTaskAcc(memo, filepath) {
        memo[filepath] = makeThriftThunk(filepath);
        return memo;
    }

    function makeThriftThunk(filepath) {
        return function thriftThunk(cb) {
            fs.readFile(filepath, 'utf8', onFile);

            function onFile(err, file) {
                cb(null, new Thrift({
                    source: file,
                    strict: false
                }));
            }
        }
    }

    function readThriftServiceNamesAndFunctions(thrifts) {
        self.functions[serviceName] = self.functions[serviceName] || {};

        Object.keys(thrifts).forEach(function readService(filepath) {
            var thrift = thrifts[filepath];
            Object.keys(thrift.services).forEach(function readFunctions(thriftServiceName) {
                self.functions[serviceName][thriftServiceName] = Object.keys(thrift.services[thriftServiceName].functionsByName);
            });
        });
    }

    function getServiceNames(thrifts) {
        return Object.keys(thrifts).reduce(function acc(memo, filepath) {
            var thrift = thrifts[filepath];
            var thriftServiceNames = Object.keys(thrift.services);

            self.functions[serviceName] = thriftServiceNames.reduce(function getFunctions(memo, n) {
                memo[n] = Object.keys(thrift.services[n]);
                return memo;
            }, {});

            return uniq(memo.concat(thriftServiceNames));
        }, []);
    }
}

Services.prototype.listFunctions = function listFunctions(serviceName, thriftService, cb) {
    var self = this;

    if (self.functions[serviceName] && self.functions[serviceName][thriftService]) {
        return setImmediate(function onNextTick() {
            cb(null, self.functions[serviceName][thriftService]);
        })
    }

    if (self.functions[serviceName]) {
        return self.listThrifts(serviceName, retry);
    }

    self.list(retry);

    function retry(err) {
        if (err) {
            return cb(err);
        }
        self.listFunctions(serviceName, thriftService, cb);
    }
}
