import mongoose from "mongoose";
import rfqModel from "../../models/rfq/rfqModel.js";
import salesOrderModel from "../../models/sales_orders/sales_order_list_Model.js";
import sales_order_form_Model from "../../models/sales_orders/sales_order_form_Model.js";
import bomModel from "../../models/bom/bomModel.js";
import itemModel from "../../models/inventory/item/itemModel.js";
import customItemModel from "../../models/inventory/customItem/customItemModel.js";
import vendorModel from "../../models/masters/vendorModel.js";
import materialPurchaseRequestModel from "../../models/store/materialPurchaseRequestModel.js";
import vendorBillModel from "../../models/accounts/vendorBillModel.js";
import { nanoid } from "nanoid";
import {
  uploadToR2,
  generateSignedUrl,
  deleteFromR2,
} from "../../helpers/r2helper.js";
import serviceCategoryModel from "../../models/masters/common/serviceCategoryModel.js";
import materialTypeModel from "../../models/inventory/common/materialTypeModel.js";
import materialCategoryModel from "../../models/inventory/common/materialCategoryModel.js";
import { transporter, generateEmailTemplateForRFQ, generateEmailTemplateForPO } from "../../helpers/mail.js";
import enquiryModel from "../../models/enquiry/enquiryModel.js";
import fetch from "node-fetch";

const getNextRfqUid = async (prefix = "RFQ-") => {
  const lastRfq = await rfqModel
    .findOne({ uid: new RegExp(`^${prefix}`) })
    .sort({ uid: -1 });
  if (!lastRfq) return `${prefix}00001`;
  const lastNum = parseInt(lastRfq.uid.replace(prefix, ""), 10);
  return `${prefix}${(lastNum + 1).toString().padStart(5, "0")}`;
};

// Get all RFQs
export const getAllRFQs = async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    const isAdmin = req.user?.role.toLowerCase() === "admin executive";
    const isHead = req.user?.is_head || false;
    const isPurchase = req.user?.role?.toLowerCase().includes("purchase");

    const filterCreator = req.query.creatorId;

    if (isPurchase && !isAdmin && !isHead) {
      query.createdBy = req.user?._id;
    } else if (filterCreator) {
      query.createdBy = filterCreator;
    }


    const rfqs = await rfqModel
      .find(query)
      .sort({ createdAt: -1 })
      .populate({
        path: "selectedVendors",
        select: "name mobile_no email service_category",
      })
      .populate("category_id")
      .lean();

    // Fetch all material categories to resolve naming on the fly for existing items
    const materialCats = await materialCategoryModel.find().select('_id name').lean();

    // Fetch corresponding SalesOrders to get is_on_hold status and Enquiries for fallback reference_no
    const subJobNos = rfqs.map(r => r.subJobNo).filter(Boolean);
    const jobNos = rfqs.map(r => r.jobNo).filter(Boolean);

    // Derive main job numbers from subJobNos (e.g. RD21031a -> RD21031)
    const derivedJobNos = subJobNos.map(s => s.replace(/[a-zA-Z]$/, ''));
    const allSearchJobNos = [...new Set([...jobNos, ...derivedJobNos])];

    const [salesOrders, enquiries] = await Promise.all([
      salesOrderModel.find({ sub_job_no: { $in: subJobNos } }, 'sub_job_no is_on_hold').lean(),
      enquiryModel.find({ job_no: { $in: allSearchJobNos } }, 'job_no reference_no').lean()
    ]);

    const holdMap = {};
    for (const s of salesOrders) {
      holdMap[s.sub_job_no] = s.is_on_hold || false;
    }

    const enqMap = {};
    for (const e of enquiries) {
      enqMap[e.job_no] = e.reference_no;
    }

    let formattedData = rfqs.map((r) => {
      let resolvedCategoryId = r.category_id;

      // If category_id is missing but category name exists, try to find a match
      if (!resolvedCategoryId && r.category) {
        const match = materialCats.find(c => c.name.toLowerCase() === r.category.toLowerCase());
        if (match) resolvedCategoryId = match;
      }

      const obj = {
        ...r,
        category_id: resolvedCategoryId,
        image: r.image ? generateSignedUrl(r.image) : null,
        is_on_hold: holdMap[r.subJobNo] || false
      };

      // Fallback for reference_no
      if (!obj.reference_no) {
        const directMatch = obj.jobNo ? enqMap[obj.jobNo] : null;
        const derivedJobNo = obj.subJobNo ? obj.subJobNo.replace(/[a-zA-Z]$/, '') : null;
        const subMatch = derivedJobNo ? enqMap[derivedJobNo] : null;
        obj.reference_no = directMatch || subMatch || "";
      }

      return obj;
    });

    // In-memory search if provided
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      formattedData = formattedData.filter(item =>
        searchRegex.test(item.uid) ||
        searchRegex.test(item.jobNo) ||
        searchRegex.test(item.subJobNo) ||
        searchRegex.test(item.reference_no) ||
        searchRegex.test(item.client) ||
        searchRegex.test(item.name)
      );
    }

    return res.status(200).json({ success: true, data: formattedData });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Create new RFQ
