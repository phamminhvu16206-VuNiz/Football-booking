const User = require('../models/User');
const bcrypt = require('bcryptjs');
const generateToken = require('../utils/generateToken');

// @desc    Đăng ký tài khoản
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;

        // 1. Validate dữ liệu đầu vào
        if (!name || !email || !password || !phone) {
            return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ thông tin' });
        }

        // 2. Kiểm tra email đã tồn tại chưa
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ success: false, message: 'Email này đã được sử dụng' });
        }

        // 3. Mã hóa mật khẩu với bcryptjs
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 4. Tạo User mới
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            phone,
        });

        // 5. Trả về kết quả kèm Token
        if (user) {
            res.status(201).json({
                success: true,
                data: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    role: user.role,
                    token: generateToken(user._id),
                    avatar: user.avatar || '/images/default-avatar.png'
                },
            });
        } else {
            res.status(400).json({ success: false, message: 'Dữ liệu người dùng không hợp lệ' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Đăng nhập
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Kiểm tra email & password
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập Email và Mật khẩu' });
        }

        // 2. Tìm người dùng theo email
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng' });
        }

        // 3. Kiểm tra trạng thái tài khoản
        if (user.status === 'BLOCKED') {
            return res.status(403).json({ success: false, message: 'Tài khoản của bạn đã bị khóa' });
        }

        // 4. So sánh mật khẩu bằng bcrypt.compare
        const isMatch = await bcrypt.compare(password, user.password);

        if (user && isMatch) {
            res.json({
                success: true,
                data: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    role: user.role,
                    token: generateToken(user._id),
                    avatar: user.avatar || '/images/default-avatar.png'
                },
            });
        } else {
            res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Lấy thông tin người dùng hiện tại
// @route   GET /api/auth/me
// @access  Private (Cần Token)
const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        res.json({
            success: true,
            data: user,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    register,
    login,
    getMe,
};