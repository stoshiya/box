var debug = require('debug')('box');
var request = require('request');

var ELASTIC_SEARCH_HOST = process.env.BONSAI_URL || 'http://localhost:9200/';
var INDEX_NAME = 'boxview';
var BASE_URL = ELASTIC_SEARCH_HOST + INDEX_NAME;

function existsIndex(callback) {
  var name = 'elasticsearch.existsIndex()';
  var start = new Date();
  request.head({ url: BASE_URL }, function (err, res) {
    if (err) {
      callback({ name: name, error: err });
      return;
    }
    callback(null, res.statusCode === 200);
    debug('%s %d msec', name, new Date() - start);
  });
}

function putMapping(callback) {
  var name = 'elasticsearch.putMapping()';
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
      callback({ name: name, error: err });
      return;
    }
    if (res.statusCode !== 200) {
      callback({ name: name, status: res.statusCode, body: body });
      return;
    }
    callback();
    debug('%s %d msec', name, new Date() - start);
  });
}

function init(callback) {
  existsIndex(function (err, exists) {
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
  var name = 'elasticsearch.search()';
  var start = new Date();
  request({
    url: BASE_URL + '/entry/_search',
    body: JSON.stringify({ query: { filtered: {
      query: { query_string: {
        query: keyword,
        fields: ["title", "body"],
        use_dis_max: true
      } },
      filter: { query: { match: { userId: userId } } }
    } } }),
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

function documents(id, userId, callback) {
  var name = 'elasticsearch.documents()';
  var start = new Date();
  request({
    url: BASE_URL + '/entry/_search',
    body: JSON.stringify({ query: { filtered: {
      query: { match: { id: id } },
      filter: { query: { match: { userId: userId } } }
    } } }),
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
    callback(null, body.hits.hits);
    debug('%s %d msec', name, new Date() - start);
  });
}

function upsertDocument(existsDocuments, id, title, modified, userId, text, callback) {
  var name = 'elasticsearch.upsertDocument()';
  var start = new Date();
  request.post({
    url: existsDocuments.length > 0 ? BASE_URL + '/entry/' + existsDocuments[0]._id : BASE_URL + '/entry',
    json: { id: id, userId: userId, modified: modified, title: title, body: text }
  }, function (err, res, body) {
    if (err) {
      callback({ name: name, error: err });
      return;
    }
    if (res.statusCode !== 200 && res.statusCode !== 201) {
      callback({ name: name, status: res.statusCode, body: body });
      return;
    }
    callback(null, body);
    debug('%s %d msec', name, new Date() - start);
  });
}

exports.search = search;
exports.documents = documents;
exports.upsertDocument = upsertDocument;

init(function(err) {
  if (err) {
    console.error(err);
    process.exit(1);
  }
});
