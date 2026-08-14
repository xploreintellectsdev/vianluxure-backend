const axios = require("axios");

const getBaseUrl = () => {
    const env = process.env.INSTAMOJO_ENV || "PRODUCTION";
    return env.toUpperCase() === "SANDBOX" || env.toUpperCase() === "TEST"
        ? "https://test.instamojo.com/api/1.1"
        : "https://www.instamojo.com/api/1.1";
};

const getHeaders = () => {
    const apiKey = process.env.INSTAMOJO_API_KEY;
    const authToken = process.env.INSTAMOJO_AUTH_TOKEN;

    if (!apiKey || !authToken) {
        throw new Error("INSTAMOJO_API_KEY and INSTAMOJO_AUTH_TOKEN must be set in .env");
    }

    return {
        "X-Api-Key": apiKey,
        "X-Auth-Token": authToken,
        "Content-Type": "application/x-www-form-urlencoded",
    };
};

/**
 * Initiates a payment session using Instamojo Payment Requests API.
 * Returns checkoutUrl which opens Instamojo's seamless hosted checkout web screen.
 */
const initiateSale = async ({ merchantTxnNo, amount, customerEmail, customerMobile, customerName }) => {
    // Ensure phone number contains 10 digits as required by gateway specs
    let cleanPhone = String(customerMobile || "9999999999").replace(/[^0-9]/g, "");
    if (cleanPhone.length > 10 && cleanPhone.startsWith("91")) {
        cleanPhone = cleanPhone.slice(-10);
    }
    if (cleanPhone.length !== 10) {
        cleanPhone = "9999999999"; // Fallback if mobile is malformed or guest
    }

    // Instamojo API requires URL encoded form data
    const payload = new URLSearchParams();
    payload.append("purpose", `Vian Luxure Order ${merchantTxnNo}`);
    payload.append("amount", parseFloat(Number(amount).toFixed(2)));
    payload.append("buyer_name", customerName || "Vian Luxure Customer");
    payload.append("email", customerEmail && !customerEmail.includes("guest@") ? customerEmail : (customerEmail || "customer@vianluxure.com"));
    payload.append("phone", cleanPhone);
    payload.append("send_email", "false");
    payload.append("send_sms", "false");
    payload.append("allow_repeated_payments", "false");

    try {
        const response = await axios.post(`${getBaseUrl()}/payment-requests/`, payload, { headers: getHeaders() });
        const data = response.data;

        if (!data || !data.success || !data.payment_request || !data.payment_request.longurl) {
            throw new Error("Failed to retrieve longurl from Instamojo response.");
        }

        return {
            success: true,
            paymentRequestId: data.payment_request.id,
            checkoutUrl: data.payment_request.longurl,
            gatewayResponse: data,
        };
    } catch (error) {
        const errorData = error.response?.data;
        console.error("Instamojo initiateSale error:", errorData || error.message);
        
        let errorMessage = "Instamojo payment initiation failed.";
        if (errorData && errorData.message) {
            if (typeof errorData.message === 'string') {
                errorMessage = errorData.message;
            } else if (typeof errorData.message === 'object') {
                // Instamojo returns validation errors as objects, e.g. { amount: ['Amount cannot be less than INR 9.00.'] }
                errorMessage = Object.values(errorData.message).flat().join(" ");
            }
        }
        throw new Error(errorMessage);
    }
};

/**
 * Verifies payment status by directly interrogating Instamojo server.
 * Prevents spoofing or unauthorized tampering by never relying solely on frontend success callback.
 */
const verifyPayment = async (paymentRequestId, paymentId) => {
    if (!paymentId) return { isSuccess: false, status: "MISSING_PARAMS" };

    try {
        // We directly query the payment endpoint to avoid race conditions 
        // where the payment_request hasn't yet updated with the payments array.
        const url = `${getBaseUrl()}/payments/${paymentId}/`;
        const headers = getHeaders();
        delete headers["Content-Type"];

        const response = await axios.get(url, { headers });
        const data = response.data;

        if (!data || !data.success || !data.payment) {
            return { isSuccess: false, error: "Invalid response from Instamojo API" };
        }

        const payment = data.payment;
        const isSuccess = payment.status === "Credit";

        return {
            isSuccess,
            status: isSuccess ? "SUCCESS" : payment.status,
            amount: payment.amount,
            gatewayPaymentId: payment.payment_id,
            paymentRequestId: paymentRequestId || "UNKNOWN",
            paymentMode: payment.instrument_type || "INSTAMOJO",
            raw: data,
        };
    } catch (error) {
        console.error(`Instamojo verification failed for ${paymentId}:`, error.response?.data || error.message);
        return { isSuccess: false, error: error.message };
    }
};

/**
 * Initiates a refund via Instamojo Refund API
 */
const initiateRefund = async ({ paymentId, amount, reason = "Customer requested refund" }) => {
    try {
        const payload = new URLSearchParams();
        payload.append("payment_id", paymentId);
        payload.append("type", "QFL"); // Quality issue/Customer requested
        payload.append("body", reason);
        payload.append("refund_amount", parseFloat(Number(amount).toFixed(2)));

        const response = await axios.post(`${getBaseUrl()}/refunds/`, payload, { headers: getHeaders() });
        return { success: true, data: response.data };
    } catch (error) {
        console.error("Instamojo initiateRefund failed:", error.response?.data || error.message);
        throw new Error(error.response?.data?.message || "Instamojo refund failed.");
    }
};

module.exports = { initiateSale, verifyPayment, initiateRefund };
