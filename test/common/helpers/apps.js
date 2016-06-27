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

var AppsResource = require('./../resources/apps');
var AppsDP = require('./../providers/data/apps');
var APITestError = require('./../apiTestError');

// # Apps Helper
// Abstracts common functionality for the related resource.
module.exports = {

  createOne: function (accountId) {
    var app = AppsDP.generateOne(accountId);
    return AppsResource
      .createOneAsPrerequisite(app)
      .catch(function (error) {
        throw new APITestError('Creating App', error.response.body, app);
      })
      .then(function (res) {
        app.id = res.body.id;
        app.sdkKey = res.body.sdk_key;
        return app;
      });
  }
};