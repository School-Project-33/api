// require the needed modules
var express = require("express");
var crypto = require("crypto");
var { newUser, forgot_password } = require("../../functions/email");
var { send_error } = require("../../functions/error");
var {
  check_user_token,
  user_check,
  check_permission
} = require("../../functions/middleware");

// create the router
var router = express.Router();

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
										"UPDATE users SET token =?, token_expires_at = DATE_ADD(NOW(), INTERVAL 3 HOUR) WHERE id =?",
										[token, user.id],
										function (err, rows) {
											if (err) {
												send_error(err, "Updating token");
												throw err;
											}
											// get the role info
											db.query(
												"SELECT * FROM roles WHERE id =?",
												[user.role],
												async function (error, results, fields) {
													if (error) {
														send_error(error, "Error logging in");
														throw error;
													}
													if (results.length < 1) {
														res.send({
															status: 401,
															message: "Invalid email or password",
														});
														return;
													}
													let role = results[0];
													res.send({
														status: 200,
														message: "Successfully logged in",
														user: {
															id: user.id,
															first_name: user.first_name,
															last_name: user.last_name,
															token: token,
															role: role.role_name,
														},
													});
												}
											);
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

router.post("/add", async function (req, res) {
	let first_name = req.body.first_name;
	let last_name = req.body.last_name;
	let email = req.body.email;
	let password = req.body.password;

	if(!first_name || !last_name || !email || !password) {
		res.send({ status: 400, message: "Missing required fields" });
		return;
	}

	let email_check = await query("SELECT email FROM users WHERE email = ?", [email]);
	if(email_check.length > 0) {
		res.send({ status: 400, message: "Email already in use" });
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
						"INSERT INTO users (first_name, last_name, email, password, salt) VALUES (?, ?, ?, ?, ?)",
						[first_name, last_name, email, hashedPassword, saltId],
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

// users route to get all users as admin user
router.get("/", check_user_token, check_permission("ADMIN"), function (req, res) {
	db.query(
		"SELECT id,first_name,last_name,email,email_verified,role,verified_drivers_licence,times_rented,created_at,updated_at FROM users",
		function (error, results, fields) {
			if (error) {
				send_error(error, "Error getting users");
				res.send({ status: 500, message: "Error getting users" });
			} else {
				res.send({
					status: 200,
					message: "Successfully got users",
					data: results,
				});
			}
		}
	);
});

// users/user/{id} route to get a single user
router.get("/user/:id", check_user_token, user_check, function (req, res) {
	db.query(
		"SELECT id,first_name,last_name,email,email_verified,role,verified_drivers_licence,times_rented,created_at,updated_at FROM users WHERE id =?",
		[req.params.id],
		function (error, results, fields) {
			if (error) {
				send_error(error, "Error getting user");
				res.send({ status: 500, message: "Error getting user" });
			} else {
				// get the role info from the roles table:
				db.query(
				"SELECT * FROM roles WHERE id =?",
				[results[0].role],
				function (error, role_results, fields) {
					if (error) {
					send_error(error, "Error getting user");
					throw error;
					}
					if (role_results.length < 1) {
					res.send({ status: 500, message: "Error getting user" });
					return;
					}
					results[0].role = role_results[0];
					res.send({
						status: 200,
						message: "Successfully got user",
						data: results[0],
					});
				});
			}
		}
	);
});

// users/reset_password_email this route will send an email to the given email address
router.post("/reset_password_email", function (req, res) {
	let email = req.body.email;
	db.query(
		"SELECT * FROM users WHERE email =?",
		[email],
		function (error, results, fields) {
			if (error) {
				send_error(error, "Error sending reset password email");
				res.send({
				status: 500,
				message: "Error sending reset password email",
				});
			} else {
				if (results.length < 1) {
					res.send({ status: 404, message: "Email not found" });
				} else {
					forgot_password(email, results[0].id, req.headers.host);
					res.send({
						status: 200,
						message: "Successfully sent reset password email",
					});
				}
			}
		}
	);
});

// users/reset_password this route will reset the password for the given user
router.post("/reset_password", function (req, res) {
	let password = req.body.password;
	let token = req.body.email_token;

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
					// Update the user with the new password and salt
					db.query(
						"UPDATE users SET password =?, salt =? WHERE password_reset_token =?",
						[hashedPassword, saltId, token],
						function (err, result) {
							if (err) throw err;
							res.send({
								status: 200,
								message: "Successfully reset password",
							});
						}
					);
				}
			);
		}
	);
});

