import nodemailer from "nodemailer";
import {
  getEnquiryDetailForImposedImage,
  getSignedImageUrl,
} from "../controllers/enquiry/enquiryController.js";

const btoa = (str) => Buffer.from(str).toString('base64');

const emailSender = process.env.EMAIL_SENDER;
const emailPassword = process.env.EMAIL_PASSWORD;

console.log("emailSender", emailSender);

export const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: emailSender,
    pass: emailPassword,
  },
  tls: {
    rejectUnauthorized: false,
  },
  authMethod: "PLAIN",
});

// Re-export user-based mail helpers from modular helper
export {
  isClientServicingRole,
  getUserTransporter,
  sendMailWithUser,
} from "./userMailTransporter.js";

const capitalizeFirst = (str) => {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const generateEmailTemplate = async (enquiry, expiresInSeconds) => {
  const expiryTimestamp =
    Date.now() + (enquiry.links_duration || 0) * 60 * 60 * 1000;

  const expiryDateFormatted = new Date(expiryTimestamp).toLocaleString(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  );

  const { needsWatermark, logoUrl, copyrightText, enquiryDetails } =
    await getEnquiryDetailForImposedImage(enquiry);

  const encodedExpiry = btoa(expiryTimestamp.toString());
  const link = `${process.env.CLIENT_CONFIRMATION_SCREEN_URL}/rd/clientconfirmation/${enquiry.id}?v=1&exp=${encodedExpiry}`;

  const imageListItems = await Promise.all(
    (enquiry.images || [])
      .filter((img) => img.url)
      .map(async (img, index) => {
        const signedUrl = await getSignedImageUrl({
          img,
          enquiry,
          expiresInSeconds,
          needsWatermark,
          logoUrl,
          copyrightText,
          enquiryDetails,
        });

        let statusColor = "#FFA500";
        let statusText = "Waiting for approval";

        if (img.is_accepted === true) {
          statusColor = "#28a745";
          statusText = "Accepted";
        } else if (img.is_accepted === false) {
          statusColor = "#dc3545";
          statusText = "Rejected";
        }

        const sizeDisplay =
          img.image_product_size && img.image_product_size.length > 0
            ? img.image_product_size
              .map((sizeObj) =>
                Object.entries(sizeObj)
                  .map(
                    ([key, value]) =>
                      `${key}: ${value || "N/A"} ${img.imageunit || ""}`
                  )
                  .join(" | ")
              )
              .join("<br/>")
            : "N/A";

        return `
          <tr style="background-color:${index % 2 === 0 ? "#ffffff" : "#f8f9fa"
          };">
            <td style="text-align:center; padding:12px; border-bottom:1px solid #e6e6e6; color:#333;">
              ${index + 1}
            </td>

            <td style="text-align:center; padding:12px; border-bottom:1px solid #e6e6e6;">
              <img 
                src="${signedUrl}" 
                alt="Design ${index + 1}" 
                style="max-width:130px; height:auto; border-radius:6px; border:1px solid #ddd;"
              />
            </td>

            <td style="text-align:center; padding:12px; border-bottom:1px solid #e6e6e6; color:#333;">
              ${sizeDisplay}
            </td>

            <td style="text-align:center; padding:12px; border-bottom:1px solid #e6e6e6; color:${statusColor}; font-weight:600;">
              ${statusText}
            </td>
          </tr>
        `;
      })
  );

  const imageList = imageListItems.join("");

  return `
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
              <td style="padding-top:25px; padding-right:30px;padding-left:30px; text-align:left;">
                  <div>
                    <img 
                      src="https://rdcustomawards.com/cdn/shop/files/logo.svg?v=1700546283&width=90" 
                      alt="RD Custom Awards Logo" 
                      style="max-width:170px; height:auto;"
                    />
                  </div>
                  <div style="font-size:16px; font-weight:600; color:#004aad;">
                    Job No: ${enquiry.job_no || "N/A"}
                  </div>
                </td>
              </tr>

              <!-- BODY CONTENT -->
              <tr>
                <td style="padding:25px 30px;">
                  <p style="font-size:16px; color:#333; margin:0 0 15px;">
                    Hello <strong>${capitalizeFirst(enquiry.name)}</strong>,
                  </p>

                  <p style="font-size:15px; line-height:1.6; color:#555; margin:0 0 25px;">
                    We’re excited to share the latest design options for your product 
                    <strong>${capitalizeFirst(enquiry.product_name) || "N/A"
    }</strong>.
                    Please review the details below and share your feedback.
                  </p>


                  <!-- REVIEW BUTTON -->
                  <p style="text-align:center; margin:20px 0 5px;">
                    <a 
                      href="${link}" 
                      style="display:inline-block; padding:12px 25px; background-color:#004aad; color:#ffffff; text-decoration:none; border-radius:6px; font-weight:600;"
                    >
                      Review Your Designs
                    </a>
                  </p>

                  <!-- EXPIRY MESSAGE (ADDED HERE) -->
                  <p style="text-align:center; font-size:13px; color:#777; margin:0 0 25px;">
                    🔒 This review link will expire on <strong>${expiryDateFormatted}</strong>
                  </p>

                  <!-- DESIGN TABLE -->
                  <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; font-size:14px; margin-bottom:25px;">
                    <thead>
                      <tr style="background-color:#004aad; color:#ffffff;">
                        <th style="padding:12px;">S.No</th>
                        <th style="padding:12px;">Design Preview</th>
                        <th style="padding:12px;">Size</th>
                        <th style="padding:12px;">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${imageList ||
    `<tr><td colspan="4" style="text-align:center; padding:20px; color:#777;">No designs available</td></tr>`
    }
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
                    © ${new Date().getFullYear()} RD Custom Awards. All rights reserved.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
};

export const generateEmailTemplateForPI = (sampleorder) => {
  const durationHours = sampleorder.links_duration ?? 24;
  const expiryTimestamp = Date.now() + durationHours * 60 * 60 * 1000;

  const expiryDateFormatted = new Date(expiryTimestamp).toLocaleString(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  );

  const encodedExpiry = btoa(expiryTimestamp.toString());
  const link = `${process.env.CLIENT_CONFIRMATION_SCREEN_URL}/rd/clientconfirmation/${sampleorder?.enquiry_id?.id}/${sampleorder?.id}?v=1&exp=${encodedExpiry}`;

  console.log("sampleorder", sampleorder);

  const jobNo = sampleorder?.job_no || "N/A";
  const subjobNo = sampleorder?.sub_job_no || "N/A";
  const customerName = capitalizeFirst(sampleorder?.client_name) || "Customer";
  const productName = capitalizeFirst(sampleorder?.product_name) || "N/A";
  const piFiles = sampleorder?.Pi_files || [];
  const lastPiFile = piFiles.length > 0 ? piFiles[piFiles.length - 1] : "#";

  return `
  <html>
    <body style="font-family: Arial, sans-serif; background-color:#f4f6f8; margin:0; padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color:#fff; border-radius:10px; overflow:hidden; box-shadow:0 2px 10px rgba(0,0,0,0.1);">
              
              <!-- Header -->
              <tr>
                <td style="background-color:#004aad; color:#fff; padding:20px; text-align:center; font-size:20px; font-weight:bold;">
                  Proforma Invoice Update
                </td>
              </tr>

               <!-- REVIEW BUTTON -->
                  <p style="text-align:center; margin:20px 0 5px;">
                    <a 
                      href="${link}" 
                      style="display:inline-block; padding:12px 25px; background-color:#004aad; color:#ffffff; text-decoration:none; border-radius:6px; font-weight:600;"
                    >
                      Review Your Files
                    </a>
                  </p>

                  <!-- EXPIRY MESSAGE (ADDED HERE) -->
                  <p style="text-align:center; font-size:13px; color:#777; margin:0 0;">
                    🔒 This review link will expire on <strong>${expiryDateFormatted}</strong>
                  </p>

              <!-- Body -->
              <tr>
                <td style="padding:30px; color:#333;">
                  <p>Dear <strong>${customerName}</strong>,</p>
                  <p>We are pleased to share the details of your product:</p>

                  <table cellpadding="5" cellspacing="0" width="100%" style="border-collapse:collapse; margin:15px 0;">
                    <tr>
                      <td style="font-weight:bold; width:150px;">Job No:</td>
                      <td>${jobNo}</td>
                    </tr>
                    <tr>
                      <td style="font-weight:bold;">Sub Job No:</td>
                      <td>${subjobNo}</td>
                    </tr>
                    <tr>
                      <td style="font-weight:bold;">Product Name:</td>
                      <td>${productName}</td>
                    </tr>
                    <tr>
                      <td style="font-weight:bold;">PI Link:</td>
                      <td><a href="${lastPiFile}" target="_blank">View PI</a></td>
                    </tr>
                  </table>

                  <p>Please review your Proforma Invoice and let us know if you have any questions or feedback.</p>

                  <p>Thank you for choosing <strong>RD Custom Awards</strong>.</p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color:#f8f9fa; color:#777; text-align:center; padding:15px; font-size:12px;">
                  © ${new Date().getFullYear()} RD Custom Awards. All rights reserved.
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
};

export const generateEmailTemplateForQuoatation = (sampleorder) => {
  const durationHours = sampleorder.links_duration ?? 24;
  const expiryTimestamp = Date.now() + durationHours * 60 * 60 * 1000;

  const expiryDateFormatted = new Date(expiryTimestamp).toLocaleString(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  );

  const encodedExpiry = btoa(expiryTimestamp.toString());
  const link = `${process.env.CLIENT_CONFIRMATION_SCREEN_URL}/rd/clientconfirmation/${sampleorder?.enquiry_id?.id}/${sampleorder?.id}?v=1&exp=${encodedExpiry}`;

  // console.log("sampleorder",sampleorder)

  const jobNo = sampleorder?.job_no || "N/A";
  const subjobNo = sampleorder?.sub_job_no || "N/A";
  const customerName = capitalizeFirst(sampleorder?.client_name) || "Customer";
  const productName = capitalizeFirst(sampleorder?.product_name) || "N/A";
  const quatation_files = sampleorder?.quatation_files || [];
  const lastQuotationFile =
    quatation_files.length > 0
      ? quatation_files[quatation_files.length - 1]
      : "#";

  return `
  <html>
    <body style="font-family: Arial, sans-serif; background-color:#f4f6f8; margin:0; padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color:#fff; border-radius:10px; overflow:hidden; box-shadow:0 2px 10px rgba(0,0,0,0.1);">
              
              <!-- Header -->
              <tr>
                <td style="background-color:#004aad; color:#fff; padding:20px; text-align:center; font-size:20px; font-weight:bold;">
                  Quotation Update
                </td>
              </tr>


              
                  <!-- REVIEW BUTTON -->
                  <p style="text-align:center; margin:20px 0 5px;">
                    <a 
                      href="${link}" 
                      style="display:inline-block; padding:12px 25px; background-color:#004aad; color:#ffffff; text-decoration:none; border-radius:6px; font-weight:600;"
                    >
                      Review Your Files
                    </a>
                  </p>

                  <!-- EXPIRY MESSAGE (ADDED HERE) -->
                  <p style="text-align:center; font-size:13px; color:#777; margin:0 0;">
                    🔒 This review link will expire on <strong>${expiryDateFormatted}</strong>
                  </p>


              <!-- Body -->
              <tr>
                <td style="padding:30px; color:#333;">
                  <p>Dear <strong>${customerName}</strong>,</p>
                  <p>We are pleased to share the details of your product:</p>

                  <table cellpadding="5" cellspacing="0" width="100%" style="border-collapse:collapse; margin:15px 0;">
                    <tr>
                      <td style="font-weight:bold; width:150px;">Job No:</td>
                      <td>${jobNo}</td>
                    </tr>
                    <tr>
                      <td style="font-weight:bold;">Sub Job No:</td>
                      <td>${subjobNo}</td>
                    </tr>
                    <tr>
                      <td style="font-weight:bold;">Product Name:</td>
                      <td>${productName}</td>
                    </tr>
                    <tr>
                      <td style="font-weight:bold;">Quotation Link:</td>
                      <td><a href="${lastQuotationFile}" target="_blank">View Quotation</a></td>
                    </tr>
                  </table>

                  <p>Please review your Quotation and let us know if you have any questions or feedback.</p>

                  <p>Thank you for choosing <strong>RD Custom Awards</strong>.</p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color:#f8f9fa; color:#777; text-align:center; padding:15px; font-size:12px;">
                  © ${new Date().getFullYear()} RD Custom Awards. All rights reserved.
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
};

export const generateEmailTemplateForDtp = (sampleorder, dtpId, shareType) => {
  const durationHours = sampleorder.links_duration ?? 24;
  const expiryTimestamp = Date.now() + durationHours * 60 * 60 * 1000;

  const expiryDateFormatted = new Date(expiryTimestamp).toLocaleString(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  );

  const encodedExpiry = btoa(expiryTimestamp.toString());
  const baseUrl = process.env.CLIENT_CONFIRMATION_SCREEN_URL;
  const link = `${baseUrl}/rd/clientconfirmation/${sampleorder?.enquiry_id?.id}/${sampleorder?.id}/${dtpId}?v=1&exp=${encodedExpiry}`;

  const jobNo = sampleorder?.job_no || "N/A";
  const subjobNo = sampleorder?.sub_job_no || "N/A";
  const customerName = capitalizeFirst(sampleorder?.client_name) || "Customer";
  const productName = capitalizeFirst(sampleorder?.product_name) || "N/A";

  let title = "Product Update";
  let message = "We are pleased to share the details of your product:";

  if (shareType === "master") {
    title = "Master Template Update";
    message = "We are pleased to share the Master Template for your product:";
  } else if (shareType === "proofing") {
    title = "Content Proofing Update";
    message = "We are pleased to share the Content Proof for your product:";
  }

  return `
  <html>
    <body style="font-family: Arial, sans-serif; background-color:#f4f6f8; margin:0; padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color:#fff; border-radius:10px; overflow:hidden; box-shadow:0 2px 10px rgba(0,0,0,0.1);">
              
              <!-- Header -->
              <tr>
                <td style="background-color:#004aad; color:#fff; padding:20px; text-align:center; font-size:20px; font-weight:bold;">
                  ${title}
                </td>
              </tr>

              <!-- REVIEW BUTTON -->
              <p style="text-align:center; margin:20px 0 5px;">
                <a 
                  href="${link}" 
                  style="display:inline-block; padding:12px 25px; background-color:#004aad; color:#ffffff; text-decoration:none; border-radius:6px; font-weight:600;"
                >
                  Review Your Files
                </a>
              </p>

              <!-- EXPIRY MESSAGE -->
              <p style="text-align:center; font-size:13px; color:#777; margin:0 0;">
                🔒 This review link will expire on <strong>${expiryDateFormatted}</strong>
              </p>

              <!-- Body -->
              <tr>
                <td style="padding:30px; color:#333;">
                  <p>Dear <strong>${customerName}</strong>,</p>
                  <p>${message}</p>

                  <table cellpadding="5" cellspacing="0" width="100%" style="border-collapse:collapse; margin:15px 0;">
                    <tr>
                      <td style="font-weight:bold; width:150px;">Job No:</td>
                      <td>${jobNo}</td>
                    </tr>
                    <tr>
                      <td style="font-weight:bold;">Sub Job No:</td>
                      <td>${subjobNo}</td>
                    </tr>
                    <tr>
                      <td style="font-weight:bold;">Product Name:</td>
                      <td>${productName}</td>
                    </tr>
                  </table>

                  <p>Please review the files using the link above and let us know if you have any questions or feedback.</p>

                  <p>Thank you for choosing <strong>RD Custom Awards</strong>.</p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color:#f8f9fa; color:#777; text-align:center; padding:15px; font-size:12px;">
                  © ${new Date().getFullYear()} RD Custom Awards. All rights reserved.
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
};

export const generateEmailTemplateForRFQ = (rfq, vendor, quoteLink) => {
  const expiryTimestamp =
    Date.now() + (rfq.linksDuration || 48) * 60 * 60 * 1000;

  const expiryDateFormatted = new Date(expiryTimestamp).toLocaleString(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
      hour12: false,
    }
  );

  // quoteLink is already per-vendor (contains vendor's unique token) — no ?vname= needed
  const vendorLink = quoteLink;

  return `
  <html>
    <body style="font-family: Arial, sans-serif; background-color:#f4f6f8; margin:0; padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color:#fff; border-radius:10px; overflow:hidden; box-shadow:0 2px 10px rgba(0,0,0,0.1);">
              
              <!-- Header Logo -->
              <tr>
                <td align="center" style="padding: 20px 0 10px 0;">
                  <img 
                    src="https://rdcustomawards.com/cdn/shop/files/logo.svg?v=1700546283&width=170" 
                    alt="RD Custom Awards Logo" 
                    style="max-width:170px; height:auto; display: block;"
                  />
                </td>
              </tr>

              <!-- Header Title -->
              <tr>
                <td style="background-color:#004aad; color:#fff; padding:20px; text-align:center; font-size:20px; font-weight:bold;">
                  Request for Quotation - RD Custom Awards
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding:30px; color:#333;">
                  <p>Hello <strong>${vendor.name}</strong>,</p>
                  <p>RDCA Procurement has sent you a Request for Quotation.</p>

                  <table cellpadding="5" cellspacing="0" width="100%" style="border-collapse:collapse; margin:15px 0;">
                    <tr>
                      <td style="font-weight:bold; width:150px;">Item:</td>
                      <td>${rfq.name}</td>
                    </tr>
                    <tr>
                      <td style="font-weight:bold;">Qty:</td>
                      <td>${rfq.qty}</td>
                    </tr>
                    <tr>
                      <td style="font-weight:bold;">Specs:</td>
                      <td>${rfq.specs || "N/A"}</td>
                    </tr>
                    <tr>
                      <td style="font-weight:bold;">Deliver By:</td>
                      <td>${rfq.deliveryDate && !isNaN(new Date(rfq.deliveryDate))
      ? new Date(rfq.deliveryDate).toLocaleDateString(
        "en-GB"
      )
      : "TBD"
    }</td>
                    </tr>
                    ${rfq.remarks
      ? `
                    <tr>
                      <td style="font-weight:bold;">Remarks:</td>
                      <td style="background-color:#fffbeb; padding:8px; border-radius:6px; font-style:italic; border-left:3px solid #f59e0b;">${rfq.remarks}</td>
                    </tr>
                    `
      : ""
    }
                  </table>

                  <p style="text-align:center; margin:30px 0;">
                    <a 
                      href="${vendorLink}" 
                      style="display:inline-block; padding:15px 30px; background-color:#004aad; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:bold; font-size:16px;"
                    >
                      Submit Your Quote
                    </a>
                  </p>

                  <p style="text-align:center; font-size:13px; color:#777;">
                    🔒 This link will expire on: <strong>${expiryDateFormatted}</strong>
                  </p>

                  <p style="font-size:14px; margin-top:30px;">
                    Thank you for your attention. Please do not hesitate to contact us if you have any questions or require further assistance.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color:#f8f9fa; color:#777; text-align:center; padding:15px; font-size:12px;">
                  © ${new Date().getFullYear()} RD Custom Awards. All rights reserved.
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
};
export const generateEmailTemplateForPO = (
  rfqName,
  rfqUid,
  jobNo,
  subJobNo,
  award,
  rfqImage
) => {
  const {
    vendorName,
    qty,
    rate,
    deliverySchedule,
    poNumber,
  } = award;
  const totalValue = (Number(rate) * Number(qty)).toLocaleString("en-IN");
  const hasSplit = deliverySchedule && deliverySchedule.length > 1;

  const buildSplitRows = () => {
    if (!hasSplit) return "";
    return deliverySchedule
      .map((s, i) => {
        const dateStr = s.date
          ? (typeof s.date === 'string' ? s.date.split('T')[0] : new Date(s.date).toISOString().split('T')[0])
          : "TBD";
        const timeStr = s.time ? ` <span style="color:#64748b;font-size:10px;">(${s.time})</span>` : "";
        const dateTimeStr = dateStr + timeStr;

        const rowBg = i % 2 === 0 ? "#ffffff" : "#f8fafc";
        return (
          '<tr style="background:' +
          rowBg +
          '">' +
          '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#374151;">#' +
          (i + 1) +
          "</td>" +
          '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#374151;">' +
          dateTimeStr +
          "</td>" +
          '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#374151;text-align:right">' +
          s.qty +
          " nos</td>" +
          "</tr>"
        );
      })
      .join("");
  };

  const splitSection = hasSplit
    ? `<p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin:0 0 8px;">Delivery Schedule for ${poNumber}</p>` +
    '<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:20px;">' +
    '<thead><tr style="background:#f1f5f9;">' +
    '<th style="padding:8px 12px;font-size:10px;text-align:left;color:#64748b;text-transform:uppercase;">Split</th>' +
    '<th style="padding:8px 12px;font-size:10px;text-align:left;color:#64748b;text-transform:uppercase;">Date</th>' +
    '<th style="padding:8px 12px;font-size:10px;text-align:right;color:#64748b;text-transform:uppercase;">Qty</th>' +
    "</tr></thead>" +
    "<tbody>" +
    buildSplitRows() +
    "</tbody>" +
    "</table>"
    : "";

  return (
    '<html><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;"><tr><td align="center">' +
    '<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.1);">' +
    // Logo
    '<tr><td align="center" style="padding:20px 0 10px;">' +
    '<img src="https://rdcustomawards.com/cdn/shop/files/logo.svg?v=1700546283&width=170" alt="RDCA" style="max-width:160px;height:auto;display:block;" />' +
    "</td></tr>" +
    // Green header
    '<tr><td style="background:#16a34a;color:#fff;padding:18px 24px;text-align:center;">' +
    '<div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;opacity:.8;margin-bottom:4px;">Official Notification</div>' +
    '<div style="font-size:20px;font-weight:700;">Purchase Order Issued</div>' +
    "</td></tr>" +
    // Optional Image Preview
    (rfqImage
      ? '<tr><td align="center" style="padding:28px 28px 0;">' +
      '<a href="' +
      rfqImage +
      '" target="_blank" style="display:inline-block;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 2px 4px rgba(0,0,0,0.05);">' +
      '<img src="' +
      rfqImage +
      '" alt="Product Image" style="max-width:100%;height:auto;max-height:220px;display:block;" />' +
      "</a>" +
      '<div style="font-size:11px;color:#94a3b8;margin-top:6px;">Click image to view full size</div>' +
      "</td></tr>"
      : "") +
    // Body
    '<tr><td style="padding:28px 28px 20px;color:#1e293b;">' +
    '<p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Dear <strong>' +
    vendorName +
    "</strong>,</p>" +
    '<p style="font-size:14px;color:#475569;margin:0 0 20px;">You have been awarded a Purchase Order from RDCA Procurement. Details below:</p>' +
    // PO details table
    '<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:20px;">' +
    '<tr style="background:#f8fafc;"><td colspan="2" style="padding:10px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;border-bottom:1px solid #e2e8f0;">PO Reference &middot; ' +
    rfqUid +
    "</td></tr>" +
    // '<tr style="background:#f8fafc;"><td colspan="2" style="padding:10px 14px;font-size:10px;font-weight:700;letter-spacing:.08em;color:#64748b;border-bottom:1px solid #e2e8f0;">PO No. &middot; ' +
    // poNumber +
    // "</td></tr>" +
    '<tr><td style="padding:10px 14px;font-size:12px;color:#64748b;border-bottom:1px solid #f1f5f9;width:140px;">PO No.:</td><td style="padding:10px 14px;font-size:13px;font-weight:600;color:#0f172a;border-bottom:1px solid #f1f5f9;">' +
    poNumber +
    "</td></tr>" +
    '<tr><td style="padding:10px 14px;font-size:12px;color:#64748b;border-bottom:1px solid #f1f5f9;width:140px;">Item:</td><td style="padding:10px 14px;font-size:13px;font-weight:600;color:#0f172a;border-bottom:1px solid #f1f5f9;">' +
    rfqName +
    "</td></tr>" +
    // '<tr style="background:#f8fafc;"><td style="padding:10px 14px;font-size:12px;color:#64748b;border-bottom:1px solid #f1f5f9;">Job No:</td><td style="padding:10px 14px;font-size:13px;font-weight:600;color:#0f172a;border-bottom:1px solid #f1f5f9;">' + jobRef + '</td></tr>' +
    '<tr><td style="padding:10px 14px;font-size:12px;color:#64748b;border-bottom:1px solid #f1f5f9;">Quantity:</td><td style="padding:10px 14px;font-size:13px;font-weight:600;color:#0f172a;border-bottom:1px solid #f1f5f9;">' +
    qty +
    " nos</td></tr>" +
    (deliverySchedule && deliverySchedule.length === 1 ? (
      '<tr><td style="padding:10px 14px;font-size:12px;color:#64748b;border-bottom:1px solid #f1f5f9;">Deliver By:</td><td style="padding:10px 14px;font-size:13px;font-weight:700;color:#c2410c;border-bottom:1px solid #f1f5f9;">' +
      (deliverySchedule[0].date ? (typeof deliverySchedule[0].date === 'string' ? deliverySchedule[0].date.split('T')[0] : new Date(deliverySchedule[0].date).toISOString().split('T')[0]) : "TBD") +
      (deliverySchedule[0].time ? ` (${deliverySchedule[0].time})` : "") +
      "</td></tr>"
    ) : "") +
    '<tr style="background:#f8fafc;"><td style="padding:10px 14px;font-size:12px;color:#64748b;border-bottom:1px solid #f1f5f9;">Unit Rate:</td><td style="padding:10px 14px;font-size:13px;font-weight:700;color:#059669;border-bottom:1px solid #f1f5f9;">&#8377;' +
    Number(rate).toLocaleString("en-IN") +
    "</td></tr>" +
    // '<tr><td style="padding:10px 14px;font-size:12px;color:#64748b;border-bottom:1px solid #f1f5f9;">Tax:</td><td style="padding:10px 14px;font-size:13px;font-weight:600;color:#0f172a;border-bottom:1px solid #f1f5f9;">' + (tax || '18% GST') + '</td></tr>' +
    '<tr><td style="padding:12px 14px;font-size:12px;color:#64748b;background:#f0fdf4;">Total Value:</td><td style="padding:12px 14px;font-size:18px;font-weight:800;color:#16a34a;background:#f0fdf4;">&#8377;' +
    totalValue +
    "</td></tr>" +
    "</table>" +
    splitSection +
    '<p style="font-size:13px;color:#475569;margin:0 0 8px;">Please acknowledge receipt of this PO and confirm your delivery commitment at the earliest.</p>' +
    '<p style="font-size:13px;color:#475569;">Thank you for partnering with <strong>RD Custom Awards</strong>.</p>' +
    "</td></tr>" +
    // Footer
    '<tr><td style="background:#f8fafc;color:#94a3b8;text-align:center;padding:14px;font-size:11px;border-top:1px solid #e2e8f0;">' +
    "&copy; " +
    new Date().getFullYear() +
    " RD Custom Awards. All rights reserved." +
    "</td></tr>" +
    "</table></td></tr></table>" +
    "</body></html>"
  );
};

