import mongoose from "mongoose";
import EnquiryJob from "../../../models/enquiry/enquiryJobIntegrationModel.js";
import dtpStudioModel from "../../../models/dtp_studio/dtpStudioModel.js";
import { generateSignedUrl, uploadToR2 } from "../../../helpers/r2helper.js";
import { transporter, sendMailWithUser } from "../../../helpers/mail.js";
import { generatePublicToken, verifyPublicLink } from "../../../helpers/publicLinkToken.js";
import { getCurrentDate } from "../../../helpers/dateTime.js";

/**
 * getDtpProofsForEnquiry
 * Fetches all DTP master template proofs and content proofing files for sub-jobs of an enquiry.
 */
const _toAddressStr = (addr) => {
  if (!addr) return "";
  if (typeof addr === "string") return addr.trim();
  if (Array.isArray(addr)) {
    for (const a of addr) {
      const res = _toAddressStr(a);
      if (res) return res;
    }
    return "";
  }
  if (typeof addr === "object") {
    if (typeof addr.address === "string" && addr.address.trim()) return addr.address.trim();
    if (typeof addr.full_address === "string" && addr.full_address.trim()) return addr.full_address.trim();
    const parts = [addr.address_1, addr.address_2, addr.city, addr.state, addr.postal_code || addr.pin]
      .filter((p) => p !== undefined && p !== null && String(p).trim() !== "")
      .map((p) => String(p).trim());
    if (parts.length > 0) return parts.join(", ");
    if (addr.label) return String(addr.label);
    return "";
  }
  return String(addr);
};

