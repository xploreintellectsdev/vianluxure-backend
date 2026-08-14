const { pool } = require("../config/db");
const orderService = require("../services/order.service");
const iciciPayment = require("../services/iciciPayment.service");
const cashfreePayment = require("../services/cashfreePayment.service");
const instamojoPayment = require("../services/instamojoPayment.service");
const emailService = require("../services/email.service");
const { successRes, errorRes } = require("../utils/response");
const catchAsync = require("../utils/catchAsync");

const VALID_PAYMENT_MODES = ["CARD", "NB", "WALLET", "UPI", "CASHFREE", "ICICI", "INSTAMOJO", "ALL", "ONLINE", "STORE_WALLET"];

// 1. Stash the checkout (cart/customer/address) in payment_sessions and ask
// the selected Gateway (Cashfree or ICICI) for a redirect URL.
const initiatePayment = catchAsync(async (req, res) => {
    const { customer, cart, totals, addressId, paymentMode = "ONLINE", gateway = null } = req.body;

    if (!cart || cart.length === 0) {
        return errorRes(res, "Cart is empty", 400);
    }
    if (!paymentMode || !VALID_PAYMENT_MODES.includes(paymentMode)) {
        return errorRes(res, "A valid payment method or gateway choice is required", 400);
    }

    let userId = req.user?.user_id || null;

    const conn = await pool.getConnection();
    let merchantTxnNo;
    try {
        await conn.query("SELECT GET_LOCK('order_number_generation', 10)");
        try {
            let nextId = 50000;
            const [orderRows] = await conn.query(`SELECT MAX(CAST(SUBSTRING_INDEX(order_number, '-', -1) AS UNSIGNED)) as max_num FROM orders WHERE order_number LIKE 'ORD-%'`);
            if (orderRows[0] && orderRows[0].max_num) nextId = Math.max(nextId, orderRows[0].max_num + 1);

            const [sessionRows] = await conn.query(`SELECT MAX(CAST(SUBSTRING_INDEX(merchant_txn_no, '-', -1) AS UNSIGNED)) as max_num FROM payment_sessions WHERE merchant_txn_no LIKE 'ORD-%'`);
            if (sessionRows[0] && sessionRows[0].max_num) nextId = Math.max(nextId, sessionRows[0].max_num + 1);

            merchantTxnNo = `ORD-${nextId}`;
        } finally {
            await conn.query("SELECT RELEASE_LOCK('order_number_generation')");
        }
        if (userId) {
            const [userRows] = await conn.query('SELECT email, name FROM users WHERE user_id = ?', [userId]);
            if (userRows.length > 0) {
                if (!customer.email) customer.email = userRows[0].email;
                if (!customer.name || customer.name === "Customer") customer.name = userRows[0].name;
            }
        }

        await conn.query(
            `INSERT INTO payment_sessions
                (merchant_txn_no, user_id, address_id, customer_name, customer_mobile, customer_email, shipping_address, cart_json, subtotal, shipping_fee, grand_total, payment_mode, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Initiated')`,
            [
                merchantTxnNo,
                userId,
                addressId || null,
                customer.name,
                customer.phone,
                customer.email || null,
                customer.address,
                JSON.stringify(cart),
                totals.subtotal,
                totals.shippingFee,
                totals.grandTotal,
                paymentMode,
            ]
        );
    } finally {
        conn.release();
    }

    let redirectUrl = null;
    let paymentSessionId = null;
    let selectedGateway = gateway ? gateway.toUpperCase() : null;
    if (!selectedGateway) {
        try {
            await pool.query(`CREATE TABLE IF NOT EXISTS store_settings (
                setting_key VARCHAR(50) PRIMARY KEY,
                setting_value VARCHAR(255) NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )`);
            const [rows] = await pool.query("SELECT setting_value FROM store_settings WHERE setting_key = 'active_gateway'");
            if (rows && rows.length > 0) {
                selectedGateway = rows[0].setting_value.toUpperCase();
            } else {
                await pool.query("INSERT IGNORE INTO store_settings (setting_key, setting_value) VALUES ('active_gateway', 'CASHFREE')");
                selectedGateway = "CASHFREE";
            }
        } catch (err) {
            console.warn("Could not fetch store_settings, defaulting to CASHFREE:", err.message);
            selectedGateway = "CASHFREE";
        }
    }
    let gatewayName = "CASHFREE";
    if (selectedGateway === "ICICI" || selectedGateway === "ICICI_BANK") {
        gatewayName = "ICICI";
    } else if (selectedGateway === "INSTAMOJO") {
        gatewayName = "INSTAMOJO";
    }

    if (gatewayName === "ICICI") {
        let iciciResponse;
        try {
            iciciResponse = await iciciPayment.initiateSale({
                merchantTxnNo,
                amount: totals.grandTotal,
                paymentMode: ["CARD", "NB", "WALLET", "UPI"].includes(paymentMode) ? paymentMode : undefined,
                customerEmail: customer.email,
                customerMobile: customer.phone,
            });
        } catch (err) {
            // ── LOGGING: full error + which merchantTxnNo it happened for ──
            console.error("=== ICICI initiateSale REQUEST FAILED ===");
            console.error("merchantTxnNo:", merchantTxnNo);
            console.error("Error:", err);
            console.error("==========================================");
            return errorRes(res, "Could not reach the payment gateway. Please try again.", 502);
        }

        if (iciciResponse.responseCode !== "R1000" || !iciciResponse.redirectURI || !iciciResponse.tranCtx) {
            // ── LOGGING: dump ICICI's full rejection payload, not just the description ──
            console.error("=== ICICI initiateSale REJECTED ===");
            console.error("merchantTxnNo:", merchantTxnNo);
            console.error("Full ICICI response:", JSON.stringify(iciciResponse, null, 2));
            console.error("responseCode:", iciciResponse.responseCode);
            console.error("responseDescription:", iciciResponse.responseDescription);
            console.error("====================================");
            return errorRes(res, iciciResponse.responseDescription || "Payment gateway rejected the request.", 502);
        }
        redirectUrl = `${iciciResponse.redirectURI}?tranCtx=${encodeURIComponent(iciciResponse.tranCtx)}`;
    } else if (gatewayName === "INSTAMOJO") {
        try {
            const imRes = await instamojoPayment.initiateSale({
                merchantTxnNo,
                amount: totals.grandTotal,
                customerEmail: customer.email,
                customerMobile: customer.phone,
                customerName: customer.name,
            });
            // Return JSON response for Seamless Checkout immediately without redirect
            return successRes(res, "Payment initiated", {
                checkoutUrl: imRes.checkoutUrl,
                paymentRequestId: imRes.paymentRequestId,
                merchantTxnNo,
                gateway: gatewayName
            }, null, 200);
        } catch (err) {
            console.error("=== Instamojo initiateSale FAILED ===");
            console.error("merchantTxnNo:", merchantTxnNo);
            console.error("Error:", err);
            console.error("=====================================");
            return errorRes(res, err.message || "Could not initiate Instamojo payment. Please try again.", 502);
        }
    } else {
        // Default to Cashfree Payments Gateway
        try {
            const cfRes = await cashfreePayment.initiateSale({
                merchantTxnNo,
                amount: totals.grandTotal,
                userId,
                customerEmail: customer.email,
                customerMobile: customer.phone,
                customerName: customer.name,
            });
            redirectUrl = cfRes.redirectUrl || null;
            paymentSessionId = cfRes.paymentSessionId || null;
        } catch (err) {
            console.error("=== Cashfree initiateSale FAILED ===");
            console.error("merchantTxnNo:", merchantTxnNo);
            console.error("Error:", err);
            console.error("=====================================");
            return errorRes(res, err.message || "Could not initiate Cashfree payment. Please try again.", 502);
        }
    }

    return successRes(res, "Redirecting to payment gateway", { redirectUrl, paymentSessionId, gateway: gatewayName, env: process.env.CASHFREE_ENV || "SANDBOX" }, null, 200);
});

