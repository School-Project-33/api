// require the needed modules
var express = require("express");
var crypto = require("crypto");
var { newUser, forgot_password } = require("../../functions/email");
var { send_error } = require("../../functions/error");
var {
  check_user_token
} = require("../../functions/middleware");
const { promisify } = require('util');

// create the router
var router = express.Router();

router.post("/register", async function (req, res) {
    try {
        const { email, password, firstname, lastname, phonenumber, seller } = req.body;

        if (!email || !password || !firstname || !lastname || !phonenumber || typeof seller !== 'boolean') {
            let missing_fields = [];
            if (!email) missing_fields.push("email");
            if (!password) missing_fields.push("password");
            if (!firstname) missing_fields.push("first_name");
            if (!lastname) missing_fields.push("last_name");
            if (!phonenumber) missing_fields.push("phone_number");
            if (typeof seller !== 'boolean') missing_fields.push("seller");
            return res.status(400).send({ "status": 400, "message": `Please fill in the following fields: ${missing_fields.join(", ")}` });
        }

        // Check if the user already exists
        const userAlreadyExist = await db.query("SELECT * FROM users WHERE email = ?", [email]);
        if (userAlreadyExist.length > 0) return res.status(400).send({ "status": 400, "message": "User already exists" });

        // Hash the password
        const salt = crypto.randomBytes(16).toString('hex');
        const pbkdf2 = promisify(crypto.pbkdf2);
        const hashedPassword = await pbkdf2(password, salt, 310000, 32, 'sha256');

        // Insert the salt into the salts table
        const saltResult = await query("INSERT INTO salts (salt) VALUES (?)", [salt]);
        const saltId = await saltResult.insertId;

        // Insert the user into the users table with the salt ID
        let userData = await query("INSERT INTO users (first_name, last_name, email, phone_number, password, salt, role, seller) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [firstname, lastname, email, phonenumber, hashedPassword.toString('hex'), await saltId, 5, seller]);

        // Assuming newUser is a function that handles post-registration actions
        newUser(firstname, email, userData.insertId, req.headers.host);

        res.status(200).send({ "status": 200, "message": "User registered successfully" });

    } catch (err) {
        console.error(err);
        res.status(500).send({ "status": 500, "message": "Internal Server Error" });
    }
});

// The verification route
router.get("/verify/:token", async function (req, res) {
	try {
		const token = req.params.token;
		const user = await query("SELECT * FROM users WHERE email_verify_token = ?", [token]);

		if (user.length === 0) return res.status(404).send({ "status": 404, "message": "Token not found" });

		db.query("UPDATE users SET email_verify_token = NULL, email_verified = 1 WHERE id = ?", [user[0].id], async function (err, result) {
			if (err) {
				send_error(err, "Updating email verification token");
				return res.status(500).send({ "status": 500, "message": "Internal Server Error" });
			}

			res.status(200).send({ "status": 200, "message": "Email verified successfully" });
		});

	} catch (err) {
		console.error(err);
		res.status(500).send({ "status": 500, "message": "Internal Server Error" });
	}
});

module.exports = router;
