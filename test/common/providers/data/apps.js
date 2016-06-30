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

// # Apps Data Provider object
//
// Defines some methods to generate valid and common APP test data. With
// common we mean it oes not have anything special on it.
//
// From there, you can modify and get bogus, invalid or other type of data
// depending on your test needs.
var AppsDataProvider = {

  prefix: 'API_TEST_APP_',

  /**
   * ### AppsDataProvider.generateOne()
   *
   * Generates valida data that represents an APP which APPS REST API
   * end points accept.
   *
   * @param {String} accountId, which will be used in the app data.
   * @param {String} prefix, a prefix value to put in the name
   *
   * @returns {Object} app info with the following schema
   *
   *     {
   *         account_id: String,
   *         app_name: String,
   *         app_platform: String
   *     }
   */
  generateOne: function (accountId, prefix) {
    return {
      account_id: accountId,
      app_name: (prefix ? prefix + '_' : '' ) + this.prefix + Date.now(),
      app_platform: 'iOS'
    };
  },

  generateOneForUpdate: function (accountId, prefix) {
    return {
      account_id: accountId,
      app_name: (prefix ? prefix + '_' : '' ) + this.prefix + Date.now(),
      configs: [
        {
          sdk_release_version: 1,
          logging_level: 'debug',
          configuration_refresh_interval_sec: 3600,
          configuration_stale_timeout_sec: 36000,
          operation_mode: 'transfer_and_report',
          initial_transport_protocol: 'standard',
          stats_reporting_interval_sec: 60,
          stats_reporting_level: 'debug',
          stats_reporting_max_requests_per_report: 500,
          a_b_testing_origin_offload_ratio: 0,
          domains_black_list: [],
          domains_white_list: [],
          domains_provisioned_list: [],
          allowed_transport_protocols: []
        }
      ]
    };
  },

  /**
   * ### AppsDataProvider.clone()
   *
   * Clones the given app in a new similar one.
   *
   * @param {Object} app object
   */
  clone: function (app) {
    return JSON.parse(JSON.stringify(app));
  },

  DataDrivenHelper: {

    /**
     * ### AppsDataProvider.setValueByPath()
     *
     * @param {Object} obj, App object in which value is going to be set
     * @param {String} pathString that represents the concatenation of keys and
     * the last key is the one that is going to change
     * @param {Object} value, any value that the property accepts
     */
    setValueByPath: function (obj, pathString, value) {
      var prop = obj;
      var path = pathString.split('.');
      for (var i = 0; i < path.length - 1; i++) {
        var key = path[i] === '0' ? 0 : path[i];
        prop = prop[key];
      }
      prop[path[i]] = value;
    },

    /**
     * ### AppsDataProvider.getValueByPath()
     *
     * @param {Object} obj, App object in which value is going to be set
     * @param {String} pathString that represents the concatenation of keys and
     * the last key is the one that for which the value is going to be get
     * @returns {Object|Undefined} the value that the key has in the specified
     * object, undefined otherwise
     */
    getValueByPath: function (obj, pathString) {
      var prop = JSON.parse(JSON.stringify(obj));
      var path = pathString.split('.');
      for (var i = 0; i < path.length - 1; i++) {
        prop = prop[path[i]];
        if (prop === undefined) {
          return undefined;
        }
      }
      return prop[path[i]];
    },

    /**
     * ### AppsDataProvider.generateEmptyData()
     *
     * Generates empty data for the key and based on the schema-definition
     * provided.
     *
     * @param {String} action, could be add, update, etc
     * @param {String} propertyPath, concatenation of keys
     * @param {String} schemaDef, schema defined by Joi
     * @returns {Object} with the following structur:
     * {
     *     spec: string,
     *     propertyPath: *,
     *     testValue: {object|undefined}
     * }
     */
    generateEmptyData: function (action, propertyPath, schemaDef) {
      var data = {
        spec: 'should return bad request when trying to ' + action + ' apps ' +
        'with empty `' + propertyPath + '` property value',
        propertyPath: propertyPath,
        testValue: undefined
      };
      switch (schemaDef) {
        case 'Joi.objectId()':
          data.testValue = '';
          break;
        case 'Joi.string()':
          data.testValue = undefined;
          break;
        case 'Joi.string().valid(\'iOS\', \'Android\', \'Windows_Mobile\')':
          data.testValue = '';
          break;
        case 'Joi.number().integer().min(0).max(10000)':
          data.testValue = undefined;
          break;
        case 'Joi.string().valid(\'debug\', \'info\', \'warning\', ' +
        '\'error\', \'critical\')':
          data.testValue = '';
          break;
        case 'Joi.number().integer().min(60).max(604800)':
          data.testValue = undefined;
          break;
        case 'Joi.number().integer().min(60).max(999999999)':
          data.testValue = undefined;
          break;
        case 'Joi.string().valid(\'transfer_and_report\', \'transfer_only\', ' +
        '\'report_only\', \'off\')':
          data.testValue = '';
          break;
        case 'Joi.string().valid(\'standard\', \'quic\', \'rmp\')':
          data.testValue = '';
          break;
        case 'Joi.number().integer().min(20).max(3600)':
          data.testValue = undefined;
          break;
        case 'Joi.number().integer().min(1).max(1000)':
          data.testValue = undefined;
          break;
        case 'Joi.number().integer().min(0).max(100)':
          data.testValue = undefined;
          break;
        case 'Joi.array().items(Joi.string().regex(domainRegex))':
          data.testValue = '';
          break;
        case 'Joi.array().items(Joi.string().valid(\'standard\', \'quic\', ' +
        '\'rmp\'))':
          data.testValue = '';
          break;
        default:
          console.log('ALERT! In generate data: not considered:', schemaDef);
          data.testValue = undefined;
      }
      return data;
    },

    /**
     * ### AppsDataProvider.generateLongData()
     *
     * Generates long data for the key and based on the schema-definition
     * provided.
     *
     * @param {String} action, could be add, update, etc
     * @param {String} propertyPath, concatenation of keys
     * @param {String} schemaDef, schema defined by Joi
     * @returns {Object} with the following structure:
     * {
     *     spec: string,
     *     propertyPath: *,
     *     testValue: {object|undefined}
     * }
     */
    generateLongData: function (action, propertyPath, schemaDef) {
      var longObjectId = 'abcdef01234567890123456789';
      var longNumber = 98765432109876543210987654321098765432109876543210;
      var longText = 'LoremipsumdolorsitametconsecteturadipiscingelitPellente' +
        'squeposuereturpisvelmolestiefeugiatmassaorcilacinianunceumolestiearc' +
        'umetusatestProinsitametnequeefficiturelementumquamutcondimentumanteQ' +
        'uisquesedipsumegetsemtempuseleifendinvelligulaNuncmaximusgravidalibe' +
        'roquisultriciesnuncgravidaeuCrasaeratsitametfeliseuismodplaceratViva' +
        'musfermentumduisitametsemaccumsansedvariusurnaaliquetIntegernonnunca' +
        'cmassaconsequatimperdietidinterdummagnaCurabiturdolorexsollicitudinv' +
        'iverranislegetsodalestempormagnaDuissitameturnaeratMaurisaccumsanleo' +
        'sedquamlobortisvenenatisNullamimperdietetmagnasedaccumsanDuisposuere' +
        'posuererisusvitaevolutpatVestibulumbibendumnislhendreritnisipharetra' +
        'infaucibusnullarhoncusPellentesquepretiumuttellusidpellentesqueAenea' +
        'nanteaugueultricesuttortorquisconsequatsemperfelis';
      var data = {
        spec: 'should return bad request when trying to ' + action + ' apps ' +
        'with long `' + propertyPath + '` property value',
        propertyPath: propertyPath,
        testValue: undefined
      };
      switch (schemaDef) {
        case 'Joi.objectId()':
          data.testValue = longObjectId;
          break;
        case 'Joi.string()':
          data.testValue = longText;
          break;
        case 'Joi.string().valid(\'iOS\', \'Android\', \'Windows_Mobile\')':
          data.testValue = longText;
          break;
        case 'Joi.number().integer().min(0).max(10000)':
          data.testValue = longNumber;
          break;
        case 'Joi.string().valid(\'debug\', \'info\', \'warning\', ' +
        '\'error\', \'critical\')':
          data.testValue = longText;
          break;
        case 'Joi.number().integer().min(60).max(604800)':
          data.testValue = longNumber;
          break;
        case 'Joi.number().integer().min(60).max(999999999)':
          data.testValue = longNumber;
          break;
        case 'Joi.string().valid(\'transfer_and_report\', \'transfer_only\', ' +
        '\'report_only\', \'off\')':
          data.testValue = longText;
          break;
        case 'Joi.string().valid(\'standard\', \'quic\', \'rmp\')':
          data.testValue = longText;
          break;
        case 'Joi.number().integer().min(20).max(3600)':
          data.testValue = longNumber;
          break;
        case 'Joi.number().integer().min(1).max(1000)':
          data.testValue = longNumber;
          break;
        case 'Joi.number().integer().min(0).max(100)':
          data.testValue = longNumber;
          break;
        case 'Joi.array().items(Joi.string().regex(domainRegex))':
          data.testValue = longText;
          break;
        case 'Joi.array().items(Joi.string().valid(\'standard\', \'quic\', ' +
        '\'rmp\'))':
          data.testValue = longText;
          break;
        default:
          console.log('ALERT! In generate data: not considered:', schemaDef);
          data.testValue = undefined;
      }
      return data;
    },

    /**
     * ### AppsDataProvider.generateBogusData()
     *
     * Generates bogus data for the key and based on the schema-definition
     * provided.
     *
     * @param {String} action, could be add, update, etc
     * @param {String} propertyPath, concatenation of keys
     * @param {String} schemaDef, schema defined by Joi
     * @returns {Object} with the following structure:
     * {
     *     spec: string,
     *     propertyPath: *,
     *     testValue: {object|undefined}
     * }
     */
    generateBogusData: function (action, propertyPath, schemaDef) {
      var bogusObjectId = '!@#$%^&*()_+';
      var bogusNumber = '!@#$%^&*()_+';
      var bogusText = '!@#$%^&*()_+';
      var data = {
        spec: 'should return bad request when trying to ' + action + ' apps ' +
        'with bogus `' + propertyPath + '` property value',
        propertyPath: propertyPath,
        testValue: undefined
      };
      switch (schemaDef) {
        case 'Joi.objectId()':
          data.testValue = bogusObjectId;
          break;
        case 'Joi.string()':
          data.testValue = bogusText;
          break;
        case 'Joi.string().valid(\'iOS\', \'Android\', \'Windows_Mobile\')':
          data.testValue = bogusText;
          break;
        case 'Joi.number().integer().min(0).max(10000)':
          data.testValue = bogusNumber;
          break;
        case 'Joi.string().valid(\'debug\', \'info\', \'warning\', ' +
        '\'error\', \'critical\')':
          data.testValue = bogusText;
          break;
        case 'Joi.number().integer().min(60).max(604800)':
          data.testValue = bogusNumber;
          break;
        case 'Joi.number().integer().min(60).max(999999999)':
          data.testValue = bogusNumber;
          break;
        case 'Joi.string().valid(\'transfer_and_report\', \'transfer_only\', ' +
        '\'report_only\', \'off\')':
          data.testValue = bogusText;
          break;
        case 'Joi.string().valid(\'standard\', \'quic\', \'rmp\')':
          data.testValue = bogusText;
          break;
        case 'Joi.number().integer().min(20).max(3600)':
          data.testValue = bogusNumber;
          break;
        case 'Joi.number().integer().min(1).max(1000)':
          data.testValue = bogusNumber;
          break;
        case 'Joi.number().integer().min(0).max(100)':
          data.testValue = bogusNumber;
          break;
        case 'Joi.array().items(Joi.string().regex(domainRegex))':
          data.testValue = bogusText;
          break;
        case 'Joi.array().items(Joi.string().valid(\'standard\', \'quic\', ' +
        '\'rmp\'))':
          data.testValue = bogusText;
          break;
        default:
          console.log('ALERT! In generate data: not considered:', schemaDef);
          data.testValue = undefined;
      }
      return data;
    },

    /**
     * ### AppsDataProvider.generateInvalidData()
     *
     * Generates invalid data for the key and based on the schema-definition
     * provided.
     *
     * @param {String} action, could be add, update, etc
     * @param {String} propertyPath, concatenation of keys
     * @param {String} schemaDef, schema defined by Joi
     * @returns {Object} with the following structure:
     * {
     *     spec: string,
     *     propertyPath: *,
     *     testValue: {object|undefined}
     * }
     */
    generateInvalidData: function (action, propertyPath, schemaDef) {
      var invalidObjectId = '123456789zzzzzz987654321';
      var invalidNumber = '-9999999999';
      var invalidText = 'Invalid string';
      var data = {
        spec: 'should return bad request when trying to ' + action + ' apps ' +
        'with invalid `' + propertyPath + '` property value',
        propertyPath: propertyPath,
        testValue: undefined
      };
      switch (schemaDef) {
        case 'Joi.objectId()':
          data.testValue = invalidObjectId;
          break;
        case 'Joi.string()':
          data.testValue = undefined;
          break;
        case 'Joi.string().valid(\'iOS\', \'Android\', \'Windows_Mobile\')':
          data.testValue = invalidText;
          break;
        case 'Joi.number().integer().min(0).max(10000)':
          data.testValue = invalidNumber;
          break;
        case 'Joi.string().valid(\'debug\', \'info\', \'warning\', ' +
        '\'error\', \'critical\')':
          data.testValue = invalidText;
          break;
        case 'Joi.number().integer().min(60).max(604800)':
          data.testValue = invalidNumber;
          break;
        case 'Joi.number().integer().min(60).max(999999999)':
          data.testValue = invalidNumber;
          break;
        case 'Joi.string().valid(\'transfer_and_report\', \'transfer_only\', ' +
        '\'report_only\', \'off\')':
          data.testValue = invalidText;
          break;
        case 'Joi.string().valid(\'standard\', \'quic\', \'rmp\')':
          data.testValue = invalidText;
          break;
        case 'Joi.number().integer().min(20).max(3600)':
          data.testValue = invalidNumber;
          break;
        case 'Joi.number().integer().min(1).max(1000)':
          data.testValue = invalidNumber;
          break;
        case 'Joi.number().integer().min(0).max(100)':
          data.testValue = invalidNumber;
          break;
        case 'Joi.array().items(Joi.string().regex(domainRegex))':
          data.testValue = invalidText;
          break;
        case 'Joi.array().items(Joi.string().valid(\'standard\', \'quic\', ' +
        '\'rmp\'))':
          data.testValue = invalidText;
          break;
        default:
          console.log('ALERT! In generate data: not considered:', schemaDef);
          data.testValue = undefined;
      }
      return data;
    },

    /**
     * ### AppsDataProvider.generateNonExistentData()
     *
     * Generates non-existing data for the key and based on the schema-
     * definition provided.
     *
     * @param {String} action, could be add, update, etc
     * @param {String} propertyPath, concatenation of keys
     * @param {String} schemaDef, schema defined by Joi
     * @returns {Object} with the following structure:
     * {
     *     spec: string,
     *     propertyPath: *,
     *     testValue: {object|undefined}
     * }
     */
    generateNonExistentData: function (action, propertyPath, schemaDef) {
      var nonExistentId = '123456789abcdef987654321';
      var nonExistingOption = 'non-existing-option';
      var nonExistingNumberOption = '99999999999999999999999999999999999999999';
      var data = {
        spec: 'should return bad request when trying to ' + action + ' apps ' +
        'with non-existent `' + propertyPath + '` property value',
        propertyPath: propertyPath,
        testValue: undefined
      };
      switch (schemaDef) {
        case 'Joi.objectId()':
          data.testValue = nonExistentId;
          break;
        case 'Joi.string()':
          data.testValue = undefined;
          break;
        case 'Joi.string().valid(\'iOS\', \'Android\', \'Windows_Mobile\')':
          data.testValue = nonExistingOption;
          break;
        case 'Joi.number().integer().min(0).max(10000)':
          data.testValue = nonExistingNumberOption;
          break;
        case 'Joi.string().valid(\'debug\', \'info\', \'warning\', ' +
        '\'error\', \'critical\')':
          data.testValue = nonExistingOption;
          break;
        case 'Joi.number().integer().min(60).max(604800)':
          data.testValue = nonExistingNumberOption;
          break;
        case 'Joi.number().integer().min(60).max(999999999)':
          data.testValue = nonExistingNumberOption;
          break;
        case 'Joi.string().valid(\'transfer_and_report\', \'transfer_only\', ' +
        '\'report_only\', \'off\')':
          data.testValue = nonExistingOption;
          break;
        case 'Joi.string().valid(\'standard\', \'quic\', \'rmp\')':
          data.testValue = nonExistingOption;
          break;
        case 'Joi.number().integer().min(20).max(3600)':
          data.testValue = nonExistingNumberOption;
          break;
        case 'Joi.number().integer().min(1).max(1000)':
          data.testValue = nonExistingNumberOption;
          break;
        case 'Joi.number().integer().min(0).max(100)':
          data.testValue = nonExistingNumberOption;
          break;
        case 'Joi.array().items(Joi.string().regex(domainRegex))':
          data.testValue = undefined;
          break;
        case 'Joi.array().items(Joi.string().valid(\'standard\', \'quic\', ' +
        '\'rmp\'))':
          data.testValue = nonExistingOption;
          break;
        default:
          console.log('ALERT! In generate data: not considered:', schemaDef);
          data.testValue = undefined;
      }
      return data;
    }
  }
};

module.exports = AppsDataProvider;
