const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Route Đăng ký & Đăng nhập
router.post('/register', register);
router.post('/login', login);

// Route lấy thông tin cá nhân (Yêu cầu qua protect middleware)
router.get('/me', protect, getMe);

module.exports = router;