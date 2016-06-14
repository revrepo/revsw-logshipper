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

var Hapi = require( 'hapi' ),
  fs = require( 'fs' ),
  config = require( 'config' ),
  logger = require( 'revsw-logger' )( config.log ),
  cluster = require( 'cluster' );

var stuff = require( '../lib/commons' );


//  init cluster ---------------------------------------------------------------------------------//

if ( cluster.isMaster ) {

  //  ---------------------------------
  //  main cluster process setup

  logger.info( 'Master pid ' + process.pid );

  //  run workers
  if ( config.run_logshipping_jobs === true ) {

    //  create `uploads` directory
    var mkdirp = require( 'mkdirp' );
    mkdirp.sync( stuff.toUploadsPath( '' ) );

    var logshipping_worker = cluster.fork( { worker_name: 'shipping' } );
  } else {
    logger.info( 'Log Shipping Service is disabled per configuration' );
  }

  if ( config.run_logcleaning_jobs === true ) {
    var logscleaning_worker = cluster.fork( { worker_name: 'cleaning' } );
  } else {
    logger.info( 'Log Cleaning Service is disabled per configuration' );
  }

  cluster.on( 'exit', function( worker, code, signal ) {
    if ( worker === logshipping_worker ) {
      logger.warn( 'logshipping worker(' + worker.process.pid + ') died, respawning' );
      logshipping_worker = cluster.fork( { worker_name: 'shipping' } );
    } else if ( worker === logscleaning_worker ) {
      logger.warn( 'logscleaning worker(' + worker.process.pid + ') died, respawning' );
      logscleaning_worker = cluster.fork( { worker_name: 'cleaning' } );
    }
  } );

  //  run simple api server in the main process
  var server = new Hapi.Server();

  server.connection( {
    host: config.get( 'service.host' ),
    port: config.get( 'service.https_port' ),
    tls: {
      key: fs.readFileSync( config.get( 'service.key_path' ) ),
      cert: fs.readFileSync( config.get( 'service.cert_path' ) )
    },
    routes: { cors: true }
  } );

  server.connection( {
    host: config.get( 'service.host' ),
    port: config.get( 'service.http_port' )
  } );

  //  redirect all non-HTTPS requests to HTTPS
  server.ext( 'onRequest', function( request, reply ) {
    var https_port = config.get( 'service.https_port' );
    if ( request.connection.info.port !== https_port ) {
      return reply.redirect( 'https://' + request.info.hostname +
        ( https_port !== 443 ? ( ':' + https_port ) : '' ) +
        request.path ).code( 301 );
    }
    reply.continue();
  } );

  server.register( {
    register: require( 'hapi-router' ),
    options: {
      routes: 'routes/*.js'
    }
  }, function( err ) {
    if ( err ) {
      throw err;
    }
  } );

  //  ---------------------------------
  server.start( function() {
    logger.info( 'hapi server started, ' + server.info.uri );
  } );

} else {

  // console.dir( process.env.worker_name );

  //  ---------------------------------
  //  worker processes setup

  // var dispatcher = require( '../lib/dispatcher' );
  var Queue = require( '../lib/queue' );
  var Qu = new Queue();

  if ( process.env.worker_name === 'shipping' ) {

    logger.info( 'logs shipping worker started, process id ' + process.pid );

    Qu.run( true/*fresh start*/ );
    setInterval( function() {
      Qu.run();
    }, ( config.logs_shipping_span_sec * 1000 ) );

  } else if ( process.env.worker_name === 'cleaning' ) {

    logger.info( 'logs cleaning worker started, process id ' + process.pid );

    setTimeout(function() {

      setInterval( function() {
        Qu.clean();
      }, ( config.logs_cleaning_span_sec * 1000 ) );

    }, config.logs_shipping_span_sec * 500/*shift on half of logshipping interval*/ );


  }

}












//  ----------------------------------------------------------------------------------------------//

