import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getImageBase64FromUrl } from "./getImageBase64FromUrl.js";

export const generateCostSheetPDFBuffer = async (formData) => {
  const {
    materialSpecification = [],
    materialprocess = [],
    packingdatas = [],
    materialGroups = [],
    jobQty = 1,
    productName = "-",
    subJobNo = "-",
    reference_no = "",
    orgimage,
  } = formData || {};

  const toNumber = (val) => {
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  };

  const toFixedNumber = (num, decimals = 2) => {
    return Number(Number(num).toFixed(decimals));
  };

  const formatCurrency = (num) => `Rs. ${Number(num || 0).toFixed(2)}`;

  const getUnitFromLabel = (label = "") => {
    const mappings = [
      { keyword: "Enter Minutes per Sheet", unit: "min" },
      { keyword: "TOTAL Sq Inches", unit: "sq in" },
      { keyword: "Enter Cost per Sheet", unit: "pcs" },
      { keyword: "Enter Qty", unit: "pcs" },
    ];

    const found = mappings.find((m) => label.includes(m.keyword));
    return found ? found.unit : "";
  };

  // --- Pre-calculations ---
  const materialGroupMap = {};
  materialGroups.forEach((group) => {
    materialGroupMap[group.group_name] = group.materials?.[0] || {};
  });

  const grandTotals = {
    totalUnitCost: 0,
    totalJobCost: 0,
  };

  // 1. Raw Materials Calculation
  const calculatedMaterials = materialSpecification.map((item) => {
    let jobTotal;
    let unitRate;

    if (item.material_type === "sheet" && item.input?.size) {
      const [width, height] = (item.input.size || "0x0").split("x").map(toNumber);
      const sizeMultiplier = width * height;
      jobTotal = toFixedNumber(toNumber(item.rate) * sizeMultiplier * toNumber(item.final_total));
      unitRate = toFixedNumber(jobTotal / toNumber(jobQty || 1));
    } else {
      jobTotal = toFixedNumber(toNumber(item.rate) * toNumber(item.final_total));
      unitRate = jobTotal / toNumber(jobQty || 1);
    }

    grandTotals.totalUnitCost = toFixedNumber(grandTotals.totalUnitCost + unitRate);
    grandTotals.totalJobCost = toFixedNumber(grandTotals.totalJobCost + jobTotal);

    return { ...item, unitRate, jobTotal };
  });

  // 2. Processes Calculation
  const departmentMap = {};
  materialprocess.forEach((group) => {
    group.processes?.forEach((proc) => {
      const unitCost = toFixedNumber(toNumber(proc.unit_cost));
      const jobCost = toFixedNumber(toNumber(proc.job_cost));

      grandTotals.totalUnitCost = toFixedNumber(grandTotals.totalUnitCost + unitCost);
      grandTotals.totalJobCost = toFixedNumber(grandTotals.totalJobCost + jobCost);

      const dept = proc.department || "Other";
      if (!departmentMap[dept]) {
        departmentMap[dept] = [];
      }
      departmentMap[dept].push({
        ...proc,
        material_group_name: group.material_group_name,
        material_unit: group.material_unit,
        unit_cost: unitCost,
        job_cost: jobCost,
      });
    });
  });

  // 3. Packing Calculation
  packingdatas.forEach((pack) => {
    const unitCost = toFixedNumber(toNumber(pack.total));
    const jobCost = toFixedNumber(toNumber(pack.finaltotal));

    grandTotals.totalUnitCost = toFixedNumber(grandTotals.totalUnitCost + unitCost);
    grandTotals.totalJobCost = toFixedNumber(grandTotals.totalJobCost + jobCost);

    const isPackingLabour = pack.name?.toLowerCase().includes("labour");
    if (isPackingLabour) {
      if (!departmentMap["Assembly"]) {
        departmentMap["Assembly"] = [];
      }
      departmentMap["Assembly"].push({
        process_index: "",
        process_name: pack.name,
        department: "Assembly",
        row_type: "Inhouse",
        vendor: "-",
        unit_cost: unitCost,
        job_cost: jobCost,
        input: { actual_input: "-" },
        material_group_name: "Packing",
        order_qty: jobQty,
        material_unit: "",
        current_total_material: "-"
      });
    }
  });

  // --- PDF Generation ---
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  const jobLabel = reference_no ? `${subJobNo} - ${reference_no}` : subJobNo;
  doc.text(`PRODUCTION COST SHEET ${jobLabel ? `- ${jobLabel}` : ""}`, 14, 18);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Product Name: ${productName || "-"} `, pageWidth - 14, 16, { align: "right" });
  doc.text(`Total Qty: ${jobQty || "-"}`, pageWidth - 14, 22, { align: "right" });

  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  doc.text(`Generated: ${dateStr}`, 14, 24);

  doc.setDrawColor(120, 90, 255);
  doc.setLineWidth(0.6);
  doc.line(14, 27, pageWidth - 14, 27);

  let startY = 34;

  const sectionTitle = (title) => {
    doc.setFillColor(230, 235, 255);
    doc.rect(14, startY - 6, pageWidth - 28, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title, 16, startY);
    startY += 8;
  };

  // Image
  if (orgimage) {
    try {
      const base64Image = await getImageBase64FromUrl(orgimage);
      const imgWidth = 25;
      const imgHeight = 25;
      doc.addImage(base64Image, "JPEG", pageWidth - imgWidth - 14, startY, imgWidth, imgHeight);
      startY += imgHeight + 8;
    } catch (err) {
      console.error("Image loading error:", err);
    }
  }

  // 1. Raw Materials Table
  sectionTitle("1. Raw Materials");
  autoTable(doc, {
    startY,
    head: [["Item", "Size", "Req Qty", "Unit Cost", "Job Cost"]],
    body: calculatedMaterials.map((item) => [
      item.material_name || "-",
      item.input?.size || "-",
      `${item.final_total} ${item.material_type === "sheet" ? "Batch" : "Pcs"}`,
      formatCurrency(item.unitRate),
      formatCurrency(item.jobTotal),
    ]),
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: "bold" },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
    }
  });
  startY = doc.lastAutoTable.finalY + 10;

  // 2. Processes (Summary)
  sectionTitle("2. Processes Summary");
  autoTable(doc, {
    startY,
    head: [["#", "Process", "Vendor", "Input", "Unit Cost", "Job Cost"]],
    body: materialprocess.flatMap(group => group.processes.map(proc => [
      proc.process_index,
      `${proc.process_name} (${group.material_group_name})`,
      proc.vendor || "-",
      proc.input?.actual_input || "-",
      formatCurrency(proc.unit_cost),
      formatCurrency(proc.job_cost)
    ])),
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: "bold" },
    columnStyles: {
      4: { halign: 'right' },
      5: { halign: 'right' },
    }
  });
  startY = doc.lastAutoTable.finalY + 10;

  // 3. Packing (Summary)
  if (packingdatas.length > 0) {
    if (startY > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      startY = 20;
    }
    sectionTitle("3. Packing Summary");
    autoTable(doc, {
      startY,
      head: [["Item", "Unit Cost", "Job Cost"]],
      body: packingdatas.map((pack) => [
        pack.name || "-",
        formatCurrency(toNumber(pack.total)),
        formatCurrency(toNumber(pack.finaltotal)),
      ]),
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: "bold" },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
      }
    });
    startY = doc.lastAutoTable.finalY + 12;
  }

  // --- Grand Totals Section ---
  if (startY > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage();
    startY = 20;
  }

  doc.setFillColor(50, 50, 50);
  const boxWidth = pageWidth * 0.8;
  const boxX = (pageWidth - boxWidth) / 2;
  doc.rect(boxX, startY, boxWidth, 20, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text("Total Unit Cost", boxX + (boxWidth / 4), startY + 6, { align: "center" });
  doc.text("Total Job Cost", boxX + (boxWidth * 3 / 4), startY + 6, { align: "center" });

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(grandTotals.totalUnitCost), boxX + (boxWidth / 4), startY + 14, { align: "center" });
  doc.text(formatCurrency(grandTotals.totalJobCost), boxX + (boxWidth * 3 / 4), startY + 14, { align: "center" });

  doc.setTextColor(0, 0, 0);
  startY += 28;

  // 4. Department-wise Detailed Process Job Sheet
  Object.entries(departmentMap).forEach(([department, processes]) => {
    if (startY > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      startY = 20;
    }

    const deptTotalUnit = processes.reduce((acc, p) => acc + (toNumber(p.unit_cost) || 0), 0);
    const deptTotalJob = processes.reduce((acc, p) => acc + (toNumber(p.job_cost) || 0), 0);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(79, 70, 229);
    doc.text(`4. Department-wise Process Job Sheet - Department: ${department}`, 14, startY);
    doc.setTextColor(0, 0, 0);
    startY += 4;

    autoTable(doc, {
      startY,
      head: [["Sr. No", "Process Name", "Alias", "Job Qty", "In/Out", "Vendor", "Material Type", "Size", "Qty", "UPS", "Input", "Unit Rate", "Job Rate"]],
      body: processes.map((proc) => {
        const material = materialGroupMap[proc.material_group_name] || {};
        const inputUnit = getUnitFromLabel(proc.prompt || "");

        return [
          proc.process_index || "-",
          proc.process_name || "-",
          proc.material_group_name || "-",
          jobQty || proc.order_qty || "-",
          proc.row_type === "Inhouse" ? "In" : "Out",
          proc.vendor || "-",
          material.material_name || "-",
          material.input?.size || "-",
          `${proc.current_total_material || "-"} ${proc.material_unit || ""}`,
          material.input?.ups || "-",
          `${proc.input?.actual_input || "-"} ${inputUnit}`,
          formatCurrency(proc.unit_cost),
          formatCurrency(proc.job_cost),
        ];
      }).concat([
        [
          { content: 'Total', colSpan: 11, styles: { fontStyle: 'bold', halign: 'left' } },
          { content: formatCurrency(deptTotalUnit), styles: { fontStyle: 'bold', halign: 'right' } },
          { content: formatCurrency(deptTotalJob), styles: { fontStyle: 'bold', halign: 'right' } }
        ]
      ]),
      theme: "grid",
      styles: { fontSize: 7, cellPadding: 1, overflow: 'linebreak' },
      headStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 7 },
        1: { cellWidth: 25 },
        2: { cellWidth: 15 },
        3: { cellWidth: 10, halign: 'center' },
        4: { cellWidth: 10 },
        5: { cellWidth: 15 },
        6: { cellWidth: 20 },
        7: { cellWidth: 12 },
        8: { cellWidth: 12, halign: 'center' },
        9: { cellWidth: 8, halign: 'center' },
        10: { cellWidth: 10, halign: 'center' },
        11: { cellWidth: 18, halign: 'right' },
        12: { cellWidth: 18, halign: 'right' },
      },
      margin: { top: 10, bottom: 10, left: 10, right: 10 }
    });
    startY = doc.lastAutoTable.finalY + 12;
  });

  return Buffer.from(doc.output("arraybuffer"));
};
