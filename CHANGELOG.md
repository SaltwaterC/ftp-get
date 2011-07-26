## v0.1.6
 * Adds error codes for each failure as well as debug information into the error argument.
 * Made the data listener after connection to wait for all the data events that are received under 500 ms. This is for the servers that don't send their MOTD-like message into a single data event. This is a cleaner approach than using timeouts between socket writes.

## v0.1.5
 * Rewrite most of the library internals.

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
