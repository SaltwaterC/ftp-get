'use strict';

var ftp = require('../');

var assert = require('assert');

var common = require('./includes/common.js');

var callbacks = {
	get: 0
};

ftp.get({
	url: 'ftp://127.0.0.1/foo.txt',
	bufferType: 'buffer'
}, function (err, res) {
	callbacks.get++;
	assert.ifError(err);
	assert.strictEqual(res.toString(), 'bar\n');
});

common.teardown(callbacks);
