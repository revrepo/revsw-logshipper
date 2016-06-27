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

var AccountsResource = require('./../resources/accounts');
var AccountsDP = require('./../providers/data/accounts');
var APITestError = require('./../apiTestError');

// # Accounts Helper
// Abstracts common functionality for the related resource.
module.exports = {

  /**
   * Creates a new account.
   *
   * @returns {Object} account data
   */
  createOne: function () {
    var account = AccountsDP.generateOne();
    return AccountsResource
      .createOneAsPrerequisite(account)
      .catch(function (error) {
        throw new APITestError('Creating Account', error.response.body,
          account);
      })
      .then(function (res) {
        account.id = res.body.object_id;
        return account;
      });
  },

  /**
   * Creates new account and the updates it in order to get a full/complete
   * account (with most of all required data).
   *
   * @returns {Object} account data
   */
  createCompleteOne: function () {
    return this
      .createOne()
      .then(function (account) {
        var completeAccount = AccountsDP.generateCompleteOne(account);
        return AccountsResource
          .update(completeAccount.id, completeAccount)
          .then(function (res) {
            if (res.body.statusCode !== 200) {
              throw new APITestError('Creating Full Account',
                res.body.statusCode,
                account);
            }
            return completeAccount;
          })
          .catch(function (err) {
            throw new APITestError('Creating Full Account', err.body, account);
          });
      });
  },

  /**
   * Gets the first statement for the given account id.
   *
   * @param {String} accountId
   * @returns {Promise} which will return the first statement from the account
   */
  getFirstStatement: function (accountId) {
    return AccountsResource
      .statements(accountId)
      .getAll()
      .expect(200)
      .then(function (res) {
        return res.body[0];
      });
  }
};
