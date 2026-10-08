const cron = require('node-cron');
const Booking = require('../models/Booking');

const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};

// Hàm khởi tạo Cron Job
const initBookingCronJob = () => {
    // Lập lịch chạy mỗi 15 phút một lần: '*/15 * * * *'
    cron.schedule('*/15 * * * *', async () => {
        try {
            console.log('⏰ [CRON JOB] Đang kiểm tra các lịch đặt sân đã qua giờ đá...');

            // 1. Lấy thời gian hiện tại
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');

            const currentDateStr = `${year}-${month}-${day}`; // Dạng 'YYYY-MM-DD'
            const currentMinutes = now.getHours() * 60 + now.getMinutes(); // Số phút hiện tại trong ngày

            // 2. Tìm tất cả đơn CONFIRMED có ngày đặt nhỏ hơn hoặc bằng ngày hiện tại
            const confirmedBookings = await Booking.find({
                status: 'CONFIRMED',
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
    });
};

module.exports = initBookingCronJob;