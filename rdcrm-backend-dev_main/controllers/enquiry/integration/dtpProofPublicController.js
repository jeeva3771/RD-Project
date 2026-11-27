import mongoose from "mongoose";
import EnquiryJob from "../../../models/enquiry/enquiryJobIntegrationModel.js";
import dtpStudioModel from "../../../models/dtp_studio/dtpStudioModel.js";
import { generateSignedUrl } from "../../../helpers/r2helper.js";
import { verifyPublicLink } from "../../../helpers/publicLinkToken.js";

const toAddressStr = (addr) => {
  if (!addr) return "";
  if (typeof addr === "string") return addr.trim();
  if (Array.isArray(addr)) {
    for (const a of addr) {
      const res = toAddressStr(a);
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

/**
 * getPublicProofView
 * Public endpoint for client to view DTP master proofs and content proofs.
 */
export const getPublicProofView = async (req, res) => {
  try {
    const { id } = req.params;
    const { subjobs } = req.query;

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

    const authCheck = verifyPublicLink(job, req);
    if (!authCheck.valid) {
      return res.status(authCheck.status || 403).json({ success: false, message: authCheck.message });
    }

    const parentJobNo = job.enquiry_no || `RD${job.seq || 21072}`;
    const activeSubJobs = (job.sub_jobs || []).filter((s) => !s.is_dropped);
    const subJobMap = {};

    for (const sj of activeSubJobs) {
      if (subjobs && !subjobs.includes(sj.sub_job_no)) continue;

      let dtpDoc = null;
      if (sj.dtp_id) {
        dtpDoc = await dtpStudioModel.findById(sj.dtp_id).lean();
      }
      if (!dtpDoc) {
        const cleanSjNo = String(sj.sub_job_no || "").trim();
        dtpDoc = await dtpStudioModel.findOne({
          $or: [
            { sub_job_no: cleanSjNo },
            { sub_job_no: cleanSjNo.startsWith("RD") ? cleanSjNo : `RD${cleanSjNo}` },
            { sub_job_no: cleanSjNo.replace(/^RD/i, "") },
            ...(sj.sample_order_id ? [{ sample_order_id: sj.sample_order_id }] : []),
          ],
        }).sort({ createdAt: -1 }).lean();
      }

      const signedMasterFiles = (dtpDoc?.master_template_files || []).map((f) => ({
        ...f,
        _id: f._id ? String(f._id) : undefined,
        file_url: f.file_url ? generateSignedUrl(f.file_url) : "",
      }));

      const signedContentFiles = (dtpDoc?.content_proofing_files || []).map((f) => ({
        ...f,
        _id: f._id ? String(f._id) : undefined,
        file_url: f.file_url ? generateSignedUrl(f.file_url) : "",
      }));

      const hasMasterApproved = (signedMasterFiles || []).some((f) => f.status === "Approved");
      let isMasterApproved = hasMasterApproved;
      let isContentApproved =
        signedContentFiles.length > 0 && signedContentFiles.every((f) => f.status === "Approved");
      const isMasterRejected = signedMasterFiles.some((f) => f.status === "Rejected");
      const isContentRejected = signedContentFiles.some((f) => f.status === "Rejected");

      // Check if Client Servicing uploaded an artwork proof
      const csProof =
        job.wizard_state?.dtp?.sample?.proofFile ||
        job.wizard_state?.dtp?.production?.proofFile;
      let csUploadedProof = null;
      if (csProof && (csProof.file_url || csProof.raw_url)) {
        const signedCsUrl = generateSignedUrl(csProof.raw_url || csProof.file_url);
        csUploadedProof = {
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

        if (signedMasterFiles.length === 0) {
          signedMasterFiles.push(csUploadedProof);
        }
      }

      // Check if Client Servicing uploaded content file directly
      const csContent =
        job.wizard_state?.dtp?.sample?.content ||
        job.wizard_state?.dtp?.production?.content;
      let csUploadedContent = null;
      if (csContent && (csContent.file_url || csContent.raw_url)) {
        const isCsContentApproved = Boolean(
          csContent.status === "Approved" ||
          sj.content_proof_status === "approved" ||
          sj.proof_status === "approved" ||
          job.wizard_state?.dtp?.sample?.proofSent === "Approved" ||
          job.wizard_state?.dtp?.sample?.approved ||
          isContentApproved ||
          isMasterApproved
        );
        const signedCsContentUrl = generateSignedUrl(csContent.raw_url || csContent.file_url);
        csUploadedContent = {
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

        if (signedContentFiles.length === 0) {
          signedContentFiles.push(csUploadedContent);
        }
      }

      // If sample job and either master is approved or overall proof is approved, ensure all content files reflect Approved
      const reqPhase = String(req.query.phase || "").trim().toLowerCase();
      const isExplicitProduction = reqPhase === "production" || reqPhase === "prod" || job.step >= 4;
      const isSampleSubJob = !isExplicitProduction && Boolean(
        reqPhase === "sample" ||
        job.step === 2 ||
        sj.is_sample ||
        (job.order_type === "sample" && !job.step)
      );
      const isSampleApprovedStatus = Boolean(
        isSampleSubJob && (
          isMasterApproved ||
          sj.proof_status === "approved" ||
          sj.master_template_status === "approved" ||
          sj.content_proof_status === "approved" ||
          job.wizard_state?.dtp?.sample?.proofSent === "Approved" ||
          job.wizard_state?.dtp?.sample?.approved ||
          job.wizard_state?.dtp?.sample?.proofFile?.status === "Approved" ||
          (job.wizard_state?.dtp?.sample?.proofFiles || []).some((f) => f.status === "Approved") ||
          csUploadedProof?.status === "Approved" ||
          signedMasterFiles.some((f) => f.status === "Approved")
        )
      );

      if (isSampleApprovedStatus) {
        signedContentFiles.forEach((f) => {
          f.status = "Approved";
        });
        if (csUploadedContent) {
          csUploadedContent.status = "Approved";
        }
        signedMasterFiles.forEach((f) => {
          f.status = "Approved";
        });
        if (csUploadedProof) {
          csUploadedProof.status = "Approved";
        }
        isMasterApproved = true;
        isContentApproved = true;
      }

      const productImgUrl =
        sj.img_url ||
        sj.selected_option_url ||
        sj.render_url ||
        (sj.design_options?.find((o) => o.selected)?.image_url) ||
        (sj.design_options?.[0]?.image_url) ||
        "";
      const signedProductImgUrl = productImgUrl ? generateSignedUrl(productImgUrl) : "";

      subJobMap[sj.sub_job_no] = {
        sub_job_no: sj.sub_job_no,
        product_name: sj.theme || sj.product_name || "Custom Trophy",
        theme: sj.theme || sj.product_name || "Custom Trophy",
        size: typeof sj.size === "object" ? (sj.size?.trophyH || sj.size?.size || "") : sj.size,
        quantity: sj.quantity || 1,
        spec: (typeof sj.spec === "string" && sj.spec) || sj.spec_line || sj.specLine || (sj.size ? `Trophy · ${typeof sj.size === "object" ? (sj.size?.trophyH || sj.size?.size) : sj.size}" in · Fusion: MDF + Crystal` : ""),
        img_url: signedProductImgUrl,
        proof_status: isSampleApprovedStatus ? "approved" : (sj.proof_status || "pending"),
        proof_decision: sj.proof_decision || job.wizard_state?.dtp?.sample?.approved || null,
        assigned_to_name: dtpDoc?.assigned_to_name || "DTP Artist",
        round: job.wizard_state?.dtp?.sample?.round || job.wizard_state?.dtp?.production?.round || 1,
        master_template_status:
          sj.master_template_status ||
          (isMasterApproved ? "approved" : isMasterRejected ? "revision" : "pending"),
        content_proof_status:
          sj.content_proof_status ||
          (isContentApproved ? "approved" : isContentRejected ? "revision" : "pending"),
        is_master_approved: isMasterApproved,
        is_content_approved: isContentApproved,
        is_master_rejected: isMasterRejected,
        is_content_rejected: isContentRejected,
        can_upload_content: isMasterApproved,
        master_template_files: signedMasterFiles,
        content_proofing_files: signedContentFiles,
        artwork_files: (dtpDoc?.artwork_files || [])
          .map((u) => (u ? generateSignedUrl(u) : ""))
          .filter(Boolean),
        cs_uploaded_proof: csUploadedProof,
        cs_uploaded_content: csUploadedContent,
        content_file_url: (signedContentFiles[0]?.file_url) || csUploadedContent?.file_url || "",
        content_name: csUploadedContent?.name || job.wizard_state?.dtp?.sample?.content?.name || "Sample Artwork Content",
        is_sample: Boolean(
          sj.is_sample ||
          sj.sample_order_id ||
          job.order_type === "sample" ||
          job.job_type === "sample" ||
          job.wizard_state?.dtp?.sample?.proofFile ||
          csUploadedProof?.is_sample
        ),
      };
    }

    const customer = job.customer_id || {};
    const billTo = job.wizard_state?.billTo || job.order_mode?.bill_to || null;
    const isDifferentBillingParty = Boolean(billTo && billTo.on && (billTo.name || billTo.address));

    const rawCustomerBilling = customer.billing_address || (Array.isArray(customer.address) ? customer.address.find(a => a.is_billing) || customer.address[0] : customer.address);
    const defaultAddressStr = toAddressStr(rawCustomerBilling) || "Plot 14, MIDC, Andheri East, Mumbai 400093";
    const defaultGstinStr = typeof customer.gstin === "object" ? (customer.gstin?.gst_no || "") : String(customer.gst_no || customer.gstin || "27AADCM5561H1Z6");

    const effCompName = isDifferentBillingParty ? (billTo.name || customer.name || "Client") : (customer.name || customer.company || "Client Company");
    const effAddress = isDifferentBillingParty ? (toAddressStr(billTo.address) || defaultAddressStr) : defaultAddressStr;
    const effGstin = isDifferentBillingParty ? (typeof billTo.gstin === "object" ? (billTo.gstin?.gst_no || "") : String(billTo.gstin || defaultGstinStr)) : defaultGstinStr;
    const effContactName = isDifferentBillingParty && billTo.contact?.name ? billTo.contact.name : (job.contact_person || customer.contact_person || customer.name || "Client");
    const effContactEmail = isDifferentBillingParty && billTo.contact?.email ? billTo.contact.email : (job.contact_email || customer.email || "contact@client.example");
    const effContactPhone = isDifferentBillingParty && billTo.contact?.phone ? billTo.contact.phone : (job.contact_phone || customer.phone || customer.mobile || "9820055123");

    return res.status(200).json({
      success: true,
      data: {
        enquiry_id: job._id,
        enquiry_no: parentJobNo,
        client_name: effContactName,
        client_company: effCompName,
        client_address: effAddress,
        client_gstin: effGstin,
        client_email: effContactEmail,
        client_phone: effContactPhone,
        delivery_date: job.delivery_date,
        bill_to: billTo,
        sub_jobs: subJobMap,
        active_sub_jobs: activeSubJobs.map((s) => s.sub_job_no),
        all_products: activeSubJobs.map((s) => {
          const pUrl = s.img_url || s.selected_option_url || s.render_url || (s.design_options?.find((o) => o.selected)?.image_url) || (s.design_options?.[0]?.image_url) || "";
          return {
            subJobNo: s.sub_job_no,
            theme: s.theme || s.product_name || "Custom Trophy",
            spec: (typeof s.spec === "string" && s.spec) || s.spec_line || s.specLine || (s.size ? `Trophy · ${typeof s.size === "object" ? (s.size?.trophyH || s.size?.size) : s.size}" in · Fusion: MDF + Crystal` : ""),
            imgUrl: pUrl ? generateSignedUrl(pUrl) : "",
            qty: s.quantity || 1,
            size: typeof s.size === "object" ? (s.size?.trophyH || s.size?.size || "") : s.size,
          };
        }),
        proof_shared_info: job.wizard_state?.dtpProofSharing || null,
        is_sample: Boolean(
          req.query.phase === "sample" ||
          req.query.sample === "true" ||
          job.order_type === "sample" ||
          job.job_type === "sample" ||
          job.order_mode?.mode === "sample" ||
          job.wizard_state?.mode === "sample" ||
          job.stage === "sample" ||
          job.wizard_state?.stage === "sample" ||
          job.wizard_state?.dtp?.sample?.proofFile ||
          (job.sub_jobs || []).some((s) => s.is_sample || s.sample_order_id)
        ),
        order_type: job.order_type || job.job_type || (job.order_mode?.mode === "sample" ? "sample" : (job.wizard_state?.dtp?.sample?.proofFile ? "sample" : "production")),
      },
    });
  } catch (error) {
    console.error("Error in getPublicProofView:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
