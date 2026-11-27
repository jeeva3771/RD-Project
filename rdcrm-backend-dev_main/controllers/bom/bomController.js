import { nanoid } from "nanoid";
import mongoose from "mongoose";
import bomModel from "../../models/bom/bomModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";
import { deleteFromR2, downloadFromR2, generateSignedUrl, uploadToR2, signSafe } from "../../helpers/r2helper.js";
import salesorderlistModel from "../../models/sales_orders/sales_order_list_Model.js";
import mime from "mime-types";
import { generateQuotationPDFBuffer } from "./generateQuotationPDFBuffer.js";
import { generateJobSheetPDFBuffer } from "./generateJobSheetPDFBuffer.js";
import { generateCostSheetPDFBuffer } from "./generateCostSheetPDFBuffer.js";
import enquiryModel from "../../models/enquiry/enquiryModel.js";
import customItemModel from "../../models/inventory/customItem/customItemModel.js";
import userModel from "../../models/users/userModel.js";
import EnquiryJob from "../../models/enquiry/enquiryJobIntegrationModel.js";

// Helper to ensure custom items are unique per sub-job (clones custom items from other sub-jobs)
export const ensureUniqueCustomItems = async (items, materialSpecification, jobNo, subJobNo, referenceNo, userId) => {
  if (!items || !Array.isArray(items)) return;

  for (const item of items) {
    if (item.is_inventory_item === false && item.master_id) {
      try {
        const originalCustomItem = await customItemModel.findById(item.master_id);
        // If this custom item was created for another sub_job_no, clone it for the current sub_job_no
        if (originalCustomItem && originalCustomItem.sub_job_no !== subJobNo) {
          console.log(`[UniqueCustomItems] Cloning custom item ${originalCustomItem.item_code} from ${originalCustomItem.sub_job_no} to ${subJobNo}`);

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
        console.error("Error cloning custom item in ensureUniqueCustomItems helper:", err);
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

    const search = req.query.search?.trim() || "";
    const job_no = req.query.job_no?.trim() || "";
    const sub_job_no = req.query.sub_job_no?.trim() || "";
    const bom_id = req.query.bom_id?.trim() || req.query.id?.trim() || "";
    const is_active = req.query.is_active;
    const sortField = req.query.sortField?.trim();
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    const query = {};

    if (bom_id) {
      const isObjId = mongoose.Types.ObjectId.isValid(bom_id);
      query.$or = [
        ...(isObjId ? [{ _id: bom_id }] : []),
        { id: bom_id }
      ];
    } else {
      // Support legacy search parameter (searches both fields)
      if (search) {
        query.$or = [
          { job_no: { $regex: search, $options: "i" } },
          { sub_job_no: { $regex: search, $options: "i" } }
        ];
      }

      // Support specific field searches (stripping optional RD prefix for flexible match)
      if (job_no) {
        const strippedJob = job_no.replace(/^RD/i, "").trim();
        query.job_no = { $regex: strippedJob || job_no, $options: "i" };
      }

      if (sub_job_no) {
        const strippedSub = sub_job_no.replace(/^RD/i, "").trim();
        query.sub_job_no = { $regex: strippedSub || sub_job_no, $options: "i" };
      }
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

    const boms = await bomModel
      .find(query)
      .collation({ locale: "en", strength: 2 })
      .sort(sortOption)
      .populate({ path: "enquiry_id", select: "enquiry_no reference_no" })
      .populate({ path: "sales_order_nanoid", select: "order_no" })
      // .populate({ path: "material.material_id", select: "name" })
      // .populate({ path: "combinations.material_id", select: "name" })
      // .populate({ path: "combinations.process.process_id", select: "name" })
      // .populate({ path: "packing.material_id", select: "name" })
      .populate({ path: "created_by", select: "name" })
      .populate({ path: "updated_by.user", select: "name" })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalBOMs / limit);

    const processedBoms = boms.map((b) => {
      const obj = b.toObject ? b.toObject() : { ...b };
      if (obj.org_image) {
        obj.org_image = signSafe(obj.org_image);
        obj.image = obj.org_image;
      }
      return obj;
    });

    res.status(200).json({
      success: true,
      count: boms.length,
      total: totalBOMs,
      page,
      totalPages,
      data: processedBoms,
    });
  } catch (error) {
    console.error("Error getting BOMs:", error);
    res.status(500).json({
      success: false,
      message: "Error getting BOMs",
      error: error.message,
    });
  }
};

export const getBOMById = async (req, res) => {
  try {
    const { id } = req.params;
    const cleanId = String(id || "").trim();
    const isOid = mongoose.isValidObjectId(cleanId);
    const withoutRd = cleanId.replace(/^RD/i, "");
    const withRd = `RD${withoutRd}`;

    let bom;
    try {
      bom = await bomModel
        .findOne({
          $or: [
            { id: cleanId },
            ...(isOid ? [{ _id: cleanId }] : []),
            { sub_job_no: cleanId },
            { sub_job_no: withRd },
            { sub_job_no: withoutRd },
          ],
        })
        .populate({ path: "enquiry_id", select: "enquiry_no reference_no name product_name" })
        .populate({ path: "created_by", select: "name" })
        .populate({ path: "updated_by.user", select: "name" });
    } catch (popErr) {
      console.warn("Populate failed in getBOMById, falling back to unpopulated find:", popErr.message);
      bom = await bomModel.findOne({
        $or: [
          { id: cleanId },
          ...(isOid ? [{ _id: cleanId }] : []),
          { sub_job_no: cleanId },
          { sub_job_no: withRd },
          { sub_job_no: withoutRd },
        ],
      });
    }

    if (!bom) {
      return res.status(404).json({
        success: false,
        message: "BOM not found",
      });
    }

    let signedPdfUrl = null;
    let signedCdrUrl = null;

    if (bom.artwork_pdf) {
      try {
        signedPdfUrl = generateSignedUrl(bom.artwork_pdf);
      } catch {
        signedPdfUrl = bom.artwork_pdf;
      }
    }

    if (bom.artwork_cdr) {
      try {
        signedCdrUrl = generateSignedUrl(bom.artwork_cdr);
      } catch {
        signedCdrUrl = bom.artwork_cdr;
      }
    }

    const bomObj = bom.toObject();
    if (bomObj.org_image) {
      bomObj.org_image = signSafe(bomObj.org_image);
      bomObj.image = bomObj.org_image;
    }

    res.status(200).json({
      success: true,
      data: {
        ...bomObj,
        artwork_pdf_url: signedPdfUrl,
        artwork_cdr_url: signedCdrUrl,
      },
    });
  } catch (error) {
    console.error("Error getting BOM:", error);
    res.status(500).json({
      success: false,
      message: "Error getting BOM",
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
      orgimage,
      items,
      jobDescription,
    } = req.body;

    console.log("req.body", req.body)

    console.log(req.files.artwork_pdf);

    if (!enquiry_id || !job_no || !sub_job_no) {
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


    // Parse JSON fields from FormData
    const parsedMaterial = material_specification ? JSON.parse(material_specification) : [];
    const parsedGroups = material_groups ? JSON.parse(material_groups) : [];
    const parsedProcesses = materialprocess ? deepParseJSON(materialprocess) : [];
    const parsedPacking = packingdatas ? JSON.parse(packingdatas) : [];
    const parsedCostDetails = costdetails ? JSON.parse(costdetails) : {};
    const parsedJobSheet = jobSheet ? JSON.parse(jobSheet) : {};
    const parsedQuotation = quotation ? JSON.parse(quotation) : {};
    const parsedItems = items ? JSON.parse(items) : [];

    let job_sheet_pdf_url = "";

    // Fetch reference_no from linked enquiry
    const linkedEnquiry = enquiry_id ? await enquiryModel.findById(enquiry_id).select("reference_no") : null;
    const reference_no = linkedEnquiry?.reference_no || "";

    await ensureUniqueCustomItems(parsedItems, parsedMaterial, job_no, sub_job_no, reference_no, userId);

    if (parsedJobSheet && sales_order_id) {
      const pdfBuffer = await generateJobSheetPDFBuffer({
        job_quantity: job_quantity,
        product_name: product_name,
        sub_job_no: sub_job_no,
        reference_no: reference_no,
        materialSpecification: parsedMaterial,
        materialprocess: parsedProcesses,
        packingdatas: parsedPacking,
        orgimage: orgimage ? generateSignedUrl(orgimage) : null,
        materialGroups: parsedGroups,
      });

      const filename = reference_no
        ? `job-sheet-${sub_job_no}-${reference_no}.pdf`
        : `job-sheet-${sub_job_no}.pdf`;

      job_sheet_pdf_url = await uploadToR2(
        `/quotation/${job_no}/jobsheet`,
        pdfBuffer,
        filename,
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
        reference_no: reference_no,
        quotation: parsedQuotation,
        packingdatas: parsedPacking,
        jobDescription,
        orgimage: orgimage ? generateSignedUrl(orgimage) : null,
      });


      const filename = reference_no
        ? `quotation-${sub_job_no}-${reference_no}.pdf`
        : `quotation-${sub_job_no}.pdf`;

      quotation_pdf_url = await uploadToR2(
        `/quotation/${job_no}/quotationpdf`,
        pdfBuffer,
        filename,
        "application/pdf"
      );
    } catch (err) {
      console.error("Error generating quotation PDF:", err);
    }

    console.log("quotation_pdf_url", quotation_pdf_url);

    const cleanSubNo = (sub_job_no || "").trim();
    const withoutRdSub = cleanSubNo.replace(/^RD/i, "");
    const withRdSub = `RD${withoutRdSub}`;

    // Check if a BOM record already exists for this sub_job_no or sales order
    let existingBOM = await bomModel.findOne({
      $or: [
        ...(cleanSubNo ? [{ sub_job_no: cleanSubNo }, { sub_job_no: withRdSub }, { sub_job_no: withoutRdSub }] : []),
        ...(sales_order_id ? [{ sales_order_nanoid: sales_order_id }] : []),
      ],
    }).sort({ createdAt: -1 });

    let savedBOM;
    if (existingBOM) {
      console.log("Updating existing BOM document instead of creating duplicate:", existingBOM.id);
      existingBOM.enquiry_id = enquiry_id;
      existingBOM.job_no = job_no;
      existingBOM.sub_job_no = sub_job_no;
      existingBOM.jobDescription = jobDescription;
      existingBOM.sales_order_nanoid = sales_order_id;
      if (orgimage) existingBOM.org_image = orgimage;
      existingBOM.product_name = product_name;
      existingBOM.job_quantity = job_quantity;
      existingBOM.items = parsedItems;
      existingBOM.material_specification = parsedMaterial;
      existingBOM.material_groups = parsedGroups;
      existingBOM.materialprocess = parsedProcesses;
      existingBOM.packingdatas = parsedPacking;
      existingBOM.costdetails = parsedCostDetails;
      existingBOM.jobSheet = parsedJobSheet;
      existingBOM.quotation = parsedQuotation;
      if (artwork_pdf_url) existingBOM.artwork_pdf = artwork_pdf_url;
      if (artwork_cdr_url) existingBOM.artwork_cdr = artwork_cdr_url;
      existingBOM.is_bom_draft = false;
      existingBOM.draft_step = 0;
      existingBOM.is_active = true;
      existingBOM.updated_at = getCurrentDate();
      existingBOM.updated_by = existingBOM.updated_by || [];
      existingBOM.updated_by.push({ user: userId, date: getCurrentDate() });
      savedBOM = await existingBOM.save();
    } else {
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
        created_by: userId,
        created_at: getCurrentDate(),
        updated_by: [],
        updated_at: null,
      });

      savedBOM = await newBOM.save();
    }

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

    if (sales_order_id) {
      await salesorderlistModel.findOneAndUpdate(
        { id: sales_order_id },
        {
          $set: {
            bom_id: savedBOM._id,
            is_bom_filled: true,
            bom_nanoid: savedBOM.id,
            is_bom_rework: true,
            updated_at: getCurrentDate(),
          },
          $push: {
            job_sheet_files: job_sheet_pdf_url,
            updated_by: {
              user: userId,
              date: getCurrentDate(),
            },
            quatation_files: quotation_pdf_url ? quotation_pdf_url : [],
          },
        },
        { new: true }
      );
    }

    if (sub_job_no) {
      try {
        const finalUnitRate = Number((Number(parsedQuotation?.finalUnitPrice || parsedQuotation?.unitPrice || 0)).toFixed(2));
        const defaultSample = finalUnitRate > 0 ? Number((finalUnitRate + 200).toFixed(2)) : 0;
        const sampleRate = (parsedQuotation?.samplePrice !== undefined && parsedQuotation?.samplePrice !== null && Number(parsedQuotation.samplePrice) > 0)
          ? Number(Number(parsedQuotation.samplePrice).toFixed(2))
          : defaultSample;
        const artworkCharge = Number(Number(parsedQuotation?.artworkCharge || 0).toFixed(2));

        const cleanNo = String(sub_job_no).trim();
        const withRd = cleanNo.startsWith("RD") ? cleanNo : `RD${cleanNo}`;
        const withoutRd = cleanNo.replace(/^RD/i, "");

        const enquiryJob = await EnquiryJob.findOne({
          $or: [
            { "sub_jobs.sub_job_no": cleanNo },
            { "sub_jobs.sub_job_no": withRd },
            { "sub_jobs.sub_job_no": withoutRd },
          ],
        });
        if (enquiryJob) {
          const sj = enquiryJob.sub_jobs.find(
            (s) => s.sub_job_no === cleanNo || s.sub_job_no === withRd || s.sub_job_no === withoutRd
          );
          if (sj) {
            sj.bom_id = savedBOM._id; // Strictly store BOM MongoDB ObjectId
            sj.bom_nanoid = savedBOM.id; // Store 16-char nanoId
            sj.costing_status = "completed";
            sj.quotation_status = "completed";
            sj.costing_completed_at = new Date();
            if (finalUnitRate > 0) {
              sj.target_rate = Number(finalUnitRate);
              sj.unit_rate = Number(finalUnitRate);
              sj.sample_rate = Number(sampleRate);
              sj.artwork_charge = Number(artworkCharge);
              sj.line_total = Number(((sj.quantity || 1) * finalUnitRate).toFixed(2));
              if (artworkCharge > 0) {
                const targetList = enquiryJob?.sub_jobs;
                if (Array.isArray(targetList)) {
                  targetList.forEach((other) => {
                    if (other !== sj) other.artwork_charge = 0;
                  });
                }
              }
            }
          }

          // Also sync BOM ObjectId and nanoId to salesorderlist card in Production Hub
          await salesorderlistModel.updateMany(
            {
              $or: [
                { sub_job_no: cleanNo },
                { sub_job_no: withRd },
                { sub_job_no: withoutRd },
              ],
            },
            {
              $set: {
                bom_id: savedBOM._id,
                bom_nanoid: savedBOM.id,
                is_bom_filled: true,
                updated_at: getCurrentDate(),
              },
            }
          );

          if (enquiryJob.wizard_state) {
            const ws = { ...(enquiryJob.wizard_state || {}) };

            // Parse group letter and variant number from sub_job_no, e.g. "RD21074-A1" -> Group 'A', Variant 1
            const match = cleanNo.match(/[-_]?([A-Za-z])(\d+)?$/);
            const groupCharFromNo = match ? match[1].toUpperCase() : "";
            const variantNumFromNo = match && match[2] ? parseInt(match[2], 10) : 1;
            const resolvedVariantIdx = sj?.size_variant ? sj.size_variant - 1 : (variantNumFromNo - 1);
            const targetGroupIdx = groupCharFromNo ? groupCharFromNo.charCodeAt(0) - 65 : 0;

            if (ws.e?.trophyGroups && Array.isArray(ws.e.trophyGroups)) {
              ws.e.trophyGroups.forEach((tg, idx) => {
                const groupChar = String.fromCharCode(65 + idx);
                // Strict match: update ONLY the targeted sub-job variant item
                if (groupChar === groupCharFromNo || (!groupCharFromNo && idx === 0)) {
                  if (Array.isArray(tg.items) && tg.items[resolvedVariantIdx]) {
                    tg.items[resolvedVariantIdx].rate = finalUnitRate;
                    tg.items[resolvedVariantIdx].unit_rate = finalUnitRate;
                    tg.items[resolvedVariantIdx].sampleRate = sampleRate;
                    tg.items[resolvedVariantIdx].artworkCharge = artworkCharge;
                    tg.items[resolvedVariantIdx].costing_status = "completed";
                    tg.items[resolvedVariantIdx].bom_id = savedBOM._id || savedBOM.id;
                  }
                  const allItemsCompleted =
                    Array.isArray(tg.items) &&
                    tg.items.length > 0 &&
                    tg.items.every((it) => it.costing_status === "completed");
                  tg.costing_status = allItemsCompleted ? "completed" : "in_progress";
                }
              });
            }

            // Sync into simulatedRates strictly for this specific sub-job
            ws.simulatedRates = ws.simulatedRates || {};
            const ratePayload = {
              rate: finalUnitRate,
              sample: sampleRate,
              artwork: artworkCharge,
              costing_status: "completed",
              bom_id: savedBOM._id || savedBOM.id,
            };
            ws.simulatedRates[`${targetGroupIdx}-${resolvedVariantIdx}`] = ratePayload;
            ws.simulatedRates[cleanNo] = ratePayload;
            ws.simulatedRates[withRd] = ratePayload;
            ws.simulatedRates[withoutRd] = ratePayload;

            enquiryJob.wizard_state = ws;
            enquiryJob.markModified("wizard_state");
          }

          enquiryJob.markModified("sub_jobs");
          enquiryJob.markModified("financials");
          await enquiryJob.save();
        }
      } catch (e) {
        console.error("Error syncing BOM to EnquiryJob in createBOM:", e);
      }
    }

    res.status(201).json({
      success: true,
      message: "BOM created successfully",
      data: savedBOM,
    });
  } catch (error) {
    console.error("Error creating BOM:", error);
    res.status(500).json({ success: false, message: "Error creating BOM", error: error.message });
  }
};


// SAVE BOM AS DRAFT (upsert — update if draft exists, else create)
export const saveBOMDraft = async (req, res) => {
  try {
    const {
      enquiry_id,
      job_no,
      sub_job_no,
      sales_order_id,
      bom_id,
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
    } = req.body;

    if (!enquiry_id || !job_no || !sub_job_no || !sales_order_id) {
      return res.status(400).json({
        success: false,
        message: "Enquiry ID, job number, sub job number and sales_order_id are required",
      });
    }

    const userId = req.user?._id;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    // Parse JSON fields (same as createBOM)
    const parsedItems = items ? JSON.parse(items) : [];
    const parsedMaterial = material_specification ? JSON.parse(material_specification) : [];
    const parsedGroups = material_groups ? JSON.parse(material_groups) : [];
    const parsedProcesses = materialprocess ? deepParseJSONLocal(materialprocess) : [];
    const parsedPacking = packingdatas ? JSON.parse(packingdatas) : [];
    const parsedCostDetails = costdetails ? JSON.parse(costdetails) : {};
    const parsedJobSheet = jobSheet ? JSON.parse(jobSheet) : {};
    const parsedQuotation = quotation ? JSON.parse(quotation) : {};

    let reference_no = "";
    if (enquiry_id) {
      const enq = await enquiryModel.findById(enquiry_id).select('reference_no').lean();
      if (enq) reference_no = enq.reference_no;
    }

    await ensureUniqueCustomItems(parsedItems, parsedMaterial, job_no, sub_job_no, reference_no, userId);

    // 1. CLONING
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

    // 2. NEW UPLOADS
    if (req.files?.artwork_pdf?.[0]) {
      const f = req.files.artwork_pdf[0];
      artwork_pdf_url = await uploadToR2(`/quotation/${job_no}/designs/pdf`, f.buffer, f.originalname, f.mimetype);
    }
    if (req.files?.artwork_cdr?.[0]) {
      const f = req.files.artwork_cdr[0];
      artwork_cdr_url = await uploadToR2(`/quotation/${job_no}/designs/cdr`, f.buffer, f.originalname, f.mimetype);
    }


    const updatePayload = {
      enquiry_id,
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

    console.log("Saving BOM Draft for Sales Order:", sales_order_id);

    const cleanSubNo = sub_job_no ? String(sub_job_no).trim() : "";
    const withRdSub = cleanSubNo ? (cleanSubNo.startsWith("RD") ? cleanSubNo : `RD${cleanSubNo}`) : "";
    const withoutRdSub = cleanSubNo ? cleanSubNo.replace(/^RD/i, "") : "";

    // Try to find an existing BOM or draft for this sales order or sub-job (robust ID check)
    const existingDraft = await bomModel.findOne({
      $or: [
        ...(bom_id ? [
          { id: String(bom_id).trim() },
          ...(mongoose.isValidObjectId(bom_id) ? [{ _id: bom_id }] : []),
        ] : []),
        { sales_order_nanoid: sales_order_id },
        { sales_order_id: sales_order_id },
        ...(cleanSubNo ? [{ sub_job_no: cleanSubNo }, { sub_job_no: withRdSub }, { sub_job_no: withoutRdSub }] : []),
      ],
    }).sort({ createdAt: -1 });

    let savedBOM;

    if (existingDraft) {
      console.log("Updating existing draft:", existingDraft.id);
      // UPDATE the existing draft — no new record created
      savedBOM = await bomModel.findOneAndUpdate(
        { _id: existingDraft._id },
        {
          $set: updatePayload,
          $push: { updated_by: { user: userId, date: getCurrentDate() } },
        },
        { new: true }
      );
    } else {
      console.log("Creating a brand new draft...");
      // CREATE a brand new draft
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

    if (savedBOM) {
      console.log("BOM Draft Record Status:", savedBOM.is_bom_draft ? "DRAFT" : "NOT DRAFT");

      // Sync draft status to EnquiryJob sub-job
      if (sub_job_no) {
        try {
          const enquiryJob = await EnquiryJob.findOne({ "sub_jobs.sub_job_no": sub_job_no });
          if (enquiryJob) {
            const sj = enquiryJob.sub_jobs.find((s) => s.sub_job_no === sub_job_no);
            if (sj && sj.costing_status !== "completed") {
              sj.bom_id = savedBOM._id; // Store BOM's MongoDB ObjectId
              sj.bom_nanoid = savedBOM.id; // Store BOM's nanoId
              sj.costing_status = "in_progress";
              enquiryJob.markModified("sub_jobs");
              await enquiryJob.save();
            }
          }

          // Also sync BOM ObjectId and nanoId to salesorderlist card in Production Hub
          await salesorderlistModel.updateMany(
            {
              $or: [
                { sub_job_no: sub_job_no },
                { sub_job_no: `RD${String(sub_job_no).replace(/^RD/i, "")}` },
                { sub_job_no: String(sub_job_no).replace(/^RD/i, "") },
              ],
            },
            {
              $set: {
                bom_id: savedBOM._id,
                bom_nanoid: savedBOM.id,
                updated_at: getCurrentDate(),
              },
            }
          );
        } catch (e) {
          console.error("Error syncing draft BOM to EnquiryJob:", e);
        }
      }

      // Build a safe $or — only include _id if it looks like a valid ObjectId
      const soOrConditions = [{ id: sales_order_id }];
      if (salesorderlistModel.base.isValidObjectId(sales_order_id)) {
        soOrConditions.push({ _id: sales_order_id });
      }

      const updatedOrder = await salesorderlistModel.findOneAndUpdate(
        { $or: soOrConditions },
        {
          $set: {
            is_bom_filled: false, // Move to DRAFT box — works for both new and rework BOMs
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

      console.log("Sales Order link update result:", updatedOrder ? "SUCCESS" : "FAILED (Order not found)");
    }

    if (existingDraft) {
      return res.status(200).json({
        success: true,
        message: "Draft updated successfully",
        data: savedBOM,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Draft saved successfully",
      data: savedBOM,
    });
  } catch (error) {
    console.error("Error saving BOM draft:", error);
    res.status(500).json({ success: false, message: "Error saving draft", error: error.message });
  }
};

// local deepParseJSON helper used by saveBOMDraft above
function deepParseJSONLocal(value) {
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return value; }
  }
  if (Array.isArray(value)) return value.map(deepParseJSONLocal);
  if (typeof value === "object" && value !== null) {
    const o = {};
    for (const k in value) o[k] = deepParseJSONLocal(value[k]);
    return o;
  }
  return value;
}

function deepParseJSON(value) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  if (Array.isArray(value)) {
    return value.map(deepParseJSON);
  }

  if (typeof value === "object" && value !== null) {
    const newObj = {};
    for (const key in value) {
      newObj[key] = deepParseJSON(value[key]);
    }
    return newObj;
  }

  return value;
}

// UPDATE BOM
export const updateBOM = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const cleanId = String(id || "").trim();
    const isOid = mongoose.isValidObjectId(cleanId);
    const withoutRd = cleanId.replace(/^RD/i, "");
    const withRd = `RD${withoutRd}`;

    const bom = await bomModel.findOne({
      $or: [
        { id: cleanId },
        ...(isOid ? [{ _id: cleanId }] : []),
        { sub_job_no: cleanId },
        { sub_job_no: withRd },
        { sub_job_no: withoutRd },
      ],
    });
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
      sales_order_id,
      allow_mastercarton_packing,
      allow_thermocol_packing,
      allow_blackbox_packing,
    } = req.body;

    delete req.body.clone_artwork_pdf_key;
    delete req.body.clone_artwork_cdr_key;

    const parsedMaterialProcess = materialprocess ? deepParseJSON(materialprocess) : materialprocess;

    const parsedItems = items ? JSON.parse(items) : null;
    const parsedMaterial = material_specification ? JSON.parse(material_specification) : null;

    if (parsedItems) {
      const linkedEnquiryForUpdate = bom.enquiry_id ? await enquiryModel.findById(bom.enquiry_id).select("reference_no") : null;
      const reference_no_update = linkedEnquiryForUpdate?.reference_no || "";
      await ensureUniqueCustomItems(parsedItems, parsedMaterial || bom.material_specification, bom.job_no, bom.sub_job_no, reference_no_update, userId);
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
      ...(allow_mastercarton_packing !== undefined && { allow_mastercarton_packing: allow_mastercarton_packing === 'true' || allow_mastercarton_packing === true }),
      ...(allow_thermocol_packing !== undefined && { allow_thermocol_packing: allow_thermocol_packing === 'true' || allow_thermocol_packing === true }),
      ...(allow_blackbox_packing !== undefined && { allow_blackbox_packing: allow_blackbox_packing === 'true' || allow_blackbox_packing === true }),
    };

    const finalMaster = updateData.allow_mastercarton_packing !== undefined ? updateData.allow_mastercarton_packing : bom.allow_mastercarton_packing;
    const finalThermocol = updateData.allow_thermocol_packing !== undefined ? updateData.allow_thermocol_packing : bom.allow_thermocol_packing;
    const finalBlackbox = updateData.allow_blackbox_packing !== undefined ? updateData.allow_blackbox_packing : bom.allow_blackbox_packing;
    updateData.allow_sequential_packing = !!(finalMaster || finalThermocol || finalBlackbox);

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

        // Fetch reference_no from linked enquiry (from stored bom.enquiry_id)
        const linkedEnquiryForUpdate = bom.enquiry_id ? await enquiryModel.findById(bom.enquiry_id).select("reference_no") : null;
        const reference_no_update = linkedEnquiryForUpdate?.reference_no || "";

        const pdfBuffer = await generateQuotationPDFBuffer({
          product_name: product_name || bom.product_name,
          job_quantity: job_quantity || bom.job_quantity,
          totalUnitCost: parsedQuotation?.finalUnitPrice || 0,
          sub_job_no: bom.sub_job_no,
          reference_no: reference_no_update,
          quotation: parsedQuotation,
          packingdatas: JSON.parse(packingdatas || "[]"),
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

        const filename = reference_no_update
          ? `quotation-${bom.sub_job_no}-${reference_no_update}-v${version}.pdf`
          : `quotation-${bom.sub_job_no}-v${version}.pdf`;

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

        // Fetch reference_no from linked enquiry
        const linkedEnquiryForJobSheet = bom.enquiry_id ? await enquiryModel.findById(bom.enquiry_id).select("reference_no") : null;
        const reference_no_jobsheet = linkedEnquiryForJobSheet?.reference_no || "";

        const pdfBuffer = await generateJobSheetPDFBuffer({
          ...parsedJobSheet,
          materialGroups: parsedGroups,
          job_quantity: job_quantity || bom.job_quantity,
          product_name: product_name || bom.product_name,
          sub_job_no: bom.sub_job_no,
          reference_no: reference_no_jobsheet,
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

        const filename = reference_no_jobsheet
          ? `job-sheet-${bom.sub_job_no}-${reference_no_jobsheet}-v${version}.pdf`
          : `job-sheet-${bom.sub_job_no}-v${version}.pdf`;

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
      const updateObj = {
        $set: { is_bom_filled: true, is_bom_rework: true, updated_at: getCurrentDate(), },
        $push: { updated_by: { user: userId, date: getCurrentDate(), }, },
      };


      if (quotation_pdf_url) updateObj.$push.quatation_files = quotation_pdf_url;
      if (job_sheet_pdf_url) updateObj.$push.job_sheet_files = job_sheet_pdf_url;

      await salesorderlistModel.findOneAndUpdate({ id: sales_order_id }, updateObj, { new: true });
    }
    const updatedBOM = await bomModel.findOne({
      $or: [
        { id: cleanId },
        ...(isOid ? [{ _id: cleanId }] : []),
        { sub_job_no: cleanId },
        { sub_job_no: withRd },
        { sub_job_no: withoutRd },
      ],
    });

    // Sync to EnquiryJob sub-job
    if (updatedBOM?.sub_job_no) {
      try {
        const finalUnitRate = Number((Number(updateData.quotation?.finalUnitPrice || updatedBOM.quotation?.finalUnitPrice || 0)).toFixed(2));
        const defaultSample = finalUnitRate > 0 ? Number((finalUnitRate + 200).toFixed(2)) : 0;
        const sampleRate = (updateData.quotation?.samplePrice !== undefined && Number(updateData.quotation?.samplePrice) > 0)
          ? Number(Number(updateData.quotation.samplePrice).toFixed(2))
          : (updatedBOM.quotation?.samplePrice !== undefined && Number(updatedBOM.quotation?.samplePrice) > 0)
          ? Number(Number(updatedBOM.quotation.samplePrice).toFixed(2))
          : defaultSample;
        const artworkCharge = Number(Number(updateData.quotation?.artworkCharge || updatedBOM.quotation?.artworkCharge || 0).toFixed(2));

        const bomSubJobNo = String(updatedBOM.sub_job_no).trim();
        const bomWithRd = bomSubJobNo.startsWith("RD") ? bomSubJobNo : `RD${bomSubJobNo}`;
        const bomWithoutRd = bomSubJobNo.replace(/^RD/i, "");

        const enquiryJob = await EnquiryJob.findOne({
          $or: [
            { "sub_jobs.sub_job_no": bomSubJobNo },
            { "sub_jobs.sub_job_no": bomWithRd },
            { "sub_jobs.sub_job_no": bomWithoutRd },
          ],
        });
        if (enquiryJob) {
          const sj = enquiryJob.sub_jobs.find(
            (s) => s.sub_job_no === bomSubJobNo || s.sub_job_no === bomWithRd || s.sub_job_no === bomWithoutRd
          );
          if (sj) {
            sj.bom_id = updatedBOM._id || updatedBOM.id;
            sj.bom_nanoid = updatedBOM.id || "";
            sj.costing_status = "completed";
            sj.quotation_status = "completed";
            sj.costing_completed_at = new Date();
            if (finalUnitRate > 0) {
              sj.target_rate = Number(finalUnitRate);
              sj.unit_rate = Number(finalUnitRate);
              sj.sample_rate = Number(sampleRate);
              sj.artwork_charge = Number(artworkCharge);
              sj.line_total = Number(((sj.quantity || 1) * finalUnitRate).toFixed(2));
              if (artworkCharge > 0) {
                const targetList = enquiryJob?.sub_jobs;
                if (Array.isArray(targetList)) {
                  targetList.forEach((other) => {
                    if (other !== sj) other.artwork_charge = 0;
                  });
                }
              }
            }
          }

          if (enquiryJob.wizard_state) {
            const ws = { ...(enquiryJob.wizard_state || {}) };

            // Parse group letter and variant number from sub_job_no, e.g. "RD21074-A1" -> Group 'A', Variant 1
            const match = bomSubJobNo.match(/[-_]?([A-Za-z])(\d+)?$/);
            const groupCharFromNo = match ? match[1].toUpperCase() : "";
            const variantNumFromNo = match && match[2] ? parseInt(match[2], 10) : 1;
            const resolvedVariantIdx = sj?.size_variant ? sj.size_variant - 1 : (variantNumFromNo - 1);
            const targetGroupIdx = groupCharFromNo ? groupCharFromNo.charCodeAt(0) - 65 : 0;

            if (ws.e?.trophyGroups && Array.isArray(ws.e.trophyGroups)) {
              ws.e.trophyGroups.forEach((tg, idx) => {
                const groupChar = String.fromCharCode(65 + idx);
                // Strict match: update ONLY the targeted sub-job variant item
                if (groupChar === groupCharFromNo || (!groupCharFromNo && idx === 0)) {
                  if (Array.isArray(tg.items) && tg.items[resolvedVariantIdx]) {
                    tg.items[resolvedVariantIdx].rate = finalUnitRate;
                    tg.items[resolvedVariantIdx].unit_rate = finalUnitRate;
                    tg.items[resolvedVariantIdx].sampleRate = sampleRate;
                    tg.items[resolvedVariantIdx].artworkCharge = artworkCharge;
                    tg.items[resolvedVariantIdx].costing_status = "completed";
                    tg.items[resolvedVariantIdx].bom_id = updatedBOM._id || updatedBOM.id;
                    tg.items[resolvedVariantIdx].bom_nanoid = updatedBOM.id || "";
                  }
                  const allItemsCompleted =
                    Array.isArray(tg.items) &&
                    tg.items.length > 0 &&
                    tg.items.every((it) => it.costing_status === "completed");
                  tg.costing_status = allItemsCompleted ? "completed" : "in_progress";
                }
              });
            }

            // Sync into simulatedRates strictly for this specific sub-job
            ws.simulatedRates = ws.simulatedRates || {};
            const ratePayload = {
              rate: finalUnitRate,
              sample: sampleRate,
              artwork: artworkCharge,
              costing_status: "completed",
              bom_id: updatedBOM._id || updatedBOM.id,
            };
            ws.simulatedRates[`${targetGroupIdx}-${resolvedVariantIdx}`] = ratePayload;
            ws.simulatedRates[bomSubJobNo] = ratePayload;
            ws.simulatedRates[bomWithRd] = ratePayload;
            ws.simulatedRates[bomWithoutRd] = ratePayload;

            enquiryJob.wizard_state = ws;
            enquiryJob.markModified("wizard_state");
          }

          enquiryJob.markModified("sub_jobs");
          enquiryJob.markModified("financials");
          await enquiryJob.save();
        }
      } catch (e) {
        console.error("Error syncing BOM update to EnquiryJob:", e);
      }
    }

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


export const downloadQuotationPDF = async (req, res) => {
  try {
    const { mode } = req.query;
    const {
      product_name,
      job_quantity,
      sub_job_no,
      reference_no,
      quotation,
      jobDescription,
      orgimage,
    } = req.body;

    const pdfBuffer = await generateQuotationPDFBuffer({
      product_name,
      job_quantity,
      totalUnitCost: quotation?.finalUnitPrice || 0,
      sub_job_no,
      reference_no,
      quotation,
      jobDescription,
      orgimage: orgimage ? generateSignedUrl(orgimage) : null,
    });

    res.setHeader("Content-Type", "application/pdf");

    const filename = reference_no
      ? `quotation-${sub_job_no}-${reference_no}.pdf`
      : `quotation-${sub_job_no}.pdf`;

    if (mode === "print") {
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${filename}"`
      );
    } else {
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
    }

    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to generate PDF" });
  }
};



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
      reference_no,
      orgimage,
      materialGroups
    } = req.body;

    console.log("req.body", req.body)

    const pdfBuffer = await generateJobSheetPDFBuffer({
      materialSpecification,
      materialprocess,
      packingdatas,
      job_quantity,
      product_name,
      sub_job_no,
      reference_no,
      orgimage: orgimage ? generateSignedUrl(orgimage) : null,
      materialGroups
    });

    res.setHeader("Content-Type", "application/pdf");

    const filename = reference_no
      ? `job-sheet-${sub_job_no}-${reference_no}.pdf`
      : `job-sheet-${sub_job_no}.pdf`;

    if (mode === "print") {
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${filename}"`
      );
    } else {
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
    }

    res.send(pdfBuffer);
  } catch (err) {
    console.error("Job Sheet PDF error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to generate Job Sheet PDF",
    });
  }
};

/* ==========================================================================
   📐 DETAILED MATHEMATICAL BOM QUANTITY RECALCULATION ENGINE (PHASE 3)
   ========================================================================== */

/**
 * Pure mathematical recalculation function that scales all BOM elements
 * (materials, processes, packing, costdetails, quotation) based on new quantity.
 */
export const recalculateBOMForNewQty = (bom, newQty) => {
  const newQtyNum = Number(newQty);
  if (isNaN(newQtyNum) || newQtyNum <= 0) {
    throw new Error("Invalid new quantity provided for recalculation");
  }

  const bomObj = bom.toObject ? bom.toObject() : JSON.parse(JSON.stringify(bom));

  // Store the old quantity to use for scaling area metrics
  const oldQtyNum = Number(bomObj.job_quantity || bomObj.order_qty || 1);

  // Update primary job quantity on the returned/sandbox data
  bomObj.job_quantity = newQtyNum;

  // 1. Recalculate Material Specifications
  const recalculatedMaterialSpec = (bomObj.material_specification || []).map((mat) => {
    const wastageVal = Number(mat.wastage?.value || 0);
    const wastageType = mat.wastage?.type || "%";
    const rateVal = parseFloat(mat.rate || 0);

    if (mat.material_type === "sheet") {
      const ups = Number(mat.input?.ups || 1);

      let width = 0;
      let height = 0;
      const sizeStr = mat.input?.size || "";
      if (sizeStr) {
        const parts = sizeStr.toLowerCase().split("x");
        if (parts.length === 2) {
          width = Number(parts[0].trim()) || 0;
          height = Number(parts[1].trim()) || 0;
        }
      }

      // if (width === 0 || height === 0) {
      //   width = Number(mat.input?.width || mat.input?.one_up_length || 0);
      //   height = Number(mat.input?.height || mat.input?.one_up_width || 0);
      // }

      const sheetArea = width * height;

      let finalTotal;
      if (wastageType === "%") {
        finalTotal = Math.ceil((newQtyNum * (1 + wastageVal / 100)) / ups);
      } else {
        finalTotal = Math.ceil((newQtyNum + wastageVal) / ups);
      }

      const jobTotal = sheetArea * rateVal * finalTotal;
      const unitRate = newQtyNum > 0 ? jobTotal / newQtyNum : 0;

      return {
        ...mat,
        input: {
          ...mat.input,
          quantity: Math.ceil(newQtyNum / ups),
        },
        final_total: finalTotal,
        jobTotal: Number(jobTotal.toFixed(2)),
        unitRate: Number(unitRate.toFixed(2)),
      };
    } else {
      // Direct/Unit Material
      const inputQty = Number(mat.input?.quantity || 1);
      const unit = mat.input?.unit || "Unit";

      let finalTotal;
      if (wastageType === "%") {
        if (unit === "Unit") {
          finalTotal = Math.ceil((newQtyNum * inputQty) * (1 + wastageVal / 100));
        } else {
          finalTotal = Math.ceil(inputQty * (1 + wastageVal / 100));
        }
      } else { // count
        if (unit === "Unit") {
          finalTotal = Math.ceil((newQtyNum * inputQty) + wastageVal);
        } else {
          finalTotal = Math.ceil(inputQty + wastageVal);
        }
      }

      const jobTotal = rateVal * finalTotal;
      const unitRate = newQtyNum > 0 ? jobTotal / newQtyNum : 0;

      return {
        ...mat,
        final_total: finalTotal,
        jobTotal: Number(jobTotal.toFixed(2)),
        unitRate: Number(unitRate.toFixed(2)),
      };
    }
  });

  // 1.5 Recalculate Material Groups
  const recalculatedMaterialGroups = (bomObj.material_groups || []).map((group) => {
    const updatedMaterials = (group.materials || []).map((mat) => {
      const matchedMaterial = recalculatedMaterialSpec.find(
        (m) => String(m.material_id) === String(mat.material_id) || m.item_id === mat.item_id
      );

      if (matchedMaterial) {
        return {
          ...mat,
          input: {
            ...mat.input,
            quantity: matchedMaterial.input?.quantity,
          },
          final_total: matchedMaterial.final_total,
        };
      }
      return mat;
    });

    return {
      ...group,
      materials: updatedMaterials,
    };
  });

  // Helper to resolve first material of a group (for standard_unit wastage calculations)
  const getGroupFirstMaterial = (groupId) => {
    const bomGroup = recalculatedMaterialGroups.find(
      (g) => String(g.group_id || g._id) === String(groupId)
    );
    const firstMaterialInGroup = bomGroup?.materials?.[0];
    if (firstMaterialInGroup) {
      return recalculatedMaterialSpec.find(
        (m) => String(m.material_id) === String(firstMaterialInGroup.material_id) || m.item_id === firstMaterialInGroup.item_id
      );
    }
    return recalculatedMaterialSpec.find(
      (m) => String(m.material_id) === String(groupId) || m.item_id === groupId
    );
  };

  // 2. Recalculate Material Processes
  const recalculatedMaterialProcess = (bomObj.materialprocess || []).map((group) => {
    const matchedMaterial = getGroupFirstMaterial(group.material_group_id);

    const sheetUps = (matchedMaterial && matchedMaterial.material_type === "sheet")
      ? Number(matchedMaterial.input?.ups || 1)
      : 1;

    const groupFinalTotal = matchedMaterial ? Number(matchedMaterial.final_total || 0) : 0;

    const updatedProcesses = (group.processes || []).map((proc) => {
      const actualInput = Number(proc.input?.actual_input || 0);
      const processNameLower = (proc.process_name || "").toLowerCase();
      const promptLower = (proc.prompt || "").toLowerCase();

      // Auto-resolve dynamic process indexing type
      let processType = proc.process_type || proc.type || "";
      if (!processType) {
        if (processNameLower.includes("laser") || processNameLower.includes("cutting") || promptLower.includes("sheet")) {
          processType = "sheet_time_based";
        } else if (processNameLower.includes("punching") || processNameLower.includes("stroke") || processNameLower.includes("ups")) {
          processType = "ups_based";
        } else if (promptLower.includes("sq inches") || promptLower.includes("area")) {
          processType = "job_absolute_area";
        } else {
          processType = "standard_unit";
        }
      }

      const isUVProcess = processNameLower.includes("uv") || processNameLower.includes("print");
      const hasLaserBefore = (group.processes || []).some(p => (p.process_name || "").toLowerCase().includes("laser"));

      let jobMetric;

      if (isUVProcess) {
        if (newQtyNum === 1) {
          jobMetric = 1;
        } else {
          const upsVal = Number(matchedMaterial?.input?.ups || 1);
          jobMetric = hasLaserBefore
            ? actualInput * (groupFinalTotal * upsVal)
            : actualInput * groupFinalTotal;
        }
      } else {
        switch (processType) {
          case "sheet_time_based":
          case "sheet_rate_based":
            jobMetric = groupFinalTotal * actualInput;
            break;

          case "standard_unit": {
            const firstMat = getGroupFirstMaterial(group.material_group_id) || {};
            const matWastageVal = Number(firstMat.wastage?.value || 0);
            const matWastageType = firstMat.wastage?.type || "%";
            let qtyWithWastage;
            if (matWastageType === "%") {
              qtyWithWastage = Math.ceil(newQtyNum * (1 + matWastageVal / 100));
            } else {
              qtyWithWastage = Math.ceil(newQtyNum + matWastageVal);
            }
            jobMetric = qtyWithWastage * actualInput;
            break;
          }

          case "job_absolute_area":
            jobMetric = oldQtyNum > 0 ? (actualInput / oldQtyNum) * newQtyNum : actualInput;
            break;

          case "ups_based":
            jobMetric = actualInput > 0 ? Math.ceil(newQtyNum / actualInput) : 0;
            break;

          default:
            jobMetric = actualInput;
            break;
        }
      }

      // Preserve existing rates in BOM
      const rateVal = Number(proc.rate || 0);
      const outsourceRateVal = Number(proc.outsource_rate || 0);

      const jobCost = proc.row_type === "Outsource"
        ? (jobMetric * outsourceRateVal)
        : (jobMetric * rateVal);

      const unitCost = newQtyNum > 0 ? jobCost / newQtyNum : 0;

      return {
        ...proc,
        current_total_material: groupFinalTotal,
        order_qty: newQtyNum * sheetUps,
        job_metric: jobMetric,
        jobMetric: jobMetric,
        job_cost: Number(jobCost.toFixed(2)),
        jobTotal: Number(jobCost.toFixed(2)),
        unit_cost: Number(unitCost.toFixed(2)),
        unitRate: Number(unitCost.toFixed(2)),
      };
    });

    return {
      ...group,
      material_total: groupFinalTotal,
      material_input: matchedMaterial ? matchedMaterial.input : group.material_input,
      processes: updatedProcesses,
    };
  });

  // 3. Recalculate Packing Datas
  const recalculatedPackingDatas = (bomObj.packingdatas || []).map((row) => {
    // Keep unit cost exactly the same as the original row total or unit cost
    const newUnitCost = Number(row.total || 0);

    // Calculate the job cost strictly as unit cost * new quantity
    let newFinalTotal;

    let newTotalQty;
    if (row.name === "Packing Labour") {
      newFinalTotal = Number(row.qty || 0) * Number(row.unitCost || 0) * newQtyNum
      newTotalQty = Number(row.qty || 0) * Number(row.unitCost || 0) * newQtyNum
    } else {
      newFinalTotal = Number(row.total || 0) * newQtyNum
      newTotalQty = newQtyNum
    }

    return {
      ...row,
      total: Number(newUnitCost.toFixed(2)),
      finaltotal: Number(newFinalTotal.toFixed(2)),
      total_qty: newTotalQty,
    };
  });

  // 4. Summarize cost details and quotation selling prices
  const totalMaterialUnit = recalculatedMaterialSpec.reduce((sum, m) => sum + (m.unitRate || 0), 0);
  const totalMaterialJob = recalculatedMaterialSpec.reduce((sum, m) => sum + (m.jobTotal || 0), 0);

  const totalProcessUnit = recalculatedMaterialProcess.reduce((sum, g) => {
    return sum + (g.processes || []).reduce((pSum, p) => pSum + (p.unit_cost || 0), 0);
  }, 0);
  const totalProcessJob = recalculatedMaterialProcess.reduce((sum, g) => {
    return sum + (g.processes || []).reduce((pSum, p) => pSum + (p.job_cost || 0), 0);
  }, 0);

  const totalPackingUnit = recalculatedPackingDatas.reduce((sum, p) => sum + (p.total || 0), 0);
  const totalPackingJob = recalculatedPackingDatas.reduce((sum, p) => sum + (p.finaltotal || 0), 0);

  const totalUnitCost = totalMaterialUnit + totalProcessUnit + totalPackingUnit;
  const totalJobCost = totalMaterialJob + totalProcessJob + totalPackingJob;

  const marginVal = Number(bomObj.quotation?.margin || 0);
  const marginType = bomObj.quotation?.marginType || "%";

  const finalUnitPrice = marginType === "₹"
    ? totalUnitCost + marginVal
    : totalUnitCost + (totalUnitCost * (marginVal / 100));

  const finalJobPrice = marginType === "₹"
    ? totalJobCost + marginVal
    : totalJobCost + (totalJobCost * (marginVal / 100));

  const recalculatedQuotation = {
    margin: bomObj.quotation?.margin || "0",
    marginType: bomObj.quotation?.marginType || "%",
    finalUnitPrice: Number(finalUnitPrice.toFixed(2)),
    finalJobPrice: Number(finalJobPrice.toFixed(2)),
    gstRate: bomObj.quotation?.gstRate || "18",
  };

  const costDetailsObj = {
    materialSpecification: recalculatedMaterialSpec,
    materialprocess: recalculatedMaterialProcess,
    packingdatas: recalculatedPackingDatas,
  };

  const jobSheetObj = {
    materialSpecification: recalculatedMaterialSpec,
    materialprocess: recalculatedMaterialProcess,
    packingdatas: recalculatedPackingDatas,
  };

  return {
    material_specification: recalculatedMaterialSpec,
    material_groups: recalculatedMaterialGroups,
    materialprocess: recalculatedMaterialProcess,
    packingdatas: recalculatedPackingDatas,
    costdetails: costDetailsObj,
    jobSheet: jobSheetObj,
    quotation: recalculatedQuotation,
    totalJobCost: Number(totalJobCost.toFixed(2)),
  };
};

/**
 * Controller service trigger that orchestrates calculation of pending quantity rfq sandbox data
 * and stores it inside mongoose models safely.
 */
export const triggerBOMRecalculationForPendingQty = async (bomQuery, newQtyVal) => {
  try {
    const bomObj = await bomModel.findOne(bomQuery);
    if (!bomObj) return null;

    console.log(`[triggerBOMRecalculationForPendingQty] Recalculating BOM ${bomObj.id} for new qty ${newQtyVal}`);

    const recalculated = recalculateBOMForNewQty(bomObj, newQtyVal);

    let quotation_pdf_url = "";
    let job_sheet_pdf_url = "";
    let cost_sheet_pdf_url = "";
    try {
      const linkedEnquiry = bomObj.enquiry_id ? await enquiryModel.findById(bomObj.enquiry_id).select("reference_no") : null;
      const reference_no = linkedEnquiry?.reference_no || "";

      // Determine next version based on existing quotation PDFs in BOM and Sales Order
      let version = 1;
      const existingBOMPdfs = bomObj.quotation_pdf || [];
      existingBOMPdfs.forEach((file) => {
        const match = file.match(/-v(\d+)/);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (num >= version) version = num + 1;
        }
      });

      const soQuery = bomObj.sales_order_nanoid ? { id: bomObj.sales_order_nanoid } : { _id: bomObj.sales_order_id };
      const salesOrder = await salesorderlistModel.findOne(soQuery);
      if (salesOrder && salesOrder.quatation_files) {
        salesOrder.quatation_files.forEach((file) => {
          const match = file.match(/-v(\d+)/);
          if (match && match[1]) {
            const num = parseInt(match[1], 10);
            if (num >= version) version = num + 1;
          }
        });
      }

      // 1. Generate Quotation PDF
      const pdfBuffer = await generateQuotationPDFBuffer({
        product_name: bomObj.product_name,
        job_quantity: newQtyVal,
        totalUnitCost: recalculated.quotation.finalUnitPrice || 0,
        sub_job_no: bomObj.sub_job_no,
        reference_no: reference_no,
        quotation: recalculated.quotation,
        packingdatas: recalculated.packingdatas,
        jobDescription: bomObj.jobDescription,
        orgimage: bomObj.org_image ? generateSignedUrl(bomObj.org_image) : null,
      });

      const filename = reference_no
        ? `quotation-${bomObj.sub_job_no}-${reference_no}-v${version}-recalc-draft.pdf`
        : `quotation-${bomObj.sub_job_no}-v${version}-recalc-draft.pdf`;

      quotation_pdf_url = await uploadToR2(
        `/quotation/${bomObj.job_no}/quotationpdf`,
        pdfBuffer,
        filename,
        "application/pdf"
      );

      // 2. Generate Job Sheet PDF
      try {
        const jobSheetBuffer = await generateJobSheetPDFBuffer({
          job_quantity: newQtyVal,
          product_name: bomObj.product_name,
          sub_job_no: bomObj.sub_job_no,
          reference_no: reference_no,
          materialSpecification: recalculated.material_specification,
          materialprocess: recalculated.materialprocess,
          packingdatas: recalculated.packingdatas,
          orgimage: bomObj.org_image ? generateSignedUrl(bomObj.org_image) : null,
          materialGroups: recalculated.material_groups,
        });

        const jobSheetFilename = reference_no
          ? `job-sheet-${bomObj.sub_job_no}-${reference_no}-v${version}-recalc-draft.pdf`
          : `job-sheet-${bomObj.sub_job_no}-v${version}-recalc-draft.pdf`;

        job_sheet_pdf_url = await uploadToR2(
          `/quotation/${bomObj.job_no}/jobsheet`,
          jobSheetBuffer,
          jobSheetFilename,
          "application/pdf"
        );
      } catch (jsErr) {
        console.error("[triggerBOMRecalculationForPendingQty] Job sheet PDF generation failed:", jsErr);
      }

      // 3. Generate Cost Sheet PDF
      try {
        const costSheetBuffer = await generateCostSheetPDFBuffer({
          jobQty: newQtyVal,
          productName: bomObj.product_name,
          subJobNo: bomObj.sub_job_no,
          reference_no: reference_no,
          materialSpecification: recalculated.material_specification,
          materialprocess: recalculated.materialprocess,
          packingdatas: recalculated.packingdatas,
          orgimage: bomObj.org_image ? generateSignedUrl(bomObj.org_image) : null,
          materialGroups: recalculated.material_groups,
        });

        const costSheetFilename = reference_no
          ? `cost-sheet-${bomObj.sub_job_no}-${reference_no}-v${version}-recalc-draft.pdf`
          : `cost-sheet-${bomObj.sub_job_no}-v${version}-recalc-draft.pdf`;

        cost_sheet_pdf_url = await uploadToR2(
          `/quotation/${bomObj.job_no}/costsheet`,
          costSheetBuffer,
          costSheetFilename,
          "application/pdf"
        );
      } catch (csErr) {
        console.error("[triggerBOMRecalculationForPendingQty] Cost sheet PDF generation failed:", csErr);
      }

      console.log("[triggerBOMRecalculationForPendingQty] Uploaded recalculation PDFs successfully");
    } catch (pdfErr) {
      console.error("[triggerBOMRecalculationForPendingQty] PDF Generation failed:", pdfErr);
    }

    recalculated.quotation_pdf = quotation_pdf_url;
    recalculated.job_sheet_pdf = job_sheet_pdf_url;
    recalculated.cost_sheet_pdf = cost_sheet_pdf_url;

    // Save inside sandboxed qty_update field
    bomObj.qty_update.recalculated_data = recalculated;
    bomObj.qty_update.new_qty = Number(newQtyVal);

    // Keep all primary fields completely untouched (do not modify bomObj.job_quantity or primary specs)

    bomObj.markModified("qty_update");
    await bomObj.save();

    console.log(`[triggerBOMRecalculationForPendingQty] Successfully sandboxed all recalculated costs for BOM ${bomObj.id}`);
    return bomObj;
  } catch (err) {
    console.error("[triggerBOMRecalculationForPendingQty] Error during recalculation:", err);
    throw err;
  }
};

