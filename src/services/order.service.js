const { pool } = require('../config/db');

const createOrder = async (orderData, cartItems) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        let orderNumber = orderData.orderNumber;
        if (!orderNumber || !orderNumber.startsWith('ORD-')) {
            await conn.query("SELECT GET_LOCK('order_number_generation', 10)");
            try {
                let nextId = 50000;
                const [orderRows] = await conn.query(`SELECT MAX(CAST(SUBSTRING_INDEX(order_number, '-', -1) AS UNSIGNED)) as max_num FROM orders WHERE order_number LIKE 'ORD-%'`);
                if (orderRows[0] && orderRows[0].max_num) nextId = Math.max(nextId, orderRows[0].max_num + 1);

                const [sessionRows] = await conn.query(`SELECT MAX(CAST(SUBSTRING_INDEX(merchant_txn_no, '-', -1) AS UNSIGNED)) as max_num FROM payment_sessions WHERE merchant_txn_no LIKE 'ORD-%'`);
                if (sessionRows[0] && sessionRows[0].max_num) nextId = Math.max(nextId, sessionRows[0].max_num + 1);

                orderNumber = `ORD-${nextId}`;
            } finally {
                await conn.query("SELECT RELEASE_LOCK('order_number_generation')");
            }
        }

        // 2. Insert into orders
        const orderQuery = `
            INSERT INTO orders (order_number, user_id, address_id, customer_name, customer_mobile, customer_email, shipping_address, subtotal, shipping_fee, grand_total)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const [orderResult] = await conn.query(orderQuery, [
            orderNumber, orderData.userId, orderData.addressId, orderData.name, orderData.mobile,
            orderData.email || null, orderData.address, orderData.subtotal, orderData.shippingFee, orderData.grandTotal
        ]);
        const orderId = orderResult.insertId;

        // 3. Insert Cart Items
        for (const item of cartItems) {
            const isFabric = item.type === 'fabric';
            const dbQuantity = isFabric ? 1 : (item.quantity || 1);
            const selectedMeter = isFabric ? item.quantity : null;

            const itemQuery = `
                INSERT INTO order_items (
                    order_id, pro_id, product_type, product_name, product_image,
                    quantity, selected_meter, unit_price, total_price,
                    selected_size, fit_style,
                    is_custom,
                    monogram_enabled, monogram_text, monogram_placement_id, monogram_color_id, monogram_font_id, monogram_price
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const [itemResult] = await conn.query(itemQuery, [
                orderId, item.pro_id || item.id, item.type, item.name, item.image,
                dbQuantity, selectedMeter, item.price, item.totalPrice,
                item.size || null, item.fit || null,
                item.isCustom ? 1 : 0,
                item.monogram?.enabled ? 1 : 0, item.monogram?.text ?? null,
                item.monogram?.placementId ?? null, item.monogram?.colorId ?? null, item.monogram?.fontId ?? null, item.monogram?.price ?? null,
            ]);
            const itemId = itemResult.insertId;

            // 4. Insert Bespoke Selections safely
            if (item.customizations && Array.isArray(item.customizations) && item.customizations.length > 0) {
                for (const cust of item.customizations) {
                    if (!cust.name) continue;
                    await conn.query(
                        `INSERT INTO order_bespoke_selections (order_item_id, option_type, option_name, option_price) VALUES (?, ?, ?, ?)`,
                        [itemId, cust.type || 'custom', cust.name, cust.price || 0]
                    );
                }
            }

            // 5. Deduct inventory from stock_master upon order creation
            const proId = item.pro_id || item.id;
            if (proId && !isNaN(proId)) {
                let stockType = null;
                let deductQty = 0;
                if (item.type === 'fabric' || item.type === 'made-to-wear' || item.type === 'bespoke') {
                    stockType = 'fabric';
                    deductQty = parseFloat(selectedMeter || item.quantity || 1);
                } else if (item.type === 'rtw' || item.type === 'ready_to_wear' || item.type === 'ready-to-wear') {
                    stockType = 'rtw';
                    deductQty = parseFloat(item.quantity || 1);
                }
                
                if (stockType && deductQty > 0) {
                    await conn.query(
                        `UPDATE stock_master SET quantity = GREATEST(0, quantity - ?), updated_at = NOW() WHERE pro_id = ? AND product_type = ?`,
                        [deductQty, Number(proId), stockType]
                    );
                }
            }
        }

        await conn.commit();
        return { orderId, orderNumber };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

