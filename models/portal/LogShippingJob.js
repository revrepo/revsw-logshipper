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

var config = require('config'),
  mongoose = require('mongoose'),
  _ = require('lodash'),
  logger = require('revsw-logger')(config.log),
  utils = require('../../lib/utilities');

var LogShippingJobConnection = mongoose.createConnection(
  config.get('portal_mongo.connect_string'));

function LogShippingJob(mongoose, connection, options) {
  this.options = options;
  this.Schema = mongoose.Schema;
  this.ObjectId = this.Schema.ObjectId;

  this.LogShippingJobSchema = new this.Schema({
    'job_name': String,
    'operational_mode': { type: String, default: 'stop' },
    'account_id': String,
    'created_by': String,
    'created_at': { type: Date, default: Date.now },
    'source_type': { type: String, default: 'domain' },
    'source_id': String,
    'destination_type': { type: String, default: 's3' },
    'destination_host': { type: String, default: '' },
    'destination_port': { type: String, default: '' },
    'destination_key': { type: String, default: '' },
    'destination_username': { type: String, default: '' },
    'destination_password': { type: String, default: '' },
    'notification_email': { type: String, default: '' },
    'comment': { type: String, default: '' },
    'updated_by': String,
    'updated_at': { type: Date, default: Date.now }
  });

  this.model = connection.model('LogShippingJob', this.LogShippingJobSchema, 'LogShippingJob');
}

mongoose.set('debug', config.get('mongoose_debug_logging'));


LogShippingJob.prototype = {
  listShippingJobs: function (callback) {

    // Get ids from config
    var account_ids = config.get('active_account_ids');
    var supp_account_ids = config.get('suppressed_account_ids');
    var options = {};

    // query with account ids filters if needed
    if (account_ids && account_ids.length > 0) {
      options = {
        operational_mode: {
          $in: [
            'active',
            'pause']
        },
        destination_host: {
          $ne: ''
        },
        account_id: {
          $in: account_ids,
          $ne: supp_account_ids.length > 0 ? supp_account_ids : ''
        }
      };
    } else {
      options = {
        operational_mode: {
          $in: [
            'active',
            'pause']
        },
        destination_host: {
          $ne: ''
        },
        account_id: {
          $ne: supp_account_ids.length > 0 ? supp_account_ids : ''
        }
      };
    }
    this.model.find(options, function (err, jobs) {
      var results = utils.clone(jobs).map(function (r) {
        delete r.__v;
        return r;
      });
      callback(err, results);
    });
  },

  pauseJobs: function (jobIds, callback) {
    this.model.update(
      {
        _id: {
          $in: jobIds
        }
      },
      {
        $set: {
          operational_mode: 'pause'
        }
      },
      {
        multi: true,
        w: 1
      }, function (err, result) {
        callback(err, result);
      });
  }
};

exports.LogShippingJobs = new LogShippingJob(mongoose, LogShippingJobConnection);
