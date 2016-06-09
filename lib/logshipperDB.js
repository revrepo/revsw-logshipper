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

    var coll,
      where = {
        domain: {},
        shipping: { $not: { $gt: stuff.SS_READY } } //  id does work too in case shipping field is absent
      };
    return ( db_ ? promise.resolve( true ) : this.connect() )
      .then( function() {
        coll = db_.collection( config.logshipper_db.domain_log_collection );
        where.domain = {
          $in: jobs.map( function( job ) {
            return job.domain_name;
          } )
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
        if ( logs.length ) {
          //  mark collected log records
          where.unixtime = { $gte: logs[0].unixtime, $lte: logs[logs.length-1].unixtime };
          return coll.updateAsync( where, { $set: { shipping: stuff.SS_COLLECTED } }, { w: 1, multi: true } )
            .then( function( data ) {
              //{ result: { ok: 1, nModified: 1200, n: 2100 },
              logger.info( 'LogShipperDB.collectAllDomainLogs: ' + data.result.nModified + ' records shipping status updated.' );
              if ( data.result.nModified !== logs.length ) {
                logger.warn( 'LogShipperDB.collectAllDomainLogs: updated records num inconsistence.' );
              }
              return logs;
            } );
        }
        return logs;
      } )
      .then( function( logs ) {
        //  distribute records among domains
        var hash = {};
        logs.forEach( function( rec ) {
          if ( !hash[ rec.domain ] ) {
            hash[ rec.domain ] = { records: [] };
          }
          hash[ rec.domain ].records.push( rec );
        } );

        //  update jobs with log data
        jobs.forEach( function( job ) {
          job.span = where.unixtime;

          //  if there're more than 1 job for the domain - these logs will be "shared" between them
          //  i.e. all `logs` properties will refer one object
          job.logs = hash[ job.domain_name ] || { records: [] };
          //

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
   *  update log records for every job in the array
   *
   *  @param {array} jobs of source_type === 'domain'
   *  @param {int} new status
   *  @returns {Promise(jobs)}
   */
  updateDomainLogs: function( jobs, new_status ) {

    if ( new_status === undefined ) {
      return promise.reject( new Error( 'LogShipperDB.updateDomainLogs, new status not provided' ) );
    }

    var coll,
      where = { shipping: stuff.SS_COLLECTED };

    return ( db_ ? promise.resolve( true ) : this.connect() )
      .then( function() {
        coll = db_.collection( config.logshipper_db.domain_log_collection );
        where.$or = jobs.map( function( job ) {
          return {
            domain: job.domain_name,
            unixtime: job.span
          };
        } );
        logger.debug( 'where', where );
        return coll.updateAsync( where, { $set: { shipping: new_status } }, { w: 1, multi: true } );
      } )
      .then( function( data ) {
        //  { result: { ok: 1, nModified: 1200, n: 2100 },
        logger.debug( 'result', data.result );
        logger.info( 'LogShipperDB.updateDomainLogs: ' + data.result.nModified + ' records shipping status updated to ' + stuff.shippingStatusNames[new_status] );
        return jobs;
      } )
      .catch( function( err ) {
        logger.error( 'LogShipperDB.updateDomainLogs: ' + err.toString() );
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
  "v" : 1,
  "key" : {
    "domain" : 1,
    "unixtime" : 1
  },
  "name" : "domain_1_unixtime_1",
  "ns" : "logshipper.DomainsLog"
  }, {
  "v" : 1,
  "key" : {
    "unixtime" : 1
  },
  "name" : "unixtime_1",
  "ns" : "logshipper.DomainsLog"
  }]
*/
