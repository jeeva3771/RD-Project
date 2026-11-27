import mongoose from "mongoose";
import { generateSignedUrl, signJobWizardDesigns } from "../../../helpers/r2helper.js";
import customerModel from "../../../models/masters/customerModel.js";
import userModel from "../../../models/users/userModel.js";
import EnquiryJob from "../../../models/enquiry/enquiryJobIntegrationModel.js";
import bomModel from "../../../models/bom/bomModel.js";
import { formatEnquiryNo } from "../../../config/enquiryConfig.js";
import { normalizeJobArtworkCharge } from "./costingQuotationHelpers.js";

// Generate sequential sub_job_no: e.g. parent "RD21072", groupIndex 0 -> A, sizeIndex 1 -> RD21072-A1
export const _formatSubJobNo = (parentNo, groupIndex = 0, sizeIndex = 1) => {
  const groupChar = String.fromCharCode(65 + groupIndex); // 0 -> A, 1 -> B, 2 -> C
  return `${parentNo}-${groupChar}${sizeIndex}`;
};

// Recursively sanitizes objects to prevent MongoServerError: Nested BSON depth greater than 50 not allowed
// Strips recursive frontend cache fields like rawJob / raw_job and caps depth to safe limit.
export const sanitizeDepth = (obj, currentDepth = 0, maxDepth = 10, seen = new WeakSet()) => {
  if (obj === null || typeof obj !== "object") return obj;
  if (currentDepth >= maxDepth || seen.has(obj)) return undefined;
  seen.add(obj);

  if (Array.isArray(obj)) {
    return obj
      .map((item) => sanitizeDepth(item, currentDepth + 1, maxDepth, seen))
      .filter((x) => x !== undefined);
  }

  const clean = {};
  for (const key of Object.keys(obj)) {
    if (key === "rawJob" || key === "raw_job") continue;
    const cleaned = sanitizeDepth(obj[key], currentDepth + 1, maxDepth, seen);
    if (cleaned !== undefined) {
      clean[key] = cleaned;
    }
  }
  return clean;
};

// Safely signs file URLs without throwing errors
export const safeSignFile = (f) => {
  if (!f) return f;
  try {
    if (typeof f === "string") {
      const s = generateSignedUrl(f) || f;
      return { file_url: f, signed_url: s, url: s };
    }
    if (typeof f === "object") {
      const rawUrl = f.file_url || f.url || f.signed_url;
      if (rawUrl && typeof rawUrl === "string") {
        const s = generateSignedUrl(rawUrl) || rawUrl;
        f.signed_url = s;
        f.url = s;
      }
    }
  } catch (e) {
    console.warn("safeSignFile error:", e);
  }
  return f;
};

// Calculates bucket counts, KPIs, week summary, and filters jobs based on bucket / day
export const computeJobBucketsAndKpis = (allJobs = [], queryBucket = "all", queryDay = null) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const TODAY = new Date();

  const bucketCounts = {
    all: 0,
    enquiry: 0,
    sdtp: 0,
    sampling: 0,
    sappr: 0,
    packq: 0,
    push: 0,
    pdtp: 0,
    content: 0,
    plist: 0,
    pay: 0,
    dispatchq: 0,
    today: 0,
    packed: 0,
    aftersales: 0,
    collections: 0,
    reviews: 0,
    md: 0,
    cancelled: 0,
  };

  let totalMoney = 0;
  let overdueCount = 0;
  let agedPackedCount = 0;
  const scores = [];

  const jobsWithBuckets = (allJobs || []).map((j) => {
    const stage = j.stage || "enquiry";
    const rawDue =
      j.job_completion_date ||
      j.delivery_details?.job_completion_date ||
      j.the_ask?.job_completion_date ||
      j.wizard_state?.e?.job_completion_date ||
      j.wizard_state?.e?.jobCompletionDate ||
      j.delivery_details?.delivery_date ||
      j.delivery_details?.needed_by_date ||
      j.needed_by_date ||
      j.delivery_date ||
      j.the_ask?.needed_by_date ||
      j.the_ask?.delivery_date ||
      j.order_mode?.production_date ||
      j.order_mode?.sample_date ||
      j.the_ask?.event_date ||
      j.event_date ||
      null;
    const due = rawDue ? String(rawDue).slice(0, 10) : null;
    const isDueToday = due === todayStr;

    const buckets = [];
    if (j.is_lost || stage === "cancelled" || stage === "lost") {
      buckets.push("cancelled");
    } else {
      if (isDueToday && ["sample", "production", "ready_for_dispatch", "packing"].includes(stage)) {
        buckets.push("today");
      }
      if (stage === "dtp") {
        buckets.push("pdtp");
        if (!j.wizard_state?.contentReceived) buckets.push("content");
        if ((j.financials?.total || 0) > (j.financials?.advance_received || 0)) buckets.push("pay");
      } else if (stage === "enquiry" || stage === "brief") {
        buckets.push("enquiry");
        if (j.the_brief?.design_status === "uploaded") buckets.push("sdtp");
      } else if (stage === "sample") {
        buckets.push(j.wizard_state?.approved ? "sappr" : "sampling");
      } else if (stage === "production") {
        buckets.push("push");
        buckets.push("pdtp");
      } else if (stage === "ready_for_dispatch") {
        buckets.push("dispatchq");
      } else if (stage === "packed") {
        buckets.push("packed");
        buckets.push("dispatchq");
      } else if (stage === "aftersales") {
        buckets.push("aftersales");
      } else if (stage === "closed" || stage === "delivered") {
        buckets.push("closed");
      }
    }

    const attn = buckets.some((k) => k !== "reviews" && k !== "cancelled");
    if (attn) bucketCounts.all = (bucketCounts.all || 0) + 1;
    buckets.forEach((b) => {
      bucketCounts[b] = (bucketCounts[b] || 0) + 1;
    });

    const ageDays = Math.max(1, Math.round((Date.now() - new Date(j.createdAt || Date.now()).getTime()) / 86400000));
    const amount = j.financials?.total || 0;
    totalMoney += amount;

    if (due && new Date(due + "T00:00") < TODAY && stage !== "enquiry") {
      overdueCount++;
    }
    if (buckets.includes("packed") && ageDays >= 2) {
      agedPackedCount++;
    }
    if (j.score != null) {
      scores.push(j.score);
    }

    return {
      ...j,
      due,
      buckets,
      attn,
      ageDays,
    };
  });

  const dayIso = (n) => {
    const d = new Date(TODAY.getTime() + n * 86400000);
    return d.toISOString().slice(0, 10);
  };
  const week = Array.from({ length: 7 }, (_, i) => ({
    iso: dayIso(i),
    count: jobsWithBuckets.filter((m) => m.due === dayIso(i) && m.stage !== "enquiry").length,
  }));

  const bucket = queryBucket || "all";
  const day = queryDay || null;

  let filteredJobs = jobsWithBuckets;
  if (day) {
    filteredJobs = filteredJobs.filter(
      (m) => m.due === day && m.stage !== "enquiry" && m.stage !== "closed"
    );
  } else if (bucket === "all") {
    filteredJobs = filteredJobs.filter((m) => m.attn);
  } else if (bucket) {
    filteredJobs = filteredJobs.filter((m) => m.buckets.includes(bucket));
  }

  return {
    filteredJobs,
    bucketCounts,
    kpis: {
      money: totalMoney,
      overdue: overdueCount,
      agedPacked: agedPackedCount,
      avgScore: scores.length ? Math.round(scores.reduce((a, x) => a + x, 0) / scores.length) : null,
      scoresCount: scores.length,
    },
    week,
  };
};

