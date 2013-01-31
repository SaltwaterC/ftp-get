'use strict';

var ftp = require('../');

var fs = require('fs');
var p = require('path');
var util = require('util');
var assert = require('assert');

var common = require('./includes/common.js');

var path = p.resolve('foo.txt');
var callbacks = {
	get: 0
};

var makeRequest = function () {
	util.log('calling ftp.get');
	ftp.get('ftp://127.0.0.1/foo.txt', path, function (err, res) {
		callbacks.get++;
		
		assert.ok(err instanceof Error);
		assert.deepEqual(err.code, 1);
		
		fs.unlink(path, function (err) {
			util.log('removed the test file');
			assert.ifError(err);
		});
	});
};

var createFile = function () {
	util.log('creating the test file');
	fs.open(path, 'w+', '0100', function (err, fd) {
		assert.ifError(err);
		fs.close(fd, function () {
			makeRequest();
		});
	});
};

fs.stat(path, function (err, stat) {
	if (err) {
		createFile();	
	} else {
		util.log('removing existing test file');
		fs.unlink(path, function (err) {
			assert.ifError(err);
			createFile();
		});
	}
});

common.teardown(callbacks);
