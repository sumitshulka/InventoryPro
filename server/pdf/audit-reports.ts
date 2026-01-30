import PDFDocument from 'pdfkit';
import { AuditSession, AuditVerification, Warehouse, User } from '@shared/schema';

interface VerificationWithDetails {
  id: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  batchNumber: string | null;
  systemQuantity: number;
  physicalQuantity: number | null;
  discrepancy: number | null;
  status: string;
  confirmedBy: number | null;
  confirmerName: string | null;
  confirmedAt: string | null;
  notes: string | null;
}

interface OrganizationInfo {
  organizationName: string;
  logo?: string | null;
  currency: string;
  currencySymbol: string;
}

interface AuditReportData {
  session: AuditSession & { warehouseName: string };
  verifications: VerificationWithDetails[];
  organization: OrganizationInfo;
}

function drawTableHeader(doc: any, headers: string[], widths: number[], y: number) {
  const margin = 40;
  let x = margin;
  
  doc.font('Helvetica-Bold').fontSize(8);
  doc.rect(margin, y, doc.page.width - 80, 18).fill('#f0f0f0');
  doc.fillColor('#000000');
  
  headers.forEach((header, i) => {
    doc.text(header, x + 2, y + 5, { width: widths[i] - 4, align: 'left' });
    x += widths[i];
  });
  
  return y + 18;
}

function drawTableRow(doc: any, cells: string[], widths: number[], y: number, altRow: boolean = false) {
  const margin = 40;
  let x = margin;
  const rowHeight = 16;
  
  if (altRow) {
    doc.rect(margin, y, doc.page.width - 80, rowHeight).fill('#fafafa');
    doc.fillColor('#000000');
  }
  
  doc.font('Helvetica').fontSize(7);
  cells.forEach((cell, i) => {
    doc.text(cell || '-', x + 2, y + 4, { width: widths[i] - 4, align: 'left' });
    x += widths[i];
  });
  
  return y + rowHeight;
}

function checkNewPage(doc: any, currentY: number, requiredHeight: number = 50): number {
  if (currentY + requiredHeight > doc.page.height - 60) {
    doc.addPage();
    return 40;
  }
  return currentY;
}

