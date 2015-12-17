
'use strict';

var test = require('tape');
var tcurl = require('../index.js');
var TChannel = require('tchannel');

function echo(req, res, arg2, arg3) {
    res.headers.as = 'raw';
    res.sendOk(arg2, arg3);
}

test('getting an ok response', function t(assert) {
    var server = new TChannel({
        serviceName: 'server'
    });
    var opts = {
        isOptions: true
    };

    var hostname = '127.0.0.1';
    var port;
    var endpoint = 'echo';
    var serviceName = 'server';

    server.register(endpoint, opts, echo);

    function onServerListen() {
        port = server.address().port;
        onListening();
    }

    server.listen(0, hostname, onServerListen);

    function onListening() {
        var cmd = [
            '-p', hostname + ':' + port,
            serviceName,
            endpoint,
            '--raw',
            'hello'
        ];

        tcurl.exec(cmd, {
            error: function error(err) {
                assert.ifError(err);
            },
            response: function response(res) {
                assert.deepEqual(res.arg3.toString(), 'hello', 'response passes through');
            },
            exit: function exit() {
                server.close();
                assert.end();
            }
        });
    }
});

test('getting an ok response with --body', function t(assert) {
    var server = new TChannel({
        serviceName: 'server'
    });
    var opts = {
        isOptions: true
    };

    var hostname = '127.0.0.1';
    var port;
    var endpoint = 'echo';
    var serviceName = 'server';

    server.register(endpoint, opts, echo);

    function onServerListen() {
        port = server.address().port;
        onListening();
    }

    server.listen(0, hostname, onServerListen);

    function onListening() {
        var cmd = [
            '-p', hostname + ':' + port,
            serviceName,
            endpoint,
            '--raw',
            '--body',
            'hello'
        ];

        tcurl.exec(cmd, {
            error: function error(err) {
                assert.ifError(err);
            },
            response: function response(res) {
                assert.deepEqual(res.arg3.toString(), 'hello', 'response passes through');
            },
            exit: function exit() {
                server.close();
                assert.end();
            }
        });
    }
});
