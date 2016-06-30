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

var childProcess = require('child_process');
var should = require('should-http');
var request = require('supertest');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var path = require('path');
var config = require('config');
var API = require('./../../common/api');
var LogShippingJobsDP = require('./../../common/providers/data/logShippingJobs');

var FtpClient = require('./../../common/ftpClient');

describe('Functional check', function () {

    // Changing default mocha's timeout (Default is 2 seconds).
    this.timeout(config.get('api.request.maxTimeout'));

    var revAdmin = config.get('api.users.revAdmin');
    var reseller = config.get('api.users.reseller');

    var account;
    var firstLsJ;
    var firstDc;
    var ftpClient;
    var ftpServerProcess;
    var jobMinutes = 1;

    var testSourceId = '5655668638f201be519f9d87'; // temporary

    before(function (done) {
        API.helpers
            .authenticateUser(revAdmin)
            .then(function () {
                return API.helpers.accounts.createOne();
            })
            .then(function (newAccount) {
                account = newAccount;
            })
            .then(function() {
                return API.helpers.domainConfigs.createOne(account.id, 'LS-TEST');
            })
            .then(function (domainConfig) {
                firstDc = domainConfig;
            })
            .then(function () {
                return API.helpers.logShippingJobs.createOne(account.id);
            })
            .then(function (logShippingJob) {
                firstLsJ = logShippingJob;
            })
            .then(function () {
                var firstLsJConfig = LogShippingJobsDP.generateUpdateData(
                    account.id,
                    'ftp',
                    'domain',
                    testSourceId,
                    'active'
                );
                return API.resources.logShippingJobs
                    .update(firstLsJ.id, firstLsJConfig)
                    .expect(200)
                    .then(function() {
                        firstLsJConfig.id = firstLsJ.id;
                        firstLsJ = firstLsJConfig;
                        done();
                    })
                    .catch(done);
            })
            .catch(done);
    });

    after(function (done) {
        API.helpers
            .authenticateUser(revAdmin)
            .then(function () {
                return API.resources.domainConfigs.deleteOne(firstDc.id);
            })
            .then(function () {
                return API.resources.logShippingJobs.deleteOne(firstLsJ.id);
            })
            .then(function() {
                return API.resources.accounts.deleteAllPrerequisites(done);
            })
            .catch(done);
    });

    describe('Destination FTP server, Source type Domain', function () {

        beforeEach(function (done) {
            done();
        });

        afterEach(function (done) {
            done();
        });

        it('should start local ftp server', function (done) {
            ftpServerProcess = childProcess.fork(
                    path.join(
                        __dirname,
                        '../../common',
                        config.get('logshipper.ftp.script')
                    ));
            done();
        });

        it('should ping and get response from ftp server', function (done) {
            setTimeout(function() {
                ftpClient = new FtpClient();
                ftpClient.connect(
                    firstLsJ.destination_host,
                    firstLsJ.destination_port,
                    firstLsJ.username,
                    firstLsJ.password,
                    function(err) {
                        if (!err) {
                            done();
                        } else {
                            throw new Error('Could not connect to local ftp server');
                        }
                    });
            }, 20000);
        });

        it('should get list from ftp server', function (done) {
            ftpClient.list('/', function(err, files) {
                files.length.should.be.above(0);
                done();
            });
        });

        it('should download test file from ftp server', function (done) {
            ftpClient.download(
                config.get('logshipper.ftp.test_file'),
                '/',
                path.join(
                    __dirname,
                    '../../common',
                    config.get('logshipper.ftp.download')
                ),
                function() {
                    setTimeout(function() {
                        fs.exists(
                            path.join(
                                __dirname,
                                '../../common',
                                config.get('logshipper.ftp.download'),
                                config.get('logshipper.ftp.test_file')
                            ),
                            function(exists) {
                                if (exists) {
                                    fs.unlink(
                                        path.join(
                                            __dirname,
                                            '../../common',
                                            config.get('logshipper.ftp.download'),
                                            config.get('logshipper.ftp.test_file')
                                        ),
                                        function() {
                                            done();
                                        }
                                    );
                                } else {
                                    throw new Error('Test file is not found');
                                }
                            });
                        }, 5000);
                    });
        });

        it('should complete logshipping job and send logs to local ftp server in ' + jobMinutes +
            ' minutes', function (done) {
            setTimeout(function() {
                ftpClient.list('/', function(err, files) {
                    console.log(files);
                    files.length.should.be.above(1);
                    var filesToUnlink = [];
                   
                    files.forEach(function(file) {
                        if (file.name !== config.get('logshipper.ftp.test_file')) {
                            filesToUnlink.push(
                                fs.unlink(
                                    path.join(
                                        __dirname,
                                        '../../common',
                                        config.get('logshipper.ftp.root'),
                                        file.name
                                    ),
                                    function () {
                                        console.log('Removed ' + file.name + ' from local ftp');
                                    }
                                )
                            );
                        }
                    });
                                       
                    Promise.all(filesToUnlink)
                        .then(function() {
                            done();
                        })
                        .catch(function() {
                            throw new Error('One of files could not be removed');
                        });
                });
            }, jobMinutes * 60 * 1000);
        });

        it('should stop local ftp server', function (done) {
            ftpServerProcess.kill('SIGKILL');
            done();
        });
    });
});
