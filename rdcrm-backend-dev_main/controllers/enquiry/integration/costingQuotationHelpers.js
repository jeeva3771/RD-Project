/**
 * costingQuotationHelpers.js
 * Helpers for costing & quotation synchronization in Enquiry Flow Integration.
 * Enforces one-time artwork charge (default ₹1,500) per enquiry across all sub-jobs.
 */

/**
 * Normalizes artwork charges across sub-jobs in an enquiry.
 * Exactly ONE active sub-job carries the 1-time artwork charge (default ₹1,500).
 * All other sub-jobs in the enquiry are assigned 0.
 */
export const normalizeJobArtworkCharge = (subJobs = [], defaultFee = 1500) => {
  if (!Array.isArray(subJobs) || subJobs.length === 0) return subJobs;

  let bearerIndex = subJobs.findIndex(
    (sj) => !sj.is_dropped && Number(sj.artwork_charge ?? sj.artworkCharge ?? 0) > 0
  );

  if (bearerIndex === -1) {
    bearerIndex = subJobs.findIndex((sj) => !sj.is_dropped);
  }

  if (bearerIndex === -1 && subJobs.length > 0) {
    bearerIndex = 0;
  }

  return subJobs.map((sj, idx) => {
    const isBearer = idx === bearerIndex;
    let fee = 0;
    if (isBearer) {
      const existingFee = Number(sj.artwork_charge ?? sj.artworkCharge ?? 0);
      fee = existingFee > 0 ? existingFee : defaultFee;
    }
    return {
      ...sj,
      artwork_charge: fee,
      artworkCharge: fee,
      isArtworkBearer: isBearer,
    };
  });
};

/**
 * Enriches sub-jobs with unit rates from BOMs or wizard simulatedRates,
 * and enforces the single one-time artwork charge (default ₹1,500) on the bearer sub-job.
 */
export const enrichSubJobsWithBOMAndSimulatedRates = (job, boms = []) => {
  const wizardSimulatedRates = job.wizard_state?.simulatedRates || {};
  const wizardCostingLines = job.wizard_state?.costing?.lines || [];

  // Artwork fee is a 1-time charge per enquiry (default 1500 on first active sub-job)
  const activeSjs = (job.sub_jobs || []).filter((sj) => !sj.is_dropped);
  let bearerSubJobNo = null;
  const explicitBearer = activeSjs.find((sj) => {
    const withoutRd = (sj.sub_job_no || "").replace(/^RD/, "");
    const match = String(sj.sub_job_no || "").trim().match(/[-_]?([A-Za-z])(\d+)?$/);
    const gIdx = match ? match[1].toUpperCase().charCodeAt(0) - 65 : 0;
    const vIdx = match && match[2] ? parseInt(match[2], 10) - 1 : 0;
    const resolvedKey = `${gIdx}-${vIdx}`;
    const sim = wizardSimulatedRates[sj.sub_job_no] || wizardSimulatedRates[resolvedKey] || wizardSimulatedRates[withoutRd] || {};
    return (Number(sj.artwork_charge) > 0 || Number(sim.artwork) > 0);
  });
  if (explicitBearer) {
    bearerSubJobNo = explicitBearer.sub_job_no;
  } else if (activeSjs.length > 0) {
    bearerSubJobNo = activeSjs[0].sub_job_no;
  }

  let hasUpdates = false;

  const enrichedSubJobs = (job.sub_jobs || []).map((sj, idx) => {
    const withoutRd = (sj.sub_job_no || "").replace(/^RD/, "");
    const matchedBom = (boms || []).find(
      (b) =>
        (sj.bom_id && (String(b._id) === String(sj.bom_id) || b.id === String(sj.bom_id))) ||
        (sj.sub_job_no && (b.sub_job_no === sj.sub_job_no || b.sub_job_no === withoutRd || `RD${b.sub_job_no}` === sj.sub_job_no))
    );

    const bomQuotationRate = Number(
      matchedBom?.quotation?.finalUnitPrice ||
      matchedBom?.totalUnitCost ||
      matchedBom?.costing?.unit_cost ||
      matchedBom?.commercial?.calculated_unit_rate ||
      matchedBom?.total_manufacturing_cost ||
      0
    );

    const match = String(sj.sub_job_no || "").trim().match(/[-_]?([A-Za-z])(\d+)?$/);
    const gIdx = match ? match[1].toUpperCase().charCodeAt(0) - 65 : idx;
    const vIdx = match && match[2] ? parseInt(match[2], 10) - 1 : 0;
    const resolvedKey = `${gIdx}-${vIdx}`;

    const simEntry =
      wizardSimulatedRates[sj.sub_job_no] ||
      wizardSimulatedRates[resolvedKey] ||
      wizardSimulatedRates[withoutRd] ||
      wizardCostingLines.find((l) => l.name?.includes(sj.sub_job_no) || l.id === sj.sub_job_no);

    const simRate = Number(simEntry?.rate || simEntry?.unit_rate || 0);

    const hasCostingDone = Boolean(
      (matchedBom && (!matchedBom.is_bom_draft || bomQuotationRate > 0)) ||
      (simEntry && simEntry.isManualSaved && simRate > 0) ||
      (sj.bom_id && sj.costing_status === "completed")
    );

    const resolvedRate = bomQuotationRate > 0
      ? Number(bomQuotationRate.toFixed(2))
      : simRate > 0
      ? Number(simRate.toFixed(2))
      : (hasCostingDone && sj.unit_rate > 0)
      ? Number(sj.unit_rate.toFixed(2))
      : 0;

    const sampleItemMatch = (job.wizard_state?.sampleItems || []).find(
      (it) => it.subJobNo === sj.sub_job_no || (sj.sub_job_no && it.subJobNo && sj.sub_job_no.endsWith(it.subJobNo.split('-').slice(1).join('-')))
    );
    const samplePrice = Number(sampleItemMatch?.rate || matchedBom?.quotation?.samplePrice || simEntry?.sample || simEntry?.sampleRate || 0);
    const resolvedSampleRate = samplePrice > 0
      ? Number(samplePrice.toFixed(2))
      : (resolvedRate > 0 ? Number((resolvedRate + 200).toFixed(2)) : (sj.sample_rate || 0));

    const isBearer = sj.sub_job_no === bearerSubJobNo;
    let sjArtwork = 0;
    if (isBearer && !sj.is_dropped) {
      const rawArt = Number(matchedBom?.quotation?.artworkCharge || simEntry?.artwork || sj.artwork_charge || 0);
      sjArtwork = rawArt > 0 ? rawArt : 1500;
    }

    if (resolvedRate > 0 && (sj.unit_rate !== resolvedRate || sj.target_rate !== resolvedRate)) {
      hasUpdates = true;
    }
    if (sj.artwork_charge !== sjArtwork) {
      hasUpdates = true;
    }

    return {
      ...sj,
      bom_id: matchedBom?._id || sj.bom_id,
      costing_status: hasCostingDone ? "completed" : (sj.costing_status || "pending"),
      unit_rate: resolvedRate,
      target_rate: resolvedRate > 0 ? resolvedRate : (sj.target_rate || 0),
      sample_rate: resolvedSampleRate,
      artwork_charge: sjArtwork,
      line_total: Number(((sj.quantity || 1) * resolvedRate).toFixed(2)),
    };
  });

  return { enrichedSubJobs, hasUpdates };
};
