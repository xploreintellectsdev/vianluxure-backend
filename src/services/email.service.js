const nodemailer = require('nodemailer');
const { pool } = require('../config/db');

// Create reusable transporter object using regular SMTP transport
const createTransporter = () => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('⚠️ [EMAIL SERVICE] SMTP_USER or SMTP_PASS is missing in environment variables.');
    return null;
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: process.env.SMTP_SECURE === 'true' || parseInt(process.env.SMTP_PORT || '465', 10) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const sendMail = async ({ to, subject, html, attachments = [] }) => {
  if (!to) {
    console.warn(`⚠️ [EMAIL SERVICE] No recipient email provided for subject: "${subject}". Skipping email.`);
    return false;
  }
  const transporter = createTransporter();
  if (!transporter) {
    return false;
  }
  try {
    const fromName = process.env.MAIL_FROM_NAME || 'VIAN LUXURE';
    const fromEmail = process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER;
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html,
      attachments,
    });
    console.log(`✉️ [EMAIL SENT] To: ${to} | Subject: "${subject}"`);
    return true;
  } catch (error) {
    console.error(`❌ [EMAIL ERROR] Failed to send to ${to}:`, error.message);
    return false;
  }
};

const getAdminEmail = () => process.env.ADMIN_EMAIL || process.env.SMTP_USER || 'madhan.23.11.5@gmail.com';

/**
 * Get recipient email for an order by checking order records, user accounts, or address records
 */
const getOrderEmail = async (order) => {
  if (order.customer_email) return order.customer_email;
  if (order.user_email && !order.user_email.endsWith('@vianluxure.local')) return order.user_email;
  if (order.user_id) {
    const [uRows] = await pool.query('SELECT email FROM users WHERE user_id = ?', [order.user_id]);
    if (uRows[0]?.email && !uRows[0].email.endsWith('@vianluxure.local')) {
      return uRows[0].email;
    }
  }
  return null;
};

const generateOrderItemsHtml = (items = []) => {
  if (!items || items.length === 0) return '<p>No item details available.</p>';
  return `
    <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-family: sans-serif;">
      <thead>
        <tr style="background-color: #fbf9f4; border-bottom: 2px solid #C8A64D;">
          <th style="padding: 10px; text-align: left; font-size: 13px; color: #333;">Product Name</th>
          <th style="padding: 10px; text-align: center; font-size: 13px; color: #333;">Qty / Meters</th>
          <th style="padding: 10px; text-align: right; font-size: 13px; color: #333;">Price</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => `
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px; font-size: 14px; color: #444;">
              <strong>${item.product_name || 'Product'}</strong>
              ${item.selected_size ? `<br><small style="color:#777;">Size: ${item.selected_size}</small>` : ''}
              ${item.fit_style ? `<br><small style="color:#777;">Fit: ${item.fit_style}</small>` : ''}
              ${item.selected_meter ? `<br><small style="color:#777;">Length: ${item.selected_meter}m</small>` : ''}
            </td>
            <td style="padding: 10px; text-align: center; font-size: 14px; color: #555;">
              ${item.selected_meter ? `${item.selected_meter}m` : (item.quantity || 1)}
            </td>
            <td style="padding: 10px; text-align: right; font-size: 14px; color: #333; font-weight: bold;">
              ₹${Number(item.total_price || item.unit_price || 0).toFixed(2)}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
};

/**
 * Send order placed notification to User & Admin
 */
