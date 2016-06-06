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
 *  simple(st) pub/sub implementation
 */

/*jslint node: true */
'use strict';

//  ----------------------------------------------------------------------------------------------//

// var _ = require( 'lodash' );
// var config = require( 'config' );
// var logger = require( 'revsw-logger' )( config.log );
// var promise = require( 'bluebird' );

// var stuff = require( './commons' );

//  ----------------------------------------------------------------------------------------------//

var PubSub = function() {
  this.events = {};
};

/** *********************************
 *  subscribe
 *
 */
PubSub.prototype.on = function( event, cb ) {
  if ( !this.events[event] ) {
    this.events[event] = [];
  }
  this.events[event].push( cb );
};

/** *********************************
 *  unsubscribe
 *
 */
PubSub.prototype.off = function( event, cb ) {
  if ( !this.events[event] ) {
    return;
  }
  var found = this.events[event].indexOf( cb );
  if ( found !== -1 ) {
    this.events[event].splice( found, 1 );
  }
};

/** *********************************
 *  publish
 *
 */
PubSub.prototype.fire = function( event ) {
  if ( !this.events[event] ) {
    return;
  }
  var args_ = [].splice.call( arguments, 1 );
  this.events[event].forEach( function( cb ) {
    cb.apply( null, args_ );
  });
};

module.exports = PubSub;

