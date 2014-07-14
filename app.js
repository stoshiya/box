var express = require('express');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var passport = require('passport');
var BoxStrategy = require('passport-box').Strategy;

var routes = require('./routes/index');

var app = express();

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET || !process.env.CALLBACK_URL) {
  process.exit(1);
  return;
}

passport.use('box', new BoxStrategy({
  clientID:     process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL:  process.env.CALLBACK_URL
}, function(accessToken, refreshToken, profile, done) {
  profile.accessToken = accessToken;
  process.nextTick(function() {
    return done(null, profile);
  });
}));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({ secret: 'secret', resave: true, saveUninitialized: true, cookie: { maxAge: 60 * 60 * 1000 } }));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));


var auth = function(req, res, next) {
  if (req.isAuthenticated()) {
    delete req.session.callbackURL;
    next();
    return;
  }
  req.session.callbackURL = req.url;
  res.redirect('/login');
};

var router = express.Router();
router.get('/login',    passport.authenticate('box'));
router.get('/callback', passport.authenticate('box', { failureRedirect: '/login' }), function (req, res) {
  res.redirect(req.session.callbackURL || '/folders/0');
});
router.get('/logout', function(req, res) {
  req.logout();
  res.redirect('/');
});
router.get('/', routes.index);
router.get('/folders/:id',   auth, routes.folders);
router.get('/files/:id',     auth, routes.files);
router.get('/download/:id',  auth, routes.download);
router.get('/convert/:id',   auth, routes.convert);
router.get('/documents',     auth, routes.documents);
router.get('/documents/:id', auth, routes.view);
app.use('/', router);

/// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

module.exports = app;

process.on('uncaughtException', function(err) {
  console.error(err);
});
