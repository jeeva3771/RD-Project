import { nanoid } from "nanoid";
import bomModel from "../../models/standalone_bom/standalonebomModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";
import { deleteFromR2, downloadFromR2, generateSignedUrl, uploadToR2 } from "../../helpers/r2helper.js";
import salesorderlistModel from "../../models/sales_orders/sales_order_list_Model.js";
import mime from "mime-types";
import { generateQuotationPDFBuffer } from "./generateQuotationPDFBuffer.js";
import { generateJobSheetPDFBuffer } from "./generateJobSheetPDFBuffer.js";
import customItemModel from "../../models/inventory/customItem/customItemModel.js";

// Helper to ensure custom items are unique per sub-job (clones custom items from other sub-jobs)
const ensureUniqueCustomItems = async (items, materialSpecification, jobNo, subJobNo, referenceNo, userId) => {
  if (!items || !Array.isArray(items)) return;

  for (const item of items) {
    if (item.is_inventory_item === false && item.master_id) {
      try {
        const originalCustomItem = await customItemModel.findById(item.master_id);
        // If this custom item was created for another sub_job_no, clone it for the current sub_job_no
        if (originalCustomItem && originalCustomItem.sub_job_no !== subJobNo) {
          console.log(`[UniqueCustomItems Standalone] Cloning custom item ${originalCustomItem.item_code} from ${originalCustomItem.sub_job_no} to ${subJobNo}`);

          const lastItem = await customItemModel
            .findOne({ item_code: { $regex: /^CUS\d+$/ } })
            .sort({ item_code: -1 })
            .collation({ locale: "en_US", numericOrdering: true });

          const nextNo = lastItem?.item_code
            ? parseInt(lastItem.item_code.replace("CUS", "")) + 1
            : 1;

          const newCustomItemData = {
            id: nanoid(16),
            item_code: `CUS${String(nextNo).padStart(3, "0")}`,
            name: originalCustomItem.name,
            type_id: originalCustomItem.type_id,
            category_id: originalCustomItem.category_id,
            item_type: originalCustomItem.item_type,
            rate_unit: originalCustomItem.rate_unit,
            price: originalCustomItem.price,
            length: originalCustomItem.length,
            width: originalCustomItem.width,
            height: originalCustomItem.height,
            thickness: originalCustomItem.thickness,
            dimension_unit: originalCustomItem.dimension_unit,
            stock: originalCustomItem.stock || 0,
            is_active: originalCustomItem.is_active,
            is_inventory_item: originalCustomItem.is_inventory_item,
            reference_vendor_name: originalCustomItem.reference_vendor_name,
            sheet_size: originalCustomItem.sheet_size,
            source_bom_type: originalCustomItem.source_bom_type,
            job_no: jobNo,
            sub_job_no: subJobNo,
            reference_no: referenceNo,
            supplier_ids: originalCustomItem.supplier_ids,
            created_by: userId || originalCustomItem.created_by,
            created_at: getCurrentDate(),
          };

          const clonedCustomItem = new customItemModel(newCustomItemData);
          const savedClonedItem = await clonedCustomItem.save();

          const oldItemId = item.item_id;
          const oldMasterId = item.master_id;

          // Update the custom item references in items array
          item.master_id = savedClonedItem._id.toString();
          item.item_id = savedClonedItem.id;

          // Update the custom item references in materialSpecification array
          if (materialSpecification && Array.isArray(materialSpecification)) {
            for (const mat of materialSpecification) {
              if (mat.item_id === oldItemId || String(mat.material_id) === String(oldMasterId)) {
                mat.item_id = savedClonedItem.id;
                mat.material_id = savedClonedItem._id;
              }
            }
          }
        }
      } catch (err) {
        console.error("Error cloning custom item in ensureUniqueCustomItems standalone helper:", err);
      }
    }
  }
};



