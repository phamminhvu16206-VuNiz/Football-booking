# Football Booking backend setup

1. Copy `.env.example` to `.env` and fill in the MongoDB URI, a private JWT secret, SePay webhook API key, and the receiving bank/account/name used to generate the VietQR payment image.
2. Configure SePay to send **incoming transfers** to `POST /api/bookings/webhook` and select API Key authentication. SePay sends the key as `Authorization: Apikey <key>`.
3. Set `BOOKING_HOLD_MINUTES` to a whole number from 1 to 60. It defaults to 10 minutes. Customers can resume payment from booking history while a hold is active. Unpaid holds expire automatically and their time slots become available again.
4. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, and `FRONTEND_URL` to enable password-reset emails. Reset links expire after 60 minutes.

MongoDB is used to serialize booking and payment operations for the same field and date. All application instances must connect to the same database. A SePay transaction is recorded once; underpayments are rejected, and late, duplicate-slot, or excess payments are marked for manual refund handling.

When a paid booking is cancelled by an administrator, its payment status becomes `REFUND_PENDING` and the time slot remains unavailable. Process the refund through the bank/payment provider, then use the admin booking screen to record `REFUNDED`. The application records the refund state but does not initiate a bank transfer.

Run the backend unit tests with `npm test`. They cover password-reset email/token handling, booking holds, and SePay webhook validation using stubs; they do not send email or contact SePay.

To add the 15 additional sample fields (five each for 5-, 7-, and 11-a-side) without deleting existing users, bookings, or fields, configure `MONGO_URI` and run `npm run seed:fields`. The command is safe to rerun; it skips duplicate sample records and synchronizes each field type to its matching image in `frontend/public` (`san5.jpg`, `san7.jpg`, or `san11.jpg`).

The public fields endpoint supports `keyword`, `type`, `status`, `page`, `limit`, and `sort` query parameters. Set `sort=price_asc` or `sort=price_desc` to order matching fields by price; the default is newest first.
