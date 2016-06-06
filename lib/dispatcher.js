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
var rsyslog = require( './rsyslog' );
var pubsub = require( './pubsub' );


//  ----------------------------------------------------------------------------------------------//

//  the Queue
var jobsQueue_ = [];

//  domain ID:{name,status} hashes
//  domain called "active" from the log collection point of view - the logs being stored for active and paused jobs
//  status field stores 2 for the active domain and 0 for not
//  after new jobs loaded, each "domain" job add 1 to the status
//  it allows us to easy distinguish active(1,3) and changed(1 became active, 2 - inactive) domains
var domains_ = {};

//  the event Bus
var bus_ = new pubsub();


//  ---------------------------------

var loadNewJobs_ = function() {

  var newjobs = false;
  return revportalDB.loadShippingJobsList()
    .then( function( jobs ) {

      newjobs = jobs;
      logger.info( newjobs.length + ' shipping jobs loaded.' );
      var domains2add = [];
      newjobs.forEach( function( job ) {
        if ( job.source_type === 'domain' ) {
          if ( !domains_[job.source_id] ) {
            domains2add.push( job.source_id );
          } else {
            domains_[job.source_id].status += 1;
          }
        }
      });

      if ( domains2add.length ) {
        //  there are new domains to add to the loadShippingJobsList
        return revportalDB.loadDomainNames( domains2add )
          .then( function( domains ) {
            domains.forEach( function( d ) {
              domains_[ d._id ] = { name: d.domain_name, status: 1 };
            });
            logger.info( domains.length + ' domain id:name hashes updated.' );
            return promise.resolve( true/*changed*/ );
          });
      }
      return promise.resolve( false/*not(yet) changed*/ );
    } )
    .then( function( changed ) {

      var names = _.values( domains_ )
        .filter( function( item ) {
          var active = item.status === 1 || item.status === 3;
          changed = changed || item.status === 1 || item.status === 2;
          item.status = active ? 2 : 0;
          return active;
        })
        .map( function( item ) {
          return item.name;
        });

      //  filter out paused jobs leaving only the active tasks
      newjobs = newjobs.filter( function( job ) {
        return job.operational_mode === 'active';
      });

      //  reload rsyslog system service
      return changed ? rsyslog.reloadConfig( names ) : promise.resolve();
    })
    .then( function() {

      if ( newjobs.length ) {
        var base_id = Date.now().toString( 16 );
        newjobs.forEach( function( job ) {
          job._id = job._id.toString() + '.' + base_id; //  <-- 5739a972d3399cea316682c5.154cf268f84
          job.status = stuff.SS_READY;
          job.attempts = config.failed_retry_num;
          if ( job.source_type === 'domain' ) {
            job.domain_name = domains_[ job.source_id ].name;
          }
          jobsQueue_.push( job );
        } );
        logger.info( 'the Queue now contains ' + jobsQueue_.length + ' shipping jobs.' );
        bus_.fire( 'new.jobs.loaded' );
      }
      return jobsQueue_;
    } );
};

//  ---------------------------------
var loadDomainLogs_ = function() {

  return logshipperDB.collectAllDomainLogs( jobsQueue_.filter( function( job ) {
      return job.source_type === 'domain' && job.status === stuff.SS_READY;
    } ) )
    .then( function() {
      bus_.fire( 'domain.logs.loaded' );
    });
};

//  ---------------------------------
var saveLogsForUpload_ = function() {

  var jobs2save = jobsQueue_.filter( function( job ) {
    var shipper = logshippers[ job.destination_type ];
    return shipper && shipper.type === stuff.ST_FILE &&     //  allow jobs with file type of shipper
      job.logs.records && job.logs.records.length;          //  non-empty log array
  } ).map( function( job ) {
    return logshippers[ job.destination_type ].save( job ); //  promise to array
  } );

  //  logshippers[].save() never throws, gulp exception and mark job as faulty
  //  so promise.all always finishing after all jobs done
  return promise.all( jobs2save )
    .then( function( jobs ) {
      jobs.forEach( function( job ) {
        if ( job.status === stuff.SS_FILED ) {
          job.file_for_upload = job.logs.file_for_upload;
          //  no more reason to keep them in memory
          job.logs = false;
        }
      } );
      bus_.fire( 'logs.filed' );
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
        //  allow filed jobs with file type of shipper (empty logs not filed)
      ( ( shipper.type === stuff.ST_FILE && job.status === stuff.SS_FILED ) ||
        //  or collected jobs with stream type of shipper
        ( shipper.type === stuff.ST_STREAM && job.status === stuff.SS_COLLECTED ) );
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
      bus_.fire( 'logs.dispatched' );
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
      return promise.any( files );
      // return promise.all( files );
    })
    .then( function() {
      bus_.fire( 'shipped.jobs.processed' );
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
  init: function() {
    bus_.on( 'new.jobs.loaded', loadDomainLogs_ );
    bus_.on( 'domain.logs.loaded', saveLogsForUpload_ );
    bus_.on( 'logs.filed', dispatchLogs_ );
    // bus_.on( 'logs.dispatched',  );
  },

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
