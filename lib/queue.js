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


/** *********************************
 *  the Queue class
 *
 *  @param {object} outer shared object to store domain {id:{name,status},id:{...}, ...} hashes
 */
var JobsQueue = function( domains ) {

  this.domains = domains;
  this.queue = [];
  this.id = Date.now().toString( 16 );
  this.status = stuff.QS_READY;
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
      logger.info( 'JobsQueue[' + self.id + '].loadNewJobs, ' + newjobs.length + ' shipping jobs loaded.' );

      var ids = [];
      for ( var i = 0, len = newjobs.length; i < len; ++i ) {
        if ( newjobs[i].source_type === 'domain' ) {
          ids.push( newjobs[i].source_id );
        }
      }

      return self.domains.update( ids );
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
        newjobs.forEach( function( job ) {
          job._id = job._id.toString() + '.' + self.id; //  <-- 5739a972d3399cea316682c5.154cf268f84
          job.status = stuff.SS_READY;
          job.attempts = config.failed_retry_num;
          if ( job.source_type === 'domain' ) {
            job.domain_name = self.domains.getName( job.source_id );
          }
          self.queue.push( job );
        } );
        logger.info( 'JobsQueue[' + self.id + '].loadNewJobs, queue now contains ' + self.queue.length + ' shipping jobs.' );
      }
    } );
};

/** *********************************
 *  load logs for every job with type === `domain`
 *
 *  @returns {promise}
 */
JobsQueue.prototype.loadDomainLogs = function() {

  var self = this,
    jobs = self.queue.filter( function( job ) {
      return job.source_type === 'domain' && job.status === stuff.SS_READY;
    });

  if ( !jobs.length ) {
    logger.info( 'JobsQueue[' + self.id + '].loadDomainLogs, nothing to do.' );
    return promise.resolve( false );
  }

  return logshipperDB.collectAllDomainLogs( jobs )
    .then( function() {
      var ql = self.queue.length;
      self.queue = self.queue.filter( function( job ) {
        return job.source_type !== 'domain' ||
          job.status !== stuff.SS_COLLECTED ||
          ( job.logs.records && job.logs.records.length );
      });
      if ( self.queue.length < ql ) {
        logger.info( 'JobsQueue[' + self.id + '].loadDomainLogs, ' + ( ql - self.queue.length ) + ' jobs with empty logs removed.' );
      }
      return true;
    });
};

/** *********************************
 *  upload logs to file(s) for the jobs with shipping type === `ST_FILE`
 *
 *  @returns {promise}
 */
JobsQueue.prototype.saveLogsForUpload = function() {

  var jobs = this.queue.filter( function( job ) {
    var shipper = logshippers[ job.destination_type ];
    return shipper && shipper.type === stuff.ST_FILE &&     //  allow jobs with file type of shipper
      job.logs.records && job.logs.records.length;          //  non-empty log array
  } ).map( function( job ) {
    return logshippers[ job.destination_type ].save( job ); //  store a promise to array
  } );

  if ( !jobs.length ) {
    logger.info( 'JobsQueue[' + this.id + '].saveLogsForUpload, nothing to do.' );
    return promise.resolve( false );
  }

  //  logshippers[].save() never throws, discards possible exception and marks job as faulty instead
  //  so promise.all always finishing after all jobs done/failure
  return promise.all( jobs )
    .then( function( jobs ) {
      jobs.forEach( function( job ) {
        if ( job.status === stuff.SS_FILED ) {
          job.file_for_upload = job.logs.file_for_upload;
          //  no more reason to keep them in memory
          job.logs = false;
        }
      } );
      return true;
    } );
};

/** *********************************
 *  dispatches prepared logs
 *
 *  @returns {promise}
 */
