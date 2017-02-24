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

/**
 *  collection of Log Shipping Transports
 */

/*jslint node: true */
'use strict';

//  ----------------------------------------------------------------------------------------------//

var _ = require('lodash');
var config = require('config');
var logger = require('revsw-logger')(config.log);
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var zip = require('adm-zip');
var path = require('path');
var ftps = require('ftps');
var mail = require('./mail');
var utils = require('./utilities');
var os = require('os');
var elastic = require('elasticsearch');

var notifyEmail = config.get('notify_admin_by_email_on_logshipper_job_failures');
var fromEmail = config.get('support_email');

//  ---------------------------------
var stuff = require('./commons');

/**
 *  Notify revAdmin about logshipper job failure
 *
 *  @param {String} subject
 *  @param {Object} error
 *  @param {Object} job
 */
function notifyAdminOnJobFailure(subject, error, job) {
  if (notifyEmail !== '') {
    var jobClone = utils.clone(job);
    delete jobClone.logs;

    mail.sendMail({
      from: fromEmail,
      to: notifyEmail,
      subject: process.env.NODE_ENV + ':' + os.hostname() + ' ' + subject,
      text: error.stack + '\n Job: ' + JSON.stringify(jobClone)
    }, function (err, data) {
      if (err) {
        console.error(err);
      }
    });
  }
}

/** *********************************
 *  save collected logs to file for further upload
 *  it catches exceptions and doesn't throw but mark the job as faulty
 *
 *  @param {object} job
 *  @returns {Promise(job)}
 */
var saveForUpload_ = function (job) {

  if (!job.logs || !job.logs.length) {
    return Promise.resolve(job);
  }

  if (job.shared.file_for_upload /*semaphore, below*/) {
    job.status = stuff.SS_FILED;
    return Promise.resolve(job);
  }

  //  mark it on a case if the logs object shared between several jobs
  job.shared.file_for_upload = true;

  return Promise.resolve(job)
    .then(function (job) {

      //  convert every record to json string + lf
      var data = job.logs.reduce(function (prev, curr) {
        return prev + JSON.stringify(curr) + '\n';
      }, '');
      
      var escapedDomainName = job.domain_name.replace(/[^a-z0-9]/gi, '_').toLowerCase();

      var zipper = new zip(),
        filename = job._id + '.' + escapedDomainName + '.log.zip';

      zipper.addFile(job._id + '.' + escapedDomainName + '.log', new Buffer(data), '');
      job.shared.file_for_upload = filename;
      return fs.writeFileAsync(stuff.toUploadsPath(filename), zipper.toBuffer());
    })
    .then(function () {
      job.status = stuff.SS_FILED;
      return job;
    })
    .catch(function (err) {
      //  it gulps exception and return job marked as failed
      job.status = stuff.SS_ERROR;
      job.error = 'LogShippers.save job id ' + job._id + ', error ' + err.toString();
      logger.error(job.error);

      notifyAdminOnJobFailure(
        'failed to save logs for upload for job',
        err,
        job
      );

      return job;
    });
};

/** *********************************
 *  trying once to send file via ftp
 *
 *  @param {object} control structure
 *  @param {object} job
 *  @returns {Promise(job)}
 */
var ftpFireOnce_ = function (control, job) {
  return control.ftp
    .put(stuff.toUploadsPath(job.shared.file_for_upload))
    .exec()
    .then(function (res) {
      if (res.error) {
        throw new Error(res.error);
      }
      //  job is done
      control.count = 0;
    })
    .catch(function (err) {
      logger.warn('LogShippers::ftpFireOnce_ job id ' + job._id + ', error ' + err.toString());
      if (--control.count) {
        //  fucked up but still in business, delay then fire again
        var delay = job.destination_type === 'sftp' ? config.sftp_failed_delay : config.ftp_failed_delay;
        return Promise.delay(delay);
      }
      //  now fucked up totally
      throw err;
    })
    .then(function () {
      //  we can get here from the above "then" or the above "catch"
      if (control.count) {
        //  not yet done, again
        return ftpFireOnce_(control, job);
      }
    });
};

