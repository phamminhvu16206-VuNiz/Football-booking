const mongoose = require('mongoose');

// Hàm kết nối CSDL MongoDB
const connectDB = async () => {
  try {
    // Kết nối tới MongoDB thông qua chuỗi MONGO_URI từ file .env
    const conn = await mongoose.connect(process.env.MONGO_URI);
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Lỗi kết nối MongoDB: ${error.message}`);
    // Thoát chương trình với mã lỗi (1) nếu không thể kết nối DB
    process.exit(1);
  }
};

module.exports = connectDB;