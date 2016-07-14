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

var elastic = require('elasticsearch');
var Promise = require('bluebird');

var ElasticSearchClient = function () {
  this.client = false;
};

ElasticSearchClient.prototype.connect = function (host, port, callback) {
  var self = this;

  if (!self.client) {
    try {
      self.client = new elastic.Client({
        host: host + ':' + port,
        requestTimeout: 30000,
        log: false
      });

      callback(null);
    } catch (error) {
      callback(error);
    }
  } else {
    callback(new Error('Client is already connected'), null);
  }
};

ElasticSearchClient.prototype.list = function (searchType, searchIndex, callback) {
  var self = this;
  if (self.client) {
    var request = {
      index: searchIndex,
      type: searchType
    };

    self.client.search(request, function (err, res) {
      if (!err) {
        callback(null, res.hits.hits);
      } else {
        callback(err, null);
      }
    });
  } else {
    callback(new Error('elastic client is not connected'), null);
  }
};


ElasticSearchClient.prototype.deleteMany = function (queue, callback) {
  var self = this;

  if (self.client) {
    var request = {
      body: queue // [{ delete: { _index: 'myindex', _type: 'mytype', _id: 3 } }, ...]
    };
    self.client.bulk(request, function (err, resp) {
      callback(err, resp);
    });
  } else {
    callback(new Error('elastic client is not connected'), null);
  }
};

ElasticSearchClient.prototype.deleteIndex = function (index, callback) {
  var self = this;

  if (self.client) {
    self.client.indices.delete({
      index: index,
      ignore: [404]
    }, function (err, resp) {
      callback(err, resp);
    });
  } else {
    callback(new Error('elastic client is not connected'), null);
  }
};

ElasticSearchClient.prototype.close = function (callback) {
  var self = this;
  if (self.client) {
    self.client = false;
    callback();
  } else {
    callback(new Error('elastic client is not connected'), null);
  }
};

module.exports = ElasticSearchClient;