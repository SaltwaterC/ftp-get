'use strict';

/* core modules */
var fs = require('fs');
var u = require('url');
var p = require('path');
var net = require('net');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

/* internal module */
require('./Buffer.toByteArray.js');

var CRLF = '\r\n';
exports.CRLF = CRLF;

/**
 * util.debug wrapper. Outputs only when NODE_ENV=development
 *
 * @param {String} message
 */
var debug = function (message) {
	if (process.env.NODE_ENV === 'development') {
		util.debug('ftp-get - ' + String(message));
	}
};

/**
 * Returns the absolute integer value of the input. Avoids the NaN crap.
 * 
 * @param value
 * @returns {Number}
 */
var absInt = function (value) {
	/*jslint bitwise:true*/
	var sureInt = parseInt(value, 10) | 0;
	/*jslint bitwise:false*/
	return Math.abs(sureInt);
};

/**
 * Authentication info parser
 *
 * @param {String} auth
 * @returns {Object} auth
 */
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

/**
 * URL parser
 *
 * @param {String} url
 * @returns {Object} url
 */
var processUrl = function (url) {
	url = String(url);
	url = url.trim();
	url = u.parse(url);
	url.port = url.port || 21;
	
	var auth = parseAuth(url.auth);
	url.user = auth.user || 'anonymous';
	url.pass = auth.pass || 'anonymous@';
	
	// in order to save a CWD round trip
	// stripping the forward slash for files
	// at the apex of the FTP list
	// wu-ftpd + anonymous fails on these
	var path = url.pathname.split('/');
	if (path.length === 2) {
		url.pathftp = url.pathname.substring(1);
	} else {
		url.pathftp = url.pathname;
	}
	
	// ftp breaks on %20 and other stuff like this
	url.pathftp = decodeURIComponent(url.pathftp);
	
	return url;
};

/**
 * Parses the FTP server messages
 *
 * @param {String} data
 * @param {Object} messages
 */
var parseMessages = function (data) {
	var idx;
	var messages = [];
	
	data = String(data).split(CRLF);
	
	for (idx in data) {
		if (data.hasOwnProperty(idx)) {
			var code = data[idx].substring(0, 3);
			var message = data[idx].substring(3);
			
			messages.push({
				code: code,
				message: message
			});
			
			if (code !== '') {
				debug('socket.receive ' + code + ': ' + message);
			}
		}
	}
	
	return messages;
};

var endOfMessages = function (messages) {
	var idx;
	
	for (idx in messages) {
		if (messages.hasOwnProperty(idx)) {
			// some servers don't send the complete reply in one packet
			// node splits it in different data events
			// have fun debugging that ...
			if (messages[idx].code === '') {
				return true;
			}
		}
	}
	
	return false;
};

/**
 * The FTP client
 *
 * @param {Object} opt
 */
function FTP(opt) {
	EventEmitter.call(this);
	
	if (typeof opt === 'string') {
		opt = {url: opt};
	}
	
	if (typeof opt !== 'object') {
		throw new Error('You must pass an object for the client options.');
	}
	
	if (opt.url === undefined) {
		throw new Error('You must pass an url option to the ftp-get library.');
	}
	
	opt.url = processUrl(opt.url);
	
	opt.timeout = absInt(opt.timeout);
	if (opt.timeout === 0) {
		opt.timeout = 60;
	}
	opt.timeout = opt.timeout * 1000;
	
	opt.bufferType = opt.bufferType || 'string';
	if (opt.bufferType !== 'buffer' && opt.bufferType !== 'string') {
		throw new Error('Expecting buffer or string as buffer type.');
	}
	
	this.opt = opt;
	
	this.error = false;
	this.ended = false;
}

util.inherits(FTP, EventEmitter);

/**
 * Watches the data events for FTP errors
 *
 * @param {Array} messages
 * @returns {Object} error
 */
