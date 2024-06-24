// require the needed modules
var express = require("express");
var { send_error } = require("../../functions/error");
var multer = require("multer");
var path = require("path");
var fs = require("fs");
var { check_user_token, check_user_id, check_writer_id, isSeller } = require("../../functions/middleware");
var cors = require('cors');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../public/images/uploads/'+req.user.first_name +"/"+req.user.last_name);
        fs.mkdirSync(uploadPath, { recursive: true }); // Ensure the uploads directory exists
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + path.extname(file.originalname)); // Append current timestamp to the file name
    }
});

const upload = multer({ storage: storage });

// create the router
var router = express.Router();

router.use(cors());
router.options('*', cors());

router.get('/', async function(req, res, next){
    try {
        let writers = await query("SELECT * FROM writers");
        let total_writers_query = await query("SELECT COUNT(*) as total_writers FROM writers");
        let total_writers = total_writers_query[0].total_writers;
        // also get the users first and last_name from the users table and add it to the writers object
        for (let i = 0; i < writers.length; i++){
            let user = await query("SELECT first_name, last_name FROM users WHERE id = ?", [writers[i].user_id]);
            writers[i].first_name = user[0].first_name;
            writers[i].last_name = user[0].last_name;
            let books = await query("SELECT * FROM books WHERE author = ?", [writers[i].id]);
            writers[i].books = books;
            // add global book rating to each book object
            for (let j = 0; j < books.length; j++){
                let global_rating = await query("SELECT AVG(rating) AS global_rating FROM reviews WHERE book_id =?", [books[j].id]);
                books[j].global_rating = global_rating[0].global_rating;
                // get the amount of all reviews
                let amount = await query("SELECT COUNT(*) AS amount FROM reviews WHERE book_id =?", [books[j].id]);
                books[j].amount_of_reviews = amount[0].amount;
            }
            // add global book rating to the writer object
            // get all the book_ids from the books array and get a global rating from those books and add it to the writer object
            let global_rating = await query("SELECT AVG(rating) AS global_rating FROM reviews WHERE book_id IN (SELECT id FROM books WHERE author = ?)", [writers[i].id]);
            writers[i].global_rating = global_rating[0].global_rating;
            // get the amount of all reviews
            let amount = await query("SELECT COUNT(*) AS amount FROM reviews WHERE book_id IN (SELECT id FROM books WHERE author = ?)", [writers[i].id]);
            writers[i].amount_of_reviews = amount[0].amount;
        }
        if(writers.length > 0){
            await res.json({status: 200, message: "Success!", amount: total_writers, writers: writers});
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
        let books = await query("SELECT * FROM books WHERE author = ?", [writer[0].id]);
        // add global book rating to each book object
        for (let i = 0; i < books.length; i++){
            let global_rating = await query("SELECT AVG(rating) AS global_rating FROM reviews WHERE book_id =?", [books[i].id]);
            books[i].global_rating = global_rating[0].global_rating;
            // get the amount of all reviews
            let amount = await query("SELECT COUNT(*) AS amount FROM reviews WHERE book_id =?", [books[i].id]);
            books[i].amount_of_reviews = amount[0].amount;
        }
        
        // add global book rating to the writer object
        // get all the book_ids from the books array and get a global rating from those books and add it to the writer object
        let global_rating = await query("SELECT AVG(rating) AS global_rating FROM reviews WHERE book_id IN (SELECT id FROM books WHERE author = ?)", [writer[0].id]);
        writer[0].global_rating = global_rating[0].global_rating;
        // get the amount of all reviews
        let amount = await query("SELECT COUNT(*) AS amount FROM reviews WHERE book_id IN (SELECT id FROM books WHERE author = ?)", [writer[0].id]);
        writer[0].amount_of_reviews = amount[0].amount;
        writer[0].books = books;
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
router.put('/settings/:id', check_user_token, isSeller, check_writer_id, upload.fields([
    { name: 'profile_image', maxCount: 1 },
    { name: 'profile_banner', maxCount: 1 }
]), async function(req, res, next){
    try {
        let writer = await query("SELECT * FROM writers WHERE id = ?", [req.params.id]);
        if(writer.length > 0){
            let body = req.body;
            let public_email = body.public_email;
            let bio = body.bio;
            let website_url = body.website_url;
            let twitter_url = body.twitter_url;
            let facebook_url = body.facebook_url;
            let instagram_url = body.instagram_url;

            if(website_url == null || website_url == "") website_url = null;
            if(twitter_url == null || twitter_url == "") twitter_url = null;
            if(facebook_url == null || facebook_url == "") facebook_url = null;
            if(instagram_url == null || instagram_url == "") instagram_url = null;

            let profileImageFilePath = req.files.profile_image[0].path.split("/public/")[1] || req.files.profile_image[0].path.split("\\public\\")[1].replace(/\\/g, "/");
            let ProfileBannerFilePath = req.files.profile_banner[0].path.split("/public/")[1] || req.files.profile_banner[0].path.split("\\public\\")[1].replace(/\\/g, "/");

            profileImageFilePath = "http://185.192.97.1:55614/" + profileImageFilePath;
            ProfileBannerFilePath = "http://185.192.97.1:55614/" + ProfileBannerFilePath;

            await query("UPDATE writers SET profile_image =?, profile_banner =?, public_email = ?, bio = ?, website_url = ?, twitter_url = ?, facebook_url = ?, instagram_url = ? WHERE id = ?", [profileImageFilePath, ProfileBannerFilePath, public_email, bio, website_url, twitter_url, facebook_url, instagram_url, req.params.id]);
            
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
