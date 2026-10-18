const User = require('../models/User');
const bcrypt = require('bcryptjs');
const generateToken = require('../utils/generateToken');

const getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password -tokenVersion');
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        }
        res.json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (user) {
            user.name = req.body.name || user.name;
            user.phone = req.body.phone || user.phone;
            user.avatar = req.body.avatar || user.avatar;

            const updatedUser = await user.save();

            res.json({
                success: true,
                message: 'Cập nhật thông tin cá nhân thành công',
                data: {
                    _id: updatedUser._id,
                    name: updatedUser.name,
                    email: updatedUser.email,
                    phone: updatedUser.phone,
                    role: updatedUser.role,
                    avatar: updatedUser.avatar
                },
            });
        } else {
            res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' ||
            !currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ mật khẩu cũ và mật khẩu mới' });
        }

        if (typeof newPassword !== 'string' || newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không chính xác' });
        }

        // 1. Kiểm tra mật khẩu cũ có đúng không
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không chính xác' });
        }

        // 2. Hash mật khẩu mới và lưu vào CSDL
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.tokenVersion = (user.tokenVersion || 0) + 1;
        await user.save();

        res.json({
            success: true,
            message: 'Đổi mật khẩu thành công',
            token: generateToken(user._id, user.tokenVersion),
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteMyAccount = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        }

        await User.findByIdAndDelete(req.user._id);
        res.json({ success: true, message: 'Đã xóa tài khoản cá nhân thành công' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ==========================================
// 2. DÀNH CHO QUẢN TRỊ VIÊN (ADMIN)
// ==========================================

// @desc    Lấy danh sách tất cả người dùng (Admin)
// @route   GET /api/users
// @access  Private/Admin
const getUsers = async (req, res) => {
    try {
        // Lấy tất cả user ngoại trừ password, sắp xếp mới nhất lên đầu
        const users = await User.find({}).select('-password -tokenVersion').sort({ createdAt: -1 });
        res.json({ success: true, count: users.length, data: users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Lấy thông tin chi tiết 1 user theo ID (Admin)
// @route   GET /api/users/:id
// @access  Private/Admin
const getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password -tokenVersion');
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        }
        res.json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (user) {
            user.name = req.body.name || user.name;
            user.phone = req.body.phone || user.phone;
            user.role = req.body.role || user.role; // USER hoặc ADMIN
            if (req.body.status) {
                user.status = req.body.status;
            }

            const updatedUser = await user.save();

            res.json({
                success: true,
                message: 'Cập nhật tài khoản người dùng thành công',
                data: {
                    _id: updatedUser._id,
                    name: updatedUser.name,
                    email: updatedUser.email,
                    phone: updatedUser.phone,
                    role: updatedUser.role,
                    status: updatedUser.status,
                },
            });
        } else {
            res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        }

        // Tránh việc Admin tự xóa chính mình
        if (user._id.toString() === req.user._id.toString()) {
            return res.status(400).json({ success: false, message: 'Bạn không thể tự xóa tài khoản của chính mình' });
        }

        await User.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Đã xóa người dùng thành công' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getUserProfile,
    updateUserProfile,
    changePassword,
    deleteMyAccount,
    getUsers,
    getUserById,
    updateUser,
    deleteUser,
};