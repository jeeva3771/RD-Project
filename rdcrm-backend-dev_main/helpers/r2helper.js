import { nanoid } from "nanoid";
import AWS from "aws-sdk";
import dotenv from "dotenv";
import { URL, fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env"), quiet: true });

const r2 = new AWS.S3({
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  region: "auto",
  signatureVersion: "v4",
});

const BUCKET_NAME = process.env.BUCKET_NAME || "test";

export const uploadToR2 = async (foldername = "uploads", fileBuffer, originalName, mimetype) => {
    const fileKey = `${foldername}/${nanoid(16)}---${originalName}`;

  const params = {
    Bucket: BUCKET_NAME,
    Key: fileKey,
    Body: fileBuffer,
    ContentType: mimetype,
    // ACL: 'public-read', // R2 ignores this, so you can remove
  };

  await r2.putObject(params).promise();

  const publicUrl = `https://${BUCKET_NAME}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${fileKey}`;
  return publicUrl;
};

export const deleteFromR2 = async (fileUrl) => {
  const key = decodeURIComponent(new URL(fileUrl).pathname.substring(1));
  await r2
    .deleteObject({
      Bucket: BUCKET_NAME,
      Key: key,
    })
    .promise();
};

export const downloadFromR2 = async (fileUrl) => {
  if (!fileUrl) return null;
  let key = fileUrl;
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    try {
      const u = new URL(fileUrl);
      key = decodeURIComponent(u.pathname.substring(1));
    // eslint-disable-next-line no-unused-vars
    } catch (e) {
      key = fileUrl;
    }
  } else if (key.startsWith('/')) {
    key = key.substring(1);
  }

  // Strip bucket name prefix if included in pathname
  if (BUCKET_NAME && key.startsWith(BUCKET_NAME + '/')) {
    key = key.substring(BUCKET_NAME.length + 1);
  }

  const data = await r2
    .getObject({
      Bucket: BUCKET_NAME,
      Key: key,
    })
    .promise();

  return data.Body;
};

