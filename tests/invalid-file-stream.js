var ftp = require('../');
var fs = require('fs');
var p = require('path');
var assert = require('assert');
var path = p.resolve('foo.txt');

try {
	fs.statSync(path);
	fs.unlinkSync(path);
} catch (e) {}

var fd = fs.openSync(path, 'w+');
fs.closeSync(fd);
fs.chmodSync(path, 0100);

ftp.get('ftp://127.0.0.1/foo.txt', path, function (err, res) {
	assert.ok(err instanceof Error);
	assert.equal(err.errno, 13);
	assert.deepEqual(err.code, 1);
});

process.on('exit', function () {
	fs.unlink(path, function (err) {
		assert.ifError(err);
	});
});