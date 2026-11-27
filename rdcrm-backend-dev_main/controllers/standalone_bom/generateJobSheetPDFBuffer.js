import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getImageBase64FromUrl } from "./getImageBase64FromUrl.js";

export const generateJobSheetPDFBuffer = async (formData) => {
  const {
    materialSpecification = [],
    materialprocess = [],
    packingdatas = [],
    job_quantity = "-",
    product_name = "-",
    sub_job_no = "-",
    orgimage,
    materialGroups = []
  } = formData || {};

  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  let startY = 34;

  // ---------------- HEADER ----------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`PRODUCTION JOB SHEET - ${sub_job_no}`, 14, 18);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Product Name: ${product_name}`, pageWidth - 14, 16, { align: "right" });
  doc.text(`Total Qty: ${job_quantity}`, pageWidth - 14, 22, { align: "right" });

  const now = new Date();
  doc.text(`Generated: ${now.toLocaleString("en-GB")}`, 14, 24);

  doc.setDrawColor(120, 90, 255);
  doc.setLineWidth(0.6);
  doc.line(14, 27, pageWidth - 14, 27);

  // ---------------- IMAGE ----------------
  if (orgimage) {
    try {
      const base64Image = await getImageBase64FromUrl(orgimage);
      const imgWidth = 15;
      const imgHeight = 15;
      doc.addImage(base64Image, "JPEG", pageWidth - imgWidth - 14, startY, imgWidth, imgHeight);
      startY += imgHeight + 8;
    } catch (err) {
      console.error("Image fetch error:", err);
    }
  }

  const sectionTitle = (title) => {
    doc.setFillColor(230, 235, 255);
    doc.rect(14, startY - 6, pageWidth - 28, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title, 16, startY);
    startY += 6;
  };

  // ---------------- MATERIAL ----------------
  sectionTitle("1. Material Requisition");
  autoTable(doc, {
    startY,
    head: [["Material", "Size", "Alias", "Color", "Qty"]],
    body: materialSpecification.map((m) => [
      m.material_name || "-",
      m.input?.size || "-",
      m.alias || "-",
      m.color || "-",
      m.final_total ? `${m.final_total} ${m.material_type === "sheet" ? "sheet" : "pcs"}` : "-"
    ]),
    theme: "grid",
    styles: { fontSize: 9 },
  });
  startY = doc.lastAutoTable.finalY + 10;

  // ---------------- PROCESS ----------------
  sectionTitle("2. Process Workflow");
  materialprocess.forEach((group) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`Section: ${group.material_group_name}`, 14, startY);
    startY += 4;

    autoTable(doc, {
      startY,
      head: [["#", "Process", "Input"]],
      body: group.processes.map((p) => [
        p.process_index,
        p.process_name || "-",
        p.input.actual_input || "-"
      ]),
      theme: "grid",
      styles: { fontSize: 9 },
    });

    startY = doc.lastAutoTable.finalY + 8;
  });

  // ---------------- PACKING ----------------
  sectionTitle("3. Packing Instructions");
  autoTable(doc, {
    startY,
    head: [["Item", "Spec / Qty"]],
    body: packingdatas.map((p) => [
      p.name || "-",
      p.itemType === "logic"
        ? `${p.logic1 || 1} x ${p.logic2 || 1} x ${p.logic3 || 1}`
        : p.qty || "-"
    ]),
    theme: "grid",
    styles: { fontSize: 9 },
  });
  startY = doc.lastAutoTable.finalY + 10;

  // ---------------- DEPARTMENT-WISE PROCESS ----------------
  sectionTitle("4. Department-wise Process Job Sheet");

  // Create material group map
  const materialGroupMap = {};
  materialGroups.forEach((group) => {
    materialGroupMap[group.group_name] = group.materials?.[0] || {};
  });

  // Build department map
  const departmentMap = {};
  materialprocess.forEach((group) => {
    group.processes?.forEach((proc) => {
      const dept = proc.department || "Other";
      if (!departmentMap[dept]) departmentMap[dept] = [];
      departmentMap[dept].push({
        ...proc,
        material_group_name: group.material_group_name,
        material_unit: group.material_unit,
      });
    });
  });

  // Add packing as Assembly
  packingdatas.forEach((pack) => {
    if (pack.name?.toLowerCase().includes("labour")) {
      if (!departmentMap["Assembly"]) departmentMap["Assembly"] = [];
      departmentMap["Assembly"].push({
        process_index: "",
        process_name: pack.name,
        department: "Assembly",
        row_type: "Inhouse",
        vendor: "-",
        unit_cost: Number(pack.total || 0),
        job_cost: Number(pack.finaltotal || 0),
        input: "-",
        material_group_name: "Packing",
        order_qty: job_quantity,
      });
    }
  });

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


  // Render department tables
  for (const [department, processes] of Object.entries(departmentMap)) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`Department: ${department}`, 14, startY);
    startY += 4;

    autoTable(doc, {
      startY,
      head: [
        [
          "S. No",
          "Process Name",
          "Alias",
          "Job Qty",
          "Type",
          "Vendor",
          "Material Type",
          "Size",
          "Qty",
          "UPS",
          "Input",
        ]
      ],
      body: processes.map((proc) => {
        const material = materialGroupMap[proc.material_group_name] || {};
        return [
          proc.process_index || "-",
          proc.process_name || "-",
          proc.material_group_name || "-",
          job_quantity || proc.order_qty || "-",
          proc.row_type || "-",
          proc.vendor || "-",
          material.material_name || "-",
          material.input?.size || "-",
          proc.current_total_material
      ? `${proc.current_total_material} ${proc.material_unit || ""}`
      : "-",
          material.input?.ups || "-",
        (() => {
  const unit = getUnitFromLabel(proc.prompt || "");
  return proc.input ? `${proc.input.actual_input} ${unit}`.trim() : "-";
})()

        ];
      }),
      theme: "grid",
      styles: { fontSize: 8 },
      headStyles: {
    fillColor: [230, 235, 255],
    textColor: [0, 0, 0],
    fontStyle: "bold",
  },
  didParseCell: function (data) {
    if (data.section === "body" && data.column.index === 2) {
      data.cell.styles.textColor = [37, 99, 235]; 
      data.cell.styles.fontStyle = "bold"; 
    }
  }
    });

    startY = doc.lastAutoTable.finalY + 8;
  }

  return Buffer.from(doc.output("arraybuffer"));
};
