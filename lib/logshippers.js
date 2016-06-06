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

var _ = require( 'lodash' );
var config = require( 'config' );
var logger = require( 'revsw-logger' )( config.log );
var promise = require( 'bluebird' );
var fs = promise.promisifyAll( require( 'fs' ) );
var zip = require( 'adm-zip' );
var ftps = require( 'ftps' );

//  ---------------------------------
var stuff = require( './commons' );
var logshipperDB = require( './logshipperDB' );
var revportalDB = require( './revportalDB' );

/** *********************************
 *  save collected logs to file for further upload
 *  it catches exceptions and doesn't throw but mark the job as faulty
 *
 *  @param {object} job
 *  @returns {promise(job)}
 */
var saveForUpload_ = function( job ) {

  if ( !job.logs || !job.logs.records.length ) {
    return promise.resolve( job );
  }

  if ( job.logs.file_for_upload /*semaphore, below*/ ) {
    job.status = stuff.SS_FILED;
    return promise.resolve( job );
  }

  //  mark it on a case if the logs object shared between several jobs
  job.logs.file_for_upload = true;

  return promise.resolve( job )
    .then( function( job ) {

      //  convert every record to json string + lf
      var data = job.logs.records.reduce( function( prev, curr ) {
        return prev + JSON.stringify( curr ) + '\n';
      }, '' );

      var zipper = new zip(),
        filename = job._id + '.log.zip';

      zipper.addFile( job._id + '.log', new Buffer( data ), '' );
      job.logs.file_for_upload = filename;
      return fs.writeFileAsync( stuff.toUploadsPath( filename ), zipper.toBuffer() );
    } )
    .then( function() {
      job.status = stuff.SS_FILED;
      return job;
    } )
    .catch( function( err ) {
      //  it gulps exception and return job marked as failed
      job.status = stuff.SS_ERROR;
      job.error = 'LogShippers.save job id ' + job._id + ', error ' + err.toString();
      logger.error( job.error );
      return job;
    } );
};

/** *********************************
 *  trying once to send file via ftp, decrement counter in case of failure
 *
 *  @param {object} control structure
 *  @param {object} job
 *  @returns {promise(job)}
 */
var ftpFireOnce_ = function( control, job ) {

  return control.ftp
    .put( stuff.toUploadsPath( job.file_for_upload ) )
    .exec()
    .then( function( res ) {
      if ( res.error ) {
        throw new Error( res.error );
      }
      //  job is done
      control.counts = 0;
    })
    .catch( function( err ) {
      logger.warn( 'LogShippers::ftpFireOnce_ job id ' + job._id + ', error ' + err.toString() );
      if ( --control.counts ) {
        //  fucked up but still in business, delay then fire again
        return promise.delay( config.ftp_failed_delay );
      }
      //  now fucked up totally
      throw err;
    })
    .then( function() {
      //  we can get here from the above "then" or the above "catch"
      if ( control.counts ) {
        //  not yet done, again
        return ftpFireOnce_( control, job );
      }
    });
};

/** *********************************
 *  sends file via ftp, decrement counter in case of failure
 *  it catches exceptions and doesn't throw but mark the job as faulty
 *
 *  @param {object} job
 *  @returns {promise(job)}
 */
var ftpFire_ = function( job ) {

  var control = {
    ftp: ( new ftps({
      protocol: 'ftp',
      host: job.destination_host,
      username: job.destination_username,
      password: job.destination_password,
      port: ( job.destination_port || 21 ),
      requiresPassword: ( job.destination_password !== '' ),
      // host: 'testsjc20-ls01.revsw.net', //  debug
      // username: 'dmitry',
      // password: 'disaster-257',
      // requiresPassword: true,
      // timeout: 30,
    } ) ),
    counts: 2
  };
  control.ftp.exec = promise.promisify( control.ftp.exec );

  return ftpFireOnce_( control, job )
    .then( function() {
      job.status = stuff.SS_SHIPPED;
      return job;
    })
    .catch( function( err ) {
      //  it gulps exception and return job marked as failed
      job.error = 'LogShippers::ftpFire_, no more attempts: job id ' + job._id + ', error ' + err.toString();
      job.status = stuff.SS_ERROR;
      logger.error( job.error );
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

  s3: {
    type: stuff.ST_FILE,
    save: saveForUpload_
  },

};
