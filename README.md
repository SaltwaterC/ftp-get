## About

Simple FTP client for node.js. Useful for downloading files from a remote location, therefore it implements just a small subset of the FTP protocol. All the data connections use the passive mode. Although the error reporting was implemented with care, it wasn't properly used with production data. Consider it a development preview. The production data smoke test will follow soon.

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
```

Basically you need to pass the callback as the second argument of the get function instead of passing the file path. However, although the FTP client uses by default the binary mode for transfering a file, the buffered response is intended to be used only with textual data.

## Misc

 * You may use the client in development mode in order to see the debug messages. Just define the NODE_ENV environment variable with the value 'development'.
 * If there's a FTP error, then the returned error argument also contains the [FTP status code](http://www.theegglestongroup.com/writing/ftp_error_codes.php) of the failed request (error.code). All 4xx and 5xx codes are considered to be errors. The client does not retry even though 4xx may be considered temporary errors.
