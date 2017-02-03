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

var _ = require('lodash');
var config = require('config');
var logger = require('revsw-logger')(config.log);
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var exec = Promise.promisify(require('child_process').exec);

var stuff = require('./commons');

//  ----------------------------------------------------------------------------------------------//

var RSyslog = module.exports = {

  /** *********************************
   *  check status of the RSyslog system service
   *
   *  @returns {Promise(boolean)}
   */
  status: function () {

    return exec(config.rsyslog.status_command)
      .then(function (stdout) {
        if (stdout.slice(0, config.rsyslog.running_status_string.length) === config.rsyslog.running_status_string) {
          logger.info('RSyslog.status, running');
          return true;
        } else if (stdout.slice(0, config.rsyslog.dead_status_string.length) === config.rsyslog.dead_status_string) {
          logger.warn('RSyslog.status, dead');
          return false;
        }
        logger.warn('RSyslog.status, unknown state: ' + stdout);
        logger.warn('RSyslog.status, assuming dead');
        return false;
      })
      .catch(function (err) {
        logger.error('RSyslog.status error: ' + err.toString() + ', ' + err.code);
        throw err;
      });
  },

  /** *********************************
   *  restart the RSyslog system service
   *
   *  @returns {Promise()}
   */
  restart: function () {

    return this.status()
      .then(function (running) {
        if (running) {
          return fs.readFileAsync(config.rsyslog.pid_file)
            .then(function (pid) {
              pid = parseInt(pid);
              //  force rsyslog to flush inner buffers
              //  naive workaround to make following restarting time a bit shorter
              process.kill(pid, 'SIGHUP');
            })
            .delay(config.rsyslog.HUP_pause)
            .catch(function (err) {
              //  if pid not found or not readable or whatever - fuck it, log and do nothing
              logger.warn('RSyslog.restart error with pid processing: ' + err.toString());
            });
        }
      })
      .then(function () {
        return exec(config.rsyslog.restart_command);
      })
      .then(function () {
        logger.info('RSyslog.restart: done');
        return true;
      })
      .catch(function (err) {
        logger.error('RSyslog.restart error: ' + err.toString());
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
   * then restart RSyslog system service
   * in a case of empty domains list the conf file will be empty
   *
   *  @param {array} domain names
   *  @returns {Promise()}
   */
  reloadConfig: function (domains) {

    return fs.readFileAsync(stuff.toRootPath(config.rsyslog.config_src), {encoding: 'utf8'})
      .then(function (stencil) {
        if (stencil.indexOf(config.rsyslog.domains_list_tag) === -1) {
          throw new Error('RSyslog config parsing failed - Domains List Tag not found');
        }
        var tagpos = stencil.indexOf(config.rsyslog.header_comment_tag);
        if (tagpos === -1) {
          logger.warn('RSyslog.reloadConfig: config parsing warning - Header Comment Tag not found');
        }
        if (domains.length) {
          var domainsString = '';
          domains.forEach(function(domain) {
            if (domain.indexOf('*') === -1) {
              domainsString += '$!domain == \'' + domain + '\' or\n';
            } else {
              domainsString += '$!domain contains \'' + domain.substring(1) + '\' or\n';
            }
          });
          // remove last or \n
          domainsString = domainsString.substring(0, domainsString.length - 4);
          
          stencil = stencil.replace(config.rsyslog.domains_list_tag, domainsString);
          if (tagpos !== -1) {
            stencil = stencil.replace(config.rsyslog.header_comment_tag, '\n# Last update: ' + (new Date()).toISOString());
          }
        } else {
          tagpos = stencil.indexOf(config.rsyslog.program_tag);
          stencil = (tagpos !== -1 ? stencil.slice(0, tagpos) : '');
          stencil = stencil.replace(config.rsyslog.header_comment_tag, '\n# Last update: ' + (new Date()).toISOString());
          stencil = stencil + '\n  stop\n}';
        }

        return fs.writeFileAsync(config.rsyslog.config_dest, stencil);
      })
      .then(function () {
        logger.info('RSyslog.reloadConfig: done');
        return this.restart();
      }.bind(this))
      .catch(function (err) {
        logger.error('RSyslog.reloadConfig error: ' + err.toString());
        throw err;
      });
  }


};
