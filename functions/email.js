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
        let text = 'Beste '+ fname +'\nUw e-mail is gebruikt om een account aan te maken bij E-Schrijvers.\n\nKlik op de volgende link om uw email te verifiëren: http://' + host + '/api/v1/users/verify/' + token +'\n\nAls u geen account heeft aangemaakt, stuur dan een e-mail naar support-e.schrijvers@wolfsoft.solutions zodat we het account dat aan dit account is gekoppeld, kunnen verwijderen.';
    
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
};

async function order_email(email, book_id, order_id, res, req){
    let book = await query('SELECT * FROM books WHERE id = ?', [book_id]);
    if(book.length < 1) return res.status(404).send({ "status": 404, "message": "No book found" });
    let order = await query('SELECT * FROM orders WHERE order_id = ? AND book_id =?', [order_id, book_id]);
    if(order.length < 1) return res.status(404).send({ "status": 404, "message": "No order found" });
    let writer = await query('SELECT * FROM writers WHERE id = ?', [book[0].author]);
    if(writer.length < 1) return res.status(404).send({ "status": 404, "message": "No writer found" });
    let writerUser = await query('SELECT * FROM users WHERE id = ?', [writer[0].user_id]);
    if(writerUser.length < 1) return res.status(404).send({ "status": 404, "message": "No user found" });

    let orderUser = await query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if(orderUser.length < 1) return res.status(404).send({ "status": 404, "message": "No user found" });

    // get the order status in text
    let order_status = await query("SELECT * FROM order_status");
    order.forEach(function (order) {
        order.order_status = order_status[order.order_status - 1].status;
    });

    let subject = 'Order bevestiging';
    let text = 'Geachte heer/mevrouw'+ orderUser[0].last_name +',\n\nU heeft een order geplaatst voor het boek: '+ book[0].title +'\nDe schrijver van dit boek is: '+ writerUser[0].first_name+ " "+ writerUser[0].last_name +'\nUw order ID is: #'+ order[0].order_id +'\nUw order status is: '+ order[0].order_status +'\n\nBedankt voor uw bestelling.';
    
    send_mail(email, text, subject);
}

async function update_order_email(email, order_id, req, res){
    let order = await query('SELECT * FROM orders WHERE order_id = ?', [order_id]);
    if(order.length < 1) return res.status(404).send({ "status": 404, "message": "No order found" });
    let book = await query('SELECT * FROM books WHERE id = ?', [order[0].book_id]);
    if(book.length < 1) return res.status(404).send({ "status": 404, "message": "No book found" });
    let writer = await query('SELECT * FROM writers WHERE id = ?', [book[0].author]);
    if(writer.length < 1) return res.status(404).send({ "status": 404, "message": "No writer found" });
    let writerUser = await query('SELECT * FROM users WHERE id = ?', [writer[0].user_id]);
    if(writerUser.length < 1) return res.status(404).send({ "status": 404, "message": "No user found" });

    let orderUser = await query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if(orderUser.length < 1) return res.status(404).send({ "status": 404, "message": "No user found" });

    // get the order status in text
    let order_status = await query("SELECT * FROM order_status");
    order.forEach(function (order) {
        order.order_status = order_status[order.order_status - 1].status;
    });

    let subject = 'Order update';
    let text = 'Geachte heer/mevrouw'+ orderUser[0].last_name +',\n\nUw order voor het boek: '+ book[0].title +'\nDe schrijver van dit boek is: '+ writerUser[0].first_name+ " "+ writerUser[0].last_name +'\nUw order ID is: #'+ order[0].order_id +'\nUw order status is: '+ order[0].order_status +'\n\nBedankt voor uw bestelling.';
    send_mail(email, text, subject);
}

module.exports = {
    newUser,
    forgot_password,
    send_mail,
    contact_mail,
    order_email,
    update_order_email,
};