const walletRepository = require("../repositories/wallet.repository");
const { pool: ConnectDB } = require("../config/db");
const emailService = require("./email.service");

// Get or create user wallet details
const getWalletDetails = async (userId) => {
  let wallet = await walletRepository.findWalletByUserId(userId);
  if (!wallet) {
    wallet = await walletRepository.createWallet(userId);
  }

  const summary = await walletRepository.getTransactionsSummary(wallet.wallet_id);

  return {
    wallet_id: wallet.wallet_id,
    balance: parseFloat(wallet.balance),

    status: wallet.status,
    total_credits: summary.totalCredits,
    total_debits: summary.totalDebits,
    recent_transactions_count: summary.recentTransactionCount
  };
};

// Get transaction logs with filter and pagination
const getTransactionHistory = async (userId, filters) => {
  let wallet = await walletRepository.findWalletByUserId(userId);
  if (!wallet) {
    wallet = await walletRepository.createWallet(userId);
  }

  const transactions = await walletRepository.findTransactions(wallet.wallet_id, filters);
  const totalRecords = await walletRepository.countTransactions(wallet.wallet_id, filters);
  
  return {
    transactions,
    pagination: {
      total: totalRecords,
      page: parseInt(filters.page || 1),
      limit: parseInt(filters.limit || 10),
      totalPages: Math.ceil(totalRecords / parseInt(filters.limit || 10))
    }
  };
};

