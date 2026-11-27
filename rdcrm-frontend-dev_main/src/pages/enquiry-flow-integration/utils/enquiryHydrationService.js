import {
  sanitizeWizardState,
} from "./helpers";

/**
 * Maps incoming backend EnquiryJob document to frontend wizard state `s`.
 * Extracted from EnquiryFlow.jsx to maintain modular architecture and keep files < 1,500 lines.
 */
export function mapBackendJobToWizardState(job, defaultSeqCount = 100) {
  const raw = job.rawJob || job;
  const baseState = sanitizeWizardState(job.wizard_state || {}) || {};
  const eObj = baseState.e || {};
  const evDate = raw.event_date || raw.the_ask?.event_date || eObj.event_date || eObj.eventExactDate || eObj.eventDate || "";
  const needDate = raw.delivery_date || raw.needed_by_date || raw.the_ask?.delivery_date || raw.the_ask?.needed_by_date || eObj.delivery_date || eObj.neededByDate || eObj.deliveryDate || "";
  const compDate = raw.job_completion_date || raw.the_ask?.job_completion_date || raw.delivery_details?.job_completion_date || eObj.job_completion_date || eObj.jobCompletionDate || baseState.jobDeliveryDate || "";

  const resolvedClientId = baseState.clientId || raw.customer_id?._id || raw.customer_id;
  const resolvedContactId = baseState.contactId || raw.contact_id || null;
  const resolvedShipToId = baseState.shipToId || raw.ship_to_id || null;
  const rawCoord = (raw.coordinator_name === "Priya Nair" ? "" : (raw.coordinator_name || ""));
  const resolvedCoordinator = baseState.coordinator || rawCoord || "";
  const resolvedQty = Number(baseState.finalQty || baseState.qty || raw.the_ask?.quantity || raw.delivery_details?.quantity || (raw.sub_jobs?.[0]?.quantity) || 50);
  const resolvedSize = String(eObj.size || raw.the_ask?.size || (raw.sub_jobs?.[0]?.size) || "8");

  let resolvedGroups = eObj.trophyGroups;
  if ((!resolvedGroups || resolvedGroups.length === 0) && Array.isArray(raw.sub_jobs) && raw.sub_jobs.length > 0) {
    resolvedGroups = [{
      theme: raw.the_ask?.theme || raw.sub_jobs[0].theme || "Custom Trophy",
      productName: raw.the_ask?.product_name || raw.sub_jobs[0].product_name || "Custom Trophy",
      kind: raw.sub_jobs[0].trophy_type || "custom",
      type: "Trophy",
      mat: raw.the_ask?.material || raw.sub_jobs[0].material || "MDF",
      items: raw.sub_jobs.map((sj) => {
        const sjColours = (sj.spec?.colourQuantities && sj.spec.colourQuantities.length > 0)
          ? sj.spec.colourQuantities
          : (sj.colourQuantities && sj.colourQuantities.length > 0)
            ? sj.colourQuantities
            : [];
        const sjCustoms = (sj.spec?.customFinishes && sj.spec.customFinishes.length > 0)
          ? sj.spec.customFinishes
          : (sj.customFinishes && sj.customFinishes.length > 0)
            ? sj.customFinishes
            : [];
        const sjDims = (sj.spec?.sizeDimensions && sj.spec.sizeDimensions.length > 0)
          ? sj.spec.sizeDimensions
          : (sj.sizeDimensions && sj.sizeDimensions.length > 0)
            ? sj.sizeDimensions
            : [];

        return {
          size: sj.size || resolvedSize,
          qty: sj.quantity || resolvedQty,
          rate: sj.unit_rate || sj.target_rate || 0,
          unit_rate: sj.unit_rate || sj.target_rate || 0,
          budget: sj.target_rate || sj.spec?.budget || 0,
          sizeRate: sj.spec?.sizeRate || sj.size_rate || sj.sizeRate || 0,
          sizeDimensions: sjDims,
          colourQuantities: sjColours,
          colour: sj.spec?.colour || sj.colour || "",
          customFinishes: sjCustoms,
          sampleRate: sj.sample_rate || (sj.unit_rate ? sj.unit_rate + 200 : 0),
          artworkCharge: sj.artwork_charge || 0,
          bom_id: sj.bom_id || null,
          costing_status: sj.costing_status || (sj.bom_id ? "completed" : "not_requested"),
          specLine: sj.spec_line || "",
          spec: {
            ...(sj.spec || {}),
            ...(sjColours.length > 0 ? { colourQuantities: sjColours } : {}),
            ...(sjCustoms.length > 0 ? { customFinishes: sjCustoms } : {}),
            ...(sjDims.length > 0 ? { sizeDimensions: sjDims } : {}),
          },
        };
      }),
    }];
  } else if (resolvedGroups && Array.isArray(resolvedGroups) && Array.isArray(raw.sub_jobs) && raw.sub_jobs.length > 0) {
    // Sync DB sub_jobs rates, colours, specs back into resolvedGroups items
    resolvedGroups = resolvedGroups.map((group, gIdx) => {
      const groupChar = String.fromCharCode(65 + gIdx);
      const updatedItems = (group.items || []).map((item, sIdx) => {
        const subJobNo = `${raw.enquiry_no || 'RD'}-${groupChar}${sIdx + 1}`;
        const sj = raw.sub_jobs.find(
          (s) => s.sub_job_no === subJobNo || s.sub_job_no?.endsWith(`${groupChar}${sIdx + 1}`)
        );
        if (sj) {
          const hasBom = Boolean(sj.bom_id || item.bom_id);
          const isCompleted = sj.costing_status === "completed" && hasBom;
          const effR = hasBom ? (sj.unit_rate || item.rate || 0) : 0;

          // Current wizard state in item takes strict precedence over DB sub-job
          const itemColours = Array.isArray(item.colourQuantities)
            ? item.colourQuantities
            : (Array.isArray(item.spec?.colourQuantities) ? item.spec.colourQuantities : null);

          const sjColours = itemColours !== null
            ? itemColours
            : (Array.isArray(sj.spec?.colourQuantities) && sj.spec.colourQuantities.length > 0
              ? sj.spec.colourQuantities
              : (Array.isArray(sj.colourQuantities) ? sj.colourQuantities : []));

          const itemCustoms = Array.isArray(item.customFinishes)
            ? item.customFinishes
            : (Array.isArray(item.spec?.customFinishes) ? item.spec.customFinishes : null);

          const sjCustoms = itemCustoms !== null
            ? itemCustoms
            : (Array.isArray(sj.spec?.customFinishes) && sj.spec.customFinishes.length > 0
              ? sj.spec.customFinishes
              : (Array.isArray(sj.customFinishes) ? sj.customFinishes : []));

          const effColour = item.colour !== undefined
            ? item.colour
            : (item.spec?.colour !== undefined
              ? item.spec.colour
              : (sj.colour || sj.spec?.colour || ""));

          const sjDims = (item.sizeDimensions && item.sizeDimensions.length > 0)
            ? item.sizeDimensions
            : (sj.spec?.sizeDimensions && sj.spec.sizeDimensions.length > 0)
              ? sj.spec.sizeDimensions
              : (sj.sizeDimensions && sj.sizeDimensions.length > 0)
                ? sj.sizeDimensions
                : [];

          const updatedSpec = {
            ...(sj.spec || {}),
            ...(item.spec || {}),
            ...(sjDims.length > 0 ? { sizeDimensions: sjDims } : {}),
          };

          if (sjColours.length > 0) {
            updatedSpec.colourQuantities = sjColours;
          } else {
            delete updatedSpec.colourQuantities;
          }

          if (effColour && String(effColour).trim()) {
            updatedSpec.colour = String(effColour).trim();
          } else {
            delete updatedSpec.colour;
          }

          if (sjCustoms.length > 0) {
            updatedSpec.customFinishes = sjCustoms;
          } else {
            delete updatedSpec.customFinishes;
          }

          return {
            ...item,
            qty: Number(sj.quantity || item.qty || resolvedQty),
            rate: effR,
            unit_rate: effR,
            budget: item.budget || sj.target_rate || 0,
            sizeRate: item.sizeRate !== undefined ? item.sizeRate : (sj.spec?.sizeRate || sj.size_rate || sj.sizeRate || 0),
            sizeDimensions: sjDims,
            colourQuantities: sjColours,
            colour: effColour || "",
            customFinishes: sjCustoms,
            sampleRate: sj.sample_rate || item.sampleRate || (effR > 0 ? effR + 200 : 0),
            artworkCharge: sj.artwork_charge !== undefined ? sj.artwork_charge : (item.artworkCharge || 0),
            bom_id: sj.bom_id || item.bom_id || null,
            costing_status: isCompleted ? "completed" : (sj.costing_status === "completed" ? "pending" : (sj.costing_status || item.costing_status || "not_requested")),
            spec: updatedSpec,
          };
        }
        return item;
      });
      return { ...group, items: updatedItems };
    });
  }

  const rawBrief = raw.the_brief || {};
  const lastUploadTime = rawBrief.last_design_upload
    ? new Date(rawBrief.last_design_upload).getTime()
    : (raw.wizard_state?.designUploadedAt ? new Date(raw.wizard_state.designUploadedAt).getTime() : 0);
  const optionsSharedTime = rawBrief.options_shared_at
    ? new Date(rawBrief.options_shared_at).getTime()
    : (baseState.optionsShared && typeof baseState.optionsShared === "string" ? new Date(baseState.optionsShared).getTime() : 0);
  const isNewUploadAfterShare = lastUploadTime > 0 && lastUploadTime > optionsSharedTime;

  const hasUploadedSubJobs = (raw.sub_jobs || []).some(
    (sj) => !sj.is_dropped && !sj.is_on_hold && sj.trophy_type !== "ready" && sj.kind !== "ready" && sj.design_status === "uploaded"
  ) || rawBrief.design_status === "uploaded" || raw.wizard_state?.designStatus === "uploaded";

  const isOptionsSharedExplicitlyFalse =
    rawBrief.options_shared === false ||
    raw.wizard_state?.optionsShared === false ||
    hasUploadedSubJobs ||
    isNewUploadAfterShare;

  const optionsSharedVal = isOptionsSharedExplicitlyFalse
    ? false
    : (rawBrief.options_shared_at
      ? new Date(rawBrief.options_shared_at).toISOString()
      : (rawBrief.options_shared
        ? (typeof rawBrief.options_shared === "string" ? rawBrief.options_shared : true)
        : (baseState.optionsShared || false)));
  const optionsSharedChannelVal = isOptionsSharedExplicitlyFalse
    ? ""
    : (baseState.optionsSharedChannel || rawBrief.options_shared_channel || "");

  const effDesignerId = rawBrief.designer_id || raw.assigned_designer || eObj.assignedDesigner || eObj.designer_id || "";
  const effDesignerName = rawBrief.designer_name || raw.assigned_designer_name || eObj.assignedDesignerName || eObj.designer_name || "";
  const effDesignNeeded = rawBrief.design_needed ?? eObj.designer ?? true;
  const effProductBriefs = eObj.productBriefs || rawBrief.product_briefs || {};
  const effBriefText = eObj.globalBrief || rawBrief.brief_text || "";
  const effRefFiles = (eObj.globalRefs && eObj.globalRefs.length > 0) ? eObj.globalRefs : (rawBrief.ref_files || []);

  const activeCustomSubJobs = (raw.sub_jobs || []).filter(
    (sj) => !sj.is_dropped && !sj.is_on_hold && sj.trophy_type !== "ready" && sj.kind !== "ready"
  );
  const hasActiveCustom = activeCustomSubJobs.length > 0;
  const allApproved = hasActiveCustom && activeCustomSubJobs.every(
    (sj) => sj.design_approved === true || sj.design_status === "approved"
  );
  const hasAnyReworkOrUploaded = (raw.sub_jobs || []).some(
    (sj) =>
      sj.design_status === "rework" ||
      sj.design_status === "uploaded" ||
      sj.design_status === "rejected" ||
      sj.design_status === "reject"
  ) || rawBrief.design_status === "rework" || rawBrief.design_status === "uploaded";

  const isJobDesignApproved = Boolean(
    hasActiveCustom
      ? (allApproved && !hasAnyReworkOrUploaded)
      : (baseState.designApproved === true || rawBrief.design_status === "approved")
  );

  const activeSubJobsForQuote = (raw.sub_jobs || []).filter(
    (sj) => !sj.is_dropped && !sj.is_on_hold
  );
  const anySubJobQuoteApproved = activeSubJobsForQuote.some(
    (sj) => sj.client_quote_decision === "approved"
  );
  const anySubJobQuoteRevision = activeSubJobsForQuote.some(
    (sj) => sj.client_quote_decision === "revision"
  );
  const anySubJobQuoteRejected = activeSubJobsForQuote.some(
    (sj) => sj.client_quote_decision === "rejected"
  );
  const isJobQuoteApproved = Boolean(
    raw.wizard_state?.quoteApproved === true ||
    raw.wizard_state?.client_quote_decision === "approved" ||
    baseState.quoteApproved === true ||
    baseState.client_quote_decision === "approved" ||
    anySubJobQuoteApproved
  );
  const resolvedQuoteDecision = isJobQuoteApproved
    ? "approved"
    : anySubJobQuoteRevision
      ? "revision"
      : anySubJobQuoteRejected
        ? "rejected"
        : (raw.wizard_state?.client_quote_decision || baseState.client_quote_decision || "pending");

  const approvedSubJob = activeSubJobsForQuote.find((sj) => sj.client_quote_decision === "approved");
  const resolvedDecisionObj =
    raw.wizard_state?.decision ||
    baseState.decision ||
    (isJobQuoteApproved
      ? {
        decision: "approved",
        channel: approvedSubJob?.client_quote_communication || "Direct Client Response",
        notes: approvedSubJob?.client_quote_decision_notes || "",
        at: approvedSubJob?.client_quote_decision_at || new Date().toISOString(),
      }
      : null);

  const isRawLostOrCancelled = Boolean(
    raw.is_lost ||
    raw.stage === "cancelled" ||
    raw.stage === "lost" ||
    baseState.is_lost ||
    baseState.stage === "cancelled" ||
    baseState.stage === "lost"
  );

  const isSampleRatesApproved = Boolean(
    baseState.ratesApproved === true ||
    baseState.sampleConfirmed === true ||
    baseState.sampleRatesState === "approved" ||
    baseState.sampleDecision?.decision === "approved" ||
    raw.sample_rates_approved === true ||
    raw.wizard_state?.ratesApproved === true ||
    raw.wizard_state?.sampleConfirmed === true ||
    raw.wizard_state?.sampleRatesState === "approved" ||
    raw.wizard_state?.sampleDecision?.decision === "approved"
  );

  const resolvedSampleRateOk =
    baseState.sampleRateOk ||
    raw.wizard_state?.sampleRateOk ||
    (isSampleRatesApproved
      ? {
        channel: baseState.sampleApprovalMethod || raw.wizard_state?.sampleApprovalMethod || "Online Link",
        at: baseState.sampleDecision?.at || raw.wizard_state?.sampleDecision?.at || new Date().toISOString(),
        by: baseState.sampleDecision?.by || raw.wizard_state?.sampleDecision?.by || "Client",
        proof: baseState.sampleDecision?.notes
          ? `Approved online via link: "${baseState.sampleDecision.notes}"`
          : "Client approved via online confirmation link",
      }
      : null);

  const resolvedSampleConfirmSent =
    baseState.sampleConfirmSent ||
    raw.wizard_state?.sampleConfirmSent ||
    (baseState.sampleRatesSent ? (baseState.sampleConfirmSent || "WhatsApp") : null) ||
    (raw.wizard_state?.sampleRatesSent ? (raw.wizard_state?.sampleConfirmSent || "WhatsApp") : null) ||
    (isSampleRatesApproved ? (baseState.sampleConfirmSent || raw.wizard_state?.sampleConfirmSent || "Direct") : null);

  const isSampleDtpApproved = Boolean(
    baseState.dtp?.sample?.approved ||
    raw.wizard_state?.dtp?.sample?.approved ||
    baseState.dtp?.sample?.proofFile?.status === "Approved" ||
    raw.wizard_state?.dtp?.sample?.proofFile?.status === "Approved" ||
    (baseState.dtp?.sample?.proofFiles || []).some((f) => f.status === "Approved") ||
    (raw.wizard_state?.dtp?.sample?.proofFiles || []).some((f) => f.status === "Approved") ||
    (raw.sub_jobs || []).some(
      (sj) => (sj.is_sample || raw.order_type === "sample" || raw.job_type === "sample" || raw.wizard_state?.dtp?.sample) &&
      (sj.proof_status === "approved" || sj.master_template_status === "approved")
    )
  );

  const resolvedSampleDtp = {
    ...(baseState.dtp?.sample || {}),
    ...(raw.wizard_state?.dtp?.sample || {}),
  };

  if (isSampleDtpApproved) {
    const appSubJob = (raw.sub_jobs || []).find((sj) => sj.proof_decision?.decision === "approved" || sj.proof_status === "approved");
    const pf = raw.wizard_state?.dtp?.sample?.proofFile || baseState.dtp?.sample?.proofFile;
    if (!resolvedSampleDtp.approved) {
      resolvedSampleDtp.approved = appSubJob?.proof_decision || {
        decision: "approved",
        status: "Approved",
        at: pf?.action_at || appSubJob?.proof_approved_at || new Date().toISOString(),
        by: pf?.action_by || appSubJob?.proof_decision?.by || "Client Link",
        method: "Client Link",
      };
    }
    resolvedSampleDtp.proofSent = resolvedSampleDtp.proofSent || "Approved";
    if (resolvedSampleDtp.proofFile) {
      resolvedSampleDtp.proofFile = { ...resolvedSampleDtp.proofFile, status: "Approved" };
    }
    if (Array.isArray(resolvedSampleDtp.proofFiles)) {
      resolvedSampleDtp.proofFiles = resolvedSampleDtp.proofFiles.map((f) => ({ ...f, status: "Approved" }));
    }
    if (resolvedSampleDtp.content) {
      resolvedSampleDtp.content = { ...resolvedSampleDtp.content, status: "Approved" };
    }
    if (Array.isArray(resolvedSampleDtp.contentFiles)) {
      resolvedSampleDtp.contentFiles = resolvedSampleDtp.contentFiles.map((f) => ({ ...f, status: "Approved" }));
    }
  }

  const resolvedDtp = {
    ...(baseState.dtp || {}),
    ...(raw.wizard_state?.dtp || {}),
    sample: resolvedSampleDtp,
  };

  return {
    ...baseState,
    dtp: resolvedDtp,
    rawJob: raw,
    sampleConfirmSent: resolvedSampleConfirmSent,
    sampleRatesSent: Boolean(resolvedSampleConfirmSent),
    ratesApproved: isSampleRatesApproved,
    sampleConfirmed: isSampleRatesApproved,
    sampleRatesState: isSampleRatesApproved
      ? "approved"
      : (baseState.sampleRatesState || raw.wizard_state?.sampleRatesState || (baseState.sampleDecision?.decision === "revision" ? "revision" : (baseState.sampleRatesState || "awaiting_approval"))),
    sampleRateOk: resolvedSampleRateOk,
    ratesApprovalLog: baseState.ratesApprovalLog || raw.wizard_state?.ratesApprovalLog || resolvedSampleRateOk,
    sampleDecision: baseState.sampleDecision || raw.wizard_state?.sampleDecision || (isSampleRatesApproved ? { decision: "approved" } : null),
    is_lost: isRawLostOrCancelled,
    stage: isRawLostOrCancelled ? "cancelled" : (raw.stage || baseState.stage || "enquiry"),
    lost: raw.lost_reason || raw.wizard_state?.lost || baseState.lost || null,
    lostReason: raw.wizard_state?.lostReason || raw.lost_reason || baseState.lostReason || null,
    lostNotes: raw.wizard_state?.lostNotes || baseState.lostNotes || "",
    lostAt: raw.lost_at || raw.wizard_state?.lostAt || baseState.lostAt || null,
    lostBy: raw.wizard_state?.lostBy || baseState.lostBy || null,
    isLocked: isRawLostOrCancelled,
    the_brief: {
      ...rawBrief,
      ref_files: effRefFiles,
      client_logo: (rawBrief.client_logo && rawBrief.client_logo.length > 0)
        ? rawBrief.client_logo
        : (eObj.globalLogos || eObj.clientLogo || []),
      signatures: (rawBrief.signatures && rawBrief.signatures.length > 0)
        ? rawBrief.signatures
        : (eObj.globalSignatures || eObj.signatures || []),
      additional_files: (rawBrief.additional_files && rawBrief.additional_files.length > 0)
        ? rawBrief.additional_files
        : (eObj.globalAdditionalFiles || eObj.additionalFiles || []),
      options_shared: optionsSharedVal ? true : false,
      design_status: isJobDesignApproved ? "approved" : (hasUploadedSubJobs ? "uploaded" : (rawBrief.design_status || baseState.designStatus || "pending")),
    },
    sub_jobs: raw.sub_jobs || baseState.sub_jobs || [],
    financials: raw.financials || baseState.financials || {},
    optionsShared: optionsSharedVal,
    optionsSharedChannel: optionsSharedChannelVal,
    designApproved: isJobDesignApproved,
    designStatus: isJobDesignApproved ? "approved" : (hasUploadedSubJobs ? "uploaded" : (baseState.designStatus || rawBrief.design_status || "pending")),
    quoteApproved: isJobQuoteApproved,
    client_quote_decision: resolvedQuoteDecision,
    decision: resolvedDecisionObj,
    quoted: Boolean(raw.wizard_state?.quoted || baseState.quoted || activeSubJobsForQuote.some((sj) => sj.quote_shared)),
    productFeedback: baseState.productFeedback || {},
    uploadedDesigns: baseState.uploadedDesigns || (raw.wizard_state?.uploadedDesigns) || {},
    billTo: baseState.billTo || raw.order_mode?.bill_to || raw.wizard_state?.billTo || null,
    charge: baseState.charge || raw.order_mode?.charge || raw.wizard_state?.charge || "foc",
    sampleRate: (() => {
      const ch = baseState.charge || raw.order_mode?.charge || raw.wizard_state?.charge || "foc";
      const fallbackSum = (raw.sub_jobs || []).reduce((acc, sj) => {
        return acc + Number(sj.sample_rate || (sj.unit_rate ? sj.unit_rate + 200 : 0));
      }, 0);
      if (baseState.sampleRate !== undefined && Number(baseState.sampleRate) > 0) return Number(baseState.sampleRate);
      if (raw.order_mode?.sample_rate !== undefined && Number(raw.order_mode.sample_rate) > 0) return Number(raw.order_mode.sample_rate);
      return ch !== "foc" ? fallbackSum : 0;
    })(),
    sampleRateManual: (() => {
      const ch = baseState.charge || raw.order_mode?.charge || raw.wizard_state?.charge || "foc";
      const fallbackSum = (raw.sub_jobs || []).reduce((acc, sj) => {
        return acc + Number(sj.sample_rate || (sj.unit_rate ? sj.unit_rate + 200 : 0));
      }, 0);
      if (baseState.sampleRateManual !== undefined && Number(baseState.sampleRateManual) > 0) return Number(baseState.sampleRateManual);
      if (raw.wizard_state?.sampleRateManual !== undefined && Number(raw.wizard_state.sampleRateManual) > 0) return Number(raw.wizard_state.sampleRateManual);
      if (raw.order_mode?.sample_rate !== undefined && Number(raw.order_mode.sample_rate) > 0) return Number(raw.order_mode.sample_rate);
      return ch !== "foc" ? fallbackSum : 0;
    })(),
    sampleQty: baseState.sampleQty || raw.order_mode?.sample_qty || raw.wizard_state?.sampleQty || 1,
    sampleBillingParty: baseState.sampleBillingParty || raw.wizard_state?.sampleBillingParty || "client",
    sampleFreight: baseState.sampleFreight || raw.wizard_state?.sampleFreight || (raw.delivery_details?.who_pays === "Client" ? "Client pays freight" : "We pay freight"),
    sampleCarrier: baseState.sampleCarrier || raw.delivery_details?.delivery_mode || raw.wizard_state?.sampleCarrier || "",
    sampleShipTo: baseState.sampleShipTo || raw.delivery_details?.shipping_address || raw.wizard_state?.sampleShipTo || "",
    sampleAddress: baseState.sampleAddress || raw.delivery_details?.shipping_address || raw.wizard_state?.sampleAddress || null,
    sampleChargesAmount: baseState.sampleChargesAmount !== undefined
      ? baseState.sampleChargesAmount
      : (raw.delivery_details?.delivery_cost !== undefined ? raw.delivery_details.delivery_cost : 0),
    sampleGst: baseState.sampleGst !== undefined
      ? baseState.sampleGst
      : (raw.wizard_state?.sampleGst !== undefined ? raw.wizard_state.sampleGst : 18),
    sampleGstIncl: baseState.sampleGstIncl !== undefined
      ? baseState.sampleGstIncl
      : (raw.wizard_state?.sampleGstIncl !== undefined ? raw.wizard_state.sampleGstIncl : false),
    dbJobId: raw._id || job._id,
    clientId: resolvedClientId,
    contactId: resolvedContactId,
    shipToId: resolvedShipToId,
    coordinator: resolvedCoordinator,
    qty: resolvedQty,
    step: baseState.step !== undefined ? baseState.step : (raw.step || 0),
    seq: (raw.seq || parseInt(String(raw.enquiry_no || job.id || "").replace(/\D/g, ""), 10)) || baseState.seq || defaultSeqCount,
    leadDate: baseState.leadDate || needDate,
    jobDeliveryDate: baseState.jobDeliveryDate || compDate,
    e: {
      ...eObj,
      briefMode: eObj.briefMode || (Object.keys(effProductBriefs).length > 0 ? "each" : (effBriefText ? "one" : (resolvedGroups?.length > 1 ? "each" : "one"))),
      globalBrief: effBriefText,
      globalRefs: effRefFiles,
      globalLogos: (eObj.globalLogos && eObj.globalLogos.length > 0)
        ? eObj.globalLogos
        : (eObj.clientLogo && eObj.clientLogo.length > 0)
          ? eObj.clientLogo
          : (rawBrief.client_logo && rawBrief.client_logo.length > 0)
            ? rawBrief.client_logo
            : [],
      clientLogo: (eObj.clientLogo && eObj.clientLogo.length > 0)
        ? eObj.clientLogo
        : (eObj.globalLogos && eObj.globalLogos.length > 0)
          ? eObj.globalLogos
          : (rawBrief.client_logo && rawBrief.client_logo.length > 0)
            ? rawBrief.client_logo
            : [],
      clientLogos: (eObj.clientLogos && eObj.clientLogos.length > 0)
        ? eObj.clientLogos
        : (eObj.globalLogos && eObj.globalLogos.length > 0)
          ? eObj.globalLogos
          : (rawBrief.client_logo && rawBrief.client_logo.length > 0)
            ? rawBrief.client_logo
            : [],
      globalSignatures: (eObj.globalSignatures && eObj.globalSignatures.length > 0)
        ? eObj.globalSignatures
        : (eObj.signatures && eObj.signatures.length > 0)
          ? eObj.signatures
          : (rawBrief.signatures && rawBrief.signatures.length > 0)
            ? rawBrief.signatures
            : [],
      signatures: (eObj.signatures && eObj.signatures.length > 0)
        ? eObj.signatures
        : (eObj.globalSignatures && eObj.globalSignatures.length > 0)
          ? eObj.globalSignatures
          : (rawBrief.signatures && rawBrief.signatures.length > 0)
            ? rawBrief.signatures
            : [],
      globalAdditionalFiles: (eObj.globalAdditionalFiles && eObj.globalAdditionalFiles.length > 0)
        ? eObj.globalAdditionalFiles
        : (eObj.additionalFiles && eObj.additionalFiles.length > 0)
          ? eObj.additionalFiles
          : (eObj.additional_files && eObj.additional_files.length > 0)
            ? eObj.additional_files
            : (rawBrief.additional_files && rawBrief.additional_files.length > 0)
              ? rawBrief.additional_files
              : [],
      additionalFiles: (eObj.additionalFiles && eObj.additionalFiles.length > 0)
        ? eObj.additionalFiles
        : (eObj.globalAdditionalFiles && eObj.globalAdditionalFiles.length > 0)
          ? eObj.globalAdditionalFiles
          : (rawBrief.additional_files && rawBrief.additional_files.length > 0)
            ? rawBrief.additional_files
            : [],
      additional_files: (eObj.additional_files && eObj.additional_files.length > 0)
        ? eObj.additional_files
        : (eObj.globalAdditionalFiles && eObj.globalAdditionalFiles.length > 0)
          ? eObj.globalAdditionalFiles
          : (rawBrief.additional_files && rawBrief.additional_files.length > 0)
            ? rawBrief.additional_files
            : [],
      productBriefs: effProductBriefs,
      designer: effDesignNeeded,
      assignedDesigner: effDesignerId,
      assignedDesignerName: effDesignerName,
      designer_id: effDesignerId,
      designer_name: effDesignerName,
      showRDLogo: rawBrief.show_logo !== undefined ? rawBrief.show_logo : (eObj.showRDLogo !== undefined ? eObj.showRDLogo : true),
      showRDContent: rawBrief.show_content ?? eObj.showRDContent ?? false,
      quoteOnly: rawBrief.quote_only ?? eObj.quoteOnly ?? false,
      copyrightContent: rawBrief.copyright_content || eObj.copyrightContent || "This artwork is the intellectual property of RD Custom Awards Pvt. Ltd., and all copyrights are held exclusively by RD Custom Awards Pvt. Ltd",
      copyright_content: rawBrief.copyright_content || eObj.copyrightContent || "This artwork is the intellectual property of RD Custom Awards Pvt. Ltd., and all copyrights are held exclusively by RD Custom Awards Pvt. Ltd",
      size: resolvedSize,
      qty: resolvedQty,
      designOptions: raw.the_brief?.options_count || eObj.designOptions || (resolvedGroups?.[0]?.items?.[0]?.designOptions) || 2,
      theme: eObj.theme || raw.the_ask?.theme || "Custom Trophy",
      productName: eObj.productName || raw.the_ask?.product_name || "Custom Trophy",
      material: eObj.material || raw.the_ask?.material || (raw.sub_jobs?.[0]?.material) || "MDF",
      colourQuantities: resolvedGroups?.[0]?.items?.[0]?.colourQuantities || [],
      colour: resolvedGroups?.[0]?.items?.[0]?.colour || "",
      customFinishes: resolvedGroups?.[0]?.items?.[0]?.customFinishes || [],
      sizeDimensions: resolvedGroups?.[0]?.items?.[0]?.sizeDimensions || [],
      sizeRate: resolvedGroups?.[0]?.items?.[0]?.sizeRate || 0,
      spec: {
        ...(eObj.spec || {}),
        ...(resolvedGroups?.[0]?.items?.[0]?.spec || {}),
        colourQuantities: resolvedGroups?.[0]?.items?.[0]?.colourQuantities || [],
        colour: resolvedGroups?.[0]?.items?.[0]?.colour || "",
        customFinishes: resolvedGroups?.[0]?.items?.[0]?.customFinishes || [],
        sizeDimensions: resolvedGroups?.[0]?.items?.[0]?.sizeDimensions || [],
        sizeRate: resolvedGroups?.[0]?.items?.[0]?.sizeRate || 0,
      },
      trophyGroups: resolvedGroups || [
        {
          theme: raw.the_ask?.theme || "Custom Trophy",
          kind: "custom",
          type: "Trophy",
          mat: raw.the_ask?.material || "MDF",
          items: [{ size: resolvedSize, qty: resolvedQty, budget: 850, designOptionsCount: 2 }],
        },
      ],
      event_date: evDate,
      delivery_date: needDate,
      job_completion_date: compDate,
    },
  };
}