// users/update_password this route will update the password for the given user
router.put("/update_password", function (req, res) {
	let password = req.body.password;
	let new_password = req.body.new_password;
	let token = req.headers["authorization"];

	if(token){
		token = token.split(" ")[1];
	} else if(!token) {
		res.status(400).send({ status: 400, message: "Missing token" });
		return;
	} else {
		res.status(400).send({ status: 400, message: "Invalid token" });
		return;
	}

	// check if "password" is the same as the current password
	db.query(
		"SELECT * FROM users WHERE token =?",
		[token],
		function (error, results, fields) {
			if (error) {
				send_error(error, "Error updating password");
				res.status(500).send({ status: 500, message: "Error updating password" });
			} else {
				if (results.length < 1) {
					res.status(404).send({ status: 404, message: "User not found" });
				} else {
					let user = results[0];
					db.query(
						"SELECT * FROM salts WHERE id = ?",
						[user.salt],
						function (error, results, fields) {
							if (error) {
								send_error(error, "Error updating password");
								throw error;
							}
							if (results.length < 1) {
								res.send({ status: 404, message: "User not found" });
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
										// Hash the new password using the salt
										crypto.pbkdf2(
											new_password,
											salt,
											310000,
											32,
											"sha256",
											function (err, hashedPassword) {
												if (err) throw err;
												// Update the user with the new password
												db.query(
													"UPDATE users SET password =? WHERE token =?",
													[hashedPassword, token],
													function (err, result) {
														if (err) throw err;
														res.send({
															status: 200,
															message: "Successfully updated password",
														});
													}
												);
											}
										);
									} else {
										res.send({ status: 401, message: "Invalid password" });
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

// users/validate/drivers-license
router.post("/validate/drivers-license", check_user_token, function (req, res) {
	let token = req.headers["authorization"].split(" ")[1];
	db.query(
		"UPDATE users SET verified_drivers_licence =? WHERE token =?",
		[1, token],
		function (error, results, fields) {
			if (error) {
				send_error(error, "Error validating drivers license");
				res.send({ status: 500, message: "Error validating drivers license" });
			} else {
				res.send({
					status: 200,
					message: "Successfully validated drivers license",
				});
			}
		}
	);
});

// users/update/{id} route to update a user
router.put("/update/:id", check_user_token, user_check, function (req, res) {
	let first_name = req.body.first_name;
	let last_name = req.body.last_name;
	let email = req.body.email;
	db.query(
		"UPDATE users SET first_name =?, last_name =?, email =? WHERE id =?",
		[first_name, last_name, email, req.params.id],
		function (error, results, fields) {
			if (error) {
				send_error(error, "Error updating user");
				res.send({ status: 500, message: "Error updating user" });
			} else {
				res.send({ status: 200, message: "Successfully updated user" });
			}
		}
	);
});

// users/update/role/:id route to update a user's role
router.put("/update/role/:id", check_user_token, check_permission("UPDATE_PEOPLE_ROLES"), function (req, res) {
	let role = req.body.role;

	// if the user doesn't have their email verified then return a 403 because the user isn't allowed a new role.
	db.query("SELECT * FROM users WHERE id = ?", [req.params.id], function (error, results, fields) {
		if (error) {
			send_error(error, "Error updating user role");
			res.send({ status: 500, message: "Error updating user role" });
		} else {
			if (results[0].email_verified === 0) {
				res.status(403).send({ status: 403, message: "User's email isn't verified" });
				return;
			} else {
				db.query(
					"UPDATE users SET role =? WHERE id =?",
					[role, req.params.id],
					function (error, results, fields) {
						if (error) {
							send_error(error, "Error updating user role");
							res.status(500).send({ status: 500, message: "Error updating user role" });
						} else {
							res.send({ status: 200, message: "Successfully updated user role" });
						}
					}
				);
			}
		}
	});
});

// users/verify/{email_verify_token}
router.get("/verify/:email_verify_token", function (req, res) {
	db.query(
		"UPDATE users SET email_verified=?, email_verify_token=?, role=? WHERE email_verify_token =?",
		[1, null, 5, req.params.email_verify_token],
		function (error, results, fields) {
			if (error) {
				send_error(error, "Error verifying email");
				res.send({ status: 500, message: "Error verifying email" });
			} if(results.affectedRows === 0) {
				res.redirect("/failed.html");
			} else {
				res.redirect("/success.html");
			}
		}
	);
});

// users/logout (set the token to null in the database)
router.delete("/logout", check_user_token, function (req, res) {
	db.query(
		"UPDATE users SET token =? WHERE token =?",
		[null, req.headers["authorization"].split(" ")[1]],
		function (error, results, fields) {
			if (error) {
				send_error(error, "Error logging out");
				res.send({ status: 500, message: "Error logging out" });
			} else {
				res.send({ status: 200, message: "Successfully logged out" });
			}
		}
	);
});

module.exports = router;