/** *********************************
 *  sends file via ftp
 *  it catches exceptions and doesn't throw but mark the job as faulty
 *
 *  @param {object} job
 *  @returns {Promise(job)}
 */
var ftpFire_ = function (job) {

  return Promise.resolve()
    .then(function () {
      var control = {
        ftp: ( new ftps({
          protocol: 'ftp',
          host: job.destination_host,
          username: job.destination_username,
          password: job.destination_password,
          port: ( job.destination_port || 21 ),
          requiresPassword: ( job.destination_password !== '' ),
          retries: 1,
          timeout: 5
        }) ),
        count: config.ftp_failed_retry_num
      };
      control.ftp.exec = Promise.promisify(control.ftp.exec);
      return ftpFireOnce_(control, job);
    })
    .then(function () {
      job.status = stuff.SS_SHIPPED;
      logger.info('LogShippers::ftpFire_, job id ' + job._id + ', done.');
      return job;
    })
    .catch(function (err) {
      //  it gulps exception and return job marked as failed
      job.error = 'LogShippers::ftpFire_, job id ' + job._id + ', error ' + err.toString();
      job.status = stuff.SS_ERROR;
      logger.error(job.error);

      notifyAdminOnJobFailure(
        'failed to dispatch logs for job (ftp)',
        err,
        job
      );

      return job;
    });
};

/** *********************************
 *  very same as ftpFire_, but using SFTP protocol
 *
 *  @param {object} job
 *  @returns {Promise(job)}
 */
var sftpFire_ = function (job) {
  return Promise.resolve()
    .then(function () {
      var control = {
        ftp: ( new ftps({
          protocol: 'sftp',
          host: job.destination_host,
          username: job.destination_username,
          password: job.destination_password,
          port: ( job.destination_port || 22 ),
          requiresPassword: ( job.destination_password !== '' ),
          retries: 1,
          timeout: 5
        }) ),
        count: config.sftp_failed_retry_num
      };
      control.ftp.exec = Promise.promisify(control.ftp.exec);
      return ftpFireOnce_(control, job);
    })
    .then(function () {
      job.status = stuff.SS_SHIPPED;
      logger.info('LogShippers::sftpFire_, job id ' + job._id + ', done.');
      return job;
    })
    .catch(function (err) {
      //  it gulps exception and return job marked as failed
      job.error = 'LogShippers::sftpFire_, job id ' + job._id + ', error ' + err.toString();
      job.status = stuff.SS_ERROR;
      logger.error(job.error);

      notifyAdminOnJobFailure(
        'failed to dispatch logs for job (sftp)',
        err,
        job
      );
      
      return job;
    });
};

/** *********************************
 *  sends file to AWS S3 storage
 *  it catches exceptions and doesn't throw but mark the job as faulty
 *  mapped
 *    S3 Bucket:              job.destination_host
 *    S3 Access Key Id:       job.destination_key
 *    S3 Secret Access Key:   job.destination_password
 *
 *  @param {object} job
 *  @returns {Promise(job)}
 */