const sendOrderPlacedEmails = async (orderId) => {
  try {
    const orderService = require('./order.service');
    const order = await orderService.getOrderById(orderId);
    if (!order) return;

    const customerEmail = await getOrderEmail(order);
    const adminEmail = getAdminEmail();
    const itemsHtml = generateOrderItemsHtml(order.items || []);

    const userHtml = `
      <div style="max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; font-family: Arial, sans-serif; color: #1e293b;">
        <div style="text-align: center; border-bottom: 2px solid #C8A64D; padding-bottom: 15px; margin-bottom: 20px;">
          <h1 style="color: #0f172a; margin: 0; font-size: 24px; font-family: Georgia, serif;">VIAN LUXURE</h1>
          <p style="color: #C8A64D; margin: 5px 0 0; font-size: 12px; letter-spacing: 2px; text-transform: uppercase;">Order Confirmed</p>
        </div>
        <p style="font-size: 16px;">Dear <strong>${order.customer_name || 'Customer'}</strong>,</p>
        <p style="line-height: 1.6; color: #475569;">Thank you for your purchase! We have successfully received your order <strong>#${order.order_number || order.order_id}</strong> and are preparing it for processing.</p>
        
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #C8A64D;">
          <p style="margin: 0; font-size: 14px;"><strong>Order Number:</strong> #${order.order_number || order.order_id}</p>
          <p style="margin: 5px 0 0; font-size: 14px;"><strong>Payment Status:</strong> ${order.payment_status || 'Success'} (${order.gateway_name || 'Online Payment'})</p>
          <p style="margin: 5px 0 0; font-size: 14px;"><strong>Delivery Address:</strong><br>${order.shipping_address || 'Online Order'}</p>
        </div>

        <h3 style="font-size: 16px; margin-top: 25px; color: #0f172a;">Order Summary</h3>
        ${itemsHtml}

        <div style="text-align: right; margin-top: 15px; font-size: 16px;">
          <p style="margin: 5px 0;">Subtotal: ₹${Number(order.subtotal || 0).toFixed(2)}</p>
          <p style="margin: 5px 0;">Shipping Fee: ₹${Number(order.shipping_fee || 0).toFixed(2)}</p>
          <p style="margin: 8px 0; font-size: 18px; font-weight: bold; color: #0f172a;">Grand Total: ₹${Number(order.grand_total || 0).toFixed(2)}</p>
        </div>

        <div style="margin-top: 35px; border-top: 1px solid #e2e8f0; pt: 20px; font-size: 12px; color: #64748b; text-align: center;">
          <p>If you have any questions, simply reply to this email or reach out to our customer support.</p>
          <p style="margin: 0;">&copy; ${new Date().getFullYear()} Vian Luxure. All Rights Reserved.</p>
        </div>
      </div>
    `;

    const adminHtml = `
      <div style="max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #cbd5e1; border-radius: 12px; font-family: Arial, sans-serif;">
        <h2 style="color: #b45309; margin-top: 0;">🚨 New Order Alert: #${order.order_number || order.order_id}</h2>
        <p>A new order has been placed on VIAN LUXURE.</p>
        <ul>
          <li><strong>Customer:</strong> ${order.customer_name} (${order.customer_mobile || 'N/A'})</li>
          <li><strong>Email:</strong> ${customerEmail || 'Not specified'}</li>
          <li><strong>Total Amount:</strong> ₹${Number(order.grand_total || 0).toFixed(2)} (${order.payment_status || 'Success'})</li>
          <li><strong>Shipping Address:</strong> ${order.shipping_address || 'N/A'}</li>
        </ul>
        <h3>Items Ordered</h3>
        ${itemsHtml}
      </div>
    `;

    let invoiceAttachments = [];
    try {
      const invoiceService = require('./invoice.service');
      const pdfBuffer = await invoiceService.generateInvoicePdfBuffer(order);
      invoiceAttachments = [
        {
          filename: `Invoice_${order.order_number || order.order_id}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ];
    } catch (pdfErr) {
      console.error("⚠️ Failed to generate invoice PDF for email attachment:", pdfErr.message);
    }

    if (customerEmail) {
      await sendMail({
        to: customerEmail,
        subject: `[VIAN LUXURE] Order Confirmation - #${order.order_number || order.order_id}`,
        html: userHtml,
        attachments: invoiceAttachments,
      });
    }
    await sendMail({
      to: adminEmail,
      subject: `[Admin Alert] New Order Placed - #${order.order_number || order.order_id}`,
      html: adminHtml,
      attachments: invoiceAttachments,
    });
  } catch (error) {
    console.error('❌ [EMAIL SERVICE ERROR in sendOrderPlacedEmails]:', error.message);
  }
};

