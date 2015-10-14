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

var tabtab = require('tabtab');
var path = require('path');

var Services = require('./idl').Services;

module.exports = completion;

function completion(err, data) {
    if (err || !data) {
        return;
    }

    var hyperbahnService = process.argv[5];
    var endpoint = process.argv[6];

    var services = new Services(path.join(process.cwd(), 'idl'));

    services.list(onList);

    function onList(err, availableHyperbahnServices) {
        if (availableHyperbahnServices.indexOf(hyperbahnService) === -1) {
            return tabtab.log(availableHyperbahnServices, data);
        }

        services.listThrifts(hyperbahnService, onThrifts);
    }

    function onThrifts(err, availableThriftServices) {

        var fns = availableThriftServices.reduce(function (memo, thriftService) {
            var functions = services.functions[hyperbahnService][thriftService].map(function(f) {
                return thriftService + '::' + f;
            });
            return memo.concat(functions);
        }, []);

        var options = fns.filter(function(f) {
            return f.indexOf(endpoint) === 0;
        });

        if (options.length === 1 && options[0] === endpoint) {

        } else {
            return tabtab.log(options, data);
        }
    }
}