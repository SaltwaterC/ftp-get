## About ![still maintained](http://stillmaintained.com/SaltwaterC/ftp-get.png)

Simple FTP client for node.js. Useful for downloading files from a remote location, therefore it implements just a small subset of the FTP protocol. Includes a method, modeled after HTTP's HEAD in order to check the existence of a remote resource without downloading its contents. All the data connections use the passive mode. The error reporting was implemented with care. Although it it used in production, it may still fail with exotic FTP servers that do things in their own weird way.

## Installation

Either manually clone this repository into your node_modules directory, or the recommended method:

> npm install ftp-get

## Usage mode

```javascript
var ftp = require('ftp-get');

ftp.get('ftp://localhost/foo.pdf', '/path/to/foo.pdf', function (error, result) {
	if (error) {
		console.error(error);
	} else {
		console.log('File downloaded at: ' + result);
	}
});
```

If you need to use authentication, pass the user:pass information to the FTP URL itself. Otherwise, it tries anonymous authentication. The target file path may be relative. [path.resolve()](http://nodejs.org/docs/latest/api/path.html#path.resolve) is used to obtain the absolute path. The absolute path is also returned into the result argument if there aren't any errors.

You may buffer the file without saving it to the disk. Useful if you download something that need to be processed without the need for saving the file:

```javascript
ftp.get('ftp://localhost/foo.xml', function (error, result) {
	if (error) {
		console.error(error);
	} else {
		console.log('The XML document contents: ' + result);
	}
});
```

Basically you need to pass the callback as the second argument of the get function instead of passing the file path. The buffered response mode is intended to be used only with textual data.

In order to check the existence of a remote resource without the need for actually download the file, there's the ftp.head() method:

```javascript
var ftp = require('ftp-get');
ftp.head('ftp://localhost/foo/bar.txt', function (error, size) {
	if (error) {
		console.error(error);
	} else {
		console.log('The remote file size is: ' + size); // the file size if everything is OK
	}
});
```

## Misc

 * You may use the client in development mode in order to see the debug messages. Just define the NODE_ENV environment variable with the value 'development'.
 * If there's a FTP error, then the returned error argument also contains the [FTP status code](http://www.theegglestongroup.com/writing/ftp_error_codes.php) of the failed request (error.code). All 4xx and 5xx codes are considered to be errors. The client does not retry even though 4xx may be considered temporary errors.
 
## Error Codes

Each failure has an attached error code. The write stream, if the file is saved to the disk, returns the file path into the error.file property. The rest of the failures, return the URL of the request, as error.url. Note that the error.url property contains the parsed URL information.

The codes are:

 * 1 - write stream failure
 * 2 - data socket information timeout
 * 3 - data socket error
 * 4 - data socket timeout
 * 5 - command socket failure
 * 6 - missing write stream at the end of the transfer
