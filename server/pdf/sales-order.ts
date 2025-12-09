import PDFDocument from 'pdfkit';
import { SalesOrder, Client, Warehouse, User } from '@shared/schema';

interface OrderItem {
  id?: number;
  itemId: number;
  quantity: number;
  unitPrice: string;
  taxPercent: string;
  taxAmount: string;
  lineTotal: string;
  notes?: string | null;
  item?: {
    id: number;
    name: string;
    sku: string;
    unit: string;
  } | null;
}

interface ApprovalInfo {
  id: number;
  status: string;
  comments?: string | null;
  approvedAt?: Date | string | null;
  approver?: { id: number; name: string } | null;
}

interface OrganizationInfo {
  organizationName: string;
  logo?: string | null;
  currency: string;
  currencySymbol: string;
}

interface SalesOrderPDFData {
  order: SalesOrder;
  items: OrderItem[];
  client: Client;
  warehouse: Warehouse;
  organization: OrganizationInfo;
  creator?: { id: number; name: string } | null;
  approvals: ApprovalInfo[];
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
  JPY: "¥",
  CAD: "C$",
  AUD: "A$",
  CHF: "CHF",
  CNY: "¥",
  SGD: "S$",
  AED: "د.إ",
  SAR: "﷼",
};

function getCurrencySymbol(currencyCode: string | undefined | null): string {
  if (!currencyCode) return "$";
  return CURRENCY_SYMBOLS[currencyCode] || currencyCode + " ";
}

