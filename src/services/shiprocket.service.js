const axios = require("axios");
const { pool } = require("../config/db");

const getShiprocketHeaders = () => {
  const token = process.env.SHIPROCKET_API_TOKEN;
  if (!token) {
    throw new Error("Missing SHIPROCKET_API_TOKEN in environment variables.");
  }
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  };
};

const normalizeShiprocketStatus = (status) => {
  if (!status) return "SELLER_PREPARING";
  const str = status.toUpperCase();
  if (str.includes("DELIVERED") && !str.includes("OUT FOR")) return "DELIVERED";
  if (str.includes("OUT FOR DELIVERY")) return "OUT_FOR_DELIVERY";
  if (str.includes("IN TRANSIT") || str.includes("SHIPPED") || str.includes("PICKED UP") || str.includes("PICKUP SCHEDULED")) return "IN_TRANSIT";
  if (str.includes("CANCELLED") || str.includes("CANCELED") || str.includes("RTO")) return "CANCELLED";
  return "SELLER_PREPARING";
};

/**
 * Create an Adhoc Order on Shiprocket and auto-assign AWB
 */
const createShiprocketOrder = async (order, items = [], weight = 0.5, dimensions = "10x10x10", pickupLocation = null) => {
  const headers = getShiprocketHeaders();
  
  let len = 10, wid = 10, hgt = 10;
  if (dimensions && dimensions.includes("x")) {
    const parts = dimensions.split("x").map(p => parseFloat(p.trim()) || 10);
    if (parts.length >= 3) {
      len = parts[0]; wid = parts[1]; hgt = parts[2];
    }
  }

  const destinationAddress = `${order.house_building || ''} ${order.street_locality || ''}`.trim() || order.shipping_address || "Shipping Address";
  const fullName = order.customer_name || order.full_name || "Customer Name";
  const nameParts = fullName.split(" ");
  const firstName = nameParts[0] || "Customer";
  const lastName = nameParts.slice(1).join(" ") || "Name";
  const phone = String(order.customer_mobile || order.mobile || "9999999999").replace(/[^0-9]/g, '').slice(-10);
  const pincode = String(order.postal_code || "600001").replace(/[^0-9]/g, '');

  const orderItems = items && items.length > 0 ? items.map((item, idx) => ({
    name: (item.product_name || item.name || "Garment Item").slice(0, 50),
    sku: item.pro_id ? `SKU-${item.pro_id}-${idx}` : `ITEM-${idx + 1}`,
    units: Math.max(1, parseInt(item.quantity || 1, 10)),
    selling_price: String(Math.max(1, Math.round(item.unit_price || item.price || (order.grand_total / items.length) || 500))),
    discount: "0",
    tax: "0",
    hsn: ""
  })) : [{
    name: "Fashion Luxury Garment",
    sku: `VIAN-ORD-${order.order_id}`,
    units: 1,
    selling_price: String(Math.round(order.grand_total || 500)),
    discount: "0",
    tax: "0",
    hsn: ""
  }];

  let parsedWeight = parseFloat(weight) || 0.5;
  if (parsedWeight >= 20) {
    parsedWeight = parsedWeight / 1000; // convert grams to kg for Shiprocket
  }
  const finalWeight = Math.max(0.1, parseFloat(parsedWeight.toFixed(3)));

  const payload = {
    order_id: `${order.order_number || ('ORD-' + order.order_id)}-${Date.now().toString().slice(-4)}`,
    order_date: new Date(order.created_at || Date.now()).toISOString().slice(0, 16).replace("T", " "),
    pickup_location: pickupLocation || process.env.SHIPROCKET_PICKUP_LOCATION || "work",
    channel_id: "",
    comment: `Order #${order.order_number}`,
    billing_customer_name: firstName,
    billing_last_name: lastName,
    billing_address: destinationAddress.slice(0, 80),
    billing_address_2: "",
    billing_city: order.city || "Tiruchengode",
    billing_pincode: pincode,
    billing_state: order.state || "Tamil Nadu",
    billing_country: order.country || "India",
    billing_email: order.customer_email || "customer@vianluxure.com",
    billing_phone: phone.length === 10 ? phone : "9999999999",
    shipping_is_billing: true,
    order_items: orderItems,
    payment_method: "Prepaid",
    shipping_charges: 0,
    giftwrap_charges: 0,
    transaction_charges: 0,
    total_discount: 0,
    sub_total: Number(order.grand_total || 500),
    length: len,
    breadth: wid,
    height: hgt,
    weight: finalWeight
  };

  try {
    console.log(`🚀 [SHIPROCKET] Creating shipment for Order ${order.order_number || order.order_id}`);
    console.log(`[SHIPROCKET] Payload:`, JSON.stringify(payload, null, 2));

    const res = await axios.post("https://apiv2.shiprocket.in/v1/external/orders/create/adhoc", payload, { headers });

    console.log(`[SHIPROCKET] Response:`, JSON.stringify(res.data, null, 2));

    if (!res.data || !res.data.order_id) {
      throw new Error(res.data?.message || "Failed to generate Shiprocket Order");
    }

    const srOrderId = String(res.data.order_id);
    const srShipmentId = String(res.data.shipment_id);
    let awbCode = res.data.awb_code;

    // If AWB code is not immediately returned, check serviceability & request AWB assignment
    if (!awbCode) {
      try {
        console.log(`[SHIPROCKET] Requesting AWB assignment for shipment ID: ${srShipmentId}`);
        let courierId = null;
        try {
          const servRes = await axios.get(`https://apiv2.shiprocket.in/v1/external/courier/serviceability/?order_id=${srOrderId}`, { headers });
          if (servRes.data?.data?.available_courier_companies?.length > 0) {
            courierId = String(servRes.data.data.available_courier_companies[0].courier_company_id);
          }
        } catch (e) {
          // ignore serviceability check failure
        }

        const awbPayload = courierId ? { shipment_id: srShipmentId, courier_id: courierId } : { shipment_id: srShipmentId };
        const awbRes = await axios.post("https://apiv2.shiprocket.in/v1/external/courier/assign/awb", awbPayload, { headers });
        console.log(`[SHIPROCKET] AWB Assign Response:`, JSON.stringify(awbRes.data, null, 2));
        
        if (awbRes.data?.awb_assign_status === 0 || awbRes.data?.status_code === 350) {
          const errMsg = awbRes.data?.response?.data?.awb_assign_error || awbRes.data?.message || "AWB Assignment Failed";
          console.warn(`⚠️ [SHIPROCKET AWB PENDING]: ${errMsg}`);
          if (errMsg.toLowerCase().includes("recharge") || errMsg.toLowerCase().includes("wallet") || errMsg.toLowerCase().includes("balance")) {
            console.warn(`👉 IMPORTANT: Please recharge your ShipRocket wallet (minimum Rs 100 required) to automatically generate AWB tracking numbers.`);
          }
        } else if (awbRes.data?.response?.data?.awb_code) {
          awbCode = awbRes.data.response.data.awb_code;
        } else if (awbRes.data?.awb_code && awbRes.data.awb_code !== "") {
          awbCode = awbRes.data.awb_code;
        }
      } catch (awbErr) {
        const msg = awbErr.response?.data?.message || awbErr.message;
        console.warn(`⚠️ [SHIPROCKET AWB PENDING]: ${msg}`);
        if (msg.toLowerCase().includes("kyc")) {
          console.warn(`👉 IMPORTANT: Please complete KYC Verification on your Shiprocket Seller Dashboard to generate AWB tracking numbers automatically.`);
        }
      }
    }

    const finalAwb = awbCode || `SR-${srShipmentId}`;
    const trackingUrl = `https://shiprocket.co/tracking/${finalAwb}`;

    return {
      success: true,
      waybill: finalAwb,
      shiprocketOrderId: srOrderId,
      shiprocketShipmentId: srShipmentId,
      carrier: "SHIPROCKET",
      trackingUrl,
      raw: res.data
    };
  } catch (error) {
    console.error("❌ [SHIPROCKET CREATE ERROR]:", error.response?.data || error.message);
    const errMsg = error.response?.data?.message || error.response?.data?.errors ? JSON.stringify(error.response.data.errors || error.response.data.message) : error.message;
    throw new Error(`Shiprocket creation failed: ${errMsg}`);
  }
};

