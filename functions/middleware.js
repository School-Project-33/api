let db = require("../db");
let permissions = require("../configs/permissions.json");
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

async function getUserRoleFromDatabase(authToken) {
    return new Promise((resolve, reject) => {
        db.query('SELECT role FROM users WHERE token = ?', [authToken], (err, results) => {
            if (err) {
                console.error('Error fetching user role from database:', err);
                return reject(err);
            }
            if (results.length === 0) {
                return resolve(null);
			}

			resolve(results[0].role);
        });
    });
};

async function getUserPermissionsFromDatabase(roleId) {
    return new Promise((resolve, reject) => {
        db.query('SELECT role_level FROM roles WHERE id = ?', [roleId], (err, results) => {
            if (err) {
                console.error('Error fetching user permissions from database:', err);
                return reject(err);
            }
            if (results.length === 0) {
                return resolve(0); // Assuming default permissions are 0
            }
            resolve(results[0].role_level);
        });
    });
};

function hasPermission(permission, userPermissions) {
    // if the user has the ADMIN permission then they can access everything
    if (userPermissions & permissions['ADMIN']) {
        return true;
    } else {
        return (userPermissions & permission) === permission;
    };
};

function check_permission(permission) {
    return async function(req, res, next) {
        try {
            let authToken = req.headers["authorization"];
			if(authToken && !authToken.startsWith("Bearer ")) {
				return res.status(403).send({
					"status": 403,
					"message": "Invalid token"
				});
			}
            if (!authToken) {
                return res.status(401).json({ error: 'Unauthorized: Missing authorization token' });
            }
			authToken = authToken.split(" ")[1];

            const userRole = await getUserRoleFromDatabase(authToken);
            if (!userRole) {
                return res.status(403).json({ error: 'Forbidden: Invalid authorization token' });
            }

            const userPermissions = await getUserPermissionsFromDatabase(userRole);
            if (!hasPermission(permissions[permission], userPermissions)) {
                return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
            }
            // If user has the required permission, proceed to the next middleware/route handler
            next();
        } catch (error) {
            console.error('Error checking user permission:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        };
    };
};

// if the user has permission or if the user is viewing their own page
async function user_check(req, res, next) {
    let authToken = req.headers["authorization"];
	if(authToken && !authToken.startsWith("Bearer ")) {
		return res.status(403).send({
			"status": 403,
			"message": "Invalid token"
		});
	}
    if (!authToken) {
        return res.status(401).json({ error: 'Unauthorized: Missing authorization token' });
    }
	authToken = authToken.split(" ")[1];

    const userRole = await getUserRoleFromDatabase(authToken);
    if (!userRole) {
        return res.status(403).json({ error: 'Forbidden: Invalid authorization token' });
    }

    const userPermissions = await getUserPermissionsFromDatabase(userRole);
	if (req.user.id === req.params.id || hasPermission(permissions["ADMIN"], userPermissions)) {
		next();
	} else {
		res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
	};
};



function check_user_permission(route, permission) {
    return async function(req, res, next) {
        try {
            let authToken = req.headers["authorization"];
            if(authToken && !authToken.startsWith("Bearer ")) {
                return res.status(403).send({
                    "status": 403,
                    "message": "Invalid token"
                });
            }
            if (!authToken) {
                return res.status(401).json({ error: 'Unauthorized: Missing authorization token' });
            }
            authToken = authToken.split(" ")[1];
            let user = await query("SELECT * FROM users WHERE token =? ", [authToken]);

            if (user.length === 0) {
                return res.status(403).json({ error: 'Forbidden: Invalid authorization token' });
            }
            
            let userRole = await query("SELECT * FROM roles WHERE id = ?", [user[0].role]);
            if (userRole.length === 0) {
                return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
            }
            switch (route) {
                case "user_reviews":
                    if(req.params.id != user[0].id) {
                        return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
                    }

                    let all_user_reviews = await query("SELECT * FROM reviews WHERE user_id = ?", [user[0].id]);
                    if (all_user_reviews.length === 0) {
                        return res.status(404).json({ error: 'review not found' });
                    }
                    if (all_user_reviews[0].user_id === user[0].id) {
                        next();
                    } else {
                        // check the users role permission
                        let userPermissions = await query("SELECT * FROM roles WHERE id = ?", [user[0].role]);
                        if (userPermissions.length === 0) {
                            return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
                        }
                        if (!hasPermission(permissions[permission], userPermissions[0].role_level)) {
                            return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
                        }
                        next();
                    }
                    break;
                case "remove_review":
                    let review_by_id = await query("SELECT * FROM reviews WHERE id = ?", [req.params.id]);
                    if (review_by_id.length === 0) {
                        return res.status(404).json({ error: 'Review not found' });
                    }
                    if (review_by_id[0].user_id === user[0].id) {
                        next();
                    } else {
                        // check the users role permission
                        let userPermissions = await query("SELECT * FROM roles WHERE id = ?", [user[0].role]);
                        if (userPermissions.length === 0) {
                            return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
                        }
                        if (!hasPermission(permissions[permission], userPermissions[0].role_level)) {
                            return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
                        }
                        next();
                    }
                    break;
                case "view_logs":
                    let userId = req.params.userId;
                    let logs = await query("SELECT * FROM logs WHERE user_id = ?", [userId]);
                    if (logs.length === 0) {
                        return res.status(200).json({
                            "status": 200,
                            "message": "User has no logs",
                            data: []
                        });
                    }
                    if (logs[0].user_id === user[0].id) {
                        next();
                    } else {
                        // check the users role permission
                        let userPermissions = await query("SELECT * FROM roles WHERE id = ?", [user[0].role]);
                        if (userPermissions.length === 0) {
                            return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
                        }
                        if (!hasPermission(permissions[permission], userPermissions[0].role_level)) {
                            return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
                        }
                        next();
                    }

            }
        } catch (error) {
            console.error('Error checking user permission:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        };
    };
};

module.exports = {
	check_user_token,
	check_permission,
	user_check,
    check_user_permission,
    hasPermission,
    getUserPermissionsFromDatabase,
    getUserRoleFromDatabase,
};