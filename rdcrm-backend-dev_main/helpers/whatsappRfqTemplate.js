/**
 * Generates the free-text WhatsApp message for RFQ sharing.
 * This can be used for client-side sharing via wa.me links.
 * 
 * @param {object} rfq - The RFQ details
 * @param {object} vendor - The vendor details
 * @param {string} quoteLink - The unique quote link
 * @returns {string} The formatted text message
 */
export const generateWhatsAppRfqTextMessage = (rfq, vendor, quoteLink) => {
  const expiryTimestamp = Date.now() + (rfq.linksDuration || 48) * 60 * 60 * 1000;
  const expiryDateFormatted = new Date(expiryTimestamp).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const deliveryDateFormatted = rfq.deliveryDate && !isNaN(new Date(rfq.deliveryDate))
    ? new Date(rfq.deliveryDate).toLocaleDateString("en-GB")
    : "TBD";

  const remarksSection = rfq.remarks ? `*Remarks:* ${rfq.remarks}` : "";

  return `*Request for Quotation — RD Custom Awards*

Hello *${vendor.name || "Vendor"}*,

We have sent you a Request for Quotation (RFQ) for the following item:

*Item Name:* ${rfq.name || "N/A"}
*Quantity:* ${rfq.qty || "0"} nos
*Specifications:* ${rfq.specs || "N/A"}
*Deliver By:* ${deliveryDateFormatted}

${remarksSection}

Please click the link below to submit your quotation:
${quoteLink}

🔒 *This quote link will expire on:* ${expiryDateFormatted}

Thank you,
RD Custom Awards Team`;
};

/**
 * Generates the Meta WhatsApp Cloud API template payload for RFQ.
 * 
 * @param {object} rfq - The RFQ details
 * @param {object} vendor - The vendor details
 * @param {string} phone - The recipient's phone number
 * @param {string} suffixLink - The suffix parameter (rfqId/vendorToken)
 * @returns {object} The Meta API payload
 */
export const generateMetaRfqTemplatePayload = (rfq, vendor, phone, suffixLink) => {
  const templateName = process.env.WHATSAPP_RFQ_TEMPLATE_NAME || "rfq_vendor_invite";
  const languageCode = process.env.WHATSAPP_LANGUAGE_CODE || "en_US";

  const expiryTimestamp = Date.now() + (rfq.linksDuration || 48) * 60 * 60 * 1000;
  const expiryDateFormatted = new Date(expiryTimestamp).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const deliveryDateFormatted = rfq.deliveryDate && !isNaN(new Date(rfq.deliveryDate))
    ? new Date(rfq.deliveryDate).toLocaleDateString("en-GB")
    : "TBD";

  const remarksParam = rfq.remarks ? `*Remarks:* ${rfq.remarks}` : " ";

  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: languageCode
      },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: vendor.name || "Vendor" },
            { type: "text", text: rfq.name || "N/A" },
            { type: "text", text: String(rfq.qty || 0) },
            { type: "text", text: rfq.specs || "N/A" },
            { type: "text", text: deliveryDateFormatted },
            { type: "text", text: remarksParam },
            { type: "text", text: expiryDateFormatted }
          ]
        },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [
            { type: "text", text: suffixLink }
          ]
        }
      ]
    }
  };
};

/**
 * Generates the free-text WhatsApp message for PO issuance notification.
 * 
 * @param {string} rfqName - Name of the RFQ item
 * @param {string} rfqUid - The RFQ UID
 * @param {object} award - The award details containing PO info
 * @returns {string} The formatted text message
 */
export const generateWhatsAppPOTextMessage = (rfqName, rfqUid, award) => {
  const { vendorName, qty, rate, deliverySchedule, poNumber } = award;
  const totalValue = (Number(rate) * Number(qty)).toLocaleString("en-IN");

  let scheduleText;
  const hasSplit = deliverySchedule && deliverySchedule.length > 1;
  if (hasSplit) {
    scheduleText = "*Delivery Schedule:*\n" + deliverySchedule.map((s, i) => {
      const dateStr = s.date
        ? (typeof s.date === 'string' ? s.date.split('T')[0] : new Date(s.date).toISOString().split('T')[0])
        : "TBD";
      const timeStr = s.time ? ` (${s.time})` : "";
      return `- Split ${i + 1}: ${s.qty} nos on ${dateStr}${timeStr}`;
    }).join("\n");
  } else if (deliverySchedule && deliverySchedule.length === 1) {
    const s = deliverySchedule[0];
    const dateStr = s.date
      ? (typeof s.date === 'string' ? s.date.split('T')[0] : new Date(s.date).toISOString().split('T')[0])
      : "TBD";
    const timeStr = s.time ? ` (${s.time})` : "";
    scheduleText = `*Deliver By:* ${dateStr}${timeStr}`;
  } else {
    scheduleText = "*Deliver By:* TBD";
  }

  return `*Purchase Order Issued — RD Custom Awards*

Dear *${vendorName || "Vendor"}*,

We are pleased to inform you that a Purchase Order has been officially issued to you.

*PO Details:*
• *PO Number:* ${poNumber || "N/A"}
• *PO Reference:* ${rfqUid || "N/A"}
• *Item:* ${rfqName || "N/A"}
• *Quantity:* ${qty || "0"} nos
• *Total Value:* Rs. ${totalValue}

${scheduleText}

Please acknowledge receipt of this PO and confirm your delivery commitment.

Thank you,
RD Custom Awards Team`;
};

