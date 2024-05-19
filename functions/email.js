const nodemailer = require("nodemailer");
const config = require('../configs/config.json');
const crypto = require('crypto');
let db = require('../db');
let { send_error } = require('./error');

const transporter = nodemailer.createTransport({
    host: config.email_server.host,
    port: config.email_server.port,
    secure: config.email_server.secure,
    auth: {
        user: config.email_server.auth.user,
        pass: config.email_server.auth.pass
    }
});

async function send_mail(email, text, subject){
    await transporter.sendMail({
        from: config.email_server.from,
        to: email,
        subject: subject,
        text: `THIS IS A SCHOOL PROJECT! THIS IS NOT REAL\n\n\n${text}\n\nThank you for using Hanz Car Rentals.\n\nPS: This is an automated message. & THIS IS A SCHOOL PROJECT! THIS IS NOT REAL`
    }).catch((err) => {
        if(err) {
            send_error(err, 'Send E-mail');
            throw err;
        };
    });
};

async function newUser(fname, email, id, host){
    var token = crypto.randomBytes(16).toString('hex');
    db.query('UPDATE users SET email_verify_token = ? WHERE id = ?', [token, id], function (err, rows) {
        if(err) {
            send_error(err, 'Updating email verification Token');
            throw err;
        };

        let subject = 'Account Verification';
        let text = 'Dear '+ fname +'\nYour e-mail has been used for an account at Hanz Car Rentals.\n\nPlease click the following link to verify your account: https://' + host + '/api/v2/users/verify/' + token +'\n\nIf you did not create an account, please send an email to hanz.car.rentals@wolfsoft.solutions so we can remove the account assosiated with this account.';
    
        send_mail(email, text, subject);
    });
};

async function forgot_password(email, id, host){
    var token = crypto.randomBytes(16).toString('hex');
    db.query('UPDATE users SET password_reset_token = ?, password_reset_token_expires_at = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE id = ?', [token, id], function (err, rows) {
        if(err) {
            send_error(err, 'Updating password reset token');
            throw err;
        };

        let subject = 'Reset Password';
        let text = 'Please copy and paste the following token in the password reset form: ' +token;
     
        send_mail(email, text, subject);
    });
};

async function contact_mail(email, subject, message) {
    await transporter.sendMail({
        from: config.email_server.from,
        to: `hcr@wolfsoft.solutions`,
        subject: subject,
        text: `THIS IS A SCHOOL PROJECT! THIS IS NOT REAL\n\n\n${message}\n\nThank you for using Hanz Car Rentals.\n\nPS: This is an automated message. & THIS IS A SCHOOL PROJECT! THIS IS NOT REAL`,
        replyTo: email
    }).catch((err) => {
        if(err) {
            send_error(err, 'Send E-mail');
            throw err;
        };
    });
} 

module.exports = {
    newUser,
    forgot_password,
    send_mail,
    contact_mail
};