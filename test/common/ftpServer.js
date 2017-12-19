/*************************************************************************
 *
 * REV SOFTWARE CONFIDENTIAL
 *
 * [2013] - [2016] Rev Software, Inc.
 * All Rights Reserved.
 *
 * NOTICE:  All information contained herein is, and remains
 * the property of Rev Software, Inc. and its suppliers,
 * if any.  The intellectual and technical concepts contained
 * herein are proprietary to Rev Software, Inc.
 * and its suppliers and may be covered by U.S. and Foreign Patents,
 * patents in process, and are protected by trade secret or copyright law.
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Rev Software, Inc.
 */

var utils = require('./utils');
var ftpd = require('ftpd');
var config = require('config');
var path = require('path');

var server;
var options = {
  host: utils.getLocalIP(),
  port: config.get('logshipper.ftp.localhost.port'),
  tls: null
};

console.log(options);

server = new ftpd.FtpServer(options.host, {
  getInitialCwd: function () { // TODO: delete - not used
    return '/';
  },
  getRoot: function () {
    console.log(path.join(__dirname, config.get('logshipper.ftp.localhost.root')));
    return path.join(__dirname, config.get('logshipper.ftp.localhost.root'));
  },
  pasvPortRangeStart: 1025,
  pasvPortRangeEnd: 1050,
  tlsOptions: options.tls,
  allowUnauthorizedTls: true,
  useWriteFile: false,
  useReadFile: false,
  uploadMaxSlurpSize: 7000
});

server.on('error', function (error) {
  console.log('FTP Server error:', error);
});

server.on('client:connected', function (connection) {
  var username = null;
  console.log('client connected: ' + connection.remoteAddress);
  connection.on('command:user', function (user, success, failure) {
    if (user) {
      username = user;
      success('ok');
    } else {
      failure();
    }
  });

  connection.on('command:pass', function (pass, success, failure) {
    if (pass) {
      success(username);
    } else {
      failure();
    }
  });
});

server.debugging = 1;
server.listen(options.port);
console.log('Listening on port ' + options.port);