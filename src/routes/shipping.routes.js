const express = require('express');
const router = express.Router();
const shippingController = require('../controllers/shipping.controller');

// Create Delhivery shipment (generate AWB)
router.post('/create', shippingController.createShipment);

// Get shipment tracking & timeline details
router.get('/track/:orderId', shippingController.getTrackingDetails);

// Manually sync shipment status with Delhivery API
router.post('/sync/:orderId', shippingController.syncShipment);

// Cancel Delhivery shipment
router.post('/cancel/:orderId', shippingController.cancelShipment);

module.exports = router;
