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
        text: `${text}\n\nBedankt dat u gebruik maakt van E-Schrijvers.\n\nPS: Dit is een geautomatiseert bericht.`
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

        let subject = 'Account verificatie';
        let text = 'Beste '+ fname +'\nUw e-mail is gebruikt om een account aan te maken bij E-Schrijvers.\n\nPlease click the following link to verify your account: https://' + host + '/api/v1/users/verify/' + token +'\n\nAls u geen account heeft aangemaakt, stuur dan een e-mail naar support-e.schrijvers@wolfsoft.solutions zodat we het account dat aan dit account is gekoppeld, kunnen verwijderen.';
    
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

        let subject = 'Wachtwoord opnieuw instellen';
        let text = 'Kopieer en plak het volgende token in het formulier voor het opnieuw instellen van het wachtwoord: ' +token;
     
        send_mail(email, text, subject);
    });
};

async function contact_mail(email, subject, message) {
    await transporter.sendMail({
        from: config.email_server.from,
        to: `info.e.schrijvers@wolfsoft.solutions`,
        subject: subject,
        text: `${message}\n\nBedankt dat u gebruik maakt van E-Schrijvers.`,
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