// Valid values of order_items.product_type as written by the frontend cart
// (see fabric/ready-to-wear/made-to-wear/bespoke "add to cart" handlers).
const VALID_PRODUCT_TYPES = ['fabric', 'rtw', 'made-to-wear', 'bespoke'];

/**
 * A single order can have several payment attempts (retry after a failed
 * gateway redirect, etc). This subquery picks only the most recent payment
 * row per order_id so joins never duplicate an order.
 */
const LATEST_PAYMENT_JOIN = `
    LEFT JOIN (
        SELECT p1.*
        FROM payments p1
        INNER JOIN (
            SELECT order_id, MAX(payment_id) AS max_payment_id
            FROM payments
            GROUP BY order_id
        ) latest ON latest.order_id = p1.order_id AND latest.max_payment_id = p1.payment_id
    ) p ON p.order_id = o.order_id
`;

/**
 * Paginated, searchable order list for the admin panel, optionally scoped
 * to one product type (an order shows up under a type's tab if it contains
 * at least one line item of that type — a cart can mix types, so the same
 * order can legitimately appear under more than one tab).
 *
 * IMPORTANT: this used to INNER JOIN payments and require
 * payment_status = 'Success', which silently hid every order still sitting
 * at 'Pending' (or 'Failed') from every category tab — that was the root
 * cause of orders "not showing up" per type. Admins need to see and manage
 * orders regardless of payment status, so this is now a LEFT JOIN against
 * the latest payment row, with no status filter.
 */
const getAllOrders = async ({ page = 1, limit = 10, search = '', productType = null, startDate, endDate } = {}) => {
    const offset = (Math.max(1, Number(page)) - 1) * Number(limit);
    const searchTerm = `%${search}%`;

    let typeFilter = '';
    let dateFilter = '';
    const baseParams = [];

    if (productType === 'non_corporate') {
        typeFilter = "AND oi.product_type != 'corporate'";
    } else if (productType && VALID_PRODUCT_TYPES.includes(productType)) {
        typeFilter = 'AND oi.product_type = ?';
        baseParams.push(productType);
    }
    
    if (startDate) {
        dateFilter += ' AND DATE(o.created_at) >= ?';
        baseParams.push(startDate);
    }
    if (endDate) {
        dateFilter += ' AND DATE(o.created_at) <= ?';
        baseParams.push(endDate);
    }

    baseParams.push(searchTerm, searchTerm, searchTerm);

    const whereClause = `
        WHERE 1 = 1
        ${typeFilter}
        ${dateFilter}
        AND (o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_mobile LIKE ?)
    `;

    const countQuery = `
        SELECT COUNT(DISTINCT o.order_id) AS total
        FROM orders o
        INNER JOIN order_items oi ON oi.order_id = o.order_id
        ${whereClause}
    `;
    const [countRows] = await pool.query(countQuery, baseParams);
    const total = countRows[0]?.total || 0;

    // GROUP BY (not DISTINCT) because an order can have several order_items
    // rows matching the type filter (e.g. two fabric line items) — GROUP BY
    // o.order_id is the explicit, unambiguous way to say "one row per
    // order" once joins can fan out.
    const dataQuery = `
        SELECT
            o.order_id, o.order_number, o.customer_name, o.customer_mobile, o.customer_email,
            o.shipping_address, o.subtotal, o.shipping_fee,
            o.grand_total, o.order_status, o.created_at AS order_date,
            p.payment_status, p.payment_mode, p.gateway_name, p.transaction_id, p.card_network, p.bank_name,
            sd.carrier, sd.awb_number, sd.shipment_status, sd.tracking_url
        FROM orders o
        INNER JOIN order_items oi ON oi.order_id = o.order_id
        ${LATEST_PAYMENT_JOIN}
        LEFT JOIN shipment_details sd ON sd.order_id = o.order_id
        ${whereClause}
        GROUP BY
o.order_id,
o.order_number,
o.customer_name,
o.customer_mobile,
o.customer_email,
o.shipping_address,
o.subtotal,
o.shipping_fee,
o.grand_total,
o.order_status,
o.created_at,
p.payment_status,
p.payment_mode,
p.gateway_name,
p.transaction_id,
p.card_network,
p.bank_name,
sd.carrier,
sd.awb_number,
sd.shipment_status,
sd.tracking_url
        ORDER BY o.created_at DESC
        LIMIT ? OFFSET ?
    `;
    const [rows] = await pool.query(dataQuery, [...baseParams, Number(limit), offset]);

    return { rows, total };
};

