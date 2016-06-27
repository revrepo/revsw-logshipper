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
    utils = require('../../lib/utilities');

var AppConnection = mongoose.createConnection(config.get('portal_mongo.connect_string'));

function App(mongoose, connection, options) {
    this.options = options;
    this.Schema = mongoose.Schema;
    this.ObjectId = this.Schema.ObjectId;

    var configSchema = mongoose.Schema({
        sdk_release_version: {type: Number},
        logging_level: String,
        configuration_refresh_interval_sec: {type: Number},
        configuration_stale_timeout_sec: {type: Number},
        operation_mode: String,
        allowed_transport_protocols: [String],
        initial_transport_protocol: String,
        transport_monitoring_url: String,
        stats_reporting_interval_sec: {type: Number},
        stats_reporting_level: String,
        stats_reporting_max_requests_per_report: {type: Number},
        domains_provisioned_list: [String],
        domains_white_list: [String],
        domains_black_list: [String],
        a_b_testing_origin_offload_ratio: {type: Number}
    }, {
        _id: false
    });

    this.AppSchema = new this.Schema({
        app_name: String,
        account_id: String,
        app_platform: String, // (“iOS” or “Android”)
        deleted: {type: Boolean, default: false},
        deleted_at: {type: Date, default : null},
        deleted_by: String,
        sdk_key: String,
        created_at: {type: Date, default: Date.now},
        created_by: String,
        updated_at: {type: Date, default: Date.now},
        updated_by: String,
        serial_id: {type: Number},
        sdk_configuration_api_service: String,
        sdk_stats_reporting_api_service: String,
        bp_group_id: String,
        configs: [configSchema],
        app_published_version: {type: Number, default: 0},
        last_app_published_version: {type: Number, default: 0},
        comment: {type: String, default: ''},
        previous_app_values: [{}]
    });

    this.model = connection.model('App', this.AppSchema, 'App');
}

mongoose.set('debug', config.get('mongoose_debug_logging'));

App.prototype = {
    get: function(item, callback) {
        this.model.findOne(item, function(err, doc) {
            if (doc) {
                doc = utils.clone(doc);
                delete doc.__v;
            }
            callback(err, doc);
        });
    },
    query: function(item, callback) {
        this.model.find(item, function(err, doc) {
            if (doc) {
                doc = utils.clone(doc).map(function(r){
                    delete r.__v;
                    return r;
                });
            }
            callback(err, doc);
        });
    },
    list: function(callback) {
        this.model.find({deleted: {$ne: true}}, function(err, apps) {
            if (apps) {
                apps = utils.clone(apps).map(function(app) {
                    delete app.__v;
                    return app;
                });
            }
            callback(err, apps);
        });
    }
};

exports.Apps = new App(mongoose, AppConnection);
