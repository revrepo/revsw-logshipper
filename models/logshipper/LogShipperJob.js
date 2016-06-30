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

var LogShipperJobConnection = mongoose.createConnection(config.get('logshipper_mongo.connect_string'));

function LogShipperJob(mongoose, connection, options) {
    this.options = options;
    this.Schema = mongoose.Schema;
    this.ObjectId = this.Schema.ObjectId;

    this.LogShipperJobSchema = new this.Schema({
        'job_id':  {type: String, required: true},
        'domain_name': {type: String, lowercase: true}, // TODO: should be source_id and source_type
        'status': Number,
        'shipper_type': Number,
        'span': Number,
        'logs': [],
        'shared': {
            'file_to_upload': String,
            'jobs': [{}],
            'file_type_jobs_num': Number
        }
    });

    this.model = connection.model('LogShipperJob', this.LogShipperJobSchema, 'Jobs');
}

mongoose.set('debug', config.get('mongoose_debug_logging'));


LogShipperJob.prototype = {
    saveJobs: function (jobs, callback) {
        if (!jobs.length) {
            logger.warn('LogShipperJob.saveJobs: nothing to do (no jobs)');
            // Not sure, what to return
            callback(null, true);
            return true;
        }

        // send upsert as bulk
        var bulk = this.model.collection.initializeOrderedBulkOp({
            w: 1
        });

        jobs.forEach(function (job) {
            var j = _.omit(job, ['logs', 'shared']);
            j.file_for_upload = job.shared.file_for_upload;
            j.jobs = job.shared.jobs;

            bulk.find({
                _id: job._id
            })
                .upsert()
                .updateOne(j);
        });

        bulk.execute(function (err, result) {
            logger.debug('LogShipperJob.saveJobs: result, modified ' +
                          result.nModified + ', upserted ' + result.nUpserted);

            callback(err, result);
        });
    },

    listLastProcessed: function (jobIds, callback) {
        this.model.aggregate([
                {
                    $match: {
                        status: {
                            $in: [
                                commons.SS_SHIPPED,
                                commons.SS_FILED,
                                commons.SS_COLLECTED
                            ]
                        },
                        job_id: {
                            $in: jobIds
                        }
                    }
                },
                {
                    $group: {
                        _id: '$job_id',
                        last_processed: {
                            $max: '$span.to'
                        }
                    }
                }
            ], function (err, jobs) {
                var results = utils.clone(jobs).map(function (r) {
                    delete r.__v;
                    return r;
                });
                callback(err, results);
            });
    },

    removeProcessing: function(callback) {
        this.model.remove({
                status: {
                    $in: [
                        commons.SS_FILED,
                        commons.SS_COLLECTED
                    ]
                }
            }, function (err, data) {
                callback(err, data.result);
            });
    },

    clean: function(callback) {
        var threshold = { $lte: ( Date.now() / 1000 - config.logs_max_age_hr * 3600/*sec*/ ) };
        this.model.remove({
            'span.to': threshold
        }, function (err, data) {
            callback(err, data.result);
        });
    }
};

exports.LogShipperJobs = new LogShipperJob(mongoose, LogShipperJobConnection);