const getOrderById = async (orderId) => {
    const orderQuery = `
        SELECT
            o.*, o.created_at AS order_date,
            p.payment_status, p.transaction_id, p.gateway_payment_id, p.payment_mode, p.gateway_name, p.card_network, p.bank_name, p.currency, p.paid_at,
            COALESCE(o.customer_email, u.email) AS user_email, COALESCE(o.customer_email, u.email) AS email, u.mobile AS user_mobile, u.is_guest AS user_is_guest,
            ua.full_name AS address_full_name, ua.mobile AS address_mobile,
            ua.house_building, ua.street_locality, ua.landmark,
            ua.city AS address_city, ua.state AS address_state,
            ua.postal_code AS address_postal_code, ua.country AS address_country
        FROM orders o
        ${LATEST_PAYMENT_JOIN}
        LEFT JOIN users u ON u.user_id = o.user_id
        LEFT JOIN user_addresses ua ON ua.address_id = o.address_id
        WHERE o.order_id = ?
    `;
    const [orderRows] = await pool.query(orderQuery, [orderId]);
    if (orderRows.length === 0) return null;

    const itemsQuery = `
        SELECT oi.*, 
            mp.placement_name AS monogram_placement_name, mp.placement_image AS monogram_placement_image,
            mc.color_name AS monogram_color_name, mc.color_image AS monogram_color_image,
            mf.font_name AS monogram_font_name, mf.font_preview_image AS monogram_font_preview_image
        FROM order_items oi
        LEFT JOIN monogram_placements mp ON oi.monogram_placement_id = mp.placement_id
        LEFT JOIN monogram_colors mc ON oi.monogram_color_id = mc.color_id
        LEFT JOIN monogram_fonts mf ON oi.monogram_font_id = mf.font_id
        WHERE oi.order_id = ? 
        ORDER BY oi.item_id
    `;
    const [items] = await pool.query(itemsQuery, [orderId]);

    if (items.length > 0) {
        const itemIds = items.map((i) => i.item_id);
        // Garment-design picks (collar/pocket/sleeve/button) for made-to-wear
        // and bespoke items. order_bespoke_selections only stores the option
        // name/price it was created with (not an option_id), so the image is
        // looked up by matching (option_type, option_name) back against
        // custom_options — the same table the checkout step pickers read
        // from. If an option was renamed/removed since, the image is simply
        // left null and the frontend shows a placeholder instead of failing.
        const [selections] = await pool.query(
            `SELECT bs.order_item_id, bs.option_type, bs.option_name, bs.option_price, co.option_image
             FROM order_bespoke_selections bs
             LEFT JOIN custom_options co
                ON co.option_type = bs.option_type AND co.option_name = bs.option_name
             WHERE bs.order_item_id IN (?)`,
            [itemIds]
        );

        const selectionsByItem = {};
        selections.forEach((s) => {
            (selectionsByItem[s.order_item_id] ||= []).push(s);
        });
        items.forEach((item) => {
            item.design_selections = selectionsByItem[item.item_id] || [];
        });
    }

    return { ...orderRows[0], items };
};

