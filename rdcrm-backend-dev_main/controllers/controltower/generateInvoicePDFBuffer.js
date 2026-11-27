import { jsPDF } from 'jspdf';
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Theme
const TEAL = [24, 90, 112];      // header / footer band
const TEAL_LIGHT = [214, 233, 240]; // total highlight
const GRAY_ROW = [242, 245, 246];   // zebra row
const GRAY_LINE = [210, 216, 219];
const TEXT_DARK = [30, 41, 51];
const TEXT_MUTED = [110, 120, 128];

export const generateInvoicePDFBuffer = async (invoice, job) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const rightX = pageW - marginX;

  // ---------- HEADER ----------
  const BRAND = [63, 63, 150];
  const MUTED = [120, 120, 120];

  let textStartX = marginX;
  let logoData = null;
  try {
    const logoPath = path.resolve(__dirname, "../../Img/logo.png");
    const logoBuffer = fs.readFileSync(logoPath);
    const logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;

    const imgProps = doc.getImageProperties(logoBase64);

    const maxWidth = 20;
    const scale = maxWidth / imgProps.width;

    const logoWidth = maxWidth;
    const logoHeight = imgProps.height * scale;

    const logoY = 12;
    // We will draw the image at the end to prevent SMask graphics state issues in jsPDF
    logoData = { base64: logoBase64, x: marginX, y: logoY, w: logoWidth, h: logoHeight };

    textStartX = marginX + logoWidth + 4;
  } catch (err) {
    console.error("Logo load error:", err);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.text("RD Custom Awards Pvt. Ltd.", textStartX, 17);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("410, Sagar Prabhat Indl Est, near Dahisar Toll Plaza,", textStartX, 23);
  doc.text("Naka, Dahisar East, Mumbai, Maharashtra 400068", textStartX, 28);

  // Right side
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("INVOICE", rightX, 24, { align: "right" });

  // Divider line
  doc.setDrawColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.setLineWidth(0.7);
  doc.line(marginX, 34, rightX, 34);

  // ---------- INVOICE META + BILL TO ----------
  let y = 46;
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);

  let labelY = y;
  
  const addMetaRow = (label, value) => {
    doc.setFontSize(9.5);
    doc.setFont("helvetica", 'bold');
    doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
    doc.text(label, marginX, labelY);
    
    doc.setFont("helvetica", 'normal');
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
    doc.text(value, marginX + 28, labelY);
    labelY += 6;
  };

  addMetaRow('Invoice No.', String(invoice.invoiceNo));
  addMetaRow('Date of Issue', invoice.date ? new Date(invoice.date).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB'));
  
  if (invoice.dueDate) {
    addMetaRow('Due Date', new Date(invoice.dueDate).toLocaleDateString('en-GB'));
  }
  
  addMetaRow('Job Ref', job.sub_job_no || '—');

  // Bill To, right aligned
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  doc.setFont("helvetica", 'bold');
  doc.text('Bill To', rightX, y, { align: 'right' });
  doc.setFont("helvetica", 'normal');
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);

  const billToLines = [
    job.client_name || 'Client Company Name',
    job.client_address || '',
    job.client_phone ? `Phone: ${job.client_phone}` : '',
  ].filter(Boolean);

  let by = y + 6;
  billToLines.forEach(line => {
    const wrapped = doc.splitTextToSize(line, 80);
    wrapped.forEach(wLine => {
      doc.text(wLine, rightX, by, { align: 'right' });
      by += 5;
    });
    by += 1;
  });

  // ---------- TABLE ----------
  const tableTop = Math.max(y + 30, by + 6);
  const cols = {
    item: marginX,
    desc: marginX + 14,
    hours: marginX + 110,
    rate: marginX + 138,
    amount: rightX,
  };

  doc.setFont("helvetica", 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  doc.text('Item', cols.item, tableTop);
  doc.text('Description', cols.desc, tableTop);
  doc.text('Qty', cols.hours, tableTop, { align: 'right' });
  doc.text('Rate', cols.rate, tableTop, { align: 'right' });
  doc.text('Amount', cols.amount, tableTop, { align: 'right' });

  doc.setDrawColor(GRAY_LINE[0], GRAY_LINE[1], GRAY_LINE[2]);
  doc.line(marginX, tableTop + 3, rightX, tableTop + 3);

  // Single line item row
  const rowH = 9;
  let rowY = tableTop + 3 + rowH;

  doc.setFillColor(GRAY_ROW[0], GRAY_ROW[1], GRAY_ROW[2]);
  doc.rect(marginX, tableTop + 3, rightX - marginX, rowH, 'F');

  doc.setFont("helvetica", 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  doc.text('1', cols.item, rowY - 2.5);
  doc.text(job.product_name || job.product || '-', cols.desc, rowY - 2.5);
  doc.text(String(invoice.qty ?? ''), cols.hours, rowY - 2.5, { align: 'right' });
  doc.text((invoice.pricePerQty ?? 0).toFixed(2), cols.rate, rowY - 2.5, { align: 'right' });
  doc.text((invoice.subtotal ?? 0).toFixed(2), cols.amount, rowY - 2.5, { align: 'right' });

  // Empty banded rows
  let blankY = tableTop + 3 + rowH;
  for (let i = 0; i < 4; i++) {
    if (i % 2 === 1) {
      doc.setFillColor(GRAY_ROW[0], GRAY_ROW[1], GRAY_ROW[2]);
      doc.rect(marginX, blankY, rightX - marginX, rowH, 'F');
    }
    blankY += rowH;
  }

  doc.setDrawColor(GRAY_LINE[0], GRAY_LINE[1], GRAY_LINE[2]);
  doc.line(marginX, blankY, rightX, blankY);

  // ---------- TERMS (left) + TOTALS (right) ----------
  const totalsLabelX = rightX - 55;
  let ty = blankY + 12;

  doc.setFont("helvetica", 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  doc.text('Terms', marginX, ty);
  doc.setFont("helvetica", 'normal');
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
  doc.setFontSize(8.5);
  if (invoice.remarks) {
    const wrapped = doc.splitTextToSize(invoice.remarks, 90);
    doc.text(wrapped, marginX, ty + 6);
  }

  const taxPct = Number(invoice.gstPct ?? 0);
  const totalsRows = [
    ['Subtotal', (invoice.subtotal ?? 0).toFixed(2)],
    ['Tax Rate', taxPct === 0 ? '0.00% (No GST)' : `${taxPct.toFixed(2)}%`],
    ['Tax', (invoice.gstAmt ?? 0).toFixed(2)],
  ];

  doc.setFontSize(9.5);
  totalsRows.forEach(([label, val], i) => {
    const rowYPos = ty + i * 7;
    doc.setFont("helvetica", 'bold');
    doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
    doc.text(label, totalsLabelX, rowYPos, { align: 'right' });
    doc.setFont("helvetica", 'normal');
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
    doc.text(val, rightX, rowYPos, { align: 'right' });
  });

  const totalY = ty + totalsRows.length * 7 + 3;
  doc.setDrawColor(GRAY_LINE[0], GRAY_LINE[1], GRAY_LINE[2]);
  doc.line(totalsLabelX - 25, totalY - 5, rightX, totalY - 5);

  doc.setFillColor(TEAL_LIGHT[0], TEAL_LIGHT[1], TEAL_LIGHT[2]);
  doc.rect(totalsLabelX - 25, totalY - 2, 25 + (rightX - totalsLabelX), 9, 'F');
  doc.setFont("helvetica", 'bold');
  doc.setFontSize(11);
  doc.setTextColor(TEAL[0], TEAL[1], TEAL[2]);
  doc.text('Total', totalsLabelX, totalY + 4.5, { align: 'right' });
  doc.text((invoice.totalAmt ?? 0).toFixed(2), rightX, totalY + 4.5, { align: 'right' });

  // ---------- FOOTER BAND ----------
  const footerH = 14;
  doc.setFillColor(TEAL[0], TEAL[1], TEAL[2]);
  doc.rect(0, pageH - footerH, pageW, footerH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", 'italic');
  doc.setFontSize(10);
  doc.text('Thank you for your business!', pageW / 2, pageH - footerH / 2 + 2, { align: 'center' });

  // Render the logo last to avoid SMask graphics state corrupting subsequent vector fills
  if (logoData) {
    doc.addImage(logoData.base64, "PNG", logoData.x, logoData.y, logoData.w, logoData.h);
  }

  // --- RETURN BUFFER ---
  return Buffer.from(doc.output('arraybuffer'));
};