// Create a recharge topup request
const initiateRecharge = async (userId, amount, gatewayName = "CASHFREE") => {
  let wallet = await walletRepository.findWalletByUserId(userId);
  if (!wallet) {
    wallet = await walletRepository.createWallet(userId);
  }

  if (wallet.status !== "ACTIVE") {
    throw new Error("Wallet is inactive or blocked.");
  }

  // Generate unique merchant transaction number
  const merchantTxnNo = `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const topup = await walletRepository.createTopup({
    wallet_id: wallet.wallet_id,
    user_id: userId,
    amount: parseFloat(amount),
    merchant_txn_no: merchantTxnNo,
    gateway_name: gatewayName
  });

  return topup;
};

// Complete recharge successfully
const completeRecharge = async (userId, topupId) => {
  const connection = await ConnectDB.getConnection();
  try {
    await connection.beginTransaction();

    const topup = await walletRepository.findTopupById(topupId, connection);
    if (!topup) {
      throw new Error("Recharge topup request not found.");
    }

    if (topup.user_id !== userId) {
      throw new Error("Unauthorized recharge request.");
    }

    if (topup.status === "SUCCESS") {
      throw new Error("Recharge already processed.");
    }

    const wallet = await walletRepository.findWalletById(topup.wallet_id, connection);
    if (!wallet) {
      throw new Error("Associated wallet not found.");
    }

    if (wallet.status !== "ACTIVE") {
      throw new Error("Wallet is currently inactive.");
    }

    const balanceBefore = parseFloat(wallet.balance);
    const balanceAfter = balanceBefore + parseFloat(topup.amount);

    // Update topup record
    await walletRepository.updateTopupStatus(topupId, "SUCCESS", null, null, connection);

    // Update wallet balance
    await walletRepository.updateBalance(wallet.wallet_id, balanceAfter, connection);

    // Create transaction log
    await walletRepository.createTransaction({
      wallet_id: wallet.wallet_id,
      user_id: userId,
      transaction_type: "CREDIT",
      transaction_source: "WALLET_TOPUP",
      transaction_status: "SUCCESS",
      amount: topup.amount,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      remarks: `Wallet recharged successfully with transaction ref: ${topup.merchant_txn_no}`
    }, connection);

    await connection.commit();

    emailService.sendWalletCreditEmail({
      userId,
      amount: topup.amount,
      newBalance: balanceAfter,
      remarks: `Wallet recharged successfully (Ref: ${topup.merchant_txn_no})`,
      transactionSource: "WALLET_TOPUP"
    }).catch(err => console.error("Error sending wallet credit email:", err));

    return {
      success: true,
      balance: balanceAfter,
      message: "Wallet recharge completed successfully."
    };
  } catch (error) {
    await connection.rollback();
    console.error("❌ Complete Recharge Service Error:", error.message);
    throw error;
  } finally {
    connection.release();
  }
};

// Deduct wallet balance during checkout
const debitPayment = async (userId, amount, orderId = null) => {
  const connection = await ConnectDB.getConnection();
  try {
    await connection.beginTransaction();

    const wallet = await walletRepository.findWalletByUserId(userId, connection);
    if (!wallet) {
      throw new Error("Wallet not found.");
    }

    if (wallet.status !== "ACTIVE") {
      throw new Error("Wallet is inactive or blocked.");
    }

    const currentBalance = parseFloat(wallet.balance);
    const debitAmount = parseFloat(amount);

    if (currentBalance < debitAmount) {
      throw new Error("Insufficient wallet balance.");
    }

    const balanceBefore = currentBalance;
    const balanceAfter = balanceBefore - debitAmount;

    // Update balance
    await walletRepository.updateBalance(wallet.wallet_id, balanceAfter, connection);

    // Log transaction
    await walletRepository.createTransaction({
      wallet_id: wallet.wallet_id,
      user_id: userId,
      order_id: orderId,
      transaction_type: "DEBIT",
      transaction_source: "ORDER_PAYMENT",
      transaction_status: "SUCCESS",
      amount: debitAmount,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      remarks: orderId ? `Payment debited for Order ID: ${orderId}` : "Payment debited for checkout"
    }, connection);

    await connection.commit();
    return {
      success: true,
      balance: balanceAfter,
      message: "Wallet payment debited successfully."
    };
  } catch (error) {
    await connection.rollback();
    console.error("❌ Debit Payment Service Error:", error.message);
    throw error;
  } finally {
    connection.release();
  }
};

// Handle wallet refunds for Order cancellations
const processRefund = async (userId, refundData, conn = null) => {
  const connection = conn || await ConnectDB.getConnection();
  const shouldManageTransaction = !conn;
  try {
    if (shouldManageTransaction) {
      await connection.beginTransaction();
    }

    const { 
      order_id, 
      payment_id, 
      cancellation_id, 
      refund_method, 
      refund_amount, 
      wallet_refund_amount = 0,
      gateway_refund_amount = 0
    } = refundData;

    // Prevent duplicate refunds checking
    const [existingTx] = await connection.execute(
      "SELECT * FROM wallet_transactions WHERE cancellation_id = ? AND transaction_type = 'CREDIT' AND transaction_source = 'ORDER_REFUND'",
      [cancellation_id]
    );

    if (existingTx.length > 0) {
      throw new Error("Refund already processed for this cancellation.");
    }

    let wallet = await walletRepository.findWalletByUserId(userId, connection);
    if (!wallet) {
      wallet = await walletRepository.createWallet(userId, connection);
    }

    if (wallet.status !== "ACTIVE") {
      throw new Error("Wallet is currently inactive. Cannot process refund.");
    }

    const currentBalance = parseFloat(wallet.balance);
    let amountToCredit = 0;
    let remarks = "";

    if (refund_method === "WALLET") {
      amountToCredit = parseFloat(refund_amount);
      remarks = `Full refund credited to wallet for Order ID: ${order_id}`;
    } else if (refund_method === "SPLIT") {
      // Split payments credit wallet portion back to wallet
      amountToCredit = parseFloat(wallet_refund_amount);
      remarks = `Split payment refund. Wallet portion of ₹${amountToCredit} credited back. Bank portion: ₹${gateway_refund_amount}`;
    } else if (refund_method === "ORIGINAL_PAYMENT" && wallet_refund_amount > 0) {
      // If gateway order was requested as wallet refund option
      amountToCredit = parseFloat(wallet_refund_amount);
      remarks = `Consolidated Gateway order refund credited to store wallet for Order ID: ${order_id}`;
    } else {
      // If original payment method option (e.g. gateway only), credit goes to bank. We simulate a placeholder success.
      if (shouldManageTransaction) {
        await connection.commit();
      }
      return {
        success: true,
        refunded_to_wallet: false,
        message: "Bank refund successfully initiated. No wallet transaction processed."
      };
    }

    if (amountToCredit <= 0) {
      if (shouldManageTransaction) {
        await connection.commit();
      }
      return {
        success: true,
        refunded_to_wallet: false,
        message: "No wallet contribution to refund."
      };
    }

    const balanceBefore = currentBalance;
    const balanceAfter = balanceBefore + amountToCredit;

    // Update wallet balance
    await walletRepository.updateBalance(wallet.wallet_id, balanceAfter, connection);

    // Create transaction log
    await walletRepository.createTransaction({
      wallet_id: wallet.wallet_id,
      user_id: userId,
      order_id: order_id,
      payment_id: payment_id,
      cancellation_id: cancellation_id,
      transaction_type: "CREDIT",
      transaction_source: "ORDER_REFUND",
      transaction_status: "SUCCESS",
      amount: amountToCredit,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      remarks: remarks
    }, connection);

    if (shouldManageTransaction) {
      await connection.commit();
    }

    emailService.sendWalletCreditEmail({
      userId,
      amount: amountToCredit,
      newBalance: balanceAfter,
      remarks: remarks || `Refund credited for Order #${order_id}`,
      transactionSource: "ORDER_REFUND"
    }).catch(err => console.error("Error sending refund credit email:", err));

    return {
      success: true,
      refunded_to_wallet: true,
      balance: balanceAfter,
      message: "Refund processed and credited to wallet successfully."
    };
  } catch (error) {
    if (shouldManageTransaction) {
      await connection.rollback();
    }
    console.error("❌ Process Refund Service Error:", error.message);
    throw error;
  } finally {
    if (shouldManageTransaction) {
      connection.release();
    }
  }
};