const restoreOrderStock = async (orderId, dbConn = pool) => {
    try {
        const [items] = await dbConn.query(`SELECT pro_id, product_type, quantity, selected_meter FROM order_items WHERE order_id = ?`, [orderId]);
        for (const item of items) {
            if (item.pro_id && !isNaN(item.pro_id)) {
                let stockType = null;
                let restoreQty = 0;
                if (item.product_type === 'fabric' || item.product_type === 'made-to-wear' || item.product_type === 'bespoke') {
                    stockType = 'fabric';
                    restoreQty = parseFloat(item.selected_meter || item.quantity || 1);
                } else if (item.product_type === 'rtw' || item.product_type === 'ready_to_wear' || item.product_type === 'ready-to-wear') {
                    stockType = 'rtw';
                    restoreQty = parseFloat(item.quantity || 1);
                }
                if (stockType && restoreQty > 0) {
                    await dbConn.query(
                        `UPDATE stock_master SET quantity = quantity + ?, updated_at = NOW() WHERE pro_id = ? AND product_type = ?`,
                        [restoreQty, Number(item.pro_id), stockType]
                    );
                }
            }
        }
    } catch (error) {
        console.error("Error restoring inventory stock on order cancellation:", error.message);
    }
};

const updateOrderStatus = async (orderId, status) => {
    const [current] = await pool.query(`SELECT order_status FROM orders WHERE order_id = ?`, [orderId]);
    const oldStatus = current.length > 0 ? (current[0].order_status || '').toUpperCase() : '';
    const newStatus = (status || '').toUpperCase();

    const query = `UPDATE orders SET order_status = ? WHERE order_id = ?`;
    const [result] = await pool.query(query, [status, orderId]);
    
    if (result.affectedRows > 0 && newStatus === 'CANCELLED' && oldStatus !== 'CANCELLED') {
        await restoreOrderStock(orderId, pool);
        try {
            await processOrderRefund(orderId);
        } catch (err) {
            console.error("Error triggering bank refund on cancellation:", err.message);
        }
        try {
            const emailService = require('./email.service');
            emailService.sendOrderCancelledEmails(orderId, "Order cancelled by Administration");
        } catch (e) {
            console.error("Failed to send cancellation emails:", e.message);
        }
    }
    return result.affectedRows > 0;
};

