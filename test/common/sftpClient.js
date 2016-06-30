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

var Client = require('ftps');
var fs = require('fs');
var Promise = require('bluebird');
var path = require('path');

var SFtpClient = function() {
    this.client = false;
};

SFtpClient.prototype.connect = function(host, port, username, password, callback) {
    var self = this;

    try {
        self.client = new Client({
            host: host,
            username: username,
            password: password,
            port: port,
            protocol: 'sftp',
            timeout: 5
        });
        callback(null);
    } catch(error) {
        callback(error);
    }
};

SFtpClient.prototype.list = function(host, port, username, password, filesPath, callback) {
    var self = this;
    self.connect(
        host,
        port,
        username,
        password,
        function(err) {
            if (!err) {
                self.client
                    .cd(filesPath)
                    .ls()
                    .exec(function (err, res) {
                        callback(err, res);
                    });
            } else {
                callback(new Error('Connection error'), null);
            }
        });
};

SFtpClient.prototype.download = function(filename, filePath, dest, callback) {
    var self = this;
    if (self.client) {
        self.client
            .get(path.join(filePath, filename), path.join(dest, filename))
            .exec(function(err, res) {
                callback(err, res);
            });
    }
};

SFtpClient.prototype.close = function(callback) {
    var self = this;
    if (self.client) {
        self.client = false;
        if (callback !== undefined) {
            callback();
        }
    }
};

module.exports = SFtpClient;