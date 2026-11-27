import mongoose from "mongoose";
import EnquiryJob from "../../../models/enquiry/enquiryJobIntegrationModel.js";
import salesorderlistModel from "../../../models/sales_orders/sales_order_list_Model.js";
import bomModel from "../../../models/bom/bomModel.js";
import { nanoid } from "nanoid";
import { getCurrentDate } from "../../../helpers/dateTime.js";
import { transporter, sendMailWithUser } from "../../../helpers/mail.js";
import { generatePublicToken, verifyPublicLink } from "../../../helpers/publicLinkToken.js";
import { resolveApprovedSubJobDesignImage, isWebImage, generateSignedUrl } from "../../../helpers/r2helper.js";

/**
 * sendSampleConfirmationEmail
 * Sends Sample Order Confirmation sheet with individual sub-job rates, GST, and approval link.
 */
export const sendSampleConfirmationEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      to_email,
      client_link,
      contact_name,
      duration = 24,
      selectedItems = [],
      totalAmount = 0,
      charge = "charge",
      gstRate = 18,
      carrier = "Our vehicle",
      destination = "",
      notes = "",
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

    const customer = job.customer_id || {};
    const e = job.wizard_state?.e || {};
    const recipientEmail = (to_email || job.contact_email || customer.email || e.contactEmail || "").trim();

    if (!recipientEmail) {
      return res.status(400).json({ success: false, message: "No valid recipient email address found" });
    }

    const parentJobNo = job.enquiry_no || (job.seq ? `RD${job.seq}` : "RD21090");
    const durationHours = Number(duration || 24);
    const expiryTimestamp = Date.now() + durationHours * 60 * 60 * 1000;
    const expiryDateFormatted = new Date(expiryTimestamp).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const clientName = contact_name || job.contact_person || customer.contact_person || customer.name || "Client";
    const isFoc = charge === "foc";

    // Format sub-job code ensuring RD prefix
    const formatSubJobCode = (code, idx = 0) => {
      if (!code) return `${parentJobNo}-A${idx + 1}`;
      let str = String(code).trim();
      if (str.startsWith("RD")) return str;
      if (/^\d/.test(str)) return `RD${str}`;
      if (str.startsWith("-")) return `${parentJobNo}${str}`;
      return `RD${str}`;
    };

    // Prepare items list
    let itemsToProcess = [];
    if (Array.isArray(selectedItems) && selectedItems.length > 0) {
      itemsToProcess = selectedItems.map((it, idx) => ({
        subJobNo: formatSubJobCode(it.subJobNo, idx),
        theme: it.theme || it.name || it.product || "Custom Trophy",
        description: it.description || it.spec || it.specLine || `${it.theme || "Custom Trophy"} · 1 pc`,
        pieces: Number(it.pieces || it.sampleQty || 1),
        rate: Number(it.sampleRate || it.sample_rate || it.rawItemRate || it.unitRate || 0),
      }));
    } else {
      // Fallback from job sub_jobs or wizard_state
      const sjs = (job.sub_jobs || []).filter((sj) => !sj.is_dropped && !sj.is_on_hold);
      itemsToProcess = sjs.map((sj, idx) => ({
        subJobNo: formatSubJobCode(sj.sub_job_no, idx),
        theme: sj.theme || sj.product_name || "Custom Trophy",
        description: sj.spec_line || `${sj.theme || sj.product_name || "Custom Trophy"} · ${sj.size || 8} in`,
        pieces: 1,
        rate: Number(sj.sample_rate || (sj.unit_rate ? sj.unit_rate + 200 : 0)),
      }));
    }

    if (itemsToProcess.length === 0) {
      itemsToProcess = [{
        subJobNo: `${parentJobNo}-A1`,
        theme: "Custom Trophy",
        description: "Custom Trophy Sample",
        pieces: 1,
        rate: Number(totalAmount || 0),
      }];
    }

    // Calculations
    let subtotal = 0;
    let totalPieces = 0;
    itemsToProcess.forEach((it) => {
      totalPieces += it.pieces;
      if (!isFoc) {
        subtotal += it.rate * it.pieces;
      }
    });

    const parsedGstRate = Number(gstRate || 18);
    const gstAmt = isFoc ? 0 : Math.round(subtotal * (parsedGstRate / 100));
    const grandTotal = isFoc ? 0 : (subtotal + gstAmt);

    // Target link for client review
    let targetLink = client_link;
    if (!targetLink) {
      const baseUrl = process.env.CLIENT_CONFIRMATION_SCREEN_URL || "http://localhost:5173";
      const targetId = job._id || job.enquiry_no || job.seq;
      const subjobParam = itemsToProcess.map((i) => i.subJobNo).join(",");
      const { token, exp: expParam, sig } = generatePublicToken(targetId, durationHours);
      targetLink = `${baseUrl}/rd/quote-view/${targetId}?token=${token}&exp=${expParam}&sig=${sig}&tab=sample&subjobs=${encodeURIComponent(subjobParam)}`;
    }

    // Build items table rows HTML
    const itemsRowsHtml = itemsToProcess.map((it) => {
      const rateText = isFoc
        ? "Free of cost"
        : `₹${Number(it.rate).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      return `
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:12px 14px; font-weight:700; color:#0f172a; font-size:13px; vertical-align:top;">
            ${it.subJobNo}
          </td>
          <td style="padding:12px 14px; color:#334155; font-size:13px; vertical-align:top;">
            <div style="font-weight:600; color:#0f172a; margin-bottom:2px;">${it.theme}</div>
            <div style="font-size:12px; color:#64748b;">${it.description}</div>
          </td>
          <td style="padding:12px 14px; text-align:center; color:#0f172a; font-weight:600; font-size:13px; vertical-align:top;">
            ${it.pieces} pc
          </td>
          <td style="padding:12px 14px; text-align:right; font-weight:700; color:#0f172a; font-size:13px; vertical-align:top;">
            ${rateText}
          </td>
        </tr>
      `;
    }).join("");

    const deliveryDestination = destination || job.wizard_state?.sampleShipTo || customer.billing_address || "Client Office / Venue";
    const carrierMode = carrier || job.wizard_state?.sampleCarrier || "Our vehicle";

    const emailHTML = `
      <html>
        <body style="margin:0; padding:0; background-color:#f4f6f8; font-family:'Segoe UI', Arial, sans-serif;">
          <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f6f8; padding:30px 0;">
            <tr>
              <td align="center">
                <table width="680" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 14px rgba(0,0,0,0.08);">
                  <!-- Top Blue Header -->
                  <tr>
                    <td align="center" style="background-color:#004aad; padding:24px 30px;">
                      <h2 style="color:#ffffff; font-size:22px; margin:0; font-weight:700; letter-spacing:0.3px;">
                        Sample Order Confirmation - RD Custom Awards
                      </h2>
                    </td>
                  </tr>

                  <!-- Logo & Job Reference -->
                  <tr>
                    <td style="padding:24px 30px; text-align:left; border-bottom:1px solid #f1f5f9;">
                      <div style="display:flex; justify-content:space-between; align-items:center;">
                        <img 
                          src="https://rdcustomawards.com/cdn/shop/files/logo.svg?v=1700546283&width=90" 
                          alt="RD Custom Awards Logo" 
                          style="max-width:140px; height:auto;"
                        />
                        <div style="text-align:right;">
                          <div style="font-size:16px; font-weight:800; color:#004aad;">
                            ${parentJobNo}
                          </div>
                          <div style="font-size:12px; color:#64748b; margin-top:2px;">
                            Sample Order Confirmation
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>

                  <!-- Main Content -->
                  <tr>
                    <td style="padding:24px 30px;">
                      <p style="font-size:15px; color:#1e293b; margin:0 0 14px;">
                        Dear <strong>${clientName}</strong>,
                      </p>
                      <p style="font-size:14px; line-height:1.6; color:#475569; margin:0 0 20px;">
                        Please find below the sample order confirmation and pricing details for your enquiry <strong>${parentJobNo}</strong>.
                      </p>

                      <!-- Sample Items Table -->
                      <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; font-size:13px; margin-bottom:20px; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">
                        <thead>
                          <tr style="background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
                            <th style="padding:10px 14px; text-align:left; font-size:12px; font-weight:700; color:#475569; width:120px;">Sub-job No</th>
                            <th style="padding:10px 14px; text-align:left; font-size:12px; font-weight:700; color:#475569;">Item</th>
                            <th style="padding:10px 14px; text-align:center; font-size:12px; font-weight:700; color:#475569; width:80px;">Pieces</th>
                            <th style="padding:10px 14px; text-align:right; font-size:12px; font-weight:700; color:#475569; width:130px;">Rate (taxable)</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${itemsRowsHtml}
                        </tbody>
                        <tfoot>
                          <tr style="background-color:#f8fafc; border-top:1px solid #e2e8f0;">
                            <td colspan="2" style="padding:10px 14px; font-weight:600; color:#64748b; text-align:right;">Subtotal (taxable):</td>
                            <td style="padding:10px 14px; text-align:center; font-weight:700; color:#0f172a;">${totalPieces}</td>
                            <td style="padding:10px 14px; text-align:right; font-weight:700; color:#0f172a;">
                              ${isFoc ? "₹0.00" : `₹${subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            </td>
                          </tr>
                          <tr style="background-color:#f8fafc; border-top:1px solid #e2e8f0;">
                            <td colspan="3" style="padding:10px 14px; font-weight:600; color:#64748b; text-align:right;">GST @ ${parsedGstRate}%:</td>
                            <td style="padding:10px 14px; text-align:right; font-weight:700; color:#0f172a;">
                              ${isFoc ? "₹0.00" : `₹${gstAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            </td>
                          </tr>
                          <tr style="background-color:#eef2ff; border-top:2px solid #6366f1;">
                            <td colspan="3" style="padding:14px; font-weight:800; color:#1e1b4b; text-align:right; font-size:14px;">
                              TOTAL SAMPLE ORDER (${itemsToProcess.length} ITEMS · ${totalPieces} PCS):
                            </td>
                            <td style="padding:14px; text-align:right; font-weight:900; color:#004aad; font-size:16px;">
                              ${isFoc ? "Free of cost (₹0.00)" : `₹${grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            </td>
                          </tr>
                        </tfoot>
                      </table>

                      <!-- Delivery Info Summary -->
                      <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; font-size:12px; margin-bottom:24px; border:1px solid #e2e8f0; border-radius:6px; background-color:#f8fafc;">
                        <tr>
                          <td style="padding:8px 12px; font-weight:600; color:#64748b; width:130px;">Carrier Mode:</td>
                          <td style="padding:8px 12px; color:#0f172a; font-weight:600;">${carrierMode}</td>
                        </tr>
                        <tr>
                          <td style="padding:8px 12px; font-weight:600; color:#64748b;">Sample Destination:</td>
                          <td style="padding:8px 12px; color:#0f172a;">${deliveryDestination}</td>
                        </tr>
                      </table>

                      <!-- Review & Confirm Button -->
                      <p style="text-align:center; margin:28px 0 12px;">
                        <a 
                          href="${targetLink}" 
                          target="_blank"
                          style="display:inline-block; padding:13px 32px; background-color:#004aad; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:700; font-size:15px; box-shadow:0 3px 8px rgba(0,74,173,0.3);"
                        >
                          Review & Confirm Sample Online
                        </a>
                      </p>

                      <p style="text-align:center; font-size:12px; color:#64748b; margin:0 0 24px;">
                        🔒 Valid until <strong>${expiryDateFormatted}</strong>
                      </p>

                      <p style="font-size:13px; color:#475569; margin-top:20px; line-height:1.6;">
                        Please click the link above to review the sample specifications and confirm approval to initiate sampling.<br/><br/>
                        Warm regards,<br/>
                        <strong>RD Custom Awards Pvt. Ltd.</strong>
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td align="center" style="background-color:#f8fafc; padding:16px; border-top:1px solid #e2e8f0;">
                      <p style="font-size:11px; color:#64748b; margin:0;">
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

    if (transporter) {
      await sendMailWithUser(req.user, {
        to: recipientEmail,
        subject: `Sample Order Confirmation - ${parentJobNo} - RD Custom Awards`,
        html: emailHTML,
      });
    }

    const now = new Date();
    const wizard_state = { ...(job.wizard_state || {}) };
    wizard_state.sampleRatesState = "awaiting_approval";
    wizard_state.sampleConfirmed = false;
    if (wizard_state.sampleDecision?.decision === "revision") {
      wizard_state.sampleRevisionHistory = [
        ...(wizard_state.sampleRevisionHistory || []),
        wizard_state.sampleDecision,
      ];
      wizard_state.sampleDecision = null;
    }
    wizard_state.sampleRatesSentVia = "email";
    wizard_state.sampleConfirmSent = "Email";
    wizard_state.sampleRatesSent = true;
    wizard_state.sampleRatesSentAt = now.toISOString();
    wizard_state.sampleItems = itemsToProcess;
    wizard_state.sampleTotal = grandTotal;
    wizard_state.sampleSubtotal = subtotal;
    wizard_state.sampleGst = parsedGstRate;
    wizard_state.charge = charge;
    wizard_state.sampleCarrier = carrierMode;
    wizard_state.sampleShipTo = deliveryDestination;

    job.wizard_state = wizard_state;
    job.markModified("wizard_state");

    // Also sync sample_rate to job.sub_jobs
    if (Array.isArray(job.sub_jobs)) {
      job.sub_jobs.forEach((sj) => {
        const matched = itemsToProcess.find((it) => it.subJobNo === sj.sub_job_no || sj.sub_job_no?.endsWith(it.subJobNo?.split('-').slice(1).join('-')));
        if (matched && matched.rate > 0) {
          sj.sample_rate = matched.rate;
        }
      });
      job.markModified("sub_jobs");
    }

    const subJobCodes = itemsToProcess.map((i) => i.subJobNo).join(", ");
    job.history.push({
      action: "SAMPLE_CONFIRMATION_EMAIL_SENT",
      step: job.step,
      sub_job_no: subJobCodes,
      remarks: `Sample confirmation email sent to ${recipientEmail} for ${subJobCodes} (Total: ₹${grandTotal})${notes ? ` - ${notes}` : ""}`,
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
      message: `Sample confirmation email sent successfully to ${recipientEmail}`,
      recipient: recipientEmail,
      items: itemsToProcess,
      totalAmount: grandTotal,
    });
  } catch (error) {
    console.error("Error sending sample confirmation email:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while sending sample confirmation email",
      error: error.message,
    });
  }
};

/**
 * recordPublicSampleFeedback
 * Client approves or requests alterations on sample order & rates via public link
 */
export const recordPublicSampleFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      decision = "approved", // "approved" | "revision"
      notes = "",
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
      return res.status(authCheck.status).json({ success: false, message: authCheck.message });
    }

    const now = new Date();
    const wizard_state = { ...(job.wizard_state || {}) };
    const isApproved = decision === "approved";
    const clientActor = clientName || job.contact_person || job.customer_id?.name || "Client";

    wizard_state.sampleRatesState = isApproved ? "approved" : "revision";
    wizard_state.sampleConfirmed = isApproved;
    wizard_state.ratesApproved = isApproved;
    wizard_state.sampleApprovalMethod = "Client Link (Direct)";
    wizard_state.sampleDecision = {
      decision,
      notes: notes ? String(notes).trim() : "",
      at: now.toISOString(),
      by: clientActor,
    };

    if (isApproved) {
      const approvalLog = {
        channel: "Client Link (Direct)",
        via: "Online Link",
        fmt: "Client Link (Direct)",
        at: now.toISOString(),
        by: clientActor,
        proof: notes
          ? `Approved online via confirmation link by ${clientActor} ("${notes}")`
          : `Approved online via direct client confirmation link by ${clientActor}`,
      };
      wizard_state.sampleRateOk = approvalLog;
      wizard_state.ratesApprovalLog = approvalLog;
      job.sample_rates_approved = true;
    } else {
      job.sample_rates_approved = false;
      delete wizard_state.sampleRateOk;
      delete wizard_state.ratesApprovalLog;
    }

    job.wizard_state = wizard_state;
    job.markModified("wizard_state");

    job.history.push({
      action: `SAMPLE_RATES_${decision.toUpperCase()}`,
      step: job.step,
      remarks: `Client ${decision.toUpperCase()} sample order & rates via link: ${notes || "No remarks"}`,
      changed_by: {
        user_id: null,
        user_name: clientName || job.contact_person || job.customer_id?.name || "Client",
        role: "Client",
      },
      timestamp: now,
    });

    await job.save();

    return res.status(200).json({
      success: true,
      message: `Sample order feedback recorded: ${decision}`,
      data: job,
    });
  } catch (error) {
    console.error("Error in recordPublicSampleFeedback:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * recordSampleShared
 * Records sample confirmation sheet shared via WhatsApp, Link, etc.
 * Resets any previous revision requests, updates status to awaiting_approval, and unlocks the sheet.
 */
export const recordSampleShared = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      channel = "WhatsApp",
      recipient = "",
      selectedItems = [],
      totalAmount = 0,
      notes = "",
    } = req.body || {};

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
    const wizard_state = { ...(job.wizard_state || {}) };
    wizard_state.sampleRatesState = "awaiting_approval";
    wizard_state.sampleConfirmed = false;
    wizard_state.sampleRatesSentVia = channel;
    wizard_state.sampleRatesSentAt = now.toISOString();

    if (wizard_state.sampleDecision?.decision === "revision") {
      wizard_state.sampleRevisionHistory = [
        ...(wizard_state.sampleRevisionHistory || []),
        wizard_state.sampleDecision,
      ];
      wizard_state.sampleDecision = null;
    }

    if (Array.isArray(selectedItems) && selectedItems.length > 0) {
      wizard_state.sampleItems = selectedItems.map((it) => ({
        subJobNo: it.subJobNo,
        theme: it.theme || it.name || "Custom Trophy",
        description: it.description || it.spec || "",
        pieces: Number(it.pieces || 1),
        rate: Number(it.sampleRate || it.sample_rate || it.rawItemRate || 0),
      }));
    }

    if (totalAmount > 0) {
      wizard_state.sampleTotal = totalAmount;
    }

    job.wizard_state = wizard_state;
    job.markModified("wizard_state");

    job.history.push({
      action: "SAMPLE_CONFIRMATION_SHARED",
      step: job.step,
      remarks: `Sample confirmation sheet shared via ${channel}${recipient ? ` (${recipient})` : ""}${notes ? ` - ${notes}` : ""}`,
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
      message: `Sample confirmation sheet shared via ${channel}`,
      data: job,
    });
  } catch (error) {
    console.error("Error in recordSampleShared:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * pushToSampleProduction
 * Spawns individual salesorderlist cards for each active sub-job in Production Hub.
 * Enforces strictly the requested sample count (e.g. 1 pc), NOT the bulk order quantity.
 * Links collection references to sub_jobs without depending on legacy sales_order_form.
 */
export const pushToSampleProduction = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      charge = "foc",
      sampleRate = 0,
      sampleCarrier,
      sampleShipTo,
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

    const parentJobNo = job.enquiry_no || (job.seq ? `RD${job.seq}` : "RD21072");
    const activeSubJobs = (job.sub_jobs || []).filter((sj) => !sj.is_dropped && !sj.is_on_hold);

    if (activeSubJobs.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No active products or sub-jobs found on this job to push to sample production.",
      });
    }

    const now = new Date();
    const createdOrders = [];

    // Process each active sub-job independently for Production Hub
    for (let idx = 0; idx < activeSubJobs.length; idx++) {
      const sj = activeSubJobs[idx];

      // Format subJobNo ensuring clean format
      const sjNo = sj.sub_job_no || `${parentJobNo}-A${idx + 1}`;

      // 1. Strictly determine requested sample quantity (Default 1, or client specified pieces)
      const sampleItemDef = (job.wizard_state?.sampleItems || []).find(
        (it) => it.subJobNo === sjNo || (it.subJobNo && sjNo.endsWith(it.subJobNo.replace(/^RD\d+-/, "")))
      );
      const requestedSampleQty = Number(
        sampleItemDef?.pieces || sj.sample_qty || job.order_mode?.sample_qty || job.wizard_state?.sampleQty || 1
      );

      // 2. Resolve sub-job approved design image (strictly displayable web image)
      let subJobImage = resolveApprovedSubJobDesignImage(job, sj, idx);
      if (!subJobImage && req.body?.uploadedDesigns) {
        const u = req.body.uploadedDesigns;
        subJobImage = u[`${idx}-0`] || u[`0-0`] || Object.values(u).find(isWebImage) || "";
      }

      // 3. Resolve BOM ObjectId and nanoid
      let bomObjId = null;
      let bomNanoId = sj.bom_nanoid || "";
      const rawBomId = sj.bom_id || null;

      if (rawBomId) {
        if (mongoose.Types.ObjectId.isValid(rawBomId)) {
          bomObjId = new mongoose.Types.ObjectId(rawBomId);
        } else {
          bomNanoId = bomNanoId || String(rawBomId);
          try {
            const bomDoc = await bomModel.findOne({
              $or: [{ id: String(rawBomId) }, { "items.item_id": String(rawBomId) }],
            }).select("_id id").lean();
            if (bomDoc) {
              bomObjId = bomDoc._id;
              bomNanoId = bomDoc.id || bomNanoId;
              sj.bom_id = bomDoc._id;
              sj.bom_nanoid = bomDoc.id;
            }
          } catch {
            // Ignore if BOM document not found
          }
        }
      }

      // If not yet linked on sub-job, check by sub_job_no in BOM collection
      if (!bomObjId) {
        try {
          const cleanNo = String(sjNo).trim();
          const withRd = cleanNo.startsWith("RD") ? cleanNo : `RD${cleanNo}`;
          const withoutRd = cleanNo.replace(/^RD/i, "");
          const matchedBom = await bomModel.findOne({
            $or: [
              { sub_job_no: cleanNo },
              { sub_job_no: withRd },
              { sub_job_no: withoutRd },
            ],
          }).sort({ createdAt: -1 }).select("_id id").lean();

          if (matchedBom) {
            bomObjId = matchedBom._id;
            bomNanoId = matchedBom.id || bomNanoId;
            sj.bom_id = matchedBom._id;
            sj.bom_nanoid = matchedBom.id;
          }
        } catch {
          // Ignore if BOM not found by sub_job_no
        }
      }

      const validBomObjId = (bomObjId && mongoose.Types.ObjectId.isValid(bomObjId)) ? bomObjId : null;

      // 4. Check if a salesorderlist card already exists for this sub_job specifically for SAMPLE
      let existingOrder = null;
      if (sj.sample_order_id && mongoose.Types.ObjectId.isValid(sj.sample_order_id)) {
        existingOrder = await salesorderlistModel.findOne({
          _id: sj.sample_order_id,
          type: "sample",
        });
      }

      if (!existingOrder) {
        existingOrder = await salesorderlistModel.findOne({
          enquiry_flow_id: job._id,
          sub_job_no: sjNo,
          type: "sample",
        });
      }

      if (!existingOrder) {
        existingOrder = await salesorderlistModel.findOne({
          job_no: parentJobNo,
          sub_job_no: sjNo,
          type: "sample",
        });
      }

      if (!existingOrder) {
        const orderNanoId = nanoid(16);
        const newOrder = new salesorderlistModel({
          id: orderNanoId,
          enquiry_id: job._id,
          enquiry_flow_id: job._id,
          source: "enquiry_flow_integration",
          job_no: parentJobNo,
          sub_job_no: sjNo,
          category: "Sample",
          type: "sample",
          status: "pending",
          job_quantity: requestedSampleQty, // STRICT: Sample count only!
          image: subJobImage,
          designer_person: sj.designer_id || job.assigned_designer || null,
          is_sales_order_filled: true, // Pre-filled directly from enquiry flow
          is_verified_to_proceed: true,
          bom_id: validBomObjId,
          bom_nanoid: bomNanoId || "",
          is_bom_filled: Boolean(validBomObjId),
          designer_files: Array.isArray(sj.designer_files)
            ? sj.designer_files.map((f) => (typeof f === "string" ? f : (f?.file_url || f?.url))).filter(Boolean)
            : [],
          created_by: req.user?._id || job.created_by,
          created_at: getCurrentDate(),
        });

        await newOrder.save();
        existingOrder = newOrder;
      } else {
        // Update existing with latest sample count & status
        existingOrder.job_quantity = requestedSampleQty;
        existingOrder.type = "sample";
        existingOrder.category = "Sample";
        existingOrder.enquiry_flow_id = job._id;
        existingOrder.source = "enquiry_flow_integration";
        existingOrder.bom_id = validBomObjId;
        existingOrder.is_bom_filled = Boolean(validBomObjId);
        if (bomNanoId) existingOrder.bom_nanoid = bomNanoId;
        if (subJobImage) {
          existingOrder.image = subJobImage;
        }
        if (Array.isArray(sj.designer_files) && sj.designer_files.length > 0) {
          existingOrder.designer_files = sj.designer_files.map((f) => (typeof f === "string" ? f : (f?.file_url || f?.url))).filter(Boolean);
        }
        await existingOrder.save();
      }

      // 5. Update sub-job link inside EnquiryJob
      sj.sub_job_no = sjNo;
      sj.sample_order_id = existingOrder._id;
      sj.sample_order_nanoid = existingOrder.id;
      sj.sample_qty = requestedSampleQty;
      sj.production_status = "pending";
      sj.is_pushed_shop_floor = false;
      if (subJobImage) {
        sj.approved_design_url = subJobImage;
        if (!Array.isArray(sj.approved_designs) || sj.approved_designs.length === 0) {
          sj.approved_designs = [subJobImage];
        }
      }

      createdOrders.push({
        sub_job_no: sjNo,
        order_id: existingOrder._id,
        order_nanoid: existingOrder.id,
        sample_qty: requestedSampleQty,
      });
    }

    // 6. Update Wizard State and Order Mode on EnquiryJob
    const wizard_state = { ...(job.wizard_state || {}) };
    wizard_state.sent = true;
    wizard_state.sentAt = now.toISOString();
    wizard_state.samplePushedAt = now.toISOString();
    wizard_state.charge = charge;
    wizard_state.sampleRate = charge === "foc" ? 0 : Number(sampleRate || wizard_state.sampleRate || 0);
    wizard_state.ratesApproved = true;
    wizard_state.sampleConfirmed = true;
    wizard_state.sampleRatesState = "approved";
    if (sampleCarrier) wizard_state.sampleCarrier = sampleCarrier;
    if (sampleShipTo) wizard_state.sampleShipTo = sampleShipTo;

    job.wizard_state = wizard_state;
    job.markModified("wizard_state");

    job.order_mode = {
      ...(job.order_mode || {}),
      mode: "sample",
      charge,
      sample_rate: wizard_state.sampleRate,
      sample_approved: false,
    };
    job.markModified("order_mode");

    job.stage = "sample";
    job.markModified("sub_jobs");

    job.history.push({
      action: "PUSHED_TO_SAMPLE_PRODUCTION",
      step: 6,
      remarks: `Pushed ${activeSubJobs.length} sub-job(s) to Production Hub with sample quantity: ${createdOrders
        .map((o) => `${o.sub_job_no} (${o.sample_qty} pc)`)
        .join(", ")}`,
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
      message: `Enquiry successfully pushed to Sample Production in Production Hub (${createdOrders.length} sub-jobs).`,
      orders: createdOrders,
      data: job,
    });
  } catch (error) {
    console.error("Error pushing to sample production:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while pushing to sample production",
      error: error.message,
    });
  }
};

/**
 * sendSampleProofEmail
 * Shares finished sample photos & video proof link with client for approval.
 */
export const sendSampleProofEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      to_email,
      contact_name,
      duration = 48,
      mode = "sample", // "sample" | "pre_production"
      mediaItems: _mediaItems = [],
      notes = "",
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

    const customer = job.customer_id || {};
    const e = job.wizard_state?.e || {};
    const recipientEmail = (to_email || job.contact_email || customer.email || e.contactEmail || "").trim();

    if (!recipientEmail) {
      return res.status(400).json({ success: false, message: "No valid recipient email address found" });
    }

    const parentJobNo = job.enquiry_no || (job.seq ? `RD${job.seq}` : "RD21072");
    const durationHours = Number(duration || 48);
    const clientName = contact_name || job.contact_person || customer.contact_person || customer.name || "Client";
    const now = new Date();

    const wizard_state = { ...(job.wizard_state || {}) };
    const curV = wizard_state.round || 1;

    // PP is ONLY when:
    // User directly chose production without sample first (wizard_state.mode === "production" && (wizard_state.pp || wizard_state.ppAfter)),
    // OR mode === "pre_production" and wizard_state.mode !== "sample"
    const isPP = mode === "pre_production"
      ? (wizard_state.mode !== "sample")
      : (wizard_state.mode === "production" && Boolean(wizard_state.pp || wizard_state.ppAfter));

    const sampleTitle = `Sample v${curV} Production`;

    const baseUrl = process.env.CLIENT_CONFIRMATION_SCREEN_URL || "http://localhost:5173";
    const targetId = job._id || job.enquiry_no || job.seq;
    const { token, exp: expParam, sig } = generatePublicToken(targetId, durationHours);
    const targetLink = `${baseUrl}/rd/sample-proof/${targetId}?token=${token}&exp=${expParam}&sig=${sig}&mode=${isPP ? "pre_production" : "sample"}`;

    const subjectTitle = isPP
      ? `Pre-Production Sample Proof for Your Approval - ${parentJobNo}`
      : `${sampleTitle} Proof for Your Approval - ${parentJobNo}`;

    const emailHtml = `
      <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="background:#0f172a;color:#ffffff;padding:24px 28px;">
          <h2 style="margin:0 0 6px;font-size:20px;font-weight:700;letter-spacing:-0.5px;">RD Custom Awards</h2>
          <p style="margin:0;font-size:13px;color:#94a3b8;">${isPP ? "Pre-Production Sample Proof for Approval" : `${sampleTitle} Proof for Approval`}</p>
        </div>
        <div style="padding:28px;">
          <p style="font-size:14px;color:#334155;margin:0 0 16px;">Dear <b>${clientName}</b>,</p>
          <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 20px;">
            ${isPP
        ? `We are pleased to inform you that your 1-piece pre-production sample for <b>${parentJobNo}</b> has been crafted on our factory floor. High-resolution photos and video are ready for your review and sign-off before releasing bulk production.`
        : `We are pleased to inform you that your <b>${sampleTitle}</b> piece(s) for <b>${parentJobNo}</b> have been crafted on our factory floor. High-resolution photos and video are ready for your review and approval.`}
          </p>
          ${notes ? `<div style="background:#f8fafc;border-left:4px solid #6366f1;padding:12px 16px;margin:0 0 20px;font-size:13px;color:#475569;border-radius:0 8px 8px 0;"><b>Note from Production:</b> ${notes}</div>` : ""}
          <div style="text-align:center;margin:32px 0;">
            <a href="${targetLink}" target="_blank" style="display:inline-block;background:#4f46e5;color:#ffffff;font-size:14px;font-weight:700;padding:14px 32px;border-radius:8px;text-decoration:none;box-shadow:0 4px 12px rgba(79,70,229,0.35);">
              📸 ${isPP ? "Inspect Pre-Production Sample Proof &rarr;" : `Inspect ${sampleTitle} Proof &rarr;`}
            </a>
          </div>
          <p style="font-size:12px;color:#64748b;line-height:1.5;margin:0 0 8px;">
            You can inspect the engraving finish, dimensions, craftsmanship, and rotating video on this secure link, and directly submit your sign-off or revision instructions.
          </p>
          <p style="font-size:12px;color:#94a3b8;margin:24px 0 0;border-top:1px solid #f1f5f9;padding-top:16px;">
            Link valid for ${durationHours} hours. If you wish to receive the physical sample piece before giving bulk production sign-off, you can select that option on the page.
          </p>
        </div>
      </div>
    `;

    try {
      await sendMailWithUser(req.user, {
        to: recipientEmail,
        subject: subjectTitle,
        html: emailHtml,
      });
    } catch (mailErr) {
      console.warn("Sample proof email send failed (non-blocking):", mailErr);
    }

    // Update wizard_state
    const sflow = { ...(wizard_state.sflow || {}) };
    const curSf = { ...(sflow[curV] || {}) };

    curSf.sampleProofSent = "Email";
    curSf.sampleProofSentAt = now.toISOString();
    curSf.photosAt = now.toISOString();
    curSf.sampleProofRecipient = recipientEmail;
    sflow[curV] = curSf;
    wizard_state.sflow = sflow;

    job.wizard_state = wizard_state;
    job.markModified("wizard_state");

    job.history.push({
      action: "SAMPLE_PROOF_SHARED",
      step: job.step,
      remarks: `Sample proof photos and video shared via Email to ${recipientEmail} (${isPP ? "Pre-Production" : sampleTitle})`,
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
      message: `Sample proof sent successfully to ${recipientEmail}`,
      publicLink: targetLink,
      data: job,
    });
  } catch (error) {
    console.error("Error in sendSampleProofEmail:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * getPublicSampleProofView
 * Public endpoint to fetch sample photos, videos, and specs for client review.
 */
export const getPublicSampleProofView = async (req, res) => {
  try {
    const { id } = req.params;
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

    const parentJobNo = job.enquiry_no || (job.seq ? `RD${job.seq}` : "RD21072");
    const customer = job.customer_id || {};
    const ws = job.wizard_state || {};
    const curV = ws.round || 1;
    const sf = ws.sflow?.[curV] || {};

    const activeSubJobs = (job.sub_jobs || []).filter((s) => !s.is_dropped);
    const subJobMedia = sf.samplePhotos || {};
    const subJobVideos = sf.sampleVideos || {};

    const products = activeSubJobs.map((sj, idx) => {
      const sjNo = sj.sub_job_no || `${parentJobNo}-A${idx + 1}`;
      let approvedImage = resolveApprovedSubJobDesignImage(job, sj, idx);
      if (approvedImage) {
        approvedImage = generateSignedUrl(approvedImage);
      }

      // Photos for this sub-job
      const rawPhotos = subJobMedia[sjNo] || subJobMedia[`item_${idx}`] || null;
      let photoList = [];
      if (Array.isArray(rawPhotos)) {
        photoList = rawPhotos.map((p) => ({
          url: p.url ? generateSignedUrl(p.url) : (typeof p === "string" ? generateSignedUrl(p) : ""),
          name: p.name || "Sample Photo",
          uploaded_at: p.uploaded_at || p.uploadedAt || "",
          uploaded_by: p.uploaded_by || "Shop Floor",
        })).filter((p) => !!p.url);
      } else if (rawPhotos && rawPhotos.url) {
        photoList = [{
          url: generateSignedUrl(rawPhotos.url),
          name: rawPhotos.name || "Sample Photo",
          uploaded_at: rawPhotos.uploaded_at || rawPhotos.uploadedAt || "",
          uploaded_by: rawPhotos.uploaded_by || "Shop Floor",
        }];
      }

      // Videos for this sub-job
      const rawVideos = subJobVideos[sjNo] || subJobVideos[`item_${idx}`] || null;
      let videoList = [];
      if (Array.isArray(rawVideos)) {
        videoList = rawVideos.map((v) => ({
          url: v.url ? generateSignedUrl(v.url) : (typeof v === "string" ? generateSignedUrl(v) : ""),
          name: v.name || "Sample Video",
          uploaded_at: v.uploaded_at || v.uploadedAt || "",
        })).filter((v) => !!v.url);
      } else if (rawVideos && rawVideos.url) {
        videoList = [{
          url: generateSignedUrl(rawVideos.url),
          name: rawVideos.name || "Sample Video",
          uploaded_at: rawVideos.uploaded_at || rawVideos.uploadedAt || "",
        }];
      }

      return {
        sub_job_no: sjNo,
        theme: sj.theme || sj.product_name || "Custom Trophy",
        size: sj.size || 8,
        material: sj.material || sj.raw_material || "Custom Spec",
        approved_design_url: approvedImage,
        photos: photoList,
        videos: videoList,
      };
    });

    const isPP = ws.mode === "production" ? Boolean(ws.pp || ws.ppAfter || req.query.mode === "pre_production") : false;

    return res.status(200).json({
      success: true,
      data: {
        job_id: job._id,
        enquiry_no: parentJobNo,
        client_name: job.contact_person || customer.contact_person || customer.name || "Client",
        client_company: customer.name || customer.company || "Client Company",
        customer: {
          name: customer.name || customer.company || "Client Name",
          billing: (customer.address?.[0]?.address_1
            ? `${customer.address[0].address_1}${customer.address[0].address_2 ? ', ' + customer.address[0].address_2 : ''}, ${customer.address[0].city || ''}`
            : (typeof customer.billing === "string" ? customer.billing : "")) || "Plot 14, MIDC, Andheri East, Mumbai 400093",
          gstin: customer.gstin || customer.address?.[0]?.gst_no || "27AADCM5561H1Z6",
        },
        contact: {
          name: job.contact_person || customer.contact_person || "Contact Person",
          role: job.contact_role || "HR Executive",
          email: job.contact_email || customer.email || "contact@client.example",
          phone: job.contact_phone || customer.mobile_no || "9820055123",
        },
        coordinator_name: job.coordinator_name || ws.coordinator || "Meera Client Servicing",
        mode: isPP ? "pre_production" : "sample",
        round: curV,
        ready_at: sf.readyAt || null,
        uploadedDesigns: ws.uploadedDesigns || {},
        productFeedback: ws.productFeedback || {},
        products,
        approval_status: {
          is_approved: Boolean(sf.clientApproved || (isPP ? ws.ppApproved : ws.approved)),
          approved_at: sf.approvedAt || (isPP ? ws.ppOk?.at : ws.sampleOk?.at) || null,
          approved_by: sf.approvedBy || (isPP ? ws.ppOk?.by : ws.sampleOk?.by) || null,
          is_physical_requested: Boolean(sf.physicalSampleRequested),
          physical_requested_at: sf.physicalRequestedAt || null,
          physical_notes: sf.physicalRequiredNotes || "",
          physical_dispatch: sf.disp || null,
          delivered_at: sf.deliveredAt || null,
          revision_notes: sf.revisionNotes || null,
        },
      },
    });
  } catch (error) {
    console.error("Error in getPublicSampleProofView:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * recordPublicSampleProofFeedback
 * Handles client decision on sample photos/video:
 * - "approved"
 * - "revision"
 * - "physical_required"
 */
export const recordPublicSampleProofFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      decision = "approved", // "approved" | "revision" | "physical_required"
      notes = "",
      clientName = "",
      mode = "sample", // "sample" | "pre_production"
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

    const authCheck = verifyPublicLink(job, req);
    if (!authCheck.valid) {
      return res.status(authCheck.status || 403).json({ success: false, message: authCheck.message });
    }

    const now = new Date();
    const ws = { ...(job.wizard_state || {}) };
    const curV = ws.round || 1;
    const sflow = { ...(ws.sflow || {}) };
    const sf = { ...(sflow[curV] || {}) };
    const clientActor = clientName || job.contact_person || job.customer_id?.name || "Client";
    const isPP = mode === "pre_production" ? (ws.mode !== "sample") : (ws.mode === "production" && Boolean(ws.pp || ws.ppAfter));

    if (decision === "approved") {
      sf.clientApproved = true;
      sf.approvedAt = now.toISOString();
      sf.approvedBy = clientActor;
      sf.approvalNotes = notes ? String(notes).trim() : "";

      const approvalLog = {
        channel: "Client Proof Link (Direct)",
        via: "Online Proof Link",
        fmt: "Client Proof Link",
        at: now.toISOString(),
        by: clientActor,
        proof: notes
          ? `Approved photos & video via proof link by ${clientActor} ("${notes}")`
          : `Approved sample photos & video via proof link by ${clientActor}`,
      };

      if (isPP) {
        ws.ppApproved = true;
        ws.ppOk = approvalLog;
        job.pp_approved = true;
      } else {
        ws.approved = true;
        ws.sampleOk = approvalLog;
        job.sample_approved = true;
      }

      job.history.push({
        action: isPP ? "PRE_PRODUCTION_SAMPLE_APPROVED" : "SAMPLE_APPROVED",
        step: job.step,
        remarks: `Client ${clientActor} APPROVED ${isPP ? "pre-production" : "sample"} photos & video online: ${notes || "No remarks"}`,
        changed_by: { user_id: null, user_name: clientActor, role: "Client" },
        timestamp: now,
      });
    } else if (decision === "revision") {
      sf.clientRevision = true;
      sf.revisedAt = now.toISOString();
      sf.revisedBy = clientActor;
      sf.revisionNotes = notes ? String(notes).trim() : "";

      job.history.push({
        action: isPP ? "PRE_PRODUCTION_SAMPLE_REVISION" : "SAMPLE_REVISION",
        step: job.step,
        remarks: `Client ${clientActor} requested alterations on ${isPP ? "pre-production" : "sample"} piece: ${notes}`,
        changed_by: { user_id: null, user_name: clientActor, role: "Client" },
        timestamp: now,
      });
    } else if (decision === "physical_required") {
      sf.physicalSampleRequested = true;
      sf.physicalRequestedAt = now.toISOString();
      sf.physicalRequestedBy = clientActor;
      sf.physicalRequiredNotes = notes ? String(notes).trim() : "Client requested physical inspection before bulk approval";

      job.history.push({
        action: "SAMPLE_PHYSICAL_INSPECTION_REQUESTED",
        step: job.step,
        remarks: `Client ${clientActor} requested PHYSICAL sample piece delivery before giving final approval: ${notes || "Physical delivery required"}`,
        changed_by: { user_id: null, user_name: clientActor, role: "Client" },
        timestamp: now,
      });
    }

    sflow[curV] = sf;
    ws.sflow = sflow;
    job.wizard_state = ws;
    job.markModified("wizard_state");

    await job.save();

    return res.status(200).json({
      success: true,
      message: `Sample proof feedback recorded: ${decision}`,
      decision,
      data: job,
    });
  } catch (error) {
    console.error("Error in recordPublicSampleProofFeedback:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * saveSamplePhysicalDispatch
 * Records courier/vehicle dispatch and delivery of sample piece.
 */
export const saveSamplePhysicalDispatch = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      carrier = "Our vehicle",
      docket_no = "",
      dispatch_date = new Date().toISOString().split("T")[0],
      delivery_date = null,
      is_delivered = false,
      notes = "",
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

    const now = new Date();
    const ws = { ...(job.wizard_state || {}) };
    const curV = ws.round || 1;
    const sflow = { ...(ws.sflow || {}) };
    const sf = { ...(sflow[curV] || {}) };

    sf.disp = {
      carrier,
      ref: docket_no,
      date: dispatch_date,
      at: now.toISOString(),
      notes,
    };

    if (is_delivered || delivery_date) {
      sf.deliveredAt = delivery_date || now.toISOString().split("T")[0];
    } else {
      sf.deliveredAt = null;
    }

    ws.sampleCarrier = carrier;
    sflow[curV] = sf;
    ws.sflow = sflow;
    job.wizard_state = ws;
    job.markModified("wizard_state");

    job.history.push({
      action: is_delivered ? "SAMPLE_PHYSICAL_DELIVERED" : "SAMPLE_PHYSICAL_DISPATCHED",
      step: job.step,
      remarks: `Sample physical dispatch updated: Carrier: ${carrier}, Docket: ${docket_no || "N/A"}, Date: ${dispatch_date}${is_delivered ? ` (Delivered: ${sf.deliveredAt})` : ""}`,
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
      message: is_delivered ? "Sample physical delivery recorded" : "Sample physical dispatch saved",
      data: job,
    });
  } catch (error) {
    console.error("Error in saveSamplePhysicalDispatch:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
