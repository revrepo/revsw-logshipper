module.exports = {
  "run_logshipping_jobs": true,
  "run_logcleaning_jobs": true,
  "log": {
    "transports": {
      "Console": {
        "level": "debug",
        "colorize": true,
        "prettyPrint": true,
        "humanReadableUnhandledException": true,
        "showLevel": true
      },
      "File": {
        "filename": "./log/revsw-logshipper.log",
        "level": "debug",
        "prettyPrint": true
      }
    }
  },
  "portal_mongo": {
    "connect_string": "mongodb://TESTSJC20-CMDB01.REVSW.NET:27017/revportal?replicaSet=CMDB-rs0"
  },
  "logshipper_mongo": {
    "connect_string": process.env.MONGODB_URI || "127.0.0.1:27017/logshipper"
  },
  "mongoose_debug_logging": false,
  "version_file": "./config/version.txt",
  "rsyslog": {
    "config_src": "scripts/syslog-logshipper.conf",
    "config_dest": "/etc/rsyslog-logshipper.d/logshipper.conf",
    "HUP_pause": 5000,
    "pid_file": "/var/run/rsyslogd.pid",
    "status_command": "service rsyslog status",
    "restart_command": "service rsyslog restart",
    "running_status_string": "rsyslog start/running, process ",
    "dead_status_string": "rsyslog stop/waiting",
    "domains_list_tag": "{{DomainsConditionListTAG}}",
    "header_comment_tag": "{{HeaderCommentTAG}}",
    "program_tag": "{{ProgramTAG}}"
  },
  "logs_shipping_span_sec": 10,
  "logs_shipping_leeway_sec": 30,
  "logs_shipping_max_records": 50000,
  "logs_cleaning_span_sec": 120,
  "logs_max_age_hr": 120,
  "jobs_max_age_hr": 0.2,
  "uploads_dir": "uploads",
  "queue_failed_retry_num": 3,
  "ftp_failed_delay": 5000,
  "ftp_failed_retry_num": 3,
  "sftp_failed_delay": 5000,
  "sftp_failed_retry_num": 3,
  "s3_failed_delay": 5000,
  "s3_failed_retry_num": 3,
  "es_failed_delay": 5000,
  "es_failed_retry_num": 3,
  "service": {
    "host": "0.0.0.0",
    "http_port": 8000,
    "https_port": 8443,
    "key_path": "./config/dev_ssl_certs/server.key",
    "cert_path": "./config/dev_ssl_certs/server.crt"
  },
  "sendgrid_api_key": "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",
  "notify_admin_by_email_on_logshipper_job_failures": "",
  "notify_developers_by_email_about_bad_implementation": "",
  "notify_developers_by_email_about_uncaught_exceptions": "",

  "support_email": "support@revapm.com",
  "support_name": "RevAPM Support Team",

  "active_account_ids": [],
  "suppressed_account_ids": [],
  "delete_shipped_files": true
};