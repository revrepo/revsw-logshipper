/*************************************************************************
 *
 * REV SOFTWARE CONFIDENTIAL
 *
 * [2013] - [2017] Rev Software, Inc.
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

var Client = require('ftps');
var _ =require('lodash');
var fs = require('fs');
var Promise = require('bluebird');
var path = require('path');

var SFtpClient = function () {
  this.client = false;
};

SFtpClient.prototype.connect = function (options, callback) {
  var self = this;

  try {
    options = _.merge({},{
      // host: host,
      // username: username,
      // password: password,
      // port: port,
      protocol: 'sftp',
      timeout: 40,
      retries: 3,
      autoConfirm: true, // set sftp:auto-confirm yes
    }, options);  
    self.client = new Client(options);
    // NOTE: check access to ftp server
    self.client.ls().exec(function(err,data){
      if(err || data.error){
        self.client = false;
        throw new Error('Connection error');
      }
      callback(null);
    });
  } catch (error) {
    callback(error);
  }
};

SFtpClient.prototype.list = function (filesPath, callback) {
  var self = this;
  if (self.client) {
    self.client
      .cd(filesPath)
      .raw('dir')
      .exec(function (err, res) {
        if (!err) {
          var files = res.data.split('\n')
            .filter(function (file) {
              return !!(file.indexOf('.gz') !== -1 || file.indexOf('test-file') !== -1);
            })
            .map(function (filename) {
              var filenameSplit = filename.split(' ');
              return filenameSplit[filenameSplit.length - 1];
            });
        }
        callback(err || res.error, files);
      });
  } else {
    callback(new Error('sftp client is not connected to any server'), null);
  }
};

SFtpClient.prototype.delete = function (filename, callback) {
  var self = this;
  if (self.client) {
    self.client
      .raw('rm ' + filename)
      .exec(function (err, res) {
        callback(err || res.error, res);
      });
  } else {
    callback(new Error('sftp client is not connected to any server'), null);
  }
};

SFtpClient.prototype.download = function (filename, filePath, dest, callback) {
  var self = this;
  if (self.client) {
    self.client
      .get(path.join(filePath, filename), path.join(dest, filename))
      .exec(function (err, res) {
        callback(err || res.error, res);
      });
  } else {
    callback(new Error('sftp client is not connected to any server'), null);
  }
};

SFtpClient.prototype.close = function (callback) {
  var self = this;
  if (self.client) {
    self.client = false;
    if (callback !== undefined) {
      callback();
    }
  }
};

module.exports = SFtpClient;