// require the needed modules
var express = require("express");
var { send_error } = require("../../functions/error");
const { check_user_token, check_user_id, check_writer_id, isSeller } = require("../../functions/middleware");

// create the router
var router = express.Router();

router.get('/', async function(req, res, next){
    try {
        let writers = await query("SELECT * FROM writers");
        // also get the users first and last_name from the users table and add it to the writers object
        for (let i = 0; i < writers.length; i++){
            let user = await query("SELECT first_name, last_name FROM users WHERE id = ?", [writers[i].user_id]);
            writers[i].first_name = user[0].first_name;
            writers[i].last_name = user[0].last_name;
        }
        if(writers.length > 0){
            await res.json({status: 200, message: "Success!", writers: writers});
        } else{
            res.status(404).json({status: 404, message: "Writers not found", writers: []});
        };
    } catch (err) {
        res.status(500).json({status: 500, message: "Internal Server Error"});
        send_error(err, "Getting writers failed");
    }
});

router.get('/:id', async function(req, res, next){
    try {
        let writer = await query("SELECT * FROM writers WHERE id = ?", [req.params.id]);
        // also get the users first and last_name from the users table and add it to the writers object
        let user = await query("SELECT first_name, last_name FROM users WHERE id = ?", [writer[0].user_id]);
        writer[0].first_name = user[0].first_name;
        writer[0].last_name = user[0].last_name;
        if(writer.length > 0){
            res.json({status: 200, message: "Success!", writer: writer[0]});
        } else{
            res.status(404).json({status: 404, message: "Writer not found", writers: []});
        };
    } catch (err) {
        res.status(500).json({status: 500, message: "Internal Server Error"});
        send_error(err, "Getting writer failed");
    }
});

// create the settings route
router.put('/settings/:id', check_user_token, isSeller, check_writer_id, async function(req, res, next){
    try {
        let writer = await query("SELECT * FROM writers WHERE id = ?", [req.params.id]);
        if(writer.length > 0){
            let newSettings = req.body;
            let settings = JSON.parse(writer[0].settings);
            for (let key in newSettings){
                settings[key] = newSettings[key];
            };
            await query("UPDATE writers SET settings = ? WHERE id = ?", [JSON.stringify(settings), req.params.id]);
            res.json({status: 200, message: "Settings updated successfully"});
        } else{
            res.status(404).json({status: 404, message: "Writer not found"});
        };
    } catch (err) {
        res.status(500).json({status: 500, message: "Internal Server Error"});
        send_error(err, "Updating writer settings failed");
    }
});


module.exports = router;
