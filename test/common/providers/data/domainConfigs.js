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

// # Domain Configs Data Provider object
//
// Defines some methods to generate valid and common domain-configs test data.
// With common we mean it oes not have anything special on it.
//
// From there, you can modify and get bogus, invalid or other type of data
// depending on your test needs.
var DomainConfigsDataProvider = {

  prefix: 'ls-test',

  /**
   * ### DomainConfigsDataProvider.generateOne()
   *
   * Generates valida data that represents an domain-config which the
   * domain-configs REST API end points accept.
   *
   * @param {String} accountId, which will be used in the domain config data.
   *
   * @returns {Object} account info with the following schema
   *
   *     {
   *         domain_name: string
   *         account_id: string
   *         origin_host_header: string
   *         origin_server: string
   *         origin_server_location_id: string
   *     }
   */
  generateOne: function (accountId, prefix) {
    var _prefix = prefix || this.prefix;
    return {
      'domain_name':(_prefix + '-' + Date.now() + '.revsw.net').toLowerCase(),
      'account_id': accountId,
      'origin_host_header': 'testsjc20-website01.revsw.net',
      'origin_server': 'testsjc20-website01.revsw.net',
      'origin_server_location_id': '55a56fa6476c10c329a90741',
      'tolerance': '3000'
    };
  },

  /**
   * ### DomainConfigsDataProvider.generateFull()
   *
   * Generates valid data that represents an FULL domain-config which the
   * domain-configs REST API end points accept.
   *
   * @param accountId, Account id to use for domain config
   * @param prefix, any prefix to add in domain name/values
   * @returns {Full Domain Config}
   */
  generateFull: function (accountId, prefix) {
    var fullConfig = {
      '3rd_party_rewrite': {
        '3rd_party_root_rewrite_domains': '',
        '3rd_party_runtime_domains': '',
        '3rd_party_urls': '',
        'enable_3rd_party_rewrite': false,
        'enable_3rd_party_root_rewrite': false,
        'enable_3rd_party_runtime_rewrite': false
      },
      'proxy_timeout': 20,
      'rev_component_bp': {
        'acl': {
          'acl_rules': [
            {
              'country_code': '',
              'header_name': '',
              'header_value': '',
              'host_name': '',
              'subnet_mask': ''
            }
          ],
          'action': 'deny_except',
          'enabled': false
        },
        'block_crawlers': false,
        'cache_bypass_locations': [],
        'caching_rules': [
          {
            'browser_caching': {
              'force_revalidate': false,
              'new_ttl': 1,
              'override_edge': false
            },
            'cookies': {
              'ignore_all': false,
              'keep_or_ignore_list': [],
              'list_is_keep': false,
              'override': false,
              'remove_ignored_from_request': false,
              'remove_ignored_from_response': false
            },
            'edge_caching': {
              'new_ttl': 0,
              'override_no_cc': false,
              'override_origin': false
            },
            'url': {
              'is_wildcard': true,
              'value': '**'
            },
            'version': 1
          }
        ],
        'cdn_overlay_urls': [],
        'enable_cache': true,
        'enable_security': true,
        'web_app_firewall': 'off'
      },
      'rev_component_co': {
        'css_choice': 'medium',
        'enable_optimization': false,
        'enable_rum': false,
        'img_choice': 'medium',
        'js_choice': 'medium',
        'mode': 'moderate'
      },
      'origin_server': 'API-QA-config.revsw.net',
      'origin_host_header': 'API-QA-website01.revsw.net',
      'account_id': accountId,
      'tolerance': '3000',
      'origin_server_location_id': '55a56fa6476c10c329a90741'
    };
    if (prefix) {
      fullConfig.origin_host_header = 'API-QA-website01' +
        prefix + '.revsw.net';
      return fullConfig;
    }
    return fullConfig;
  },

  /**
   * ### DomainConfigsDataProvider.cloneForUpdate()
   *
   * Clones the given domain config in a new one which does not have a
   * domain_name nor a cname.
   *
   * @param {Domain Config Object}
   */
  cloneForUpdate: function (domain) {
    var newDomain = JSON.parse(JSON.stringify(domain));
    delete newDomain.domain_name;
    delete newDomain.cname;
    return newDomain;
  },

  DataDrivenHelper: {

    /**
     * ### DomainConfigsDataProvider.setValueByPath()
     *
     * @param {Domain Config Object} obj, object in which value is going to
     * be set
     * @param {String} pathString that represents the concatenation of keys and
     * the last key is the one that is going to change
     * @param {Object} any value that the property accepts
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
     * ### DomainConfigsDataProvider.getValueByPath()
     *
     * @param {Domain Config Object} obj, object in which value is going to
     * be set
     * @param {String} pathString that represents the concatenation of keys and
     * the last key is the one that for which the value is going to be get
     * @returns {Onject|Undefined} the value that the key has in the specified
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

    removeValueByPath: function (obj, pathString) {
      var prop = obj;
      var path = pathString.split('.');
      for (var i = 0; i < path.length - 1; i++) {
        prop = prop[path[i]];
        if (prop === undefined) {
          return;
        }
      }
      delete prop[path[i]];
    },

    /**
     * ### DomainConfigsDataProvider.generateEmptyData()
     *
     * Generates empty data for the key and based on the schema-definition
     * provided.
     *
     * @param {String} propertyPath, concatenation of keys
     * @param {String} schemaDef, schema defined by Joi
     * @returns {
     *     spec: string,
     *     propertyPath: *,
     *     testValue: {object|undefined}
     * }
     */
    generateEmptyData: function (propertyPath, schemaDef) {
      var data = {
        spec: 'should return bad request when trying to update domain ' +
        'with empty `' + propertyPath + '` property value',
        propertyPath: propertyPath,
        testValue: undefined
      };
      switch (schemaDef) {
        // STRING values
        case 'Joi.string()':
          data.testValue = undefined;
          break;
        case 'Joi.string().allow("").required()':
          data.testValue = undefined;
          break;
        case 'Joi.string().required()':
          data.testValue = '';
          break;
        case 'Joi.string().max(1500).allow("").required()':
          data.testValue = undefined;
          break;
        case 'Joi.string().valid("off", "low", "medium", "high").required()':
          data.testValue = '';
          break;
        case 'Joi.string().valid("add", "remove", "replace").required()':
          data.testValue = '';
          break;
        case 'Joi.string().valid("least", "moderate", "aggressive", ' +
        '"custom", "adaptive").required()':
          data.testValue = '';
          break;
        case 'Joi.string().valid("off", "detect", "block", "block_all")' +
        '.required()':
          data.testValue = '';
          break;
        case 'Joi.string().valid("deny_except", "allow_except").required()':
          data.testValue = '';
          break;
        // NUMBER values
        case 'Joi.number().integer()':
          data.testValue = undefined;
          break;
        case 'Joi.number().valid(1).required()':
          data.testValue = undefined;
          break;
        case 'Joi.number().integer().required()':
          data.testValue = undefined;
          break;
        // BOOLEAN values
        case 'Joi.boolean()':
          data.testValue = undefined;
          break;
        case 'Joi.boolean().required()':
          data.testValue = undefined;
          break;
        // OBJECT values
        case 'Joi.object({})':
          data.testValue = undefined;
          break;
        case 'Joi.object({}).required()':
          data.testValue = {};
          break;
        // ARRAY values
        case 'Joi.array().items({})':
          data.testValue = undefined;
          break;
        case 'Joi.array().items(Joi.string())':
          data.testValue = undefined;
          break;
        case 'Joi.array().items({}).required()':
          data.testValue = undefined;
          break;
        case 'Joi.array().items(Joi.string()).required()':
          data.testValue = [''];
          break;
        case 'Joi.array().items(Joi.string().required())':
          data.testValue = [''];
          break;
        // OTHER values
        default:
          if (/Joi\.objectId\(\)\.required\(\)/.test(schemaDef)) {
            data.testValue = '';
          }
          else if (/oi\.string\(\)\.required\(\).allow\(""\)/.test(schemaDef)) {
            data.testValue = undefined;
          }
          else if (/Joi\.string\(\)\.required\(\)/.test(schemaDef)) {
            data.testValue = '';
          }
          else if (/Joi\.string\(\)\.optional\(\)/.test(schemaDef)) {
            data.testValue = undefined;
          }
          else {
            console.log('ALERT! In generateFull:: not considered:', schemaDef);
            data.testValue = undefined;
          }
      }
      return data;
    },

    /**
     * ### DomainConfigsDataProvider.generateInvalidData()
     *
     * Generates invalid data for the key and based on the schema-definition
     * provided.
     *
     * @param {String} propertyPath, concatenation of keys
     * @param {String} schemaDef, schema defined by Joi
     * @returns {
     *     spec: string,
     *     propertyPath: *,
     *     testValue: {object|undefined}
     * }
     */
    generateInvalidData: function (propertyPath, schemaDef) {
      var data = {
        spec: 'should return bad request when trying to update domain ' +
        'with invalid `' + propertyPath + '` property value',
        propertyPath: propertyPath,
        testValue: undefined
      };
      switch (schemaDef) {
        // STRING values
        case 'Joi.string()':
          data.testValue = true;
          break;
        case 'Joi.string().allow("").required()':
          data.testValue = true;
          break;
        case 'Joi.string().max(1500).allow("").required()':
          data.testValue = true;
          break;
        case 'Joi.string().required()':
          data.testValue = true;
          break;
        case 'Joi.string().valid("off", "low", "medium", "high").required()':
          data.testValue = true;
          break;
        case 'Joi.string().valid("add", "remove", "replace").required()':
          data.testValue = true;
          break;
        case 'Joi.string().valid("least", "moderate", "aggressive", "custom", "adaptive").required()':
          data.testValue = true;
          break;
        case 'Joi.string().valid("off", "detect", "block", "block_all").required()':
          data.testValue = true;
          break;
        case 'Joi.string().valid("deny_except", "allow_except").required()':
          data.testValue = true;
          break;
        // NUMBER values
        case 'Joi.number().integer()':
          data.testValue = true;
          break;
        case 'Joi.number().valid(1).required()':
          data.testValue = [true, 5];
          break;
        case 'Joi.number().integer().required()':
          data.testValue = true;
          break;
        // BOOLEAN values
        case 'Joi.boolean()':
          data.testValue = 123;
          break;
        case 'Joi.boolean().required()':
          data.testValue = 123;
          break;
        // OBJECT values
        case 'Joi.object({})':
          data.testValue = 123;
          break;
        case 'Joi.object({}).required()':
          data.testValue = 123;
          break;
        // ARRAY values
        case 'Joi.array().items({})':
          data.testValue = 'invalid-data';
          break;
        case 'Joi.array().items(Joi.string())':
          data.testValue = 'invalid-data';
          break;
        case 'Joi.array().items({}).required()':
          data.testValue = 'invalid-data';
          break;
        case 'Joi.array().items(Joi.string()).required()':
          data.testValue = 'invalid-data';
          break;
        case 'Joi.array().items(Joi.string().required())':
          data.testValue = 'invalid-data';
          break;
        // OTHER values
        default:
          if (/Joi\.objectId\(\)\.required\(\)/.test(schemaDef)) {
            data.testValue = [];
          }
          else if (/Joi\.string\(\)\.required\(\)/.test(schemaDef)) {
            data.testValue = [];
          }
          else if (/Joi\.string\(\)\.optional\(\)/.test(schemaDef)) {
            data.testValue = [];
          }
          else {
            console.log('ALERT! In generateInvalidData:: not considered:', schemaDef);
            data.testValue = undefined;
          }
      }
      return data;
    },

    /**
     * ### DomainConfigsDataProvider.generateWithoutRequiredData()
     *
     * Generates data without required data for the key and based on the
     * schema-definition provided.
     *
     * @param {String} propertyPath, concatenation of keys
     * @param {String} schemaDef, schema defined by Joi
     * @returns {
     *     spec: string,
     *     propertyPath: *,
     *     isRequired: {Boolean}
     * }
     */
    generateWithoutRequiredData: function (propertyPath, schemaDef) {
      var data = {
        spec: 'should return bad request when trying to update domain ' +
        'without required `' + propertyPath + '` property value',
        propertyPath: propertyPath,
        isRequired: undefined
      };
      switch (schemaDef) {
        // STRING values
        case 'Joi.string()':
          data.isRequired = false;
          break;
        case 'Joi.string().allow("").required()':
          data.isRequired = true;
          break;
        case 'Joi.string().max(1500).allow("").required()':
          data.isRequired = true;
          break;
        case 'Joi.string().required()':
          data.isRequired = true;
          break;
        case 'Joi.string().valid("off", "low", "medium", "high").required()':
          data.isRequired = true;
          break;
        case 'Joi.string().valid("add", "remove", "replace").required()':
          data.isRequired = true;
          break;
        case 'Joi.string().valid("least", "moderate", "aggressive", "custom", "adaptive").required()':
          data.isRequired = true;
          break;
        case 'Joi.string().valid("off", "detect", "block", "block_all").required()':
          data.isRequired = true;
          break;
        case 'Joi.string().valid("deny_except", "allow_except").required()':
          data.isRequired = true;
          break;
        // NUMBER values
        case 'Joi.number().integer()':
          data.isRequired = false;
          break;
        case 'Joi.number().valid(1).required()':
          data.isRequired = true;
          break;
        case 'Joi.number().integer().required()':
          data.isRequired = true;
          break;
        // BOOLEAN values
        case 'Joi.boolean()':
          data.isRequired = false;
          break;
        case 'Joi.boolean().required()':
          data.isRequired = true;
          break;
        // OBJECT values
        case 'Joi.object({})':
          data.isRequired = false;
          break;
        case 'Joi.object({}).required()':
          data.isRequired = true;
          break;
        // ARRAY values
        case 'Joi.array().items({})':
          data.isRequired = false;
          break;
        case 'Joi.array().items(Joi.string())':
          data.isRequired = false;
          break;
        case 'Joi.array().items({}).required()':
          data.isRequired = true;
          break;
        case 'Joi.array().items(Joi.string()).required()':
          data.isRequired = true;
          break;
        case 'Joi.array().items(Joi.string().required())':
          data.isRequired = true;
          break;
        // OTHER values
        default:
          if (/Joi\.objectId\(\)\.required\(\)/.test(schemaDef)) {
            data.isRequired = true;
          }
          else if (/Joi\.string\(\)\.required\(\)/.test(schemaDef)) {
            data.isRequired = true;
          }
          else if (/Joi\.string\(\)\.optional\(\)/.test(schemaDef)) {
            data.isRequired = false;
          }
          else {
            console.log('ALERT! In generateWithoutRequiredData:: not considered:', schemaDef);
            data.isRequired = false;
          }
      }
      return data;
    },

    /**
     * ### DomainConfigsDataProvider.generateLongData()
     *
     * Generates long data for the key and based on the schema-definition
     * provided.
     *
     * @param {String} propertyPath, concatenation of keys
     * @param {String} schemaDef, schema defined by Joi
     * @returns {
     *     spec: string,
     *     propertyPath: *,
     *     testValue: {object|undefined}
     * }
     */
    generateLongData: function (propertyPath, schemaDef) {
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
      var veryLongText = longText + longText + longText + longText;
      var data = {
        spec: 'should return bad request when trying to update domain ' +
        'with long `' + propertyPath + '` property value',
        propertyPath: propertyPath,
        testValue: undefined
      };
      switch (schemaDef) {
        // STRING values
        case 'Joi.string()':
          data.testValue = longText;
          break;
        case 'Joi.string().max(1500).allow(\"\").required()':
          data.testValue = veryLongText;
          break;
        case 'Joi.string().allow("").required()':
          data.testValue = longText;
          break;
        case 'Joi.string().required()':
          data.testValue = longText;
          break;
        case 'Joi.string().valid("off", "low", "medium", "high").required()':
          data.testValue = longText;
          break;
        case 'Joi.string().valid("add", "remove", "replace").required()':
          data.testValue = longText;
          break;
        case 'Joi.string().valid("least", "moderate", "aggressive", ' +
        '"custom", "adaptive").required()':
          data.testValue = longText;
          break;
        case 'Joi.string().valid("off", "detect", "block", "block_all")' +
        '.required()':
          data.testValue = longText;
          break;
        case 'Joi.string().valid("deny_except", "allow_except").required()':
          data.testValue = longText;
          break;
        // NUMBER values
        case 'Joi.number().integer()':
          data.testValue = longNumber;
          break;
        case 'Joi.number().valid(1).required()':
          data.testValue = longNumber;
          break;
        case 'Joi.number().integer().required()':
          data.testValue = longNumber;
          break;
        // BOOLEAN values
        case 'Joi.boolean()':
          data.testValue = undefined;
          break;
        case 'Joi.boolean().required()':
          data.testValue = undefined;
          break;
        // OBJECT values
        case 'Joi.object({})':
          data.testValue = undefined;
          break;
        case 'Joi.object({}).required()':
          data.testValue = undefined;
          break;
        // ARRAY values
        case 'Joi.array().items({})':
          data.testValue = undefined;
          break;
        case 'Joi.array().items(Joi.string())':
          data.testValue = [longText];
          break;
        case 'Joi.array().items({}).required()':
          data.testValue = [longText];
          break;
        case 'Joi.array().items(Joi.string()).required()':
          data.testValue = [longText];
          break;
        case 'Joi.array().items(Joi.string().required())':
          data.testValue = [longText];
          break;
        // OTHER values
        default:
          if (/Joi\.objectId\(\)\.required\(\)/.test(schemaDef)) {
            data.testValue = longObjectId;
          }
          else if (/oi\.string\(\)\.required\(\).allow\(""\)/.test(schemaDef)) {
            data.testValue = longText;
          }
          else if (/Joi\.string\(\)\.required\(\)/.test(schemaDef)) {
            data.testValue = longText;
          }
          else if (/Joi\.string\(\)\.optional\(\)/.test(schemaDef)) {
            data.testValue = longText;
          }
          else {
            console.log('ALERT! In generateLongData:: not considered:', schemaDef);
            data.testValue = undefined;
          }
      }
      return data;
    }
  }
};

module.exports = DomainConfigsDataProvider;
