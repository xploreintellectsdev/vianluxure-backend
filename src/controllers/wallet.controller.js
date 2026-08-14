const walletService = require("../services/wallet.service");
const IciciPaymentService = require("../services/iciciPayment.service");
const cashfreePayment = require("../services/cashfreePayment.service");
const orderService = require("../services/order.service");
const emailService = require("../services/email.service");
const { pool } = require("../config/db");

// GET /wallet
const getWallet = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.user_id;
    const details = await walletService.getWalletDetails(userId);
    return res.status(200).json({
      success: true,
      data: details
    });
  } catch (error) {
    console.error("❌ Get Wallet Controller Error:", error.message);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to retrieve wallet details."
    });
  }
};

// GET /wallet/transactions
const getTransactions = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.user_id;
    const { page = 1, limit = 10, transaction_type, date } = req.query;

    const history = await walletService.getTransactionHistory(userId, {
      page,
      limit,
      type: transaction_type,
      date
    });

    return res.status(200).json({
      success: true,
      data: history.transactions,
      pagination: history.pagination
    });
  } catch (error) {
    console.error("❌ Get Wallet Transactions Controller Error:", error.message);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to retrieve transactions."
    });
  }
};

// POST /wallet/add-money
const addMoney = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.user_id;
    const { amount, gateway } = req.body;

    // Read active gateway preference from Admin settings if not specified by user
    let selectedGateway = gateway ? gateway.toUpperCase() : "CASHFREE";
    if (!gateway) {
      try {
        await pool.query(`CREATE TABLE IF NOT EXISTS store_settings (
          setting_key VARCHAR(50) PRIMARY KEY,
          setting_value VARCHAR(255) NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`);
        const [rows] = await pool.query("SELECT setting_value FROM store_settings WHERE setting_key = 'active_gateway'");
        if (rows && rows.length > 0 && rows[0].setting_value.toUpperCase() !== 'BOTH' && rows[0].setting_value.toUpperCase() !== 'MULTIPLE') {
          selectedGateway = rows[0].setting_value.toUpperCase();
        }
      } catch (err) {
        console.warn("Could not read store_settings in wallet addMoney, defaulting to CASHFREE:", err.message);
      }
    }
    const gatewayName = selectedGateway === "ICICI" || selectedGateway === "ICICI_BANK" ? "ICICI" : "CASHFREE";

    const topup = await walletService.initiateRecharge(userId, amount, gatewayName === "ICICI" ? "ICICI_BANK" : "CASHFREE");
    console.log(`[WALLET] Topup initiated via ${gatewayName}: user_id=${userId}, amount=${amount}`);

    if (gatewayName === "ICICI") {
      // Call ICICI initiateSale flow by passing the topup's merchant txn number
      const initiateResult = await IciciPaymentService.initiateSale({
        merchantTxnNo: topup.merchant_txn_no,
        amount: parseFloat(amount),
        userId,
        addressId: null,
        customerEmail: req.user.email,
        customerMobile: req.user.mobile,
        customerName: req.user.name
      });

      if (initiateResult && initiateResult.responseCode === "R1000" && initiateResult.redirectURI && initiateResult.tranCtx) {
        const redirectUrl = `${initiateResult.redirectURI}?tranCtx=${encodeURIComponent(initiateResult.tranCtx)}`;
        return res.status(200).json({
          success: true,
          gateway: "ICICI",
          message: "Wallet recharge initiated successfully via ICICI.",
          paymentUrl: redirectUrl,
          data: topup
        });
      }

      console.error("ICICI initiateSale rejected:", initiateResult);
      return res.status(500).json({
        success: false,
        error: initiateResult?.responseDescription || "Gateway failed to initialize payment redirection."
      });
    } else {
      // Call Cashfree initiateSale flow
      let cfRes;
      try {
        cfRes = await cashfreePayment.initiateSale({
          merchantTxnNo: topup.merchant_txn_no,
          amount: parseFloat(amount),
          customerEmail: req.user.email || `user_${userId}@vianluxure.com`,
          customerMobile: req.user.mobile || "9999999999",
          customerName: req.user.name || "Customer"
        });
      } catch (err) {
        console.error("Cashfree recharge initiateSale failed:", err.message);
        return res.status(500).json({ success: false, error: "Cashfree gateway failed to initiate recharge." });
      }

      return res.status(200).json({
        success: true,
        gateway: "CASHFREE",
        message: "Wallet recharge initiated successfully via Cashfree.",
        paymentUrl: cfRes.paymentUrl,
        paymentSessionId: cfRes.paymentSessionId,
        data: topup
      });
    }
  } catch (error) {
    console.error("❌ Add Money Controller Error:", error.message);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to initiate recharge."
    });
  }
};

