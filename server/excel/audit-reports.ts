import ExcelJS from 'exceljs';
import { AuditSession, AuditVerification } from '@shared/schema';

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
  currency: string;
  currencySymbol: string;
}

interface AuditReportData {
  session: AuditSession & { warehouseName: string };
  verifications: VerificationWithDetails[];
  organization: OrganizationInfo;
}

export async function generatePhysicalQuantityExcel(data: AuditReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Physical Quantity Entry');

  const { session, verifications, organization } = data;

  worksheet.mergeCells('A1:H1');
  worksheet.getCell('A1').value = 'PHYSICAL QUANTITY ENTRY REPORT';
  worksheet.getCell('A1').font = { bold: true, size: 16 };
  worksheet.getCell('A1').alignment = { horizontal: 'center' };

  worksheet.mergeCells('A2:H2');
  worksheet.getCell('A2').value = organization.organizationName;
  worksheet.getCell('A2').font = { bold: true, size: 12 };
  worksheet.getCell('A2').alignment = { horizontal: 'center' };

  worksheet.mergeCells('A3:H3');
  worksheet.getCell('A3').value = `Audit: ${session.auditCode} - ${session.title}`;
  worksheet.getCell('A3').alignment = { horizontal: 'center' };

  worksheet.mergeCells('A4:H4');
  worksheet.getCell('A4').value = `Warehouse: ${session.warehouseName} | Period: ${new Date(session.startDate).toLocaleDateString()} - ${new Date(session.endDate).toLocaleDateString()}`;
  worksheet.getCell('A4').alignment = { horizontal: 'center' };

  const headerRow = worksheet.addRow(['S.No', 'Item Code', 'Item Name', 'Batch Number', 'Physical Quantity', 'Entered By', 'Entry Date', 'Notes']);
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

  verifications.forEach((v, index) => {
    worksheet.addRow([
      index + 1,
      v.itemCode,
      v.itemName,
      v.batchNumber || '-',
      v.physicalQuantity !== null ? v.physicalQuantity : 'Not Entered',
      v.confirmerName || '-',
      v.confirmedAt ? new Date(v.confirmedAt).toLocaleDateString() : '-',
      v.notes || '-'
    ]);
  });

  worksheet.columns.forEach(column => {
    column.width = 15;
  });
  worksheet.getColumn(3).width = 30;
  worksheet.getColumn(8).width = 40;

  worksheet.addRow([]);
  worksheet.addRow([`Report Generated: ${new Date().toLocaleString()}`]);
  worksheet.addRow([`Total Items: ${verifications.length}`]);
  worksheet.addRow([`Items with Physical Count: ${verifications.filter(v => v.physicalQuantity !== null).length}`]);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function generateVarianceReportExcel(data: AuditReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Variance Report');

  const { session, verifications, organization } = data;
  const varianceItems = verifications.filter(v => v.discrepancy !== null && v.discrepancy !== 0);
  const shortItems = varianceItems.filter(v => v.discrepancy! < 0);
  const excessItems = varianceItems.filter(v => v.discrepancy! > 0);

  worksheet.mergeCells('A1:H1');
  worksheet.getCell('A1').value = 'VARIANCE REPORT';
  worksheet.getCell('A1').font = { bold: true, size: 16 };
  worksheet.getCell('A1').alignment = { horizontal: 'center' };

  worksheet.mergeCells('A2:H2');
  worksheet.getCell('A2').value = organization.organizationName;
  worksheet.getCell('A2').font = { bold: true, size: 12 };
  worksheet.getCell('A2').alignment = { horizontal: 'center' };

  worksheet.mergeCells('A3:H3');
  worksheet.getCell('A3').value = `Audit: ${session.auditCode} - ${session.title}`;
  worksheet.getCell('A3').alignment = { horizontal: 'center' };

  worksheet.mergeCells('A4:H4');
  worksheet.getCell('A4').value = `Warehouse: ${session.warehouseName}`;
  worksheet.getCell('A4').alignment = { horizontal: 'center' };

  worksheet.addRow([]);
  worksheet.addRow(['SUMMARY']);
  worksheet.addRow([`Total Variance Items: ${varianceItems.length}`]);
  worksheet.addRow([`Short Items: ${shortItems.length}`]);
  worksheet.addRow([`Excess Items: ${excessItems.length}`]);
  worksheet.addRow([]);

  if (shortItems.length > 0) {
    const shortHeader = worksheet.addRow(['SHORT ITEMS (Shortage)']);
    shortHeader.font = { bold: true, color: { argb: 'FFCC0000' } };
    
    const headerRow = worksheet.addRow(['S.No', 'Item Code', 'Item Name', 'Batch', 'System Qty', 'Physical Qty', 'Shortage', 'Reason/Notes']);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCCCC' } };

    shortItems.forEach((v, index) => {
      const row = worksheet.addRow([
        index + 1,
        v.itemCode,
        v.itemName,
        v.batchNumber || '-',
        v.systemQuantity,
        v.physicalQuantity ?? 0,
        Math.abs(v.discrepancy!),
        v.notes || 'No reason provided'
      ]);
      row.getCell(7).font = { color: { argb: 'FFCC0000' } };
    });
    worksheet.addRow([]);
  }

  if (excessItems.length > 0) {
    const excessHeader = worksheet.addRow(['EXCESS ITEMS (Surplus)']);
    excessHeader.font = { bold: true, color: { argb: 'FFCC6600' } };
    
    const headerRow = worksheet.addRow(['S.No', 'Item Code', 'Item Name', 'Batch', 'System Qty', 'Physical Qty', 'Excess', 'Reason/Notes']);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEECC' } };

    excessItems.forEach((v, index) => {
      const row = worksheet.addRow([
        index + 1,
        v.itemCode,
        v.itemName,
        v.batchNumber || '-',
        v.systemQuantity,
        v.physicalQuantity ?? 0,
        v.discrepancy!,
        v.notes || 'No reason provided'
      ]);
      row.getCell(7).font = { color: { argb: 'FFCC6600' } };
    });
  }

  worksheet.columns.forEach(column => {
    column.width = 15;
  });
  worksheet.getColumn(3).width = 30;
  worksheet.getColumn(8).width = 40;

  worksheet.addRow([]);
  worksheet.addRow([`Report Generated: ${new Date().toLocaleString()}`]);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function generateFinalAuditReportExcel(data: AuditReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  
  const summarySheet = workbook.addWorksheet('Summary');
  const detailSheet = workbook.addWorksheet('Detailed Verification');

  const { session, verifications, organization } = data;

  const totalItems = verifications.length;
  const matchedItems = verifications.filter(v => v.status === 'complete' || (v.discrepancy === 0 && v.physicalQuantity !== null)).length;
  const shortItems = verifications.filter(v => v.status === 'short' || (v.discrepancy !== null && v.discrepancy < 0)).length;
  const excessItems = verifications.filter(v => v.status === 'excess' || (v.discrepancy !== null && v.discrepancy > 0)).length;
  const pendingItems = verifications.filter(v => v.status === 'pending' || v.physicalQuantity === null).length;

  summarySheet.mergeCells('A1:D1');
  summarySheet.getCell('A1').value = 'FINAL AUDIT REPORT';
  summarySheet.getCell('A1').font = { bold: true, size: 18 };
  summarySheet.getCell('A1').alignment = { horizontal: 'center' };

  summarySheet.mergeCells('A2:D2');
  summarySheet.getCell('A2').value = organization.organizationName;
  summarySheet.getCell('A2').font = { bold: true, size: 14 };
  summarySheet.getCell('A2').alignment = { horizontal: 'center' };

  summarySheet.addRow([]);
  summarySheet.addRow(['AUDIT DETAILS']);
  summarySheet.addRow(['Audit Code', session.auditCode]);
  summarySheet.addRow(['Title', session.title]);
  summarySheet.addRow(['Warehouse', session.warehouseName]);
  summarySheet.addRow(['Status', session.status.toUpperCase()]);
  summarySheet.addRow(['Start Date', new Date(session.startDate).toLocaleDateString()]);
  summarySheet.addRow(['End Date', new Date(session.endDate).toLocaleDateString()]);

  summarySheet.addRow([]);
  summarySheet.addRow(['AUDIT SUMMARY']);
  
  const summaryHeader = summarySheet.addRow(['Category', 'Count']);
  summaryHeader.font = { bold: true };
  summaryHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

  summarySheet.addRow(['Total Items', totalItems]);
  summarySheet.addRow(['Matched Items', matchedItems]);
  summarySheet.addRow(['Short Items', shortItems]);
  summarySheet.addRow(['Excess Items', excessItems]);
  summarySheet.addRow(['Pending Items', pendingItems]);

  summarySheet.addRow([]);
  summarySheet.addRow([`Report Generated: ${new Date().toLocaleString()}`]);

  summarySheet.columns.forEach(column => {
    column.width = 20;
  });

  detailSheet.mergeCells('A1:J1');
  detailSheet.getCell('A1').value = 'DETAILED VERIFICATION LIST';
  detailSheet.getCell('A1').font = { bold: true, size: 14 };
  detailSheet.getCell('A1').alignment = { horizontal: 'center' };

  const headerRow = detailSheet.addRow(['S.No', 'Item Code', 'Item Name', 'Batch', 'System Qty', 'Physical Qty', 'Variance', 'Status', 'Verified By', 'Notes']);
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

  verifications.forEach((v, index) => {
    let varianceText = '-';
    if (v.discrepancy !== null) {
      varianceText = v.discrepancy > 0 ? `+${v.discrepancy}` : v.discrepancy.toString();
    }
    
    const row = detailSheet.addRow([
      index + 1,
      v.itemCode,
      v.itemName,
      v.batchNumber || '-',
      v.systemQuantity,
      v.physicalQuantity !== null ? v.physicalQuantity : '-',
      varianceText,
      v.status.charAt(0).toUpperCase() + v.status.slice(1),
      v.confirmerName || '-',
      v.notes || '-'
    ]);

    if (v.discrepancy !== null && v.discrepancy < 0) {
      row.getCell(7).font = { color: { argb: 'FFCC0000' } };
    } else if (v.discrepancy !== null && v.discrepancy > 0) {
      row.getCell(7).font = { color: { argb: 'FFCC6600' } };
    }
  });

  detailSheet.columns.forEach(column => {
    column.width = 15;
  });
  detailSheet.getColumn(3).width = 30;
  detailSheet.getColumn(10).width = 40;

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
