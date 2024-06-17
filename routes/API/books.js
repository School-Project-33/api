// require the needed modules
var express = require("express");
var { send_error } = require("../../functions/error");
var multer = require("multer");
var path = require("path");
var fs = require("fs");
var { check_user_token, isSeller } = require("../../functions/middleware");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../public/images/uploads/'+req.user.first_name+"/"+req.body.title);
        fs.mkdirSync(uploadPath, { recursive: true }); // Ensure the uploads directory exists
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname)); // Append current timestamp to the file name
    }
});

const upload = multer({ storage: storage });

// create the router
var router = express.Router();

router.get("/", async function (req, res) {
    try {
        let books = await query("SELECT * FROM books");
        let total_books_query = await query("SELECT COUNT(*) as total_books FROM books");
	    let total_books = total_books_query[0].total_books;
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
        console.log(req.body);
        
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
        console.log(format)

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

        // before all images add "http://185.192.97.1:55614" to the path
        coverImageFilePath = "http://185.192.97.1:55614/" + coverImageFilePath;
        bookImagesFilePath = bookImagesFilePath.map(image => "http://185.192.97.1:55614/" + image);

        await query("INSERT INTO books (title, author, long_desc, short_desc, price, category_1, category_2, category_3, category_4, cover_image, images, format) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [title, author, lDescription, sDescription, price, category1, category2, category3, category4, coverImageFilePath, JSON.stringify(bookImagesFilePath), format]);
        
        res.status(200).json({ status: 200, message: 'success', paths: { cover_image: coverImageFilePath, book_images: bookImagesFilePath } });
    } catch (e) {
        console.error('Error:', e);
        res.status(500).json({ status: 500, message: 'Internal Server Error' });
    }
});

module.exports = router;
