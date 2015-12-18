
'use strict';

var test = require('tape');
var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;
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

test('getting an ok response with subprocess', function t(assert) {
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
            path.join(__dirname, '..', 'index.js'),
            '-p', hostname + ':' + port,
            serviceName,
            endpoint,
            '--raw',
            'hello'
        ];

        var proc = spawn('node', cmd);
        proc.stdout.setEncoding('utf-8');
        proc.stdout.on('data', onStdout);
        proc.stderr.setEncoding('utf-8');
        proc.stderr.on('data', onStderr);
        proc.on('exit', onExit);

        function onStdout(line) {
            assert.equals(line, 'hello');
        }

        function onStderr(line) {
            console.error(line);
            assert.fail('no stderr expected');
        }

        function onExit(code) {
            assert.equal(code, 0, 'exits with status 0');
            server.close();
            assert.end();
        }
    }
});

test('getting a bad request response with subprocess', function t(assert) {
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

    // No endpoint registered. Should return bad request.

    function onServerListen() {
        port = server.address().port;
        onListening();
    }

    server.listen(0, hostname, onServerListen);

    function onListening() {
        var cmd = [
            path.join(__dirname, '..', 'index.js'),
            '-p', hostname + ':' + port,
            serviceName,
            endpoint,
            '--raw',
            'hello'
        ];

        var proc = spawn('node', cmd);
        proc.stdout.setEncoding('utf-8');
        proc.stdout.on('data', onStdout);
        proc.stderr.setEncoding('utf-8');
        proc.stderr.on('data', onStderr);
        proc.on('exit', onExit);

        var erred = false;
        var outed = false;

        function onStdout(line) {
            var res = JSON.parse(line);
            assert.equals(res.ok, false, 'should not be ok');
            assert.equals(res.name, 'TchannelBadRequestError', 'should have BadRequest name');
            assert.ok(res.isError, 'should be an error');
            assert.ok(res.isErrorFrame, 'should be an error frame');
            outed = true;
        }

        function onStderr(line) {
            assert.equals(line, 'TchannelBadRequestError: no such endpoint ' +
                'service="server" endpoint="echo"\n', 'should log error message')
            erred = true;
        }

        function onExit(code) {
            assert.ok(outed, 'should log output');
            assert.ok(erred, 'should log error');
            assert.equal(code, 6, 'exits with status 6, bad request');
            server.close();
            assert.end();
        }
    }
});
