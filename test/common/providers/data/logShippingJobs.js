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

// # Domain Configs Data Provider object
//
// Defines some methods to generate valid and common domain-configs test data.
// With common we mean it oes not have anything special on it.
//
// From there, you can modify and get bogus, invalid or other type of data
// depending on your test needs.
var LogShippingJobsDataProvider = {

  prefix: 'API-TEST',

  /**
   * ### LogShippingJobsDataProvider.generateOne()
   *
   * Generates valid data that represents an log-shippinhg-job which the
   * log-shippinhg-job REST API end points accept.
   *
   * @param {String} accountId, which will be used in the log shipping job data.
   * @param {String} prefix, additional test-environment prefix (optional).
   *
   * @returns {Object} account info with the following schema
   *
   *     {
   *         account_id: string
   *         job_name: string
   *     }
   */
  generateOne: function (accountId, prefix) {
    var _prefix = prefix || this.prefix;
    return {
      'job_name':(_prefix + '-' + Date.now() + '-LOGSHIPPER-JOB').toLowerCase(),
      'account_id': accountId
    };
  }
};

module.exports = LogShippingJobsDataProvider;
