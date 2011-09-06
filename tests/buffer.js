var ftp = require('../');
var assert = require('assert');

ftp.get('ftp://127.0.0.1/foo.txt', function (err, res) {
	assert.ifError(err);
	assert.deepEqual(res, 'bar\n');
});
