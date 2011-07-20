## v0.1.4
 * Introduced some crappy timeouts just to please the Microsoft FTP Service when doing socket.write().

## v0.1.3
 * Trims the whitespace at the beginning and at the end of the input URL.
 * Trims the whitespace at the beginning and at the end of the input file path.

## v0.1.2
 * Small optimization: if the second argument is a callback, the path.resolve() call is avoided.
 * Declares the socket variable into the get method.

## v0.1.1
 * Added support for buffering the FTP file instead of saving it to the disk. Useful for things that need to be processed without the need of saving the file to the disk.

## v0.1
 * Initial version, featuring support for fetching FTP files from a remote location into a file onto your local machine.