/**
 * Get tracking status for a Shiprocket shipment
 */
const getShiprocketTracking = async (awbNumber, srShipmentId, srOrderId) => {
  const headers = getShiprocketHeaders();
  try {
    let url = null;
    if (srShipmentId) {
      url = `https://apiv2.shiprocket.in/v1/external/courier/track/shipment/${srShipmentId}`;
    } else if (awbNumber && !awbNumber.startsWith('SR-')) {
      url = `https://apiv2.shiprocket.in/v1/external/courier/track/awb/${awbNumber}`;
    } else if (srOrderId) {
      url = `https://apiv2.shiprocket.in/v1/external/courier/track?order_id=${srOrderId}`;
    }

    if (!url) {
      return { success: false, message: "Missing tracking identifier for Shiprocket." };
    }

    const res = await axios.get(url, { headers });
    let trackData = res.data?.tracking_data;
    if (!trackData && res.data && typeof res.data === 'object') {
      const firstVal = Object.values(res.data)[0];
      if (firstVal && firstVal.tracking_data) {
        trackData = firstVal.tracking_data;
      }
    }

    if (!trackData) {
      return { success: false, message: "No tracking details found yet." };
    }

    const rawStatus = trackData.shipment_status ? String(trackData.shipment_status) : (trackData.track_status ? String(trackData.track_status) : "Pending");
    const normalizedStatus = normalizeShiprocketStatus(rawStatus);

    let scans = (trackData.shipment_track_activities || []).map(s => ({
      status: s.activity || s.status || "Scanned",
      date: s.date || new Date().toISOString(),
      location: s.location || "Transit Hub",
      remarks: s.remarks || ""
    }));

    if (scans.length === 0 && awbNumber && awbNumber.startsWith("SR-")) {
      scans = [{
        status: "Order Received by Shiprocket",
        date: new Date().toISOString(),
        location: "Seller Hub",
        remarks: "Shipment registered. AWB allocation pending minimum Rs 100 wallet recharge or KYC verification on Shiprocket dashboard."
      }];
    }

    return {
      success: true,
      awb_number: awbNumber || trackData.awb_code,
      raw_status: rawStatus,
      normalized_status: normalizedStatus,
      expected_delivery: trackData.edd ? new Date(trackData.edd) : null,
      scans
    };
  } catch (err) {
    console.error("❌ [SHIPROCKET TRACKING ERROR]:", err.response?.data || err.message);
    return { success: false, message: err.message };
  }
};

