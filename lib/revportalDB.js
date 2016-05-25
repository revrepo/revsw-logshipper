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
 *  Revportal MongoDB access utils, not full-blown model, rather toolbelt
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
var ObjectID = mongo.ObjectID;

//  ----------------------------------------------------------------------------------------------//
var db_ = null;

//  ----------------------------------------------------------------------------------------------//
var RevportalDB = module.exports = {

  /** *********************************
   *
   */
  connect: function( force ) {

    if ( db_ && conn_ && !force ) {
      return promise.resolve( true );
    }

    return mongo.MongoClient.connectAsync( config.revportal_db.connection )
      .then( function( db ) {
        logger.info( 'RevportalDB.connect: done' );
        db_ = db;
        return true/*dummy something*/;
      })
      .catch( function( err ) {
        logger.error( 'RevportalDB.connect: ' + err.toString() );
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
  health: function() {

    return ( db_ ? promise.resolve( true ) : this.connect() )
      .then( function() {
        return db_.collectionAsync( coll_name_, { strict:true }); //  will throw if collection doesn't exist
      })
      .then( function( c_ ) {
        return { good: true };
      })
      .catch( function( err ) {
        logger.error( 'jobsModel.health: ' + err.toString() );
        // gulp exception and just return false
        return { good: false, msg: err.toString() };
      });
  },

  /** *********************************
   *  @returns the shipping jobs from db
   */
  loadShippingJobsList: function() {

    return ( db_ ? promise.resolve( true ) : this.connect() )
      .then( function() {
        var coll = db_.collection( config.revportal_db.job_collection );
        return coll.find({
          operational_mode: 'active', //  <-- 'active','pause','stop'
          destination_port: { $ne: '' },
          destination_host: { $ne: '' }
        }).project({
          account_id: 0,
          // job_name: 0, //  debug
          created_by: 0,
          updated_at: 0,
          updated_by: 0,
          comment: 0,
          notification_email: 0,
          created_at: 0,
          __v: 0 }).toArrayAsync();
      })
      .catch( function( err ) {
        logger.error( 'RevportalDB.loadShippingJobsList: ' + err.toString() );
        throw err;
      });
  },

  /** *********************************
   *  load domain names
   *
   *  @param {array[strings]} ids array with domain IDs
   *  @returns promise([{_id:'', domain_name:''}, {}, ...])
   */
  loadDomainNames: function( ids ) {

    return ( db_ ? promise.resolve( true ) : this.connect() )
      .then( function() {
        var coll = db_.collection( config.revportal_db.domain_collection );
        ids = ids.map( function( id ) {
          return new ObjectID( id );
        });
        return coll.find({ _id: { $in: ids } }, { domain_name: 1 }).toArrayAsync();
      })
      .then( function( domains ) {
        return domains.map( function( domain ) {
          domain._id = domain._id.toString();
          return domain;
        });
      })
      .catch( function( err ) {
        logger.error( 'RevportalDB.loadDomainNames: ' + err.toString() );
        throw err;
      });
  },

  /** *********************************
   *  pause jobs
   *
   *  @param {array[jobs]} array with jobs in a queue
   *  @returns promise()
   */
  pauseShippingJobs: function( jobs ) {

    return ( db_ ? promise.resolve( true ) : this.connect() )
      .then( function() {
        var coll = db_.collection( config.revportal_db.job_collection );
        var ids = jobs.map( function( job ) {
          return new ObjectID( job._id.split('.')[0] );
        });
        return coll.update({
          _id: {
            '$in' : ids
          }
        }, {
          '$set': {
            operational_mode: 'pause'
          }
        }, {
          multi: true,
          w: 1
        });
      })
      .catch( function( err ) {
        logger.error( 'RevportalDB.pauseShippingJobs: ' + err.toString() );
        throw err;
      });
  },

};


// job stored in DB
// {
//   "_id" : ObjectId("5739a972d3399cea316682c5"),
//   "account_id" : "57396a9f9f9fd9551ddd6b12",
//   "job_name" : "chk",
//   "created_by" : "manjusha.nair@vervali.com",
//   "updated_at" : ISODate("2016-05-16T11:05:22.445Z"),
//   "comment" : "",
//   "notification_email" : "",
//   "destination_password" : "",
//   "destination_username" : "",
//   "destination_key" : "",
//   "destination_port" : "",
//   "destination_host" : "",
//   "destination_type" : "s3",
//   "source_type" : "domain",
//   "created_at" : ISODate("2016-05-16T11:05:22.445Z"),
//   "operational_mode" : "running",
//   "__v" : 0
// }

// job stored in queue
// {
// _id: '573f6dd84b90a657078d4a45.154dfc18059',
// destination_host: 'testsjc20-ls01.revsw.net',
// destination_key: '',
// destination_password: 'disaster-257',
// destination_port: '21',
// destination_type: 'ftp',
// destination_username: 'dmitry',
// job_name: '333',
// operational_mode: 'active',
// source_id: '5655668638f201be519f9d87',
// source_type: 'domain',
// status: 2,
// domain_name: 'portal-qa-domain.revsw.net',
// span: { from: 1464042491, to: 1464042851 },
// logs: false,
// file_for_upload: '573f6dd84b90a657078d4a45.154dfc18059.log.zip'
// }
