import EnquiryJob from "../../../models/enquiry/enquiryJobIntegrationModel.js";
import customerModel from "../../../models/masters/customerModel.js";
import { uploadToR2, generateSignedUrl } from "../../../helpers/r2helper.js";
import { syncCustomerStats, getClientEnquiryStatsHelper } from "./coreEnquiryJobHelpers.js";
import { ENQUIRY_CONFIG, computeNextEnquiry, getCurrentYearCode } from "../../../config/enquiryConfig.js";
import mongoose from "mongoose";

// Get next sequential job number (configured in config/enquiryConfig.js)
export const getNextEnquiryNumber = async (req, res) => {
  try {
    const currentYear = getCurrentYearCode();
    const lastJob = await EnquiryJob.findOne({
      $or: [
        { year: currentYear },
        { enquiry_no: new RegExp(`^RD${currentYear}`) },
      ],
    })
      .sort({ seq: -1, createdAt: -1 })
      .select("seq year enquiry_no")
      .lean();

    const { seq, enquiry_no, year } = computeNextEnquiry(lastJob, currentYear);
    res.status(200).json({
      success: true,
      enquiry_no,
      seq,
      year,
      prefix: ENQUIRY_CONFIG.PREFIX,
      starting_seq: ENQUIRY_CONFIG.STARTING_SEQ,
    });
  } catch (error) {
    console.error("Error fetching next enquiry number (integration):", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// Client Level Live Stats Aggregation
export const getClientEnquiryStats = async (req, res) => {
  return getClientEnquiryStatsHelper(req, res, EnquiryJob);
};

// Upload file directly to Cloudflare R2 under Client ID & Enquiry folder structure
export const uploadEnquiryFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file provided" });
    }

    const { clientId, clientName, enquiryNo, folderType = "design", subJobNo } = req.body;
    let clientFolder = clientId || "general";
    let effClientName = clientName;

    if (!effClientName && clientId && mongoose.Types.ObjectId.isValid(clientId)) {
      try {
        const cust = await customerModel.findById(clientId).select("name").lean();
        if (cust?.name) effClientName = cust.name;
      } catch {
        /* ignore */
      }
    }

    if (effClientName && String(effClientName).trim()) {
      const sanitizedName = String(effClientName)
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .replace(/_+/g, "_");
      clientFolder = clientId ? `${sanitizedName}_${clientId}` : sanitizedName;
    }

    const effEnquiryNo = enquiryNo || "RD_ENQUIRY";

    const cleanSubJob = subJobNo ? String(subJobNo).trim().replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_") : "";
    const subJobPrefix = cleanSubJob ? `${cleanSubJob}/` : "";
    const folderPath = `clients/${clientFolder}/enquiries/${effEnquiryNo}/${folderType}/${subJobPrefix}`.replace(/\/+$/, "");

    const fileUrl = await uploadToR2(folderPath, req.file.buffer, req.file.originalname, req.file.mimetype);
    let signedUrl = fileUrl;
    try {
      signedUrl = generateSignedUrl(fileUrl, 86400) || fileUrl;
    } catch (signErr) {
      console.warn("Failed to generate signed URL:", signErr);
    }

    res.status(200).json({
      success: true,
      message: "File uploaded successfully to R2",
      data: {
        file_url: fileUrl,
        signed_url: signedUrl,
        file_name: req.file.originalname,
        folder_path: folderPath,
        folder_type: folderType,
        sub_job_no: subJobNo || null,
      },
    });
  } catch (error) {
    console.error("Error uploading file to R2 (integration):", error);
    res.status(500).json({ success: false, message: "Upload failed", error: error.message });
  }
};

// Mark enquiry job as lost / abandoned
export const markJobLost = async (req, res) => {
  try {
    const { id } = req.params;
    const { lost_stage = "quotation", lost_reason = "", lost_notes = "", lost_to_competitor = "" } = req.body;

    let job = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      job = await EnquiryJob.findById(id);
    }
    if (!job) {
      job = await EnquiryJob.findOne({
        $or: [{ enquiry_no: id }, { enquiry_no: `RD${id}` }, { seq: Number(id) || -1 }],
      });
    }
    if (!job) return res.status(404).json({ success: false, message: "Job not found" });

    const fullReason = lost_reason
      ? `${lost_reason}${lost_notes ? ` - ${lost_notes}` : ""}`
      : (lost_notes || "Client cancelled / abandoned");

    job.is_lost = true;
    job.stage = "cancelled";
    job.lost_stage = lost_stage;
    job.lost_reason = fullReason;
    job.lost_to_competitor = lost_to_competitor;
    job.lost_at = new Date();
    job.lost_by = req.user?._id || req.user?.id || null;

    // Mark all sub-jobs as cancelled and dropped
    (job.sub_jobs || []).forEach((sj) => {
      sj.client_quote_decision = "rejected";
      sj.is_dropped = true;
      sj.drop_reason = fullReason;
      sj.stage = "cancelled";
    });
    job.markModified("sub_jobs");

    // Persist locked state in wizard_state for instant lossless UI lock
    job.wizard_state = {
      ...(job.wizard_state || {}),
      is_lost: true,
      stage: "cancelled",
      quoteApproved: false,
      client_quote_decision: "rejected",
      lost: fullReason,
      lostReason: lost_reason || fullReason,
      lostNotes: lost_notes || "",
      lostAt: job.lost_at,
      lostBy: req.user?.name || "Client Servicing / Admin",
      isLocked: true,
    };
    job.markModified("wizard_state");

    job.history.push({
      action: "ENQUIRY_ABANDONED_CANCELLED",
      step: job.step,
      remarks: `Enquiry abandoned & cancelled at ${lost_stage} stage. Reason: ${fullReason}${lost_to_competitor ? ` (Competitor: ${lost_to_competitor})` : ""}`,
      changed_by: {
        user_id: req.user?._id || req.user?.id || null,
        user_name: req.user?.name || "User",
        role: req.user?.role || "Sales",
      },
      timestamp: new Date(),
    });

    await job.save();

    if (job.customer_id) {
      await syncCustomerStats(job.customer_id);
    }

    res.status(200).json({
      success: true,
      message: "Enquiry marked as cancelled / lost",
      data: job,
    });
  } catch (error) {
    console.error("Error in markJobLost:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
