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

var DomainConfigsResource = require('./../resources/domainConfigs');
var DomainConfigsDP = require('./../providers/data/domainConfigs');
var APITestError = require('./../apiTestError');
var API = require('./../api');

// # Users Helper
// Abstracts common functionality for the related resource.
module.exports = {

  createOne: function (accountId, prefix) {
    var domainConfig = DomainConfigsDP.generateOne(accountId, prefix);
    return DomainConfigsResource
      .createOneAsPrerequisite(domainConfig)
      .catch(function (error) {
        throw new APITestError('Creating Domain Config',
          error.response.body, domainConfig);
      })
      .then(function (res) {
        domainConfig.id = res.body.object_id;
        return domainConfig;
      });
  },

  checkStatus: function (domainId) {
    return DomainConfigsResource
      .status(domainId)
      .getOne()
      .expect(200)
      .then(function (response) {
        return response.body;
      })
      .catch(new Error('Response status is not 200'));
  }
};