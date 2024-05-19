const config = require('../configs/config.json');
let webhook_url = config.webhook_url;

async function send_error(error, errorAt){
    let text = '<@271285474516140033>\nAn error has occured: \n```\n' + error+'\n```';
    await fetch(webhook_url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({username: errorAt, content: text})
    });
};

module.exports = {
    send_error
};