let db = require("../db");
let { query } = require("./database_queries");

async function check_user_token(req, res, next) {
    var webToken = req.headers['authorization'];
    console.log("Authorization header:", webToken);

    if (webToken) {
        if (webToken.startsWith("Bearer ")) {
            webToken = webToken.split(" ")[1];
        } else {
            webToken = undefined;
        }
    }

    console.log("Extracted token:", webToken);

    if (webToken === undefined) {
        console.log("No token provided or token format incorrect");
        res.status(401).send({ "status": 401, "message": "Invalid token" });
    } else {
        db.query("SELECT id,first_name,last_name,email,email_verified,phone_number,role,seller FROM users WHERE token = ?", [webToken], function (err, result) {
            if (err) {
                console.error("Database error:", err);
                res.status(500).send({ "status": 500, "message": "Internal server error" });
                return;
            }

            if (result.length > 0) {
                let token_expires_at = new Date(result[0].token_expires_at);
                let now = new Date();
                if (token_expires_at < now) {
                    console.log("Token expired");
                    res.status(401).json({ "status": 401, "message": "Token expired" });
                } else {
                    req.user = result[0];
                    next();
                }
            } else {
                console.log("Token not found in database");
                res.status(401).send({ "status": 401, "message": "Invalid token" });
            }
        });
    }
}

async function check_user_id() {
	return function(req, res, next) {
		let user_id = req.params.id;
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
					if (result[0].id === user_id){
						next();
					} else{
						res.status(401).send({"status": 401, "message": "Unauthorized"});
					};
				} else{
					res.status(401).send({"status": 401, "message": "Unauthorized"});
				};
			});
		};
	};
}

module.exports = {
	check_user_token,
	check_user_id,
};