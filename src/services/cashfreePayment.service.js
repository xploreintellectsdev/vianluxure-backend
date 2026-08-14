const axios = require("axios");

// Determine Cashfree Base URL based on environment
const getBaseUrl = () => {
    const env = process.env.CASHFREE_ENV || "SANDBOX";
    return env.toUpperCase() === "PRODUCTION"
        ? "https://api.cashfree.com/pg"
        : "https://sandbox.cashfree.com/pg";
};

// Common headers required by Cashfree PG API v3
const getHeaders = () => {
    const appId = process.env.CASHFREE_APP_ID;
    const secretKey = process.env.CASHFREE_SECRET_KEY;

    if (!appId || !secretKey) {
        throw new Error("CASHFREE_APP_ID and CASHFREE_SECRET_KEY must be set in .env");
    }

    return {
        "x-client-id": appId,
        "x-client-secret": secretKey,
        "x-api-version": "2023-08-01",
        "Content-Type": "application/json",
    };
};

/**
 * Initiates a payment session using Cashfree PG Orders API (/pg/orders).
 * Returns payment_session_id which opens Cashfree's seamless hosted checkout web screen.
 */
const initiateSale = async ({ merchantTxnNo, amount, userId, customerEmail, customerMobile, customerName }) => {
    const baseReturnUrl = process.env.CASHFREE_CALLBACK_URL || `${process.env.FRONTEND_URL || "http://localhost:3000"}/api/payment/cashfree/callback`;
    let fullReturnUrl = `${baseReturnUrl}?order_id=${merchantTxnNo}`;

    // Cashfree Live API strictly requires an HTTPS return_url.
    // If running locally on unencrypted http:// (e.g. during localhost testing),
    // wrap the callback in an HTTPS redirect relay so Cashfree API validation passes seamlessly
    // and correctly brings the user back to local development server after checkout.
    if (!fullReturnUrl.startsWith("https://")) {
        fullReturnUrl = `https://postman-echo.com/redirect-to?url=${encodeURIComponent(fullReturnUrl)}`;
    }

    // Ensure phone number contains 10 digits as required by gateway specs
    let cleanPhone = String(customerMobile || "9999999999").replace(/[^0-9]/g, "");
    if (cleanPhone.length > 10 && cleanPhone.startsWith("91")) {
        cleanPhone = cleanPhone.slice(-10);
    }
    if (cleanPhone.length !== 10) {
        cleanPhone = "9999999999"; // Fallback if mobile is malformed or guest
    }

    const payload = {
        order_id: merchantTxnNo,
        order_amount: parseFloat(Number(amount).toFixed(2)),
        order_currency: "INR",
        customer_details: {
            customer_id: userId ? `VIAN_${userId}` : (cleanPhone !== "9999999999" ? `CUST_${cleanPhone}` : `CUST_${Date.now()}`),
            customer_phone: cleanPhone,
            customer_email: customerEmail && !customerEmail.includes("guest@") ? customerEmail : (customerEmail || "customer@vianluxure.com"),
            customer_name: customerName || "Vian Luxure Customer",
        },
        order_meta: {
            return_url: fullReturnUrl,
        },
        order_note: `Vian Luxure - Order ${merchantTxnNo}`,
    };

    try {
        const response = await axios.post(`${getBaseUrl()}/orders`, payload, { headers: getHeaders() });
        const data = response.data;

        if (!data || !data.payment_session_id) {
            throw new Error("Failed to retrieve payment_session_id from Cashfree response.");
        }

        return {
            success: true,
            paymentSessionId: data.payment_session_id,
            orderId: data.order_id,
            cfOrderId: data.cf_order_id,
            redirectUrl: data.payment_link || null,
            gatewayResponse: data,
        };
    } catch (error) {
        console.error("Cashfree initiateSale error:", error.response?.data || error.message);
        throw new Error(error.response?.data?.message || "Cashfree payment initiation failed.");
    }
};

/**
 * Verifies payment status by directly interrogating Cashfree server via orders & payments endpoints.
 * Prevents spoofing or unauthorized tampering by never relying solely on callback parameters.
 */
const verifyPayment = async (merchantTxnNo) => {
    if (!merchantTxnNo) return { isSuccess: false, status: "MISSING_TXN_NO" };

    try {
        const url = `${getBaseUrl()}/orders/${merchantTxnNo}`;
        const response = await axios.get(url, { headers: getHeaders() });
        const data = response.data;

        const isSuccess = data.order_status === "PAID" || data.order_status === "SUCCESS";

        let txnDetails = {};
        if (isSuccess) {
            try {
                // Fetch completed payment attempt details for rich receipt data
                const paymentsRes = await axios.get(`${getBaseUrl()}/orders/${merchantTxnNo}/payments`, { headers: getHeaders() });
                if (paymentsRes.data && paymentsRes.data.length > 0) {
                    const successfulPayment = paymentsRes.data.find((p) => p.payment_status === "SUCCESS") || paymentsRes.data[0];
                    txnDetails = {
                        cf_payment_id: successfulPayment.cf_payment_id || null,
                        payment_method: successfulPayment.payment_group || successfulPayment.payment_method?.type || "CASHFREE",
                        transaction_id: successfulPayment.cf_payment_id || merchantTxnNo,
                    };
                }
            } catch (err) {
                console.warn("Could not fetch detailed order payments:", err.message);
            }
        }

        return {
            isSuccess,
            status: data.order_status,
            amount: data.order_amount,
            merchantTxnNo,
            gatewayPaymentId: txnDetails.cf_payment_id || data.cf_order_id || null,
            transactionId: txnDetails.transaction_id || data.cf_order_id || merchantTxnNo,
            paymentMode: typeof txnDetails.payment_method === "string" ? txnDetails.payment_method : "CASHFREE",
            raw: data,
        };
    } catch (error) {
        console.error(`Cashfree verification failed for ${merchantTxnNo}:`, error.response?.data || error.message);
        return { isSuccess: false, error: error.message };
    }
};

/**
 * Initiates a refund via Cashfree Refund API
 */
const initiateRefund = async ({ merchantTxnNo, amount, refundId = `REF-${Date.now()}` }) => {
    try {
        const payload = {
            refund_amount: parseFloat(Number(amount).toFixed(2)),
            refund_id: refundId,
            refund_note: `Refund for order ${merchantTxnNo}`,
        };

        const response = await axios.post(`${getBaseUrl()}/orders/${merchantTxnNo}/refunds`, payload, { headers: getHeaders() });
        return { success: true, data: response.data };
    } catch (error) {
        console.error("Cashfree initiateRefund failed:", error.response?.data || error.message);
        throw new Error(error.response?.data?.message || "Cashfree refund failed.");
    }
};

module.exports = { initiateSale, verifyPayment, initiateRefund };
