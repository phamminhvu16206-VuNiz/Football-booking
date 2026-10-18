const Booking = require('../models/Booking');
const Field = require('../models/Field');
const mongoose = require('mongoose');
const crypto = require('crypto');
const withBookingDateLock = require('../utils/withBookingDateLock');
const getBookingHoldMinutes = require('../utils/bookingHoldMinutes');

const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};

const isValidTime = (time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time);

const findOverlappingBooking = async (fieldId, bookingDate, startTime, endTime, excludedId) => {
    const now = new Date();
    const query = {
        field: fieldId,
        bookingDate,
        $or: [
            { paymentStatus: { $in: ['PAID', 'REFUND_PENDING'] } },
            { status: { $in: ['CONFIRMED', 'COMPLETED'] } },
            {
                status: 'PENDING',
                $or: [
                    {
                        paymentStatus: 'PENDING',
                        holdExpiresAt: { $gt: now },
                    },
                    {
                        paymentStatus: { $exists: false },
                        createdAt: { $gt: new Date(now.getTime() - getBookingHoldMinutes() * 60 * 1000) },
                    },
                ],
            },
        ],
        startTime: { $lt: endTime },
        endTime: { $gt: startTime },
    };

    if (excludedId) {
        query._id = { $ne: excludedId };
    }

    return Booking.findOne(query);
};

