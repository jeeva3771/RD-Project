/**
 * Utility helper to build the sub_jobs array payload for synchronization with backend.
 * Extracted from EnquiryFlow.jsx to maintain modular architecture and strict < 1,500 lines limit.
 */
export function buildSubJobsPayload(currentState, parentNo) {
  const subJobs = [];
  if (currentState.e?.trophyGroups && Array.isArray(currentState.e.trophyGroups)) {
    currentState.e.trophyGroups.forEach((group, gIdx) => {
      const groupChar = String.fromCharCode(65 + gIdx);
      (group.items || [{ size: 8, qty: currentState.qty || 50 }]).forEach((item, sIdx) => {
        const subJobNo = `${parentNo}-${groupChar}${sIdx + 1}`;
        const pBriefObj =
          currentState.e?.productBriefs?.[group.theme] ||
          currentState.e?.productBriefs?.[group.productName] ||
          currentState.e?.productBriefs?.[group.name] ||
          {};

        const sjDesignerId =
          pBriefObj.assignedDesigner ||
          pBriefObj.designerId ||
          currentState.e?.assignedDesigner ||
          currentState.e?.designer_id ||
          "";

        const sjDesignerName =
          pBriefObj.designerName ||
          pBriefObj.assignedDesignerName ||
          currentState.e?.assignedDesignerName ||
          currentState.e?.designer_name ||
          "";

        const sjBriefText =
          pBriefObj.brief ||
          currentState.brief ||
          currentState.e?.globalBrief ||
          "";

        const sjRefFiles =
          (pBriefObj.refs && pBriefObj.refs.length > 0)
            ? pBriefObj.refs
            : ((currentState.e?.globalRefs && currentState.e.globalRefs.length > 0) ? currentState.e.globalRefs : (currentState.refFiles || []));

        const sjDesignNeeded =
          group.kind === "ready"
            ? false
            : (pBriefObj.designer !== undefined ? pBriefObj.designer : (currentState.e?.designer ?? true));

        const sjOptionsCount =
          pBriefObj.designOptions ||
          item.spec?.designOptions ||
          currentState.e?.designOptions ||
          2;

        const matchedExisting = Array.isArray(currentState.sub_jobs)
          ? currentState.sub_jobs.find((sj) => sj.sub_job_no === subJobNo || sj.sub_job_no?.endsWith(`${groupChar}${sIdx + 1}`))
          : null;

        const rateKey = `${gIdx}-${sIdx}`;
        const simRateEntry = currentState.simulatedRates?.[rateKey] || currentState.simulatedRates?.[subJobNo];
        const simRate = Number(simRateEntry?.rate || 0);
        const simSample = Number(simRateEntry?.sample || 0);
        const simArtwork = Number(simRateEntry?.artwork || 0);

        const effTargetRate =
          item.budget !== undefined && item.budget !== "" && Number(item.budget) >= 0
            ? Number(item.budget)
            : item.rate !== undefined && Number(item.rate) > 0
              ? Number(item.rate)
              : matchedExisting?.target_rate !== undefined && Number(matchedExisting.target_rate) > 0
                ? Number(matchedExisting.target_rate)
                : 0;

        const effBomId = item.bom_id || matchedExisting?.bom_id || null;
        const isCostingDone = Boolean(
          Boolean(effBomId) ||
          (matchedExisting?.costing_status === "completed" && Boolean(effBomId)) ||
          (simRate > 0 && simRateEntry?.isManualSaved)
        );

        // Calculated quotation/BOM rate takes precedence ONLY when costing is completed
        const effUnitRate = isCostingDone
          ? (simRate > 0 && (simRateEntry?.bom_id || simRateEntry?.isManualSaved)
            ? simRate
            : item.unit_rate !== undefined && Number(item.unit_rate) > 0 && Boolean(effBomId)
              ? Number(item.unit_rate)
              : (matchedExisting?.unit_rate !== undefined && Number(matchedExisting.unit_rate) > 0 && Boolean(effBomId))
                ? Number(matchedExisting.unit_rate)
                : 0)
          : 0;

        const effSampleRate =
          simSample > 0
            ? simSample
            : item.sampleRate !== undefined && Number(item.sampleRate) > 0
              ? Number(item.sampleRate)
              : (matchedExisting?.sample_rate !== undefined && Number(matchedExisting.sample_rate) > 0)
                ? Number(matchedExisting.sample_rate)
                : effUnitRate > 0 ? (effUnitRate + 200) : 0;

        const effArtworkCharge =
          simArtwork > 0
            ? simArtwork
            : item.artworkCharge !== undefined && Number(item.artworkCharge) >= 0
              ? Number(item.artworkCharge)
              : (matchedExisting?.artwork_charge !== undefined ? Number(matchedExisting.artwork_charge) : 0);

        const effCostingStatus = isCostingDone
          ? "completed"
          : (matchedExisting?.costing_status === "completed" && !effBomId)
            ? "pending"
            : (item.costing_status === "completed" && !effBomId)
              ? "pending"
              : (item.costing_status || matchedExisting?.costing_status || "not_requested");

        const effQuantity = Number(item.qty || currentState.qty || currentState.e?.qty || 50);

        const effColours = Array.isArray(item.colourQuantities)
          ? item.colourQuantities
          : (Array.isArray(item.spec?.colourQuantities) ? item.spec.colourQuantities : []);

        const effColour = item.colour !== undefined
          ? item.colour
          : (item.spec?.colour !== undefined ? item.spec.colour : "");

        const effCustoms = Array.isArray(item.customFinishes)
          ? item.customFinishes
          : (Array.isArray(item.spec?.customFinishes) ? item.spec.customFinishes : []);

        const effDims = Array.isArray(item.sizeDimensions)
          ? item.sizeDimensions
          : (Array.isArray(item.spec?.sizeDimensions) ? item.spec.sizeDimensions : []);

        const effSizeRate = item.sizeRate !== undefined ? item.sizeRate : (item.spec?.sizeRate || 0);

        const syncedSpec = { ...(item.spec || {}) };
        if (effColours.length > 0) {
          syncedSpec.colourQuantities = effColours;
        } else {
          delete syncedSpec.colourQuantities;
        }
        if (effColour && String(effColour).trim()) {
          syncedSpec.colour = String(effColour).trim();
        } else {
          delete syncedSpec.colour;
        }
        if (effCustoms.length > 0) {
          syncedSpec.customFinishes = effCustoms;
        } else {
          delete syncedSpec.customFinishes;
        }
        if (effDims.length > 0) {
          syncedSpec.sizeDimensions = effDims;
        } else {
          delete syncedSpec.sizeDimensions;
        }
        if (effSizeRate !== undefined) {
          syncedSpec.sizeRate = effSizeRate;
        }

        const isTrophyProduct = (group.productType || group.kind || group.type || "").toLowerCase().includes("trophy") || (group.productType || group.kind || group.type || "").toLowerCase().includes("memento");
        if (!isTrophyProduct) {
          delete syncedSpec.trophyW;
          delete syncedSpec.trophyD;
          delete syncedSpec.trophyH;
        }
        syncedSpec.budget = Number(item.budget !== undefined && item.budget !== "" ? item.budget : effTargetRate);

        subJobs.push({
          sub_job_no: subJobNo,
          design_group: groupChar,
          size_variant: sIdx + 1,
          trophy_type: group.productType || group.kind || "custom",
          sku: group.sku || "",
          theme: group.theme || currentState.e?.theme || "Custom Trophy",
          product_name: group.productName || group.theme || group.type || group.productType || currentState.e?.productName || currentState.e?.theme || "Custom Trophy",
          size: String(item.size || currentState.e?.size || 8),
          material: Array.isArray(group.mats) ? group.mats.join(" + ") : (group.mat || currentState.e?.material || "MDF"),
          budget: Number(item.budget !== undefined && item.budget !== "" ? item.budget : effTargetRate),
          target_rate: Number(Number(effTargetRate).toFixed(2)),
          unit_rate: Number(Number(effUnitRate).toFixed(2)),
          sample_rate: Number(Number(effSampleRate).toFixed(2)),
          artwork_charge: Number(Number(effArtworkCharge).toFixed(2)),
          bom_id: effBomId,
          costing_status: effCostingStatus,
          costing_requested_at: matchedExisting?.costing_requested_at || null,
          costing_completed_at: isCostingDone ? (matchedExisting?.costing_completed_at || new Date().toISOString()) : null,
          quote_shared: matchedExisting?.quote_shared || false,
          quote_shared_at: matchedExisting?.quote_shared_at || null,
          quote_channel: matchedExisting?.quote_channel || null,
          client_quote_decision:
            matchedExisting?.client_quote_decision && matchedExisting.client_quote_decision !== "pending"
              ? matchedExisting.client_quote_decision
              : (currentState.quoteApproved ? "approved" : currentState.client_quote_decision || "pending"),
          client_quote_decision_at: matchedExisting?.client_quote_decision_at || currentState.decision?.at || null,
          client_quote_decision_notes: matchedExisting?.client_quote_decision_notes || currentState.decision?.notes || "",
          client_quote_communication: matchedExisting?.client_quote_communication || currentState.decision?.channel || "",
          proof_files: matchedExisting?.proof_files || [],
          design_files: matchedExisting?.design_files || [],
          quantity: Number(item.qty || currentState.qty || currentState.e?.qty || 50),
          colourQuantities: effColours,
          colour: effColour || "",
          customFinishes: effCustoms,
          sizeDimensions: effDims,
          sizeRate: effSizeRate,
          spec: syncedSpec,
          line_total: (Number(item.qty) || currentState.qty || 50) * (item.rate || item.budget || 0),
          spec_line: item.specLine || "",
          designer_id: sjDesignerId,
          designer_name: sjDesignerName,
          assigned_designer: sjDesignerId,
          assigned_designer_name: sjDesignerName,
          brief_text: sjBriefText,
          ref_files: sjRefFiles,
          client_logo: (pBriefObj.clientLogo && pBriefObj.clientLogo.length > 0) ? pBriefObj.clientLogo : (pBriefObj.client_logo && pBriefObj.client_logo.length > 0 ? pBriefObj.client_logo : (currentState.e?.globalLogos && currentState.e.globalLogos.length > 0 ? currentState.e.globalLogos : (currentState.e?.clientLogo || currentState.e?.clientLogos || currentState.clientLogo || []))),
          signatures: (pBriefObj.signatures && pBriefObj.signatures.length > 0) ? pBriefObj.signatures : (currentState.e?.globalSignatures && currentState.e.globalSignatures.length > 0 ? currentState.e.globalSignatures : (currentState.e?.signatures || currentState.the_brief?.signatures || [])),
          additional_files: (pBriefObj.additionalFiles && pBriefObj.additionalFiles.length > 0) ? pBriefObj.additionalFiles : (pBriefObj.additional_files && pBriefObj.additional_files.length > 0 ? pBriefObj.additional_files : (currentState.e?.globalAdditionalFiles && currentState.e.globalAdditionalFiles.length > 0 ? currentState.e.globalAdditionalFiles : (currentState.e?.additionalFiles || currentState.e?.additional_files || currentState.the_brief?.additional_files || []))),
          is_logo_mandatory: Boolean(pBriefObj.is_logo_mandatory ?? pBriefObj.isLogoMandatory ?? currentState.e?.is_logo_mandatory ?? currentState.e?.isLogoMandatory ?? false),
          is_signature_mandatory: Boolean(pBriefObj.is_signature_mandatory ?? pBriefObj.isSignatureMandatory ?? currentState.e?.is_signature_mandatory ?? currentState.e?.isSignatureMandatory ?? false),
          is_additional_files_mandatory: Boolean(pBriefObj.is_additional_files_mandatory ?? pBriefObj.isAdditionalFilesMandatory ?? currentState.e?.is_additional_files_mandatory ?? currentState.e?.isAdditionalFilesMandatory ?? false),
          design_needed: sjDesignNeeded,
          options_count: sjOptionsCount,
          quote_only: !!(pBriefObj.quoteOnly ?? currentState.e?.quoteOnly),
          show_rd_logo: Boolean(currentState.e?.showRDLogo !== undefined ? currentState.e.showRDLogo : (pBriefObj.showRDLogo !== undefined ? pBriefObj.showRDLogo : true)),
          show_rd_content: Boolean(currentState.e?.showRDContent ?? pBriefObj.showRDContent ?? false),
          is_on_hold: Boolean(
            item.is_on_hold !== undefined
              ? item.is_on_hold
              : ((group.items && group.items.length > 1) ? false : group.is_on_hold)
          ),
          hold_reason: item.hold_reason || ((group.items && group.items.length > 1) ? "" : group.hold_reason) || "",
          is_dropped: Boolean(
            item.is_dropped !== undefined
              ? item.is_dropped
              : ((group.items && group.items.length > 1) ? false : group.is_dropped)
          ),
          drop_reason: item.drop_reason || ((group.items && group.items.length > 1) ? "" : group.drop_reason) || "",
          design_approved: Boolean(matchedExisting?.design_approved),
          design_status: matchedExisting?.design_status || "pending",
          design_approved_at: matchedExisting?.design_approved_at || null,
          approved_design_option: matchedExisting?.approved_design_option ?? null,
          approved_design_url: matchedExisting?.approved_design_url || null,
          approved_designs: matchedExisting?.approved_designs || [],
          product_feedback: matchedExisting?.product_feedback || null,
          designer_files: matchedExisting?.designer_files || [],
          is_design_uploaded: Boolean(matchedExisting?.is_design_uploaded),
          // Strictly preserve DTP Studio & Proof approval fields:
          dtp_id: matchedExisting?.dtp_id || null,
          proof_status: matchedExisting?.proof_status || "pending",
          master_template_status: matchedExisting?.master_template_status || "pending",
          content_proof_status: matchedExisting?.content_proof_status || "pending",
          proof_decision: matchedExisting?.proof_decision || null,
          proof_approved_at: matchedExisting?.proof_approved_at || null,
          master_template_approved_at: matchedExisting?.master_template_approved_at || null,
          content_proof_approved_at: matchedExisting?.content_proof_approved_at || null,
          dtp_files: matchedExisting?.dtp_files || [],
          sample_order_id: matchedExisting?.sample_order_id || null,
          sample_order_nanoid: matchedExisting?.sample_order_nanoid || null,
          sales_order_id: matchedExisting?.sales_order_id || null,
          sales_order_nanoid: matchedExisting?.sales_order_nanoid || null,
          sample_qty: matchedExisting?.sample_qty !== undefined ? matchedExisting.sample_qty : (currentState.order_mode?.sample_qty || 1),
          is_sample_approved: Boolean(matchedExisting?.is_sample_approved || currentState.order_mode?.sample_approved),
          is_sample: matchedExisting?.is_sample !== undefined ? matchedExisting.is_sample : (currentState.mode === "sample"),
          stage: currentState.sent
            ? (currentState.mode === "sample" ? "sample" : "production")
            : (currentState.enqSent ? "brief" : "enquiry"),
        });
      });
    });
  }

  // Default sub-job fallback if empty
  if (subJobs.length === 0) {
    const matchedExisting0 = Array.isArray(currentState.sub_jobs) ? currentState.sub_jobs[0] : null;
    const effSize = String(currentState.e?.size || (matchedExisting0?.size) || "8");
    const effQty = Number(currentState.e?.qty || currentState.qty || (matchedExisting0?.quantity) || 50);

    subJobs.push({
      sub_job_no: `${parentNo}-A1`,
      design_group: "A",
      size_variant: 1,
      trophy_type: "custom",
      theme: currentState.e?.theme || "Custom Trophy",
      product_name: currentState.e?.productName || "Custom Trophy",
      size: effSize,
      material: currentState.e?.material || "MDF",
      quantity: effQty,
      target_rate: 0,
      line_total: 0,
      design_approved: Boolean(matchedExisting0?.design_approved),
      design_status: matchedExisting0?.design_status || "pending",
      design_approved_at: matchedExisting0?.design_approved_at || null,
      approved_design_option: matchedExisting0?.approved_design_option ?? null,
      approved_design_url: matchedExisting0?.approved_design_url || null,
      approved_designs: matchedExisting0?.approved_designs || [],
      product_feedback: matchedExisting0?.product_feedback || null,
      designer_files: matchedExisting0?.designer_files || [],
      is_design_uploaded: Boolean(matchedExisting0?.is_design_uploaded),
      // Strictly preserve DTP Studio & Proof approval fields:
      dtp_id: matchedExisting0?.dtp_id || null,
      proof_status: matchedExisting0?.proof_status || "pending",
      master_template_status: matchedExisting0?.master_template_status || "pending",
      content_proof_status: matchedExisting0?.content_proof_status || "pending",
      proof_decision: matchedExisting0?.proof_decision || null,
      proof_approved_at: matchedExisting0?.proof_approved_at || null,
      master_template_approved_at: matchedExisting0?.master_template_approved_at || null,
      content_proof_approved_at: matchedExisting0?.content_proof_approved_at || null,
      dtp_files: matchedExisting0?.dtp_files || [],
      proof_files: matchedExisting0?.proof_files || [],
      sample_order_id: matchedExisting0?.sample_order_id || null,
      sample_order_nanoid: matchedExisting0?.sample_order_nanoid || null,
      sales_order_id: matchedExisting0?.sales_order_id || null,
      sales_order_nanoid: matchedExisting0?.sales_order_nanoid || null,
      sample_qty: matchedExisting0?.sample_qty !== undefined ? matchedExisting0.sample_qty : (currentState.order_mode?.sample_qty || 1),
      sample_rate: matchedExisting0?.sample_rate !== undefined ? matchedExisting0.sample_rate : 0,
      is_sample_approved: Boolean(matchedExisting0?.is_sample_approved || currentState.order_mode?.sample_approved),
      is_sample: matchedExisting0?.is_sample !== undefined ? matchedExisting0.is_sample : (currentState.mode === "sample"),
      stage: currentState.sent
        ? (currentState.mode === "sample" ? "sample" : "production")
        : (currentState.enqSent ? "brief" : "enquiry"),
    });
  }

  return subJobs;
}
