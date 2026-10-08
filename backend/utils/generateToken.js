const jwt = require('jsonwebtoken');

// Hàm tạo JWT token chứa userId
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '30d',
    });
};

module.exports = generateToken;