// Description: This file contains functions that are used to interact with the user table in the database.
var { send_mail } = require('./email.js');

async function disable_account(user_id, admin) {
    try {
        if(admin === false) {
            // get a date 30 days from now
            let date = new Date();
            date.setDate(date.getDate() + 30);
            date = date.toISOString().slice(0, 19).replace('T', ' ');
            await query("UPDATE users SET account_disabled = 1, scheduled_for_deletion = 1, scheduled_for_deletion_at =? WHERE id = ?", [date, user_id]);
            // send the user an email notification that their account has been disabled
            let user = await query("SELECT email,last_name FROM users WHERE id = ?", [user_id]);
            let email = user[0].email;
            let subject = "Account ongebruikelijk gemaakt";
            let text = `Geachte heer/mevrouw ${user[0].last_name},\n\nUw account is uitgeschakeld. Als u dit niet heeft gedaan, wijzig dan uw inloggegevens. Als u uw account wilt behouden, log dan vóór 30 dagen in.`;
            await send_mail(email, text, subject);
            return;
        } else if (admin === true) {
            await query("UPDATE users SET account_disabled = 1 WHERE id = ?", [user_id]);
            // send the user an email that their account has been disabled by an admin
            let user = await query("SELECT email,last_name FROM users WHERE id = ?", [user_id]);
            let email = user[0].email;
            let subject = "Account ongebruikelijk gemaakt";
            let text = `Beste heer/mevrouw ${user[0].last_name},\n\nUw account is onbruikbaar gesteld door een beheerder. Als je denkt dat dit niet had moeten gebeuren, kunt u ons support team contacteren.`;
            await send_mail(email, text, subject);
            return;
        } else {
            return send_error(new Error("Invalid admin value"), "enable_account");
        }
    } catch (error) {
        throw error;
    }
}

async function enable_account(user_id, admin) {
    try {
        if(admin === false) {
            await query("UPDATE users SET account_disabled = 0, scheduled_for_deletion = 0, scheduled_for_deletion_at = NULL WHERE id = ?", [user_id]);
            // send the user an email that their account has been enabled
            let user = await query("SELECT email,last_name FROM users WHERE id = ?", [user_id]);
            let email = user[0].email;
            let subject = "Account geactiveerd";
            let text = `Geachte heer/mevrouw ${user[0].last_name},\n\nUw account is geactiveerd. U kunt nu weer inloggen.`;
            await send_mail(email, text, subject);
            return;
        } else if (admin === true) {
            await query("UPDATE users SET account_disabled = 0 WHERE id = ?", [user_id]);
            // send the user an email that their account has been enabled by an admin
            let user = await query("SELECT email,last_name FROM users WHERE id = ?", [user_id]);
            let email = user[0].email;
            let subject = "Account geactiveerd";
            let text = `Geachte heer/mevrouw ${user[0].last_name},\n\nUw account is geactiveerd door een beheerder. U kunt nu weer inloggen.`;
            await send_mail(email, text, subject);
            return;
        } else {
            return send_error(new Error("Invalid admin value"), "enable_account");
        }
    } catch (error) {
        throw error;
    }
}

module.exports = {
    disable_account,
    enable_account,
}