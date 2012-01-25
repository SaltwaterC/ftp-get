// TODO DRY up the code
var fs = require('fs');
var u = require('url');
var p = require('path');
var net = require('net');
var util = require('util');
require('./Object.watch.js');

var CRLF = '\r\n';

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

var processUrl = function (url) {
	url = String(url);
	url = url.trim();
	url = u.parse(url);
	url.port = url.port || 21;
	var auth = parseAuth(url.auth);
	url.user = auth.user || 'anonymous';
	url.pass = auth.pass || 'anonymous@';
	return url;
};

exports.get = function (url, file, cb) {
	var transfer = {ended: false};
	if (typeof file == 'function') {
		cb = file;
		file = null;
	} else {
		file = String(file);
		file = file.trim();
		file = p.resolve(file);
	}
	
	url = processUrl(url);
	
	var cmdSock = dataSock = null;
	var ftpErr = ended = false;
	
	if ( ! file) {
		var buf = '';
	} else {
		var transfer = {ended: false};
		var ws = fs.createWriteStream(file);
		transfer.watch('ended', function () {
			transfer.unwatch('ended');
			fs.fsync(fd, function () {
				ws.end();
			});
		});
		ws.on('error', function (err) {
			if ( ! ftpErr) {
				cleanupGarbage();
				err.code = 1; // write stream failure
				err.file = file;
				cb(err);
			}
		});
		ws.on('open', function (fd) {
			transfer.watch('ended', function () {
				transfer.unwatch('ended');
				fs.fsync(fd, function () {
					ws.end();
				});
			});
		});
		ws.on('close', function () {
			if ( ! ftpErr) {
				cb(null, file);
			}
		});
	}
	
	var pasvTimeout = setTimeout(function () {
		cmdSock.destroy();
		var err = new Error('Did not receive the data socket information.');
		err.code = 2; // data socket information timeout
		err.url = url;
		cb(err);
	}, 60000);
	
	cmdSock = net.createConnection(url.port, url.hostname);
	cmdSock.setEncoding('utf8');
	
	var cleanupGarbage = function () {
		ftpErr = true;
		ended = true;
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
			cmdSock.write(cmd + CRLF, 'utf8', function () {
				cmdSock.once('data', function (data) {
					wcb(data);
				});
			});
		}
	};
	
	var pasvParse = function (data) {
		data = data.split(CRLF);
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
		data = data.split(CRLF);
		for (var i in data) {
			if ( ! ftpErr) {
				var code = data[i].substr(0, 3);
				if (code.charAt(0) == '4' || code.charAt(0) == '5') {
					cleanupGarbage();
					var err = new Error('FTP Error: ' + data[i]);
					err.code = code;
					err.url = url;
					cb(err);
				}
			}
		}
	};
	
	var pasvWatch  = function (data) {
		var pasv = pasvParse(data);
		if (pasv.host && pasv.port) {
			getFile(pasv);
		}
	};
	
	var getFile = function (pasv) {
		clearTimeout(pasvTimeout);
		var dataSock = net.createConnection(pasv.port, pasv.host);
		
		dataSock.setTimeout(60000, function () {
			if ( ! ftpErr) {
				cleanupGarbage();
				var err = new Error('Data socket timeout.');
				err.code = 4; // data socket timeout
				err.url = url;
				cb(err);
			}
		});
		
		cmdSock.on('data', function (data) {
			errorWatch(data);
			pasvWatch(data);
		});
		
		dataSock.on('connect', function () {
			cmdWrite('RETR ' + url.pathname, function (data) {
				errorWatch(data);
			});
		});
		
		dataSock.on('data', function (data) {
			if ( ! file) {
				buf += data;
			} else {
				try {
					ws.write(data);
				} catch (e) {} // handled by the error listener
			}
		});
		
		dataSock.on('error', function (err) {
			if ( ! ftpErr) {
				cleanupGarbage();
				err.code = 3; // data socket error
				err.url = url;
				cb(err);
			}
		});
		
		dataSock.on('end', function () {
			if ( ! ftpErr) {
				ended = true;
				cmdSock.end();
				if ( ! file) {
					cb(null, buf);
				} else {
					transfer.ended = true;
				}
			}
		});
	};
	
	cmdSock.on('connect', function () {
		debug('Connected to the FTP server on ' + url.host + ':' + url.port + '.');
		var watchConnect = function (data) {
			if (data.match(CRLF + '$')) {
				debug('Received the end message of the connection message.');
				moveNext();
			}
		};
		var moveNext = function () {
			cmdSock.removeListener('data', watchConnect);
			cmdWrite('USER ' + url.user, function (data) {
				errorWatch(data);
				cmdWrite('PASS ' + url.pass, function (data) {
					errorWatch(data);
					cmdWrite('TYPE I', function (data) {
						errorWatch(data);
						cmdWrite('PASV', function (data) {
							errorWatch(data);
							pasvWatch(data);
						});
					});
				});
			});
		};
		cmdSock.on('data', watchConnect);
	});
	
	cmdSock.on('error', function (err) {
		if ( ! ftpErr) {
			cleanupGarbage();
			err.code = 5; // command socket failure
			err.url = url;
			cb(err);
		}
	});
	
	cmdSock.on('close', function () {
		if ( ! ended) {
			cleanupGarbage();
			var err = new Error('The command socket closed prematurely.');
			err.code = 5; // command socket failure
			err.url = url;
			cb(err);
		}
	});
};

