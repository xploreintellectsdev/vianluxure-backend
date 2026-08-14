const { pool } = require("../config/db");
const delhiveryService = require("../services/delhivery.service");
const shiprocketService = require("../services/shiprocket.service");
const orderService = require("../services/order.service");
const emailService = require("../services/email.service");
const { successRes, errorRes } = require("../utils/response");
const catchAsync = require("../utils/catchAsync");

/**
 * Create a shipment on Delhivery for an order
 */
const createShipment = catchAsync(async (req, res) => {
  const { orderId, carrier = "DELHIVERY", weight = 500, dimensions = "10x10x10", pickupLocation = null } = req.body;

  if (!orderId) {
    return errorRes(res, "orderId is required", 400);
  }

  // Get order and address details
  const [orderRows] = await pool.query(
    `SELECT o.*, ua.full_name, ua.mobile, ua.house_building, ua.street_locality, ua.city, ua.state, ua.postal_code, ua.country
     FROM orders o
     LEFT JOIN user_addresses ua ON ua.address_id = o.address_id
     WHERE o.order_id = ?`,
    [orderId]
  );

  if (orderRows.length === 0) {
    return errorRes(res, "Order not found", 404);
  }

  const order = orderRows[0];

  // Check if shipment already exists
  const [existingShipment] = await pool.query(
    `SELECT * FROM shipment_details WHERE order_id = ?`,
    [orderId]
  );

  if (existingShipment.length > 0 && existingShipment[0].awb_number && existingShipment[0].shipment_status !== 'CANCELLED') {
    return errorRes(res, `Shipment already exists with AWB: ${existingShipment[0].awb_number}`, 400);
  }

  const selectedCarrier = (carrier || "DELHIVERY").toUpperCase();

  if (selectedCarrier === "SHIPROCKET") {
    const [itemRows] = await pool.query(`SELECT * FROM order_items WHERE order_id = ?`, [orderId]);
    const srResult = await shiprocketService.createShiprocketOrder(order, itemRows, weight, dimensions, pickupLocation);

    if (srResult && srResult.success) {
      await pool.query(
        `INSERT INTO shipment_details (order_id, carrier, awb_number, shiprocket_order_id, shiprocket_shipment_id, shipment_status, tracking_url, created_at)
         VALUES (?, 'SHIPROCKET', ?, ?, ?, 'SELLER_PREPARING', ?, NOW())
         ON DUPLICATE KEY UPDATE carrier = 'SHIPROCKET', awb_number = VALUES(awb_number), shiprocket_order_id = VALUES(shiprocket_order_id), shiprocket_shipment_id = VALUES(shiprocket_shipment_id), shipment_status = 'SELLER_PREPARING', tracking_url = VALUES(tracking_url), updated_at = NOW()`,
        [orderId, srResult.waybill, srResult.shiprocketOrderId, srResult.shiprocketShipmentId, srResult.trackingUrl]
      );

      await pool.query(
        `UPDATE orders SET order_status = 'SELLER_PREPARING', updated_at = NOW() WHERE order_id = ?`,
        [orderId]
      );

      await pool.query(
        `INSERT INTO order_status_history (order_id, status, remarks, created_at)
         VALUES (?, 'SELLER_PREPARING', ?, NOW())`,
        [orderId, `Shiprocket shipment created with AWB/Ref: ${srResult.waybill}`]
      );

      emailService.sendShipmentCreatedEmail(orderId, {
        waybill: srResult.waybill,
        carrier: "SHIPROCKET",
        trackingUrl: srResult.trackingUrl
      });

      return successRes(res, "Shiprocket shipment created successfully", {
        order_id: orderId,
        carrier: "SHIPROCKET",
        awb_number: srResult.waybill,
        tracking_url: srResult.trackingUrl,
        shipment_status: "SELLER_PREPARING"
      }, null, 201);
    }
    return errorRes(res, "Failed to create Shiprocket shipment", 500);
  }

  // Default to Delhivery
  const destinationAddress = `${order.house_building || ''}, ${order.street_locality || ''}`.trim() || order.shipping_address;

  const shipmentObject = {
    name: order.customer_name || order.full_name || "Customer",
    add: destinationAddress,
    pin: order.postal_code || "600001",
    city: order.city || "Chennai",
    state: order.state || "Tamil Nadu",
    country: order.country || "India",
    phone: order.customer_mobile || order.mobile || "0000000000",
    order: order.order_number || `ORD-${order.order_id}`,
    payment_mode: "Prepaid",
    return_add: process.env.DELHIVERY_PICKUP_ADDRESS || "",
    return_pin: process.env.DELHIVERY_PICKUP_PIN || "",
    return_city: process.env.DELHIVERY_PICKUP_CITY || "",
    return_state: process.env.DELHIVERY_PICKUP_STATE || "",
    return_country: process.env.DELHIVERY_PICKUP_COUNTRY || "India",
    return_name: process.env.DELHIVERY_PICKUP_NAME || "",
    return_phone: process.env.DELHIVERY_PICKUP_PHONE || "",
    products_desc: "Clothing / Fashion Garment",
    hsn_code: "",
    cod_amount: "0",
    order_date: order.created_at,
    total_amount: order.grand_total,
    seller_add: process.env.DELHIVERY_PICKUP_ADDRESS || "",
    seller_name: process.env.DELHIVERY_SELLER_NAME || "",
    seller_inv: order.order_number || `INV-${order.order_id}`,
    quantity: "1",
    waybill: "",
    shipment_width: "10",
    shipment_height: "10",
    weight: String(weight)
  };

  const result = await delhiveryService.createDelhiveryShipment(shipmentObject);

  if (result.success && result.waybill) {
    const awbNumber = result.waybill;
    const trackingUrl = `https://www.delhivery.com/track/package/${awbNumber}`;

    // Save to shipment_details
    await pool.query(
      `INSERT INTO shipment_details (order_id, carrier, awb_number, shipment_status, tracking_url, created_at)
       VALUES (?, 'DELHIVERY', ?, 'SELLER_PREPARING', ?, NOW())
       ON DUPLICATE KEY UPDATE carrier = 'DELHIVERY', awb_number = VALUES(awb_number), shipment_status = 'SELLER_PREPARING', tracking_url = VALUES(tracking_url), updated_at = NOW()`,
      [orderId, awbNumber, trackingUrl]
    );

    // Update orders table status
    await pool.query(
      `UPDATE orders SET order_status = 'SELLER_PREPARING', updated_at = NOW() WHERE order_id = ?`,
      [orderId]
    );

    // Log status history
    await pool.query(
      `INSERT INTO order_status_history (order_id, status, remarks, created_at)
       VALUES (?, 'SELLER_PREPARING', ?, NOW())`,
      [orderId, `Delhivery shipment created with AWB: ${awbNumber}`]
    );

    emailService.sendShipmentCreatedEmail(orderId, {
      waybill: awbNumber,
      carrier: "DELHIVERY",
      trackingUrl: trackingUrl
    });

    return successRes(res, "Shipment created successfully", {
      order_id: orderId,
      carrier: "DELHIVERY",
      awb_number: awbNumber,
      tracking_url: trackingUrl,
      shipment_status: "SELLER_PREPARING"
    }, null, 201);
  }

  return errorRes(res, "Failed to create Delhivery shipment", 500);
});

