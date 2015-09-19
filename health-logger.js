'use strict';

/* global console */
/* eslint no-console: [0] */

var util = require('util');
var Logger = require('./logger');

module.exports = HealthLogger;

function HealthLogger() {
    var self = this;
    Logger.call(self);
}

util.inherits(HealthLogger, Logger);

HealthLogger.prototype.response = function response(res, opts) {
    var self = this;
    var msg;
    if (self.exitCode === 0 && res && res.ok && res.body && res.body.ok) {
        console.log('ok');
    } else {
        self.exitCode = self.exitCode | 1;
        msg = 'notOk';
        if (res && res.body && res.body.message) {
            msg += '\n' + res.body.message;
        }
        console.log(msg);
    }
};
