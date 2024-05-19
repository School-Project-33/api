// require the needed modules
var express = require('express');

// create the router
var router = express.Router();

var usersRouter = require('./API/users');

router.use('/users', usersRouter);

router.get('/', function(req, res, next){
    res.json({
        status: 418,
        message: "I'm a teapot"
    })
})

module.exports = router;