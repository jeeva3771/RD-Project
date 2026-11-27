import mongoose from "mongoose";
import { nanoid } from "nanoid";
import enquiryJobIntegrationModel from "../../../models/enquiry/enquiryJobIntegrationModel.js";
import salesorderlistModel from "../../../models/sales_orders/sales_order_list_Model.js";
import salesorderformModel from "../../../models/sales_orders/sales_order_form_Model.js";
import bomModel from "../../../models/bom/bomModel.js";
import userModel from "../../../models/users/userModel.js";
import { getCurrentDate } from "../../../helpers/dateTime.js";
import { generateSignedUrl } from "../../../helpers/r2helper.js";
import { transporter, sendMailWithUser } from "../../../helpers/mail.js";
import { generatePublicToken, verifyPublicLink } from "../../../helpers/publicLinkToken.js";

/**
 * Request official Proforma Invoice from Accounts Desk (/accounts)
 * Synchronizes commercial breakdown and sub-jobs into salesorderlist
 * so the order appears in Accounts -> Pending PI Uploads tab (requestedaccountsfiles).
 */
export const requestProformaInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      subJobs = [],
      commercials = {},
      billingParty = {},
      deliveryAddress = {},
      paymentTerms = "25% Advance",
      notes = "",
    } = req.body;

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { $or: [{ id }, { enquiry_no: id }, { seq: Number(id) || -1 }] };

    const job = await enquiryJobIntegrationModel.findOne(query);
    if (!job) {
      return res.status(404).json({ success: false, message: "Enquiry job not found" });
    }

    const nowIso = new Date().toISOString();
    const parentJobNo = job.enquiry_no || (job.seq ? `RD${job.seq}` : "RD26004");
    const userId = req.user?._id || req.user?.id || null;
    const userName = req.user?.name || "Client Servicing";
    const userRole = req.user?.role || "Client Servicing";

    const billTo = job.wizard_state?.billTo || job.order_mode?.bill_to || {};
    const effectiveBillingParty = (billingParty && (billingParty.name || billingParty.address))
      ? billingParty
      : (billTo.on ? {
          name: billTo.name,
          address: billTo.address,
          gstin: billTo.gstin,
          contactPerson: billTo.contact?.name,
          contactPhone: billTo.contact?.phone,
          contactEmail: billTo.contact?.email,
        } : (billingParty || {}));

    // 1. Update EnquiryJob wizard_state.pi snapshot
    const existingPi = job.wizard_state?.pi || {};
    job.wizard_state = {
      ...(job.wizard_state || {}),
      pi: {
        ...existingPi,
        status: "requested",
        requested_at: nowIso,
        requested_by: userName,
        requested_by_id: userId,
        commercials,
        billing_party: effectiveBillingParty,
        delivery_address: deliveryAddress,
        payment_terms: paymentTerms,
        notes: notes || "",
      },
    };
    job.markModified("wizard_state");

    // Sync commercials into job.financials
    if (commercials && (commercials.invoiceTotal || commercials.taxableValue || commercials.totalAmountBeforeGst)) {
      job.financials = {
        ...(job.financials || {}),
        subtotal: Number(commercials.taxableValue || commercials.totalAmountBeforeGst || job.financials?.subtotal || 0),
        gst_rate: Number(commercials.prodGst || 18),
        gst_amount: Number((commercials.cgstAmt || 0) + (commercials.sgstAmt || 0)),
        total: Number(commercials.invoiceTotal || 0),
        advance_required: Number(commercials.advanceDue || Math.round(Number(commercials.invoiceTotal || 0) * 0.5)),
        balance_due: Number(commercials.balanceDue || Math.max(0, Number(commercials.invoiceTotal || 0) - Number(commercials.advanceDue || 0))),
        sample_charges: Number(commercials.sampleCharge || 0),
      };
      job.markModified("financials");
    }

    // 2. Push to audit history
    job.history.push({
      action: "PI_REQUESTED",
      step: 6,
      sub_job_no: (subJobs || []).filter((s) => s.id !== "sample_charges" && s.subJobNo !== "Sample").map((s) => s.subJobNo || s.id).join(", "),
      remarks: `Official Proforma Invoice requested from Accounts for Job ${parentJobNo}. Total Value: ₹${Number(commercials?.invoiceTotal || 0).toLocaleString("en-IN")}`,
      changed_by: {
        user_id: userId,
        user_name: userName,
        role: userRole,
      },
      timestamp: new Date(),
    });

    await job.save();

    const toAddressStr = (addr) => {
      if (!addr) return "";
      if (Array.isArray(addr)) return addr.map((a) => (typeof a === "object" ? Object.values(a).join(", ") : a)).filter(Boolean).join(", ");
      if (typeof addr === "object") return Object.values(addr).filter(Boolean).join(", ");
      return String(addr);
    };

    let effectiveUserId = userId || job.created_by || job.wizard_state?.pi?.requested_by_id;
    if (!effectiveUserId || !mongoose.Types.ObjectId.isValid(effectiveUserId)) {
      const defaultUser = await userModel.findOne({}).select("_id");
      effectiveUserId = defaultUser?._id;
    }

    // 3. Sync sub-jobs into salesorderlist collection (exclude sample charges billing item)
    const rawItemsToSync = Array.isArray(subJobs) && subJobs.length > 0
      ? subJobs
      : (job.sub_jobs || []).filter((sj) => !sj.is_dropped && !sj.is_on_hold);

    const filteredItems = rawItemsToSync.filter(
      (it) => it.id !== "sample_charges" && it.subJobNo !== "Sample"
    );

    const itemsToSync = filteredItems.length > 0
      ? filteredItems
      : [{
          id: `${parentJobNo}-A1`,
          subJobNo: `${parentJobNo}-A1`,
          theme: job.customer_name || "Custom Trophy",
          finalQty: Number(job.the_ask?.total_pieces || job.wizard_state?.totalPieces || 1),
          rate: Number(commercials?.taxableValue || commercials?.totalAmountBeforeGst || 0),
        }];

    const isSampleFlow = job.mode === "sample" || (job.order_mode?.mode === "sample" && job.order_mode?.sample_approved !== true && (job.step === undefined || job.step <= 5));
    const targetOrderType = isSampleFlow ? "sample" : "production";
    const targetCategory = isSampleFlow ? "Sample" : "Production";

    for (let i = 0; i < itemsToSync.length; i++) {
      const it = itemsToSync[i];
      const subJobCode = it.subJobNo || (it.group_char ? `${parentJobNo}-${it.group_char}${it.item_index || 1}` : `${parentJobNo}-A${i + 1}`);
      const qtyVal = Number(it.finalQty || it.qty || it.pieces || 1);
      const rateVal = Number(it.rate || it.unitRate || 0);

      const sjMatch = (job.sub_jobs || []).find((s) => s.sub_job_no === subJobCode) || {};

      // Find or create salesorderlist entry for this specific order type (never overwrite sample order with production!)
      const sampleIdExclude = (targetOrderType === "production" && sjMatch.sample_order_id && mongoose.Types.ObjectId.isValid(sjMatch.sample_order_id))
        ? { _id: { $ne: new mongoose.Types.ObjectId(sjMatch.sample_order_id) } }
        : {};

      let soRecord = await salesorderlistModel.findOne({
        $or: [
          { enquiry_flow_id: job._id, sub_job_no: subJobCode, type: targetOrderType, ...sampleIdExclude },
          { job_no: parentJobNo, sub_job_no: subJobCode, type: targetOrderType, ...sampleIdExclude },
        ],
      });

      if (!soRecord) {
        soRecord = new salesorderlistModel({
          id: nanoid(),
          job_no: parentJobNo,
          sub_job_no: subJobCode,
          enquiry_flow_id: job._id,
          enquiry_id: job._id,
          source: "enquiry_flow_integration",
          type: targetOrderType,
          category: targetCategory,
          job_quantity: qtyVal,
          created_by: effectiveUserId,
          created_at: getCurrentDate(),
          status: "pending",
        });
      }

      // Sync salesorderform for Accounts View Order Details modal
      let soForm = await salesorderformModel.findOne({
        $or: [
          { sample_order_nanoid: soRecord.id },
          { job_no: parentJobNo, sub_job_no: subJobCode, type: targetOrderType },
        ],
      });

      if (!soForm) {
        soForm = new salesorderformModel({
          id: nanoid(),
          sample_order_nanoid: soRecord.id,
          job_no: parentJobNo,
          sub_job_no: subJobCode,
          enquiry_id: job._id,
          category: targetCategory,
          type: targetOrderType,
          created_at: getCurrentDate(),
        });
      }

      const approvedImageUrl = it.image || it.refImg || sjMatch.approved_design_url
        || sjMatch.design_files?.[0]?.file_url || sjMatch.design_files?.[0]?.url
        || job.wizard_state?.uploadedDesigns?.[subJobCode]
        || job.wizard_state?.uploadedDesigns?.['0-0']
        || sjMatch.designer_files?.[0] || soRecord.image || '';
      const designerId = sjMatch.designer_id || job.assigned_designer || job.the_brief?.designer_id;
      const deliveryDate = job.delivery_details?.delivery_date || job.the_ask?.delivery_date
        || job.wizard_state?.jobDeliveryDate || job.wizard_state?.leadDate || '';

      soForm.sample_order_nanoid = soRecord.id;
      soForm.category = targetCategory;
      soForm.type = targetOrderType;
      soForm.client_name = effectiveBillingParty.name || billingParty.name || job.customer_name || "Client";
      soForm.contact_person = effectiveBillingParty.contactPerson || billingParty.contactPerson || job.contact_person || "";
      soForm.mobile_no = Number(effectiveBillingParty.contactPhone || billingParty.contactPhone || job.contact_mobile) || undefined;
      soForm.billing_address_1 = toAddressStr(effectiveBillingParty.address || billingParty.address);
      soForm.shipping_address_1 = toAddressStr(deliveryAddress.address || effectiveBillingParty.address || billingParty.address);
      soForm.gst_number = effectiveBillingParty.gstin || billingParty.gstin || "";
      soForm.product_name = it.theme || it.name || it.product_name || "Custom Trophy";
      soForm.job_quantity = qtyVal;
      soForm.unit_price = rateVal;
      soForm.total_amount = qtyVal * rateVal;
      soForm.delivery_mode = deliveryAddress.carrier || "Our vehicle";
      soForm.delivery_address = toAddressStr(deliveryAddress.address || billingParty.address);
      if (deliveryDate) {
        soForm.delivery_date = deliveryDate;
      }
      soForm.updated_at = getCurrentDate();
      await soForm.save();

      // Flag for Accounts "Pending PI Uploads" tab (requestedaccountsfiles)
      soRecord.enquiry_flow_id = job._id;
      soRecord.enquiry_id = job._id;
      soRecord.source = "enquiry_flow_integration";
      soRecord.created_by = effectiveUserId;
      soRecord.sample_salesorder_id = soForm._id;
      soRecord.category = targetCategory;
      soRecord.type = targetOrderType;
      soRecord.is_sales_order_filled = true;
      soRecord.is_bom_verified = true;
      soRecord.is_pi_uploaded = Boolean(soRecord.Pi_files && soRecord.Pi_files.length > 0);
      soRecord.is_verified_to_proceed = false;
      soRecord.is_pi_verified = false;
      soRecord.is_pi_rework = false;
      soRecord.job_quantity = qtyVal;
      if (deliveryDate) {
        soRecord.delivery_date = deliveryDate;
      }
      if (designerId && mongoose.Types.ObjectId.isValid(designerId)) {
        soRecord.designer_person = [new mongoose.Types.ObjectId(designerId)];
      }
      if (approvedImageUrl) {
        soRecord.image = approvedImageUrl;
        soRecord.approved_design_url = approvedImageUrl;
      }
      soRecord.updated_at = getCurrentDate();
      await soRecord.save();

      // Sync sub_job reference on job
      if (targetOrderType === "production") {
        sjMatch.sales_order_id = soRecord._id;
        sjMatch.sales_order_nanoid = soRecord.id;
      } else {
        sjMatch.sample_order_id = soRecord._id;
        sjMatch.sample_order_nanoid = soRecord.id;
      }
    }

    job.markModified("sub_jobs");
    await job.save();

    return res.status(200).json({
      success: true,
      message: `Proforma Invoice requested from Accounts team for Job ${parentJobNo}`,
      data: job.wizard_state.pi,
    });
  } catch (error) {
    console.error("Error in requestProformaInvoice:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * Record official Proforma Invoice shared with client (WhatsApp, Email, etc.)
 */
export const recordProformaShared = async (req, res) => {
  try {
    const { id } = req.params;
    const { channel = "WhatsApp", sentAt = new Date().toISOString(), recipient = "" } = req.body;

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { $or: [{ id }, { enquiry_no: id }, { seq: Number(id) || -1 }] };

    const job = await enquiryJobIntegrationModel.findOne(query);
    if (!job) {
      return res.status(404).json({ success: false, message: "Enquiry job not found" });
    }

    const currentPi = job.wizard_state?.pi || {};
    job.wizard_state = {
      ...(job.wizard_state || {}),
      pi: {
        ...currentPi,
        sent: channel,
        sent_at: sentAt,
        sent_by: req.user?.name || "Client Servicing",
        sent_to: recipient || "",
      },
    };
    job.markModified("wizard_state");

    job.history.push({
      action: "PI_SHARED_WITH_CLIENT",
      step: 6,
      remarks: `Official Proforma Invoice shared with client via ${channel}${recipient ? ` (${recipient})` : ""}`,
      changed_by: {
        user_id: req.user?._id || req.user?.id,
        user_name: req.user?.name || "Client Servicing",
        role: req.user?.role || "Client Servicing",
      },
      timestamp: new Date(),
    });

    await job.save();

    return res.status(200).json({
      success: true,
      message: `Proforma Invoice marked as sent via ${channel}`,
      data: job.wizard_state.pi,
    });
  } catch (error) {
    console.error("Error in recordProformaShared:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * Send Official Proforma Invoice Email to client via backend mailer with PDF attachment
 */
export const sendProformaEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      to_email,
      client_link,
      contact_name,
      duration,
      subJobNos = [],
      totalAmount = 0,
      notes = "",
    } = req.body || {};

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { $or: [{ id }, { enquiry_no: id }, { enquiry_no: `RD${id}` }, { seq: Number(id) || -1 }] };

    const job = await enquiryJobIntegrationModel.findOne(query).populate("customer_id");
    if (!job) {
      return res.status(404).json({ success: false, message: "Enquiry job not found" });
    }

    const customer = job.customer_id || {};
    const e = job.wizard_state?.e || {};
    const recipientEmail = (to_email || job.contact_email || customer.email || e.contactEmail || "").trim();

    if (!recipientEmail) {
      return res.status(400).json({ success: false, message: "No valid recipient email address found" });
    }

    const parentJobNo = job.enquiry_no || (job.seq ? `RD${job.seq}` : "RD26004");
    const currentPi = job.wizard_state?.pi || {};
    const piNo = currentPi.no || currentPi.pi_no || `PI/2026/${parentJobNo}`;
    const piFileUrl = currentPi.file_url || "";
    const paymentTerms = currentPi.payment_terms || "100% advance";

    // Generate fresh signed URL for Accounts uploaded PDF file if available
    let signedPiUrl = null;
    if (piFileUrl) {
      try {
        signedPiUrl = await generateSignedUrl(piFileUrl);
      } catch (err) {
        console.warn("Could not generate signed URL for PI file:", err.message);
        signedPiUrl = piFileUrl;
      }
    }

    const durationHours = Number(duration || job.the_brief?.links_duration || e.links_duration || 24);
    const expiryTimestamp = Date.now() + durationHours * 60 * 60 * 1000;
    const expiryDateFormatted = new Date(expiryTimestamp).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const targetedNos = Array.isArray(subJobNos) && subJobNos.length > 0
      ? subJobNos
      : (job.sub_jobs || []).filter((s) => !s.is_dropped && !s.is_on_hold).map((s) => s.sub_job_no);

    const subJobCode = targetedNos.length > 0
      ? targetedNos.join(", ")
      : `${parentJobNo}-A1`;

    const clientName = contact_name || job.contact_person || customer.contact_person || customer.name || "Client";

    let targetLink = client_link;
    if (!targetLink) {
      const baseUrl = process.env.CLIENT_CONFIRMATION_SCREEN_URL || (req.headers.origin || "http://localhost:5173");
      const targetId = String(job._id || job.enquiry_no || job.seq);
      const { token, exp, sig } = generatePublicToken(targetId, durationHours);
      const subjobsParam = targetedNos.length > 0 ? `&subjobs=${encodeURIComponent(targetedNos.join(","))}` : "";
      targetLink = `${baseUrl}/rd/proforma-view/${targetId}?token=${token}&exp=${exp}&sig=${sig}${subjobsParam}`;
    }

    // Determine invoice total amount
    const calcTotal = Number(totalAmount) || Number(currentPi.commercials?.invoiceTotal) || Number(currentPi.commercials?.total_taxable_amount) || 0;
    const amountRowHtml = calcTotal > 0 ? `
      <tr>
        <td style="padding:10px 14px; font-weight:600; color:#475569; width:35%; border-bottom:1px solid #e2e8f0;">Total Invoice Amount:</td>
        <td style="padding:10px 14px; font-weight:700; color:#0f172a; border-bottom:1px solid #e2e8f0;">₹${calcTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    ` : "";

    const pdfButtonHtml = signedPiUrl ? `
      <p style="text-align:center; margin:10px 0 16px;">
        <a 
          href="${signedPiUrl}" 
          target="_blank"
          style="display:inline-block; padding:12px 26px; background-color:#059669; color:#ffffff; text-decoration:none; border-radius:6px; font-weight:600; font-size:14px; margin-left:8px;"
        >
          📄 Download Official PI PDF (${piNo})
        </a>
      </p>
    ` : "";

    const attachmentNoticeHtml = signedPiUrl ? `
      <div style="background-color:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px; padding:12px 16px; margin:20px 0; font-size:13px; color:#065f46;">
        📎 <strong>Official PDF Attached:</strong> The official Proforma Invoice PDF uploaded by the Accounts team is attached to this email for your accounting records.
      </div>
    ` : "";

    const piTheme = job.the_ask?.theme || job.sub_jobs?.[0]?.theme || "";
    const piThemeLabel = piTheme ? ` (${piTheme})` : "";

    const emailHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Official Proforma Invoice - ${parentJobNo}</title>
        </head>
        <body style="font-family:Arial,Helvetica,sans-serif; background-color:#f4f6f9; margin:0; padding:20px;">
          <table width="100%" border="0" cellspacing="0" cellpadding="0">
            <tr>
              <td align="center">
                <table width="640" border="0" cellspacing="0" cellpadding="0" style="background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 15px rgba(0,0,0,0.08);">
                  
                  <!-- HEADER -->
                  <tr>
                    <td align="center" style="background-color:#004aad; padding:24px 30px;">
                      <h2 style="color:#ffffff; font-size:22px; margin:0; font-weight:700;">Official Proforma Invoice</h2>
                      <p style="color:#e0e7ff; font-size:13px; margin:5px 0 0;">RD Custom Awards Pvt. Ltd.</p>
                    </td>
                  </tr>

                  <!-- LOGO & JOB INFO -->
                  <tr>
                    <td style="padding:24px 30px 10px; text-align:left;">
                      <div>
                        <img 
                          src="https://rdcustomawards.com/cdn/shop/files/logo.svg?v=1700546283&width=90" 
                          alt="RD Custom Awards Logo" 
                          style="max-width:160px; height:auto;"
                        />
                      </div>
                      <div style="font-size:15px; font-weight:700; color:#004aad; margin-top:10px;">
                        Job Ref: ${parentJobNo} · Doc No: ${piNo}
                      </div>
                    </td>
                  </tr>

                  <!-- BODY CONTENT -->
                  <tr>
                    <td style="padding:15px 30px 25px;">
                      <p style="font-size:15px; color:#1e293b; margin:0 0 16px;">
                        Dear <strong>${clientName}</strong>,
                      </p>

                      <p style="font-size:14px; line-height:1.6; color:#475569; margin:0 0 20px;">
                        Please find below the official <strong>Proforma Invoice (${piNo})</strong> for your order <strong>${parentJobNo}</strong> from RD Custom Awards Pvt. Ltd. The official invoice document has been generated and approved by our Accounts team.
                      </p>

                      <!-- PI SUMMARY CARD -->
                      <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; font-size:13px; margin-bottom:20px;">
                        <tr>
                          <td style="padding:10px 14px; font-weight:600; color:#475569; width:35%; border-bottom:1px solid #e2e8f0;">Proforma Invoice No:</td>
                          <td style="padding:10px 14px; font-weight:700; color:#004aad; border-bottom:1px solid #e2e8f0;">${piNo}</td>
                        </tr>
                        <tr>
                          <td style="padding:10px 14px; font-weight:600; color:#475569; border-bottom:1px solid #e2e8f0;">Parent Job Number:</td>
                          <td style="padding:10px 14px; font-weight:600; color:#0f172a; border-bottom:1px solid #e2e8f0;">${parentJobNo}</td>
                        </tr>
                        <tr>
                          <td style="padding:10px 14px; font-weight:600; color:#475569; border-bottom:1px solid #e2e8f0;">Sub-job(s):</td>
                          <td style="padding:10px 14px; color:#334155; border-bottom:1px solid #e2e8f0;">${subJobCode}${piThemeLabel}</td>
                        </tr>
                        ${amountRowHtml}
                        <tr>
                          <td style="padding:10px 14px; font-weight:600; color:#475569;">Payment Terms:</td>
                          <td style="padding:10px 14px; color:#334155;">${paymentTerms}</td>
                        </tr>
                      </table>

                      ${attachmentNoticeHtml}

                      <!-- ACTION BUTTONS -->
                      <div style="text-align:center; margin:25px 0 15px;">
                        <a 
                          href="${targetLink}" 
                          target="_blank"
                          style="display:inline-block; padding:12px 28px; background-color:#004aad; color:#ffffff; text-decoration:none; border-radius:6px; font-weight:600; font-size:14px; margin:4px;"
                        >
                          👁️ View Quotation & Proforma Online
                        </a>
                        ${pdfButtonHtml}
                      </div>

                      <!-- EXPIRY MESSAGE -->
                      <p style="text-align:center; font-size:12px; color:#64748b; margin:0 0 20px;">
                        🔒 This secure client link will remain active until <strong>${expiryDateFormatted}</strong>
                      </p>

                      <div style="font-size:13px; color:#64748b; background:#f8fafc; padding:14px; border-radius:8px; border:1px solid #e2e8f0; margin-top:20px;">
                        <p style="margin:0 0 6px; font-weight:700; color:#1e293b;">Next Steps for Production:</p>
                        <p style="margin:0 0 4px;">• Please review the attached proforma invoice and confirm your approval.</p>
                        <p style="margin:0 0 4px;">• Arrange the advance payment as per the terms specified.</p>
                        <p style="margin:0;">• Once payment is confirmed, your order will proceed directly to sampling or production.</p>
                      </div>

                      <p style="font-size:14px; color:#334155; margin-top:24px;">
                        Thank you for choosing <strong>RD Custom Awards</strong>.<br/>
                        Warm regards,<br/>
                        <strong>Client Servicing & Accounts Desk</strong><br/>
                        RD Custom Awards Pvt. Ltd.
                      </p>
                    </td>
                  </tr>

                  <!-- FOOTER -->
                  <tr>
                    <td align="center" style="background-color:#f8fafc; padding:15px; border-top:1px solid #e2e8f0;">
                      <p style="font-size:12px; color:#64748b; margin:0;">
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

    // Prepare attachments: attach the uploaded PI PDF if available
    const attachments = [];
    if (signedPiUrl) {
      const safeFilename = `${(piNo || "Official_Proforma_Invoice").replace(/[/\\?%*:|"<>]/g, "_")}.pdf`;
      attachments.push({
        filename: safeFilename,
        path: signedPiUrl,
      });
    }

    if (transporter) {
      await sendMailWithUser(req.user, {
        to: recipientEmail,
        subject: `Official Proforma Invoice ${piNo ? `${piNo} - ` : ""}${parentJobNo}${piThemeLabel} - RD Custom Awards`,
        html: emailHTML,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
    }

    const now = new Date();
    const nowIso = now.toISOString();

    job.wizard_state = {
      ...(job.wizard_state || {}),
      pi: {
        ...currentPi,
        sent: "Email",
        sent_at: nowIso,
        sent_by: req.user?.name || "Client Servicing",
        sent_to: recipientEmail,
      },
    };
    job.markModified("wizard_state");

    job.history.push({
      action: "PI_EMAIL_SENT",
      step: 6,
      remarks: `Official Proforma Invoice email sent to ${recipientEmail} (Doc No: ${piNo})${signedPiUrl ? " with PDF attachment" : ""}${notes ? ` (${notes})` : ""}`,
      changed_by: {
        user_id: req.user?._id || req.user?.id || null,
        user_name: req.user?.name || "Client Servicing",
        role: req.user?.role || "Client Servicing",
      },
      timestamp: now,
    });

    await job.save();

    return res.status(200).json({
      success: true,
      message: `Official Proforma Invoice email sent successfully to ${recipientEmail}`,
      recipient: recipientEmail,
      data: job.wizard_state.pi,
    });
  } catch (error) {
    console.error("Error sending proforma email:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while sending proforma email",
      error: error.message,
    });
  }
};

/**
 * Record public Proforma Invoice decision (Accept / Request Changes / Decline) from client
 */
export const recordPublicProformaFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      decision = "approved", // "approved" | "revision" | "rejected"
      notes = "",
      clientName = "",
    } = req.body || {};

    let job = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      job = await enquiryJobIntegrationModel.findById(id).populate("customer_id");
    }
    if (!job) {
      job = await enquiryJobIntegrationModel.findOne({
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
    const nowIso = now.toISOString();
    const trimmedNotes = notes ? String(notes).trim() : "";
    const responderName = clientName || job.contact_person || job.customer_id?.name || "Client (Online Link)";

    const wizard_state = { ...(job.wizard_state || {}) };
    const currentPi = wizard_state.pi || {};

    wizard_state.pi = {
      ...currentPi,
      client_decision: {
        decision,
        notes: trimmedNotes,
        at: nowIso,
        by: responderName,
      },
    };

    if (decision === "approved") {
      wizard_state.piApproved = true;
      wizard_state.clientApproved = true;
      wizard_state.clientApprovedAt = nowIso;
      wizard_state.clientApprovedVia = "Client Link";

      // Also mark costOk so Tick 2 in Step 6 (FinancialsTab) is satisfied
      const sharedPhone = job.contact_phone || job.contact_mobile || job.customer_id?.mobile || job.customer_id?.phone || "";
      const sharedEmail = job.contact_email || job.customer_id?.email || "";
      wizard_state.costOk = {
        approval_type: "client_direct",
        method: "client_link",
        channel: "Client Link (Direct)",
        date: now.toISOString().split("T")[0],
        time: now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        whoConfirmed: responderName,
        notes: trimmedNotes || "Approved via online Proforma link",
        shared_to: responderName,
        shared_to_phone: sharedPhone,
        shared_to_email: sharedEmail,
        shared_by: currentPi.sent_by || wizard_state.coordinator || "Client Servicing",
        shared_channel: currentPi.sent || (currentPi.sent_to?.includes("@") ? "Email" : "WhatsApp"),
        shared_at: currentPi.sent_at || null,
      };
      delete wizard_state.piRevise;
      delete wizard_state.piRejected;
    } else if (decision === "revision") {
      wizard_state.piRevise = {
        requested_at: nowIso,
        notes: trimmedNotes || "Client requested changes on Proforma Invoice",
        by: responderName,
      };
      delete wizard_state.costOk;
      wizard_state.piApproved = false;
      wizard_state.clientApproved = false;
    } else if (decision === "rejected") {
      wizard_state.piRejected = {
        rejected_at: nowIso,
        notes: trimmedNotes || "Client declined Proforma Invoice",
        by: responderName,
      };
      delete wizard_state.costOk;
      wizard_state.piApproved = false;
      wizard_state.clientApproved = false;
    }

    job.wizard_state = wizard_state;
    job.markModified("wizard_state");

    const parentJobNo = job.enquiry_no || (job.seq ? `RD${job.seq}` : "RD26004");
    job.history.push({
      action: `PUBLIC_PI_${decision.toUpperCase()}`,
      step: 6,
      remarks: `Direct Client Response - Proforma Invoice ${decision.toUpperCase()} for ${parentJobNo}: ${trimmedNotes || "No remarks"}`,
      changed_by: {
        user_id: null,
        user_name: responderName,
        role: "Client",
      },
      timestamp: now,
    });

    await job.save();

    return res.status(200).json({
      success: true,
      message: `Proforma Invoice feedback recorded successfully: ${decision}`,
      data: job,
    });
  } catch (error) {
    console.error("Error in recordPublicProformaFeedback:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Push confirmed bulk production order to Production Hub (/productionorder)
 * Sets salesorderlist records to is_verified_to_proceed = true,
 * status = "pending", category = "Production", type = "production",
 * and marks EnquiryJob as released to Production Hub.
 */
export const pushToProductionHub = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      packingDetails: _packingDetails = {},
      deliveryDetails: _deliveryDetails = {},
      postNotes = "",
      priority = "Normal",
      clientLogo = [],
      signatures = [],
      additionalFiles = [],
    } = req.body || {};

    let job = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      job = await enquiryJobIntegrationModel.findById(id).populate("customer_id");
    }
    if (!job) {
      job = await enquiryJobIntegrationModel.findOne({
        $or: [{ enquiry_no: id }, { enquiry_no: "RD" + id }, { seq: Number(id) || -1 }],
      }).populate("customer_id");
    }

    if (!job) {
      return res.status(404).json({ success: false, message: "Enquiry job not found" });
    }

    const parentJobNo = job.enquiry_no || (job.seq ? `RD${job.seq}` : "RD26004");
    const activeSubJobs = (job.sub_jobs || []).filter((sj) => !sj.is_dropped && !sj.is_on_hold);

    if (activeSubJobs.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No active products or sub-jobs found on this job to push to Production Hub.",
      });
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const effectiveUserId = req.user?._id || req.user?.id || job.created_by;
    const effectiveUserName = req.user?.name || "Client Servicing";
    const effectiveUserRole = req.user?.role || "Client Servicing";

    const createdOrUpdatedOrders = [];

    // Push each active sub-job into salesorderlistModel as a verified Production Order
    for (let idx = 0; idx < activeSubJobs.length; idx++) {
      const sj = activeSubJobs[idx];
      const sjNo = sj.sub_job_no || `${parentJobNo}-A${idx + 1}`;
      const qtyVal = Number(sj.quantity || sj.qty || job.wizard_state?.finalQty || 1);
      const _rateVal = Number(sj.unit_rate || sj.target_rate || sj.rate || 0);

      // Resolve approved design image
      let approvedImg = sj.approved_design_url ||
        sj.approved_designs?.[0]?.url ||
        sj.design_files?.[0]?.file_url ||
        sj.design_files?.[0]?.url ||
        job.wizard_state?.uploadedDesigns?.[sjNo] ||
        job.wizard_state?.uploadedDesigns?.["0-0"] ||
        "";

      // Resolve BOM details if available
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
            }
          } catch {
            // Ignore if BOM document not found
          }
        }
      }

      // If still no bomObjId, check by sub_job_no in BOM collection
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
          }
        } catch {
          // Ignore if BOM not found by sub_job_no
        }
      }

      if (bomObjId) sj.bom_id = bomObjId;
      if (bomNanoId) sj.bom_nanoid = bomNanoId;

      // 1. Resolve and mark previous sample sales order as completed / approved (Preserve Sample History)
      let sampleOrderId = sj.sample_order_id;
      if (!sampleOrderId && sj.sample_order_nanoid) {
        const foundSample = await salesorderlistModel.findOne({ id: sj.sample_order_nanoid }).select("_id").lean();
        if (foundSample) {
          sampleOrderId = foundSample._id;
          sj.sample_order_id = foundSample._id;
        }
      }
      if (!sampleOrderId) {
        const foundSampleByNo = await salesorderlistModel.findOne({
          $or: [
            { enquiry_flow_id: job._id, sub_job_no: sjNo, type: "sample" },
            { job_no: parentJobNo, sub_job_no: sjNo, type: "sample" },
            { job_no: parentJobNo, sub_job_no: sjNo, category: "Sample" },
          ],
        }).select("_id id").lean();
        if (foundSampleByNo) {
          sampleOrderId = foundSampleByNo._id;
          sj.sample_order_id = foundSampleByNo._id;
          sj.sample_order_nanoid = foundSampleByNo.id;
        }
      }

      if (sampleOrderId && mongoose.Types.ObjectId.isValid(sampleOrderId)) {
        await salesorderlistModel.findByIdAndUpdate(sampleOrderId, {
          status: "complete",
          is_sample_approved: true,
          type: "sample",
          category: "Sample",
        }).catch(() => {});
      }

      // STRICT EXCLUSION: A production order must NEVER match the sample order!
      const excludeSampleQuery = sampleOrderId
        ? { _id: { $ne: new mongoose.Types.ObjectId(sampleOrderId) } }
        : {};

      // Find or create salesorderlist entry specifically for PRODUCTION order (strictly matching this job and sub_job)
      let soRecord = null;

      // 1. First priority: Match by enquiry_flow_id AND sub_job_no AND type === "production"
      soRecord = await salesorderlistModel.findOne({
        enquiry_flow_id: job._id,
        sub_job_no: sjNo,
        type: "production",
        ...excludeSampleQuery,
      });

      // 2. Second priority: Match by parentJobNo AND sub_job_no AND type === "production"
      if (!soRecord) {
        soRecord = await salesorderlistModel.findOne({
          job_no: parentJobNo,
          sub_job_no: sjNo,
          type: "production",
          ...excludeSampleQuery,
        });
      }

      // 3. Third priority: If sj.sales_order_id is set, ensure it belongs to THIS job and sub_job
      if (
        !soRecord &&
        sj.sales_order_id &&
        mongoose.Types.ObjectId.isValid(sj.sales_order_id) &&
        String(sj.sales_order_id) !== String(sampleOrderId)
      ) {
        soRecord = await salesorderlistModel.findOne({
          _id: sj.sales_order_id,
          $or: [{ enquiry_flow_id: job._id }, { job_no: parentJobNo }],
          sub_job_no: sjNo,
          type: "production",
          ...excludeSampleQuery,
        });
      }

      if (!soRecord) {
        soRecord = new salesorderlistModel({
          id: nanoid(16),
          job_no: parentJobNo,
          sub_job_no: sjNo,
          enquiry_flow_id: job._id,
          enquiry_id: job._id,
          source: "enquiry_flow_integration",
          created_by: effectiveUserId,
          created_at: getCurrentDate(),
          type: "production",
          category: "Production",
          status: "pending",
          is_pushed_shop_floor: false, // Fresh bulk production job!
          pushed_to_shop_floor_at: null,
          blocked_materials: [],
          generator_rfq: [],
        });
      }

      // Populate production order fields
      soRecord.type = "production";
      soRecord.category = "Production";
      soRecord.job_quantity = qtyVal;
      soRecord.status = soRecord.status === "process" ? soRecord.status : "pending";
      soRecord.is_verified_to_proceed = true; // Key flag for Production Hub visibility!
      soRecord.proceed_to_production_datetime = getCurrentDate();
      soRecord.is_sales_order_filled = true;
      soRecord.is_bom_verified = true;
      if (soRecord.status === "pending") {
        soRecord.is_pushed_shop_floor = false;
      }
      soRecord.designer_person = sj.designer_id || job.assigned_designer || null;
      if (approvedImg) {
        soRecord.image = approvedImg;
        soRecord.approved_design_url = approvedImg;
      }
      if (bomObjId && mongoose.Types.ObjectId.isValid(bomObjId)) {
        soRecord.bom_id = bomObjId;
      } else {
        soRecord.bom_id = null;
      }
      if (bomNanoId) soRecord.bom_nanoid = bomNanoId;
      if (priority) soRecord.priority = priority;

      // Designer files
      if (Array.isArray(sj.designer_files) && sj.designer_files.length > 0) {
        soRecord.designer_files = sj.designer_files
          .map((f) => (typeof f === "string" ? f : (f?.file_url || f?.url)))
          .filter(Boolean);
      }

      // Sync mandatory & uploaded DTP assets into salesorderlist additional_files
      const additionalFilesToPush = [];

      // 1. Logos
      const combinedLogos = [
        ...(Array.isArray(clientLogo) ? clientLogo : []),
        ...(job.wizard_state?.e?.globalLogos || []),
        ...(job.wizard_state?.clientLogo || []),
        ...(job.wizard_state?.e?.clientLogo || []),
        ...(sj.client_logo || []),
      ];
      for (const lg of combinedLogos) {
        const fileUrl = typeof lg === "string" ? lg : (lg?.file_url || lg?.url || lg?.signed_url);
        if (fileUrl) {
          additionalFilesToPush.push({
            tag_name: "Logo",
            file_url: fileUrl,
            uploaded_by: effectiveUserId,
            uploaded_at: getCurrentDate(),
          });
        }
      }

      // 2. Signatures
      const combinedSigs = [
        ...(Array.isArray(signatures) ? signatures : []),
        ...(job.wizard_state?.e?.globalSignatures || []),
        ...(job.wizard_state?.signatures || []),
        ...(job.wizard_state?.e?.signatures || []),
        ...(sj.signatures || []),
      ];
      for (const sg of combinedSigs) {
        const fileUrl = typeof sg === "string" ? sg : (sg?.file_url || sg?.url || sg?.signed_url);
        if (fileUrl) {
          const sigName = typeof sg === "object" ? sg.name : "";
          const sigDesig = typeof sg === "object" ? sg.designation : "";
          const tagLabel = sigName ? `Signed Image - ${sigName}${sigDesig ? ` (${sigDesig})` : ""}` : "Signed Image";
          additionalFilesToPush.push({
            tag_name: tagLabel,
            file_url: fileUrl,
            uploaded_by: effectiveUserId,
            uploaded_at: getCurrentDate(),
          });
          if (tagLabel !== "Signed Image") {
            additionalFilesToPush.push({
              tag_name: "Signed Image",
              file_url: fileUrl,
              uploaded_by: effectiveUserId,
              uploaded_at: getCurrentDate(),
            });
          }
        }
      }

      // 3. Additional files / Event content
      const combinedAddFiles = [
        ...(Array.isArray(additionalFiles) ? additionalFiles : []),
        ...(job.wizard_state?.e?.globalAdditionalFiles || []),
        ...(job.wizard_state?.additionalFiles || []),
        ...(job.wizard_state?.e?.additionalFiles || []),
        ...(job.wizard_state?.e?.additional_files || []),
        ...(sj.additional_files || []),
      ];
      for (const af of combinedAddFiles) {
        const fileUrl = typeof af === "string" ? af : (af?.file_url || af?.url || af?.signed_url);
        if (fileUrl) {
          additionalFilesToPush.push({
            tag_name: "additional_files",
            file_url: fileUrl,
            uploaded_by: effectiveUserId,
            uploaded_at: getCurrentDate(),
          });
        }
      }

      if (additionalFilesToPush.length > 0) {
        const existingUrls = new Set((soRecord.additional_files || []).map((f) => f.file_url));
        const newAssets = additionalFilesToPush.filter((f) => !existingUrls.has(f.file_url));
        soRecord.additional_files = [...(soRecord.additional_files || []), ...newAssets];
      }

      await soRecord.save();
      createdOrUpdatedOrders.push(soRecord);

      // Update subjob on EnquiryJob
      sj.sales_order_id = soRecord._id;
      sj.sales_order_nanoid = soRecord.id;
      sj.production_status = "pushed";
      sj.is_verified_to_proceed = true;
      sj.is_pushed_shop_floor = false;
    }

    // Sync salesorderform records
    for (let idx = 0; idx < createdOrUpdatedOrders.length; idx++) {
      const soRecord = createdOrUpdatedOrders[idx];
      let soForm = await salesorderformModel.findOne({
        $or: [
          { sample_order_nanoid: soRecord.id },
          { job_no: parentJobNo, sub_job_no: soRecord.sub_job_no, type: "production" },
        ],
      });

      if (!soForm) {
        soForm = new salesorderformModel({
          id: nanoid(16),
          sample_order_nanoid: soRecord.id,
          job_no: parentJobNo,
          sub_job_no: soRecord.sub_job_no,
          enquiry_id: job._id,
          type: "production",
          category: "Production",
          created_at: getCurrentDate(),
        });
      }

      soForm.category = "Production";
      soForm.type = "production";
      soForm.client_name = job.customer_name || "Client";
      soForm.contact_person = job.contact_person || "";
      soForm.mobile_no = Number(job.contact_mobile) || undefined;
      soForm.job_quantity = soRecord.job_quantity;
      soForm.is_verified_to_proceed = true;

      const combinedSigsForForm = [
        ...(Array.isArray(signatures) ? signatures : []),
        ...(job.wizard_state?.e?.globalSignatures || []),
        ...(job.wizard_state?.signatures || []),
      ];
      const sigSummary = combinedSigsForForm
        .filter((s) => typeof s === "object" && s.name)
        .map((s) => `${s.name}${s.designation ? ` (${s.designation})` : ""}`)
        .join(", ");
      if (sigSummary) {
        soForm.job_content = soForm.job_content
          ? `${soForm.job_content} | Signatories: ${sigSummary}`
          : `Signatories: ${sigSummary}`;
      }

      soForm.updated_at = getCurrentDate();
      await soForm.save();
    }

    // Mark job in wizard_state as released to Production Hub
    const wizard_state = { ...(job.wizard_state || {}) };
    wizard_state.released = true;
    wizard_state.releasedAt = nowIso;
    wizard_state.releasedBy = effectiveUserName;
    wizard_state.hub = {
      no: `PH/2026/${parentJobNo}`,
      at: nowIso,
      ordersCount: createdOrUpdatedOrders.length,
    };
    if (postNotes) wizard_state.postNotes = postNotes;
    if (priority) wizard_state.priority = priority;
    if (Array.isArray(clientLogo) && clientLogo.length > 0) {
      wizard_state.clientLogo = clientLogo;
      if (!wizard_state.e) wizard_state.e = {};
      wizard_state.e.globalLogos = clientLogo;
    }
    if (Array.isArray(signatures) && signatures.length > 0) {
      wizard_state.signatures = signatures;
      if (!wizard_state.e) wizard_state.e = {};
      wizard_state.e.globalSignatures = signatures;
    }
    if (Array.isArray(additionalFiles) && additionalFiles.length > 0) {
      wizard_state.additionalFiles = additionalFiles;
      if (!wizard_state.e) wizard_state.e = {};
      wizard_state.e.globalAdditionalFiles = additionalFiles;
    }

    job.wizard_state = wizard_state;
    job.step = 7; // Advance past pipeline
    job.stage = "production";
    job.production_status = "pushed";
    job.markModified("wizard_state");
    job.markModified("sub_jobs");

    // History audit log
    job.history.push({
      action: "PUSHED_TO_PRODUCTION_HUB",
      step: 6,
      remarks: `Order successfully posted to Production Hub (${createdOrUpdatedOrders.length} sub-job production orders created/verified). Doc: PH/2026/${parentJobNo}${postNotes ? ` · Notes: ${postNotes}` : ""}`,
      changed_by: {
        user_id: effectiveUserId,
        user_name: effectiveUserName,
        role: effectiveUserRole,
      },
      timestamp: now,
    });

    await job.save();

    return res.status(200).json({
      success: true,
      message: `Job ${parentJobNo} successfully posted to Production Hub (${createdOrUpdatedOrders.length} production orders verified)`,
      hubDocNo: wizard_state.hub.no,
      orders: createdOrUpdatedOrders,
      data: job,
    });
  } catch (error) {
    console.error("Error in pushToProductionHub:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
