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
var config = require('config');
var fs = require('fs');
var path = require('path');
var libssh = require('ssh');

var server;
var options = {
    host: utils.getLocalIP(),
    port: '3022',
    host_key: config.get('logshipper.sftp.host_key'),
    root: path.join(__dirname, config.get('logshipper.sftp.root')),
    test_username: 'correct_username',
    test_password: 'correct_password'
};

server = libssh.createServer({
    hostRsaKeyFile: __dirname + '/ssh_keys/' + 'rsa_' + options.host_key,
    hostDsaKeyFile: __dirname + '/ssh_keys/' + 'dsa_' + options.host_key
});

server.on('connection', function (session) {
    session.on('auth', function (message) {
        // Maybe check username/password
        return message.replyAuthSuccess();
    });
    
    session.on('channel', function (channel) {
        channel.on('subsystem', function (message) {
            if (message.subsystem == 'sftp') {
                message.replySuccess();
                message.sftpAccept();
            }
        });
        
        channel.on('sftp:realpath', function (message) {
            console.log('server cmd sftp:realpath');
            if (message.filename == '.' || (/\/$/).test(message.filename)) {
                message.replyName(path.join(options.root, message.filename), {
                    permissions: +libssh.Stat('777').dir() // see below for info about Stat
                })
            } else {
                message.replyName(message.filename, {
                    permissions: +libssh.Stat('777').reg()
                })
            }
        });

        channel.on('sftp:stat', statHandle);

        function statHandle(message) {
            console.log('server cmd sftp:stat');

            var attrs = {
                permissions: +libssh.Stat(777).dir()
                , uid: 101
                , gid: 202
                , size: 100
                , atime: Date.now()
                , mtime: Date.now()
            };

            message.replyAttr(attrs)
        }

        // can be handled the same way as 'stat' if you like
        channel.on('sftp:lstat', statHandle);

        channel.on('sftp:opendir', function (message) {
            console.log('server cmd sftp:opendir');
            message.replyHandle(message.filename + '/');
        });

        var lastmsg;
        channel.on('sftpmessage', function (message) {
            lastmsg = message
        });

        channel.on('sftp:readdir', function (message) {
            console.log('server cmd sftp:readdir', message.handle);

            if (lastmsg.type == 'readdir') {
                return message.replyStatus('ok');
            }

            var readPath = message.handle;
            fs.readdir(readPath, function(err, files) {
                if (err) {
                    console.log(err);
                    throw err;

                } else {
                    files = files.map(function(file) {
                        return {
                            filename: file,
                            longname: file,
                            attrs: { permissions: +libssh.Stat(644).reg() }
                        };
                    });
                    return message.replyNames(files);
                }
            });
        });

        var openHandles = {};

        channel.on('sftp:open', function (message) {
            console.log('server cmd sftp:open');
            // client wants to open `message.filename`, you must return a 'handle'
            // that represents that file, it can just be the filename
            // we're just going to give them the same file no matter what they
            // request
            openHandles['@' + message.filename] = fs.openSync('fileforyou.txt', 'r');
            message.replyHandle('@' + message.filename)
        });

        channel.on('sftp:read', function (message) {
            console.log('server cmd sftp:read');
            // client wants to read a chunk of the given handle that represents
            // an open file
            // sadly there is no easy streaming here, that's left up to you to
            // implement

            var buf = new Buffer(message.length); // message.length the reqeusted amount
            var length = fs.readSync(
                openHandles[message.handle]
                , buf
                , 0
                , message.length
                , message.offset // the requested start offset for a read
            );

            if (!length) // no more data left to read, send an EOF
                message.replyStatus('eof');
            else // `message.replyData()` needs a buffer and the length to send
                message.replyData(buf, length)
        });

        channel.on('sftp:close', function (message) {
            console.log('server cmd sftp:close');
            // client wants to close `message.handle`, tell it that it's done
            if (openHandles[message.handle]) {
                fs.closeSync(openHandles[message.handle]);
                openHandles[message.handle] = undefined
            }
            message.replyStatus('ok')
        })
    })
});

server.listen(options.port, options.host);
console.log('Listening on port ' + options.port);