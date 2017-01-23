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
 *  Log Shipping Queue
 */

/*jslint node: true */
'use strict';

//  ----------------------------------------------------------------------------------------------//

var _ = require('lodash');
var config = require('config');
var logger = require('revsw-logger')(config.log);
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));

//  ---------------------------------
var stuff = require('./commons');

var LogShippingJobs = Promise.promisifyAll(require('../models/portal/LogShippingJob').LogShippingJobs);

var LogShipperJobs = Promise.promisifyAll(require('../models/logshipper/LogShipperJob').LogShipperJobs);
var DomainLogs = Promise.promisifyAll(require('../models/logshipper/DomainLog').DomainLogs);

var logshippers = require('./logshippers');
var rsyslog = require('./rsyslog');
var Domains = require('./domains');

/** *********************************
 *  the Queue class
 *
 *  @param {object} outer shared object to store domain {id:{name,status},id:{...}, ...} hashes
 */
var JobsQueue = function () {
  this.domains = new Domains();
  this.queue = [];
  this.status = stuff.QS_READY;
  //  _id: {data} hash, data(time spans) of last processed jobs
  this.lastProcessed = {};
  this.missed = 0;
};

/** *********************************
 *  clean upload directory and remove collected and filed jobs - possible remains after prior crash
 *
 *  @returns {Promise}
 */
JobsQueue.prototype.cleanBeforeStart = function () {
  // reset queue
  this.queue = [];
  var filesNum = 0;

  // read all files in upload dir
  return fs.readdirAsync(stuff.toUploadsPath(''))
    .then(function (files) {
      filesNum = files.length;
      // remove all these files
      return filesNum ? Promise.all(files.map(function (file) {
        return fs.unlinkAsync(stuff.toUploadsPath(file));
      })) : false;
    })
    .then(function () {
      // clean database (jobs collection)
      logger.info('JobsQueue.cleanBeforeStart, removed ' + filesNum + ' remaining files');
      return LogShipperJobs.removeProcessingAsync()
        .then(function (result) {
          logger.info('JobsQueue.cleanBeforeStart: ' + result.n + ' jobs removed');
          return true;
        });
    });
};

/** *********************************
 *  load jobs from the db and populate jobs queue
 *
 *  @returns {Promise}
 */
JobsQueue.prototype.loadNewJobs = function () {
  var newjobs = false,
    self = this;

  // load actual jobs from portal created by users
  return LogShippingJobs.listShippingJobsAsync()
    .then(function (jobs) {
      newjobs = jobs;
      logger.info('JobsQueue.loadNewJobs, ' + newjobs.length + ' shipping jobs loaded');

      //  collect distinct domain IDs
      var domainIds = {};
      for (var i = 0, len = newjobs.length; i < len; ++i) {
        if (newjobs[i].source_type === 'domain') {
          domainIds[newjobs[i].source_id] = true;
        }
      }

      // update queue domains with ids
      return self.domains.update(Object.keys(domainIds));
    })
    .then(function () {
      //  filter out paused jobs leaving only the active ones
      newjobs = newjobs.filter(function (job) {
        return job.operational_mode === 'active';
      });
      //  reload rsyslog system service
      return self.domains.changed ? rsyslog.reloadConfig(self.domains.listOfActive()) : Promise.resolve();
    })
    .then(function () {
      if (newjobs.length) {
        var now = Date.now(),
          idSuffix = '.' + now.toString(16),
          shareds = {}; //  jobs with the same source_id will share data

        // process jobs sync
        for (var i = 0, len = newjobs.length; i < len; ++i) {
          var job = newjobs[i];

          // get proper shipper for current job (S3, FTP, etc)
          var shipper = logshippers[job.destination_type];
          if (!shipper || !shipper.type) {
            logger.error('JobsQueue.loadNewJobs error, shipper for the destination type ' + job.destination_type + ' not found');
            continue;
          }
          job.shipper_type = shipper.type;
          job.started_at = now;
          job.job_id = job._id.toString();              //  <-- 5739a972d3399cea316682c5
          job._id = job.job_id + idSuffix;             //  <-- 5739a972d3399cea316682c5.154cf268f84
          job.status = stuff.SS_READY;
          job.attempts = config.queue_failed_retry_num;
          if (job.source_type === 'domain') {
            job.domain_name = self.domains.getName(job.source_id);
            job.domain_wildcard_alias = self.domains.getWildcardAlias(job.source_id);
            job.domain_aliases = self.domains.getAliases(job.source_id);
          }

          if (!shareds[job.source_id]) {
            shareds[job.source_id] = {
              jobs: [],
              file_for_upload: '',
              file_type_jobs_num: 0
            };
          }
          shareds[job.source_id].jobs.push(job._id);
          if (job.shipper_type === stuff.ST_FILE) {
            shareds[job.source_id].file_type_jobs_num++;
          }
          job.shared = shareds[job.source_id];          // <-- now this data shared between jobs with the same source_id

          self.queue.push(job);
        }

        logger.info('JobsQueue.loadNewJobs, queue now contains ' + self.queue.length + ' shipping jobs');
      }
    });
};

