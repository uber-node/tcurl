'use strict';

var path = require('path');

var Meta = {};

Meta.health = function health(tcurl, opts, onResponse) {

    opts.thrift = path.join(__dirname, 'meta.thrift');
    opts.endpoint = 'Meta::health';

    tcurl.request(opts, onHealthResponse);

    function onHealthResponse(err, res) {
        var msg;
        var isHealthy = null;

        if (err || !res || !res.ok || !res.body.ok) {
            msg = 'notOk';
            isHealthy = false;
            if (res && res.body && res.body.message) {
                msg += '\n' + res.body.message;
            }
        } else {
            msg = 'ok';
            isHealthy = true;
        }

        tcurl.logger.log('log', msg);
        onResponse({exitCode: isHealthy ? 0 : 1}, res);
    }
};

module.exports = Meta;
