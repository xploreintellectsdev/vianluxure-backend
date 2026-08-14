const orderService = require('../services/order.service');
const delhiveryService = require('../services/delhivery.service');
const shiprocketService = require('../services/shiprocket.service');
const iciciPaymentService = require('../services/iciciPayment.service');
const cashfreePaymentService = require('../services/cashfreePayment.service');
const walletService = require('../services/wallet.service');
const emailService = require('../services/email.service');
const invoiceService = require('../services/invoice.service');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool } = require('../config/db');
const { successRes, errorRes } = require('../utils/response');
const catchAsync = require('../utils/catchAsync');

const placeOrder = catchAsync(async (req, res) => {
    const { customer, cart, totals, addressId } = req.body;

    if (!cart || cart.length === 0) {
        return errorRes(res, "Cart is empty", 400);
    }

    let userId = req.user?.user_id || null;

    const orderData = {
        userId: userId,
        addressId: addressId || null,
        name: customer.name,
        mobile: customer.phone,
        email: customer?.email || null,
        address: customer.address,
        subtotal: totals.subtotal,
        shippingFee: totals.shippingFee,
        grandTotal: totals.grandTotal
    };

    const result = await orderService.createOrder(orderData, cart);
    emailService.sendOrderPlacedEmails(result.orderId);
    return successRes(res, "Order placed successfully", result, null, 201);
});

// Admin Controllers
const getOrders = catchAsync(async (req, res) => {
    const { page = 1, limit = 10, search = '', productType = null, startDate, endDate } = req.query;

    const { rows, total } = await orderService.getAllOrders({
        page: Number(page),
        limit: Number(limit),
        search,
        productType,
        startDate,
        endDate
    });

    return successRes(res, "Orders fetched successfully", rows, { total });
});

const getOrderDetails = catchAsync(async (req, res) => {
    const order = await orderService.getOrderById(req.params.id);
    if (!order) return errorRes(res, "Order not found", 404);
    return successRes(res, "Order details fetched successfully", order);
});

const updateStatus = catchAsync(async (req, res) => {
    const { order_status } = req.body;
    const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    
    if (!validStatuses.includes(order_status)) {
        return errorRes(res, "Invalid order status", 400);
    }

    const success = await orderService.updateOrderStatus(req.params.id, order_status);
    if (!success) return errorRes(res, "Order not found", 404);

    return successRes(res, "Order status updated", { order_id: req.params.id, order_status });
});

const getOrderDetailsByNumber = catchAsync(async (req, res) => {
    const order = await orderService.getOrderByNumber(req.params.orderNumber);
    if (!order) return errorRes(res, "Order not found", 404);

    let email = order.customer_email || order.email || null;
    if (email && email.includes("@guest.vianluxure.com")) {
        email = null;
    }

    const isGuest = !order.user_id || Boolean(order.user_is_guest) || (order.email && order.email.includes("guest.vianluxure.com")) || !email;

    return successRes(res, "Order details fetched successfully", {
        orderNumber: order.order_number,
        paymentStatus: order.payment_status || 'Pending',
        paymentMethod: order.payment_mode || 'Online',
        amountPaid: order.grand_total,
        expectedDelivery: '3 - 5 Business Days',
        userId: order.user_id || null,
        email: email,
        name: order.customer_name || order.address_full_name || null,
        mobile: order.customer_mobile || order.address_mobile || null,
        isGuest: isGuest
    });
});
const getMyOrders = catchAsync(async (req, res) => {
    if (!req.user || !req.user.user_id) {
        return errorRes(res, "Unauthorized", 401);
    }
    const orders = await orderService.getOrdersByUserId(req.user.user_id, req.user.mobile, req.user.email);
    return successRes(res, "Orders fetched successfully", orders);
});

