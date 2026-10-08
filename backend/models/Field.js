const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Vui lòng nhập tên sân bóng'],
            trim: true,
        },
        type: {
            type: String,
            required: [true, 'Vui lòng chọn loại sân'],
            enum: ['5 người', '7 người', '11 người'], // Loại sân
        },
        address: {
            type: String,
            required: [true, 'Vui lòng nhập địa chỉ sân bóng'],
        },
        description: {
            type: String,
            default: '',
        },
        price: {
            type: Number,
            required: [true, 'Vui lòng nhập giá thuê sân/khung giờ'],
            min: [0, 'Giá sân không được nhỏ hơn 0'],
        },
        image: {
            type: String,
            default: 'no-photo.jpg', // Đường dẫn hình ảnh đại diện
        },
        status: {
            type: String,
            enum: ['AVAILABLE', 'MAINTENANCE'], // AVAILABLE: Hoạt động, MAINTENANCE: Bào trì
            default: 'AVAILABLE',
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Field', fieldSchema);