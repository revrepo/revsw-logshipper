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

// # Accounts Resource object

// Requiring `BaseResource`
var BasicResource = require('./basic');
// Requiring constants
var Constants = require('./../../common/constants');
var Methods = Constants.API.METHODS;

// Keys
var accountIdKey = 'accountId';
var statementKey = 'statementId';
var billingPlanHandleKey = 'billingPlanHandleId';

// Config for resource
var resourceConfig = {
  idKey: accountIdKey,
  name: 'accounts',
  path: '/accounts/{' + accountIdKey + '}',
  methods: [
    Methods.CREATE,
    Methods.READ_ALL,
    Methods.READ_ONE,
    Methods.UPDATE,
    Methods.DELETE
  ],
  nestedResources: [
    {
      idKey: null,
      name: 'billingProfile',
      path: '/billing_profile',
      methods: [
        Methods.CREATE
      ]
    },
    {
      idKey: statementKey,
      name: 'statements',
      path: '/statements/{' + statementKey + '}',
      methods: [
        Methods.READ_ALL,
        Methods.READ_ONE
      ],
      nestedResources: [
        {
          idKey: null,
          name: 'pdf',
          path: '/pdf',
          methods: [
            Methods.READ_ALL
          ]
        }
      ]
    },
    {
      idKey: null,
      name: 'transactions',
      path: '/transactions',
      methods: [
        Methods.READ_ALL
      ]
    },
    {
      idKey: billingPlanHandleKey,
      name: 'subscriptionPreview',
      path: '/subscription_preview/{' + billingPlanHandleKey + '}',
      methods: [
        Methods.READ_ONE
      ]
    },
    {
      idKey: null,
      name: 'subscriptionSummary',
      path: '/subscription_summary',
      methods: [
        Methods.READ_ALL
      ]
    }
  ]
};

// Creating new instance of BaseResource which is going to represent the API
// `accounts resource`
module.exports = new BasicResource(resourceConfig);
