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
 *  Logs MongoDB access utils, not full-blown model, rather toolbelt
 */

/*jslint node: true */
'use strict';

//  ----------------------------------------------------------------------------------------------//

var _ = require( 'lodash' );
var config = require( 'config' );
var logger = require( 'revsw-logger' )( config.log );
var promise = require( 'bluebird' );
var mongo = require( 'mongodb' );
promise.promisifyAll( mongo );

var stuff = require( './commons' );

//  ----------------------------------------------------------------------------------------------//
var db_ = null;


//  ---------------------------------
var LogShipperDB = module.exports = {

  /** *********************************
   *
   */
  connect: function( force ) {

    if ( db_ && !force ) {
      return promise.resolve( true );
    }

    return mongo.MongoClient.connectAsync( config.logshipper_db.connection )
      .then( function( db ) {
        logger.info( 'LogShipperDB.connect: done' );
        db_ = db;
        return true;
      } )
      .catch( function( err ) {
        logger.error( 'LogShipperDB.connect: ' + err.toString() );
        throw err;
      } );
  },

  close: function() {
    if ( db_ ) {
      db_.close();
      db_ = null;
    }
  },

  /** *********************************
   *
   */
  health: function() {

    return ( db_ ? promise.resolve( true ) : this.connect() )
      .then( function() {
        return promise.all( [
          db_.collectionAsync( config.logshipper_db.domain_log_collection, { strict: true } ), //  will throw if collection doesn't exist
          db_.collectionAsync( config.logshipper_db.app_log_collection, { strict: true } )
        ] );
      } )
      .then( function( c_ ) {
        return { good: true };
      } )
      .catch( function( err ) {
        logger.error( 'LogShipperDB.health: ' + err.toString() );
        // gulp exception and just return false
        return { good: false, msg: err.toString() };
      } );
  },

  /** *********************************
   *  collect log records for every job in the array
   *  to optimize DB queries amount it collect all log records at once and
   *  then distribute them among jobs
   *
   *  @param {array} jobs of source_type === 'domain'
   *  @returns {Promise(jobs)} augmented with logs data
   */
  collectAllDomainLogs: function( jobs ) {

    var coll;
    return ( db_ ? promise.resolve( true ) : this.connect() )
      .then( function() {
        coll = db_.collection( config.logshipper_db.domain_log_collection );
        var where = {
          $or: jobs.map( function( job ) {
            return { domain: job.domain_name, unixtime: { $gte: job.span.from, $lte: job.span.to } };
          })
        };
        logger.debug( 'where', where );
        return coll
          .find( where )
          .project( { _id: 0 } )
          .limit( config.logs_shipping_max_records )
          .sort( { unixtime: 1 } )
          .toArray();
      } )
      .then( function( logs ) {

        logger.info( 'LogShipperDB.collectAllDomainLogs: ' + logs.length + ' log records downloaded.' );
        //  distribute records among domains
        var hash = {};
        logs.forEach( function( rec ) {
          if ( !hash[ rec.domain ] ) {
            hash[ rec.domain ] = [];
          }
          hash[ rec.domain ].push( rec );
        } );

        //  update jobs with log data
        jobs.forEach( function( job ) {

          //  if there're more than 1 job for the domain - these logs will be "shared" between them
          //  i.e. all `logs` properties will refer one array
          if ( hash[ job.domain_name ] ) {
            job.logs = hash[ job.domain_name ];
            job.span = { from: job.logs[0].unixtime, to: job.logs[job.logs.length-1].unixtime };
          } else {
            job.logs = [];
            job.span = { from: 0, to: 0 };
          }
          job.status = stuff.SS_COLLECTED;
        } );

        return jobs;
      } )
      .catch( function( err ) {
        logger.error( 'LogShipperDB.collectAllDomainLogs: ' + err.toString() );
        throw err;
      } );
  },

  /** *********************************
   *  remove shipped and too old records
   *
   *  @returns {Promise()}
   */
  cleanLogs: function() {

    var coll_logs,
      coll_jobs,
      threshold = { $lte: ( Date.now() / 1000 - config.logs_max_age_hr * 3600/*sec*/ ) };
    logger.debug( 'LogShipperDB.cleanLogs, threshold', threshold );

    return ( db_ ? promise.resolve( true ) : this.connect() )
      .then( function() {
        coll_logs = db_.collection( config.logshipper_db.domain_log_collection );
        return coll_logs.deleteManyAsync({
          unixtime: threshold
        }, { w: 1 } );
      } )
      .then( function( data ) {
        logger.info( 'LogShipperDB.cleanLogs: ' + data.result.n + ' log records deleted.' );
        coll_jobs = db_.collection( config.logshipper_db.running_jobs_collection );
        return coll_jobs.deleteManyAsync({
          'span.to': threshold
        }, { w: 1 } );
      } )
      .then( function( data ) {
        logger.info( 'LogShipperDB.cleanLogs: ' + data.result.n + ' jobs deleted.' );
        return true;
      } )
      .catch( function( err ) {
        logger.error( 'LogShipperDB.cleanLogs: ' + err.toString() );
        throw err;
      } );
  },


  /** *********************************
   *  running job structure
   *  {
   *   loaded
   *    "_id" : "5739a972d3399cea316682c5.12390abcdef",          //  modified
   *    "job_name" : "...",
   *    "destination_password" : "",
   *    "destination_username" : "",
   *    "destination_key" : "",
   *    "destination_port" : "",
   *    "destination_host" : "",
   *    "destination_type" : "s3",
   *    "source_type" : "domain",
   *    "operational_mode" : "active",
   *  added
   *    "job_id": "5739a972d3399cea316682c5",
   *    "domain_name": "...",
   *    "status": 1,
   *    "shipper_type": 1,
   *    "span": { from: 999, to: 999 },
   *    "logs": [],                                              //  shared
   *    "shared": {                                              //  shared
   *      "file_for_upload": "...",
   *      "jobs": [{job},{job}...],
   *      "file_type_jobs_num": 1
   *    }
   *  }
   */

  /** *********************************
   *
   *
   *  @param {[string]} job ids
   *  @returns {Promise([{_id,last_processed},{}..])}
   */
  loadLastProcessedJobs: function( ids ) {

    var coll;
    return ( db_ ? promise.resolve( true ) : this.connect() )
      .then( function() {
        coll = db_.collection( config.logshipper_db.running_jobs_collection );
        return coll.aggregate(
          [
            { $match: { status: { $in: [ stuff.SS_SHIPPED, stuff.SS_FILED, stuff.SS_COLLECTED ] }, job_id: { $in: ids } } },
            { $group: { _id: '$job_id', last_processed:{ $max: '$span.to' } } }
          ],
          { cursor: { batchSize: 1 } }
        ).toArray();
      })
      .catch( function( err ) {
        logger.error( 'LogShipperDB.loadLastProcessedJobs error: ' + err.toString() );
        throw err;
      } );
  },

  /** *********************************
   *  upsert running jobs to the db
   *
   *  @param {[{job},{}...]} jobs array
   *  @param {integer} job status to filter before save, optional
   *  @returns {Promise()}
   */
  saveJobs: function( jobs, status ) {

    if ( status !== undefined ) {
      jobs = jobs.filter( function( job ) {
        return job.status === status;
      });
    }

    if ( !jobs.length ) {
      logger.warn( 'LogShipperDB.saveJobs: nothing to do.' );
      return promise.resolve( false );
    }

    var coll;
    return ( db_ ? promise.resolve( true ) : this.connect() )
      .then( function() {
        coll = db_.collection( config.logshipper_db.running_jobs_collection );
        var bulk = jobs.map( function( job ) {

          var j = _.omit( job, ['logs','shared'] );
          j.file_for_upload = job.shared.file_for_upload;
          j.jobs = job.shared.jobs;

          return {
            updateOne: {
              filter: { _id: job._id },
              update: j,
              upsert:true
            }
          };
        });
        return coll.bulkWriteAsync( bulk, { w: 1 } );
      })
      .then( function( data ) {
        // logger.debug( 'bulkWriteAsync data', data );
        // { ok: 1, nInserted: 0, nUpserted: 0, nMatched: 1, nModified: 1, nRemoved: 0 ...
        logger.debug( 'LogShipperDB.saveJobs: ' + data.nUpserted + ' new jobs, ' + data.nModified + ' modified.' );
        return true;
      } )
      .catch( function( err ) {
        logger.error( 'LogShipperDB.saveJobs error: ' + err.toString() );
        throw err;
      } );
  },

  /** *********************************
   *  remove orphaned jobs
   *  SS_FILED and SS_COLLECTED before the queue started means they are remains after crush
   *
   *  @returns {Promise()}
   */
  cleanOrphans: function() {

    var coll;
    return ( db_ ? promise.resolve( true ) : this.connect() )
      .then( function() {
        coll = db_.collection( config.logshipper_db.running_jobs_collection );
        return coll.deleteManyAsync({
          status: { $in: [ stuff.SS_FILED, stuff.SS_COLLECTED ] }
        }, { w: 1 } );
      })
      .then( function( data ) {
        logger.debug( 'LogShipperDB.cleanOrphans: ' + data.result.n + ' jobs removed.' );
      })
      .catch( function( err ) {
        logger.error( 'LogShipperDB.LogShipperDB error: ' + err.toString() );
        throw err;
      } );

  },
};


