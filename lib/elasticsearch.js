var request = require('request');

var ELASTIC_SEARCH_HOST = process.env.BONSAI_URL || 'http://localhost:9200/';
var INDEX_NAME = 'boxview';
var BASE_URL = ELASTIC_SEARCH_HOST + INDEX_NAME;

function init(callback) {
  // check index.
  request.head({ url: BASE_URL }, function (err, res) {
    if (err) {
      callback({ error: err });
      return;
    }
    if (res.statusCode === 200) {
      callback();
      return;
    }
    // create index and put mapping.
    request.put({
      url: BASE_URL,
      json: { mappings: { entry: { properties: {
        id:   { type: 'string' },
        body: { type: 'string', analyzer: 'kuromoji'}
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
    });
  });
}

function search(keyword, callback) {
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
  });
}

function putDocument(id, text, callback) {
  request.post({
    url: BASE_URL + '/entry',
    json: { id: id, body: text }
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
