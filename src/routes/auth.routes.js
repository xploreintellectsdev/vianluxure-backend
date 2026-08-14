const express = require('express');
const router = express.Router();
const { register, login, googleLogin, sendRegisterOtp } = require('../controllers/auth.controller');

router.post('/send-otp', sendRegisterOtp);
router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.post('/google-login', googleLogin);

module.exports = router;