export function generatePhysicalQuantityPDF(data: AuditReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 40,
        bufferPages: true,
        layout: 'landscape'
      });
      
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const { session, verifications, organization } = data;
      const pageWidth = doc.page.width - 80;

      doc.font('Helvetica-Bold').fontSize(16).text('PHYSICAL QUANTITY ENTRY REPORT', { align: 'center' });
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').fontSize(12).text(organization.organizationName, { align: 'center' });
      doc.moveDown(0.5);
      
      doc.font('Helvetica-Bold').fontSize(10).text(`Audit: ${session.auditCode} - ${session.title}`, { align: 'center' });
      doc.font('Helvetica').fontSize(9).text(`Warehouse: ${session.warehouseName}`, { align: 'center' });
      doc.font('Helvetica').fontSize(9).text(
        `Period: ${new Date(session.startDate).toLocaleDateString()} - ${new Date(session.endDate).toLocaleDateString()}`,
        { align: 'center' }
      );
      doc.moveDown(1);

      const headers = ['S.No', 'Item Code', 'Item Name', 'Batch', 'Physical Qty', 'Entered By', 'Entry Date', 'Notes'];
      const widths = [35, 70, 150, 80, 60, 100, 80, pageWidth - 575];
      
      let y = drawTableHeader(doc, headers, widths, doc.y);

      verifications.forEach((v, index) => {
        y = checkNewPage(doc, y, 20);
        if (y === 40) {
          y = drawTableHeader(doc, headers, widths, y);
        }
        
        const cells = [
          (index + 1).toString(),
          v.itemCode,
          v.itemName,
          v.batchNumber || '-',
          v.physicalQuantity !== null ? v.physicalQuantity.toString() : 'Not Entered',
          v.confirmerName || '-',
          v.confirmedAt ? new Date(v.confirmedAt).toLocaleDateString() : '-',
          v.notes || '-'
        ];
        y = drawTableRow(doc, cells, widths, y, index % 2 === 1);
      });

      doc.moveDown(2);
      y = checkNewPage(doc, doc.y, 50);
      doc.font('Helvetica').fontSize(8)
        .text(`Report Generated: ${new Date().toLocaleString()}`, 40, y);
      doc.text(`Total Items: ${verifications.length}`, 40, y + 12);
      doc.text(`Items with Physical Count: ${verifications.filter(v => v.physicalQuantity !== null).length}`, 40, y + 24);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export function generateVarianceReportPDF(data: AuditReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 40,
        bufferPages: true,
        layout: 'landscape'
      });
      
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const { session, verifications, organization } = data;
      const pageWidth = doc.page.width - 80;

      doc.font('Helvetica-Bold').fontSize(16).text('VARIANCE REPORT', { align: 'center' });
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').fontSize(12).text(organization.organizationName, { align: 'center' });
      doc.moveDown(0.5);
      
      doc.font('Helvetica-Bold').fontSize(10).text(`Audit: ${session.auditCode} - ${session.title}`, { align: 'center' });
      doc.font('Helvetica').fontSize(9).text(`Warehouse: ${session.warehouseName}`, { align: 'center' });
      doc.font('Helvetica').fontSize(9).text(
        `Period: ${new Date(session.startDate).toLocaleDateString()} - ${new Date(session.endDate).toLocaleDateString()}`,
        { align: 'center' }
      );
      doc.moveDown(1);

      const varianceItems = verifications.filter(v => v.discrepancy !== null && v.discrepancy !== 0);
      const shortItems = varianceItems.filter(v => v.discrepancy! < 0);
      const excessItems = varianceItems.filter(v => v.discrepancy! > 0);

      doc.font('Helvetica-Bold').fontSize(10).text('Summary:', 40);
      doc.font('Helvetica').fontSize(9)
        .text(`Total Variance Items: ${varianceItems.length}`, 50)
        .text(`Short Items: ${shortItems.length} (System > Physical)`, 50)
        .text(`Excess Items: ${excessItems.length} (Physical > System)`, 50);
      doc.moveDown(1);

      if (shortItems.length > 0) {
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#cc0000').text('SHORT ITEMS (Shortage)', 40);
        doc.fillColor('#000000');
        doc.moveDown(0.5);
        
        const headers = ['S.No', 'Item Code', 'Item Name', 'Batch', 'System Qty', 'Physical Qty', 'Shortage', 'Reason/Notes'];
        const widths = [35, 70, 130, 70, 60, 60, 60, pageWidth - 485];
        
        let y = drawTableHeader(doc, headers, widths, doc.y);

        shortItems.forEach((v, index) => {
          y = checkNewPage(doc, y, 20);
          if (y === 40) {
            doc.font('Helvetica-Bold').fontSize(11).fillColor('#cc0000').text('SHORT ITEMS (Continued)', 40, y);
            doc.fillColor('#000000');
            y = drawTableHeader(doc, headers, widths, y + 15);
          }
          
          const cells = [
            (index + 1).toString(),
            v.itemCode,
            v.itemName,
            v.batchNumber || '-',
            v.systemQuantity.toString(),
            (v.physicalQuantity ?? 0).toString(),
            Math.abs(v.discrepancy!).toString(),
            v.notes || 'No reason provided'
          ];
          y = drawTableRow(doc, cells, widths, y, index % 2 === 1);
        });
        doc.moveDown(1.5);
      }

      if (excessItems.length > 0) {
        let y = checkNewPage(doc, doc.y, 60);
        doc.y = y;
        
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#cc6600').text('EXCESS ITEMS (Surplus)', 40);
        doc.fillColor('#000000');
        doc.moveDown(0.5);
        
        const headers = ['S.No', 'Item Code', 'Item Name', 'Batch', 'System Qty', 'Physical Qty', 'Excess', 'Reason/Notes'];
        const widths = [35, 70, 130, 70, 60, 60, 60, pageWidth - 485];
        
        y = drawTableHeader(doc, headers, widths, doc.y);

        excessItems.forEach((v, index) => {
          y = checkNewPage(doc, y, 20);
          if (y === 40) {
            doc.font('Helvetica-Bold').fontSize(11).fillColor('#cc6600').text('EXCESS ITEMS (Continued)', 40, y);
            doc.fillColor('#000000');
            y = drawTableHeader(doc, headers, widths, y + 15);
          }
          
          const cells = [
            (index + 1).toString(),
            v.itemCode,
            v.itemName,
            v.batchNumber || '-',
            v.systemQuantity.toString(),
            (v.physicalQuantity ?? 0).toString(),
            v.discrepancy!.toString(),
            v.notes || 'No reason provided'
          ];
          y = drawTableRow(doc, cells, widths, y, index % 2 === 1);
        });
      }

      if (varianceItems.length === 0) {
        doc.font('Helvetica').fontSize(12).text('No variances found. All items matched system quantities.', { align: 'center' });
      }

      doc.moveDown(2);
      let y = checkNewPage(doc, doc.y, 50);
      doc.font('Helvetica').fontSize(8)
        .text(`Report Generated: ${new Date().toLocaleString()}`, 40, y);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export function generateFinalAuditReportPDF(data: AuditReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 40,
        bufferPages: true,
        layout: 'landscape'
      });
      
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const { session, verifications, organization } = data;
      const pageWidth = doc.page.width - 80;

      doc.font('Helvetica-Bold').fontSize(18).text('FINAL AUDIT REPORT', { align: 'center' });
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').fontSize(12).text(organization.organizationName, { align: 'center' });
      doc.moveDown(0.5);

      doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
      doc.moveDown(0.5);

      const leftCol = 40;
      const rightCol = doc.page.width / 2;
      let infoY = doc.y;

      doc.font('Helvetica-Bold').fontSize(10).text('Audit Code:', leftCol, infoY);
      doc.font('Helvetica').text(session.auditCode, leftCol + 80, infoY);
      
      doc.font('Helvetica-Bold').text('Status:', rightCol, infoY);
      doc.font('Helvetica').text(session.status.toUpperCase(), rightCol + 80, infoY);
      
      infoY += 15;
      doc.font('Helvetica-Bold').text('Title:', leftCol, infoY);
      doc.font('Helvetica').text(session.title, leftCol + 80, infoY);
      
      doc.font('Helvetica-Bold').text('Warehouse:', rightCol, infoY);
      doc.font('Helvetica').text(session.warehouseName, rightCol + 80, infoY);
      
      infoY += 15;
      doc.font('Helvetica-Bold').text('Start Date:', leftCol, infoY);
      doc.font('Helvetica').text(new Date(session.startDate).toLocaleDateString(), leftCol + 80, infoY);
      
      doc.font('Helvetica-Bold').text('End Date:', rightCol, infoY);
      doc.font('Helvetica').text(new Date(session.endDate).toLocaleDateString(), rightCol + 80, infoY);

      doc.y = infoY + 30;
      doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
      doc.moveDown(1);

      const totalItems = verifications.length;
      const matchedItems = verifications.filter(v => v.status === 'complete' || (v.discrepancy === 0 && v.physicalQuantity !== null)).length;
      const shortItems = verifications.filter(v => v.status === 'short' || (v.discrepancy !== null && v.discrepancy < 0)).length;
      const excessItems = verifications.filter(v => v.status === 'excess' || (v.discrepancy !== null && v.discrepancy > 0)).length;
      const pendingItems = verifications.filter(v => v.status === 'pending' || v.physicalQuantity === null).length;

      doc.font('Helvetica-Bold').fontSize(12).text('AUDIT SUMMARY', 40);
      doc.moveDown(0.5);

      const summaryY = doc.y;
      const boxWidth = (pageWidth - 30) / 5;
      const boxHeight = 50;

      const summaryData = [
        { label: 'Total Items', value: totalItems, color: '#3498db' },
        { label: 'Matched', value: matchedItems, color: '#27ae60' },
        { label: 'Short', value: shortItems, color: '#e74c3c' },
        { label: 'Excess', value: excessItems, color: '#f39c12' },
        { label: 'Pending', value: pendingItems, color: '#95a5a6' }
      ];

      summaryData.forEach((item, i) => {
        const x = 40 + (i * (boxWidth + 6));
        doc.rect(x, summaryY, boxWidth, boxHeight).fill(item.color);
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18).text(item.value.toString(), x, summaryY + 10, { width: boxWidth, align: 'center' });
        doc.fontSize(9).text(item.label, x, summaryY + 32, { width: boxWidth, align: 'center' });
        doc.fillColor('#000000');
      });

      doc.y = summaryY + boxHeight + 20;
      doc.moveDown(1);

      doc.font('Helvetica-Bold').fontSize(12).text('DETAILED VERIFICATION LIST', 40);
      doc.moveDown(0.5);

      const headers = ['S.No', 'Item Code', 'Item Name', 'Batch', 'System', 'Physical', 'Variance', 'Status', 'Verified By', 'Notes'];
      const widths = [30, 60, 120, 60, 50, 50, 50, 60, 90, pageWidth - 570];
      
      let y = drawTableHeader(doc, headers, widths, doc.y);

      verifications.forEach((v, index) => {
        y = checkNewPage(doc, y, 20);
        if (y === 40) {
          doc.font('Helvetica-Bold').fontSize(10).text('DETAILED VERIFICATION LIST (Continued)', 40, y);
          y = drawTableHeader(doc, headers, widths, y + 15);
        }
        
        let statusText = v.status.charAt(0).toUpperCase() + v.status.slice(1);
        let varianceText = '-';
        if (v.discrepancy !== null) {
          varianceText = v.discrepancy > 0 ? `+${v.discrepancy}` : v.discrepancy.toString();
        }
        
        const cells = [
          (index + 1).toString(),
          v.itemCode,
          v.itemName,
          v.batchNumber || '-',
          v.systemQuantity.toString(),
          v.physicalQuantity !== null ? v.physicalQuantity.toString() : '-',
          varianceText,
          statusText,
          v.confirmerName || '-',
          v.notes || '-'
        ];
        y = drawTableRow(doc, cells, widths, y, index % 2 === 1);
      });

      doc.addPage();
      doc.font('Helvetica-Bold').fontSize(12).text('SIGNATURES', 40, 40);
      doc.moveDown(3);

      const sigY = doc.y;
      const sigWidth = 200;
      
      doc.moveTo(40, sigY).lineTo(40 + sigWidth, sigY).stroke();
      doc.font('Helvetica').fontSize(9).text('Audit Manager', 40, sigY + 5);
      doc.text('Date: _____________', 40, sigY + 20);

      doc.moveTo(doc.page.width - 40 - sigWidth, sigY).lineTo(doc.page.width - 40, sigY).stroke();
      doc.text('Warehouse Manager', doc.page.width - 40 - sigWidth, sigY + 5);
      doc.text('Date: _____________', doc.page.width - 40 - sigWidth, sigY + 20);

      doc.moveDown(4);
      doc.font('Helvetica').fontSize(8).text(`Report Generated: ${new Date().toLocaleString()}`, 40);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
