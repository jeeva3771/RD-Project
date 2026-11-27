import EnquiryJob from "../../../models/enquiry/enquiryJobIntegrationModel.js";
import Customer from "../../../models/masters/customerModel.js";
import { uploadToR2, generateSignedUrl, signJobWizardDesigns } from "../../../helpers/r2helper.js";
import { sendMailWithUser } from "../../../helpers/mail.js";
import { getEffectiveClientDesigns } from "./designWatermarkHelper.js";
import { generatePublicToken, verifyPublicLink } from "../../../helpers/publicLinkToken.js";
import { escapeRegex } from "../../../helpers/escapeRegex.js";
import { sendTwoFactorWhatsAppTemplate } from "../../../helpers/twoFactorWhatsAppHelper.js";
import mongoose from "mongoose";

// ==========================================
// DESIGNER PORTAL & DESIGN SHARING CONTROLLERS
// ==========================================

export const getDesignerEnquiries = async (req, res) => {
  try {
    const designerId = req.user?._id || req.user?.id;
    const designerName = req.user?.name;
    const userRole = (req.user?.role?.name || req.user?.role || "").toLowerCase();
    const isAdminOrLead = /admin|lead|manager/i.test(userRole);

    const { status: _status, rework, search } = req.query;

    const query = {
      is_lost: { $ne: true },
    };

    if (!isAdminOrLead && (designerId || designerName)) {
      const orClauses = [];
      if (designerId) {
        const strId = String(designerId);
        orClauses.push({ "the_brief.designer_id": strId });
        orClauses.push({ assigned_designer: strId });
        orClauses.push({ "wizard_state.e.assignedDesigner": strId });
        orClauses.push({ "wizard_state.e.designer_id": strId });
        orClauses.push({ "wizard_state.e.designerId": strId });
        orClauses.push({ "sub_jobs.designer_id": strId });
        orClauses.push({ "sub_jobs.assigned_designer": strId });
        if (mongoose.Types.ObjectId.isValid(strId)) {
          const objId = new mongoose.Types.ObjectId(strId);
          orClauses.push({ "the_brief.designer_id": objId });
          orClauses.push({ assigned_designer: objId });
          orClauses.push({ "sub_jobs.designer_id": objId });
          orClauses.push({ "sub_jobs.assigned_designer": objId });
        }
      }
      if (designerName) {
        const safeDesignerName = escapeRegex(designerName.trim());
        const nameRegex = { $regex: new RegExp(safeDesignerName, "i") };
        orClauses.push({ "the_brief.designer_name": nameRegex });
        orClauses.push({ assigned_designer_name: nameRegex });
        orClauses.push({ "wizard_state.e.assignedDesignerName": nameRegex });
        orClauses.push({ "wizard_state.e.designer_name": nameRegex });
        orClauses.push({ "wizard_state.e.designerName": nameRegex });
        orClauses.push({ "sub_jobs.designer_name": nameRegex });
        orClauses.push({ "sub_jobs.assigned_designer_name": nameRegex });
      }
      orClauses.push({ assigned_designer: null });
      orClauses.push({ assigned_designer: { $exists: false } });
      orClauses.push({ "the_brief.designer_id": null });
      orClauses.push({ "the_brief.designer_id": { $exists: false } });
      orClauses.push({ "sub_jobs.design_status": "approved" });
      orClauses.push({ "the_brief.design_status": "approved" });
      orClauses.push({ "wizard_state.designApproved": true });
      query.$or = orClauses;
    }

    if (rework === "true") {
      const reworkClause = {
        $or: [
          { "the_brief.design_status": "rework" },
          { "wizard_state.designStatus": "rework" },
          { "sub_jobs.design_status": "rework" },
        ],
      };
      if (query.$and) {
        query.$and.push(reworkClause);
      } else if (query.$or) {
        query.$and = [{ $or: query.$or }, reworkClause];
        delete query.$or;
      } else {
        query.$or = reworkClause.$or;
      }
    }

    if (search) {
      const trimmed = String(search).trim();
      const safeSearch = escapeRegex(trimmed);
      const searchRegex = { $regex: safeSearch, $options: "i" };
      const stripped = escapeRegex(trimmed.replace(/[-_ ]/g, ""));
      const num = parseInt(trimmed.replace(/\D/g, ""), 10);

      const orList = [
        { enquiry_no: searchRegex },
        { "sub_jobs.sub_job_no": searchRegex },
        { "the_ask.product_name": searchRegex },
        { "sub_jobs.product_name": searchRegex },
        { "sub_jobs.theme": searchRegex },
        { contact_person: searchRegex },
      ];

      if (stripped && stripped !== trimmed) {
        orList.push({ enquiry_no: { $regex: stripped, $options: "i" } });
        orList.push({ "sub_jobs.sub_job_no": { $regex: stripped, $options: "i" } });
      }

      if (!isNaN(num) && num > 0) {
        orList.push({ seq: num });
      }

      try {
        const matchingCustomers = await Customer.find({ name: searchRegex }).select("_id").lean();
        if (matchingCustomers && matchingCustomers.length > 0) {
          orList.push({ customer_id: { $in: matchingCustomers.map((c) => c._id) } });
        }
      } catch {
        // continue
      }

      const searchCondition = { $or: orList };
      if (query.$and) {
        query.$and.push(searchCondition);
      } else if (query.$or) {
        query.$and = [{ $or: query.$or }, searchCondition];
        delete query.$or;
      } else {
        query.$or = searchCondition.$or;
      }
    }

    const cardFields = "enquiry_no seq customer_id the_ask the_brief sub_jobs delivery_date needed_by_date event_date job_completion_date wizard_state assigned_designer assigned_designer_name coordinator_name createdAt updatedAt";

    const jobs = await EnquiryJob.find(query)
      .select(cardFields)
      .populate("customer_id", "name mobile email")
      .sort({ updatedAt: -1 })
      .lean();

    const signFile = (f) => {
      if (!f) return f;
      if (typeof f === "string") return generateSignedUrl(f) || f;
      const rawUrl = f.file_url || f.url || f.signed_url;
      if (rawUrl && typeof rawUrl === "string") {
        const sUrl = generateSignedUrl(rawUrl);
        if (sUrl) { f.signed_url = sUrl; f.url = sUrl; }
      }
      return f;
    };

    const signFileList = (list) => {
      if (Array.isArray(list)) list.forEach(signFile);
    };

    jobs.forEach((job) => {
      signJobWizardDesigns(job);
      if (job.the_brief?.ref_files) signFileList(job.the_brief.ref_files);
      if (job.the_brief?.product_briefs) {
        Object.values(job.the_brief.product_briefs).forEach((pb) => { if (pb?.refs) signFileList(pb.refs); });
      }
      if (job.wizard_state?.e?.globalRefs) signFileList(job.wizard_state.e.globalRefs);
      if (job.wizard_state?.e?.productBriefs) {
        Object.values(job.wizard_state.e.productBriefs).forEach((pb) => { if (pb?.refs) signFileList(pb.refs); });
      }
      if (job.sub_jobs && Array.isArray(job.sub_jobs)) {
        job.sub_jobs.forEach((sj) => {
          if (sj.ref_files) signFileList(sj.ref_files);
          if (sj.design_files) sj.design_files.forEach((df) => { df.url = df.signed_url = generateSignedUrl(df.file_url); });
          if (sj.proof_files) sj.proof_files.forEach((pf) => { pf.url = pf.signed_url = generateSignedUrl(pf.file_url); });
        });
      }

      // Attach resolved approved design URL to each sub-job (A1, A2 in group A share the same design)
      const ws = job.wizard_state || {};
      const watermarkedDesigns = ws.watermarkedDesigns || ws.s?.watermarkedDesigns || {};
      const uploadedDesigns = ws.uploadedDesigns || ws.s?.uploadedDesigns || {};
      const productFeedback = ws.productFeedback || ws.s?.productFeedback || job.productFeedback || {};

      (job.sub_jobs || []).forEach((sj) => {
        let gIdx = 0;
        const m = sj.sub_job_no ? String(sj.sub_job_no).match(/[-_]?([A-Za-z])(\d+)?$/) : null;
        if (m && m[1]) gIdx = m[1].toUpperCase().charCodeAt(0) - 65;
        if (isNaN(gIdx) || gIdx < 0) gIdx = 0;

        const fb = productFeedback[gIdx] || productFeedback[String(gIdx)] || sj.product_feedback;
        const fbArr = Array.isArray(fb) ? fb : (fb ? [fb] : []);
        const appFb = fbArr.find((f) => f && f.mode === "approve");
        const appOpt = appFb?.optIdxs?.[0] ?? appFb?.optIdx ?? sj.approved_design_option ?? 0;

        let appUrl = watermarkedDesigns[`${gIdx}-${appOpt}`] || uploadedDesigns[`${gIdx}-${appOpt}`] ||
          watermarkedDesigns[`${gIdx}-0`] || uploadedDesigns[`${gIdx}-0`];
        if (!appUrl) {
          const wmKey = Object.keys(watermarkedDesigns).find((k) => k.startsWith(`${gIdx}-`));
          if (wmKey) appUrl = watermarkedDesigns[wmKey];
        }
        if (!appUrl) {
          const upKey = Object.keys(uploadedDesigns).find((k) => k.startsWith(`${gIdx}-`));
          if (upKey) appUrl = uploadedDesigns[upKey];
        }
        if (appUrl) {
          sj.approved_design_url = appUrl;
          if (!Array.isArray(sj.approved_designs) || sj.approved_designs.length === 0) {
            sj.approved_designs = [appUrl];
          }
        }
      });

      // Calculate overall design status based on individual active sub-jobs:
      const activeCustomSubJobs = (job.sub_jobs || []).filter(
        (sj) => !sj.is_dropped && !sj.is_on_hold && sj.trophy_type !== "ready" && sj.kind !== "ready"
      );
      const totalActive = activeCustomSubJobs.length;
      const approvedCount = activeCustomSubJobs.filter(
        (sj) => sj.design_approved === true || sj.design_status === "approved"
      ).length;
      const reworkCount = (job.sub_jobs || []).filter(
        (sj) => sj.design_status === "rework"
      ).length;
      const hasUploadedDesigns = Object.keys(job.wizard_state?.uploadedDesigns || {}).length > 0;

      let effectiveDesignStatus;
      if (totalActive > 0 && approvedCount >= totalActive) {
        effectiveDesignStatus = "completed";
      } else if (reworkCount > 0 || job.the_brief?.design_status === "rework" || job.wizard_state?.designStatus === "rework") {
        effectiveDesignStatus = "rework";
      } else if (hasUploadedDesigns || approvedCount > 0) {
        effectiveDesignStatus = "processing";
      } else {
        effectiveDesignStatus = "pending";
      }

      job.effective_design_status = effectiveDesignStatus;
      job.design_progress = {
        total_active: totalActive,
        approved_count: approvedCount,
        rework_count: reworkCount,
        is_completed: effectiveDesignStatus === "completed",
        is_processing: effectiveDesignStatus === "processing",
        is_rework: effectiveDesignStatus === "rework",
        is_pending: effectiveDesignStatus === "pending",
      };
    });

    res.status(200).json({
      success: true,
      data: jobs,
      total: jobs.length,
    });
  } catch (error) {
    console.error("Error fetching designer enquiries:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching designer enquiries",
      error: error.message,
    });
  }
};