export const getAllBOMs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page));
    const limit = req.query.limit
      ? Math.min(100, Math.max(1, parseInt(req.query.limit)))
      : 10;
    const skip = (page - 1) * limit;
    const countOnly = req.query.countOnly === "true";

    const search = req.query.search?.trim() || "";
    const is_active = req.query.is_active;
    const sortField = req.query.sortField?.trim();
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    const query = {};

    if (search) {
      query.$or = [
        { sub_job_no: { $regex: search, $options: "i" } },
        { product_name: { $regex: search, $options: "i" } },
      ]
    }

    const status = req.query.status;
    if (status === "draft") {
      query.is_bom_draft = true;
    } else {
      // Hide drafts by default (for "requestedquotaion" or if status is missing)
      query.is_bom_draft = { $ne: true };
    }

    if (is_active !== undefined && is_active !== "" && is_active !== null) {
      if (["true", true, "1", 1].includes(is_active)) {
        query.is_active = true;
      } else if (["false", false, "0", 0].includes(is_active)) {
        query.is_active = false;
      }
    }

    let sortOption = { created_at: -1 };

    if (sortField) {
      const isBooleanSort = sortField === "is_active";
      sortOption = {
        [sortField]: isBooleanSort ? (sortOrder === 1 ? -1 : 1) : sortOrder,
        created_at: -1,
      };
    } else if (req.query.order) {
      const order = req.query.order === "desc" ? -1 : 1;
      sortOption = { job_no: order };
    }

    const totalBOMs = await bomModel.countDocuments(query);
    
    if (countOnly) {
      console.log("...totalBOMs", totalBOMs)
      return res.status(200).json({
        success: true,
        totalBOMs,
      });
    }
    
    const boms = await bomModel
      .find(query)
      .collation({ locale: "en", strength: 2 })
      .sort(sortOption)
      // .populate({ path: "material.material_id", select: "name" })
      // .populate({ path: "combinations.material_id", select: "name" })
      // .populate({ path: "combinations.process.process_id", select: "name" })
      // .populate({ path: "packing.material_id", select: "name" })
      .populate({ path: "created_by", select: "name" })
      .populate({ path: "updated_by.user", select: "name" })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalBOMs / limit);


  const formattedBoms = boms.map(bom => ({
  ...bom.toObject(),
  org_image: bom.org_image
    ? generateSignedUrl(bom.org_image)
    : null
}));



    res.status(200).json({
      success: true,
      count: formattedBoms.length,
      total: totalBOMs,
      page,
      totalPages,
      data: formattedBoms,
    });
  } catch (error) {
    console.error("Error getting Standalone BOMs:", error);
    res.status(500).json({
      success: false,
      message: "Error getting Standalone BOMs",
      error: error.message,
    });
  }
};

  export const getBOMById = async (req, res) => {
    try {
      const { id } = req.params;
      const bom = await bomModel
        .findOne({ id })
        // .populate({ path: "enquiry_id", select: "enquiry_no" })
        // .populate({ path: "material.material_id", select: "name" })
        // .populate({ path: "combinations.material_id", select: "name" })
        // .populate({ path: "combinations.process.process_id", select: "name" })
        // .populate({ path: "packing.material_id", select: "name" })
        .populate({ path: "created_by", select: "name" })
        .populate({ path: "updated_by.user", select: "name" });

      if (!bom) {
        return res.status(404).json({
          success: false,
          message: "BOM not found",
        });
      }


        let signedPdfUrl = null;
      let signedCdrUrl = null;
      let org_image = null;

      if (bom.artwork_pdf) {
        signedPdfUrl = generateSignedUrl(bom.artwork_pdf);  
      }

      if (bom.artwork_cdr) {
        signedCdrUrl = generateSignedUrl(bom.artwork_cdr);  
      }

      
      if (bom.org_image) {
        org_image = generateSignedUrl(bom.org_image);  
      }


      res.status(200).json({
        success: true,
      data: {
          ...bom.toObject(),  
          artwork_pdf_url: signedPdfUrl,
          artwork_cdr_url: signedCdrUrl,
          org_image: org_image,
        },
      });
    } catch (error) {
      console.error("Error getting Standalone BOM:", error);
      res.status(500).json({
        success: false,
        message: "Error getting Standalone BOM",
        error: error.message,
      });
    }
  };


