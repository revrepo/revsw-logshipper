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

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

var config = require('config');
var should = require('should-http');
var request = require('supertest');

describe('Smoke check', function () {

  // Changing default mocha's timeout (Default is 2 seconds).
  this.timeout(config.get('api.request.maxTimeout'));
  var testLogshipperURL = config.get('logshipper_url');

  before(function (done) {
    done();
  });

  after(function (done) {
    done();
  });

  describe('LogShipper health check', function () {

    beforeEach(function (done) {
      done();
    });

    afterEach(function (done) {
      done();
    });

    it('should return success response code when getting status request to logshipper master app',
      function (done) {
        request(testLogshipperURL)
          .get('/v1/status')
          .expect(200)
          .end(function (err, res) {
            if (err) {
              throw err;
            }
            var responseJson = JSON.parse(res.text);
            
            responseJson.jobs_active.should.be.a.Number();
            responseJson.jobs_collected.should.be.a.Number();
            responseJson.jobs_logs_collected.should.be.a.Number();
            responseJson.jobs_filed.should.be.a.Number();
            responseJson.jobs_filed_failed.should.be.a.Number();
            responseJson.jobs_shipped.should.be.a.Number();
            responseJson.jobs_shipping_failed.should.be.a.Number();
            responseJson.jobs_shipping_failed_by_destination.s3.should.be.a.Number();
            responseJson.jobs_shipping_failed_by_destination.ftp.should.be.a.Number();
            responseJson.jobs_shipping_failed_by_destination.sftp.should.be.a.Number();
            responseJson.jobs_shipping_failed_by_destination.elasticsearch.should.be.a.Number();
            done();
          });
      });
  });
});
