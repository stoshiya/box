var AdmZip = require('adm-zip');
var async = require('async');
var cheerio = require('cheerio');
var request = require('request');
var constants = require('./../lib/constants');
var elasticsearch = require('./../lib/elasticsearch');
var invoker = require('./../lib/invoker');

var TITLE = constants.TITLE;
var OPTIONS = { normalizeWhitespace: true, xmlMode: true };

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

function viewByFile(req, res) {
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
          invoker.location(req.session.passport.user.accessToken, req.params.id, callback);
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

function viewByDocument(req, res) {
  invoker.sessions(req.params.id, function(err, result) {
    if (err) {
      console.error(err);
      res.send(500);
      return;
    }
    res.redirect(result.urls.view);
  });
}

function indexing(id, callback) {
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
    elasticsearch.putDocument(id, text, callback);
  });
}

function documents(req, res) {
  invoker.documents(function(err, result) {
    if (err) {
      console.error(err);
      res.send(500);
      return;
    }
    res.render('documents', { title: TITLE, result: result });

    // make indices for all documents.
    async.eachSeries(result.document_collection.entries,
      function(entry, callback) {
        indexing(entry.id, callback);
      },
      function(err) {
        if (err) {
          console.error(err);
        } else {
          console.log('done indices.');
        }
      });
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

function createIndex(req, res) {
  if (typeof req.params.id !== 'string') {
    res.send(400);
    return;
  }
  indexing(req.params.id, function(err, result) {
    if (err) {
      res.send(500);
      console.error(err);
      return;
    }
    res.send(result);
  });
}

function search(req, res) {
  if (typeof req.query.keyword !== 'string' || req.query.keyword === '') {
    res.send(400);
    return;
  }
  elasticsearch.search(req.query.keyword, function(err, result) {
    if (err) {
      res.send(500);
      console.error(err);
      return;
    }
    res.render('search', { title: TITLE, result: result });
  });
}

exports.index = index;
exports.folders = folders;
exports.files = files;
exports.download = download;
exports.viewByFile = viewByFile;
exports.viewByDocument = viewByDocument;
exports.documents = documents;
exports.zip = zip;
exports.pdf = pdf;
exports.createIndex = createIndex;
exports.search = search;