// 13. Designer Upload Design Options (Saves R2 URLs directly)
export const uploadDesignerOptions = async (req, res) => {
  try {
    const { id } = req.params;
    const { uploadedDesigns, trophyIndex, optionIndex, fileUrl, designStatus = "uploaded", designs } = req.body;

    let existingJob = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      existingJob = await EnquiryJob.findById(id);
    }
    if (!existingJob) {
      existingJob = await EnquiryJob.findOne({
        $or: [
          { enquiry_no: id },
          { enquiry_no: `RD${id}` },
          { enquiry_no: new RegExp(`^${id}$`, "i") },
          { "sub_jobs.sub_job_no": id },
        ],
      });
    }

    if (!existingJob) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    // Per-trophy Group lookup (Group A for trophyIndex 0, Group B for trophyIndex 1, etc.)
    if (trophyIndex !== undefined) {
      const targetGroupChar = String.fromCharCode(65 + Number(trophyIndex));
      const targetSjs = (existingJob.sub_jobs || []).filter((sj) => {
        if (sj.design_group) return sj.design_group === targetGroupChar;
        const m = (sj.sub_job_no || "").match(/[-_]([A-Za-z])\d*$/) || (sj.sub_job_no || "").match(/^([A-Za-z])\d+/);
        return m && m[1]?.toUpperCase() === targetGroupChar;
      });
      const targetSj = targetSjs[0] || (existingJob.sub_jobs && existingJob.sub_jobs[trophyIndex]);
      const targetGroup = existingJob.wizard_state?.e?.trophyGroups?.[trophyIndex] || existingJob.wizard_state?.trophyGroups?.[trophyIndex];

      // Block uploads for sub-jobs that are on hold or dropped
      if (targetGroup?.is_on_hold || targetGroup?.is_dropped || targetSj?.is_on_hold || targetSj?.is_dropped) {
        return res.status(400).json({
          success: false,
          message: `Cannot upload design: Sub-job is ${targetGroup?.is_dropped || targetSj?.is_dropped ? 'DROPPED' : 'ON HOLD'}. Designer uploads are locked.`,
        });
      }

      // Check approval strictly for THIS specific product/trophy group
      const pFb = existingJob.wizard_state?.productFeedback?.[trophyIndex] ||
                  existingJob.wizard_state?.productFeedback?.[String(trophyIndex)] ||
                  targetSj?.product_feedback;
      const fbList = Array.isArray(pFb) ? pFb : (pFb ? [pFb] : []);
      const isThisTrophyApproved = Boolean(
        (targetSjs.length > 0
          ? targetSjs.some((s) => s.design_approved === true || s.design_status === "approved")
          : targetSj?.design_approved === true || targetSj?.design_status === "approved") ||
        fbList.some((f) => f && f.mode === "approve")
      );
      const isThisTrophyRework = Boolean(
        (targetSjs.length > 0
          ? targetSjs.some((s) => s.design_status === "rework")
          : targetSj?.design_status === "rework") ||
        fbList.some((f) => f && (f.mode === "revision" || f.mode === "reject"))
      );

      // Lock uploads ONLY for this approved trophy; other unapproved trophies remain completely unlocked!
      if (isThisTrophyApproved && !isThisTrophyRework) {
        return res.status(400).json({
          success: false,
          message: `Cannot upload design: Design option for Trophy ${targetGroupChar} is already approved. Extra design uploads for this product are locked.`,
        });
      }
    }

    const currentUploaded = existingJob.wizard_state?.uploadedDesigns || existingJob.wizard_state?.s?.uploadedDesigns || {};
    let updatedUploaded = { ...currentUploaded };

    if (uploadedDesigns && typeof uploadedDesigns === "object") {
      updatedUploaded = { ...updatedUploaded, ...uploadedDesigns };
    }
    if (trophyIndex !== undefined && optionIndex !== undefined && fileUrl) {
      updatedUploaded[`${trophyIndex}-${optionIndex}`] = fileUrl;
    }
    if (designs && typeof designs === "object") {
      Object.entries(designs).forEach(([sNo, urls]) => {
        const m = String(sNo).match(/[-_]?([A-Za-z])(\d+)?$/);
        const gIdx = m && m[1] ? m[1].toUpperCase().charCodeAt(0) - 65 : 0;
        const urlArr = Array.isArray(urls) ? urls : [urls];
        urlArr.forEach((u, oIdx) => { if (u) updatedUploaded[`${gIdx}-${oIdx}`] = u; });
      });
    }

    // Keep option feedbacks intact so previous rework status on option 1 is strictly preserved!
    const curProductFeedback = { ...(existingJob.wizard_state?.productFeedback || {}) };

    const wizard_state = {
      ...(existingJob.wizard_state || {}),
      uploadedDesigns: updatedUploaded,
      designUploadedBy: req.user?.name || "Designer",
      designUploadedAt: new Date(),
      designStatus: designStatus,
      designApproved: designStatus === "approved",
      optionsShared: false, // Reset so CS is immediately prompted to share new/revised designs to client!
      optionsSharedChannel: null,
      productFeedback: curProductFeedback,
      s: {
        ...(existingJob.wizard_state?.s || {}),
        uploadedDesigns: updatedUploaded,
        designUploadedBy: req.user?.name || "Designer",
        designUploadedAt: new Date(),
        designStatus: designStatus,
        designApproved: designStatus === "approved",
        optionsShared: false,
        optionsSharedChannel: null,
        productFeedback: curProductFeedback,
      },
    };

    const the_brief = {
      ...(existingJob.the_brief || {}),
      design_status: designStatus,
      last_design_upload: new Date(),
      options_shared: false, // Reset options_shared so CS can share new designs
      options_shared_at: null,
      options_shared_channel: null,
      rework_notes: existingJob.the_brief?.rework_notes || "",
    };

    let updatedSubJobs = (existingJob.sub_jobs || []).map((sj) => {
      const sjObj = sj.toObject ? sj.toObject() : { ...sj };
      if (!sjObj.is_dropped && !sjObj.is_on_hold && sjObj.trophy_type !== "ready" && sjObj.kind !== "ready") {
        const targetGroupChar = trophyIndex !== undefined ? String.fromCharCode(65 + Number(trophyIndex)) : null;
        const belongsToTargetGroup = !targetGroupChar || sjObj.design_group === targetGroupChar || sjObj.sub_job_no?.toUpperCase().includes(`-${targetGroupChar}`);
        if (belongsToTargetGroup) {
          if (
            sjObj.design_status === "rework" ||
            sjObj.design_status === "rejected" ||
            sjObj.design_status === "reject" ||
            !sjObj.design_approved
          ) {
            sjObj.design_status = designStatus === "processing" ? "processing" : "uploaded";
            sjObj.design_approved = false;
            sjObj.rework_notes = sjObj.rework_notes || existingJob.the_brief?.rework_notes || "";
            if (sjObj.product_feedback) {
              sjObj.previous_feedback = sjObj.product_feedback;
            }
          }

          if (fileUrl) {
            const exFiles = Array.isArray(sjObj.design_files) ? [...sjObj.design_files] : [];
            if (!exFiles.some((f) => (f?.file_url || f) === fileUrl)) {
              exFiles.push({ file_url: fileUrl, file_name: `Option_${(optionIndex ?? 0) + 1}`, uploaded_at: new Date() });
              sjObj.design_files = exFiles;
            }
          }
        }
      }
      return sjObj;
    });

    if (designStatus === "approved" && Array.isArray(updatedSubJobs)) {
      const nowDt = new Date();
      updatedSubJobs = updatedSubJobs.map((sj) => {
        if (!sj.is_dropped && !sj.is_on_hold) {
          const sjRaw = sj.toObject ? sj.toObject() : sj;
          const hasDesignerFiles = Array.isArray(sjRaw.designer_files) && sjRaw.designer_files.length > 0;
          const isDesignUploaded = sjRaw.is_design_uploaded || hasDesignerFiles;
          return {
            ...sjRaw,
            design_approved: true,
            design_status: "approved",
            design_approved_at: sjRaw.design_approved_at || nowDt,
            is_design_uploaded: isDesignUploaded,
            costing_status: isDesignUploaded ? (sjRaw.costing_status === "completed" ? "completed" : "pending") : "not_requested",
            quotation_status: isDesignUploaded ? "requested" : "not_requested",
            costing_requested_at: isDesignUploaded ? (sjRaw.costing_requested_at || nowDt) : null,
          };
        }
        return sj;
      });
    }

    const setObj = {
      wizard_state,
      the_brief,
      sub_jobs: updatedSubJobs,
    };

    const updatedJob = await EnquiryJob.findByIdAndUpdate(
      existingJob._id,
      {
        $set: setObj,
        $push: {
          history: {
            action: designStatus === "processing" ? "DESIGN_OPTION_SAVED" : "DESIGN_UPLOADED",
            step: existingJob.step,
            previous_state: existingJob.the_brief?.design_status || "pending",
            new_state: designStatus,
            remarks: designStatus === "processing"
              ? `Designer ${req.user?.name || "User"} saved option to R2 & DB`
              : `Designer ${req.user?.name || "User"} uploaded designs to R2 & DB`,
            changed_by: {
              user_id: req.user?._id || null,
              user_name: req.user?.name || "Designer",
              role: req.user?.role || "Designer",
            },
            timestamp: new Date(),
          },
        },
      },
      { new: true }
    );

    // Pre-generate watermarks in background if show_logo or show_content is enabled
    const theBriefSettings = updatedJob?.the_brief || {};
    const eSettings = updatedJob?.wizard_state?.e || {};
    if (theBriefSettings.show_logo || theBriefSettings.show_content || eSettings.showRDLogo || eSettings.showRDContent) {
      getEffectiveClientDesigns(updatedJob).catch((err) =>
        console.warn("Background watermarking failed:", err.message)
      );
    }

    const resData = updatedJob?.toObject ? updatedJob.toObject() : updatedJob;
    signJobWizardDesigns(resData);

    res.status(200).json({
      success: true,
      message: "Design options uploaded successfully",
      data: resData,
    });
  } catch (error) {
    console.error("Error updating designer options:", error);
    res.status(500).json({
      success: false,
      message: "Error updating designer options",
      error: error.message,
    });
  }
};