/**
 * Send order cancellation email to User & Admin
 */
const sendOrderCancelledEmails = async (orderId, reason = 'Cancelled upon request') => {
  try {
    const orderService = require('./order.service');
    const order = await orderService.getOrderById(orderId);
    if (!order) return;

    const customerEmail = await getOrderEmail(order);
    const adminEmail = getAdminEmail();

    const userHtml = `
      <div style="max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #fecaca; border-radius: 12px; font-family: Arial, sans-serif; color: #1e293b;">
        <h2 style="color: #dc2626; margin-top: 0;">Order Cancelled</h2>
        <p>Dear <strong>${order.customer_name || 'Customer'}</strong>,</p>
        <p>Your order <strong>#${order.order_number || order.order_id}</strong> has been cancelled.</p>
        <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444; color: #991b1b;">
          <strong>Reason / Note:</strong> ${reason || 'Order cancelled'}
        </div>
        <p style="margin-top: 20px;">If a refund is applicable for prepaid payments or store wallets, it will be initiated back to your respective original payment method or wallet.</p>
        <p style="font-size: 12px; color: #64748b; margin-top: 30px;">Thank you for considering VIAN LUXURE.</p>
      </div>
    `;

    const adminHtml = `
      <div style="max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #cbd5e1; border-radius: 12px; font-family: Arial, sans-serif;">
        <h2 style="color: #dc2626; margin-top: 0;">⚠️ Order Cancelled: #${order.order_number || order.order_id}</h2>
        <p>An order was marked as cancelled.</p>
        <ul>
          <li><strong>Customer:</strong> ${order.customer_name} (${order.customer_mobile || 'N/A'})</li>
          <li><strong>Order Amount:</strong> ₹${Number(order.grand_total || 0).toFixed(2)}</li>
          <li><strong>Reason / Remarks:</strong> ${reason}</li>
        </ul>
      </div>
    `;

    if (customerEmail) {
      await sendMail({
        to: customerEmail,
        subject: `[VIAN LUXURE] Order Cancelled - #${order.order_number || order.order_id}`,
        html: userHtml,
      });
    }
    await sendMail({
      to: adminEmail,
      subject: `[Admin Alert] Order Cancelled - #${order.order_number || order.order_id}`,
      html: adminHtml,
    });
  } catch (error) {
    console.error('❌ [EMAIL SERVICE ERROR in sendOrderCancelledEmails]:', error.message);
  }
};

/**
 * Send bulk / corporate order confirmation to User & Admin
 */
const sendCorporateInquiryEmails = async (inquiryData) => {
  try {
    const adminEmail = getAdminEmail();
    const { name, company_name, email, phone, message } = inquiryData;

    const userHtml = `
      <div style="max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; font-family: Arial, sans-serif; color: #1e293b;">
        <div style="border-bottom: 2px solid #C8A64D; pb: 15px; mb: 20px;">
          <h2 style="color: #0f172a; margin: 0; font-family: Georgia, serif;">VIAN LUXURE - Corporate Team</h2>
        </div>
        <p>Dear <strong>${name}</strong>,</p>
        <p>Thank you for submitting your corporate & bulk inquiry for <strong>${company_name}</strong>!</p>
        <p>We have received your requirement details. Our dedicated B2B & Retail Supply specialist will review your request and get in touch with you shortly via phone or email.</p>
        <div style="background-color: #fbf9f4; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="margin: 0; font-size: 13px;"><strong>Your Submitted Requirement:</strong></p>
          <p style="margin: 5px 0 0; font-style: italic; color: #4b5563;">"${message || 'No specific notes mentioned.'}"</p>
        </div>
        <p style="font-size: 13px; color: #64748b;">We look forward to collaborating with your company!</p>
      </div>
    `;

    const adminHtml = `
      <div style="max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #cbd5e1; border-radius: 12px; font-family: Arial, sans-serif;">
        <h2 style="color: #047857; margin-top: 0;">🏢 New Corporate / Bulk Order Inquiry</h2>
        <p>A new retailer bulk inquiry has just been submitted:</p>
        <table style="width: 100%; font-size: 14px;">
          <tr><td><strong>Contact Person:</strong></td><td>${name}</td></tr>
          <tr><td><strong>Company Name:</strong></td><td>${company_name}</td></tr>
          <tr><td><strong>Email:</strong></td><td><a href="mailto:${email}">${email}</a></td></tr>
          <tr><td><strong>Phone:</strong></td><td><a href="tel:${phone}">${phone}</a></td></tr>
        </table>
        <div style="margin-top: 20px; background-color: #f3f4f6; padding: 15px; border-radius: 6px;">
          <strong>Message / Requirement:</strong><br>
          <span style="white-space: pre-wrap;">${message || 'N/A'}</span>
        </div>
      </div>
    `;

    if (email) {
      await sendMail({
        to: email,
        subject: `[VIAN LUXURE] Corporate & Bulk Inquiry Received`,
        html: userHtml,
      });
    }
    await sendMail({
      to: adminEmail,
      subject: `[Admin Alert] New Corporate Inquiry - ${company_name}`,
      html: adminHtml,
    });
  } catch (error) {
    console.error('❌ [EMAIL SERVICE ERROR in sendCorporateInquiryEmails]:', error.message);
  }
};

