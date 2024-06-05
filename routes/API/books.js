// require the needed modules
var express = require("express");
var { send_error } = require("../../functions/error");
var multer = require("multer");

const uploadFolder = multer({
    dest: "../../public/uploads/",
});

// create the router
var router = express.Router();

router.get("/", async function (req, res) {
    try {
        let books = await query("SELECT * FROM books");
        res.json(books);
    } catch (err) {
        send_error(err, res);
    }
});

router.post("/add", uploadFolder.single("file"), async function (req, res) {
    try {
        
    } catch (err) {
        send_error(err, res);
    }
});

module.exports = router;
