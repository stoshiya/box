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
    url: constants.CONTENT_API_BASE + '/files/' + req.params.id + '/content'
  }).pipe(res);
}

function view(req, res) {
  async.parallel({
    content: function (callback) {
      invoker.content(req.session.passport.user.accessToken, req.params.id, callback);
    },
    documents: function (callback) {
      invoker.documents(callback);
    }
  }, function (err, result) {
    if (err) {
      console.error(err);
      res.send(500);
      return;
    }
    if (result.documents.document_collection.entries.some(function(entry) {
      return entry.name === req.params.id && new Date(result.content.modified_at) < new Date(entry.created_at);
    })) {
      var id = result.documents.document_collection.entries.filter(function(entry) {
        return entry.name === req.params.id && new Date(result.content.modified_at) < new Date(entry.created_at);
      }).shift().id;
      invoker.sessions(id, function(err, result) {
        if (err) {
          console.error(err);
          res.send(500);
          return;
        }
        res.redirect(result.urls.view);
      });
    } else {
      async.waterfall([
        function (callback) {
          invoker.location(req.session.passport.user.accessToken, req.params.id, callback)
        },
        function (url, callback) {
          invoker.upload(url, req.params.id, callback);
        },
        function (body, callback) {
          invoker.sessions(body.id, callback);
        }
      ], function (err, result) {
        if (err) {
          console.error(err);
          res.send(500);
          return;
        }
        res.redirect(result.urls.view);
      });
    }
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

function zip(req, res) {
  request.get({
    headers: { Authorization: "Token " + process.env.API_KEY },
    url: constants.VIEW_API_BASE + '/documents/' + req.params.id + '/content.zip'
  }).pipe(res);
}

function pdf(req, res) {
  request.get({
    headers: { Authorization: "Token " + process.env.API_KEY },
    url: constants.VIEW_API_BASE + '/documents/' + req.params.id + '/content.pdf'
  }).pipe(res);
}

exports.index = index;
exports.folders = folders;
exports.files = files;
exports.download = download;
exports.view = view;
exports.documents = documents;
exports.zip = zip;
exports.pdf = pdf;
