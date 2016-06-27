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
var path = require('path');
var config = require('config');
var API = require('./../../common/api');
var LogShippingJobsDP = require('./../../common/providers/data/logShippingJobs');

var SFtpClient = require('./../../common/sftpClient');

describe('Negative check', function () {

    // Changing default mocha's timeout (Default is 2 seconds).
    this.timeout(config.get('api.request.maxTimeout'));

    var revAdmin = config.get('api.users.revAdmin');
    var reseller = config.get('api.users.reseller');

    var account;
    var firstLsJ;
    var firstDc;
    var sftpClient;
    var jobMinutes = 3;

    var testSourceType = 'domain',
        testSourceId = '5655668638f201be519f9d87',
        testDestinationType = 'sftp',
        testDestinationHost = '127.0.0.1',
        testDestinationPort = config.get('logshipper.sftp.port'),
        testDestinationUsername = 'correct_username',
        testDestinationPassword = 'correct_password',
        testDestinationKey = '',
        testNotificationEmail = '',
        testComment = 'this is test logshipping job for negative LS test';

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

    describe('Destination SFTP server, Source type Domain', function () {

        beforeEach(function (done) {
            done();
        });

        afterEach(function (done) {
            done();
        });
        
        it('should fail to get response from sftp server', function (done) {
            sftpClient = new SFtpClient();
            sftpClient.connect(
                config.get('logshipper.ftp.host'),
                config.get('logshipper.ftp.port'),
                testDestinationUsername,
                testDestinationPassword,
                function(err) {
                    if (err) {
                        done();
                    } else {
                        throw new Error('Connected to local sftp server somehow');
                    }
                });
        });
        

        it('should pause failed logshipping job for offline sftp server in ' + jobMinutes + 
            ' minutes', function (done) {
            setTimeout(function() {
                API.helpers
                    .authenticateUser(revAdmin)
                    .then(function() {
                        API.resources.logShippingJobs
                            .getOne(firstLsJ.id)
                            .expect(200)
                            .then(function(res) {
                                var responseJson = res.body;
                                responseJson.operational_mode.should.be.equal('pause');
                                done();
                            })
                            .catch(function(error) {
                                throw error;
                            });
                    })
                    .catch(function(error) {
                        throw error;
                    });
            }, jobMinutes * 60 * 1000);
        });
    });
});
