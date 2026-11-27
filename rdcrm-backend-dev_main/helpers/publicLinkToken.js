import crypto from "crypto";
import mongoose from "mongoose";
import EnquiryJob from "../models/enquiry/enquiryJobIntegrationModel.js";

const SECRET = process.env.JWT_SECRET || "rdcrm-public-link-salt";

/**
 * Generate HMAC-signed tokens for public client view & decision links.
 * Returns both a unified base64url token and backward-compatible exp/sig parameters.
 */
export const generatePublicToken = (jobId, durationHours = 24) => {
  const duration = Number(durationHours) || 24;
  const exp = Date.now() + duration * 60 * 60 * 1000;
  const cleanId = String(jobId || "").trim();
  const sig = crypto.createHmac("sha256", SECRET).update(`${cleanId}:${exp}`).digest("hex");
  const token = Buffer.from(JSON.stringify({ id: cleanId, exp, sig })).toString("base64url");
  const encodedExp = Buffer.from(String(exp)).toString("base64");

  return {
    token,
    exp: encodedExp,
    sig,
    expiryTimestamp: exp,
  };
};

/**
 * Verify HMAC security token for public review requests.
 * Rejects requests with missing, forged, or expired tokens.
 */
export const verifyPublicLink = (job, req) => {
  if (!job) {
    return { valid: false, status: 404, message: "Enquiry job not found." };
  }

  const token = req.query?.token || req.body?.token;
  const rawExp = req.query?.exp || req.body?.exp;
  const rawSig = req.query?.sig || req.body?.sig;

  let exp;
  let sig;
  let targetId = null;

  if (token) {
    try {
      const parsed = JSON.parse(Buffer.from(String(token).trim(), "base64url").toString("utf8"));
      targetId = parsed.id;
      exp = parseInt(parsed.exp, 10);
      sig = String(parsed.sig || "").trim();
    } catch {
      return { valid: false, status: 400, message: "Invalid security token format." };
    }
  } else if (rawExp && rawSig) {
    try {
      const decodedExp = Buffer.from(String(rawExp).trim(), "base64").toString("utf8");
      exp = parseInt(decodedExp, 10);
      sig = String(rawSig).trim();
    } catch {
      return { valid: false, status: 400, message: "Invalid expiry parameter format." };
    }
  } else {
    return {
      valid: false,
      status: 401,
      message: "Security signature is required to access this public link.",
    };
  }

  if (!exp || isNaN(exp) || Date.now() > exp) {
    return {
      valid: false,
      status: 403,
      message: "This review link has expired. Please contact your coordinator for a fresh link.",
    };
  }

  if (!sig) {
    return { valid: false, status: 403, message: "Missing security signature." };
  }

  const candidates = [
    String(job._id || ""),
    String(job.enquiry_no || ""),
    job.seq ? `RD${job.seq}` : "",
    targetId ? String(targetId) : "",
  ].filter(Boolean);

  const sigBuffer = Buffer.from(sig, "hex");
  if (sigBuffer.length !== 32) {
    return { valid: false, status: 403, message: "Invalid security signature length." };
  }

  const isMatched = candidates.some((cand) => {
    const expectedHex = crypto.createHmac("sha256", SECRET).update(`${cand}:${exp}`).digest("hex");
    const expectedBuffer = Buffer.from(expectedHex, "hex");
    return expectedBuffer.length === sigBuffer.length && crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  });

  if (!isMatched) {
    return { valid: false, status: 403, message: "Invalid or forged security signature." };
  }

  return { valid: true };
};

/**
 * Controller endpoint to securely generate signed public links for WhatsApp/Copy Link.
 */
export const getSignedPublicLink = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, docType, duration = 24, subjobs = "", tab = "", mode, phase } = req.query;
    const job = await EnquiryJob.findOne({
      $or: [
        ...(mongoose.Types.ObjectId.isValid(id) ? [{ _id: id }] : []),
        { enquiry_no: id },
        { enquiry_no: `RD${id}` },
        { seq: Number(id) || -1 },
      ],
    });
    if (!job) return res.status(404).json({ success: false, message: "Job not found" });

    const targetId = String(job._id);
    const { token, exp, sig, expiryTimestamp } = generatePublicToken(targetId, duration);
    const baseUrl = process.env.CLIENT_CONFIRMATION_SCREEN_URL || (req.headers.origin || "http://localhost:5173");

    const resolvedType = String(type || docType || "design").toLowerCase();
    const isPi = resolvedType === "pi" || resolvedType === "proforma";
    const isSampleProof = resolvedType === "sample_proof" || resolvedType === "sample-proof";
    const isDesign = resolvedType === "design";

    let route = "quote-view";
    if (isPi) route = "proforma-view";
    else if (isSampleProof) route = "sample-proof";
    else if (isDesign) route = "design-view";

    let link = `${baseUrl}/rd/${route}/${targetId}?token=${token}&exp=${exp}&sig=${sig}`;
    if (isSampleProof) {
      const sampleMode = mode || req.query?.mode || "sample";
      link += `&mode=${encodeURIComponent(sampleMode)}`;
    } else {
      if (resolvedType === "delivery" || tab === "delivery") link += "&tab=delivery";
      if (resolvedType === "sample" || tab === "sample") link += "&tab=sample";
      if (resolvedType === "proof" || tab === "proof") {
        link += "&tab=proof";
        if (phase) link += `&phase=${encodeURIComponent(phase)}`;
      }
      if (subjobs) link += `&subjobs=${encodeURIComponent(subjobs)}`;
    }

    return res.status(200).json({ success: true, link, url: link, token, exp, sig, expiryTimestamp });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

