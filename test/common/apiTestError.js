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

// # Test API Error

/**
 * Create a new API Test error.
 *
 * @param message
 * @constructor
 */
var APITestError = function (message, error, data) {
  this.name = 'APITestError';
  this.message = this.name + ': ' + (message || 'Error Message') + ' - \n\t' +
    'Data sent: ' + JSON.stringify(data) + '\n\t' +
    'Error received: ' + JSON.stringify(error);
  this.stack = (new Error()).stack;
};

// Inherit from Error
APITestError.prototype = Object.create(Error.prototype);
APITestError.prototype.constructor = APITestError;

module.exports = APITestError;