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

//  ----------------------------------------------------------------------------------------------//

var Hapi = require('hapi'),
  // Swagger = require('hapi-swagger'),
  fs = require('fs'),
  config = require( 'config'),
  logger = require( 'revsw-logger' )( config.log ),
  pkg = require( '../package.json' );


//  log shipper ----------------------------------------------------------------------------------//


if ( config.run_logshipping_jobs === true ) {

  var mkdirp = require('mkdirp');
  var stuff = require( '../lib/commons');
  //  create `uploads` directory
  mkdirp.sync( stuff.toUploadsPath( '' ) );

  var logshipper = require( '../lib/dispatcher');
  logger.info( 'Starting Log Shipping Service' );
  logshipper.run();
  setInterval( function() {
    logshipper.run();
  }, ( config.logs_shipping_span_sec * 1000 ) );

} else {
  logger.info( 'Log Shipping Service is disabled per configuration' );
}

//  simple api server ----------------------------------------------------------------------------//

var server = new Hapi.Server();

server.connection({
  host: config.get('service.host'),
  port: config.get('service.https_port'),
  tls: {
    key: fs.readFileSync(config.get('service.key_path')),
    cert: fs.readFileSync(config.get('service.cert_path'))
  },
  routes: { cors: true }
});

server.connection({
  host: config.get('service.host'),
  port: config.get('service.http_port')
});

//  redirect all non-HTTPS requests to HTTPS
server.ext('onRequest', function (request, reply) {
  var https_port = config.get('service.https_port');
  if ( request.connection.info.port !== https_port ) {
    return reply.redirect( 'https://' + request.info.hostname +
      ( https_port !== 443 ? ( ':' + https_port ) : '' ) +
      request.path ).code( 301 );
  }
  reply.continue();
});

server.register({
  register: require('hapi-router'),
  options: {
    routes: 'routes/*.js'
  }
}, function (err) {
  if (err) {
    throw err;
  }
});

//  ---------------------------------
server.start(function() {
  logger.info( 'hapi server started, ' + server.info.uri );
});

