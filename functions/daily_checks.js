let cron = require('cron');
let db = require('../db');
let { query } = require('./database_queries');
let { send_mail } = require('./email');
let { send_error } = require('./error');

async function daily_account_deletion_check(){
    let now = new Date();
    let yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    let yesterday_string = yesterday.toISOString().split('T')[0];
    let query_string = "SELECT * FROM users WHERE created_at < ?";
    let results = await query(query_string, [yesterday_string]);
    if (results.length > 0){
        for (let i = 0; i < results.length; i++){
            let user = results[i];
            let user_id = user.id;
            let email = user.email;
            let delete_query = "DELETE FROM users WHERE id = ?";
            let delete_results = await query(delete_query, [user_id]);
            if (delete_results.affectedRows > 0){
                let message = "Your account has been deleted due to inactivity. If you believe this is an error, please contact us.";
                send_mail(email, "Account Deletion", message);
            } else {
                send_error("Error deleting user account", "Error deleting user account");
            }
        }
    }
}

async function start_daily_jobs(){
    let job = new cron.CronJob('0 0 22 * * *', () => {
        daily_account_deletion_check();
    });
    job.start();
};

module.exports = {
    start_daily_jobs
};