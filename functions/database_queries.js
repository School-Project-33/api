
// database queries
function query(sql, params) {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

module.exports = {
    query
}