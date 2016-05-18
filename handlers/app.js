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

/*jslint node: true */
'use strict';

//  ----------------------------------------------------------------------------------------------//

var boom = require( 'boom' );
var config = require('config');
var logger = require('revsw-logger')(config.log);
var promise = require('bluebird');

//  ---------------------------------
var logshipper_db = require( '../lib/logshipper_db');
var revportal_db = require( '../lib/revportal_db');

//  ----------------------------------------------------------------------------------------------//

exports.healthcheck = function( request, reply ) {

  // logger.info( 'healthcheck!' );
  promise.all([
      revportal_db.health(),
      logshipper_db.health()
    ])
    .then( function( states ) {
      var res = {
        data: {
          revportal_database: states[0],
          logshipper_database: states[1]
        }
      };
      reply( res ).type('application/json; charset=utf-8');
    });

};