var S3Fire_ = function (job, retries) {

  var aws = require('aws-sdk');
  aws.config.update({
    accessKeyId: job.destination_key,
    secretAccessKey: job.destination_password
  });

  var s3 = new aws.S3({params: {Bucket: job.destination_host}});
  var body = fs.readFileSync(stuff.toUploadsPath(job.shared.file_for_upload));

  if (!retries) {
    retries = config.s3_failed_retry_num;
  }

  return new Promise(function (resolve, reject) {
    s3.upload({Key: job.shared.file_for_upload, Body: body})
      .send(function (err, data) {
        if (err) {
          return reject(err);
        }
        return resolve(data);
      });
    })
    .then(function (data) {
      job.status = stuff.SS_SHIPPED;
      logger.info('LogShippers::S3Fire_, job id ' + job._id + ', done.');
      retries = 0;
      return job;
    })
    .catch(function (err) {
      //  it gulps exception and return job marked as failed
      job.error = 'LogShippers::S3Fire_, job id ' + job._id + ', error ' + err.toString();
      job.status = stuff.SS_ERROR;
      logger.error(job.error);

      if (retries === 0) {
        notifyAdminOnJobFailure(
          'failed to dispatch logs for job (s3)',
          err,
          job
        );
        return job;

      } else {
        retries--;
        return Promise.delay(config.sftp_failed_delay);
      }
    })
    .then(function () {
      if (retries > 0) {
        return S3Fire_(job, retries);
      } else {
        return job;
      }
    });
};


/** *********************************
 *  trying once to send array of logs to ES cluster
 *
 *  @param {object} control structure
 *  @param {object} job
 *  @returns {Promise(job)}
 */
var esFireOnce_ = function (control, job) {

  return control.es.bulk(control.request)
    .then(function (data) {
      // TODO: check if there is errors in data? (400 or any other)
      // { create:
      // { _index: '*',
      //     _type: '*',
      //     _id: '*',
      //     _version: 1,
      //     status: 400,
      //     error: 'error there' } }
      control.count = 0;
    })
    .catch(function (err) {
      //  shit happened
      logger.warn('LogShippers::esFireOnce_ job id ' + job._id + ', error ' + err.toString());
      if (--control.count) {
        //  fucked up but still in business, delay then fire again
        return Promise.delay(config.es_failed_delay);
      }

      //  now fucked up totally
      throw err;
    })
    .then(function () {
      //  we can get here from the above "then" or the above "catch"
      if (control.count) {
        //  not yet done, again
        return esFireOnce_(control, job);
      }
    });
};

/** *********************************
 *  send array of logs to ES cluster
 *  it catches exceptions and doesn't throw but mark the job as faulty
 *
 *  @param {object} job
 *  @returns {Promise(job)}
 */
var esFire_ = function (job) {

  return Promise.resolve()
    .then(function () {
      job.destination_key = job.destination_key === '' ? 'logs' : job.destination_key;

      var queue = [];
      for (var i = 0, len = job.logs.length; i < len; ++i) {
        queue.push({index: {_index: job.destination_key}});
        delete job.logs[i]._id;
        queue.push(job.logs[i]);
      }

      var control = {
        es: ( new elastic.Client({
          host: job.destination_host + ':' + job.destination_port,
          requestTimeout: 120000,
          log: false
        }) ),
        count: config.es_failed_retry_num,
        request: {
          type: 'logshipper',   //  TODO: it should be parameter from the job
          refresh: true,
          body: queue
        }
      };

      return esFireOnce_(control, job);
    })
    .then(function () {
      job.status = stuff.SS_SHIPPED;
      logger.info('LogShippers::esFire_, job id ' + job._id + ', done.');
      return job;
    })
    .catch(function (err) {
      //  it gulps exception and return job marked as failed
      job.error = 'LogShippers::esFire_, job id ' + job._id + ', error ' + err.toString();
      job.status = stuff.SS_ERROR;
      logger.error(job.error);

      notifyAdminOnJobFailure(
        'failed to dispatch logs for job (es)',
        err,
        job
      );

      return job;
    });
};


//  ----------------------------------------------------------------------------------------------//

var LogShippers = module.exports = {

  ftp: {
    type: stuff.ST_FILE,
    save: saveForUpload_,
    dispatch: ftpFire_
  },

  sftp: {
    type: stuff.ST_FILE,
    save: saveForUpload_,
    dispatch: sftpFire_
  },

  s3: {
    type: stuff.ST_FILE,
    save: saveForUpload_,
    dispatch: S3Fire_
  },

  elasticsearch: {
    type: stuff.ST_STREAM,
    save: false,
    dispatch: esFire_
  }

};