FTP.prototype.errorWatch = function (messages) {
	var self = this;
	var idx;
	
	for (idx in messages) {
		if (messages.hasOwnProperty(idx)) {
			if (messages[idx].code.charAt(0) === '4' || messages[idx].code.charAt(0) === '5') {
				if ( ! self.error && ! self.ended) {
					self.cleanup();
					
					var err = new Error(util.format('FTP error %d', messages[idx].code));
					err.code = Number(messages[idx].code);
					err.url = self.opt.url;
					self.emit('error', err);
					
					return err;
				}
			}
		}
	}
	
	return null;
};

/**
 * Makes sure the FTP client receives the proper connection message
 */
FTP.prototype.connect = function () {
	var self = this;
	
	self.cmdSock = net.createConnection(self.opt.url.port, self.opt.url.hostname);
	self.cmdSock.setEncoding('utf8');
	
	self.cmdSock.setTimeout(self.opt.timeout, function () {
		if ( ! self.error && ! self.ended) {
			self.cleanup();
			
			var err = new Error('command socket timeout');
			err.code = 7;
			err.url = self.opt.url;
			
			self.emit('error', err);
		}
	});
	
	self.cmdSock.on('error', function (err) {
		if ( ! self.error && ! self.ended) {
			self.cleanup();
			err.code = 5;
			err.url = self.opt.url;
			self.emit('error', err);
		}
	});
	
	self.cmdSock.on('close', function () {
		if ( ! self.ended) {
			self.cleanup();
			
			var err = new Error('command socket prematurely closed');
			err.code = 11;
			err.url = self.opt.url;
			
			self.emit('error', err);
		}
	});
	
	self.cmdSock.on('connect', function () {
		debug('connected to the FTP server on ' + self.opt.url.hostname + ':' + self.opt.url.port + '.');
		
		var ok = false;
		var end = false;
		
		var connect = function (data) {
			var messages = parseMessages(data);
			if ( ! (self.errorWatch(messages) instanceof Error)) {
				if (messages[0].code === '220') {
					ok = true;
				}
				
				end = endOfMessages(messages);
				
				if (end === true) {
					self.cmdSock.removeAllListeners('data');
					
					if (ok === false) {
						if ( ! self.error && ! self.ended) {
							self.cleanup();
							
							var err = new Error(util.format('ftp error %s', messages[0].code));
							err.code = Number(messages[0].code);
							err.url = self.opt.url;
							
							self.emit('error', err);
						}
					} else {
						self.auth();
					}
				}
			}
		};
		
		self.cmdSock.on('data', connect);
	});
};

/**
 * FTP auth wrapper
 */
FTP.prototype.auth = function () {
	var self = this;
	
	var loggedIn = false;
	var end = false;
	var pass = false;
	
	var login = function (data) {
		var idx;
		var messages = parseMessages(data);
		
		if ( ! (self.errorWatch(messages) instanceof Error)) {
			for (idx in messages) {
				if (messages.hasOwnProperty(idx)) {
					if (messages[idx].code === '230') {
						// user logged in
						end = true;
						pass = true;
					}
					
					if (messages[idx].code === '331') {
						// send the password
						end = true;
					}
				}
			}
			
			if (end === true) {
				self.cmdSock.removeAllListeners('data');
				
				if (pass === false) {
					self.cmdWrite('PASS ' + self.opt.url.pass, login);
				} else {
					self.type();
				}
			}
		}
	};
	
	self.cmdWrite('USER ' + self.opt.url.user, login);
};

/**
 * TYPE command wrapper
 */
FTP.prototype.type = function () {
	var self = this;
	var end = false;
	
	var type = function (data) {
		var idx;
		var messages = parseMessages(data);
		
		if ( ! (self.errorWatch(messages) instanceof Error)) {
			for (idx in messages) {
				if (messages.hasOwnProperty(idx)) {
					if (messages[idx].code === '200') {
						end = true;
					}
				}
			}
			
			if (end === true) {
				self.cmdSock.removeAllListeners('data');
				self.size();
			}
		}
	};
	
	self.cmdWrite('TYPE I' , type);
};

/**
 * SIZE command wrapper
 */