/**
 * Controller endpoint to handle role-based approval (Admin/Client) of a sandboxed quantity change.
 * Once all approval gates are satisfied, it overwrites primary BOM fields and cascades to DTP, Shopfloor, and SO.
 */
export const approveBOMQtyUpdate = async (req, res) => {
  try {
    const { id } = req.params; // BOM ID
    const { role, action } = req.body; // role: "admin" or "client", action: "approve" or "reject"
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const bomObj = await bomModel.findOne({ id });
    if (!bomObj) {
      return res.status(404).json({ success: false, message: "BOM not found" });
    }

    if (!bomObj.qty_update || bomObj.qty_update.status !== "pending") {
      return res.status(400).json({ success: false, message: "No pending quantity update found for this BOM" });
    }

    if (action === "reject") {
      const remarksText = req.body.remarks || "";

      bomObj.qty_update.status = "rejected";
      bomObj.qty_update.remarks = remarksText.trim();
      bomObj.qty_update.is_admin_approved = false;
      bomObj.qty_update.is_client_approved = false;

      bomObj.markModified("qty_update");
      await bomObj.save();

      // Reset pending flag on Sales Order and store rejection remarks in edit_remarks & bom_history
      if (bomObj.sales_order_nanoid || bomObj.sales_order_id) {
        const soQuery = bomObj.sales_order_nanoid ? { id: bomObj.sales_order_nanoid } : { _id: bomObj.sales_order_id };
        const remarksText = req.body.remarks || "";

        const actorUser = req.user || (userId && userId !== "client-gate-public-portal" ? await userModel.findById(userId).select("name role") : null);
        const isClientPortal = !actorUser || actorUser._id === "client-gate-public-portal";

        const updateDataObj = {
          $set: { is_qty_pending_approval: false },
          $push: {
            bom_history: {
              action: "Reprocess Rejected",
              action_by_type: isClientPortal ? "Client" : "Internal User",
              action_by_user: isClientPortal ? null : actorUser?._id,
              action_by_name: isClientPortal ? "Client" : (actorUser?.name || "System"),
              action_by_role: isClientPortal ? "Client" : (actorUser?.role || "System"),
              remarks: remarksText.trim() || "Quantity Revision Rejected",
              date_time: getCurrentDate(),
              before_qty: bomObj.qty_update.old_qty,
              after_qty: bomObj.qty_update.new_qty,
              file_url: bomObj.qty_update?.recalculated_data?.quotation_pdf || null
            }
          }
        };

        if (remarksText.trim()) {
          updateDataObj.$push.edit_remarks = {
            remark: `Quantity Revision Rejected: ${remarksText.trim()}`,
            edited_by: userId === "client-gate-public-portal" ? null : userId,
            edited_at: getCurrentDate(),
            field_changes: [
              {
                field: "Quantity Revision Status",
                before: "Pending Approval",
                after: "Rejected"
              }
            ]
          };
        }

        await salesorderlistModel.findOneAndUpdate(soQuery, updateDataObj);
      }

      return res.status(200).json({
        success: true,
        message: "Quantity update request rejected and cleared successfully.",
        data: bomObj
      });
    }

    if (action === "approve") {
      if (role === "admin") {
        bomObj.qty_update.is_admin_approved = true;
      } else if (role === "client") {
        bomObj.qty_update.is_client_approved = true;
      } else {
        // If no explicit role, default to admin
        bomObj.qty_update.is_admin_approved = true;
      }

      // Check if both admin and client have approved
      const shouldCommit = bomObj.qty_update.is_admin_approved && bomObj.qty_update.is_client_approved;

      bomObj.markModified("qty_update");
      await bomObj.save();

      // Always push to bom_history when anyone approves
      if (bomObj.sales_order_nanoid || bomObj.sales_order_id) {
        const soQuery = bomObj.sales_order_nanoid ? { id: bomObj.sales_order_nanoid } : { _id: bomObj.sales_order_id };
        const actorUser = req.user || (userId && userId !== "client-gate-public-portal" ? await userModel.findById(userId).select("name role") : null);

        const isClientPortal = !actorUser || actorUser._id === "client-gate-public-portal";

        const updateData = {
          $push: {
            bom_history: {
              action: "Reprocess Approved",
              action_by_type: isClientPortal ? "Client" : "Internal User",
              action_by_user: isClientPortal ? null : actorUser._id,
              action_by_name: isClientPortal ? "Client" : (actorUser.name || "Client"),
              action_by_role: isClientPortal ? "Client" : (actorUser.role || "Client"),
              remarks: req.body.remarks || `${role === "admin" ? "Admin" : "Client"} approved quantity revision`,
              date_time: getCurrentDate(),
              before_qty: bomObj.qty_update.old_qty,
              after_qty: bomObj.qty_update.new_qty,
              file_url: bomObj.qty_update?.recalculated_data?.quotation_pdf || null
            }
          }
        };

        if (shouldCommit) {
          updateData.$set = { is_reprocessed_approved: true };
        }

        await salesorderlistModel.findOneAndUpdate(soQuery, updateData);
      }

      if (shouldCommit) {
        // Defer the cascade commit to the Proceed button on Sales dashboard.
        bomObj.qty_update.status = "approved";
        bomObj.markModified("qty_update");
        await bomObj.save();

        console.log(`[approveBOMQtyUpdate] DEFERRED sandboxed quantity update for BOM ${bomObj.id} to Proceed button. status set to approved.`);

        return res.status(200).json({
          success: true,
          message: "Quantity update approved by both parties. Status is now verified! Click Proceed on the Sales dashboard to finalize changes.",
          data: bomObj,
          committed: false
        });
      }

      return res.status(200).json({
        success: true,
        message: `Quantity update approved by ${role}. Waiting for remaining approvals before active cascade.`,
        data: bomObj,
        committed: false
      });
    }

    return res.status(400).json({ success: false, message: "Invalid action specified." });
  } catch (err) {
    console.error("[approveBOMQtyUpdate] Error:", err);
    res.status(500).json({ success: false, message: "Error approving quantity update", error: err.message });
  }
};