export const generateEmailTemplateForOutsource = (job, group, assignment, clientUrl) => {
  const viewLink = `${clientUrl}/outsource/confirmation/${assignment.token}`;

  return `
  <html>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; background-color:#f8fafc; margin:0; padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0; background-color:#f8fafc;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 25px rgba(15,23,42,0.08); border: 1px solid #e2e8f0;">
              
              <!-- Header Logo -->
              <tr>
                <td align="center" style="padding: 30px 0 20px 0;">
                  <img 
                    src="https://rdcustomawards.com/cdn/shop/files/logo.svg?v=1700546283&width=170" 
                    alt="RD Custom Awards" 
                    style="max-width:140px; height:auto; display: block;"
                  />
                </td>
              </tr>

              <!-- Header Title -->
              <tr>
                <td style="background: linear-gradient(135deg, #4f46e5 0%, #312e81 100%); color:#ffffff; padding:28px; text-align:center; font-size:22px; font-weight:800; letter-spacing:0.02em;">
                  Outsource Assignment Request
                </td>
              </tr>

              <!-- Body Content -->
              <tr>
                <td style="padding:40px 35px; color:#1e293b; line-height:1.6;">
                  <p style="font-size:16px; margin:0 0 16px;">Hello <strong>${assignment.vendor_name}</strong>,</p>
                  <p style="font-size:15px; color:#475569; margin:0 0 24px;">RD Custom Awards has issued an outsource assignment request to your company. Please click the button below to view the full specifications, quantities, and submit your response.</p>

                  <!-- Actions Container -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin:30px 0 25px 0;">
                    <tr>
                      <td align="center">
                        <a 
                          href="${viewLink}" 
                          style="display:inline-block; text-align:center; padding:16px 36px; background-color:#4f46e5; color:#ffffff; text-decoration:none; border-radius:12px; font-weight:700; font-size:15px; box-shadow:0 4px 12px rgba(79,70,229,0.25); letter-spacing:0.02em;"
                        >
                          View Request
                        </a>
                      </td>
                    </tr>
                  </table>

                  <p style="font-size:14px; color:#64748b; text-align:center; margin:0 0 16px;">
                    This link will expire in 48 hours. Please review the details and submit your response (Confirm/Decline) as soon as possible.
                  </p>

                  <p style="font-size:14px; color:#334155; border-top:1px solid #e2e8f0; padding-top:20px; margin-top:20px;">
                    Best Regards,<br/>
                    <strong>RD Custom Awards Team</strong>
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color:#f8fafc; color:#94a3b8; text-align:center; padding:20px; font-size:12px; border-top:1px solid #e2e8f0;">
                  © ${new Date().getFullYear()} RD Custom Awards. All rights reserved.<br/>
                  This is an automated notification. Please do not reply directly to this email.
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
};

export const generateEmailTemplateForSalesOrder = (salesOrder, orderType = "Production") => {
  const {
    job_no, sub_job_no, job_quantity, job_completion_datetime, product_name, product_size, sample_required, price_per_piece,
    client_name, contact_person, mobile_no, wp_number, email,
    billing_address_1, billing_address_2, billing_city, billing_state, billing_postal_code, billing_gst_no,
    packing_type, inner_packing_type, premium_packing_option, packing_instruction, packing_mode,
    delivery_date, delivery_type, delivery_mode, who_will_pay, courier_amount, add_in_invoice, delivery_address, multi_deliveries,
    payment, remarks, image
  } = salesOrder;

  const sizeDisplay = Array.isArray(product_size) && product_size.length > 0
    ? product_size.map(sz => Object.entries(sz).map(([k, v]) => `${k}: ${v || "N/A"}`).join(" | ")).join("<br/>")
    : "N/A";

  const isMulti = delivery_type?.toLowerCase().includes("multi");

  const renderMultiDeliveries = () => {
    if (!Array.isArray(multi_deliveries) || multi_deliveries.length === 0) return "";
    let html = `
      <div style="margin-top:15px; overflow-x:auto;">
        <table width="100%" cellpadding="6" cellspacing="0" style="border-collapse:collapse; font-size:13px; border:1px solid #e2e8f0;">
          <tr style="background:#f1f5f9;">
            <th style="border:1px solid #e2e8f0; text-align:left;">Point</th>
            <th style="border:1px solid #e2e8f0; text-align:left;">Contact</th>
            <th style="border:1px solid #e2e8f0; text-align:left;">Qty</th>
            <th style="border:1px solid #e2e8f0; text-align:left;">Mode</th>
            <th style="border:1px solid #e2e8f0; text-align:left;">Payer</th>
            <th style="border:1px solid #e2e8f0; text-align:left;">Location</th>
          </tr>
    `;
    multi_deliveries.forEach((md, i) => {
      let modeText = md.deliveryMode || "N/A";
      if ((md.deliveryMode === "Break" || md.deliveryMode === "Hand Delivery + Courier") && md.customDeliveryMode) {
        modeText += ` (${md.customDeliveryMode})`;
      }

      let payerText = md.whoWillPay || "N/A";
      if (md.whoWillPay === "RD Courier") {
        payerText += ` - ${md.courierAmount || "N/A"}`;
        if (md.addInInvoice) payerText += ` (Add to Invoice)`;
      }

      html += `
        <tr>
          <td style="border:1px solid #e2e8f0;">${i + 1}</td>
          <td style="border:1px solid #e2e8f0;">${md.contactName || "N/A"}<br/>${md.contactNumber || ""}</td>
          <td style="border:1px solid #e2e8f0;">${md.quantity || "N/A"}</td>
          <td style="border:1px solid #e2e8f0;">${modeText}</td>
          <td style="border:1px solid #e2e8f0;">${payerText}</td>
          <td style="border:1px solid #e2e8f0;">${md.deliveryLocation || "N/A"}</td>
        </tr>
      `;
    });
    html += `</table></div>`;
    return html;
  };

  let formattedJobCompletion = job_completion_datetime || "N/A";
  if (job_completion_datetime) {
    try {
      const d = new Date(job_completion_datetime);
      if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        let hours = d.getHours();
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        const strTime = String(hours).padStart(2, '0') + ':' + minutes + ' ' + ampm;
        formattedJobCompletion = `${yyyy}-${mm}-${dd} ${strTime}`;
      }
    } catch (e) { console.log(e); }
  }

  const formatVal = (val) => (val === "undefined" || val === null || val === undefined || val === "null") ? "" : String(val).trim();
  const bAdd1 = formatVal(billing_address_1);
  const bAdd2 = formatVal(billing_address_2);
  const bCity = formatVal(billing_city);
  const bState = formatVal(billing_state);
  const bZip = formatVal(billing_postal_code);

  let billingAddressHtml = bAdd1 || "N/A";
  if (bAdd2) billingAddressHtml += `<br/>${bAdd2}`;

  let cityStateZip = [bCity, bState, bZip].filter(Boolean).join(", ");
  if (cityStateZip) billingAddressHtml += `<br/>${cityStateZip}`;

  const isSample = orderType && orderType.toLowerCase().includes("sample");

  return `
  <html>
    <body style="font-family: Arial, sans-serif; background-color:#f4f6f8; margin:0; padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px 0;">
        <tr>
          <td align="center">
            <table width="700" cellpadding="0" cellspacing="0" style="background-color:#fff; border-radius:10px; overflow:hidden; box-shadow:0 2px 10px rgba(0,0,0,0.1);">
              
              <!-- LOGO & TITLE HEADER -->
              <tr>
                <td style="background-color:#004aad; padding:15px 30px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="left" valign="middle" width="25%">
                        <div style="background-color:#ffffff; padding:6px 10px; border-radius:4px; display:inline-block;">
                          <img 
                            src="https://rdcustomawards.com/cdn/shop/files/logo.svg?v=1700546283&width=90" 
                            alt="RD Custom Awards Logo" 
                            style="max-width:110px; height:auto; display:block;"
                          />
                        </div>
                      </td>
                      <td align="center" valign="middle" width="50%" style="color:#ffffff; font-size:22px; font-weight:bold; letter-spacing:0.5px;">
                        ${isSample ? "Sample" : "Production"} Order Summary
                      </td>
                      <td width="25%"></td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:30px; color:#333;">
                  
                  <!-- INTRO TEXT -->
                  <div style="margin-bottom: 25px; border-bottom: 1px solid #e2e8f0; padding-bottom: 20px;">
                    <h2 style="font-size:18px; color:#333; margin:0 0 8px;">${isSample ? "Sample" : "Production"} Order Confirmed 🎉</h2>
                    <p style="font-size:15px; color:#555; line-height:1.5; margin:0;">
                      Your ${isSample ? "Sample" : "Production"} Order has been successfully created. <br/>
                      Please review the finalized details for your order below.
                    </p>
                  </div>
                  
                  ${image ? `
                  <div style="text-align:center; margin-bottom: 25px;">
                    <img src="${image}" alt="Approved Product Image" style="max-width:300px; max-height:300px; border-radius:8px; border:1px solid #e2e8f0;" />
                    <p style="font-size:12px; color:#64748b; margin-top:8px;">Approved Product Image</p>
                  </div>
                  ` : ""}

                  <h3 style="color:#004aad; border-bottom:2px solid #e2e8f0; padding-bottom:5px; margin-top:0;">Job Details</h3>
                  <table cellpadding="4" cellspacing="0" width="100%" style="font-size:14px; margin-bottom:20px;">
                    <tr><td width="35%"><b>Job No:</b></td><td>${sub_job_no ? sub_job_no : job_no}</td></tr>
                    <tr><td><b>Job Quantity:</b></td><td>${job_quantity || "N/A"}</td></tr>
                    <tr><td><b>Job Completion Date:</b></td><td>${formattedJobCompletion}</td></tr>
                    <tr><td><b>Product Name:</b></td><td>${product_name || "N/A"}</td></tr>
                    <tr><td><b>Product Size:</b></td><td>${sizeDisplay}</td></tr>
                    ${isSample
      ? `<tr><td><b>Sample Price Per Piece:</b></td><td>₹ ${price_per_piece || "N/A"}</td></tr>`
      : `<tr><td><b>Sample Required:</b></td><td>${sample_required ? `Yes, Price per piece: ₹${price_per_piece || "N/A"}` : "No"}</td></tr>`
    }
                  </table>

                  <h3 style="color:#004aad; border-bottom:2px solid #e2e8f0; padding-bottom:5px;">Client Details</h3>
                  <table cellpadding="4" cellspacing="0" width="100%" style="font-size:14px; margin-bottom:20px;">
                    <tr><td width="35%"><b>Client Name:</b></td><td>${client_name || "N/A"}</td></tr>
                    <tr><td><b>Contact Person:</b></td><td>${contact_person || "N/A"}</td></tr>
                    <tr><td><b>Mobile Number:</b></td><td>${mobile_no || "N/A"}</td></tr>
                    <tr><td><b>WhatsApp Number:</b></td><td>${Array.isArray(wp_number) ? wp_number.join(", ") : (wp_number || "N/A")}</td></tr>
                    <tr><td><b>Email Address:</b></td><td>${Array.isArray(email) ? email.join(", ") : (email || "N/A")}</td></tr>
                    <tr><td valign="top"><b>Billing Address:</b></td><td>${billingAddressHtml}</td></tr>
                    ${(billing_gst_no && String(billing_gst_no).trim() !== "" && String(billing_gst_no) !== "undefined" && String(billing_gst_no) !== "null" && billing_gst_no !== "N/A") ? `<tr><td><b>GST Number:</b></td><td>${billing_gst_no}</td></tr>` : ""}
                  </table>

                  <h3 style="color:#004aad; border-bottom:2px solid #e2e8f0; padding-bottom:5px;">Packaging Details</h3>
                  <table cellpadding="4" cellspacing="0" width="100%" style="font-size:14px; margin-bottom:20px;">
                    <tr><td width="35%"><b>Packing Type:</b></td><td>${packing_type || "N/A"}</td></tr>
                    <tr><td><b>Inner Packing Type:</b></td><td>${inner_packing_type || "N/A"}</td></tr>
                    ${(premium_packing_option && premium_packing_option.trim() !== "" && premium_packing_option !== "N/A") ? `<tr><td><b>Premium Packing Option:</b></td><td>${premium_packing_option}</td></tr>` : ""}
                    ${(packing_instruction && packing_instruction.trim() !== "" && packing_instruction !== "N/A") ? `<tr><td><b>Packing Instructions:</b></td><td>${packing_instruction}</td></tr>` : ""}
                    <tr><td><b>Packing Mode:</b></td><td>${(packing_mode && packing_mode.toLowerCase() === "both") ? "Individual, Consolidated" : (packing_mode || "N/A")}</td></tr>
                  </table>

                  <h3 style="color:#004aad; border-bottom:2px solid #e2e8f0; padding-bottom:5px;">Delivery Details</h3>
                  <table cellpadding="4" cellspacing="0" width="100%" style="font-size:14px; margin-bottom:10px;">
                    <tr><td width="35%"><b>Delivery Date:</b></td><td>${delivery_date || "N/A"}</td></tr>
                    <tr><td><b>Delivery Type:</b></td><td>${delivery_type || "N/A"}</td></tr>
                    ${!isMulti ? `
                    <tr><td><b>Delivery Mode:</b></td><td>${delivery_mode || "N/A"}</td></tr>
                    ${delivery_mode && delivery_mode.toLowerCase().replace(/\s+/g, '') === 'clientpickup' ? "" : `
                    <tr><td><b>Who Will Pay:</b></td><td>${who_will_pay || "N/A"}</td></tr>
                    ${who_will_pay === "RD Courier" ? `
                    <tr><td><b>Courier Amount:</b></td><td>${courier_amount || "N/A"}</td></tr>
                    <tr><td><b>Add to Invoice:</b></td><td>${add_in_invoice ? "Yes" : "No"}</td></tr>
                    ` : ""}
                    `}
                    <tr><td valign="top"><b>Delivery Location:</b></td><td>${delivery_address || "N/A"}</td></tr>
                    ` : ""}
                  </table>
                  ${isMulti ? renderMultiDeliveries() : ""}

                  <h3 style="color:#004aad; border-bottom:2px solid #e2e8f0; padding-bottom:5px; margin-top:20px;">Payment & Remarks</h3>
                  <table cellpadding="4" cellspacing="0" width="100%" style="font-size:14px; margin-bottom:10px;">
                    <tr><td width="35%"><b>Payment Method:</b></td><td>${payment || "N/A"}</td></tr>
                    ${(remarks && remarks.trim() !== "" && remarks !== "N/A") ? `<tr><td><b>Remarks:</b></td><td>${remarks}</td></tr>` : ""}
                  </table>

                  <p style="margin-top:30px; font-size:14px; text-align:center;">
                    Thank you for choosing <strong>RD Custom Awards</strong>.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color:#f8f9fa; color:#777; text-align:center; padding:15px; font-size:12px;">
                  © ${new Date().getFullYear()} RD Custom Awards. All rights reserved.
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
};