// CREATE BOM
  export const createBOM = async (req, res) => {
    try {
      // Extract basic fields
      const {
        enquiry_id,
        job_no,
        sub_job_no,
        sales_order_id,
        product_name,
        job_quantity,
        material_specification,
        material_groups,
        materialprocess,
        packingdatas,
        costdetails,
        jobSheet,
        quotation,
        items,
        jobDescription,
      } = req.body;

      let orgimage;
      console.log("req.body",req.body)

      console.log(req.files.artwork_pdf);

      if (!sub_job_no) {
        return res.status(400).json({
          success: false,
          message: "Enquiry ID, job number, and sub job number are required",
        });
      }

      const userId = req.user?._id;
      if (!userId)
        return res.status(401).json({ success: false, message: "Unauthorized" });

let artwork_pdf_url = "";
if (req.body.clone_artwork_pdf_key) {
  const artworkPdfKey = req.body.clone_artwork_pdf_key;
  console.log("Cloning artwork PDF from key:", artworkPdfKey);

  try {
    const pdfBuffer = await downloadFromR2(artworkPdfKey);
    console.log("Artwork PDF buffer received:", pdfBuffer?.byteLength || 0, "bytes");

    const pdfName = artworkPdfKey.split("/").pop();
    const pdfMimeType = mime.lookup(pdfName) || "application/pdf";

    artwork_pdf_url = await uploadToR2(
      `/quotation/${job_no}/pdf`,
      pdfBuffer,
      pdfName,
      pdfMimeType
    );

    console.log("Cloned artwork PDF URL:", artwork_pdf_url);

  } catch (err) {
    console.error("Error cloning artwork PDF from key:", artworkPdfKey, err);
  }
}

let artwork_cdr_url = "";
if (req.body.clone_artwork_cdr_key) {
  const artworkCdrKey = req.body.clone_artwork_cdr_key;
  console.log("Cloning artwork CDR from key:", artworkCdrKey);

  try {
    const cdrBuffer = await downloadFromR2(artworkCdrKey);
    console.log("Artwork CDR buffer received:", cdrBuffer?.byteLength || 0, "bytes");

    const cdrName = artworkCdrKey.split("/").pop();
    const cdrMimeType = mime.lookup(cdrName) || "application/octet-stream";

    artwork_cdr_url = await uploadToR2(
      `/quotation/${job_no}/cdr`,
      cdrBuffer,
      cdrName,
      cdrMimeType
    );

    console.log("Cloned artwork CDR URL:", artwork_cdr_url);

  } catch (err) {
    console.error("Error cloning artwork CDR from key:", artworkCdrKey, err);
  }
}

if (req.files?.artwork_pdf && req.files.artwork_pdf.length > 0) {
  const file = req.files.artwork_pdf[0];
  artwork_pdf_url = await uploadToR2(
    `/quotation/${job_no}/designs/pdf`,
    file.buffer,
    file.originalname,
    file.mimetype
  );
}

if (req.files?.artwork_cdr && req.files.artwork_cdr.length > 0) {
  const file = req.files.artwork_cdr[0];
  artwork_cdr_url = await uploadToR2(
    `/${job_no}/cdr`,
    file.buffer,
    file.originalname,
    file.mimetype
  );
}

      console.log("orgimage",orgimage)




console.log("req.files?.image", req.files?.image);

if (req.files?.image && req.files.image.length > 0) {
  const file = req.files.image[0]; 

  console.log("Uploaded file:", file);

  const fileBuffer = file.buffer;
  const originalName = file.originalname;
  const mimeType =
    file.mimetype || mime.lookup(originalName) || "application/octet-stream";

  const uploadResult = await uploadToR2(
    `/${sub_job_no}/image`,
    fileBuffer,
    originalName,
    mimeType
  );

  orgimage = uploadResult;

  console.log("orgimageorgimage",orgimage)
} 
else if (req.body.orgimage) {
  orgimage = req.body.orgimage;
}

console.log("Final image:", orgimage);




  


      // Parse JSON fields from FormData
      const parsedMaterial = material_specification ? JSON.parse(material_specification) : [];
      const parsedGroups = material_groups ? JSON.parse(material_groups) : [];
      const parsedProcesses = materialprocess ? deepParseJSON(materialprocess) : [];
      const parsedPacking = packingdatas ? JSON.parse(packingdatas) : [];
      const parsedCostDetails = costdetails ? JSON.parse(costdetails) : {};
      const parsedJobSheet = jobSheet ? JSON.parse(jobSheet) : {};
      const parsedQuotation = quotation ? JSON.parse(quotation) : {};
      const parsedItems = items ? JSON.parse(items) : [];

      await ensureUniqueCustomItems(parsedItems, parsedMaterial, job_no, sub_job_no, req.body.reference_no || "", userId);
      
      let job_sheet_pdf_url = "";

      console.log("orgimage2",orgimage)

if (parsedJobSheet && sales_order_id) {
  const pdfBuffer = await generateJobSheetPDFBuffer({
      job_quantity: job_quantity,
      product_name: product_name, 
      sub_job_no: sub_job_no,
      materialSpecification: parsedMaterial,
      materialprocess: parsedProcesses,
     packingdatas: parsedPacking,
  orgimage: orgimage ? generateSignedUrl(orgimage) : null,
      materialGroups : parsedGroups,


  });

  job_sheet_pdf_url = await uploadToR2(
     `/quotation/${job_no}/jobsheet`,
    pdfBuffer,
    `job-sheet-${sub_job_no}.pdf`,
    "application/pdf"
  );
}



// Generate quotation PDF
let quotation_pdf_url = "";
try {
  const pdfBuffer = await generateQuotationPDFBuffer({
  product_name: product_name,
  job_quantity: job_quantity,
  totalUnitCost: parsedQuotation?.finalUnitPrice || 0,
  sub_job_no: sub_job_no,
  quotation: parsedQuotation,
  jobDescription,
  orgimage: orgimage ? generateSignedUrl(orgimage) : null,
});


  quotation_pdf_url = await uploadToR2(
    `/quotation/${job_no}/quotationpdf`,
    pdfBuffer,
    `quotation-${sub_job_no}.pdf`,
    "application/pdf"
  );
} catch (err) {
  console.error("Error generating quotation PDF:", err);
}

console.log("quotation_pdf_url",quotation_pdf_url)


      console.log("org_image",orgimage)


     const newBOM = new bomModel({
      id: nanoid(16),
      enquiry_id,
      job_no,
      sub_job_no,
      jobDescription,
      sales_order_nanoid: sales_order_id,
      org_image: orgimage, 
      product_name,
      job_quantity,
      items: parsedItems,   
      material_specification: parsedMaterial,
      material_groups: parsedGroups,
      materialprocess: parsedProcesses,
      packingdatas: parsedPacking,
      costdetails: parsedCostDetails,
      jobSheet: parsedJobSheet,
      quotation: parsedQuotation,
      artwork_pdf: artwork_pdf_url,
      artwork_cdr: artwork_cdr_url,
      is_active: true,
      is_bom_draft: false,
      created_by: userId,
      created_at: getCurrentDate(),
      updated_by: [],
      updated_at: null,
      jobsheetfiles: job_sheet_pdf_url,
      quoatationfiles: quotation_pdf_url,
    });


      const savedBOM = await newBOM.save();

    // Link custom items back to this BOM
    const customItemUpdates = parsedItems
      .filter((item) => item.is_inventory_item === false && item.master_id)
      .map((item) => item.master_id);

    if (customItemUpdates.length > 0) {
      await customItemModel.updateMany(
        { _id: { $in: customItemUpdates } },
        { $set: { source_bom_id: savedBOM._id } }
      );
    }


      res.status(201).json({
        success: true,
        message: "Standalone BOM created successfully",
        data: savedBOM,
      });
    } catch (error) {
      console.error("Error creating BOM:", error);
      res.status(500).json({ success: false, message: "Error creating Standalone BOM", error: error.message });
    }
  };


