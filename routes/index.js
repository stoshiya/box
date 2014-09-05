var async = require('async');
var request = require('request');
var constants = require('./../lib/constants');
var elasticsearch = require('./../lib/elasticsearch');
var box = require('./../lib/box');

var TITLE = constants.TITLE;

function index(req, res) {
  if (req.isAuthenticated()) {
    res.redirect('/folders/0');
  } else {
    res.render('index', { title: TITLE });
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

function hasDocument(id, result) {
  return result.documents.document_collection.entries.some(function (entry) {
    return entry.name === id && new Date(result.file.modified_at) < new Date(entry.created_at);
  });
}

function findId(id, result) {
  return result.documents.document_collection.entries.filter(function (entry) {
    return entry.name === id && new Date(result.file.modified_at) < new Date(entry.created_at);
  }).shift().id;
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
      if (hasDocument(req.params.id, result)) {
        callback(null, findId(req.params.id, result));
      } else {
        async.waterfall([
          function (callback) {
            box.location(req.session.passport.user.accessToken, req.params.id, callback);
          },
          function (url, callback) {
            box.upload(url, req.params.id, callback);
          }
        ], function (err, result) {
          if (err) {
            callback(err);
          } else {
            callback(null, result.id);
          }
        });
      }
    },
    function (id, callback) {
      box.sessions(id, callback);
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
      if (hasDocument(id, result)) {
        callback(null, { file: result.file, id: findId(id, result) });
      } else {
        async.waterfall([
          function (callback) {
            box.location(token, id, callback);
          },
          function (url, callback) {
            box.upload(url, id, callback);
          }
        ], function (err, id) {
          callback(err, { file: result.file, id: id });
        });
      }
    },
    function (result, callback) {
      elasticsearch.documents(result.file.id, userId, function (err, documents) {
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
        } else {
          indexing(userId, token, entry.id, callback);
        }
      }, callback);
    }
  ], callback);
}

exports.index = index;
exports.folders = folders;
exports.files = files;
exports.download = download;
exports.view = view;
exports.documents = documents;
exports.zip = zip;
exports.pdf = pdf;
exports.search = search;
exports.createIndexes = createIndexes;
