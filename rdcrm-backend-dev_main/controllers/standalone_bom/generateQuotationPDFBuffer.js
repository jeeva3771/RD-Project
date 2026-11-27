import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getImageBase64FromUrl } from "./getImageBase64FromUrl.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


export const generateQuotationPDFBuffer = async (formData) => {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();

  const {
    product_name = "-",
    job_quantity = 0,
    totalUnitCost = 0,
    sub_job_no = "JOB-NEW",
    quotation = {},
    jobDescription = "-",
    orgimage = null,
  } = formData;

  console.log("orgimage",orgimage)
  const gstRate = Number(quotation?.gstRate || 18);

  /* ================= HEADER ================= */

// --- LOGO ---
// --- LOGO (original aspect ratio) ---
try {
  const logoPath = path.resolve(__dirname, "../../Img/logo.png");
  const logoBuffer = fs.readFileSync(logoPath);
  const logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;

  const imgProps = doc.getImageProperties(logoBase64);

  const maxWidth = 20; // control size here (mm)
  const scale = maxWidth / imgProps.width;

  const logoWidth = maxWidth;
  const logoHeight = imgProps.height * scale;

  const logoX = 14;
  const logoY = 12;

  doc.addImage(logoBase64, "PNG", logoX, logoY, logoWidth, logoHeight);

  // Text starts after logo
  var textStartX = logoX + logoWidth + 1;
} catch (err) {
  console.error("Logo load error:", err);
}


// --- COMPANY NAME ---
doc.setFont("helvetica", "bold");
doc.setFontSize(20);
doc.setTextColor(63, 63, 150);
doc.text("RD Custom Awards", textStartX, 20);

// --- TAGLINE ---
doc.setFont("helvetica", "normal");
doc.setFontSize(10);
doc.setTextColor(120, 120, 120);
doc.text("Excellence in Craftsmanship", textStartX, 24);


  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(120, 120, 120);
  doc.text("QUOTATION", pageWidth - 14, 20, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(63, 63, 150);
  doc.text(`#${sub_job_no}`, pageWidth - 14, 26, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(`${new Date().toLocaleDateString("en-GB")}`, pageWidth - 14, 32, { align: "right" });

  // Divider
  doc.setDrawColor(63, 63, 150);
  doc.setLineWidth(0.7);
  doc.line(14, 38, pageWidth - 14, 38);

  /* ================= PROJECT DESCRIPTION ================= */
let y = 48;

doc.setFont("helvetica", "bold");
doc.setFontSize(10);

// First part: "JOB "
doc.setTextColor(120, 120, 120);
doc.text("JOB ", 14, y);

// Measure width so next text starts right after
let xOffset = 14 + doc.getTextWidth("JOB ");

// Sub job number in BLUE
doc.setTextColor(63, 63, 150);
doc.text(String(sub_job_no).toUpperCase(), xOffset, y);

// Measure again
xOffset += doc.getTextWidth(String(sub_job_no).toUpperCase());

// Remaining text
doc.setTextColor(120, 120, 120);
doc.text(" CUSTOM DESIGNED AWARD", xOffset, y);


  y += 8;
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(product_name, 14, y);

  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(jobDescription, 14, y);

  /* ================= ADD IMAGE ================= */
  if (orgimage) {
    try {
      const base64Image = await getImageBase64FromUrl(orgimage);
      const imgWidth = 20;
      const imgHeight = 20;
      const xPos = pageWidth - imgWidth - 14;
      const yPos = 48 ;
      doc.addImage(base64Image, "JPEG", xPos, yPos, imgWidth, imgHeight);
    } catch (err) {
      console.error("Image fetch error:", err);
    }
  }

  /* ================= CALCULATIONS ================= */
  const subtotal = job_quantity * totalUnitCost;
  const gstAmount = (subtotal * gstRate) / 100;
  const grandTotal = subtotal + gstAmount;

  /* ================= TABLE ================= */
  autoTable(doc, {
    startY: y + 12,
    head: [["Description", "Qty", "Unit Price", "Total"]],
    body: [[jobDescription, job_quantity, `RS ${totalUnitCost.toFixed(2)}`, `RS ${subtotal.toFixed(2)}`]],
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 5, textColor: 0, font: "helvetica" },
    headStyles: { fillColor: [245, 246, 250], textColor: 0, fontStyle: "bold", halign: "center" },
    columnStyles: { 0: { halign: "left" }, 1: { halign: "center" }, 2: { halign: "right" }, 3: { halign: "right" } },
    didParseCell: (data) => {
      if (data.section === "body" && [0, 1, 2].includes(data.column.index)) {
        data.cell.styles.textColor = [120, 120, 120];
      }
    },
  });

  const tableEndY = doc.lastAutoTable.finalY + 10;
  const labelX = pageWidth - 70;
  const valueX = pageWidth - 14;

  /* ================= TOTALS ================= */
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text("Subtotal", labelX, tableEndY);
  doc.text(`RS ${subtotal.toFixed(2)}`, valueX, tableEndY, { align: "right" });

  doc.text(`GST (${gstRate}%)`, labelX, tableEndY + 8);
  doc.text(`RS ${gstAmount.toFixed(2)}`, valueX, tableEndY + 8, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(63, 63, 150);
  doc.text("Total", labelX, tableEndY + 18);
  doc.text(`RS ${grandTotal.toFixed(2)}`, valueX, tableEndY + 18, { align: "right" });

  /* ================= RETURN AS BUFFER ================= */
  return Buffer.from(doc.output("arraybuffer")); // Buffer ready for R2
};