// UPDATE BOM

// ORPHAN REMOVED 2

// UPDATE BOM
export const updateBOM = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const bom = await bomModel.findOne({ id });
    if (!bom) {
      return res.status(404).json({ success: false, message: "BOM not found" });
    }

    const {
      material_specification,
      material_groups,
      materialprocess,
      packingdatas,
      costdetails,
      jobSheet,
      quotation,
      items,
      jobDescription,
      product_name,
      job_quantity,
      orgimage,
      sales_order_id
    } = req.body;


    delete req.body.clone_artwork_pdf_key;
    delete req.body.clone_artwork_cdr_key;

    const parsedMaterialProcess = materialprocess ? deepParseJSON(materialprocess) : materialprocess;

    const parsedItems = items ? JSON.parse(items) : null;
    const parsedMaterial = material_specification ? JSON.parse(material_specification) : null;

    if (parsedItems) {
      await ensureUniqueCustomItems(parsedItems, parsedMaterial || bom.material_specification, bom.job_no, bom.sub_job_no, req.body.reference_no || "", userId);
    }

    /* -------------------- PARSE JSON FIELDS -------------------- */
    const updateData = {
      ...(parsedMaterial && { material_specification: parsedMaterial }),
      ...(material_groups && { material_groups: JSON.parse(material_groups) }),
      ...(materialprocess && { materialprocess: parsedMaterialProcess }),
      ...(packingdatas && { packingdatas: JSON.parse(packingdatas) }),
      ...(costdetails && { costdetails: JSON.parse(costdetails) }),
      ...(jobSheet && { jobSheet: JSON.parse(jobSheet) }),
      ...(quotation && { quotation: JSON.parse(quotation) }),
      ...(parsedItems && { items: parsedItems }),
      ...(jobDescription && { jobDescription }),
      ...(product_name && { product_name }),
      ...(job_quantity && { job_quantity }),
      ...(orgimage && { org_image: orgimage }),
      is_bom_draft: false,
    };

    /* -------------------- CLONE ARTWORK FILES -------------------- */
    let artwork_pdf_url = bom.artwork_pdf;
    let artwork_cdr_url = bom.artwork_cdr;

    /* -------------------- UPLOAD NEW FILES -------------------- */
    if (req.files?.artwork_pdf?.length > 0) {
      if (artwork_pdf_url) await deleteFromR2(artwork_pdf_url);
      const file = req.files.artwork_pdf[0];
      artwork_pdf_url = await uploadToR2(
        `/quotation/${bom.job_no}/designs/pdf`,
        file.buffer,
        file.originalname,
        file.mimetype
      );
    }

    if (req.files?.artwork_cdr?.length > 0) {
      if (artwork_cdr_url) await deleteFromR2(artwork_cdr_url);
      const file = req.files.artwork_cdr[0];
      artwork_cdr_url = await uploadToR2(
        `/quotation/${bom.job_no}/designs/cdr`,
        file.buffer,
        file.originalname,
        file.mimetype
      );
    }

    updateData.artwork_pdf = artwork_pdf_url;
    updateData.artwork_cdr = artwork_cdr_url;

    /* -------------------- REGENERATE QUOTATION PDF WITH VERSIONING -------------------- */
    let quotation_pdf_url = null;

    if (quotation && sales_order_id) {
      try {
        const parsedQuotation = JSON.parse(quotation);

        const pdfBuffer = await generateQuotationPDFBuffer({
          product_name: product_name || bom.product_name,
          job_quantity: job_quantity || bom.job_quantity,
          totalUnitCost: parsedQuotation?.finalUnitPrice || 0,
          sub_job_no: bom.sub_job_no,
          quotation: parsedQuotation,
          jobDescription: jobDescription || bom.jobDescription,
          orgimage: orgimage
            ? generateSignedUrl(orgimage)
            : bom.org_image
            ? generateSignedUrl(bom.org_image)
            : null,
        });

        const salesOrder = await salesorderlistModel.findOne({ id: sales_order_id });
        const existingFiles = salesOrder?.quatation_files || [];

        let version = 1;
        existingFiles.forEach((file) => {
          const match = file.match(/quotation-.*-v(\d+)\.pdf$/);
          if (match && match[1]) {
            const num = parseInt(match[1], 10);
            if (num >= version) version = num + 1;
          }
        });

        const filename = `quotation-${bom.sub_job_no}-v${version}.pdf`;

        quotation_pdf_url = await uploadToR2(
          `/quotation/${bom.job_no}/quotationpdf`,
          pdfBuffer,
          filename,
          "application/pdf"
        );

        // quotation_pdf_url is uploaded, but we push it to the array on update instead of overwriting it
      } catch (err) {
        console.error("Quotation PDF update failed:", err);
      }
    }

    /* -------------------- REGENERATE JOB SHEET PDF -------------------- */
