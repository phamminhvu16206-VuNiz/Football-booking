const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db.js');

// Import routes
const userRoutes = require('./routes/userRoutes.js');
const authRoutes = require('./routes/authRoutes.js');
const fieldRoutes = require('./routes/fieldRoutes.js');
const timeSlotRoutes = require('./routes/timeSlotRoutes.js');
const bookingRoutes = require('./routes/bookingRoutes.js');
const adminRoutes = require('./routes/adminRoutes.js');

// Cron Job Import
const initBookingCronJob = require('./jobs/bookingJob');

dotenv.config();
require('./utils/bookingHoldMinutes')();
connectDB();

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Nạp routes
app.use('/api/fields', fieldRoutes);
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/timeslots', timeSlotRoutes);
app.use('/api/admin', adminRoutes);

// Khởi tạo Cron Job
initBookingCronJob();

app.get('/', (req, res) => {
  res.send('API Quản lý sân bóng đá đang hoạt động...');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server đang chạy ở chế độ ${process.env.NODE_ENV} tại cổng ${PORT}`);
});