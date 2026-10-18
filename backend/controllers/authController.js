const User = require('../models/User');
const bcrypt = require('bcryptjs');
const generateToken = require('../utils/generateToken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const getMailTransporter = () => {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
        return null;
    }

    return nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: Number(SMTP_PORT) === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
};

const requestPasswordReset = async (req, res) => {
    try {
        const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        if (!email) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập email' });
        }

        const transporter = getMailTransporter();
        if (!transporter || !process.env.SMTP_FROM || !process.env.FRONTEND_URL) {
            return res.status(503).json({ success: false, message: 'Chức năng đặt lại mật khẩu chưa được cấu hình email' });
        }

        const user = await User.findOne({ email });
        if (user) {
            const resetToken = crypto.randomBytes(32).toString('hex');
            user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
            user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
            await user.save();

            const resetUrl = new URL('/forgot-password', process.env.FRONTEND_URL);
            resetUrl.searchParams.set('token', resetToken);
            try {
                await transporter.sendMail({
                    from: process.env.SMTP_FROM,
                    to: user.email,
                    subject: 'Đặt lại mật khẩu Football Booking',
                    text: `Dùng liên kết sau để đặt lại mật khẩu trong vòng 60 phút: ${resetUrl.toString()}`,
                    html: `<p>Liên kết đặt lại mật khẩu có hiệu lực trong 60 phút:</p><p><a href="${resetUrl.toString()}">Đặt lại mật khẩu</a></p>`,
                });
            } catch (error) {
                user.passwordResetToken = undefined;
                user.passwordResetExpires = undefined;
                await user.save();
                console.error('Không gửi được email đặt lại mật khẩu:', error.message);
                return res.status(503).json({ success: false, message: 'Không thể gửi email đặt lại mật khẩu lúc này' });
            }
        }

        res.json({
            success: true,
            message: 'Nếu email đã đăng ký, hướng dẫn đặt lại mật khẩu sẽ được gửi đến hộp thư.',
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;
        if (typeof token !== 'string' || !token || typeof password !== 'string' || password.length < 6) {
            return res.status(400).json({ success: false, message: 'Mã đặt lại không hợp lệ hoặc mật khẩu dưới 6 ký tự' });
        }

        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const passwordHash = await bcrypt.hash(password, 10);
        const user = await User.findOneAndUpdate({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: new Date() },
        }, {
            $set: { password: passwordHash },
            $inc: { tokenVersion: 1 },
            $unset: { passwordResetToken: 1, passwordResetExpires: 1 },
        }, { new: true });

        if (!user) {
            return res.status(400).json({ success: false, message: 'Mã đặt lại không hợp lệ hoặc đã hết hạn' });
        }

        res.json({ success: true, message: 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

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
                    token: generateToken(user._id, user.tokenVersion),
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
                    token: generateToken(user._id, user.tokenVersion),
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
        const user = await User.findById(req.user._id).select('-password -tokenVersion');
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
    requestPasswordReset,
    resetPassword,
};