function formatAmount(amount: string | number, currencyCode?: string): string {
  const numAmount = typeof amount === "string" ? parseFloat(amount) || 0 : amount;
  
  if (currencyCode === "INR") {
    return numAmount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  
  return numAmount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getWatermarkText(status: string): string | null {
  const normalizedStatus = status.toLowerCase();
  if (normalizedStatus === 'draft') return 'DRAFT';
  if (normalizedStatus === 'waiting_approval') return 'PENDING APPROVAL';
  if (normalizedStatus === 'approved') return 'APPROVED';
  if (normalizedStatus === 'rejected') return 'REJECTED';
  return null;
}

export function generateSalesOrderPDF(data: SalesOrderPDFData): Promise<Buffer> {
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

      const { order, items, client, warehouse, organization, creator, approvals } = data;
      const pageWidth = doc.page.width - 80;
      const currencyCode = order.currencyCode || organization.currency;
      const currencySymbol = getCurrencySymbol(currencyCode);

      // Add company logo if available
      if (organization.logo) {
        try {
          // Handle base64 logo data
          let logoData = organization.logo;
          if (logoData.includes('base64,')) {
            logoData = logoData.split('base64,')[1];
          }
          const logoBuffer = Buffer.from(logoData, 'base64');
          
          // Center the logo at the top
          const logoWidth = 80;
          const logoX = (doc.page.width - logoWidth) / 2;
          doc.image(logoBuffer, logoX, 40, { width: logoWidth });
          doc.y = 130; // Move down after logo
        } catch (logoError) {
          console.error('Error rendering logo in PDF:', logoError);
          // Continue without logo
        }
      }

      doc.font('Helvetica-Bold').fontSize(20).text('SALES ORDER', { align: 'center' });
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

      const orderInfoY = doc.y;
      doc.font('Helvetica-Bold').fontSize(10).text('Order No:', 40, orderInfoY);
      doc.font('Helvetica').text(order.orderCode, 120, orderInfoY);
      
      doc.font('Helvetica-Bold').text('Order Date:', 40, orderInfoY + 15);
      doc.font('Helvetica').text(formatDate(order.orderDate), 120, orderInfoY + 15);
      
      if (order.clientPoReference) {
        doc.font('Helvetica-Bold').text('Client PO:', 40, orderInfoY + 30);
        doc.font('Helvetica').text(order.clientPoReference, 120, orderInfoY + 30);
      }

      const rightColX = 350;
      doc.font('Helvetica-Bold').text('Status:', rightColX, orderInfoY);
      doc.font('Helvetica').text(order.status.toUpperCase().replace('_', ' '), rightColX + 60, orderInfoY);
      
      doc.font('Helvetica-Bold').text('Currency:', rightColX, orderInfoY + 15);
      doc.font('Helvetica').text(currencyCode, rightColX + 60, orderInfoY + 15);

      doc.y = orderInfoY + 50;
      doc.moveDown(0.5);

      doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
      doc.moveDown(0.5);

      doc.font('Helvetica-Bold').fontSize(11).text('CLIENT DETAILS', 40, doc.y);
      doc.moveDown(0.5);

      const clientStartY = doc.y;
      doc.font('Helvetica-Bold').fontSize(10).text(client.companyName, 40, clientStartY);
      doc.font('Helvetica').fontSize(9);
      
      let yOffset = 15;
      if (client.contactPerson) {
        doc.text(`Contact: ${client.contactPerson}`, 40, clientStartY + yOffset);
        yOffset += 12;
      }
      
      const shippingAddress = [
        order.shippingAddress,
        order.shippingCity,
        order.shippingState,
        order.shippingZipCode,
        order.shippingCountry
      ].filter(Boolean).join(', ') || 
        [client.shippingAddress, client.shippingCity, client.shippingState, client.shippingZipCode, client.shippingCountry].filter(Boolean).join(', ');
      
      if (shippingAddress) {
        doc.text(`Shipping Address: ${shippingAddress}`, 40, clientStartY + yOffset, { width: pageWidth });
        yOffset += 24;
      }
      
      if (client.phone) {
        doc.text(`Phone: ${client.phone}`, 40, clientStartY + yOffset);
      }
      if (client.email) {
        doc.text(`Email: ${client.email}`, 250, clientStartY + yOffset);
      }
      yOffset += 12;
      
      if (client.taxId) {
        doc.text(`GSTIN/Tax ID: ${client.taxId}`, 40, clientStartY + yOffset);
        yOffset += 12;
      }

      doc.y = clientStartY + yOffset + 10;
      doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
      doc.moveDown(0.5);

      doc.font('Helvetica-Bold').fontSize(11).text('ORDER ITEMS', 40, doc.y);
      doc.moveDown(0.5);

      const tableTop = doc.y;
      const colWidths = { sno: 30, item: 150, sku: 70, qty: 50, unit: 50, rate: 70, tax: 50, total: 80 };
      const colX = {
        sno: 40,
        item: 70,
        sku: 220,
        qty: 290,
        unit: 340,
        rate: 390,
        tax: 460,
        total: doc.page.width - 40 - colWidths.total
      };

      doc.font('Helvetica-Bold').fontSize(8);
      doc.text('S.No', colX.sno, tableTop, { width: colWidths.sno });
      doc.text('Item Name', colX.item, tableTop, { width: colWidths.item });
      doc.text('SKU', colX.sku, tableTop, { width: colWidths.sku });
      doc.text('Qty', colX.qty, tableTop, { width: colWidths.qty, align: 'right' });
      doc.text('Unit', colX.unit, tableTop, { width: colWidths.unit });
      doc.text('Rate', colX.rate, tableTop, { width: colWidths.rate, align: 'right' });
      doc.text('Tax %', colX.tax, tableTop, { width: colWidths.tax, align: 'right' });
      doc.text('Total', colX.total, tableTop, { width: colWidths.total, align: 'right' });

      doc.moveTo(40, tableTop + 12).lineTo(doc.page.width - 40, tableTop + 12).stroke();

      let rowY = tableTop + 18;
      doc.font('Helvetica').fontSize(8);

      items.forEach((item, index) => {
        if (rowY > doc.page.height - 150) {
          doc.addPage();
          rowY = 50;
        }

        doc.text((index + 1).toString(), colX.sno, rowY, { width: colWidths.sno });
        doc.text(item.item?.name || `Item #${item.itemId}`, colX.item, rowY, { width: colWidths.item });
        doc.text(item.item?.sku || '-', colX.sku, rowY, { width: colWidths.sku });
        doc.text(item.quantity.toString(), colX.qty, rowY, { width: colWidths.qty, align: 'right' });
        doc.text(item.item?.unit || 'unit', colX.unit, rowY, { width: colWidths.unit });
        doc.text(currencySymbol + formatAmount(item.unitPrice, currencyCode), colX.rate, rowY, { width: colWidths.rate, align: 'right' });
        doc.text(parseFloat(item.taxPercent || '0').toFixed(1) + '%', colX.tax, rowY, { width: colWidths.tax, align: 'right' });
        doc.text(currencySymbol + formatAmount(item.lineTotal, currencyCode), colX.total, rowY, { width: colWidths.total, align: 'right' });

        rowY += 15;
      });

      doc.moveTo(40, rowY).lineTo(doc.page.width - 40, rowY).stroke();
      rowY += 10;

      const subtotal = parseFloat(order.subtotal || '0');
      const totalTax = parseFloat(order.totalTax || '0');
      const grandTotal = parseFloat(order.grandTotal || '0');

      const summaryX = doc.page.width - 40 - 180;
      doc.font('Helvetica').fontSize(9);
      doc.text('Subtotal:', summaryX, rowY);
      doc.text(currencySymbol + formatAmount(subtotal, currencyCode), summaryX + 80, rowY, { width: 100, align: 'right' });
      rowY += 15;
      
      doc.text('Tax:', summaryX, rowY);
      doc.text(currencySymbol + formatAmount(totalTax, currencyCode), summaryX + 80, rowY, { width: 100, align: 'right' });
      rowY += 15;
      
      doc.font('Helvetica-Bold').fontSize(10);
      doc.text('Grand Total:', summaryX, rowY);
      doc.text(currencySymbol + formatAmount(grandTotal, currencyCode), summaryX + 80, rowY, { width: 100, align: 'right' });
      rowY += 25;

      if (order.notes) {
        doc.font('Helvetica-Bold').fontSize(9).text('Notes:', 40, rowY);
        rowY += 12;
        doc.font('Helvetica').fontSize(8).text(order.notes, 40, rowY, { width: pageWidth });
        rowY += 30;
      }

      doc.moveTo(40, rowY).lineTo(doc.page.width - 40, rowY).stroke();
      rowY += 15;

      doc.font('Helvetica-Bold').fontSize(9).text('AUTHORIZATION', 40, rowY);
      rowY += 15;
      doc.font('Helvetica').fontSize(8);

      if (creator) {
        doc.text(`Initiated by: ${creator.name}`, 40, rowY);
        doc.text(`Date: ${formatDate(order.createdAt)}`, 250, rowY);
        rowY += 15;
      }

      const latestApproval = approvals.find(a => a.status === 'approved' || a.status === 'rejected');
      if (latestApproval && latestApproval.approver) {
        const approvalStatus = latestApproval.status === 'approved' ? 'Approved' : 'Rejected';
        doc.text(`${approvalStatus} by: ${latestApproval.approver.name}`, 40, rowY);
        doc.text(`Date: ${formatDate(latestApproval.approvedAt)}`, 250, rowY);
        rowY += 15;
        
        if (latestApproval.comments) {
          doc.text(`Remarks: ${latestApproval.comments}`, 40, rowY, { width: pageWidth });
          rowY += 15;
        }
      }

      rowY += 20;
      doc.moveTo(40, rowY).lineTo(doc.page.width - 40, rowY).stroke();
      rowY += 10;

      doc.font('Helvetica-Oblique').fontSize(7).fillColor('#666666');
      doc.text(
        'This is a computer generated document. Physical signature, if required, must be affixed separately.',
        40, rowY, { width: pageWidth, align: 'center' }
      );

      const watermarkText = getWatermarkText(order.status);
      if (watermarkText) {
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
          doc.switchToPage(i);
          
          doc.save();
          doc.fillColor('#cccccc').opacity(0.3);
          doc.font('Helvetica-Bold').fontSize(60);
          
          const textWidth = doc.widthOfString(watermarkText);
          const textHeight = doc.currentLineHeight();
          const centerX = (doc.page.width - textWidth) / 2;
          const centerY = (doc.page.height - textHeight) / 2;
          
          doc.translate(doc.page.width / 2, doc.page.height / 2);
          doc.rotate(-45, { origin: [0, 0] });
          doc.text(watermarkText, -textWidth / 2, -textHeight / 2, { lineBreak: false });
          
          doc.restore();
        }
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
