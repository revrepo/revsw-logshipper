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

// # User Data Provider object
//
// Defines some methods to generate valid and common user test data.
// With common we mean it does not have anything special on it.
//
// From there, you can modify and get bogus, invalid or other type of data
// depending on your test needs.
var UserDataProvider = {

  prefix: 'api-test',

  /**
   * ### UserDataProvider.generateOne()
   *
   * Generates valid data that represents a user and the user REST API
   * end points accept.
   *
   * @param {Object} data, user information to use
   * @returns {Object} user info with the following schema
   *    {
   *      email: String,
   *      firstname: String,
   *      lastname: String,
   *      password: String,
   *      access_control_list: {
   *        dashBoard: Boolean,
   *        reports: Boolean,
   *        configure: Boolean,
   *        test: Boolean,
   *        readOnly: Boolean
   *      },
   *      role: String,
   *      theme: String
   *    }
   */
  generateOne: function (data) {
    var prefix = data.firstName ? data.firstName + '_' : '';
    var user = {
      email: prefix + 'API_TEST_USER_' + Date.now() + '@revsw.com',
      firstname: data.firstName || 'Super',
      lastname: data.lastName || 'Man',
      password: 'password1',
      access_control_list: {
        dashBoard: true,
        reports: true,
        configure: true,
        test: true,
        readOnly: true
      },
      role: data.role || 'user',
      theme: 'light'
    };
    if (data.companyId) {
      user.companyId = data.companyId;
    }
    return user;
  },

  /**
   * ### UserDataProvider.generateOneToSignUp()
   *
   * Generates valid data that represents a user (the sign-up REST API
   * end-point accepts) that is going to be registered.
   *
   * @param {String} billingPlan, billing plan info to use
   * @returns {Object} user data.
   */
  generateOneToSignUp: function (billingPlan) {
    if (!billingPlan) {
      billingPlan = 'billing-plan-gold';
    }
    var firstName = faker.name.firstName();
    var lastName = faker.name.lastName();
    var user = {
      first_name: firstName,
      last_name: lastName,
      email: [firstName, Date.now() + '@mailinator.com']
        .join('-')
        .toLowerCase(),
      // TODO: Commenting out below lines as the are not required for /signup2
      //company_name: faker.company.companyName(),
      //phone_number: faker.phone.phoneNumber(),
      password: 'password1',
      //passwordConfirm: 'password1',
      //address1: faker.address.streetAddress(),
      //address2: faker.address.secondaryAddress(),
      country: faker.address.country(),
      //state: faker.address.state(),
      //city: faker.address.city(),
      //zipcode: faker.address.zipCode(),
      billing_plan: billingPlan
    };
    return user;
  }
};

module.exports = UserDataProvider;
