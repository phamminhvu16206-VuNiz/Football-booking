const assert = require('node:assert/strict');
const { after, afterEach, beforeEach, test } = require('node:test');
const Booking = require('../models/Booking');
const Field = require('../models/Field');

const lockModulePath = require.resolve('../utils/withBookingDateLock');
const originalLockModule = require.cache[lockModulePath];
require.cache[lockModulePath] = {
    id: lockModulePath,
    filename: lockModulePath,
    loaded: true,
    exports: async (_fieldId, _bookingDate, action) => ({ acquired: true, value: await action() }),
};

const {
    createBooking,
    getBookingPaymentInfo,
    handleSepayWebhook,
} = require('../controllers/bookingController');

const fieldId = '64b000000000000000000001';
const bookingId = '64b000000000000000000002';
const userId = '64b000000000000000000003';
const originalEnvironment = new Map();
const originalBookingMethods = {};
const originalFieldFindById = Field.findById;

after(() => {
    if (originalLockModule) {
        require.cache[lockModulePath] = originalLockModule;
    } else {
        delete require.cache[lockModulePath];
    }
});

const createResponse = () => ({
    statusCode: 200,
    body: null,
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(body) {
        this.body = body;
        return this;
    },
});

const createPendingBooking = (overrides = {}) => ({
    _id: bookingId,
    field: fieldId,
    bookingDate: '2030-01-01',
    startTime: '06:30',
    endTime: '07:30',
    totalPrice: 1000,
    status: 'PENDING',
    paymentStatus: 'PENDING',
    holdExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    save: async () => {},
    ...overrides,
});

beforeEach(() => {
    for (const key of ['PAYMENT_BANK_CODE', 'PAYMENT_BANK_ACCOUNT', 'PAYMENT_ACCOUNT_NAME', 'BOOKING_HOLD_MINUTES', 'SEPAY_WEBHOOK_API_KEY']) {
        originalEnvironment.set(key, process.env[key]);
    }
    Object.assign(process.env, {
        PAYMENT_BANK_CODE: 'TESTBANK',
        PAYMENT_BANK_ACCOUNT: '1234567890',
        PAYMENT_ACCOUNT_NAME: 'FOOTBALL BOOKING',
        BOOKING_HOLD_MINUTES: '10',
        SEPAY_WEBHOOK_API_KEY: 'webhook-test-key',
    });

    originalBookingMethods.create = Booking.create;
    originalBookingMethods.findOne = Booking.findOne;
    originalBookingMethods.findById = Booking.findById;
    Field.findById = async () => ({ _id: fieldId, name: 'Test field', price: 60000 });
});

afterEach(() => {
    for (const [key, value] of originalEnvironment) {
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }
    originalEnvironment.clear();
    Booking.create = originalBookingMethods.create;
    Booking.findOne = originalBookingMethods.findOne;
    Booking.findById = originalBookingMethods.findById;
    Field.findById = originalFieldFindById;
});

test('creates a pending booking hold and returns configured payment instructions', async () => {
    let createdBooking;
    const populatedBooking = createPendingBooking();
    Booking.findOne = async () => null;
    Booking.create = async (data) => {
        createdBooking = data;
        return { _id: bookingId };
    };
    Booking.findById = () => ({
        populate() {
            return this;
        },
        toObject() {
            return populatedBooking;
        },
    });
    const response = createResponse();

    await createBooking({
        body: {
            fieldId,
            bookingDate: '2030-01-01',
            startTime: '06:30',
            endTime: '07:30',
            paymentMethod: 'BANK_TRANSFER',
        },
        user: { _id: userId },
    }, response);

    assert.equal(response.statusCode, 201);
    assert.equal(createdBooking.paymentStatus, 'PENDING');
    assert.equal(createdBooking.status, 'PENDING');
    assert.equal(createdBooking.totalPrice, 60000);
    assert.ok(createdBooking.holdExpiresAt instanceof Date);
    assert.equal(response.body.data.paymentInstructions.accountNumber, '1234567890');
});

