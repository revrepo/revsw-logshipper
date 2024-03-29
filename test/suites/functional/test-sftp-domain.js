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

var should = require('should-http');
var childProcess = require('child_process');
var request = require('supertest');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var path = require('path');
var zlib = require('zlib');
var config = require('config');
var API = require('./../../common/api');
var LogShippingJobsDP = require('./../../common/providers/data/logShippingJobs');
var utils = require('./../../common/utils');
var DomainHelpers = require('./../../common/helpers/domainConfigs');
var SFtpClient = require('./../../common/sftpClient');
var Constants = require('./../../common/constants');
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
  var jobMinutes = 2;

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
        var times = Constants.DOMAIN_STATUS_POLLING_TIMEOUT;
        var interval = Constants.DOMAIN_STATUS_POLLING_INTERVAL;
        var domainPolling = function () {
          if (times < 0) {
            done(new Error('Domain polling timeout'));
          }
          times -= interval;
          DomainHelpers.checkStatus(firstDc.id).then(function (res) {
            if (res.staging_status === 'Published' && res.global_status === 'Published') {
              return API.helpers.logShippingJobs.createOne(account.id)
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
            } else {
              setTimeout(domainPolling, interval);
            }
          });
        };
        domainPolling();
      });
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
        var options = {
          host: firstLsJ.destination_host,
          port: firstLsJ.destination_port,
          username: firstLsJ.destination_username,
          password: firstLsJ.destination_password,
          protocol: firstLsJ.destination_type
        };
        sftpClient.connect(options, function (err) {
            if (!err) {
              done();
            } else {
              console.log('sftp client connection error: ', err);
              done(new Error('Could not connect to local sftp server'));
            }
          });
      }, 3000);
    });

    it('should get list from sftp server', function (done) {
      sftpClient.list(
        './',
        function (err, files) {
          if (!err) {
            files.length.should.be.above(0);
            done();
          } else {
            done(err);
          }
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
      }, 1 * 1000);
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

    var logFiles = [];

    it('should complete logshipping job and send logs to sftp server in ' + jobMinutes +
      ' minutes', function (done) {
        setTimeout(function () {
          sftpClient.list('./', function (err, files) {
            files.length.should.be.above(1);
            files.forEach(function (file) {
              var fileName = file;
              if (fileName !== config.get('logshipper.sftp.test_file')) { 
                logFiles.push(file);
              }
            });
            done();
          });
        }, jobMinutes * 60 * 1000);
      });

    it('should contain all expected fields in a Log Shipping JSON object', function (done) {
      var filesToUnlink = [];
      if (logFiles.length > 0) {
        logFiles.forEach(function (file) {
          var fileName = file;
          sftpClient.download(
            fileName,
            './',
            path.join(
              __dirname,
              '../../common',
              config.get('logshipper.sftp.download')
            ),
            function () {
              fs.readFile(path.join(
                __dirname,
                '../../common', 
                config.get('logshipper.sftp.download'),
                fileName
              ), function read(err, data) {
                zlib.unzip(data, function (err, buffer) {
                  if (err) {
                    console.log('zlib.unzip:err',err);
                    return;
                  }
                  var logJSONs = buffer.toString();
                  logJSONs = logJSONs.split('\n');
                  logJSONs.forEach(function (js) {
                    if (js !== undefined && js !== '') {
                      var JSONFields = utils
                        .checkJSONFields(JSON.parse(js), Constants.JOB_EXPECTED_FIELDS);
                      if (JSONFields.res) {
                        JSONFields.res.should.be.equal(true);
                      } else {
                        console.log('Unexpected fields: ' + JSONFields.unexpectedFields.toString());
                        console.log('Missing Fields: ' + JSONFields.missingFields.toString());
                      }
                    } 
                    filesToUnlink.push(
                      fs.unlink(
                        path.join(
                          __dirname,
                          '../../common',
                          config.get('logshipper.sftp.download'),
                          fileName
                        ),
                        function () {
                          console.log('Removed ' + fileName + ' from local directory');
                        }
                      )
                    );
                  });
                });
              });
            });
        });
        Promise.all(filesToUnlink)
          .then(function () {
            done();
          })
          .catch(function () {
            throw new Error('One of files could not be removed');
          });
      } else {
        done();
      }
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
      }, 1 * 1000);
    });

    // xit('should stop local sftp server', function (done) {
    //     sftpServerProcess.kill('SIGKILL');
    //     done();
    // });
  });
});
