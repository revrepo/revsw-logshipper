/*************************************************************************
 *
 * REV SOFTWARE CONFIDENTIAL
 *
 * [2013] - [2015] Rev Software, Inc.
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

// # Basic Resource object

// Requiring config.
var config = require('config');

// Required third-party libraries.
var Promise = require('bluebird');
var request = require('supertest-as-promised');

// Required components form rest-api framework.
var Session = require('./../session');
var Constants = require('./../../common/constants');
var Methods = Constants.API.METHODS;


// #### Helper function _contains
//
// Validate is specified array contains specified element.
var _contains = function (list, element) {
  return list && list.indexOf(element) >= 0;
};

// #### Helper function getRequest
//
//  Create an instance of super-test request which already has the reference
//  to the REST API HOST to point.
//  Also, the optional `data` argument may contain host and version data to override
//  the config's parameters
var getRequest = function () {
  var host = config.get('api.host');
  var apiVersion = config.get('api.version');
  return request( (host.protocol + '://' + host.name + ':' + host.port + '/' + apiVersion) );
};

// #### Helper function setUserToRequest
//
// In case there is a session with a current user, authenticates that user to
// perform the API call.
//
// Receives as param the request instance
var setUserToRequest = function (request) {
  var user = Session.getCurrentUser();
  if (user && user.token) {
    return request.set('Authorization', 'Bearer ' + user.token);
  }
  return request;
};

// #### Helper function getPath
//
// Return s the URI resource to consume from the REST API.
//
// Receives as param the request instance
var getPath = function (data, ids) {
  var path = data.path;
  if (typeof ids === 'object') {
    for (var key in ids) {
      if (ids.hasOwnProperty(key)) {
        path = path.replace('/{' + key + '}', (ids[key] ? '/' + ids[key] : ''));
      }
    }
  }
  else {
    if (data.idKey) {
      path = path.replace('/{' + data.idKey + '}', ids ? '/' + ids : '');
    }
  }
  path = path.replace(/\/\{.+\}/, '');
  //console.log('        >>> Resource PATH:', path);
  return path;
};

var getResourceBuilder = function (nestedResource, path, parentIdKey) {
  var baseResource = nestedResource;
  var data = {
    path: path,
    idKey: parentIdKey
  };
  // Return resource build which depends on
  return function (id) {
    var resource = JSON.parse(JSON.stringify(baseResource));
    if (!resource.isAbsolutePath) {
      // Path = parent-resource-path + nested-resource-path
      resource.path = getPath(data, id) + resource.path;
    }
    return new BasicResource(resource);
  };
};

/**
 * ### BasicResource.constructor()
 *
 * Base implementation for Resource which defines all actions that could be
 * performed by triggering requests (using supported methods) to the REST API.
 *
 * @param {object} data, object with configuration properties. For instance:
 *
 *     {
 *       name: 'accounts',
 *       paht: '/accounts'
 *     }
 * @returns {object} which allows the user to perform some actions. With the
 * following schema:
 *
 *     {
 *         getAll: Function,
 *         getOne: Function,
 *         createOne: Function,
 *         createOneAsPrerequisite: Function,
 *         update: Function,
 *         deleteOne: Function,
 *         deleteMany: Function,
 *         deleteAllPrerequisites: Function,
 *         rememberAsPrerequisite: Function,
 *         forgetPrerequisite: Function
 *     }
 *
 * @constructor
 *
 */
