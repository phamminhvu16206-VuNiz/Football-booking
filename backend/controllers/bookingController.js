const Booking = require('../models/Booking');
const Field = require('../models/Field');
const mongoose = require('mongoose');

const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};

// @desc    Lấy danh sách các khung giờ ĐÃ THANH TOÁN (Màu đỏ) theo Sân và Ngày
// @route   GET /api/bookings/booked-slots
// @access  Public
const getBookedSlots = async (req, res) => {
    try {
        const { fieldId, date } = req.query;

        // 1. Kiểm tra tham số truyền vào
        if (!fieldId || !date) {
            return res.json({ success: true, data: [] });
        }

        // 2. Kiểm tra fieldId có phải ObjectId hợp lệ của MongoDB không
        if (!mongoose.Types.ObjectId.isValid(fieldId)) {
            return res.json({ success: true, data: [] });
        }

        // 3. Chuẩn hóa định dạng ngày (YYYY-MM-DD)
        const formattedDate = date.split('T')[0];

        // 4. Tìm các đơn đã thanh toán
        const paidBookings = await Booking.find({
            field: fieldId,
            bookingDate: formattedDate,
            paymentStatus: 'PAID',
            status: { $ne: 'CANCELLED' }
        }).select('startTime endTime');

        return res.json({
            success: true,
            data: paidBookings || []
        });
    } catch (error) {
        console.error('Lỗi lấy booked-slots:', error);
        // Trả về mảng rỗng thay vì ném lỗi 500
        return res.json({ success: true, data: [] });
    }
};

