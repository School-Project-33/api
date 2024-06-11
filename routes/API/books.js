// require the needed modules
var express = require("express");
var { send_error } = require("../../functions/error");
var multer = require("multer");
var path = require("path");
var fs = require("fs");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(__dirname, '../../public/images/uploads/');
      fs.mkdirSync(uploadPath, { recursive: true }); // Ensure the uploads directory exists
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + path.extname(file.originalname)); // Append current timestamp to the file name
    }
});

var upload = multer({ storage });

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

router.post("/add/cover_image", upload.single("image"), async function (req, res) {
    try {
        if(!req.file){
            console.log("No file uploaded")
            return res.status(400).send({ status: 400, message: "No file uploaded" });
        }
        let filePath = req.file.path.split("/public/")[1] || req.file.path.split("\\public\\")[1].replace(/\\/g, "/");
        res.json({ message: "Book added successfully! I think", path: "/"+filePath });
    } catch (err) {
        res.status(500).json({ message: "An error occurred" });
        send_error(err, res);
    }
});

module.exports = router;
