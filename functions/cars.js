var db = require('../db');
var { query } = require("./database_queries");
var { send_mail } = require("./email");
var { hasPermission, getUserPermissionsFromDatabase, getUserRoleFromDatabase } = require("./middleware");
var permissions = require("../configs/permissions.json");
var { send_request } = require("./dws");

async function rentCar(userId, carId, fromDate, toDate, cb) {
    try {
        // Start transaction
        await db.beginTransaction();

        // Check if car is available
        let cars = await query("SELECT * FROM cars WHERE id =?", [carId]);
        if(cars.length == 0){
            new Error("Car not found");
            return cb({status: 404, message: "Car not found."});
        }
        if (cars[0].car_available == 0) {
            new Error("Car is not available");
            return cb({status: 22, message: "Car is not available."});
        }

        let dbuser = await query("SELECT * FROM users WHERE id =?", [userId]);
        let dbuser_email = dbuser[0].email;
        let dbuser_verified_email = dbuser[0].email_verified;
        let dbuser_verified_drivers_license = dbuser[0].verified_drivers_licence;

        if(!dbuser_verified_email || !dbuser_verified_drivers_license){
            new Error("Email or Drivers License not verified");
            return cb({status:403, message:"Email or Drivers License not verified"});
        }

        // Insert into log table
        db.query("INSERT INTO logs (user_id, car_id, start_date, end_date, status) VALUES (?,?,?,?,?)", [userId, carId, fromDate, toDate, 1], function (err, result) {
            if(err) throw err;
        });
        
        // notify staff and user
        // send email to all users with the "ACCEPT_DENY_REQUEST" permission
        let users = await query("SELECT * FROM users")
        users.forEach(async user => {
            let role_permissions = await query("SELECT * FROM roles WHERE id =?", [user.role]);
            if(hasPermission(permissions["ACCEPT_DENY_REQUEST"], await role_permissions[0].role_level)){
                send_request(dbuser[0].first_name +" "+dbuser[0].last_name, `${dbuser[0].first_name} requested to rent: \n\nCarId: ${carId}\nFrom-to: ${fromDate.replace(/-/g, "/")} - ${toDate.replace(/-/g, "/")}`);
                send_mail(user.email, `Dear ${user.first_name},\n${dbuser[0].first_name} requested to rent: \n\nCarId: ${carId}\nFrom-to: ${fromDate.replace(/-/g, "/")} - ${toDate.replace(/-/g, "/")}\n\n`, "Car Rental Request");
            }
        });

        // get car details
        let car = await query("SELECT * FROM cars WHERE id =?", [carId]);
        let car_type = await query("SELECT * FROM car_types WHERE id =?", [car[0].car_type]);
        let car_location = await query("SELECT * FROM locations WHERE id =?", [car[0].location]);

        // send mail to user
        send_mail(dbuser_email, `Dear ${dbuser[0].first_name},\nYour request to rent: \n\n${car_type[0].brand} ${car_type[0].model}\nLocated in: ${car_location[0].location} \nFrom-to: ${fromDate.replace(/-/g, "/")} - ${toDate.replace(/-/g, "/")}\n\nHas been sent to the staff for approval.`, "Car Rental Request");
        // Commit transaction
        await db.commit();

        cb({status: 200, message: "Request sent to staff for approval."});

    } catch (error) {
        // Rollback if any error occurs
        cb({status:500, message:"Something went wrong"});
        await db.rollback();
        throw error;
    }
}

module.exports = {
    rentCar
}