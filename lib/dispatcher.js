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

var _ = require('lodash');
var config = require('config');
var logger = require('revsw-logger')(config.log);
var promise = require('bluebird');

//  ---------------------------------
var stuff = require('./commons');

var logshipper_db = require( './logshipper_db');
var revportal_db = require( './revportal_db');
var logshippers = require( './logshippers');


//  ----------------------------------------------------------------------------------------------//

//  the Queue
var jobsQueue_ = [];

//  domain ID:Name hashes
var domains_ = {};


//  ---------------------------------

var loadNewJobs_ = function() {

  return revportal_db.loadShippingJobsList()
    .then( function( newjobs ) {

      logger.info( newjobs.length + ' shipping jobs loaded.' );
      var newdomains = [];
      newjobs.forEach( function( job ) {
        if ( job.source_type === 'domain' && !domains_[job.source_id] ) {
          newdomains.push( job.source_id );
        }
      });

      if ( newdomains.length ) {
        return revportal_db.loadDomainNames( newdomains )
          .then( function( domains ) {
            domains.forEach( function( d ) {
              domains_[d._id] = d.domain_name;
            });
            logger.info( domains.length + ' domain id:name hashes updated.' );
            return newjobs;
          });
      }
      return promise.resolve( newjobs );
    })
    .then( function( newjobs ) {
      var base_id = Date.now().toString(16);
      newjobs.forEach( function( job ) {
        job._id = job._id.toString() + '.' + base_id; //  <-- 5739a972d3399cea316682c5.154cf268f84
        job.status = stuff.SS_READY;
        if ( job.source_type === 'domain' ) {
          job.domain_name = domains_[job.source_id];
        }
        jobsQueue_.push( job );
      });
    });
};

//  ---------------------------------
var loadDomainLogs_ = function() {

  return logshipper_db.collectAllDomainLogs( jobsQueue_.filter( function( job ) {
      return job.source_type === 'domain' && job.status === stuff.SS_READY;
    }) );
};

//  ---------------------------------
var saveLogsForUpload_ = function() {

  var jobs = jobsQueue_.filter( function( job ) {
    var shipper = logshippers[job.destination_type];
    return shipper && shipper.type === stuff.ST_FILE; //  allow jobs with file type of shipper
  }).map( function( job ) {
    return logshippers[job.destination_type].save( job );
  });

  return promise.all( jobs )
    .then( function( jobs ) {
      jobs.forEach( function( job ) {
        if ( job.status === stuff.SS_FILED ) {
          job.file_for_upload = job.logs.file_for_upload;
          //  no more reason to keep them in memory
          job.logs = false;
        }
      });
    });
};

//  ---------------------------------
var dispatchLogs_ = function() {

  var jobs = jobsQueue_.filter( function( job ) {
    var shipper = logshippers[job.destination_type];
    return shipper &&
      shipper.dispatch &&
      ( ( shipper.type === stuff.ST_FILE && job.status === stuff.SS_FILED ) ||        //  allow filed jobs with file type of shipper
        ( shipper.type === stuff.ST_STREAM && job.status === stuff.SS_COLLECTED ) );  //  or collected jobs with stream type of shipper
  }).map( function( job ) {
    return logshippers[job.destination_type].dispatch( job );
  });

  return promise.all( jobs )
    .then( function( jobs ) {
      jobs.forEach( function( job ) {
        if ( job.status === stuff.SS_SHIPPED ) {
          job.logs = false;
        }
      });
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
        return loadDomainLogs_();
      })
      .then( function() {
        return saveLogsForUpload_();
      })
      .then( function() {
        return dispatchLogs_();
      })
      .then( function() {

        var failed = 0,
          shipped = 0;
        jobsQueue_.forEach( function( job ) {
          if ( job.status === stuff.SS_SHIPPED ) {
            ++shipped;
          } else if ( job.status === stuff.SS_ERROR ) {
            ++failed;
          }
        });
        logger.info( 'LogShippingDispatcher.run, queue processing finished, shipped ' + shipped + 'jobs, failed ' + failed + ' jobs.' );
        jobsQueue_ = [];
      })
      .catch( function( err ) {
        logger.error( 'LogShippingDispatcher.run, queue processing error: ' + err.toString() );
      });
  }

};
