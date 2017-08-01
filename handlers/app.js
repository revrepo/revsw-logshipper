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

/*jslint node: true */
'use strict';

//  ----------------------------------------------------------------------------------------------//

var boom = require('boom');
var config = require('config');
var fs = require('fs');
var logger = require('revsw-logger')(config.log);
var Promise = require('bluebird');
var utils = require('../lib/utilities');

var LogShippingJobs = Promise.promisifyAll(require('../models/portal/LogShippingJob').LogShippingJobs);
var DomainConfigs = Promise.promisifyAll(require('../models/portal/DomainConfig').DomainConfigs);
var Apps = Promise.promisifyAll(require('../models/portal/App').Apps);

//  ---------------------------------
var commons = require('../lib/commons');

//  ----------------------------------------------------------------------------------------------//

exports.healthCheck = function (request, reply) {
  var version = fs.readFileSync(config.get('version_file'), {
    encoding: 'utf8'
  });


  return LogShippingJobs.listShippingJobsAsync()
    .then(function (jobs) {
      return DomainConfigs.listAsync();
    })
    .then(function (domainConfigs) {
      return Apps.listAsync();
    })
    .then(function (apps) {
      return reply({
        message: 'Everything is OK',
        version: version
      });
    })
    .catch(function (error) {
      return reply({
        message: 'Error: ' + error.message,
        version: version.trim()
      });
    });
};

exports.logshipperStatus = function (request, reply) {
  // request.server.app.logshipperStats.per_job_stats = [];
  // LogShippingJobs.lis
  
  return utils.renderJSON(request, reply, null, request.server.app.logshipperStats);
};