/** *********************************
 *  load last processed time for new jobs in the queue or each in the jobs array
 *
 *  @param {[jobs..]} array of jobs, optional
 *  @returns {Promise}
 */
JobsQueue.prototype.loadLastProcessedTime = function (jobs) {
  var self = this,
    jobIds = {};

  if (!jobs) {
    self.queue.forEach(function (job) {
      if (job.status === stuff.SS_READY && !self.lastProcessed[job.job_id]) {
        jobIds[job.job_id] = true;
        self.lastProcessed[job.job_id] = 0;
      }
    });
  } else {
    jobs.forEach(function (job) {
      self.lastProcessed[job.job_id] = 0;
      jobIds[job.job_id] = true;
    });
  }
  jobIds = Object.keys(jobIds);

  if (!jobIds.length) {
    return Promise.resolve(false);
  }

  return LogShipperJobs.listLastProcessedAsync(jobIds)
    .then(function (data) {
      data.forEach(function (job) {
        self.lastProcessed[job._id] = job.last_processed;
      });

      logger.info('JobsQueue.loadLastProcessedTime, ' + data.length + ' jobs last processed time updated');
      return true;
    });
};

/** *********************************
 *  load logs for every job with type === `domain`
 *
 *  @returns {Promise}
 */
JobsQueue.prototype.loadDomainLogs = function () {
  var self = this,
    safetyMargin = Math.floor(Date.now() / 1000/*sec*/) - config.logs_shipping_leeway_sec,

  // get domain jobs are available to process
    jobs = self.queue.filter(function (job) {
      job.span = {
        from: (self.lastProcessed[job.job_id] || 0),
        to: safetyMargin
      };
      return job.source_type === 'domain' && job.status === stuff.SS_READY;
    });

  if (!jobs.length) {
    logger.info('JobsQueue.loadDomainLogs, nothing to do');
    return Promise.resolve(false);
  }

  // load domain logs for jobs domain_names
  return DomainLogs.listByJobsAsync(jobs)
    .then(function (logs) {
      logger.info('DomainLogs.listByJobsAsync: ' + logs.length + ' log records downloaded');

      var hash = {};
      logs.forEach(function (record) {
        if (!hash[record.domain]) {
          hash[record.domain] = [];
        }
        hash[record.domain].push(record);
      });

      //  update jobs with log data
      jobs.forEach(function (job) {
        //  if there're more than 1 job for the domain - these logs will be "shared" between them
        //  i.e. all `logs` properties will refer one array
        if (hash[job.domain_name]) {
          job.logs = hash[job.domain_name];
          job.span = {from: job.logs[0].unixtime, to: job.logs[job.logs.length - 1].unixtime};
        } else {
          job.logs = [];
          job.span = {from: 0, to: 0};
        }

        if (job.domain_wildcard_alias || job.domain_aliases.length) {
          // Check for domain wildcard aliases and just aliases
          Object.keys(hash).forEach(function (domain) {
            if ((job.domain_wildcard_alias && domain.indexOf(job.domain_wildcard_alias.substring(1)) > -1) || job.domain_aliases.indexOf(domain) > -1) {
              if (job.logs.length) {
                hash[domain].forEach(function(l) {
                  job.logs.push(l);
                });
              } else {
                job.logs = hash[domain];
              }
            }
          });

          if (job.logs.length) {
            job.span = {from: job.logs[0].unixtime, to: job.logs[job.logs.length - 1].unixtime};
          }
        }

        job.logs_count = job.logs.length;
        job.status = stuff.SS_COLLECTED;
      });

      return jobs;
    })
    .then(function (jobs) {
      var actualQueueLength = self.queue.length;

      // Filter queue by jobs with logs present
      self.queue = self.queue.filter(function (job) {
        if (job.source_type !== 'domain' ||
          job.status !== stuff.SS_COLLECTED ||
          (job.logs && job.logs.length)) {
          return true;
        }
        return false;
      });

      if (self.queue.length < actualQueueLength) {
        logger.info('JobsQueue.loadDomainLogs, ' + (actualQueueLength - self.queue.length) +
          ' jobs with empty logs removed');
      }

      var collectedJobs = self.queue.filter(function (job) {
        if (job.status === stuff.SS_COLLECTED) {
          //  update last processed time
          self.lastProcessed[job.job_id] = job.span.to;
          return true;
        }
        return false;
      });

      // update collected jobs
      return LogShipperJobs.saveJobsAsync(collectedJobs)
        .then(function (result) {
          return true;
        });
    });
};