export const generateSignedUrl = (fileUrl, expiresInSeconds = 86400, forceDownload = false, customFilename = null) => {  //24 hours
  if (!fileUrl) return '';
  if (typeof fileUrl !== 'string') return '';
  if (fileUrl.startsWith('blob:') || fileUrl.startsWith('data:')) return fileUrl;

  let key = fileUrl;
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    // If it's an external web URL not hosted on Cloudflare R2, return as-is
    if (!fileUrl.includes("r2.cloudflarestorage.com")) {
      return fileUrl;
    }
    try {
      const u = new URL(fileUrl);
      key = decodeURIComponent(u.pathname.substring(1));
    // eslint-disable-next-line no-unused-vars
    } catch (e) {
      key = fileUrl;
    }
  } else if (key.startsWith('/')) {
    key = key.substring(1);
  }

  // Strip bucket name prefix if included in pathname
  if (BUCKET_NAME && key.startsWith(BUCKET_NAME + '/')) {
    key = key.substring(BUCKET_NAME.length + 1);
  }
  if (key.startsWith('rd-custom-awards/')) {
    key = key.substring('rd-custom-awards/'.length);
  }

  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Expires: expiresInSeconds,
  };

  if (forceDownload) {
    let filename = customFilename || key.split("/").pop() || "document.pdf";
    if (filename.includes("---")) {
      filename = filename.split("---")[1];
    }
    filename = filename.replace(/["\r\n]/g, "");
    params.ResponseContentDisposition = `attachment; filename="${filename}"`;
  }

  try {
    const signedUrl = r2.getSignedUrl("getObject", params);
    return signedUrl;
  } catch (err) {
    console.error("Error signing R2 URL for key:", key, err?.message || err);
    return fileUrl;
  }
};

/**
 * Safely signs a Cloudflare R2 URL with standard fallback.
 * If the URL is already signed or not an R2 URL, handles appropriately without breaking.
 */
export const signSafe = (url, expiresInSeconds = 7 * 86400) => {
  if (!url || typeof url !== "string") return null;
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;
  // If it's an external web URL not hosted on Cloudflare R2, return as-is
  if (url.startsWith("http://") || url.startsWith("https://")) {
    if (!url.includes("r2.cloudflarestorage.com")) {
      return url;
    }
  }
  try {
    const signed = generateSignedUrl(url, expiresInSeconds);
    return signed || url;
  } catch (err) {
    console.warn("Error signing R2 URL in signSafe:", err?.message || err);
    return url;
  }
};

/**
 * Signs an uploadedDesigns object map: { "0-0": url, "0-1": url, ... }
 * Returns a new object with fresh signed URLs.
 */
export const signUploadedDesigns = (uploadedDesigns, expiresInSeconds = 86400) => {
  if (!uploadedDesigns || typeof uploadedDesigns !== "object") return uploadedDesigns;
  const signed = {};
  for (const [key, val] of Object.entries(uploadedDesigns)) {
    if (!val) continue;
    if (typeof val === "string") {
      signed[key] = generateSignedUrl(val, expiresInSeconds) || val;
    } else if (typeof val === "object") {
      const rawUrl = val.signed_url || val.file_url || val.url;
      if (rawUrl && typeof rawUrl === "string") {
        signed[key] = generateSignedUrl(rawUrl, expiresInSeconds) || rawUrl;
      } else {
        signed[key] = val;
      }
    } else {
      signed[key] = val;
    }
  }
  return signed;
};

/**
 * Deeply attaches fresh signed URLs to all designs in an EnquiryJob's wizard_state.
 */
export const signJobWizardDesigns = (job, expiresInSeconds = 86400) => {
  if (!job) return job;
  if (job.wizard_state && typeof job.wizard_state === "object") {
    if (job.wizard_state.uploadedDesigns) {
      job.wizard_state.uploadedDesigns = signUploadedDesigns(job.wizard_state.uploadedDesigns, expiresInSeconds);
    }
    if (job.wizard_state.watermarkedDesigns) {
      job.wizard_state.watermarkedDesigns = signUploadedDesigns(job.wizard_state.watermarkedDesigns, expiresInSeconds);
    }
    if (job.wizard_state.s && typeof job.wizard_state.s === "object" && job.wizard_state.s.uploadedDesigns) {
      job.wizard_state.s.uploadedDesigns = signUploadedDesigns(job.wizard_state.s.uploadedDesigns, expiresInSeconds);
    }
  }
  return job;
};

/**
 * Checks whether a given string URL/path is a renderable web image
 * (strictly rejects non-image formats like .cdr, .pdf, .ai, .eps, etc.)
 */
export const isWebImage = (url) => {
  if (!url || typeof url !== "string") return false;
  const cleanUrl = url.split("?")[0].toLowerCase().trim();
  if (!cleanUrl) return false;
  // Non-image files that should NEVER be rendered in <img> tags
  if (/\.(cdr|pdf|ai|eps|psd|zip|rar|dxf|dwg|plt|txt|doc|docx|xls|xlsx)$/i.test(cleanUrl)) {
    return false;
  }
  // Data URLs or blob URLs for images
  if (url.startsWith("data:image/") || url.startsWith("blob:")) return true;
  // Common image extensions
  if (/\.(png|jpe?g|webp|svg|gif|avif|bmp|ico)$/i.test(cleanUrl)) return true;
  // If it's a URL and has no document extension, allow if not a known non-image
  return !/\.(cdr|pdf|ai|eps|psd)$/i.test(cleanUrl);
};

/**
 * Robust resolver for the approved design preview image of a sub-job.
 * Traverses:
 * 1. sj.approved_design_url / sj.approved_designs
 * 2. job.wizard_state.uploadedDesigns / watermarkedDesigns (by group letter & approved option index)
 * 3. sj.design_files (Option designs)
 * 4. job-level uploadedDesigns
 * 5. sj.designer_files (strictly filtered to valid web images only, skipping .cdr/.pdf)
 * 6. sj.ref_files
 * 7. job.the_brief.client_logo
 */
export const resolveApprovedSubJobDesignImage = (job, sj = {}, idx = 0) => {
  if (!job) return "";

  // 1. Direct approved design on sub-job
  if (isWebImage(sj?.approved_design_url)) return sj.approved_design_url;
  if (Array.isArray(sj?.approved_designs)) {
    const valid = sj.approved_designs.find(isWebImage);
    if (valid) return valid;
  }

  // 2. Resolve from wizard_state
  const ws = job.wizard_state || {};
  const wsS = ws.s || {};
  const uploadedDesigns = { ...(wsS.uploadedDesigns || {}), ...(ws.uploadedDesigns || {}) };
  const watermarkedDesigns = { ...(wsS.watermarkedDesigns || {}), ...(ws.watermarkedDesigns || {}) };
  const productFeedback = ws.productFeedback || wsS.productFeedback || job.productFeedback || {};

  // Group index (0 for Group A, 1 for Group B, etc.)
  let gIdx = idx;
  const sjNo = sj?.sub_job_no || "";
  const m = sjNo ? String(sjNo).match(/[-_]?([A-Za-z])(\d+)?$/) : null;
  if (m && m[1]) {
    const parsed = m[1].toUpperCase().charCodeAt(0) - 65;
    if (!isNaN(parsed) && parsed >= 0) gIdx = parsed;
  } else if (sj?.design_group) {
    const parsed = String(sj.design_group).trim().toUpperCase().charCodeAt(0) - 65;
    if (!isNaN(parsed) && parsed >= 0) gIdx = parsed;
  }

  // Approved option index (0, 1, ...)
  const fb = productFeedback[gIdx] || productFeedback[String(gIdx)] || sj?.product_feedback;
  const fbArr = Array.isArray(fb) ? fb : (fb ? [fb] : []);
  const appFb = fbArr.find((f) => f && f.mode === "approve");
  const appOpt = appFb?.optIdxs?.[0] ?? appFb?.optIdx ?? sj?.approved_design_option ?? 0;

  // Try candidate keys in uploadedDesigns and watermarkedDesigns
  const candidateKeys = [
    `${gIdx}-${appOpt}`,
    `${gIdx}-0`,
    `${idx}-${appOpt}`,
    `${idx}-0`,
  ];
  for (const k of candidateKeys) {
    if (isWebImage(uploadedDesigns[k])) return uploadedDesigns[k];
    if (isWebImage(watermarkedDesigns[k])) return watermarkedDesigns[k];
  }

  // Group prefix match in uploadedDesigns
  const groupUpKey = Object.keys(uploadedDesigns).find(
    (k) => (k.startsWith(`${gIdx}-`) || k.startsWith(`${idx}-`)) && isWebImage(uploadedDesigns[k])
  );
  if (groupUpKey) return uploadedDesigns[groupUpKey];

  const groupWmKey = Object.keys(watermarkedDesigns).find(
    (k) => (k.startsWith(`${gIdx}-`) || k.startsWith(`${idx}-`)) && isWebImage(watermarkedDesigns[k])
  );
  if (groupWmKey) return watermarkedDesigns[groupWmKey];

  // 3. Check sj.design_files (Option uploads)
  if (Array.isArray(sj?.design_files) && sj.design_files.length > 0) {
    const optObj = sj.design_files[appOpt] || sj.design_files[0];
    const optUrl = typeof optObj === "string" ? optObj : (optObj?.file_url || optObj?.url || optObj?.signed_url || "");
    if (isWebImage(optUrl)) return optUrl;

    const anyValid = sj.design_files
      .map((f) => (typeof f === "string" ? f : f?.file_url || f?.url || f?.signed_url))
      .find(isWebImage);
    if (anyValid) return anyValid;
  }

  // 4. Any uploaded design across the whole job
  const anyUpload = Object.values(uploadedDesigns).find(isWebImage);
  if (anyUpload) return anyUpload;

  const anyWm = Object.values(watermarkedDesigns).find(isWebImage);
  if (anyWm) return anyWm;

  // 5. Check sj.designer_files (ONLY valid web images, ignore .cdr/.pdf)
  if (Array.isArray(sj?.designer_files) && sj.designer_files.length > 0) {
    const imgFile = sj.designer_files
      .map((f) => (typeof f === "string" ? f : f?.file_url || f?.url || f?.signed_url))
      .find(isWebImage);
    if (imgFile) return imgFile;
  }

  // 6. Check sj.ref_files (ONLY valid web images)
  if (Array.isArray(sj?.ref_files) && sj.ref_files.length > 0) {
    const refImg = sj.ref_files
      .map((f) => (typeof f === "string" ? f : f?.file_url || f?.url || f?.signed_url))
      .find(isWebImage);
    if (refImg) return refImg;
  }

  // 7. Check job.the_brief?.client_logo
  if (Array.isArray(job?.the_brief?.client_logo) && job.the_brief.client_logo.length > 0) {
    const logo = job.the_brief.client_logo[0];
    const logoUrl = typeof logo === "string" ? logo : (logo?.url || logo?.file_url || "");
    if (isWebImage(logoUrl)) return logoUrl;
  }

  return "";
};
