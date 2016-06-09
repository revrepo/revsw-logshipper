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
// var pubsub = require( './pubsub' );
var Domains = require( './domains' );
var Queue = require( './queue' );


//  ----------------------------------------------------------------------------------------------//

//  the event Bus
// var bus_ = new pubsub();

//  domains id:{name,status} hashes shared among the queues
var theDomains_ = new Domains();

//  the Queue of running queues
var theQueues_ = [];


//  ----------------------------------------------------------------------------------------------//
var LogShippingDispatcher = module.exports = {

  // debug
  domains: theDomains_,
  queues: theQueues_,
  // debug

  //  main
  run: function() {

    logger.info( 'LogShippingDispatcher.run, jobs processing started.' );

    var qu,
      queues = theQueues_.filter( function( q ) {
        return q.status === stuff.QS_READY && q.queue.length;
      });

    if ( queues.length === 0 ) {
      qu = new Queue( theDomains_ );
    } else if ( queues.length === 1 ) {
      qu = queues[0];
    } else {
      //  more than one waiting queue - merge all of them into one
      logger.debug( 'LogShippingDispatcher.run, theQueues_ length is ' + theQueues_.length );
      queues[0].queue = queues.reduce( function( prev, curr ) {
        return prev.concat( curr.queue );
      }, [] );
      qu = queues[0];
    }

    // filter out completed and failed queues
    theQueues_ = theQueues_.filter( function( q ) {
      return q.status !== stuff.QS_READY && q.status !== stuff.QS_ERROR;
    });
    //  then add the new one
    theQueues_.push( qu );

    qu.run()
      .then( function() {
        logger.info( 'LogShippingDispatcher.run finished.' );
      })
      .catch( function( err ) {
        logger.err( 'LogShippingDispatcher.run, error: ' + err.toString() );
      });

  },



};
