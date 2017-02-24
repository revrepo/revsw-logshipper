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

//  ----------------------------------------------------------------------------------------------//

var Hapi = require('hapi'),
  fs = require('fs'),
  config = require('config'),
  commons = require('../lib/commons'),
  logger = require('revsw-logger')(config.log),
  cluster = require('cluster'),
  os = require('os'),
  Queue = require('../lib/queue'),
  mail = require('../lib/mail'),
  boom = require('boom');

//  init cluster ---------------------------------------------------------------------------------//

var DEBUG = false; // if debug is true run all workers in master

// check if process is master (not cleaning or shipping fork)
if (cluster.isMaster) {

  var notifyEmail = config.get('notify_developers_by_email_about_uncaught_exceptions');
  if (notifyEmail !== '') {
    process.on('uncaughtException', function (er) {
      console.error(er.stack);
      mail.sendMail({
        from: config.get('support_email'),
        to: notifyEmail,
        subject: process.env.NODE_ENV + ':' + os.hostname() + ' ' + er.message,
        text: er.stack
      }, function (er, data) {
        if (er) {
          console.error(er);
        }
        process.exit(1);
      });
    });
  }

  //  ---------------------------------
  //  main cluster process setup

  logger.info('Master pid ' + process.pid);

  //  run workers

  var jobsQueue;
  if (DEBUG) {
    jobsQueue = new Queue();
  }

  if (config.run_logshipping_jobs === true) {
    //  create `uploads` directory
    var mkdirp = require('mkdirp');
    mkdirp.sync(commons.toUploadsPath(''));

    if (!DEBUG) {
      // fork log shipping process with cluster
      var logShippingWorker = cluster.fork({worker_name: 'shipping'});
      logShippingWorker.on('message', statsProcessHandler);
    } else {
      setInterval(function () {
        jobsQueue.run();
      }, (config.logs_shipping_span_sec * 1000 ));
    }
  } else {
    logger.info('Log Shipping Service is disabled per configuration');
  }

  if (config.run_logcleaning_jobs === true) {
    if (!DEBUG) {
      // fork log cleaning process with cluster
      var logsCleaningWorker = cluster.fork({worker_name: 'cleaning'});
    } else {
      setInterval(function () {
        jobsQueue.clean();
      }, (config.logs_cleaning_span_sec * 1000 ));
    }
  } else {
    logger.info('Log Cleaning Service is disabled per configuration');
  }

  cluster.on('exit', function (worker, code, signal) {
    if (worker === logShippingWorker) {
      logger.warn('logshipping worker(' + worker.process.pid + ') died, respawning');
      logShippingWorker = cluster.fork({worker_name: 'shipping'});
      logShippingWorker.on('message', statsProcessHandler);
    } else if (worker === logsCleaningWorker) {
      logger.warn('logscleaning worker(' + worker.process.pid + ') died, respawning');
      logsCleaningWorker = cluster.fork({worker_name: 'cleaning'});
    }
  });

  //  run simple api server in the main process
  var server = new Hapi.Server();

  server.app.logshipperStats = {
    jobs_active: 0,

    jobs_collected: 0,
    jobs_logs_collected: 0,

    jobs_filed: 0,
    jobs_filed_failed: 0,

    jobs_shipped: 0,
    jobs_shipping_failed: 0,

    jobs_shipping_failed_by_destination: {
      s3: 0,
      ftp: 0,
      sftp: 0,
      elasticsearch: 0
    }
  };

  // We need this block function to access server scope
  /* jshint ignore:start */
  function statsProcessHandler(msg) {
    if (msg.type === 'stats') {
      switch (msg.state) {
        case 'jobs_loaded': {
          server.app.logshipperStats.jobs_active = msg.jobs_count;
          break;
        }
        case 'job_collected': {
          if (msg.logs_count) {
            server.app.logshipperStats.jobs_collected++;
            server.app.logshipperStats.jobs_logs_collected += msg.logs_count;
          }
          break;
        }
        case 'job_filed': {
          server.app.logshipperStats.jobs_filed++;
          break;
        }
        case 'job_not_filed': {
          server.app.logshipperStats.jobs_filed_failed++;
          break;
        }
        case 'job_shipped': {
          server.app.logshipperStats.jobs_shipped++;
          break;
        }
        case 'job_not_shipped': {
          server.app.logshipperStats.jobs_shipping_failed++;
          server.app.logshipperStats.jobs_shipping_failed_by_destination[msg.job_type]++;
          break;
        }
      }
    }
  }
  /* jshint ignore:end */

  server.connection({
    host: config.get('service.host'),
    port: config.get('service.https_port'),
    tls: {
      key: fs.readFileSync(config.get('service.key_path')),
      cert: fs.readFileSync(config.get('service.cert_path'))
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
  server.ext('onRequest', function (request, reply) {
    var https_port = config.get('service.https_port');
    if (request.connection.info.port !== https_port) {
      return reply.redirect('https://' + request.info.hostname +
        ( https_port !== 443 ? ( ':' + https_port ) : '' ) +
        request.path).code(301);
    }
    reply.continue();
  });

  // register hapi routes
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

  server.ext('onPreResponse', function(request, reply) {
    var response = request.response;
    if (response.isBoom === true && response.output.statusCode === 500) {
      var notifyEmailBadImplementation = config.get('notify_developers_by_email_about_bad_implementation');
      if (notifyEmailBadImplementation !== '') {
        var err = boom.internal(response.message, response, 500);
        mail.sendMail({
          from: config.get('support_email'),
          to: notifyEmailBadImplementation,
          subject: '[HAPI Internal Error] ' + process.env.NODE_ENV + ':' + os.hostname() + ' ' + err.message,
          text: JSON.stringify(err) +
          '\n\n' + err.stack +
          '\n\n AUTH : ' + JSON.stringify(request.auth) +
          '\n\n METHOD : ' + JSON.stringify(request.method) +
          '\n\n PATH : ' + JSON.stringify(request.path)
        }, function(er, data) {
          if (er) {
            console.error(er);
          }
        });
      }
    }
    return reply.continue();
  });

  // start hapi server
  server.start(function () {
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
    setInterval(function () {
      jobsQueue.run();
    }, ( config.logs_shipping_span_sec * 1000 ));

  } else if (process.env.worker_name === 'cleaning') {
    logger.info('logs cleaning worker started, process id ' + process.pid);

    // run clean queue with timeout
    setTimeout(function () {

      // repeat clean queue every config.logs_cleaning_span_sec seconds
      setInterval(function () {
        jobsQueue.clean();
      }, (config.logs_cleaning_span_sec * 1000 ));

    }, config.logs_shipping_span_sec * 500 /*shift on half of logshipping interval*/);

  }

}