// 2. ICICI form-POSTs the payment result here. Only on a verified SUCCESS do
// we create the real order + payments row; a decline/cancel just marks the
// session Failed and nothing lands in `orders` or `payments` at all.
const paymentCallback = catchAsync(async (req, res) => {
    const params = req.body;
    const secretKey = process.env.ICICI_SECRET_KEY;
    const frontendUrl = process.env.FRONTEND_URL;

    const isVerified = iciciPayment.verifyCallback(params, secretKey);
    if (!isVerified) {
        // ── LOGGING: dump everything ICICI actually posted back, so we can
        // see if the params themselves look right (right merchantTxnNo,
        // right amount) even though the hash didn't match. A mismatch here
        // almost always means ICICI_SECRET_KEY in .env doesn't match what's
        // registered against this merchant ID on ICICI's side. ──
        console.error("=== ICICI CALLBACK: secureHash verification FAILED ===");
        console.error("merchantTxnNo:", params.merchantTxnNo);
        console.error("Full callback params received from ICICI:", JSON.stringify(params, null, 2));
        console.error("secureHash from ICICI:", params.secureHash);
        console.error("ICICI_SECRET_KEY is set:", !!secretKey, secretKey ? `(length ${secretKey.length})` : "(MISSING)");
        console.error("========================================================");
        return res.redirect(`${frontendUrl}/checkout/payment-result?status=failed&reason=invalid_signature`);
    }

    const merchantTxnNo = params.merchantTxnNo;
    const responseCode = params.responseCode;
    const isSuccess = responseCode === "000" || responseCode === "0000";

    const conn = await pool.getConnection();
    try {
        const [rows] = await conn.query(
            `SELECT * FROM payment_sessions WHERE merchant_txn_no = ? FOR UPDATE`,
            [merchantTxnNo]
        );

        if (rows.length === 0) {
            // Check if it's a Wallet Topup
            const [topupRows] = await conn.query(
                `SELECT * FROM wallet_topups WHERE merchant_txn_no = ? FOR UPDATE`,
                [merchantTxnNo]
            );

            if (topupRows.length > 0) {
                const topup = topupRows[0];
                
                // If it's already processed, just redirect to wallet
                if (topup.status !== "PENDING") {
                    return res.redirect(`${frontendUrl}/profile/wallet?recharge=${topup.status.toLowerCase()}`);
                }
                
                if (!isSuccess) {
                    console.error("=== ICICI CALLBACK: wallet topup DECLINED by gateway ===");
                    console.error("merchantTxnNo:", merchantTxnNo, "| responseCode:", responseCode, "| respDescription:", params.respDescription);
                    console.error("==========================================================");
                    await conn.query(`UPDATE wallet_topups SET status = 'FAILED' WHERE topup_id = ?`, [topup.topup_id]);
                    return res.redirect(`${frontendUrl}/profile/wallet?recharge=failed`);
                }
                
                // Complete wallet recharge
                const walletService = require("../services/wallet.service");
                try {
                    await walletService.completeRecharge(topup.user_id, topup.topup_id);
                    return res.redirect(`${frontendUrl}/profile/wallet?recharge=success`);
                } catch (err) {
                    console.error("Wallet recharge completion failed:", err);
                    return res.redirect(`${frontendUrl}/profile/wallet?recharge=failed`);
                }
            }

            // ── LOGGING: this is the classic "we can't find the session" case —
            // usually means the merchantTxnNo ICICI sent back doesn't match
            // what we generated (truncation, encoding issue, or wrong env
            // pointing at a different DB). Dump the raw params too. ──
            console.error("=== ICICI CALLBACK: NO MATCHING SESSION OR TOPUP ===");
            console.error("merchantTxnNo received from ICICI:", merchantTxnNo);
            console.error("Full callback params:", JSON.stringify(params, null, 2));
            console.error("=====================================================");
            return res.redirect(`${frontendUrl}/checkout/payment-result?status=failed&reason=session_not_found`);
        }

        const session = rows[0];

        // Callback arrived twice (retry, or the customer refreshed the
        // return page) — don't create a second order for the same session.
        if (session.status !== "Initiated") {
            if (session.status === "Success" && session.order_id) {
                const [[order]] = await conn.query(
                    `SELECT order_number FROM orders WHERE order_id = ?`,
                    [session.order_id]
                );
                return res.redirect(
                    `${frontendUrl}/checkout/payment-result?status=success&orderNumber=${order?.order_number || ""}`
                );
            }
            // ── LOGGING: session already in a terminal (non-Initiated,
            // non-Success) state — e.g. already marked Failed on a prior
            // callback. Show what state it's already in. ──
            console.error("=== ICICI CALLBACK: session already in non-Initiated state ===");
            console.error("merchantTxnNo:", merchantTxnNo, "| current session.status:", session.status);
            console.error("================================================================");
            return res.redirect(`${frontendUrl}/checkout/payment-result?status=failed&reason=session_already_${session.status.toLowerCase()}`);
        }

        if (!isSuccess) {
            // ── LOGGING: the actual decline reason from ICICI's bank/gateway side.
            // This is the most common real-world cause — e.g. wrong UAT test
            // card, OTP mismatch, insufficient funds simulation, etc. ──
            console.error("=== ICICI CALLBACK: payment DECLINED by gateway ===");
            console.error("merchantTxnNo:", merchantTxnNo);
            console.error("responseCode:", responseCode);
            console.error("respDescription:", params.respDescription);
            console.error("Full callback params:", JSON.stringify(params, null, 2));
            console.error("====================================================");
            await conn.query(
                `UPDATE payment_sessions SET status = 'Failed', response_code = ?, response_description = ? WHERE session_id = ?`,
                [responseCode || null, params.respDescription || null, session.session_id]
            );
            return res.redirect(`${frontendUrl}/checkout/payment-result?status=failed&reason=declined&code=${encodeURIComponent(responseCode || "")}`);
        }

        // --- THE FIX IS HERE ---
        // MySQL's driver automatically parses JSON columns into objects.
        // We only parse it if it's still a string.
        const cart = typeof session.cart_json === 'string' 
            ? JSON.parse(session.cart_json) 
            : session.cart_json;

        const orderData = {
            userId: session.user_id,
            addressId: session.address_id,
            name: session.customer_name,
            mobile: session.customer_mobile,
            email: session.customer_email || null,
            address: session.shipping_address,
            subtotal: session.subtotal,
            shippingFee: session.shipping_fee,
            grandTotal: session.grand_total,
            orderNumber: session.merchant_txn_no,
        };

        let orderId, orderNumber;
        try {
            ({ orderId, orderNumber } = await orderService.createOrder(orderData, cart));
        } catch (err) {
            // ── LOGGING: payment succeeded at ICICI but order creation
            // failed on our side (stock issue, DB error, etc). This is
            // important to catch loudly since the customer was charged. ──
            console.error("=== ICICI CALLBACK: PAYMENT SUCCEEDED BUT ORDER CREATION FAILED ===");
            console.error("merchantTxnNo:", merchantTxnNo, "| session_id:", session.session_id);
            console.error("Error:", err);
            console.error("ACTION NEEDED: customer was charged, verify and create order manually or refund.");
            console.error("=====================================================================");
            throw err;
        }

        await conn.query(
            `INSERT INTO payments
                (order_id, user_id, gateway_name, transaction_id, gateway_payment_id, merchant_txn_no, merchant_id,
                 aggregator_id, bank_name, payment_mode, payment_inst_id, card_network, response_code,
                 response_description, amount, wallet_amount, gateway_amount, currency, payment_status, paid_at)
             VALUES (?, ?, 'ICICI_BANK', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?, 'INR', 'Success', NOW())`,
            [
                orderId,
                session.user_id,
                params.txnID || null,
                params.paymentID || null,
                merchantTxnNo,
                params.merchantId || null,
                params.aggregatorID || null,
                params.bankName || "ICICI_BANK",
                params.paymentMode || null,
                params.paymentInstId || null,
                params.cardNetwork || null,
                responseCode || null,
                params.respDescription || null,
                session.grand_total,
                session.grand_total,
            ]
        );

        await conn.query(
            `UPDATE payment_sessions SET status = 'Success', order_id = ? WHERE session_id = ?`,
            [orderId, session.session_id]
        );

        emailService.sendOrderPlacedEmails(orderId);

        return res.redirect(`${frontendUrl}/checkout/payment-result?status=success&orderNumber=${orderNumber}`);
    } finally {
        conn.release();
    }
});

