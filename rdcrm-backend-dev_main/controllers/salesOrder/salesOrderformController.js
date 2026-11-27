import mongoose from "mongoose";
import { nanoid } from "nanoid";
import salesorderformModel from "../../models/sales_orders/sales_order_form_Model.js";
import enquiryModel from "../../models/enquiry/enquiryModel.js";
import salesorderlistModel from "../../models/sales_orders/sales_order_list_Model.js";
import EnquiryJob from "../../models/enquiry/enquiryJobIntegrationModel.js";
import bomModel from "../../models/bom/bomModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";
import {
  uploadToR2,
  generateSignedUrl,
  signSafe,
} from "../../helpers/r2helper.js";
import { transporter, generateEmailTemplateForSalesOrder } from "../../helpers/mail.js";
import fetch from "node-fetch";



export const getAllSampleSalesOrders = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit)));
    const skip = (page - 1) * limit;

    const search = (req.query.search || "").trim();
    const status = req.query.status?.trim();

    const query = {};

    if (search) {
      query.$or = [
        { job_no: { $regex: search, $options: "i" } },
        { sub_job_no: { $regex: search, $options: "i" } },
        { client_name: { $regex: search, $options: "i" } },
      ];
    }

    if (status) query.status = status;

    const total = await salesorderformModel.countDocuments(query);

    const orders = await salesorderformModel
      .find(query)
      .populate("created_by", "name")
      .populate("updated_by.user", "name")
      .populate("enquiry_id", "job_no name product_name")
      .populate("sample__order_id", "job_no sub_job_no")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      success: true,
      count: orders.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: orders,
    });
  } catch (error) {
    console.error("getAllSampleSalesOrders error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

export const getSampleSalesOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await salesorderformModel
      .findOne({ id })
      .populate("created_by", "name")
      .populate("updated_by.user", "name")
      .populate("enquiry_id", "job_no name product_name")
      .populate("sample__order_id", "job_no sub_job_no");

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Sample Sales Order not found" });
    }

    const obj = order.toObject();
    obj.orgimage = signSafe(obj.image) || obj.image || null;
    obj.image = signSafe(obj.image);

    return res.status(200).json({ success: true, data: obj });
  } catch (error) {
    console.error("getSampleSalesOrderById error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

export const getSampleSalesOrderandlistById = async (req, res) => {
  try {
    const { ssoid } = req.params;
    const cleanSsoid = String(ssoid || "").trim();
    const isOid = mongoose.isValidObjectId(cleanSsoid);
    const withoutRd = cleanSsoid.replace(/^RD/i, "");
    const withRd = `RD${withoutRd}`;

    let order = await salesorderformModel
      .findOne({
        $or: [
          { sample_order_nanoid: cleanSsoid },
          { id: cleanSsoid },
          { sub_job_no: cleanSsoid },
          { sub_job_no: withRd },
          { sub_job_no: withoutRd },
        ],
      })
      .populate("created_by", "name")
      .populate("updated_by.user", "name")
      .populate({
        path: "enquiry_id",
        select:
          "job_no name product_name category subcategory mobile_no wp_number email unit product_size marketing_cordinator reference_no",
        populate: {
          path: "marketing_cordinator",
          select: "name",
        },
      })
      .populate("sample__order_id", "job_no sub_job_no");

    if (order) {
      const obj = order.toObject();
      obj.orgimage = signSafe(obj.image) || obj.image || null;
      obj.image = signSafe(obj.image);

      const subNo = String(obj.sub_job_no || "").trim();
      const subWithout = subNo.replace(/^RD/i, "");
      const subWith = `RD${subWithout}`;

      const matchedBom = await bomModel.findOne({
        $or: [
          ...(obj.sample_order_nanoid ? [{ sales_order_nanoid: obj.sample_order_nanoid }] : []),
          ...(obj.id ? [{ sales_order_nanoid: obj.id }] : []),
          ...(subNo ? [{ sub_job_no: subNo }, { sub_job_no: subWith }, { sub_job_no: subWithout }] : []),
        ],
      }).sort({ createdAt: -1 });

      if (matchedBom) {
        obj.bom_id = matchedBom.id || matchedBom._id;
        obj.bom_nanoid = matchedBom.id || matchedBom._id;
        obj.is_bom_filled = !matchedBom.is_bom_draft;
        obj.is_bom_rework = Boolean(matchedBom.is_bom_draft);
      }

      return res.status(200).json({ success: true, data: obj });
    }

    if (!order) {
      // Check EnquiryJob integration collection (supports Enquiry sub-jobs in Quotation BOM Stepper)
      let job;
      try {
        job = await EnquiryJob.findOne({
          $or: [
            { "sub_jobs.sub_job_no": cleanSsoid },
            { "sub_jobs.sub_job_no": withRd },
            { "sub_jobs.sub_job_no": withoutRd },
            { enquiry_no: cleanSsoid },
            { enquiry_no: withRd },
            { enquiry_no: withoutRd },
            ...(isOid ? [{ _id: cleanSsoid }] : []),
          ],
        })
          .populate("customer_id")
          .populate("assigned_to", "name")
          .lean();
      } catch (popErr) {
        console.warn("Populate failed in getSampleSalesOrderandlistById, falling back to unpopulated find:", popErr.message);
        job = await EnquiryJob.findOne({
          $or: [
            { "sub_jobs.sub_job_no": cleanSsoid },
            { "sub_jobs.sub_job_no": withRd },
            { "sub_jobs.sub_job_no": withoutRd },
            { enquiry_no: cleanSsoid },
            { enquiry_no: withRd },
            { enquiry_no: withoutRd },
            ...(isOid ? [{ _id: cleanSsoid }] : []),
          ],
        }).lean();
      }

      if (job) {
        const subJob =
          (job.sub_jobs || []).find(
            (s) =>
              s.sub_job_no === cleanSsoid ||
              s.sub_job_no === withRd ||
              s.sub_job_no === withoutRd
          ) ||
          job.sub_jobs?.[0] ||
          {};

        let groupIdx = 0;
        const match = subJob.sub_job_no ? subJob.sub_job_no.match(/-([A-Z])\d*$/i) : null;
        if (match && match[1]) {
          groupIdx = match[1].toUpperCase().charCodeAt(0) - 65;
        }

        const ws = job.wizard_state || {};
        const watermarkedDesigns = ws.watermarkedDesigns || {};
        const uploadedDesigns = ws.uploadedDesigns || {};
        const productFeedback = ws.productFeedback || {};
        const fb = productFeedback[groupIdx] || productFeedback[String(groupIdx)];
        const fbArr = Array.isArray(fb) ? fb : fb ? [fb] : [];
        const approvedFb = fbArr.find((f) => f && f.mode === "approve");
        const approvedOptIdx =
          approvedFb && approvedFb.optIdxs && approvedFb.optIdxs[0] !== undefined
            ? approvedFb.optIdxs[0]
            : 0;

        let rawImg =
          watermarkedDesigns[`${groupIdx}-${approvedOptIdx}`] ||
          uploadedDesigns[`${groupIdx}-${approvedOptIdx}`] ||
          watermarkedDesigns[`${groupIdx}-0`] ||
          uploadedDesigns[`${groupIdx}-0`];

        if (!rawImg && Array.isArray(subJob.design_files) && subJob.design_files.length > 0) {
          rawImg = subJob.design_files[0]?.signed_url || subJob.design_files[0]?.url || subJob.design_files[0]?.file_url || subJob.design_files[0];
        }
        if (!rawImg && Array.isArray(subJob.proof_files) && subJob.proof_files.length > 0) {
          rawImg = subJob.proof_files[0]?.signed_url || subJob.proof_files[0]?.url || subJob.proof_files[0]?.file_url || subJob.proof_files[0];
        }
        if (!rawImg && Array.isArray(subJob.ref_files) && subJob.ref_files.length > 0) {
          rawImg = subJob.ref_files[0]?.signed_url || subJob.ref_files[0]?.url || subJob.ref_files[0]?.file_url || subJob.ref_files[0];
        }
        if (!rawImg) {
          rawImg =
            subJob.reference_image ||
            job.the_ask?.reference_images?.[0] ||
            Object.values(watermarkedDesigns)[0] ||
            Object.values(uploadedDesigns)[0] ||
            null;
        }

        if (rawImg && typeof rawImg === "object") {
          rawImg = rawImg.url || rawImg.path || rawImg.signed_url || rawImg.file_url || null;
        }

        const signedImg = signSafe(rawImg);

        const subNo = String(subJob.sub_job_no || cleanSsoid).trim();
        const subWithout = subNo.replace(/^RD/i, "");
        const subWith = `RD${subWithout}`;

        // Look up BOM by subJob.bom_id or by sub_job_no (with or without RD)
        const matchedBom = await bomModel.findOne({
          $or: [
            ...(subJob.bom_id ? [
              { id: String(subJob.bom_id) },
              ...(mongoose.isValidObjectId(subJob.bom_id) ? [{ _id: subJob.bom_id }] : []),
            ] : []),
            { sub_job_no: subNo },
            { sub_job_no: subWith },
            { sub_job_no: subWithout },
          ],
        }).sort({ createdAt: -1 });

        const effectiveBomId = matchedBom ? (matchedBom.id || matchedBom._id) : (subJob.bom_id || null);
        const isBomFilled = matchedBom ? !matchedBom.is_bom_draft : (subJob.costing_status === "completed");
        const isBomRework = matchedBom ? Boolean(matchedBom.is_bom_draft) : (subJob.costing_status === "rework" || subJob.costing_status === "in_progress");

        let resolvedTargetRate = subJob.target_rate != null ? Number(Number(subJob.target_rate).toFixed(2)) : 0;
        if (!resolvedTargetRate && matchedBom?.quotation?.finalUnitPrice) {
          resolvedTargetRate = Number(Number(matchedBom.quotation.finalUnitPrice).toFixed(2));
        }

        let resolvedSampleRate = 0;
        if (subJob.sample_rate != null && Number(subJob.sample_rate) > 0) {
          resolvedSampleRate = Number(Number(subJob.sample_rate).toFixed(2));
        } else if (matchedBom?.quotation?.samplePrice && Number(matchedBom.quotation.samplePrice) > 0) {
          resolvedSampleRate = Number(Number(matchedBom.quotation.samplePrice).toFixed(2));
        } else if (resolvedTargetRate > 0) {
          resolvedSampleRate = Number((resolvedTargetRate + 200).toFixed(2));
        }

        const resolvedArtworkCharge = subJob.artwork_charge != null
          ? Number(Number(subJob.artwork_charge).toFixed(2))
          : (matchedBom?.quotation?.artworkCharge ? Number(Number(matchedBom.quotation.artworkCharge).toFixed(2)) : 0);

        // If matchedBom exists, backfill EnquiryJob sub-job if needed
        if (matchedBom && (!subJob.bom_id || subJob.costing_status !== (isBomFilled ? "completed" : "in_progress"))) {
          try {
            await EnquiryJob.updateOne(
              { _id: job._id, "sub_jobs.sub_job_no": subJob.sub_job_no },
              {
                $set: {
                  "sub_jobs.$.bom_id": matchedBom._id,
                  "sub_jobs.$.costing_status": isBomFilled ? "completed" : "in_progress",
                  "sub_jobs.$.costing_completed_at": isBomFilled ? (matchedBom.createdAt || new Date()) : null,
                  ...(resolvedTargetRate ? { "sub_jobs.$.target_rate": resolvedTargetRate } : {}),
                  ...(resolvedSampleRate ? { "sub_jobs.$.sample_rate": resolvedSampleRate } : {}),
                  ...(resolvedArtworkCharge ? { "sub_jobs.$.artwork_charge": resolvedArtworkCharge } : {}),
                },
              }
            );
          } catch (syncErr) {
            console.error("Error backfilling EnquiryJob sub-job BOM info:", syncErr);
          }
        }

        const obj = {
          _id: job._id,
          id: subJob.sub_job_no || cleanSsoid,
          sample_order_nanoid: subJob.sub_job_no || cleanSsoid,
          job_no: job.enquiry_no || (job.seq ? `RD${job.seq}` : ""),
          sub_job_no: subJob.sub_job_no || cleanSsoid,
          product_name: subJob.product_name || "Custom Trophy",
          job_quantity: subJob.quantity || 1,
          image: signedImg,
          orgimage: signedImg || rawImg,
          job_description: subJob.spec_line || subJob.specs || subJob.material || "",
          client_name: job.customer_id?.company_name || job.customer_id?.name || "Client",
          enquiry_id: {
            _id: job._id,
            reference_no: job.enquiry_no || (job.seq ? `RD${job.seq}` : ""),
            name: job.customer_id?.company_name || job.customer_id?.name || "",
            product_name: subJob.product_name || "Custom Trophy",
            category: subJob.trophy_type || "Custom Trophy",
            subcategory: subJob.theme || "",
            email: [job.customer_id?.email || job.contact_email].filter(Boolean),
            mobile_no: job.customer_id?.mobile_no || job.contact_mobile || "",
            wp_number: [job.customer_id?.mobile_no || job.contact_mobile].filter(Boolean),
            marketing_cordinator: job.assigned_to
              ? [{ _id: job.assigned_to._id, name: job.assigned_to.name }]
              : [{ name: job.coordinator_name || "Coordinator" }],
            product_size: [{ size: subJob.size || "8" }],
          },
          bom_id: effectiveBomId,
          bom_nanoid: matchedBom?.id || effectiveBomId,
          target_rate: resolvedTargetRate,
          sample_rate: resolvedSampleRate,
          artwork_charge: resolvedArtworkCharge,
          is_bom_filled: isBomFilled,
          is_bom_rework: isBomRework,
        };

        return res.status(200).json({ success: true, data: obj });
      }
    }

    return res
      .status(404)
      .json({ success: false, message: "Sample Sales Order not found" });
  } catch (error) {
    console.error("getSampleSalesOrderById error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

export const createSampleSalesOrder = async (req, res) => {
  try {
    const { enquiry_id, sample__order_id, job_no, sub_job_no, ...rest } =
      req.body;

    const userId = req.user?._id;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    // Validate enquiry
    const enquiry = await enquiryModel.findOne({ id: enquiry_id });
    if (!enquiry)
      return res
        .status(404)
        .json({ success: false, message: "Linked enquiry not found" });

    // Validate sample order
    let sampleOrder = null;
    if (sample__order_id) {
      sampleOrder = await salesorderlistModel.findById(sample__order_id);
      if (!sampleOrder)
        return res.status(404).json({
          success: false,
          message: "Linked Sample Order not found",
        });
    }

    // Normalize sample_required to boolean
    if (rest.sample_required !== undefined) {
      if (typeof rest.sample_required === "string") {
        rest.sample_required = rest.sample_required.toLowerCase() === "true" || rest.sample_required.toLowerCase() === "yes";
      } else {
        rest.sample_required = Boolean(rest.sample_required);
      }
    }

    const newOrder = new salesorderformModel({
      id: nanoid(16),
      enquiry_id,
      sample__order_id,
      job_no,
      sub_job_no,
      billing_address_2: rest.billing_address_2 || "",
      billing_gst_no: rest.billing_gst_no || "",
      ...rest,
      created_by: userId,
      created_at: getCurrentDate(),
    });

    const saved = await newOrder.save();
    return res.status(201).json({
      success: true,
      message: "Sample Sales Order created",
      data: saved,
    });
  } catch (error) {
    console.error("createSampleSalesOrder error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// export const updateSampleSalesOrder = async (req, res) => {
//   try {
//     console.log("updateSampleSalesOrder", req.body);
//     const { id } = req.params;
//     console.log("Updating Sample Sales Order ID:", id);

//     const updates = { ...req.body };
//     const userId = req.user?._id;
//     if (!userId)
//       return res.status(401).json({ success: false, message: "Unauthorized" });

//     const existing = await salesorderformModel.findOne({
//       sample_order_nanoid: id,
//     });
//     if (!existing)
//       return res
//         .status(404)
//         .json({ success: false, message: "Sample Sales Order not found" });

//     const uploadedUrls = [];

//     // MULTIPLE FILES UPLOAD TO R2
//     console.log("req.files", req.files);
//     if (req.files && req.files.length > 0) {
//       for (const file of req.files) {
//         const imageUrl = await uploadToR2(
//           `${existing.category}/${existing.subcategory}/${existing.job_no}/${existing.sub_job_no}/job_content`,
//           file.buffer,
//           file.originalname,
//           file.mimetype
//         );

//         uploadedUrls.push(imageUrl);
//       }
//     }

//     if (uploadedUrls.length > 0) {
//   updates.$push.product_images = { $each: uploadedUrls };
// }

//     updates.updated_at = getCurrentDate();

//     updates.$set = {
//       updated_by: [{ user: userId, date: getCurrentDate() }],
//     };

//     const updated = await salesorderformModel.findOneAndUpdate(
//       { sample_order_nanoid: id },
//       updates,
//       { new: true }
//     );

//     return res.status(200).json({
//       success: true,
//       message: "Sample Sales Order updated",
//       data: updated,
//     });
//   } catch (error) {
//     console.error("updateSampleSalesOrder error:", error);
//     return res
//       .status(500)
//       .json({ success: false, message: "Server error", error: error.message });
//   }
// };

export const updateSampleSalesOrder = async (req, res) => {
  try {
    console.log("updateSampleSalesOrder", req.body);
    const { id } = req.params;
    const userId = req.user?._id;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const existing = await salesorderformModel.findOne({
      sample_order_nanoid: id,
    });

    if (!existing)
      return res
        .status(404)
        .json({ success: false, message: "Sample Sales Order not found" });

    let updates = { ...req.body };

    // FIELDS THAT MUST BE JSON.PARSE
    const arrayFields = [
      "email",
      "wp_number",
      "product_size",
      "marketing_cordinator",
      "multi_deliveries",
    ];

    arrayFields.forEach((field) => {
      if (updates[field] && typeof updates[field] === "string") {
        try {
          updates[field] = JSON.parse(updates[field]);
        } catch (err) {
          console.log(`JSON parse failed for ${field}:`, err);
        }
      }
    });

    // NUMBER FIELDS
    const numberFields = ["job_quantity", "mobile_no", "billing_postal_code"];
    numberFields.forEach((field) => {
      if (updates[field]) {
        updates[field] = Number(updates[field]);
      }
    });

    // BOOLEAN FIELDS
    if (updates.sample_required !== undefined) {
      if (typeof updates.sample_required === "string") {
        updates.sample_required = updates.sample_required.toLowerCase() === "true" || updates.sample_required.toLowerCase() === "yes";
      } else {
        updates.sample_required = Boolean(updates.sample_required);
      }
    }
    if (updates.add_in_invoice !== undefined) {
      if (typeof updates.add_in_invoice === "string") {
        updates.add_in_invoice = updates.add_in_invoice.toLowerCase() === "true";
      } else {
        updates.add_in_invoice = Boolean(updates.add_in_invoice);
      }
    }

    const uploadedUrls = [];

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const imageUrl = await uploadToR2(
          `${updates.category}/${updates.subcategory}/${existing.job_no}/${existing.sub_job_no}/sample_order/job_content`,
          file.buffer,
          file.originalname,
          file.mimetype
        );

        uploadedUrls.push(imageUrl);
      }
    }

    const finalUpdate = { $set: {} };

    Object.keys(updates).forEach((key) => {
      if (!["$push", "$set", "product_files"].includes(key)) {
        finalUpdate.$set[key] = updates[key];
      }
    });

    if (uploadedUrls.length > 0) {
      finalUpdate.$push = {
        product_files: { $each: uploadedUrls },
      };
    }

    finalUpdate.$set.updated_at = getCurrentDate();
    finalUpdate.$set.updated_by = [{ user: userId, date: getCurrentDate() }];

    console.log("FINAL UPDATE OBJ:", finalUpdate);

    const updated = await salesorderformModel.findOneAndUpdate(
      { sample_order_nanoid: id },
      finalUpdate,
      { new: true }
    );

    if (!updated) {
      return res.status(400).json({
        success: false,
        message: "Sample Sales Order update failed",
      });
    }

    await salesorderlistModel.findOneAndUpdate(
      { id: id },
      { $set: { is_sales_order_filled: true } },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Sample Sales Order updated",
      data: updated,
    });
  } catch (error) {
    console.error("updateSampleSalesOrder error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

export const deleteSampleSalesOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await salesorderformModel.findOne({ id });
    if (!existing)
      return res
        .status(404)
        .json({ success: false, message: "Sample Sales Order not found" });

    await salesorderformModel.deleteOne({ id });

    return res.status(200).json({
      success: true,
      message: "Sample Sales Order deleted",
    });
  } catch (error) {
    console.error("deleteSampleSalesOrder error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

export const sendSalesOrderEmailById = async (req, res) => {
  try {
    const { id } = req.params;

    const salesOrder = await salesorderformModel.findOne({ id });
    if (!salesOrder) {
      return res.status(404).json({
        success: false,
        message: "Sales Order not found",
      });
    }

    if (!salesOrder.email || salesOrder.email.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No email address found for this Sales Order",
      });
    }

    const salesOrderObj = salesOrder.toObject();
    if (salesOrderObj.image) {
      salesOrderObj.image = generateSignedUrl(salesOrderObj.image);
    }

    const parentOrder = await salesorderlistModel.findById(salesOrder.sample__order_id);
    const orderType = parentOrder?.type || "Production";

    const emailHTML = generateEmailTemplateForSalesOrder(salesOrderObj, orderType);
    await transporter.sendMail({
      from: `"RD Custom Awards" <${process.env.EMAIL_SENDER}>`,
      to: Array.isArray(salesOrder.email) ? salesOrder.email.join(",") : salesOrder.email,
      subject: `Sales Order Details for ${salesOrder.product_name ? salesOrder.product_name.charAt(0).toUpperCase() + salesOrder.product_name.slice(1) : "Product"}`,
      html: emailHTML,
    });

    res.status(200).json({
      success: true,
      message: "Sales order email sent successfully",
      salesOrderId: id,
    });
  } catch (error) {
    console.error("Error sending sales order email:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

export const sendSalesOrderWhatsAppShare = async (req, res) => {
  try {
    const { phone_number, values } = req.body;

    if (!phone_number) {
      return res.status(400).json({ success: false, message: "Phone number is required" });
    }

    let formattedPhone = phone_number.toString().trim();
    if (formattedPhone.startsWith("+")) {
      formattedPhone = formattedPhone.substring(1);
    }
    if (formattedPhone.length === 10) {
      formattedPhone = "91" + formattedPhone;
    }

    const url = process.env.TWOFACTOR_WHATSAPP_PRODUCT_CONFIRAMTION_URL;
    const apiKey = process.env.TWOFACTOR_WHATSAPP_API_KEY;

    // We reuse the product confirmation template or just send if there's a new one. 
    // Usually values: { "1": jobRef, "2": client, "3": product, "4": link, "5": expiry }
    const payload = {
      receiver: formattedPhone,
      values: values
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    let data;
    try {
      data = await response.json();
    } catch {
      const text = await response.text();
      data = { message: text };
    }

    if (response.ok) {
      return res.status(200).json({
        success: true,
        message: "Message accepted by WhatsApp",
        data: data,
      });
    } else {
      return res.status(response.status || 400).json({
        success: false,
        message: "Failed to send WhatsApp message",
        error: data,
      });
    }
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};
