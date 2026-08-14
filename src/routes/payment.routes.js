const express = require("express");
const router = express.Router();
const { initiatePayment, paymentCallback, cashfreeCallback, instamojoVerify, getGatewaySettings, updateGatewaySettings } = require("../controllers/payment.controller");

router.post("/initiate", initiatePayment);

// ICICI form-POSTs here after the customer completes/cancels payment
router.post("/callback", paymentCallback);
router.get("/callback", paymentCallback);

// Cashfree redirects / webhooks here after completion
router.post("/cashfree/callback", cashfreeCallback);
router.get("/cashfree/callback", cashfreeCallback);

// Instamojo seamless checkout frontend verification endpoint
router.post("/instamojo/verify", instamojoVerify);


// Gateway configuration endpoints
router.get("/settings", getGatewaySettings);
router.get("/admin/settings", getGatewaySettings);
router.put("/admin/settings", updateGatewaySettings);

module.exports = router;
