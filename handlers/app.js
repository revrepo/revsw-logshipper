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
var stuff = require( '../lib/commons' );
var logshipperDB = require( '../lib/logshipperDB');
var revportalDB = require( '../lib/revportalDB');

//  ----------------------------------------------------------------------------------------------//

exports.healthcheck = function( request, reply ) {

  var fs = promise.promisifyAll( require('fs') );
  var version = 'undefined';

  promise.resolve()
    .then( function() {
      return promise.all([
          revportalDB.health(),
          logshipperDB.health(),
          fs.readFileAsync( stuff.toRootPath( config.version_file ), { encoding: 'utf8' })
        ]);
    })
    .then( function( states ) {
      version = states[2].trim();
      var msg = [];
      if ( !states[0].good ) {
        msg.push( states[0].msg );
      }
      if ( !states[1].good ) {
        msg.push( states[1].msg );
      }
      if ( msg.length ) {
        msg = msg.join('; ');
        reply( boom.badImplementation( msg, {
          message: msg,
          version: version
        } ) );
      } else {
        reply({
          message: 'Everything is OK',
          version: version
        });
      }
    })
    .catch( function( err ) {
      var msg = err.toString();
      reply( boom.badImplementation( msg, {
        message: msg,
        version: version
      } ) );
    });
};

