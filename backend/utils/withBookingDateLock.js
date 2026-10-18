const crypto = require('crypto');
const BookingLock = require('../models/BookingLock');

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const withBookingDateLock = async (fieldId, bookingDate, action) => {
    const lockId = `${fieldId}:${bookingDate}`;
    const token = crypto.randomUUID();
    const waitUntil = Date.now() + 5000;
    let acquired = false;

    while (!acquired && Date.now() < waitUntil) {
        const now = new Date();
        try {
            const lock = await BookingLock.findOneAndUpdate(
                {
                    _id: lockId,
                    $or: [
                        { leaseUntil: { $lte: now } },
                        { leaseUntil: { $exists: false } },
                    ],
                },
                {
                    $set: {
                        field: fieldId,
                        bookingDate,
                        token,
                        leaseUntil: new Date(now.getTime() + 30000),
                    },
                },
                { upsert: true, new: true }
            );
            acquired = lock.token === token;
        } catch (error) {
            if (error.code !== 11000) {
                throw error;
            }
            await delay(50);
        }
    }

    if (!acquired) {
        return { acquired: false };
    }

    try {
        return { acquired: true, value: await action() };
    } finally {
        await BookingLock.deleteOne({ _id: lockId, token });
    }
};

module.exports = withBookingDateLock;