FTP.prototype.size = function () {
	var self = this;
	
	var code, message;
	var end = false;
	
	var size = function (data) {
		var messages = parseMessages(data);
		
		code = messages[0].code;
		message = messages[0].message;
		
		end = endOfMessages(messages);
		
		if (end === true) {
			self.cmdSock.removeAllListeners('data');
			switch (code) {
				case '213': // ok
					self.emit('size', message.trim());
				break;
				
				case '500': // SIZE extension of RFC 3659 not implemented
					self.emit('size', -1);
				break;
				
				default: // FTP error
					if ( ! self.error && ! self.ended) {
						self.cleanup();
						var err = new Error(util.format('ftp error %s', code));
						err.code = Number(code);
						err.url = self.opt.url;
						
						self.emit('error', err);
					}
				break;
			}
		}
	};
	
	self.cmdWrite('SIZE ' + self.opt.url.pathftp, size);
};

/**
 * Downloads a file from remote location
 */
FTP.prototype.download = function () {
	var self = this;
	var end = false;
	
	var pasv = function (data) {
		var messages = parseMessages(data);
		if ( ! (self.errorWatch(messages) instanceof Error)) {
			if (messages[0].code === '227') {
				var address = messages[0].message.match(/\(([\w\W]*)\)/);
				address = address[1];
				address = address.split(',');
				
				var host = address[0] + '.' + address[1] + '.' + address[2] + '.' + address[3];
				var port = (address[4] * 256) + absInt(address[5]);
				
				self.dataSock = net.createConnection(port, host);
				self.dataSock.setTimeout(self.opt.timeout, function () {
					if ( ! self.error && ! self.ended) {
						self.cleanup();
						var err = new Error('data socket timeout');
						err.code = 4;
						err.url = self.opt.url;
						self.emit('error', err);
					}
				});
				
				self.dataSock.on('error', function (err) {
					if ( ! self.error && ! self.ended) {
						self.cleanup();
						err.code = 3;
						err.url = self.opt.url;
						self.emit('error', err);
					}
				});
				
				self.dataSock.once('connect', function () {
					self.dataSock.pause();
					self.retr();
				});
			} else { // did not get the data socket information
				if ( ! self.error && ! self.ended) {
					self.cleanup();
					var error = new Error('could not get the data socket information');
					error.code = 9;
					error.url = self.opt.url;
					self.emit('error', error);
				}
			}
		}
		
		end = endOfMessages(messages);
		if (end === true) {
			self.cmdSock.removeAllListeners('data');
		}
	};
	
	self.cmdWrite('PASV', pasv);
};

/**
 * RETR command wrapper
 */
FTP.prototype.retr = function () {
	var self = this;
	var end = false;
	
	var retr = function (data) {
		var idx;
		var messages = parseMessages(data);
		
		if ( ! (self.errorWatch(messages) instanceof Error)) {
			for (idx in messages) {
				if (messages.hasOwnProperty(idx)) {
					if (messages[idx].code === '150' || messages[idx].code === '125') {
						end = true;
					}
				}
			}
			
			if (end === true) {
				self.emit('stream', self.dataSock);
				self.cmdSock.setTimeout(0);
				self.cmdSock.removeAllListeners('data');
			}
		}
	};
	
	self.cmdWrite('RETR ' + self.opt.url.pathftp, retr);
};

/**
 * Writes commands to the command socket
 *
 * @param {String} cmd
 * @param {Function} cb
 */
FTP.prototype.cmdWrite = function (cmd, cb) {
	var self = this;
	
	if (self.cmdSock.writable) {
		debug('socket.write: ' + cmd);
		self.cmdSock.write(cmd + CRLF, 'utf8', function () {
			self.cmdSock.on('data', function (data) {
				cb(data);
			});
		});
	}
};

/**
 * Cleaning up the client junk on error
 */
FTP.prototype.cleanup = function () {
	this.error = true;
	this.ended = true;
	
	if (this.cmdSock) {
		this.cmdSock.destroy();
	}
	
	if (this.dataSock) {
		this.dataSock.destroy();
	}
	
	if (this.writeStream) {
		this.writeStream.destroy();
	}
	
	if (this.file) {
		fs.unlink(this.file);
	}
};

/**
 * Clean close of all the client resources
 */
FTP.prototype.close = function () {
	this.ended = true;
	this.cmdSock.end();
};

