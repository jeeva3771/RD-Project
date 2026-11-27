import mongoose from "mongoose";
import EnquiryJob from "../../../models/enquiry/enquiryJobIntegrationModel.js";
import customerModel from "../../../models/masters/customerModel.js";
import { transporter, sendMailWithUser } from "../../../helpers/mail.js";
import { generatePublicToken, verifyPublicLink } from "../../../helpers/publicLinkToken.js";

/**
 * sendDeliveryEmail
 * Sends Sample Delivery & Courier Charges summary to client with approval link.
 */
export const sendDeliveryEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      to_email,
      client_link,
      contact_name,
      duration = 24,
      carrier = "Tempo",
      chargesAmount = 0,
      isClientPayer = true,
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

    const parentJobNo = job.enquiry_no || (job.seq ? `RD${job.seq}` : "RD");
    const durationHours = Number(duration || 24);
    const expiryTimestamp = Date.now() + durationHours * 60 * 60 * 1000;
    const expiryDateFormatted = new Date(expiryTimestamp).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const clientName = contact_name || job.contact_person || customer.contact_person || customer.name || "Client";
    const baseAmt = Number(chargesAmount || 0);
    const gstAmt = Math.round(baseAmt * 0.18);
    const totalAmt = baseAmt + gstAmt;
    const payerLabel = isClientPayer ? "Payable by Client (will be added to final invoice)" : "Borne by RD Custom Awards";

    let targetLink = client_link;
    if (!targetLink) {
      const baseUrl = process.env.CLIENT_CONFIRMATION_SCREEN_URL || "http://localhost:5173";
      const targetId = job._id || job.enquiry_no || job.seq;
      const { token, exp: expParam, sig } = generatePublicToken(targetId, durationHours);
      targetLink = `${baseUrl}/rd/quote-view/${targetId}?token=${token}&exp=${expParam}&sig=${sig}&tab=delivery`;
    }

    const emailHTML = `
      <html>
        <body style="margin:0; padding:0; background-color:#f4f6f8; font-family:'Segoe UI', Arial, sans-serif;">
          <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f6f8; padding:30px 0;">
            <tr>
              <td align="center">
                <table width="650" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
                  <tr>
                    <td align="center" style="background-color:#004aad; padding:22px 30px;">
                      <h2 style="color:#ffffff; font-size:20px; margin:0; font-weight:700;">Sample Delivery & Courier Charges - RD Custom Awards</h2>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:25px 30px; text-align:left;">
                      <div>
                        <img 
                          src="https://rdcustomawards.com/cdn/shop/files/logo.svg?v=1700546283&width=90" 
                          alt="RD Custom Awards Logo" 
                          style="max-width:150px; height:auto;"
                        />
                      </div>
                      <div style="font-size:15px; font-weight:600; color:#004aad; margin-top:8px;">
                        Job Ref: ${parentJobNo} · Sample Delivery
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 30px 25px;">
                      <p style="font-size:15px; color:#333; margin:0 0 15px;">
                        Dear <strong>${clientName}</strong>,
                      </p>
                      <p style="font-size:14px; line-height:1.6; color:#555; margin:0 0 20px;">
                        Please find the delivery & courier charges details for your sample dispatch under enquiry <strong>${parentJobNo}</strong> below.
                      </p>

                      <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; font-size:13px; margin-bottom:20px; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">
                        <tr style="background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
                          <td style="padding:10px 14px; font-weight:600; color:#64748b; width:140px;">Carrier Mode</td>
                          <td style="padding:10px 14px; font-weight:700; color:#0f172a;">${carrier}</td>
                        </tr>
                        <tr style="background-color:#ffffff; border-bottom:1px solid #e2e8f0;">
                          <td style="padding:10px 14px; font-weight:600; color:#64748b;">Delivery To</td>
                          <td style="padding:10px 14px; color:#0f172a;">${destination || "Client Office / Venue"}</td>
                        </tr>
                        <tr style="background-color:#f8fafc; border-bottom:1px solid #e2e8f0;">
                          <td style="padding:10px 14px; font-weight:600; color:#64748b;">Courier / Freight Rate</td>
                          <td style="padding:10px 14px; color:#0f172a;">₹${baseAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                        <tr style="background-color:#ffffff; border-bottom:1px solid #e2e8f0;">
                          <td style="padding:10px 14px; font-weight:600; color:#64748b;">GST @ 18%</td>
                          <td style="padding:10px 14px; color:#0f172a;">₹${gstAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                        <tr style="background-color:#f1f5f9; font-weight:bold; border-bottom:1px solid #e2e8f0;">
                          <td style="padding:12px 14px; color:#0f172a;">Total Charges</td>
                          <td style="padding:12px 14px; color:#004aad; font-size:15px;">₹${totalAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                        <tr style="background-color:#ffffff;">
                          <td style="padding:10px 14px; font-weight:600; color:#64748b;">Payment Term</td>
                          <td style="padding:10px 14px; color:#0f172a; font-weight:600;">${payerLabel}</td>
                        </tr>
                      </table>

                      <p style="text-align:center; margin:25px 0 10px;">
                        <a 
                          href="${targetLink}" 
                          target="_blank"
                          style="display:inline-block; padding:12px 28px; background-color:#004aad; color:#ffffff; text-decoration:none; border-radius:6px; font-weight:600; font-size:14px;"
                        >
                          View & Approve Online
                        </a>
                      </p>

                      <p style="text-align:center; font-size:12px; color:#777; margin:0 0 20px;">
                        🔒 Valid until <strong>${expiryDateFormatted}</strong>
                      </p>

                      <p style="font-size:13px; color:#555; margin-top:20px; line-height:1.5;">
                        Please reply to this email or click the link above with your confirmation to initiate dispatch.<br/><br/>
                        Warm regards,<br/>
                        <strong>RD Custom Awards Pvt. Ltd.</strong>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="background-color:#f8f9fa; padding:14px; border-top:1px solid #eee;">
                      <p style="font-size:11px; color:#777; margin:0;">
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

    const deliveryTheme = job.the_ask?.theme || job.sub_jobs?.[0]?.theme || "";
    const deliveryThemePart = deliveryTheme ? ` (${deliveryTheme})` : "";

    if (transporter) {
      await sendMailWithUser(req.user, {
        to: recipientEmail,
        subject: `Sample Delivery & Courier Charges - ${parentJobNo}${deliveryThemePart} - RD Custom Awards`,
        html: emailHTML,
      });
    }

    const now = new Date();
    const wizard_state = { ...(job.wizard_state || {}) };
    wizard_state.sampleChargesState = "awaiting_approval";
    wizard_state.sampleChargesSentVia = "email";
    wizard_state.sampleChargesAmount = baseAmt;
    wizard_state.sampleCarrier = carrier;
    wizard_state.sampleFreight = isClientPayer ? "Client pays freight" : "RD pays freight";
    wizard_state.sampleChargesSentAt = now.toISOString();

    job.wizard_state = wizard_state;
    job.markModified("wizard_state");

    job.history.push({
      action: "DELIVERY_CHARGES_EMAIL_SENT",
      step: job.step,
      remarks: `Delivery charges email sent to ${recipientEmail} (₹${baseAmt} + GST for ${carrier})${notes ? ` - ${notes}` : ""}`,
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
      message: `Delivery charges email sent successfully to ${recipientEmail}`,
      recipient: recipientEmail,
    });
  } catch (error) {
    console.error("Error sending delivery charges email:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while sending delivery charges email",
      error: error.message,
    });
  }
};

/**
 * recordPublicDeliveryFeedback
 * Client approves or requests change on courier/delivery charges via public link
 */
export const recordPublicDeliveryFeedback = async (req, res) => {
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
    wizard_state.sampleChargesState = decision === "approved" ? "approved" : "simulated";
    wizard_state.sampleApprovalMethod = "Client Link (Direct)";
    wizard_state.sampleChargesDecision = {
      decision,
      notes: notes ? String(notes).trim() : "",
      at: now.toISOString(),
      by: clientName || job.contact_person || job.customer_id?.name || "Client",
    };

    job.wizard_state = wizard_state;
    job.markModified("wizard_state");

    const delivery_details = { ...(job.delivery_details || {}) };
    if (decision === "approved" && wizard_state.sampleChargesAmount) {
      delivery_details.delivery_cost = Number(wizard_state.sampleChargesAmount) || 0;
      job.delivery_details = delivery_details;
      job.markModified("delivery_details");
    }

    const delivery_charges = {
      ...(job.delivery_charges?.toObject ? job.delivery_charges.toObject() : job.delivery_charges || {}),
    };
    if (decision === "approved") {
      delivery_charges.status = "client_approved";
      delivery_charges.approved_at = now;
      delivery_charges.approved_by = {
        user_id: null,
        user_name: clientName || job.contact_person || job.customer_id?.name || "Client",
        role: "Client",
      };
      delivery_charges.approval_method = "Client Link (Direct)";
      delivery_charges.approval_notes = notes ? String(notes).trim() : "";
    } else {
      delivery_charges.status = "quoted";
      delivery_charges.re_request_notes = notes ? String(notes).trim() : "";
    }
    job.delivery_charges = delivery_charges;
    job.markModified("delivery_charges");

    job.history.push({
      action: `DELIVERY_CHARGES_${decision.toUpperCase()}`,
      step: job.step,
      remarks: `Client ${decision.toUpperCase()} courier/delivery charges via link: ${notes || "No remarks"}`,
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
      message: `Delivery charges feedback recorded: ${decision}`,
      data: job,
    });
  } catch (error) {
    console.error("Error in recordPublicDeliveryFeedback:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * requestDeliveryCharge
 * Dispatches delivery charge request from Coordinator to Packing Team
 */
export const requestDeliveryCharge = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      carrier = "Tempo",
      payer = "client",
      destination_area = "Local",
      destination_city = "",
      address_snapshot = {},
      when = "Office hours",
      notes = "",
      re_request_reason = "", // "address_change" | "client_revision" | "re_estimate"
      re_request_notes = "",
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
    const coordinatorUser = {
      user_id: req.user?._id || req.user?.id || null,
      user_name: req.user?.name || job.coordinator_name || "Client Servicing",
    };

    // 1. Inspect existing delivery charge and archive previous approved state into history
    const existingDC = job.delivery_charges?.toObject ? job.delivery_charges.toObject() : (job.delivery_charges || {});
    const existingHist = Array.isArray(existingDC.approval_history) ? [...existingDC.approval_history] : [];
    const wasApproved = existingDC.status === "client_approved" || job.wizard_state?.sampleChargesState === "approved";
    const prevAmount = existingDC.amount || job.wizard_state?.sampleChargesAmount || 0;

    if (wasApproved && prevAmount > 0) {
      existingHist.unshift({
        revision: existingHist.length + 1,
        amount: prevAmount,
        carrier: existingDC.carrier || carrier,
        payer: existingDC.payer || payer,
        courier_partner: existingDC.courier_partner || "",
        address_snapshot: existingDC.address_snapshot || {},
        when: existingDC.when || "",
        approved_at: existingDC.approved_at || job.wizard_state?.sampleChargesSentAt || now,
        approved_by: existingDC.approved_by || {
          user_id: null,
          user_name: job.wizard_state?.sampleApprovalMethod || "Client",
          role: "Client",
        },
        approval_method: existingDC.approval_method || job.wizard_state?.sampleApprovalMethod || "WhatsApp",
        approval_notes: existingDC.approval_notes || "",
        quoted_at: existingDC.quoted_at || null,
        quoted_by: existingDC.quoted_by || null,
        re_request_reason: re_request_reason || "address_change",
        re_request_notes: re_request_notes || notes || "",
        invalidated_at: now,
        invalidated_by: coordinatorUser,
      });
    }

    // 2. Update delivery_charges subdocument
    job.delivery_charges = {
      status: "requested",
      carrier,
      payer: payer === "rd" ? "rd" : "client",
      amount: 0,
      courier_partner: "",
      notes: notes ? String(notes).trim() : "",
      requested_at: now,
      requested_by: coordinatorUser,
      quoted_at: null,
      quoted_by: null,
      destination_area,
      destination_city,
      address_snapshot: {
        label: address_snapshot.label || "",
        full_address: address_snapshot.full_address || address_snapshot.address || "",
        city: address_snapshot.city || destination_city || "",
        state: address_snapshot.state || "",
        pin: address_snapshot.pin || "",
        site_contact: address_snapshot.site_contact || address_snapshot.contact || "",
        site_phone: address_snapshot.site_phone || address_snapshot.phone || "",
      },
      when,
      re_request_reason: re_request_reason || (wasApproved ? "address_change" : ""),
      re_request_notes: re_request_notes || notes || "",
      approval_history: existingHist,
      approved_at: null,
      approved_by: null,
      approval_method: null,
      approval_notes: null,
    };
    job.markModified("delivery_charges");

    // 3. Sync into wizard_state so all existing step views display "requested" and reset old approval
    const wizard_state = { ...(job.wizard_state || {}) };
    wizard_state.sampleChargesState = "requested";
    wizard_state.sampleChargesAmount = 0;
    wizard_state.sampleApprovalMethod = null;
    wizard_state.sampleChargesDecision = null;
    wizard_state.sampleCarrier = carrier;
    wizard_state.delivCarrier = carrier;
    wizard_state.sampleFreight = payer === "client" ? "Client pays freight" : "RD pays freight";
    wizard_state.delivPayer = payer;
    wizard_state.sampleArea = destination_area;
    wizard_state.sampleCity = destination_city || wizard_state.sampleCity;
    wizard_state.sampleWhen = when;
    wizard_state.deliv = {
      ...(wizard_state.deliv || {}),
      carrier,
      payer,
      destination: destination_area,
      when,
      chargesState: "requested",
      chargesAmount: 0,
      approvalMethod: null,
      notes,
    };
    job.wizard_state = wizard_state;
    job.markModified("wizard_state");

    // 4. Sync delivery_details
    const delivery_details = { ...(job.delivery_details || {}) };
    delivery_details.carrier = carrier;
    delivery_details.payer = payer;
    delivery_details.charges_state = "requested";
    delivery_details.charges_amount = 0;
    delivery_details.delivery_cost = 0;
    job.delivery_details = delivery_details;
    job.markModified("delivery_details");

    // 5. Audit History
    const actionName = wasApproved ? "DELIVERY_CHARGE_RE_REQUESTED" : "DELIVERY_CHARGE_REQUESTED";
    const reasonText = re_request_reason === "address_change"
      ? "Address Changed"
      : re_request_reason === "client_revision"
      ? "Client Requested Changes"
      : "Re-estimate";

    job.history.push({
      action: actionName,
      step: job.step,
      remarks: wasApproved
        ? `Delivery charge re-requested from Packing team due to ${reasonText}. Previous approval (₹${prevAmount}) moved to history.${re_request_notes ? ` Notes: ${re_request_notes}` : ""}`
        : `Delivery charge requested from Packing team for ${carrier} (${payer === "client" ? "Client pays" : "RD pays"})${notes ? ` - ${notes}` : ""}`,
      changed_by: {
        user_id: coordinatorUser.user_id,
        user_name: coordinatorUser.user_name,
        role: req.user?.role || "CS",
      },
      timestamp: now,
    });

    await job.save();

    return res.status(200).json({
      success: true,
      message: wasApproved
        ? `Delivery charge re-requested from Packing team (${reasonText})`
        : "Delivery charge estimation request sent to Packing team",
      data: job,
    });
  } catch (error) {
    console.error("Error in requestDeliveryCharge:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * getDeliveryChargeRequests
 * Fetches all delivery charge requests for the Packing team console
 */
export const getDeliveryChargeRequests = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 15);
    const skip = (page - 1) * limit;
    const statusParam = (req.query.status || "requested").toLowerCase();
    const search = (req.query.search || "").trim();

    // Base filter: Only jobs that have active or completed delivery charges
    const filter = {
      "delivery_charges.status": { $in: ["requested", "quoted", "client_approved", "rejected"] },
    };

    if (statusParam === "requested") {
      filter["delivery_charges.status"] = "requested";
    } else if (statusParam === "quoted") {
      filter["delivery_charges.status"] = { $in: ["quoted", "client_approved"] };
    }

    if (search) {
      const escaped = search.replace(/[/\-\\^$*+?.()|[\]{}]/g, "\\$&");
      const searchRegex = new RegExp(escaped, "i");

      let matchingCustIds = [];
      try {
        const matched = await customerModel.find({ name: searchRegex }, "_id").lean();
        matchingCustIds = (matched || []).map((c) => c._id);
      } catch {
        // ignore
      }

      const orConditions = [
        { enquiry_no: searchRegex },
        { contact_person: searchRegex },
        { coordinator_name: searchRegex },
        { "delivery_charges.carrier": searchRegex },
        { "delivery_charges.destination_city": searchRegex },
        { "delivery_charges.courier_partner": searchRegex },
        { "the_ask.product_name": searchRegex },
      ];
      if (matchingCustIds.length > 0) {
        orConditions.push({ customer_id: { $in: matchingCustIds } });
      }
      filter.$or = orConditions;
    }

    // Counts across all categories
    const [pendingCount, quotedCount, allCount] = await Promise.all([
      EnquiryJob.countDocuments({ "delivery_charges.status": "requested" }),
      EnquiryJob.countDocuments({ "delivery_charges.status": { $in: ["quoted", "client_approved"] } }),
      EnquiryJob.countDocuments({ "delivery_charges.status": { $in: ["requested", "quoted", "client_approved", "rejected"] } }),
    ]);

    const total = await EnquiryJob.countDocuments(filter);
    const jobs = await EnquiryJob.find(filter)
      .sort({ "delivery_charges.requested_at": -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("customer_id", "name contact_person mobile email phone")
      .lean();

    const formattedList = jobs.map((j) => {
      const cust = j.customer_id || {};
      const subJobs = (j.sub_jobs || []).filter((s) => !s.is_dropped && !s.is_lost);
      const itemsList =
        subJobs.length > 0
          ? subJobs.map((s) => ({
              sub_job_no: s.sub_job_no,
              product_name: s.theme || s.product_name || "Trophy",
              size: s.size || "8",
              quantity: s.quantity || 1,
            }))
          : [
              {
                sub_job_no: j.enquiry_no,
                product_name: j.the_ask?.theme || j.the_ask?.product_name || "Trophy",
                size: j.the_ask?.size || "8",
                quantity: j.the_ask?.quantity || 1,
              },
            ];

      const packConfig = j.wizard_state?.pack || {};
      const packagingSummary = [
        ...(packConfig.outer || []),
        ...(packConfig.protect || []),
        packConfig.mode || "",
      ]
        .filter(Boolean)
        .join(" · ");

      return {
        _id: j._id,
        enquiry_no: j.enquiry_no,
        seq: j.seq,
        stage: j.stage,
        client_name: cust.name || j.wizard_state?.client?.name || "Client",
        contact_person: j.contact_person || cust.contact_person || "",
        contact_mobile: j.contact_mobile || cust.mobile || cust.phone || "",
        coordinator_name: j.coordinator_name || "Client Servicing",
        needed_by_date: j.needed_by_date || j.the_ask?.needed_by_date || j.wizard_state?.e?.neededByDate || "",
        delivery_date: j.delivery_date || j.the_ask?.delivery_date || j.wizard_state?.leadDate || "",
        event_date: j.event_date || j.the_ask?.event_date || "",
        items: itemsList,
        total_quantity: itemsList.reduce((acc, it) => acc + Number(it.quantity || 0), 0),
        packaging_summary: packagingSummary || "Standard box",
        delivery_charges: j.delivery_charges || {},
      };
    });

    return res.status(200).json({
      success: true,
      data: formattedList,
      counts: {
        pending: pendingCount,
        quoted: quotedCount,
        all: allCount,
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error("Error in getDeliveryChargeRequests:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * submitDeliveryCharge
 * Packing team inputs the delivery/freight charge amount and partner details
 */
export const submitDeliveryCharge = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      amount,
      courier_partner = "",
      notes = "",
    } = req.body || {};

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount < 0) {
      return res.status(400).json({
        success: false,
        message: "A valid positive delivery charge amount is required",
      });
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

    const now = new Date();
    const packingUser = {
      user_id: req.user?._id || req.user?.id || null,
      user_name: req.user?.name || "Packing Team",
    };

    // 1. Update delivery_charges subdocument (Clear any previous approval state)
    job.delivery_charges = {
      ...(job.delivery_charges?.toObject ? job.delivery_charges.toObject() : job.delivery_charges || {}),
      status: "quoted",
      amount: numericAmount,
      courier_partner: courier_partner ? String(courier_partner).trim() : (job.delivery_charges?.courier_partner || ""),
      notes: notes ? String(notes).trim() : (job.delivery_charges?.notes || ""),
      quoted_at: now,
      quoted_by: packingUser,
      approved_at: null,
      approved_by: null,
      approval_method: null,
      approval_notes: null,
    };
    job.markModified("delivery_charges");

    // 2. Sync into wizard_state so DetailsStep & PackDelivery show the rate (strictly simulated / awaiting approval)
    const wizard_state = { ...(job.wizard_state || {}) };
    wizard_state.sampleChargesState = "simulated";
    wizard_state.sampleChargesAmount = numericAmount;
    wizard_state.sampleCourierPartner = courier_partner;
    wizard_state.sampleChargesNotes = notes;
    wizard_state.sampleApprovalMethod = null;
    wizard_state.sampleChargesDecision = null;
    wizard_state.deliv = {
      ...(wizard_state.deliv || {}),
      chargesState: "simulated",
      chargesAmount: numericAmount,
      courierPartner: courier_partner,
      chargesNotes: notes,
      approvalMethod: null,
    };
    job.wizard_state = wizard_state;
    job.markModified("wizard_state");

    // 3. Sync delivery_details
    const delivery_details = { ...(job.delivery_details || {}) };
    delivery_details.delivery_cost = numericAmount;
    delivery_details.charges_state = "quoted";
    delivery_details.charges_amount = numericAmount;
    delivery_details.courier_partner = courier_partner;
    job.delivery_details = delivery_details;
    job.markModified("delivery_details");

    // 4. Audit history
    job.history.push({
      action: "DELIVERY_CHARGE_QUOTED",
      step: job.step,
      remarks: `Delivery charge quoted by Packing team: ₹${numericAmount.toLocaleString("en-IN")} (${courier_partner || job.delivery_charges?.carrier || "Carrier"})${notes ? ` - ${notes}` : ""}`,
      changed_by: {
        user_id: packingUser.user_id,
        user_name: packingUser.user_name,
        role: req.user?.role || "Packing",
      },
      timestamp: now,
    });

    await job.save();

    return res.status(200).json({
      success: true,
      message: `Delivery charge of ₹${numericAmount.toLocaleString("en-IN")} recorded successfully`,
      data: job,
    });
  } catch (error) {
    console.error("Error in submitDeliveryCharge:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * approveDeliveryCharge
 * Client Servicing Coordinator logs/approves the delivery charge (e.g. after phone/WhatsApp with client)
 */
export const approveDeliveryCharge = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      approval_method = "WhatsApp",
      approval_notes = "",
      amount,
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
    const csUser = {
      user_id: req.user?._id || req.user?.id || null,
      user_name: req.user?.name || "Client Servicing",
      role: req.user?.role || "CS",
    };

    const finalAmount = amount !== undefined && !isNaN(Number(amount))
      ? Number(amount)
      : Number(job.delivery_charges?.amount || job.wizard_state?.sampleChargesAmount || 0);

    // 1. Update delivery_charges subdocument
    const dc = { ...(job.delivery_charges?.toObject ? job.delivery_charges.toObject() : job.delivery_charges || {}) };
    dc.status = "client_approved";
    dc.amount = finalAmount;
    dc.approved_at = now;
    dc.approved_by = csUser;
    dc.approval_method = approval_method;
    dc.approval_notes = approval_notes ? String(approval_notes).trim() : "";
    job.delivery_charges = dc;
    job.markModified("delivery_charges");

    // 2. Sync wizard_state
    const wizard_state = { ...(job.wizard_state || {}) };
    wizard_state.sampleChargesState = "approved";
    wizard_state.sampleChargesAmount = finalAmount;
    wizard_state.sampleApprovalMethod = approval_method;
    wizard_state.deliv = {
      ...(wizard_state.deliv || {}),
      chargesState: "approved",
      chargesAmount: finalAmount,
      approvalMethod: approval_method,
    };
    job.wizard_state = wizard_state;
    job.markModified("wizard_state");

    // 3. Sync delivery_details
    const delivery_details = { ...(job.delivery_details || {}) };
    delivery_details.delivery_cost = finalAmount;
    delivery_details.charges_state = "client_approved";
    delivery_details.charges_amount = finalAmount;
    job.delivery_details = delivery_details;
    job.markModified("delivery_details");

    // 4. Audit History
    job.history.push({
      action: "DELIVERY_CHARGE_APPROVED",
      step: job.step,
      remarks: `Delivery charge of ₹${finalAmount.toLocaleString("en-IN")} approved via ${approval_method} by ${csUser.user_name}${approval_notes ? ` - ${approval_notes}` : ""}`,
      changed_by: csUser,
      timestamp: now,
    });

    await job.save();

    return res.status(200).json({
      success: true,
      message: `Delivery charge approved via ${approval_method}`,
      data: job,
    });
  } catch (error) {
    console.error("Error in approveDeliveryCharge:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
