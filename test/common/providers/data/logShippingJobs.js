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

// # Domain Configs Data Provider object
//
// Defines some methods to generate valid and common domain-configs test data.
// With common we mean it oes not have anything special on it.
//
// From there, you can modify and get bogus, invalid or other type of data
// depending on your test needs.
var LogShippingJobsDataProvider = {

  prefix: 'LS-TEST',

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
      'job_name': (_prefix + '-' + Date.now() + '-LOGSHIPPER-JOB').toLowerCase(),
      'account_id': accountId
    };
  },

  generateUpdateData: function(accountId, destination, source, sourceId, operationalMode, prefix) {
    var _prefix = prefix || this.prefix;
    var destinationHost = '',
        destinationPort = '',
        destinationKey = '',
        username = '',
        password = '';

    if (operationalMode !== 'active' && operationalMode !== 'stop' && operationalMode !== 'pause') {
      throw new Error('Invalid operationalMode');
    }

    if (source === 'domain') {
      // pass
    } else {
      throw new Error('Invalid source');
    }

    if (destination === 's3') {
      destinationHost = 'logshipper-qa-testing-bucket';
      destinationKey = 'AKIAIHKS2KF4XKGKB6XQ';
      password = 'HXmFLSSPNMLoESX0Lbfp1D3BniW6cf8vZz+LNysj'; // S3 SecretKey
    } else if (destination === 'ftp') {
      destinationHost = config.get('logshipper.ftp.host');
      destinationPort = '3021';
      username = 'logshipper';
      password = 'logshipper';
    } else if (destination === 'sftp') {
      destinationHost = '192.168.4.75';   // TESTSJC20-WEBSITE01, separate SSHD process managed
                                          // using /etc/init.d/ssh-sftp
      destinationPort = '222';
      username = 'sftp-test';
      password = 'Revsw11b';
    } else if (destination === 'elasticsearch') {
      destinationHost = 'testsjc20-es01.revsw.net';
      destinationPort = '9200';
      destinationKey = 'logs';
    } else {
      throw new Error('Invalid destination');
    }

    return {
      job_name: ('UPDATED-' + _prefix + '-' + Date.now() + '-LOGSHIPPER-JOB').toLowerCase(),
      account_id: accountId,
      source_type: source,
      source_id: sourceId,
      destination_type: destination,
      destination_host: destinationHost,
      destination_port: destinationPort,
      destination_username: username,
      destination_password: password,
      destination_key: destinationKey,
      notification_email: '',
      comment: 'test commment for logshipping job',
      operational_mode: operationalMode
    };
  },

  generateInvalidUpdateData: function(accountId, destination, source, sourceId, operationalMode, prefix) {
    var _prefix = prefix || this.prefix;
    var destinationHost = '',
        destinationPort = '',
        destinationKey = '',
        username = '',
        password = '';

    if (operationalMode !== 'active' && operationalMode !== 'stop' && operationalMode !== 'pause') {
      throw new Error('Invalid operationalMode');
    }

    if (source === 'domain') {
      // pass
    } else {
      throw new Error('Invalid source');
    }

    if (destination === 's3') {
      destinationHost = 'HJjsfhJSInvaLid73BuckDJS22';
      destinationKey = 'AKIAIIGELF5U2CXR5EO5A';
      password = '3uedu+gf6kYEY/ulj/Gx3JzXF9/ocnIMreKy+zk/R'; // S3 SecretKey
    } else if (destination === 'ftp') {
      destinationHost = '128.0.0.1';
      destinationPort = '3221';
    } else if (destination === 'sftp') {
      destinationHost = '128.0.0.1';
      destinationPort = '3222';
      username = 'logshipper2';
      password = 'logshipper1';
    } else if (destination === 'elasticsearch') {
      destinationHost = 'testsjc99-es01.revsw.net';
      destinationPort = '9201';
      destinationKey = 'logs';
    } else {
      throw new Error('Invalid destination');
    }

    return {
      job_name: ('UPDATED-' + _prefix + '-' + Date.now() + '-LOGSHIPPER-JOB').toLowerCase(),
      account_id: accountId,
      source_type: source,
      source_id: sourceId,
      destination_type: destination,
      destination_host: destinationHost,
      destination_port: destinationPort,
      destination_username: username,
      destination_password: password,
      destination_key: destinationKey,
      notification_email: '',
      comment: 'test commment for logshipping job',
      operational_mode: operationalMode
    };
  }
};

module.exports = LogShippingJobsDataProvider;
