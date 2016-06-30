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

var config = require('config');
var fs = require('fs');
var path = require('path');
var SFTP = require('sftp-ws');


var server;
var options = {
    host: '127.0.0.1',
    port: '3022',
    host_key: config.get('logshipper.sftp.host_key'),
    root: path.join(__dirname, config.get('logshipper.sftp.root')),
    test_username: 'correct_username',
    test_password: 'correct_password'
};


server = new SFTP.Server({
    host: options.host,
    port: options.port,
    virtualRoot: options.root,
    readOnly: false,
    log: console
});