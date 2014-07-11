var request = require('request');

function invoker(token, path, callback) {
  var start = new Date();
  var opt = {
    headers: { Authorization: "Bearer " +  token },
    url: 'https://api.box.com/2.0' + path,
    json: true
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
    callback(null, body);
    console.log(new Date() - start + ' msec');
  });
}

exports.folder  = function(token, id, callback) { invoker(token, '/folders/' + id, callback); };
exports.content = function(token, id, callback) { invoker(token, '/files/'   + id, callback); };
