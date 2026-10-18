const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Field = require('./models/Field');

dotenv.config({ path: require('path').join(__dirname, '.env') });

const fieldImages = {
    '5 người': '/san5.jpg',
    '7 người': '/san7.jpg',
    '11 người': '/san11.jpg',
};

const additionalFields = [
    {
        name: 'Sân Mini Thống Nhất',
        type: '5 người',
        address: '12 Lữ Gia, Phường 15, Quận 11, TP.HCM',
        description: 'Sân cỏ nhân tạo bằng phẳng, có khu vực nghỉ cho đội bóng.',
        price: 220000,
        image: fieldImages['5 người'],
        status: 'AVAILABLE',
    },
    {
        name: 'Sân Cỏ Xanh Tân Bình',
        type: '5 người',
        address: '88 Cộng Hòa, Phường 4, Quận Tân Bình, TP.HCM',
        description: 'Sân mini gần khu trung tâm, trang bị đèn chiếu sáng buổi tối.',
        price: 240000,
        image: fieldImages['5 người'],
        status: 'AVAILABLE',
    },
    {
        name: 'Sân Phú Nhuận FC',
        type: '5 người',
        address: '35 Phan Đình Phùng, Phường 17, Quận Phú Nhuận, TP.HCM',
        description: 'Không gian thân thiện, phù hợp cho các trận bóng giao hữu.',
        price: 230000,
        image: fieldImages['5 người'],
        status: 'AVAILABLE',
    },
    {
        name: 'Sân Mini Bình Thạnh',
        type: '5 người',
        address: '210 Nơ Trang Long, Phường 12, Quận Bình Thạnh, TP.HCM',
        description: 'Mặt sân cỏ nhân tạo thoát nước tốt, có bãi giữ xe gần sân.',
        price: 260000,
        image: fieldImages['5 người'],
        status: 'AVAILABLE',
    },
    {
        name: 'Sân Chợ Lớn Mini',
        type: '5 người',
        address: '75 Hồng Bàng, Phường 12, Quận 5, TP.HCM',
        description: 'Sân mini thoáng, khung giờ linh hoạt cho các đội bóng phong trào.',
        price: 210000,
        image: fieldImages['5 người'],
        status: 'AVAILABLE',
    },
    {
        name: 'Sân 7 Nhà Bè',
        type: '7 người',
        address: '18 Huỳnh Tấn Phát, Thị trấn Nhà Bè, TP.HCM',
        description: 'Sân 7 người rộng rãi, khuôn viên xanh và có chỗ gửi xe.',
        price: 390000,
        image: fieldImages['7 người'],
        status: 'AVAILABLE',
    },
    {
        name: 'Sân Gia Định 7',
        type: '7 người',
        address: '144 Phan Văn Trị, Phường 12, Quận Bình Thạnh, TP.HCM',
        description: 'Mặt cỏ êm, hệ thống chiếu sáng phù hợp cho các trận đấu buổi tối.',
        price: 380000,
        image: fieldImages['7 người'],
        status: 'AVAILABLE',
    },
    {
        name: 'Sân Rạch Chiếc 7',
        type: '7 người',
        address: '2 Xa lộ Hà Nội, Phường An Phú, TP. Thủ Đức, TP.HCM',
        description: 'Sân 7 tiêu chuẩn phong trào, dễ di chuyển từ khu vực phía Đông.',
        price: 420000,
        image: fieldImages['7 người'],
        status: 'AVAILABLE',
    },
    {
        name: 'Sân An Phú Riverside',
        type: '7 người',
        address: '66 Nguyễn Hoàng, Phường An Phú, TP. Thủ Đức, TP.HCM',
        description: 'Sân bóng thoáng mát, mặt cỏ được chăm sóc và vệ sinh thường xuyên.',
        price: 450000,
        image: fieldImages['7 người'],
        status: 'AVAILABLE',
    },
    {
        name: 'Sân 7 Quận 8',
        type: '7 người',
        address: '320 Tạ Quang Bửu, Phường 5, Quận 8, TP.HCM',
        description: 'Sân 7 gần khu dân cư, có khu vực thay đồ và nghỉ ngơi.',
        price: 360000,
        image: fieldImages['7 người'],
        status: 'AVAILABLE',
    },
    {
        name: 'Sân Tân Sơn Nhất 11',
        type: '11 người',
        address: '6 Tân Sơn, Phường 12, Quận Gò Vấp, TP.HCM',
        description: 'Sân 11 người với mặt cỏ rộng, phù hợp thi đấu và tập luyện theo đội.',
        price: 950000,
        image: fieldImages['11 người'],
        status: 'AVAILABLE',
    },
    {
        name: 'Sân Cát Lái 11',
        type: '11 người',
        address: '25 Nguyễn Thị Định, Phường Cát Lái, TP. Thủ Đức, TP.HCM',
        description: 'Khu sân rộng, không gian thoáng và có hệ thống đèn chiếu sáng.',
        price: 1100000,
        image: fieldImages['11 người'],
        status: 'AVAILABLE',
    },
    {
        name: 'Sân Bóng Quận 12',
        type: '11 người',
        address: '50 Nguyễn Ảnh Thủ, Phường Hiệp Thành, Quận 12, TP.HCM',
        description: 'Sân cỏ tự nhiên rộng rãi, thích hợp tổ chức trận đấu giao hữu.',
        price: 850000,
        image: fieldImages['11 người'],
        status: 'AVAILABLE',
    },
    {
        name: 'Sân Bình Chánh 11',
        type: '11 người',
        address: '100 Nguyễn Văn Linh, Xã Bình Hưng, Huyện Bình Chánh, TP.HCM',
        description: 'Sân 11 người ở khu vực phía Nam, có bãi đỗ xe cạnh sân.',
        price: 900000,
        image: fieldImages['11 người'],
        status: 'AVAILABLE',
    },
    {
        name: 'Sân Thống Nhất 11',
        type: '11 người',
        address: '138 Đào Duy Từ, Phường 6, Quận 10, TP.HCM',
        description: 'Sân bóng quy mô lớn, phù hợp cho giải đấu nội bộ và luyện tập.',
        price: 1200000,
        image: fieldImages['11 người'],
        status: 'AVAILABLE',
    },
];

const seedAdditionalFields = async () => {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI chưa được cấu hình trong backend/.env');
        }

        await mongoose.connect(process.env.MONGO_URI);

        for (const [type, image] of Object.entries(fieldImages)) {
            await Field.updateMany({ type }, { $set: { image } });
        }

        const results = await Promise.all(additionalFields.map((field) =>
            Field.updateOne(
                { name: field.name, type: field.type },
                {
                    $set: { image: field.image },
                    $setOnInsert: Object.fromEntries(
                        Object.entries(field).filter(([key]) => key !== 'image')
                    ),
                },
                { upsert: true }
            )
        ));

        const insertedCount = results.reduce((total, result) => total + result.upsertedCount, 0);
        console.log(`Đã thêm ${insertedCount} sân mới; ${additionalFields.length - insertedCount} sân đã tồn tại.`);
        for (const type of ['5 người', '7 người', '11 người']) {
            const typeCount = results.filter((_, index) => additionalFields[index].type === type)
                .reduce((total, result) => total + result.upsertedCount, 0);
            console.log(`${type}: ${typeCount}/5 sân mới được thêm.`);
        }
    } catch (error) {
        console.error('Không thể thêm dữ liệu sân mẫu:', error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
};

seedAdditionalFields();
