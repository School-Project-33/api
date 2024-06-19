// require the needed modules
var express = require("express");
var { send_error } = require("../../functions/error");
var cors = require('cors');
var { check_user_token, isAdmin, check_user_id } = require("../../functions/middleware");
var { order_email, update_order_email } = require("../../functions/email");

// create the router
var router = express.Router();

router.use(cors());
router.options('*', cors());

// Get all the orders. This route is only accessible by an admin
router.get("/", check_user_token, isAdmin, async function (req, res) {
    try {
        let orders = await query("SELECT * FROM orders");
        // Also get the order status in text format instead of interger format
        let order_status = await query("SELECT * FROM order_status");
        orders.forEach(function (order) {
            order.order_status = order_status[order.order_status - 1].status;
        });
        res.status(200).send({ "status": 200, "orders": orders });
    } catch (err) {
        console.error(err);
        send_error(err, "Posting contact form failed", res);
    }
});

// Get an order from a user account by user_id and order_id
router.get("/order/:id/:order_id", check_user_token, check_user_id, async function (req, res) {
    try {
        let order = await query("SELECT * FROM orders WHERE user_id = ? AND order_id = ?", [req.params.id, req.params.order_id]);
        // Also get the order status in text format instead of interger format
        let order_status = await query("SELECT * FROM order_status");
        order.forEach(function (order) {
            order.order_status = order_status[order.order_status - 1].status;
        });
        res.status(200).send({ "status": 200, "order": order });
    } catch (err) {
        console.error(err);
        send_error(err, "Posting contact form failed", res);
    }    
});

// Get all the orders from a user account by user_id
router.get("/ordered_by/:id", check_user_token, check_user_id, async function (req, res) {
    try {
        let orders = await query("SELECT * FROM orders WHERE user_id = ?", [req.params.id]);
        // Also get the order status in text format instead of interger format
        let order_status = await query("SELECT * FROM order_status");
        orders.forEach(function (order) {
            order.order_status = order_status[order.order_status - 1].status;
        });
        res.status(200).send({ "status": 200, "orders": orders });
    } catch (err) {
        console.error(err);
        send_error(err, "Posting contact form failed", res);
    }
});

// Get all the orders from a user account by book_id
router.get("/ordered_book/:id", check_user_token, async function (req, res) {
    try {
        // get the order by book_id. Check if the user is either an admin or the writer of the book
        if(req.user.role != 1 && req.user.seller != 1) {
            return res.status(401).send({ "status": 401, "message": "Unauthorized" });
        }
        let orders = await query("SELECT * FROM orders WHERE book_id = ?", [req.params.id]);
        // Also get the order status in text format instead of interger format
        let order_status = await query("SELECT * FROM order_status");
        orders.forEach(function (order) {
            order.order_status = order_status[order.order_status - 1].status;
        });
        if(orders.length < 1) {
            return res.status(404).send({ "status": 404, "message": "No orders found", "orders": orders});
        }
        let writer = await query("SELECT author FROM books WHERE id = ?", [req.params.id]);
        let author = await query("SELECT user_id FROM writers WHERE id =?", [writer[0].author]);
        let writerUserData = await query("SELECT * FROM users WHERE id = ?", [author[0].user_id])
        if (req.user.role != 1 && req.user.id != writerUserData[0].id) {
            console.log("did not write the book ig")
            return res.status(401).send({ "status": 401, "message": "Unauthorized" });
        }
        res.status(200).send({ "status": 200, "orders": orders });
    } catch (err) {
        console.error(err);
        send_error(err, "Posting contact form failed", res);
    }
});

// Create a new order
router.post("/new", check_user_token, async function (req, res) {
    try {
        var { book_id, quantity } = req.body;
        if(!book_id || !quantity) {
            let missing = [];
            if(!book_id) missing.push("book_id");
            if(!quantity) missing.push("quantity");
            return res.status(400).send({ status: 400, message: "Please fill in the missing fields.", missing: missing});
        }
        // create an order_id
        let order_id = Math.floor(Math.random() * 1000000000);
        let orders = await query("SELECT * FROM orders WHERE order_id = ?", [order_id]);
        async function check_order_id(){
            if(orders.length > 0) {
                order_id = Math.floor(Math.random() * 1000000000);
                await check_order_id();
            }
        }
        check_order_id();
        await query("INSERT INTO orders (user_id, book_id, quantity, order_id, order_status) VALUES (?, ?, ?, ?, ?)", [req.user.id, req.body.book_id, req.body.quantity, order_id, 2]);
        // get the order that's just been created
        let order = await query("SELECT * FROM orders WHERE order_id = ?", [order_id]);
        // send an email to the user that the order has been created
        await order_email(req.user.email, req.body.book_id, order_id, res, req);
        res.status(200).send({ "status": 200, "order": order });
    } catch (err) {
        console.error(err);
        send_error(err, "Posting contact form failed", res);
    }
});

// Update an order
router.put("/update/:order_id", check_user_token, async function (req, res) {
    try {
        var { status } = req.body;
        if(!status) {
            return res.status(400).send({ status: 400, message: "Please fill in the status" });
        }

        // check if the user is either the writer of the book, or an administrator
        let order = await query("SELECT * FROM orders WHERE order_id = ?", [req.params.order_id]);
        if(order.length < 1) {
            return res.status(404).send({ "status": 404, "message": "Order not found" });
        }
        let book = await query("SELECT author FROM books WHERE id = ?", [order[0].book_id]);
        let author = await query("SELECT user_id FROM writers WHERE id = ?", [book[0].author]);
        let writer = await query("SELECT * FROM users WHERE id = ?", [author[0].user_id]);
        if(req.user.role != 1 && req.user.id != writer[0].id) {
            return res.status(401).send({ "status": 401, "message": "Unauthorized" });
        }
        await query("UPDATE orders SET order_status = ? WHERE order_id = ?", [status, req.params.order_id]);

        let order_user = await query("SELECT * FROM users WHERE id = ?", [order[0].user_id]);
        await update_order_email(order_user[0].email, req.params.order_id, req, res);
        
        return res.status(200).send({ "status": 200, message: "Successfully changed the order status!" });
    } catch (err) {
        console.error(err);
        send_error(err, "Posting contact form failed", res);
    }
});

module.exports = router;
