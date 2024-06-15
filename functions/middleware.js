async function check_user_token(req, res, next) {
    var webToken = req.headers['authorization'];

    if (webToken) {
        if (webToken.startsWith("Bearer ")) {
            webToken = webToken.split(" ")[1];
        } else {
            webToken = undefined;
        }
    }

    if (webToken === undefined) {
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
                    res.status(401).json({ "status": 401, "message": "Token expired" });
                } else {
                    req.user = result[0];
                    next();
                }
            } else {
                res.status(401).send({ "status": 401, "message": "Invalid token" });
            }
        });
    }
}

async function check_user_id(req, res, next) {
	let user_id = req.params.id;
	if (req.user.id === user_id) {
		next();
	} else {
		res.status(401).send({"status": 401, "message": "Unauthorized"});
	}
}

function check_writer_id(req, res, next) {
    let id = req.params.id;
    let user_id = req.user.id;
    let seller = req.user.seller;
    
    if (!seller) {
        return res.status(401).send({"status": 401, "message": "Unauthorized"});
    }

    db.query("SELECT user_id FROM writers WHERE id = ?", [id], function(err, result) {
        if (err) {
            return next(err);
        }
        if (result.length > 0) {
            if (result[0].user_id === user_id || seller === 1) {
                next();
            } else {
                res.status(401).send({"status": 401, "message": "Unauthorized"});
            }
        } else {
            res.status(404).send({"status": 404, "message": "Writer not found"});
        }
    });
}

async function isSeller(){
	return function(req, res, next){
		let user_id = req.user.id;
		db.query("SELECT seller FROM users WHERE id = ?", [user_id], function(err, result){
			if (err) throw err;
			if (result.length > 0){
				if (result[0].seller === 1){
					next();
				} else{
					res.status(401).send({"status": 401, "message": "Unauthorized"});
				};
			} else{
				res.status(401).send({"status": 401, "message": "Unauthorized"});
			};
		});
	}
}

module.exports = {
	check_user_token,
	check_user_id,
	isSeller,
	check_writer_id,
};