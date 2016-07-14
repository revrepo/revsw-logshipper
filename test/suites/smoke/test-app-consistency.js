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

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

var config = require('config');
var should = require('should-http');
var request = require('supertest');

describe('Smoke check', function () {

  // Changing default mocha's timeout (Default is 2 seconds).
  this.timeout(config.get('api.request.maxTimeout'));
  var testLogshipperURL = (process.env.LS_QA_URL) ? process.env.LS_QA_URL : 'https://127.0.0.1:8443';

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

    it('should return success response code when getting health check request to logshipper master app',
      function (done) {
        var expectedMessage = 'Everything is OK';

        request(testLogshipperURL)
          .get('/v1/healthcheck')
          .expect(200)
          .end(function (err, res) {
            if (err) {
              throw err;
            }
            var responseJson = JSON.parse(res.text);
            responseJson.message.should.be.equal(expectedMessage);
            done();
          });
      });
  });
});