/**
 * Generates the Meta WhatsApp Cloud API template payload for PO issuance.
 * 
 * @param {string} rfqName - Name of the RFQ item
 * @param {string} rfqUid - The RFQ UID
 * @param {object} award - The award details containing PO info
 * @param {string} phone - Recipient's phone number
 * @param {string} suffixLink - The suffix parameter for vendor portal link
 * @returns {object} The Meta API payload
 */
export const generateMetaPOTemplatePayload = (rfqName, rfqUid, award, phone, suffixLink) => {
  const templateName = process.env.WHATSAPP_PO_TEMPLATE_NAME || "purchase_order_issued";
  const languageCode = process.env.WHATSAPP_LANGUAGE_CODE || "en_US";

  const { vendorName, qty, rate, deliverySchedule, poNumber } = award;
  const totalValue = (Number(rate) * Number(qty)).toLocaleString("en-IN");

  let scheduleText;
  const hasSplit = deliverySchedule && deliverySchedule.length > 1;
  if (hasSplit) {
    scheduleText = "Delivery Schedule:\n" + deliverySchedule.map((s, i) => {
      const dateStr = s.date
        ? (typeof s.date === 'string' ? s.date.split('T')[0] : new Date(s.date).toISOString().split('T')[0])
        : "TBD";
      const timeStr = s.time ? ` (${s.time})` : "";
      return `- Split ${i + 1}: ${s.qty} nos on ${dateStr}${timeStr}`;
    }).join("\n");
  } else if (deliverySchedule && deliverySchedule.length === 1) {
    const s = deliverySchedule[0];
    const dateStr = s.date
      ? (typeof s.date === 'string' ? s.date.split('T')[0] : new Date(s.date).toISOString().split('T')[0])
      : "TBD";
    const timeStr = s.time ? ` (${s.time})` : "";
    scheduleText = `Deliver By: ${dateStr}${timeStr}`;
  } else {
    scheduleText = "Deliver By: TBD";
  }

  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: languageCode
      },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: vendorName || "Vendor" },
            { type: "text", text: poNumber || "N/A" },
            { type: "text", text: rfqUid || "N/A" },
            { type: "text", text: rfqName || "N/A" },
            { type: "text", text: String(qty || 0) },
            { type: "text", text: totalValue },
            { type: "text", text: scheduleText }
          ]
        },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [
            { type: "text", text: suffixLink }
          ]
        }
      ]
    }
  };
};

/**
 * Generates the free-text WhatsApp message for outsource assignment sharing.
 * 
 * @param {object} job - The master job details
 * @param {object} group - The material group details
 * @param {object} assignment - The outsource assignment details
 * @param {string} viewLink - The outsource confirmation link
 * @returns {string} The formatted text message
 */
export const generateWhatsAppOutsourceTextMessage = (job, group, assignment, viewLink) => {
  const deliveryDateFormatted = assignment.outsource_delivery_date && !isNaN(new Date(assignment.outsource_delivery_date))
    ? new Date(assignment.outsource_delivery_date).toLocaleDateString("en-GB")
    : assignment.outsource_delivery_date || "TBD";

  const jobNoStr = `${job.job_no || "N/A"}${job.sub_job_no ? `/${job.sub_job_no}` : ""}`;

  return `*Outsource Assignment Request — RD Custom Awards*

Hello *${assignment.vendor_name || "Vendor"}*,

We have sent you an outsource assignment request for the following job:

• *Job No:* ${jobNoStr}
• *Process:* ${job.process_name || "N/A"}
• *Material Group:* ${group.group_name || "N/A"}
• *Quantity:* ${assignment.outsource_qty || 0} pcs
• *Delivery Date:* ${deliveryDateFormatted}

Please click the link below to view the specifications and confirm/decline the assignment:
${viewLink}

🔒 *This link will expire in 48 hours.*

Thank you,
RD Custom Awards Team`;
};

/**
 * Generates the Meta WhatsApp Cloud API template payload for outsource assignment.
 * 
 * @param {object} job - The master job details
 * @param {object} group - The material group details
 * @param {object} assignment - The outsource assignment details
 * @param {string} phone - Recipient's phone number
 * @param {string} suffixLink - The suffix parameter (token)
 * @returns {object} The Meta API payload
 */
export const generateMetaOutsourceTemplatePayload = (job, group, assignment, phone, suffixLink) => {
  const templateName = process.env.WHATSAPP_OUTSOURCE_TEMPLATE_NAME || "outsource_vendor_invite";
  const languageCode = process.env.WHATSAPP_LANGUAGE_CODE || "en_US";

  const deliveryDateFormatted = assignment.outsource_delivery_date && !isNaN(new Date(assignment.outsource_delivery_date))
    ? new Date(assignment.outsource_delivery_date).toLocaleDateString("en-GB")
    : assignment.outsource_delivery_date || "TBD";

  const jobNoStr = `${job.job_no || "N/A"}${job.sub_job_no ? `/${job.sub_job_no}` : ""}`;

  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: languageCode
      },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: assignment.vendor_name || "Vendor" },
            { type: "text", text: jobNoStr },
            { type: "text", text: job.process_name || "N/A" },
            { type: "text", text: group.group_name || "N/A" },
            { type: "text", text: String(assignment.outsource_qty || 0) },
            { type: "text", text: deliveryDateFormatted }
          ]
        },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [
            { type: "text", text: suffixLink }
          ]
        }
      ]
    }
  };
};

