module.exports = {
  API: {
    METHODS: {
      CREATE: 'create',
      READ_ALL: 'read-all',
      READ_ONE: 'read-one',
      UPDATE: 'update',
      DELETE: 'delete'
    },
    USERS: {
      ROLES: {
        REV_ADMIN: 'Rev Admin',
        RESELLER: 'Reseller',
        ADMIN: 'Admin',
        USER: 'Normal User'
      }
    }
  },
  JOB_EXPECTED_FIELDS: [
    'host',
    '@timestamp',
    'unixtime',
    'domain',
    'ipport',
    'response',
    'request',
    's_bytes',
    'r_bytes',
    'method',
    'conn_status',
    'KA',
    'FBT_mu',
    'referer',
    'cache',
    'agent',
    'cont_type',
    'quic',
    'http2',
    'clientip',
    'duration',
    'upstream_time',
    'ie_format_o',
    'ie_format',
    'ie_res',
    'ie_res_o',
    'ie_bytes_o'
  ],
  DOMAIN_STATUS_POLLING_TIMEOUT: 180000,
  DOMAIN_STATUS_POLLING_INTERVAL: 3000
};
