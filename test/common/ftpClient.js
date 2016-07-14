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

var Client = require('ftp');
var fs = require('fs');
var path = require('path');

var FtpClient = function () {
  this.client = new Client();
};

FtpClient.prototype.connect = function (host, port, username, password, callback) {
  var self = this;

  if (!self.client.connected) {
    self.client.on('ready', function () {
      if (callback !== undefined) {
        callback(null);
      }
    });

    self.client.on('error', function (error) {

      if (callback !== undefined) {
        callback(error);
      }
    });

    self.client.connect({
      host: host,
      port: port,
      username: username,
      password: password,
      connTimeout: 360,
      pasvTimeout: 360,
      keepalive: 360
    });
    return true;
  } else {
    return false;
  }
};

FtpClient.prototype.list = function (filesPath, callback) {
  var self = this;
  if (self.client.connected) {
    self.client.list(filesPath, false, callback);
  }
};

FtpClient.prototype.download = function (filename, filePath, dest, callback) {
  var self = this;
  if (self.client.connected) {
    self.client.get(path.join(filePath, filename), function (err, stream) {
      if (err) {
        throw err;
      }
      stream.pipe(fs.createWriteStream(path.join(dest, filename)));
      if (callback !== undefined) {
        callback();
      }
    });
  }
};

FtpClient.prototype.close = function (callback) {
  var self = this;
  if (self.client.connected) {
    self.client.end();
    if (callback !== undefined) {
      callback();
    }
  }
};

module.exports = FtpClient;