// domain log record format
// "_id" : ObjectId("573a398e93de77f13832ba39"),
// "host" : "TESTSJC20-BP01.REVSW.NET",
// "@timestamp" : "2016-05-16T21:20:07.000Z",
// "unixtime" : 1463433607,                     //  indexed
// "domain" : "portal-qa-domain.revsw.net",     //  indexed + unixtime
// "ipport" : "80",
// "response" : "200",
// "request" : "/",
// "s_bytes" : 651,
// "r_bytes" : 350,
// "method" : "GET",
// "conn_status" : "OK",
// "KA" : 1,
// "FBT_mu" : 1428,
// "cache" : "MISS",
// "referer" : "http://www.metacafe.com/watch/yt-5gr4M7T9xeQ/",
// "agent" : "Mozilla/5.0 (iPhone; CPU iPhone OS 7_0 like Mac OS X) AppleWebKit/537.51.1 (KHTML, like Gecko) Version/7.0 Mobile/11A465 Safari/9537.53 BingPreview/1.0b",
// "cont_type" : "text/html",
// "quic" : "-",
// "http2" : ""

//  app log record format
// "sdk_key": "07d88bca-a35a-47c1-a8aa-f726fddf780f",
// "device": {...},
// "location": {...},
// "app_name": "termscorp",
// "sdk_version": "1",
// "version": "1.0.1",
// "log_events": [],
// "carrier": {...},
// "requests": [{ },{ },...],
// "network": {...},
// "wifi": {...},
// "ip": "54.88.56.156",
// "received_at": 1463581702721,
// "account_id": "55c8dba441266c821d1c20c5",
// "app_id": "56a637fb7f64c1853f7453e9",
// "geoip": {
//   "country_code2": "US",
//   "region_name": "VA",
//   "city_name": "Ashburn"
// },
// "hits": 0,
// "end_ts": 1463581702722,
// "start_ts": 1463581702722

/*
  > db.DomainsLog.getIndexes()
  [{
    "v": 1,
    "key": {
      "_id": 1
    },
    "name": "_id_",
    "ns": "logshipper.DomainsLog"
  }, {
    "v": 1,
    "key": {
      "unixtime": 1
    },
    "name": "unixtime_1",
    "ns": "logshipper.DomainsLog"
  }, {
    "v": 1,
    "key": {
      "domain": 1,
      "unixtime": 1
    },
    "name": "domain_1_unixtime_1",
    "ns": "logshipper.DomainsLog"
  }, {
    "v": 1,
    "key": {
      "shipping": 1
    },
    "name": "shipping_1",
    "ns": "logshipper.DomainsLog"
  }]
*/