const cancelOrder = catchAsync(async (req, res) => {
    const { orderId } = req.params;
    // refundMethod: "WALLET" (always for wallet-paid) | "GATEWAY" (back via ICICI) | undefined (no paid order)
    const { refundMethod } = req.body;

    if (!req.user || !req.user.user_id) {
        return errorRes(res, "Unauthorized", 401);
    }

    const [orderRows] = await pool.query('SELECT * FROM orders WHERE order_id = ? AND user_id = ?', [orderId, req.user.user_id]);
    if (orderRows.length === 0) {
        return errorRes(res, "Order not found", 404);
    }
    const order = orderRows[0];

    // Status check
    const nonCancellable = ['ON_THE_WAY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
    const currentStatus = (order.order_status || '').toUpperCase();
    if (nonCancellable.includes(currentStatus)) {
        return errorRes(res, `Cannot cancel order in status: ${order.order_status}`, 400);
    }

    // Fetch payment record
    const [paymentRows] = await pool.query(
        `SELECT * FROM payments WHERE order_id = ? ORDER BY payment_id DESC LIMIT 1`,
        [orderId]
    );
    const payment = paymentRows[0] || null;

    // Check if shipment exists
    const [shipmentRows] = await pool.query('SELECT * FROM shipment_details WHERE order_id = ?', [orderId]);
    const shipment = shipmentRows[0];

    if (shipment && shipment.awb_number) {
        try {
            if (shipment.carrier === 'SHIPROCKET') {
                await shiprocketService.cancelShiprocketShipment(shipment.shiprocket_order_id, shipment.awb_number);
            } else {
                await delhiveryService.cancelDelhiveryShipment(shipment.awb_number);
            }
        } catch (error) {
            console.error("Failed to cancel shipment during order cancellation:", error.message);
            return errorRes(res, "Failed to cancel the dispatched shipment with our courier partner. Please contact support.", 500);
        }
    }

    // --- Update DB status ---
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        await connection.query(
            `UPDATE orders SET order_status = 'CANCELLED', refund_method = ?, updated_at = NOW() WHERE order_id = ?`,
            [refundMethod || null, orderId]
        );

        await orderService.restoreOrderStock(orderId, connection);

        if (shipment && shipment.awb_number) {
            await connection.query(
                `UPDATE shipment_details SET shipment_status = 'CANCELLED', updated_at = NOW() WHERE order_id = ?`,
                [orderId]
            );
        }

        const cancelRemarks = refundMethod
            ? `Order cancelled by customer. Refund method: ${refundMethod}`
            : 'Order cancelled by customer (no payment to refund)';

        await connection.query(
            `INSERT INTO order_status_history (order_id, status, remarks, created_at) VALUES (?, 'CANCELLED', ?, NOW())`,
            [orderId, cancelRemarks]
        );

        await connection.commit();
        emailService.sendOrderCancelledEmails(orderId, cancelRemarks);
    } catch (dbErr) {
        await connection.rollback();
        throw dbErr;
    } finally {
        connection.release();
    }

    // --- Process Refund via Gateway Bank Portal or Store Wallet ---
    const refundResult = await orderService.processOrderRefund(orderId, refundMethod || null);
    console.log("Final Refund Status");
    console.log(refundResult.status === 'success' ? 'SUCCESS' : (refundResult.status || 'FAILED'));
    console.log("=========================================================");

    return successRes(res, "Order cancelled successfully", { refund: refundResult });
});

const getOrderForInvoice = async (identifier) => {
    let order = await orderService.getOrderById(identifier);
    if (!order && isNaN(identifier)) {
        order = await orderService.getOrderByNumber(identifier);
    }
    return order;
};

const downloadInvoice = catchAsync(async (req, res) => {
    const order = await getOrderForInvoice(req.params.id);
    if (!order) return errorRes(res, "Order not found", 404);

    const pdfBuffer = await invoiceService.generateInvoicePdfBuffer(order);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice_${order.order_number || order.order_id}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.end(pdfBuffer);
});

const printInvoice = catchAsync(async (req, res) => {
    const order = await getOrderForInvoice(req.params.id);
    if (!order) return errorRes(res, "Order not found", 404);

    const pdfBuffer = await invoiceService.generateInvoicePdfBuffer(order);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Invoice_${order.order_number || order.order_id}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.end(pdfBuffer);
});

const getOrderStats = catchAsync(async (req, res) => {
    const stats = await orderService.getOrderStats();
    return successRes(res, "Order stats fetched successfully", stats);
});

module.exports = { placeOrder, getOrders, getOrderDetails, getOrderDetailsByNumber, updateStatus, getMyOrders, cancelOrder, downloadInvoice, printInvoice, getOrderStats };