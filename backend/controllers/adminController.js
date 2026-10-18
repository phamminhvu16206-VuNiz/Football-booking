const Booking = require('../models/Booking');
const Field = require('../models/Field');
const User = require('../models/User');
const withBookingDateLock = require('../utils/withBookingDateLock');

// @desc    Lấy danh sách tất cả lịch đặt sân (Admin)
// @route   GET /api/admin/bookings
// @access  Private/Admin
const getAllBookings = async (req, res) => {
    try {
        const { status, bookingDate, fieldId } = req.query;
        let query = {};

        if (status) query.status = status;
        if (bookingDate) query.bookingDate = bookingDate;
        if (fieldId) query.field = fieldId;

        const bookings = await Booking.find(query)
            .populate('user', 'name email phone')
            .populate('field', 'name type address')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: bookings.length,
            data: bookings,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Xác nhận đơn đặt sân (PENDING -> CONFIRMED)
// @route   PUT /api/admin/bookings/:id/confirm
// @access  Private/Admin
const confirmBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt sân' });
        }

        if (booking.status !== 'PENDING' || booking.paymentStatus !== 'PAID') {
            return res.status(400).json({
                success: false,
                message: 'Chỉ có thể xác nhận đơn đã thanh toán và đang chờ xử lý',
            });
        }

        booking.status = 'CONFIRMED';
        await booking.save();

        res.json({
            success: true,
            message: 'Đã xác nhận đơn đặt sân thành công',
            data: booking,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Từ chối đơn đặt sân (PENDING -> CANCELLED)
// @route   PUT /api/admin/bookings/:id/reject
// @access  Private/Admin
const rejectBooking = async (req, res) => {
    try {
        const initialBooking = await Booking.findById(req.params.id);
        if (!initialBooking) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt sân' });
        }

        const result = await withBookingDateLock(initialBooking.field, initialBooking.bookingDate, async () => {
            const booking = await Booking.findById(req.params.id);
            if (!booking) {
                return { status: 404, message: 'Không tìm thấy đơn đặt sân' };
            }
            if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') {
                return { status: 400, message: 'Không thể hủy/từ chối đơn ở trạng thái này' };
            }

            booking.status = 'CANCELLED';
            if (booking.paymentStatus === 'PAID') {
                booking.paymentStatus = 'REFUND_PENDING';
            }
            booking.holdExpiresAt = null;
            if (req.body.note) {
                booking.note = `${booking.note ? `${booking.note}\n` : ''}[Admin Từ chối]: ${req.body.note}`;
            }
            await booking.save();
            return { status: 200, booking };
        });

        if (!result.acquired) {
            return res.status(409).json({ success: false, message: 'Đang xử lý lịch đặt này, vui lòng thử lại' });
        }
        if (result.value.status !== 200) {
            return res.status(result.value.status).json({ success: false, message: result.value.message });
        }
        res.json({ success: true, message: 'Đã từ chối/hủy đơn đặt sân', data: result.value.booking });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Đánh dấu trận đấu đã hoàn thành (CONFIRMED -> COMPLETED)
// @route   PUT /api/admin/bookings/:id/complete
// @access  Private/Admin
const completeBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt sân' });
        }

        if (booking.status !== 'CONFIRMED' || booking.paymentStatus !== 'PAID') {
            return res.status(400).json({
                success: false,
                message: 'Chỉ có thể hoàn thành đơn đã thanh toán và được xác nhận',
            });
        }

        booking.status = 'COMPLETED';
        await booking.save();

        res.json({
            success: true,
            message: 'Đã hoàn thành trận đấu',
            data: booking,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const completeRefund = async (req, res) => {
    try {
        const initialBooking = await Booking.findById(req.params.id);
        if (!initialBooking) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt sân' });
        }

        const result = await withBookingDateLock(initialBooking.field, initialBooking.bookingDate, async () => {
            const booking = await Booking.findById(req.params.id);
            if (!booking) {
                return { status: 404, message: 'Không tìm thấy đơn đặt sân' };
            }
            if (booking.status !== 'CANCELLED' || booking.paymentStatus !== 'REFUND_PENDING') {
                return { status: 400, message: 'Đơn này không chờ hoàn tiền' };
            }

            booking.paymentStatus = 'REFUNDED';
            booking.refundedAt = new Date();
            booking.refundedBy = req.user._id;
            await booking.save();
            return { status: 200, booking };
        });

        if (!result.acquired) {
            return res.status(409).json({ success: false, message: 'Đang xử lý lịch đặt này, vui lòng thử lại' });
        }
        if (result.value.status !== 200) {
            return res.status(result.value.status).json({ success: false, message: result.value.message });
        }
        res.json({ success: true, message: 'Đã ghi nhận hoàn tiền thành công', data: result.value.booking });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Thống kê doanh thu & Tổng quan hệ thống
// @route   GET /api/admin/dashboard-stats
// @access  Private/Admin
const getDashboardStats = async (req, res) => {
    try {
        // 1. Đếm tổng số lượng entities
        const totalUsers = await User.countDocuments({ role: 'USER' });
        const totalFields = await Field.countDocuments();
        const totalBookings = await Booking.countDocuments();

        // 2. Đếm số đơn theo từng trạng thái
        const pendingBookings = await Booking.countDocuments({ status: 'PENDING' });
        const confirmedBookings = await Booking.countDocuments({ status: 'CONFIRMED' });
        const completedBookings = await Booking.countDocuments({ status: 'COMPLETED' });
        const cancelledBookings = await Booking.countDocuments({ status: 'CANCELLED' });

        // 3. Tính tổng doanh thu từ các đơn CONFIRMED và COMPLETED
        const revenueData = await Booking.aggregate([
            { $match: { paymentStatus: 'PAID', status: { $ne: 'CANCELLED' } } },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$totalPrice' },
                },
            },
        ]);

        const totalRevenue = revenueData.length > 0 ? revenueData[0].totalRevenue : 0;

        res.json({
            success: true,
            data: {
                totalUsers,
                totalFields,
                totalBookings,
                bookingStats: {
                    pending: pendingBookings,
                    confirmed: confirmedBookings,
                    completed: completedBookings,
                    cancelled: cancelledBookings,
                },
                totalRevenue,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getAllBookings,
    confirmBooking,
    rejectBooking,
    completeBooking,
    completeRefund,
    getDashboardStats,
};