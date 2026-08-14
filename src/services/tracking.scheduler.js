const cron = require("node-cron");
const { pool } = require("../config/db");
const delhiveryService = require("./delhivery.service");
const shiprocketService = require("./shiprocket.service");

let isRunning = false;

const runTrackingSync = async () => {
  if (isRunning) {
    console.log("[SHIPPING SYNC] Previous tracking sync still running. Skipping overlapping execution.");
    return;
  }

  isRunning = true;
  console.log("[SHIPPING SYNC] Starting tracking sync...");

  try {
    const [shipments] = await pool.query(
      `SELECT sd.*, o.order_number FROM shipment_details sd
       INNER JOIN orders o ON sd.order_id = o.order_id
       WHERE sd.awb_number IS NOT NULL
         AND o.order_status NOT IN ('DELIVERED', 'CANCELLED')`
    );

    console.log(`[SHIPPING SYNC] Found ${shipments.length} active shipments to synchronize.`);

    for (const shipment of shipments) {
      try {
        console.log(`[SHIPPING SYNC] Checking AWB: ${shipment.awb_number} (Carrier: ${shipment.carrier || 'DELHIVERY'}, Order: ${shipment.order_number})`);
        const syncResult = shipment.carrier === 'SHIPROCKET'
          ? await shiprocketService.syncShiprocketShipmentStatus(shipment)
          : await delhiveryService.syncDelhiveryShipmentStatus(shipment);
        console.log(`[SHIPPING SYNC] Status updated: ${syncResult?.statusChanged}`);
      } catch (shipmentErr) {
        console.error(`❌ [SHIPPING SYNC ERROR] Failed to sync AWB ${shipment.awb_number}:`, shipmentErr.message);
      }
    }

    console.log("[DELHIVERY SYNC] Completed");
  } catch (error) {
    console.error("❌ [DELHIVERY SYNC FATAL ERROR] Scheduler run failed:", error.message);
  } finally {
    isRunning = false;
  }
};

const initScheduler = () => {
  console.log("[DELHIVERY SYNC] Scheduler initialization requested.");
  // Run tracking sync automatically every hour
  cron.schedule("0 * * * *", runTrackingSync);
};

module.exports = {
  initScheduler,
  runTrackingSync
};
