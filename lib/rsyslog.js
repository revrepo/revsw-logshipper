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
 *  RSyslog utils
 */

/*jslint node: true */
'use strict';

//  ----------------------------------------------------------------------------------------------//

var _ = require( 'lodash' );
var config = require( 'config' );
var logger = require( 'revsw-logger' )( config.log );
var promise = require( 'bluebird' );
var fs = promise.promisifyAll( require( 'fs' ) );
var exec = promise.promisify( require( 'child_process' ).exec );

var stuff = require( './commons' );

//  ----------------------------------------------------------------------------------------------//

var RSyslog = module.exports = {

  /** *********************************
   *  check status of the RSyslog system service
   *
   *  @returns {Promise()}
   */
  status: function() {

    var pid = false;
    return fs.readFileAsync( config.rsyslog.pid_file )
      .then( function( file ) {
        pid = parseInt(file);
      })
      .then( function() {
        process.kill( pid, 0 );
      })
      .catch( function( err ) {
        if ( err.code && err.code !== 'ESRCH' /*EPERM most probably*/ ) {
          return;
        }
        logger.error( 'RSyslog.status error: rsyslog process not running.' );
        throw err;
      })
      .then( function() {
        return pid;
      });
  },

  /** *********************************
   *  restart the RSyslog system service
   *
   *  @returns {Promise()}
   */
  restart: function() {

    return this.status()
      .then( function( pid ) {
        process.kill( pid, 'SIGHUP' );  //  naive workaround to make rsyslog restarting a bit faster
      })
      .delay( config.rsyslog.HUP_pause )
      .then( function() {
        return exec( config.rsyslog.restart_command );
      })
      .then( function() {
        logger.info( 'RSyslog.restart: done' );
      })
      .catch( function( err ) {
        logger.error( 'RSyslog.restart error: ' + err.toString() );
        throw err;
      });
  },

  /** *********************************
   *  re-write config like
   * if ( $!domain == 'portal-qa-domain.revsw.net' or
   *      $!domain == 'test-zero.revsw.net' or
   *      .....
   *      $!domain == 'test-fifty.revsw.net' ) then { .....
   *
   *  then restart RSyslog system service
   *
   *  @param {array} domain names
   *  @returns {Promise()}
   */
  reloadConfig: function( domains ) {

    return fs.readFileAsync( stuff.toRootPath( config.rsyslog.config_src ), { encoding: 'utf8' } )
      .then( function( stencil ) {
        if ( domains.length ) {
          domains = '$!domain == \'' + domains.join('\' or\n       $!domain == \'') + '\'';
          stencil = stencil
            .replace( config.rsyslog.header_comment_tag, '\n# Last update: ' + (new Date()).toISOString() )
            .replace( config.rsyslog.domains_list_tag, domains );
        } else {
          var commenttagpos = stencil.indexOf( config.rsyslog.header_comment_tag );
          stencil = ( commenttagpos !== -1 ? stencil.slice( 0, commenttagpos ) : '# Warning: Header Comment Tag not found' ) +
            '\n# Last update: ' + (new Date()).toISOString();
        }

        return fs.writeFileAsync( config.rsyslog.config_dest, stencil );
      })
      .then( function() {
        logger.info( 'RSyslog.reloadConfig: done' );
        return this.restart();
      })
      .catch( function( err ) {
        logger.error( 'RSyslog.reloadConfig error: ' + err.toString() );
        throw err;
      });
  },



};