/**
 * Sync shipment status for scheduler / manual refresh
 */
const syncShiprocketShipmentStatus = async (shipment, connection = null) => {
  const executeQuery = async (query, params) => {
    if (connection) return connection.query(query, params);
    return pool.query(query, params);
  };

  let awb = shipment.awb_number;
  const srShipmentId = shipment.shiprocket_shipment_id || (awb && awb.startsWith('SR-') ? awb.replace('SR-', '') : null);
  const srOrderId = shipment.shiprocket_order_id;

  // If AWB hasn't been generated yet (starts with SR-), attempt to assign AWB now during sync!
  if (awb && awb.startsWith('SR-') && srShipmentId) {
    try {
      const headers = getShiprocketHeaders();
      console.log(`[SHIPROCKET SYNC] Attempting AWB assignment for pending shipment ID: ${srShipmentId}`);
      const awbRes = await axios.post("https://apiv2.shiprocket.in/v1/external/courier/assign/awb", { shipment_id: srShipmentId }, { headers });
      console.log(`[SHIPROCKET SYNC] AWB Assign Response:`, JSON.stringify(awbRes.data, null, 2));
      
      let newAwb = null;
      if (awbRes.data?.response?.data?.awb_code) {
        newAwb = awbRes.data.response.data.awb_code;
      } else if (awbRes.data?.awb_code && awbRes.data.awb_code !== "") {
        newAwb = awbRes.data.awb_code;
      }

      if (newAwb) {
        awb = newAwb;
        const newTrackingUrl = `https://shiprocket.co/tracking/${newAwb}`;
        await executeQuery(
          `UPDATE shipment_details SET awb_number = ?, tracking_url = ?, updated_at = NOW() WHERE order_id = ?`,
          [newAwb, newTrackingUrl, shipment.order_id]
        );
        await executeQuery(
          `UPDATE orders SET tracking_number = ?, updated_at = NOW() WHERE order_id = ?`,
          [newAwb, shipment.order_id]
        );
        console.log(`✅ [SHIPROCKET SYNC] Successfully generated and updated AWB number: ${newAwb}`);
      } else {
        const errMsg = awbRes.data?.response?.data?.awb_assign_error || awbRes.data?.message;
        if (errMsg) {
          console.warn(`⚠️ [SHIPROCKET AWB PENDING DURING SYNC]: ${errMsg}`);
        }
      }
    } catch (assignErr) {
      console.error(`❌ [SHIPROCKET SYNC AWB ASSIGN ERROR]:`, assignErr.response?.data || assignErr.message);
    }
  }

  const [orderRows] = await executeQuery("SELECT order_status, order_number FROM orders WHERE order_id = ?", [shipment.order_id]);
  const orderObj = orderRows[0];
  const currentStatus = (orderObj?.order_status || '').toUpperCase();
  if (!orderObj || currentStatus === "CANCELLED" || currentStatus === "DELIVERED") {
    return { success: true, awbNumber: awb, rawStatus: shipment.shipment_status, normalizedStatus: currentStatus, statusChanged: false };
  }

  const trackingResult = await getShiprocketTracking(awb, srShipmentId, srOrderId);
  if (!trackingResult.success) {
    return { success: false, message: trackingResult.message };
  }

  const normalizedStatus = trackingResult.normalized_status;
  const prevStatus = shipment.shipment_status;

  if (normalizedStatus !== prevStatus) {
    console.log(`[SHIPROCKET SYNC] Status changing for AWB ${awb}: ${prevStatus} -> ${normalizedStatus}`);
    await executeQuery(
      `UPDATE shipment_details SET shipment_status = ?, expected_delivery = ?, last_tracking_sync = NOW(), updated_at = NOW() WHERE order_id = ?`,
      [normalizedStatus, trackingResult.expected_delivery || null, shipment.order_id]
    );
    await executeQuery(
      `UPDATE orders SET order_status = ?, updated_at = NOW() WHERE order_id = ?`,
      [normalizedStatus, shipment.order_id]
    );
    await executeQuery(
      `INSERT INTO order_status_history (order_id, status, remarks, created_at) VALUES (?, ?, ?, NOW())`,
      [shipment.order_id, normalizedStatus, `Shiprocket status updated to ${normalizedStatus} (AWB: ${awb})`]
    );
  }

  return {
    success: true,
    awbNumber: awb,
    rawStatus: trackingResult.raw_status,
    normalizedStatus,
    statusChanged: normalizedStatus !== prevStatus
  };
};

/**
 * Cancel order on Shiprocket
 */
const cancelShiprocketShipment = async (srOrderId, awbNumber = null) => {
  const headers = getShiprocketHeaders();
  try {
    if (!srOrderId && awbNumber && awbNumber.startsWith("SR-")) {
      // srShipmentId fallback
    }
    const ids = srOrderId ? [Number(srOrderId)] : (awbNumber && !awbNumber.startsWith('SR-') ? [awbNumber] : []);
    if (ids.length === 0) {
      return { success: true, message: "No numeric Shiprocket ID found to cancel remotely." };
    }
    console.log(`[SHIPROCKET] Cancelling Shiprocket Order ID:`, ids);
    const res = await axios.post("https://apiv2.shiprocket.in/v1/external/orders/cancel", { ids }, { headers });
    return { success: true, data: res.data };
  } catch (error) {
    console.error("❌ [SHIPROCKET CANCEL ERROR]:", error.response?.data || error.message);
    return { success: true, message: "Cancelled locally" }; // Continue with local cancel if remote fails or already canceled
  }
};

module.exports = {
  createShiprocketOrder,
  getShiprocketTracking,
  syncShiprocketShipmentStatus,
  cancelShiprocketShipment
};
