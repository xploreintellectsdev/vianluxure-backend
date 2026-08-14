const crypto = require("crypto");

// UAT (test) vs production sale URL — see "URLs" chapter of the ICICI
// Interface Specification Document. Respects ICICI_SALE_URL if set;
// otherwise falls back based on ICICI_ENV=production, defaulting to UAT.
const SALE_URL =
    process.env.ICICI_SALE_URL ||
    (process.env.ICICI_ENV === "production"
        ? "https://pgpay.icicibank.com/pg/api/v2/initiateSale"
        : "https://pgpayuat.icicibank.com/tsp/pg/api/v2/initiateSale");

/**
 * Hash Calculation (V1) — used for the initiateSale JSON request and for
 * verifying the form-posted payment response callback.
 * Per the ICICI spec: sort all non-null/non-empty parameter values by key
 * name, concatenate the values (not the keys), HMAC-SHA256 with the secret
 * key, hex-encode, lowercase.
 */
const generateHash = (params, secretKey) => {
    const concatenated = Object.keys(params)
        .sort()
        .filter((key) => params[key] !== null && params[key] !== undefined && params[key] !== "")
        .map((key) => String(params[key]))
        .join("");

    return crypto.createHmac("sha256", secretKey).update(concatenated, "utf8").digest("hex").toLowerCase();
};

// ICICI wants txnDate as YYYYMMDDHHMMSS
const formatTxnDate = (date = new Date()) => {
    const pad = (n) => String(n).padStart(2, "0");
    return (
        `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
        `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
    );
};

/**
 * Calls ICICI's initiateSale API in Standard/Redirect mode (payType "0").
 * ICICI's own hosted page collects card/net-banking/UPI/wallet details, so
 * no card data ever touches our server — we only get back a redirect URL.
 *
 * paymentMode restricts which instrument ICICI's hosted page offers:
 * "CARD" | "NB" (net banking) | "WALLET" | "UPI". Pass undefined/null to
 * let the customer pick from all of them on ICICI's page.
 */
const initiateSale = async ({ merchantTxnNo, amount, paymentMode, customerEmail, customerMobile }) => {
    const merchantId = process.env.ICICI_MERCHANT_ID;
    const secretKey = process.env.ICICI_SECRET_KEY;
    // Accept either name — some setups call this ICICI_CALLBACK_URL instead.
    const returnURL = process.env.ICICI_RETURN_URL || process.env.ICICI_CALLBACK_URL;

    if (!merchantId || !secretKey || !returnURL) {
        throw new Error("ICICI_MERCHANT_ID, ICICI_SECRET_KEY, and ICICI_RETURN_URL (or ICICI_CALLBACK_URL) must be set in .env");
    }

    const params = {
        merchantId,
        merchantTxnNo,
        amount: Number(amount).toFixed(2),
        currencyCode: "356", // INR, fixed per spec
        payType: "0", // Standard mode (redirect) — see ISD Chapter 1
        aggregatorID: process.env.ICICI_AGGREGATOR_ID || undefined,
        customerEmailID: customerEmail || "guest@vianluxure.com",
        transactionType: "SALE",
        returnURL,
        txnDate: formatTxnDate(),
        customerMobileNo: customerMobile || undefined,
        paymentMode: paymentMode || undefined,
    };

    const secureHash = generateHash(params, secretKey);
    const payload = { ...params, secureHash };

    const response = await fetch(SALE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    let data;
    try {
        data = await response.json();
    } catch (e) {
        const rawText = await response.text();
        console.error("ICICI Gateway returned non-JSON response:", rawText);
        throw new Error("ICICI Gateway returned an invalid response (not JSON)");
    }
    
    return data;
};

/**
 * Verifies the secureHash on a callback payload (the payment response
 * ICICI form-POSTs back to our returnURL). Per the spec, only the POSTed
 * parameters are hashed — query params are excluded, which is naturally
 * true here since we only ever read req.body for this.
 */
const verifyCallback = (callbackParams, secretKey) => {
    const { secureHash, ...rest } = callbackParams;
    if (!secureHash) return false;
    return generateHash(rest, secretKey) === String(secureHash).toLowerCase();
};

/**
 * Initiates a refund via ICICI Command URL.
 * Per ICICI ISD: command = "REFUND", with the original merchantTxnNo,
 * the txnID returned by ICICI, and the refund amount.
 */
const initiateRefund = async ({ merchantTxnNo, txnID, amount }) => {
    const merchantId = process.env.ICICI_MERCHANT_ID;
    const secretKey = process.env.ICICI_SECRET_KEY;
    const commandUrl = process.env.ICICI_COMMAND_URL;

    if (!merchantId || !secretKey || !commandUrl) {
        throw new Error("ICICI_MERCHANT_ID, ICICI_SECRET_KEY, and ICICI_COMMAND_URL must be set in .env");
    }

    const params = {
        merchantId,
        merchantTxnNo,
        txnID,
        amount: Number(amount).toFixed(2),
        currencyCode: "356",
        transactionType: "REFUND",
        txnDate: formatTxnDate(),
    };

    const secureHash = generateHash(params, secretKey);
    const payload = { ...params, secureHash };

    const response = await fetch(commandUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    let data;
    try {
        data = await response.json();
    } catch (e) {
        const rawText = await response.text();
        console.error("ICICI Refund: non-JSON response:", rawText);
        throw new Error("ICICI Refund gateway returned an invalid response");
    }

    const isSuccess = data?.responseCode === 'R1000' || data?.responseCode === '000';
    const statusText = isSuccess ? 'SUCCESS' : 'FAILED';

    console.log("\nICICI Refund");
    console.log(`ICICI Refund URL: ${commandUrl}`);
    console.log("Request Payload:");
    console.log(JSON.stringify({
        refundTxnNo: merchantTxnNo,
        originalTxnId: txnID,
        amount: Number(amount).toFixed(2)
    }, null, 2));
    console.log(`HTTP Status: ${response.status} ${response.statusText || 'OK'}`);
    console.log("Complete Response Body:");
    console.log(JSON.stringify(data, null, 2));
    console.log(`Refund Reference Number: ${data.merchantTxnNo || merchantTxnNo}`);
    console.log(`Refund Status: ${statusText}`);
    console.log(`Gateway Transaction ID: ${data.txnID || 'N/A'}`);
    console.log("==================================================");

    return data;
};

module.exports = { generateHash, formatTxnDate, initiateSale, verifyCallback, initiateRefund };