// 14. Request Design Rework
export const requestDesignRework = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks, reworkNotes, trophyIndex: _trophyIndex, markupFileUrl } = req.body;

    const existingJob = await EnquiryJob.findById(id);
    if (!existingJob) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    const the_brief = {
      ...(existingJob.the_brief || {}),
      design_status: "rework",
      rework_notes: reworkNotes || remarks || "Client requested changes",
      rework_markup_url: markupFileUrl || null,
      rework_requested_at: new Date(),
      rework_requested_by: req.user?.name || "CS Executive",
    };

    const wizard_state = {
      ...(existingJob.wizard_state || {}),
      designReworkRemarks: remarks || reworkNotes,
      designStatus: "rework",
    };

    const updatedJob = await EnquiryJob.findByIdAndUpdate(
      id,
      {
        $set: {
          the_brief,
          wizard_state,
        },
        $push: {
          history: {
            action: "DESIGN_REWORK_REQUESTED",
            step: existingJob.step,
            previous_state: "uploaded",
            new_state: "rework",
            remarks: remarks || reworkNotes || "Design rework requested",
            changed_by: {
              user_id: req.user?._id || null,
              user_name: req.user?.name || "CS",
              role: req.user?.role || "CS",
            },
            timestamp: new Date(),
          },
        },
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Rework requested successfully",
      data: updatedJob,
    });
  } catch (error) {
    console.error("Error requesting design rework:", error);
    res.status(500).json({
      success: false,
      message: "Error requesting design rework",
      error: error.message,
    });
  }
};