exports.head = function (url, cb) {
	url = processUrl(url);
	var ftpErr = ended = false;
	var cmdSock = net.createConnection(url.port, url.hostname);
	cmdSock.setEncoding('utf8');
	
	var cmdWrite = function (cmd, wcb) {
		if (cmdSock.writable) {
			debug('socket.write: ' + cmd);
			cmdSock.write(cmd + CRLF, 'utf8', function () {
				cmdSock.once('data', function (data) {
					wcb(data);
				});
			});
		}
	};
	
	var errorWatch = function (data) {
		data = data.split(CRLF);
		for (var i in data) {
			if ( ! ftpErr) {
				var code = data[i].substr(0, 3);
				if (code.charAt(0) == '4' || code.charAt(0) == '5') {
					cleanupGarbage();
					var err = new Error('FTP Error: ' + data[i]);
					err.code = code;
					err.url = url;
					cb(err);
				}
			}
		}
	};
	
	var cleanupGarbage = function () {
		ftpErr = true;
		ended = true;
		if (cmdSock) {
			cmdSock.destroy();
		}
	};
	
	cmdSock.on('connect', function () {
		debug('Connected to the FTP server on ' + url.host + ':' + url.port + '.');
		var watchConnect = function (data) {
			if (data.match(CRLF + '$')) {
				debug('Received the end message of the connection message.');
				moveNext();
			}
		};
		var moveNext = function () {
			cmdSock.removeListener('data', watchConnect);
			cmdWrite('USER ' + url.user, function (data) {
				errorWatch(data);
				cmdWrite('PASS ' + url.pass, function (data) {
					errorWatch(data);
					cmdWrite('SIZE ' + url.pathname, function (data) {
						errorWatch(data);
						ended = true;
						cmdSock.end();
						if ( ! ftpErr) {
							cb(null, data.substr(4, data.length - 6));
						}
					});
				});
			});
		};
		cmdSock.on('data', watchConnect);
	});
	
	cmdSock.on('error', function (err) {
		if ( ! ftpErr) {
			cleanupGarbage();
			err.code = 5; // command socket failure
			err.url = url;
			cb(err);
		}
	});
	
	cmdSock.on('close', function () {
		if ( ! ended) {
			cleanupGarbage();
			var err = new Error('The command socket closed prematurely.');
			err.code = 5; // command socket failure
			err.url = url;
			cb(err);
		}
	});
};
