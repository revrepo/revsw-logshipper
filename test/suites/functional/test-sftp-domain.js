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
var childProcess = require('child_process');
var request = require('supertest');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var path = require('path');
var config = require('config');
var API = require('./../../common/api');
var LogShippingJobsDP = require('./../../common/providers/data/logShippingJobs');
var utils = require('./../../common/utils');

var SFtpClient = require('./../../common/sftpClient');

describe('Functional check', function () {

  // Changing default mocha's timeout (Default is 2 seconds).
  this.timeout(config.get('api.request.maxTimeout'));

  var revAdmin = config.get('api.users.revAdmin');
  var reseller = config.get('api.users.reseller');

  var account;
  var firstLsJ;
  var firstDc;
  var sftpClient;
  // var sftpServerProcess;
  var proxyServers;
  var jobMinutes = 1;

  before(function (done) {
    API.helpers
      .authenticateUser(revAdmin)
      .then(function () {
        return utils.getProxyServers();
      })
      .then(function (servers) {
        proxyServers = servers;
      })
      .then(function () {
        return API.helpers.accounts.createOne();
      })
      .then(function (newAccount) {
        account = newAccount;
      })
      .then(function () {
        return API.helpers.domainConfigs.createOne(account.id);
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
          'sftp',
          'domain',
          firstDc.id,
          'active'
        );
        return API.resources.logShippingJobs
          .update(firstLsJ.id, firstLsJConfig)
          .expect(200)
          .then(function () {
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
      .then(function () {
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

    // xit('should start local sftp server', function (done) {
    //     sftpServerProcess = childProcess.fork(
    //             path.join(
    //                 __dirname,
    //                 '../../common',
    //                 config.get('logshipper.sftp.script')
    //             ));
    //     done();
    // });

    it('should ping and get response from sftp server', function (done) {
      setTimeout(function () {
        sftpClient = new SFtpClient();
        sftpClient.connect(
          firstLsJ.destination_host,
          firstLsJ.destination_port,
          firstLsJ.destination_username,
          firstLsJ.destination_password,
          function (err) {
            if (!err) {
              done();
            } else {
              console.log('sftp client connection error: ', err);
              throw new Error('Could not connect to local sftp server');
            }
          });
      }, 3000);
    });

    it('should get list from sftp server', function (done) {
      sftpClient.list(
        './',
        function (err, files) {
          if (!err) {
            files.length.should.be.equal(1);
            done();
          } else {
            throw err;
          }
        });
    });

    it('should download test file from sftp server', function (done) {
      sftpClient.download(
        config.get('logshipper.sftp.test_file'),
        './',
        path.join(
          __dirname,
          '../../common',
          config.get('logshipper.sftp.download')
        ),
        function () {
          setTimeout(function () {
            fs.exists(
              path.join(
                __dirname,
                '../../common',
                config.get('logshipper.sftp.download'),
                config.get('logshipper.sftp.test_file')
              ),
              function (exists) {
                if (exists) {
                  fs.unlink(
                    path.join(
                      __dirname,
                      '../../common',
                      config.get('logshipper.sftp.download'),
                      config.get('logshipper.sftp.test_file')
                    ),
                    function () {
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

    it('should send requests to recently created domain config to generate logs in 2 minutes', function (done) {
      setTimeout(function () {
        var productionProxyServers = proxyServers
          .filter(function (server) {
            return server.environment === 'prod' && server.status === 'online';
          })
          .map(function (server) {
            return server.server_name.toLowerCase();
          });

        var stagingProxyServers = proxyServers
          .filter(function (server) {
            return server.environment === 'staging' && server.status === 'online';
          })
          .map(function (server) {
            return server.server_name.toLowerCase();
          });
        var proxyRequests = [];
        productionProxyServers.forEach(function (server) {
          proxyRequests.push(
            utils.sendProxyServerRequest(server, firstDc.domain_name)
          );
        });
        stagingProxyServers.forEach(function (server) {
          proxyRequests.push(
            utils.sendProxyServerRequest(server, firstDc.domain_name)
          );
        });
        return Promise.all(proxyRequests)
          .then(function () {
            done();
          })
          .catch(function (error) {
            return Promise.reject(error);
          });
      }, 120 * 1000);
    });

    it('should complete logshipping job and send logs to sftp server in ' + jobMinutes +
      ' minutes', function (done) {
      setTimeout(function () {
        sftpClient.list('./', function (err, files) {
          files.length.should.be.above(1);
          done();
        });
      }, jobMinutes * 60 * 1000);
    });

    it('should stop logshipping job for sftp server', function (done) {
      var firstLsJConfig = LogShippingJobsDP.generateUpdateData(
        account.id,
        'sftp',
        'domain',
        firstDc.id,
        'stop'
      );
      API.resources.logShippingJobs
        .update(firstLsJ.id, firstLsJConfig)
        .expect(200)
        .then(function () {
          done();
        })
        .catch(function (error) {
          throw error;
        });
    });

    it('should clean up sftp server', function (done) {
      setTimeout(function () {
        sftpClient.list('./', function (err, files) {
          var filesToUnlink = [];

          files.forEach(function (file) {
            if (file !== config.get('logshipper.sftp.test_file')) {
              filesToUnlink.push(
                sftpClient.delete(file, function (err, data) {
                  if (err) {
                    throw err;
                  }
                })
              );
            }
          });

          Promise.all(filesToUnlink)
            .then(function () {
              done();
            })
            .catch(function () {
              done();
            });
        });
      }, 5 * 1000);
    });

    // xit('should stop local sftp server', function (done) {
    //     sftpServerProcess.kill('SIGKILL');
    //     done();
    // });
  });
});