// 3. Cashfree redirects or sends webhooks here. We verify directly against Cashfree server.
const cashfreeCallback = catchAsync(async (req, res) => {
    const merchantTxnNo = req.query.order_id || req.body?.order_id || req.body?.data?.order?.order_id;
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

    if (!merchantTxnNo) {
        console.error("Cashfree callback missing order_id / merchantTxnNo");
        return res.redirect(`${frontendUrl}/checkout/payment-result?status=failed&reason=missing_txn_no`);
    }

    const verification = await cashfreePayment.verifyPayment(merchantTxnNo);
    const isSuccess = verification && verification.isSuccess;

    const conn = await pool.getConnection();
    try {
        const [rows] = await conn.query(
            `SELECT * FROM payment_sessions WHERE merchant_txn_no = ? FOR UPDATE`,
            [merchantTxnNo]
        );

        if (rows.length === 0) {
            // Check if it's a Wallet Topup
            const [topupRows] = await conn.query(
                `SELECT * FROM wallet_topups WHERE merchant_txn_no = ? FOR UPDATE`,
                [merchantTxnNo]
            );

            if (topupRows.length > 0) {
                const topup = topupRows[0];
                if (topup.status !== "PENDING") {
                    return res.redirect(`${frontendUrl}/profile/wallet?recharge=${topup.status.toLowerCase()}`);
                }
                if (!isSuccess) {
                    await conn.query(`UPDATE wallet_topups SET status = 'FAILED' WHERE topup_id = ?`, [topup.topup_id]);
                    return res.redirect(`${frontendUrl}/profile/wallet?recharge=failed`);
                }
                const walletService = require("../services/wallet.service");
                try {
                    await walletService.completeRecharge(topup.user_id, topup.topup_id);
                    return res.redirect(`${frontendUrl}/profile/wallet?recharge=success`);
                } catch (err) {
                    console.error("Wallet recharge completion failed:", err);
                    return res.redirect(`${frontendUrl}/profile/wallet?recharge=failed`);
                }
            }

            console.error("Cashfree callback: no matching session for merchantTxnNo", merchantTxnNo);
            return res.redirect(`${frontendUrl}/checkout/payment-result?status=failed&reason=session_not_found`);
        }

        const session = rows[0];

        if (session.status !== "Initiated") {
            if (session.status === "Success" && session.order_id) {
                const [[order]] = await conn.query(
                    `SELECT order_number FROM orders WHERE order_id = ?`,
                    [session.order_id]
                );
                return res.redirect(
                    `${frontendUrl}/checkout/payment-result?status=success&orderNumber=${order?.order_number || ""}`
                );
            }
            return res.redirect(`${frontendUrl}/checkout/payment-result?status=failed`);
        }

        if (!isSuccess) {
            console.error("=== Cashfree CALLBACK: payment not SUCCESS ===");
            console.error("merchantTxnNo:", merchantTxnNo, "| verification:", JSON.stringify(verification, null, 2));
            console.error("================================================");
            await conn.query(
                `UPDATE payment_sessions SET status = 'Failed', response_code = ?, response_description = ? WHERE session_id = ?`,
                [verification.status || "FAILED", "Payment not marked SUCCESS by Cashfree", session.session_id]
            );
            return res.redirect(`${frontendUrl}/checkout/payment-result?status=failed`);
        }

        const cart = typeof session.cart_json === 'string'
            ? JSON.parse(session.cart_json)
            : session.cart_json;

        const orderData = {
            userId: session.user_id,
            addressId: session.address_id,
            name: session.customer_name,
            mobile: session.customer_mobile,
            email: session.customer_email || null,
            address: session.shipping_address,
            subtotal: session.subtotal,
            shippingFee: session.shipping_fee,
            grandTotal: session.grand_total,
            orderNumber: session.merchant_txn_no,
        };
        const { orderId, orderNumber } = await orderService.createOrder(orderData, cart);

        await conn.query(
            `INSERT INTO payments
                (order_id, user_id, gateway_name, transaction_id, gateway_payment_id, merchant_txn_no, merchant_id,
                 aggregator_id, bank_name, payment_mode, payment_inst_id, card_network, response_code,
                 response_description, amount, wallet_amount, gateway_amount, currency, payment_status, paid_at)
             VALUES (?, ?, 'CASHFREE', ?, ?, ?, ?, NULL, 'CASHFREE', ?, NULL, NULL, ?, ?, ?, 0.00, ?, 'INR', 'Success', NOW())`,
            [
                orderId,
                session.user_id,
                verification.transactionId || null,
                verification.gatewayPaymentId || null,
                merchantTxnNo,
                process.env.CASHFREE_APP_ID || null,
                verification.paymentMode || session.payment_mode || null,
                verification.status || "SUCCESS",
                "Verified Cashfree Payment",
                session.grand_total,
                session.grand_total,
            ]
        );

        await conn.query(
            `UPDATE payment_sessions SET status = 'Success', order_id = ? WHERE session_id = ?`,
            [orderId, session.session_id]
        );

        emailService.sendOrderPlacedEmails(orderId);

        return res.redirect(`${frontendUrl}/checkout/payment-result?status=success&orderNumber=${orderNumber}`);
    } finally {
        conn.release();
    }
});

