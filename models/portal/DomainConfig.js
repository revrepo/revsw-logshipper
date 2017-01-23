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
  logger = require('revsw-logger')(config.log),
  utils = require('../../lib/utilities');

var DomainConnection = mongoose.createConnection(config.get('portal_mongo.connect_string'));

function DomainConfig(mongoose, connection, options) {
  this.options = options;
  this.Schema = mongoose.Schema;
  this.ObjectId = this.Schema.ObjectId;

  this.DomainConfigSchema = new this.Schema({
    'domain_name': {type: String, required: true, lowercase: true},
    'bp_group_id': {type: String, required: true},
    'origin_server_location_id': {type: String, required: true},
    'bp_apache_custom_config': {type: String},
    'bp_apache_fe_custom_config': {type: String},
    'co_apache_custom_config': {type: String},
    'co_cnames': {type: String},
    'account_id': {type: this.ObjectId},
    'config_command_options': {type: String},
    'tolerance': {type: Number},
    'rum_beacon_url': {type: String},
    'updated_at': {type: Date, default: Date.now},
    'created_at': {type: Date, default: Date.now},
    'created_by': {type: String},
    'deleted': {type: Boolean, default: false},
    'deleted_at': {type: Date, default: null},
    'deleted_by': {type: String},
    'operation': {type: String},
    'enable_ssl': {type: Boolean, default: false},
    'ssl_protocols': {type: String, default: ''},
    'ssl_ciphers': {type: String, default: ''},
    'ssl_cert_id': {type: String, default: ''},
    'ssl_conf_profile': {type: String, default: ''},
    'ssl_prefer_server_ciphers': {type: Boolean, default: true},
    'btt_key': {type: String, default: ''},
    'cname': {type: String},
    'proxy_config': {},
    'published_domain_version': {type: Number, default: 0},
    'last_published_domain_version': {type: Number, default: 0},
    'comment': {type: String, default: ''},
    'previous_domain_configs': [{}]
  });

  this.model = connection.model('DomainConfig', this.DomainConfigSchema, 'DomainConfig');
}

mongoose.set('debug', config.get('mongoose_debug_logging'));

DomainConfig.prototype = {
  get: function (item, callback) {
    this.model.findOne({_id: item, deleted: {$ne: true}}, function (err, _doc) {
      if (err) {
        callback(err);
      }
      var doc = utils.clone(_doc);
      if (doc) {
        doc.domain_name = doc.domain_name.toLowerCase();
      }
      callback(null, doc);
    });
  },

  list: function (callback) {
    this.model.find({deleted: {$ne: true}}, function (err, domains) {
      if (err) {
        callback(err, null);
      }
      var results = utils.clone(domains).map(function (r) {
        r.domain_name = r.domain_name.toLowerCase();
        delete r.__v;
        return r;
      });
      callback(err, results);
    });
  },

  listNamesByIds: function (domainIds, callback) {
    this.model.find({
        _id: {
          $in: domainIds
        },
        deleted: {
          $ne: true
        }
      },
      {
        domain_name: 1,
        proxy_config: 1
      },
      function (err, domains) {
        var results = utils.clone(domains).map(function (r) {
          r.domain_name = r.domain_name.toLowerCase();
          delete r.__v;
          return r;
        });
        callback(err, results);
      });
  }
};

exports.DomainConfigs = new DomainConfig(mongoose, DomainConnection);