/**
 * Get tracking status & timeline for an order
 */
const getTrackingDetails = catchAsync(async (req, res) => {
  const { orderId } = req.params;

  const [orderRows] = await pool.query(`SELECT * FROM orders WHERE order_id = ?`, [orderId]);
  if (orderRows.length === 0) {
    return errorRes(res, "Order not found", 404);
  }
  const order = orderRows[0];

  const [shipmentRows] = await pool.query(`SELECT * FROM shipment_details WHERE order_id = ?`, [orderId]);
  const shipment = shipmentRows[0] || null;

  const [historyRows] = await pool.query(
    `SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC`,
    [orderId]
  );

  console.log("========================================");
  console.log("[VIEW DETAILS TRIGGER] Backend endpoint reached");
  console.log(`[VIEW DETAILS TRIGGER] Order: ${order.order_number}`);
  console.log("========================================");

  let trackingData = null;
  if (shipment && shipment.awb_number) {
    if (shipment.carrier === 'SHIPROCKET') {
      console.log(`[VIEW DETAILS SYNC] Shiprocket ref found: ${shipment.awb_number}. Syncing with Shiprocket...`);
      trackingData = await shiprocketService.getShiprocketTracking(shipment.awb_number, shipment.shiprocket_shipment_id, shipment.shiprocket_order_id);
    } else {
      console.log(`[VIEW DETAILS SYNC] AWB found: ${shipment.awb_number}. Syncing with Delhivery...`);
      trackingData = await delhiveryService.getShipmentStatus(shipment.awb_number, order.order_number);
    }
  } else {
    console.log("[VIEW DETAILS SYNC] SKIPPED — No AWB number");
  }

  const timeline = delhiveryService.buildDeliveryTimeline(
    order,
    shipment,
    trackingData?.scans || [],
    historyRows
  );

  return successRes(res, "Tracking details fetched", {
    order,
    shipment,
    tracking: trackingData,
    timeline,
    history: historyRows
  });
});