// @desc    Tạo đơn đặt sân nháp (Khách chọn ô - chưa khóa ô của người khác)
// @route   POST /api/bookings
// @access  Private
const createBooking = async (req, res) => {
    try {
        const { fieldId, bookingDate, startTime, endTime, note, paymentMethod } = req.body;

        if (!fieldId || !bookingDate || !startTime || !endTime) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng chọn đầy đủ thông tin đặt sân',
            });
        }

        const startMins = timeToMinutes(startTime);
        const endMins = timeToMinutes(endTime);

        if (endMins <= startMins) {
            return res.status(400).json({ success: false, message: 'Giờ kết thúc phải lớn hơn giờ bắt đầu' });
        }

        const field = await Field.findById(fieldId);
        if (!field || field.status === 'MAINTENANCE') {
            return res.status(400).json({ success: false, message: 'Sân bóng không khả dụng' });
        }

        // CHỈ KIỂM TRA TRÙNG VỚI CÁC ĐƠN ĐÃ THANH TOÁN (PAID)
        const existingPaidBookings = await Booking.find({
            field: fieldId,
            bookingDate,
            paymentStatus: 'PAID',
            status: { $ne: 'CANCELLED' }
        });

        const isOverlapped = existingPaidBookings.some((booking) => {
            const existingStart = timeToMinutes(booking.startTime);
            const existingEnd = timeToMinutes(booking.endTime);
            return startMins < existingEnd && endMins > existingStart;
        });

        if (isOverlapped) {
            return res.status(409).json({
                success: false,
                message: 'Rất tiếc! Khung giờ này vừa có người khác thanh toán giữ chỗ thành công.',
            });
        }

        const duration = endMins - startMins;
        const pricePerHour = field.price;
        const totalPrice = (pricePerHour / 60) * duration;

        // Tạo đơn đặt sân ở trạng thái PENDING
        const booking = await Booking.create({
            user: req.user._id,
            field: fieldId,
            bookingDate,
            startTime,
            endTime,
            duration,
            pricePerHour,
            totalPrice,
            note,
            paymentMethod: paymentMethod || 'BANK_TRANSFER',
            paymentStatus: 'PENDING',
            status: 'PENDING',
        });

        const populatedBooking = await Booking.findById(booking._id)
            .populate('user', 'name email phone')
            .populate('field', 'name type address price');

        res.status(201).json({
            success: true,
            message: 'Tạo đơn đặt sân thành công. Vui lòng thanh toán để giữ chỗ!',
            data: populatedBooking,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Cập nhật thanh toán (Ai bấm thanh toán trước được giữ chỗ trước)
// @route   PUT /api/bookings/:id/payment
// @access  Private
const updatePaymentStatus = async (req, res) => {
    try {
        const { paymentStatus, paymentMethod } = req.body;
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt sân' });
        }

        if (paymentStatus === 'PAID') {
            // KIỂM TRA LẠI MỘT LẦN NỮA XEM TRONG LÚC CHUYỂN KHOẢN ĐÃ CÓ AI THANH TOÁN KHUNG GIỜ NÀY CHƯA
            const startMins = timeToMinutes(booking.startTime);
            const endMins = timeToMinutes(booking.endTime);

            const conflictingPaidBooking = await Booking.findOne({
                _id: { $ne: booking._id }, // Không tính chính đơn này
                field: booking.field,
                bookingDate: booking.bookingDate,
                paymentStatus: 'PAID',
                status: { $ne: 'CANCELLED' },
                $or: [
                    {
                        $and: [
                            { startTime: { $lt: booking.endTime } },
                            { endTime: { $gt: booking.startTime } }
                        ]
                    }
                ]
            });

            if (conflictingPaidBooking) {
                booking.status = 'CANCELLED';
                booking.paymentStatus = 'REFUND_PENDING'; // Chờ hoàn tiền
                await booking.save();

                return res.status(409).json({
                    success: false,
                    message: 'Khung giờ này vừa có người khác thanh toán thành công trước bạn ít giây. Vui lòng liên hệ sân để nhận lại tiền chuyển khoản hoặc chọn giờ khác!'
                });
            }

            booking.paymentStatus = 'PAID';
            booking.status = 'CONFIRMED';
        }

        if (paymentMethod) booking.paymentMethod = paymentMethod;
        await booking.save();

        res.json({
            success: true,
            message: 'Thanh toán giữ chỗ thành công!',
            data: booking,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Các hàm khác giữ nguyên
const checkPaymentStatus = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt sân' });
        res.json({ success: true, paymentStatus: booking.paymentStatus, status: booking.status });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const handleSepayWebhook = async (req, res) => {
    try {
        const { content, transferAmount } = req.body;
        const match = content && content.match(/DATSAN\s+([a-fA-Z0-9]+)/i);

        if (!match) return res.status(200).json({ success: false, message: 'Nội dung CK không hợp lệ' });

        const bookingId = match[1];
        const booking = await Booking.findById(bookingId);

        if (!booking || booking.paymentStatus === 'PAID') {
            return res.status(200).json({ success: true, message: 'Đơn đã xử lý từ trước' });
        }

        if (transferAmount >= booking.totalPrice) {
            // Kiểm tra trùng giờ khi webhook gọi
            const existingPaid = await Booking.findOne({
                _id: { $ne: booking._id },
                field: booking.field,
                bookingDate: booking.bookingDate,
                paymentStatus: 'PAID',
                status: { $ne: 'CANCELLED' },
                $or: [
                    {
                        $and: [
                            { startTime: { $lt: booking.endTime } },
                            { endTime: { $gt: booking.startTime } }
                        ]
                    }
                ]
            });

            if (existingPaid) {
                booking.status = 'CANCELLED';
                booking.paymentStatus = 'REFUND_PENDING';
                await booking.save();
                return res.status(200).json({ success: false, message: 'Đã có người thanh toán trước' });
            }

            booking.paymentStatus = 'PAID';
            booking.status = 'CONFIRMED';
            booking.paymentMethod = 'BANK_TRANSFER';
            await booking.save();

            return res.status(200).json({ success: true, message: 'Thanh toán thành công' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createBooking,
    getBookedSlots,
    checkPaymentStatus,
    updatePaymentStatus,
    handleSepayWebhook
};