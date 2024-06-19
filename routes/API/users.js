// require the needed modules
var express = require("express");
var crypto = require("crypto");
var { newUser, forgot_password } = require("../../functions/email");
var { send_error } = require("../../functions/error");
var {
  check_user_token,
  check_user_id
} = require("../../functions/middleware");
var { send_mail } = require("../../functions/email");
var cors = require('cors');
var { disable_account, enable_account } = require("../../functions/user_functions");

// create the router
var router = express.Router();

router.use(cors());
router.options('*', cors());

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

    if (!email || !password) {
        res.status(400).send({ message: "Missing required fields" });
        return;
    }

    db.query("SELECT * FROM users WHERE email = ?", [email], function (error, results) {
        if (error) {
            send_error(error, "Error logging in");
            res.status(500).send({ message: "Error logging in" });
            return;
        }

        if (results.length < 1) {
            res.status(401).send({ message: "Invalid email or password" });
            return;
        }

        let user = results[0];

        db.query("SELECT * FROM salts WHERE id = ?", [user.salt], function (error, results) {
            if (error) {
                send_error(error, "Error logging in");
                res.status(500).send({ message: "Error logging in" });
                return;
            }

            if (results.length < 1) {
                res.status(401).send({ message: "Invalid email or password" });
                return;
            }

            let salt = results[0].salt;

            crypto.pbkdf2(password, salt, 310000, 32, "sha256", async function (err, hashedPassword) {
                if (err) {
                    send_error(err, "Error hashing password");
                    res.status(500).send({ message: "Error hashing password" });
                    return;
                }

                if (hashedPassword.toString("hex") === user.password.toString("hex")) {
                    // Update the token and token expiration date to tomorrow
                    let new_expire_date = new Date();
                    new_expire_date.setDate(new_expire_date.getDate() + 1);
                    new_expire_date = new_expire_date.toISOString().slice(0, 19).replace('T', ' ');

					console.log("test")

					if(user.scheduled_for_deletion === true && user.account_disabled === true && user.scheduled_for_deletion_at !== null) {
						console.log("Account word weer gebruikt")
						let email = user.email;
						let text = 'Geachte heer/mevrouw '+ user.last_name +',\n\nUw account is weer ingeschakeld. Als u dit niet heeft gedaan, wijzig dan uw inloggegevens.';
						let subject = 'Account weer ingeschakeld';
						send_mail(email, text, subject);
						await query("UPDATE users SET scheduled_for_deletion = 0, scheduled_for_deletion_at = NULL, account_disabled = 0 WHERE id = ?", [user.id]);
					}

                    // Create a user token
                    let token = crypto.randomBytes(16).toString("hex");

                    db.query(
                        "UPDATE users SET token = ?, token_expires_at = ? WHERE id = ?",
                        [token, new_expire_date, user.id],
                        function (err) {
                            if (err) {
                                send_error(err, "Updating token");
                                res.status(500).send({ message: "Updating token failed" });
                                return;
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
                    res.status(401).send({ message: "Invalid email or password" });
                }
            });
        });
    });
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

// get all users
router.get("/", async function (req, res) {
	let users = await query("SELECT id,first_name,last_name,email,email_verified,phone_number,role,seller,scheduled_for_deletion,scheduled_for_deletion_at,account_disabled,created_at,updated_at FROM users");
	let total_users_query = await query("SELECT COUNT(*) as total_users FROM users");
	let total_users = total_users_query[0].total_users;
	res.send({ status: 200, amount: total_users, users: users });
});

// get a user by id
router.get("/:id", async function (req, res) {
    let user = await query("SELECT id,first_name,last_name,email,email_verified,phone_number,role,seller,scheduled_for_deletion,scheduled_for_deletion_at,account_disabled,created_at,updated_at FROM users WHERE id =?", [req.params.id]);
    if(user.length < 1) {
        res.send({ status: 400, message: "User not found", user: null });
        return;
    }
    res.send({ status: 200, user: user[0] });
});

// change the user name
router.put("/settings/:id/name", check_user_token, check_user_id, async function (req, res, next) {
	let user = await query("SELECT * FROM users WHERE id =?", [req.params.id]);
    if(user.length < 1) {
        res.send({ status: 400, message: "User not found" });
        return;
    }
    if(req.body.first_name) {
        await query("UPDATE users SET first_name =? WHERE id =?", [req.body.first_name, req.params.id]);
    }
    if(req.body.last_name) {
        await query("UPDATE users SET last_name =? WHERE id =?", [req.body.last_name, req.params.id]);
    }

	if(!req.body.first_name && !req.body.last_name) return res.send({ status: 400, message: "Missing required fields", user: null });

	if(req.body.first_name || req.body.last_name) {
		let first_name = req.body.first_name || req.user.first_name;
		let last_name = req.body.last_name || req.user.last_name;
		req.user.first_name = first_name;
		req.user.last_name = last_name;
		return res.send({ status: 200, message: "Successfully changed name to: '" + first_name + " " + last_name + "'"});
	}
});

// change the email
router.put("/settings/:id/email", check_user_token, check_user_id, async function (req, res, next) {
	let user = await query("SELECT * FROM users WHERE id =?", [req.params.id]);
    if(user.length < 1) {
        res.send({ status: 400, message: "User not found" });
        return;
    }
	
	// check if the email is already in the database
	let email = await query("SELECT * FROM users WHERE email =?", [req.body.email]);
    if(email.length > 0) {
        res.send({ status: 400, message: "Email is already in use" });
        return;
    }

	// generate a change email token
	let token = crypto.randomBytes(16).toString("hex");
	await query("UPDATE users SET email_change_token =?, new_email_address=? WHERE id =?", [token, req.body.new_email, req.params.id]);
	// send an email to the old email and new email
	
	// send email to old email:
	await send_mail(user[0].email, `Beste heer/mevrouw ${await req.user.last_name},\n\nWe hebben een verzoek ontvangen om het e-mailadres dat aan uw account is gekoppeld te wijzigen. Om de veiligheid van uw account te waarborgen, willen we bevestigen dat u degene bent die deze wijziging heeft aangevraagd.\n\nUw huidige E-mail adres: ${req.user.email}\nNieuwe E-mail adres: ${req.body.new_email}\nDatum van aanvraag: ${Date()}\n\nAls u dit verzoek heeft gedaan, klik dan op de onderstaande link om de wijziging te bevestigen:\nhttp://185.192.97.1:55614/api/v1/users/change_email/${token}\n\nAls u geen verzoek heeft gedaan om uw e-mailadres te wijzigen, neem dan onmiddellijk contact met ons op via info.e.schrijvers@wolfsoft.solutions. We raden u ook aan om uw wachtwoord direct te wijzigen om de veiligheid van uw account te waarborgen.\n\nWe nemen de veiligheid van uw account zeer serieus en willen u bedanken voor uw medewerking.`, "Email wijziging");
	
	// send email to new email:
	await send_mail(req.body.new_email, "Dit is een test bericht.", "Email wijziging");
	res.send({ status: 200, message: "Sent an email to both old and new email addresses" });
});

// The user disabled route
router.put("/settings/:id/disable", check_user_token, check_user_id, async function (req, res, next) {
	await disable_account(req.params.id, false);
	res.send({ status: 200, message: "Successfully disabled account" });
});

// The user enable route
router.put("/settings/:id/enable", check_user_token, check_user_id, async function (req, res, next) {
	await enable_account(req.params.id, false);
	res.send({ status: 200, message: "Successfully enabled account" });
});

module.exports = router;