// backend/seed.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

const User = require('./models/User');
const Field = require('./models/Field');
const TimeSlot = require('./models/TimeSlot');

dotenv.config();

const seedData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected for Seeding...');

        // 1. Xóa dữ liệu cũ
        await User.deleteMany();
        await Field.deleteMany();
        await TimeSlot.deleteMany();

        console.log('🧹 Đã xóa dữ liệu cũ...');

        // 2. Tạo tài khoản mẫu
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('123456', salt);

        const admin = await User.create({
            name: 'Quản Trị Viên',
            email: 'admin@gmail.com',
            password: hashedPassword,
            phone: '0909999999',
            role: 'ADMIN',
            status: 'ACTIVE'
        });

        const user = await User.create({
            name: 'Nguyễn Văn A',
            email: 'user@gmail.com',
            password: hashedPassword,
            phone: '0901234567',
            role: 'USER',
            status: 'ACTIVE'
        });

        console.log('✅ Đã tạo tài khoản Admin (admin@gmail.com / 123456) & User (user@gmail.com / 123456)');

        // 3. Tạo Sân Bóng Mẫu
        await Field.create([
            {
                name: 'Sân Bóng Cỏ Nhân Tạo A1',
                type: '5 người',
                address: '123 Đường Số 1, Quận 10, TP.HCM',
                description: 'Sân cỏ nhân tạo mềm, có mái che ban đêm, đèn LED cực sáng.',
                price: 200000,
                image: '/san5.jpg',
                status: 'AVAILABLE'
            },
            {
                name: 'Sân Bóng Đá Đại Dương B2',
                type: '7 người',
                address: '456 Đường Nguyễn Văn Linh, Quận 7, TP.HCM',
                description: 'Sân 7 chuẩn kích thước FIFA, không gian thoáng mát.',
                price: 350000,
                image: '/san7.jpg',
                status: 'AVAILABLE'
            },
            {
                name: 'Sân Vận Động Quốc Tế C3',
                type: '11 người',
                address: '789 Đường Lê Lợi, TP. Thủ Đức',
                description: 'Sân cỏ tự nhiên tiêu chuẩn thi đấu chuyên nghiệp.',
                price: 800000,
                image: '/san11.jpg',
                status: 'AVAILABLE'
            }
        ]);

        console.log('✅ Đã tạo 3 sân bóng mẫu');

        // 4. Tạo Mốc Giờ 30 phút
        const times = [];
        for (let h = 6; h <= 22; h++) {
            const startH = String(h).padStart(2, '0');
            times.push(`${startH}:00`);
            if (h < 22) times.push(`${startH}:30`);
        }

        for (const t of times) {
            await TimeSlot.create({ time: t, status: 'ACTIVE' });
        }

        console.log(`✅ Đã khởi tạo ${times.length} mốc giờ 30 phút thành công!`);
        console.log('🎉 KHỞI TẠO DỮ LIỆU MẪU HOÀN TẤT!');
        process.exit();
    } catch (error) {
        console.error('❌ Lỗi Seeding:', error.message);
        process.exit(1);
    }
};

seedData();