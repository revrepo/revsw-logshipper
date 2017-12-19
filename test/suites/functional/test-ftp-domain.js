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

var childProcess = require('child_process');
var should = require('should-http');
var request = require('supertest');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var path = require('path');
var config = require('config');
var API = require('./../../common/api');
var LogShippingJobsDP = require('./../../common/providers/data/logShippingJobs');
var utils = require('./../../common/utils');
var DomainHelpers = require('./../../common/helpers/domainConfigs');
var ftps = require('ftps');
var FtpClient = require('./../../common/ftpClient');
var Constants = require('./../../common/constants');

describe('Functional check', function() {
  // Changing default mocha's timeout (Default is 2 seconds).
  this.timeout(config.get('api.request.maxTimeout'));

  var revAdmin = config.get('api.users.revAdmin');
  var reseller = config.get('api.users.reseller');
  // TODO: delete old version with local FTP Server
  xdescribe('Destination local FTP server, Source type Domain', function() {
    var account;
    var firstLsJ;
    var firstDc;
    var ftpClient;
    var ftpServerProcess;
    var proxyServers;
    var jobMinutes = 1;

    before(function(done) {
      API.helpers
        .authenticateUser(revAdmin)
        .then(function() {
          return utils.getProxyServers();
        })
        .then(function(servers) {
          proxyServers = servers;
        })
        .then(function() {
          return API.helpers.accounts.createOne();
        })
        .then(function(newAccount) {
          account = newAccount;
        })
        .then(function() {
          return API.helpers.domainConfigs.createOne(account.id);
        })
        .then(function(domainConfig) {
          firstDc = domainConfig;
          var times = Constants.DOMAIN_STATUS_POLLING_TIMEOUT;
          var interval = Constants.DOMAIN_STATUS_POLLING_INTERVAL;
          var domainPolling = function() {
            if (times < 0) {
              done(new Error('Domain polling timeout'));
            }
            times -= interval;
            DomainHelpers.checkStatus(firstDc.id).then(function(res) {
              if (res.staging_status === 'Published' && res.global_status === 'Published') {
                return API.helpers.logShippingJobs.createOne(account.id)
                  .then(function(logShippingJob) {
                    firstLsJ = logShippingJob;
                  })
                  .then(function() {
                    var firstLsJConfig = LogShippingJobsDP.generateUpdateData(
                      account.id,
                      'ftp',
                      'domain',
                      firstDc.id,
                      'active',
                      'ftp-localhost-test', {
                        destination_host: config.get('logshipper.ftp.localhost.host'),
                        destination_port: config.get('logshipper.ftp.localhost.port'),
                        destination_username: config.get('logshipper.ftp.localhost.username'),
                        destination_password: config.get('logshipper.ftp.localhost.password')
                      }
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
              } else {
                setTimeout(domainPolling, interval);
              }
            });
          };
          domainPolling();
        })
        .catch(done);
    });

    after(function(done) {
      API.helpers
        .authenticateUser(revAdmin)
        .then(function() {
          return API.resources.domainConfigs.deleteOne(firstDc.id);
        })
        .then(function() {
          return API.resources.logShippingJobs.deleteOne(firstLsJ.id);
        })
        .then(function() {
          return API.resources.accounts.deleteAllPrerequisites(done);
        })
        .catch(done);
    });
    beforeEach(function(done) {
      done();
    });

    afterEach(function(done) {
      done();
    });

    it('should start local ftp server', function(done) {
      ftpServerProcess = childProcess.fork(
        path.join(
          __dirname,
          '../../common',
          config.get('logshipper.ftp.localhost.script')
        ));
      done();
    });

    it('should ping and get response from ftp server', function(done) {
      setTimeout(function() {
        ftpClient = new FtpClient();
        ftpClient.connect(
          firstLsJ.destination_host, // 'localhost',
          firstLsJ.destination_port,
          firstLsJ.username,
          firstLsJ.password,
          function(err) {
            if (!err) {
              done();
            } else {
              done(new Error('Could not connect to local ftp server'));
              throw new Error('Could not connect to local ftp server');
            }
          });
      }, 20000);
    });

    it('should get list from ftp server', function(done) {
      ftpClient.list('/', function(err, files) {
        if (err) {
          done(err);
        }
        files.length.should.be.above(0);
        done();
      });
    });

    it('should download test file from ftp server', function(done) {
      console.log('logshipper.ftp.localhost.download', config.get('logshipper.ftp.localhost.download'))
      ftpClient.download(
        config.get('logshipper.ftp.localhost.test_file'),
        '/',
        path.join(
          __dirname,
          '../../common',
          config.get('logshipper.ftp.localhost.download')
        ),
        function() {
          setTimeout(function() {
            fs.exists(
              path.join(
                __dirname,
                '../../common',
                config.get('logshipper.ftp.localhost.download'),
                config.get('logshipper.ftp.localhost.test_file')
              ),
              function(exists) {
                if (exists) {
                  fs.unlink(
                    path.join(
                      __dirname,
                      '../../common',
                      config.get('logshipper.ftp.localhost.download'),
                      config.get('logshipper.ftp.localhost.test_file')
                    ),
                    function() {
                      done();
                    }
                  );
                } else {
                  done(new Error('Test file is not found'));
                  throw new Error('Test file is not found');
                }
              });
          }, 5000);
        });
    });

    it('should send requests to recently created domain config to generate logs in 2 minutes', function(done) {
      setTimeout(function() {
        var productionProxyServers = proxyServers
          .filter(function(server) {
            return server.environment === 'prod' && server.status === 'online';
          })
          .map(function(server) {
            return server.server_name.toLowerCase();
          });

        var stagingProxyServers = proxyServers
          .filter(function(server) {
            return server.environment === 'staging' && server.status === 'online';
          })
          .map(function(server) {
            return server.server_name.toLowerCase();
          });
        var proxyRequests = [];
        productionProxyServers.forEach(function(server) {
          proxyRequests.push(
            utils.sendProxyServerRequest(server, firstDc.domain_name)
          );
        });
        stagingProxyServers.forEach(function(server) {
          proxyRequests.push(
            utils.sendProxyServerRequest(server, firstDc.domain_name)
          );
        });
        return Promise.all(proxyRequests)
          .then(function() {
            done();
          })
          .catch(function(error) {
            return Promise.reject(error);
          });
      }, 120 * 1000);
    });

    it('should complete logshipping job and send logs to local ftp server in ' + jobMinutes +
      ' minutes',
      function(done) {
        setTimeout(function() {
          ftpClient.list('/', function(err, files) {
            files.length.should.be.above(1);
            var filesToUnlink = [];

            files.forEach(function(file) {
              if (file.name !== config.get('logshipper.ftp.localhost.test_file')) {
                filesToUnlink.push(
                  fs.unlink(
                    path.join(
                      __dirname,
                      '../../common',
                      config.get('logshipper.ftp.localhost.root'),
                      file.name
                    ),
                    function() {
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
              .catch(function(err) {
                done(new Error('One of files could not be removed'));
                throw new Error('One of files could not be removed');
              });
          });
        }, jobMinutes * 60 * 1000);
      });

    it('should stop logshipping job for ftp server', function(done) {
      var firstLsJConfig = LogShippingJobsDP.generateUpdateData(
        account.id,
        'ftp',
        'domain',
        firstDc.id,
        'stop'
      );
      API.resources.logShippingJobs
        .update(firstLsJ.id, firstLsJConfig)
        .expect(200)
        .then(function() {
          done();
        })
        .catch(function(error) {
          done(error);
          throw error;
        });
    });

    it('should stop local ftp server', function(done) {
      ftpServerProcess.kill('SIGKILL');
      done();
    });
  });

  //=== Remote FTP Server
  describe('Destination FTP server by IP, Source type Domain', function() {
    var account;
    var remoteFTPLsJ;
    var domainConfigForTestRemoteFTPIP;
    var ftpClient;
    var ftpServerProcess;
    var proxyServers;
    var jobMinutes = 1;

    before(function(done) {
      API.helpers
        .authenticateUser(revAdmin)
        .then(function() {
          return utils.getProxyServers();
        })
        .then(function(servers) {
          proxyServers = servers;
        })
        .then(function() {
          return API.helpers.accounts.createOne();
        })
        .then(function(newAccount) {
          account = newAccount;
        })
        .then(function() {
          return API.helpers.domainConfigs.createOne(account.id);
        })
        .then(function(domainConfig) {
          domainConfigForTestRemoteFTPIP = domainConfig;
          var times = Constants.DOMAIN_STATUS_POLLING_TIMEOUT;
          var interval = Constants.DOMAIN_STATUS_POLLING_INTERVAL;
          var domainPolling = function() {
            if (times < 0) {
              done(new Error('Domain polling timeout'));
            }
            times -= interval;
            DomainHelpers.checkStatus(domainConfigForTestRemoteFTPIP.id)
              .then(function(res) {
                if (res.staging_status === 'Published' && res.global_status === 'Published') {
                  return API.helpers.logShippingJobs.createOne(account.id)
                    .then(function(logShippingJob) {
                      remoteFTPLsJ = logShippingJob;
                      return;
                    })
                    .then(function() {
                      var remoteFTPIPLsJConfig = LogShippingJobsDP.generateUpdateData(
                        account.id,
                        'ftp',
                        'domain',
                        domainConfigForTestRemoteFTPIP.id,
                        'active',
                        'ftp-remote-ip', {
                          destination_host: config.get('logshipper.ftp.remote_ip.host'),
                          destination_port: config.get('logshipper.ftp.remote_ip.port'),
                          destination_username: config.get('logshipper.ftp.remote_ip.username'),
                          destination_password: config.get('logshipper.ftp.remote_ip.password')
                        }
                      );
                      return API.resources.logShippingJobs
                        .update(remoteFTPLsJ.id, remoteFTPIPLsJConfig)
                        .expect(200)
                        .then(function() {
                          remoteFTPIPLsJConfig.id = remoteFTPLsJ.id;
                          remoteFTPLsJ = remoteFTPIPLsJConfig;
                          done();
                        });
                    })
                    .catch(done);
                } else {
                  setTimeout(domainPolling, interval);
                }
              });
          };
          domainPolling();
        })
        .catch(done);
    });

    after(function(done) {
      API.helpers
        .authenticateUser(revAdmin)
        .then(function() {
          return API.resources.domainConfigs.deleteOne(domainConfigForTestRemoteFTPIP.id);
        })
        .then(function() {
          return API.resources.logShippingJobs.deleteOne(remoteFTPLsJ.id);
        })
        .then(function() {
          return API.resources.accounts.deleteAllPrerequisites(done);
        })
        .catch(done);
    });

    beforeEach(function(done) {
      done();
    });

    afterEach(function(done) {
      done();
    });

    it('should send requests to recently created domain config to generate logs in 2 minutes', function(done) {
      setTimeout(function() {
        var productionProxyServers = proxyServers
          .filter(function(server) {
            return server.environment === 'prod' && server.status === 'online';
          })
          .map(function(server) {
            return server.server_name.toLowerCase();
          });

        var stagingProxyServers = proxyServers
          .filter(function(server) {
            return server.environment === 'staging' && server.status === 'online';
          })
          .map(function(server) {
            return server.server_name.toLowerCase();
          });

        var proxyRequests = [];
        productionProxyServers.forEach(function(server) {
          proxyRequests.push(
            utils.sendProxyServerRequest(server, domainConfigForTestRemoteFTPIP.domain_name)
          );
        });
        stagingProxyServers.forEach(function(server) {
          proxyRequests.push(
            utils.sendProxyServerRequest(server, domainConfigForTestRemoteFTPIP.domain_name)
          );
        });
        return Promise.all(proxyRequests)
          .then(function() {
            done();
          })
          .catch(function(error) {
            done(error);
            return Promise.reject(error);
          });
      }, 2 * 60 * 1000);
    });

    it('should connect to remote ftp server', function(done) {
      try {
        ftpClient = new ftps({
          protocol: 'ftp',
          host: remoteFTPLsJ.destination_host,
          username: remoteFTPLsJ.destination_username,
          password: remoteFTPLsJ.destination_password,
          port: (remoteFTPLsJ.destination_port || 21),
          requiresPassword: (remoteFTPLsJ.destination_password !== ''),
          retries: 1,
          timeout: 5,
        });
      } catch (error) {
        return done(error);
      }
      done();
    });
    // });

    it('should get list files from home directory', function(done) {
      ftpClient.cd('~/').ls()
        .exec(function(err, data) {
          done(err || data.error);
        });
    });

    it('should find file with Job Id in home directory', function(done) {
      // console.log('remoteFTPLsJ.id', remoteFTPLsJ.id)
      var regEx = new RegExp('' + remoteFTPLsJ.id, 'g');
      setTimeout(function() {
        ftpClient.cd('~/')
          .pwd()
          .ls().exec(function(err, data) {
            if (!err && !data.error) {
              // console.log('regEx.test(data)', regEx, remoteFTPLsJ.id, regEx.test(data.data), data.data)
              return done(!regEx.test(data.data));
            } else {
              done(new Error('Could not get list files from remote ftp server'));
            }
          });

      }, 1 * 60 * 1000);
    });
    // TODO: fix regEx
    xit('should find file with logs for test domain name ', function(done) {
      var escapedDomainName = domainConfigForTestRemoteFTPIP.domain_name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      var fileZipName = remoteFTPLsJ.id + '\\.[[a-z0-9\\.]{0,12}]*' + escapedDomainName + '.log.gz';
      var regEx = new RegExp('' + fileZipName, 'g');

      ftpClient.cd('~/')
        .pwd()
        .ls()
        .exec(function(err, data) {
          // console.log('regEx.test(data)', regEx, fileZipName, regEx.test(data.data), data.data)
          if (!err && !data.error) {
            if (!regEx.test(data.data)) {
              return done(new Error('File not found'));
            }
            return done();
          } else {
            done(new Error('Could not get list files from remote ftp server'));
          }
        });
    });

    it('should stop logshipping job for ftp server', function(done) {
      var firstLsJConfig = LogShippingJobsDP.generateUpdateData(
        account.id,
        'ftp',
        'domain',
        domainConfigForTestRemoteFTPIP.id,
        'stop',
        'ftp-remote-ip', {
          destination_host: config.get('logshipper.ftp.remote_ip.host'),
          destination_port: config.get('logshipper.ftp.remote_ip.port'),
          destination_username: config.get('logshipper.ftp.remote_ip.username'),
          destination_password: config.get('logshipper.ftp.remote_ip.password')
        }
      );
      API.resources.logShippingJobs
        .update(remoteFTPLsJ.id, firstLsJConfig)
        .expect(200)
        .then(function() {
          done();
        })
        .catch(function(error) {
          done(error);
        });
    });
  });

});