// POST /wallet/add-money/success
const addMoneySuccess = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.user_id;
    const { topup_id } = req.body;

    if (!topup_id) {
      return res.status(400).json({ success: false, error: "Topup ID is required." });
    }

    const result = await walletService.completeRecharge(userId, topup_id);
    console.log(`[WALLET] Topup success: user_id=${userId}, topup_id=${topup_id}`);

    return res.status(200).json({
      success: true,
      message: result.message,
      balance: result.balance
    });
  } catch (error) {
    console.error("❌ Add Money Success Controller Error:", error.message);
    return res.status(400).json({
      success: false,
      error: error.message || "Failed to process recharge completion."
    });
  }
};

// POST /wallet/payment
const payment = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.user_id;
    const { amount, order_id } = req.body;

    const result = await walletService.debitPayment(userId, amount, order_id);
    console.log(`[WALLET] Payment debit: user_id=${userId}, amount=${amount}, order_id=${order_id}`);

    return res.status(200).json({
      success: true,
      message: result.message,
      balance: result.balance
    });
  } catch (error) {
    console.error("❌ Wallet Payment Controller Error:", error.message);
    return res.status(400).json({
      success: false,
      error: error.message || "Wallet payment failed."
    });
  }
};

// POST /wallet/refund
const refund = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.user_id;
    const {
      order_id,
      payment_id,
      cancellation_id,
      refund_method,
      refund_amount,
      wallet_refund_amount,
      gateway_refund_amount
    } = req.body;

    const result = await walletService.processRefund(userId, {
      order_id,
      payment_id,
      cancellation_id,
      refund_method,
      refund_amount,
      wallet_refund_amount,
      gateway_refund_amount
    });

    console.log(`[WALLET] Refund processed: user_id=${userId}, order_id=${order_id}, method=${refund_method}`);

    return res.status(200).json({
      success: true,
      message: result.message,
      refunded_to_wallet: result.refunded_to_wallet,
      balance: result.balance
    });
  } catch (error) {
    console.error("❌ Wallet Refund Controller Error:", error.message);
    return res.status(400).json({
      success: false,
      error: error.message || "Wallet refund processing failed."
    });
  }
};

