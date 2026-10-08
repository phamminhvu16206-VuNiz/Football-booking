const Field = require('../models/Field');

const getFields = async (req, res) => {
    try {
        const { keyword, type, status, page = 1, limit = 10 } = req.query;
        let query = {};

        if (keyword) {
            query.name = { $regex: keyword, $options: 'i' };
        }

        if (type) {
            query.type = type;
        }

        if (status) {
            query.status = status;
        }

        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;

        const totalFields = await Field.countDocuments(query);
        const fields = await Field.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        res.json({
            success: true,
            count: fields.length,
            pagination: {
                total: totalFields,
                page: pageNum,
                pages: Math.ceil(totalFields / limitNum),
            },
            data: fields,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Lấy chi tiết 1 sân bóng
// @route   GET /api/fields/:id
// @access  Public
const getFieldById = async (req, res) => {
    try {
        const field = await Field.findById(req.params.id);

        if (!field) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy sân bóng' });
        }

        res.json({ success: true, data: field });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Tạo sân bóng mới (Admin)
// @route   POST /api/fields
// @access  Private/Admin
const createField = async (req, res) => {
    try {
        const { name, type, address, description, price, image, status } = req.body;

        // Validate dữ liệu bắt buộc
        if (!name || !type || !address || price === undefined) {
            return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ tên sân, loại sân, địa chỉ và giá thuê' });
        }

        if (price < 0) {
            return res.status(400).json({ success: false, message: 'Giá thuê sân không được nhỏ hơn 0' });
        }

        const field = await Field.create({
            name,
            type,
            address,
            description,
            price,
            image,
            status,
        });

        res.status(201).json({
            success: true,
            message: 'Tạo sân bóng thành công',
            data: field,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Cập nhật thông tin sân bóng (Admin)
// @route   PUT /api/fields/:id
// @access  Private/Admin
const updateField = async (req, res) => {
    try {
        const field = await Field.findById(req.params.id);

        if (!field) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy sân bóng' });
        }

        // Cập nhật thông tin mới nếu có gửi lên, không thì giữ nguyên
        field.name = req.body.name || field.name;
        field.type = req.body.type || field.type;
        field.address = req.body.address || field.address;
        field.description = req.body.description !== undefined ? req.body.description : field.description;
        field.price = req.body.price !== undefined ? req.body.price : field.price;
        field.image = req.body.image || field.image;
        field.status = req.body.status || field.status;

        const updatedField = await field.save();

        res.json({
            success: true,
            message: 'Cập nhật thông tin sân bóng thành công',
            data: updatedField,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Xóa sân bóng (Admin)
// @route   DELETE /api/fields/:id
// @access  Private/Admin
const deleteField = async (req, res) => {
    try {
        const field = await Field.findById(req.params.id);

        if (!field) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy sân bóng' });
        }

        await Field.findByIdAndDelete(req.params.id);

        res.json({ success: true, message: 'Xóa sân bóng thành công' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getFields,
    getFieldById,
    createField,
    updateField,
    deleteField,
};