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
 *  Log Shipping Dispatcher
 */

/*jslint node: true */
'use strict';

//  ----------------------------------------------------------------------------------------------//

var _ = require('lodash');
var config = require('config');
var logger = require('revsw-logger')(config.log);
var promise = require('bluebird');

//  ---------------------------------
var logshipper_db = require( './logshipper_db');
var revportal_db = require( './revportal_db');
var logshippers = require( './logshippers');


//  ----------------------------------------------------------------------------------------------//

var jobs_ = {};

var LogShippingDispatcher = module.exports = {

  //  ---------------------------------
  run: function() {

    return revportal_db.loadJobs()
      .then( function( jobs ) {
        jobs_ = jobs;   //  TODO: compare prior and current jobs lists, `do some` with the removed
        var span = Math.floor( Date.now() / 1000 )/*sec*/ -
          Math.floor( config.service.logs_shipping_span * 1.5/*safety reserve to catch late records*/ );
        return collectDomainLogs( jobs, span );
      })
      .then( function( jobs ) {

        //  here we go

      })
      .catch( function( err ) {

      });
  }

};
