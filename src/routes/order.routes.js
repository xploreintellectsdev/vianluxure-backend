const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

// Existing customer route
router.post('/checkout', orderController.placeOrder);
router.get('/my-orders', authenticateToken, orderController.getMyOrders);

// Admin routes (no auth applied yet)
router.get('/', orderController.getOrders);
router.get('/stats', orderController.getOrderStats);
router.get('/details/:orderNumber', orderController.getOrderDetailsByNumber);
router.get('/:id/invoice/download', orderController.downloadInvoice);
router.get('/:id/invoice/print', orderController.printInvoice);
router.get('/:id', orderController.getOrderDetails);
router.patch('/:id/status', orderController.updateStatus);
router.post('/:orderId/cancel', authenticateToken, orderController.cancelOrder);
    
module.exports = router;