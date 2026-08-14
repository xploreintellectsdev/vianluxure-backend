const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const trashController = require('../controllers/trash.controller');

// GET /api/admin/dashboard
router.get('/dashboard', adminController.getDashboardStats);

// Admin Auth & Account Management
router.post('/login', adminController.adminLogin);
router.get('/admins', adminController.listAdmins);
router.post('/admins', adminController.createAdmin);
router.delete('/admins/:id', adminController.deleteAdmin);
router.put('/admins/:id', adminController.updateAdmin);
router.post('/admins/send-superadmin-otp', adminController.sendSuperAdminOtp);
router.put('/admins/:id/password', adminController.changeAdminPassword);

// User Management (Admin Side)
router.get('/users', adminController.getAllUsers);
router.get('/users/:id', adminController.getUserDetails);

// Soft Delete Recovery (Undo / Restore)
router.get('/trash/:entity', trashController.getTrash);
router.post('/restore', trashController.restoreEntity);
router.delete('/permanent-delete', trashController.permanentDelete);

module.exports = router;
