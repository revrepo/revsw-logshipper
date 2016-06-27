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

var Joi = require('joi');
var App = require('../handlers/app.js');

module.exports = [
    {
        method: 'GET',
        path: '/',
        config: {
        handler: function( req, reply ) {
                reply();
            },
        }
    },

    {
        method: 'GET',
        path: '/v1/healthcheck',
        config: {
        handler: App.healthCheck,
        description: 'Service base health check',
        tags: ['api'],
        validate: {
                params: {},
                query: {}
            }
        }
    },

    {
        method: 'GET',
        path: '/v1/queue',
        config: {
            handler: App.logshipperJobsQueue,
            description: 'Get the jobs are processing now in logshipper queue',
            tags: ['api'],
            validate: {
                params: {},
                query: {}
            }
        }
    }
];

