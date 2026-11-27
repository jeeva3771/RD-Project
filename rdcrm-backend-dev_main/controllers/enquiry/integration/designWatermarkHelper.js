import EnquiryJob from "../../../models/enquiry/enquiryJobIntegrationModel.js";
import { uploadToR2, generateSignedUrl } from "../../../helpers/r2helper.js";
import { addWatermarkToImage } from "../../../helpers/watermarkImage.js";

/**
 * Helper to ensure design images have RD Logo and/or Copyright Content
 * watermarked if enabled in the Brief settings.
 * Returns a map of client-facing image URLs (e.g. {"0-0": "url", "0-1": "url"}).
 */
export async function getEffectiveClientDesigns(job) {
  if (!job) return {};

  const uploadedDesigns = job.wizard_state?.uploadedDesigns || {};
  if (!uploadedDesigns || typeof uploadedDesigns !== "object" || Object.keys(uploadedDesigns).length === 0) {
    return {};
  }

  const theBrief = job.the_brief || {};
  const e = job.wizard_state?.e || {};

  // Check if logo or content should be shown
  const showLogo = theBrief.show_logo !== undefined
    ? theBrief.show_logo
    : (e.showRDLogo !== undefined ? e.showRDLogo : true);

  const showContent = theBrief.show_content !== undefined
    ? theBrief.show_content
    : Boolean(e.showRDContent || Object.values(e.productBriefs || {}).some((pb) => pb.showRDContent));

  // If neither is enabled, client sees the original clean designs
  if (!showLogo && !showContent) {
    const signedCleanDesigns = {};
    for (const [key, url] of Object.entries(uploadedDesigns)) {
      if (url && typeof url === "string") {
        signedCleanDesigns[key] = generateSignedUrl(url, 7 * 86400);
      }
    }
    return signedCleanDesigns;
  }

  const logoUrl = showLogo
    ? (process.env.LOGO_IMG_URL || "https://rdcustomawards.com/cdn/shop/files/logo.svg?v=1700546283&width=90")
    : null;
  const copyrightText = showContent
    ? (theBrief.copyright_content ||
        theBrief.content_text ||
        e.copyrightContent ||
        e.copyright_content ||
        Object.values(e.productBriefs || {}).find((pb) => pb.copyrightContent)?.copyrightContent ||
        "This artwork is the intellectual property of RD Custom Awards Pvt. Ltd., and all copyrights are held exclusively by RD Custom Awards Pvt. Ltd")
    : null;

  const currentWatermarked = { ...(job.wizard_state?.watermarkedDesigns || {}) };
  let hasNewWatermarks = false;

  const parentJobNo = job.enquiry_no || (job.seq ? `RD${job.seq}` : "RD");

  for (const [key, rawUrl] of Object.entries(uploadedDesigns)) {
    if (!rawUrl || typeof rawUrl !== "string") continue;

    // If already generated and valid, use cached watermarked version
    if (
      currentWatermarked[key] &&
      typeof currentWatermarked[key] === "string" &&
      !currentWatermarked[key].includes("undefined")
    ) {
      continue;
    }

    try {
      const [trophyIdx] = key.split("-").map(Number);
      const groupChar = String.fromCharCode(65 + (isNaN(trophyIdx) ? 0 : trophyIdx));
      const subJobCode = `${parentJobNo}-${groupChar}1`;

      const group = e.trophyGroups?.[trophyIdx] || {};
      const trophyTitle = group.productName || group.theme || job.the_ask?.product_name || "Custom Trophy";
      const size = group.items?.[0]?.size || job.sub_jobs?.[trophyIdx]?.size || job.the_ask?.size || "8 in";

      const enquiryDetails = {
        job_no: subJobCode,
        category: job.the_ask?.product_type || "Trophy",
        subcategory: trophyTitle,
        product_size: size ? `Size: ${size}` : "",
        designer_code: theBrief.designer_name || e.designer_name || "RD Design Team",
      };

      console.log(`Generating watermark for job ${parentJobNo} slot ${key}...`);

      const watermarkedBuffer = await addWatermarkToImage(rawUrl, logoUrl, copyrightText, enquiryDetails);

      const timestamp = Date.now();
      const filename = `watermarked_${parentJobNo}_${key}_${timestamp}.jpg`;
      const watermarkedUrl = await uploadToR2("designs/watermarked", watermarkedBuffer, filename, "image/jpeg");

      if (watermarkedUrl) {
        currentWatermarked[key] = watermarkedUrl;
        hasNewWatermarks = true;
        console.log(`Watermark generated for slot ${key}: ${watermarkedUrl}`);
      }
    } catch (wmErr) {
      console.error(`Error watermarking design slot ${key}:`, wmErr.message);
      // Fallback to original if watermarking fails
      currentWatermarked[key] = rawUrl;
    }
  }

  // Cache back to database if any new watermarks were created
  if (hasNewWatermarks && job._id) {
    try {
      await EnquiryJob.findByIdAndUpdate(job._id, {
        $set: {
          "wizard_state.watermarkedDesigns": currentWatermarked,
        },
      });
    } catch (dbErr) {
      console.warn("Could not cache watermarkedDesigns to DB:", dbErr.message);
    }
  }

  const clientFacingDesigns = {};
  for (const [key, url] of Object.entries(currentWatermarked)) {
    if (url && typeof url === "string") {
      clientFacingDesigns[key] = generateSignedUrl(url, 7 * 86400);
    }
  }

  return clientFacingDesigns;
}
