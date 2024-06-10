// require the needed modules
const mysql = require('mysql');
var crypto = require('crypto');

// require the config file where all the needed data is stored (db credentials, etc)
var config = require('./configs/config.json')

// create the connection with the specified credentials
var db = mysql.createConnection({
	host: config.db.host,
	user: config.db.username,
	password: config.db.password,
	database: config.db.name
});

// create the salts table if it doesn't exist. The fields are: id INT AUTOINCREMENT PRIMARY KEY, salt INT NOT NULL
db.query(`CREATE TABLE IF NOT EXISTS salts (
	id INT AUTO_INCREMENT PRIMARY KEY,
	salt BLOB NOT NULL
)`, function (err, result) {
	if (err) throw err;
	if(result.changedRows > 0){
		console.log("Table salts created");
	}
});

// create the roles table if not exists. the fields are: id INT AUTOINCREMENT PRIMARY KEY, role TEXT NOT NULL, role_desc NOT NULL, role_level INT NOT NULL. The role_level is used to determine the level of the role, the lower the number the higher the level
db.query("CREATE TABLE IF NOT EXISTS roles ( \
	id INT AUTO_INCREMENT PRIMARY KEY, \
	role_name TEXT NOT NULL, \
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, \
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP \
)", function (err, result) {
	if (err) throw err;
	if(result.changedRows > 0){
		console.log("Table roles created");
	}
});

// create the following roles in the roles table if the table is empty. These are the roles: Beheerder, Verhuurder, Gebruiker
db.query("SELECT * FROM roles", function (err, result) {
	if (err) throw err;
	// If the roles table is empty, create the default roles
	if (result.length === 0) {
		db.query("INSERT INTO roles (role_name) VALUES (?)", ['Beheerder']);
		db.query("INSERT INTO roles (role_name) VALUES (?)", ['Curator']);
		db.query("INSERT INTO roles (role_name) VALUES (?)", ['Schrijver']);
		db.query("INSERT INTO roles (role_name) VALUES (?)", ['Gebruiker']);
		db.query("INSERT INTO roles (role_name) VALUES (?)", ['Gast Gebruiker'], function (err, result) {
			if (err) throw err;
			console.log("Default roles created");
		});
	}
});

// create the users table if it doesn't exist. The fiels are: id INT NOT NULL PRIMARY KEY AUTOINCREMENT, first_name VARCHAR(255) NOT NULL, last_name VARCHAR(255) NOT NULL, email TEXT NOT NULL, email_verified BOOLEAN, email_verify_token TEXT, token TEXT, password BLOB NOT NULL, salt INT NOT NULL, password_reset_token TEXT, password_reset_token_expires_at TIMESTAMP, role INT NOT NULL, verified_drivers_licence BOOLEAN, times_rented INT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP. The salt is a foreign key to the salts table
db.query("CREATE TABLE IF NOT EXISTS users ( \
	id INT AUTO_INCREMENT PRIMARY KEY, \
	first_name VARCHAR(255) NOT NULL, \
	last_name VARCHAR(255) NOT NULL, \
	email TEXT NOT NULL, \
	email_verified BOOLEAN, \
	email_verify_token TEXT, \
	phone_number TEXT, \
	token BLOB, \
	token_expires_at TIMESTAMP, \
	password BLOB NOT NULL, \
	salt INT NOT NULL, \
	password_reset_token TEXT, \
	password_reset_token_expires_at TIMESTAMP, \
	role INT NOT NULL DEFAULT 5, \
	seller BOOLEAN, \
	scheduled_for_deletion BOOLEAN, \
	scheduled_for_deletion_at DATE, \
	account_disabled BOOLEAN, \
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, \
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, \
	FOREIGN KEY (salt) REFERENCES salts(id), \
	FOREIGN KEY (role) REFERENCES roles(id) \
)", function (err, result) {
	if (err) throw err;
	if(result.changedRows > 0){
		console.log("Table users created");
	}
});

