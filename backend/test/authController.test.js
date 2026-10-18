const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { afterEach, beforeEach, test } = require('node:test');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const { requestPasswordReset, resetPassword } = require('../controllers/authController');

const mailEnvironment = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'FRONTEND_URL'];
const originalEnvironment = new Map();
const originalUserMethods = {};
let originalCreateTransport;
let sentMail;

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

beforeEach(() => {
    for (const key of mailEnvironment) {
        originalEnvironment.set(key, process.env[key]);
    }
    Object.assign(process.env, {
        SMTP_HOST: 'smtp.example.test',
        SMTP_PORT: '587',
        SMTP_USER: 'mailer@example.test',
        SMTP_PASS: 'test-password',
        SMTP_FROM: 'Football Booking <mailer@example.test>',
        FRONTEND_URL: 'http://localhost:4200',
    });

    originalUserMethods.findOne = User.findOne;
    originalUserMethods.findOneAndUpdate = User.findOneAndUpdate;
    originalCreateTransport = nodemailer.createTransport;
    sentMail = null;
    nodemailer.createTransport = () => ({
        sendMail: async (mail) => {
            sentMail = mail;
        },
    });
});

afterEach(() => {
    for (const key of mailEnvironment) {
        const value = originalEnvironment.get(key);
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }
    originalEnvironment.clear();
    User.findOne = originalUserMethods.findOne;
    User.findOneAndUpdate = originalUserMethods.findOneAndUpdate;
    nodemailer.createTransport = originalCreateTransport;
});

test('sends a reset link containing a one-time token and stores only its hash', async () => {
    const user = {
        email: 'player@example.test',
        save: async () => {},
    };
    User.findOne = async (query) => {
        assert.deepEqual(query, { email: 'player@example.test' });
        return user;
    };

    const response = createResponse();
    await requestPasswordReset({ body: { email: ' PLAYER@EXAMPLE.TEST ' } }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.success, true);
    assert.equal(sentMail.to, user.email);

    const resetUrl = new URL(sentMail.text.match(/https?:\/\/\S+/)[0]);
    const token = resetUrl.searchParams.get('token');
    assert.ok(token);
    assert.equal(user.passwordResetToken, crypto.createHash('sha256').update(token).digest('hex'));
    assert.ok(user.passwordResetExpires > new Date());
});

test('returns the same success response without sending mail for an unknown email', async () => {
    User.findOne = async () => null;
    const response = createResponse();

    await requestPasswordReset({ body: { email: 'unknown@example.test' } }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.success, true);
    assert.equal(sentMail, null);
});

test('clears the reset token and reports mail delivery failures', async () => {
    let saveCount = 0;
    const user = {
        email: 'player@example.test',
        save: async () => {
            saveCount += 1;
        },
    };
    User.findOne = async () => user;
    nodemailer.createTransport = () => ({
        sendMail: async () => {
            throw new Error('SMTP unavailable');
        },
    });
    const response = createResponse();

    await requestPasswordReset({ body: { email: user.email } }, response);

    assert.equal(response.statusCode, 503);
    assert.equal(user.passwordResetToken, undefined);
    assert.equal(user.passwordResetExpires, undefined);
    assert.equal(saveCount, 2);
});

test('resets the password once and invalidates existing sessions', async () => {
    const token = 'one-time-reset-token';
    let updateQuery;
    let updateOperation;
    User.findOneAndUpdate = async (query, update) => {
        updateQuery = query;
        updateOperation = update;
        return { _id: 'user-id' };
    };
    const response = createResponse();

    await resetPassword({ body: { token, password: 'new-password' } }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(updateQuery.passwordResetToken, crypto.createHash('sha256').update(token).digest('hex'));
    assert.ok(updateQuery.passwordResetExpires.$gt instanceof Date);
    assert.equal(await bcrypt.compare('new-password', updateOperation.$set.password), true);
    assert.deepEqual(updateOperation.$inc, { tokenVersion: 1 });
    assert.deepEqual(updateOperation.$unset, { passwordResetToken: 1, passwordResetExpires: 1 });
});

test('rejects a short password before attempting a database update', async () => {
    let updateCalled = false;
    User.findOneAndUpdate = async () => {
        updateCalled = true;
        return null;
    };
    const response = createResponse();

    await resetPassword({ body: { token: 'token', password: '123' } }, response);

    assert.equal(response.statusCode, 400);
    assert.equal(updateCalled, false);
});
