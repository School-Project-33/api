// require the needed modules
var express = require("express");
var { contact_mail } = require("../../functions/email");
var { send_error } = require("../../functions/error");

// create the router
var router = express.Router();


router.post("/", async function (req, res) {
    try {
        var { name, email, subject, message } = req.body;

        if (!name || !email || !message) {
            let missing_fields = [];
            if (!name) missing_fields.push("name");
            if (!email) missing_fields.push("email");
            if (!subject) missing_fields.push("subject");
            if (!message) missing_fields.push("message");
            return res.status(400).send({ "status": 400, "message": `Please fill in the following fields: ${missing_fields.join(", ")}` });
        }

        message = `Name: ${name}\n\n${message}`;

        // Assuming contact_mail is a function that sends the email
        contact_mail(email, subject, message);

        res.status(200).send({ "status": 200, "message": "Message sent successfully" });

    } catch (err) {
        console.error(err);
        res.status(500).send({ "status": 500, "message": "Internal Server Error" });
    }
});


module.exports = router;