/**
 * Sync status manually for a shipment
 */
const syncShipment = catchAsync(async (req, res) => {
  const { orderId } = req.params;

  const [shipmentRows] = await pool.query(`SELECT * FROM shipment_details WHERE order_id = ?`, [orderId]);
  if (shipmentRows.length === 0 || !shipmentRows[0].awb_number) {
    return errorRes(res, "No active shipment found for this order", 404);
  }

  const shipment = shipmentRows[0];
  const result = shipment.carrier === 'SHIPROCKET'
    ? await shiprocketService.syncShiprocketShipmentStatus(shipment)
    : await delhiveryService.syncDelhiveryShipmentStatus(shipment);

  return successRes(res, "Shipment status synchronized", result);
});

/**
 * Cancel shipment on courier
 */
const cancelShipment = catchAsync(async (req, res) => {
  const { orderId } = req.params;

  const [shipmentRows] = await pool.query(`SELECT * FROM shipment_details WHERE order_id = ?`, [orderId]);
  if (shipmentRows.length === 0 || !shipmentRows[0].awb_number) {
    return errorRes(res, "No shipment found to cancel", 404);
  }

  const shipment = shipmentRows[0];
  const waybill = shipment.awb_number;
  let result;
  if (shipment.carrier === 'SHIPROCKET') {
    result = await shiprocketService.cancelShiprocketShipment(shipment.shiprocket_order_id, waybill);
  } else {
    result = await delhiveryService.cancelDelhiveryShipment(waybill);
  }

  // Update DB status
  await pool.query(
    `UPDATE shipment_details SET shipment_status = 'CANCELLED', updated_at = NOW() WHERE order_id = ?`,
    [orderId]
  );
  await pool.query(
    `UPDATE orders SET order_status = 'CANCELLED', updated_at = NOW() WHERE order_id = ?`,
    [orderId]
  );
  await orderService.restoreOrderStock(orderId, pool);
  await pool.query(
    `INSERT INTO order_status_history (order_id, status, remarks, created_at) VALUES (?, 'CANCELLED', ?, NOW())`,
    [orderId, `Shipment cancelled on ${shipment.carrier || 'Delhivery'} (AWB: ${waybill})`]
  );

  try {
    await orderService.processOrderRefund(orderId);
  } catch (refundErr) {
    console.error("Error triggering bank refund on shipment cancellation:", refundErr.message);
  }

  emailService.sendOrderCancelledEmails(orderId, `Shipment cancelled by Administration`);

  return successRes(res, "Shipment cancelled successfully", { waybill, carrier: shipment.carrier || 'DELHIVERY', result });
});

module.exports = {
  createShipment,
  getTrackingDetails,
  syncShipment,
  cancelShipment
};