/** *********************************
 *  upload logs to file(s) for the jobs with shipping type === `ST_FILE`
 *
 *  @returns {Promise}
 */
JobsQueue.prototype.saveLogsForUpload = function () {
  var self = this,
    jobsToFile = this.queue.filter(function (job) {
      return job.shipper_type === stuff.ST_FILE;              //  allow jobs with file type of shipper
    }).map(function (job) {
      return logshippers[job.destination_type].save(job); //  store a Promise to array
    });

  if (!jobsToFile.length) {
    logger.info('JobsQueue.saveLogsForUpload, nothing to do');
    return Promise.resolve(false);
  }

  //  logshippers[].save() never throws, discards possible exception and marks job as faulty instead
  //  so Promise.all always finishing after all jobs done/failure
  return Promise.all(jobsToFile)
    .then(function (jobsToFile) {
      // when failed job has shared data with other jobs - all of them should be marked as failed
      var folks = {},
        found = false;

      jobsToFile.forEach(function (job) {
        if (job.status === stuff.SS_ERROR && job.shared.jobs.length > 1) {
          job.shared.jobs.forEach(function (id) {
            folks[id] = true;
            found = true;
          });
        }
      });
      if (found) {
        jobsToFile.forEach(function (job) {
          if (folks[job._id]) {
            job.status = stuff.SS_ERROR;
          }
        });
      }

      var filedJobs = jobsToFile.filter(function (job) {
        if (job.status === stuff.SS_FILED) {
          //  update last processed time
          self.lastProcessed[job.job_id] = job.span.to;
          //  no reason to keep logs in memory while they are on a disk
          job.logs = false;
          return true;
        }
        return false;
      });

      return LogShipperJobs.saveJobsAsync(filedJobs)
        .then(function (result) {
          return true;
        });
    });
};

/** *********************************
 *  dispatches prepared and loaded logs
 *
 *  @returns {Promise}
 */
