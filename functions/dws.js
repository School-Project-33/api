let webhook_url = `https://discord.com/api/webhooks/1221931048028340224/iRH__U98U4-CzLmFtJ48VF0XPft5_zqY6-GSPhMN3K9fmrd5fj4P0j05kGjgpWnd6MoV`;

async function send_request(req_user, req_car){
    let text = ''+req_user+' requested to rent: \n```\n' +req_car+'\n```';
    await fetch(webhook_url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({username: req_user, content: text})
    });
};

module.exports = {
    send_request
};