// Export getEffectiveClientDesigns for backwards compatibility
export { getEffectiveClientDesigns };

// Public endpoint for client design preview (no JWT needed)
export const getPublicDesignView = async (req, res) => {
  try {
    const { id } = req.params;
    let job = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      job = await EnquiryJob.findById(id).populate("customer_id");
    }

    if (!job) {
      job = await EnquiryJob.findOne({
        $or: [{ enquiry_no: id }, { enquiry_no: "RD" + id }, { seq: Number(id) || -1 }]
      }).populate("customer_id");
    }

    if (!job) {
      return res.status(404).json({ success: false, message: "Design preview not found" });
    }

    const authCheck = verifyPublicLink(job, req);
    if (!authCheck.valid) {
      return res.status(authCheck.status || 403).json({ success: false, message: authCheck.message });
    }

    const cust = job.customer_id || {};
    const e = job.wizard_state?.e || {};

    const formatAddress = (addr) => {
      if (!addr) return "";
      if (typeof addr === "string") return addr;
      if (Array.isArray(addr) && addr.length > 0) return formatAddress(addr[0]);
      if (typeof addr === "object") {
        const parts = [
          addr.address_1,
          addr.address_2,
          addr.city,
          addr.state,
          addr.postal_code || addr.pincode,
        ].filter(Boolean);
        return parts.join(", ");
      }
      return "";
    };

    const rawBilling = cust.billing_address || (Array.isArray(cust.address) ? cust.address.find(a => a.is_billing) || cust.address[0] : cust.address);
    const billingStr = formatAddress(rawBilling);
    const gstinStr = cust.gst_no || cust.gstin || (rawBilling && typeof rawBilling === "object" ? rawBilling.gst_no : "") || "";

    const effectiveDesigns = await getEffectiveClientDesigns(job);

    // Filter out uploaded designs for held or dropped sub-jobs
    const filteredUploadedDesigns = {};
    Object.entries(effectiveDesigns || {}).forEach(([key, url]) => {
      const [trophyIdx] = key.split("-").map(Number);
      const group = e.trophyGroups?.[trophyIdx];
      const subJob = job.sub_jobs?.[trophyIdx];
      if (group && (group.is_on_hold || group.is_dropped)) return;
      if (subJob && (subJob.is_on_hold || subJob.is_dropped)) return;
      filteredUploadedDesigns[key] = url;
    });

    const publicData = {
      _id: job._id,
      enquiry_no: job.enquiry_no,
      seq: job.seq,
      customer: {
        id: cust._id,
        name: cust.company_name || cust.name || "Client",
        billing: billingStr,
        gstin: gstinStr,
        city: cust.city || "",
        state: cust.state || "",
      },
      contact: {
        id: job.contact_id,
        name: job.contact_person || cust.contact_person || "Client Contact",
        mobile: job.contact_mobile || cust.contact_number || "",
        email: job.contact_email || cust.contact_email || "",
      },
      coordinator_name: job.coordinator_name || "Coordinator",
      sub_jobs: (job.sub_jobs || []).filter((s) => !s.is_on_hold && !s.is_dropped),
      the_ask: job.the_ask || {},
      the_brief: job.the_brief || {},
      uploadedDesigns: filteredUploadedDesigns,
      trophyGroups: (e.trophyGroups || []).filter((g) => !g.is_on_hold && !g.is_dropped),
      globalBrief: e.globalBrief || job.the_ask?.theme || job.the_brief?.brief_text || "Custom Trophy",
      productBriefs: e.productBriefs || {},
      productFeedback: job.wizard_state?.productFeedback || {},
      briefMode: e.briefMode || "one",
      links_duration: job.the_brief?.links_duration || e.links_duration || 24,
      showRDLogo: job.the_brief?.show_logo !== undefined
        ? job.the_brief.show_logo
        : (e.showRDLogo !== undefined ? e.showRDLogo : true),
      showRDContent: job.the_brief?.show_content !== undefined
        ? job.the_brief.show_content
        : Boolean(e.showRDContent || Object.values(e.productBriefs || {}).some(pb => pb.showRDContent)),
      copyrightContent: job.the_brief?.copyright_content || e.copyrightContent || e.copyright_content || Object.values(e.productBriefs || {}).find(pb => pb.copyrightContent)?.copyrightContent || "",
      createdAt: job.createdAt,
    };

    return res.status(200).json({
      success: true,
      data: publicData,
    });
  } catch (error) {
    console.error("Error fetching public design view:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching design preview",
      error: error.message,
    });
  }
};


