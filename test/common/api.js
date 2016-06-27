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

// # API object

var Session = require('./session');
var APIHelpers = require('./helpers/api');
var APIResources = require('./resources/api');

// This allows to overpass SSL certificate check
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// `API` object that abstracts all functionality from the REST API being tested.
// Defines all resources and other components needed for testing.
module.exports = {

    // Session, will help us to _remember_ which user is currently being used.
    session: Session,

    // A set of all helpers for the REST API service.
    helpers: APIHelpers,

    // A set of all resources that the REST API service provides.
    resources: APIResources
};