const getMyBookings = async (req, res) => {
    try {
        const now = new Date();
        const legacyHoldCutoff = new Date(now.getTime() - getBookingHoldMinutes() * 60 * 1000);
        await Booking.updateMany(
            {
                user: req.user._id,
                status: 'PENDING',
                paymentStatus: 'PENDING',
                $or: [
                    { holdExpiresAt: { $lte: now } },
                    {
                        holdExpiresAt: null,
                        createdAt: { $lte: legacyHoldCutoff },
                    },
                ],
            },
            { $set: { status: 'CANCELLED', holdExpiresAt: null } }
        );

        const bookings = await Booking.find({ user: req.user._id })
            .populate('field', 'name type address image')
            .sort({ createdAt: -1 });

        const responseBookings = bookings.map((booking) => {
            const data = booking.toObject();
            if (data.status === 'PENDING' && data.paymentStatus === 'PENDING' && !data.holdExpiresAt) {
                data.holdExpiresAt = new Date(data.createdAt.getTime() + getBookingHoldMinutes() * 60 * 1000);
            }
            return data;
        });

        res.json({ success: true, count: responseBookings.length, data: responseBookings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getBookingById = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Mã đơn đặt sân không hợp lệ' });
        }

        const booking = await Booking.findOne({ _id: req.params.id, user: req.user._id })
            .populate('field', 'name type address image');

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt sân' });
        }

        res.json({ success: true, data: booking });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getBookingPaymentInfo = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Mã đơn đặt sân không hợp lệ' });
        }

        const initialBooking = await Booking.findOne({ _id: req.params.id, user: req.user._id });
        if (!initialBooking) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt sân' });
        }

        const result = await withBookingDateLock(initialBooking.field, initialBooking.bookingDate, async () => {
            const booking = await Booking.findOne({ _id: req.params.id, user: req.user._id });
            if (!booking) {
                return { status: 404, message: 'Không tìm thấy đơn đặt sân' };
            }
            if (booking.status !== 'PENDING' || booking.paymentStatus !== 'PENDING') {
                return { status: 409, message: 'Đơn đặt sân không còn chờ thanh toán' };
            }

            const holdExpiresAt = booking.holdExpiresAt ||
                new Date(booking.createdAt.getTime() + getBookingHoldMinutes() * 60 * 1000);
            if (holdExpiresAt <= new Date()) {
                booking.status = 'CANCELLED';
                booking.holdExpiresAt = null;
                await booking.save();
                return { status: 410, message: 'Đơn đã hết thời hạn giữ chỗ và được tự động hủy' };
            }

            const paymentInstructions = {
                bankCode: process.env.PAYMENT_BANK_CODE,
                accountNumber: process.env.PAYMENT_BANK_ACCOUNT,
                accountName: process.env.PAYMENT_ACCOUNT_NAME,
            };
            if (!paymentInstructions.bankCode || !paymentInstructions.accountNumber || !paymentInstructions.accountName) {
                return { status: 503, message: 'Thông tin tài khoản nhận thanh toán chưa được cấu hình' };
            }

            return {
                status: 200,
                data: {
                    ...booking.toObject(),
                    holdExpiresAt,
                    paymentInstructions,
                },
            };
        });

        if (!result.acquired) {
            return res.status(409).json({ success: false, message: 'Đơn đang được xử lý; vui lòng thử lại' });
        }
        if (result.value.status !== 200) {
            return res.status(result.value.status).json({ success: false, message: result.value.message });
        }
        return res.json({ success: true, data: result.value.data });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const cancelBooking = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Mã đơn đặt sân không hợp lệ' });
        }

        const initialBooking = await Booking.findOne({ _id: req.params.id, user: req.user._id });
        if (!initialBooking) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt sân' });
        }

        const result = await withBookingDateLock(initialBooking.field, initialBooking.bookingDate, async () => {
            const booking = await Booking.findOne({ _id: req.params.id, user: req.user._id });
            if (!booking) {
                return { status: 404, message: 'Không tìm thấy đơn đặt sân' };
            }
            if (booking.status !== 'PENDING' || booking.paymentStatus !== 'PENDING') {
                return { status: 400, message: 'Chỉ có thể hủy đơn chưa thanh toán đang chờ xử lý' };
            }
            booking.status = 'CANCELLED';
            await booking.save();
            return { status: 200, booking };
        });

        if (!result.acquired) {
            return res.status(409).json({ success: false, message: 'Đang xử lý đặt sân này, vui lòng thử lại' });
        }
        if (result.value.status !== 200) {
            return res.status(result.value.status).json({ success: false, message: result.value.message });
        }
        res.json({ success: true, message: 'Đã hủy đơn đặt sân thành công', data: result.value.booking });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
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
            return res.status(400).json({ success: false, message: 'Mã sân không hợp lệ' });
        }

        // 3. Chuẩn hóa định dạng ngày (YYYY-MM-DD)
        const formattedDate = date.split('T')[0];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(formattedDate)) {
            return res.status(400).json({ success: false, message: 'Ngày không hợp lệ' });
        }
        const dateParts = formattedDate.split('-').map(Number);
        if (new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]))
            .toISOString().slice(0, 10) !== formattedDate) {
            return res.status(400).json({ success: false, message: 'Ngày không hợp lệ' });
        }

        const now = new Date();
        const paidBookings = await Booking.find({
            field: fieldId,
            bookingDate: formattedDate,
            $or: [
                { paymentStatus: { $in: ['PAID', 'REFUND_PENDING'] } },
                { status: { $in: ['CONFIRMED', 'COMPLETED'] } },
                {
                    status: 'PENDING',
                    $or: [
                        {
                            paymentStatus: 'PENDING',
                            holdExpiresAt: { $gt: now },
                        },
                        {
                            paymentStatus: { $exists: false },
                            createdAt: { $gt: new Date(now.getTime() - getBookingHoldMinutes() * 60 * 1000) },
                        },
                    ],
                },
            ],
        }).select('startTime endTime');

        return res.json({
            success: true,
            data: paidBookings || []
        });
    } catch (error) {
        console.error('Lỗi lấy booked-slots:', error);
        return res.status(500).json({ success: false, message: 'Không thể tải khung giờ đã đặt' });
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
        if (paymentMethod && paymentMethod !== 'BANK_TRANSFER') {
            return res.status(400).json({ success: false, message: 'Phương thức thanh toán không được hỗ trợ' });
        }

        if (!isValidTime(startTime) || !isValidTime(endTime)) {
            return res.status(400).json({ success: false, message: 'Định dạng giờ không hợp lệ' });
        }

        const startMins = timeToMinutes(startTime);
        const endMins = timeToMinutes(endTime);

        if (endMins <= startMins || startMins < 360 || endMins > 1410 ||
            startMins % 30 !== 0 || endMins % 30 !== 0) {
            return res.status(400).json({ success: false, message: 'Khung giờ phải theo mốc 30 phút trong khoảng 06:00-23:30' });
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) {
            return res.status(400).json({ success: false, message: 'Ngày đặt sân không hợp lệ' });
        }
        const dateParts = bookingDate.split('-').map(Number);
        const parsedDate = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
        if (parsedDate.toISOString().slice(0, 10) !== bookingDate) {
            return res.status(400).json({ success: false, message: 'Ngày đặt sân không hợp lệ' });
        }

        const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
        if (bookingDate < today) {
            return res.status(400).json({ success: false, message: 'Không thể đặt sân cho ngày đã qua' });
        }
        if (bookingDate === today) {
            const currentTimeParts = new Intl.DateTimeFormat('en-GB', {
                timeZone: 'Asia/Ho_Chi_Minh',
                hour: '2-digit',
                minute: '2-digit',
                hourCycle: 'h23',
            }).formatToParts(new Date());
            const currentHour = Number(currentTimeParts.find((part) => part.type === 'hour').value);
            const currentMinute = Number(currentTimeParts.find((part) => part.type === 'minute').value);
            if (startMins <= currentHour * 60 + currentMinute) {
                return res.status(400).json({ success: false, message: 'Không thể đặt khung giờ đã bắt đầu' });
            }
        }

        if (!mongoose.Types.ObjectId.isValid(fieldId)) {
            return res.status(400).json({ success: false, message: 'Mã sân không hợp lệ' });
        }
        const paymentInstructions = {
            bankCode: process.env.PAYMENT_BANK_CODE,
            accountNumber: process.env.PAYMENT_BANK_ACCOUNT,
            accountName: process.env.PAYMENT_ACCOUNT_NAME,
        };
        if (!paymentInstructions.bankCode || !paymentInstructions.accountNumber || !paymentInstructions.accountName) {
            return res.status(503).json({ success: false, message: 'Thông tin tài khoản nhận thanh toán chưa được cấu hình' });
        }

        const field = await Field.findById(fieldId);
        if (!field || field.status === 'MAINTENANCE') {
            return res.status(400).json({ success: false, message: 'Sân bóng không khả dụng' });
        }

        const result = await withBookingDateLock(fieldId, bookingDate, async () => {
            const conflict = await findOverlappingBooking(fieldId, bookingDate, startTime, endTime);
            if (conflict) {
                return { conflict: true };
            }

            const holdExpiresAt = new Date(Date.now() + getBookingHoldMinutes() * 60 * 1000);
            const duration = endMins - startMins;
            const booking = await Booking.create({
                user: req.user._id,
                field: fieldId,
                bookingDate,
                startTime,
                endTime,
                duration,
                pricePerHour: field.price,
                totalPrice: Math.round((field.price / 60) * duration),
                note,
                paymentMethod: paymentMethod || 'BANK_TRANSFER',
                paymentStatus: 'PENDING',
                status: 'PENDING',
                holdExpiresAt,
            });
            return { booking };
        });

        if (!result.acquired) {
            return res.status(409).json({ success: false, message: 'Đang có lượt đặt cùng ngày được xử lý; vui lòng thử lại' });
        }
        if (result.value.conflict) {
            return res.status(409).json({
                success: false,
                message: 'Khung giờ đã được đặt hoặc đang được giữ chỗ để thanh toán.',
            });
        }

        const populatedBooking = await Booking.findById(result.value.booking._id)
            .populate('user', 'name email phone')
            .populate('field', 'name type address price');

        res.status(201).json({
            success: true,
            message: 'Tạo đơn đặt sân thành công. Vui lòng thanh toán trước thời hạn giữ chỗ!',
            data: {
                ...populatedBooking.toObject(),
                paymentInstructions,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const checkPaymentStatus = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Mã đơn đặt sân không hợp lệ' });
        }

        const initialBooking = await Booking.findOne({ _id: req.params.id, user: req.user._id });
        if (!initialBooking) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt sân' });

        let booking = initialBooking;
        if (booking.status === 'PENDING' && booking.paymentStatus === 'PENDING' &&
            booking.holdExpiresAt && booking.holdExpiresAt <= new Date()) {
            const result = await withBookingDateLock(booking.field, booking.bookingDate, async () => {
                booking = await Booking.findOne({ _id: req.params.id, user: req.user._id });
                if (booking && booking.status === 'PENDING' && booking.paymentStatus === 'PENDING' &&
                    booking.holdExpiresAt && booking.holdExpiresAt <= new Date()) {
                    booking.status = 'CANCELLED';
                    booking.holdExpiresAt = null;
                    await booking.save();
                }
            });
            if (!result.acquired) {
                return res.status(503).json({ success: false, message: 'Không thể kiểm tra thời hạn giữ chỗ' });
            }
        }
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt sân' });
        }

        res.json({
            success: true,
            paymentStatus: booking.paymentStatus,
            status: booking.status,
            holdExpiresAt: booking.holdExpiresAt,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const handleSepayWebhook = async (req, res) => {
    try {
        const apiKey = process.env.SEPAY_WEBHOOK_API_KEY;
        if (!apiKey) {
            return res.status(503).json({ success: false, message: 'Webhook thanh toán chưa được cấu hình' });
        }

        const authorization = req.get('Authorization') || '';
        const providedKey = authorization.startsWith('Apikey ') ? authorization.slice(7) : '';
        const expectedBuffer = Buffer.from(apiKey);
        const providedBuffer = Buffer.from(providedKey);
        if (expectedBuffer.length !== providedBuffer.length ||
            !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
            return res.status(401).json({ success: false, message: 'Webhook không được xác thực' });
        }

        const { content, transferAmount, transferType, id: transactionId } = req.body;
        if (transferType !== 'in' || transactionId === undefined || transactionId === null ||
            !/^\d+$/.test(String(transactionId))) {
            return res.status(400).json({ success: false, message: 'Giao dịch webhook không hợp lệ' });
        }
        const match = content && content.match(/DATSAN\s+([a-fA-Z0-9]+)/i);

        if (!match) return res.status(400).json({ success: false, message: 'Nội dung chuyển khoản không hợp lệ' });

        const bookingId = match[1];
        if (!mongoose.Types.ObjectId.isValid(bookingId)) {
            return res.status(400).json({ success: false, message: 'Mã đơn đặt sân không hợp lệ' });
        }

        const receivedAmount = Number(transferAmount);
        if (!Number.isFinite(receivedAmount) || receivedAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Số tiền chuyển khoản không hợp lệ' });
        }

        const previousTransaction = await Booking.findOne({ sepayTransactionId: String(transactionId) });
        if (previousTransaction) {
            return res.status(200).json({ success: true, message: 'Giao dịch đã được xử lý trước đó' });
        }

        const initialBooking = await Booking.findById(bookingId);
        if (!initialBooking) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt sân' });
        }

        const result = await withBookingDateLock(initialBooking.field, initialBooking.bookingDate, async () => {
            const booking = await Booking.findById(bookingId);
            if (!booking) {
                return { status: 404, message: 'Không tìm thấy đơn đặt sân' };
            }
            if (booking.paymentStatus === 'PAID' || booking.sepayTransactionId) {
                return { status: 200, success: true, message: 'Đơn đã được thanh toán trước đó' };
            }
            if (receivedAmount < booking.totalPrice) {
                return { status: 400, message: 'Số tiền chuyển khoản chưa đủ' };
            }

            booking.sepayTransactionId = String(transactionId);
            booking.paymentMethod = 'BANK_TRANSFER';
            if (booking.status !== 'PENDING' || booking.paymentStatus !== 'PENDING' ||
                !booking.holdExpiresAt || booking.holdExpiresAt <= new Date()) {
                booking.status = 'CANCELLED';
                booking.paymentStatus = 'REFUND_PENDING';
                booking.paymentAmount = receivedAmount;
                booking.holdExpiresAt = null;
                await booking.save();
                return { status: 200, success: true, message: 'Thanh toán đến sau khi giữ chỗ hết hạn; cần hoàn tiền' };
            }

            const conflict = await findOverlappingBooking(
                booking.field,
                booking.bookingDate,
                booking.startTime,
                booking.endTime,
                booking._id
            );
            if (conflict) {
                booking.status = 'CANCELLED';
                booking.paymentStatus = 'REFUND_PENDING';
                booking.paymentAmount = receivedAmount;
                booking.holdExpiresAt = null;
                await booking.save();
                return { status: 200, success: true, message: 'Khung giờ đã được nhận; giao dịch cần hoàn tiền' };
            }

            if (receivedAmount > booking.totalPrice) {
                booking.status = 'CANCELLED';
                booking.paymentStatus = 'REFUND_PENDING';
                booking.paymentAmount = receivedAmount;
                booking.holdExpiresAt = null;
                await booking.save();
                return { status: 200, success: true, message: 'Đã nhận thừa tiền; giao dịch cần hoàn tiền' };
            }

            booking.paymentAmount = receivedAmount;
            booking.paymentStatus = 'PAID';
            booking.status = 'CONFIRMED';
            booking.holdExpiresAt = null;
            await booking.save();
            return { status: 200, success: true, message: 'Thanh toán thành công' };
        });

        if (!result.acquired) {
            return res.status(503).json({ success: false, message: 'Không thể khóa lịch đặt sân; vui lòng thử lại' });
        }
        return res.status(result.value.status).json({
            success: result.value.success === true,
            message: result.value.message,
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(200).json({ success: true, message: 'Giao dịch đã được xử lý trước đó' });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createBooking,
    getMyBookings,
    getBookingById,
    getBookingPaymentInfo,
    cancelBooking,
    getBookedSlots,
    checkPaymentStatus,
    handleSepayWebhook
};