export const getDtpProofsForEnquiry = async (req, res) => {
  try {
    const { id } = req.params;
    const { subJobNo } = req.query;

    let job = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      job = await EnquiryJob.findById(id).populate("customer_id");
    }
    if (!job) {
      job = await EnquiryJob.findOne({
        $or: [{ enquiry_no: id }, { enquiry_no: `RD${id}` }, { seq: Number(id) || -1 }],
      }).populate("customer_id");
    }

    if (!job) {
      return res.status(404).json({ success: false, message: "Enquiry job not found" });
    }

    const subJobs = (job.sub_jobs || []).filter((s) => !s.is_dropped);
    const subJobMap = {};

    for (const sj of subJobs) {
      if (subJobNo && sj.sub_job_no !== subJobNo) continue;

      const reqPhase = (req.query.phase || "").toLowerCase();
      const isSampleJob = Boolean(
        reqPhase === "sample" ||
        ((!reqPhase || reqPhase === "") && (
          sj.is_sample ||
          sj.sample_order_id ||
          job.order_type === "sample" ||
          job.job_type === "sample"
        ))
      );

      let isMasterApproved = false;
      let isMasterFullyApproved = false;
      let hasMasterApproved = false;
      let isContentApproved = false;
      let hasContentApproved = false;
      let isMasterRejected = false;
      let isContentRejected = false;

      let dtpDoc = null;
      if (sj.dtp_id) {
        dtpDoc = await dtpStudioModel.findById(sj.dtp_id).lean();
      }

      if (!dtpDoc) {
        const cleanSjNo = String(sj.sub_job_no || "").trim();
        const withRd = cleanSjNo.startsWith("RD") ? cleanSjNo : `RD${cleanSjNo}`;
        const withoutRd = cleanSjNo.replace(/^RD/i, "");
        const cleanJobNo = String(job.enquiry_no || job.seq || "").trim();
        const cleanJobNoWithRd = cleanJobNo.startsWith("RD") ? cleanJobNo : `RD${cleanJobNo}`;
        const cleanJobNoWithoutRd = cleanJobNo.replace(/^RD/i, "");
        const suffix = cleanSjNo.replace(/^RD[0-9]+-/i, "");
        const comboWithRd = `${cleanJobNoWithRd}-${suffix}`;
        const comboWithoutRd = `${cleanJobNoWithoutRd}-${suffix}`;

        dtpDoc = await dtpStudioModel.findOne({
          $or: [
            { sub_job_no: cleanSjNo },
            { sub_job_no: withRd },
            { sub_job_no: withoutRd },
            { sub_job_no: comboWithRd },
            { sub_job_no: comboWithoutRd },
            ...(sj.sample_order_id ? [{ sample_order_id: sj.sample_order_id }] : []),
            ...(subJobs.length === 1 ? [
              { job_no: cleanJobNoWithRd },
              { job_no: cleanJobNoWithoutRd },
              { reference_enquiry: cleanJobNoWithRd },
              { reference_enquiry: cleanJobNoWithoutRd },
              { enquiry_id: job._id }
            ] : [])
          ],
        }).sort({ createdAt: -1 }).lean();
      }

      if (dtpDoc) {
        const signedMasterFiles = (dtpDoc.master_template_files || []).map((f) => ({
          ...f,
          _id: f._id ? String(f._id) : undefined,
          file_url: f.file_url ? generateSignedUrl(f.file_url) : "",
          raw_url: f.file_url,
        }));

        const signedContentFiles = (dtpDoc.content_proofing_files || []).map((f) => ({
          ...f,
          _id: f._id ? String(f._id) : undefined,
          file_url: f.file_url ? generateSignedUrl(f.file_url) : "",
          raw_url: f.file_url,
        }));

        const signedArtworkFiles = (dtpDoc.artwork_files || []).map((url) =>
          url ? generateSignedUrl(url) : ""
        ).filter(Boolean);

        const signedFinalPrepFiles = [];
        (dtpDoc.final_prep_files || []).forEach((prep) => {
          (prep.production_files || []).forEach((pf) => {
            if (pf?.file_url) {
              signedFinalPrepFiles.push({
                file_url: generateSignedUrl(pf.file_url),
                raw_url: pf.file_url,
                material_group_name: prep.material_group_name || "",
                material_group_id: prep.material_group_id || "",
                uploaded_at: pf.uploaded_at || "",
              });
            }
          });
        });

        hasMasterApproved = (signedMasterFiles || []).some((f) => f.status === "Approved");
        isMasterApproved = hasMasterApproved;
        isMasterFullyApproved =
          signedMasterFiles.length > 0 &&
          signedMasterFiles.every((f) => f.status === "Approved");
        hasContentApproved = (signedContentFiles || []).some((f) => f.status === "Approved");
        isContentApproved =
          signedContentFiles.length > 0 &&
          signedContentFiles.every((f) => f.status === "Approved");
        isMasterRejected = signedMasterFiles.some((f) => f.status === "Rejected");
        isContentRejected = signedContentFiles.some((f) => f.status === "Rejected");

        subJobMap[sj.sub_job_no] = {
          dtp_id: dtpDoc._id,
          sub_job_no: sj.sub_job_no,
          dtp_status: dtpDoc.status,
          assigned_to_name: dtpDoc.assigned_to_name || "DTP Artist",
          is_master_approved: isMasterApproved,
          is_master_fully_approved: isMasterFullyApproved,
          has_master_approved: hasMasterApproved,
          is_content_approved: isContentApproved,
          has_content_approved: hasContentApproved,
          is_master_rejected: isMasterRejected,
          is_content_rejected: isContentRejected,
          can_upload_content: isSampleJob ? true : hasMasterApproved,
          master_template_files: signedMasterFiles,
          content_proofing_files: signedContentFiles,
          artwork_files: signedArtworkFiles,
          final_prep_files: signedFinalPrepFiles,
          updated_at: dtpDoc.updated_at || dtpDoc.updatedAt,
          is_sample: isSampleJob,
        };
      } else {
        subJobMap[sj.sub_job_no] = {
          dtp_id: null,
          sub_job_no: sj.sub_job_no,
          dtp_status: "Pending DTP push",
          assigned_to_name: "",
          is_master_approved: false,
          is_content_approved: false,
          is_master_rejected: false,
          is_content_rejected: false,
          can_upload_content: false,
          master_template_files: [],
          content_proofing_files: [],
          artwork_files: [],
          updated_at: null,
          is_sample: Boolean(
            sj.is_sample ||
            sj.sample_order_id ||
            job.order_type === "sample" ||
            job.job_type === "sample" ||
            job.wizard_state?.dtp?.sample?.proofFile
          ),
        };
      }

      // Check if Client Servicing uploaded a proof file directly
      const csProof =
        job.wizard_state?.dtp?.sample?.proofFile ||
        job.wizard_state?.dtp?.production?.proofFile;
      if (csProof && (csProof.file_url || csProof.raw_url)) {
        const signedCsUrl = generateSignedUrl(csProof.raw_url || csProof.file_url);
        const csProofItem = {
          _id: "cs_proof_" + sj.sub_job_no,
          name: csProof.name || "Sample_Artwork_Proof",
          file_url: signedCsUrl,
          raw_url: csProof.raw_url || csProof.file_url,
          size: csProof.size || 0,
          mimetype: csProof.mimetype || "application/pdf",
          uploaded_at: csProof.uploaded_at || "",
          uploaded_by: csProof.uploaded_by || "Client Servicing",
          status: csProof.status || "Pending",
          is_cs_upload: true,
          phase: csProof.phase || (job.wizard_state?.dtp?.sample?.proofFile ? "sample" : "production"),
          is_sample: Boolean(
            csProof.phase === "sample" ||
            job.wizard_state?.dtp?.sample?.proofFile ||
            sj.is_sample ||
            job.order_type === "sample" ||
            job.job_type === "sample"
          ),
          rejection_reason: csProof.rejection_reason || "",
        };

        subJobMap[sj.sub_job_no].cs_uploaded_proof = csProofItem;

        if (subJobMap[sj.sub_job_no].master_template_files.length === 0) {
          subJobMap[sj.sub_job_no].master_template_files = [csProofItem];
        }
      }

      // Check if Client Servicing uploaded content file directly
      const csContent =
        job.wizard_state?.dtp?.sample?.content ||
        job.wizard_state?.dtp?.production?.content;
      if (csContent && (csContent.file_url || csContent.raw_url)) {
        const isCsContentApproved = Boolean(
          csContent.status === "Approved" ||
          sj.content_proof_status === "approved" ||
          sj.proof_status === "approved" ||
          job.wizard_state?.dtp?.sample?.proofSent === "Approved" ||
          job.wizard_state?.dtp?.sample?.approved ||
          isContentApproved ||
          (isSampleJob && isMasterApproved)
        );
        const signedCsContentUrl = generateSignedUrl(csContent.raw_url || csContent.file_url);
        const csContentItem = {
          _id: "cs_content_" + sj.sub_job_no,
          name: csContent.name || "Content_File",
          original_name: csContent.name || "Content_File",
          file_url: signedCsContentUrl,
          raw_url: csContent.raw_url || csContent.file_url,
          size: csContent.size || 0,
          mimetype: csContent.mimetype || "application/octet-stream",
          uploaded_at: csContent.uploaded_at || "",
          uploaded_by: csContent.uploaded_by || "Client Servicing",
          status: isCsContentApproved ? "Approved" : (csContent.status || "Pending"),
          is_cs_upload: true,
        };

        subJobMap[sj.sub_job_no].cs_uploaded_content = csContentItem;
        subJobMap[sj.sub_job_no].content_file_url = signedCsContentUrl;

        if (subJobMap[sj.sub_job_no].content_proofing_files.length === 0) {
          subJobMap[sj.sub_job_no].content_proofing_files = [csContentItem];
        }
      }

      // Ensure subJobMap reflects proof_status, proof_decision, and phase-scoped approval
      if (isSampleJob) {
        const isSubJobSampleApproved = Boolean(
          isMasterApproved ||
          sj.sample_proof_status === "approved" ||
          sj.proof_status === "approved" ||
          sj.master_template_status === "approved" ||
          job.wizard_state?.dtp?.sample?.proofSent === "Approved" ||
          job.wizard_state?.dtp?.sample?.approved ||
          job.wizard_state?.dtp?.sample?.proofFile?.status === "Approved" ||
          (job.wizard_state?.dtp?.sample?.proofFiles || []).some((f) => f.status === "Approved") ||
          subJobMap[sj.sub_job_no]?.cs_uploaded_proof?.status === "Approved" ||
          (subJobMap[sj.sub_job_no]?.master_template_files || []).some((f) => f.status === "Approved")
        );

        subJobMap[sj.sub_job_no].proof_status = isSubJobSampleApproved ? "approved" : (sj.sample_proof_status || sj.proof_status || "pending");
        subJobMap[sj.sub_job_no].proof_decision = sj.sample_proof_decision || sj.proof_decision || job.wizard_state?.dtp?.sample?.approved || null;

        if (isSubJobSampleApproved) {
          subJobMap[sj.sub_job_no].is_master_approved = true;
          subJobMap[sj.sub_job_no].is_content_approved = true;
          subJobMap[sj.sub_job_no].master_template_status = "approved";
          subJobMap[sj.sub_job_no].content_proof_status = "approved";
          (subJobMap[sj.sub_job_no].master_template_files || []).forEach((f) => {
            f.status = "Approved";
          });
          (subJobMap[sj.sub_job_no].content_proofing_files || []).forEach((f) => {
            f.status = "Approved";
          });
          if (subJobMap[sj.sub_job_no].cs_uploaded_proof) {
            subJobMap[sj.sub_job_no].cs_uploaded_proof.status = "Approved";
          }
          if (subJobMap[sj.sub_job_no].cs_uploaded_content) {
            subJobMap[sj.sub_job_no].cs_uploaded_content.status = "Approved";
          }
        }
      } else {
        // PRODUCTION PHASE: Strictly isolated from sample approval!
        const isProdProofApproved = Boolean(
          (isMasterApproved && isContentApproved) ||
          sj.production_proof_status === "approved" ||
          job.wizard_state?.dtp?.production?.approved ||
          job.wizard_state?.dtp?.prod?.approved
        );

        subJobMap[sj.sub_job_no].proof_status = isProdProofApproved ? "approved" : (sj.production_proof_status || "pending");
        subJobMap[sj.sub_job_no].production_proof_status = isProdProofApproved ? "approved" : (sj.production_proof_status || "pending");
        subJobMap[sj.sub_job_no].proof_decision = sj.production_proof_decision || job.wizard_state?.dtp?.production?.approved || job.wizard_state?.dtp?.prod?.approved || null;
        subJobMap[sj.sub_job_no].production_proof_decision = subJobMap[sj.sub_job_no].proof_decision;

        if (sj.production_master_template_status === "approved" || isMasterApproved) {
          subJobMap[sj.sub_job_no].is_master_approved = true;
          subJobMap[sj.sub_job_no].master_template_status = "approved";
        }
        if (sj.production_content_proof_status === "approved" || isContentApproved) {
          subJobMap[sj.sub_job_no].is_content_approved = true;
          subJobMap[sj.sub_job_no].content_proof_status = "approved";
        }
      }
    }

    return res.status(200).json({
      success: true,
      enquiry_id: job._id,
      enquiry_no: job.enquiry_no,
      is_sample: Boolean(
        job.order_type === "sample" ||
        job.job_type === "sample" ||
        job.wizard_state?.dtp?.sample?.proofFile ||
        (job.sub_jobs || []).some((s) => s.is_sample || s.sample_order_id)
      ),
      order_type: job.order_type || job.job_type || (job.wizard_state?.dtp?.sample?.proofFile ? "sample" : "production"),
      proofs: subJobMap,
    });
  } catch (error) {
    console.error("Error in getDtpProofsForEnquiry:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * shareDtpProofWithClient
 * Generates public client review link and sends email/whatsapp with proof preview.
 */
export const shareDtpProofWithClient = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      channel = "whatsapp", // "email" | "whatsapp" | "link"
      recipient = "",
      subJobNo,
      notes = "",
      duration = 48,
      phase,
    } = req.body || {};

    let job = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      job = await EnquiryJob.findById(id).populate("customer_id");
    }
    if (!job) {
      job = await EnquiryJob.findOne({
        $or: [{ enquiry_no: id }, { enquiry_no: `RD${id}` }, { seq: Number(id) || -1 }],
      }).populate("customer_id");
    }

    if (!job) {
      return res.status(404).json({ success: false, message: "Enquiry job not found" });
    }

    const parentJobNo = job.enquiry_no || `RD${job.seq || 21072}`;
    const targetSubJobNo = subJobNo || (job.sub_jobs?.[0]?.sub_job_no) || `${parentJobNo}-A1`;
    const matchedSj = (job.sub_jobs || []).find((s) => s.sub_job_no === targetSubJobNo) || job.sub_jobs?.[0];

    // Fetch DTP document for proofs
    let dtpDoc = null;
    if (matchedSj?.dtp_id) {
      dtpDoc = await dtpStudioModel.findById(matchedSj.dtp_id).lean();
    }
    if (!dtpDoc) {
      dtpDoc = await dtpStudioModel.findOne({
        $or: [
          { sub_job_no: targetSubJobNo },
          { sub_job_no: `RD${String(targetSubJobNo).replace(/^RD/i, "")}` },
          { sub_job_no: String(targetSubJobNo).replace(/^RD/i, "") },
        ],
      }).sort({ createdAt: -1 }).lean();
    }

    const masterProofs = (dtpDoc?.master_template_files || []).map((f) => ({
      ...f,
      file_url: f.file_url ? generateSignedUrl(f.file_url) : "",
    }));
    const contentProofs = (dtpDoc?.content_proofing_files || []).map((f) => ({
      ...f,
      file_url: f.file_url ? generateSignedUrl(f.file_url) : "",
    }));

    // Determine whether this is a sample phase or production phase
    const explicitPhase = String(
      phase || req.body?.phase || req.query?.phase || ""
    ).trim().toLowerCase();

    const isProductionStep = Boolean(
      explicitPhase === "production" ||
      explicitPhase === "prod" ||
      job.step >= 4 ||
      job.stage === "production" ||
      job.wizard_state?.stage === "production" ||
      job.order_mode?.mode === "production" ||
      job.production_order_id ||
      matchedSj?.production_order_id
    );

    const isSamplePhase = !isProductionStep && Boolean(
      explicitPhase === "sample" ||
      job.step === 2 ||
      (job.order_type === "sample" && !job.step) ||
      (job.job_type === "sample" && !job.step) ||
      matchedSj?.is_sample
    );
    const phaseParam = isSamplePhase ? "&phase=sample" : "&phase=production";

    // Generate public review link with token
    const baseUrl = process.env.CLIENT_CONFIRMATION_SCREEN_URL || "http://localhost:5173";
    const targetId = job._id || job.enquiry_no;
    const durationHours = Number(duration || 48);
    const { token, exp, sig } = generatePublicToken(targetId, durationHours);
    const clientLink = `${baseUrl}/rd/quote-view/${targetId}?token=${token}&exp=${exp}&sig=${sig}&tab=proof&subjobs=${encodeURIComponent(targetSubJobNo)}${phaseParam}`;

    const customer = job.customer_id || {};
    const clientName = job.contact_person || customer.contact_person || customer.name || "Client";
    const toEmail = recipient || job.contact_email || customer.email || "";

    const now = new Date();

    if (channel === "email" && toEmail && transporter) {
      const emailHTML = `
        <html>
          <body style="margin:0; padding:0; background-color:#f8fafc; font-family:'Segoe UI', Arial, sans-serif;">
            <table width="100%" cellspacing="0" cellpadding="0" style="padding:30px 0;">
              <tr>
                <td align="center">
                  <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,0.08);">
                    <tr>
                      <td style="background:#004aad; padding:24px 30px; text-align:center;">
                        <h2 style="color:#ffffff; margin:0; font-size:22px; font-weight:700;">${isSamplePhase ? "Sample Artwork Proof for Approval" : "Production Artwork Proof for Approval"}</h2>
                        <p style="color:#bfdbfe; margin:6px 0 0; font-size:13px;">${parentJobNo} · Sub-Job ${targetSubJobNo} · ${isSamplePhase ? "Sample Piece" : "Production Run"}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:28px 32px;">
                        <p style="font-size:15px; color:#1e293b; margin:0 0 16px;">Dear <strong>${clientName}</strong>,</p>
                        <p style="font-size:14px; line-height:1.6; color:#475569; margin:0 0 20px;">
                          ${isSamplePhase
                            ? "Our DTP design studio has prepared the sample artwork proof for your order. Please inspect the design layout, logos, text, and dimensions, and submit your approval or alteration request."
                            : "Our DTP design studio has prepared the artwork layout and content proof for your production run. Please inspect the master layout and content proofs to approve for the production run."}
                        </p>

                        <div style="background:#f1f5f9; border-radius:8px; padding:16px; margin-bottom:24px;">
                          <div style="font-size:13px; font-weight:700; color:#0f172a; margin-bottom:8px;">Order Reference:</div>
                          <div style="font-size:13px; color:#475569;"><strong>Job:</strong> ${parentJobNo} (${targetSubJobNo})</div>
                          <div style="font-size:13px; color:#475569;"><strong>Product / Theme:</strong> ${matchedSj?.theme || matchedSj?.product_name || "Custom Trophy"}</div>
                          <div style="font-size:13px; color:#475569;"><strong>Quantity:</strong> ${matchedSj?.quantity || 1} pcs</div>
                          ${notes ? `<div style="font-size:13px; color:#64748b; margin-top:8px;"><em>Note: ${notes}</em></div>` : ""}
                        </div>

                        <div style="text-align:center; margin:32px 0 20px;">
                          <a href="${clientLink}" target="_blank" style="display:inline-block; background:#004aad; color:#ffffff; font-weight:700; font-size:15px; padding:14px 36px; text-decoration:none; border-radius:8px; box-shadow:0 4px 12px rgba(0,74,173,0.3);">
                            Review & Approve Proof Online
                          </a>
                        </div>
                        <p style="text-align:center; font-size:12px; color:#64748b; margin:0 0 20px;">
                          🔒 Link active for ${durationHours} hours
                        </p>
                        <p style="font-size:13px; color:#475569; line-height:1.6;">
                          Warm regards,<br/>
                          <strong>RD Custom Awards Pvt. Ltd.</strong>
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

      const sjTheme = matchedSj?.theme || matchedSj?.product_name || "";
      const sjThemePart = sjTheme ? ` (${sjTheme})` : "";
      await sendMailWithUser(req.user, {
        to: toEmail,
        subject: `${isSamplePhase ? "Sample Artwork Proof Approval" : "Artwork Proof Approval Required"} - ${parentJobNo} (${targetSubJobNo})${sjThemePart} - RD Custom Awards`,
        html: emailHTML,
      });
    }

    // Update wizard_state and sub_job audit
    const wizard_state = { ...(job.wizard_state || {}) };
    wizard_state.dtpProofSharing = {
      channel,
      sentAt: now.toISOString(),
      recipient: recipient || toEmail,
      subJobNo: targetSubJobNo,
      notes,
    };
    job.wizard_state = wizard_state;
    job.markModified("wizard_state");

    if (matchedSj) {
      matchedSj.proof_status = "sent_to_client";
      matchedSj.proof_sent_at = now;
      job.markModified("sub_jobs");
    }

    job.history.push({
      action: "DTP_PROOF_SHARED",
      step: job.step || 4,
      sub_job_no: targetSubJobNo,
      remarks: `DTP Proof shared with client via ${channel}${recipient ? ` (${recipient})` : ""}`,
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
      message: `Proof shared successfully via ${channel}`,
      clientLink,
      recipient: toEmail || recipient,
      subJobNo: targetSubJobNo,
      masterProofsCount: masterProofs.length,
      contentProofsCount: contentProofs.length,
    });
  } catch (error) {
    console.error("Error in shareDtpProofWithClient:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * recordClientProofFeedback
 * Records client approval or alteration request on DTP proof, and syncs status back to DTP Studio.
 */
export const recordClientProofFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      fileId, // Specific attachment ObjectId
      fileType, // "master" | "proofing"
      status, // "Approved" | "Rejected"
      rejection_reason = "",
      decision = "approved", // fallback / bulk: "approved" | "revision"
      stage, // "master" | "proofing" (if bulk for a stage)
      subJobNo,
      remarks = "",
      clientName = "",
    } = req.body || {};

    let job = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      job = await EnquiryJob.findById(id).populate("customer_id");
    }
    if (!job) {
      job = await EnquiryJob.findOne({
        $or: [{ enquiry_no: id }, { enquiry_no: `RD${id}` }, { seq: Number(id) || -1 }],
      }).populate("customer_id");
    }

    if (!job) {
      return res.status(404).json({ success: false, message: "Enquiry job not found" });
    }

    if (!req.user) {
      const authCheck = verifyPublicLink(job, req);
      if (!authCheck.valid) {
        return res.status(authCheck.status).json({ success: false, message: authCheck.message });
      }
    }

    const now = new Date();
    const nowStr = getCurrentDate();
    const targetSubJobNo = subJobNo || job.sub_jobs?.[0]?.sub_job_no;
    const clientActor = clientName || job.contact_person || job.customer_id?.name || "Client";
    const matchedSj = (job.sub_jobs || []).find((s) => s.sub_job_no === targetSubJobNo);

    // Fetch DTP Studio document
    let dtpDoc = null;
    if (matchedSj?.dtp_id) {
      dtpDoc = await dtpStudioModel.findById(matchedSj.dtp_id);
    }
    if (!dtpDoc && targetSubJobNo) {
      dtpDoc = await dtpStudioModel.findOne({
        $or: [
          { sub_job_no: targetSubJobNo },
          { sub_job_no: `RD${String(targetSubJobNo).replace(/^RD/i, "")}` },
          { sub_job_no: String(targetSubJobNo).replace(/^RD/i, "") },
        ],
      }).sort({ createdAt: -1 });
    }

    const reqPhase = (req.query.phase || req.body.phase || "").toLowerCase();
    const isSampleOrder = Boolean(
      reqPhase === "sample" ||
      ((!reqPhase || reqPhase === "") && (
        job.order_type === "sample" ||
        job.job_type === "sample" ||
        matchedSj?.is_sample ||
        matchedSj?.sample_order_id
      ))
    );

    const targetStatus = status || (decision === "approved" ? "Approved" : "Rejected");
    const reason = (rejection_reason || remarks || "").trim();

    // Handle optional reference file for rejections
    let referenceFileUrl = "";
    if (req.file) {
      try {
        const category = job.category || "uncategorized";
        const subcategory = job.subcategory || "unsubcategorized";
        const parentJobNo = job.enquiry_no || `RD${job.seq || 21072}`;
        const path = `${category}/${subcategory}/${parentJobNo}/${targetSubJobNo}/dtp/rejections`;
        referenceFileUrl = await uploadToR2(path, req.file.buffer, req.file.originalname, req.file.mimetype);
      } catch (uploadErr) {
        console.error("Error uploading reference file for proof feedback:", uploadErr);
      }
    }

    if (dtpDoc) {
      // CASE 1: Individual file approval / alteration / rejection
      if (fileId && fileType && !isSampleOrder) {
        if (fileType === "master") {
          const mFile = (dtpDoc.master_template_files || []).find(
            (f) => String(f._id) === String(fileId) || f.file_url === fileId
          );
          if (mFile) {
            mFile.status = targetStatus;
            mFile.action_by_type = req.user ? "Internal User" : "Client Link";
            mFile.action_by_name = req.user?.name || clientActor;
            mFile.action_by_role = req.user?.role || "Client";
            if (targetStatus === "Approved") {
              mFile.approved_at = nowStr;
              mFile.approved_by_name = clientActor;
              mFile.rejection_reason = "";
              mFile.alteration_notes = "";
              mFile.rejection_reference_file = "";
            } else if (targetStatus === "Alteration") {
              mFile.rejected_at = nowStr;
              mFile.rejected_by_name = clientActor;
              mFile.alteration_notes = reason || "Client requested alterations";
              mFile.rejection_reason = reason || "Client requested alterations";
              if (referenceFileUrl) mFile.rejection_reference_file = referenceFileUrl;
            } else {
              mFile.rejected_at = nowStr;
              mFile.rejected_by_name = clientActor;
              mFile.rejection_reason = reason || "Client rejected proof";
              mFile.alteration_notes = "";
              if (referenceFileUrl) mFile.rejection_reference_file = referenceFileUrl;
            }
          }
        } else if (fileType === "proofing") {
          const cFile = (dtpDoc.content_proofing_files || []).find(
            (f) => String(f._id) === String(fileId) || f.file_url === fileId
          );
          if (cFile) {
            cFile.status = targetStatus;
            cFile.action_by_type = req.user ? "Internal User" : "Client Link";
            cFile.action_by_name = req.user?.name || clientActor;
            cFile.action_by_role = req.user?.role || "Client";
            if (targetStatus === "Approved") {
              cFile.approved_at = nowStr;
              cFile.approved_by_name = clientActor;
              cFile.rejection_reason = "";
              cFile.alteration_notes = "";
              cFile.rejection_reference_file = "";
            } else if (targetStatus === "Alteration") {
              cFile.rejected_at = nowStr;
              cFile.rejected_by_name = clientActor;
              cFile.alteration_notes = reason || "Client requested alterations";
              cFile.rejection_reason = reason || "Client requested alterations";
              if (referenceFileUrl) cFile.rejection_reference_file = referenceFileUrl;
            } else {
              cFile.rejected_at = nowStr;
              cFile.rejected_by_name = clientActor;
              cFile.rejection_reason = reason || "Client rejected proof";
              cFile.alteration_notes = "";
              if (referenceFileUrl) cFile.rejection_reference_file = referenceFileUrl;
            }
          }
        }
      } else {
        // CASE 2: Bulk decision for a stage or whole sub-job (or Sample Unified Approval)
        const targetStage = isSampleOrder ? "all" : (stage || "all");

        if (targetStage === "master" || targetStage === "all") {
          (dtpDoc.master_template_files || []).forEach((f) => {
            f.status = targetStatus;
            f.action_by_type = req.user ? "Internal User" : "Client Link";
            f.action_by_name = req.user?.name || clientActor;
            f.action_by_role = req.user?.role || "Client";
            if (targetStatus === "Approved") {
              f.approved_at = nowStr;
              f.approved_by_name = clientActor;
              f.rejection_reason = "";
              f.alteration_notes = "";
              f.rejection_reference_file = "";
            } else if (targetStatus === "Alteration") {
              f.rejected_at = nowStr;
              f.rejected_by_name = clientActor;
              f.alteration_notes = reason || "Client requested alteration";
              f.rejection_reason = reason || "Client requested alteration";
              if (referenceFileUrl) f.rejection_reference_file = referenceFileUrl;
            } else {
              f.rejected_at = nowStr;
              f.rejected_by_name = clientActor;
              f.rejection_reason = reason || "Client rejected proof";
              f.alteration_notes = "";
              if (referenceFileUrl) f.rejection_reference_file = referenceFileUrl;
            }
          });
        }

        if (targetStage === "proofing" || targetStage === "all") {
          (dtpDoc.content_proofing_files || []).forEach((f) => {
            f.status = targetStatus;
            f.action_by_type = req.user ? "Internal User" : "Client Link";
            f.action_by_name = req.user?.name || clientActor;
            f.action_by_role = req.user?.role || "Client";
            if (targetStatus === "Approved") {
              f.approved_at = nowStr;
              f.approved_by_name = clientActor;
              f.rejection_reason = "";
              f.alteration_notes = "";
              f.rejection_reference_file = "";
            } else if (targetStatus === "Alteration") {
              f.rejected_at = nowStr;
              f.rejected_by_name = clientActor;
              f.alteration_notes = reason || "Client requested alteration";
              f.rejection_reason = reason || "Client requested alteration";
              if (referenceFileUrl) f.rejection_reference_file = referenceFileUrl;
            } else {
              f.rejected_at = nowStr;
              f.rejected_by_name = clientActor;
              f.rejection_reason = reason || "Client rejected proof";
              f.alteration_notes = "";
              if (referenceFileUrl) f.rejection_reference_file = referenceFileUrl;
            }
          });
        }
      }

      // Check aggregate statuses across both stages
      const masterFiles = dtpDoc.master_template_files || [];
      const contentFiles = dtpDoc.content_proofing_files || [];

      const hasMasterApproved = masterFiles.some((f) => f.status === "Approved");
      const allMasterApproved =
        masterFiles.length > 0 && masterFiles.every((f) => f.status === "Approved");
      const _anyMasterRejected = masterFiles.some((f) => f.status === "Rejected");

      const allContentApproved =
        contentFiles.length > 0 && contentFiles.every((f) => f.status === "Approved");
      const _anyContentRejected = contentFiles.some((f) => f.status === "Rejected");

      // Auto-unlock DTP studio stage transition:
      if (isSampleOrder) {
        if (targetStatus === "Approved" || (allMasterApproved && allContentApproved)) {
          dtpDoc.status = "Final Prep";
        }
      } else {
        if (hasMasterApproved && dtpDoc.status === "Master Template") {
          dtpDoc.status = "Content Proofing";
        } else if (hasMasterApproved && allContentApproved && dtpDoc.status === "Content Proofing") {
          dtpDoc.status = "Final Prep";
        }
      }

      dtpDoc.history.push({
        action: `CLIENT_PROOF_${(status || decision || "FEEDBACK").toUpperCase()}`,
        description: `Client updated ${fileType || stage || "proof"}: ${status || decision}${
          rejection_reason || remarks ? ` - ${rejection_reason || remarks}` : ""
        }`,
        user: null,
        date: nowStr,
      });

      dtpDoc.updated_at = nowStr;
      await dtpDoc.save();
    }

    // Update EnquiryJob sub-job status and wizard_state (runs whether dtpDoc exists or not)
    if (isSampleOrder) {
      const isSampleApproved = targetStatus === "Approved" || decision === "approved";
      const isSampleRejected = targetStatus === "Rejected" || decision === "revision" || decision === "rejected";

      if (isSampleApproved) {
        if (matchedSj) {
          matchedSj.sample_master_template_status = "approved";
          matchedSj.sample_master_template_approved_at = now;
          matchedSj.sample_content_proof_status = "approved";
          matchedSj.sample_content_proof_approved_at = now;
          matchedSj.sample_proof_status = "approved";
          matchedSj.sample_proof_approved_at = now;
          matchedSj.master_template_status = "approved";
          matchedSj.master_template_approved_at = now;
          matchedSj.content_proof_status = "approved";
          matchedSj.content_proof_approved_at = now;
          matchedSj.proof_status = "approved";
          matchedSj.proof_approved_at = now;
          matchedSj.sample_proof_decision = {
            decision: "approved",
            status: "Approved",
            remarks: remarks || "",
            at: now,
            by: clientActor,
          };
          matchedSj.proof_decision = matchedSj.sample_proof_decision;
        }

        (job.sub_jobs || []).forEach((sj) => {
          sj.sample_master_template_status = "approved";
          sj.sample_master_template_approved_at = now;
          sj.sample_content_proof_status = "approved";
          sj.sample_content_proof_approved_at = now;
          sj.sample_proof_status = "approved";
          sj.sample_proof_approved_at = now;
          sj.master_template_status = "approved";
          sj.master_template_approved_at = now;
          sj.content_proof_status = "approved";
          sj.content_proof_approved_at = now;
          sj.proof_status = "approved";
          sj.proof_approved_at = now;
          sj.sample_proof_decision = {
            decision: "approved",
            status: "Approved",
            remarks: remarks || "",
            at: now,
            by: clientActor,
          };
          sj.proof_decision = sj.sample_proof_decision;
        });
        job.markModified("sub_jobs");

        if (!job.wizard_state) job.wizard_state = {};
        if (!job.wizard_state.dtp) job.wizard_state.dtp = {};
        if (!job.wizard_state.dtp.sample) job.wizard_state.dtp.sample = {};

        if (job.wizard_state.dtp.sample.content) {
          job.wizard_state.dtp.sample.content.status = "Approved";
          job.wizard_state.dtp.sample.content.approved_at = nowStr;
          job.wizard_state.dtp.sample.content.approved_by = clientActor;
        }
        if (Array.isArray(job.wizard_state.dtp.sample.contentFiles)) {
          job.wizard_state.dtp.sample.contentFiles.forEach((f) => {
            f.status = "Approved";
            f.approved_at = nowStr;
            f.approved_by = clientActor;
          });
        }
        if (job.wizard_state.dtp.sample.proofFile) {
          job.wizard_state.dtp.sample.proofFile.status = "Approved";
          job.wizard_state.dtp.sample.proofFile.approved_at = nowStr;
          job.wizard_state.dtp.sample.proofFile.approved_by = clientActor;
        }
        if (Array.isArray(job.wizard_state.dtp.sample.proofFiles)) {
          job.wizard_state.dtp.sample.proofFiles.forEach((f) => {
            f.status = "Approved";
            f.approved_at = nowStr;
            f.approved_by = clientActor;
          });
        }

        job.wizard_state.dtp.sample.approved = {
          at: now.toISOString(),
          by: clientActor,
          method: remarks ? `Client Communication (${remarks})` : "Client Link",
        };
        job.wizard_state.dtp.sample.proofSent = "Approved";
        job.wizard_state.dtp.sample.master_template_status = "approved";
        job.wizard_state.dtp.sample.content_proof_status = "approved";
        job.wizard_state.dtp.sample.proof_status = "approved";
        job.markModified("wizard_state");
      } else if (isSampleRejected) {
        if (matchedSj) {
          matchedSj.sample_master_template_status = "revision";
          matchedSj.sample_content_proof_status = "revision";
          matchedSj.sample_proof_status = "revision";
          matchedSj.master_template_status = "revision";
          matchedSj.content_proof_status = "revision";
          matchedSj.proof_status = "revision";
        }
        (job.sub_jobs || []).forEach((sj) => {
          sj.sample_master_template_status = "revision";
          sj.sample_content_proof_status = "revision";
          sj.sample_proof_status = "revision";
          sj.master_template_status = "revision";
          sj.content_proof_status = "revision";
          sj.proof_status = "revision";
        });
        job.markModified("sub_jobs");
      }
    } else {
      // PRODUCTION APPROVAL: Save cleanly to production fields
      const masterFiles = dtpDoc?.master_template_files || [];
      const contentFiles = dtpDoc?.content_proofing_files || [];
      const allMasterApproved =
        masterFiles.length > 0 && masterFiles.every((f) => f.status === "Approved");
      const anyMasterRejected = masterFiles.some((f) => f.status === "Rejected");
      const allContentApproved =
        contentFiles.length > 0 && contentFiles.every((f) => f.status === "Approved");
      const anyContentRejected = contentFiles.some((f) => f.status === "Rejected");

      const isBulkApprove = targetStatus === "Approved" || decision === "approved";
      const isBulkReject = targetStatus === "Rejected" || decision === "revision" || decision === "rejected";

      const hasMasterApproved = masterFiles.some((f) => f.status === "Approved");
      if (matchedSj) {
        if (hasMasterApproved || allMasterApproved || isBulkApprove) {
          matchedSj.production_master_template_status = "approved";
          matchedSj.production_master_template_approved_at = now;
        } else if (anyMasterRejected || isBulkReject) {
          matchedSj.production_master_template_status = "revision";
        }

        if (allContentApproved || isBulkApprove) {
          matchedSj.production_content_proof_status = "approved";
          matchedSj.production_content_proof_approved_at = now;
        } else if (anyContentRejected || isBulkReject) {
          matchedSj.production_content_proof_status = "revision";
        }

        const prodApproved = isBulkApprove || (allMasterApproved && allContentApproved);
        matchedSj.production_proof_status = prodApproved ? "approved" : (isBulkReject || anyMasterRejected || anyContentRejected ? "revision" : "pending");
        matchedSj.production_proof_approved_at = prodApproved ? now : null;
        matchedSj.production_proof_decision = {
          decision: prodApproved ? "approved" : (isBulkReject ? "revision" : "in_progress"),
          status: prodApproved ? "Approved" : (isBulkReject ? "Revision" : "Pending"),
          remarks: remarks || rejection_reason || "",
          at: now,
          by: clientActor,
          fileId: fileId || null,
          fileType: fileType || null,
        };
      }

      const prodApproved = isBulkApprove || (allMasterApproved && allContentApproved);
      (job.sub_jobs || []).forEach((sj) => {
        if (prodApproved) {
          sj.production_master_template_status = "approved";
          sj.production_master_template_approved_at = now;
          sj.production_content_proof_status = "approved";
          sj.production_content_proof_approved_at = now;
          sj.production_proof_status = "approved";
          sj.production_proof_approved_at = now;
          sj.production_proof_decision = matchedSj?.production_proof_decision || {
            decision: "approved",
            status: "Approved",
            remarks: remarks || "",
            at: now,
            by: clientActor,
          };
        } else if (isBulkReject) {
          sj.production_master_template_status = "revision";
          sj.production_content_proof_status = "revision";
          sj.production_proof_status = "revision";
          sj.production_proof_decision = matchedSj?.production_proof_decision;
        }
      });

      if (!job.wizard_state) job.wizard_state = {};
      if (!job.wizard_state.dtp) job.wizard_state.dtp = {};
      job.wizard_state.dtp.production = job.wizard_state.dtp.production || {};
      job.wizard_state.dtp.prod = job.wizard_state.dtp.prod || {};

      if (prodApproved) {
        const prodApprovalData = {
          at: now.toISOString(),
          by: clientActor,
          method: remarks ? `Client Communication (${remarks})` : "Client Link",
          remarks: remarks || "",
        };
        job.wizard_state.dtp.production.approved = prodApprovalData;
        job.wizard_state.dtp.prod.approved = prodApprovalData;
        job.wizard_state.dtp.production.proofSent = "Approved";
        job.wizard_state.dtp.prod.proofSent = "Approved";
      } else if (isBulkReject) {
        job.wizard_state.dtp.production.approved = null;
        job.wizard_state.dtp.prod.approved = null;
      }

      job.markModified("sub_jobs");
      job.markModified("wizard_state");
    }

    // Also sync client feedback to wizard_state.dtp.sample/production proofFile
    const wizard_state = { ...(job.wizard_state || {}) };
    let wizardUpdated = false;

    const targetPhaseKey = isSampleOrder ? "sample" : "production";
    const altPhaseKey = isSampleOrder ? "sample" : "prod";
    [targetPhaseKey, altPhaseKey].forEach((p) => {
      if (wizard_state.dtp?.[p]?.proofFile) {
        const pf = wizard_state.dtp[p].proofFile;
        if (!fileId || String(fileId).includes("cs_proof_") || pf.file_url === fileId || pf.raw_url === fileId) {
          pf.status = targetStatus;
          pf.action_at = nowStr;
          pf.action_by = clientActor;
          if (targetStatus === "Rejected") {
            pf.rejection_reason = reason || "Client requested alteration";
          } else {
            pf.rejection_reason = "";
          }
          wizardUpdated = true;
        }
      }
      if (Array.isArray(wizard_state.dtp?.[p]?.proofFiles)) {
        wizard_state.dtp[p].proofFiles.forEach((pf) => {
          if (!fileId || String(fileId).includes("cs_proof_") || pf.file_url === fileId || pf.raw_url === fileId) {
            pf.status = targetStatus;
            pf.action_at = nowStr;
            pf.action_by = clientActor;
            wizardUpdated = true;
          }
        });
      }
    });
    if (wizardUpdated) {
      job.wizard_state = wizard_state;
      job.markModified("wizard_state");
    }

    job.history.push({
      action: `DTP_PROOF_FEEDBACK`,
      step: job.step || 4,
      sub_job_no: targetSubJobNo,
      remarks: `Client feedback on ${fileType || stage || "proof"} (${fileId || "all"}): ${
        status || decision
      } - ${rejection_reason || remarks || "No remarks"}`,
      changed_by: {
        user_id: null,
        user_name: clientActor,
        role: "Client",
      },
      timestamp: now,
    });

    await job.save();

    return res.status(200).json({
      success: true,
      message: `Proof feedback recorded successfully`,
      fileId,
      fileType,
      status: status || decision,
      subJobNo: targetSubJobNo,
      dtpUpdated: Boolean(dtpDoc),
    });
  } catch (error) {
    console.error("Error in recordClientProofFeedback:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Re-export getPublicProofView from modular controller
export { getPublicProofView } from "./dtpProofPublicController.js";

/**
 * uploadArtworkProof
 * Uploads artwork/proof file uploaded by Client Servicing to Cloudflare R2 and persists in EnquiryJob & DtpStudio.
 */
export const uploadArtworkProof = async (req, res) => {
  try {
    const { id } = req.params;
    const { subJobNo, phase = "sample", round = 1, fileCategory = "proof", fileType } = req.body || {};

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    let job = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      job = await EnquiryJob.findById(id);
    }
    if (!job) {
      job = await EnquiryJob.findOne({
        $or: [{ enquiry_no: id }, { enquiry_no: `RD${id}` }, { seq: Number(id) || -1 }],
      });
    }

    if (!job) {
      return res.status(404).json({ success: false, message: "Enquiry job not found" });
    }

    const parentJobNo = job.enquiry_no || `RD${job.seq || 21072}`;
    const targetSubJobNo = subJobNo || (job.sub_jobs?.[0]?.sub_job_no) || `${parentJobNo}-A1`;
    const nowISO = new Date().toISOString();
    const uploadedByName = req.user?.name || req.user?.username || "Client Servicing";
    const isContent = (fileCategory === "content" || fileType === "content");

    // 1. Upload to Cloudflare R2
    const folder = isContent ? `dtp_content/${phase}/${parentJobNo}` : `dtp_proofs/${phase}/${parentJobNo}`;
    const fileUrl = await uploadToR2(folder, req.file.buffer, req.file.originalname, req.file.mimetype);
    const signedUrl = generateSignedUrl(fileUrl);

    // 2. Persist in EnquiryJob wizard_state
    const wizard_state = { ...(job.wizard_state || {}) };
    if (!wizard_state.dtp) wizard_state.dtp = {};
    if (!wizard_state.dtp[phase]) wizard_state.dtp[phase] = {};

    const matchedSj = (job.sub_jobs || []).find((s) => s.sub_job_no === targetSubJobNo);

    if (isContent) {
      const contentFileObj = {
        name: req.file.originalname,
        file_url: fileUrl,
        raw_url: fileUrl,
        size: req.file.size,
        mimetype: req.file.mimetype,
        uploaded_at: nowISO,
        uploaded_by: uploadedByName,
        rows: phase === "sample" ? null : 40,
        parsed: true,
      };

      if (phase === "sample") {
        if (!Array.isArray(wizard_state.dtp[phase].contentFiles)) {
          wizard_state.dtp[phase].contentFiles = [];
        }
        wizard_state.dtp[phase].contentFiles.push(contentFileObj);
      }
      wizard_state.dtp[phase].content = contentFileObj;
      wizard_state.dtp[phase].contentAt = nowISO;
      job.wizard_state = wizard_state;
      job.markModified("wizard_state");

      job.history.push({
        action: "DTP_CONTENT_UPLOADED_BY_CS",
        step: job.step || 4,
        sub_job_no: targetSubJobNo,
        remarks: `Content file "${req.file.originalname}" uploaded to R2 by ${uploadedByName} for ${phase} stage`,
        changed_by: {
          user_id: req.user?._id || null,
          user_name: uploadedByName,
          role: req.user?.role || "CS",
        },
        timestamp: new Date(),
      });

      await job.save();

      // Sync to DTP Studio model
      try {
        let dtpDoc = null;
        if (matchedSj?.dtp_id) {
          dtpDoc = await dtpStudioModel.findById(matchedSj.dtp_id);
        }
        if (!dtpDoc) {
          dtpDoc = await dtpStudioModel.findOne({
            $or: [
              { sub_job_no: targetSubJobNo },
              { sub_job_no: `RD${String(targetSubJobNo).replace(/^RD/i, "")}` },
              { sub_job_no: String(targetSubJobNo).replace(/^RD/i, "") },
            ],
          });
        }
        if (dtpDoc) {
          if (!Array.isArray(dtpDoc.content_proofing_files)) {
            dtpDoc.content_proofing_files = [];
          }
          dtpDoc.content_proofing_files.push({
            file_url: fileUrl,
            status: "Pending",
            uploaded_at: getCurrentDate(),
            uploaded_by_cs: true,
            original_name: req.file.originalname,
          });
          await dtpDoc.save();
        }
      } catch (dtpSyncErr) {
        console.warn("Could not sync content file to dtpStudioModel:", dtpSyncErr.message);
      }

      return res.status(200).json({
        success: true,
        message: "Content file uploaded and stored in R2 successfully",
        content: {
          ...contentFileObj,
          signed_url: signedUrl,
        },
      });
    }

    // Default: Artwork Proof file
    const proofFileObj = {
      name: req.file.originalname,
      file_url: fileUrl,
      raw_url: fileUrl,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploaded_at: nowISO,
      uploaded_by: uploadedByName,
      round: Number(round) || 1,
      phase,
      sub_job_no: targetSubJobNo,
    };

    if (phase === "sample") {
      if (!Array.isArray(wizard_state.dtp[phase].proofFiles)) {
        wizard_state.dtp[phase].proofFiles = [];
      }
      wizard_state.dtp[phase].proofFiles.push(proofFileObj);
    }
    wizard_state.dtp[phase].proofFile = proofFileObj;
    wizard_state.dtp[phase].proofAt = nowISO;
    wizard_state.dtp[phase].round = Number(round) || 1;
    wizard_state.dtp[phase].proofSent = null;

    job.wizard_state = wizard_state;
    job.markModified("wizard_state");

    if (matchedSj) {
      matchedSj.proof_status = "ready_for_client";
      matchedSj.proof_file_url = fileUrl;
      job.markModified("sub_jobs");
    }

    job.history.push({
      action: "DTP_PROOF_UPLOADED_BY_CS",
      step: job.step || 4,
      sub_job_no: targetSubJobNo,
      remarks: `Artwork proof "${req.file.originalname}" uploaded to R2 by ${uploadedByName} for ${phase} stage (Round ${round})`,
      changed_by: {
        user_id: req.user?._id || null,
        user_name: uploadedByName,
        role: req.user?.role || "CS",
      },
      timestamp: new Date(),
    });

    await job.save();

    // 3. Sync to DTP Studio model if document exists
    try {
      let dtpDoc = null;
      if (matchedSj?.dtp_id) {
        dtpDoc = await dtpStudioModel.findById(matchedSj.dtp_id);
      }
      if (!dtpDoc) {
        dtpDoc = await dtpStudioModel.findOne({
          $or: [
            { sub_job_no: targetSubJobNo },
            { sub_job_no: `RD${String(targetSubJobNo).replace(/^RD/i, "")}` },
            { sub_job_no: String(targetSubJobNo).replace(/^RD/i, "") },
          ],
        });
      }

      if (dtpDoc) {
        if (!Array.isArray(dtpDoc.master_template_files)) {
          dtpDoc.master_template_files = [];
        }
        dtpDoc.master_template_files.push({
          file_url: fileUrl,
          status: "Pending",
          uploaded_at: getCurrentDate(),
          uploaded_by_cs: true,
          original_name: req.file.originalname,
          round: Number(round) || 1,
        });

        if (!Array.isArray(dtpDoc.artwork_files)) {
          dtpDoc.artwork_files = [];
        }
        if (!dtpDoc.artwork_files.includes(fileUrl)) {
          dtpDoc.artwork_files.push(fileUrl);
        }

        await dtpDoc.save();
      }
    } catch (dtpSyncErr) {
      console.warn("Could not sync CS uploaded proof to dtpStudioModel:", dtpSyncErr.message);
    }

    return res.status(200).json({
      success: true,
      message: "Artwork proof uploaded and stored in R2 successfully",
      proofFile: {
        ...proofFileObj,
        signed_url: signedUrl,
      },
    });
  } catch (error) {
    console.error("Error in uploadArtworkProof:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
