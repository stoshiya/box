var async = require('async');
var request = require('request');

var ELASTIC_SEARCH_HOST = process.env.BONSAI_URL || 'http://localhost:9200/';
var INDEX_NAME = 'boxview';
var BASE_URL = ELASTIC_SEARCH_HOST + INDEX_NAME;

function existsIndex(callback) {
  var start = new Date();
  request.head({ url: BASE_URL }, function (err, res) {
    if (err) {
      callback({ error: err });
      return;
    }
    callback(null, res.statusCode === 200);
    console.log(new Date() - start + ' msec');
  });
}

function putMapping(callback) {
  var start = new Date();
  request.put({
    url: BASE_URL,
    json: { mappings: { entry: { properties: {
      id:       { type: 'string' },
      userId:   { type: 'string' },
      modified: { type: 'date' },
      title:    { type: 'string', analyzer: 'kuromoji' },
      body:     { type: 'string', analyzer: 'kuromoji' }
    } } } }
  }, function (err, res, body) {
    if (err) {
      callback({ error: err });
      return;
    }
    if (res.statusCode !== 200) {
      callback({ status: res.statusCode, body: body });
      return;
    }
    callback();
    console.log(new Date() - start + ' msec');
  });
}

function init(callback) {
  existsIndex(function(err, exists) {
    if (err) {
      callback(err);
      return;
    }
    if (exists) {
      callback();
      return;
    }
    putMapping(callback);
  });
}

function search(userId, keyword, callback) {
  var start = new Date();
  request({
    url: BASE_URL + '/entry/_search',
    body: JSON.stringify({ query: { filtered: {
      query: { match: { body: keyword } },
      filter: { query: { match: { userId: userId } } }
    } } }),
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

function documents(id, userId, callback) {
  var start = new Date();
  request({
    url: BASE_URL + '/entry/_search',
    body: JSON.stringify({ query: { filtered: {
      query: { match: { id: id } },
      filter: { query: { match: { userId: userId } } }
    } } }),
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
    callback(null, body.hits.hits);
    console.log(new Date() - start + ' msec');
  });
}

function upsertDocument(existsDocuments, id, name, modified, userId, text, callback) {
  if (existsDocuments.length > 0) {
    if (existsDocuments[0]._source.modified === modified || new Date(existsDocuments[0]._source.modified) === new Date(modified)) {
      callback();
      return;
    }
  }
  var start = new Date();
  request.post({
    url: existsDocuments.length > 0 ? BASE_URL + '/entry/' + existsDocuments[0]._id : BASE_URL + '/entry',
    json: { id: id, userId: userId, modified: modified, title: name, body: text }
  }, function(err, res, body) {
    if (err) {
      callback({ error: err });
      return;
    }
    if (res.statusCode !== 200 && res.statusCode !== 201) {
      callback({ status: res.statusCode, body: body });
      return;
    }
    callback(null, body);
    console.log(new Date() - start + ' msec');
  });
}

function putDocument(id, name, modified, userId, text, callback) {
  async.waterfall([
    function(callback) {
      documents(id, userId, callback);
    },
    function(existsDocuments, callback) {
      upsertDocument(existsDocuments, id, name, modified, userId, text, callback);
    }
  ], callback);
}

exports.search = search;
exports.putDocument = putDocument;

init(function(err) {
  if (err) {
    console.error(err);
    process.exit(1);
  }
});
