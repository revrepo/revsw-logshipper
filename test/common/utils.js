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

var config = require('config');
var os = require('os');
var Promise = require('bluebird');
var agent = require('supertest-as-promised');

module.exports = {
    getLocalIP: function() {
        var ifaces = os.networkInterfaces();
        var localIP = null;
        Object.keys(ifaces).forEach(function (ifname) {
            var alias = 0;

            ifaces[ifname].forEach(function (iface) {
                if ('IPv4' !== iface.family || iface.internal !== false) {
                    return;
                }

                if (iface.address.indexOf('192.168') !== -1) {
                    localIP = iface.address;
                }
                ++alias;
            });
        });

        return localIP ? localIP : '127.0.0.1';
    },

    getProxyServers: function() {
        var cdsUrl = config.get('cds.protocol') + '://' + config.get('cds.name') + ':' + config.get('cds.port');
        return agent(cdsUrl)
            .get('/v1/proxy_servers')
            .set('Authorization', 'Bearer ' + config.get('cds.token'))
            .then(function (res) {
                return res.body;
            })
            .catch(function(error) {
                throw error;
            });
    },
    
    sendProxyServerRequest: function(serverHost, domainName) {
        return agent('http://' + serverHost)
            .get('/')
            .set('Host', domainName)
            .expect(200)
            .then(function (res) {
                return agent('http://' + serverHost + ':18000')
                    .get('/')
                    .set('Host', domainName)
                    .expect(200)
                    .then(function (res) {
                        return Promise.resolve(true);
                    })
                    .catch(function(error) {
                        console.log('Proxy ' + serverHost + ' error (' + domainName + '): ', error);
                        return Promise.reject(error);
                    });                
            })
            .catch(function(error) {
                console.log('Proxy ' + serverHost + ' error (' + domainName + '): ', error);
                return Promise.reject(error);
            });
    }
};
