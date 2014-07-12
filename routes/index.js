var async = require('async');
var request = require('request');
var invoker = require('./../lib/invoker');
var constants = require('./../lib/constants');

var TITLE = constants.TITLE;

function index(req, res) {
  if (req.isAuthenticated()) {
    res.redirect('/folders/0');
  } else {
    res.render('index', { title: TITLE });
  }
}

function folders(req, res) {
  invoker.folder(req.session.passport.user.accessToken, req.params.id, function(err, result) {
    if (err) {
      console.error(err);
      res.send(500);
    } else {
      result.item_collection.entries.forEach(function(entry) {
        entry.href = '/' + entry.type + 's/' + entry.id;
      });
      res.render('folders', { title: TITLE, result: result });
    }
  });
}

function files(req, res) {
  invoker.content(req.session.passport.user.accessToken, req.params.id, function(err, result) {
    if (err) {
      console.error(err);
      res.send(500);
    } else {
      res.render('files', { title: TITLE, result: result });
    }
  });
}

function download(req, res) {
  request.get({
    headers: { Authorization: "Bearer " + req.session.passport.user.accessToken },
    url: 'https://api.box.com/2.0/files/' + req.params.id + '/content'
  }).pipe(res);
}

function convert(req, res) {
  invoker.documents(function(err, result) {
    if (err) {
      console.error(err);
      res.send(500);
      return;
    }
    if (result.document_collection.entries.some(function(entry) { return entry.name === req.params.id; })) {
      res.redirect('/documents');
      return;
    }
    async.waterfall([
      function (callback) {
        invoker.location(req.session.passport.user.accessToken, req.params.id, callback)
      },
      function (url, callback) {
        invoker.sessions(url, req.params.id, callback);
      }
    ], function (err) {
      if (err) {
        console.error(err);
        res.send(500);
        return;
      }
      res.redirect('/documents');
    });
  });
}

function documents(req, res) {
  invoker.documents(function(err, result) {
    if (err) {
      console.error(err);
      res.send(500);
    } else {
      res.render('documents', { title: TITLE, result: result });
    }
  });
}

exports.index = index;
exports.folders = folders;
exports.files = files;
exports.download = download;
exports.convert = convert;
exports.documents = documents;
