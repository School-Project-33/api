// require the needed modules
var express = require("express");
var { send_error } = require("../../functions/error");
var multer = require("multer");
var path = require("path");
var fs = require("fs");
var { check_user_token, isSeller, isAdmin, check_writer_id } = require("../../functions/middleware");
var cors = require('cors');
var { send_mail } = require("../../functions/email");

async function sanitizeFilename(filename) {
    if (!filename) {
        return filename; // Provide a default filename or handle as per your application logic
    }
    // Replace disallowed characters with underscores
    return filename.replace(/[^\w\s.\-:<>'"/\\|?* ]/g, '_');
}

const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        try {
            let sanitizedTitle = await sanitizeFilename(req.body.title);
            let sanitizedAuthorFirstName = await sanitizeFilename(req.user.first_name);
            let sanitizedAuthorLastName = await sanitizeFilename(req.user.last_name);

            if(!req.body.title || !req.user.first_name || !req.user.last_name) {
                let missing = [];
                if(!req.body.title) missing.push("title");
                if(!req.user.first_name) missing.push("first_name");
                if(!req.user.last_name) missing.push("last_name");
                return cb(new Error('Missing required fields: '+ missing.join(', ')));
            }
            
            // Ensure sanitized variables are defined
            sanitizedTitle = sanitizedTitle;
            sanitizedAuthorFirstName = sanitizedAuthorFirstName;
            sanitizedAuthorLastName = sanitizedAuthorLastName;

            const uploadPath = path.join(__dirname, '../../public/images/uploads', sanitizedAuthorFirstName, sanitizedAuthorLastName, sanitizedTitle);
            fs.mkdirSync(uploadPath, { recursive: true }); // Ensure the uploads directory exists
            cb(null, uploadPath);
        } catch (err) {
            cb(err);
        }
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname+"-"+ Date.now() + path.extname(file.originalname)); // Append current timestamp to the file name
    }
});

const upload = multer({ storage: storage });

// create the router
var router = express.Router();

router.use(cors());
router.options('*', cors());

router.get("/", async function (req, res) {
    try {
        let books = await query("SELECT * FROM books");
        let total_books_query = await query("SELECT COUNT(*) as total_books FROM books");
	    let total_books = total_books_query[0].total_books;
        // get the user_id fromt he writers table
        for (let i = 0; i < books.length; i++){
            let author = await query("SELECT user_id FROM writers WHERE id =?", [books[i].author]);
            let user = await query("SELECT first_name, last_name FROM users WHERE id =?", [author[0].user_id]);
            let rating = await query("SELECT AVG(rating) AS rating FROM reviews WHERE book_id =?", [books[i].id]);
            let amount = await query("SELECT COUNT(*) AS amount FROM reviews WHERE book_id =?", [books[i].id]);
            books[i].amount_of_reviews = amount[0].amount;
            books[i].rating = rating[0].rating;
            books[i].first_name = user[0].first_name;
            books[i].last_name = user[0].last_name;
        }
        // images is a stringified array, parse it to an array
        for (let i = 0; i < books.length; i++){
            books[i].images = JSON.parse(books[i].images);
        }

        res.json({ status: 200, message: "Successfully got all books", amount: total_books, books: books });
    } catch (err) {
        send_error(err, res);
    }
});


