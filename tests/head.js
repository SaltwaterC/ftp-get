var ftp = require('../');
var assert = require('assert');
var callback = false;

ftp.head('ftp://127.0.0.1/foo.txt', function (err, size) {
	callback = true;
	assert.ifError(err);
	assert.deepEqual(size, '4');
});

process.on('exit', function () {
	assert.ok(callback);
});
