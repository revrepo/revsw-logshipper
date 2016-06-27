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

// # Main API Helper

var Session = require('./../session');

// Requiring resources to use in these Helpers.
var AuthenticateRes = require('./../resources/authenticate');

// Required Helpers to attach to main API helper object
var AccountsHelper = require('./accounts');
var AppsHelper = require('./apps');
var DomainConfigsHelper = require('./domainConfigs');
var UsersHelper = require('./users');
var LogShippingJobsHelper = require('./logShippingJobs');


// Abstracts common functionality for the API.
module.exports = {

  accounts: AccountsHelper,
  apps: AppsHelper,
  domainConfigs: DomainConfigsHelper,
  users: UsersHelper,
  logShippingJobs: LogShippingJobsHelper,

  /**
   * ### API.helpers.authenticateUser()
   *
   * Helper method to Authenticate user before doing any type of request to
   * the REST API services.
   *
   * @param user, user information. For instance
   *     {
   *       name: 'joe@email.com',
   *       password: 'something'
   *     }
   *
   * @returns {Promise}
   */
  authenticateUser: function (user) {
    return AuthenticateRes
      .createOne({email: user.email, password: user.password})
      .then(function (response) {
        user.token = response.body.token;
        Session.setCurrentUser(user);
      })
      .catch(function (error) {
        throw new Error('Authenticating user', error.response.body, user);
      });
  },

  /**
   * ### API.helpers.attemptToAuthenticateUser()
   *
   * Helper method to Attempt to authenticate user before doing any type of
   * request to the REST API services without catching any errors.
   *
   * @param user, user information. For instance
   *     {
   *       name: 'joe@email.com',
   *       password: 'something'
   *     }
   *
   * @returns {Promise}
   */
  attemptToAuthenticateUser: function (user) {
    return AuthenticateRes
      .createOne({email: user.email, password: user.password})
      .then(function (response) {
        user.token = response.body.token;
        Session.setCurrentUser(user);
      });
  }
};
