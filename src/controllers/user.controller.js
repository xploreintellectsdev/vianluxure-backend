const { pool } = require('../config/db');
const catchAsync = require('../utils/catchAsync');
const { errorRes, successRes } = require('../utils/response');
const emailService = require('../services/email.service');

const sendEmailChangeOtp = catchAsync(async (req, res) => {
    const userId = req.user?.user_id;
    if (!userId) {
        return errorRes(res, 'Unauthorized', 401);
    }
    const { email } = req.body;
    if (!email || !email.trim()) {
        return errorRes(res, 'New email address is required', 400);
    }
    const newEmail = email.trim().toLowerCase();

    // Check if new email already exists for another user
    const [existingEmail] = await pool.query(
        `SELECT user_id FROM users WHERE LOWER(TRIM(email)) = ? AND user_id != ?`,
        [newEmail, userId]
    );
    if (existingEmail.length > 0) {
        return errorRes(res, 'This email address is already associated with another account', 409);
    }

    // Generate 6-digit verification OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await pool.query('DELETE FROM email_otps WHERE LOWER(email) = ?', [newEmail]);
    await pool.query(
        'INSERT INTO email_otps (email, otp, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))',
        [newEmail, otp]
    );

    await emailService.sendVerificationOtpEmail({ name: req.user.name || 'Valued Customer', email: newEmail, otp });
    return successRes(res, 'Verification code sent to your new email address.');
});

const updateProfile = catchAsync(async (req, res) => {
    const userId = req.user?.user_id;
    if (!userId) {
        return errorRes(res, 'Unauthorized', 401);
    }

    const { firstName, lastName, mobile, profilePic, email, otp } = req.body;
    
    // Validate inputs if needed
    const name = `${firstName || ''} ${lastName || ''}`.trim();

    // Check if mobile is already taken by another user
    if (mobile) {
        const [existing] = await pool.query(
            `SELECT user_id FROM users WHERE mobile = ? AND user_id != ?`,
            [mobile, userId]
        );
        if (existing.length > 0) {
            return errorRes(res, 'Mobile number already in use by another account', 409);
        }
    }

    // Check current email in DB
    const [currentUserRows] = await pool.query(`SELECT email FROM users WHERE user_id = ?`, [userId]);
    const currentDbEmail = currentUserRows[0]?.email || '';

    // Check if email is being changed
    if (email && email.trim() !== '') {
        const newEmail = email.trim().toLowerCase();
        if (newEmail !== currentDbEmail.trim().toLowerCase()) {
            // Check if email is already taken by another user
            const [existingEmail] = await pool.query(
                `SELECT user_id FROM users WHERE LOWER(TRIM(email)) = ? AND user_id != ?`,
                [newEmail, userId]
            );
            if (existingEmail.length > 0) {
                return errorRes(res, 'Email address already in use by another account', 409);
            }

            // Enforce OTP verification for email changes
            if (!otp) {
                return errorRes(res, 'Verification code (OTP) is required to update your email address', 400);
            }
            const [otpRows] = await pool.query(
                'SELECT * FROM email_otps WHERE LOWER(email) = ? AND otp = ? AND expires_at >= NOW()',
                [newEmail, otp.trim()]
            );
            if (!otpRows || otpRows.length === 0) {
                return errorRes(res, 'Invalid or expired verification code. Please check the code or request a new one.', 400);
            }
            // Clear verified OTP
            await pool.query('DELETE FROM email_otps WHERE LOWER(email) = ?', [newEmail]);
        }
    }

    // Build update query dynamically
    let updateFields = [];
    let queryParams = [];

    if (name) {
        updateFields.push('name = ?');
        queryParams.push(name);
    }
    if (mobile !== undefined) {
        const cleanMobile = typeof mobile === 'string' ? mobile.trim() : mobile;
        updateFields.push('mobile = ?');
        queryParams.push(cleanMobile === '' ? null : cleanMobile);
    }
    if (email !== undefined && email.trim() !== '') {
        updateFields.push('email = ?');
        queryParams.push(email.trim());
    }
    if (profilePic !== undefined) {
        updateFields.push('profile_pic = ?');
        queryParams.push(profilePic);
    }

    if (updateFields.length === 0) {
        return errorRes(res, 'No fields to update', 400);
    }

    queryParams.push(userId);
    
    await pool.query(
        `UPDATE users SET ${updateFields.join(', ')} WHERE user_id = ?`,
        queryParams
    );

    // Fetch updated user to return
    const [rows] = await pool.query(`SELECT user_id, name, email, mobile, profile_pic FROM users WHERE user_id = ?`, [userId]);
    const updatedUser = rows[0];

    return successRes(res, 'Profile updated successfully', updatedUser);
});

module.exports = { updateProfile, sendEmailChangeOtp };