// 15. Send Design Review Email to Client via System Mailer
export const sendDesignEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { to_email, client_link, contact_name, duration, subJobNos } = req.body || {};

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

    const customer = job.customer_id || {};
    const e = job.wizard_state?.e || {};
    const recipientEmail = (to_email || job.contact_email || customer.email || e.contactEmail || "").trim();

    if (!recipientEmail) {
      return res.status(400).json({ success: false, message: "No valid recipient email address found" });
    }

    const parentJobNo = job.enquiry_no || (job.seq ? `RD${job.seq}` : "RD");
    const subJobCode = job.sub_jobs?.[0]?.sub_job_no || `${parentJobNo}-A1`;
    const productName = job.the_ask?.theme || job.sub_jobs?.[0]?.theme || job.the_ask?.product_name || e.theme || e.productName || "Custom Trophy";
    const clientName = contact_name || job.contact_person || customer.contact_person || customer.name || "Client";
    const durationHours = Number(duration || job.the_brief?.links_duration || e.links_duration || 24);

    const expiryTimestamp = Date.now() + durationHours * 60 * 60 * 1000;
    const expiryDateFormatted = new Date(expiryTimestamp).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    let targetLink = client_link;
    if (!targetLink) {
      const baseUrl = process.env.CLIENT_CONFIRMATION_SCREEN_URL || "http://localhost:5173";
      const targetId = String(job._id || job.enquiry_no || job.seq);
      const { token, exp, sig } = generatePublicToken(targetId, durationHours);
      targetLink = `${baseUrl}/rd/design-view/${targetId}?token=${token}&exp=${exp}&sig=${sig}`;
    }

    // Build design options table (with watermarks if enabled in brief) - exclude held, dropped, or already approved products, and filter by subJobNos
    const uploadedDesigns = await getEffectiveClientDesigns(job);
    const subJobNosList = Array.isArray(subJobNos)
      ? subJobNos.map((s) => String(s).trim().toUpperCase())
      : null;

    const uploadedEntries = Object.entries(uploadedDesigns).filter(([key, url]) => {
      if (!url || typeof url !== "string") return false;
      const [trophyIdx] = key.split("-").map(Number);
      const group = e.trophyGroups?.[trophyIdx];
      const subJob = job.sub_jobs?.[trophyIdx];
      if (group && (group.is_on_hold || group.is_dropped)) return false;
      if (subJob && (subJob.is_on_hold || subJob.is_dropped)) return false;

      // Exclude already-approved sub-jobs from email awaiting approval
      if (subJob && (subJob.design_approved === true || subJob.design_status === "approved")) {
        return false;
      }

      // If specific subJobNos were selected, only include those sub-jobs
      if (subJobNosList && subJobNosList.length > 0) {
        const groupChar = String.fromCharCode(65 + trophyIdx);
        const subJobCode = subJob?.sub_job_no || `${parentJobNo}-${groupChar}1`;
        const matches = subJobNosList.some(
          (code) =>
            subJobCode.toUpperCase() === code ||
            subJobCode.toUpperCase().includes(code) ||
            code.includes(subJobCode.toUpperCase()) ||
            code === groupChar ||
            code.endsWith(`-${groupChar}1`) ||
            code.endsWith(`${groupChar}1`)
        );
        if (!matches) return false;
      }

      return true;
    });

    let designTableRows = "";
    if (uploadedEntries.length > 0) {
      designTableRows = uploadedEntries
        .map(([key, url], idx) => {
          const [trophyIdx, optIdx] = key.split("-").map(Number);
          const group = e.trophyGroups?.[trophyIdx] || {};
          const trophyTitle = group.theme || group.productName || job.sub_jobs?.[trophyIdx]?.theme || job.the_ask?.theme || job.the_ask?.product_name || "Custom Trophy";
          const size = group.items?.[0]?.size || job.sub_jobs?.[trophyIdx]?.size || job.the_ask?.size || "8 in";
          const label = `${trophyTitle} - Option ${(optIdx || 0) + 1} (${size})`;

          return `
          <tr style="background-color:${idx % 2 === 0 ? "#ffffff" : "#f8f9fa"};">
            <td style="text-align:center; padding:12px; border-bottom:1px solid #e6e6e6; color:#333;">${idx + 1}</td>
            <td style="text-align:center; padding:12px; border-bottom:1px solid #e6e6e6;">
              <img src="${url}" alt="${label}" style="max-width:130px; max-height:130px; object-fit:contain; border-radius:6px; border:1px solid #ddd;" />
            </td>
            <td style="text-align:center; padding:12px; border-bottom:1px solid #e6e6e6; color:#333; font-weight:600;">${label}</td>
            <td style="text-align:center; padding:12px; border-bottom:1px solid #e6e6e6; color:#FFA500; font-weight:600;">Waiting for approval</td>
          </tr>
        `;
        })
        .join("");
    } else {
      designTableRows = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#777;">No designs uploaded yet</td></tr>`;
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
                      <h2 style="color:#ffffff; font-size:22px; margin:0;">Design Review - RD Custom Awards</h2>
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
                        Job No: ${subJobCode}
                      </div>
                    </td>
                  </tr>

                  <!-- BODY CONTENT -->
                  <tr>
                    <td style="padding:25px 30px;">
                      <p style="font-size:16px; color:#333; margin:0 0 15px;">
                        Hello <strong>${clientName}</strong>,
                      </p>

                      <p style="font-size:15px; line-height:1.6; color:#555; margin:0 0 25px;">
                        We’re excited to share the latest design options for your product 
                        <strong>${productName}</strong>.
                        Please review the details below and share your feedback.
                      </p>

                      <!-- REVIEW BUTTON -->
                      <p style="text-align:center; margin:20px 0 10px;">
                        <a 
                          href="${targetLink}" 
                          target="_blank"
                          style="display:inline-block; padding:12px 28px; background-color:#004aad; color:#ffffff; text-decoration:none; border-radius:6px; font-weight:600; font-size:15px;"
                        >
                          Review Your Designs
                        </a>
                      </p>

                      <!-- EXPIRY MESSAGE -->
                      <p style="text-align:center; font-size:13px; color:#777; margin:0 0 25px;">
                        🔒 This review link will expire on <strong>${expiryDateFormatted}</strong>
                      </p>

                      <!-- DESIGN TABLE -->
                      <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; font-size:14px; margin-bottom:25px;">
                        <thead>
                          <tr style="background-color:#004aad; color:#ffffff;">
                            <th style="padding:12px;">S.No</th>
                            <th style="padding:12px;">Design Preview</th>
                            <th style="padding:12px;">Option / Size</th>
                            <th style="padding:12px;">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${designTableRows}
                        </tbody>
                      </table>

                      <p style="font-size:14px; color:#555; margin-top:25px;">
                        Once you’ve reviewed the designs, please reply with your comments or approval.
                      </p>

                      <p style="font-size:14px; color:#555; margin-top:15px;">
                        Thank you for choosing <strong>RD Custom Awards</strong>.<br/>
                        We truly appreciate your trust in our craftsmanship.
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

    await sendMailWithUser(req.user, {
      to: recipientEmail,
      subject: `Designs for ${productName} - ${subJobCode}`,
      html: emailHTML,
    });

    const now = new Date();
    const nowIso = now.toISOString();

    // Record in history audit and update design options shared status
    await EnquiryJob.findByIdAndUpdate(job._id, {
      $set: {
        "the_brief.options_shared": true,
        "the_brief.options_shared_at": now,
        "the_brief.options_shared_channel": "Email",
        "wizard_state.optionsShared": nowIso,
        "wizard_state.optionsSharedChannel": "Email",
      },
      $push: {
        history: {
          action: "DESIGN_EMAIL_SENT",
          step: job.step,
          previous_state: job.the_brief?.design_status || "uploaded",
          new_state: "shared_email",
          remarks: `Design review email sent to ${recipientEmail}`,
          changed_by: {
            user_id: req.user?._id || null,
            user_name: req.user?.name || "Client Servicing",
            role: req.user?.role || "CS",
          },
          timestamp: now,
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: `Design email sent successfully to ${recipientEmail}`,
      recipient: recipientEmail,
    });
  } catch (error) {
    console.error("Error sending integration design email:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while sending email",
      error: error.message,
    });
  }
};


