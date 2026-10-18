const mongoose = require('mongoose');

const bookingLockSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            required: true,
        },
        field: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Field',
            required: true,
        },
        bookingDate: {
            type: String,
            required: true,
        },
        token: {
            type: String,
            required: true,
        },
        leaseUntil: {
            type: Date,
            required: true,
        },
    },
    { versionKey: false }
);

module.exports = mongoose.model('BookingLock', bookingLockSchema);
