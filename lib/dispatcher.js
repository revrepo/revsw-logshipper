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
      newjobs.forEach( function( job ) {
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
    })/*, from, to*/ );

};



//  ----------------------------------------------------------------------------------------------//
var LogShippingDispatcher = module.exports = {



  // debug
  queue: jobsQueue_,
  loadNewJobs: loadNewJobs_,
  loadDomainLogs: loadDomainLogs_
  // debug
};
