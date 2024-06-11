// require the needed modules
var express = require('express');

// create the router
var router = express.Router();

var usersRouter = require('./API/users');
var contactRouter = require('./API/contact');
var booksRouter = require('./API/books');
var writersRouter = require('./API/writers');

router.use('/users', usersRouter);
router.use('/contact', contactRouter);
router.use('/books', booksRouter);
router.use('/writers', writersRouter);

router.get('/', function(req, res, next){
    res.json({
        status: 418,
        message: "I'm a teapot"
    })
})

module.exports = router;