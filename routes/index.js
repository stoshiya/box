var invoker = require('./../lib/invoker');

function index(req, res) {
  res.render('index', { title: 'Express' });
}

function folders(req, res) {
  invoker.folder(req.session.passport.user.accessToken, req.params.id, function(err, result) {
    if (err) {
      console.error(err);
      res.send(500);
    } else {
      res.render('folders', {
        title: 'Express',
        entries: result.item_collection.entries.map(function(entry) {
          entry.href = '/' + entry.type + 's/' + entry.id;
          return entry;
        })
      });
    }
  });
}

function files(req, res) {
  invoker.content(req.session.passport.user.accessToken, req.params.id, function(err, result) {
    if (err) {
      console.error(err);
      res.send(500);
    } else {
      res.render('files', { title: 'Express', result: JSON.stringify(result) });
    }
  });
}

exports.index = index;
exports.folders = folders;
exports.files = files;

