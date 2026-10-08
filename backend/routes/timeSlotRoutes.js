const express = require('express');
const router = express.Router();
const {
    getTimeSlots,
    generateSlots,
} = require('../controllers/timeSlotController');
const { protect, admin } = require('../middleware/authMiddleware');

// Route lấy danh sách mốc giờ
router.get('/', getTimeSlots);

// Route tự động sinh mốc giờ 30p (Chỉ Admin)
router.post('/generate', protect, admin, generateSlots);

module.exports = router;