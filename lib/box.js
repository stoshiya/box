var AdmZip = require('adm-zip');
var cheerio = require('cheerio');
var request = require('request');
var constants = require('./constants');

var CONTENT_API_BASE = constants.CONTENT_API_BASE;
var VIEW_API_BASE = constants.VIEW_API_BASE;

var OPTIONS = { normalizeWhitespace: true, xmlMode: true };

function retrieve(token, path, callback) {
  var name = 'box.retrieve()';
  var start = new Date();
  request.get({
    headers: { Authorization: "Bearer " +  token },
    url: CONTENT_API_BASE + path,
    json: true
  }, function(err, res, body) {
    if (err) {
      callback({ name: name, error: err });
      return;
    }
    if (res.statusCode !== 200) {
      callback({ name: name, status: res.statusCode, body: body });
      return;
    }
    callback(null, body);
    console.log(name + ' ' + (new Date() - start) + ' msec');
  });
}

function location(token, id, callback) {
  var name = 'box.location()';
  var start = new Date();
  request.get({
    headers: { Authorization: "Bearer " + token },
    url: CONTENT_API_BASE + '/files/' + id + '/content',
    followRedirect: false,
    json: true
  }, function(err, res) {
    if (err) {
      callback({ name: name, error: err });
      return;
    }
    if (res.statusCode !== 302) {
      callback({ name: name, status: res.statusCode });
      return;
    }
    callback(null, res.headers.location);
    console.log(name + ' ' + (new Date() - start) + ' msec');
  });
}

function upload(uri, id, callback) {
  var name = 'box.upload()';
  var start = new Date();
  var form = request.post({
    headers: { Authorization: "Token " + process.env.API_KEY },
    url: VIEW_API_BASE + '/documents',
    json: true
  }, function(err, res, body) {
    if (err) {
      callback({ name: name, error: err });
      return;
    }
    if (res.statusCode !== 202) {
      callback({ name: name, status: res.statusCode, body: body });
      return;
    }
    callback(null, body);
    console.log(name + ' ' + (new Date() - start) + ' msec');
  }).form();
  form.append('url', uri);
  form.append('name', id);
}

function documents(callback) {
  var name = 'box.sessions()';
  var start = new Date();
  request({
    headers: { Authorization: "Token " + process.env.API_KEY },
    url: VIEW_API_BASE + '/documents?limit=50',
    json: true
  }, function (err, res, body) {
    if (err) {
      callback({ name: name, error: err });
      return;
    }
    if (res.statusCode !== 200) {
      callback({ name: name, status: res.statusCode, body: body });
      return;
    }
    callback(null, body);
    console.log(name + ' ' + (new Date() - start) + ' msec');
  });
}

function sessions(id, callback) {
  var name = 'box.sessions()';
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
        callback({ name: name, error: err });
        return;
      }
      if (res.statusCode !== 201) {
        retryHandler();
        return;
      }
      callback(null, body);
      console.log(name + ' ' + (new Date() - start) + ' msec');
    });

    function retryHandler() {
      if (count++ > 10) {
        callback({ name: name, error: new Error('Gave up.') });
        return;
      }
      setTimeout(function() {
        exec();
      }, 1000);
    }
  })();
}

function extract(id, callback) {
  var name = 'box.extract()';
  var start = new Date();
  request.get({
    headers: { Authorization: "Token " + process.env.API_KEY },
    url: constants.VIEW_API_BASE + '/documents/' + id + '/content.zip',
    encoding: null
  }, function (err, response, buffer) {
    if (err) {
      callback({ name: name, error: err });
      return;
    }
    if (response.statusCode !== 200) {
      callback({ name: name, status: response.statusCode });
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
    console.log(name + ' ' + (new Date() - start) + ' msec');
  });
}

exports.folder = function(token, id, callback) { retrieve(token, '/folders/' + id, callback); };
exports.file   = function(token, id, callback) { retrieve(token, '/files/'   + id, callback); };
exports.location = location;
exports.upload = upload;
exports.documents = documents;
exports.sessions = sessions;
exports.extract = extract;