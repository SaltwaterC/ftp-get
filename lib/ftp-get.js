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
	
	var socket = net.createConnection(url.port, url.hostname);
	socket.setEncoding('utf8');
	
	var ftpError = false;
	
	var write = function (cmd) {
		if ( ! ftpError) {
			debug('socket.write: ' + cmd);
			socket.write(cmd + '\r\n');
		}
	};
	
	socket.on('connect', function () {
		debug('Connected to the FTP server on ' + url.host + ':' + url.port + '.');
		setTimeout(function () { // kudos to the Microsoft FTP Service for this crap
			write('USER ' + url.user);
			write('PASS ' + url.pass);
			setTimeout(function () {
				write('TYPE I');
				write('PASV');
			}, 500);
		}, 500);
	});
	
	var passiveTimeout = setTimeout(function () {
		socket.destroy();
		cb(new Error('Did not receive the data channel information.'), {});
	}, 60000);
	
	socket.on('data', function (data) {
		var i, code;
		data = data.split(/\r\n/); // FTP uses CRLF
		for (i in data) {
			code = data[i].substr(0, 3);
			
			if (code == 227) { // received the passive information, open the data connection
				clearTimeout(passiveTimeout);
				var address = data[i].match(/\((.*)\)/);
				address = address[1].split(',');
				
				var options = {};
				options.port = (address[4] * 256) + (parseInt(address[5]) | 0);
				address.pop();
				address.pop();
				options.host = address.join('.');
				debug('Opening passive data connection for ' + options.host + ':' + options.port + '.');
				
				var dsock = net.createConnection(options.port, options.host);
				dsock.setTimeout(60000, function () {
					dsock.destroy();
					socket.destroy();
					cb(new Error('FTP data socket timeout.'), {});
				});
				
				dsock.on('connect', function () {
					debug('Connected to the FTP data port on ' + options.host + ':' + options.port + '.');
					debug('Sending the RETR ' + url.pathname + ' command.');
					write('RETR ' + url.pathname);
				});
				
				if ( ! buffer) {
					var ws = fs.createWriteStream(file);
					ws.on('error', function (error) {
						dsock.destroy();
						socket.destroy();
						ws.destroy();
						cb(error, {});
					});
				} else {
					var buf = '';
				}
				
				dsock.on('data', function (ddata) {
					if ( ! buffer) {
						try {
							ws.write(ddata);
						} catch (e) {} // handled by the error listener
					} else {
						buf += ddata;
					}
				});
				
				dsock.on('error', function (error) {
					if (passiveTimeout) {
						clearTimeout(passiveTimeout);
					}
					if (socket) {
						socket.destroy();
					}
					if (ws) {
						ws.destroy();
					}
					if (typeof file == 'string') {
						fs.unlink(file);
					}
					cb(error, {});
				});
				
				dsock.on('end', function () {
					debug('Ending the transfer.');
					socket.end();
					if ( ! buffer) {
						try {
							ws.end();
							cb(undefined, file);
						} catch (e) {} // handled by the error listener
					} else {
						cb(undefined, buf);
					}
				});
			}
			
			if (code.charAt(0) == '4' || code.charAt(0) == '5') {
				ftpError = true;
				if (passiveTimeout) {
					clearTimeout(passiveTimeout);
				}
				socket.destroy();
				if (dsock) {
					dsock.destroy();
				}
				if (ws) {
					ws.destroy();
				}
				if (typeof file == 'string') {
					fs.unlink(file);
				}
				var error = new Error('FTP Error: ' + data[i]);
				error.code = code;
				cb(error, {});
			}
		}
	});
	
	socket.on('error', function (error) {
		clearTimeout(passiveTimeout);
		cb(error, {});
	});
};
