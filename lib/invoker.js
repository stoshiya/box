var request = require('request');
var constants = require('./constants');

var CONTENT_API_BASE = constants.CONTENT_API_BASE;
var VIEW_API_BASE = constants.VIEW_API_BASE;

function invoker(token, path, callback) {
  var start = new Date();
  request.get({
    headers: { Authorization: "Bearer " +  token },
    url: CONTENT_API_BASE + path,
    json: true
  }, function(err, res, body) {
    if (err) {
      callback(err);
      return;
    }
    if (res.statusCode !== 200) {
      callback(res.statusCode);
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
      callback(err);
      return;
    }
    if (res.statusCode !== 302) {
      callback(res.statusCode);
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
      res.send(500);
      return;
    }
    if (res.statusCode !== 202) {
      res.send(500);
      return;
    }
    callback(null, body.id);
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
      callback(err);
      return;
    }
    if (res.statusCode !== 200) {
      callback(res.statusCode);
      return;
    }
    callback(null, body);
    console.log(new Date() - start + ' msec');
  });
}

function sessions(id, callback) {
  var start = new Date();
  request.post({
    headers: {
      Authorization: "Token " + process.env.API_KEY,
      'Content-type': 'application/json'
    },
    url: constants.VIEW_API_BASE + '/sessions',
    body: JSON.stringify({ document_id: id }),
    json: true
  }, function(err, response, body) {
    if (err) {
      callback(500);
      return;
    }
    callback(null, body);
    console.log(new Date() - start + ' msec');
  });
}

exports.folder  = function(token, id, callback) { invoker(token, '/folders/' + id, callback); };
exports.content = function(token, id, callback) { invoker(token, '/files/'   + id, callback); };
exports.location = location;
exports.upload = upload;
exports.documents = documents;
exports.sessions = sessions;
