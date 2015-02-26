#!/usr/bin/env node

'use strict';

var parseArgs = require('minimist');
var TChannel = require('tchannel');
var console = require('console');
var process = require('process');
var myLocalIp = require('my-local-ip');
var url = require('url');
var DebugLogtron = require('debug-logtron');

if (require.main === module) {
    main(parseArgs(process.argv.slice(2)));
}

function main(argv) {
    /*eslint no-console: 0, max-statements: [2, 20] */
    if (argv.h || argv.help || argv._.length === 0) {
        console.log('tcurl [options] host:port');
        console.log('  ');
        console.log('  Options: ');
        console.log('    -d [data] send a body');
        return;
    }

    var body = argv.d || '';

    var uri = argv._[0];
    var parsedUri = url.parse('tchannel://' + uri);

    var client = TChannel({
        logger: DebugLogtron('tcurl')
    });

    if (parsedUri.hostname === 'localhost') {
        parsedUri.hostname = myLocalIp();
    }

    client.listen(0, myLocalIp());

    client.once('listening', onListen);

    function onListen() {
        client.send({
            host: parsedUri.hostname + ':' + parsedUri.port
        }, parsedUri.pathname || '/', null, body, onResponse);
    }

    function onResponse(err, res1, res2) {
        if (err) {
            throw err;
        }

        console.log(JSON.parse(String(res2)));
        client.quit();
    }
}
