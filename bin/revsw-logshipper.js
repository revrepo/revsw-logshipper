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
    fs = require('fs'),
    config = require('config'),
    commons = require('../lib/commons'),
    logger = require('revsw-logger')(config.log),
    cluster = require('cluster'),
    Queue = require('../lib/queue');

//  init cluster ---------------------------------------------------------------------------------//

// check if process is master (not cleaning or shipping fork)
if (cluster.isMaster) {

  //  ---------------------------------
  //  main cluster process setup

  logger.info( 'Master pid ' + process.pid );

  //  run workers

  if (config.run_logshipping_jobs === true) {
    //  create `uploads` directory
    var mkdirp = require('mkdirp');
    mkdirp.sync(commons.toUploadsPath( '' ));

    // fork log shipping process with cluster
    var logShippingWorker = cluster.fork({worker_name: 'shipping'});
  } else {
    logger.info('Log Shipping Service is disabled per configuration');
  }

  if (config.run_logcleaning_jobs === true) {
    // fork log cleaning process with cluster
    var logsCleaningWorker = cluster.fork({worker_name: 'cleaning'});
  } else {
    logger.info('Log Cleaning Service is disabled per configuration');
  }

  cluster.on('exit', function(worker, code, signal) {
    if (worker === logShippingWorker) {
      logger.warn('logshipping worker(' + worker.process.pid + ') died, respawning');
      logShippingWorker = cluster.fork({worker_name: 'shipping'});
    } else if (worker === logsCleaningWorker) {
      logger.warn('logscleaning worker(' + worker.process.pid + ') died, respawning');
      logsCleaningWorker = cluster.fork({worker_name: 'cleaning'});
    }
  });

  //  run simple api server in the main process
  var server = new Hapi.Server();

  server.connection({
    host: config.get('service.host'),
    port: config.get('service.https_port'),
    tls: {
      key: fs.readFileSync(config.get('service.key_path')),
      cert: fs.readFileSync(config.get( 'service.cert_path'))
    },
    routes: { 
      cors: true 
    }
  });

  server.connection({
    host: config.get('service.host'),
    port: config.get('service.http_port')
  });

  //  redirect all non-HTTPS requests to HTTPS
  server.ext('onRequest', function(request, reply) {
    var https_port = config.get('service.https_port');
    if (request.connection.info.port !== https_port) {
      return reply.redirect('https://' + request.info.hostname +
        ( https_port !== 443 ? ( ':' + https_port ) : '' ) +
        request.path).code(301);
    }
    reply.continue();
  });

  // register hapi routes
  server.register( {
    register: require('hapi-router'),
    options: {
      routes: 'routes/*.js'
    }
  }, function(err) {
    if (err) {
      throw err;
    }
  });

  // start hapi server
  server.start(function() {
    logger.info('hapi server started, ' + server.info.uri);
  });

} else {

  //  ---------------------------------
  //  worker processes setup

  // var dispatcher = require( '../lib/dispatcher' );

  // create queue for logshipper workers

  var jobsQueue = new Queue();

  // start queues
  if (process.env.worker_name === 'shipping') {
    logger.info('logs shipping worker started, process id ' + process.pid);

    // run queue iteration as fresh
    jobsQueue.run(true /*fresh start*/);

    // repeat queue run every config.logs_shipping_span_sec seconds
    setInterval(function() {
      jobsQueue.run();
    }, ( config.logs_shipping_span_sec * 1000 ) );

    // TODO: Maybe share queue with messages
    //process.on('message', function(message) {
    //  if (message === 'queue') {
    //
    //  }
    //});

  } else if (process.env.worker_name === 'cleaning') {
    logger.info('logs cleaning worker started, process id ' + process.pid);

    // run clean queue with timeout
    setTimeout(function() {

      // repeat clean queue every config.logs_cleaning_span_sec seconds
      setInterval(function() {
        jobsQueue.clean();
      }, (config.logs_cleaning_span_sec * 1000 ));

    }, config.logs_shipping_span_sec * 500 /*shift on half of logshipping interval*/ );

  }

}

