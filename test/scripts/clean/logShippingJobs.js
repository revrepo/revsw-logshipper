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

var config = require('config');
var API = require('./../../common/api');

describe('Clean up', function () {

    // Changing default mocha's timeout (Default is 2 seconds).
    this.timeout(config.get('api.request.maxTimeout'));

    var revAdmin = config.get('api.users.revAdmin');
    var namePattern = /^(updated-)?ls-test-[0-9]{3,15}-logshipper-job$/i;
    // updated-ls-test-1466846615983-logshipper-job

    before(function (done) {
        done();
    });

    after(function (done) {
        done();
    });

    describe('LogShipping Jobs resource', function () {

        beforeEach(function (done) {
            done();
        });

        afterEach(function (done) {
            done();
        });

        it('should clean LogShipping Jobs created for testing.',
            function (done) {
                API.helpers
                    .authenticateUser(revAdmin)
                    .then(function () {
                        API.resources.logShippingJobs
                            .getAll()
                            .expect(200)
                            .then(function (res) {
                                var ids = [];
                                var logShippingJobs = res.body;
                                logShippingJobs.forEach(function (logShippingJob) {
                                    if (namePattern.test(logShippingJob.job_name)) {
                                        ids.push(logShippingJob.id);
                                    }
                                });
                                API.resources.logShippingJobs
                                    .deleteManyIfExist(ids)
                                    .finally(done);
                            })
                            .catch(done);
                    })
                    .catch(done);
            });
    });
});
