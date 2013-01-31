'use strict';

var ftp = require('../');

var assert = require('assert');
var fs = require('fs');

var common = require('./includes/common.js');

var file = './foo.txt';
var callbacks ={
	get: 0
};

ftp.get('ftp://127.0.0.1/foo.txt', file, function (err, res) {
	callbacks.get++;
	
	assert.ifError(err);
	fs.stat(file, function (err) {
		assert.ifError(err);
		fs.readFile(file, function (err, data) {
			assert.ifError(err);
			assert.strictEqual(data.toString(), 'bar\n');
			fs.unlink(file, function (err) {
				assert.ifError(err);
			});
		});
	});
});

common.teardown(callbacks);