/**
 * ftp.head method similar to HTTP's HEAD
 * Based on the SIZE command, therefore it fails for
 * older servers that don't implement RFC 
 *
 * @param {Object} opt
 * @param {Function} cb
 */
exports.head = function (opt, cb) {
	var client = new FTP(opt);
	
	client.on('error', function (err) {
		cb(err);
	});
	
	client.on('size', function (size) {
		if (size === -1) {
			var err = new Error('SIZE command not implemented');
			err.code = 8;
			err.url = client.opt.url;
			cb(err);
		} else {
			cb(null, Number(size));
		}
		
		client.close();
	});
	
	client.connect();
};

/**
 * ftp.get method for downloading a remote file
 *
 * @param {Object} opt
 * @param {String} file
 * @param {Function} cb
 */
exports.get = function (opt, file, cb) {
	if (typeof file === 'function') {
		cb = file;
		file = null;
	} else {
		file = String(file);
		file = file.trim();
		file = p.resolve(file);
	}
	
	var client = new FTP(opt);
	var fileSize = -1;
	var error = false;
	
	client.on('error', function (err) {
		if ( ! error) {
			error = true;
			cb(err);
		}
	});
	
	client.on('size', function (size) {
		debug('got the size event');
		fileSize = Number(size);
		client.download();
	});
	
	client.on('stream', function (stream) {
		debug('got the stream event');
		stream.resume();
		
		if (file === null) { // buffer the data
			var buf = [];
			
			stream.on('error', function (err) {
				if ( ! error) {
					error = true;
					client.cleanup();
					
					err.code = 3; // data socket error
					err.url = client.opt.url;
					
					cb(err);
				}
			});
			
			stream.on('data', function (data) {
				if ( ! error) {
					buf = buf.concat(data.toByteArray());
				}
			});
			
			stream.on('close', function () {
				if ( ! error) {
					var buffer = new Buffer(buf);
					if (fileSize !== -1 && fileSize !== buffer.length) {
						error = true;
						client.cleanup();
						
						var err = new Error(util.format('wrong file size, expected %d, got %d', fileSize, buffer.length));
						err.code = 10;
						err.url = client.opt.url;
						
						cb(err);
					} else {
						if (client.opt.bufferType === 'string') {
							buffer = buffer.toString();
							console.error('The string bufferType is deprecated. Use the buffer bufferType');
						}
						cb(null, buffer);
						client.close();
					}
				}
			});
		} else { // save the data to disk
			var writeStream = fs.createWriteStream(file);
			var transfer = new EventEmitter();
			
			writeStream.on('error', function (err) {
				if ( ! error) {
					error = true;
					client.cleanup();
					
					error = true;
					err.code = 1;
					err.url = client.opt.url;
					
					cb(err);
				}
			});
			
			transfer.on('end', function () {
				transfer.removeAllListeners('end');
				writeStream.on('open', function (fd) {
					fs.fsync(fd, function () {
						writeStream.end();
					});
				});
			});
			
			writeStream.on('open', function (fd) {
				transfer.on('end', function () {
					transfer.removeAllListeners('end');
					fs.fsync(fd, function () {
						writeStream.end();
					});
				});
			});
			
			stream.on('close', function () {
				if ( ! error) {
					client.close();
					transfer.emit('end');
				}
			});
			
			writeStream.on('close', function () {
				if ( ! error) {
					fs.stat(file, function (err, stats) {
						var err2;
						if ( ! error) {
							if (err) {
								error = true;
								client.cleanup();
								
								err2 = new Error('the file does not exist at the end of the transfer');
								err2.code = 12;
								err2.url = client.opt.url;
								cb(err2);
							} else {
								if (fileSize !== -1 && fileSize !== stats.size) {
									error = true;
									client.cleanup();
									
									err2 = new Error(util.format('wrong file size, expected %d, got %d', fileSize, stats.size));
									err2.code = 10;
									err2.url = client.opt.url;
									
									cb(err2);
								} else {
									cb(null, file);
								}
							}
						}
					});
				}
			});
			
			stream.on('data', function (data) {
				try {
					writeStream.write(data);
				} catch (e) {} // handled by the error listener, sad that async methods throw
			});
		}
	});
	
	client.connect();
};