let job_sheet_pdf_url = null;

if (jobSheet && sales_order_id) {
  try {
    const parsedJobSheet = JSON.parse(jobSheet);
      const parsedGroups = material_groups ? JSON.parse(material_groups) : [];

    const pdfBuffer = await generateJobSheetPDFBuffer({
      ...parsedJobSheet,
      materialGroups : parsedGroups,
      job_quantity: job_quantity || bom.job_quantity,
      product_name: product_name || bom.product_name,
      sub_job_no: bom.sub_job_no,
  orgimage: orgimage
            ? generateSignedUrl(orgimage)
            : bom.org_image
            ? generateSignedUrl(bom.org_image)
            : null,
    });

    const salesOrder = await salesorderlistModel.findOne({ id: sales_order_id });
    const existingFiles = salesOrder?.job_sheet_files || [];

    let version = 1;
    existingFiles.forEach((file) => {
      const match = file.match(/job-sheet-.*-v(\d+)\.pdf$/);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num >= version) version = num + 1;
      }
    });

    const filename = `job-sheet-${bom.sub_job_no}-v${version}.pdf`;

    job_sheet_pdf_url = await uploadToR2(
      `/quotation/${bom.job_no}/jobsheet`,
      pdfBuffer,
      filename,
      "application/pdf"
    );

    updateData.jobSheet_pdf = job_sheet_pdf_url;

  } catch (err) {
    console.error("Job Sheet PDF update failed:", err);
  }
}


    const bomUpdateQuery = {
      $set: {
        ...updateData,
        updated_at: getCurrentDate(),
      },
      $push: {
        updated_by: {
          user: userId,
          date: getCurrentDate(),
        },
      },
    };

    if (quotation_pdf_url) {
      bomUpdateQuery.$push.quotation_pdf = quotation_pdf_url;
    }

    await bomModel.updateOne({ id }, bomUpdateQuery);

    /* -------------------- UPDATE SALES ORDER FLAGS -------------------- */
  if (sales_order_id) {
     const updateObj = { $set: { is_bom_filled: true, is_bom_rework: true, updated_at: getCurrentDate(), }, 
     $push: { updated_by: { user: userId, date: getCurrentDate(), }, }, };
     
   
       if (quotation_pdf_url) updateObj.$push.quatation_files = quotation_pdf_url;
      if (job_sheet_pdf_url) updateObj.$push.job_sheet_files = job_sheet_pdf_url;
     
     await salesorderlistModel.findOneAndUpdate( { id: sales_order_id }, updateObj, { new: true } ); }
    const updatedBOM = await bomModel.findOne({ id });

    res.status(200).json({
      success: true,
      message: "BOM updated successfully",
      data: updatedBOM,
    });
  } catch (error) {
    console.error("Error updating BOM:", error);
    res.status(500).json({
      success: false,
      message: "Error updating BOM",
      error: error.message,
    });
  }
};


