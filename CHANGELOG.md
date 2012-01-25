## v0.2.8
 * Fixes the ftp.head() not calling the callback when the underlying socket closes prematurely. Uses the same patch for ftp.get() in order to fail faster than waiting for the data socket to timeout.
 * The close / error events for both ftp.get() and ftp.head() both call the callback with the same set of properties.

## v0.2.7
 * Fixes the ftp.head() for when socket errors are emitted.

## v0.2.6
 * Adds support for ftp.head() method modeled after the idea of HTTP's HEAD.

## v0.2.5
 * Fixes a possible race condition where a single data event for the disk transfer case might not triggger the end callback.

## v0.2.4
 * Fixes a race condition where a single data event from the data socket could be missed.

## v0.2.3
 * Removed the last QUIT command before closing the command channel.

## v0.2.2
 * Makes sure that the success isn't trigered for the saved to the disk transfer if there's an error.

## v0.2.1
 * Adds a [fsync(2)](http://linux.die.net/man/2/fsync) wrapper for the transfers that are saved to disk, improving the library stability.

## v0.2
 * Bugfix: Ignores repeated FTP errors. Calls the callback only once. Implemented a flag that keeps the error callback away, therefore it removes any race condition.
 * Enhancement: Adds error codes for each failure as well as debug information into the error argument.
 * Enhancement: Made the data listener after connection to wait for all the data events that do not end with CRLF. This is a cleaner approact that removes the timeouts for the servers that don't send their welcome junk in a single package.
 * Changes the returned value of the err argument in the success case from undefined to null in order to follow exactly the node.js convention. This may break some code if the evaluation is made against 'undefined'.

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
