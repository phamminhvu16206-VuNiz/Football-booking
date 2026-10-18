const express = require('express');
const router = express.Router();
const {
    getAllBookings,
    confirmBooking,
    rejectBooking,
    completeBooking,
    completeRefund,
    getDashboardStats,
} = require('../controllers/adminController');
const { protect, admin } = require('../middleware/authMiddleware');

// Tất cả API trong file này đều bắt buộc là ADMIN (Yêu cầu qua protect & admin middleware)
router.use(protect, admin);

// API Thống kê tổng quan Dashboard
router.get('/dashboard-stats', getDashboardStats);

// API Quản lý danh sách Booking
router.get('/bookings', getAllBookings);
router.put('/bookings/:id/confirm', confirmBooking);
router.put('/bookings/:id/reject', rejectBooking);
router.put('/bookings/:id/complete', completeBooking);
router.put('/bookings/:id/refund-complete', completeRefund);

module.exports = router;