const processOrderRefund = async (orderId, preferredMethod = null) => {
    try {
        const [orderRows] = await pool.query('SELECT * FROM orders WHERE order_id = ?', [orderId]);
        if (orderRows.length === 0) return { status: 'failed', error: 'Order not found' };
        const order = orderRows[0];

        if (order.payment_mode === 'COD') {
            console.log(`[REFUND] Order ${orderId} is Cash on Delivery (COD). No online bank refund required.`);
            return { status: 'cod_order', message: 'No refund needed for COD order.' };
        }

        const [paymentRows] = await pool.query(
            `SELECT * FROM payments WHERE order_id = ? ORDER BY payment_id DESC LIMIT 1`,
            [orderId]
        );
        const payment = paymentRows[0] || null;

        if (payment && !['SUCCESS', 'VERIFIED', 'COMPLETED', 'PAID'].includes((payment.payment_status || '').toUpperCase())) {
            console.log(`[REFUND] Payment status for order ${orderId} is '${payment.payment_status}' (not success). No bank refund triggered.`);
            return { status: 'no_payment', error: `Payment status is ${payment.payment_status}` };
        }

        const refundAmount = payment ? parseFloat(payment.amount || order.grand_total) : parseFloat(order.grand_total);
        if (!refundAmount || refundAmount <= 0) {
            return { status: 'no_payment', error: 'No amount to refund' };
        }

        const isWalletPayment = !payment || payment.gateway_name === 'STORE_WALLET' || order.payment_mode === 'STORE_WALLET';
        const method = (preferredMethod || (isWalletPayment ? 'WALLET' : 'GATEWAY')).toUpperCase();

        if (method === 'WALLET' || isWalletPayment) {
            if (order.user_id) {
                try {
                    const walletService = require('./wallet.service');
                    await walletService.processRefund(order.user_id, {
                        order_id: parseInt(orderId),
                        payment_id: payment?.payment_id || null,
                        cancellation_id: null,
                        refund_method: 'WALLET',
                        refund_amount: refundAmount,
                        wallet_refund_amount: refundAmount,
                        gateway_refund_amount: 0,
                    });
                    await pool.query(`UPDATE orders SET refund_method = 'WALLET' WHERE order_id = ?`, [orderId]);
                    console.log(`[REFUND] ₹${refundAmount} credited to store wallet for order ${orderId}`);
                    return { method: 'WALLET', status: 'success', amount: refundAmount };
                } catch (walletErr) {
                    console.error(`[REFUND] Wallet credit failed for order ${orderId}:`, walletErr.message);
                    return { method: 'WALLET', status: 'failed', error: walletErr.message };
                }
            }
        }

        // --- GATEWAY BANK PORTAL REFUND (Cashfree or ICICI Bank) ---
        if (!payment) {
            console.warn(`[REFUND] No confirmed payment record found for order ${orderId} to initiate bank portal refund.`);
            return { method: 'GATEWAY', status: 'failed', error: 'No payment record found.' };
        }

        const gatewayName = (payment.gateway_name || '').toUpperCase();
        const merchantTxnNo = payment.merchant_txn_no || order.order_number;

        if (gatewayName === 'CASHFREE') {
            console.log(`[REFUND] Triggering Cashfree Bank Portal refund for order ${orderId} (Txn: ${merchantTxnNo}, Amount: ₹${refundAmount})`);
            try {
                const cashfreePaymentService = require('./cashfreePayment.service');
                const cfRes = await cashfreePaymentService.initiateRefund({
                    merchantTxnNo: merchantTxnNo,
                    amount: refundAmount,
                    refundId: `REF-${orderId}-${Date.now().toString().slice(-4)}`
                });
                console.log(`[REFUND] Cashfree bank portal refund response:`, cfRes);
                await pool.query(`UPDATE orders SET refund_method = 'GATEWAY' WHERE order_id = ?`, [orderId]);
                return { method: 'GATEWAY', gateway: 'CASHFREE', status: 'success', amount: refundAmount, response: cfRes };
            } catch (cfErr) {
                console.error(`[REFUND] Cashfree bank refund failed for order ${orderId}:`, cfErr.message);
                return { method: 'GATEWAY', gateway: 'CASHFREE', status: 'failed', error: cfErr.message };
            }
        } else if (gatewayName === 'ICICI' || gatewayName === 'ICICI_BANK') {
            const txnID = payment.transaction_id || payment.gateway_payment_id;
            if (!txnID) {
                console.error(`[REFUND] ICICI Bank Portal refund failed: missing bank transaction ID (txnID) for order ${orderId}`);
                return { method: 'GATEWAY', gateway: 'ICICI_BANK', status: 'failed', error: 'Missing bank transaction ID' };
            }
            console.log(`[REFUND] Triggering ICICI Bank Portal refund for order ${orderId} (Txn: ${merchantTxnNo}, Bank ID: ${txnID}, Amount: ₹${refundAmount})`);
            try {
                const iciciPaymentService = require('./iciciPayment.service');
                const iciciRes = await iciciPaymentService.initiateRefund({
                    merchantTxnNo: merchantTxnNo,
                    txnID: txnID,
                    amount: refundAmount,
                });
                console.log(`[REFUND] ICICI Bank portal refund response:`, iciciRes);
                const isSuccess = iciciRes?.responseCode === 'R1000' || iciciRes?.responseCode === '000' || iciciRes?.status === 'SUCCESS';
                await pool.query(`UPDATE orders SET refund_method = 'GATEWAY' WHERE order_id = ?`, [orderId]);
                return { method: 'GATEWAY', gateway: 'ICICI_BANK', status: isSuccess ? 'success' : 'failed', amount: refundAmount, response: iciciRes };
            } catch (iciciErr) {
                console.error(`[REFUND] ICICI bank refund failed for order ${orderId}:`, iciciErr.message);
                return { method: 'GATEWAY', gateway: 'ICICI_BANK', status: 'failed', error: iciciErr.message };
            }
        } else {
            console.warn(`[REFUND] Unknown gateway provider (${payment.gateway_name}) for order ${orderId}.`);
            return { method: 'GATEWAY', status: 'failed', error: `Unknown payment provider: ${payment.gateway_name}` };
        }
    } catch (error) {
        console.error(`[REFUND ERROR] Error processing refund for order ${orderId}:`, error.message);
        return { status: 'error', error: error.message };
    }
};

