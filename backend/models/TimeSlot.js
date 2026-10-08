const mongoose = require('mongoose');

const timeSlotSchema = new mongoose.Schema(
    {
        time: {
            type: String, 
            required: true,
            unique: true,
        },
        status: {
            type: String,
            enum: ['ACTIVE', 'INACTIVE'],
            default: 'ACTIVE',
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('TimeSlot', timeSlotSchema);