router.post('/add', check_user_token, isSeller, upload.fields([
    { name: 'cover_image', maxCount: 1 },
    { name: 'book_images', maxCount: 10 }
]), async function (req, res) {
    try {
        let coverImageFilePath = req.files.cover_image[0].path.split("/public/")[1] || req.files.cover_image[0].path.split("\\public\\")[1].replace(/\\/g, "/");
        
        // Check if req.files.book_image exists before mapping
        let bookImagesFilePath = [];
        if (req.files.book_images) {
            bookImagesFilePath.push(req.files.book_images.map(file => file.path.split("/public/")[1] || file.path.split("\\public\\")[1].replace(/\\/g, "/")))
        }

        let writer = await query("SELECT id FROM writers WHERE user_id = ?", [req.user.id]);

        let title = req.body.title;
        let author = writer[0].id;
        let lDescription = req.body.long_desc;
        let sDescription = req.body.short_desc;
        let price = req.body.price;
        let category1 = req.body.category_1;
        let category2 = req.body.category_2;
        let category3 = req.body.category_3;
        let category4 = req.body.category_4;
        let format = req.body.format;

        if(!title || !author || !lDescription || !sDescription || !price || !category1 || !coverImageFilePath || !bookImagesFilePath || !format){
            let missing = [];
            if(!title) missing.push("title");
            if(!author) missing.push("author");
            if(!lDescription) missing.push("long_desc");
            if(!sDescription) missing.push("short_desc");
            if(!price) missing.push("price");
            if(!category1) missing.push("category_1");
            if(!format) missing.push("format");
            if(!coverImageFilePath) missing.push("cover_image");
            if(!bookImagesFilePath) missing.push("book_images");
            res.status(400).json({status: 400, message: "Missing required fields", missing: missing});
        }

        if(!category2 || category2 == 0) category2 = null;
        if(!category3 || category3 == 0) category3 = null;
        if(!category4 || category4 == 0) category4 = null;

        coverImageFilePath = "http://"+config.server.ip +":"+config.server.port+"/" + coverImageFilePath;
        bookImagesFilePath = bookImagesFilePath[0].map(image => "http://"+config.server.ip +":"+config.server.port+"/" + image);

        await query("INSERT INTO books (title, author, long_desc, short_desc, price, category_1, category_2, category_3, category_4, cover_image, images, format) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [title, author, lDescription, sDescription, price, category1, category2, category3, category4, coverImageFilePath, JSON.stringify(bookImagesFilePath), format]);
        
        res.status(200).json({ status: 200, message: 'success', paths: { cover_image: coverImageFilePath, book_images: bookImagesFilePath } });
    } catch (e) {
        console.error('Error:', e);
        res.status(500).json({ status: 500, message: 'Internal Server Error' });
    }
});

router.get("/:writer_id/:book_title", async function (req, res) {
    try {
        let author = await query("SELECT * FROM writers WHERE id =?", [req.params.writer_id]);
        if(author.length < 1) return res.status(404).json({ status: 404, message: "Author not found", book: [] });
        // find the book with the title and the author
        let book = await query("SELECT * FROM books WHERE title = ? AND author = ?", [req.params.book_title, author[0].id]);
        if (book.length > 0) {
            // get the rating of the book from the reviews table and also how many reviews there are
            let rating = await query("SELECT AVG(rating) AS rating FROM reviews WHERE book_id =?", [book[0].id]);
            let amount = await query("SELECT COUNT(*) AS amount FROM reviews WHERE book_id =?", [book[0].id]);
            book[0].rating = rating[0].rating;
            book[0].amount_of_reviews = amount[0].amount;

            // images is a stringified array, parse it to an array
            for (let i = 0; i < book.length; i++){
                book[i].images = JSON.parse(book[i].images);
            }
            // get all the reviews
            let reviews = await query("SELECT * FROM reviews WHERE book_id =?", [book[0].id]);
            
            // for each review get the first and last name of the user
            for (let i = 0; i < reviews.length; i++){
                let user = await query("SELECT first_name, last_name FROM users WHERE id =?", [reviews[i].user_id]);
                reviews[i].first_name = user[0].first_name;
                reviews[i].last_name = user[0].last_name;
            }
            book[0].reviews = reviews;

            res.json({ status: 200, message: "Success!", book: book[0] });
        } else {
            res.status(404).json({ status: 404, message: "Book not found", book: [] });
        }
    } catch (err) {
        send_error(err, res);
    }
});

// Remove a book
router.delete('/admin/book/:id', check_user_token, isAdmin, async function (req, res) {
    try {
        let { reason } = req.body;
        if(!reason) return res.status(400).json({ status: 400, message: "Missing required fields" });
        let book = await query("SELECT * FROM books WHERE id = ?", [req.params.id]);
        if (book.length < 1) return res.status(404).json({ status: 404, message: "Book not found" });
        db.query("DELETE FROM books WHERE id = ?", [req.params.id], async function (err, result) {
            if (err) {
                send_error(err, res);
            }
            // remove the images from the server
            let cover_image = book[0].cover_image;
            let cover_image_parts = cover_image.split("/");
            let cover_image_path = cover_image_parts.slice(3, cover_image_parts.length - 1).join("/");
            cover_image_path = path.join(__dirname, "../../public/", cover_image_path);
            
            // Remove the directory
            try {
                // check if the directory exists
                if (fs.existsSync(cover_image_path)) {
                    fs.rmdirSync(cover_image_path, { recursive: true });
                }
                console.error("Directory doesn't exist")
            } catch (e) {
                send_error(e, "Removing book + directory", res);
                console.error("Error removing directory:", e);
            }
            let authorId = book[0].author;
            let author = await query("SELECT * FROM writers WHERE id =?", [authorId]);
            let authorUser = await query("SELECT * FROM users WHERE id =?", [author[0].user_id]);
            // send mail to author[0].public_email and authorUser[0].email
            if(!author[0].public_email && !authorUser[0].email) return res.status(400).json({ status: 400, message: "Author email not found. Book is still deleted. They're just not notified." });
            if(author[0].public_email == authorUser[0].email){
                await send_mail(author[0].public_email, `Geachte heer/mevrouw ${authorUser[0].last_name},\n\nUw boek "${book[0].title}" is verwijdert van onze website. Dit is de reden: \n${reason}\n\nAls u het hier niet mee eens bent kunt u contact opnemen met onze support medewerkers.`, "Boek verwijdert");
                return res.json({ status: 200, message: "Book verwijdert" });
            } else if(author[0].public_email != authorUser[0].email){ 
                await send_mail(author[0].public_email, `Geachte heer/mevrouw ${authorUser[0].last_name},\n\nUw boek "${book[0].title}" is verwijdert van onze website. Dit is de reden: \n${reason}\n\nAls u het hier niet mee eens bent kunt u contact opnemen met onze support medewerkers.`, "Boek verwijdert");
                await send_mail(authorUser[0].email, `Geachte heer/mevrouw ${authorUser[0].last_name},\n\nUw boek "${book[0].title}" is verwijdert van onze website. Dit is de reden: \n${reason}\n\nAls u het hier niet mee eens bent kunt u contact opnemen met onze support medewerkers.`, "Boek verwijdert");
                res.json({ status: 200, message: "Book verwijdert" });
            }
        });
    } catch (err) {
        send_error(err, res);
    }
});

// remove a book as the writer of the book
router.delete('/writer/:id/book/:book_id', check_user_token, check_writer_id, async function (req, res) {
    try {
        let book = await query("SELECT * FROM books WHERE id = ?", [req.params.book_id]);
        if (book.length < 1) return res.status(404).json({ status: 404, message: "Book not found" });
        let authorId = book[0].author;
        if(authorId != req.params.id) return res.status(401).json({ status: 401, message: "Unauthorized" });
        db.query("DELETE FROM books WHERE id = ?", [req.params.book_id], async function (err, result) {
            if (err) {
                send_error(err, res);
            }
            // remove the images from the server
            let cover_image = book[0].cover_image;
            let cover_image_parts = cover_image.split("/");
            let cover_image_path = cover_image_parts.slice(3, cover_image_parts.length - 1).join("/");
            cover_image_path = path.join(__dirname, "../../public/", cover_image_path);
            
            // Remove the directory
            try {
                // check if the directory exists
                if (fs.existsSync(cover_image_path)) {
                    fs.rmdirSync(cover_image_path, { recursive: true });
                }
                console.error("Directory doesn't exist, Continuing without deleting...");
            } catch (e) {
                send_error(e, "Removing book + directory", res);
                console.error("Error removing directory:", e);
            }
            return res.json({ status: 200, message: "Book verwijdert" });
        });
    } catch (err) {
        send_error(err, res);
    }
});

module.exports = router;