const getOrderByNumber = async (orderNumber) => {
    const [rows] = await pool.query(`SELECT order_id FROM orders WHERE order_number = ?`, [orderNumber]);
    if (rows.length === 0) return null;
    return getOrderById(rows[0].order_id);
};
const getOrdersByUserId = async (userId, mobile, email) => {
    const orderQuery = `
        SELECT o.*, 
               p.payment_status, p.payment_mode, p.gateway_name, p.transaction_id, p.card_network, p.bank_name
        FROM orders o
        ${LATEST_PAYMENT_JOIN}
        WHERE o.user_id = ? OR (o.user_id IS NULL AND (o.customer_mobile = ? OR o.customer_email = ?))
        ORDER BY o.created_at DESC
    `;
    const [orders] = await pool.query(orderQuery, [userId, mobile || '', email || '']);
    
    if (orders.length === 0) return [];

    const orderIds = orders.map(o => o.order_id);
    
    const itemsQuery = `
        SELECT oi.*, 
            mp.placement_name AS monogram_placement_name, mp.placement_image AS monogram_placement_image,
            mc.color_name AS monogram_color_name, mc.color_image AS monogram_color_image,
            mf.font_name AS monogram_font_name, mf.font_preview_image AS monogram_font_preview_image
        FROM order_items oi
        LEFT JOIN monogram_placements mp ON oi.monogram_placement_id = mp.placement_id
        LEFT JOIN monogram_colors mc ON oi.monogram_color_id = mc.color_id
        LEFT JOIN monogram_fonts mf ON oi.monogram_font_id = mf.font_id
        WHERE oi.order_id IN (?) 
        ORDER BY oi.item_id
    `;
    const [items] = await pool.query(itemsQuery, [orderIds]);

    const itemsByOrderId = items.reduce((acc, item) => {
        if (!acc[item.order_id]) acc[item.order_id] = [];
        acc[item.order_id].push(item);
        return acc;
    }, {});

    return orders.map(order => ({
        ...order,
        items: itemsByOrderId[order.order_id] || []
    }));
};

const getOrderStats = async () => {
    const query = `
        SELECT product_type, COUNT(DISTINCT order_id) as total
        FROM order_items
        WHERE product_type IN ('fabric', 'rtw', 'made-to-wear', 'bespoke')
        GROUP BY product_type
    `;
    const [rows] = await pool.query(query);
    const stats = { fabric: 0, rtw: 0, 'made-to-wear': 0, bespoke: 0 };
    rows.forEach(row => {
        if (stats[row.product_type] !== undefined) {
            stats[row.product_type] = row.total;
        }
    });
    return stats;
};

module.exports = { createOrder, getAllOrders, getOrderById, getOrderByNumber, updateOrderStatus, processOrderRefund, restoreOrderStock, VALID_PRODUCT_TYPES, getOrdersByUserId, getOrderStats };