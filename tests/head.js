'use strict';

var ftp = require('../');

var assert = require('assert');

var common = require('./includes/common.js');

var callbacks = {
	head: 0
};

ftp.head('ftp://127.0.0.1/foo.txt', function (err, size) {
	callbacks.head++;
	assert.ifError(err);
	assert.strictEqual(size, 4);
});

common.teardown(callbacks);
