import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { formatDateID, formatIDR, formatNumber, formatPercent } from './formatters';

export interface ExportReportData {
  title: string;
  subtitle?: string;
  periodDescription: string;
  summaryKpis?: { label: string; value: string }[];
  headers: string[];
  rows: (string | number)[][];
  fileNamePrefix: string;
}

/**
 * Export data to PDF format with corporate styling
 */
export function exportToPDF(data: ExportReportData) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Header branding
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('AT - LIVE REPORTS', 14, 10);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text('Sistem Monitoring, Analytics & Performance Management Tim Live Streamer Shopee', 14, 17);

  const printTime = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
  doc.setFontSize(8);
  doc.text(`Waktu Cetak: ${printTime} WIB`, pageWidth - 14, 17, { align: 'right' });

  // Report Title & Period
  let currentY = 32;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(data.title.toUpperCase(), 14, currentY);

  currentY += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Periode: ${data.periodDescription}`, 14, currentY);

  currentY += 8;

  // Summary KPI block if present
  if (data.summaryKpis && data.summaryKpis.length > 0) {
    const kpiWidth = Math.min(50, (pageWidth - 28) / data.summaryKpis.length);
    data.summaryKpis.forEach((kpi, idx) => {
      const x = 14 + idx * (kpiWidth + 4);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, currentY, kpiWidth, 14, 2, 2, 'FD');

      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(kpi.label, x + 4, currentY + 5);

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(kpi.value, x + 4, currentY + 11);
    });

    currentY += 20;
  }

  // AutoTable data table
  autoTable(doc, {
    startY: currentY,
    head: [data.headers],
    body: data.rows,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (hookData) => {
      // Footer page numbering
      const str = `Halaman ${hookData.pageNumber}`;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(str, pageWidth - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
      doc.text('Dokumen Rahasia Internal Tim Live Streaming', 14, doc.internal.pageSize.getHeight() - 8);
    },
  });

  const cleanFileName = `${data.fileNamePrefix}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(cleanFileName);
}

/**
 * Export data to Excel (.xlsx) format
 */
export function exportToExcel(data: ExportReportData) {
  const wsData: any[][] = [];

  // Title header block
  wsData.push(['AT - LIVE REPORTS (SHOPEE LIVE PERFORMANCE SYSTEM)']);
  wsData.push([data.title]);
  wsData.push([`Periode: ${data.periodDescription}`]);
  wsData.push([`Waktu Unduh: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`]);
  wsData.push([]); // blank line

  // KPI summaries if present
  if (data.summaryKpis && data.summaryKpis.length > 0) {
    wsData.push(['RINGKASAN EKSEKUTIF:']);
    data.summaryKpis.forEach((kpi) => {
      wsData.push([kpi.label, kpi.value]);
    });
    wsData.push([]);
  }

  // Headers and table rows
  wsData.push(data.headers);
  data.rows.forEach((r) => wsData.push(r));

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  const colWidths = data.headers.map((h, i) => {
    let maxLen = h.length;
    data.rows.forEach((row) => {
      const val = row[i]?.toString() || '';
      if (val.length > maxLen) maxLen = val.length;
    });
    return { wch: Math.min(35, Math.max(12, maxLen + 3)) };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');

  const cleanFileName = `${data.fileNamePrefix}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, cleanFileName);
}

/**
 * Export data to CSV with UTF-8 BOM
 */
export function exportToCSV(data: ExportReportData) {
  const csvRows: string[] = [];

  // Escape field for CSV
  const escapeCsv = (val: string | number) => {
    const s = String(val ?? '').replace(/"/g, '""');
    return `"${s}"`;
  };

  csvRows.push(escapeCsv(data.title));
  csvRows.push(escapeCsv(`Periode: ${data.periodDescription}`));
  csvRows.push('');

  csvRows.push(data.headers.map(escapeCsv).join(','));

  data.rows.forEach((row) => {
    csvRows.push(row.map(escapeCsv).join(','));
  });

  const csvContent = '\uFEFF' + csvRows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${data.fileNamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