/**
 * Send shipment tracking notice to User when shipment is created
 */
const sendShipmentCreatedEmail = async (orderId, shipmentInfo) => {
  try {
    const orderService = require('./order.service');
    const order = await orderService.getOrderById(orderId);
    if (!order) return;

    const customerEmail = await getOrderEmail(order);
    if (!customerEmail) {
      console.log(`[SHIPMENT EMAIL] No email found for Order #${order.order_number || order.order_id}. Skipping email.`);
      return;
    }

    const { waybill, carrier, trackingUrl } = shipmentInfo;
    const carrierDisplay = carrier === 'SHIPROCKET' ? 'Shiprocket Logistics' : (carrier || 'Courier Delivery');

    const userHtml = `
      <div style="max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; font-family: Arial, sans-serif; color: #1e293b;">
        <div style="text-align: center; border-bottom: 2px solid #C8A64D; pb: 15px; mb: 20px;">
          <h1 style="color: #0f172a; margin: 0; font-size: 24px; font-family: Georgia, serif;">VIAN LUXURE</h1>
          <p style="color: #059669; margin: 5px 0 0; font-size: 13px; font-weight: bold;">📦 Your Order Has Shipped!</p>
        </div>
        <p>Dear <strong>${order.customer_name || 'Customer'}</strong>,</p>
        <p>Great news! Your order <strong>#${order.order_number || order.order_id}</strong> has been dispatched via <strong>${carrierDisplay}</strong>.</p>
        
        <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; padding: 18px; border-radius: 10px; text-align: center; margin: 25px 0;">
          <p style="margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #065f46; font-weight: bold;">Tracking Number (AWB)</p>
          <p style="margin: 5px 0 15px; font-size: 20px; font-family: monospace; font-weight: bold; color: #047857;">${waybill || 'Assigned soon'}</p>
          ${trackingUrl ? `
            <a href="${trackingUrl}" target="_blank" style="display: inline-block; background-color: #059669; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              Track Order Live &rarr;
            </a>
          ` : ''}
        </div>

        <p style="font-size: 13px; color: #475569;">You can use the tracking link above or log into your store account to view detailed scan activities and expected delivery schedules.</p>
        <p style="font-size: 12px; color: #94a3b8; margin-top: 30px; text-align: center; border-top: 1px solid #f1f5f9; pt: 15px;">
          &copy; ${new Date().getFullYear()} Vian Luxure. All rights reserved.
        </p>
      </div>
    `;

    await sendMail({
      to: customerEmail,
      subject: `[VIAN LUXURE] Your Order #${order.order_number || order.order_id} has Shipped! 📦`,
      html: userHtml,
    });
  } catch (error) {
    console.error('❌ [EMAIL SERVICE ERROR in sendShipmentCreatedEmail]:', error.message);
  }
};