// Instamojo verify handler (called by frontend on client-side success)
const instamojoVerify = catchAsync(async (req, res) => {
    const { merchantTxnNo, paymentRequestId, paymentId } = req.body;
    
    if (!merchantTxnNo || !paymentRequestId || !paymentId) {
        return errorRes(res, "Missing required parameters for verification", 400);
    }

    const verification = await instamojoPayment.verifyPayment(paymentRequestId, paymentId);
    const isSuccess = verification && verification.isSuccess;

    const conn = await pool.getConnection();
    try {
        const [rows] = await conn.query(
            `SELECT * FROM payment_sessions WHERE merchant_txn_no = ? FOR UPDATE`,
            [merchantTxnNo]
        );

        if (rows.length === 0) {
            console.error("Instamojo verification: no matching session for merchantTxnNo", merchantTxnNo);
            return errorRes(res, "Payment session not found", 404);
        }

        const session = rows[0];

        if (session.status !== "Initiated") {
            if (session.status === "Success" && session.order_id) {
                const [[order]] = await conn.query(
                    `SELECT order_number FROM orders WHERE order_id = ?`,
                    [session.order_id]
                );
                return successRes(res, "Order already processed", { success: true, orderNumber: order?.order_number || "" }, null, 200);
            }
            return errorRes(res, "Session already processed or failed", 400);
        }

        if (!isSuccess) {
            console.error("=== Instamojo VERIFICATION: payment not SUCCESS ===");
            console.error("merchantTxnNo:", merchantTxnNo, "| verification:", JSON.stringify(verification, null, 2));
            console.error("=====================================================");
            await conn.query(
                `UPDATE payment_sessions SET status = 'Failed', response_code = ?, response_description = ? WHERE session_id = ?`,
                [verification.status || "FAILED", "Payment not verified by Instamojo server", session.session_id]
            );
            return errorRes(res, "Payment verification failed", 400);
        }

        const cart = typeof session.cart_json === 'string'
            ? JSON.parse(session.cart_json)
            : session.cart_json;

        const orderData = {
            userId: session.user_id,
            addressId: session.address_id,
            name: session.customer_name,
            mobile: session.customer_mobile,
            email: session.customer_email || null,
            address: session.shipping_address,
            subtotal: session.subtotal,
            shippingFee: session.shipping_fee,
            grandTotal: session.grand_total,
            orderNumber: session.merchant_txn_no,
        };
        const { orderId, orderNumber } = await orderService.createOrder(orderData, cart);

        await conn.query(
            `INSERT INTO payments
                (order_id, user_id, gateway_name, transaction_id, gateway_payment_id, merchant_txn_no, merchant_id,
                 aggregator_id, bank_name, payment_mode, payment_inst_id, card_network, response_code,
                 response_description, amount, wallet_amount, gateway_amount, currency, payment_status, paid_at)
             VALUES (?, ?, 'INSTAMOJO', ?, ?, ?, ?, NULL, 'INSTAMOJO', ?, NULL, NULL, ?, ?, ?, 0.00, ?, 'INR', 'Success', NOW())`,
            [
                orderId,
                session.user_id,
                verification.transactionId || paymentRequestId,
                paymentId,
                merchantTxnNo,
                null, // merchant_id
                verification.paymentMode || session.payment_mode || null,
                verification.status || "SUCCESS",
                "Verified Instamojo Payment",
                session.grand_total,
                session.grand_total,
            ]
        );

        await conn.query(
            `UPDATE payment_sessions SET status = 'Success', order_id = ? WHERE session_id = ?`,
            [orderId, session.session_id]
        );

        emailService.sendOrderPlacedEmails(orderId);

        return successRes(res, "Payment verified successfully", { success: true, orderNumber }, null, 200);
    } catch (err) {
        console.error("Instamojo verification error:", err);
        return errorRes(res, "Internal server error during verification", 500);
    } finally {
        conn.release();
    }
});

