'use strict';

var test = require('tape');

var tcurl = require('../index.js');

test('tcurl is a function', function t(assert) {
    assert.equal(typeof tcurl, 'function');

    assert.end();
});

test('tcurl is not implemented', function t(assert) {
    assert.throws(function throwIt() {
        tcurl();
    }, /Not Implemented/);

    assert.end();
});
