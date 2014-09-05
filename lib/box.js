var AdmZip = require('adm-zip');
var async = require('async');
var cheerio = require('cheerio');
var debug = require('debug')('box');
var request = require('request');
var constants = require('./constants');

var CONTENT_API_BASE = constants.CONTENT_API_BASE;
var VIEW_API_BASE = constants.VIEW_API_BASE;
var LIMIT = 1000; // refer <https://developers.box.com/docs/#folders-retrieve-a-folders-items>

var OPTIONS = { normalizeWhitespace: true, xmlMode: true };

function retrieve(token, path, callback) {
  var name = 'box.retrieve()';
  var start = new Date();
  request.get({
    headers: { Authorization: "Bearer " + token },
    url: CONTENT_API_BASE + path,
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
    debug('%s %s %d msec', name, path, new Date() - start);
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
    debug('%s %d msec', name, new Date() - start);
  });
}

function upload(uri, id, callback) {
  var name = 'box.upload()';
  var start = new Date();
  var form = request.post({
    headers: { Authorization: "Token " + process.env.API_KEY },
    url: VIEW_API_BASE + '/documents',
    json: true
  }, function (err, res, body) {
    if (err) {
      callback({ name: name, error: err });
      return;
    }
    if (res.statusCode !== 202) {
      callback({ name: name, status: res.statusCode, body: body });
      return;
    }
    callback(null, body);
    debug('%s %d msec', name, new Date() - start);
  }).form();
  form.append('url', uri);
  form.append('name', id);
}

function documents(callback) {
  var name = 'box.documents()';
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
    debug('%s %d msec', name, new Date() - start);
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
      debug('%s %d msec', name, new Date() - start);
    });

    function retryHandler() {
      if (count++ > 10) {
        callback({ name: name, error: new Error('Gave up.') });
        return;
      }
      setTimeout(function () {
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
    debug('%s %d msec', name, new Date() - start);
  });
}

function folderItems(token, id, callback) {
  var name = 'box.folderItems()';
  var start = new Date();
  var total;
  var offset = 0;
  var entries = [];
  async.doWhilst(
    function (callback) {
      retrieve(token, '/folders/' + id + '/items?limit=' + LIMIT + '&offset=' + offset, function (err, result) {
        if (err) {
          callback(err);
          return;
        }
        total = result.total_count;
        result.entries.forEach(function (entry) {
          entries.push(entry);
        });
        callback();
      });
    },
    function () {
      return (offset += LIMIT) <= total;
    },
    function (err) {
      if (err) {
        callback({ name: name, error: err });
        return;
      }
      callback(null, entries);
      debug('%s %d msec', name, new Date() - start);
    }
  );
}

exports.folder = function(token, id, callback) { retrieve(token, '/folders/' + id, callback); };
exports.file   = function(token, id, callback) { retrieve(token, '/files/'   + id, callback); };
exports.location = location;
exports.upload = upload;
exports.documents = documents;
exports.sessions = sessions;
exports.extract = extract;
exports.folderItems = folderItems;
