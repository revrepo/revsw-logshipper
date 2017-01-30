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

'use strict';

var _ = require('lodash');
var config = require('config');
var promise = require('bluebird');
var logger = require('revsw-logger')(config.log);
var sendgrid = require('sendgrid')(config.get('sendgrid_api_key'));

/** *********************************
 *  Send a email using SendGrid
 *
 *  @param {Object} mail options
 *  @param {Function} callback(err,data), optional
 *  @returns {promise} if callback is absent
 */
exports.sendMail = function(mailOptions, cb) {

  if (!_.isObject(mailOptions) ||
    !_.has(mailOptions, 'to') ||
    !_.has(mailOptions, 'subject') ||
    (!_.has(mailOptions, 'text') &&
    !_.has(mailOptions, 'html'))) {
    logger.error('mail::sendMail:Wrong mail options');
    var err = new Error('mail::sendMail:Wrong mail options');
    return cb ? cb( err ) : promise.reject( err );
  }

  if (!mailOptions.from) {
    mailOptions.from = config.get('support_email');
  }
  if (!mailOptions.fromname) {
    mailOptions.fromname = config.get('support_name');
  }

  logger.info('sendMail:: Calling SendGrid to send the following email to user ' + mailOptions.to +
    ': ' + JSON.stringify(mailOptions));

  if ( cb ) {
    return sendgrid.send(mailOptions, cb);
  }

  //  in case of callback absence return promise
  return new promise( function( resolve, reject ) {
    sendgrid.send(mailOptions, function( err, data  ) {
      if ( err ) {
        return reject( err );
      }
      return resolve( data );
    });
  });

};
