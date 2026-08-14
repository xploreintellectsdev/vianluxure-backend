const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

router.post('/send-email-otp', authenticateToken, userController.sendEmailChangeOtp);
router.put('/profile', authenticateToken, userController.updateProfile);

module.exports = router;
