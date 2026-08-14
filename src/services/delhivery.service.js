const axios = require("axios");
const qs = require("qs");
const { pool } = require("../config/db");

/**
 * Creates a shipment in Delhivery.
 * @param {Object} shipmentObject - Single shipment details
 * @returns {Promise<Object>} normalized result
 */
const createDelhiveryShipment = async (shipmentObject) => {
  const apiToken = process.env.DELHIVERY_API_TOKEN;
  const baseUrl = process.env.DELHIVERY_BASE_URL;

  if (!apiToken || !baseUrl) {
    throw new Error("Missing required Delhivery configuration: DELHIVERY_API_TOKEN or DELHIVERY_BASE_URL");
  }

  // Validate pickup info from env
  const pickupName = process.env.DELHIVERY_PICKUP_NAME;
  const pickupPin = process.env.DELHIVERY_PICKUP_PIN;
  const pickupPhone = process.env.DELHIVERY_PICKUP_PHONE;

  if (!pickupName || !pickupPin || !pickupPhone) {
    throw new Error("Missing required Delhivery configuration: PICKUP location details in environment.");
  }

  const requestData = {
    shipments: [shipmentObject],
    pickup_location: {
      name: pickupName,
      pin: pickupPin,
      phone: pickupPhone
    }
  };

  const payload = {
    format: "json",
    data: JSON.stringify(requestData)
  };

  try {
    console.log(` [DELHIVERY] Initiating shipment request to: ${baseUrl} for order: ${shipmentObject.order}`);

    console.log(
      "[DELHIVERY] Request Data:",
      JSON.stringify(requestData, null, 2)
    );
    console.log(
      "[DELHIVERY] Form Payload:",
      qs.stringify(payload)
    );

    const response = await axios.post(
      baseUrl,
      qs.stringify(payload),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Token ${apiToken}`
        }
      }
    );

    const resData = response.data;
    console.log(
      "[DELHIVERY] Create Shipment Response:",
      JSON.stringify(resData, null, 2)
    );

    if (resData?.error === true || resData?.success === false) {
      let detailedRemark = resData?.rmk || "Delhivery rejected the shipment creation request.";
      if (resData?.packages && resData.packages.length > 0) {
        const pkgError = resData.packages[0]?.remarks;
        if (pkgError && pkgError.length > 0) {
          detailedRemark = pkgError.join(" | ");
        }
      }
      throw new Error(detailedRemark);
    }

    const waybill = resData?.packages?.[0]?.waybill;
    if (!waybill) {
      throw new Error(
        resData?.rmk || "Waybill not received from Delhivery."
      );
    }

    return {
      success: true,
      waybill,
      response: resData
    };
  } catch (error) {
    const sanitizedMsg = error.message.replace(new RegExp(apiToken, "g"), "[REDACTED_API_TOKEN]");
    console.error("❌ [DELHIVERY API ERROR]:", sanitizedMsg);
    throw new Error(`Delhivery Shipment Creation Failed: ${sanitizedMsg}`);
  }
};

/**
 * Normalizes raw Delhivery shipment status string to a standard application-friendly value.
 */
const normalizeDelhiveryStatus = (rawStatus) => {
  if (!rawStatus) return "SELLER_PREPARING";
  const status = rawStatus.toLowerCase().trim();

  if (status.includes("cancel")) {
    return "CANCELLED";
  }
  if (status.includes("rto") || status.includes("return") || status.includes("lost") || status.includes("undelivered")) {
    return "CANCELLED";
  }

  if (status.includes("placed") || status.includes("confirm")) {
    return "ORDER_PLACED";
  }

  if (
    status.includes("created") ||
    status.includes("pending pickup") ||
    status.includes("preparing") ||
    status.includes("ready for pickup") ||
    status.includes("pending") ||
    status.includes("manifest")
  ) {
    return "SELLER_PREPARING";
  }

  if (
    (status.includes("picked") && !status.includes("not picked")) ||
    status.includes("pickup") ||
    status.includes("transit") ||
    status.includes("dispatched") ||
    status.includes("bagged") ||
    status.includes("connected") ||
    status.includes("trip") ||
    status.includes("reached") ||
    status.includes("scan")
  ) {
    return "ON_THE_WAY";
  }

  if (
    status.includes("out for delivery") ||
    status.includes("delivering") ||
    status.includes("ofd") ||
    status.includes("dispatched for delivery")
  ) {
    return "OUT_FOR_DELIVERY";
  }

  if (status.includes("delivered")) {
    return "DELIVERED";
  }

  return "SELLER_PREPARING";
};

/**
 * Fetch shipment details and scan history from Delhivery API.
 */
const getShipmentStatus = async (waybill, refid) => {
  const apiToken = process.env.DELHIVERY_API_TOKEN;
  const baseUrl = process.env.DELHIVERY_BASE_URL;

  if (!apiToken || !baseUrl) {
    throw new Error("Missing required Delhivery configuration: DELHIVERY_API_TOKEN or DELHIVERY_BASE_URL");
  }

  if (!waybill) {
    throw new Error("AWB/Waybill number is required for tracking.");
  }

  const trackingUrl = new URL(baseUrl).origin + "/api/v1/packages/json/";

  const params = { waybill };
  if (refid) {
    params.refids = refid;
  }

  try {
    console.log(` [DELHIVERY] Tracking AWB: ${waybill}, Ref: ${refid}`);
    const response = await axios.get(trackingUrl, {
      params,
      headers: {
        Authorization: `Token ${apiToken}`
      }
    });

    const resData = response.data;
    const shipmentDataArray = resData?.ShipmentData;

    if (!shipmentDataArray || shipmentDataArray.length === 0) {
      return {
        success: false,
        message: "No tracking details found for AWB."
      };
    }

    const shipment = shipmentDataArray[0]?.Shipment;
    if (!shipment) {
      return {
        success: false,
        message: "Malformed tracking payload returned from Delhivery."
      };
    }

    const rawStatus = shipment.Status?.Status || "Pending";
    const normalizedStatus = normalizeDelhiveryStatus(rawStatus);

    const pickupDate = shipment.PickUpDateTime ? new Date(shipment.PickUpDateTime) : null;
    const expectedDelivery = shipment.ExpectedDeliveryDate ? new Date(shipment.ExpectedDeliveryDate) : null;
    const deliveredDate = (normalizedStatus === "DELIVERED" && shipment.Status?.StatusDateTime)
      ? new Date(shipment.Status.StatusDateTime)
      : null;

    const scans = (shipment.Scans || []).map(s => {
      const detail = s.ScanDetail || {};
      return {
        status: detail.Scan,
        date: detail.ScanDateTime,
        location: detail.ScannedLocation,
        remarks: detail.Instructions || detail.Remarks || ""
      };
    });

    return {
      success: true,
      awb_number: waybill,
      raw_status: rawStatus,
      normalized_status: normalizedStatus,
      pickup_date: pickupDate,
      expected_delivery: expectedDelivery,
      delivered_date: deliveredDate,
      last_tracking_sync: new Date(),
      scans,
      rawResponse: shipment
    };
  } catch (error) {
    const sanitizedMsg = error.message.replace(new RegExp(apiToken, "g"), "[REDACTED_API_TOKEN]");
    console.error("❌ [DELHIVERY TRACKING ERROR]:", sanitizedMsg);
    return {
      success: false,
      message: `Tracking API Call Failed: ${sanitizedMsg}`
    };
  }
};

const buildDeliveryTimeline = (order, shipment, scans = [], statusHistory = []) => {
  const history = Array.isArray(statusHistory) ? statusHistory : [];
  const isCancelled = (order.order_status || "").toUpperCase() === "CANCELLED";

  const findScanTime = (keywords) => {
    if (!Array.isArray(scans)) return null;
    const found = scans.find(s => {
      const sName = (s.status || "").toLowerCase();
      return keywords.some(k => sName.includes(k));
    });
    return found ? found.date : null;
  };

  const findHistoryTime = (statusKey) => {
    const found = history.find(h => h.status === statusKey);
    return found ? found.created_at : null;
  };

  if (isCancelled) {
    const timeline = [];

    timeline.push({
      key: "ORDER_PLACED",
      label: "Order Placed",
      completed: true,
      current: false,
      timestamp: findHistoryTime("ORDER_PLACED") || order.created_at
    });

    const hasPreparing = history.some(h => h.status === "SELLER_PREPARING");
    if (hasPreparing) {
      timeline.push({
        key: "SELLER_PREPARING",
        label: "Seller Preparing your Order",
        completed: true,
        current: false,
        timestamp: findHistoryTime("SELLER_PREPARING") || (shipment && shipment.created_at) || order.updated_at
      });
    }

    timeline.push({
      key: "CANCELLED",
      label: "Cancelled",
      completed: true,
      current: true,
      timestamp: findHistoryTime("CANCELLED") || order.updated_at
    });

    return timeline;
  }

  const timelineKeys = [
    { key: "ORDER_PLACED", label: "Order Placed" },
    { key: "SELLER_PREPARING", label: "Seller Preparing your Order" },
    { key: "ON_THE_WAY", label: "On the Way" },
    { key: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
    { key: "DELIVERED", label: "Delivered" }
  ];

  const getIndex = (status) => {
    if (!status) return -1;
    if (status === "DELIVERED") return 4;
    if (status === "OUT_FOR_DELIVERY") return 3;
    if (status === "ON_THE_WAY") return 2;
    if (status === "SELLER_PREPARING") return 1;
    return 0;
  };

  const currentDbIndex = getIndex(order.order_status);
  const normalizedStatus = shipment && shipment.awb_number
    ? normalizeDelhiveryStatus(shipment.shipment_status)
    : null;
  const normalizedIndex = normalizedStatus ? getIndex(normalizedStatus) : -1;
  const currentIndex = normalizedIndex > currentDbIndex ? normalizedIndex : currentDbIndex;

  return timelineKeys.map((item, idx) => {
    const completed = idx <= currentIndex;
    const current = idx === currentIndex;
    let timestamp = null;

    if (completed) {
      timestamp = findHistoryTime(item.key);
      if (!timestamp) {
        if (item.key === "ORDER_PLACED") {
          timestamp = order.created_at;
        } else if (item.key === "SELLER_PREPARING") {
          timestamp = (shipment && shipment.created_at) || order.updated_at;
        } else if (item.key === "ON_THE_WAY") {
          timestamp = (shipment && shipment.pickup_date) || findScanTime(["pickup", "picked", "transit", "dispatched", "reached", "trip", "connected", "scan"]);
        } else if (item.key === "OUT_FOR_DELIVERY") {
          timestamp = findScanTime(["out for delivery", "delivering", "dispatched for delivery", "ofd"]);
        } else if (item.key === "DELIVERED") {
          timestamp = (shipment && shipment.delivered_date) || findScanTime(["delivered"]);
        }
      }
    }

    return {
      key: item.key,
      label: item.label,
      completed,
      current,
      timestamp
    };
  });
};

const getStatusPriority = (status) => {
  if (status === "ORDER_PLACED") return 0;
  if (status === "SELLER_PREPARING") return 1;
  if (status === "ON_THE_WAY") return 2;
  if (status === "OUT_FOR_DELIVERY") return 3;
  if (status === "DELIVERED") return 4;
  return -1;
};

const syncDelhiveryShipmentStatus = async (shipment, connection = null) => {
  const awb = shipment.awb_number;
  const executeQuery = async (query, params) => {
    if (connection) return connection.query(query, params);
    return pool.query(query, params);
  };

  const [orderRows] = await executeQuery("SELECT order_status, order_number FROM orders WHERE order_id = ?", [shipment.order_id]);
  const orderObj = orderRows[0];
  const currentStatus = (orderObj?.order_status || '').toUpperCase();
  if (!orderObj || currentStatus === "CANCELLED" || currentStatus === "DELIVERED") {
    console.log(`[DELHIVERY SYNC SKIP] Skipping sync for AWB ${awb} because order status is terminal: ${orderObj?.order_status}`);
    return {
      success: true,
      awbNumber: awb,
      rawStatus: shipment.shipment_status,
      normalizedStatus: orderObj?.order_status,
      statusChanged: false
    };
  }

  const trackingResult = await getShipmentStatus(awb, orderObj.order_number || orderObj.order_id);
  if (!trackingResult.success) {
    throw new Error(`Delhivery tracking API failed: ${trackingResult.message}`);
  }

  const rawStatus = trackingResult.raw_status;
  const normalizedStatus = normalizeDelhiveryStatus(rawStatus);
  const prevStatus = shipment.shipment_status;

  const prevPriority = getStatusPriority(prevStatus);
  const newPriority = getStatusPriority(normalizedStatus);

  let statusChanged = false;
  if (newPriority > prevPriority || (prevPriority === -1 && newPriority !== -1)) {
    statusChanged = true;
  }

  const isException = normalizedStatus === "CANCELLED";
  if (isException && normalizedStatus !== prevStatus) {
    statusChanged = true;
  }

  if (statusChanged) {
    console.log(`[DELHIVERY SYNC] Status changing for AWB ${awb}: ${prevStatus} -> ${normalizedStatus}`);

    await executeQuery(
      `UPDATE shipment_details
       SET shipment_status = ?, expected_delivery = ?, last_tracking_sync = NOW(), updated_at = NOW()
       WHERE order_id = ?`,
      [
        normalizedStatus,
        trackingResult.expected_delivery || shipment.expected_delivery || null,
        shipment.order_id
      ]
    );

    await executeQuery(
      `UPDATE orders
       SET order_status = ?, updated_at = NOW()
       WHERE order_id = ?`,
      [normalizedStatus, shipment.order_id]
    );

    await executeQuery(
      `INSERT INTO order_status_history (order_id, status, remarks, created_at)
       VALUES (?, ?, ?, NOW())`,
      [shipment.order_id, normalizedStatus, `Status updated to ${normalizedStatus} via Delhivery`]
    );

    try {
      const emailService = require("./email.service");
      const [orderRows] = await executeQuery("SELECT * FROM orders WHERE order_id = ?", [shipment.order_id]);
      const order = orderRows[0];
      if (order) {
        const [userRows] = await executeQuery("SELECT email FROM users WHERE user_id = ?", [order.user_id]);
        const email = userRows[0]?.email;
        if (email) {
          const [addressRows] = await executeQuery("SELECT full_name FROM user_addresses WHERE address_id = ?", [order.address_id]);
          const customerName = addressRows[0]?.full_name || "Customer";

          console.log(`[Delhivery Sync]
Order: ${order.order_number}
AWB: ${awb}
Raw Status: ${rawStatus}
Normalized Status: ${normalizedStatus}
Previous DB Status: ${prevStatus}
Status Changed: true
DB Updated: true
Email Sent: true`);

          await emailService.sendStatusUpdateEmail({
            toEmail: email,
            orderNumber: order.order_number,
            status: normalizedStatus,
            customerName,
            awbNumber: awb,
            trackingUrl: shipment.tracking_url || `https://www.delhivery.com/track/package/${awb}`,
            expectedDelivery: trackingResult.expected_delivery || shipment.expected_delivery || null
          });
        }
      }
    } catch (emailErr) {
      console.error(`❌ [DELHIVERY SYNC EMAIL ERROR] Failed to send status change email:`, emailErr.message);
    }
  } else {
    await executeQuery(
      `UPDATE shipment_details
       SET expected_delivery = ?, last_tracking_sync = NOW()
       WHERE order_id = ?`,
      [
        trackingResult.expected_delivery || shipment.expected_delivery || null,
        shipment.order_id
      ]
    );
  }

  return {
    success: true,
    awbNumber: awb,
    rawStatus,
    normalizedStatus,
    statusChanged,
    expectedDelivery: trackingResult.expected_delivery || shipment.expected_delivery || null,
    pickupDate: trackingResult.pickup_date || shipment.pickup_date || null,
    deliveredDate: trackingResult.delivered_date || shipment.delivered_date || null,
    scans: trackingResult.scans || [],
    rawResponse: trackingResult.rawResponse || null
  };
};