JobsQueue.prototype.dispatchLogs = function () {
  var self = this,
    jobsToDispatch = self.queue.filter(function (job) {
      var shipper = logshippers[job.destination_type];
      return shipper &&
        shipper.dispatch &&
        //  allow filed jobs with file type
        ((job.shipper_type === stuff.ST_FILE && job.status === stuff.SS_FILED ) ||
        //  or collected jobs with stream type
        (job.shipper_type === stuff.ST_STREAM && job.status === stuff.SS_COLLECTED));
    }).map(function (job) {
      return logshippers[job.destination_type].dispatch(job);
    });

  if (!jobsToDispatch.length) {
    logger.info('JobsQueue.dispatchLogs, nothing to do');
    return Promise.resolve(false);
  }

  //  logshippers[...].dispatch() never throws, discards possible exception and marks job as faulty instead
  //  so Promise.all always finishing after all jobs done/failed
  return Promise.all(jobsToDispatch)
    .then(function (jobsToDispatch) {
      var shippedJobs = jobsToDispatch.filter(function (job) {
        if (job.status === stuff.SS_SHIPPED) {
          //  update last processed time
          self.lastProcessed[job.job_id] = job.span.to;
          //  no any reason to keep logs in memory
          job.logs = false;
          return true;
        }
        return false;
      });

      logger.info('JobsQueue.dispatchLogs, ' + shippedJobs.length + ' jobs shipped successfully');
      //  then save jobs to the db
      return LogShipperJobs.saveJobsAsync(shippedJobs)
        .then(function (result) {
          return true;
        });
    });
};

/** *********************************
 *  process(remove) shipped jobs
 *
 *  @returns {Promise}
 */
JobsQueue.prototype.processShippedJobs = function () {
  var self = this,
    shippedJobs = self.queue.filter(function (job) {
      return job.status === stuff.SS_SHIPPED;
    });
  logger.info('JobsQueue.processShippedJobs, processing ' + shippedJobs.length + ' shipped jobs');

  if (!shippedJobs.length) {
    return Promise.resolve(false);
  }

  // delete all dispatched log files
  var files = shippedJobs.filter(function (job) {
    return job.shared.file_for_upload && --job.shared.file_type_jobs_num === 0; // it was last
  })
    .map(function (job) {
      return fs.unlinkAsync(stuff.toUploadsPath(job.shared.file_for_upload));
    });

  return Promise.all(files)
    .then(function () {
      //  filter out done jobs
      self.queue = self.queue.filter(function (job) {
        return job.status !== stuff.SS_SHIPPED;
      });
    });
};

/** *********************************
 *  process failed jobs, abort those have zeroed attempt counter, delay others
 *  i.e. after completion the queue may contain jobs for the next attempt
 *
 *  @returns {Promise}
 */
JobsQueue.prototype.processFailedJobs = function () {
  var self = this,
    failedJobs = self.queue.filter(function (job) {
      return job.status === stuff.SS_ERROR;
    });

  if (!failedJobs.length) {
    logger.info('JobsQueue.processFailedJobs, nothing to do');
    return Promise.resolve(false);
  }
  logger.info('JobsQueue.processFailedJobs, processing ' + failedJobs.length + ' failed jobs');

  //  collect ids of dead jobs(expended attempts count)
  var deadJobIds = {};
  failedJobs.forEach(function (job) {
    if (--job.attempts === 0) {
      deadJobIds[job.job_id] = true;
    }
  });
  //  collect all jobs with the same dead _id
  failedJobs = self.queue.filter(function (job) {
    if (deadJobIds[job.job_id]) {
      job.status = stuff.SS_ERROR;
      return true;
    }
    if (job.status === stuff.SS_ERROR) {
      job.status = job.shipper_type === stuff.ST_FILE ? stuff.SS_FILED : stuff.SS_COLLECTED;
    }
    return false;
  });

  logger.info('JobsQueue.processFailedJobs, processing ' + failedJobs.length + ' aborted jobs');
  if (!failedJobs.length) {
    return Promise.resolve(false);
  }

  //  filter the deads out of the queue
  self.queue = self.queue.filter(function (job) {
    return job.status !== stuff.SS_ERROR;
  });

  //  bury deads
  return LogShipperJobs.saveJobsAsync(failedJobs)
    .then(function () {
      //  reload last processed times
      return self.loadLastProcessedTime(failedJobs);
    })
    .then(function () {
      //  remove stored files if any
      var files = failedJobs.filter(function (job) {
        return job.shared.file_for_upload && --job.shared.file_type_jobs_num === 0; // it was last
      })
        .map(function (job) {
          return fs.unlinkAsync(stuff.toUploadsPath(job.shared.file_for_upload));
        });

      return files.length ? Promise.all(files) : Promise.resolve();
    })
    .then(function () {
      //  then pause jobs
      var jobIds = _.uniq(failedJobs.map(function (job) {
        return job.job_id;
      }));
      return LogShippingJobs.pauseJobsAsync(jobIds)
        .then(function (data) {
          logger.info('processFailedJobs.pauseJobs paused ' + data.n + ' jobs');
        });
    });
};