export const generateEmailTemplateForSampleApproval = async (item, expiresInSeconds = 86400) => {
  const expiryTimestamp = Date.now() + expiresInSeconds * 1000;
  const expiryDateFormatted = new Date(expiryTimestamp).toLocaleString(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  );

  const encodedExpiry = btoa(expiryTimestamp.toString());
  const enquiryId = item.enquiry_id?.id || item.enquiry_id?._id || item.enquiry_id || "";
  const salesOrderId = item.sales_order_id?.id || item.sales_order_id?._id || item.sales_order_id || "";

  const link = enquiryId && salesOrderId
    ? `${process.env.CLIENT_CONFIRMATION_SCREEN_URL}/rd/clientconfirmation/${enquiryId}/${salesOrderId}/?v=1&exp=${encodedExpiry}`
    : `${process.env.CLIENT_CONFIRMATION_SCREEN_URL}/rd/clientconfirmation/${enquiryId || item.job_no}?v=1&exp=${encodedExpiry}`;

  const jobNo = item.job_no || "N/A";
  const subjobNo = item.sub_job_no || "N/A";
  const customerName = capitalizeFirst(item.client_name) || "Customer";
  const productName = capitalizeFirst(item.product_name) || "N/A";
  const sampleImg = item.final_sample_image || "";

  return `
  <html>
    <body style="font-family: Arial, sans-serif; background-color:#f4f6f8; margin:0; padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color:#fff; border-radius:10px; overflow:hidden; box-shadow:0 2px 10px rgba(0,0,0,0.1);">
              
              <!-- Header -->
              <tr>
                <td style="background-color:#004aad; color:#fff; padding:20px; text-align:center; font-size:20px; font-weight:bold;">
                  Sample Piece Review
                </td>
              </tr>

              <!-- REVIEW BUTTON -->
              <p style="text-align:center; margin:20px 0 5px;">
                <a 
                  href="${link}" 
                  style="display:inline-block; padding:12px 25px; background-color:#004aad; color:#ffffff; text-decoration:none; border-radius:6px; font-weight:600;"
                >
                  Review &amp; Approve Sample
                </a>
              </p>

              <!-- EXPIRY MESSAGE -->
              <p style="text-align:center; font-size:13px; color:#777; margin:0 0;">
                🔒 This review link will expire on <strong>${expiryDateFormatted}</strong>
              </p>

              <!-- Body -->
              <tr>
                <td style="padding:30px; color:#333;">
                  <p>Dear <strong>${customerName}</strong>,</p>
                  <p>We are pleased to share the details of your product:</p>

                  <table cellpadding="5" cellspacing="0" width="100%" style="border-collapse:collapse; margin:15px 0;">
                    <tr>
                      <td style="font-weight:bold; width:150px;">Job No:</td>
                      <td>${jobNo}</td>
                    </tr>
                    <tr>
                      <td style="font-weight:bold;">Sub Job No:</td>
                      <td>${subjobNo}</td>
                    </tr>
                    <tr>
                      <td style="font-weight:bold;">Product Name:</td>
                      <td>${productName}</td>
                    </tr>
                    ${sampleImg ? `
                    <tr>
                      <td style="font-weight:bold; vertical-align:top; padding-top:10px;">Sample Image:</td>
                      <td style="padding-top:10px;">
                        <img src="${sampleImg}" alt="Sample Piece" style="max-width:160px; max-height:160px; height:auto; border-radius:6px; border:1px solid #ddd; object-fit:contain;" />
                      </td>
                    </tr>
                    ` : ''}
                  </table>

                  <p>Please review your Sample Piece and let us know your confirmation so we can proceed with primary production.</p>

                  <p>Thank you for choosing <strong>RD Custom Awards</strong>.</p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color:#f8f9fa; color:#777; text-align:center; padding:15px; font-size:12px;">
                  © ${new Date().getFullYear()} RD Custom Awards. All rights reserved.
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
};

/**
 * Payment Reminder Email Template
 * Sends a professionally styled HTML notification with company branding,
 * outstanding amount highlight, optional pending invoice breakdown table,
 * company bank remittance details, and clear call-to-action.
 */
export const generatePaymentReminderEmailTemplate = ({
  clientName = "Customer",
  message = "",
  outstanding = 0,
  _total = 0,
  invoices = [],
  _bankDetails = null,
  senderName = "Accounts Department",
  companyName = "RD Custom Awards Pvt. Ltd.",
}) => {
  const logoUrl =
    process.env.LOGO_IMG_URL ||
    "https://rdcustomawards.com/cdn/shop/files/logo.svg?v=1700546283&width=90";
  const numOutstanding = Number(outstanding || 0);
  const formattedOutstanding = numOutstanding.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });

  const formattedMessage = message
    ? message
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map(
          (p) =>
            `<p style="margin: 0 0 12px; font-size: 14px; line-height: 1.6; color: #334155;">${p}</p>`
        )
        .join("")
    : `<p style="margin: 0 0 12px; font-size: 14px; line-height: 1.6; color: #334155;">This is a friendly reminder regarding the outstanding balance of <strong>₹ ${formattedOutstanding}</strong> on your account with <strong>${companyName}</strong>. Kindly arrange for payment at your earliest convenience.</p>`;

  const invoiceRows =
    Array.isArray(invoices) && invoices.length > 0
      ? invoices
          .map((inv, idx) => {
            const invNo =
              inv.invoiceNo ||
              inv.invoice_no ||
              inv.sub_job_no ||
              `INV-${idx + 1}`;
            const invAmt = Number(
              inv.amount || inv.grandTotal || inv.totalAmt || 0
            ).toLocaleString("en-IN", { minimumFractionDigits: 2 });
            const invBal = Number(
              inv.balance !== undefined
                ? inv.balance
                : inv.outstanding !== undefined
                ? inv.outstanding
                : inv.amount || 0
            ).toLocaleString("en-IN", { minimumFractionDigits: 2 });

            return `
            <tr style="background-color: ${idx % 2 === 0 ? "#ffffff" : "#f8fafc"};">
              <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #0f172a; font-family: monospace;">${invNo}</td>
              <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace; color: #475569;">₹ ${invAmt}</td>
              <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 800; font-family: monospace; color: #b45309;">₹ ${invBal}</td>
            </tr>
          `;
          })
          .join("")
      : "";

  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8">
      <title>Payment Reminder — ${companyName}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f1f5f9; padding: 30px 10px;">
        <tr>
          <td align="center">
            <table width="640" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); max-width: 640px; width: 100%; border-top: 4px solid #b45309;">
              
              <!-- Brand Header -->
              <tr>
                <td style="background-color: #ffffff; padding: 24px 32px 18px 32px; border-bottom: 1.5px solid #f1f5f9;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="left" style="vertical-align: middle;">
                        <img src="${logoUrl}" alt="${companyName}" style="height: 44px; width: auto; display: block;" />
                      </td>
                      <td align="right" style="vertical-align: middle;">
                        <span style="display: inline-block; background-color: #fffbeb; color: #92400e; font-size: 11px; font-weight: 800; padding: 6px 14px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px; border: 1.5px solid #fde68a;">
                          Payment Reminder
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Hero Callout -->
              <tr>
                <td style="padding: 28px 32px 16px 32px;">
                  <div style="background: linear-gradient(to right, #fffbeb, #fef3c7); border: 1px solid #fde68a; border-radius: 12px; padding: 20px 24px; text-align: center;">
                    <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #92400e; margin-bottom: 4px;">
                      Total Outstanding Balance
                    </div>
                    <div style="font-size: 28px; font-weight: 900; color: #b45309; font-family: monospace;">
                      ₹ ${formattedOutstanding}
                    </div>
                  </div>
                </td>
              </tr>

              <!-- Greeting & Custom Message -->
              <tr>
                <td style="padding: 8px 32px 20px 32px;">
                  <p style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 0 0 16px;">
                    Dear ${clientName},
                  </p>
                  ${formattedMessage}
                </td>
              </tr>

              <!-- Invoices Breakdown Table (if provided) -->
              ${
                invoiceRows
                  ? `
              <tr>
                <td style="padding: 0 32px 24px 32px;">
                  <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; margin-bottom: 8px;">
                    Pending Invoice Breakdown
                  </div>
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; font-size: 13px;">
                    <thead>
                      <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; text-align: left;">
                        <th style="padding: 10px 12px; color: #475569; font-weight: 700;">Invoice No</th>
                        <th style="padding: 10px 12px; color: #475569; font-weight: 700; text-align: right;">Total</th>
                        <th style="padding: 10px 12px; color: #475569; font-weight: 700; text-align: right;">Balance Due</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${invoiceRows}
                    </tbody>
                  </table>
                </td>
              </tr>
              `
                  : ""
              }

              <!-- Sign-off -->
              <tr>
                <td style="padding: 0 32px 28px 32px; font-size: 14px; color: #334155; line-height: 1.6;">
                  Warm regards,<br />
                  <strong style="color: #0f172a;">${senderName}</strong><br />
                  <span style="color: #64748b; font-size: 12px;">Accounts &amp; Collections Department</span><br />
                  <span style="color: #64748b; font-size: 12px;">${companyName}</span>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 32px; text-align: center;">
                  <p style="font-size: 11px; color: #94a3b8; margin: 0; line-height: 1.5;">
                    © ${new Date().getFullYear()} ${companyName}. All rights reserved.<br />
                    This is an automated communication generated from our Accounts Console.
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
};
