// require the needed modules
var express = require('express');

// create the router
var router = express.Router();

router.use((req, res, next) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];
  const ip = realIP || forwardedFor || req.ip;
  console.log(`Visitor IP Address: ${ip.replace('::ffff:', '')}`);
  next();
});

var apiRouter = require('./api');
var docsRouter = require('./docs.js');

router.use('/api/v2', apiRouter);
router.use('/docs/v2', docsRouter);

router.get('/', function (req, res) {
  res.redirect("/docs/v2");
});


module.exports = router;