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
var utils = require('./../../common/utils');
var Constants = require('./../../common/constants');
var ElasticSearchClient = require('./../../common/elasticClient');
var DomainHelpers = require('./../../common/helpers/domainConfigs');

describe('Functional check', function () {

  // Changing default mocha's timeout (Default is 2 seconds).
  this.timeout(config.get('api.request.maxTimeout'));

  var revAdmin = config.get('api.users.revAdmin');
  var reseller = config.get('api.users.reseller');

  var account;
  var firstLsJ;
  var firstDc;
  var elasticClient;
  var jobMinutes = 1;
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
            if(res.staging_status === 'Published' && res.global_status === 'Published') {
              return API.helpers.logShippingJobs.createOne(account.id)
              .then(function (logShippingJob) {
                firstLsJ = logShippingJob;
              })
              .then(function () {
                var firstLsJConfig = LogShippingJobsDP.generateUpdateData(
                  account.id,
                  'elasticsearch',
                  'domain',
                  firstDc.id,
                  'active'
                );
                return API.resources.logShippingJobs
                  .update(firstLsJ.id, firstLsJConfig)
                  .expect(200)
                  .then(function (res) {
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

  describe('Destination ElasticSearch, Source type Domain', function () {

    beforeEach(function (done) {
      done();
    });

    afterEach(function (done) {
      done();
    });

    it('should connect to test elastic search', function (done) {
      elasticClient = new ElasticSearchClient();
      elasticClient.connect(
        firstLsJ.destination_host,
        firstLsJ.destination_port,
        function (err) {
          if (!err) {
            done();
          } else {
            throw err;
          }
        });
    });

    it('should delete elastic index', function (done) {
      elasticClient.deleteIndex(
        firstLsJ.destination_key,
        function (err, data) {
          if (!err) {
            done();
          } else {
            throw err;
          }
        });
    });

    it('should get logshipper objects list from elastic', function (done) {
      var noIndexErrorMessage = 'IndexMissingException[[' +
        firstLsJ.destination_key + '] missing]';
      elasticClient.list(
        'logshipper',
        firstLsJ.destination_key,
        function (err, hits) {
          if (!err) {
            hits.length.should.be.equal(0);
            done();
          } else {
            if (err.message !== noIndexErrorMessage) {
              throw err;
            } else {
              done();
            }
          }
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

    var hitJSON;

    it('should complete logshipping job and send logs to elastic in ' + jobMinutes +
      ' minutes', function (done) {
        setTimeout(function () {
          elasticClient.list(
            'logshipper',
            firstLsJ.destination_key,
            function (err, hits) {
              if (!err) {
                hits.length.should.be.above(0);
                hitJSON = hits[0];
                done();
              } else {
                throw err;
              }
            });
        }, jobMinutes * 60 * 1000);
      });

    it('should only contain expected fields in a log shipping JSON object', function (done) {
      for (var field in hitJSON._source) {
        if (hitJSON._source.hasOwnProperty(field)) {
          Constants.JOB_EXPECTED_FIELDS.indexOf(field).should.be.not.equal(-1);
        }
      }
      done();
    });

    it('should stop logshipping job for elastic', function (done) {
      var firstLsJConfig = LogShippingJobsDP.generateUpdateData(
        account.id,
        'elasticsearch',
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
  });
});