// 16. Record Design Options Shared with Client (WhatsApp, Link, etc.) & Dispatch 2Factor WhatsApp
export const recordDesignShared = async (req, res) => {
  try {
    const { id } = req.params;
    const { channel = "WhatsApp", recipient = "", subJobNos = [], values = null, clientLink = "" } = req.body || {};

    let job = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      job = await EnquiryJob.findById(id);
    }
    if (!job) {
      job = await EnquiryJob.findOne({
        $or: [{ enquiry_no: id }, { enquiry_no: "RD" + id }, { seq: Number(id) || -1 }],
      });
    }

    if (!job) {
      return res.status(404).json({ success: false, message: "Enquiry job not found" });
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // 2Factor WhatsApp Dispatch for Design Options
    let twoFactorResult = null;
    if (String(channel).toLowerCase() === "whatsapp" && recipient) {
      const contactName = job.contact_id?.name || job.the_brief?.contact_name || job.customer_id?.name || "Client";
      const subJobCode = Array.isArray(subJobNos) && subJobNos.length > 0 ? subJobNos.join(", ") : (job.enquiry_no || "Design Options");
      const targetLink = clientLink || `${process.env.CLIENT_URL || "https://rdcustomawards.com"}/rd/design-view/${job._id}`;

      const matchedSj = Array.isArray(subJobNos) && subJobNos.length > 0 && Array.isArray(job.sub_jobs)
        ? job.sub_jobs.find((sj) => subJobNos.includes(sj.sub_job_no) || subJobNos.includes(sj.sub_job_no?.replace("RD", "")))
        : null;
      const resolvedProdName = matchedSj?.product_name || job.the_brief?.product_name || job.sub_jobs?.[0]?.product_name || job.product_name || "Custom Trophy";
      const expiryTimestamp = Date.now() + 24 * 60 * 60 * 1000;
      const expiryDateFormatted = new Date(expiryTimestamp).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

      const templateValues = values || {
        "1": `Design Options – Sub Job No: ${subJobCode}`,
        "2": contactName,
        "3": resolvedProdName,
        "4": targetLink,
        "5": expiryDateFormatted,
      };

      twoFactorResult = await sendTwoFactorWhatsAppTemplate(recipient, templateValues);
    }

    const updatedJob = await EnquiryJob.findByIdAndUpdate(
      job._id,
      {
        $set: {
          "the_brief.options_shared": true,
          "the_brief.options_shared_at": now,
          "the_brief.options_shared_channel": channel,
          "the_brief.two_factor_sent": Boolean(twoFactorResult?.success),
          "wizard_state.optionsShared": nowIso,
          "wizard_state.optionsSharedChannel": channel,
          "wizard_state.twoFactorResult": twoFactorResult,
        },
        $push: {
          history: {
            action: "DESIGN_OPTIONS_SHARED",
            step: job.step,
            previous_state: job.the_brief?.design_status || "uploaded",
            new_state: `shared_${String(channel).toLowerCase()}`,
            remarks: `Design options shared with client via ${channel}${recipient ? ` (${recipient})` : ""}${twoFactorResult?.success ? " [2Factor Sent]" : ""}`,
            changed_by: {
              user_id: req.user?._id || null,
              user_name: req.user?.name || "Client Servicing",
              role: req.user?.role || "CS",
            },
            timestamp: now,
          },
        },
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: `Design options recorded as shared via ${channel}${twoFactorResult?.success ? " and sent via 2Factor WhatsApp" : ""}`,
      data: updatedJob,
      twoFactor: twoFactorResult,
    });
  } catch (error) {
    console.error("Error recording design options shared:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 17. Record Sub-Job Level Design Feedback (Approve / Revision / Reject per Trophy)
export const recordSubJobDesignFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { pIdx = 0, groupChar: rawGroupChar, subJobNo, feedback } = req.body || {};

    if (!feedback || !feedback.mode) {
      return res.status(400).json({ success: false, message: "Feedback object with mode is required" });
    }

    let job = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      job = await EnquiryJob.findById(id);
    }
    if (!job) {
      job = await EnquiryJob.findOne({
        $or: [{ enquiry_no: id }, { enquiry_no: "RD" + id }, { seq: Number(id) || -1 }],
      });
    }

    if (!job) {
      return res.status(404).json({ success: false, message: "Enquiry job not found" });
    }

    const extractedGroup = subJobNo
      ? (String(subJobNo).match(/[-_]([A-Za-z])\d*$/) || String(subJobNo).match(/^([A-Za-z])\d+/))?.[1]?.toUpperCase()
      : null;
    const groupChar = rawGroupChar || extractedGroup || (pIdx !== undefined ? String.fromCharCode(65 + Number(pIdx)) : "A");
    const isApprove = feedback.mode === "approve";
    const now = new Date();

    // Match ALL sub-jobs sharing this common design (e.g., A1 10 in and A2 8 in for the same trophy group)
    const targetSubJobNosList = subJobNo ? String(subJobNo).split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) : [];
    const matchingSubJobs = (job.sub_jobs || []).filter((sj) => {
      if (sj.is_dropped || sj.is_on_hold) return false;
      const sjGroup = sj.design_group || (String(sj.sub_job_no || "").match(/[-_]([A-Za-z])\d*$/) || String(sj.sub_job_no || "").match(/^([A-Za-z])\d+/))?.[1]?.toUpperCase();
      if (groupChar && (sjGroup === groupChar || sj.sub_job_no?.toUpperCase().includes(`-${groupChar}`))) {
        return true;
      }
      if (targetSubJobNosList.length > 0) {
        const sjUpper = String(sj.sub_job_no || "").toUpperCase();
        return targetSubJobNosList.includes(sjUpper) || targetSubJobNosList.some((t) => sjUpper.endsWith(t));
      }
      return false;
    });

    if (matchingSubJobs.length === 0) {
      console.warn(`No direct sub-job found for group ${groupChar}, checking by index...`);
      if (job.sub_jobs && job.sub_jobs[pIdx] && !job.sub_jobs[pIdx].is_dropped && !job.sub_jobs[pIdx].is_on_hold) {
        matchingSubJobs.push(job.sub_jobs[pIdx]);
      }
    }

    matchingSubJobs.forEach((sj) => {
      sj.design_status = isApprove ? "approved" : "rework";
      sj.design_approved = isApprove;
      sj.design_approved_at = isApprove ? now : null;
      if (feedback.optIdxs && feedback.optIdxs.length > 0) {
        sj.approved_design_option = feedback.optIdxs[0];
      }
      sj.product_feedback = feedback;

      // When an individual sub-job's design is approved, mark approved; costing queues ONLY after designer uploads approved files
      if (isApprove && !sj.is_dropped && !sj.is_on_hold) {
        const hasDesignerFiles = Array.isArray(sj.designer_files) && sj.designer_files.length > 0;
        sj.is_design_uploaded = sj.is_design_uploaded || hasDesignerFiles;
        if (sj.is_design_uploaded) {
          sj.costing_status = sj.costing_status === "completed" ? "completed" : "pending";
          sj.quotation_status = "requested";
          sj.costing_requested_at = sj.costing_requested_at || now;
        } else {
          sj.costing_status = "not_requested";
          sj.quotation_status = "not_requested";
        }
      }
    });

    // Update wizard_state.productFeedback
    const wizardState = job.wizard_state ? (job.wizard_state.toObject ? job.wizard_state.toObject() : { ...job.wizard_state }) : {};
    const curProductFeedback = { ...(wizardState.productFeedback || {}) };
    const existingSysFbs = Array.isArray(curProductFeedback[pIdx])
      ? curProductFeedback[pIdx]
      : curProductFeedback[pIdx]
      ? [curProductFeedback[pIdx]]
      : [];

    curProductFeedback[pIdx] = [...existingSysFbs, feedback];
    wizardState.productFeedback = curProductFeedback;

    // Check if ALL active custom sub-jobs in this enquiry are now approved
    const activeSubJobs = (job.sub_jobs || []).filter(
      (sj) => !sj.is_dropped && !sj.is_on_hold && sj.trophy_type !== "ready"
    );
    const allApproved = activeSubJobs.length > 0 && activeSubJobs.every((sj) => sj.design_approved === true);
    const anyRework = (job.sub_jobs || []).some((sj) => sj.design_status === "rework");

    if (!job.the_brief) job.the_brief = {};

    if (allApproved) {
      job.the_brief.design_status = "approved";
      wizardState.designApproved = true;
      wizardState.designStatus = "approved";
    } else if (anyRework) {
      job.the_brief.design_status = "rework";
      job.the_brief.rework_notes = feedback.remark || "Client requested changes on sub-job design";
      job.the_brief.rework_requested_at = now;
      wizardState.designStatus = "rework";
    }

    job.wizard_state = wizardState;
    job.markModified("sub_jobs");
    job.markModified("wizard_state");
    job.markModified("the_brief");

    // History audit logging
    const actionName = isApprove ? "SUBJOB_DESIGN_APPROVED" : "SUBJOB_DESIGN_REWORK";
    const subJobCodes = matchingSubJobs.map((s) => s.sub_job_no).join(", ") || `Group ${groupChar}`;
    job.history.push({
      action: actionName,
      step: job.step,
      remarks: `Design ${feedback.mode} for Trophy ${groupChar} (${subJobCodes}): ${feedback.remark || "No remark"}${feedback.communication?.method ? ` via ${feedback.communication.method}` : ""}`,
      changed_by: {
        user_id: req.user?._id || req.user?.id || null,
        user_name: req.user?.name || "Client Servicing",
        role: req.user?.role || "CS",
      },
      timestamp: now,
    });

    await job.save();

    const resData = job.toObject ? job.toObject() : job;
    signJobWizardDesigns(resData);

    return res.status(200).json({
      success: true,
      message: `Sub-job ${groupChar} design feedback recorded successfully`,
      data: resData,
      subJobs: resData.sub_jobs,
      allApproved,
    });
  } catch (error) {
    console.error("Error recording sub-job design feedback:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 18. Record Public Client Design Feedback (Direct Client Link - Approve / Revision / Reject)
export const recordPublicDesignFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      pIdx = 0,
      groupChar: rawGroupChar,
      subJobNo,
      mode = "approve", // "approve" | "revision" | "reject"
      optIdxs = [],
      remark = "",
      clientName = "",
    } = req.body || {};

    if (!mode) {
      return res.status(400).json({ success: false, message: "Feedback mode is required (approve, revision, or reject)" });
    }

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

    const extractedGroup = subJobNo
      ? (String(subJobNo).match(/[-_]([A-Za-z])\d*$/) || String(subJobNo).match(/^([A-Za-z])\d+/))?.[1]?.toUpperCase()
      : null;
    const groupChar = rawGroupChar || extractedGroup || (pIdx !== undefined ? String.fromCharCode(65 + Number(pIdx)) : "A");
    const isApprove = mode === "approve";
    const now = new Date();

    const feedback = {
      mode,
      optIdxs: Array.isArray(optIdxs) ? optIdxs : [optIdxs],
      remark: remark ? String(remark).trim() : (isApprove ? "Approved by client via review link" : ""),
      communication: {
        method: "Direct Client Response",
        date: now,
        contact_person: clientName || job.contact_person || job.customer_id?.name || "Client",
      },
    };

    // Match ALL sub-jobs sharing this common design (e.g., A1 10 in and A2 8 in for the same trophy group)
    const targetSubJobNosList = subJobNo ? String(subJobNo).split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) : [];
    const matchingSubJobs = (job.sub_jobs || []).filter((sj) => {
      if (sj.is_dropped || sj.is_on_hold) return false;
      const sjGroup = sj.design_group || (String(sj.sub_job_no || "").match(/[-_]([A-Za-z])\d*$/) || String(sj.sub_job_no || "").match(/^([A-Za-z])\d+/))?.[1]?.toUpperCase();
      if (groupChar && (sjGroup === groupChar || sj.sub_job_no?.toUpperCase().includes(`-${groupChar}`))) {
        return true;
      }
      if (targetSubJobNosList.length > 0) {
        const sjUpper = String(sj.sub_job_no || "").toUpperCase();
        return targetSubJobNosList.includes(sjUpper) || targetSubJobNosList.some((t) => sjUpper.endsWith(t));
      }
      return false;
    });

    if (matchingSubJobs.length === 0 && job.sub_jobs && job.sub_jobs[pIdx] && !job.sub_jobs[pIdx].is_dropped && !job.sub_jobs[pIdx].is_on_hold) {
      matchingSubJobs.push(job.sub_jobs[pIdx]);
    }

    matchingSubJobs.forEach((sj) => {
      sj.design_status = isApprove ? "approved" : "rework";
      sj.design_approved = isApprove;
      sj.design_approved_at = isApprove ? now : null;
      if (feedback.optIdxs && feedback.optIdxs.length > 0) {
        sj.approved_design_option = feedback.optIdxs[0];
      }
      sj.product_feedback = feedback;

      // When approved, mark approved; costing queues ONLY after designer uploads approved files
      if (isApprove && !sj.is_dropped && !sj.is_on_hold) {
        const hasDesignerFiles = Array.isArray(sj.designer_files) && sj.designer_files.length > 0;
        sj.is_design_uploaded = sj.is_design_uploaded || hasDesignerFiles;
        if (sj.is_design_uploaded) {
          sj.costing_status = sj.costing_status === "completed" ? "completed" : "pending";
          sj.quotation_status = "requested";
          sj.costing_requested_at = sj.costing_requested_at || now;
        } else {
          sj.costing_status = "not_requested";
          sj.quotation_status = "not_requested";
        }
      }
    });

    // Update wizard_state.productFeedback
    const wizardState = job.wizard_state ? (job.wizard_state.toObject ? job.wizard_state.toObject() : { ...job.wizard_state }) : {};
    const curProductFeedback = { ...(wizardState.productFeedback || {}) };
    const existingSysFbs = Array.isArray(curProductFeedback[pIdx])
      ? curProductFeedback[pIdx]
      : curProductFeedback[pIdx]
      ? [curProductFeedback[pIdx]]
      : [];

    curProductFeedback[pIdx] = [...existingSysFbs, feedback];
    wizardState.productFeedback = curProductFeedback;

    // Check if ALL active custom sub-jobs in this enquiry are now approved
    const activeSubJobs = (job.sub_jobs || []).filter(
      (sj) => !sj.is_dropped && !sj.is_on_hold && sj.trophy_type !== "ready" && sj.kind !== "ready"
    );
    const allApproved = activeSubJobs.length > 0 && activeSubJobs.every((sj) => sj.design_approved === true);
    const anyRework = (job.sub_jobs || []).some((sj) => sj.design_status === "rework");

    if (!job.the_brief) job.the_brief = {};

    if (allApproved) {
      job.the_brief.design_status = "approved";
      wizardState.designApproved = true;
      wizardState.designStatus = "approved";
    } else if (anyRework) {
      job.the_brief.design_status = "rework";
      job.the_brief.rework_notes = feedback.remark || "Client requested changes via review link";
      job.the_brief.rework_requested_at = now;
      wizardState.designStatus = "rework";
    }

    job.wizard_state = wizardState;
    job.markModified("sub_jobs");
    job.markModified("wizard_state");
    job.markModified("the_brief");

    // History audit logging
    const actionName = isApprove ? "PUBLIC_SUBJOB_DESIGN_APPROVED" : "PUBLIC_SUBJOB_DESIGN_REWORK";
    const subJobCodes = matchingSubJobs.map((s) => s.sub_job_no).join(", ") || `Group ${groupChar}`;
    job.history.push({
      action: actionName,
      step: job.step,
      remarks: `Direct Client Response - Design ${mode.toUpperCase()} for ${subJobCodes}: ${feedback.remark || "No remark"}`,
      changed_by: {
        user_id: null,
        user_name: clientName || job.contact_person || job.customer_id?.name || "Direct Client Response",
        role: "Client",
      },
      timestamp: now,
    });

    await job.save();

    const resData = job.toObject ? job.toObject() : job;
    signJobWizardDesigns(resData);

    return res.status(200).json({
      success: true,
      message: `Feedback received and recorded successfully: ${mode}`,
      data: resData,
      subJobs: resData.sub_jobs,
      allApproved,
    });
  } catch (error) {
    console.error("Error recording public design feedback:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Upload approved production design artwork (.cdr / .pdf) for a sub-job.
 * Once uploaded, this automatically moves the sub-job to Quotation Desk (costing_status = 'pending').
 */
export const uploadSubJobArtwork = async (req, res) => {
  try {
    const { id } = req.params;
    const { sub_job_no } = req.body;
    const files = req.files || [];

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: "No artwork files provided" });
    }

    const cleanId = String(id || "").trim();
    const cleanSubNo = String(sub_job_no || cleanId).trim();

    const job = await EnquiryJob.findOne({
      $or: [
        ...(mongoose.Types.ObjectId.isValid(cleanId) ? [{ _id: cleanId }] : []),
        { enquiry_no: cleanId },
        { "sub_jobs.sub_job_no": cleanSubNo },
      ],
    });

    if (!job) {
      return res.status(404).json({ success: false, message: "Enquiry job not found" });
    }

    const subJob = (job.sub_jobs || []).find(
      (s) => s.sub_job_no === cleanSubNo
    ) || job.sub_jobs?.[0];

    if (!subJob) {
      return res.status(404).json({ success: false, message: "Sub-job not found" });
    }

    const uploadedUrls = [];
    const basePath = `enquiry_jobs/${job.enquiry_no}/${subJob.sub_job_no}/artwork`;

    for (const file of files) {
      const url = await uploadToR2(
        basePath,
        file.buffer,
        file.originalname,
        file.mimetype
      );
      uploadedUrls.push(url);
    }

    if (!Array.isArray(subJob.designer_files)) subJob.designer_files = [];
    subJob.designer_files.push(...uploadedUrls);

    if (!Array.isArray(subJob.dtp_files)) subJob.dtp_files = [];
    uploadedUrls.forEach((url) => {
      const ext = url.split(".").pop().toLowerCase();
      subJob.dtp_files.push({
        file_url: url,
        file_name: url.split("/").pop(),
        file_type: ext === "cdr" ? "cdr" : ext === "pdf" ? "pdf" : "design",
        uploaded_at: new Date(),
      });
    });

    subJob.is_design_uploaded = true;
    subJob.costing_status = "pending";
    subJob.costing_requested_at = new Date();
    subJob.costing_completed_at = null;
    subJob.quotation_status = "requested";
    subJob.bom_id = null;
    subJob.bom_nanoid = null;
    subJob.unit_rate = 0;
    subJob.target_rate = 0;
    subJob.sample_rate = 0;
    subJob.artwork_charge = 0;
    subJob.line_total = 0;

    job.markModified("sub_jobs");

    job.history.push({
      action: "DESIGNER_PRODUCTION_ARTWORK_UPLOADED",
      step: job.step,
      remarks: `Designer uploaded ${uploadedUrls.length} production artwork file(s) for ${subJob.sub_job_no}. Moved to Quotation Desk.`,
      changed_by: {
        user_id: req.user?._id || null,
        user_name: req.user?.name || "Designer",
        role: "Designer",
      },
      timestamp: new Date(),
    });

    await job.save();

    return res.status(200).json({
      success: true,
      message: "Artwork uploaded successfully and sub-job moved to Quotation Desk",
      data: {
        designer_files: subJob.designer_files,
        sub_job_no: subJob.sub_job_no,
      },
    });
  } catch (err) {
    console.error("uploadSubJobArtwork error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
