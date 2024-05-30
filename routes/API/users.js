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

router.post("/register", async function (req, res) {
	let first_name = req.body.firstname;
	let last_name = req.body.lastname;
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

module.exports = router;