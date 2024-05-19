// require the needed modules
var createError = require('http-errors');
var express = require('express');
var logger = require('morgan');
var { send_error } = require('./functions/error.js');
// let db = require('./db.js');
// var { query } = require(`./functions/database_queries.js`);

// require the routers
var indexRouter = require('./routes/index');

// global.db = db;
// global.query = query;

// whipe deleted users daily
// var { start_daily_jobs } = require('./functions/daily_checks');
// start_daily_jobs();

// create the express app
var app = express();

// view engine setup
app.use(express.static(__dirname + '/public'));

app.locals.pluralize = require('pluralize');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// use the routers
app.use('/', indexRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;

    // render the error page
    res.status(err.status || 500);
    if(err.status == 404) {
        return res.send("404 Not Found");
    }  else {
        send_error(err, "webpage/api request");
    }
});

module.exports = app;