export const deleteBOM = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedBOM = await bomModel.findOneAndDelete({ id });

    if (!deletedBOM) {
      return res.status(404).json({
        success: false,
        message: "BOM not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "BOM deleted successfully",
      data: deletedBOM,
    });
  } catch (error) {
    console.error("Error deleting BOM:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting BOM",
      error: error.message,
    });
  }
};


// export const downloadQuotationPDF = async (req, res) => {
//   try {
//     const { mode } = req.query; 
//     const {
//       product_name,
//       job_quantity,
//       sub_job_no,
//       quotation,
//       jobDescription,
//       orgimage,
//     } = req.body;

//     const pdfBuffer = await generateQuotationPDFBuffer({
//       product_name,
//       job_quantity,
//       totalUnitCost: quotation?.finalUnitPrice || 0,
//       sub_job_no,
//       quotation,
//       jobDescription,
//       orgimage: orgimage ? generateSignedUrl(orgimage) : null,
//     });

//     res.setHeader("Content-Type", "application/pdf");

//     if (mode === "print") {
//       res.setHeader(
//         "Content-Disposition",
//         `inline; filename="quotation-${sub_job_no}.pdf"`
//       );
//     } else {
//       res.setHeader(
//         "Content-Disposition",
//         `attachment; filename="quotation-${sub_job_no}.pdf"`
//       );
//     }

//     res.send(pdfBuffer);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ success: false, message: "Failed to generate PDF" });
//   }
// };


export const downloadQuotationPDF = async (req, res) => {
  try {
    const { mode } = req.query;

    // Destructure form fields from req.body
    const {
      product_name,
      job_quantity,
      sub_job_no,
      jobDescription,
      "quotation[margin]": margin,
      "quotation[marginType]": marginType,
      "quotation[finalUnitPrice]": finalUnitPrice,
      "quotation[finalJobPrice]": finalJobPrice,
      "quotation[gstRate]": gstRate,
      orgimage: orgimageUrl,
    } = req.body;

    // Rebuild quotation object
    const quotation = {
      margin: parseFloat(margin) || 0,
      marginType,
      finalUnitPrice: parseFloat(finalUnitPrice) || 0,
      finalJobPrice: parseFloat(finalJobPrice) || 0,
      gstRate,
    };

    // Determine which image to use
    let orgimage = null;

    if (req.file) {
      // Use uploaded file
      orgimage = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    } else if (orgimageUrl) {
      // Use existing image URL
      orgimage = orgimageUrl; // your getImageBase64FromUrl will handle it
    }

    // Generate PDF buffer
    const pdfBuffer = await generateQuotationPDFBuffer({
      product_name,
      job_quantity,
      totalUnitCost: quotation.finalUnitPrice,
      sub_job_no,
      quotation,
      jobDescription,
      orgimage,
    });

    // Set headers for PDF download/print
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      mode === "print"
        ? `inline; filename="quotation-${sub_job_no}.pdf"`
        : `attachment; filename="quotation-${sub_job_no}.pdf"`
    );

    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to generate PDF" });
  }
};


