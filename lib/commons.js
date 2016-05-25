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
 *  common stuff
 */

/*jslint node: true */
'use strict';

//  ----------------------------------------------------------------------------------------------//
var _ = require('lodash');
var path = require('path');
var config = require('config');
var logger = require('revsw-logger')(config.log);


var stuff = module.exports = {

  toUploadsPath: function( filename ) {
    return path.join( __dirname, '..', config.uploads_dir, filename );
  },

  //  shipping statuses
  SS_READY: 0,
  SS_COLLECTED: 1,
  SS_FILED: 2,
  SS_SHIPPED: 3,
  SS_ERROR: 4,
  SS_DELAYED: 5,
  statusNames: ['READY','COLLECTED','FILED','SHIPPED','ERROR','DELAYED'],

  //  shipper types
  ST_STREAM: 0,
  ST_FILE: 1,
  typeNames: ['STREAM','FILE'],

  makeSpan: function() {
    var to = Math.floor( Date.now() / 1000 )/*right now in seconds*/ - config.logs_shipping_standoff_sec;
    var from = to - config.logs_shipping_span_sec - config.logs_shipping_reserve_sec;
    logger.debug( 'stuff.makeSpan: from ' + from + ', ' + ( new Date(from*1000) ).toUTCString() + '; to ' + to + ', ' + ( new Date(to*1000) ).toUTCString() );
    return {
      from: from,
      to: to
    }
  },


};