// Admin: Get currently active payment gateway setting
const getGatewaySettings = catchAsync(async (req, res) => {
    await pool.query(`CREATE TABLE IF NOT EXISTS store_settings (
        setting_key VARCHAR(50) PRIMARY KEY,
        setting_value VARCHAR(255) NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);
    const [rows] = await pool.query("SELECT setting_value FROM store_settings WHERE setting_key = 'active_gateway'");
    let activeGateway = "CASHFREE";
    if (rows && rows.length > 0) {
        activeGateway = rows[0].setting_value.toUpperCase();
    } else {
        await pool.query("INSERT IGNORE INTO store_settings (setting_key, setting_value) VALUES ('active_gateway', 'CASHFREE')");
    }
    return successRes(res, "Retrieved gateway settings", { activeGateway }, null, 200);
});

// Admin: Update active payment gateway setting
const updateGatewaySettings = catchAsync(async (req, res) => {
    const { activeGateway } = req.body;
    const gateways = activeGateway.toUpperCase().split(",").map(g => g.trim());
    const valid = gateways.every(g => ["CASHFREE", "ICICI", "ICICI_BANK", "INSTAMOJO", "BOTH", "MULTIPLE"].includes(g));
    if (!activeGateway || !valid) {
        return errorRes(res, "Invalid gateway selection.", 400);
    }
    // Normalize legacy BOTH/MULTIPLE to just CASHFREE,ICICI for backward compat if they specifically passed BOTH
    let normalized = activeGateway.toUpperCase();
    if (normalized === "BOTH" || normalized === "MULTIPLE") {
        normalized = "CASHFREE,ICICI";
    }
    if (normalized === "ICICI_BANK") {
        normalized = "ICICI";
    }
    await pool.query(`CREATE TABLE IF NOT EXISTS store_settings (
        setting_key VARCHAR(50) PRIMARY KEY,
        setting_value VARCHAR(255) NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);
    await pool.query("INSERT INTO store_settings (setting_key, setting_value) VALUES ('active_gateway', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)", [normalized]);
    return successRes(res, "Payment gateway updated successfully", { activeGateway: normalized }, null, 200);
});

module.exports = { initiatePayment, paymentCallback, cashfreeCallback, instamojoVerify, getGatewaySettings, updateGatewaySettings };