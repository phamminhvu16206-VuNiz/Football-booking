const jwt = require('jsonwebtoken');

// Hàm tạo JWT token chứa userId
const generateToken = (id, tokenVersion = 0) => {
    return jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '30d',
    });
};

module.exports = generateToken;