// export const downloadJobSheetPDF = async (req, res) => {
//   try {
//     const { mode } = req.query;

//     const {
//       materialSpecification,
//       materialprocess,
//       packingdatas,
//       job_quantity,
//       product_name,
//       sub_job_no,
//       orgimage,
//       materialGroups
//     } = req.body;

//     console.log("req.body",req.body)

//     const pdfBuffer = await generateJobSheetPDFBuffer({
//       materialSpecification,
//       materialprocess,
//       packingdatas,
//       job_quantity,
//       product_name,
//       sub_job_no,
//       orgimage: orgimage ? generateSignedUrl(orgimage) : null,
//       materialGroups
//     });

//     res.setHeader("Content-Type", "application/pdf");

//     if (mode === "print") {
//       res.setHeader(
//         "Content-Disposition",
//         `inline; filename="job-sheet-${sub_job_no}.pdf"`
//       );
//     } else {
//       res.setHeader(
//         "Content-Disposition",
//         `attachment; filename="job-sheet-${sub_job_no}.pdf"`
//       );
//     }

//     res.send(pdfBuffer);
//   } catch (err) {
//     console.error("Job Sheet PDF error:", err);
//     res.status(500).json({
//       success: false,
//       message: "Failed to generate Job Sheet PDF",
//     });
//   }
// };

export const downloadJobSheetPDF = async (req, res) => {
  try {
    const { mode } = req.query;

    const {
      materialSpecification,
      materialprocess,
      packingdatas,
      job_quantity,
      product_name,
      sub_job_no,
      orgimage: orgimageUrl,
      materialGroups,
    } = req.body || {};

    let orgimage = null;

    if (req.file) {
      orgimage = `data:${req.file.mimetype};base64,${req.file.buffer.toString(
        "base64"
      )}`;
    } else if (orgimageUrl) {
      orgimage = orgimageUrl;
    }

    const pdfBuffer = await generateJobSheetPDFBuffer({
      materialSpecification: materialSpecification
        ? JSON.parse(materialSpecification)
        : [],
      materialprocess: materialprocess
        ? JSON.parse(materialprocess)
        : [],
      packingdatas: packingdatas ? JSON.parse(packingdatas) : [],
      materialGroups: materialGroups ? JSON.parse(materialGroups) : [],
      job_quantity: parseInt(job_quantity, 10) || 0,
      product_name,
      sub_job_no,
      orgimage,
    });

    console.log("-------------------------sub_job_no",sub_job_no)
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      mode === "print"
        ? `inline; filename="job-sheet-${sub_job_no}.pdf"`
        : `attachment; filename="job-sheet-${sub_job_no}.pdf"`
    );

    res.send(pdfBuffer);
  } catch (err) {
    console.error("Job Sheet PDF error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to generate Job Sheet PDF",
    });
  }
};