// add a user to the table if the database is empty
db.query("SELECT * FROM users", function (err, result) {
	if (err) throw err;

	// If the users table is empty, create a default user
	if (result.length === 0) {
		// Generate a random salt
		const salt = crypto.randomBytes(16).toString('hex');
		// Hash the password using the salt
		const password = config.defaultUser.password; // Set your default password here
		crypto.pbkdf2(password, salt, 310000, 32, 'sha256', function(err, hashedPassword) {
			if (err) throw err;
			// Insert the salt into the salts table
			db.query("INSERT INTO salts (salt) VALUES (?)", [salt], function (err, result) {
				if (err) throw err;

				// Get the ID of the inserted salt
				const saltId = result.insertId;

				// Insert the user into the users table with the salt ID
				db.query("INSERT INTO users (first_name, last_name, email, email_verified, password, salt, role) VALUES (?, ?, ?, ?, ?, ?, ?)",
				[config.defaultUser.first_name, config.defaultUser.last_name, config.defaultUser.email, 1, hashedPassword, saltId, config.defaultUser.role],
				function (err, result) {
					if (err) throw err;
						console.log("Default user created");
					}
				);
			});
		});
	} else return;
});

// create the writers table if not exists. the fields are: id INT AUTOINCREMENT PRIMARY KEY, user_id INT NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id)
db.query("CREATE TABLE IF NOT EXISTS writers ( \
	id INT AUTO_INCREMENT PRIMARY KEY, \
	user_id INT NOT NULL, \
	profile_image TEXT, \
	profile_banner TEXT, \
	bio TEXT NOT NULL, \
	website_url TEXT, \
	twitter_url TEXT, \
	facebook_url TEXT, \
	instagram_url TEXT, \
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, \
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, \
	FOREIGN KEY (user_id) REFERENCES users(id) \
)", function (err, result) {
	if (err) throw err;
	if(result.changedRows > 0){
		console.log("Table writers created");
	}
});

// Create the categories table if it doesn't exist. The fields are: id INT AUTOINCREMENT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
db.query("CREATE TABLE IF NOT EXISTS categories ( \
	id INT AUTO_INCREMENT PRIMARY KEY, \
	name TEXT NOT NULL, \
	description TEXT NOT NULL, \
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, \
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP \
)", function (err, result) {
	if (err) throw err;
	if(result.changedRows > 0){
		console.log("Table categories created");
	}
});

// create the defaults for categories
db.query("SELECT * FROM categories", function (err, result) {
	if (err) throw err;
	if (result.length === 0) {
		db.query("INSERT INTO categories (name, description) VALUES (?, ?)", ['Fiction', 'Fiction category']);
		db.query("INSERT INTO categories (name, description) VALUES (?, ?)", ['Non-Fiction', 'Non-Fiction category']);
		db.query("INSERT INTO categories (name, description) VALUES (?, ?)", ['Science Fiction', 'Science Fiction category']);
		db.query("INSERT INTO categories (name, description) VALUES (?, ?)", ['Fantasy', 'Fantasy category']);
		db.query("INSERT INTO categories (name, description) VALUES (?, ?)", ['Horror', 'Horror category']);
		db.query("INSERT INTO categories (name, description) VALUES (?, ?)", ['Mystery', 'Mystery category']);
		db.query("INSERT INTO categories (name, description) VALUES (?, ?)", ['Thriller', 'Thriller category']);
		db.query("INSERT INTO categories (name, description) VALUES (?, ?)", ['Romance', 'Romance category']);
		db.query("INSERT INTO categories (name, description) VALUES (?, ?)", ['Biography', 'Biography category']);
		db.query("INSERT INTO categories (name, description) VALUES (?, ?)", ['Autobiography', 'Autobiography category']);
		db.query("INSERT INTO categories (name, description) VALUES (?, ?)", ['Self-Help', 'Self-Help category']);
		db.query("INSERT INTO categories (name, description) VALUES (?, ?)", ['Cookbook', 'Cookbook category'], async function (err, result) {
			if (err) throw err;
			console.log("Default categories created");
		});
	}
});

// create the formats table if not exists. the fields are: id INT AUTOINCREMENT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
db.query("CREATE TABLE IF NOT EXISTS formats ( \
	id INT AUTO_INCREMENT PRIMARY KEY, \
	name TEXT NOT NULL, \
	description TEXT NOT NULL, \
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, \
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP \
)", function (err, result) {
	if (err) throw err;
	if(result.changedRows > 0){
		console.log("Table formats created");
	}
});