// Admin Dashboard Stats & User List
const getAdminDashboard = async (req, res) => {
  try {
    const { pool: ConnectDB } = require("../config/db");
    
    // Overall Stats
    const [[stats]] = await ConnectDB.query(`
      SELECT 
        COALESCE(SUM(balance), 0) as total_balance,
        (SELECT COALESCE(SUM(amount), 0) FROM wallet_transactions WHERE transaction_source = 'WALLET_TOPUP' AND transaction_status = 'SUCCESS') as total_recharges,
        (SELECT COALESCE(SUM(amount), 0) FROM wallet_transactions WHERE transaction_source = 'ORDER_REFUND' AND transaction_status = 'SUCCESS') as total_refunds,
        (SELECT COALESCE(SUM(amount), 0) FROM wallet_transactions WHERE transaction_source = 'ORDER_PAYMENT' AND transaction_status = 'SUCCESS') as total_payments
      FROM wallets
    `);

    // User List with Balance
    const [users] = await ConnectDB.query(`
      SELECT 
        u.user_id, u.name, u.email,
        w.balance, w.status,
        (SELECT MAX(created_at) FROM wallet_transactions wt WHERE wt.wallet_id = w.wallet_id) as last_transaction_date
      FROM users u
      LEFT JOIN wallets w ON u.user_id = w.user_id
      ORDER BY w.balance DESC
    `);

    return res.status(200).json({ success: true, stats, users });
  } catch (error) {
    console.error("Admin Dashboard Error:", error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

// Admin User Details
const getAdminUserDetails = async (req, res) => {
  try {
    const { pool: ConnectDB } = require("../config/db");
    const userId = req.params.userId;
    
    // User & Wallet Info
    const [[user]] = await ConnectDB.query(`
      SELECT u.name, u.email, u.mobile, w.balance, w.status, w.wallet_id
      FROM users u
      LEFT JOIN wallets w ON u.user_id = w.user_id
      WHERE u.user_id = ?
    `, [userId]);

    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    // User Specific Stats
    const [[stats]] = await ConnectDB.query(`
      SELECT 
        (SELECT COALESCE(SUM(amount), 0) FROM wallet_transactions WHERE wallet_id = ? AND transaction_source = 'WALLET_TOPUP' AND transaction_status = 'SUCCESS') as total_recharges,
        (SELECT COALESCE(SUM(amount), 0) FROM wallet_transactions WHERE wallet_id = ? AND transaction_source = 'ORDER_REFUND' AND transaction_status = 'SUCCESS') as total_refunds,
        (SELECT COALESCE(SUM(amount), 0) FROM wallet_transactions WHERE wallet_id = ? AND transaction_source = 'ORDER_PAYMENT' AND transaction_status = 'SUCCESS') as total_payments
    `, [user.wallet_id, user.wallet_id, user.wallet_id]);

    // Transaction History
    const [transactions] = await ConnectDB.query(`
      SELECT * FROM wallet_transactions 
      WHERE wallet_id = ? 
      ORDER BY created_at DESC LIMIT 50
    `, [user.wallet_id]);

    return res.status(200).json({ success: true, user: { ...user, ...stats }, transactions });
  } catch (error) {
    console.error("Admin User Details Error:", error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

// Admin Credit Wallet
const adminCreditWallet = async (req, res) => {
  try {
    const { userId, amount, reason, remarks } = req.body;
    const adminId = req.user.userId || req.user.user_id || 1; // Fallback or extract from token
    
    const result = await walletService.creditAdminWallet({
      userId, adminId, amount, reason, remarks
    });
    
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

// POST /wallet/checkout - Complete order using wallet balance
const walletCheckout = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.user_id;
    const { customer, cart, totals, addressId } = req.body;

    if (!cart || cart.length === 0) {
      return res.status(400).json({ success: false, error: "Cart is empty." });
    }
    if (!totals || !totals.grandTotal) {
      return res.status(400).json({ success: false, error: "Order total is required." });
    }

    // Step 1: Create the order (will throw if wallet is insufficient)
    const orderData = {
      userId,
      addressId: addressId || null,
      name: customer.name,
      mobile: customer.phone,
      email: customer.email || null,
      address: customer.address,
      subtotal: totals.subtotal,
      shippingFee: totals.shippingFee,
      grandTotal: totals.grandTotal,
    };

    const { orderId, orderNumber } = await orderService.createOrder(orderData, cart);

    // Step 2: Debit wallet
    try {
      await walletService.debitPayment(userId, totals.grandTotal, orderId);
    } catch (walletErr) {
      // If wallet debit fails, we should ideally rollback the order.
      // For now, log it and return the error.
      console.error("❌ Wallet debit failed after order created:", walletErr.message);
      return res.status(400).json({ success: false, error: walletErr.message });
    }

    // Step 3: Record the wallet payment in payments table (needed for refunds)
    const merchantTxnNo = `WALLET-${Date.now()}`;
    try {
      await pool.query(
        `INSERT INTO payments
          (order_id, user_id, gateway_name, merchant_txn_no, payment_mode, amount, payment_status, paid_at)
         VALUES (?, ?, 'STORE_WALLET', ?, 'STORE_WALLET', ?, 'Success', NOW())`,
        [orderId, userId, merchantTxnNo, parseFloat(totals.grandTotal)]
      );
    } catch (payErr) {
      // Non-fatal: order and debit already succeeded, just log
      console.error("[WALLET CHECKOUT] Could not insert payment record:", payErr.message);
    }

    console.log(`[WALLET CHECKOUT] Order created: ${orderNumber}, user_id=${userId}, amount=${totals.grandTotal}`);

    emailService.sendOrderPlacedEmails(orderId);

    return res.status(200).json({
      success: true,
      message: "Order placed successfully using wallet.",
      orderNumber,
    });
  } catch (error) {
    console.error("❌ Wallet Checkout Controller Error:", error.message);
    return res.status(500).json({
      success: false,
      error: error.message || "Wallet checkout failed.",
    });
  }
};

module.exports = {
  getWallet,
  getTransactions,
  addMoney,
  addMoneySuccess,
  payment,
  refund,
  walletCheckout,
  getAdminDashboard,
  getAdminUserDetails,
  adminCreditWallet
};
