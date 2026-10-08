const express = require('express');
const router = express.Router();

// 1. Import các hàm từ Controller
const { 
    createBooking, 
    getBookedSlots, 
    checkPaymentStatus, 
    updatePaymentStatus, 
    handleSepayWebhook 
} = require('../controllers/bookingController');

// 2. Import Middleware xác thực
const { protect } = require('../middleware/authMiddleware');

// 3. Khai báo Routes
router.get('/booked-slots', getBookedSlots);
router.post('/webhook', handleSepayWebhook);

router.post('/', protect, createBooking);
router.get('/:id/payment-status', protect, checkPaymentStatus); // Dòng 16
router.put('/:id/payment', protect, updatePaymentStatus);

module.exports = router;