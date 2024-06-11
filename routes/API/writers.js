// require the needed modules
var express = require("express");
var { send_error } = require("../../functions/error");
const { check_user_token, check_user_id } = require("../../functions/middleware");

// create the router
var router = express.Router();

router.get('/', async function(req, res, next){
    try {
        let writers = await query("SELECT * FROM writers");
        res.json({writers: writers});
    } catch (err) {
        res.status(500).json({status: 500, message: "Internal Server Error"});
        send_error(err, "Getting writers failed");
    }
});

router.get('/:id', async function(req, res, next){
    try {
        let writer = await query("SELECT * FROM writers WHERE id = ?", [req.params.id]);
        if(writer.length > 0){
            res.json({writer: writer[0]});
        } else{
            res.status(404).json({status: 404, message: "Writer not found"});
        };
    } catch (err) {
        res.status(500).json({status: 500, message: "Internal Server Error"});
        send_error(err, "Getting writer failed");
    }
});

// create the settings route
router.post('/settings/:id', check_user_token, check_user_id, async function(req, res, next){
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

router.get('/settings/:id', async function(req, res) {
    try {
        let writer = await query("SELECT * FROM writers WHERE id = ?", [req.params.id]);
        if(writer.length > 0){
            let settings = JSON.parse(writer[0].settings);
            res.json({settings: settings});
        } else{
            res.status(404).json({status: 404, message: "Writer not found"});
        };
    } catch (err) {
        res.status(500).json({status: 500, message: "Internal Server Error"});
        send_error(err, "Getting writer settings failed");
    }
});


module.exports = router;
