const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Vui lòng nhập họ tên người dùng'],
            trim: true, // Tự động cắt bỏ khoảng trắng thừa ở 2 đầu
        },
        email: {
            type: String,
            required: [true, 'Vui lòng nhập email'],
            unique: true, // Email không được trùng lặp trong hệ thống
            lowercase: true, // Tự động chuyển email về chữ thường
            trim: true,
        },
        password: {
            type: String,
            required: [true, 'Vui lòng nhập mật khẩu'],
            minlength: [6, 'Mật khẩu phải có ít nhất 6 ký tự'],
        },
        phone: {
            type: String,
            required: [true, 'Vui lòng nhập số điện thoại'],
        },
        role: {
            type: String,
            enum: ['USER', 'ADMIN'], // Chỉ nhận 1 trong 2 giá trị quy định
            default: 'USER',
        },
        status: {
            type: String,
            enum: ['ACTIVE', 'BLOCKED'],
            default: 'ACTIVE',
        },
        tokenVersion: {
            type: Number,
            default: 0,
        },
        avatar: { 
            type: String, default: '' 
        },
        passwordResetToken: {
            type: String,
            select: false,
        },
        passwordResetExpires: {
            type: Date,
            select: false,
        },
    },
    {
        timestamps: true, // Tự động tạo createdAt và updatedAt
    }
);

module.exports = mongoose.model('User', userSchema);