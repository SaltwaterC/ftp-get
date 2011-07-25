var fs = require('fs');
var u = require('url');
var p = require('path');
var net = require('net');
var util = require('util');

var debug = function (message) {
	if (process.env.NODE_ENV == 'development') {
		util.log(message);
	}
};

var parseAuth = function (auth) {
	if (auth) {
		auth = auth.split(':');
		if (auth[0] && auth[1]) {
			return {
				user: auth[0],
				pass: auth[1]
			};
		}
	}
	return {};
};

var trim = function (string) {
	return string.replace(/^\s*/, '').replace(/\s*$/, '');
};

exports.get = function (url, file, cb) {
	var buffer = false;
	if (typeof file == 'function') {
		cb = file;
		buffer = true;
	} else {
		file = trim(file);
		file = p.resolve(file);
	}
	
	url = trim(url);
	url = u.parse(url);
	url.port = url.port || 21;
	var auth = parseAuth(url.auth);
	url.user = auth.user || 'anonymous';
	url.pass = auth.pass || 'anonymous@';
	
	var cmdSock  = dataSock = null;
	
	if (buffer) {
		var buf = '';
	} else {
		var ws = fs.createWriteStream(file);
		ws.on('error', function (err) {
			cleanupGarbage();
			cb(err);
		});
	}
	
	var pasvTimeout = setTimeout(function () {
		cmdErr = true;
		cmdSock.destroy();
		cb(new Error('Did not receive the data socket information.'));
	}, 60000);
	
	cmdSock = net.createConnection(url.port, url.hostname);
	cmdSock.setEncoding('utf8');
	
	var cleanupGarbage = function () {
		if (pasvTimeout) {
			clearTimeout(pasvTimeout);
		}
		if (cmdSock) {
			cmdSock.destroy();
		}
		if (dataSock) {
			dataSock.destroy();
		}
		if (ws) {
			ws.destroy();
		}
		if (typeof file == 'string') {
			fs.unlink(file);
		}
	};
	
	var cmdWrite = function (cmd, wcb) {
		if (cmdSock.writable) {
			debug('socket.write: ' + cmd);
			cmdSock.write(cmd + '\r\n', 'utf8', function () {
				cmdSock.once('data', function (data) {
					wcb(data);
				});
			});
		}
	};
	
	var pasvParse = function (data) {
		data = data.split(/\r\n/);
		for (var i in data) {
			var code = data[i].substr(0, 3);
			if (code == 227) {
				var address = data[i].match(/\((.*)\)/);
				address = address[1];
				address = address.split(',');
				return {
					host: address[0] + '.' + address[1] + '.' + address[2] + '.' + address[3],
					port: (address[4] * 256) + (parseInt(address[5]) | 0)
				};
			}
		}
		return {};
	};
	
	var errorWatch = function (data) {
		data = data.split(/\r\n/);
		for (var i in data) {
			var code = data[i].substr(0, 3);
			if (code.charAt(0) == '4' || code.charAt(0) == '5') {
				cleanupGarbage();
				var err = new Error('FTP Error: ' + data[i]);
				err.code = code;
				cb(err);
			}
		}
	};
	
	var getFile = function (pasv) {
		clearTimeout(pasvTimeout);
		var dataSock = net.createConnection(pasv.port, pasv.host);
		
		cmdSock.on('data', function (data) {
			errorWatch(data);
		});
		
		dataSock.on('connect', function () {
			cmdWrite('RETR ' + url.pathname, function (retr) {
				retr = retr.split(/\r\n/);
				for (var i in retr) {
					var expect = retr[i].substr(0, 3);
					if (expect == 150) {
						dataSock.on('data', function (data) {
							if (buffer) {
								buf += data;
							} else {
								try {
									ws.write(data);
								} catch (e) {} // handled by the error listener
							}
						});
					}
				}
			});
		});
		
		dataSock.on('error', function (err) {
			cleanupGarbage();
			cb(err);
		});
		
		dataSock.on('end', function () {
			debug('Ending the transfer.');
			cmdSock.end();
			if (buffer) {
				cb(undefined, buf);
			} else {
				if (ws) {
					ws.end();
					cb(undefined, file);
				}
			}
		});
	};
	
	cmdSock.on('connect', function () {
		cmdSock.once('data', function (data) {
			debug('Connected to the FTP server on ' + url.host + ':' + url.port + '.');
			errorWatch(data);
			cmdWrite('USER ' + url.user, function (data) {
				errorWatch(data);
				cmdWrite('PASS ' + url.pass, function (data) {
					errorWatch(data);
					cmdWrite('TYPE I', function (data) {
						errorWatch(data);
						cmdWrite('PASV', function (data) {
							var pasv = pasvParse(data);
							if ( ! pasv.host || ! pasv.port) {
								cleanupGarbage();
								cb(new Error('Unable to get the data connection information.'));
							} else {
								getFile(pasv);
							}
						});
					});
				});
			});
		});
	});
	
	cmdSock.on('error', function (err) {
		cleanupGarbage();
		cb(err);
	});
};
