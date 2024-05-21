let db = require("../db");
let { query } = require("./database_queries");

async function check_user_token(req, res, next){
	var webToken = req.headers['authorization'];
	if(webToken){
		if(webToken.startsWith("Bearer ")){
			webToken = webToken.split(" ")[1];
		} else {
			webToken = undefined;
		};
	};

	if (webToken === undefined){
		res.status(401).send({"status": 401, "message": "Invalid token"});
	} else{
		db.query("SELECT * FROM users WHERE token = ?", [webToken], function(err, result){
			if (err) throw err;
			if (result.length > 0){
                // get the token_expires_at from the database and see if it isn't expired yet:
                let token_expires_at = result[0].token_expires_at;
                let now = new Date();
                if (token_expires_at < now) {
                    res.status(401).json({"status": 401, "message": "Token expired"});
                } else {
                    req.user = result[0];
                    next();
                };
			} else{
				res.status(401).send({"status": 401, "message": "Invalid token"});
			};
		});
	};
};

module.exports = {
	check_user_token,
};