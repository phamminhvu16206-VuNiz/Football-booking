const express = require('express');
const router = express.Router();

// 1. Import các hàm từ Controller
const { 
    createBooking, 
    getMyBookings,
    getBookingById,
    getBookingPaymentInfo,
    cancelBooking,
    getBookedSlots, 
    checkPaymentStatus, 
    handleSepayWebhook 
} = require('../controllers/bookingController');

// 2. Import Middleware xác thực
const { protect } = require('../middleware/authMiddleware');

// 3. Khai báo Routes
router.get('/booked-slots', getBookedSlots);
router.post('/webhook', handleSepayWebhook);

router.post('/', protect, createBooking);
router.get('/my-bookings', protect, getMyBookings);
router.get('/:id/payment-status', protect, checkPaymentStatus);
router.get('/:id/payment-info', protect, getBookingPaymentInfo);
router.put('/:id/cancel', protect, cancelBooking);
router.get('/:id', protect, getBookingById);

module.exports = router;