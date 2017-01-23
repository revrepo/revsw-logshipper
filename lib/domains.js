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
 *  Domains List toolbelt
 */

/*jslint node: true */
'use strict';

//  ----------------------------------------------------------------------------------------------//

var _ = require('lodash');
var config = require('config');
var logger = require('revsw-logger')(config.log);
var Promise = require('bluebird');

var DomainConfigs = Promise.promisifyAll(require('../models/portal/DomainConfig').DomainConfigs);

/** *********************************
 *  Simple object to store domain {id:{name,status},id:{...}, ...} hashes
 *  utility class supposed to be singleton
 */

var Domains = function () {
  this.hash = {};
  this.changed = false;
};

/** *********************************
 *  update the hash with a new list of domain IDs and set `changed` status
 *
 *  @param {array}  domain ids, supposed to be distinct
 *  @returns {Promise()}
 */
Domains.prototype.update = function (ids) {

  var newdomains = [],
    self = this;
  self.changed = false;

  // ids = _.uniq( ids );  //  remove doubles
  // status field stores 2 for the active domain and 0 for not
  ids.forEach(function (id) {
    if (!self.hash[id]) {
      newdomains.push(id);
      self.changed = true;
    } else {
      self.hash[id].status++;
      //  status now means 0 === remains dead, 1 === new active, 2 === new dead, 3 === remains active
    }
  });

  return DomainConfigs.listNamesByIdsAsync(newdomains)
    .then(function (domains) {
      domains.forEach(function (d) {
        var proxyConfig = d.proxy_config;
        
        if (proxyConfig) {
          self.hash[d._id] = {
              name: d.domain_name,
              aliases: proxyConfig.domain_aliases || [],
              wildcard_alias: proxyConfig.domain_wildcard_alias || null,
              status: 1
          };
        } else {
          self.hash[d._id] = {
            name: d.domain_name,
            aliases: [],
            wildcard_alias: null,
            status: 1
          };
        }       
      });

      //  normalize statuses
      _.forEach(self.hash, function (d) {
        self.changed = self.changed || ( d.status === 1 || d.status === 2 );
        d.status = ( d.status % 2 ) * 2;  //  1 or 3 --> 2
      });

      logger.info('Domains.update, ' + domains.length + ' domain id:name entries added, statuses are ' + ( self.changed ? '' : 'not ' ) + 'changed');
    });

};

/** *********************************
 *  returns array of active domain names
 *
 *  @returns {array}
 */
Domains.prototype.listOfActive = function () {
  // return all domain names with status === 2
  var names = [];
  
  _.values(this.hash)
  .filter(function (d) {
    return d.status === 2;
  })
  .forEach(function (d) {
    names.push(d.name);

    if (d.aliases.length) {
      d.aliases.forEach(function (a) {
        names.push(a);
      });
    }
    if (d.wildcard_alias) {
      names.push(d.wildcard_alias);
    }
  });
  
  return names;
};

/** *********************************
 *  id --> name mapper
 *
 *  @returns {string} domain name
 */
Domains.prototype.getName = function (id) {
  return this.hash[id] && this.hash[id].name;
};

/** *********************************
 *  id
 *
 *  @returns {array} domain aliases
 */
Domains.prototype.getAliases = function (id) {
  return this.hash[id] && this.hash[id].aliases;
};

/** *********************************
 *  id
 *
 *  @returns {array} domain wildcard aliase
 */
Domains.prototype.getWildcardAlias = function (id) {
  return this.hash[id] && this.hash[id].wildcard_alias;
};

//  ----------------------------------------------------------------------------------------------//
module.exports = Domains;