/**
 * Admin: Credit user wallet manually
 */
const creditAdminWallet = async ({ userId, adminId, amount, reason, remarks }) => {
  const connection = await ConnectDB.getConnection();
  try {
    await connection.beginTransaction();

    const wallet = await walletRepository.findWalletByUserId(userId, connection);
    if (!wallet) {
      throw new Error("Wallet not found for this user.");
    }

    const amountToCredit = parseFloat(amount);
    if (isNaN(amountToCredit) || amountToCredit <= 0) {
      throw new Error("Invalid credit amount.");
    }

    const balanceBefore = parseFloat(wallet.balance);
    const balanceAfter = balanceBefore + amountToCredit;

    // Update Wallet Balance
    await walletRepository.updateBalance(wallet.wallet_id, balanceAfter, connection);

    // Insert Wallet Transaction
    await walletRepository.createTransaction({
      wallet_id: wallet.wallet_id,
      user_id: userId,
      transaction_type: "CREDIT",
      transaction_source: "ADMIN_CREDIT",
      transaction_status: "SUCCESS",
      amount: amountToCredit,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      admin_id: adminId,
      reason: reason,
      remarks: remarks
    }, connection);

    await connection.commit();

    const isRefund = reason && reason.toLowerCase().includes("refund");
    emailService.sendWalletCreditEmail({
      userId,
      amount: amountToCredit,
      newBalance: balanceAfter,
      reason: reason,
      remarks: remarks,
      transactionSource: isRefund ? "ORDER_REFUND" : "ADMIN_CREDIT"
    }).catch(err => console.error("Error sending admin credit email:", err));

    return {
      success: true,
      wallet_id: wallet.wallet_id,
      balance: balanceAfter,
      credited_amount: amountToCredit
    };
  } catch (error) {
    await connection.rollback();
    console.error("❌ Admin Wallet Credit Error:", error.message);
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  getWalletDetails,
  getTransactionHistory,
  initiateRecharge,
  completeRecharge,
  debitPayment,
  processRefund,
  creditAdminWallet
};
