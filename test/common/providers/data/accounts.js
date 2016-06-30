/*************************************************************************
 *
 * REV SOFTWARE CONFIDENTIAL
 *
 * [2013] - [2015] Rev Software, Inc.
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

var faker = require('faker');

// # Accounts Data Provider object
//
// Defines some methods to generate valid and common account test data. With
// common we mean it oes not have anything special on it.
//
// From there, you can modify and get bogus, invalid or other type of data
// depending on your test needs.
var AccountsDataProvider = {

  prefix: 'LS_TEST_COMPANY_',

  /**
   * ### AccountsDataProvider.generateOne()
   *
   * Generates valida data that represents an account which accounts REST API
   * end points accept.
   *
   * @param {String} prefix, a prefix value to put in the name
   *
   * @returns {Object} account info with the following schema
   *
   *     {
   *         companyName: string
   *     }
   */
  generateOne: function (prefix) {
    return {
      companyName: (prefix ? prefix + '_' : '' ) + this.prefix + Date.now()
    };
  },

  /**
   * Generates valida data that represents a full/complete account which
   * accounts REST API end points accept.
   *
   * @param {Object} account with at least id and company name data
   * @returns {Object} account info
   */
  generateCompleteOne: function (account) {
    var firstName = faker.name.firstName();
    var lastName = faker.name.lastName();
    return {
      id: account.id,
      companyName: account.companyName,
      first_name: firstName,
      last_name: lastName,
      phone_number: faker.phone.phoneNumber(),
      contact_email: [firstName, Date.now() + '@mailinator.com']
        .join('-')
        .toLowerCase(),
      address1: faker.address.streetAddress(),
      address2: faker.address.secondaryAddress(),
      country: faker.address.country(),
      state: faker.address.state(),
      city: faker.address.city(),
      zipcode: faker.address.zipCode(),
      use_contact_info_as_billing_info: true,
      billing_info: {}
    };
  }
};

module.exports = AccountsDataProvider;
