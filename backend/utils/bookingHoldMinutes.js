const getBookingHoldMinutes = () => {
    const configured = process.env.BOOKING_HOLD_MINUTES;
    if (configured === undefined || configured === '') {
        return 10;
    }

    const minutes = Number(configured);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 60) {
        throw new Error('BOOKING_HOLD_MINUTES must be a whole number from 1 to 60');
    }
    return minutes;
};

module.exports = getBookingHoldMinutes;