// 10. Client Level Live Stats Aggregation
export const getClientEnquiryStatsHelper = async (req, res, EnquiryJob) => {
  try {
    const { clientId } = req.params;
    if (!clientId) {
      return res.status(400).json({ success: false, message: "Invalid client ID" });
    }

    const clientIdStr = String(clientId);
    const isObjId = mongoose.Types.ObjectId.isValid(clientId);
    const cId = isObjId ? new mongoose.Types.ObjectId(clientId) : null;

    let custDoc = null;
    if (isObjId) {
      custDoc = await customerModel.findById(clientId).select("_id id name").lean();
    }
    if (!custDoc) {
      custDoc = await customerModel.findOne({ id: clientIdStr }).select("_id id name").lean();
    }

    const idFilters = [
      clientIdStr,
      ...(cId ? [cId] : []),
      ...(custDoc?.id ? [String(custDoc.id)] : []),
      ...(custDoc?._id ? [String(custDoc._id), custDoc._id] : []),
    ];

    const stats = await EnquiryJob.aggregate([
      {
        $match: {
          customer_id: { $in: idFilters },
          is_lost: { $ne: true },
        },
      },
      {
        $group: {
          _id: null,
          total_enquiries: { $sum: 1 },
          in_process_jobs: {
            $sum: {
              $cond: [
                { $in: ["$stage", ["enquiry", "brief", "sample", "production", "ready_for_dispatch", "dispatched"]] },
                1,
                0,
              ],
            },
          },
          in_process_value: {
            $sum: {
              $cond: [
                { $in: ["$stage", ["enquiry", "brief", "sample", "production", "ready_for_dispatch", "dispatched"]] },
                "$financials.total",
                0,
              ],
            },
          },
          completed_jobs: {
            $sum: {
              $cond: [{ $in: ["$stage", ["delivered", "closed"]] }, 1, 0],
            },
          },
          total_ordered: { $sum: "$financials.total" },
          total_advance_received: { $sum: "$financials.advance_received" },
          realtime_outstanding: {
            $sum: { $subtract: ["$financials.total", "$financials.advance_received"] },
          },
        },
      },
    ]);

    const liveJobs = await EnquiryJob.find({
      customer_id: { $in: idFilters },
      stage: { $in: ["enquiry", "brief", "sample", "production", "ready_for_dispatch"] },
      is_lost: { $ne: true },
    })
      .select("enquiry_no the_ask delivery_details stage financials sub_jobs")
      .lean();

    const formattedLive = liveJobs.map((j) => ({
      id: j.enquiry_no,
      product: j.the_ask?.theme || j.the_ask?.product_name || "Custom Trophy",
      qty: j.delivery_details?.quantity || 0,
      stage: j.stage,
      value: j.financials?.total || 0,
      adv: j.financials?.advance_required || 0,
      recd: j.financials?.advance_received || 0,
      sample: j.stage === "sample",
      sub_jobs: j.sub_jobs || [],
    }));

    const pastJobs = await EnquiryJob.find({
      customer_id: { $in: idFilters },
      is_lost: { $ne: true },
    })
      .select("enquiry_no the_ask delivery_details stage financials sub_jobs createdAt")
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    const formattedPast = [];
    pastJobs.forEach((j) => {
      const monthStr = j.createdAt
        ? new Date(j.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })
        : "Recent";

      if (j.sub_jobs && Array.isArray(j.sub_jobs) && j.sub_jobs.length > 0) {
        j.sub_jobs.forEach((sj) => {
          const pName = (sj.theme || sj.product_name || j.the_ask?.theme || j.the_ask?.product_name || "Custom Trophy").trim();
          if (!formattedPast.some((po) => po.name.toLowerCase() === pName.toLowerCase())) {
            formattedPast.push({
              name: pName,
              month: monthStr,
              size: sj.size || 8,
              rate: sj.target_rate || (sj.line_total && sj.quantity ? Math.round(sj.line_total / sj.quantity) : 850),
              mat: sj.material || "MDF",
              qty: sj.quantity || 50,
            });
          }
        });
      } else {
        const pName = (j.the_ask?.theme || j.the_ask?.product_name || "Custom Trophy").trim();
        if (!formattedPast.some((po) => po.name.toLowerCase() === pName.toLowerCase())) {
          formattedPast.push({
            name: pName,
            month: monthStr,
            size: j.the_ask?.size || 8,
            rate: j.financials?.total && j.delivery_details?.quantity ? Math.round(j.financials.total / j.delivery_details.quantity) : 850,
            mat: j.the_ask?.material || "MDF",
            qty: j.delivery_details?.quantity || 50,
          });
        }
      }
    });

    const resultStats = stats[0] || {
      total_enquiries: 0,
      in_process_jobs: 0,
      in_process_value: 0,
      completed_jobs: 0,
      total_ordered: 0,
      total_advance_received: 0,
      realtime_outstanding: 0,
    };

    res.status(200).json({
      success: true,
      stats: resultStats,
      live_jobs: formattedLive,
      past_orders: formattedPast,
    });
  } catch (error) {
    console.error("Error aggregating client enquiry stats (integration):", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// Formats a job document into a tiny flat card summary containing ONLY the fields needed by JobsBoard UI
export const formatBoardCardSummary = (j, meta = {}) => {
  const stage = meta.stage || j.stage || "enquiry";
  const buckets = Array.isArray(meta.buckets) && meta.buckets.length > 0
    ? meta.buckets
    : [stage === "brief" ? "enquiry" : stage];
  const due = meta.due !== undefined ? meta.due : null;
  const ageDays = meta.ageDays != null
    ? meta.ageDays
    : Math.max(1, Math.round((Date.now() - new Date(j.createdAt || Date.now()).getTime()) / 86400000));

  const subJobsList = Array.isArray(j.sub_jobs) ? j.sub_jobs : [];
  const isHold = Boolean(
    subJobsList.some((s) => s.is_on_hold) ||
    j.is_on_hold ||
    j.wizard_state?.is_on_hold
  );

  const distinctProducts = subJobsList.length > 0
    ? [...new Set(subJobsList.map((s) => s.theme || s.product_name || "Trophy"))]
    : [j.the_ask?.theme || j.the_ask?.product_name || "Custom Trophy"];

  const pHeadline = distinctProducts.length > 1
    ? `${distinctProducts[0]} + ${distinctProducts.length - 1} more`
    : distinctProducts[0] || "Custom Trophy";

  const totalQty = subJobsList.length > 0
    ? subJobsList.reduce((acc, s) => acc + (s.quantity || 0), 0)
    : Number(j.the_ask?.quantity || 100);

  const hasSubJobUploaded = subJobsList.some(
    (s) => !s.is_dropped && !s.is_on_hold && s.design_status === "uploaded"
  );
  const designStatus =
    j.the_brief?.design_status ||
    j.wizard_state?.the_brief?.design_status ||
    (hasSubJobUploaded ? "uploaded" : "pending");

  const noteParts = [];
  if (stage === "dtp" || buckets.includes("pdtp")) {
    noteParts.push("Production artwork: waiting for content");
  }
  const pendingAdv = (j.financials?.total || 0) - (j.financials?.advance_received || 0);
  if (pendingAdv > 0 && stage !== "enquiry") {
    noteParts.push(`₹${Number(pendingAdv).toLocaleString("en-IN")} advance pending`);
  }
  if (buckets.includes("content")) {
    noteParts.push("Content list awaited");
  }
  if (stage === "packed" || buckets.includes("packed")) {
    noteParts.push("Packed 3 days ago · courier has not picked up");
  }
  if (stage === "aftersales") {
    noteParts.push("Delivered · 2 plaques arrived cracked (breakage ticket open)");
  }
  if (stage === "enquiry") {
    if (designStatus === "uploaded") {
      noteParts.push("Design uploaded · Ready to send to client");
    } else if (designStatus === "approved") {
      noteParts.push("Design approved · Ready for quotation");
    } else if (designStatus === "rework") {
      noteParts.push("Client requested revisions on design");
    } else {
      noteParts.push("Brief logged · Waiting for designer");
    }
  }
  const note = noteParts.join(" · ") || `${pHeadline} · ${totalQty} pcs`;

  let next;
  if (buckets.includes("pay")) next = "Collect the advance";
  else if (stage === "dtp") next = "Collect the advance";
  else if (buckets.includes("content")) next = "Get the name list / content";
  else if (buckets.includes("packed")) next = "Escalate with the courier or switch to Porter today";
  else if (buckets.includes("dispatchq")) next = "Confirm dispatch address, then pack";
  else if (stage === "aftersales") next = "Send 2 replacements and close the ticket";
  else if (buckets.includes("collections")) next = "Follow up for payment";
  else if (stage === "enquiry") {
    if (designStatus === "uploaded") next = "Share design options with client";
    else if (designStatus === "approved") next = "Send quotation to client";
    else next = "Follow up with designer for artwork";
  } else {
    next = "Open job for next action";
  }

  const creatorName =
    j.created_by_user?.name ||
    (typeof j.created_by === "object" && j.created_by?.name ? j.created_by.name : null) ||
    (Array.isArray(j.history) && j.history.length > 0 && j.history[0]?.changed_by?.user_name ? j.history[0].changed_by.user_name : null) ||
    j.coordinator_name ||
    j.assigned_to?.name ||
    null;

  return {
    _isCardSummary: true,
    _id: j._id,
    id: j.enquiry_no || formatEnquiryNo(j.seq),
    stage,
    hold: isHold,
    designStatus,
    client: j.customer_id?.name || "Client",
    product: pHeadline,
    qty: totalQty,
    note,
    next,
    buckets: buckets.length > 0 ? buckets : ["enquiry"],
    due,
    ageDays,
    amount: j.financials?.total || 0,
    score: j.wizard_state?.score || j.score || 400,
    exec: j.coordinator_name || j.wizard_state?.coordinator || j.assigned_to?.name || "Meera Joshi",
    created_by_name: creatorName,
    sub_jobs: subJobsList.map((s) => ({
      sub_job_no: s.sub_job_no,
      product: s.theme || s.product_name || "Trophy",
      qty: s.quantity,
    })),
  };
};

// Build MongoDB search filter matching enquiry_no, sub_jobs.sub_job_no, customer name, product_name
export const buildJobsSearchFilter = async (searchStr) => {
  if (!searchStr || !String(searchStr).trim()) return null;
  const raw = String(searchStr).trim();
  const escaped = raw.replace(/[/\-\\^$*+?.()|[\]{}]/g, "\\$&");
  const searchRegex = new RegExp(escaped, "i");

  // Extract numeric digits for seq matching (e.g. "RD21107" -> 21107)
  const numMatch = raw.match(/\d+/);
  const seqNum = numMatch ? parseInt(numMatch[0], 10) : null;

  // 1. Search customer master by name
  let matchingCustIds = [];
  try {
    const matchedCustomers = await customerModel
      .find({ name: { $regex: searchRegex } })
      .select("_id")
      .lean();
    matchingCustIds = (matchedCustomers || []).map((c) => c._id);
  } catch (err) {
    console.warn("buildJobsSearchFilter customer lookup error:", err);
  }

  // 2. Conditions matching enquiry_no, sub_jobs.sub_job_no, customer name, product_name
  const conditions = [
    { enquiry_no: { $regex: searchRegex } },
    { "sub_jobs.sub_job_no": { $regex: searchRegex } },
    { "the_ask.product_name": { $regex: searchRegex } },
    { "the_ask.theme": { $regex: searchRegex } },
    { "sub_jobs.product_name": { $regex: searchRegex } },
    { "sub_jobs.theme": { $regex: searchRegex } },
    { "wizard_state.client.name": { $regex: searchRegex } },
    { "wizard_state.e.clientName": { $regex: searchRegex } },
    { contact_person: { $regex: searchRegex } },
  ];

  if (seqNum && !isNaN(seqNum)) {
    conditions.push({ seq: seqNum });
  }

  if (matchingCustIds.length > 0) {
    conditions.push({ customer_id: { $in: matchingCustIds } });
  }

  return { $or: conditions };
};

// Sync customer statistics in customerModel based on enquiry_flows_integration
// Uses integration-specific stat fields to avoid overwriting enquiry_flow (old) stats
export const syncCustomerStats = async (customerId) => {
  try {
    if (!customerId) return;
    const custIdStr = String(customerId);
    const isObjectId = mongoose.Types.ObjectId.isValid(customerId);
    const custObjId = isObjectId ? new mongoose.Types.ObjectId(customerId) : null;

    let custDoc = null;
    if (isObjectId) {
      custDoc = await customerModel.findById(customerId).select("_id id name").lean();
    }
    if (!custDoc) {
      custDoc = await customerModel.findOne({ id: custIdStr }).select("_id id name").lean();
    }

    const idFilters = [
      custIdStr,
      ...(custObjId ? [custObjId] : []),
      ...(custDoc?.id ? [String(custDoc.id)] : []),
      ...(custDoc?._id ? [String(custDoc._id), custDoc._id] : []),
    ];

    const allJobs = await EnquiryJob.find({ customer_id: { $in: idFilters } }).lean();
    if (!allJobs) return;

    const totalEnquiries = allJobs.length;
    const inProcessJobs = allJobs.filter(
      (j) => !j.is_lost && ["enquiry", "brief", "sample", "production", "ready_for_dispatch", "dispatched"].includes(j.stage)
    ).length;
    const wonJobs = allJobs.filter(
      (j) => ["sample", "production", "ready_for_dispatch", "dispatched", "delivered", "closed"].includes(j.stage)
    ).length;

    const lastJob = allJobs[allJobs.length - 1];
    const lastSummary = lastJob
      ? `${lastJob.stage} · ${lastJob.the_ask?.theme || lastJob.the_ask?.product_name || "Trophy"}`
      : "";

    const targetCustId = custDoc?._id || (isObjectId ? custObjId : customerId);

    // Update standard customer summary stats directly from enquiry_flows_integration
    await customerModel.findByIdAndUpdate(targetCustId, {
      $set: {
        "stats.total_jobs": inProcessJobs,
        "stats.enquiries_count": totalEnquiries,
        "stats.won_count": wonJobs,
        "stats.last_enquiry_summary": lastSummary,
      },
    });
  } catch (err) {
    console.warn("Could not sync customer stats (integration):", err);
  }
};

// Map wizard_state trophyGroups & items to structured sub_jobs
export const mapTrophyGroupItemsToSubJobs = ({
  trophyGroups = [],
  enquiry_no,
  effSize = "8",
  effQty = 50,
  existingJob = null,
  stage = "enquiry",
}) => {
  const processedSubJobs = [];
  trophyGroups.forEach((group, gIdx) => {
    const groupChar = String.fromCharCode(65 + gIdx);
    (group.items || [{ size: effSize, qty: effQty }]).forEach((item, sIdx) => {
      const subJobNo = `${enquiry_no}-${groupChar}${sIdx + 1}`;
      const existingSj = existingJob?.sub_jobs?.find((s) => s.sub_job_no === subJobNo);
      const isMultiItem = Array.isArray(group.items) && group.items.length > 1;
      const isHold =
        item.is_on_hold !== undefined
          ? Boolean(item.is_on_hold)
          : existingSj?.is_on_hold !== undefined
            ? Boolean(existingSj.is_on_hold)
            : !isMultiItem && Boolean(group.is_on_hold);
      const holdReason = item.hold_reason || existingSj?.hold_reason || (!isMultiItem ? group.hold_reason : "") || "";
      const isDrop =
        item.is_dropped !== undefined
          ? Boolean(item.is_dropped)
          : existingSj?.is_dropped !== undefined
            ? Boolean(existingSj.is_dropped)
            : !isMultiItem && Boolean(group.is_dropped);
      const dropReason = item.drop_reason || existingSj?.drop_reason || (!isMultiItem ? group.drop_reason : "") || "";

      const effSizeRate =
        item.sizeRate !== undefined && item.sizeRate !== "" && item.sizeRate !== null
          ? Number(item.sizeRate)
          : (existingSj?.size_rate || existingSj?.sizeRate || 0);

      const effTargetRate =
        item.budget !== undefined && item.budget !== "" && Number(item.budget) >= 0
          ? Number(item.budget)
          : effSizeRate > 0
            ? effSizeRate
            : item.rate !== undefined && Number(item.rate) >= 0
              ? Number(item.rate)
              : (existingSj?.target_rate || 0);

      const effSampleRate = item.sampleRate !== undefined ? Number(item.sampleRate) : existingSj?.sample_rate || 0;
      const effArtworkCharge = item.artworkCharge !== undefined ? Number(item.artworkCharge) : existingSj?.artwork_charge || 0;
      const effQuantity = Number(item.qty || effQty);

      const rawSpec = item.spec || {};
      const cleanSpec = { ...rawSpec };
      delete cleanSpec.dimensions;
      delete cleanSpec.customL;
      delete cleanSpec.customB;
      delete cleanSpec.thickness;
      if (Array.isArray(cleanSpec.colourQuantities) && cleanSpec.colourQuantities.length === 0) {
        delete cleanSpec.colourQuantities;
      }
      if (typeof cleanSpec.colour === "string" && !cleanSpec.colour.trim()) {
        delete cleanSpec.colour;
      }
      const rawCustoms = (cleanSpec.customFinishes && cleanSpec.customFinishes.length > 0)
        ? cleanSpec.customFinishes
        : (item.customFinishes && item.customFinishes.length > 0)
          ? item.customFinishes
          : [];
      const customs = Array.isArray(rawCustoms)
        ? rawCustoms.map((c) => {
            if (typeof c === "string") return { colour: c, colourCode: "#B08D57", isCustom: true };
            return {
              colour: c.colour || c.name || "",
              colourCode: c.colourCode || c.code || "#B08D57",
              isCustom: true
            };
          }).filter((c) => Boolean(c.colour))
        : [];
      if (customs.length > 0) {
        cleanSpec.customFinishes = customs;
      } else {
        delete cleanSpec.customFinishes;
      }
      cleanSpec.budget = Number(item.budget !== undefined && item.budget !== "" ? item.budget : effTargetRate);
      if (effSizeRate > 0) {
        cleanSpec.sizeRate = effSizeRate;
      }

      const isTrophyProduct = (group.productType || group.kind || group.type || "").toLowerCase().includes("trophy") || (group.productType || group.kind || group.type || "").toLowerCase().includes("memento");
      const rawDims = (item.sizeDimensions && item.sizeDimensions.length > 0)
        ? item.sizeDimensions
        : (cleanSpec.sizeDimensions && cleanSpec.sizeDimensions.length > 0)
          ? cleanSpec.sizeDimensions
          : (existingSj?.spec?.sizeDimensions || existingSj?.sizeDimensions || []);
      if (rawDims.length > 0) {
        cleanSpec.sizeDimensions = rawDims;
        if (isTrophyProduct) {
          const wObj = rawDims.find((d) => d.key === "width");
          if (wObj && wObj.value !== undefined && cleanSpec.trophyW === undefined) cleanSpec.trophyW = Number(wObj.value) || wObj.value;
          const dObj = rawDims.find((d) => d.key === "depth");
          if (dObj && dObj.value !== undefined && cleanSpec.trophyD === undefined) cleanSpec.trophyD = Number(dObj.value) || dObj.value;
          const hObj = rawDims.find((d) => d.key === "height");
          if (hObj && hObj.value !== undefined && cleanSpec.trophyH === undefined) cleanSpec.trophyH = Number(hObj.value) || hObj.value;
        }
      } else {
        delete cleanSpec.sizeDimensions;
      }

      if (!isTrophyProduct) {
        delete cleanSpec.trophyW;
        delete cleanSpec.trophyD;
        delete cleanSpec.trophyH;
      }

      processedSubJobs.push({
        sub_job_no: subJobNo,
        design_group: groupChar,
        size_variant: sIdx + 1,
        trophy_type: group.kind || "custom",
        kind: group.kind || "custom",
        theme: group.theme || existingJob?.the_ask?.theme || "Custom Trophy",
        product_name: group.productName || group.theme || group.type || existingJob?.the_ask?.product_name || "Custom Trophy",
        size: String(item.size || effSize),
        sizeDimensions: rawDims,
        sizeRate: effSizeRate || 0,
        spec: cleanSpec,
        material: Array.isArray(group.mats) ? group.mats.join(" + ") : group.mat || "MDF",
        quantity: effQuantity,
        budget: Number(item.budget !== undefined && item.budget !== "" ? item.budget : effTargetRate),
        target_rate: effTargetRate,
        sample_rate: effSampleRate,
        artwork_charge: effArtworkCharge,
        line_total: effQuantity * effTargetRate,
        costing_status: existingSj?.costing_status || "not_requested",
        costing_requested_at: existingSj?.costing_requested_at || null,
        costing_completed_at: existingSj?.costing_completed_at || null,
        costing_assigned_to: existingSj?.costing_assigned_to || null,
        bom_id: existingSj?.bom_id || null,
        quote_shared: existingSj?.quote_shared || false,
        quote_shared_at: existingSj?.quote_shared_at || null,
        quote_channel: existingSj?.quote_channel || null,
        client_quote_decision: existingSj?.client_quote_decision || "pending",
        client_quote_decision_at: existingSj?.client_quote_decision_at || null,
        client_quote_decision_notes: existingSj?.client_quote_decision_notes || "",
        stage: isDrop ? "cancelled" : existingSj?.stage || existingJob?.stage || stage || "enquiry",
        is_on_hold: Boolean(isHold),
        hold_reason: holdReason,
        held_at: isHold ? existingSj?.held_at || new Date() : null,
        is_dropped: Boolean(isDrop),
        drop_reason: dropReason,
        dropped_at: isDrop ? existingSj?.dropped_at || new Date() : null,
      });
    });
  });
  return normalizeJobArtworkCharge(processedSubJobs, 1500);
};
// Step 1 projection: ultra-minimal scalar fields ONLY for bucket filtering, KPIs & 7-day counts
export const BOARD_SCAN_PROJECTION = [
  "_id", "stage", "is_lost", "score", "createdAt",
  "job_completion_date", "delivery_date", "needed_by_date", "event_date",
  "the_ask.job_completion_date", "the_ask.delivery_date", "the_ask.needed_by_date", "the_ask.event_date",
  "delivery_details.job_completion_date", "delivery_details.delivery_date", "delivery_details.needed_by_date",
  "order_mode.production_date", "order_mode.sample_date",
  "financials.total", "financials.advance_received",
  "the_brief.design_status", "wizard_state.approved", "wizard_state.contentReceived",
  "wizard_state.e.job_completion_date", "wizard_state.e.jobCompletionDate",
].join(" ");

// Step 2 projection: fetched ONLY for the current paginated 8 cards
export const BOARD_CARD_PROJECTION = [
  "_id", "enquiry_no", "seq", "stage", "is_lost", "is_on_hold", "score", "createdAt",
  "customer_id", "assigned_to", "coordinator_name", "created_by", "history",
  "the_ask.product_name", "the_ask.theme", "the_ask.quantity",
  "the_brief.design_status", "financials.total", "financials.advance_received",
  "sub_jobs.sub_job_no", "sub_jobs.product_name", "sub_jobs.theme", "sub_jobs.quantity",
  "sub_jobs.is_on_hold", "sub_jobs.is_dropped", "sub_jobs.design_status",
  "wizard_state.score", "wizard_state.coordinator", "wizard_state.is_on_hold",
  "wizard_state.the_brief.design_status",
  "delivery_charges", "delivery_details",
].join(" ");

// Helper to resolve assigned customer IDs for a logged-in user:
// - Returns null for Admin and Client Servicing Manager / Head (indicating no restriction).
// - Returns array of customer IDs (ObjectIds and string IDs) for Client Servicing Executive.
export const getAssignedCustomerIdsForUser = async (reqUser) => {
  if (!reqUser) return null;
  const userRole = (reqUser.role || "").toLowerCase();
  const isHead = reqUser.is_head === true;
  const isAdminOrManager =
    userRole.includes("admin") ||
    userRole.includes("manager") ||
    userRole.includes("head") ||
    isHead;

  // Admin and Client Servicing Manager see ALL enquiries and clients
  if (isAdminOrManager) {
    return null;
  }

  // Resolve valid MongoDB ObjectId for the user
  let userObjId = null;
  if (reqUser._id && mongoose.Types.ObjectId.isValid(reqUser._id)) {
    userObjId = new mongoose.Types.ObjectId(reqUser._id);
  } else if (reqUser.id && mongoose.Types.ObjectId.isValid(reqUser.id)) {
    userObjId = new mongoose.Types.ObjectId(reqUser.id);
  } else if (reqUser.id) {
    try {
      const dbUser = await userModel.findOne({ id: reqUser.id }).select("_id").lean();
      if (dbUser?._id && mongoose.Types.ObjectId.isValid(dbUser._id)) {
        userObjId = new mongoose.Types.ObjectId(dbUser._id);
      }
    } catch (e) {
      console.warn("Could not find user _id from custom id in getAssignedCustomerIdsForUser:", e?.message);
    }
  }

  if (!userObjId) return [];

  const matchConditions = [
    { client_servicing_persons: userObjId },
    { owner: userObjId },
    { rd_account_managers: userObjId },
  ];

  const assignedCustomers = await customerModel
    .find({ $or: matchConditions })
    .select("_id id")
    .lean();

  const allowedIds = [];
  (assignedCustomers || []).forEach((c) => {
    if (c._id) allowedIds.push(c._id);
    if (c.id) allowedIds.push(c.id);
  });

  return allowedIds;
};

// Enriches enquiry job with 24-hr signed asset URLs, auto-resolved live BOM rates, and auto-healed design states
export const enrichJobWithSignedAssetsAndBOM = async (job) => {
  if (!job) return;

  const signFile = (f) => {
    if (!f) return f;
    if (typeof f === "string") {
      return generateSignedUrl(f) || f;
    }
    const rawUrl = f.file_url || f.url || f.signed_url;
    if (rawUrl && typeof rawUrl === "string") {
      const sUrl = generateSignedUrl(rawUrl);
      if (sUrl) {
        f.signed_url = sUrl;
        f.url = sUrl;
      }
    }
    return f;
  };

  const signFileList = (list) => {
    if (!Array.isArray(list)) return;
    list.forEach((f) => signFile(f));
  };

  const signBriefAssets = (b) => {
    if (!b || typeof b !== "object") return;
    signFileList(b.ref_files || b.refs || b.globalRefs);
    signFileList(b.client_logo || b.clientLogo || b.clientLogos);
    signFileList(b.signatures);
    signFileList(b.additional_files || b.additionalFiles);
  };

  signBriefAssets(job.the_brief);
  signBriefAssets(job.wizard_state?.e);
  if (job.the_brief?.product_briefs) {
    Object.values(job.the_brief.product_briefs).forEach(signBriefAssets);
  }
  if (job.wizard_state?.e?.productBriefs) {
    Object.values(job.wizard_state.e.productBriefs).forEach(signBriefAssets);
  }

  signJobWizardDesigns(job);
  if (job.sub_jobs && Array.isArray(job.sub_jobs)) {
    for (const sj of job.sub_jobs) {
      if (!sj || typeof sj !== "object") continue;
      signBriefAssets(sj);
      if (Array.isArray(sj.dtp_files)) sj.dtp_files = sj.dtp_files.map((f) => signFile(f));
      if (Array.isArray(sj.packing_files)) sj.packing_files = sj.packing_files.map((f) => signFile(f));
      if (Array.isArray(sj.proof_files)) sj.proof_files = sj.proof_files.map((f) => signFile(f));
      if (Array.isArray(sj.design_files)) sj.design_files = sj.design_files.map((f) => signFile(f));

      if (sj.sub_job_no) {
        const cleanNo = String(sj.sub_job_no).trim();
        const withRd = cleanNo.startsWith("RD") ? cleanNo : `RD${cleanNo}`;
        const withoutRd = cleanNo.replace(/^RD/i, "");

        try {
          const bomOrConditions = [
            { sub_job_no: cleanNo },
            { sub_job_no: withRd },
            { sub_job_no: withoutRd },
          ];
          if (sj.bom_id) {
            bomOrConditions.unshift({ id: String(sj.bom_id).trim() });
            if (mongoose.isValidObjectId(sj.bom_id)) {
              bomOrConditions.unshift({ _id: sj.bom_id });
            }
          }

          const matchedBom = await bomModel.findOne({ $or: bomOrConditions }).sort({ createdAt: -1 }).lean();

          const jobCreatedAt = job.createdAt ? new Date(job.createdAt) : null;
          const costingRequestedAt = sj.costing_requested_at ? new Date(sj.costing_requested_at) : null;
          const bomCreatedAt = matchedBom?.createdAt ? new Date(matchedBom.createdAt) : null;

          const isBomStale = Boolean(
            matchedBom &&
            ((jobCreatedAt && bomCreatedAt && bomCreatedAt < jobCreatedAt) ||
              (costingRequestedAt && bomCreatedAt && bomCreatedAt < costingRequestedAt))
          );

          if (matchedBom && !isBomStale) {
            sj.bom_id = matchedBom._id || matchedBom.id;
            sj.bom_nanoid = matchedBom.id || "";
            const bomUnitPrice = Number(
              matchedBom.quotation?.finalUnitPrice ||
              matchedBom.totalUnitCost ||
              matchedBom.costing?.unit_cost ||
              matchedBom.commercial?.calculated_unit_rate ||
              matchedBom.total_manufacturing_cost ||
              0
            );
            const bomSamplePrice = Number(matchedBom.quotation?.samplePrice || 0);
            const bomArtwork = Number(matchedBom.quotation?.artworkCharge || 0);

            if (bomUnitPrice > 0 && !matchedBom.is_bom_draft) {
              sj.costing_status = "completed";
              sj.quotation_status = "completed";
              sj.target_rate = Number(bomUnitPrice.toFixed(2));
              sj.unit_rate = Number(bomUnitPrice.toFixed(2));
              sj.line_total = Number(((sj.quantity || 1) * bomUnitPrice).toFixed(2));
              if (bomSamplePrice > 0) {
                sj.sample_rate = Number(bomSamplePrice.toFixed(2));
              } else if (sj.unit_rate > 0 && !sj.sample_rate) {
                sj.sample_rate = Number((sj.unit_rate + 200).toFixed(2));
              }
              if (bomArtwork > 0) {
                sj.artwork_charge = Number(bomArtwork.toFixed(2));
              }
            }
          } else if (!matchedBom || isBomStale) {
            sj.bom_id = null;
            sj.bom_nanoid = null;
            if (sj.costing_status === "completed") {
              sj.costing_status = sj.costing_requested_at ? "pending" : "not_requested";
            }
            sj.unit_rate = 0;
            sj.target_rate = 0;
            sj.sample_rate = 0;
            sj.artwork_charge = 0;
            sj.line_total = 0;
          }
        } catch (bomErr) {
          console.warn(`Error resolving BOM for ${sj.sub_job_no}:`, bomErr.message);
        }
      }
    }

    const upMap = job.wizard_state?.uploadedDesigns || {};
    const fbMap = job.wizard_state?.productFeedback || {};
    let healed = false;
    job.sub_jobs.forEach((sj, sIdx) => {
      if (sj.is_dropped || sj.is_on_hold || sj.trophy_type === "ready") return;
      const gChar = sj.design_group || String.fromCharCode(65 + sIdx);
      const gIdx = gChar.charCodeAt(0) - 65;
      const hasUp = Object.keys(upMap).some((k) => (k.startsWith(`${gIdx}-`) || k.startsWith(`${gChar}-`)) && upMap[k]) || (Array.isArray(sj.designer_files) && sj.designer_files.length > 0);
      const fbs = fbMap[gIdx] || fbMap[String(gIdx)] || sj.product_feedback;
      const hasApp = (Array.isArray(fbs) ? fbs : (fbs ? [fbs] : [])).some((f) => f && f.mode === "approve");
      if ((!hasUp || !hasApp) && (sj.design_approved || sj.design_status === "approved")) {
        sj.design_approved = false;
        sj.design_status = "pending";
        sj.costing_status = "not_requested";
        sj.quotation_status = "not_requested";
        healed = true;
      }
    });

    const isSampleDtpApproved = Boolean(
      job.wizard_state?.dtp?.sample?.proofFile?.status === "Approved" ||
      job.wizard_state?.dtp?.sample?.approved ||
      (job.wizard_state?.dtp?.sample?.proofFiles || []).some((f) => f.status === "Approved")
    );
    if (isSampleDtpApproved) {
      const pf = job.wizard_state?.dtp?.sample?.proofFile;
      const appAt = pf?.action_at || new Date().toISOString();
      const appBy = pf?.action_by || "Client Link";
      if (!job.wizard_state) job.wizard_state = {};
      if (!job.wizard_state.dtp) job.wizard_state.dtp = {};
      if (!job.wizard_state.dtp.sample) job.wizard_state.dtp.sample = {};
      if (!job.wizard_state.dtp.sample.approved) {
        job.wizard_state.dtp.sample.approved = { at: appAt, by: appBy, method: "Client Link" };
        job.wizard_state.dtp.sample.proofSent = "Approved";
        healed = true;
      }
      job.sub_jobs.forEach((sj) => {
        if (sj.is_sample || job.order_type === "sample" || job.job_type === "sample") {
          if (sj.sample_proof_status !== "approved" || sj.proof_status !== "approved" || sj.master_template_status !== "approved") {
            sj.sample_proof_status = "approved";
            sj.proof_status = "approved";
            sj.master_template_status = "approved";
            sj.content_proof_status = "approved";
            sj.proof_approved_at = sj.proof_approved_at || appAt;
            sj.sample_proof_decision = sj.sample_proof_decision || { decision: "approved", status: "Approved", at: appAt, by: appBy };
            sj.proof_decision = sj.proof_decision || { decision: "approved", status: "Approved", at: appAt, by: appBy };
            healed = true;
          }
        }
      });
    }

    const activeSjs = job.sub_jobs.filter((s) => !s.is_dropped && !s.is_on_hold && s.trophy_type !== "ready");
    if (!activeSjs.every((s) => s.design_approved === true)) {
      if (job.the_brief?.design_status === "approved") { job.the_brief.design_status = "pending"; healed = true; }
      if (job.wizard_state?.designApproved) { job.wizard_state.designApproved = false; healed = true; }
      if (job.wizard_state?.designStatus === "approved") { job.wizard_state.designStatus = "pending"; healed = true; }
    }
    try {
      const upDoc = { sub_jobs: job.sub_jobs };
      if (healed) {
        upDoc["the_brief.design_status"] = job.the_brief?.design_status || "pending";
        upDoc["wizard_state.designApproved"] = false;
        upDoc["wizard_state.designStatus"] = "pending";
        if (job.wizard_state?.dtp?.sample?.approved) {
          upDoc["wizard_state.dtp.sample.approved"] = job.wizard_state.dtp.sample.approved;
          upDoc["wizard_state.dtp.sample.proofSent"] = "Approved";
          if (job.wizard_state.dtp.sample.proofFile) {
            upDoc["wizard_state.dtp.sample.proofFile.status"] = "Approved";
          }
        }
      }
      await EnquiryJob.updateOne({ _id: job._id }, { $set: upDoc });
    } catch (dbSyncErr) {
      console.warn("Could not sync resolved BOM sub_jobs:", dbSyncErr.message);
    }
  }

  if (job.common_files) {
    Object.keys(job.common_files).forEach((cat) => {
      if (Array.isArray(job.common_files[cat])) {
        job.common_files[cat].forEach((f) => (f.signed_url = generateSignedUrl(f.file_url)));
      }
    });
  }
};


