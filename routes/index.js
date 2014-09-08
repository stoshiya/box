var async = require('async');
var debug = require('debug')('box');
var path = require('path');
var request = require('request');
var constants = require('./../lib/constants');
var elasticsearch = require('./../lib/elasticsearch');
var box = require('./../lib/box');
var libUtil = require('./../lib/util');

var TITLE = constants.TITLE;
var REGEXP_SUPPORTED_FILES = /pdf|doc|docx|ppt|pptx/i; // refer <https://developers.box.com/view/>

function loginform(req, res) {
  if (req.isAuthenticated()) {
    res.redirect('/folders/0');
  } else {
    res.render('loginform', { title: TITLE });
  }
}

function folders(req, res) {
  box.folder(req.session.passport.user.accessToken, req.params.id, function (err, result) {
    if (err) {
      console.error(err);
      res.status(500).end();
    } else {
      res.render('folders', { title: TITLE, result: result });
    }
  });
}

function files(req, res) {
  box.file(req.session.passport.user.accessToken, req.params.id, function (err, result) {
    if (err) {
      console.error(err);
      res.status(500).end();
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
  async.waterfall([
    function (callback) {
      async.parallel({
        file: function (callback) {
          box.file(req.session.passport.user.accessToken, req.params.id, callback);
        },
        documents: function (callback) {
          box.documents(callback);
        }
      }, callback);
    },
    function (result, callback) {
      if (libUtil.hasDocument(req.params.id, result)) {
        callback(null, libUtil.findId(req.params.id, result));
      } else {
        async.waterfall([
          function (callback) {
            box.location(req.session.passport.user.accessToken, req.params.id, callback);
          },
          function (url, callback) {
            box.upload(url, req.params.id, callback);
          }
        ], callback);
      }
    },
    function(result, callback) {
      box.wait(result.id, callback);
    },
    function (result, callback) {
      box.sessions(result.id, callback);
    }
  ], function (err, result) {
    if (err) {
      console.error(err);
      res.status(500).end();
      return;
    }
    res.redirect(result.urls.view);
  });
}

function indexing(userId, token, id, callback) {
  async.waterfall([
    function (callback) {
      async.parallel({
        file: function (callback) {
          box.file(token, id, callback);
        },
        documents: function (callback) {
          box.documents(callback);
        }
      }, callback);
    },
    function (result, callback) {
      var file = result.file;
      if (libUtil.hasDocument(id, result)) {
         callback(null, { file: file, id: libUtil.findId(id, result) });
      } else {
        async.waterfall([
          function (callback) {
            box.location(token, id, callback);
          },
          function (url, callback) {
            box.upload(url, id, callback);
          },
          function (result, callback) {
            box.wait(result.id, callback);
          }
        ], function (err, result) {
          if (err) {
            callback(err);
          } else {
            callback(null, { file: file, id: result.id });
          }
        });
      }
    },
    function (result, callback) {
      elasticsearch.documents(result.file.id, userId, function (err, documents) {
        if (err) {
          callback(err);
          return;
        }
        if (documents.length > 0) {
          var modified = new Date(result.file.modified_at);
          var isUpdated = documents.every(function (document) {
            return document._source.modified === result.file.modified_at || new Date(document._source.modified) === modified;
          });
          if (isUpdated) {
            callback();
            return;
          }
        }
        async.waterfall([
          function (callback) {
            box.extract(result.id, callback);
          },
          function (text, callback) {
            elasticsearch.upsertDocument(documents, result.file.id, result.file.name, result.file.modified_at, result.file.created_by.id, text, callback);
          }
        ], callback);
      });
    }
  ], callback);
}

function documents(req, res) {
  box.documents(function(err, result) {
    if (err) {
      console.error(err);
      res.status(500).end();
      return;
    }
    res.render('documents', { title: TITLE, result: result });
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

function search(req, res) {
  if (typeof req.query.query !== 'string' || req.query.query === '') {
    res.status(400).end();
    return;
  }
  elasticsearch.search(req.session.passport.user.id, req.query.query, function (err, result) {
    if (err) {
      res.status(500).end();
      console.error(err);
      return;
    }
    res.render('search', { title: TITLE, result: result, query: req.query.query });
  });
}

function createIndexes(userId, token, id, callback) {
  async.waterfall([
    function (callback) {
      box.folderItems(token, id, callback);
    },
    function (result, callback) {
      async.eachSeries(result, function(entry, callback) {
        if (entry.type === 'folder') {
          createIndexes(userId, token, entry.id, callback);
        } else if (path.extname(entry.name).match(REGEXP_SUPPORTED_FILES) !== null) {
          indexing(userId, token, entry.id, callback);
        } else {
          callback();
        }
      }, callback);
    }
  ], callback);
}

function callback(req, res) {
  res.redirect(req.session.callbackURL || '/folders/0');
  delete req.session.callbackURL;
  createIndexes(req.session.passport.user.id, req.session.passport.user.accessToken, '0', function (err) {
    if (err) {
      console.error(err);
    } else {
      debug('finished indexes.');
    }
  });
}

function logout(req, res) {
  req.logout();
  res.redirect('/');
}

exports.loginform = loginform;
exports.folders = folders;
exports.files = files;
exports.download = download;
exports.view = view;
exports.documents = documents;
exports.zip = zip;
exports.pdf = pdf;
exports.search = search;
exports.callback = callback;
exports.logout = logout;
