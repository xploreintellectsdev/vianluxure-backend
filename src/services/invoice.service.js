const PDFDocument = require('pdfkit');

/**
 * Generates a professional PDF Invoice for an order
 * Returns a Promise resolving to a Buffer
 */
const toTitleCase = (str) => {
  if (!str || typeof str !== 'string') return str;
  return str.split(' ').map(w => w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : '').join(' ');
};

const generateInvoicePdfBuffer = (order) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // ----------------------------------------------------
      // HEADER SECTION
      // ----------------------------------------------------
      // Left side: Brand info
      doc.font('Helvetica-Bold').fontSize(20).fillColor('#111111').text('VIAN LUXURE', 50, 45);
      doc.font('Helvetica').fontSize(9.5).fillColor('#555555').text('Premium fabrics & Custom tailoring', 50, 68);
      doc.fontSize(8.5).text('support@vianluxure.com | www.vianluxure.com', 50, 81);

      // Right side: Invoice ID and Date
      doc.font('Helvetica-Bold').fontSize(18).fillColor('#111111').text('INVOICE', 350, 45, { align: 'right', width: 195 });

      const invoiceId = `${order.order_number || order.order_id}`;
      const orderDate = order.order_date || order.created_at ? new Date(order.order_date || order.created_at).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');
      const paymentStatus = (order.payment_status || 'PAID').toUpperCase();

      doc.font('Helvetica').fontSize(9.5).fillColor('#333333');
      doc.text(`Invoice ID: ${invoiceId}`, 350, 68, { align: 'right', width: 195 });
      doc.text(`Date: ${orderDate}`, 350, 81, { align: 'right', width: 195 });
      doc.text(`Payment Status: ${paymentStatus}`, 350, 94, { align: 'right', width: 195 });

      // Divider line
      doc.moveTo(50, 120).lineTo(545, 120).strokeColor('#E5E7EB').lineWidth(1).stroke();

      // ----------------------------------------------------
      // CUSTOMER & DELIVERY DETAILS
      // ----------------------------------------------------
      const detailsTop = 135;

      // Left Column: Customer Details
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#111111').text('CUSTOMER DETAILS', 50, detailsTop);
      doc.font('Helvetica').fontSize(9).fillColor('#374151');

      const custName = toTitleCase(order.customer_name || order.address_full_name || order.name || 'Customer');
      const custEmail = (order.customer_email || order.email || order.user_email || 'N/A').toLowerCase();
      const custPhone = order.customer_mobile || order.mobile || order.user_mobile || 'N/A';

      doc.text(`Name: ${custName}`, 50, detailsTop + 16, { width: 220 });
      doc.text(`Email: ${custEmail}`, 50, doc.y + 3, { width: 220 });
      doc.text(`Phone: ${custPhone}`, 50, doc.y + 3, { width: 220 });

      // Right Column: Delivery Address
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#111111').text('DELIVERY ADDRESS', 290, detailsTop);
      doc.font('Helvetica').fontSize(9).fillColor('#374151');

      const addrName = toTitleCase(order.address_full_name || order.customer_name || 'Customer');
      doc.text(`Name: ${addrName}`, 290, detailsTop + 16, { width: 255 });

      let addressText = '';
      if (order.house_building || order.street_locality || order.city) {
        const parts = [
          toTitleCase(order.house_building),
          toTitleCase(order.street_locality),
          order.landmark ? `Landmark: ${toTitleCase(order.landmark)}` : null,
          [toTitleCase(order.address_city || order.city), toTitleCase(order.address_state || order.state), order.address_postal_code || order.postal_code].filter(Boolean).join(', ')
        ].filter(Boolean);
        addressText = parts.join('\n');
      } else {
        addressText = toTitleCase(order.shipping_address || 'Address details on file');
      }

      const addressLines = addressText.split('\n');
      doc.text(`Address: ${addressLines[0]}`, 290, doc.y + 3, { width: 255 });
      if (addressLines.length > 1) {
        doc.text(addressLines.slice(1).join('\n'), 290, doc.y + 2, { width: 255, lineGap: 2 });
      }
      
      const addrPhone = order.address_phone || order.customer_mobile || order.mobile || order.user_mobile || 'N/A';
      doc.text(`Phone number: ${addrPhone}`, 290, doc.y + 3, { width: 255 });

      // Ensure Y is adjusted below both columns
      const tableTop = Math.max(doc.y, detailsTop + 75) + 20;

      // ----------------------------------------------------
      // ITEMS TABLE HEADER
      // ----------------------------------------------------
      // Draw background header bar
      doc.rect(50, tableTop, 495, 22).fill('#F3F4F6');

      // Draw header borders
      doc.moveTo(50, tableTop).lineTo(545, tableTop).strokeColor('#E5E7EB').lineWidth(1).stroke();
      doc.moveTo(50, tableTop + 22).lineTo(545, tableTop + 22).strokeColor('#E5E7EB').lineWidth(1).stroke();
      [50, 195, 375, 430, 485, 545].forEach(x => {
        doc.moveTo(x, tableTop).lineTo(x, tableTop + 22).strokeColor('#E5E7EB').lineWidth(1).stroke();
      });

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#1F2937');
      doc.text('ITEM DESCRIPTION', 55, tableTop + 6, { width: 135 });
      doc.text('SPECIFICATIONS', 200, tableTop + 6, { width: 170 });
      doc.text('QTY/MTR', 375, tableTop + 6, { width: 50, align: 'right' });
      doc.text('PRICE', 430, tableTop + 6, { width: 50, align: 'right' });
      doc.text('TOTAL', 485, tableTop + 6, { width: 55, align: 'right' });

      let currentY = tableTop + 22;
      const items = order.items || [];

      // ----------------------------------------------------
      // ITEMS TABLE ROWS
      // ----------------------------------------------------
      items.forEach((item, idx) => {
        // Check if page break is needed
        if (currentY > 670) {
          doc.addPage();
          currentY = 50;
        }

        const itemName = item.product_name || item.name || 'Custom Garment / Fabric';
        const itemType = (item.product_type || item.type || '').toUpperCase();

        const rowTop = currentY;
        const textY = currentY + 6;

        // Col 1: Description
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#111111');
        doc.text(itemName, 55, textY, { width: 135 });
        const nameHeight = doc.y - textY;

        if (itemType) {
          doc.font('Helvetica').fontSize(8).fillColor('#6B7280');
          doc.text(`Type: ${itemType}`, 55, doc.y + 2, { width: 135 });
        }
        const col1Height = doc.y - rowTop;

        // Col 2: Specifications
        let specY = textY;
        doc.font('Helvetica').fontSize(8.5).fillColor('#374151');

        let hasSpec = false;
        if (item.fit_style) {
          doc.text(`Fit: ${item.fit_style}`, 200, specY, { width: 170 });
          specY = doc.y + 2;
          hasSpec = true;
        }
        if (item.selected_size) {
          doc.text(`Size: ${item.selected_size}`, 200, specY, { width: 170 });
          specY = doc.y + 2;
          hasSpec = true;
        }
        if (item.selected_meter) {
          doc.text(`Length: ${item.selected_meter} Meters`, 200, specY, { width: 170 });
          specY = doc.y + 2;
          hasSpec = true;
        }

        // Custom Bespoke Selections in gold/bronze tone
        if (item.design_selections && item.design_selections.length > 0) {
          const customSummary = item.design_selections
            .map(s => `${s.option_type || 'custom'}: ${s.option_name || ''}`)
            .join(', ');

          doc.font('Helvetica').fontSize(8).fillColor('#C8A64D');
          doc.text(`Custom Details: ${customSummary}`, 200, specY, { width: 170, lineGap: 1 });
          specY = doc.y + 2;
          hasSpec = true;
        }

        if (item.monogram_enabled && item.monogram_text) {
          doc.font('Helvetica-Oblique').fontSize(8).fillColor('#4B5563');
          doc.text(`Monogram: "${item.monogram_text}"`, 200, specY, { width: 170 });
          specY = doc.y + 2;
          hasSpec = true;
        }

        if (!hasSpec) {
          doc.font('Helvetica').fontSize(8.5).fillColor('#9CA3AF');
          doc.text('Standard specs', 200, specY, { width: 170 });
          specY = doc.y + 2;
        }

        const col2Height = specY - rowTop;

        // Col 3, 4, 5: Qty, Price, Total
        const qtyStr = item.selected_meter ? `${item.selected_meter}m` : String(item.quantity || 1);
        const unitPrice = Number(item.unit_price || item.price || 0).toFixed(2);
        const totalPrice = Number(item.total_price || item.totalPrice || (unitPrice * (item.selected_meter || item.quantity || 1))).toFixed(2);

        doc.font('Helvetica').fontSize(9).fillColor('#111111');
        doc.text(qtyStr, 375, textY, { width: 50, align: 'right' });
        doc.text(`INR ${unitPrice}`, 430, textY, { width: 50, align: 'right' });
        doc.text(`INR ${totalPrice}`, 485, textY, { width: 55, align: 'right' });

        // Calculate max row height
        const rowHeight = Math.max(col1Height, col2Height, 20) + 12;

        // Draw borders for row
        doc.moveTo(50, rowTop + rowHeight).lineTo(545, rowTop + rowHeight).strokeColor('#E5E7EB').lineWidth(1).stroke(); // bottom
        [50, 195, 375, 430, 485, 545].forEach(x => {
          doc.moveTo(x, rowTop).lineTo(x, rowTop + rowHeight).strokeColor('#E5E7EB').lineWidth(1).stroke(); // vertical lines
        });

        currentY += rowHeight;
      });

      // ----------------------------------------------------
      // FINANCIAL SUMMARY
      // ----------------------------------------------------
      currentY = Math.max(currentY + 15, doc.y + 15);
      if (currentY > 680) {
        doc.addPage();
        currentY = 50;
      }

      const summaryLeft = 330;
      const valLeft = 440;

      doc.font('Helvetica').fontSize(9.5).fillColor('#374151');
      doc.text('Subtotal:', summaryLeft, currentY, { width: 100, align: 'right' });
      doc.text(`INR ${Number(order.subtotal || 0).toFixed(2)}`, valLeft, currentY, { width: 100, align: 'right' });

      currentY += 16;
      doc.text('Shipping:', summaryLeft, currentY, { width: 100, align: 'right' });
      doc.text(`INR ${Number(order.shipping_fee || 0).toFixed(2)}`, valLeft, currentY, { width: 100, align: 'right' });

      currentY += 20;
      doc.moveTo(350, currentY - 4).lineTo(545, currentY - 4).strokeColor('#D1D5DB').lineWidth(1).stroke();

      doc.font('Helvetica-Bold').fontSize(11).fillColor('#111111');
      doc.text('Grand Total:', summaryLeft, currentY, { width: 100, align: 'right' });
      doc.text(`INR ${Number(order.grand_total || 0).toFixed(2)}`, valLeft, currentY, { width: 100, align: 'right' });

      // ----------------------------------------------------
      // FOOTER
      // ----------------------------------------------------
      const footerTop = 740;
      doc.font('Helvetica-Oblique').fontSize(9).fillColor('#374151');
      doc.text('Thank you for shopping with VIAN LUXURE!', 50, footerTop, { align: 'center', width: 495 });

      doc.font('Helvetica').fontSize(8).fillColor('#6B7280');
      doc.text('This is a computer generated invoice and does not require signature.', 50, footerTop + 14, { align: 'center', width: 495 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = {
  generateInvoicePdfBuffer
};
