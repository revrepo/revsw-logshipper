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
    var namePattern = /^ls-test-[0-9]{3,15}\.revsw\.net$/i;

    before(function (done) {
        done();
    });

    after(function (done) {
        done();
    });

    describe('Domain Configs resource', function () {

        beforeEach(function (done) {
            done();
        });

        afterEach(function (done) {
            done();
        });

        it('should clean DomainConfigs created for testing.',
            function (done) {
                API.helpers
                    .authenticateUser(revAdmin)
                    .then(function () {
                        API.resources.domainConfigs
                            .getAll()
                            .expect(200)
                            .then(function (res) {
                                var ids = [];
                                var domainConfigs = res.body;
                                domainConfigs.forEach(function (domainConfig) {
                                    if (namePattern.test(domainConfig.domain_name)) {
                                        ids.push(domainConfig.id);
                                    }
                                });
                                API.resources.domainConfigs
                                    .deleteManyIfExist(ids)
                                    .finally(done);
                            })
                            .catch(done);
                    })
                    .catch(done);
            });
    });
});
