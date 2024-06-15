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
        res.json({ books: books });
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
        if (req.files.book_image) {
            bookImagesFilePath = req.files.book_image.map(file => file.path.split("/public/")[1] || file.path.split("\\public\\")[1].replace(/\\/g, "/"));
        }
        
        res.status(200).json({ status: 200, message: 'success', paths: { cover_image: coverImageFilePath, book_images: bookImagesFilePath } });
    } catch (e) {
        console.error('Error:', e);
        res.status(500).json({ status: 500, message: 'Internal Server Error' });
    }
});

module.exports = router;