/** *********************************
 *  wrapper around all above methods
 *
 *  @returns {Promise}
 */
JobsQueue.prototype.run = function (freshStart) {
  var self = this;

  // if queue status is running skip run
  if (self.status === stuff.QS_RUNNING) {
    ++self.missed;
    logger.warn('JobsQueue.run, the queue is busy');
    return Promise.resolve(false);
  }

  // set queue status as running
  self.status = stuff.QS_RUNNING;
  return Promise.resolve()
    .then(function () {
      // if running as fresh start, should clean
      if (freshStart) {
        logger.info('JobsQueue.run fresh started');
        // clean uploads and db
        return self.cleanBeforeStart()
          .then(function () {
            // load new jobs
            return self.loadNewJobs();
          });
      } else {
        logger.info('JobsQueue.run started, the queue contains ' + self.queue.length + ' jobs');
        return self.loadNewJobs();
      }
    })
    .then(function () {
      // filter jobs by availability to run now
      return self.loadLastProcessedTime();
    })
    .then(function () {
      // load domain logs for all jobs and for shared as well
      return self.loadDomainLogs();
    })
    .then(function () {
      // save log files
      return self.saveLogsForUpload();
    })
    .then(function () {
      // dispatch logs for jobs with logs uploaded
      return self.dispatchLogs();
    })
    .then(function () {
      return self.processShippedJobs();
    })
    .then(function () {
      return self.processFailedJobs();
    })
    .then(function () {
      logger.info('JobsQueue.run finished, the queue contains ' + self.queue.length + ' delayed jobs');

      if (self.missed) {
        --self.missed;
        self.status = stuff.QS_READY;
        return self.run();
      }
      self.status = stuff.QS_READY;
      return true;
    })
    .catch(function (err) {
      logger.error('JobsQueue.run error: ' + err.toString());
      logger.error(err.stack);
      self.status = stuff.QS_ERROR;
      throw err;
    });
};

/** *********************************
 *  clean domain/app logs and outdated logshipper jobs
 *
 *  @returns {Promise}
 */
JobsQueue.prototype.cleanLogs = function () {
  return DomainLogs.cleanAsync()
    .then(function (result) {
      logger.info('JobsQueue.cleanLogs ' + result.n + ' DomainsLog records deleted');
      return LogShipperJobs.cleanAsync();
    })
    .then(function (result) {
      logger.info('JobsQueue.cleanLogs ' + result.n + ' LogShipperJobs deleted');
    });
};

/** *********************************
 *  run db cleaning service
 */
JobsQueue.prototype.clean = function () {
  logger.info('JobsQueue.clean started');
  this.cleanLogs()
    .then(function () {
      logger.info('JobsQueue.clean finished');
    })
    .catch(function (err) {
      logger.error('JobsQueue.clean error: ' + err.toString());
    });
};

module.exports = JobsQueue;