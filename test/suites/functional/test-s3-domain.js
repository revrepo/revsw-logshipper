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

var should = require('should-http');
var request = require('supertest');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var path = require('path');
var config = require('config');
var API = require('./../../common/api');
var LogShippingJobsDP = require('./../../common/providers/data/logShippingJobs');

var S3Client = require('./../../common/s3Client');

describe('Functional check', function () {

    // Changing default mocha's timeout (Default is 2 seconds).
    this.timeout(config.get('api.request.maxTimeout'));

    var revAdmin = config.get('api.users.revAdmin');
    var reseller = config.get('api.users.reseller');

    var account;
    var firstLsJ;
    var firstDc;
    var s3Client;
    var jobMinutes = 1;

    var testSourceType = 'domain',
        testSourceId = '5655668638f201be519f9d87',
        testDestinationType = 's3',
        testDestinationHost = config.get('logshipper.s3.test_bucket'),
        testDestinationPort = '',
        testDestinationUsername = 'username',
        testDestinationPassword = config.get('logshipper.s3.test_bucket_secret'),
        testDestinationKey = config.get('logshipper.s3.test_bucket_key'),
        testNotificationEmail = '',
        testComment = 'this is test logshipping job for functional LS test';

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

                firstLsJ = LogShippingJobsDP.generateOne(account.id, 'LS-TEST');
                return API.resources.logShippingJobs
                    .createOne(firstLsJ)
                    .expect(200)
                    .then(function (response) {
                        firstLsJ.id = response.body.object_id;
                        var firstLsJUpdateBody = {
                            account_id: account.id,
                            job_name: 'updated-' + firstLsJ.job_name,
                            source_type: testSourceType,
                            source_id: testSourceId,
                            destination_type: testDestinationType,
                            destination_host: testDestinationHost,
                            destination_port: testDestinationPort,
                            destination_username: testDestinationUsername,
                            destination_password: testDestinationPassword,
                            destination_key: testDestinationKey,
                            notification_email: testNotificationEmail,
                            comment: testComment,
                            operational_mode: 'active'
                        };
                        return API.resources.logShippingJobs
                            .update(firstLsJ.id, firstLsJUpdateBody)
                            .expect(200)
                            .then(function() {
                                done();
                            })
                            .catch(done);
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

    describe('Destination S3, Source type Domain', function () {

        beforeEach(function (done) {
            done();
        });

        afterEach(function (done) {
            done();
        });

        it('should connect to amazon s3', function (done) {
            setTimeout(function() {
                s3Client = new S3Client();
                s3Client.connect(
                    config.get('logshipper.s3.test_bucket'),
                    config.get('logshipper.s3.test_bucket_key'),
                    config.get('logshipper.s3.test_bucket_secret'),
                    function(err) {
                        if (!err) {
                            done();
                        } else {
                            throw new Error('Could not connect to amazon s3');
                        }
                    });
            }, 1000);
        });

        it('should remove all objects from s3 bucket', function (done) {
            s3Client.list(config.get('logshipper.s3.test_bucket'), function (err, files) {
                if (!err) {
                    if (files.length) {
                        s3Client.deleteMany(config.get('logshipper.s3.test_bucket'),
                            files,
                            function (err, data) {
                                if (err) {
                                    throw err;
                                }
                                done();
                            });
                    } else {
                        done();
                    }
                } else {
                    throw err;
                }
            });
        });

        it('should get objects list from s3 bucket', function (done) {
            s3Client.list(config.get('logshipper.s3.test_bucket'),
                function(err, files) {
                    if (!err) {
                        files.length.should.be.equal(0);
                        done();
                    } else {
                        throw err;
                    }
                });
        });

        it('should complete logshipping job and send logs to s3 bucket in ' + jobMinutes +
            ' minutes', function (done) {
            setTimeout(function() {
                s3Client.list(config.get('logshipper.s3.test_bucket'), function(err, files) {
                    if (!err) {
                        files.length.should.be.above(0);

                        s3Client.deleteMany(config.get('logshipper.s3.test_bucket'),
                            files,
                            function (err, data) {
                                if (!err) {
                                    done();
                                } else {
                                    throw err;
                                }
                        });
                    } else {
                        throw err;
                    }
                });
            }, jobMinutes * 60 * 1000);
        });
    });
});
