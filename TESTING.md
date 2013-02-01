## Requrements

 * a FTP server accesible through the loopback interface
 * annonymous authentication
 * tests/data/foo.txt into the document root of the FTP server for the annonymous access

The FTP client was implemented against the pure-ftpd server. Tested against a lot of real world FTP implementations by using wget as comparision and sha1sum for hash check of the actual download.
