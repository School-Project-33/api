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

router.post("/register", async function (req, res) {
	let first_name = req.body.firstname;
	let last_name = req.body.lastname;
	let email = req.body.email;
	let password = req.body.password;
	let phone = req.body.phonenumber;
	let seller = req.body.seller;

	if(!first_name || !last_name || !email || !password || typeof seller !== "boolean") {
		let missing_fields = [];
		if(!first_name) missing_fields.push("firstname");
		if(!last_name) missing_fields.push("lastname");     
		if(!email) missing_fields.push("email");
		if(!password) missing_fields.push("password");
		if(typeof seller !== "boolean") missing_fields.push("seller");
		res.send({ status: 400, message: "Missing required fields" });
		return;
	}
	if(phone == "" || phone == undefined) phone = null;

	let email_check = await query("SELECT email FROM users WHERE email = ?", [email]);
	if(email_check.length > 0) {
		res.status(409).send({ status: 409, message: "Email already in use" });
		return;
	}

	const salt = crypto.randomBytes(16).toString("hex");
	// Hash the password using the salt
	crypto.pbkdf2(
		password,
		salt,
		310000,
		32,
		"sha256",
		function (err, hashedPassword) {
			if (err) throw err;
			// Insert the salt into the salts table
			db.query(
				"INSERT INTO salts (salt) VALUES (?)",
				[salt],
				function (err, result) {
					if (err) throw err;

					// Get the ID of the inserted salt
					const saltId = result.insertId;

					// Insert the user into the users table with the salt ID
					db.query(
						"INSERT INTO users (first_name, last_name, email, seller, phone_number, password, salt) VALUES (?, ?, ?, ?, ?, ?, ?)",
						[first_name, last_name, email, seller, phone, hashedPassword, saltId],
						function (err, result) {
							if (err) throw err;
							// Send the new user an email
							newUser(first_name, email, result.insertId, req.headers.host);
							res.send({ status: 200, message: "Successfully added user" });
						}
					);
				}
			);
		}
	);
});

// users/verify/{email_verify_token}
router.get("/verify/:email_verify_token", async function (req, res) {
	let userInfo = await query("SELECT * FROM users WHERE email_verify_token = ?", [req.params.email_verify_token]);
	if(userInfo.length < 1) return res.redirect("/failed.html");
	if(userInfo[0].email_verified) return res.redirect("/success.html");
	console.log("Writer: " + userInfo[0].seller)
	let role;
	if(userInfo[0].seller) {
		role = 3;
	} else {
		role = 4;
	}
	db.query(
		"UPDATE users SET email_verified=?, email_verify_token=?, role=? WHERE email_verify_token =?",
		[1, null, role, req.params.email_verify_token],
		async function (error, results, fields) {
			if (error) {
				send_error(error, "Error verifying email");
				res.send({ status: 500, message: "Error verifying email" });
			} if(results.affectedRows === 0) {
				res.redirect("/failed.html");
			} else {
				let user_id = userInfo[0].id;
				await query("INSERT INTO writers (user_id) VALUES (?)", [user_id]);
				res.redirect("/success.html");
			}
		}
	);
});

router.post("/login", function (req, res) {
	let email = req.body.email;
	let password = req.body.password;

	db.query(
		"SELECT * FROM users WHERE email = ?",
		[email],
		function (error, results, fields) {
			if (error) {
				send_error(error, "Error logging in");
				res.send({ status: 500, message: "Error logging in" });
			} else {
				if (results.length < 1) {
				    res.send({ status: 401, message: "Invalid email or password" });
				} else {
					let user = results[0];
					db.query(
						"SELECT * FROM salts WHERE id = ?",
						[user.salt],
						function (error, results, fields) {
							if (error) {
								send_error(error, "Error logging in");
								throw error;
							}
							if (results.length < 1) {
								res.send({ status: 401, message: "Invalid email or password" });
								return;
							}
							let salt = results[0].salt;
							crypto.pbkdf2(
								password,
								salt,
								310000,
								32,
								"sha256",
								function (err, hashedPassword) {
									if (hashedPassword.toString("hex") == user.password.toString("hex")) {
										// Create a user token
										let token = crypto.randomBytes(16).toString("hex");
										db.query(
										"UPDATE users SET token =? WHERE id =?",
										[token, user.id],
										function (err, rows) {
											if (err) {
												send_error(err, "Updating token");
												throw err;
											}
											res.send({
                                                status: 200,
                                                message: "Successfully logged in",
                                                user: {
                                                    token: token,
                                                    id: user.id,
                                                    first_name: user.first_name,
                                                    last_name: user.last_name,
                                                    email: user.email,
                                                    role: user.role,
                                                    email_verified: user.email_verified
                                                }
                                            });
										}
									);
								} else {
									res.send({
										status: 401,
										message: "Invalid email or password",
									});
								}
								return;
								}
							);
						}
					);
				}
			}
		}
	);
});

// forgot password 
router.post("/forgot_password", async function (req, res) {
	let email = req.body.email;
	if(!email) {
		res.send({ status: 400, message: "Missing required fields" });
		return;
	}
	let user = await query("SELECT * FROM users WHERE email = ?", [email]);
	if(user.length < 1) {
		res.send({ status: 400, message: "User not found" });
		return;
	}
	forgot_password(email, user[0].id, req.headers.host);
	res.send({ status: 200, message: "Successfully sent email" });
});

// reset password with the reset token
router.post("/reset_password", async function (req, res) {
	let password = req.body.password;
	let token = req.body.token;
	if(!password || !token) {
		res.send({ status: 400, message: "Missing required fields" });
		return;
	}
	let user = await query("SELECT * FROM users WHERE password_reset_token = ? AND password_reset_token_expires_at > NOW()", [token]);
	if(user.length < 1) {
		res.send({ status: 400, message: "Invalid token" });
		return;
	}
	const salt = crypto.randomBytes(16).toString("hex");
	// Hash the password using the salt
	crypto.pbkdf2(
		password,
		salt,
		310000,
		32,
		"sha256",
		function (err, hashedPassword) {
			if (err) throw err;
			// Insert the salt into the salts table
			db.query(
				"INSERT INTO salts (salt) VALUES (?)",
				[salt],
				function (err, result) {
					if (err) throw err;

					// Get the ID of the inserted salt
					const saltId = result.insertId;

					// Insert the user into the users table with the salt ID
					db.query(
						"UPDATE users SET password = ?, salt = ?, password_reset_token = NULL, password_reset_token_expires_at = NULL WHERE id = ?",
						[hashedPassword, saltId, user[0].id],
						function (err, result) {
							if (err) throw err;
							res.send({ status: 200, message: "Successfully reset password" });
						}
					);
				}
			);
		}
	);
});

module.exports = router;