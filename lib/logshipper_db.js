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

var _ = require('lodash');
var config = require('config');
var logger = require('revsw-logger')(config.log);
var promise = require('bluebird');
var mongo = require('mongodb');
promise.promisifyAll( mongo );

//  ----------------------------------------------------------------------------------------------//

var SS_READY = 0;
var SS_COLLECTED = 1;
var SS_SHIPPED = 2;
var SS_DELAYED = 3;
var SS_ERROR = 4;

//  ---------------------------------
var db_ = null,
  //  cashed for brevity
  domain_coll_name_ = config.service.logshipper_db.domain_log_collection,
  app_coll_name_ = config.service.logshipper_db.app_log_collection;

//  ----------------------------------------------------------------------------------------------//
var LogShipperDB = module.exports = {

  /** *********************************
   *
   */
  connect: function( force ) {

    if ( db_ && conn_ && !force ) {
      return promise.resolve( true );
    }

    return mongo.MongoClient.connectAsync( config.service.logshipper_db.connection )
      .then( function( db ) {
        logger.info( 'LogShipperDB.connect: ok' );
        db_ = db;
        return true;
      })
      .catch( function( err ) {
        logger.error( 'LogShipperDB.connect: ' + err.toString() );
        throw err;
      });;
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
  //  ---------------------------------
  health: function() {

    return ( db_ ? promise.resolve( true ) : this.connect() )
      .then( function() {
        return promise.all([
          db_.collectionAsync( domain_coll_name_, { strict:true }), //  will throw if collection doesn't exist
          db_.collectionAsync( app_coll_name_, { strict:true })
          ]);
      })
      .then( function( c_ ) {
        return { good: true };
      })
      .catch( function( err ) {
        logger.error( 'LogShipperDB.health: ' + err.toString() );
        // gulp exception and just return false
        return { good: false, msg: err.toString() };
      });
  },

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


  /** *********************************
   *  collect log records for every job in the array
   *
   *  @param {object} jobs contains hash prop domains
   *  @param {integer} linux epoch time in seconds
   *  @param {integer} linux epoch time in seconds, default now

   *  @returns {Promise(jobs)}
   *  promise({
   *    domains: {
   *      <_id>: {
   *        jobs: [{
   *          _id" : ObjectId(...),
   *          source_type" : "domain", .......
   *        }, {...}],
   *        domain_name: 'somedomain.com',
   *        logs:[{},{},{}....]             <-- log records for this domain
   *      }
   *    },
   *    apps: {  }
   *  })
   */
  collectDomainLogs: function( jobs, from, to ) {

    var coll,
      where = {
        domain: {},
        unixtime: ( to ? { $gte: from, $lte: to } : { $gte: from } ),
        shippind: { $not: { $gt: SS_READY } }
      };
    return ( db_ ? promise.resolve( true ) : this.connect() )
      .then( function() {
        coll = db_.collection( domain_coll_name_ );
        var domains = _.map( jobs.domains, function( item ) {
          return item.domain_name;
        });
        if ( domains.length ) {
          where.domain = { $in: domains };
          return coll.find( where ).sort({ unixtime: 1 }).toArray()
        }
        return [];
      })
      .then( function( logs ) {
        if ( logs.length ) {
          //  mark collected log records
          return coll.updateAsync( where, { $set: { shipping: SS_COLLECTED } }, { w: 1, multi: true })
            .then( function() {
              return logs;
            })
        }
        return logs;
      })
      .then( function( logs ) {
        var domains_hash = {};
        logs.forEach( function( item ) {
          if ( !domain_hash[item.domain] ) {
            domain_hash[item.domain] = []
          }
          domains_hash[item.domain].push( item );
        });
        _.each( jobs.domains, function( item ) {
          item.logs = domains_hash[item.domain_name];
        });
        return jobs;
      })
      .catch( function( err ) {
        logger.error( 'LogShipperDB.collectLogs: ' + err.toString() );
        throw err;
      });
  }

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