test('returns payment details for an unpaid booking while its hold is active', async () => {
    const booking = createPendingBooking();
    booking.toObject = () => ({ ...booking });
    Booking.findOne = async () => booking;
    const response = createResponse();

    await getBookingPaymentInfo({
        params: { id: bookingId },
        user: { _id: userId },
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data._id, bookingId);
    assert.equal(response.body.data.paymentInstructions.accountNumber, '1234567890');
});

test('automatically cancels a booking when payment details are requested after its hold expires', async () => {
    const booking = createPendingBooking({ holdExpiresAt: new Date(Date.now() - 1000) });
    Booking.findOne = async () => booking;
    const response = createResponse();

    await getBookingPaymentInfo({
        params: { id: bookingId },
        user: { _id: userId },
    }, response);

    assert.equal(response.statusCode, 410);
    assert.equal(response.body.success, false);
    assert.equal(booking.status, 'CANCELLED');
    assert.equal(booking.holdExpiresAt, null);
});

test('rejects invalid 30-minute booking intervals before writing', async () => {
    let createCalled = false;
    Booking.create = async () => {
        createCalled = true;
    };
    const response = createResponse();

    await createBooking({
        body: {
            fieldId,
            bookingDate: '2030-01-01',
            startTime: '06:15',
            endTime: '07:00',
        },
        user: { _id: userId },
    }, response);

    assert.equal(response.statusCode, 400);
    assert.equal(createCalled, false);
});

test('confirms an authenticated exact-amount SePay transfer once', async () => {
    const booking = createPendingBooking();
    let saveCount = 0;
    booking.save = async () => {
        saveCount += 1;
    };
    Booking.findOne = async (query) => {
        if (query.sepayTransactionId) return null;
        return null;
    };
    Booking.findById = async () => booking;
    const response = createResponse();

    await handleSepayWebhook({
        get: () => 'Apikey webhook-test-key',
        body: {
            content: `DATSAN ${bookingId}`,
            transferAmount: 1000,
            transferType: 'in',
            id: 12345,
        },
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.success, true);
    assert.equal(booking.paymentStatus, 'PAID');
    assert.equal(booking.status, 'CONFIRMED');
    assert.equal(booking.sepayTransactionId, '12345');
    assert.equal(booking.holdExpiresAt, null);
    assert.equal(saveCount, 1);
});

test('rejects unauthorized webhook requests without reading or updating bookings', async () => {
    let bookingLookupCalled = false;
    Booking.findOne = async () => {
        bookingLookupCalled = true;
        return null;
    };
    const response = createResponse();

    await handleSepayWebhook({
        get: () => 'Apikey incorrect-key',
        body: {
            content: `DATSAN ${bookingId}`,
            transferAmount: 1000,
            transferType: 'in',
            id: 12346,
        },
    }, response);

    assert.equal(response.statusCode, 401);
    assert.equal(bookingLookupCalled, false);
});

test('rejects underpayments without marking the booking as paid', async () => {
    const booking = createPendingBooking();
    Booking.findOne = async () => null;
    Booking.findById = async () => booking;
    const response = createResponse();

    await handleSepayWebhook({
        get: () => 'Apikey webhook-test-key',
        body: {
            content: `DATSAN ${bookingId}`,
            transferAmount: 999,
            transferType: 'in',
            id: 12347,
        },
    }, response);

    assert.equal(response.statusCode, 400);
    assert.equal(booking.paymentStatus, 'PENDING');
    assert.equal(booking.sepayTransactionId, undefined);
});

test('marks excess transfers for manual refund instead of confirming the booking', async () => {
    const booking = createPendingBooking();
    Booking.findOne = async () => null;
    Booking.findById = async () => booking;
    const response = createResponse();

    await handleSepayWebhook({
        get: () => 'Apikey webhook-test-key',
        body: {
            content: `DATSAN ${bookingId}`,
            transferAmount: 1100,
            transferType: 'in',
            id: 12348,
        },
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(booking.paymentStatus, 'REFUND_PENDING');
    assert.equal(booking.status, 'CANCELLED');
    assert.equal(booking.paymentAmount, 1100);
});

test('acknowledges duplicate transaction IDs without reprocessing them', async () => {
    let bookingLookupCalled = false;
    Booking.findOne = async () => ({ _id: 'existing-booking' });
    Booking.findById = async () => {
        bookingLookupCalled = true;
        return null;
    };
    const response = createResponse();

    await handleSepayWebhook({
        get: () => 'Apikey webhook-test-key',
        body: {
            content: `DATSAN ${bookingId}`,
            transferAmount: 1000,
            transferType: 'in',
            id: 12345,
        },
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.success, true);
    assert.equal(bookingLookupCalled, false);
});