const cancelDelhiveryShipment = async (waybill) => {
  const apiToken = process.env.DELHIVERY_API_TOKEN;
  const baseUrl = process.env.DELHIVERY_BASE_URL;

  if (!apiToken || !baseUrl) {
    throw new Error("Missing required Delhivery configuration: DELHIVERY_API_TOKEN or DELHIVERY_BASE_URL");
  }

  const urlObj = new URL(baseUrl);
  const cancelUrl = `${urlObj.origin}/api/p/edit`;

  const payload = {
    waybill,
    cancellation: "true"
  };

  console.log(` [DELHIVERY] Dispatching cancel shipment request to: ${cancelUrl} for AWB: ${waybill}`);

  try {
    const response = await axios.post(
      cancelUrl,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${apiToken}`
        }
      }
    );

    const rawBody = response.data;
    const parsedResult = (rawBody && rawBody.status === true) ? "SUCCESS" : "FAILED";

    console.log("[DELHIVERY CANCEL DEBUG]");
    console.log("- AWB being cancelled:", waybill);
    console.log("- Request URL:", cancelUrl);
    console.log("- HTTP method: POST");
    console.log("- Request payload:", JSON.stringify(payload));
    console.log("- HTTP response status:", response.status);
    console.log("- Full raw Delhivery response body:", JSON.stringify(rawBody));
    console.log("- Parsed cancellation result:", parsedResult);
    console.log("=========================");

    return rawBody;
  } catch (error) {
    const httpStatus = error.response?.status || "N/A";
    const rawErrorBody = error.response?.data ? JSON.stringify(error.response.data) : "N/A";
    const errorMsg = error.message;

    console.log("[DELHIVERY CANCEL DEBUG] [ERROR]");
    console.log("- AWB being cancelled:", waybill);
    console.log("- Request URL:", cancelUrl);
    console.log("- HTTP method: POST");
    console.log("- Request payload:", JSON.stringify(payload));
    console.log("- HTTP error status:", httpStatus);
    console.log("- raw Delhivery error response body:", rawErrorBody);
    console.log("- error message:", errorMsg);
    console.log("=========================");

    const sanitizedMsg = error.message.replace(new RegExp(apiToken, "g"), "[REDACTED_API_TOKEN]");
    throw new Error(`Delhivery cancel failed: ${sanitizedMsg}`);
  }
};

module.exports = {
  createDelhiveryShipment,
  normalizeDelhiveryStatus,
  getShipmentStatus,
  buildDeliveryTimeline,
  getStatusPriority,
  syncDelhiveryShipmentStatus,
  cancelDelhiveryShipment
};
