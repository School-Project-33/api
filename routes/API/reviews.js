// require the needed modules
var express = require("express");
var { send_error } = require("../../functions/error");
var cors = require('cors');
var { check_user_token, isAdmin, check_user_id } = require("../../functions/middleware");
var { send_mail } = require("../../functions/email");

// create the router
var router = express.Router();

router.use(cors());
router.options('*', cors());

// reviews routes

// get all reviews
router.get("/", async function (req, res) {
    try {
        let reviews = await query("SELECT * FROM reviews");
        // for each review return their global rating
        for (let i = 0; i < reviews.length; i++) {
            let global_rating = await query("SELECT AVG(rating) AS global_rating FROM reviews WHERE book_id =?", [reviews[i].book_id]);
            reviews[i].global_rating = global_rating[0].global_rating;
        }
        // get the amount of all reviews
        let amount = await query("SELECT COUNT(*) AS amount FROM reviews");
        res.status(200).send({ "status": 200, "reviews": reviews, "amount": amount[0].amount });
    } catch (err) {
        console.error(err);
        send_error(err, "Getting reviews failed");
        res.status(500).send({ "status": 500, "message": "Internal Server Error" });
    }
});

// get a review by id
router.get("/review/:id", async function (req, res) {
    try {
        let review = await query("SELECT * FROM reviews WHERE id =?", [req.params.id]);
        if (review.length < 1) return res.status(404).send({ "status": 404, "message": "Review not found" });
        res.status(200).send({ "status": 200, "review": review });
    } catch (err) {
        console.error(err);
        send_error(err, "Getting review failed");
        res.status(500).send({ "status": 500, "message": "Internal Server Error" });
    }
});

// get all reviews by book_id
router.get("/book/:book_id", async function (req, res) {
    try {
        let reviews = await query("SELECT * FROM reviews WHERE book_id =?", [req.params.book_id]);
        if (reviews.length < 1) return res.status(404).send({ "status": 404, "message": "Reviews not found" });
        // get the global rating of the book
        let global_rating = await query("SELECT AVG(rating) AS rating FROM reviews WHERE book_id =?", [req.params.book_id]);
        reviews[0].global_rating = global_rating[0].rating;
        res.status(200).send({ "status": 200, "reviews": reviews, "book": book[0] });
    } catch (err) {
        console.error(err);
        send_error(err, "Getting reviews failed");
        res.status(500).send({ "status": 500, "message": "Internal Server Error" });
    }
});

// get all reviews by user_id
router.get("/user/:user_id", async function (req, res) {
    try {
        let reviews = await query("SELECT * FROM reviews WHERE user_id =?", [req.params.user_id]);
        if (reviews.length < 1) return res.status(404).send({ "status": 404, "message": "Reviews not found" });
        res.status(200).send({ "status": 200, "reviews": reviews });
    } catch (err) {
        console.error(err);
        send_error(err, "Getting reviews failed");
        res.status(500).send({ "status": 500, "message": "Internal Server Error" });
    }
});

// create a new review by book_id
router.post("/new/:book_id", check_user_token, async function (req, res) {
    try {
        let book = await query("SELECT * FROM books WHERE id =?", [req.params.book_id]);
        if (book.length < 1) return res.status(404).send({ "status": 404, "message": "Book not found" });
        let rating = req.body.rating;
        if(rating > 5 || rating < 1) return res.status(400).send({ "status": 400, "message": "Rating must be between 1 and 5" });
        let review_text = req.body.review;
        if(!review_text || !rating) {
            let missing = [];
            if(!rating) missing.push("rating");
            if(!review_text) missing.push("review");
            return res.status(400).send({ "status": 400, "message": "Please fill in the missing fields: " + missing.join(", ")});
        }
        let review = await query("INSERT INTO reviews (book_id, user_id, rating, review) VALUES (?, ?, ?, ?)", [req.params.book_id, req.user.id, rating, review_text]);
        if(review.affectedRows < 1) return res.status(500).send({ "status": 500, "message": "Creating review failed" });
        res.status(201).send({ "status": 201, "message": "Review created" });
    } catch (err) {
        console.error(err);
        send_error(err, "Creating review failed");
        res.status(500).send({ "status": 500, "message": "Internal Server Error" });
    }
});

// remove a review as admin. Also send the writer of the review an email that their review is removed due to a reason
router.delete("/delete/:id", check_user_token, isAdmin, async function (req, res, next){
    try {
        let review = await query("SELECT * FROM reviews WHERE id=?", [req.params.id]);
        if(review.lenght < 1) return res.status(404).json({ status: 404, message: "Cannot find the review you're trying to delete. Please refresh and try again later." });

        let reason = req.body.reason;
        if(!reason) return res.status(400).json({ status: 400, message: "Please provide a reason for deleting this review." });
        let delete_review = await query("DELETE FROM reviews WHERE id=?", [req.params.id]);
        if(delete_review.affectedRows < 1) return res.status(500).json({ status: 500, message: "Deleting the review failed" });

        // send the writer an email that their review is removed
        let user = await query("SELECT * FROM users WHERE id=?", [review[0].user_id]);
        if(user.length < 1) return res.status(404).json({ status: 404, message: "Cannot find the user that wrote the review" });
        let email = user[0].email;
        let subject = "Uw review is verwijderd";
        let text = `Beste heer/mevrouw ${user[0].last_name},\nUw review is verwijderd om de volgende reden: ${reason}\n\nMet vriendelijke groet,\nHet team van E-schrijvers`;
        await send_mail(email, text, subject);
        res.status(200).json({ status: 200, message: "Review deleted" });        
    } catch (err) {
        console.error(err);
        send_error(err, "Deleting review failed");
        res.status(500).json({ status: 500, message: "Internal Server Error" });
    }
});

// delete a review by id
router.delete("/delete/:id/:review_id", check_user_token, check_user_id, async function (req, res, next) {
    try {
        let review = await query("SELECT * FROM reviews WHERE id =?", [req.params.id]);
        if (review.length < 1) return res.status(404).send({ "status": 404, "message": "Review not found" });
        if (review[0].user_id != req.user.id) return res.status(403).send({ "status": 403, "message": "You can only delete your own reviews" });
        let deleted = await query("DELETE FROM reviews WHERE id =?", [req.params.id]);
        if (deleted.affectedRows < 1) return res.status(500).send({ "status": 500, "message": "Deleting review failed" });
        res.status(200).send({ "status": 200, "message": "Review deleted" });
    } catch (err) {
        console.error(err);
        send_error(err, "Deleting review failed");
        res.status(500).send({ "status": 500, "message": "Internal Server Error" });
    }
});

module.exports = router;
