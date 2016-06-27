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

  toRootPath: function( path_ ) {
    return path.join( __dirname, '..', path_ );
  },

  toUploadsPath: function( filename ) {
    return path.join( __dirname, '..', config.uploads_dir, filename );
  },

  //  job shipping statuses
  SS_READY: 0,
  SS_COLLECTED: 1,
  SS_FILED: 2,
  SS_SHIPPED: 3,
  SS_ERROR: 4,
  SS_DELAYED: 5,
  shippingStatusNames: ['READY','COLLECTED','FILED','SHIPPED','ERROR','DELAYED'],

  //  queue statuses
  QS_READY: 0,
  QS_RUNNING: 1,
  QS_ERROR: 2,
  queueStatusNames: ['READY','RUNNING','ERROR'],

  //  shipper types
  ST_UNKNOWN: 0,
  ST_STREAM: 1,
  ST_FILE: 2,
  shipperTypeNames: ['UNKNOWN','STREAM','FILE'],

};
