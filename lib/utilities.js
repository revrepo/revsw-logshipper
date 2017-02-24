'use strict';

var hapi = require('hapi');

module.exports = {
  clone: function (obj) {
    return (JSON.parse(JSON.stringify(obj)));
  },
  
  buildError: function (code, err) {
    var error = hapi.error.badRequest(err);
    error.output.statusCode = code;
    error.reformat();
    return error;
  },
  
  renderJSON: function (request, reply, error, result) {
    if (error) {
      if (this.isString(error)) {
        reply(this.buildError(400, error));
      } else {
        reply(error);
      }
    } else {
      reply(result).type('application/json; charset=utf-8');
    }
  }
};
