const express = require("express");
const router = express.Router();
const walletController = require("../controllers/wallet.controller");
const walletValidation = require("../validations/wallet.validation");
const { authenticateToken } = require("../middleware/auth.middleware");

// Get wallet details
router.get("/", authenticateToken, walletController.getWallet);

// Get paginated wallet transactions
router.get("/transactions", authenticateToken, walletController.getTransactions);

// Initiate wallet recharge request
router.post("/add-money", authenticateToken, walletValidation.validateRecharge, walletController.addMoney);

// Complete wallet recharge successfully
router.post("/add-money/success", authenticateToken, walletController.addMoneySuccess);

// Deduct wallet balance for payment
router.post("/payment", authenticateToken, walletValidation.validateDebit, walletController.payment);

// Checkout using wallet balance (creates order + debits wallet)
router.post("/checkout", authenticateToken, walletController.walletCheckout);

// Process wallet refunds on cancellations
router.post("/refund", authenticateToken, walletValidation.validateRefund, walletController.refund);

// Admin: Get all wallets and stats for dashboard
router.get("/admin/dashboard", authenticateToken, walletController.getAdminDashboard);

// Admin: Get user wallet details
router.get("/admin/user/:userId", authenticateToken, walletController.getAdminUserDetails);

// Admin: Credit user wallet manually
router.post("/admin/credit", authenticateToken, walletController.adminCreditWallet);

module.exports = router;
