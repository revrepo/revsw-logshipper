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

var Client = require('aws-sdk');
var Promise = require('bluebird');

var S3Client = function () {
  this.client = false;
};

S3Client.prototype.connect = function (host, username, password, callback) {
  var self = this;

  if (!self.client) {
    try {
      console.log('s3 credentials', username, password);
      Client.config.update({
        accessKeyId: username,
        secretAccessKey: password
      });
      self.client = new Client.S3({params: {Bucket: host}});

      callback(null);
    } catch (error) {
      callback(error);
    }
  } else {
    callback(new Error('Client is already connected'), null);
  }
};

S3Client.prototype.list = function (bucket, callback) {
  var self = this;
  if (self.client) {
    var params = {
      Bucket: bucket
    };

    self.client.listObjects(params, function (err, data) {
      if (err) {
        callback(err, null);
      } else {
        callback(null, data.Contents);
      }
    });
  } else {
    callback(new Error('S3 is not connected'), null);
  }
};

S3Client.prototype.download = function (filename, bucket, dest, callback) {
  // Deprecated
  // var self = this;
  // if (self.client) {
  //     var params = {
  //         Bucket: bucket,
  //         IfMatch: filename
  //     };
  //     s3.getObject(params, function(err, data) {
  //         if (err) console.log(err, err.stack); // an error occurred
  //         else     console.log(data);           // successful response
  //     });
  // } else {
  //     callback(new Error('S3 is not connected'), null);
  // }
};

S3Client.prototype.deleteMany = function (bucket, files, callback) {
  var self = this;

  if (self.client) {
    var params = {
      Bucket: bucket,
      Delete: {
        Objects: files.map(function (file) {
          //return {Key: 'https://s3.amazonaws.com/' + bucket + '/' + key};
          return {
            Key: file.Key
          };
        }),
        Quiet: false
      },
      RequestPayer: 'logshipper'
    };
    self.client.deleteObjects(params, function (err, data) {
      if (err) {
        callback(err, null);
      } else {
        callback(null, data);
      }
    });
  } else {
    callback(new Error('S3 is not connected'), null);
  }
};

S3Client.prototype.close = function (callback) {
  var self = this;
  if (self.client) {
    self.client = false;
    callback();
  } else {
    callback(new Error('S3 is not connected'), null);
  }
};

module.exports = S3Client;