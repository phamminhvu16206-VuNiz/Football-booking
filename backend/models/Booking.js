const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        field: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Field',
            required: true,
        },
        bookingDate: {
            type: String,
            required: [true, 'Vui lòng chọn ngày đặt sân'],
        },
        startTime: {
            type: String, // Ví dụ: '06:00'
            required: [true, 'Vui lòng chọn giờ bắt đầu'],
        },
        endTime: {
            type: String, // Tự động tính toán. Ví dụ: 06:00 + 60p = '07:00'
            required: [true, 'Vui lòng chọn giờ kết thúc'],
        },
        duration: {
            type: Number,
            required: true, // Số phút (tự động tính từ startTime và endTime)
        },
        pricePerHour: {
            type: Number, // Giá sân tại thời điểm đặt
            required: true,
        },
        totalPrice: {
            type: Number,
            required: true,
        },
        status: {
            type: String,
            enum: ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'],
            default: 'PENDING',
        },
        note: {
            type: String,
            default: '',
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Booking', bookingSchema);