/**
 * Send wallet credit notification to user
 */
const sendWalletCreditEmail = async ({ userId, amount, newBalance, reason, remarks, transactionSource }) => {
  try {
    const [uRows] = await pool.query('SELECT name, email FROM users WHERE user_id = ?', [userId]);
    const user = uRows[0];
    if (!user || !user.email || user.email.endsWith('@vianluxure.local')) {
      console.warn(`⚠️ [EMAIL SERVICE] No valid email found for user_id ${userId}. Skipping wallet credit notification.`);
      return;
    }

    const formattedAmount = Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const formattedBalance = Number(newBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    
    let sourceTitle = "Wallet Credit Successful";
    let detailTitle = "Gift Credit";
    if (transactionSource === "ADMIN_CREDIT") {
      sourceTitle = "Gift & Promotional Credit";
      detailTitle = "Gift Credit";
    } else if (transactionSource === "ORDER_REFUND") {
      sourceTitle = "Order Refund Credit";
      detailTitle = "Refund Credit";
    } else if (transactionSource === "WALLET_TOPUP") {
      sourceTitle = "Wallet Top-up Successful";
      detailTitle = "Wallet Recharge / Top-up";
    }

    const userHtml = `
      <div style="max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 16px; font-family: Arial, sans-serif; color: #1e293b; background-color: #ffffff;">
        <div style="text-align: center; border-bottom: 2px solid #C8A64D; padding-bottom: 20px; margin-bottom: 25px;">
          <h1 style="color: #0f172a; margin: 0; font-size: 26px; font-family: Georgia, serif; letter-spacing: 2px;">VIAN LUXURE</h1>
          <p style="color: #059669; margin: 8px 0 0; font-size: 14px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">✨ ${sourceTitle}</p>
        </div>
        
        <p style="font-size: 16px; line-height: 1.6;">Dear <strong>${user.name || 'Valued Customer'}</strong>,</p>
        <p style="font-size: 15px; color: #475569; line-height: 1.6;">
          We are pleased to inform you that an amount has been credited to your Vian Luxure wallet. You can use your balance seamlessly during checkout for your upcoming bespoke and ready-to-wear orders.
        </p>
        
        <div style="background-color: #fbf9f4; border: 1px solid #E7D6A3; border-radius: 12px; padding: 24px; margin: 25px 0; text-align: center;">
          <p style="margin: 0 0 6px; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1.5px; font-weight: bold;">Amount Credited</p>
          <p style="margin: 0; font-size: 36px; font-family: Georgia, serif; font-weight: bold; color: #059669;">₹${formattedAmount}</p>
          
          <div style="margin-top: 20px; padding-top: 18px; border-top: 1px dashed #cbd5e1; text-align: center;">
            <span style="color: #64748b; font-size: 12px; display: block; text-transform: uppercase; letter-spacing: 1px;">Available Wallet Balance</span>
            <strong style="color: #0f172a; font-size: 22px; font-family: Georgia, serif; margin-top: 4px; display: block;">₹${formattedBalance}</strong>
          </div>
        </div>
        
        <div style="font-size: 14px; color: #334155; background: #f8fafc; padding: 20px; border-left: 4px solid #C8A64D; border-radius: 8px; margin: 25px 0; line-height: 1.7; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <p style="margin: 0 0 12px; font-weight: bold; color: #0f172a; text-transform: uppercase; font-size: 13px; letter-spacing: 1.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Transaction Details</p>
          <div><strong style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; display: block;">Transaction Detail:</strong> <span style="color: #0f172a; font-weight: 600; font-size: 15px;">${detailTitle}</span></div>
          ${reason ? `<div style="margin-top: 10px;"><strong style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; display: block;">Reason:</strong> <span style="color: #1e293b; font-weight: 500;">${reason}</span></div>` : ''}
          ${remarks ? `<div style="margin-top: 10px;"><strong style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; display: block;">Additional Reason / Remarks:</strong> <span style="color: #1e293b;">${remarks}</span></div>` : ''}
        </div>

        <div style="text-align: center; margin: 35px 0;">
          <a href="https://vianluxure.com/profile/wallet" target="_blank" style="display: inline-block; background-color: #C8A64D; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 30px; font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; box-shadow: 0 4px 10px rgba(200, 166, 77, 0.35);">
            View Wallet Balance &rarr;
          </a>
        </div>
        
        <p style="font-size: 13px; color: #64748b; line-height: 1.6;">
          Thank you for choosing Vian Luxure. If you have any questions regarding your account or wallet balance, simply reply to this email or contact our concierges.
        </p>
        <p style="font-size: 12px; color: #94a3b8; margin-top: 35px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 15px;">
          &copy; ${new Date().getFullYear()} Vian Luxure. All rights reserved.
        </p>
      </div>
    `;

    await sendMail({
      to: user.email,
      subject: `[VIAN LUXURE] ₹${Number(amount).toLocaleString('en-IN')} Credited to Your Wallet ✨`,
      html: userHtml,
    });
  } catch (error) {
    console.error('❌ [EMAIL SERVICE ERROR in sendWalletCreditEmail]:', error.message);
  }
};

/**
 * Send email verification OTP code for registration
 */
const sendVerificationOtpEmail = async ({ name, email, otp }) => {
  try {
    const userHtml = `
      <div style="max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 16px; font-family: Arial, sans-serif; color: #1e293b; background-color: #ffffff;">
        <div style="text-align: center; border-bottom: 2px solid #C8A64D; padding-bottom: 20px; margin-bottom: 25px;">
          <h1 style="color: #0f172a; margin: 0; font-size: 26px; font-family: Georgia, serif; letter-spacing: 2px;">VIAN LUXURE</h1>
          <p style="color: #C8A64D; margin: 8px 0 0; font-size: 13px; font-weight: bold; letter-spacing: 1.5px; text-transform: uppercase;">✨ EMAIL VERIFICATION</p>
        </div>
        
        <p style="font-size: 16px; line-height: 1.6;">Dear <strong>${name || 'Valued Customer'}</strong>,</p>
        <p style="font-size: 15px; color: #475569; line-height: 1.6;">
          Thank you for starting your registration with Vian Luxure. To protect your account and verify your email address, please enter the following one-time verification code on the registration page:
        </p>
        
        <div style="background-color: #fbf9f4; border: 1px solid #E7D6A3; border-radius: 12px; padding: 28px; margin: 30px 0; text-align: center;">
          <p style="margin: 0 0 8px; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 2px; font-weight: bold;">Your Verification Code</p>
          <div style="font-size: 40px; font-family: 'Courier New', monospace; font-weight: bold; color: #0f172a; letter-spacing: 8px; padding: 8px 0;">
            ${otp}
          </div>
          <p style="margin: 12px 0 0; font-size: 12px; color: #dc2626; font-weight: 500;">
            ⏳ This code will expire in 15 minutes.
          </p>
        </div>
        
        <p style="font-size: 14px; color: #64748b; line-height: 1.6;">
          If you did not initiate this registration request, please disregard this email or inform our security team immediately.
        </p>
        <p style="font-size: 12px; color: #94a3b8; margin-top: 35px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 15px;">
          &copy; ${new Date().getFullYear()} Vian Luxure. All rights reserved.
        </p>
      </div>
    `;

    await sendMail({
      to: email,
      subject: `[VIAN LUXURE] ${otp} is your Registration Verification Code ✨`,
      html: userHtml,
    });
  } catch (error) {
    console.error('❌ [EMAIL SERVICE ERROR in sendVerificationOtpEmail]:', error.message);
    throw new Error('Failed to deliver email verification code. Please check your email address.');
  }
};

module.exports = {
  sendOrderPlacedEmails,
  sendOrderCancelledEmails,
  sendCorporateInquiryEmails,
  sendShipmentCreatedEmail,
  sendWalletCreditEmail,
  sendVerificationOtpEmail,
};