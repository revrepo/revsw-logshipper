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

// function LogShippingJob(mongoose, connection, options) {
//   this.options = options;
//   this.Schema = mongoose.Schema;
//   this.ObjectId = this.Schema.ObjectId;

//   this.LogShippingJobSchema = new this.Schema({
//     'job_name': String,
//     'operational_mode': {type: String, default: 'stop'},
//     'account_id': String,
//     'created_by': String,
//     'created_at': {type: Date, default: Date.now},
//     'source_type': {type: String, default: 'domain'},
//     'source_id': String,
//     'destination_type': {type: String, default: 's3' },
//     'destination_host': {type: String, default: ''},
//     'destination_port': {type: String, default: ''},
//     'destination_key': {type: String, default: ''},
//     'destination_username': {type: String, default: ''},
//     'destination_password': {type: String, default: ''},
//     'notification_email': {type: String, default: ''},
//     'comment': {type: String, default: ''},
//     'updated_by': String,
//     'updated_at': {type: Date, default: Date.now}
//   });

//   this.model = connection.model('LogShippingJob', this.LogShippingJobSchema, 'LogShippingJob');
// }

//  Job
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



//  ---------------------------------
var db_ = null,
  //  cashed for brevity
  job_coll_name_ = config.service.revportal_db.job_collection;
  app_coll_name_ = config.service.revportal_db.app_collection;
  domain_coll_name_ = config.service.revportal_db.domain_collection;


//  ----------------------------------------------------------------------------------------------//
var RevportalDB = module.exports = {

  /** *********************************
   *
   */
  connect: function( force ) {

    if ( db_ && conn_ && !force ) {
      return promise.resolve( true );
    }

    return mongo.MongoClient.connectAsync( config.service.revportal_db.db_connection )
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
   *  @returns the shipping jobs in form of
   *  promise({
   *    domains: {
   *      <_id>: {
   *        jobs: [{
   *          _id" : ObjectId(...),
   *          job_name" : "chk",
   *          source_type" : "domain",
   *          operational_mode" : "running",
   *          sourse_id: ...........
   *        }, {...}]
   *      },
   *      <_id>: {
   *        jobs: [{
   *          _id" : ...........
   *        }]
   *      }, ...........
   *    },
   *    apps: { same as for domains }
   *  })
   */
  loadShippingJobsList: function() {

    return ( db_ ? promise.resolve( true ) : this.connect() )
      .then( function() {
        var coll = db.collection( job_coll_name_ );
        return coll.find({
          operational_mode: 'active', //  <-- TODO: clarify
          destination_port: { $ne: '' },
          destination_host: { $ne: '' }
        }, {
          account_id: 0,
          job_name: 0,
          created_by: 0,
          updated_at: 0,
          comment: 0,
          notification_email: 0,
          created_at: 0,
          __v: 0 }).toArrayAsync();
      })
      .then( function( data ) {
        var jobs = {
          domains: {},
          apps: {}
        }
        data.forEach( function( item ) {
          var cont = item.source_type === 'domain' ? 'domains' : 'apps',
            id = item._id.toString();
          if ( !jobs[cont][id] ) {
            jobs[cont][id] = { jobs: [] };
          };
          jobs[cont][id].jobs.push( item );
        });
        return jobs;
      })
      .catch( function( err ) {
        logger.error( 'RevportalDB.loadShippingJobsList: ' + err.toString() );
        throw err;
      });
  },

  /** *********************************
   *  load domains and update names in the passed jobs <-- domains log record contain domain name but no id
   *
   *  @param {object} derived from the loadShippingJobsList
   *  @returns updated shipping jobs
   *  promise({
   *    domains: {
   *      <_id>: {
   *        jobs: [{
   *          _id" : ObjectId(...),
   *          source_type" : "domain", .......
   *        }, {...}],
   *        domain_name: 'somedomain.com'     <-- here
   *      }
   *    },
   *    apps: {  }
   *  })
   */
  loadDomainNames: function( jobs ) {

    return ( db_ ? promise.resolve( true ) : this.connect() )
      .then( function() {
        var coll = db.collection( domain_coll_name_ );
        var ids = Object.keys( jobs.domains );
        if ( ids.length ) {
          ids = ids.map( function( id ) {
            return new ObjectID( id );
          });
          return coll.find({ _id: { $in: ids } }, { domain_name: 1 }).toArrayAsync();
        }
        return [];
      })
      .then( function( data ) {
        data.forEach( function( item ) {
          jobs.domains[item._id.toString()].domain_name = item.domain_name;
        });
        return jobs;
      })
      .catch( function( err ) {
        logger.error( 'RevportalDB.loadDomainNames: ' + err.toString() );
        throw err;
      });
  },

  /** *********************************
   *  combination of the above methods
   */
  loadJobs: function() {

    var self = this;
    return this.loadShippingJobsList()
      .then( function( jobs ) {
        return self.loadDomainNames( jobs );
      })
      .catch( function( err ) {
        logger.error( 'RevportalDB.loadJobs: ' + err.toString() );
        throw err;
      });
  },

};
