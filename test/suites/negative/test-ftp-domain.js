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
var utils = require('./../../common/utils');

var FtpClient = require('./../../common/ftpClient');

describe('Negative check', function () {

  // Changing default mocha's timeout (Default is 2 seconds).
  this.timeout(config.get('api.request.maxTimeout'));

  var revAdmin = config.get('api.users.revAdmin');
  var reseller = config.get('api.users.reseller');

  var account;
  var firstLsJ;
  var firstDc;
  var ftpClient;
  var jobMinutes = 2;
  var proxyServers;
  

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
        var firstLsJConfig = LogShippingJobsDP.generateInvalidUpdateData(
          account.id,
          'ftp',
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

  describe('Destination FTP server, Source type Domain', function () {

    beforeEach(function (done) {
      done();
    });

    afterEach(function (done) {
      done();
    });

    it('should fail to get response from ftp server', function (done) {
      ftpClient = new FtpClient();
      ftpClient.connect(
        firstLsJ.destination_host,
        firstLsJ.destination_port,
        firstLsJ.username,
        firstLsJ.password,
        function (err) {
          if (err) {
            done();
          } else {
            throw new Error('Connected to local ftp server somehow');
          }
        });
    });

    it('should send requests to recently created domain config to generate logs in 1 minutes', function (done) {
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
      }, 60 * 1000);
    });


    it('should pause failed logshipping job for offline ftp server in ' + jobMinutes +
      ' minutes', function (done) {
      setTimeout(function () {
        API.helpers
          .authenticateUser(revAdmin)
          .then(function () {
            API.resources.logShippingJobs
              .getOne(firstLsJ.id)
              .expect(200)
              .then(function (res) {
                var responseJson = res.body;
                responseJson.operational_mode.should.be.equal('pause');
                done();
              })
              .catch(function (error) {
                throw error;
              });
          })
          .catch(function (error) {
            throw error;
          });
      }, jobMinutes * 60 * 1000);
    });
  });
});
