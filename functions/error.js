const config = require('../configs/config.json');
let webhook_url = config.webhook_url;

async function send_error(error, errorAt, res){
    let text = '<@271285474516140033>\nAn error has occured: \n```\n' + error+'\n```';
    await fetch(webhook_url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({username: errorAt, content: text})
    });
    console.error(error);
    if(res){
        const errorDetails = {
            message: error.message,
            stack: error.stack,
        };
        res.status(500).json({
            status: 500,
            message: 'Internal Server Error',
            error: errorDetails
        });
    } else {
        console.error('No response object provided');
    }
};

module.exports = { send_error };


module.exports = {
    send_error
};