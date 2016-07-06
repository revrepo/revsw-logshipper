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

var os = require('os');

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

                // if (alias >= 1) {
                //     console.log(ifname + ':' + alias, iface.address);
                // } else {
                //     console.log(ifname, iface.address);
                // }
                if (iface.address.indexOf('192.168') !== -1) {
                    localIP = iface.address;
                }
                ++alias;
            });
        });

        return localIP ? localIP : '127.0.0.1';
    }
};
