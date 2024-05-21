// require the needed modules
var express = require("express");
var crypto = require("crypto");
var { newUser, forgot_password } = require("../../functions/email");
var { send_error } = require("../../functions/error");
var {
  check_user_token
} = require("../../functions/middleware");

// create the router
var router = express.Router();

router.post("/register", function (req, res){
	console.log(req.body);
	
	res.json({
		status: 200,
		message: "Successfully registered"
	});
});

module.exports = router;
