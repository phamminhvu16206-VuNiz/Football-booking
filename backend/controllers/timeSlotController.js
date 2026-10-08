const TimeSlot = require('../models/TimeSlot');

const generate30MinTimes = (startHour = 6, endHour = 22) => {
    const times = [];
    let currentMinutes = startHour * 60;
    const endMinutesLimit = endHour * 60;

    while (currentMinutes <= endMinutesLimit) {
        const h = String(Math.floor(currentMinutes / 60)).padStart(2, '0');
        const m = String(currentMinutes % 60).padStart(2, '0');
        times.push(`${h}:${m}`);
        currentMinutes += 30;
    }

    return times;
};

// @desc    Lấy danh sách mốc giờ
// @route   GET /api/timeslots
// @access  Public
const getTimeSlots = async (req, res) => {
    try {
        const filter = req.query.status ? { status: req.query.status } : {};
        const timeSlots = await TimeSlot.find(filter).sort({ time: 1 });

        res.json({
            success: true,
            count: timeSlots.length,
            data: timeSlots,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Tự động khởi tạo mốc giờ từ 06:00 đến 22:00 (cách nhau 30p)
// @route   POST /api/timeslots/generate
// @access  Private/Admin
const generateSlots = async (req, res) => {
    try {
        const defaultTimes = generate30MinTimes(6, 22);

        for (const timeStr of defaultTimes) {
            await TimeSlot.updateOne(
                { time: timeStr },
                { $setOnInsert: { time: timeStr, status: 'ACTIVE' } },
                { upsert: true }
            );
        }

        const allSlots = await TimeSlot.find().sort({ time: 1 });

        res.status(201).json({
            success: true,
            message: 'Khởi tạo các mốc giờ 30 phút thành công',
            count: allSlots.length,
            data: allSlots,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getTimeSlots,
    generateSlots,
};