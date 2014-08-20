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
      id:    { type: 'string' },
      title: { type: 'string', analyzer: 'kuromoji' },
      body:  { type: 'string', analyzer: 'kuromoji' }
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

function search(keyword, callback) {
  var start = new Date();
  request({
    url: BASE_URL + '/entry/_search',
    body: JSON.stringify({ query : { match: { body: keyword } } } ),
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

function putDocument(id, name, text, callback) {
  var start = new Date();
  request.post({
    url: BASE_URL + '/entry',
    json: { id: id, name: name, body: text }
  }, function(err, res, body) {
    if (err) {
      callback({ error: err });
      return;
    }
    if (res.statusCode !== 201) {
      callback({ status: res.statusCode, body: body });
      return;
    }
    callback(null, body);
    console.log(new Date() - start + ' msec');
  });
}

exports.search = search;
exports.putDocument = putDocument;

init(function(err) {
  if (err) {
    console.error(err);
    process.exit(1);
  }
});