// SAVE BOM AS DRAFT (upsert — update if draft exists, else create)
export const saveBOMDraft = async (req, res) => {
  try {
    const {
      job_no,
      sub_job_no,
      sales_order_id,
      product_name,
      job_quantity,
      material_specification,
      material_groups,
      materialprocess,
      packingdatas,
      costdetails,
      jobSheet,
      quotation,
      orgimage,
      items,
      jobDescription,
      draft_step,
      bom_id,
    } = req.body;

    if (!sub_job_no) {
      return res.status(400).json({
        success: false,
        message: "Sub job number is required",
      });
    }

    const userId = req.user?._id;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    // Parse JSON fields
    const parsedItems         = items                 ? JSON.parse(items)                            : [];
    const parsedMaterial      = material_specification ? JSON.parse(material_specification)           : [];
    const parsedGroups        = material_groups        ? JSON.parse(material_groups)                  : [];
    const parsedProcesses     = materialprocess        ? deepParseJSON(materialprocess)               : [];
    const parsedPacking       = packingdatas           ? JSON.parse(packingdatas)                     : [];
    const parsedCostDetails   = costdetails            ? JSON.parse(costdetails)                      : {};
    const parsedJobSheet      = jobSheet               ? JSON.parse(jobSheet)                         : {};
    const parsedQuotation     = quotation              ? JSON.parse(quotation)                        : {};

    // Handle Artwork Files
    let artwork_pdf_url = "";
    if (req.body.clone_artwork_pdf_key) {
      try {
        const key = req.body.clone_artwork_pdf_key;
        const pdfBuffer = await downloadFromR2(key);
        const name = key.split("/").pop();
        artwork_pdf_url = await uploadToR2(`/quotation/${job_no}/pdf`, pdfBuffer, name, mime.lookup(name) || "application/pdf");
      } catch (err) { console.error("Err cloning pdf", err); }
    }

    let artwork_cdr_url = "";
    if (req.body.clone_artwork_cdr_key) {
      try {
        const key = req.body.clone_artwork_cdr_key;
        const cdrBuffer = await downloadFromR2(key);
        const name = key.split("/").pop();
        artwork_cdr_url = await uploadToR2(`/quotation/${job_no}/cdr`, cdrBuffer, name, mime.lookup(name) || "application/octet-stream");
      } catch (err) { console.error("Err cloning cdr", err); }
    }

    if (req.files?.artwork_pdf?.[0]) {
      const f = req.files.artwork_pdf[0];
      artwork_pdf_url = await uploadToR2(`/quotation/${job_no}/designs/pdf`, f.buffer, f.originalname, f.mimetype);
    }
    if (req.files?.artwork_cdr?.[0]) {
      const f = req.files.artwork_cdr[0];
      artwork_cdr_url = await uploadToR2(`/quotation/${job_no}/designs/cdr`, f.buffer, f.originalname, f.mimetype);
    }

    const updatePayload = {
      job_no,
      sub_job_no,
      sales_order_nanoid: sales_order_id,
      org_image: orgimage || "",
      product_name: product_name || "",
      job_quantity: job_quantity || 0,
      jobDescription: jobDescription || "",
      is_bom_draft: true,
      draft_step: draft_step != null ? Number(draft_step) : 0,
      items: parsedItems,
      material_specification: parsedMaterial,
      material_groups: parsedGroups,
      materialprocess: parsedProcesses,
      packingdatas: parsedPacking,
      costdetails: parsedCostDetails,
      jobSheet: parsedJobSheet,
      quotation: parsedQuotation,
      artwork_pdf: artwork_pdf_url,
      artwork_cdr: artwork_cdr_url,
      updated_at: getCurrentDate(),
    };

    // Find existing draft for this sub_job_no
    let existingDraft = null;
    if (bom_id) {
      existingDraft = await bomModel.findOne({ id: bom_id });
    }
    if (!existingDraft) {
      existingDraft = await bomModel.findOne({
        sub_job_no,
        is_bom_draft: true,
      });
    }

    let savedBOM;
    if (existingDraft) {
      savedBOM = await bomModel.findOneAndUpdate(
        { _id: existingDraft._id },
        {
          $set: updatePayload,
          $push: { updated_by: { user: userId, date: getCurrentDate() } },
        },
        { new: true }
      );
    } else {
      const newBOM = new bomModel({
        id: nanoid(16),
        ...updatePayload,
        is_active: true,
        created_by: userId,
        created_at: getCurrentDate(),
        updated_by: [],
        updated_at: null,
      });
      savedBOM = await newBOM.save();
    }

    // Link to Sales Order if provided
    if (savedBOM && sales_order_id) {
      await salesorderlistModel.findOneAndUpdate(
        { id: sales_order_id },
        {
          $set: {
            is_bom_filled: false, 
            bom_id: savedBOM._id,
            bom_nanoid: savedBOM.id,
            updated_at: getCurrentDate(),
          },
          $push: {
            updated_by: { user: userId, date: getCurrentDate() },
          },
        },
        { new: true }
      );
    }

    res.status(existingDraft ? 200 : 201).json({
      success: true,
      message: existingDraft ? "Draft updated successfully" : "Draft saved successfully",
      data: savedBOM,
    });
  } catch (error) {
    console.error("Error saving BOM draft:", error);
    res.status(500).json({ success: false, message: "Error saving draft", error: error.message });
  }
};


function deepParseJSON(value) {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return deepParseJSON(parsed);
    } catch {
      return value;
    }
  }
  if (Array.isArray(value)) {
    return value.map(deepParseJSON);
  }
  if (value && typeof value === "object") {
    const result = {};
    for (const key in value) {
      result[key] = deepParseJSON(value[key]);
    }
    return result;
  }
  return value;
}
