const express = require('express');
const router = express.Router();
const {
    getUserProfile,
    updateUserProfile,
    changePassword,
    deleteMyAccount,
    getUsers,
    getUserById,
    updateUser,
    deleteUser,
} = require('../controllers/userController');
const { protect, admin } = require('../middleware/authMiddleware');

// 1. Routes dành cho User đã đăng nhập (Cần Middleware 'protect')
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);
router.put('/change-password', protect, changePassword);
router.delete('/profile', protect, deleteMyAccount);

// 2. Routes dành cho Admin (Cần Middleware 'protect' + 'admin')
router.route('/')
    .get(protect, admin, getUsers);

router.route('/:id')
    .get(protect, admin, getUserById)
    .put(protect, admin, updateUser)
    .delete(protect, admin, deleteUser);

module.exports = router;