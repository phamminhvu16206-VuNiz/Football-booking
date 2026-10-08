const jwt = require('jsonwebtoken');
const User = require('../models/User');

// 1. Middleware xác thực Token (Khách hàng / Admin)
const protect = async (req, res, next) => {
    let token;

    // Kiểm tra xem request header có chứa "Authorization: Bearer <token>" không
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            // Lấy token từ chuỗi "Bearer <token>"
            token = req.headers.authorization.split(' ')[1];

            // Giải mã token bằng Secret Key
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Tìm user theo id từ payload token (loại bỏ trường password) và gán vào req.user
            req.user = await User.findById(decoded.id).select('-password');

            if (!req.user) {
                return res.status(401).json({ success: false, message: 'Người dùng không tồn tại' });
            }

            if (req.user.status === 'BLOCKED') {
                return res.status(403).json({ success: false, message: 'Tài khoản của bạn đã bị khóa' });
            }

            next(); // Cho phép đi tiếp sang Controller
        } catch (error) {
            console.error(error);
            return res.status(401).json({ success: false, message: 'Token không hợp lệ hoặc đã hết hạn' });
        }
    }

    if (!token) {
        return res.status(401).json({ success: false, message: 'Không tìm thấy Token xác thực' });
    }
};

// 2. Middleware kiểm tra quyền ADMIN
const admin = (req, res, next) => {
    if (req.user && req.user.role === 'ADMIN') {
        next(); // Cho phép đi tiếp nếu là ADMIN
    } else {
        res.status(403).json({ success: false, message: 'Quyền truy cập bị từ chối. Chỉ dành cho Admin' });
    }
};

module.exports = { protect, admin };