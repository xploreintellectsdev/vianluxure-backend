const authService = require('../services/auth.service');
const { successRes, errorRes } = require('../utils/response');
const catchAsync = require('../utils/catchAsync');

const sendRegisterOtp = catchAsync(async (req, res) => {
    const { name, email, mobile } = req.body;
    if (!email) return errorRes(res, "Email address is required to send verification code", 400);
    if (!name) return errorRes(res, "Name is required", 400);
    if (!mobile) return errorRes(res, "Mobile number is required", 400);

    const result = await authService.sendRegisterOtp({ name, email, mobile });
    return successRes(res, result.message, null);
});

const register = catchAsync(async (req, res) => {
    const { name, email, mobile, password, otp } = req.body;

    if (!name) return errorRes(res, "Name is required", 400);
    if (!email) return errorRes(res, "Email is required", 400);
    if (!mobile) return errorRes(res, "Mobile number is required", 400);
    if (!password || password.length < 6) return errorRes(res, "Password must be at least 6 characters", 400);
    if (!otp) return errorRes(res, "Email verification code (OTP) is required", 400);

    const { user, token } = await authService.register({ name, email, mobile, password, otp });
    return successRes(res, "Account created successfully", { user, token }, null, 201);
});

const login = catchAsync(async (req, res) => {
    const { email, password } = req.body;

    if (!email) return errorRes(res, "Email is required", 400);
    if (!password) return errorRes(res, "Password is required", 400);

    const { user, token } = await authService.login({ email, password });
    try {
        const { pool } = require('../config/db');
        const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '::1';
        await pool.query(
            `INSERT INTO user_login_history (user_id, name, email, ip_address, status) VALUES (?, ?, ?, ?, 'SUCCESS')`,
            [user?.user_id || null, user?.name || user?.email || 'User', user?.email || '', ip]
        );
    } catch (e) {
        // Ignore error if table not ready
    }
    return successRes(res, "Logged in successfully", { user, token });
});

const googleLogin = catchAsync(async (req, res) => {
    const { token, access_token } = req.body;

    if (!token && !access_token) return errorRes(res, "Google token is required", 400);

    const { user, token: jwtToken } = await authService.googleLogin({ token, access_token });
    try {
        const { pool } = require('../config/db');
        const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '::1';
        await pool.query(
            `INSERT INTO user_login_history (user_id, name, email, ip_address, status) VALUES (?, ?, ?, ?, 'SUCCESS (GOOGLE)')`,
            [user?.user_id || null, user?.name || user?.email || 'User', user?.email || '', ip]
        );
    } catch (e) {
        // Ignore error if table not ready
    }
    return successRes(res, "Logged in with Google successfully", { user, token: jwtToken });
});

module.exports = { register, login, googleLogin, sendRegisterOtp };