export const createRFQ = async (req, res) => {
  try {
    const {
      uid,
      jobNo,
      subJobNo,
      client,
      name,
      specs,
      qty,
      deadline,
      deliveryDate,
      deliveryTime,
      image,
      aiBaseRate,
      logicalRate,
      category,
      category_id,
      subcategory,
      material_category_id,
      material_type_id,
      vendorName,
      source,
      packingBufferVal,
      packingBufferPrc,
      packingFinalQty,
      sales_order_nanoid,
      is_custom_item,
      item_id
    } = req.body;

    // Resolve category_id if missing or invalid but name is present
    let finalCategoryId = null;
    if (category_id && mongoose.Types.ObjectId.isValid(category_id)) {
      finalCategoryId = category_id;
    }

    if (!finalCategoryId && category && category !== "CUSTOM" && category !== "null" && category !== "undefined") {
      const [mCat, sCat] = await Promise.all([
        materialCategoryModel.findOne({ name: { $regex: new RegExp(`^${category}$`, 'i') } }).select('_id').lean(),
        serviceCategoryModel.findOne({ name: { $regex: new RegExp(`^${category}$`, 'i') } }).select('_id').lean()
      ]);
      if (mCat) finalCategoryId = mCat._id;
      else if (sCat) finalCategoryId = sCat._id;
    }

    // Generate Sequential UID
    let finalUid = uid;
    if (uid === "AUTO_RFQ") {
      finalUid = await getNextRfqUid("RFQBULK-");
    } else if (uid === "AUTO_CUST") {
      finalUid = await getNextRfqUid("RFQCUST-");
    } else if (uid === "AUTO_AI") {
      finalUid = await getNextRfqUid("RFQPACK-");
    } else if (uid === "AUTO_STORE") {
      finalUid = await getNextRfqUid("RFQSTORE-");
    }

    let imageUrl = image;
    let path = `${category || "general"}/${subcategory || "uncategorized"}/${jobNo || "manual"
      }/${subJobNo || "entry"}/rfq`;

    if (
      uid === "AUTO_CUST" ||
      (finalUid && finalUid.startsWith("RQFCUST-")) ||
      jobNo === "CUSTOM"
    ) {
      path = `customrfq/${finalUid}`;
    } else if (
      uid === "AUTO_STORE" ||
      (finalUid && finalUid.startsWith("RFQSTORE-"))
    ) {
      path = `storerfq/${jobNo}/${finalUid}`;
    }

    if (req.file) {
      imageUrl = await uploadToR2(
        path,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );
    } else if (image && image.startsWith("data:image")) {
      const base64Data = image.split(",")[1];
      const buffer = Buffer.from(base64Data, "base64");
      imageUrl = await uploadToR2(
        path,
        buffer,
        `rfq_${finalUid}.png`,
        "image/png"
      );
    }

    let foundItemId = item_id || null;
    if (!foundItemId && name) {
      const escapedName = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matchedItem = await itemModel.findOne({ name: { $regex: new RegExp(`^${escapedName}$`, 'i') } }).select('_id').lean();
      if (matchedItem) foundItemId = matchedItem._id;
    }

    let reference_no = '';
    if (jobNo && jobNo !== 'CUSTOM') {
      const enq = await enquiryModel.findOne({ job_no: jobNo }).select('reference_no').lean();
      if (enq) reference_no = enq.reference_no;
    }

    const newRFQ = new rfqModel({
      uid: finalUid,
      jobNo,
      subJobNo,
      reference_no: reference_no,
      client,
      item_id: foundItemId,
      is_custom_item: is_custom_item === "true" || is_custom_item === true,
      name,
      specs,
      qty,
      deadline,
      deliveryDate,
      deliveryTime,
      image: imageUrl,
      aiBaseRate,
      logicalRate:
        (typeof logicalRate === "string"
          ? JSON.parse(logicalRate)
          : logicalRate) || [],
      category,
      category_id: finalCategoryId,
      material_category_id: material_category_id && (mongoose.Types.ObjectId.isValid(material_category_id) || typeof material_category_id === 'string') ? material_category_id : null,
      material_type_id: material_type_id && (mongoose.Types.ObjectId.isValid(material_type_id) || typeof material_type_id === 'string') ? material_type_id : null,
      subcategory,
      vendorName: vendorName || null,
      source: source || null,
      packingBufferVal: packingBufferVal || null,
      packingBufferPrc: packingBufferPrc || null,
      packingFinalQty: packingFinalQty || null,
      createdBy: req.user._id,
      sales_order_nanoid: sales_order_nanoid || null,
    });
    await newRFQ.save();
    const data = await rfqModel.findById(newRFQ._id).lean();
    if (data.image) data.image = generateSignedUrl(data.image);
    return res
      .status(201)
      .json({ success: true, message: "RFQ Created", data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Update RFQ (General update for stage, vendors, quotes, awards)
export const updateRFQ = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    const existing = await rfqModel.findById(id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "RFQ not found" });
    }

    // ── Concurrency Guard for stage transitions ─────────────────────────
    // Prevents stale actions: if client sends a stage change but the DB
    // stage has already moved past the expected state, reject the update.
    if (updates.stage) {
      const currentRfq = existing;
      if (currentRfq) {
        const STAGE_ORDER = [
          "1. Draft RFQ", "2. Assign Vendors", "3. Review (Negotiate)",
          "4. PO Awarded", "5. In Process", "6. Delivery"
        ];
        const currentIdx = STAGE_ORDER.indexOf(currentRfq.stage);
        const requestedIdx = STAGE_ORDER.indexOf(updates.stage);

        // Block forward duplicate: e.g. trying to award PO when already in process
        if (currentIdx >= 0 && requestedIdx >= 0 && requestedIdx <= currentIdx && requestedIdx !== 0) {
          // Exception: Allow rollback to Draft (index 0) — that's intentional
          return res.status(409).json({
            success: false,
            message: `This RFQ has already progressed to "${currentRfq.stage}". Another user may have updated it. Please refresh the page to see the latest data.`,
            staleAction: true
          });
        }
      }
    }

    // Handle Image Upload if providing file or base64
    if (req.file || (updates.image && updates.image.startsWith("data:image"))) {

      // Delete old image if it exists
      if (existing && existing.image) {
        console.log("Deleting old image from R2:", existing.image);
        try {
          await deleteFromR2(existing.image);
        } catch (err) {
          console.error("Error deleting old image from R2:", err);
        }
      }

      // We need metadata for the path. Let's try to get it from existing or body
      const jobNo = updates.jobNo || existing?.jobNo || "manual";
      const subJobNo = updates.subJobNo || existing?.subJobNo || "entry";
      const cat = updates.category || existing?.category || "general";
      const subcat =
        updates.subcategory || existing?.subcategory || "uncategorized";
      const uid = updates.uid || existing?.uid || "";

      let path = `${cat}/${subcat}/${jobNo}/${subJobNo}/rfq`;
      if (uid.startsWith("RQFCUST-") || jobNo === "CUSTOM") {
        path = `customrfq/${uid}`;
      } else if (uid.startsWith("RFQSTORE-")) {
        path = `storerfq/${jobNo}/${uid}`;
      }

      if (req.file) {
        updates.image = await uploadToR2(
          path,
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype
        );
      } else if (updates.image && updates.image.startsWith("data:image")) {
        const base64Data = updates.image.split(",")[1];
        const buffer = Buffer.from(base64Data, "base64");
        updates.image = await uploadToR2(
          path,
          buffer,
          `${id}.png`,
          "image/png"
        );
      }
    }

    // Sync deadline with deliveryDate if provided
    if (updates.deliveryDate) {
      updates.deadline = updates.deliveryDate;
    }

    // Prevent Mongoose from crashing on empty date strings
    if (updates.deadline === "") updates.deadline = null;
    if (updates.deliveryDate === "") updates.deliveryDate = null;
    if (updates.deliveryTime === "") updates.deliveryTime = null;

    try {
      // Manage unique PO number generation dynamically
      if (updates.awards && Array.isArray(updates.awards)) {
        let maxLocal = null;
        for (const aw of updates.awards) {
          if (!aw.poNumber) {
            if (maxLocal === null) {
              const allRfqs = await rfqModel.find({ "awards.poNumber": { $exists: true } }, { "awards.poNumber": 1 }).lean();
              let dbMax = 0;
              allRfqs.forEach(r => {
                (r.awards || []).forEach(a => {
                  if (a.poNumber && a.poNumber.startsWith('PO-')) {
                    const num = parseInt(a.poNumber.replace('PO-', ''), 10);
                    if (!isNaN(num) && num > dbMax) {
                      dbMax = num;
                    }
                  }
                });
              });
              maxLocal = dbMax;
            }
            maxLocal++;
            aw.poNumber = `PO-${String(maxLocal).padStart(5, '0')}`;

            // Initialize baselines from the Sales Requirements specifically for Job Qty
            let baselineJobQty = 0;
            try {
              const soform = await sales_order_form_Model.findOne({
                job_no: existing?.jobNo || updates.jobNo,
                sub_job_no: existing?.subJobNo || updates.subJobNo
              }).select('job_quantity').lean();
              baselineJobQty = soform?.job_quantity || 0;
            } catch (err) {
              console.error(err);
            }

            aw.currentJobQty = baselineJobQty;
            aw.current_delivery_date = existing?.deliveryDate || updates.deliveryDate;
            aw.current_job_completion_date = existing?.deadline || updates.deadline;
          }
        }
      }

      const updatedRFQ = await rfqModel
        .findByIdAndUpdate(id, updates, { new: true })
        .lean();
      if (!updatedRFQ)
        return res
          .status(404)
          .json({ success: false, message: "RFQ not found" });
      if (updatedRFQ.image)
        updatedRFQ.image = generateSignedUrl(updatedRFQ.image);
      return res
        .status(200)
        .json({ success: true, message: "RFQ Updated", data: updatedRFQ });
    } catch (dbError) {
      console.error("Database Update Error:", dbError);
      return res.status(400).json({ success: false, message: dbError.message });
    }
  } catch (error) {
    console.error("Update RFQ General Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Fetch the latest generated PO number dynamically
export const getNextPoNumber = async (req, res) => {
  try {
    const allRfqs = await rfqModel.find({ "awards.poNumber": { $exists: true } }, { "awards.poNumber": 1 }).lean();
    let dbMax = 0;
    allRfqs.forEach(r => {
      (r.awards || []).forEach(a => {
        if (a.poNumber && a.poNumber.startsWith('PO-')) {
          const num = parseInt(a.poNumber.replace('PO-', ''), 10);
          if (!isNaN(num) && num > dbMax) {
            dbMax = num;
          }
        }
      });
    });
    return res.status(200).json({ success: true, maxPo: dbMax });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// Get Vendors (filtered by material category_id or category_name string, optionally search by name/mobile)
export const getVendorsByMaterial = async (req, res) => {
  try {
    const { search, category_id, category_name, material_category_id, material_type_id, recommended_vendor } = req.query;
    let query = { is_active: true };

    let resolvedMaterialCatId = null;
    let resolvedMaterialTypeId = null;

    if (material_category_id) {
      if (mongoose.Types.ObjectId.isValid(material_category_id)) {
        resolvedMaterialCatId = new mongoose.Types.ObjectId(material_category_id);
      } else {
        const mCat = await materialCategoryModel.findOne({ name: { $regex: new RegExp(`^${material_category_id}$`, 'i') } }).select('_id').lean();
        if (mCat) resolvedMaterialCatId = mCat._id;
      }
    }
    if (material_type_id) {
      if (mongoose.Types.ObjectId.isValid(material_type_id)) {
        resolvedMaterialTypeId = new mongoose.Types.ObjectId(material_type_id);
      } else {
        const mType = await materialTypeModel.findOne({ name: { $regex: new RegExp(`^${material_type_id}$`, 'i') } }).select('_id').lean();
        if (mType) resolvedMaterialTypeId = mType._id;
      }
    }

    // Fallback if no specific material_category_id was provided
    if (!resolvedMaterialCatId) {
      if (category_id && mongoose.Types.ObjectId.isValid(category_id)) {
        resolvedMaterialCatId = new mongoose.Types.ObjectId(category_id);
      }
      if (category_name) {
        const mCat = await materialCategoryModel.findOne({ name: { $regex: new RegExp(`^${category_name}$`, 'i') } }).select('_id').lean();
        if (mCat) resolvedMaterialCatId = mCat._id;
      }
    }

    // 2. Build Category Filter (Match either Material OR Service category)
    const catConditions = [];
    if (resolvedMaterialCatId) catConditions.push({ material_categories: resolvedMaterialCatId });
    // Incorporate material_type matching if we have resolved it
    if (resolvedMaterialTypeId) catConditions.push({ material_types: resolvedMaterialTypeId });

    if (catConditions.length > 0) {
      query.$or = catConditions;
    }
    // We intentionally ignore the `else if (category_id || category_name)` returning empty array, 
    // because user explicitly requested: "when no vendor match, display all vendor"

    // 3. Handle Search (Name or Mobile)
    if (search) {
      const searchRegex = new RegExp(search, "i");
      const searchOr = [
        { name: searchRegex },
        {
          $expr: {
            $regexMatch: {
              input: { $toString: "$mobile_no" },
              regex: search,
              options: "i",
            },
          },
        },
      ];

      if (query.$or) {
        // Intersect Category filter and Search filter
        const prevOr = query.$or;
        delete query.$or;
        query.$and = [
          { $or: prevOr },
          { $or: searchOr }
        ];
      } else {
        query.$or = searchOr;
      }
    }

    // 4. Initial Fetch (Try to find specific matches)
    let vendorsRaw = await vendorModel
      .find(query)
      .select("_id name mobile_no email material_categories material_types")
      .populate({ path: "material_categories", select: "name" })
      .populate({ path: "material_types", select: "name" })
      .sort({ name: 1 })
      .lean();

    // 5. Fallback: If no vendors match categories OR a specific recommended vendor is requested, show all active vendors
    if (vendorsRaw.length === 0 || recommended_vendor) {
      const fallbackQuery = { is_active: true };
      if (search) {
        const searchRegex = new RegExp(search, "i");
        fallbackQuery.$or = [
          { name: searchRegex },
          {
            $expr: {
              $regexMatch: {
                input: { $toString: "$mobile_no" },
                regex: search,
                options: "i",
              },
            },
          },
        ];
      }

      vendorsRaw = await vendorModel
        .find(fallbackQuery)
        .select("_id name mobile_no email material_categories material_types")
        .populate({ path: "material_categories", select: "name" })
        .populate({ path: "material_types", select: "name" })
        .sort({ name: 1 })
        .lean();
    }

    // 6. Final Processing: Control Badge visibility in the backend itself
    // 6. Final Processing: Control Badge visibility and Match/Recommended flags
    const finalVendors = vendorsRaw.map(v => {
      // 1. Check Category Match
      const mMatch = resolvedMaterialCatId && v.material_categories?.some(mc => mc._id.toString() === resolvedMaterialCatId.toString());
      const tMatch = resolvedMaterialTypeId && v.material_types?.some(mt => mt._id.toString() === resolvedMaterialTypeId.toString());

      // 2. Check Recommendation Match (by Name)
      const isRecommended = recommended_vendor && v.name?.toLowerCase().trim() === recommended_vendor.toLowerCase().trim();

      return {
        ...v,
        isMatched: !!(mMatch || tMatch),
        isRecommended: !!isRecommended,
        // The user wants categories visible all the time, so we just return the entities
        material_categories: v.material_categories,
        material_types: v.material_types
      };
    });

    return res.status(200).json({ success: true, data: finalVendors });
  } catch (error) {
    console.error("Error in getVendorsByMaterial:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Broadcast RFQ to selected vendors — generates a unique per-vendor token + link and sends emails
export const broadcastRFQ = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      vendorIds,
      deliveryDate,
      deliveryTime,
      isSplit,
      schedule,
      linksDuration,
      remarks,
    } = req.body;

    const rfq = await rfqModel.findById(id);
    if (!rfq)
      return res.status(404).json({ success: false, message: "RFQ not found" });

    // ── Concurrency Guard ─────────────────────────────────────────────────
    // If another admin already broadcast this RFQ, reject the duplicate action
    if (rfq.stage !== "1. Draft RFQ") {
      return res.status(409).json({
        success: false,
        message: `This RFQ has already been broadcast and moved to "${rfq.stage}". Please refresh the page to see the latest data.`,
        staleAction: true
      });
    }

    // Fetch vendors to get their name & email
    const vendors = await vendorModel.find({ _id: { $in: vendorIds } }).lean();

    // Build a per-vendor token map. Reuse existing token if vendor was already in a previous broadcast.
    const existingTokenMap = {};
    (rfq.vendorTokens || []).forEach(vt => {
      existingTokenMap[vt.vendorId?.toString()] = vt.token;
    });

    const vendorTokens = vendors.map(v => ({
      vendorId: v._id,
      vendorName: v.name,
      token: existingTokenMap[v._id.toString()] || nanoid(32),
    }));

    await rfqModel.findByIdAndUpdate(id, {
      selectedVendors: vendorIds,
      vendorTokens,
      broadcastSentAt: new Date(),
      stage: "2. Assign Vendors",
      deliveryDate: deliveryDate || rfq.deliveryDate,
      deliveryTime: deliveryTime || rfq.deliveryTime,
      deadline: deliveryDate || rfq.deadline,
      isSplit: isSplit ?? rfq.isSplit,
      deliverySchedule: schedule || rfq.deliverySchedule,
      linksDuration: linksDuration || rfq.linksDuration,
      remarks: remarks || "",
    });

    const frontendBase = process.env.CLIENT_CONFIRMATION_SCREEN_URL || "http://localhost:5173";

    // Build an rfq-like object with the UPDATED delivery details for the email
    const rfqForEmail = {
      ...rfq.toObject(),
      deliveryDate: deliveryDate || rfq.deliveryDate,
      deliveryTime: deliveryTime || rfq.deliveryTime,
      isSplit: isSplit ?? rfq.isSplit,
      deliverySchedule: schedule || rfq.deliverySchedule,
      linksDuration: linksDuration || rfq.linksDuration,
      remarks: remarks || rfq.remarks,
    };

    const { sendEmail = true, sendWhatsapp = false } = req.body;

    // Build mail promises if email is selected
    let mailPromises = [];
    if (sendEmail) {
      mailPromises = vendorTokens.map((vt) => {
        const vendor = vendors.find(v => v._id.toString() === vt.vendorId.toString());
        if (!vendor?.email) {
          console.warn(`Vendor ${vt.vendorName} has no email address. Skipping email.`);
          return Promise.resolve();
        }

        const vendorQuoteLink = `${frontendBase}/vendor-quote/${id}/${vt.token}`;
        const emailHtml = generateEmailTemplateForRFQ(rfqForEmail, vendor, vendorQuoteLink);

        return transporter.sendMail({
          from: `RD Custom Awards <${process.env.EMAIL_SENDER}>`,
          to: vendor.email,
          subject: `Request for Quotation: ${rfq.name} - RD Custom Awards`,
          html: emailHtml,
        });
      });
    }

    // Build WhatsApp bulk payload if whatsapp is selected
    if (sendWhatsapp) {
      const broadcastWhatsAppNumbers = [];
      vendorTokens.forEach((vt) => {
        const vendor = vendors.find(v => v._id.toString() === vt.vendorId.toString());
        if (vendor && vendor.mobile_no) {
          let phone = String(vendor.mobile_no).trim().replace(/\D/g, "");
          if (phone.length === 10) phone = "91" + phone;

          const quoteLink = `${frontendBase}/vendor-quote/${id}/${vt.token}`;

          const deliveryDateFormatted = rfqForEmail.deliveryDate && !isNaN(new Date(rfqForEmail.deliveryDate))
            ? new Date(rfqForEmail.deliveryDate).toLocaleDateString("en-GB")
            : "TBD";

          const cleanSpecs = (rfqForEmail.specs || "N/A").replace(/<[^>]*>?/gm, '').trim() || "N/A";
          const rawRemarks = (rfqForEmail.remarks || "").replace(/<[^>]*>?/gm, '').trim();
          const cleanRemarks = rawRemarks.length > 0 ? rawRemarks : "No Remarks";

          const expiryTimestamp = Date.now() + (rfqForEmail.linksDuration || 48) * 60 * 60 * 1000;
          const expiryDateFormatted = new Date(expiryTimestamp).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
          });

          broadcastWhatsAppNumbers.push({
            receiver: phone,
            values: {
              "1": vendor.name || "Vendor",
              "2": rfqForEmail.name || "N/A",
              "3": String(rfqForEmail.qty || 0),
              "4": cleanSpecs.substring(0, 500),
              "5": deliveryDateFormatted,
              "6": cleanRemarks.substring(0, 500),
              "7": quoteLink,
              "8": expiryDateFormatted
            }
          });
        }
      });

      if (broadcastWhatsAppNumbers.length > 0) {
        const bulkPayload = {
          type: "multiple",
          numbers: broadcastWhatsAppNumbers
        };
        const url = process.env.TWOFACTOR_WHATSAPP_RFQ_REQUEST_VENDORS_URL;
        const apiKey = process.env.TWOFACTOR_WHATSAPP_API_KEY;

        fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify(bulkPayload),
        })
          .then(res => res.json())
          .then(data => console.log("Broadcast WA sent", data))
          .catch(err => console.error("Broadcast WA error", err));
      }
    }

    try {
      if (mailPromises.length > 0) await Promise.allSettled(mailPromises);
    } catch (mailError) {
      console.error("Error sending RFQ emails:", mailError);
    }

    // Return the first vendor's link as a sample (for display in the UI)
    const sampleLink = vendorTokens.length > 0
      ? `${frontendBase}/vendor-quote/${id}/${vendorTokens[0].token}`
      : null;

    return res.status(200).json({ success: true, data: { quoteLink: sampleLink, vendorTokens } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Public: Get RFQ details for vendor to view (by per-vendor token) — no auth required
export const getVendorRFQView = async (req, res) => {
  try {
    const { id, token } = req.params;
    const rfq = await rfqModel.findById(id).lean();

    if (!rfq) {
      return res.status(404).json({ success: false, message: "Invalid link" });
    }

    // Resolve vendor identity from per-vendor token — this is the authoritative check
    const vendorEntry = (rfq.vendorTokens || []).find(vt => vt.token === token);
    if (!vendorEntry) {
      return res.status(404).json({ success: false, message: "Invalid link" });
    }
    const vendorName = vendorEntry.vendorName;

    // Server-side Expiry Check
    const broadcastTime = rfq.broadcastSentAt
      ? new Date(rfq.broadcastSentAt).getTime()
      : 0;
    const durationMs = (rfq.linksDuration || 48) * 60 * 60 * 1000;
    if (broadcastTime > 0 && Date.now() > broadcastTime + durationMs) {
      return res
        .status(403)
        .json({ success: false, message: "This link has expired." });
    }

    // Check if this vendor has already submitted a quote
    const existingQuote = rfq.quotes.find((q) => q.vendorName === vendorName);
    const alreadySubmitted = !!existingQuote;

    const safeRfq = {
      _id: rfq._id,
      uid: rfq.uid,
      name: rfq.name,
      specs: rfq.specs,
      qty: rfq.qty,
      deadline: rfq.deadline,
      deliveryDate: rfq.deliveryDate,
      deliveryTime: rfq.deliveryTime,
      isSplit: rfq.isSplit,
      deliverySchedule: rfq.deliverySchedule,
      linksDuration: rfq.linksDuration,
      aiBaseRate: rfq.aiBaseRate,
      logicalRate: rfq.logicalRate || [],
      image: rfq.image ? generateSignedUrl(rfq.image) : null,
      jobNo: rfq.jobNo,
      subJobNo: rfq.subJobNo,
      client: rfq.client,
      remarks: rfq.remarks,
      // Vendor identity is supplied by the server — client cannot override this
      vendorName,
      alreadySubmitted,
      existingQuote: alreadySubmitted ? {
        rate: existingQuote.rate,
        delDays: existingQuote.delDays,
        delDate: existingQuote.delDate,
        scheduleResponses: existingQuote.scheduleResponses || [],
        isScheduleConfirmed: existingQuote.isScheduleConfirmed || false,
      } : null,
    };
    return res.status(200).json({ success: true, data: safeRfq });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Public: Vendor submits a quote (rate + delivery days) via per-vendor token link
export const submitVendorQuote = async (req, res) => {
  try {
    const { id, token } = req.params;
    const { rate, delDays } = req.body;

    const rfq = await rfqModel.findById(id);
    if (!rfq) {
      return res
        .status(404)
        .json({ success: false, message: "Invalid or expired link" });
    }

    // Resolve vendor identity from per-vendor token — ignore any name sent in request body
    const vendorEntry = (rfq.vendorTokens || []).find(vt => vt.token === token);
    if (!vendorEntry) {
      return res
        .status(404)
        .json({ success: false, message: "Invalid or expired link" });
    }
    const vendorName = vendorEntry.vendorName; // server-authoritative, cannot be spoofed

    // Replace any existing quote from this vendor and push the new one
    rfq.quotes = rfq.quotes.filter((q) => q.vendorName !== vendorName);
    rfq.quotes.push({
      vendorName,
      rate: Number(rate),
      delDays: Number(delDays),
      delDate: req.body.delDate ? new Date(req.body.delDate) : null,
      isScheduleConfirmed: !!req.body.isScheduleConfirmed,
      scheduleResponses: req.body.scheduleResponses || [],
      receivedAt: new Date(),
    });

    await rfq.save();

    return res
      .status(200)
      .json({ success: true, message: "Quote submitted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 1. Get Unique Job Numbers — only jobs with at least one un-RFQ'd material
export const getAvailableJobNos = async (req, res) => {
  try {
    const jobs = await salesOrderModel
      .find({ is_pushed_shop_floor: true })
      .populate({
        path: "bom_id",
        select: "material_specification items",
        populate: {
          path: "items.subCategoryId",
          model: "item",
          select: "name stock min_stock",
        },
      })
      .populate({
        path: "blocked_materials",
        select: "materialId status",
      })
      .select("job_no sub_job_no _id blocked_materials is_on_hold")
      .lean();

    // All RFQs (active + completed) to check if a material is already covered
    const allRfqs = await rfqModel
      .find({})
      .select("jobNo subJobNo name")
      .lean();

    const orderIds = jobs.map((j) => j._id);
    const forms = await sales_order_form_Model
      .find({ sample__order_id: { $in: orderIds } })
      .select("sample__order_id client_name")
      .lean();

    const map = new Map();

    // Group sub-jobs under their parent job_no
    const jobsByJobNo = jobs.reduce((acc, job) => {
      if (!acc[job.job_no]) acc[job.job_no] = [];
      acc[job.job_no].push(job);
      return acc;
    }, {});

    for (const [jobNo, jobList] of Object.entries(jobsByJobNo)) {
      // Job appears if ANY sub-job has at least one material that is:
      // 1. Not yet covered by an RFQ
      // 2. Not blocked/allocated
      const jobHasPending = jobList.some((job) => {
        const materials = [
          ...(job.bom_id?.material_specification || []),
          ...(job.bom_id?.packingdatas || [])
            .filter(p =>
              p.name?.toUpperCase() !== 'PACKING LABOUR' &&
              (!p.logicalRate || p.logicalRate.length === 0)
            )
            .map(p => ({
              material_name: p.name,
              material_type: p.itemType,
              item_id: p.itemId?.toString()
            }))
        ];
        const blockedMaterialIds = new Set(
          (job.blocked_materials || [])
            .filter((bm) => bm.status === "blocked" || bm.status === "consumed")
            .map((bm) => bm.materialId)
        );

        return materials.some((ms) => {
          const matName = ms.material_name || ms.material_type;
          const matId = ms.item_id; // nanoid used for blocking

          // Check if blocked
          if (matId && blockedMaterialIds.has(matId)) return false;

          // Check if RFQ already exists for job+subjob+name
          const alreadyCovered = allRfqs.some(
            (r) =>
              r.jobNo === job.job_no &&
              r.subJobNo === job.sub_job_no &&
              r.name === matName
          );
          return !alreadyCovered;
        });
      });

      if (jobHasPending && !map.has(jobNo)) {
        const firstJob = jobList[0];
        const form = forms.find(
          (f) => f.sample__order_id?.toString() === firstJob._id.toString()
        );
        map.set(jobNo, {
          job_no: jobNo,
          client_name: form?.client_name || "Unknown Client",
          is_on_hold: firstJob.is_on_hold || false,
        });
      }
    }

    return res
      .status(200)
      .json({ success: true, data: Array.from(map.values()) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Get Sub-Jobs — only sub-jobs that still have at least one un-RFQ'd material
export const getSubJobsForJob = async (req, res) => {
  try {
    const { jobNo } = req.params;

    const jobs = await salesOrderModel
      .find({ job_no: jobNo, is_pushed_shop_floor: true })
      .populate({
        path: "bom_id",
        select: "material_specification",
      })
      .populate({
        path: "blocked_materials",
        select: "materialId status",
      })
      .select("sub_job_no _id job_no blocked_materials is_on_hold")
      .lean();

    // All RFQs for this jobNo to check coverage
    const allRfqs = await rfqModel
      .find({ jobNo })
      .select("subJobNo name")
      .lean();

    const orderIds = jobs.map((j) => j._id);
    const forms = await sales_order_form_Model
      .find({ sample__order_id: { $in: orderIds } })
      .select("sample__order_id product_name")
      .lean();

    // Only include sub-jobs where at least one material is:
    // 1. Not blocked
    // 2. Not yet covered by an RFQ
    const data = jobs
      .filter((job) => {
        const materials = [
          ...(job.bom_id?.material_specification || []),
          ...(job.bom_id?.packingdatas || [])
            .filter(p =>
              p.name?.toUpperCase() !== 'PACKING LABOUR' &&
              (!p.logicalRate || p.logicalRate.length === 0)
            )
            .map(p => ({
              material_name: p.name,
              material_type: p.itemType,
              item_id: p.itemId?.toString()
            }))
        ];
        const blockedMaterialIds = new Set(
          (job.blocked_materials || [])
            .filter((bm) => bm.status === "blocked" || bm.status === "consumed")
            .map((bm) => bm.materialId)
        );

        return materials.some((ms) => {
          const matName = ms.material_name || ms.material_type;
          const matId = ms.item_id;

          // Check if blocked
          if (matId && blockedMaterialIds.has(matId)) return false;

          return !allRfqs.some(
            (r) => r.subJobNo === job.sub_job_no && r.name === matName
          );
        });
      })
      .map((job) => {
        const form = forms.find(
          (f) => f.sample__order_id?.toString() === job._id.toString()
        );
        return {
          _id: job._id,
          sub_job_no: job.sub_job_no,
          product_name: form?.product_name || "Standard Product",
          is_on_hold: job.is_on_hold || false,
        };
      });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getStoreRFQPendingRequests = async (req, res) => {
  try {
    const requests = await materialPurchaseRequestModel.find({ status: 'APPROVED' }).lean();

    // Check if they are completely RFQd
    const allRfqs = await rfqModel.find({ source: 'STORE' }).select('jobNo name').lean();

    const data = [];
    for (const reqObj of requests) {
      const isComplete = (reqObj.items || []).every(item => {
        return allRfqs.some(r => r.jobNo === reqObj.request_number && r.name === item.item_name);
      });
      if (!isComplete) {
        data.push({ request_number: reqObj.request_number, _id: reqObj._id });
      }
    }
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getStoreRFQRequestDetails = async (req, res) => {
  try {
    const request_number = req.params.id;
    const request = await materialPurchaseRequestModel.findOne({ request_number }).populate('items.item_id').lean();

    if (!request) return res.status(404).json({ success: false, message: "Request not found" });

    const existingRfqs = await rfqModel.find({ jobNo: request_number, source: 'STORE' }).select('name').lean();
    const rfqNames = new Set(existingRfqs.map(r => r.name));

    const pendingMaterials = (request.items || []).map((item, idx) => {
      const itemDoc = item.item_id;
      const stock = parseFloat(itemDoc?.stock || 0);
      const min_stock = parseFloat(itemDoc?.min_stock || 0);
      const req_qty = parseFloat(item.required_qty || 0);
      const needsPurchase = stock < req_qty || stock < min_stock;

      return {
        id: `req-${idx}`, // Unique identifier
        name: item.item_name,
        req_qty,
        stock,
        min_stock,
        needsPurchase,
        material_category_id: item.category_id || itemDoc?.secondarycategory || null,
        material_type_id: item.type_id || itemDoc?.master || null,
        specs: item.specification || '',
        vendorName: itemDoc?.vendorName || null,
      }
    }).filter(m => !rfqNames.has(m.name));

    return res.status(200).json({ success: true, data: { request_number: request.request_number, items: pendingMaterials } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Get Material Details — ALL materials EXCEPT those already covered by an existing RFQ
export const getMaterialDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const job = await salesOrderModel
      .findById(id)
      .populate({
        path: "bom_id",
        populate: {
          path: "items.subCategoryId",
          model: "item",
          select: "name stock min_stock size_wise_stock",
          populate: {
            path: "size_wise_stock.size_id",
            model: "stock_sizes",
            select: "size", // size name like "24x48"
          },
        },
      })
      .populate({
        path: "blocked_materials",
        select: "materialId status",
      })
      .lean();

    if (!job)
      return res.status(404).json({ success: false, message: "Job not found" });

    // All RFQs for this specific job+subjob
    const existingRfqs = await rfqModel
      .find({ jobNo: job.job_no, subJobNo: job.sub_job_no })
      .select("name")
      .lean();
    const rfqNames = new Set(existingRfqs.map((r) => r.name));

    // Blocked material IDs
    const blockedMaterialIds = new Set(
      (job.blocked_materials || [])
        .filter((bm) => bm.status === "blocked" || bm.status === "consumed")
        .map((bm) => bm.materialId)
    );

    const form = await sales_order_form_Model
      .findOne({ sample__order_id: id })
      .select("client_name product_name product_size category subcategory")
      .lean();

    // Batch resolve secondarycategory and master
    const uniqueCategoryNames = [
      ...new Set((job.bom_id?.items || []).map(it => it.secondarycategory).filter(Boolean))
    ];
    const uniqueMasterNames = [
      ...new Set((job.bom_id?.items || []).map(it => it.master).filter(Boolean))
    ];

    const [resolvedCats, resolvedTypes] = await Promise.all([
      materialCategoryModel.find({ name: { $in: uniqueCategoryNames } }).select('_id name').lean(),
      materialTypeModel.find({ name: { $in: uniqueMasterNames } }).select('_id name').lean()
    ]);

    const catNameToId = {};
    resolvedCats.forEach(c => { catNameToId[c.name.toLowerCase()] = c._id; });

    const typeNameToId = {};
    resolvedTypes.forEach(t => { typeNameToId[t.name.toLowerCase()] = t._id; });

    const materialSpecs = (job.bom_id?.material_specification || []).map(ms => ({ ...ms, materialType: 'Material' }));
    const packingSpecs = (job.bom_id?.packingdatas || [])
      .filter(p =>
        p.name?.toUpperCase() !== 'PACKING LABOUR' &&
        (!p.logicalRate || p.logicalRate.length === 0)
      )
      .map(p => ({
        material_id: p.itemId,
        item_id: p.itemId ? p.itemId.toString() : null,
        material_name: p.name,
        material_type: p.itemType,
        final_total: parseFloat(p.qty || p.finaltotal || 0),
        materialType: 'Packing',
        input: {
          size: p.logic1 ? `${p.logic1}${p.logic2 ? 'x' + p.logic2 : ''}${p.logic3 ? 'x' + p.logic3 : ''}` : ''
        }
      }));

    const allMaterials = [...materialSpecs, ...packingSpecs].map(
      (ms) => {
        const mappedItemId = ms.item_id ? ms.item_id.toString() : null;
        const matIdStr = ms.material_id ? ms.material_id.toString() : null;

        const matchedItem = (job.bom_id?.items || []).find(
          (it) =>
            (it.item_id && it.item_id.toString() === mappedItemId) ||
            (it.subCategoryId && it.subCategoryId.toString() === mappedItemId) ||
            (it.subCategoryId && matIdStr && it.subCategoryId.toString() === matIdStr)
        );
        const itemDoc = matchedItem?.subCategoryId;
        let stock;
        let min_stock = 0;

        const req_qty = ms.final_total || 0;

        // Handle SHEET type
        if (matchedItem?.itemType?.toLowerCase() === "sheet") {
          console.log("matchedItem?.itemType?:", matchedItem?.itemType)
          const inputSize = ms?.input?.size?.toLowerCase(); // "24x48"
          console.log("inputSize:", inputSize)
          console.log("itemDoc?.size_wise_stock::", itemDoc?.size_wise_stock)

          const matchedSizeStock = (itemDoc?.size_wise_stock || []).find(
            (sws) =>
              sws.size_id?.size?.toLowerCase() === inputSize
          );
          console.log("matchedSizeStock", matchedSizeStock)

          stock = parseFloat(matchedSizeStock?.count || 0);
          console.log("stock,", stock)
        } else {
          // Normal items
          stock = parseFloat(itemDoc?.stock || 0);
          min_stock = parseFloat(itemDoc?.min_stock || 0);
        }

        // Purchase logic
        const needsPurchase =
          matchedItem?.itemType?.toLowerCase() === "sheet"
            ? stock < req_qty   // ignore min_stock
            : stock < req_qty || stock < min_stock;
        const itemType = matchedItem?.type || "Standard";

        const secondaryCatName = matchedItem?.secondarycategory;
        const material_category_id = secondaryCatName ? (secondaryCatName || null) : null;

        const masterName = matchedItem?.master;
        const material_type_id = masterName ? (masterName || null) : null;

        const vendorName = matchedItem?.vendorName || null;

        return { ...ms, stock, min_stock, req_qty, needsPurchase, itemType, material_category_id, material_type_id, vendorName };
      }
    );

    // Exclude materials that already have an RFQ (any status) or are blocked
    const pendingMaterials = allMaterials.filter((m) => {
      const matName = m.material_name || m.material_type;
      const matId = m.item_id;

      // Exclude if already has RFQ
      if (rfqNames.has(matName)) return false;

      // Exclude if blocked
      if (blockedMaterialIds.has(matId)) return false;

      return true;
    });

    // Resolve category_id for details (check both Material and Service categories)
    let category_id = null;
    if (form?.category) {
      const [mCat, sCat] = await Promise.all([
        materialCategoryModel.findOne({ name: { $regex: new RegExp(`^${form.category}$`, 'i') } }).select('_id').lean(),
        serviceCategoryModel.findOne({ name: { $regex: new RegExp(`^${form.category}$`, 'i') } }).select('_id').lean()
      ]);
      if (mCat) category_id = mCat._id;
      else if (sCat) category_id = sCat._id;
    }

    const data = {
      _id: job._id,
      job_no: job.job_no,
      sub_job_no: job.sub_job_no,
      quantity: job.quantity,
      client_name: form?.client_name || "Unknown Client",
      product_name: form?.product_name || "Unknown Product",
      product_size: form?.product_size || [],
      category: form?.category || "",
      category_id,
      subcategory: form?.subcategory || "",
      material_specification: pendingMaterials,
      sales_order_nanoid: job?.bom_id?.sales_order_nanoid || null,
    };

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.log(error)
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Mark a sub-job's BOM as having its Packing AI RFQ created
export const markPackPurchased = async (req, res) => {
  try {
    const { salesOrderId } = req.params;
    const salesOrder = await salesOrderModel
      .findById(salesOrderId)
      .select("bom_id")
      .lean();
    if (!salesOrder?.bom_id)
      return res.status(404).json({ success: false, message: "BOM not found" });

    await bomModel.findByIdAndUpdate(salesOrder.bom_id, {
      is_pack_purchase_rfq: true,
    });
    return res.status(200).json({ success: true, message: "Packing flag set" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getPackingAvailableJobs = async (req, res) => {
  try {
    const jobs = await salesOrderModel
      .find({})
      .populate({
        path: "bom_id",
        select: "packingdatas material_specification is_pack_purchase_rfq allow_sequential_packing",
      })
      .select("job_no sub_job_no _id is_on_hold")
      .lean();

    const orderIds = jobs.map((j) => j._id);
    const forms = await sales_order_form_Model
      .find({ sample__order_id: { $in: orderIds } })
      .select("sample__order_id client_name")
      .lean();

    const map = new Map();

    const jobsByJobNo = jobs.reduce((acc, job) => {
      if (!acc[job.job_no]) acc[job.job_no] = [];
      acc[job.job_no].push(job);
      return acc;
    }, {});

    for (const [jobNo, jobList] of Object.entries(jobsByJobNo)) {
      // Job appears only if at least one sub-job:
      // 1. Not already flagged as packing purchased
      // 2. Has allow_sequential_packing = true (set from ProductViewActionDrawer)
      const hasActive = jobList.some((job) => {
        if (job.bom_id?.is_pack_purchase_rfq) return false;
        return job.bom_id?.allow_sequential_packing === true;
      });

      if (hasActive && !map.has(jobNo)) {
        const firstJob = jobList[0];
        const form = forms.find(
          (f) => f.sample__order_id?.toString() === firstJob._id.toString()
        );
        map.set(jobNo, {
          job_no: jobNo,
          client_name: form?.client_name || "Unknown Client",
          is_on_hold: firstJob.is_on_hold || false,
        });
      }
    }

    return res
      .status(200)
      .json({ success: true, data: Array.from(map.values()) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 2.1 Get Sub-Jobs for Packing AI — only sub-jobs not yet flagged as purchased AND allowed
export const getPackingSubJobsForJob = async (req, res) => {
  try {
    const { jobNo } = req.params;

    const jobs = await salesOrderModel
      .find({ job_no: jobNo })
      .populate({
        path: "bom_id",
        select: "is_pack_purchase_rfq allow_sequential_packing",
      })
      .select("sub_job_no _id job_no quantity")
      .lean();

    const orderIds = jobs.map((j) => j._id);
    const forms = await sales_order_form_Model
      .find({ sample__order_id: { $in: orderIds } })
      .select("sample__order_id product_name")
      .lean();

    // Exclude sub-jobs that are already purchased OR not yet allowed for Packing AI
    const data = jobs
      .filter((job) => !job.bom_id?.is_pack_purchase_rfq && job.bom_id?.allow_sequential_packing === true)
      .map((job) => {
        const form = forms.find(
          (f) => f.sample__order_id?.toString() === job._id.toString()
        );
        return {
          _id: job._id,
          sub_job_no: job.sub_job_no,
          product_name: form?.product_name || "Standard Product",
        };
      });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Get Packing Details for Sequential Packing AI
// Returns only custom packing materials (Thermocol Custom & Black Box Custom) from BOM.
// MASTER CARTON layer is always surfaced by the frontend — no stock filtering applied.
export const getPackingDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const job = await salesOrderModel
      .findById(id)
      .populate({
        path: "bom_id",
        select: "packingdatas material_specification items allow_sequential_packing allow_mastercarton_packing allow_thermocol_packing allow_blackbox_packing",
        populate: [
          {
            path: "packingdatas.itemId",
            model: "item",
            select: "name",
          },
          {
            path: "items.subCategoryId",
            model: "item",
            select: "name",
          },
        ],
      })
      .lean();

    if (!job)
      return res.status(404).json({ success: false, message: "Job not found" });

    const form = await sales_order_form_Model
      .findOne({ sample__order_id: id })
      .select(
        "client_name product_name unit product_size category subcategory job_quantity"
      )
      .lean();

    // The two custom packing material names the frontend uses for TH / TB layers
    const CUSTOM_PACKING_NAMES = ["Thermocol (Custom)", "Black Box (Custom)"];

    // 1. From packingdatas (dedicated packing BOM entries)
    const fromPackingDatas = await Promise.all(
      (job.bom_id?.packingdatas || [])
        .filter((p) => CUSTOM_PACKING_NAMES.includes(p.name))
        .map(async (p) => {
          let logicalRate = p.logicalRate || [];

          // Fallback: If logicalRate is missing fields, fetch from Item Master
          if (
            logicalRate.length === 0 ||
            (logicalRate[0] &&
              !logicalRate[0].condition &&
              !logicalRate[0].rate)
          ) {
            try {
              const itemDoc = await itemModel.findOne({ name: p.name }).lean();
              if (itemDoc?.logical_rate) {
                logicalRate = itemDoc.logical_rate;
              }
            } catch (err) {
              console.error("Error fetching packingdata logic:", err);
            }
          }

          return {
            ...p,
            name: p.name,
            final_total: p.finaltotal,
            logicalRate: logicalRate.map((r) => ({
              _id: r._id,
              rate: r.rate || r.price,
              // Item master uses logical_rate[].condition, BOM logic might use .condition or .variable
              condition:
                r.condition || (r.variable ? { variable: r.variable } : null),
            })),
          };
        })
    );

    // NOT taking from material_specification anymore as per requirement
    const merged = fromPackingDatas;

    // Resolve category_id for packing details (check both Material and Service categories)
    let category_id = null;
    if (form?.category) {
      const [mCat, sCat] = await Promise.all([
        materialCategoryModel.findOne({ name: { $regex: new RegExp(`^${form.category}$`, 'i') } }).select('_id').lean(),
        serviceCategoryModel.findOne({ name: { $regex: new RegExp(`^${form.category}$`, 'i') } }).select('_id').lean()
      ]);
      if (mCat) category_id = mCat._id;
      else if (sCat) category_id = sCat._id;
    }

    const data = {
      _id: job._id,
      job_no: job.job_no,
      sub_job_no: job.sub_job_no,
      quantity: form?.job_quantity || job.quantity,
      client_name: form?.client_name,
      product_name: form?.product_name,
      unit: form?.unit,
      product_size: form?.product_size || [],
      category: form?.category || "",
      category_id,
      subcategory: form?.subcategory || "",
      packing_materials: merged, // only Thermocol (Custom) and Black Box (Custom)
      allow_sequential_packing: job.bom_id?.allow_sequential_packing || false,
      allow_mastercarton_packing: job.bom_id?.allow_mastercarton_packing || false,
      allow_thermocol_packing: job.bom_id?.allow_thermocol_packing || false,
      allow_blackbox_packing: job.bom_id?.allow_blackbox_packing || false,
    };

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Send Purchase Order emails to awarded vendors
export const sendPOEmails = async (req, res) => {
  try {
    const { id } = req.params;
    const { awards, rfqName, rfqUid, jobNo, subJobNo, sendEmail = true, sendWhatsapp = false } = req.body;

    if (!awards || !Array.isArray(awards) || awards.length === 0) {
      return res.status(400).json({ success: false, message: "No awards provided" });
    }

    // Fetch the RFQ to get the image
    const rfq = await rfqModel.findById(id).lean();
    if (!rfq) {
      return res.status(404).json({ success: false, message: "RFQ not found" });
    }

    // ── Concurrency Guard ─────────────────────────────────────────────────
    // If another admin already clicked Allow Production, the stage will have
    // moved past PO Awarded. Prevent duplicate emails from being sent.
    const STAGE_ORDER = [
      "1. Draft RFQ", "2. Assign Vendors", "3. Review (Negotiate)",
      "4. PO Awarded", "5. In Process", "6. Delivery"
    ];
    if (STAGE_ORDER.indexOf(rfq.stage) >= 4) {
      return res.status(409).json({
        success: false,
        message: `This RFQ has already progressed to "${rfq.stage}". Purchase Orders have already been issued. Please refresh the page to see the latest data.`,
        staleAction: true
      });
    }
    let rfqImage = null;
    if (rfq && rfq.image) {
      rfqImage = generateSignedUrl(rfq.image);
    }



    // Resolve vendor emails in one query
    const vendorNames = awards.map(a => a.vendorName).filter(Boolean);
    // Select mobile_no for whatsapp sending as well
    const vendors = await vendorModel.find({ name: { $in: vendorNames } }).select("name email mobile_no").lean();
    const emailMap = {};
    const vendorMap = {};
    vendors.forEach(v => {
      emailMap[v.name] = v.email;
      vendorMap[v.name] = v;
    });

    let mailPromises = [];
    if (sendEmail) {
      mailPromises = awards.map(award => {
        const email = emailMap[award.vendorName];

        if (!email) {
          console.warn(`No email for vendor: ${award.vendorName}`);
          return Promise.resolve();
        }
        const html = generateEmailTemplateForPO(rfqName, rfqUid, jobNo, subJobNo, award, rfqImage);
        return transporter.sendMail({
          from: `RD Custom Awards <${process.env.EMAIL_SENDER}>`,
          to: email,
          subject: `Purchase Order Confirmed: ${rfqName} - RD Custom Awards`,
          html,
        });
      });
    }

    if (sendWhatsapp) {
      const poWhatsAppNumbers = [];
      awards.forEach(award => {
        const vendorInfo = vendorMap[award.vendorName];
        if (vendorInfo && vendorInfo.mobile_no) {
          let phone = String(vendorInfo.mobile_no).trim().replace(/\D/g, "");
          if (phone.length === 10) phone = "91" + phone;

          const totalValue = (Number(award.rate) * Number(award.qty)).toLocaleString("en-IN");

          let scheduleText = "TBD";
          if (award.deliverySchedule && award.deliverySchedule.length > 1) {
            scheduleText = "Multiple Splits";
          } else if (award.deliverySchedule && award.deliverySchedule.length === 1) {
            scheduleText = award.deliverySchedule[0].date ? new Date(award.deliverySchedule[0].date).toISOString().split('T')[0] : "TBD";
          }

          poWhatsAppNumbers.push({
            receiver: phone,
            values: {
              "1": award.vendorName || "Vendor",
              "2": award.poNumber || "N/A",
              "3": rfqUid || "N/A",
              "4": rfqName || "N/A",
              "5": String(award.qty || 0),
              "6": String(award.rate || 0),
              "7": totalValue,
              "8": scheduleText
            }
          });
        }
      });

      if (poWhatsAppNumbers.length > 0) {
        const bulkPayload = {
          type: "multiple",
          numbers: poWhatsAppNumbers
        };
        const url = process.env.TWOFACTOR_WHATSAPP_PO_ISSUED_VENDORS_URL;
        const apiKey = process.env.TWOFACTOR_WHATSAPP_API_KEY;
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
          body: JSON.stringify(bulkPayload)
        })
          .then(res => res.json())
          .then(data => console.log("PO WA sent", data))
          .catch(err => console.error("PO WA error", err));
      }
    }

    const results = await Promise.allSettled(mailPromises);
    const failed = results.filter(r => r.status === 'rejected').length;

    if (failed > 0) {
      return res.status(207).json({ success: true, message: `PO emails sent with ${failed} failure(s).` });
    }

    return res.status(200).json({ success: true, message: `PO emails/messages sent to ${awards.length} vendor(s).` });
  } catch (error) {
    console.error("sendPOEmails error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Internal Helper: Enriches an RFQ object with its original product image (from BOM) 
 * and signs all image URLs for use in the Procurement Coordination Kanban view.
 */
const _enrichCoordRFQ = async (rfq) => {
  if (!rfq) return rfq;
  try {
    const bom = await bomModel.findOne({ sub_job_no: rfq.subJobNo }).select("org_image").lean();
    let org_image = bom?.org_image || null;
    if (org_image) {
      try {
        org_image = generateSignedUrl(org_image);
      } catch (e) {
        console.error("Error signing org_image:", e);
      }
    }
    return {
      ...rfq,
      image: rfq.image ? generateSignedUrl(rfq.image) : null,
      org_image,
    };
  } catch (err) {
    console.error("Error in _enrichCoordRFQ helper:", err);
    return rfq;
  }
};

// PROCUREMENT COORDINATION MODULE

/**
 * GET /rfq/coord/list
 * Returns all RFQs that are in awarded / active production stages.
 * Those are the cards shown in the Procurement Coordination Kanban.
 */
export const getCoordRFQs = async (req, res) => {
  try {
    // Removed "4. PO Awarded": POs only appear in Coordination AFTER clicking "Allow Production"
    const COORD_STAGES = ["5. In Process", "6. Delivery"];

    let query = { stage: { $in: COORD_STAGES } };
    const isAdmin = req.user?.role.toLowerCase() === "admin executive";
    const isHead = req.user?.is_head || false;
    const isPurchase = req.user?.role?.toLowerCase().includes("purchase");

    const filterCreator = req.query.creatorId;

    if (isPurchase && !isAdmin && !isHead) {
      query.createdBy = req.user?._id;
    } else if (filterCreator) {
      query.createdBy = filterCreator;
    }



    const rfqs = await rfqModel
      .find(query)
      .sort({ createdAt: -1 })
      .lean();

    // Fetch corresponding BOMs and SalesOrders to get org_image and is_on_hold
    const subJobNos = rfqs.map(r => r.subJobNo).filter(Boolean);
    const jobNos = rfqs.map(r => r.jobNo).filter(Boolean);

    const [boms, salesOrders, enquiries] = await Promise.all([
      bomModel.find({ sub_job_no: { $in: subJobNos } }, 'sub_job_no org_image').lean(),
      salesOrderModel.find({ sub_job_no: { $in: subJobNos } }, 'sub_job_no is_on_hold').lean(),
      enquiryModel.find({ job_no: { $in: [...new Set([...jobNos, ...subJobNos.map(s => s.replace(/[a-zA-Z]$/, ''))])] } }, 'job_no reference_no').lean()
    ]);

    const bomMap = {};
    for (const b of boms) {
      if (b.org_image) {
        bomMap[b.sub_job_no] = b.org_image;
      }
    }

    const holdMap = {};
    for (const s of salesOrders) {
      holdMap[s.sub_job_no] = s.is_on_hold || false;
    }

    const enqMap = {};
    for (const e of enquiries) {
      enqMap[e.job_no] = e.reference_no;
    }

    // Attach signed image URLs, org_image, is_on_hold and fallback reference_no
    let formattedData = rfqs.map(r => {
      const obj = { ...r };
      if (obj.image) obj.image = generateSignedUrl(obj.image);
      obj.org_image = bomMap[obj.subJobNo] ? generateSignedUrl(bomMap[obj.subJobNo]) : null;
      obj.is_on_hold = holdMap[obj.subJobNo] || false;

      // Fallback for reference_no
      if (!obj.reference_no) {
        const directMatch = obj.jobNo ? enqMap[obj.jobNo] : null;
        const derivedJobNo = obj.subJobNo ? obj.subJobNo.replace(/[a-zA-Z]$/, '') : null;
        const subMatch = derivedJobNo ? enqMap[derivedJobNo] : null;
        obj.reference_no = directMatch || subMatch || "";
      }

      return obj;
    });

    // In-memory filter if search is provided
    const { search } = req.query;
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      formattedData = formattedData.filter(item =>
        searchRegex.test(item.uid) ||
        searchRegex.test(item.jobNo) ||
        searchRegex.test(item.subJobNo) ||
        searchRegex.test(item.reference_no) ||
        searchRegex.test(item.client) ||
        searchRegex.test(item.name)
      );
    }

    return res.status(200).json({ success: true, data: formattedData });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /rfq/coord/:id/stage
 * Body: { coordStage: "EN ROUTE", note?: "..." }
 * Moves a PO to a new coordination Kanban stage and logs the action.
 */
export const updateCoordStage = async (req, res) => {
  try {
    const { id } = req.params;
    const { coordStage, note } = req.body;

    const VALID = ["ESCALATED", "PENDING RACK", "EN ROUTE", "QC CHECK", "STORES INWARD"];
    if (!VALID.includes(coordStage)) {
      return res.status(400).json({ success: false, message: "Invalid coordStage value." });
    }

    const logEntry = {
      date: new Date(),
      action: "STAGE MOVED",
      note: note || `Moved to ${coordStage}`,
      user: req.user?.name || req.user?.email || "Coordinator",
      userId: req.user?._id,
    };

    const updated = await rfqModel.findByIdAndUpdate(
      id,
      {
        coordStage,
        $push: { coordLogs: { $each: [logEntry], $position: 0 } },
      },
      { new: true }
    ).lean();

    if (!updated) return res.status(404).json({ success: false, message: "RFQ not found" });

    const enriched = await _enrichCoordRFQ(updated);
    return res.status(200).json({ success: true, message: "Stage updated", data: enriched });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /rfq/coord/:id/remark
 * Body: { note: "Vendor confirmed dispatch" }
 * Appends a coordinator remark to coordLogs.
 */
export const addCoordRemark = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    if (!note || !note.trim()) {
      return res.status(400).json({ success: false, message: "Remark note is required." });
    }

    const logEntry = {
      date: new Date(),
      action: "COORDINATOR REMARK",
      note: note.trim(),
      user: req.user?.name || req.user?.email || "Coordinator",
      userId: req.user?._id,
    };

    const updated = await rfqModel.findByIdAndUpdate(
      id,
      { $push: { coordLogs: { $each: [logEntry], $position: 0 } } },
      { new: true }
    ).lean();

    if (!updated) return res.status(404).json({ success: false, message: "RFQ not found" });

    const enriched = await _enrichCoordRFQ(updated);
    return res.status(200).json({ success: true, message: "Remark added", data: enriched });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /rfq/coord/:id/eta
 * Body: { deliveryDate: "2026-04-10", note: "Vendor requested delay" }
 * Updates the delivery ETA and logs the reason. Adds log entry with old + new ETA.
 */
export const updateCoordETA = async (req, res) => {
  try {
    const { id } = req.params;
    const { deliveryDate, note } = req.body;

    if (!deliveryDate) {
      return res.status(400).json({ success: false, message: "deliveryDate is required." });
    }
    if (!note || !note.trim()) {
      return res.status(400).json({ success: false, message: "A remark is required when updating ETA." });
    }

    // Fetch existing to record old ETA
    const existing = await rfqModel.findById(id).select("deliveryDate deadline uid").lean();
    if (!existing) return res.status(404).json({ success: false, message: "RFQ not found" });

    const oldEta = existing.deliveryDate || existing.deadline;
    const formatDt = (d) => {
      if (!d) return "None";
      const dt = new Date(d);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      const datePart = `${y}-${m}-${day}`;
      const timePart = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
      return `${datePart} @ ${timePart}`;
    };
    const oldStr = formatDt(oldEta);
    const newStr = formatDt(new Date(deliveryDate));

    const logEntry = {
      date: new Date(),
      action: "ETA UPDATED",
      note: `${note.trim()} [${oldStr} → ${newStr}]`,
      user: req.user?.name || req.user?.email || "Coordinator",
      userId: req.user?._id,
    };

    const updated = await rfqModel.findByIdAndUpdate(
      id,
      {
        deliveryDate: new Date(deliveryDate),
        deadline: new Date(deliveryDate),
        $push: { coordLogs: { $each: [logEntry], $position: 0 } },
      },
      { new: true }
    ).lean();

    const enriched = await _enrichCoordRFQ(updated);
    return res.status(200).json({ success: true, message: "ETA updated", data: enriched });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /rfq/coord/:id/inward
 * Body: { ordered, inwardGood, rejected, reInward }
 * Updates the inward accounting numbers on a PO (visible in the Ledger).
 */
export const updateInwardAccounting = async (req, res) => {
  try {
    const { id } = req.params;
    const { ordered, inwardGood, rejected, reInward } = req.body;

    const logEntry = {
      date: new Date(),
      action: "INWARD UPDATED",
      note: `Ord:${ordered ?? "-"} Good:${inwardGood ?? "-"} Rej:${rejected ?? "-"} Re-In:${reInward ?? "-"}`,
      user: req.user?.name || req.user?.email || "Coordinator",
      userId: req.user?._id,
    };

    const updated = await rfqModel.findByIdAndUpdate(
      id,
      {
        inwardAccounting: {
          ordered: Number(ordered ?? 0),
          inwardGood: Number(inwardGood ?? 0),
          rejected: Number(rejected ?? 0),
          reInward: Number(reInward ?? 0),
          lastUpdated: new Date(),
        },
        $push: { coordLogs: { $each: [logEntry], $position: 0 } },
      },
      { new: true }
    ).lean();

    if (!updated) return res.status(404).json({ success: false, message: "RFQ not found" });

    const enriched = await _enrichCoordRFQ(updated);
    return res.status(200).json({ success: true, message: "Inward accounting updated", data: enriched });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PER-AWARD (PO Number) COORDINATION  —  each award card moves independently

/**
 * PATCH /rfq/coord/:rfqId/award/:poNumber/stage
 * Body: { coordStage, note? }
 * Moves a specific PO number to a new coordination stage.
 */
export const updateAwardCoordStage = async (req, res) => {
  try {
    const { rfqId, poNumber } = req.params;
    const { coordStage, note } = req.body;

    const VALID = ["ESCALATED", "PENDING ACK", "EN ROUTE", "QC CHECK", "STORES INWARD"];
    if (!VALID.includes(coordStage))
      return res.status(400).json({ success: false, message: "Invalid coordStage value." });

    const logEntry = {
      date: new Date(),
      action: "STAGE MOVED",
      note: note || `Moved to ${coordStage}`,
      user: req.user?.name || req.user?.email || "Coordinator",
      userId: req.user?._id,
    };

    // If moving to EN ROUTE, we clear the manual escalation tracking (oldPoDeliveryDate)
    const updateObj = { $set: { "awards.$.coordStage": coordStage } };
    if (coordStage === "EN ROUTE") {
      updateObj.$set["awards.$.oldPoDeliveryDate"] = null;
    }

    const updated = await rfqModel.findOneAndUpdate(
      { _id: rfqId, "awards.poNumber": poNumber },
      {
        ...updateObj,
        $push: { "awards.$.coordLogs": { $each: [logEntry], $position: 0 } },
      },
      { new: true }
    ).lean();

    if (!updated) return res.status(404).json({ success: false, message: "RFQ or PO not found" });

    const enriched = await _enrichCoordRFQ(updated);
    return res.status(200).json({ success: true, message: `PO Moved to ${coordStage}`, data: enriched });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /rfq/coord/:rfqId/award/:poNumber/eta
 * Body: { deliveryDate, note }
 * Updates ETA for a specific PO (stored in awards.$.poDeliveryDate).
 */
export const updateAwardCoordETA = async (req, res) => {
  try {
    const { rfqId, poNumber } = req.params;
    const { deliveryDate, note } = req.body;

    if (!deliveryDate)
      return res.status(400).json({ success: false, message: "deliveryDate is required." });
    if (!note?.trim())
      return res.status(400).json({ success: false, message: "A remark is required when updating ETA." });

    // Fetch existing award to log old ETA
    const existing = await rfqModel.findOne(
      { _id: rfqId, "awards.poNumber": poNumber },
      { "awards.$": 1, deliveryDate: 1 }
    ).lean();

    const formatDt = (d) => {
      if (!d) return "None";
      const dt = new Date(d);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      const datePart = `${y}-${m}-${day}`;
      const timePart = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
      return `${datePart} @ ${timePart}`;
    };

    const award = existing?.awards?.[0];
    let latestSplitDate = null;
    if (award?.deliverySchedule?.length > 0) {
      const latest = award.deliverySchedule.reduce((prev, s) => {
        const d = s.date ? new Date(s.date) : null;
        const prev_d = prev?.date ? new Date(prev.date) : null;
        return d && (!prev_d || d > prev_d) ? s : prev;
      }, null);
      if (latest?.date) {
        const base = new Date(latest.date);
        if (latest.time) {
          const [h, m] = latest.time.split(':').map(Number);
          base.setHours(h || 0, m || 0, 0, 0);
        }
        latestSplitDate = base;
      }
    }
    const isManuallyEdited = !!award?.oldPoDeliveryDate;
    const baseSplitEta = latestSplitDate || award?.poDeliveryDate || existing?.deliveryDate || existing?.deadline;
    const oldEta = isManuallyEdited ? award?.poDeliveryDate : baseSplitEta;

    const oldStr = formatDt(oldEta);
    const newStr = formatDt(new Date(deliveryDate));

    const logEntry = {
      date: new Date(),
      action: "ETA UPDATED",
      note: `${note.trim()} [${oldStr} → ${newStr}]`,
      user: req.user?.name || req.user?.email || "Coordinator",
      userId: req.user?._id,
    };

    const updated = await rfqModel.findOneAndUpdate(
      { _id: rfqId, "awards.poNumber": poNumber },
      {
        $set: {
          "awards.$.poDeliveryDate": new Date(deliveryDate),
          "awards.$.oldPoDeliveryDate": oldEta ? new Date(oldEta) : null,
          "awards.$.coordStage": "ESCALATED"
        },
        $push: { "awards.$.coordLogs": { $each: [logEntry], $position: 0 } },
      },
      { new: true }
    ).lean();

    if (!updated) return res.status(404).json({ success: false, message: "RFQ or PO not found" });

    const enriched = await _enrichCoordRFQ(updated);
    return res.status(200).json({ success: true, message: "ETA updated and PO moved to Escalations", data: enriched });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /rfq/coord/:rfqId/award/:poNumber/restore-eta
 * Reverts to the previous ETA from Escalations and returns to PENDING RACK.
 */
export const restoreAwardCoordETA = async (req, res) => {
  try {
    const { rfqId, poNumber } = req.params;

    const existing = await rfqModel.findOne(
      { _id: rfqId, "awards.poNumber": poNumber },
      { "awards.$": 1 }
    ).lean();

    const oldDate = existing?.awards?.[0]?.oldPoDeliveryDate;
    if (!oldDate) return res.status(400).json({ success: false, message: "No previous ETA available for restoration." });

    const formatDt = (d) => {
      if (!d) return "None";
      const dt = new Date(d);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      const datePart = `${y}-${m}-${day}`;
      const timePart = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
      return `${datePart} @ ${timePart}`;
    };

    const currentEta = existing?.awards?.[0]?.poDeliveryDate;
    const oldStr = formatDt(oldDate);
    const curStr = formatDt(currentEta);

    const logEntry = {
      date: new Date(),
      action: "ETA RESTORED",
      note: `Reverted to previous delivery date [${curStr} → ${oldStr}]`,
      user: req.user?.name || req.user?.email || "Coordinator",
      userId: req.user?._id,
    };

    const updated = await rfqModel.findOneAndUpdate(
      { _id: rfqId, "awards.poNumber": poNumber },
      {
        $set: {
          "awards.$.poDeliveryDate": oldDate,
          "awards.$.oldPoDeliveryDate": null,
          "awards.$.coordStage": "PENDING RACK",
        },
        $push: { "awards.$.coordLogs": { $each: [logEntry], $position: 0 } },
      },
      { new: true }
    ).lean();

    if (!updated) return res.status(404).json({ success: false, message: "RFQ or PO not found" });

    const enriched = await _enrichCoordRFQ(updated);
    return res.status(200).json({ success: true, message: "ETA restored and PO returned to Pending Rack", data: enriched });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /rfq/coord/:rfqId/award/:poNumber/remark
 * Body: { note }
 * Adds a coordinator remark to a specific PO's coordLogs.
 */
export const addAwardCoordRemark = async (req, res) => {
  try {
    const { rfqId, poNumber } = req.params;
    const { note } = req.body;

    if (!note?.trim())
      return res.status(400).json({ success: false, message: "Remark note is required." });

    const logEntry = {
      date: new Date(),
      action: "COORDINATOR REMARK",
      note: note.trim(),
      user: req.user?.name || req.user?.email || "Coordinator",
      userId: req.user?._id,
    };

    const updated = await rfqModel.findOneAndUpdate(
      { _id: rfqId, "awards.poNumber": poNumber },
      { $push: { "awards.$.coordLogs": { $each: [logEntry], $position: 0 } } },
      { new: true }
    ).lean();

    if (!updated) return res.status(404).json({ success: false, message: "RFQ or PO not found" });

    const enriched = await _enrichCoordRFQ(updated);
    return res.status(200).json({ success: true, message: "Remark added", data: enriched });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /rfq/coord/:rfqId/award/:poNumber/inward
 * Body: { ordered, inwardGood, rejected, reinward }
 * Saves inward accounting numbers per-PO.
 */
export const updateAwardInwardAccounting = async (req, res) => {
  try {
    const { rfqId, poNumber } = req.params;
    const { ordered, inwardGood, rejected, reinward } = req.body;

    const logEntry = {
      date: new Date(),
      action: "INWARD UPDATED",
      note: `Ord:${ordered ?? "-"} Good:${inwardGood ?? "-"} Rej:${rejected ?? "-"} Re:${reinward ?? "-"}`,
      user: req.user?.name || req.user?.email || "Coordinator",
      userId: req.user?._id,
    };

    const updated = await rfqModel.findOneAndUpdate(
      { _id: rfqId, "awards.poNumber": poNumber },
      {
        $set: {
          "awards.$.inwardOrdered": Number(ordered ?? 0),
          "awards.$.inwardGood": Number(inwardGood ?? 0),
          "awards.$.inwardRejected": Number(rejected ?? 0),
          "awards.$.inwardReinward": Number(reinward ?? 0),
          "awards.$.inwardUpdatedAt": new Date(),
        },
        $push: { "awards.$.coordLogs": { $each: [logEntry], $position: 0 } },
      },
      { new: true }
    ).lean();

    if (!updated) return res.status(404).json({ success: false, message: "RFQ or PO not found" });

    const enriched = await _enrichCoordRFQ(updated);
    return res.status(200).json({ success: true, message: "Inward updated", data: enriched });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /coord/:rfqId/award/:poNumber/inward-action
 * Action-based Transaction Audit Protocol handler.
 * Body: { action, qty?, challan? }
 * Actions:
 *   ARRIVAL_REGISTRY   → add qty to inwardReceived
 *   QC_AUDIT           → add passed/failed to inwardGood / inwardRejected
 *   PRODUCTION_RELEASE → add qty to inwardIssued (must not exceed qcGood - issued)
 *   DISPATCH_RETURNS   → move all inwardRejected to inwardReturned
 *   REINWARD           → move qty from inwardReturned into inwardReinward
 *   TOGGLE_ESCALATE    → flip inwardIsEscalated
 */
export const awardInwardAction = async (req, res) => {
  try {
    const { rfqId, poNumber } = req.params;
    const { action, qty, qtyPassed, qtyFailed, challan, receiptDate, note: actionNote } = req.body;
    const userName = req.user?.name || req.user?.email || "Store Team";
    const userId = req.user?._id;

    // Fetch current award state
    const rfq = await rfqModel.findOne({ _id: rfqId, "awards.poNumber": poNumber }).lean();
    if (!rfq) return res.status(404).json({ success: false, message: "RFQ/PO not found" });

    const award = rfq.awards.find(a => a.poNumber === poNumber);
    if (!award) return res.status(404).json({ success: false, message: "Award not found" });

    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }).toLowerCase();

    let updateSet = { "awards.$.inwardUpdatedAt": now };
    let pushOps = {};
    let historyEntry = null;
    let coordLog = null;
    let errorMsg = null;

    switch (action) {

      case "ARRIVAL_REGISTRY": {
        const q = Number(qty || 0);
        const already = Number(award.inwardReceived || 0);
        const limit = Number(award.qty || 0);

        if (q <= 0) { errorMsg = "Qty must be > 0"; break; }
        if (already + q > limit) {
          errorMsg = `Arrival limit exceeded: PO total is ${limit}, already received ${already}. Max allowed now: ${limit - already}`;
          break;
        }

        updateSet["awards.$.inwardReceived"] = already + q;
        const actualDate = receiptDate ? new Date(receiptDate) : now;
        historyEntry = { time: timeStr, date: actualDate, user: userName, userId, msg: `BATCH RECEIPT: ${q} UNITS UNLOADED${challan ? ` | CHALLAN: ${challan}` : ""}` };
        coordLog = { date: actualDate, action: "ARRIVAL REGISTRY", note: `Received: ${q} units${challan ? `, Challan: ${challan}` : ""}`, user: userName, userId };

        // Save Challan Details
        if (challan) {
          let fileUrl = "";
          if (req.files && req.files.length > 0) {
            const file = req.files.find(f => f.fieldname === 'challanFile');
            if (file) {
              const url = await uploadToR2(`challans/${rfqId}/${poNumber}`, file.buffer, file.originalname, file.mimetype);
              if (url) fileUrl = url;
            }
          }
          pushOps["awards.$.inwardChallans"] = {
            qty: q,
            challanNo: challan,
            date: actualDate,
            docUrl: fileUrl
          };
        }
        break;
      }

      case "ADD_INVOICE": {
        const { invoiceNo, invoiceAmt, dueDate } = req.body;
        const q = Number(qty || 0);
        const goodQty = award.inwardGood || 0;
        const alreadyInvoiced = award.inwardInvoiced || 0;
        const remainingToInvoice = goodQty - alreadyInvoiced;

        if (!invoiceNo || !invoiceAmt || !dueDate) { 
          errorMsg = "Invoice No, Amount, and Payment Due Date are mandatory"; 
          break; 
        }
        if (q <= 0) { errorMsg = "Qty must be > 0"; break; }
        if (q > remainingToInvoice) { 
          errorMsg = `Invoice qty (${q}) cannot exceed remaining QC passed qty (${remainingToInvoice}). Total Good: ${goodQty}`; 
          break; 
        }

        updateSet["awards.$.inwardInvoiced"] = alreadyInvoiced + q;

        let fileUrl = "";
        if (req.files && req.files.length > 0) {
          const file = req.files.find(f => f.fieldname === 'invoiceFile');
          if (file) {
            const url = await uploadToR2(`vendor_invoices/${rfqId}/${poNumber}`, file.buffer, file.originalname, file.mimetype);
            if (url) fileUrl = url;
          }
        }

        const actualDate = receiptDate ? new Date(receiptDate) : now;
        const parsedDueDate = (dueDate && String(dueDate).trim()) ? new Date(dueDate) : null;
        if (parsedDueDate) {
          const todayCheck = new Date();
          todayCheck.setHours(0, 0, 0, 0);
          if (parsedDueDate < todayCheck) {
            errorMsg = "Payment Due Date cannot be in the past";
            break;
          }
        }

        const latestChallan = award.inwardChallans && award.inwardChallans.length > 0 
          ? award.inwardChallans[award.inwardChallans.length - 1] 
          : null;
        
        let resolvedVendorId = award.vendor || null;
        if (!resolvedVendorId && award.vendorName) {
          const vDoc = await vendorModel.findOne({ name: { $regex: new RegExp(`^${award.vendorName.trim()}$`, "i") } }).select("_id");
          if (vDoc) resolvedVendorId = vDoc._id;
        }

        await vendorBillModel.create({
          vendor_id: resolvedVendorId,
          vendor_name: award.vendorName || "Unknown",
          rfq_id: rfq._id,
          po_number: poNumber,
          product_name: rfq.name || "",
          challan_no: latestChallan ? latestChallan.challanNo : "",
          challan_url: latestChallan ? (latestChallan.docUrl || latestChallan.fileUrl || "") : "",
          invoice_no: invoiceNo,
          receipt_date: actualDate,
          due_date: parsedDueDate,
          received_qty: q,
          payable_amount: Number(invoiceAmt),
          paid_amount: 0,
          balance_due: Number(invoiceAmt),
          status: "Pending",
          invoice_url: fileUrl,
          recorded_by: userName
        });

        historyEntry = { time: timeStr, date: actualDate, user: userName, userId, msg: `INVOICE LOGGED: ${invoiceNo} FOR ${q} UNITS${parsedDueDate ? ` | DUE: ${parsedDueDate.toLocaleDateString("en-GB")}` : ""}` };
        coordLog = { date: actualDate, action: "ADD INVOICE", note: `Invoice: ${invoiceNo}, Qty: ${q}, Amt: ${invoiceAmt}${parsedDueDate ? `, Due Date: ${parsedDueDate.toLocaleDateString("en-GB")}` : ""}`, user: userName, userId };
        break;
      }

      case "QC_AUDIT": {
        const g = Number(qtyPassed || 0);
        const b = Number(qtyFailed || 0);
        const pendingQC = (award.inwardReceived || 0) - (award.inwardGood || 0) - (award.inwardRejected || 0);
        if ((g + b) > pendingQC) {
          errorMsg = `Validation error: entered (${g + b}) exceeds pending queue (${pendingQC})`;
          break;
        }
        const newGood = (award.inwardGood || 0) + g;
        const newRejected = (award.inwardRejected || 0) + b;
        updateSet["awards.$.inwardGood"] = newGood;
        updateSet["awards.$.inwardRejected"] = newRejected;

        // ── Gate: move current award → STORES INWARD only when ──────────────
        //  1. No QC pending (all received have been inspected)
        //  2. Enough GOOD units to cover the full order:
        //       inwardGood + inwardReinward (replacements) >= award.qty
        //
        // Why:  If 100 ordered, 20 pass QC, 80 rejected → good=20, need 100
        //       Even though pending=0, good(20)+reinward(0)=20 < 100 → NOT done
        //       Only after vendor replacements bring good+reinward up to 100 → done
        const newPending = (award.inwardReceived || 0) - newGood - newRejected;
        const reinward = award.inwardReinward || 0;
        const enoughGood = (newGood + reinward) >= (award.qty || 0);

        if (newPending === 0 && enoughGood && (g + b) > 0) {
          updateSet["awards.$.coordStage"] = "STORES INWARD";

          // ── Gate: move RFQ → Delivery only when EVERY award satisfies ───────
          //    good + reinward >= ordered  AND  pending === 0
          const otherAwardsAllClear = rfq.awards
            .filter(a => a.poNumber !== poNumber)
            .every(a => {
              const aGood = a.inwardGood || 0;
              const aReinward = a.inwardReinward || 0;
              const aOrdered = a.qty || 0;
              if ((aGood + aReinward) < aOrdered) return false; // not enough good units
              const aReceived = a.inwardReceived || 0;
              const aPending = aReceived - aGood - (a.inwardRejected || 0);
              return aPending === 0;
            });

          if (otherAwardsAllClear) {
            updateSet["stage"] = "6. Delivery";
            coordLog = {
              date: now,
              action: "STAGE MOVED",
              note: `All POs fully inspected & good qty met — RFQ moved to 6. Delivery`,
              user: userName,
              userId,
            };
          }
        }

        historyEntry = { time: timeStr, date: now, user: userName, userId, msg: `QC FINALIZED: ${g} PASSED, ${b} FAILED` };
        if (!coordLog) {
          coordLog = { date: now, action: "QC AUDIT", note: `Passed: ${g}, Failed: ${b}`, user: userName, userId };
        }
        // Note: Stock update is handled upon PRODUCTION_RELEASE to avoid double addition
        break;
      }



      case "PRODUCTION_RELEASE": {
        const q = Number(qty || 0);
        const stock = (award.inwardGood || 0) + (award.inwardReinward || 0) - (award.inwardIssued || 0);
        const poLimit = (award.qty || 0) - (award.inwardIssued || 0);

        if (q <= 0) { errorMsg = "Release qty must be > 0"; break; }
        if (q > stock) { errorMsg = `Release denied: only ${stock} available in stock`; break; }
        if (q > poLimit) { errorMsg = `Release denied: PO quantity limit reached. Remaining allowed: ${poLimit}`; break; }

        updateSet["awards.$.inwardIssued"] = (award.inwardIssued || 0) + q;
        // Auto-clear escalation if job is fully issued/completed
        if (((award.inwardIssued || 0) + q) >= (award.qty || 0)) {
          updateSet["awards.$.inwardIsEscalated"] = false;
        }
        historyEntry = { time: timeStr, date: now, user: userName, userId, msg: `FLOOR RELEASE: ${q} UNITS DISPATCHED` };
        coordLog = { date: now, action: "PRODUCTION RELEASE", note: `Issued: ${q} units | Item: ${rfq.name}`, user: userName, userId };

        // Update inventory stock for production release
        if (q > 0 && rfq.name) {
          await _tryIncrementInventoryStock(rfq, q, "PRODUCTION_RELEASE");
        }
        break;
      }

      case "DISPATCH_RETURNS": {
        const b = award.inwardRejected || 0;
        if (b === 0) { errorMsg = "No defectives ready for return"; break; }
        // Reduce inwardReceived so the returned items don't falsely reappear in pendingQC (Quality Audit Queue)
        updateSet["awards.$.inwardReceived"] = Math.max(0, (award.inwardReceived || 0) - b);
        updateSet["awards.$.inwardReturned"] = (award.inwardReturned || 0) + b;
        updateSet["awards.$.inwardRejected"] = 0;
        historyEntry = { time: timeStr, date: now, user: userName, userId, msg: `RETURN NOTE CREATED: ${b} UNITS DISPATCHED` };
        coordLog = { date: now, action: "DISPATCH RETURNS", note: `Returned to vendor: ${b} units`, user: userName, userId };
        break;
      }



      case "TOGGLE_ESCALATE": {
        const newVal = !(award.inwardIsEscalated || false);
        updateSet["awards.$.inwardIsEscalated"] = newVal;
        const escNote = actionNote?.trim() || (newVal ? "QC Escalation activated" : "Escalation cleared");
        historyEntry = { time: timeStr, date: now, user: userName, userId, msg: newVal ? `URGENT ESCALATION TRIGGERED${actionNote?.trim() ? `: ${actionNote.trim()}` : ""}` : `ESCALATION REVOKED${actionNote?.trim() ? `: ${actionNote.trim()}` : ""}` };
        coordLog = { date: now, action: newVal ? "ESCALATED" : "DE-ESCALATED", note: escNote, user: userName, userId };
        break;
      }

      default:
        return res.status(400).json({ success: false, message: `Unknown action: ${action}` });
    }

    if (errorMsg) return res.status(400).json({ success: false, message: errorMsg });

    // pushOps already initialized at the top
    if (historyEntry) pushOps["awards.$.inwardHistory"] = { $each: [historyEntry], $position: 0 };
    if (coordLog) pushOps["awards.$.coordLogs"] = { $each: [coordLog], $position: 0 };

    const updated = await rfqModel.findOneAndUpdate(
      { _id: rfqId, "awards.poNumber": poNumber },
      { $set: updateSet, $push: pushOps },
      { new: true }
    ).lean();

    // (Stock updates are now triggered inline within QC_AUDIT, REINWARD, and PRODUCTION_RELEASE)

    const enriched = await _enrichCoordRFQ(updated);
    return res.status(200).json({ success: true, message: `Action ${action} applied`, data: enriched });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Helper: Asynchronously increments stock on itemModel.
 * 
 * KEY INSIGHT: The sheet SIZE (e.g. "12x12") lives in rfq.specs (e.g. "12x12 (2 UPS)"),
 * NOT in rfq.name (which is just "2 MM ACRYLIC"). The old code was parsing rfq.name
 * for dimensions and never finding them, so sheets always fell into the linear/unit path.
 */
async function _tryIncrementInventoryStock(rfq, qty, action) {
  try {
    const mongoose = (await import('mongoose')).default;
    let itemName = (rfq.name || '').trim();

    // Mapping for custom names
    const n = itemName.toUpperCase();
    if (n.includes("TB: BLACK TOP-BOTTOM BOX") || n === "TB: BLACK TOP-BOTTOM BOX") {
      itemName = "Black Box (Custom)";
    } else if (n.includes("TH: THERMACOLE CUSHION") || n === "TH: THERMACOLE CUSHION") {
      itemName = "Thermocol (Custom)";
    }

    const specs = (rfq.specs || '').trim();

    // 1. Parse dimensions from SPECS field (e.g. "12x12 (2 UPS)", "24x48", "48*96")
    //    This is where the sheet size actually lives — NOT in the name.
    const sizeMatch = specs.match(/(\d+(?:\.\d+)?)\s*[xX*×]\s*(\d+(?:\.\d+)?)/i);
    let width = 0, height = 0;

    if (sizeMatch) {
      width = parseFloat(sizeMatch[1]);
      height = parseFloat(sizeMatch[2]);
    }

    // 2. Find the inventory item — name matches directly (e.g. "2 MM ACRYLIC")
    let item = null;
    let isCustom = false;

    // Try item_id first (robust against name changes)
    if (rfq.item_id) {
      if (rfq.is_custom_item) {
        item = await customItemModel.findOne({ id: rfq.item_id });
        if (!item) item = await customItemModel.findById(rfq.item_id);
        if (item) isCustom = true;
      } else {
        item = await itemModel.findOne({ id: rfq.item_id });
        if (!item) item = await itemModel.findById(rfq.item_id);
        // Fallback for custom items where is_custom_item flag is missing/false
        if (!item) {
          item = await customItemModel.findOne({ id: rfq.item_id });
          if (!item) item = await customItemModel.findById(rfq.item_id);
          if (item) isCustom = true;
        }
      }
    }

    // Fallback to exact name match (with trim to avoid trailing/leading space issues)
    const itemNameTrimmed = (itemName || '').trim();
    if (!item && itemNameTrimmed) {
      const nameRegex = new RegExp(`^${itemNameTrimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      item = await itemModel.findOne({ name: { $regex: nameRegex } });
      if (!item) {
        item = await customItemModel.findOne({ name: { $regex: nameRegex } });
        if (item) isCustom = true;
      }
    }

    if (!item) {
      console.warn(`[INVENTORY] Item '${itemName}' (ID: ${rfq.item_id}) not found. Stock not updated.`);
      return;
    }

    // Determine final qty change based on item type and action
    // Only PRODUCTION_RELEASE updates store inventory stock (INCREASES stock)
    if (action !== "PRODUCTION_RELEASE") {
      console.log(`[INVENTORY] Action '${action}' skipped stock update (stock is increased upon PRODUCTION_RELEASE)`);
      return;
    }

    const finalQty = Math.abs(qty); // Always positive: increases stock on PRODUCTION_RELEASE

    // 3. If standard sheet item and dimensions found in specs → size-wise stock update
    if (!isCustom && sizeMatch && item.item_type === 'sheet') {
      const StockSize = mongoose.model('stock_sizes');

      // Look for the exact size in stock_sizes collection
      const widthStr = width.toString();
      const heightStr = height.toString();
      let matchedSize = await StockSize.findOne({
        size: { $regex: new RegExp(`^${widthStr}\\s*[xX*×]\\s*${heightStr}$`, 'i') }
      });
      if (!matchedSize) {
        matchedSize = await StockSize.findOne({
          size: { $regex: new RegExp(`^${heightStr}\\s*[xX*×]\\s*${widthStr}$`, 'i') }
        });
      }

      if (matchedSize) {
        const sizeIdStr = matchedSize._id.toString();
        let foundSizeEntry = null;

        if (item.size_wise_stock && Array.isArray(item.size_wise_stock)) {
          foundSizeEntry = item.size_wise_stock.find(s => s.size_id && s.size_id.toString() === sizeIdStr);
        } else {
          item.size_wise_stock = [];
        }

        if (foundSizeEntry) {
          // Add incoming qty to existing count, then recalculate sqinch
          foundSizeEntry.count = (foundSizeEntry.count || 0) + finalQty;
          foundSizeEntry.sqinch = foundSizeEntry.count * width * height;
        } else {
          // New size entry
          item.size_wise_stock.push({
            size_id: matchedSize._id,
            count: finalQty,
            sqinch: finalQty * width * height
          });
        }

        // Must mark modified so Mongoose persists the array changes
        item.markModified('size_wise_stock');

        // Aggregate total stock = sum of all size sqinch values
        let totalStockSqIn = 0;
        for (const s of item.size_wise_stock) {
          totalStockSqIn += (s.sqinch || 0);
        }
        item.stock = totalStockSqIn;

        await item.save();
        console.log(`[INVENTORY] Sheet "${item.name}" size ${width}x${height}: ${finalQty >= 0 ? '+' : ''}${finalQty} sheets → count=${foundSizeEntry?.count || finalQty}, total stock=${item.stock} sqin`);
      } else {
        console.warn(`[INVENTORY] Size ${width}x${height} not found in stock_sizes collection. Stock not updated.`);
      }
    } else {
      // Linear/unit stock update (no sheet dimensions or non-sheet item)
      item.stock = (item.stock || 0) + finalQty;
      await item.save();
      console.log(`[INVENTORY] Item '${item.name}' ${finalQty >= 0 ? '+' : ''}${finalQty} → stock=${item.stock}`);
    }
  } catch (err) {
    console.error(`[INVENTORY] Error updating stock for '${rfq?.name || 'Unknown'}':`, err.message);
  }
}

/**
 * PATCH /rfq/coord/:rfqId/award/:poNumber/accept-qty
 * Accepts the pending quantity change from Sales and clears the flag.
 */
export const acceptAwardQtyChange = async (req, res) => {
  try {
    const { rfqId, poNumber } = req.params;

    const rfq = await rfqModel.findOne({ _id: rfqId, "awards.poNumber": poNumber });
    if (!rfq) return res.status(404).json({ success: false, message: "RFQ or PO not found" });

    const award = rfq.awards.find(a => a.poNumber === poNumber);
    if (!award || !award.pendingQtyChange) {
      return res.status(400).json({ success: false, message: "No pending quantity change for this PO." });
    }

    const logEntry = {
      date: new Date(),
      action: "QTY ADJUSTMENT ACCEPTED",
      note: `Pending qty ${award.newQtyRequest} Nos accepted and synchronized.`,
      user: req.user?.name || req.user?.email || "Coordinator",
      userId: req.user?._id,
    };

    const updated = await rfqModel.findOneAndUpdate(
      { _id: rfqId, "awards.poNumber": poNumber },
      {
        $set: {
          "awards.$.currentJobQty": award.newQtyRequest,
          "awards.$.pendingQtyChange": false,
          "awards.$.newQtyRequest": null
        },
        $push: { "awards.$.coordLogs": { $each: [logEntry], $position: 0 } },
      },
      { new: true }
    ).lean();

    const enriched = await _enrichCoordRFQ(updated);
    return res.status(200).json({ success: true, message: "PO Quantity updated and alert cleared.", data: enriched });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /rfq/coord/:rfqId/award/:poNumber/accept-date
 * Accepts the pending date changes from Sales and clears the flags.
 */
export const acceptAwardDateChange = async (req, res) => {
  try {
    const { rfqId, poNumber } = req.params;

    const rfq = await rfqModel.findOne({ _id: rfqId, "awards.poNumber": poNumber });
    if (!rfq) return res.status(404).json({ success: false, message: "RFQ or PO not found" });

    const award = rfq.awards.find(a => a.poNumber === poNumber);
    if (!award || (!award.pendingDateChange && !award.pendingJobCompletionChange)) {
      return res.status(400).json({ success: false, message: "No pending date change for this PO." });
    }

    const logEntry = {
      date: new Date(),
      action: "TIMELINE SHIFT ACCEPTED",
      note: `Pending timeline shifts accepted and synchronized.`,
      user: req.user?.name || req.user?.email || "Coordinator",
      userId: req.user?._id,
    };

    const updateSet = {};
    if (award.pendingDateChange) {
      updateSet["awards.$.current_delivery_date"] = award.newDateRequest;
      updateSet["awards.$.pendingDateChange"] = false;
      updateSet["awards.$.newDateRequest"] = null;
    }
    if (award.pendingJobCompletionChange) {
      updateSet["awards.$.current_job_completion_date"] = award.newJobCompletionRequest;
      updateSet["awards.$.pendingJobCompletionChange"] = false;
      updateSet["awards.$.newJobCompletionRequest"] = null;
    }

    const updated = await rfqModel.findOneAndUpdate(
      { _id: rfqId, "awards.poNumber": poNumber },
      {
        $set: updateSet,
        $push: { "awards.$.coordLogs": { $each: [logEntry], $position: 0 } },
      },
      { new: true }
    ).lean();

    const enriched = await _enrichCoordRFQ(updated);
    return res.status(200).json({ success: true, message: "PO Timeline updated and alert cleared.", data: enriched });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
