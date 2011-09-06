var ftp = require('../');
var assert = require('assert');
var callback = false;

ftp.get('ftp://127.0.0.1/foo.txt', function (err, res) {
	callback = true;
	assert.ifError(err);
	assert.deepEqual(res, 'bar\n');
});

process.on('exit', function () {
	assert.ok(callback);
});
