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

// var childProcess = require('child_process');
// var should = require('should-http');
// var request = require('supertest');
// var Promise = require('bluebird');
// var fs = Promise.promisifyAll(require('fs'));
// var path = require('path');
// var config = require('config');
// var API = require('./../../common/api');
// var LogShippingJobsDP = require('./../../common/providers/data/logShippingJobs');
//
// var SFtpClient = require('./../../common/sftpClient');
//
// describe('Functional check', function () {
//
//     // Changing default mocha's timeout (Default is 2 seconds).
//     this.timeout(config.get('api.request.maxTimeout'));
//
//     var revAdmin = config.get('api.users.revAdmin');
//     var reseller = config.get('api.users.reseller');
//
//     var account;
//     var firstLsJ;
//     var firstDc;
//     var sftpClient;
//     var sftpServerProcess;
//     var jobMinutes = 1;
//
//     var testSourceType = 'domain',
//         testSourceId = '5655668638f201be519f9d87',
//         testDestinationType = 'sftp',
//         testDestinationHost = config.get('logshipper.sftp.host'),
//         testDestinationPort = config.get('logshipper.sftp.port'),
//         testDestinationUsername = config.get('logshipper.sftp.username'),
//         testDestinationPassword = config.get('logshipper.sftp.password'),
//         testDestinationKey = '',
//         testNotificationEmail = '',
//         testComment = 'this is test logshipping job for functional LS test';
//
//     before(function (done) {
//         API.helpers
//             .authenticateUser(revAdmin)
//             .then(function () {
//                 return API.helpers.accounts.createOne();
//             })
//             .then(function (newAccount) {
//                 account = newAccount;
//             })
//             .then(function() {
//                 return API.helpers.domainConfigs.createOne(account.id, 'LS-TEST');
//             })
//             .then(function (domainConfig) {
//                 firstDc = domainConfig;
//
//                 firstLsJ = LogShippingJobsDP.generateOne(account.id, 'LS-TEST');
//                 return API.resources.logShippingJobs
//                     .createOne(firstLsJ)
//                     .expect(200)
//                     .then(function (response) {
//                         firstLsJ.id = response.body.object_id;
//                         var firstLsJUpdateBody = {
//                             account_id: account.id,
//                             job_name: 'updated-' + firstLsJ.job_name,
//                             source_type: testSourceType,
//                             source_id: testSourceId,
//                             destination_type: testDestinationType,
//                             destination_host: testDestinationHost,
//                             destination_port: testDestinationPort,
//                             destination_username: testDestinationUsername,
//                             destination_password: testDestinationPassword,
//                             destination_key: testDestinationKey,
//                             notification_email: testNotificationEmail,
//                             comment: testComment,
//                             operational_mode: 'active'
//                         };
//                         return API.resources.logShippingJobs
//                             .update(firstLsJ.id, firstLsJUpdateBody)
//                             .expect(200)
//                             .then(function() {
//                                 done();
//                             })
//                             .catch(done);
//                     })
//                     .catch(done);
//             })
//             .catch(done);
//     });
//
//     after(function (done) {
//         API.helpers
//             .authenticateUser(revAdmin)
//             .then(function () {
//                 return API.resources.domainConfigs.deleteOne(firstDc.id);
//             })
//             .then(function () {
//                 return API.resources.logShippingJobs.deleteOne(firstLsJ.id);
//             })
//             .then(function() {
//                 return API.resources.accounts.deleteAllPrerequisites(done);
//             })
//             .catch(done);
//     });
//
//     describe('Destination SFTP server, Source type Domain', function () {
//
//         beforeEach(function (done) {
//             done();
//         });
//
//         afterEach(function (done) {
//             done();
//         });

        // it('should start local sftp server', function (done) {
        //     sftpServerProcess = childProcess.fork(
        //             path.join(
        //                 __dirname,
        //                 '../../common',
        //                 config.get('logshipper.sftp.script')
        //             ));
        //     done();
        // });
        //
        // it('should ping and get response from sftp server', function (done) {
        //     setTimeout(function() {
        //         sftpClient = new SFtpClient();
        //         sftpClient.connect(
        //             config.get('logshipper.sftp.host'),
        //             config.get('logshipper.sftp.port'),
        //             testDestinationUsername,
        //             testDestinationPassword,
        //             function(err) {
        //                 if (!err) {
        //                     done();
        //                 } else {
        //                     throw new Error('Could not connect to local sftp server');
        //                 }
        //             });
        //     }, 3000);
        // });
        //
        // it('should get list from sftp server', function (done) {
        //     sftpClient.list(
        //         config.get('logshipper.sftp.host'),
        //         config.get('logshipper.sftp.port'),
        //         testDestinationUsername,
        //         testDestinationPassword,
        //         '/',
        //         function(err, files) {
        //             if (!err) {
        //                 console.log(err, files);
        //                 files.length.should.be.above(0);
        //                 done();
        //             } else {
        //                 throw err;
        //             }
        //     });
        // });
        //
        // it('should download test file from sftp server', function (done) {
        //     sftpClient.download(
        //         config.get('logshipper.sftp.test_file'),
        //         '/',
        //         path.join(
        //             __dirname,
        //             '../../common',
        //             config.get('logshipper.sftp.download')
        //         ),
        //         function() {
        //             setTimeout(function() {
        //                 fs.exists(
        //                     path.join(
        //                         __dirname,
        //                         '../../common',
        //                         config.get('logshipper.sftp.download'),
        //                         config.get('logshipper.sftp.test_file')
        //                     ),
        //                     function(exists) {
        //                         if (exists) {
        //                             fs.unlink(
        //                                 path.join(
        //                                     __dirname,
        //                                     '../../common',
        //                                     config.get('logshipper.sftp.download'),
        //                                     config.get('logshipper.sftp.test_file')
        //                                 ),
        //                                 function() {
        //                                     done();
        //                                 }
        //                             );
        //                         } else {
        //                             throw new Error('Test file is not found');
        //                         }
        //                     });
        //                 }, 5000);
        //             });
        // });
        //
        // it('should complete logshipping job and send logs to local sftp server in ' + jobMinutes +
        //     ' minutes', function (done) {
        //     setTimeout(function() {
        //         sftpClient.list('/', function(err, files) {
        //             console.log(files);
        //             files.length.should.be.above(1);
        //             var filesToUnlink = [];
        //
        //             files.forEach(function(file) {
        //                 if (file.name !== config.get('logshipper.sftp.test_file')) {
        //                     filesToUnlink.push(
        //                         fs.unlink(
        //                             path.join(
        //                                 __dirname,
        //                                 '../../common',
        //                                 config.get('logshipper.sftp.root'),
        //                                 file.name
        //                             ),
        //                             function () {
        //                                 console.log('Removed ' + file.name + ' from local sftp');
        //                             }
        //                         )
        //                     );
        //                 }
        //             });
        //
        //             Promise.all(filesToUnlink)
        //                 .then(function() {
        //                     done();
        //                 })
        //                 .catch(function() {
        //                     throw new Error('One of files could not be removed');
        //                 });
        //         });
        //     }, jobMinutes * 60 * 1000);
        // });
        //
        // it('should stop local sftp server', function (done) {
        //     sftpServerProcess.kill('SIGKILL');
        //     done();
        // });
//     });
// });
