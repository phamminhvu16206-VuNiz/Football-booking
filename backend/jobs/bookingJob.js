const cron = require('node-cron');
const Booking = require('../models/Booking');
const getBookingHoldMinutes = require('../utils/bookingHoldMinutes');

const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};

// Hàm khởi tạo Cron Job
const initBookingCronJob = () => {
    cron.schedule('* * * * *', async () => {
        try {
            const now = new Date();
            const legacyHoldCutoff = new Date(now.getTime() - getBookingHoldMinutes() * 60 * 1000);
            const expiredHolds = await Booking.updateMany(
                {
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
                {
                    $set: {
                        status: 'CANCELLED',
                        holdExpiresAt: null,
                    },
                }
            );
            if (expiredHolds.modifiedCount > 0) {
                console.log(`Đã tự hủy ${expiredHolds.modifiedCount} đơn hết hạn giữ chỗ.`);
            }
        } catch (error) {
            console.error('[CRON JOB ERROR - EXPIRED HOLDS]:', error.message);
        }
    });

    cron.schedule('*/15 * * * *', async () => {
        try {
            console.log('⏰ [CRON JOB] Đang kiểm tra các lịch đặt sân đã qua giờ đá...');
            // 1. Lấy thời gian hiện tại
            const now = new Date();
            const currentDateStr = new Intl.DateTimeFormat('sv-SE', {
                timeZone: 'Asia/Ho_Chi_Minh',
            }).format(now);
            const timeParts = new Intl.DateTimeFormat('en-GB', {
                timeZone: 'Asia/Ho_Chi_Minh',
                hour: '2-digit',
                minute: '2-digit',
                hourCycle: 'h23',
            }).formatToParts(now);
            const currentHour = Number(timeParts.find((part) => part.type === 'hour').value);
            const currentMinute = Number(timeParts.find((part) => part.type === 'minute').value);
            const currentMinutes = currentHour * 60 + currentMinute;

            // 2. Tìm tất cả đơn CONFIRMED có ngày đặt nhỏ hơn hoặc bằng ngày hiện tại
            const confirmedBookings = await Booking.find({
                status: 'CONFIRMED',
                paymentStatus: 'PAID',
                bookingDate: { $lte: currentDateStr },
            });

            let updatedCount = 0;

            for (const booking of confirmedBookings) {
                const bookingEndMins = timeToMinutes(booking.endTime);

                // Trường hợp 1: Ngày đặt nằm ở quá khứ (< ngày hiện tại) -> Chắc chắn đã qua
                // Trường hợp 2: Ngày đặt là hôm nay VÀ giờ kết thúc < giờ hiện tại
                if (
                    booking.bookingDate < currentDateStr ||
                    (booking.bookingDate === currentDateStr && bookingEndMins <= currentMinutes)
                ) {
                    booking.status = 'COMPLETED';
                    await booking.save();
                    updatedCount++;
                }
            }

            if (updatedCount > 0) {
                console.log(`✅ [CRON JOB] Đã tự động chuyển ${updatedCount} lịch đặt sân sang COMPLETED.`);
            } else {
                console.log('ℹ️ [CRON JOB] Không có lịch đặt nào cần cập nhật.');
            }
        } catch (error) {
            console.error('❌ [CRON JOB ERROR]:', error.message);
        }
    }, { timezone: 'Asia/Ho_Chi_Minh' });
};

module.exports = initBookingCronJob;