let cron = require('cron');
let { send_mail } = require('./email');
let { send_error } = require('./error');

async function daily_account_deletion_check(){
    let now = new Date();
    let now_string = now.toISOString().slice(0, 10);
    let query_string = "SELECT * FROM users";
    let results = await query(query_string);
    if (results.length > 0){
        for (let i = 0; i < results.length; i++){
            let user = results[i];
            let going_to_be_deleted = user.scheduled_for_deletion;
            if(going_to_be_deleted == 1 || going_to_be_deleted == true){
                let scheduled_for_deletion_at = user.scheduled_for_deletion_at;
                scheduled_for_deletion_at.setDate(scheduled_for_deletion_at.getDate() + 1);
                let scheduled_for_deletion_at_string = scheduled_for_deletion_at.toISOString().slice(0, 10);
                if(scheduled_for_deletion_at_string == now_string){
                    let user_id = user.id;
                    let email = user.email;
                    let delete_query = "DELETE FROM users WHERE id = ?";
                    let delete_results = await query(delete_query, [user_id]);
                    if (delete_results.affectedRows > 0){
                        let message = "Uw account is verwijdert.";
                        send_mail(email, "Account Deletion", message);
                    } else {
                        send_error("Error deleting user account", "Error deleting user account");
                    }
                }
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
    start_daily_jobs,
    daily_account_deletion_check
};