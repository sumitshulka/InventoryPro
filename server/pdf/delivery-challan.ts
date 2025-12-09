import PDFDocument from 'pdfkit';
import { SalesOrder, SalesOrderDispatch, Client, Warehouse, User } from '@shared/schema';

interface DispatchItem {
  id: number;
  itemId: number;
  quantity: number;
  notes?: string | null;
  item?: {
    id: number;
    name: string;
    sku: string;
    unit: string;
  } | null;
}

interface OrganizationInfo {
  organizationName: string;
  logo?: string | null;
  currency: string;
  currencySymbol: string;
}

interface ChallanData {
  dispatch: SalesOrderDispatch & { items: DispatchItem[] };
  order: SalesOrder;
  client: Client;
  warehouse: Warehouse;
  organization: OrganizationInfo;
  dispatchedBy?: { id: number; name: string } | null;
}

export function generateDeliveryChallanPDF(data: ChallanData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 40,
        bufferPages: true 
      });
      
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const { dispatch, order, client, warehouse, organization } = data;
      const pageWidth = doc.page.width - 80;

      // Add company logo if available
      if (organization.logo) {
        try {
          let logoData = organization.logo;
          if (logoData.includes('base64,')) {
            logoData = logoData.split('base64,')[1];
          }
          const logoBuffer = Buffer.from(logoData, 'base64');
          
          const logoWidth = 80;
          const logoX = (doc.page.width - logoWidth) / 2;
          doc.image(logoBuffer, logoX, 40, { width: logoWidth });
          doc.y = 130;
        } catch (logoError) {
          console.error('Error rendering logo in PDF:', logoError);
        }
      }

      doc.font('Helvetica-Bold').fontSize(20).text('DELIVERY CHALLAN', { align: 'center' });
      doc.moveDown(0.5);
      
      doc.font('Helvetica-Bold').fontSize(14).text(organization.organizationName, { align: 'center' });
      doc.moveDown(0.3);
      
      if (warehouse) {
        doc.font('Helvetica').fontSize(10)
          .text(`Warehouse: ${warehouse.name}`, { align: 'center' });
      }
      doc.moveDown(1);

      doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
      doc.moveDown(0.5);

      const challanInfoY = doc.y;
      doc.font('Helvetica-Bold').fontSize(10).text('Challan No:', 40, challanInfoY);
      doc.font('Helvetica').text(dispatch.dispatchCode, 120, challanInfoY);
      
      doc.font('Helvetica-Bold').text('Date:', 40, challanInfoY + 15);
      doc.font('Helvetica').text(
        new Date(dispatch.dispatchDate).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }),
        120, challanInfoY + 15
      );
      
      doc.font('Helvetica-Bold').text('Order No:', 40, challanInfoY + 30);
      doc.font('Helvetica').text(order.orderCode, 120, challanInfoY + 30);

      const rightColX = 350;
      doc.font('Helvetica-Bold').text('Status:', rightColX, challanInfoY);
      doc.font('Helvetica').text(dispatch.status.toUpperCase(), rightColX + 60, challanInfoY);
      
      if (data.dispatchedBy) {
        doc.font('Helvetica-Bold').text('Prepared By:', rightColX, challanInfoY + 15);
        doc.font('Helvetica').text(data.dispatchedBy.name, rightColX + 80, challanInfoY + 15);
      }

      doc.y = challanInfoY + 60;
      doc.moveDown(0.5);

      doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
      doc.moveDown(0.5);

      doc.font('Helvetica-Bold').fontSize(11).text('CONSIGNEE DETAILS', 40, doc.y);
      doc.moveDown(0.5);

      const clientStartY = doc.y;
      doc.font('Helvetica-Bold').fontSize(10).text(client.companyName, 40, clientStartY);
      doc.font('Helvetica').fontSize(9);
      
      let yOffset = 15;
      doc.text(`Contact: ${client.contactPerson}`, 40, clientStartY + yOffset);
      yOffset += 12;
      
      const shippingAddress = order.shippingAddress || 
        `${client.shippingAddress}, ${client.shippingCity}, ${client.shippingState} ${client.shippingZipCode}, ${client.shippingCountry}`;
      
      doc.text(`Address: ${shippingAddress}`, 40, clientStartY + yOffset, { width: pageWidth });
      yOffset += 24;
      
      doc.text(`Phone: ${client.phone}`, 40, clientStartY + yOffset);
      doc.text(`Email: ${client.email}`, 250, clientStartY + yOffset);
      yOffset += 12;
      
      if (client.taxId) {
        doc.text(`GSTIN/Tax ID: ${client.taxId}`, 40, clientStartY + yOffset);
        yOffset += 12;
      }

      doc.y = clientStartY + yOffset + 10;
      doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
      doc.moveDown(0.5);

      doc.font('Helvetica-Bold').fontSize(11).text('TRANSPORT DETAILS', 40, doc.y);
      doc.moveDown(0.5);

      const transportY = doc.y;
      doc.font('Helvetica').fontSize(9);
      
      doc.font('Helvetica-Bold').text('Courier:', 40, transportY);
      doc.font('Helvetica').text(dispatch.courierName || 'N/A', 110, transportY);
      
      if (dispatch.trackingNumber) {
        doc.font('Helvetica-Bold').text('Tracking No:', 250, transportY);
        doc.font('Helvetica').text(dispatch.trackingNumber, 330, transportY);
      }
      
      if (dispatch.vehicleNumber) {
        doc.font('Helvetica-Bold').text('Vehicle No:', 40, transportY + 15);
        doc.font('Helvetica').text(dispatch.vehicleNumber, 110, transportY + 15);
      }
      
      if (dispatch.driverName) {
        doc.font('Helvetica-Bold').text('Driver:', 250, transportY + 15);
        doc.font('Helvetica').text(dispatch.driverName, 300, transportY + 15);
        
        if (dispatch.driverContact) {
          doc.text(` (${dispatch.driverContact})`, 300 + doc.widthOfString(dispatch.driverName), transportY + 15);
        }
      }

      doc.y = transportY + 40;
      doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
      doc.moveDown(0.5);

      doc.font('Helvetica-Bold').fontSize(11).text('ITEMS', 40, doc.y);
      doc.moveDown(0.5);

      const tableTop = doc.y;
      const colWidths = { sno: 35, sku: 80, item: 180, unit: 50, qty: 60, notes: 110 };
      const tableStartX = 40;
      
      doc.rect(tableStartX, tableTop, pageWidth, 20).fill('#f0f0f0');
      doc.fillColor('black');
      
      doc.font('Helvetica-Bold').fontSize(9);
      let colX = tableStartX + 5;
      doc.text('S.No', colX, tableTop + 5, { width: colWidths.sno });
      colX += colWidths.sno;
      doc.text('SKU', colX, tableTop + 5, { width: colWidths.sku });
      colX += colWidths.sku;
      doc.text('Item Description', colX, tableTop + 5, { width: colWidths.item });
      colX += colWidths.item;
      doc.text('Unit', colX, tableTop + 5, { width: colWidths.unit });
      colX += colWidths.unit;
      doc.text('Qty', colX, tableTop + 5, { width: colWidths.qty, align: 'right' });
      colX += colWidths.qty;
      doc.text('Notes', colX, tableTop + 5, { width: colWidths.notes });

      let rowY = tableTop + 25;
      doc.font('Helvetica').fontSize(9);
      
      dispatch.items.forEach((item, index) => {
        if (rowY > doc.page.height - 100) {
          doc.addPage();
          rowY = 50;
        }

        colX = tableStartX + 5;
        doc.text(String(index + 1), colX, rowY, { width: colWidths.sno });
        colX += colWidths.sno;
        doc.text(item.item?.sku || '-', colX, rowY, { width: colWidths.sku });
        colX += colWidths.sku;
        doc.text(item.item?.name || `Item #${item.itemId}`, colX, rowY, { width: colWidths.item });
        colX += colWidths.item;
        doc.text(item.item?.unit || '-', colX, rowY, { width: colWidths.unit });
        colX += colWidths.unit;
        doc.text(String(item.quantity), colX, rowY, { width: colWidths.qty, align: 'right' });
        colX += colWidths.qty;
        doc.text(item.notes || '-', colX, rowY, { width: colWidths.notes });
        
        rowY += 18;
      });

      const totalQty = dispatch.items.reduce((sum, item) => sum + item.quantity, 0);
      doc.moveTo(tableStartX, rowY).lineTo(tableStartX + pageWidth, rowY).stroke();
      rowY += 5;
      
      doc.font('Helvetica-Bold');
      colX = tableStartX + colWidths.sno + colWidths.sku + colWidths.item + 5;
      doc.text('Total:', colX, rowY, { width: colWidths.unit });
      colX += colWidths.unit;
      doc.text(String(totalQty), colX, rowY, { width: colWidths.qty, align: 'right' });

      if (dispatch.notes) {
        doc.y = rowY + 30;
        doc.font('Helvetica-Bold').fontSize(10).text('Remarks:', 40, doc.y);
        doc.font('Helvetica').fontSize(9).text(dispatch.notes, 40, doc.y + 12, { width: pageWidth });
      }

      const footerY = doc.page.height - 120;
      doc.moveTo(40, footerY).lineTo(doc.page.width - 40, footerY).stroke();
      
      doc.font('Helvetica').fontSize(8);
      doc.text('1. Goods once dispatched cannot be returned without prior approval.', 40, footerY + 10);
      doc.text('2. Please verify the contents upon receipt and report any discrepancies immediately.', 40, footerY + 20);
      doc.text('3. This is a computer-generated document.', 40, footerY + 30);

      doc.font('Helvetica-Bold').fontSize(9);
      doc.text('Received By:', 40, footerY + 55);
      doc.text('Authorized Signatory', 400, footerY + 55);
      
      doc.moveTo(40, footerY + 75).lineTo(150, footerY + 75).stroke();
      doc.moveTo(400, footerY + 75).lineTo(doc.page.width - 40, footerY + 75).stroke();
      
      doc.font('Helvetica').fontSize(8);
      doc.text('(Signature & Date)', 55, footerY + 78);
      doc.text('(Signature & Stamp)', 420, footerY + 78);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