// Add defaults to the formats table
db.query("SELECT * FROM formats", function (err, result) {
	if (err) throw err;
	if (result.length === 0) {
		db.query("INSERT INTO formats (name, description) VALUES (?, ?)", ['Paperback', 'Paperback format']);
		db.query("INSERT INTO formats (name, description) VALUES (?, ?)", ['Hardcover', 'Hardcover format']);
		db.query("INSERT INTO formats (name, description) VALUES (?, ?)", ['Ebook', 'Ebook format'], function (err, result) {
			if (err) throw err;
			console.log("Default formats created");
		});
	}
});

// Create the books table if it doesn't exist. The fields are: id INT AUTOINCREMENT PRIMARY KEY, title TEXT NOT NULL, author INT NOT NULL, cover_image TEXT, FOREIGN KEY (author) REFERENCES writers(id)
db.query("CREATE TABLE IF NOT EXISTS books ( \
	id INT AUTO_INCREMENT PRIMARY KEY, \
	title TEXT NOT NULL, \
	author INT NOT NULL, \
	cover_image TEXT, \
	images TEXT, \
	long_desc TEXT NOT NULL, \
	short_desc TEXT NOT NULL, \
	price DECIMAL(10, 2) NOT NULL, \
	category_1 INT NOT NULL, \
	category_2 INT, \
	category_3 INT, \
	category_4 INT, \
	format INT NOT NULL, \
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, \
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, \
	FOREIGN KEY (author) REFERENCES writers(id) \
)", function (err, result) {
	if (err) throw err;
	if(result.changedRows > 0){
		console.log("Table books created");
	}
});

// // create the reviews table if not exists. the fields are: id INT AUTOINCREMENT PRIMARY KEY, book_id INT NOT NULL, user_id INT NOT NULL, review TEXT NOT NULL, rating INT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (book_id) REFERENCES books(id), FOREIGN KEY (user_id) REFERENCES users(id)
// db.query("CREATE TABLE IF NOT EXISTS reviews ( \
// 	id INT AUTO_INCREMENT PRIMARY KEY, \
// 	book_id INT NOT NULL, \
// 	user_id INT NOT NULL, \
// 	review TEXT NOT NULL, \
// 	rating INT NOT NULL, \
// 	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, \
// 	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, \
// 	FOREIGN KEY (book_id) REFERENCES books(id), \
// 	FOREIGN KEY (user_id) REFERENCES users(id) \
// )", function (err, result) {
// 	if (err) throw err;
// 	if(result.changedRows > 0){
// 		console.log("Table reviews created");
// 	}
// });

// // create the baskets table if not exists. the fields are: id INT AUTOINCREMENT PRIMARY KEY, user_id INT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id)
// db.query("CREATE TABLE IF NOT EXISTS baskets ( \
// 	id INT AUTO_INCREMENT PRIMARY KEY, \
// 	user_id INT NOT NULL, \
// 	items blob NOT NULL, \
// 	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, \
// 	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, \
// 	FOREIGN KEY (user_id) REFERENCES users(id) \
// )", function (err, result) {
// 	if (err) throw err;
// 	if(result.changedRows > 0){
// 		console.log("Table baskets created");
// 	}
// });

// // create the orders table if not exists. the fields are: id INT AUTOINCREMENT PRIMARY KEY, user_id INT NOT NULL, basket_id INT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id), FOREIGN KEY (book_id) REFERENCES books(id)
// db.query("CREATE TABLE IF NOT EXISTS orders ( \
// 	id INT AUTO_INCREMENT PRIMARY KEY, \
// 	user_id INT NOT NULL, \
// 	basket_id INT NOT NULL, \
// 	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, \
// 	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, \
// 	FOREIGN KEY (user_id) REFERENCES users(id), \
// 	FOREIGN KEY (basket_id) REFERENCES baskets(id) \
// )", function (err, result) {
// 	if (err) throw err;
// 	if(result.changedRows > 0){
// 		console.log("Table orders created");
// 	}
// });

// export the db connection
module.exports = db;