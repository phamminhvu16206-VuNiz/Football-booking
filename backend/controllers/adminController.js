const Booking = require('../models/Booking');
const Field = require('../models/Field');
const User = require('../models/User');

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

        if (booking.status !== 'PENDING') {
            return res.status(400).json({
                success: false,
                message: `Đơn đặt sân hiện đang ở trạng thái ${booking.status}, không thể xác nhận`,
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
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt sân' });
        }

        if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') {
            return res.status(400).json({
                success: false,
                message: 'Không thể hủy/từ chối đơn ở trạng thái này',
            });
        }

        booking.status = 'CANCELLED';
        if (req.body.note) {
            booking.note = `[Admin Từ chối]: ${req.body.note}`;
        }
        await booking.save();

        res.json({
            success: true,
            message: 'Đã từ chối/hủy đơn đặt sân',
            data: booking,
        });
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
            {
                $match: { status: { $in: ['CONFIRMED', 'COMPLETED'] } },
            },
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
    getDashboardStats,
};