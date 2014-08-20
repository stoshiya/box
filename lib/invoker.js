var AdmZip = require('adm-zip');
var cheerio = require('cheerio');
var request = require('request');
var constants = require('./constants');

var CONTENT_API_BASE = constants.CONTENT_API_BASE;
var VIEW_API_BASE = constants.VIEW_API_BASE;

var OPTIONS = { normalizeWhitespace: true, xmlMode: true };

function invoker(token, path, callback) {
  var start = new Date();
  request.get({
    headers: { Authorization: "Bearer " +  token },
    url: CONTENT_API_BASE + path,
    json: true
  }, function(err, res, body) {
    if (err) {
      callback({ error: err });
      return;
    }
    if (res.statusCode !== 200) {
      callback({ status: res.statusCode, body: body });
      return;
    }
    callback(null, body);
    console.log(new Date() - start + ' msec');
  });
}

function location(token, id, callback) {
  var start = new Date();
  request.get({
    headers: { Authorization: "Bearer " + token },
    url: CONTENT_API_BASE + '/files/' + id + '/content',
    followRedirect: false,
    json: true
  }, function(err, res) {
    if (err) {
      callback({ error: err });
      return;
    }
    if (res.statusCode !== 302) {
      callback({ status: res.statusCode });
      return;
    }
    callback(null, res.headers.location);
    console.log(new Date() - start + ' msec');
  });
}

function upload(uri, id, callback) {
  var start = new Date();
  var form = request.post({
    headers: { Authorization: "Token " + process.env.API_KEY },
    url: VIEW_API_BASE + '/documents',
    json: true
  }, function(err, res, body) {
    if (err) {
      callback({ error: err });
      return;
    }
    if (res.statusCode !== 202) {
      callback({ status: res.statusCode, body: body });
      return;
    }
    callback(null, body);
    console.log(new Date() - start + ' msec');
  }).form();
  form.append('url', uri);
  form.append('name', id);
}

function documents(callback) {
  var start = new Date();
  request({
    headers: { Authorization: "Token " + process.env.API_KEY },
    url: VIEW_API_BASE + '/documents?limit=50',
    json: true
  }, function (err, res, body) {
    if (err) {
      callback({ error: err });
      return;
    }
    if (res.statusCode !== 200) {
      callback({ status: res.statusCode, body: body });
      return;
    }
    callback(null, body);
    console.log(new Date() - start + ' msec');
  });
}

function sessions(id, callback) {
  var count = 0;

  (function exec() {
    var start = new Date();
    request.post({
      headers: {
        Authorization: "Token " + process.env.API_KEY,
        'Content-type': 'application/json'
      },
      url: constants.VIEW_API_BASE + '/sessions',
      body: JSON.stringify({ document_id: id }),
      json: true
    }, function (err, res, body) {
      if (err) {
        callback({ error: err });
        return;
      }
      if (res.statusCode !== 201) {
        retryHandler();
        return;
      }
      callback(null, body);
      console.log(new Date() - start + ' msec');
    });

    function retryHandler() {
      if (count++ > 10) {
        callback({ error: new Error('Gave up.') });
        return;
      }
      setTimeout(function() {
        exec();
      }, 1000);
    }
  })();
}

function extract(id, callback) {
  var start = new Date();
  request.get({
    headers: { Authorization: "Token " + process.env.API_KEY },
    url: constants.VIEW_API_BASE + '/documents/' + id + '/content.zip',
    encoding: null
  }, function (err, response, buffer) {
    if (err) {
      callback({ error: err });
      return;
    }
    if (response.statusCode !== 200) {
      callback({ statusCode: response.statusCode });
      return;
    }
    var text = new AdmZip(buffer).getEntries()
      .filter(function (entry) {
        return !entry.isDirectory && entry.name.match(constants.REGEXP_SVG) !== null;
      })
      .map(function (entry) {
        return cheerio.load(entry.getData(), OPTIONS)('text tspan').text();
      }).join();
    callback(null, text);
    console.log(new Date() - start + ' msec');
  });
}

exports.folder = function(token, id, callback) { invoker(token, '/folders/' + id, callback); };
exports.file   = function(token, id, callback) { invoker(token, '/files/'   + id, callback); };
exports.location = location;
exports.upload = upload;
exports.documents = documents;
exports.sessions = sessions;
exports.extract = extract;
