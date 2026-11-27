import EnquiryJob from "../../../models/enquiry/enquiryJobIntegrationModel.js";
import bomModel from "../../../models/bom/bomModel.js";
import salesorderlistModel from "../../../models/sales_orders/sales_order_list_Model.js";
import { generateSignedUrl } from "../../../helpers/r2helper.js";
import { transporter, sendMailWithUser } from "../../../helpers/mail.js";
import { getEffectiveClientDesigns } from "./designFlowController.js";
import { syncCustomerStats } from "./coreEnquiryJobController.js";
import { generatePublicToken, verifyPublicLink } from "../../../helpers/publicLinkToken.js";
import { enrichSubJobsWithBOMAndSimulatedRates } from "./costingQuotationHelpers.js";
import mongoose from "mongoose";

// ==========================================
// SUB-JOB COSTING, BOM & QUOTATION INTEGRATION
// ==========================================

export const requestCostingForSubJobs = async (req, res) => {
  try {
    const { id } = req.params;
    const { subJobNos = [], notes = "" } = req.body;

    const job = await EnquiryJob.findById(id);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    const now = new Date();
    const targetedNos = Array.isArray(subJobNos) && subJobNos.length > 0
      ? subJobNos
      : job.sub_jobs.filter((s) => !s.is_dropped && !s.is_on_hold).map((s) => s.sub_job_no);

    if (targetedNos.length === 0) {
      return res.status(400).json({ success: false, message: "No active sub-jobs selected for costing" });
    }

    // Update sub_jobs array
    job.sub_jobs.forEach((s) => {
      if (targetedNos.includes(s.sub_job_no) || targetedNos.some((t) => s.sub_job_no.endsWith(t))) {
        s.costing_status = "pending";
        s.costing_requested_at = now;
      }
    });

    // Sync to wizard_state
    const wizard_state = { ...(job.wizard_state || {}) };
    wizard_state.costReq = now.toISOString();
    if (wizard_state.e?.trophyGroups && Array.isArray(wizard_state.e.trophyGroups)) {
      wizard_state.e.trophyGroups.forEach((tg, idx) => {
        const groupChar = String.fromCharCode(65 + idx);
        (tg.items || []).forEach((item, itemIdx) => {
          const itemSubJobNo = `${job.enquiry_no || 'RD'}-${groupChar}${itemIdx + 1}`;
          if (targetedNos.includes(itemSubJobNo) || targetedNos.some((t) => t.endsWith(`${groupChar}${itemIdx + 1}`))) {
            item.costing_status = "pending";
            item.costing_requested_at = now.toISOString();
          }
        });
        const hasPending = (tg.items || []).some((it) => it.costing_status === "pending");
        if (hasPending) {
          tg.costing_status = "pending";
          tg.costing_requested_at = now.toISOString();
        }
      });
    }
    job.wizard_state = wizard_state;
    job.markModified("wizard_state");
    job.markModified("sub_jobs");

    job.history.push({
      action: "COSTING_REQUESTED",
      step: job.step,
      sub_job_no: targetedNos.join(", "),
      remarks: `Costing requested for ${targetedNos.join(", ")}${notes ? ` (${notes})` : ""}`,
      changed_by: {
        user_id: req.user?._id || req.user?.id || null,
        user_name: req.user?.name || "Coordinator",
        role: req.user?.role || "Coordinator",
      },
      timestamp: now,
    });

    await job.save();

    res.status(200).json({
      success: true,
      message: `Costing requested for ${targetedNos.length} sub-job(s)`,
      data: job,
    });
  } catch (error) {
    console.error("Error in requestCostingForSubJobs:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// 14. Submit BOM Rate and Sync directly to Sub-Job (Single Unit Rate, No Qty Slabs)
export const submitBOMAndSyncRate = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      subJobNo,
      unit_rate,
      sample_rate,
      artwork_charge = 0,
      bom_id = null,
      bom_details = null,
      notes = "",
      rates = null, // Supports batch: [{ subJobNo, unit_rate, sample_rate, artwork_charge, bom_id, bom_details }]
    } = req.body;

    const job = await EnquiryJob.findById(id);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    const now = new Date();
    const rateItems = Array.isArray(rates) && rates.length > 0
      ? rates
      : [{ subJobNo, unit_rate, sample_rate, artwork_charge, bom_id, bom_details }];

    const updatedSubJobNos = [];

    for (const item of rateItems) {
      const targetNo = item.subJobNo;
      let matched = job.sub_jobs.find((s) => s.sub_job_no === targetNo);
      if (!matched) {
        matched = job.sub_jobs.find((s) => s.sub_job_no.endsWith(targetNo) || targetNo?.endsWith(s.sub_job_no));
      }

      if (matched) {
        const uRate = Number((Number(item.unit_rate) || matched.unit_rate || matched.target_rate || 0).toFixed(2));
        const defaultSample = uRate > 0 ? Number((uRate + 200).toFixed(2)) : uRate;
        const sRate = item.sample_rate !== undefined && item.sample_rate !== null && !isNaN(Number(item.sample_rate))
          ? Number(Number(item.sample_rate).toFixed(2))
          : (matched.sample_rate ? Number(Number(matched.sample_rate).toFixed(2)) : defaultSample);
        const aCharge = Number(Number(item.artwork_charge || 0).toFixed(2));

        matched.target_rate = uRate;
        matched.unit_rate = uRate;
        matched.sample_rate = sRate;
        matched.artwork_charge = aCharge;
        matched.line_total = Number((Number(matched.quantity || 1) * uRate).toFixed(2));
        matched.costing_status = "completed";
        matched.quotation_status = "completed";
        matched.costing_completed_at = now;

        // Artwork fee is a 1-time charge per enquiry: if set > 0, clear on all other sub-jobs
        if (aCharge > 0 && Array.isArray(job.sub_jobs)) {
          job.sub_jobs.forEach((other) => {
            if (other.sub_job_no !== matched.sub_job_no) {
              other.artwork_charge = 0;
            }
          });
        }
        if (item.bom_id) {
          try {
            const isObjId = mongoose.Types.ObjectId.isValid(item.bom_id);
            const bDoc = await bomModel.findOne({
              $or: [...(isObjId ? [{ _id: item.bom_id }] : []), { id: String(item.bom_id) }]
            }).select("_id id").lean();
            matched.bom_id = bDoc?._id || (isObjId ? item.bom_id : null);
            matched.bom_nanoid = bDoc?.id || (!isObjId ? String(item.bom_id) : "");
          } catch {
            const isObj = mongoose.Types.ObjectId.isValid(item.bom_id);
            matched.bom_id = isObj ? item.bom_id : null;
            matched.bom_nanoid = !isObj ? String(item.bom_id) : "";
          }
          const validSoBomId = (matched.bom_id && mongoose.Types.ObjectId.isValid(matched.bom_id)) ? matched.bom_id : null;
          salesorderlistModel.updateMany(
            { sub_job_no: matched.sub_job_no },
            { $set: { ...(validSoBomId ? { bom_id: validSoBomId } : {}), bom_nanoid: matched.bom_nanoid || "", is_bom_filled: true } }
          ).catch(() => {});
        }
        if (item.bom_details) matched.bom_details = item.bom_details;

        updatedSubJobNos.push(matched.sub_job_no);

        // Update corresponding trophyGroups entry in wizard_state strictly for this sub-job
        if (job.wizard_state?.e?.trophyGroups && Array.isArray(job.wizard_state.e.trophyGroups)) {
          const match = String(matched.sub_job_no || "").trim().match(/[-_]?([A-Za-z])(\d+)?$/);
          const groupCharFromNo = match ? match[1].toUpperCase() : "";
          const variantNumFromNo = match && match[2] ? parseInt(match[2], 10) : 1;
          const vIdx = matched.size_variant ? matched.size_variant - 1 : (variantNumFromNo - 1);
          const targetGroupIdx = groupCharFromNo ? groupCharFromNo.charCodeAt(0) - 65 : 0;

          job.wizard_state.e.trophyGroups.forEach((tg, idx) => {
            const groupChar = String.fromCharCode(65 + idx);
            if (groupChar === groupCharFromNo || (!groupCharFromNo && idx === 0)) {
              if (Array.isArray(tg.items) && tg.items[vIdx]) {
                tg.items[vIdx].rate = uRate;
                tg.items[vIdx].unit_rate = uRate;
                tg.items[vIdx].sampleRate = sRate;
                tg.items[vIdx].artworkCharge = aCharge;
                tg.items[vIdx].costing_status = "completed";
                if (item.bom_id) tg.items[vIdx].bom_id = item.bom_id;
              }
              const allItemsCompleted =
                Array.isArray(tg.items) &&
                tg.items.length > 0 &&
                tg.items.every((it) => it.costing_status === "completed");
              tg.costing_status = allItemsCompleted ? "completed" : "in_progress";
            }
          });

          job.wizard_state.simulatedRates = job.wizard_state.simulatedRates || {};

          // If this sub-job has artwork > 0, clear artwork fee on all other sub-jobs in simulatedRates and trophyGroups
          if (aCharge > 0) {
            job.wizard_state.e.trophyGroups.forEach((tg, idx) => {
              const groupChar = String.fromCharCode(65 + idx);
              if (Array.isArray(tg.items)) {
                tg.items.forEach((it, itIdx) => {
                  const isCurrent = (groupChar === groupCharFromNo || (!groupCharFromNo && idx === 0)) && itIdx === vIdx;
                  if (!isCurrent && it.artworkCharge) {
                    it.artworkCharge = 0;
                  }
                });
              }
            });
            Object.keys(job.wizard_state.simulatedRates).forEach((k) => {
              if (k !== `${targetGroupIdx}-${vIdx}` && k !== matched.sub_job_no) {
                if (job.wizard_state.simulatedRates[k]?.artwork) {
                  job.wizard_state.simulatedRates[k].artwork = 0;
                }
              }
            });
          }

          const ratePayload = {
            rate: uRate,
            sample: sRate,
            artwork: aCharge,
            costing_status: "completed",
            bom_id: item.bom_id || null,
          };
          job.wizard_state.simulatedRates[`${targetGroupIdx}-${vIdx}`] = ratePayload;
          job.wizard_state.simulatedRates[matched.sub_job_no] = ratePayload;
        }
      }
    }

    if (updatedSubJobNos.length === 0) {
      return res.status(404).json({ success: false, message: "No matching sub-jobs found to sync rates" });
    }

    // Recalculate job financials across all active (non-dropped) sub-jobs
    const activeSubJobs = job.sub_jobs.filter((s) => !s.is_dropped);
    const itemsSubtotal = activeSubJobs.reduce((sum, s) => sum + (Number(s.line_total) || 0), 0);
    const enquiryArtworkCharge = Number(
      job.financials?.artwork_charge !== undefined
        ? job.financials.artwork_charge
        : job.wizard_state?.costing?.artwork !== undefined
          ? job.wizard_state.costing.artwork
          : 1500
    );
    const subtotal = itemsSubtotal + enquiryArtworkCharge;
    const gstRate = job.financials?.gst_rate || 18;
    const gstAmount = Math.round((subtotal * gstRate) / 100);
    const total = subtotal + gstAmount;
    const advanceRecd = Number(job.financials?.advance_received || 0);

    job.financials = {
      ...(job.financials || {}),
      items_subtotal: itemsSubtotal,
      artwork_charge: enquiryArtworkCharge,
      subtotal,
      gst_rate: gstRate,
      gst_amount: gstAmount,
      total,
      balance: Math.max(0, total - advanceRecd),
    };

    // Update wizard_state costing summary
    const firstUpdated = job.sub_jobs.find((s) => updatedSubJobNos.includes(s.sub_job_no));
    if (job.wizard_state) {
      job.wizard_state.costing = {
        rate: firstUpdated?.target_rate || 0,
        sampleRate: firstUpdated?.sample_rate || 0,
        artwork: firstUpdated?.artwork_charge || 0,
        updatedAt: now.toISOString(),
      };
      job.wizard_state.quoteRate = firstUpdated?.target_rate || 0;
      job.wizard_state.jobRate = firstUpdated?.target_rate || 0;
      job.markModified("wizard_state");
    }

    job.markModified("sub_jobs");
    job.markModified("financials");

    job.history.push({
      action: "BOM_RATE_SYNCED",
      step: job.step,
      sub_job_no: updatedSubJobNos.join(", "),
      remarks: `Rate synced for ${updatedSubJobNos.join(", ")}: ₹${firstUpdated?.target_rate}/pc, Sample: ₹${firstUpdated?.sample_rate}/pc, Artwork: ₹${firstUpdated?.artwork_charge}${notes ? ` (${notes})` : ""}`,
      changed_by: {
        user_id: req.user?._id || req.user?.id || null,
        user_name: req.user?.name || "Quotation Specialist",
        role: req.user?.role || "Quotation Specialist",
      },
      timestamp: now,
    });

    await job.save();

    res.status(200).json({
      success: true,
      message: `Rate synced successfully for ${updatedSubJobNos.length} sub-job(s)`,
      data: job,
    });
  } catch (error) {
    console.error("Error in submitBOMAndSyncRate:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// 15. Record Sub-Job Quotes Shared with Client (All or Selective)
export const sendSubJobQuotes = async (req, res) => {
  try {
    const { id } = req.params;
    const { subJobNos = [], channel = "email", notes = "" } = req.body;

    const job = await EnquiryJob.findById(id);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    const now = new Date();
    const targetedNos = Array.isArray(subJobNos) && subJobNos.length > 0
      ? subJobNos
      : job.sub_jobs.filter((s) => !s.is_dropped && !s.is_on_hold && s.costing_status === "completed").map((s) => s.sub_job_no);

    if (targetedNos.length === 0) {
      return res.status(400).json({ success: false, message: "No completed sub-jobs selected to send quote" });
    }

    const actuallyShared = [];
    job.sub_jobs.forEach((s) => {
      if (targetedNos.includes(s.sub_job_no) || targetedNos.some((t) => s.sub_job_no.endsWith(t))) {
        // Hold and dropped sub-jobs must not have quotes shared
        if (s.is_on_hold || s.is_dropped) return;
        s.quote_shared = true;
        s.quote_shared_at = now;
        s.quote_channel = channel;
        actuallyShared.push(s.sub_job_no);
      }
    });

    if (actuallyShared.length === 0) {
      return res.status(400).json({ success: false, message: "Selected sub-jobs are on hold or dropped and cannot be quoted." });
    }

    // Update wizard_state
    const wizard_state = { ...(job.wizard_state || {}) };
    wizard_state.quoted = true;
    wizard_state.quoteVia = channel;
    wizard_state.quoteSharedAt = now.toISOString();
    job.wizard_state = wizard_state;
    job.markModified("wizard_state");
    job.markModified("sub_jobs");

    job.history.push({
      action: "QUOTATION_SHARED",
      step: job.step,
      sub_job_no: targetedNos.join(", "),
      remarks: `Quotation sent to client via ${channel} for ${targetedNos.join(", ")}${notes ? ` (${notes})` : ""}`,
      changed_by: {
        user_id: req.user?._id || req.user?.id || null,
        user_name: req.user?.name || "Coordinator",
        role: req.user?.role || "Coordinator",
      },
      timestamp: now,
    });

    await job.save();

    res.status(200).json({
      success: true,
      message: `Quotation marked as sent for ${targetedNos.length} sub-job(s)`,
      data: job,
    });
  } catch (error) {
    console.error("Error in sendSubJobQuotes:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// 16. Record Client Decision on Sub-Job Quote (Admin / Client Servicing or Internal)
export const updateQuoteDecision = async (req, res) => {
  try {
    const { id } = req.params;
    const { subJobNo, subJobNos = [], decision = "approved", notes = "", channel = "Phone Call" } = req.body;

    let job = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      job = await EnquiryJob.findById(id).populate("customer_id");
    }
    if (!job) {
      job = await EnquiryJob.findOne({
        $or: [{ enquiry_no: id }, { enquiry_no: "RD" + id }, { seq: Number(id) || -1 }],
      }).populate("customer_id");
    }
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    const now = new Date();
    const targetedSubJobs = (job.sub_jobs || []).filter((sj) => {
      if (sj.is_dropped || sj.is_on_hold) return false;
      if (Array.isArray(subJobNos) && subJobNos.length > 0) {
        return subJobNos.includes(sj.sub_job_no) || subJobNos.some((t) => sj.sub_job_no?.endsWith(t));
      }
      if (subJobNo && subJobNo !== "all") {
        return sj.sub_job_no === subJobNo || sj.sub_job_no?.endsWith(subJobNo) || subJobNo?.endsWith(sj.sub_job_no);
      }
      return true;
    });

    if (targetedSubJobs.length === 0) {
      return res.status(404).json({ success: false, message: `No active sub-jobs found for decision: ${subJobNo || "all"}` });
    }

    targetedSubJobs.forEach((sj) => {
      sj.client_quote_decision = decision;
      sj.client_quote_decision_at = now;
      sj.client_quote_decision_notes = notes;
      sj.client_quote_communication = channel || "Internal - Client Servicing / Admin";
    });

    job.markModified("sub_jobs");

    const wizard_state = { ...(job.wizard_state || {}) };
    wizard_state.client_quote_decision = decision;
    wizard_state.decision = {
      decision,
      channel: channel || "Phone Call",
      notes: notes || "",
      at: now.toISOString(),
      by: req.user?.name || "Client Servicing / Admin",
    };
    if (decision === "approved") {
      wizard_state.quoteApproved = true;
    } else {
      wizard_state.quoteApproved = false;
      if (decision === "rejected") {
        const fullLostReason = notes || "Client declined quotation / abandoned";
        wizard_state.lost = fullLostReason;
        wizard_state.is_lost = true;
        wizard_state.stage = "cancelled";
        wizard_state.isLocked = true;
        job.is_lost = true;
        job.stage = "cancelled";
        job.lost_stage = "quotation";
        job.lost_reason = fullLostReason;
        job.lost_at = now;
        job.lost_by = req.user?._id || req.user?.id || null;

        // Mark all active targeted sub-jobs as dropped & cancelled
        targetedSubJobs.forEach((sj) => {
          sj.is_dropped = true;
          sj.drop_reason = fullLostReason;
          sj.stage = "cancelled";
        });
      }
    }
    job.wizard_state = wizard_state;
    job.markModified("wizard_state");

    const subJobCodes = targetedSubJobs.map((s) => s.sub_job_no).join(", ");
    job.history.push({
      action: `QUOTE_DECISION_${decision.toUpperCase()}`,
      step: job.step,
      sub_job_no: subJobCodes,
      remarks: `Internal Quote Decision for ${subJobCodes}: ${decision.toUpperCase()} via ${channel || "Phone Call"}${notes ? ` (${notes})` : ""}`,
      changed_by: {
        user_id: req.user?._id || req.user?.id || null,
        user_name: req.user?.name || "Coordinator",
        role: req.user?.role || "Coordinator",
      },
      timestamp: now,
    });

    await job.save();

    if (decision === "rejected" && job.customer_id) {
      await syncCustomerStats(job.customer_id);
    }

    res.status(200).json({
      success: true,
      message: `Quote decision recorded: ${decision}`,
      data: job,
      sub_jobs: job.sub_jobs,
    });
  } catch (error) {
    console.error("Error in updateQuoteDecision:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// 17. Get Enquiries & Sub-Jobs Pending Costing (For Integration Quotation Desk)
export const getPendingCostingSubJobs = async (req, res) => {
  try {
    const { status = "all", search = "" } = req.query;

    const query = {
      is_lost: { $ne: true },
      // Must be either design approved OR have costing requested
      $or: [
        { "the_brief.design_status": "approved" },
        { "wizard_state.designApproved": true },
        { "wizard_state.designStatus": "approved" },
        { "sub_jobs.costing_status": { $in: ["pending", "in_progress", "completed"] } },
      ],
    };

    const jobs = await EnquiryJob.find(query)
      .populate("customer_id", "name company_name email mobile_no contact_person")
      .populate("assigned_to", "name")
      .sort({ updatedAt: -1 })
      .lean();

    const signSafe = (url) => {
      if (!url || typeof url !== "string") return null;
      if (url.startsWith("blob:") || url.startsWith("data:")) return url;
      // Do not re-sign if it's an external web URL not hosted on Cloudflare R2
      if (url.startsWith("http://") || url.startsWith("https://")) {
        if (!url.includes("r2.cloudflarestorage.com")) {
          return url;
        }
      }
      try {
        const signed = generateSignedUrl(url, 7 * 86400);
        return signed || url;
      } catch (err) {
        console.warn("Error signing R2 URL in getPendingCostingSubJobs:", err?.message || err);
        return url;
      }
    };

    const allSubJobs = [];

    jobs.forEach((job) => {
      const e = job.wizard_state?.e || {};
      const trophyGroups = Array.isArray(e.trophyGroups) ? e.trophyGroups : [];
      const watermarkedDesigns = job.wizard_state?.watermarkedDesigns || {};
      const uploadedDesigns = job.wizard_state?.uploadedDesigns || {};
      const productFeedback = job.wizard_state?.productFeedback || {};

      const subJobs = Array.isArray(job.sub_jobs) ? job.sub_jobs : [];

      subJobs.forEach((s) => {
        if (Array.isArray(s.designer_files)) {
          s.designer_files = s.designer_files.map(signSafe).filter(Boolean);
        }
        if (Array.isArray(s.dtp_files)) {
          s.dtp_files = s.dtp_files.map((df) => ({
            ...df,
            file_url: signSafe(df.file_url || df.url) || df.file_url || df.url,
            file_name: df.file_name || (df.file_url ? df.file_url.split("/").pop() : "artwork"),
            file_type: df.file_type || ((df.file_url || "").toLowerCase().endsWith(".cdr") ? "cdr" : "pdf"),
          }));
        }

        // Find group index by parsing sub_job_no (e.g. RD21075-A1 -> 'A' -> 0)
        let groupIdx = 0;
        const match = s.sub_job_no ? s.sub_job_no.match(/-([A-Z])(\d+)?$/i) : null;
        if (match && match[1]) {
          groupIdx = match[1].toUpperCase().charCodeAt(0) - 65;
        }

        const group = trophyGroups[groupIdx] || {};

        // Find approved design preview image for this trophy group
        const fb = productFeedback[groupIdx] || productFeedback[String(groupIdx)];
        const fbArr = Array.isArray(fb) ? fb : (fb ? [fb] : []);
        const approvedFb = fbArr.find((f) => f && f.mode === "approve");
        const approvedOptIdx = (approvedFb && approvedFb.optIdxs && approvedFb.optIdxs[0] !== undefined)
          ? approvedFb.optIdxs[0]
          : 0;

        const specificKey = `${groupIdx}-${approvedOptIdx}`;
        const defaultGroupKey = `${groupIdx}-0`;

        let approvedDesignUrl =
          watermarkedDesigns[specificKey] ||
          uploadedDesigns[specificKey] ||
          watermarkedDesigns[defaultGroupKey] ||
          uploadedDesigns[defaultGroupKey] ||
          null;

        // Check if design or proof files are attached directly to this sub-job
        if (!approvedDesignUrl && Array.isArray(s.design_files) && s.design_files.length > 0) {
          approvedDesignUrl = s.design_files[0]?.signed_url || s.design_files[0]?.url || s.design_files[0]?.file_url;
        }
        if (!approvedDesignUrl && Array.isArray(s.proof_files) && s.proof_files.length > 0) {
          approvedDesignUrl = s.proof_files[0]?.signed_url || s.proof_files[0]?.url || s.proof_files[0]?.file_url;
        }

        approvedDesignUrl = signSafe(approvedDesignUrl);

        // Find reference image
        let refImageUrl = null;
        if (Array.isArray(s.ref_files) && s.ref_files.length > 0) {
          refImageUrl = s.ref_files[0]?.signed_url || s.ref_files[0]?.url || s.ref_files[0]?.file_url || s.ref_files[0];
        }
        if (!refImageUrl && group.theme && job.the_brief?.product_briefs?.[group.theme]?.refs?.length > 0) {
          const r = job.the_brief.product_briefs[group.theme].refs[0];
          refImageUrl = r?.signed_url || r?.url || r?.file_url;
        }
        if (!refImageUrl) {
          refImageUrl = s.reference_image || group.reference_images?.[0] || job.the_ask?.reference_images?.[0] || null;
        }
        if (refImageUrl && typeof refImageUrl === "object") {
          refImageUrl = refImageUrl.signed_url || refImageUrl.url || refImageUrl.path || refImageUrl.file_url || null;
        }
        refImageUrl = signSafe(refImageUrl);

        // Sub-Job costing status:
        // Must have costing requested or designer production artwork uploaded (.cdr/.pdf)
        const artworkUploaded = Boolean(
          s.is_design_uploaded === true ||
          (Array.isArray(s.designer_files) && s.designer_files.length > 0) ||
          (Array.isArray(s.dtp_files) && s.dtp_files.length > 0)
        );

        let effectiveCostingStatus = s.costing_status;
        if (!effectiveCostingStatus || effectiveCostingStatus === "not_requested") {
          if (artworkUploaded) {
            effectiveCostingStatus = "pending";
          } else {
            effectiveCostingStatus = "not_requested";
          }
        }

        // Sub-jobs pending designer artwork upload must NOT appear in Quotation Desk yet
        if (effectiveCostingStatus === "not_requested") {
          return;
        }

        const flattenedSubJob = {
          _id: `${job._id}_${s.sub_job_no}`,
          job_id: job._id,
          enquiry_no: job.enquiry_no || (job.seq ? `RD${job.seq}` : ""),
          seq: job.seq,
          customer_id: job.customer_id?._id,
          customer_name: job.customer_id?.company_name || job.customer_id?.name || "Client",
          customer_email: job.customer_id?.email || job.contact_email || "",
          customer_mobile: job.customer_id?.mobile_no || job.customer_id?.mobile || job.contact_mobile || "",
          coordinator_name: job.coordinator_name || job.assigned_to?.name || "Coordinator",
          event_date: job.event_date || job.the_ask?.event_date || null,
          delivery_date:
            job.job_completion_date ||
            job.the_ask?.job_completion_date ||
            job.delivery_details?.job_completion_date ||
            job.wizard_state?.e?.job_completion_date ||
            job.wizard_state?.e?.jobCompletionDate ||
            job.needed_by_date ||
            job.delivery_date ||
            job.the_ask?.needed_by_date ||
            job.the_ask?.delivery_date ||
            null,
          job_completion_date:
            job.job_completion_date ||
            job.the_ask?.job_completion_date ||
            job.delivery_details?.job_completion_date ||
            null,
          actual_needed_date:
            job.needed_by_date ||
            job.delivery_date ||
            job.the_ask?.needed_by_date ||
            job.the_ask?.delivery_date ||
            null,
          created_at: job.createdAt,
          updated_at: job.updatedAt,

          sub_job_no: s.sub_job_no,
          trophy_name: s.product_name || s.name || group.productName || group.theme || job.the_ask?.theme || job.the_ask?.product_name || "Custom Trophy",
          theme: s.theme || group.theme || job.the_ask?.theme || "",
          size: s.size || (group.items && group.items[s.size_variant - 1]?.size) || job.the_ask?.size || "Standard",
          quantity: s.quantity || s.qty || 1,
          specs: s.specs || s.material || group.specs || group.material || job.the_ask?.specs || job.the_ask?.material || "",
          material: s.material || s.specs || group.material || group.specs || job.the_ask?.material || "",

          approved_design_url: approvedDesignUrl || refImageUrl,
          reference_image_url: refImageUrl || approvedDesignUrl,
          designer_files: [
            ...(Array.isArray(s.designer_files) ? s.designer_files : []),
            ...(Array.isArray(s.dtp_files) ? s.dtp_files.map((df) => df.file_url || df.url) : []),
          ]
            .filter(Boolean)
            .map(signSafe)
            .filter(Boolean),
          dtp_files: Array.isArray(s.dtp_files)
            ? s.dtp_files.map((df) => ({
                ...df,
                file_url: signSafe(df.file_url || df.url) || df.file_url || df.url,
                file_name: df.file_name || (df.file_url ? df.file_url.split("/").pop() : "artwork"),
                file_type: df.file_type || ((df.file_url || "").toLowerCase().endsWith(".cdr") ? "cdr" : "pdf"),
              }))
            : [],

          costing_status: effectiveCostingStatus,
          quotation_status: effectiveCostingStatus === "completed" ? "completed" : "requested",
          costing_requested_at: s.costing_requested_at || job.updatedAt,
          costing_completed_at: s.costing_completed_at || null,

          unit_rate: s.target_rate || s.unit_rate || 0,
          sample_rate: s.sample_rate || 0,
          artwork_charge: s.artwork_charge || 0,
          bom_id: s.bom_id || null,
          bom_details: s.bom_details || null,
          is_on_hold: Boolean(s.is_on_hold),
          is_dropped: Boolean(s.is_dropped),

          full_job: job,
        };

        allSubJobs.push(flattenedSubJob);
      });
    });

    // Resolve existing BOMs for sub-jobs that may have been created or drafted
    const subJobNos = allSubJobs.map((s) => s.sub_job_no).filter(Boolean);
    const cleanNos = subJobNos.map((n) => String(n).trim().replace(/^RD/i, ""));
    const withRdNos = cleanNos.map((n) => `RD${n}`);
    const allPossibleNos = [...new Set([...subJobNos, ...cleanNos, ...withRdNos])];

    const existingBOMs = await bomModel.find({
      sub_job_no: { $in: allPossibleNos },
    }).select("_id id sub_job_no quotation totalUnitCost is_bom_draft createdAt").lean();

    allSubJobs.forEach((sj) => {
      const sSub = String(sj.sub_job_no || "").trim().replace(/^RD/i, "");
      const matchedBOM = existingBOMs.find((b) => {
        const bSub = String(b.sub_job_no || "").trim().replace(/^RD/i, "");
        return bSub.toLowerCase() === sSub.toLowerCase();
      });

      if (matchedBOM) {
        const jobCreated = sj.full_job?.createdAt ? new Date(sj.full_job.createdAt) : null;
        const reqAt = sj.costing_requested_at ? new Date(sj.costing_requested_at) : null;
        const bomCreated = matchedBOM.createdAt ? new Date(matchedBOM.createdAt) : null;

        const isStale = Boolean(
          (jobCreated && bomCreated && bomCreated < jobCreated) ||
          (reqAt && bomCreated && bomCreated < reqAt)
        );

        if (!isStale) {
          sj.bom_id = matchedBOM._id || matchedBOM.id;
          sj.bom_nanoid = matchedBOM.id || "";
          if (!matchedBOM.is_bom_draft) {
            sj.costing_status = "completed";
            sj.quotation_status = "completed";
            if (matchedBOM.quotation?.finalUnitPrice && !sj.unit_rate) {
              sj.unit_rate = Number(Number(matchedBOM.quotation.finalUnitPrice).toFixed(2));
            }
            if (matchedBOM.quotation?.samplePrice && !sj.sample_rate) {
              sj.sample_rate = Number(Number(matchedBOM.quotation.samplePrice).toFixed(2));
            } else if (sj.unit_rate > 0 && !sj.sample_rate) {
              sj.sample_rate = Number((sj.unit_rate + 200).toFixed(2));
            }
          } else if (sj.costing_status !== "completed") {
            sj.costing_status = "in_progress";
          }
        }
      }
    });

    // Counts across all active (non-dropped) sub-jobs
    const activeSubJobs = allSubJobs.filter((sj) => !sj.is_dropped);
    const counts = {
      all: activeSubJobs.length,
      requested: activeSubJobs.filter((sj) => sj.costing_status === "pending").length,
      draft: activeSubJobs.filter((sj) => sj.costing_status === "in_progress").length,
      completed: activeSubJobs.filter((sj) => sj.costing_status === "completed").length,
    };

    // Filter by active status tab
    let filtered = activeSubJobs;
    if (status === "pending" || status === "requested") {
      filtered = activeSubJobs.filter((sj) => sj.costing_status === "pending");
    } else if (status === "draft" || status === "in_progress") {
      filtered = activeSubJobs.filter((sj) => sj.costing_status === "in_progress");
    } else if (status === "completed") {
      filtered = activeSubJobs.filter((sj) => sj.costing_status === "completed");
    }

    // Filter by search query
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter((sj) => {
        return (
          (sj.enquiry_no && sj.enquiry_no.toLowerCase().includes(q)) ||
          (sj.sub_job_no && sj.sub_job_no.toLowerCase().includes(q)) ||
          (sj.customer_name && sj.customer_name.toLowerCase().includes(q)) ||
          (sj.trophy_name && sj.trophy_name.toLowerCase().includes(q)) ||
          (sj.coordinator_name && sj.coordinator_name.toLowerCase().includes(q))
        );
      });
    }

    res.status(200).json({
      success: true,
      count: filtered.length,
      sub_jobs: filtered,
      data: jobs,
      counts,
    });
  } catch (error) {
    console.error("Error in getPendingCostingSubJobs:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// 18. Public Endpoint for Client Quotation Preview (No Auth Required)
export const getPublicQuoteView = async (req, res) => {
  try {
    const { id } = req.params;
    let job = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      job = await EnquiryJob.findById(id).populate("customer_id");
    }

    if (!job) {
      job = await EnquiryJob.findOne({
        $or: [{ enquiry_no: id }, { enquiry_no: "RD" + id }, { seq: Number(id) || -1 }],
      }).populate("customer_id");
    }

    if (!job) {
      return res.status(404).json({ success: false, message: "Quotation preview not found" });
    }

    const authCheck = verifyPublicLink(job, req);
    if (!authCheck.valid) {
      return res.status(authCheck.status || 403).json({ success: false, message: authCheck.message });
    }

    // Enrich sub-jobs with calculated unit rate and status from BOMs, wizard_state simulatedRates, or costing lines
    try {
      const boms = await bomModel.find({
        $or: [
          { enquiry_id: job._id },
          { sub_job_no: { $in: (job.sub_jobs || []).map((s) => s.sub_job_no).filter(Boolean) } },
          { sub_job_no: { $in: (job.sub_jobs || []).map((s) => s.sub_job_no?.replace(/^RD/, "")).filter(Boolean) } },
          { _id: { $in: (job.sub_jobs || []).map((s) => s.bom_id).filter(Boolean) } },
          { id: { $in: (job.sub_jobs || []).map((s) => s.bom_id).filter(Boolean) } },
        ],
      }).lean();

      const { enrichedSubJobs, hasUpdates } = enrichSubJobsWithBOMAndSimulatedRates(job, boms);
      job.sub_jobs = enrichedSubJobs;

      if (hasUpdates) {
        await EnquiryJob.updateOne({ _id: job._id }, { $set: { sub_jobs: job.sub_jobs } });
      }
    } catch (bomErr) {
      console.warn("Could not enrich BOM in getPublicQuoteView:", bomErr.message);
    }

    const cust = job.customer_id || {};
    const e = job.wizard_state?.e || {};

    const formatAddress = (addr) => {
      if (!addr) return "";
      if (typeof addr === "string") return addr.trim();
      if (Array.isArray(addr)) {
        for (const item of addr) {
          const res = formatAddress(item);
          if (res) return res;
        }
        return "";
      }
      if (typeof addr === "object") {
        if (addr.address && typeof addr.address === "string") return addr.address.trim();
        if (addr.full_address && typeof addr.full_address === "string") return addr.full_address.trim();
        const parts = [
          addr.address_1,
          addr.address_2,
          addr.city,
          addr.state,
          addr.postal_code || addr.pincode || addr.pin,
        ].filter((p) => p !== undefined && p !== null && String(p).trim() !== "")
         .map((p) => String(p).trim());
        if (parts.length > 0) return parts.join(", ");
        if (addr.label) return String(addr.label);
      }
      return String(addr);
    };

    const rawBilling = cust.billing_address || (Array.isArray(cust.address) ? cust.address.find((a) => a.is_billing) || cust.address[0] : cust.address);
    const billingStr = formatAddress(rawBilling);
    const rawCustGstin = cust.gst_no || cust.gstin || (rawBilling && typeof rawBilling === "object" ? rawBilling.gst_no : "") || "";
    const gstinStr = typeof rawCustGstin === "object" ? (rawCustGstin?.gst_no || "") : String(rawCustGstin || "");

    const billTo = job.wizard_state?.billTo || job.order_mode?.bill_to || null;
    const isDifferentBillingParty = Boolean(billTo && billTo.on && (billTo.name || billTo.address));

    const effCustomerName = isDifferentBillingParty ? (billTo.name || cust.company_name || cust.name || "Client") : (cust.company_name || cust.name || "Client");
    const effBillingStr = isDifferentBillingParty ? (formatAddress(billTo.address) || billingStr) : billingStr;
    const effGstinStr = isDifferentBillingParty ? (typeof billTo.gstin === "object" ? (billTo.gstin?.gst_no || "") : (billTo.gstin || gstinStr)) : gstinStr;
    const effContactName = isDifferentBillingParty && billTo.contact?.name ? billTo.contact.name : (job.contact_person || cust.contact_person || "Client Contact");
    const effContactMobile = isDifferentBillingParty && billTo.contact?.phone ? billTo.contact.phone : (job.contact_mobile || cust.contact_number || "");
    const effContactEmail = isDifferentBillingParty && billTo.contact?.email ? billTo.contact.email : (job.contact_email || cust.contact_email || "");

    const effectiveDesigns = await getEffectiveClientDesigns(job);

    let piState = job.wizard_state?.pi ? { ...job.wizard_state.pi } : null;
    if (piState && piState.file_url) {
      try {
        piState.signed_file_url = await generateSignedUrl(piState.file_url);
      } catch (signErr) {
        console.warn("Could not sign PI file_url:", signErr.message);
        piState.signed_file_url = piState.file_url;
      }
    }

    const publicQuoteData = {
      _id: job._id,
      enquiry_no: job.enquiry_no,
      seq: job.seq,
      bill_to: billTo,
      customer: {
        id: cust._id,
        name: effCustomerName,
        billing: effBillingStr,
        gstin: effGstinStr,
        city: cust.city || "",
        state: cust.state || "",
      },
      contact: {
        id: job.contact_id,
        name: effContactName,
        mobile: effContactMobile,
        email: effContactEmail,
      },
      coordinator_name: job.coordinator_name || "Coordinator",
      sub_jobs: (job.sub_jobs || []).filter((sj) => !sj.is_dropped && !sj.is_on_hold).map((sj) => ({
        sub_job_no: sj.sub_job_no,
        product_name: sj.product_name,
        theme: sj.theme,
        size: sj.size,
        quantity: sj.quantity,
        unit_rate: sj.unit_rate,
        target_rate: sj.target_rate,
        sample_rate: sj.sample_rate,
        artwork_charge: sj.artwork_charge,
        costing_status: sj.costing_status,
        is_dropped: sj.is_dropped,
        is_on_hold: sj.is_on_hold,
        quote_shared: sj.quote_shared,
        quote_shared_at: sj.quote_shared_at,
        quote_channel: sj.quote_channel,
        spec_line: sj.spec_line,
        category: sj.category,
        client_quote_decision: sj.client_quote_decision,
        client_quote_decision_at: sj.client_quote_decision_at,
        client_quote_decision_notes: sj.client_quote_decision_notes,
        client_quote_communication: sj.client_quote_communication,
      })),
      the_ask: job.the_ask || {},
      the_brief: job.the_brief || {},
      delivery_details: job.delivery_details || {},
      uploadedDesigns: effectiveDesigns,
      trophyGroups: e.trophyGroups || [],
      wizard_state: {
        ...(job.wizard_state || {}),
        pi: piState || job.wizard_state?.pi || null,
        costing: job.wizard_state?.costing || null,
        quoted: job.wizard_state?.quoted || false,
        quoteVia: job.wizard_state?.quoteVia || null,
        quoteSharedAt: job.wizard_state?.quoteSharedAt || null,
        sampleCarrier: job.wizard_state?.sampleCarrier || job.delivery_details?.delivery_mode || null,
        sampleFreight: job.wizard_state?.sampleFreight || job.delivery_details?.who_pays || null,
        sampleChargesAmount: job.wizard_state?.sampleChargesAmount || job.delivery_details?.delivery_cost || 0,
        sampleChargesState: job.wizard_state?.sampleChargesState || null,
        sampleShipTo: job.wizard_state?.sampleShipTo || job.wizard_state?.shipTo || null,
        sampleReceiver: job.wizard_state?.sampleReceiver || null,
        sampleWhen: job.wizard_state?.sampleWhen || null,
      },
      links_duration: job.the_brief?.links_duration || e.links_duration || 24,
      createdAt: job.createdAt,
    };

    return res.status(200).json({
      success: true,
      data: publicQuoteData,
    });
  } catch (error) {
    console.error("Error fetching public quote view:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching quotation preview",
      error: error.message,
    });
  }
};

// 19. Send Quotation Email to Client via System Mailer
export const sendQuotationEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { to_email, client_link, contact_name, duration, subJobNos = [], notes = "" } = req.body || {};

    let job = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      job = await EnquiryJob.findById(id).populate("customer_id");
    }
    if (!job) {
      job = await EnquiryJob.findOne({
        $or: [{ enquiry_no: id }, { enquiry_no: "RD" + id }, { seq: Number(id) || -1 }],
      }).populate("customer_id");
    }

    if (!job) {
      return res.status(404).json({ success: false, message: "Enquiry job not found" });
    }

    // Enrich sub-jobs with calculated unit rate and status from BOMs, wizard_state simulatedRates, or costing lines
    try {
      const boms = await bomModel.find({
        $or: [
          { enquiry_id: job._id },
          { sub_job_no: { $in: (job.sub_jobs || []).map((s) => s.sub_job_no).filter(Boolean) } },
          { sub_job_no: { $in: (job.sub_jobs || []).map((s) => s.sub_job_no?.replace(/^RD/, "")).filter(Boolean) } },
          { _id: { $in: (job.sub_jobs || []).map((s) => s.bom_id).filter(Boolean) } },
          { id: { $in: (job.sub_jobs || []).map((s) => s.bom_id).filter(Boolean) } },
        ],
      }).lean();

      const { enrichedSubJobs } = enrichSubJobsWithBOMAndSimulatedRates(job, boms);
      job.sub_jobs = enrichedSubJobs;
    } catch (bomErr) {
      console.warn("Could not enrich BOM in sendQuotationEmail:", bomErr.message);
    }

    const customer = job.customer_id || {};
    const e = job.wizard_state?.e || {};
    const recipientEmail = (to_email || job.contact_email || customer.email || e.contactEmail || "").trim();

    if (!recipientEmail) {
      return res.status(400).json({ success: false, message: "No valid recipient email address found" });
    }

    const parentJobNo = job.enquiry_no || (job.seq ? `RD${job.seq}` : "RD");
    const durationHours = Number(duration || job.the_brief?.links_duration || e.links_duration || 24);

    const expiryTimestamp = Date.now() + durationHours * 60 * 60 * 1000;
    const expiryDateFormatted = new Date(expiryTimestamp).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const targetedNos = Array.isArray(subJobNos) && subJobNos.length > 0
      ? subJobNos
      : job.sub_jobs.filter((s) => !s.is_dropped && s.costing_status === "completed").map((s) => s.sub_job_no);

    const activeSubJobs = job.sub_jobs.filter((s) =>
      targetedNos.length > 0
        ? targetedNos.includes(s.sub_job_no) || targetedNos.some((t) => s.sub_job_no.endsWith(t))
        : !s.is_dropped
    );

    const subJobCode = targetedNos.length > 0
      ? targetedNos.join(", ")
      : (activeSubJobs[0]?.sub_job_no || `${parentJobNo}-A1`);
    const clientName = contact_name || job.contact_person || customer.contact_person || customer.name || "Client";

    let targetLink = client_link;
    if (!targetLink) {
      const baseUrl = process.env.CLIENT_CONFIRMATION_SCREEN_URL || "http://localhost:5173";
      const targetId = String(job._id || job.enquiry_no || job.seq);
      const { token, exp, sig } = generatePublicToken(targetId, durationHours);
      const subjobsParam = targetedNos.length > 0 ? `&subjobs=${encodeURIComponent(targetedNos.join(","))}` : "";
      targetLink = `${baseUrl}/rd/quote-view/${targetId}?token=${token}&exp=${exp}&sig=${sig}${subjobsParam}`;
    }

    const enquiryArtworkCharge = Number(
      job.financials?.artwork_charge !== undefined
        ? job.financials.artwork_charge
        : job.wizard_state?.costing?.artwork !== undefined
          ? job.wizard_state.costing.artwork
          : 1500
    );

    let itemsSubtotal = 0;
    let quoteItemsRows = activeSubJobs.map((sj, idx) => {
      const rate = Number(sj.target_rate || sj.unit_rate || 0);
      const qty = Number(sj.quantity || 1);
      const lineTotal = qty * rate;
      itemsSubtotal += lineTotal;

      return `
        <tr style="background-color:${idx % 2 === 0 ? "#ffffff" : "#f8f9fa"};">
          <td style="text-align:center; padding:12px; border-bottom:1px solid #e6e6e6; color:#333;">${idx + 1}</td>
          <td style="padding:12px; border-bottom:1px solid #e6e6e6; color:#333; font-weight:600;">
            <div>${sj.sub_job_no} ${sj.theme || sj.product_name || "Custom Trophy"}</div>
            <div style="font-size:12px; color:#777; font-weight:normal;">${sj.spec_line || `${sj.theme || sj.product_name || "Custom Trophy"} · ${sj.size || 8} in`}</div>
          </td>
          <td style="text-align:center; padding:12px; border-bottom:1px solid #e6e6e6; color:#333;">${qty} pcs</td>
          <td style="text-align:right; padding:12px; border-bottom:1px solid #e6e6e6; color:#333;">₹${rate.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/pc</td>
          <td style="text-align:right; padding:12px; border-bottom:1px solid #e6e6e6; color:#004aad; font-weight:bold;">₹${lineTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      `;
    }).join("");

    if (enquiryArtworkCharge > 0) {
      quoteItemsRows += `
        <tr style="background-color:#eef2ff;">
          <td style="text-align:center; padding:12px; border-bottom:1px solid #e6e6e6; color:#4338ca; font-weight:600;">${activeSubJobs.length + 1}</td>
          <td style="padding:12px; border-bottom:1px solid #e6e6e6; color:#1e1b4b; font-weight:700;">
            <div>1-Time Setup & Artwork Fee</div>
            <div style="font-size:12px; color:#6366f1; font-weight:normal;">Enquiry-level artwork processing & setup (1-time fee across all items)</div>
          </td>
          <td style="text-align:center; padding:12px; border-bottom:1px solid #e6e6e6; color:#4338ca; font-weight:600;">1 Lot</td>
          <td style="text-align:right; padding:12px; border-bottom:1px solid #e6e6e6; color:#4338ca; font-weight:600;">₹${enquiryArtworkCharge.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="text-align:right; padding:12px; border-bottom:1px solid #e6e6e6; color:#004aad; font-weight:bold;">₹${enquiryArtworkCharge.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      `;
    }

    const totalQuoteAmount = itemsSubtotal + enquiryArtworkCharge;

    if (!quoteItemsRows) {
      quoteItemsRows = `<tr><td colspan="5" style="text-align:center; padding:20px; color:#777;">No active quotation items</td></tr>`;
    }

    const emailHTML = `
      <html>
        <body style="margin:0; padding:0; background-color:#f4f6f8; font-family:'Segoe UI', Arial, sans-serif;">
          <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f6f8; padding:30px 0;">
            <tr>
              <td align="center">
                <table width="750" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
                  <!-- HEADER -->
                  <tr>
                    <td align="center" style="background-color:#004aad; padding:25px 30px;">
                      <h2 style="color:#ffffff; font-size:22px; margin:0;">Quotation - RD Custom Awards</h2>
                    </td>
                  </tr>

                  <!-- JOB NUMBER + LOGO -->
                  <tr>
                    <td style="padding-top:25px; padding-right:30px; padding-left:30px; text-align:left;">
                      <div>
                        <img 
                          src="https://rdcustomawards.com/cdn/shop/files/logo.svg?v=1700546283&width=90" 
                          alt="RD Custom Awards Logo" 
                          style="max-width:170px; height:auto;"
                        />
                      </div>
                      <div style="font-size:16px; font-weight:600; color:#004aad; margin-top:8px;">
                        Job Ref: ${parentJobNo} (${subJobCode})
                      </div>
                    </td>
                  </tr>

                  <!-- BODY CONTENT -->
                  <tr>
                    <td style="padding:25px 30px;">
                      <p style="font-size:16px; color:#333; margin:0 0 15px;">
                        Dear <strong>${clientName}</strong>,
                      </p>

                      <p style="font-size:15px; line-height:1.6; color:#555; margin:0 0 25px;">
                        Thank you for considering <strong>RD Custom Awards</strong>. Please find our commercial quotation for enquiry <strong>${parentJobNo}</strong> below.
                      </p>

                      <!-- REVIEW BUTTON -->
                      <p style="text-align:center; margin:20px 0 10px;">
                        <a 
                          href="${targetLink}" 
                          target="_blank"
                          style="display:inline-block; padding:12px 28px; background-color:#004aad; color:#ffffff; text-decoration:none; border-radius:6px; font-weight:600; font-size:15px;"
                        >
                          View & Approve Quotation
                        </a>
                      </p>

                      <!-- EXPIRY MESSAGE -->
                      <p style="text-align:center; font-size:13px; color:#777; margin:0 0 25px;">
                        🔒 This quotation link is valid until <strong>${expiryDateFormatted}</strong>
                      </p>

                      <!-- ITEMS TABLE -->
                      <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; font-size:14px; margin-bottom:25px;">
                        <thead>
                          <tr style="background-color:#004aad; color:#ffffff;">
                            <th style="padding:12px;">#</th>
                            <th style="padding:12px; text-align:left;">Item Details</th>
                            <th style="padding:12px;">Qty</th>
                            <th style="padding:12px; text-align:right;">Unit Rate</th>
                            <th style="padding:12px; text-align:right;">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${quoteItemsRows}
                        </tbody>
                        <tfoot>
                          <tr style="background-color:#f1f5f9; font-weight:bold;">
                            <td colspan="4" style="text-align:right; padding:12px; color:#333;">Total (Excl. GST):</td>
                            <td style="text-align:right; padding:12px; color:#004aad; font-size:16px;">₹${totalQuoteAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                        </tfoot>
                      </table>

                      <div style="font-size:13px; color:#666; background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:25px;">
                        <p style="margin:0 0 5px; font-weight:600; color:#333;">Commercial Terms:</p>
                        <p style="margin:0 0 4px;">• All amounts are exclusive of GST.</p>
                        <p style="margin:0 0 4px;">• Payment Terms: 100% advance upon confirmation.</p>
                        <p style="margin:0;">• Please reply or approve via the link above to proceed to sample or production.</p>
                      </div>

                      <p style="font-size:14px; color:#555; margin-top:20px;">
                        Thank you for choosing <strong>RD Custom Awards</strong>.<br/>
                        Warm regards,<br/>
                        <strong>RD Custom Awards Pvt. Ltd.</strong>
                      </p>
                    </td>
                  </tr>

                  <!-- FOOTER -->
                  <tr>
                    <td align="center" style="background-color:#f8f9fa; padding:15px; border-top:1px solid #eee;">
                      <p style="font-size:12px; color:#777; margin:0;">
                        © ${new Date().getFullYear()} RD Custom Awards Pvt. Ltd. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const quoteTheme = activeSubJobs[0]?.theme || job.the_ask?.theme || "";
    const quoteThemePart = quoteTheme ? ` (${quoteTheme})` : "";

    if (transporter) {
      await sendMailWithUser(req.user, {
        to: recipientEmail,
        subject: `Quotation for Enquiry ${parentJobNo}${quoteThemePart} - RD Custom Awards`,
        html: emailHTML,
      });
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // Mark sub-jobs as quote shared
    job.sub_jobs.forEach((s) => {
      if (targetedNos.includes(s.sub_job_no) || targetedNos.some((t) => s.sub_job_no.endsWith(t))) {
        s.quote_shared = true;
        s.quote_shared_at = now;
        s.quote_channel = "email";
      }
    });

    const wizard_state = { ...(job.wizard_state || {}) };
    wizard_state.quoted = true;
    wizard_state.quoteVia = "email";
    wizard_state.quoteSharedAt = nowIso;
    job.wizard_state = wizard_state;
    job.markModified("wizard_state");
    job.markModified("sub_jobs");

    job.history.push({
      action: "QUOTATION_EMAIL_SENT",
      step: job.step,
      previous_state: "costing_completed",
      new_state: "quote_shared",
      remarks: `Quotation email sent to ${recipientEmail} for ${targetedNos.join(", ")}${notes ? ` (${notes})` : ""}`,
      changed_by: {
        user_id: req.user?._id || null,
        user_name: req.user?.name || "Client Servicing",
        role: req.user?.role || "CS",
      },
      timestamp: now,
    });

    await job.save();

    return res.status(200).json({
      success: true,
      message: `Quotation email sent successfully to ${recipientEmail}`,
      recipient: recipientEmail,
    });
  } catch (error) {
    console.error("Error sending quotation email:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while sending quotation email",
      error: error.message,
    });
  }
};

// 20. Record Public Client Quotation Feedback (Direct Client Link - Accept / Revision / Decline)
export const recordPublicQuoteFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      decision = "approved", // "approved" | "revision" | "rejected"
      notes = "",
      subJobNos = [],
      clientName = "",
    } = req.body || {};

    let job = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      job = await EnquiryJob.findById(id).populate("customer_id");
    }
    if (!job) {
      job = await EnquiryJob.findOne({
        $or: [{ enquiry_no: id }, { enquiry_no: "RD" + id }, { seq: Number(id) || -1 }],
      }).populate("customer_id");
    }

    if (!job) {
      return res.status(404).json({ success: false, message: "Enquiry job not found" });
    }

    const authCheck = verifyPublicLink(job, req);
    if (!authCheck.valid) {
      return res.status(authCheck.status || 403).json({ success: false, message: authCheck.message });
    }

    const now = new Date();
    let targetSubJobs = (job.sub_jobs || []).filter((sj) => {
      if (sj.is_dropped || sj.is_on_hold) return false;
      if (Array.isArray(subJobNos) && subJobNos.length > 0) {
        return (
          subJobNos.includes(sj.sub_job_no) ||
          subJobNos.some((t) => sj.sub_job_no?.endsWith(t) || t?.endsWith(sj.sub_job_no))
        );
      }
      return true;
    });

    if (targetSubJobs.length === 0) {
      targetSubJobs = (job.sub_jobs || []).filter((sj) => !sj.is_dropped && !sj.is_on_hold);
    }

    if (targetSubJobs.length === 0) {
      return res.status(400).json({ success: false, message: "No active sub-jobs to record quote decision" });
    }

    targetSubJobs.forEach((sj) => {
      sj.client_quote_decision = decision;
      sj.client_quote_decision_at = now;
      sj.client_quote_decision_notes = notes ? String(notes).trim() : "";
      sj.client_quote_communication = "Direct Client Response";
    });

    job.markModified("sub_jobs");

    const wizard_state = { ...(job.wizard_state || {}) };
    wizard_state.client_quote_decision = decision;
    wizard_state.decision = {
      decision,
      channel: "Client Link (Public)",
      notes: notes ? String(notes).trim() : "",
      at: now.toISOString(),
      by: clientName || job.contact_person || job.customer_id?.name || "Client (Link)",
    };
    if (decision === "approved") {
      wizard_state.quoteApproved = true;
    } else {
      wizard_state.quoteApproved = false;
      if (decision === "rejected") {
        wizard_state.lost = notes || "Client declined quotation via link";
      }
    }
    job.wizard_state = wizard_state;
    job.markModified("wizard_state");

    const actionName = `PUBLIC_QUOTE_${decision.toUpperCase()}`;
    const subJobCodes = targetSubJobs.map((s) => s.sub_job_no).join(", ");
    job.history.push({
      action: actionName,
      step: job.step,
      sub_job_no: subJobCodes,
      remarks: `Direct Client Response - Quotation ${decision.toUpperCase()} for ${subJobCodes}: ${notes || "No remarks"}`,
      changed_by: {
        user_id: null,
        user_name: clientName || job.contact_person || job.customer_id?.name || "Direct Client Response",
        role: "Client",
      },
      timestamp: now,
    });

    await job.save();

    return res.status(200).json({
      success: true,
      message: `Quotation feedback recorded successfully: ${decision}`,
      data: job,
      subJobs: job.sub_jobs,
    });
  } catch (error) {
    console.error("Error in recordPublicQuoteFeedback:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