var BasicResource = function (data) {

  // Private properties
  var _cache = [];
  var _resource = {};

  // Generating nested resources id exist
  if (data.nestedResources) {
    for (var i = 0, len = data.nestedResources.length; i < len; i++) {
      var nestedResource = data.nestedResources[i];
      // Append nested-resource builder to parent
      _resource[nestedResource.name] =
        getResourceBuilder(nestedResource, data.path, data.idKey);
    }
  }

  if (_contains(data.methods, Methods.READ_ALL)) {
    /**
     * ### BasicResource.getAll()
     *
     * Sends a GET request to the API in order to get all object from the
     * requested type.
     *
     * @param {object} query, will be transformed to a query string
     *
     * @returns {object} the supertest-as-promised instance
     */
    _resource.getAll = function (query) {
      var location = getPath(data);
      var request = getRequest()
        .get(location)
        .query(query);
      return setUserToRequest(request);
    };
  }

  if (_contains(data.methods, Methods.READ_ONE)) {
    /**
     * ### BasicResource.getOne()
     *
     * Sends a GET request to the API in order to get the object from the
     * requested type.
     *
     * @param {String} id, the uuid of the object
     *
     * @param {object} query, will be transformed to a query string
     *
     * @returns {object} the supertest-as-promised instance
     */
    _resource.getOne = function (id, query) {
      var location = getPath(data, id);
      var request = getRequest()
        .get(location)
        .query(query);
      return setUserToRequest(request);
    };
  }

  if (_contains(data.methods, Methods.CREATE)) {
    /**
     * ### BasicResource.createOne()
     *
     * Creates a new object form the requested type.
     *
     * @param {object} object, the supertest-as-promised instance
     * @param {object} query, will be transformed to a query string
     * @param {object} param, will be transformed to a query string in case
     * first para is object ID (string)
     *
     * @returns {object} the supertest-as-promised instance
     */
    _resource.createOne = function (object, query, param) {
      var location;
      if (typeof object === 'string') {
        location = getPath(data, object);
        object = query;
        query = param;
      }
      else {
        location = getPath(data);
      }
      var request = getRequest()
        .post(location)
        .query(query)
        .send(object);
      return setUserToRequest(request);
    };
  }

  if (_contains(data.methods, Methods.CREATE)) {
    /**
     * ### BasicResource.createOneAsPrerequisite()
     *
     * Creates a new object form the requested type and stores its ID in the
     * _cache object property (which stores all IDs from all pre-requisite
     * objects created). all of this is to make sure application under testing
     * does not become messed up after the testing.
     *
     * @param {object} object, the supertest-as-promised instance
     *
     * @returns {object} the supertest-as-promised instance
     */
    _resource.createOneAsPrerequisite = function (object) {
      return this.createOne(object)
        .then(function (res) {
          _cache.push(res.body.object_id);
          return res;
        });
    };
  }

  if (_contains(data.methods, Methods.CREATE)) {
    /**
     * ### BasicResource.createManyIfNotExist()
     *
     * Sends the CREATE request to the API in order to create specified objects.
     * All requests are run one after other using promises.
     *
     * NOTE: If item to create already exists. It won't propagate the error.
     *
     * @param {Array} items, list/array of the items of the objects to create
     *
     * @returns {Object} a promise instance
     */
    _resource.createManyIfNotExist = function (items) {
      var me = this;
      return Promise.each(items, function (item) { // One promise after other
        return me
          .createOne(item)
          .then(function (res) {
            if (res.body.statusCode && parseInt(res.body.statusCode) !== 200) {
              console.log('      > Cannot create item:', item,
                res.body.message);
            }
            else {
              console.log('      > Item created: (' + res.body.message + ')');
            }
          })
          .catch(function (err) {
            console.log('      > Cannot create item:', item, err);
          }); // We catch any errors as we don't want them to be propagated
      });
    };
  }

  if (_contains(data.methods, Methods.UPDATE)) {
    /**
     * ### BasicResource.update()
     *
     * Sends the PUT request to the API in order to update specified object with
     * given data.
     *
     * @param {string} id, the uui of the object
     * @param {object} object with the information/properties from the object
     * to update.
     * @param {object} query, will be transformed to a query string
     *
     * @returns {object} the supertest-as-promised instance
     */
    _resource.update = function (id, object, query) {
      var location = getPath(data, id);
      var request = getRequest()
        .put(location)
        .query(query)
        .send(object);
      return setUserToRequest(request);
    };
  }

  if (_contains(data.methods, Methods.DELETE)) {
    /**
     * ### BasicResource.deleteOne()
     *
     * Sends the DELETE request to the API in order to delete specified object
     * with given ID.
     *
     * @param {string} id, the uui of the object
     *
     * @returns {object} the supertest-as-promised instance
     */
    _resource.deleteOne = function (id) {
      var location = getPath(data, id);
      var request = getRequest()
        .del(location);
      return setUserToRequest(request);
    };
  }

  if (_contains(data.methods, Methods.DELETE)) {
    /**
     * ### BasicResource.deleteMany()
     *
     * Sends the DELETE request to the API in order to delete specified objects
     * with given IDs. All request are run in parallel using promises.
     *
     * @param {Array} ids, list/array of the uuids of the objects to delete
     *
     * @returns {object} a promise instance
     */
    _resource.deleteMany = function (ids) {
      var me = this;
      return Promise.each(ids, function (id) { // One promise after other
        return me
          .deleteOne(id)
          .then(function () {
            console.log('      > Item deleted:', id);
          }); // We don't catch any errors as we want them to be propagated
      });
    };
  }

  if (_contains(data.methods, Methods.DELETE)) {
    /**
     * ### BasicResource.deleteManyIfExist()
     *
     * Sends the DELETE request to the API in order to delete specified objects
     * with given IDs. All requests are run run one after other using promises.
     *
     * NOTE: Items will be delete only if they exist. If not, it won't do
     * anything.
     *
     * @param {Array} ids, list/array of the uuids of the objects to delete
     *
     * @returns {object} a promise instance
     */
    _resource.deleteManyIfExist = function (ids) {
      var me = this;
      return Promise.each(ids, function (id) { // One promise after other
        return me
          .deleteOne(id)
          .then(function (res) {
            var msg;
            if (res.body.statusCode &&
              (parseInt(res.body.statusCode) < 200 ||
              parseInt(res.body.statusCode) >= 300)) {
              msg = '      > Cannot delete item:';
            }
            else {
              msg = '      > Item deleted:';
            }
            console.log(msg, id, '(' + res.body.message + ')');
          })
          .catch(function () {
            console.log('Do not do anything else as item does not exist:', id);
          }); // We catch any errors as we don't want them to be propagated
      });
    };
  }

  if (_contains(data.methods, Methods.DELETE)) {
    /**
     * ### BasicResource.deleteAllPrerequisites()
     *
     * @returns {object} the supertest-as-promised instance
     */
    _resource.deleteAllPrerequisites = function (done) {
      return done();
      /*
       return this.deleteMany(_cache)
       .then(function () {
       // What to do in case a pre-requisite is deleted successfully?
       return done();
       })
       .catch(function () {
       // What to do in case a pre-requisite is NOT deleted successfully?
       return done();
       });*/
    };
  }

  /**
   * ### BasicResource.rememberAsPrerequisite()
   *
   * Register an ID in order to handle it later (while cleaning up the
   * application) as a pre-requisite.
   *
   * @param {string} id, the uui of the object
   */
  _resource.rememberAsPrerequisite = function (id) {
    var index = _cache.indexOf(id);
    if (index === -1) {
      _cache.push(id);
    }
  };

  /**
   * ### BasicResource.forgetPrerequisite()
   *
   * Forgets an ID in order to avoid handling it later (while cleaning up the
   * application) as a pre-requisite.
   *
   * @param {string} id, the uui of the object
   */
  _resource.forgetPrerequisite = function (id) {
    var index = _cache.indexOf(id);
    if (index > -1) {
      _cache.splice(index, 1);
    }
  };

  return _resource;
};

// Exports the `BasicResource` class as module
module.exports = BasicResource;
