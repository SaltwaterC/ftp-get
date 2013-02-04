## About [![build status](https://secure.travis-ci.org/SaltwaterC/ftp-get.png?branch=master)](http://travis-ci.org/SaltwaterC/ftp-get) ![still maintained](http://stillmaintained.com/SaltwaterC/ftp-get.png)

Simple FTP client for node.js implemented in pure JavaScript. Useful for downloading files from a remote location, therefore it implements just a small subset of the FTP protocol. Includes a method, modeled after HTTP's HEAD in order to check the existence of a remote resource without downloading its contents. The ftp.head() method uses the FTP SIZE command which a RFC 3659 extension to the protocol, since 2007. However, in practice most FTP servers implement the SIZE extension before the RFC publishing date.

## Installation

Either manually clone this repository into your node_modules directory, or the recommended method:

> npm install ftp-get

## Usage mode

 * The [ftp.get method](https://github.com/SaltwaterC/ftp-get/wiki/ftp.get-method)
 * The [ftp.head method]()

## Bug reporting

Unlike 0.2 and before, the 0.3 version of ftp-get went through extensive testing with real world FTP servers. However, some edge cases may still fail. Therefore, in order to have a proper bug repot I'm kindly asking you to provide the troublesome FTP URL (if possible).

I'd appreciate the output of this script as well:

```bash
NODE_ENV=development node client.js ftp://example.com/ftp/url.foo
```

```javascript
// client.js
var ftp = require('ftp-get')

var url = process.argv[2]

ftp.get(url, 'dl.bin', function (err, res) {
	console.log(err, res)
})
```
