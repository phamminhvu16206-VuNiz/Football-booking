const express = require('express');
const router = express.Router();
const {
    getFields,
    getFieldById,
    createField,
    updateField,
    deleteField,
} = require('../controllers/fieldController');
const { protect, admin } = require('../middleware/authMiddleware');

// Route công khai (Public) & Route Admin cho danh sách
router.route('/')
    .get(getFields)                  // Ai cũng có thể xem danh sách sân
    .post(protect, admin, createField); // Chỉ Admin được tạo sân mới

// Route theo ID
router.route('/:id')
    .get(getFieldById)               // Ai cũng có thể xem chi tiết 1 sân
    .put(protect, admin, updateField)  // Chỉ Admin được sửa thông tin sân
    .delete(protect, admin, deleteField); // Chỉ Admin được xóa sân

module.exports = router;