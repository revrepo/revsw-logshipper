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

// # Main API Resource

// Requiring all resources to apply/attach to main `API` object.
var AccountsResource = require('./accounts');
var AppsResource = require('./apps');
var AuthenticateResource = require('./authenticate');
var DomainConfigsResource = require('./domainConfigs');
var UsersResource = require('./users');
var LogShippingJobsResource = require('./logShippingJobs');

// Set of all resources that the REST API service provides.
module.exports = {
    accounts: AccountsResource,
    apps: AppsResource,
    authenticate: AuthenticateResource,
    domainConfigs: DomainConfigsResource,
    users: UsersResource,
    logShippingJobs: LogShippingJobsResource
};