JobsQueue.prototype.dispatchLogs = function() {

  var jobs = this.queue.filter( function( job ) {
    var shipper = logshippers[ job.destination_type ];
    return shipper &&
      shipper.dispatch &&
        //  allow filed jobs with file type of shipper (empty logs not filed)
      ( ( shipper.type === stuff.ST_FILE && job.status === stuff.SS_FILED ) ||
        //  or collected jobs with stream type of shipper
        ( shipper.type === stuff.ST_STREAM && job.status === stuff.SS_COLLECTED ) );
  } ).map( function( job ) {
    return logshippers[ job.destination_type ].dispatch( job );
  } );

  if ( !jobs.length ) {
    logger.info( 'JobsQueue[' + this.id + '].dispatchLogs, nothing to do.' );
    return promise.resolve( false );
  }

  //  logshippers[...].dispatch() never throws, discards possible exception and marks job as faulty instead
  //  so promise.all always finishing after all jobs done/failed
  return promise.all( jobs )
    .then( function( jobs ) {
      jobs.forEach( function( job ) {
        if ( job.status === stuff.SS_SHIPPED ) {
          job.logs = false;
        }
      } );
      return true;
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
  logger.info( 'JobsQueue[' + self.id + '].processShippedJobs, processing ' + jobs.length + ' shipped jobs.' );

  if ( !jobs.length ) {
    return promise.resolve( false );
  }

  return logshipperDB.updateDomainLogs( jobs, stuff.SS_SHIPPED )
    .then( function() {
      //  remove stored files
      var files = jobs.map( function( job ) {
        return fs.unlinkAsync( stuff.toUploadsPath( job.file_for_upload ) );
      });

      //  assuming that some failed file removings are not terribly important
      return promise.any( files );
      // return promise.all( files );
    })
    .catch( function( err ) {
      if ( err.code && err.code === 'ENOENT' ) {
        //  log then discard exception, not that big deal
        logger.warn( 'JobsQueue.processShippedJobs: missed file to delete, ' + err.toString() );
        return;
      }
      throw err;
    })
    .then( function() {
      //  filter out done jobs
      self.queue = self.queue.filter( function( job ) {
        return job.status !== stuff.SS_SHIPPED;
      } );
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
    logger.info( 'JobsQueue[' + self.id + '].processFailedJobs, nothing to do.' );
    return promise.resolve( false );
  }
  logger.info( 'JobsQueue[' + self.id + '].processFailedJobs, processing ' + jobs.length + ' failed jobs.' );

  //  collect ids(db part of _id) of dead jobs(expended attempts count)
  var dead_ids = {};
  jobs.forEach( function( job ) {
    if ( --job.attempts === 0 ) {
      dead_ids[job._id.split('.')[0]] = true;
    }
  });
  //  collect all jobs with the same dead _id, mark others as filed/collected
  jobs = jobs.filter( function( job ) {
    if ( dead_ids[job._id.split('.')[0]] ) {
      return true;
    }
    job.status = logshippers[ job.destination_type ].type === stuff.ST_FILE ? stuff.SS_FILED : stuff.SS_COLLECTED;
    return false;
  });

  logger.info( 'JobsQueue[' + self.id + '].processFailedJobs, processing ' + jobs.length + ' aborted jobs.' );
  if ( !jobs.length ) {
    return promise.resolve( false );
  }

  //  filter the deads out of the queue
  self.queue = self.queue.filter( function( job ) {
    return job.status !== stuff.SS_ERROR;
  });

  //  bury deads
  return logshipperDB.updateDomainLogs( jobs, stuff.SS_READY/*revert them to un-processed status*/ )
    .then( function() {
      //  remove stored files if any
      var files = jobs.filter( function( job ) {
        return job.file_for_upload;
      }).map( function( job ) {
        return fs.unlinkAsync( stuff.toUploadsPath( job.file_for_upload ) );
      });
      return files && files.length ? promise.all( files ) : promise.resolve();
    })
    .catch( function( err ) {
      if ( err.code && err.code === 'ENOENT' ) {
        //  log then discard exception, not that big deal
        logger.warn( 'JobsQueue.processFailedJobs: missed file to delete, ' + err.toString() );
        return;
      }
      throw err;
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
JobsQueue.prototype.run = function() {

  var self = this;
  logger.info( 'JobsQueue[' + self.id + '].run started, the queue contains ' + self.queue.length + ' jobs.' );
  self.status = stuff.QS_RUNNING;
  return self.loadNewJobs()
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
      logger.info( 'JobsQueue[' + self.id + '].run finished, the queue contains ' + self.queue.length + ' delayed jobs.' );
      self.status = stuff.QS_READY;
      return true;
    })
    .catch( function( err ) {
      logger.info( 'JobsQueue[' + self.id + '].run error: ' + err.toString() );
      self.status = stuff.QS_ERROR;
      throw err;
    });

};

//  ----------------------------------------------------------------------------------------------//
module.exports = JobsQueue;