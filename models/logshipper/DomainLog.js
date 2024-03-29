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
  commons = require('../../lib/commons'),
  logger = require('revsw-logger')(config.log),
  utils = require('../../lib/utilities');

var DomainLogConnection = mongoose.createConnection(
  config.get('logshipper_mongo.connect_string')
  );

function DomainLog(mongoose, connection, options) {
  this.options = options;
  this.Schema = mongoose.Schema;
  this.ObjectId = this.Schema.ObjectId;

  this.DomainLogSchema = new this.Schema({});

  this.DomainLogSchema.index({ unixtime: 1, domain: 1 });
  this.DomainLogSchema.index({ unixtime: 1 });
  this.DomainLogSchema.index({ domain: 1 });
  this.model = connection.model('DomainLog', this.DomainLogSchema, 'DomainsLog');
}

mongoose.set('debug', config.get('mongoose_debug_logging'));

DomainLog.prototype = {
  listByJobs: function (jobs, callback) {
    var conditionsArray = jobs.map(function (job) {
      var query = {
        domain: job.domain_name,
        unixtime: {
          $gte: job.span.from, $lte: job.span.to
        }
      };

      if (job.domain_aliases) {
        var domainNames = job.domain_aliases.slice();
        domainNames.push(job.domain_name);
        query.domain = { $in: domainNames };
      }

      if (job.domain_wildcard_alias) {
        query.$or = [
          { domain: query.domain },
          { domain: { $regex: job.domain_wildcard_alias.substring(1) } }
        ];

        delete query.domain;
      }

      return query;
    });

    // logger.debug('DomainLog.listByJobs, $where', conditionsArray);
    this.model.find({
      $or: conditionsArray
    }, { __v: 0 })
      .sort({
        unixtime: 1
      })
      .limit(config.logs_shipping_max_records)
      .exec(function (err, logs) {
        logger.debug('DomainLog.listByJobs, .exec', err, (logs || []).length);
        var results = utils.clone(logs || []);
        callback(err, results);
      });
  },

  clean: function (callback) {
    var threshold = { $lte: (Date.now() / 1000 - config.logs_max_age_hr * 3600/*sec*/) };
    this.model.remove({
      unixtime: threshold
    }, function (err, data) {
      callback(err, data.result);
    });
  },

  cleanByJobs: function (jobs, callback) {
    if (!jobs || !jobs.length) {
      callback(null, { n: 0 });
    } else {

      var conditionsArray = jobs.map(function (job) {
        var query = {
          domain: job.domain_name,
          unixtime: { $lte: job.span.to }
        };

        if (job.domain_aliases) {
          var domainNames = job.domain_aliases.slice();
          domainNames.push(job.domain_name);
          query.domain = { $in: domainNames };
          query.unixtime = { $lte: job.span.to };
        }

        if (job.domain_wildcard_alias) {
          query.$or = [
            { domain: query.domain, unixtime: { $lte: job.span.to } },
            {
              domain: {
                $regex: job.domain_wildcard_alias.substring(1)
              },
              unixtime: { $lte: job.span.to }
            }
          ];

          delete query.domain;
        }

        return query;
      });

      logger.debug('DomainLog.cleanByJobs, $where', conditionsArray);
      this.model.remove({ $or: conditionsArray }, function (err, data) {
        console.log(err);
        callback(err, data.result);
      });
    }
  }
};

exports.DomainLogs = new DomainLog(mongoose, DomainLogConnection);
