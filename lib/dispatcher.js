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
 *  Log Shipping Dispatcher
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


//  ----------------------------------------------------------------------------------------------//

//  the Queue
var jobsQueue_ = [];

//  domain ID:Name hashes
var domains_ = {};


//  ---------------------------------

var loadNewJobs_ = function() {

  return revportalDB.loadShippingJobsList()
    .then( function( newjobs ) {

      logger.info( newjobs.length + ' shipping jobs loaded.' );
      var newdomains = [];
      newjobs.forEach( function( job ) {
        if ( job.source_type === 'domain' && !domains_[ job.source_id ] ) {
          newdomains.push( job.source_id );
        }
      } );

      if ( newdomains.length ) {
        return revportalDB.loadDomainNames( newdomains )
          .then( function( domains ) {
            domains.forEach( function( d ) {
              domains_[ d._id ] = d.domain_name;
            } );
            logger.info( domains.length + ' domain id:name hashes updated.' );
            return newjobs;
          } );
      }
      return promise.resolve( newjobs );
    } )
    .then( function( newjobs ) {
      var base_id = Date.now().toString( 16 );
      newjobs.forEach( function( job ) {
        job._id = job._id.toString() + '.' + base_id; //  <-- 5739a972d3399cea316682c5.154cf268f84
        job.status = stuff.SS_READY;
        job.attempts = config.failed_retry_num;
        if ( job.source_type === 'domain' ) {
          job.domain_name = domains_[ job.source_id ];
        }
        jobsQueue_.push( job );
      } );
      logger.info( 'the Queue now contains ' + jobsQueue_.length + ' shipping jobs.' );
      return jobsQueue_;
    } );
};

//  ---------------------------------
var loadDomainLogs_ = function() {

  return logshipperDB.collectAllDomainLogs( jobsQueue_.filter( function( job ) {
    return job.source_type === 'domain' && job.status === stuff.SS_READY;
  } ) );
};

//  ---------------------------------
var saveLogsForUpload_ = function() {

  var jobs = jobsQueue_.filter( function( job ) {
    var shipper = logshippers[ job.destination_type ];
    return shipper && shipper.type === stuff.ST_FILE &&   //  allow jobs with file type of shipper
      job.logs.records && job.logs.records.length;        //  non-empty log array
  } ).map( function( job ) {
    return logshippers[ job.destination_type ].save( job );
  } );

  return promise.all( jobs )
    .then( function( jobs ) {
      jobs.forEach( function( job ) {
        if ( job.status === stuff.SS_FILED ) {
          job.file_for_upload = job.logs.file_for_upload;
          //  no more reason to keep them in memory
          job.logs = false;
        }
      } );
      return jobsQueue_;
    } );
};

//  ---------------------------------
var dispatchLogs_ = function() {

  if ( !jobsQueue_.length ) {
    return promise.resolve( false );
  }

  var jobs = jobsQueue_.filter( function( job ) {
    var shipper = logshippers[ job.destination_type ];
    return shipper &&
      shipper.dispatch &&
      ( ( shipper.type === stuff.ST_FILE && job.status === stuff.SS_FILED ) || //  allow filed jobs with file type of shipper (empty logs not filed)
        ( shipper.type === stuff.ST_STREAM && job.status === stuff.SS_COLLECTED ) ); //  or collected jobs with stream type of shipper
  } ).map( function( job ) {
    return logshippers[ job.destination_type ].dispatch( job );
  } );

  return promise.all( jobs )
    .then( function( jobs ) {
      jobs.forEach( function( job ) {
        if ( job.status === stuff.SS_SHIPPED ) {
          job.logs = false;
        }
      } );
      return jobsQueue_;
    } );
};

//  ---------------------------------
var processShipped_ = function() {

  var jobs = jobsQueue_.filter( function( job ) {
    return job.status === stuff.SS_SHIPPED && job.source_type === 'domain'; //  TODO: applications
  } );

  if ( !jobs.length ) {
    return promise.resolve();
  }

  logger.info( 'LogShippingDispatcher processing ' + jobs.length + ' shipped jobs.' );
  return logshipperDB.updateDomainLogs( jobs, stuff.SS_SHIPPED )
    .then( function() {
      //  remove stored files
      var files = jobs.map( function( job ) {
        return fs.unlinkAsync( stuff.toUploadsPath( job.file_for_upload ) );
      });
      return promise.all( files );
    });
};

//  ---------------------------------
var processFailed_ = function( jobs ) {

  if ( !jobs.length ) {
    return promise.resolve();
  }

  logger.warn( 'LogShippingDispatcher processing ' + jobs.length + ' failed jobs.' );
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
    .then( function() {
      //  pause jobs
      return revportalDB.pauseShippingJobs( jobs );
    });
};



//  ----------------------------------------------------------------------------------------------//
var LogShippingDispatcher = module.exports = {

  // debug
  queue: jobsQueue_,
  loadNewJobs: loadNewJobs_,
  loadDomainLogs: loadDomainLogs_,
  saveLogsForUpload: saveLogsForUpload_,
  dispatchLogs: dispatchLogs_,
  // debug

  //  main
  run: function() {

    logger.info( 'LogShippingDispatcher.run, queue processing started.' );

    loadNewJobs_()
      .then( function() {

        if ( !jobsQueue_.length ) {
          logger.info( 'LogShippingDispatcher.run, the queue is empty.' );
          return;
        }

        promise.resolve( true )
          .then( function( data ) {
            return loadDomainLogs_();
          } )
          .then( function() {
            return saveLogsForUpload_();
          } )
          .then( function() {
            return dispatchLogs_();
          } )
          .then( function() {
            return processShipped_();
          } )
          .then( function() {

            var delayed = [],
              failed = [];

            // logger.debug( jobsQueue_ );

            jobsQueue_.forEach( function( job ) {
              if ( job.status === stuff.SS_ERROR ) {
                if ( --job.attempts === 0 ) {
                  failed.push( job );
                } else {
                  job.status = logshippers[ job.destination_type ].type === stuff.ST_FILE ? stuff.SS_FILED : stuff.SS_COLLECTED;
                  delayed.push( job );
                }
              }
            });

            if ( failed.length ) {
              //  scan delayed queue and collect all jobs with the same id as failed
              failed.forEach( function( fjob ) {
                var fid = fjob._id.split('.')[0];
                delayed.forEach( function( djob ) {
                  if ( djob._id.split('.')[0] === fid ) {
                    djob.status = stuff.SS_ERROR; // first mark it
                  }
                });
              });
              //  ... then filter out
              failed = failed.concat( delayed.filter( function( job ) {
                return job.status === stuff.SS_ERROR;
              }) );
              delayed = delayed.filter( function( job ) {
                return job.status !== stuff.SS_ERROR;
              });
            }

            logger.warn( 'LogShippingDispatcher, ' + delayed.length + ' jobs are delayed.' );
            jobsQueue_ = delayed;
            return processFailed_( failed )
              .then( function() {
                failed = [];
              });
          });

      } )
      .catch( function( err ) {
        logger.error( 'LogShippingDispatcher.run, queue processing error: ' + err.toString() );
      } );
  }

};
