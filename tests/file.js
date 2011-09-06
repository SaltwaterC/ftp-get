var ftp = require('../');
var assert = require('assert');
var fs = require('fs');
var file = './foo.txt';

ftp.get('ftp://127.0.0.1/foo.txt', file, function (err, res) {
	assert.ifError(err);
	fs.stat(file, function (err) {
		assert.ifError(err);
		fs.readFile(file, function (err, data) {
			assert.ifError(err);
			assert.deepEqual(data.toString(), 'bar\n');
			fs.unlink(file, function (err) {
				assert.ifError(err);
			});
		});
	});
});
