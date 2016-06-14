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

var _ = require( 'lodash' );
var config = require( 'config' );
var logger = require( 'revsw-logger' )( config.log );
var promise = require( 'bluebird' );
var fs = promise.promisifyAll( require( 'fs' ) );

//  ---------------------------------
var stuff = require( './commons' );

var logshipperDB = require( './logshipperDB' );
var revportalDB = require( './revportalDB' );
var logshippers = require( './logshippers' );
var rsyslog = require( './rsyslog' );

var Domains = require( './domains' );

/** *********************************
 *  the Queue class
 *
 *  @param {object} outer shared object to store domain {id:{name,status},id:{...}, ...} hashes
 */
var JobsQueue = function() {

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
 *  @returns {promise}
 */
JobsQueue.prototype.cleanBeforeStart = function() {

  this.queue = [];
  var files_num = 0;
  return fs.readdirAsync( stuff.toUploadsPath( '' ) )
    .then( function( files ) {
      files_num = files.length;
      return files_num ? promise.all( files.map( function( file ) {
        return fs.unlinkAsync( stuff.toUploadsPath( file ) );
      }) ) : false;
    })
    .then( function() {
      logger.info( 'JobsQueue.cleanBeforeStart, removed ' + files_num + ' remaining files.' );
      return logshipperDB.cleanOrphans();
    });
};

/** *********************************
 *  load jobs from the db and populate jobs queue
 *
 *  @returns {promise}
 */
JobsQueue.prototype.loadNewJobs = function() {

  var newjobs = false,
    self = this;
  return revportalDB.loadShippingJobsList()
    .then( function( jobs ) {

      newjobs = jobs;
      logger.info( 'JobsQueue.loadNewJobs, ' + newjobs.length + ' shipping jobs loaded.' );

      //  collect distinct domain IDs
      var ids = {};
      for ( var i = 0, len = newjobs.length; i < len; ++i ) {
        if ( newjobs[i].source_type === 'domain' ) {
          ids[newjobs[i].source_id] = true;
        }
      }

      return self.domains.update( Object.keys( ids ) );
    } )
    .then( function() {

      //  filter out paused jobs leaving only the active ones
      newjobs = newjobs.filter( function( job ) {
        return job.operational_mode === 'active';
      });
      //  reload rsyslog system service
      return self.domains.changed ? rsyslog.reloadConfig( self.domains.listOfActive() ) : promise.resolve();
    })
    .then( function() {

      if ( newjobs.length ) {

        var id_suffix = '.' + Date.now().toString( 16 ),
          shareds = {}; //  jobs with the same source_id will share data

        for ( var i = 0, len = newjobs.length; i < len; ++i ) {
          var job = newjobs[i];

          job.job_id = job._id.toString();              //  <-- 5739a972d3399cea316682c5
          job._id = job.job_id + id_suffix;             //  <-- 5739a972d3399cea316682c5.154cf268f84
          job.status = stuff.SS_READY;
          job.attempts = config.failed_retry_num;
          if ( job.source_type === 'domain' ) {
            job.domain_name = self.domains.getName( job.source_id );
          }
          var shipper = logshippers[ job.destination_type ];
          job.shipper_type = ( shipper && shipper.type ) || stuff.ST_UNKNOWN;

          if ( !shareds[job.source_id] ) {
            shareds[job.source_id] = {
              jobs: [],
              file_for_upload: '',
              file_type_jobs_num: 0
            };
          }
          shareds[job.source_id].jobs.push( job._id );
          if ( job.shipper_type === stuff.ST_FILE ) {
            shareds[job.source_id].file_type_jobs_num++;
          }
          job.shared = shareds[job.source_id];          // <-- now this data shared between jobs with the same source_id

          self.queue.push( job );
        }

        logger.info( 'JobsQueue.loadNewJobs, queue now contains ' + self.queue.length + ' shipping jobs.' );
      }
    } );
};

/** *********************************
 *  load last processed time for new jobs in the queue or each in the jobs array
 *
 *  @param {[jobs..]} array of jobs, optional
 *  @returns {promise}
 */
JobsQueue.prototype.loadLastProcessedTime = function( jobs ) {

  var self = this,
    _ids = {};

  if ( !jobs ) {
    self.queue.forEach( function( job ) {
      if ( job.status === stuff.SS_READY && !self.lastProcessed[job.job_id] ) {
        _ids[job.job_id] = true;
        self.lastProcessed[job.job_id] = 0;
      }
    });
  } else {
    jobs.forEach( function( job ) {
      self.lastProcessed[job.job_id] = 0;
      _ids[job.job_id] = true;
    });
  }
  _ids = Object.keys( _ids );

  if ( !_ids.length ) {
    return promise.resolve( false );
  }

  return logshipperDB.loadLastProcessedJobs( _ids )
    .then( function( data/*[{_id,last_processed},{}..]*/ ) {
      data.forEach( function( j ) {
        self.lastProcessed[j._id] = j.last_processed;
      });

      logger.info( 'JobsQueue.loadLastProcessedTime, ' + data.length + ' jobs last processed time updated.' );
      return true;
    });
};

/** *********************************
 *  load logs for every job with type === `domain`
 *
 *  @returns {promise}
 */
JobsQueue.prototype.loadDomainLogs = function() {

  var self = this,
    safety_margin = Math.floor( Date.now() / 1000/*sec*/ ) - config.logs_shipping_leeway_sec,
    jobs = self.queue.filter( function( job ) {
      job.span = {
        from: ( self.lastProcessed[job.job_id] || 0 ),
        to: safety_margin
      };
      return job.source_type === 'domain' && job.status === stuff.SS_READY;
    });

  if ( !jobs.length ) {
    logger.info( 'JobsQueue.loadDomainLogs, nothing to do.' );
    return promise.resolve( false );
  }

  return logshipperDB.collectAllDomainLogs( jobs )
    .then( function() {
      var ql = self.queue.length;
      self.queue = self.queue.filter( function( job ) {
        if ( job.source_type !== 'domain' ||
             job.status !== stuff.SS_COLLECTED ||
             ( job.logs && job.logs.length ) ) {
          return true;
        }
        return false;
      });

      if ( self.queue.length < ql ) {
        logger.info( 'JobsQueue.loadDomainLogs, ' + ( ql - self.queue.length ) + ' jobs with empty logs removed.' );
      }

      var jobs = self.queue.filter( function( job ) {
        if ( job.status === stuff.SS_COLLECTED ) {
          //  update last processed time
          self.lastProcessed[job.job_id] = job.span.to;
          return true;
        }
        return false;
      });

      return logshipperDB.saveJobs( jobs );
    });
};

/** *********************************
 *  upload logs to file(s) for the jobs with shipping type === `ST_FILE`
 *
 *  @returns {promise}
 */
JobsQueue.prototype.saveLogsForUpload = function() {

  var self = this,
    jobs = this.queue.filter( function( job ) {
      return job.shipper_type === stuff.ST_FILE;              //  allow jobs with file type of shipper
    } ).map( function( job ) {
      return logshippers[ job.destination_type ].save( job ); //  store a promise to array
    } );

  if ( !jobs.length ) {
    logger.info( 'JobsQueue.saveLogsForUpload, nothing to do.' );
    return promise.resolve( false );
  }

  //  logshippers[].save() never throws, discards possible exception and marks job as faulty instead
  //  so promise.all always finishing after all jobs done/failure
  return promise.all( jobs )
    .then( function( jobs ) {

      // failed job has shared data with other jobs - all of them should be marked as failed
      var folks = {},
        found = false;
      jobs.forEach( function( job ) {
        if ( job.status === stuff.SS_ERROR && job.shared.jobs.length > 1 ) {
          job.shared.jobs.forEach( function( id ) {
            folks[id] = true;
            found = true;
          });
        }
      });
      if ( found ) {
        jobs.forEach( function( job ) {
          if ( folks[job._id] ) {
            job.status = stuff.SS_ERROR;
          }
        });
      }

      var filed_jobs = jobs.filter( function( job ) {
        if ( job.status === stuff.SS_FILED ) {
          //  update last processed time
          self.lastProcessed[job.job_id] = job.span.to;
          //  no reason to keep logs in memory while they are on a disk
          job.logs = false;
          return true;
        }
        return false;
      });

      return logshipperDB.saveJobs( filed_jobs );
    } );
};

/** *********************************
 *  dispatches prepared logs
 *
 *  @returns {promise}
 */
JobsQueue.prototype.dispatchLogs = function() {

  var self = this,
    jobs = self.queue.filter( function( job ) {
      var shipper = logshippers[ job.destination_type ];
      return shipper &&
        shipper.dispatch &&
          //  allow filed jobs with file type
        ( ( job.shipper_type === stuff.ST_FILE && job.status === stuff.SS_FILED ) ||
          //  or collected jobs with stream type
          ( job.shipper_type === stuff.ST_STREAM && job.status === stuff.SS_COLLECTED ) );
    } ).map( function( job ) {
      return logshippers[ job.destination_type ].dispatch( job );
    } );

  if ( !jobs.length ) {
    logger.info( 'JobsQueue.dispatchLogs, nothing to do.' );
    return promise.resolve( false );
  }

  //  logshippers[...].dispatch() never throws, discards possible exception and marks job as faulty instead
  //  so promise.all always finishing after all jobs done/failed
  return promise.all( jobs )
    .then( function( jobs ) {
      var shipped_jobs = jobs.filter( function( job ) {
        if ( job.status === stuff.SS_SHIPPED ) {
          //  update last processed time
          self.lastProcessed[job.job_id] = job.span.to;
          //  no any reason to keep logs in memory
          job.logs = false;
          return true;
        }
        return false;
      } );

      logger.info( 'JobsQueue.dispatchLogs, ' + shipped_jobs.length + ' jobs shipped successfully.' );
      //  then save jobs to the db
      return logshipperDB.saveJobs( shipped_jobs );
    } );
};

/** *********************************
 *  process(remove) shipped jobs
 *
 *  @returns {promise}
 */
JobsQueue.prototype.processShippedJobs = function() {

  var self = this,
    jobs = self.queue.filter( function( job ) {
      return job.status === stuff.SS_SHIPPED;
    } );
  logger.info( 'JobsQueue.processShippedJobs, processing ' + jobs.length + ' shipped jobs.' );

  if ( !jobs.length ) {
    return promise.resolve( false );
  }

  var files = jobs.filter( function( job ) {
    return job.shared.file_for_upload && --job.shared.file_type_jobs_num === 0; // it was last
  })
  .map( function( job ) {
    return fs.unlinkAsync( stuff.toUploadsPath( job.shared.file_for_upload ) );
  });

  return promise.all( files )
    .then( function() {
      //  filter out done jobs
      self.queue = self.queue.filter( function( job ) {
        return job.status !== stuff.SS_SHIPPED;
      });
    });
};

/** *********************************
 *  process failed jobs, abort those have zeroed attempt counter, delay others
 *  i.e. after completion the queue may contain jobs for the next attempt
 *
 *  @returns {promise}
 */
JobsQueue.prototype.processFailedJobs = function() {

  var self = this,
    jobs = self.queue.filter( function( job ) {
      return job.status === stuff.SS_ERROR;
    } );

  if ( !jobs.length ) {
    logger.info( 'JobsQueue.processFailedJobs, nothing to do.' );
    return promise.resolve( false );
  }
  logger.info( 'JobsQueue.processFailedJobs, processing ' + jobs.length + ' failed jobs.' );

  //  collect ids of dead jobs(expended attempts count)
  var dead_ids = {};
  jobs.forEach( function( job ) {
    if ( --job.attempts === 0 ) {
      dead_ids[job.job_id] = true;
    }
  });
  //  collect all jobs with the same dead _id
  jobs = self.queue.filter( function( job ) {
    if ( dead_ids[job.job_id] ) {
      job.status = stuff.SS_ERROR;
      return true;
    }
    if ( job.status === stuff.SS_ERROR ) {
      job.status = job.shipper_type === stuff.ST_FILE ? stuff.SS_FILED : stuff.SS_COLLECTED;
    }
    return false;
  });

  logger.info( 'JobsQueue.processFailedJobs, processing ' + jobs.length + ' aborted jobs.' );
  if ( !jobs.length ) {
    return promise.resolve( false );
  }

  //  filter the deads out of the queue
  self.queue = self.queue.filter( function( job ) {
    return job.status !== stuff.SS_ERROR;
  });

  //  bury deads
  return logshipperDB.saveJobs( jobs )
    .then( function() {
      //  reload last processed times
      return self.loadLastProcessedTime( jobs );
    })
    .then( function() {

      //  remove stored files if any
      var files = jobs.filter( function( job ) {
        return job.shared.file_for_upload && --job.shared.file_type_jobs_num === 0; // it was last
      })
      .map( function( job ) {
        return fs.unlinkAsync( stuff.toUploadsPath( job.shared.file_for_upload ) );
      });

      return files.length ? promise.all( files ) : promise.resolve();
    })
    .then( function() {
      //  then pause jobs
      return revportalDB.pauseShippingJobs( jobs );
    });
};

/** *********************************
 *  wrapper around all above methods
 *
 *  @returns {promise}
 */
JobsQueue.prototype.run = function( fresh_start ) {

  var self = this;

  if ( self.status === stuff.QS_RUNNING ) {
    ++self.missed;
    return promise.resolve( false );
  }

  self.status = stuff.QS_RUNNING;
  return promise.resolve()
    .then( function() {
      if ( fresh_start ) {
        logger.info( 'JobsQueue.run fresh started.' );
        return self.cleanBeforeStart()
          .then( function() {
            return self.loadNewJobs();
          });
      } else {
        logger.info( 'JobsQueue.run started, the queue contains ' + self.queue.length + ' jobs.' );
        return self.loadNewJobs();
      }
    })
    .then( function() {
      return self.loadLastProcessedTime();
    })
    .then( function() {
      return self.loadDomainLogs();
    })
    .then( function() {
      return self.saveLogsForUpload();
    })
    .then( function() {
      return self.dispatchLogs();
    })
    .then( function() {
      return self.processShippedJobs();
    })
    .then( function() {
      return self.processFailedJobs();
    })
    .then( function() {
      logger.info( 'JobsQueue.run finished, the queue contains ' + self.queue.length + ' delayed jobs.' );

      // debug
      logger.debug( self.queue );
      // debug

      if ( self.missed ) {
        --self.missed;
        return self.run();
      }
      self.status = stuff.QS_READY;
      return true;
    })
    .catch( function( err ) {
      logger.error( 'JobsQueue.run error: ' + err.toString() );
      logger.error( err.stack );
      self.status = stuff.QS_ERROR;
      throw err;
    });
};

/** *********************************
 *  run db cleaning service
 */
JobsQueue.prototype.clean = function() {

  logger.info( 'JobsQueue.clean started.' );
  logshipperDB.cleanLogs()
    .then( function() {
      logger.info( 'JobsQueue.clean finished' );
    })
    .catch( function( err ) {
      logger.error( 'JobsQueue.clean error: ' + err.toString() );
    });
};


//  ----------------------------------------------------------------------------------------------//
module.exports = JobsQueue;