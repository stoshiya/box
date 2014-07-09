var request = require('request');

function invoker(token, path, id, callback) {
  var start = new Date();
  var opt = {
    headers: { Authorization: "Bearer " +  token },
    url: 'https://api.box.com/2.0/' + path + '/' + id
  };
  request(opt, function(err, res, body) {
    if (err) {
      callback(err);
      return;
    }
    if (res.statusCode !== 200) {
      callback(res.statusCode);
      return;
    }
    try {
      var entries = JSON.parse(body);
      callback(null, entries);
      console.log(new Date() - start + ' msec');
    } catch (error) {
      callback(error);
    }
  });
}

exports.folder  = function(token, id, callback) { invoker(token, 'folders', id, callback); };
exports.content = function(token, id, callback) { invoker(token, 'files',   id, callback); };

