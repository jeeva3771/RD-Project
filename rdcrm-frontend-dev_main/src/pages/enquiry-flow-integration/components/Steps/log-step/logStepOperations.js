import { axiosInstance } from "../../../../../utils/url/config";
import { toast } from "react-toastify";
import {
  allReady,
  matLabel,
  dfmt,
  inr,
  proofLine,
  quoteRecipient,
  formatEnquiryNo,
  ENQUIRY_CONFIG,
  deriveDocNo,
} from "../../../utils/helpers";

/**
 * Normalizes 1-time artwork charge across sub-jobs.
 * Exactly ONE active sub-job carries the 1-time artwork charge (default ₹1,500).
 * All other sub-jobs in the enquiry are assigned 0.
 */
export const normalizeJobArtworkCharge = (subJobs = [], defaultFee = 1500) => {
  if (!Array.isArray(subJobs) || subJobs.length === 0) return subJobs;

  // Find first active (non-dropped) sub-job that explicitly has an artwork charge > 0
  let bearerIndex = subJobs.findIndex(
    (sj) => !sj.isDrop && !sj.is_dropped && Number(sj.artworkCharge ?? sj.artwork_charge ?? 0) > 0
  );

  // If no active sub-job has artwork > 0, assign to first active sub-job
  if (bearerIndex === -1) {
    bearerIndex = subJobs.findIndex((sj) => !sj.isDrop && !sj.is_dropped);
  }

  // Fallback to index 0 if all are dropped
  if (bearerIndex === -1 && subJobs.length > 0) {
    bearerIndex = 0;
  }

  return subJobs.map((sj, idx) => {
    const isBearer = idx === bearerIndex;
    let fee = 0;
    if (isBearer) {
      const existingFee = Number(sj.artworkCharge ?? sj.artwork_charge ?? 0);
      fee = existingFee > 0 ? existingFee : defaultFee;
    }
    return {
      ...sj,
      artworkCharge: fee,
      artwork_charge: fee,
      isArtworkBearer: isBearer,
    };
  });
};

export const buildLifecycleSteps = (
  s,
  e,
  ids,
  heat,
  canAssign,
  client,
  productsList
) => {
  const quoted = s.quoted;
  const c = s.costing;
  const hasCustom = productsList.length > 0
    ? productsList.some((p) => p.kind !== "ready")
    : !allReady(s);
  const isDesignerNeeded = (e.designer !== false) && hasCustom;
  const hasProductionArtworkUpload = (Array.isArray(s.sub_jobs) ? s.sub_jobs : []).some(
    (sj) =>
      !sj.is_dropped &&
      !sj.is_on_hold &&
      (Boolean(sj.is_design_uploaded) ||
        (Array.isArray(sj.designer_files) && sj.designer_files.length > 0) ||
        (Array.isArray(sj.dtp_files) && sj.dtp_files.length > 0))
  );
  const optDone = !isDesignerNeeded || (s.optionsShared && s.designApproved && hasProductionArtworkUpload);

  return [
    {
      t: "Enquiry logged",
      s: `${ids?.enq || (s?.seq ? formatEnquiryNo(s.seq) : ENQUIRY_CONFIG.DEFAULT_ENQUIRY_NO)} · ${
        heat ? heat.label : ""
      }${canAssign ? ` · assigned to ${s.coordinator}` : ""}`,
      done: true,
    },
    ...(isDesignerNeeded
      ? [
          {
            t: `Design options sent${
              (s.designRound || 1) > 1 ? ` (round ${s.designRound})` : ""
            }`,
            s: s.optionsShared
              ? `To client · via ${s.designVia || "share"}`
              : `Due in ${e.due || 24} hours · Design`,
            done: !!s.optionsShared,
            now: !s.optionsShared,
          },
          {
            t: "Design approved",
            s: s.designApproved
              ? `Approved by client`
              : s.optionsShared
              ? "Waiting for client approval"
              : "Pending",
            done: !!s.designApproved,
            now: s.optionsShared && !s.designApproved,
          },
          {
            t: "Artwork / Production file uploaded",
            s: hasProductionArtworkUpload
              ? "Uploaded by designer"
              : s.designApproved
              ? "Awaiting designer production artwork upload"
              : "Pending",
            done: hasProductionArtworkUpload,
            now: s.designApproved && !hasProductionArtworkUpload,
          },
        ]
      : []),
    {
      t: allReady(s)
        ? "Priced from ready-stock list"
        : "Rate requested from Costing",
      s: s.costReq && (!isDesignerNeeded || hasProductionArtworkUpload)
        ? `Sent ${dfmt(s.costReq)} · ${e.qty || 100} pcs, ${e.size || 8} in, ${matLabel(e)}`
        : isDesignerNeeded
        ? "Unlocked after approved design artwork is uploaded"
        : "Send once spec is clear",
      done: !!s.costReq && (!isDesignerNeeded || hasProductionArtworkUpload),
      now: optDone && (!isDesignerNeeded || hasProductionArtworkUpload) && !s.costReq,
    },
    {
      t: c ? "Rate received from Costing" : "Awaiting Costing rate",
      s: c
        ? `${inr(Number(c.rate || 0).toFixed(2))}/pc · sample ${inr(
            Number(c.sampleRate || (c.rate ? c.rate + 200 : 0)).toFixed(2)
          )}/pc`
        : s.costReq
        ? "Waiting for Costing"
        : "",
      done: !!c,
      now: !!s.costReq && !c,
    },
    {
      t: `Quote sent to ${quoteRecipient(s, client)}`,
      s: quoted
        ? `${ids?.qt || deriveDocNo(ids?.enq || s?.enquiry_no, "QT")} · via ${
            s.quoteVia
          }`
        : c
        ? "Preview and send"
        : "",
      done: !!quoted,
      now: !!c && !quoted,
    },
    {
      t: "Client decision",
      s: s.lost
        ? `Lost · ${s.lost}`
        : s.decision
        ? `Won · ${proofLine(s.decision)}`
        : quoted
        ? "Waiting on client"
        : "After quote",
      done: !!s.lost || !!s.decision,
      now: quoted && !s.lost && !s.decision,
    },
  ];
};

export const computeFlattenedProducts = (
  productsList,
  e,
  unselectedProducts,
  parentJobNo,
  dbSubJobs,
  simulatedRates
) => {
  const flattened = [];
  productsList.forEach((p, i) => {
    const groupChar = String.fromCharCode(65 + i);
    const itemsToMap =
      p.items && p.items.length > 0
        ? p.items
        : [{ size: e.size || 8, qty: e.qty || 50 }];

    itemsToMap.forEach((item, j) => {
      if (unselectedProducts.has(i)) return;
      const subJobSuffix = `${groupChar}${j + 1}`;
      const subJobNo = `${parentJobNo}-${subJobSuffix}`;
      const rateKey = `${i}-${j}`;

      const matchedDb = dbSubJobs.find(
        (sj) => sj.sub_job_no === subJobNo || sj.sub_job_no?.endsWith(subJobSuffix)
      );

      const hasSimulatedCosting =
        Boolean(
          simulatedRates?.[rateKey]?.costing_status === "completed" &&
            simulatedRates?.[rateKey]?.bom_id
        ) ||
        Boolean(simulatedRates?.[rateKey]?.isManualSaved) ||
        Boolean(
          simulatedRates?.[subJobNo]?.costing_status === "completed" &&
            simulatedRates?.[subJobNo]?.bom_id
        );

      const hasDbCosting =
        Boolean(matchedDb?.bom_id) ||
        Boolean(item.bom_id) ||
        (matchedDb?.costing_status === "completed" && Boolean(matchedDb?.bom_id));

      const isCostingCompleted = Boolean(hasSimulatedCosting || hasDbCosting);

      const costedUnitRate = !isCostingCompleted
        ? 0
        : simulatedRates?.[rateKey]?.bom_id &&
          Number(simulatedRates[rateKey].rate) > 0
        ? Number(simulatedRates[rateKey].rate)
        : simulatedRates?.[subJobNo]?.bom_id &&
          Number(simulatedRates[subJobNo].rate) > 0
        ? Number(simulatedRates[subJobNo].rate)
        : simulatedRates?.[rateKey]?.isManualSaved &&
          Number(simulatedRates[rateKey].rate) > 0
        ? Number(simulatedRates[rateKey].rate)
        : matchedDb?.bom_id && Number(matchedDb.unit_rate) > 0
        ? Number(matchedDb.unit_rate)
        : item.bom_id && Number(item.unit_rate) > 0
        ? Number(item.unit_rate)
        : matchedDb?.unit_rate > 0 && isCostingCompleted
        ? Number(matchedDb.unit_rate)
        : 0;

      const resolvedUnitRate = Number(Number(costedUnitRate || 0).toFixed(2));
      const defaultSampleRate =
        resolvedUnitRate > 0 ? Number((resolvedUnitRate + 200).toFixed(2)) : 0;

      const resolvedSampleRate =
        simulatedRates?.[rateKey]?.sample !== undefined
          ? Number(Number(simulatedRates[rateKey].sample).toFixed(2))
          : matchedDb?.sample_rate !== undefined &&
            Number(matchedDb.sample_rate) > 0
          ? Number(Number(matchedDb.sample_rate).toFixed(2))
          : item.sampleRate
          ? Number(Number(item.sampleRate).toFixed(2))
          : defaultSampleRate;

      const resolvedArtwork =
        simulatedRates?.[rateKey]?.artwork !== undefined
          ? Number(Number(simulatedRates[rateKey].artwork).toFixed(2))
          : matchedDb?.artwork_charge !== undefined
          ? Number(Number(matchedDb.artwork_charge).toFixed(2))
          : item.artworkCharge
          ? Number(Number(item.artworkCharge).toFixed(2))
          : 0;

      flattened.push({
        ...p,
        originalProductIndex: i,
        originalItemIndex: j,
        subjobId: subJobSuffix,
        subJobNo: subJobNo,
        size: item.size || e.size || 8,
        qty: item.qty || e.qty || 50,
        rate: resolvedUnitRate,
        unitRate: resolvedUnitRate,
        target_rate: resolvedUnitRate,
        sampleRate: resolvedSampleRate,
        sample_rate: resolvedSampleRate,
        artworkCharge: resolvedArtwork,
        artwork_charge: resolvedArtwork,
        costingStatus: isCostingCompleted
          ? "completed"
          : matchedDb?.costing_status === "completed" && !matchedDb?.bom_id
          ? "pending"
          : item.costing_status === "completed" && !item.bom_id
          ? "pending"
          : matchedDb?.costing_status || item.costing_status || "pending",
        rateKey: rateKey,
        isHold: Boolean(item.is_on_hold || matchedDb?.is_on_hold || p.is_on_hold),
        isDrop: Boolean(item.is_dropped || matchedDb?.is_dropped || p.is_dropped),
      });
    });
  });

  return normalizeJobArtworkCharge(flattened, 1500);
};

export const delinkHoldSubJobs = async ({
  delinkSel,
  delinkReason,
  delinkNote,
  targetDbId,
  parentJobNo,
  e,
  s,
  set,
}) => {
  const fullReason = delinkNote ? `${delinkReason}: ${delinkNote}` : delinkReason;

  for (const subJobNo of delinkSel) {
    if (targetDbId) {
      await axiosInstance
        .post(`/enquiry-flow-integration/${targetDbId}/sub-job/${subJobNo}/hold`, {
          hold: true,
          reason: fullReason,
        })
        .catch(console.warn);
    }
  }

  const updatedTrophyGroups = (e.trophyGroups || []).map((tg, idx) => {
    const groupChar = String.fromCharCode(65 + idx);
    const updatedItems = (tg.items || []).map((item, j) => {
      const subJobNo = `${parentJobNo}-${groupChar}${j + 1}`;
      const isTarget = delinkSel.some(
        (sel) => sel === subJobNo || sel.endsWith(`-${groupChar}${j + 1}`)
      );
      if (isTarget) {
        return {
          ...item,
          is_on_hold: true,
          hold_reason: fullReason,
          held_at: new Date().toISOString(),
        };
      }
      return item;
    });

    const allHeld =
      updatedItems.length > 0 && updatedItems.every((it) => it.is_on_hold);
    return {
      ...tg,
      items: updatedItems,
      is_on_hold: allHeld,
      hold_reason: allHeld ? fullReason : tg.hold_reason,
    };
  });

  const updatedSubJobs = (s.sub_jobs || []).map((sj) => {
    const isTarget = delinkSel.some(
      (sel) =>
        sel === sj.sub_job_no ||
        (sj.sub_job_no && sel.endsWith(sj.sub_job_no)) ||
        (sj.sub_job_no && sj.sub_job_no.endsWith(sel))
    );
    if (isTarget) {
      return {
        ...sj,
        is_on_hold: true,
        hold_reason: fullReason,
        held_at: new Date(),
      };
    }
    return sj;
  });

  set({
    e: { ...e, trophyGroups: updatedTrophyGroups },
    sub_jobs: updatedSubJobs,
    wizard_state: {
      ...(s.wizard_state || s),
      e: { ...e, trophyGroups: updatedTrophyGroups },
      sub_jobs: updatedSubJobs,
    },
  });

  toast.info(`${delinkSel.length} product(s) placed on hold`);
};

export const dropSubJobs = async ({
  delinkSel,
  delinkReason,
  delinkNote,
  targetDbId,
  parentJobNo,
  e,
  s,
  set,
}) => {
  const fullReason = delinkNote ? `${delinkReason}: ${delinkNote}` : delinkReason;

  for (const subJobNo of delinkSel) {
    if (targetDbId) {
      await axiosInstance
        .post(`/enquiry-flow-integration/${targetDbId}/sub-job/${subJobNo}/drop`, {
          reason: fullReason,
        })
        .catch(console.warn);
    }
  }

  const updatedTrophyGroups = (e.trophyGroups || []).map((tg, idx) => {
    const groupChar = String.fromCharCode(65 + idx);
    const updatedItems = (tg.items || []).map((item, j) => {
      const subJobNo = `${parentJobNo}-${groupChar}${j + 1}`;
      const isTarget = delinkSel.some(
        (sel) => sel === subJobNo || sel.endsWith(`-${groupChar}${j + 1}`)
      );
      if (isTarget) {
        return {
          ...item,
          is_dropped: true,
          drop_reason: fullReason,
          dropped_at: new Date().toISOString(),
        };
      }
      return item;
    });

    const allDropped =
      updatedItems.length > 0 && updatedItems.every((it) => it.is_dropped);
    return {
      ...tg,
      items: updatedItems,
      is_dropped: allDropped,
      drop_reason: allDropped ? fullReason : "",
    };
  });

  const updatedSubJobs = (s.sub_jobs || []).map((sj) => {
    const isTarget = delinkSel.some(
      (sel) =>
        sel === sj.sub_job_no ||
        (sj.sub_job_no && sel.endsWith(sj.sub_job_no)) ||
        (sj.sub_job_no && sj.sub_job_no.endsWith(sel))
    );
    if (isTarget) {
      return {
        ...sj,
        is_dropped: true,
        drop_reason: fullReason,
        dropped_at: new Date(),
        stage: "cancelled",
      };
    }
    return sj;
  });

  set({
    e: { ...e, trophyGroups: updatedTrophyGroups },
    sub_jobs: updatedSubJobs,
    wizard_state: {
      ...(s.wizard_state || s),
      e: { ...e, trophyGroups: updatedTrophyGroups },
      sub_jobs: updatedSubJobs,
    },
  });

  toast.info(`${delinkSel.length} product(s) dropped from enquiry`);
};

export const unholdSubJob = async ({
  subJobNo,
  groupChar,
  groupIdx,
  targetDbId,
  parentJobNo,
  e,
  s,
  set,
}) => {
  if (targetDbId && subJobNo) {
    await axiosInstance
      .post(`/enquiry-flow-integration/${targetDbId}/sub-job/${subJobNo}/hold`, {
        hold: false,
        reason: "",
      })
      .catch(console.warn);
  }

  const updatedTrophyGroups = (e.trophyGroups || []).map((tg, idx) => {
    const gChar = String.fromCharCode(65 + idx);
    const updatedItems = (tg.items || []).map((item, j) => {
      const sjNo = `${parentJobNo}-${gChar}${j + 1}`;
      if (
        sjNo === subJobNo ||
        (subJobNo && subJobNo.endsWith(`-${gChar}${j + 1}`))
      ) {
        return {
          ...item,
          is_on_hold: false,
          hold_reason: "",
          held_at: null,
        };
      }
      return item;
    });

    const allHeld =
      updatedItems.length > 0 && updatedItems.every((it) => it.is_on_hold);
    return {
      ...tg,
      items: updatedItems,
      is_on_hold: allHeld,
      hold_reason: allHeld ? tg.hold_reason : "",
    };
  });

  const updatedSubJobs = (s.sub_jobs || []).map((sj) => {
    if (
      sj.sub_job_no === subJobNo ||
      (subJobNo && subJobNo.endsWith(sj.sub_job_no))
    ) {
      return { ...sj, is_on_hold: false, hold_reason: "", held_at: null };
    }
    return sj;
  });

  set({
    e: { ...e, trophyGroups: updatedTrophyGroups },
    sub_jobs: updatedSubJobs,
    wizard_state: {
      ...(s.wizard_state || s),
      e: { ...e, trophyGroups: updatedTrophyGroups },
      sub_jobs: updatedSubJobs,
    },
  });

  toast.success(`${subJobNo || "Product"} resumed!`);
};

export const holdSingleSubJob = async ({
  subJobNo,
  reason,
  targetDbId,
  parentJobNo,
  e,
  s,
  set,
}) => {
  if (targetDbId && subJobNo) {
    await axiosInstance
      .post(`/enquiry-flow-integration/${targetDbId}/sub-job/${subJobNo}/hold`, {
        hold: true,
        reason,
      })
      .catch(console.warn);
  }
  const updatedTrophyGroups = (e.trophyGroups || []).map((tg, idx) => {
    const gChar = String.fromCharCode(65 + idx);
    const updatedItems = (tg.items || []).map((item, j) => {
      const sjNo = `${parentJobNo}-${gChar}${j + 1}`;
      if (
        sjNo === subJobNo ||
        (subJobNo && subJobNo.endsWith(`-${gChar}${j + 1}`))
      ) {
        return {
          ...item,
          is_on_hold: true,
          hold_reason: reason,
          held_at: new Date().toISOString(),
        };
      }
      return item;
    });
    const allHeld =
      updatedItems.length > 0 && updatedItems.every((it) => it.is_on_hold);
    return {
      ...tg,
      items: updatedItems,
      is_on_hold: allHeld,
      hold_reason: allHeld ? reason : tg.hold_reason,
    };
  });
  const updatedSubJobs = (s.sub_jobs || []).map((sj) => {
    if (
      sj.sub_job_no === subJobNo ||
      (subJobNo && subJobNo.endsWith(sj.sub_job_no))
    ) {
      return {
        ...sj,
        is_on_hold: true,
        hold_reason: reason,
        held_at: new Date(),
      };
    }
    return sj;
  });
  set({
    e: { ...e, trophyGroups: updatedTrophyGroups },
    sub_jobs: updatedSubJobs,
    wizard_state: {
      ...(s.wizard_state || s),
      e: { ...e, trophyGroups: updatedTrophyGroups },
      sub_jobs: updatedSubJobs,
    },
  });
  toast.success(`${subJobNo} placed on hold!`);
};

export const dropSingleSubJob = async ({
  subJobNo,
  reason,
  targetDbId,
  parentJobNo,
  e,
  s,
  set,
}) => {
  if (targetDbId && subJobNo) {
    await axiosInstance
      .post(`/enquiry-flow-integration/${targetDbId}/sub-job/${subJobNo}/drop`, {
        reason,
      })
      .catch(console.warn);
  }
  const updatedTrophyGroups = (e.trophyGroups || []).map((tg, idx) => {
    const gChar = String.fromCharCode(65 + idx);
    const updatedItems = (tg.items || []).map((item, j) => {
      const sjNo = `${parentJobNo}-${gChar}${j + 1}`;
      if (
        sjNo === subJobNo ||
        (subJobNo && subJobNo.endsWith(`-${gChar}${j + 1}`))
      ) {
        return {
          ...item,
          is_dropped: true,
          drop_reason: reason,
          dropped_at: new Date().toISOString(),
        };
      }
      return item;
    });
    const allDropped =
      updatedItems.length > 0 && updatedItems.every((it) => it.is_dropped);
    return {
      ...tg,
      items: updatedItems,
      is_dropped: allDropped,
      drop_reason: allDropped ? reason : tg.drop_reason,
    };
  });
  const updatedSubJobs = (s.sub_jobs || []).map((sj) => {
    if (
      sj.sub_job_no === subJobNo ||
      (subJobNo && subJobNo.endsWith(sj.sub_job_no))
    ) {
      return {
        ...sj,
        is_dropped: true,
        drop_reason: reason,
        dropped_at: new Date(),
        stage: "cancelled",
      };
    }
    return sj;
  });
  set({
    e: { ...e, trophyGroups: updatedTrophyGroups },
    sub_jobs: updatedSubJobs,
    wizard_state: {
      ...(s.wizard_state || s),
      e: { ...e, trophyGroups: updatedTrophyGroups },
      sub_jobs: updatedSubJobs,
    },
  });
  toast.success(`${subJobNo} dropped completely!`);
};

export const processProductFeedback = ({
  pIdx,
  communicationLog,
  productFeedback,
  setProductFeedback,
  localConfirmed,
  setLocalConfirmed,
  s,
  set,
  e,
  ids,
  productsList,
  uploadedDesigns,
}) => {
  const feedback = {
    ...productFeedback[pIdx],
    communication: communicationLog,
  };
  if (!feedback || !feedback.mode) {
    toast.warn("Please select a feedback option first.", {
      position: "top-right",
    });
    return;
  }
  if (!feedback.optIdxs || feedback.optIdxs.length === 0) {
    toast.warn("Please select at least one design option.", {
      position: "top-right",
    });
    return;
  }
  if (feedback.mode === "approve" && feedback.optIdxs.length > 1) {
    feedback.optIdxs = [feedback.optIdxs[0]];
  }

  const existingLocal = Array.isArray(localConfirmed[pIdx])
    ? localConfirmed[pIdx]
    : localConfirmed[pIdx]
      ? [localConfirmed[pIdx]]
      : [];
  const updatedConfirmed = {
    ...localConfirmed,
    [pIdx]: [...existingLocal, feedback],
  };
  setLocalConfirmed(updatedConfirmed);

  setProductFeedback((prev) => {
    const copy = { ...prev };
    delete copy[pIdx];
    return copy;
  });

  const existingSysForP = Array.isArray(s.productFeedback?.[pIdx])
    ? s.productFeedback[pIdx]
    : s.productFeedback?.[pIdx]
      ? [s.productFeedback[pIdx]]
      : [];
  const updatedSysProductFeedback = {
    ...(s.productFeedback || {}),
    [pIdx]: [...existingSysForP, feedback],
  };

  const targetJobId = s.dbJobId || s._id || s.rawJob?._id || ids?.id;
  const groupChar = String.fromCharCode(65 + Number(pIdx));
  const productName = productsList[pIdx]?.name || `Trophy ${groupChar}`;

  if (targetJobId) {
    axiosInstance
      .post(
        `/enquiry-flow-integration/${targetJobId}/subjob-design-feedback`,
        {
          pIdx,
          groupChar,
          feedback,
        },
      )
      .then((res) => {
        if (res.data?.subJobs) {
          set({ sub_jobs: res.data.subJobs });
        }
        if (res.data?.allApproved) {
          set(
            {
              designApproved: true,
              designStatus: "approved",
            },
            true,
          );
        }
        toast.success(
          feedback.mode === "approve"
            ? `${productName} design approved! Request sent to designer to upload production file.`
            : `${productName} feedback recorded!`,
        );
      })
      .catch((err) => {
        console.warn(
          "Could not save subjob design feedback to backend:",
          err,
        );
        toast.error("Failed to sync sub-job response with backend");
      });
  }

  const uploadedPIdxs = productsList
    .map((_, i) => i)
    .filter((idx) => {
      const baseOptCount =
        e.briefMode === "each" &&
          e.productBriefs?.[productsList[idx].name]?.designOptions
          ? e.productBriefs[productsList[idx].name].designOptions
          : e.designOptions || 2;
      const optCount = baseOptCount + (s.extraDesignOptions?.[idx] || 0);
      return Array.from({ length: optCount }).some(
        (_, j) => uploadedDesigns[`${idx}-${j}`],
      );
    });

  const pendingPIdxs = uploadedPIdxs.filter((idx) => {
    const existingSystem = Array.isArray(updatedSysProductFeedback[idx])
      ? updatedSysProductFeedback[idx]
      : updatedSysProductFeedback[idx]
        ? [updatedSysProductFeedback[idx]]
        : [];
    const local = Array.isArray(updatedConfirmed[idx])
      ? updatedConfirmed[idx]
      : updatedConfirmed[idx]
        ? [updatedConfirmed[idx]]
        : [];
    const allFbs = [...existingSystem, ...local];
    if (allFbs.some((fb) => fb.mode === "approve")) return false;

    const reviewedSet = new Set();
    allFbs.forEach((fb) => fb.optIdxs?.forEach((i) => reviewedSet.add(i)));

    const baseOptCount =
      e.briefMode === "each" &&
        e.productBriefs?.[productsList[idx].name]?.designOptions
        ? e.productBriefs[productsList[idx].name].designOptions
        : e.designOptions || 2;
    const optCount = baseOptCount + (s.extraDesignOptions?.[idx] || 0);
    const uploadedCount = Array.from({ length: optCount }).filter(
      (_, i) => uploadedDesigns[`${idx}-${i}`],
    ).length;

    return reviewedSet.size < uploadedCount;
  });

  if (pendingPIdxs.length === 0) {
    let allApproved = true;
    const finalFeedback = { ...updatedSysProductFeedback };
    let newExtraOpts = { ...(s.extraDesignOptions || {}) };

    uploadedPIdxs.forEach((idx) => {
      const sysFbs = Array.isArray(finalFeedback[idx])
        ? finalFeedback[idx]
        : finalFeedback[idx]
          ? [finalFeedback[idx]]
          : [];
      const locFbs = Array.isArray(updatedConfirmed[idx])
        ? updatedConfirmed[idx]
        : updatedConfirmed[idx]
          ? [updatedConfirmed[idx]]
          : [];
      const merged = [...sysFbs, ...locFbs];
      if (merged.length > 0) finalFeedback[idx] = merged;

      if (!merged.some((fb) => fb.mode === "approve")) allApproved = false;

      merged.forEach((fb) => {
        if (fb.mode === "reject" || fb.mode === "revision") {
          if (locFbs.includes(fb)) {
            newExtraOpts[idx] = (newExtraOpts[idx] || 0) + fb.optIdxs.length;
          }
        }
      });
    });

    // All active custom products across the entire enquiry must have designs and approvals for whole-job approval
    const activeCustomProds = productsList.filter((p) => !p.is_dropped && !p.is_on_hold && p.kind !== "ready");
    const allProductsHaveDesignsAndApproval =
      activeCustomProds.length > 0 &&
      activeCustomProds.every((_, idx) => {
        const sysFbs = Array.isArray(finalFeedback[idx]) ? finalFeedback[idx] : (finalFeedback[idx] ? [finalFeedback[idx]] : []);
        const locFbs = Array.isArray(updatedConfirmed[idx]) ? updatedConfirmed[idx] : (updatedConfirmed[idx] ? [updatedConfirmed[idx]] : []);
        return [...sysFbs, ...locFbs].some((fb) => fb.mode === "approve");
      });

    if (allApproved && allProductsHaveDesignsAndApproval) {
      const approvedStateUpdate = {
        designApproved: true,
        productFeedback: finalFeedback,
        costReq: new Date().toISOString(),
        designStatus: "approved",
      };
      set(approvedStateUpdate, true);

      if (s.dbJobId) {
        axiosInstance
          .put(`/enquiry-flow-integration/${s.dbJobId}`, {
            stage: "brief",
            the_brief: {
              ...(s.the_brief || s.rawJob?.the_brief || {}),
              design_status: "approved",
            },
            wizard_state: {
              ...s,
              ...approvedStateUpdate,
            },
          })
          .catch(console.warn);
      }
    } else if (allApproved) {
      // Partial approval: this product is approved, but other products are still awaiting upload/review
      set({ productFeedback: finalFeedback, designApproved: false, designStatus: "pending" }, true);
      if (s.dbJobId) {
        axiosInstance
          .put(`/enquiry-flow-integration/${s.dbJobId}`, {
            wizard_state: {
              ...s,
              productFeedback: finalFeedback,
              designApproved: false,
              designStatus: "pending",
            },
          })
          .catch(console.warn);
      }
    } else {
      let combinedRemarks = [];
      let hasReworkRequest = false;
      Object.keys(finalFeedback).forEach((pKey) => {
        const arr = Array.isArray(finalFeedback[pKey])
          ? finalFeedback[pKey]
          : [finalFeedback[pKey]];
        arr.forEach((f) => {
          if (f.mode === "revision" || f.mode === "reject") {
            hasReworkRequest = true;
            if (f.remark) combinedRemarks.push(f.remark);
          }
        });
      });

      if (hasReworkRequest) {
        const reworkNotes =
          combinedRemarks.join("; ") ||
          "Client requested revisions on design options.";

        set(
          {
            optionsShared: false,
            productFeedback: finalFeedback,
            designRound: (s.designRound || 1) + 1,
            extraDesignOptions: newExtraOpts,
            designStatus: "rework",
            reworkNotes,
          },
          true,
        );

        if (s.dbJobId) {
          axiosInstance
            .post(`/enquiry-flow-integration/${s.dbJobId}/rework`, {
              remarks: reworkNotes,
              reworkNotes,
            })
            .then(() => {
              toast.info("Enquiry moved to Designer REWORK tab!");
            })
            .catch(console.warn);
        }
      } else {
        set({ productFeedback: finalFeedback });
      }
    }
    setLocalConfirmed({});
    setProductFeedback({});
  } else {
    set({ productFeedback: updatedSysProductFeedback }, true);
  }
};



/**
 * Builds flattened sub-job quotation rows combining productsList, dbSubJobs, and simulatedRates.
 * Enforces one-time artwork charge (default ₹1,500) across all sub-jobs.
 */
export const buildSubJobQuotationRows = ({
  productsList = [],
  e = {},
  s = {},
  dbSubJobs = [],
  simulatedRates = {},
  parentJobNo = "",
  defaultArtwork = 1500,
}) => {
  const rows = productsList.flatMap((p, pIdx) => {
    const groupChar = String.fromCharCode(65 + pIdx);
    const items =
      p.items && p.items.length > 0
        ? p.items
        : [{ size: e.size || 8, qty: e.qty || 50 }];

    return items.map((item, sIdx) => {
      const fallbackSubJobNo = `${parentJobNo}-${groupChar}${sIdx + 1}`;
      const rateKey = `${pIdx}-${sIdx}`;

      // Find matching MongoDB sub-job record if present
      const matchedDb = dbSubJobs.find(
        (sj) =>
          sj.sub_job_no === fallbackSubJobNo ||
          sj.sub_job_no?.endsWith(`${groupChar}${sIdx + 1}`),
      );

      const subJobNo = matchedDb?.sub_job_no || fallbackSubJobNo;

      // Costing completion check strictly for THIS specific sub-job
      const hasSimulatedCosting =
        Boolean(simulatedRates[rateKey]?.costing_status === "completed" && simulatedRates[rateKey]?.bom_id) ||
        Boolean(simulatedRates[rateKey]?.isManualSaved) ||
        Boolean(simulatedRates[subJobNo]?.costing_status === "completed" && simulatedRates[subJobNo]?.bom_id);

      const isPendingCosting =
        matchedDb?.costing_status === "pending" ||
        matchedDb?.costing_status === "in_costing" ||
        item.costing_status === "pending" ||
        item.costing_status === "in_costing";

      const hasDbCosting =
        !isPendingCosting &&
        matchedDb?.costing_status === "completed" &&
        (Boolean(matchedDb?.bom_id) || Number(matchedDb?.unit_rate) > 0);

      const isCostingCompleted = !isPendingCosting && Boolean(hasSimulatedCosting || hasDbCosting);

      // Check if production design file has been uploaded for custom products
      const isReadyStock = p.kind === "ready" || item.kind === "ready";
      const isDesignUploaded =
        isReadyStock ||
        Boolean(matchedDb?.is_design_uploaded) ||
        (Array.isArray(matchedDb?.designer_files) && matchedDb.designer_files.length > 0) ||
        (Array.isArray(matchedDb?.dtp_files) && matchedDb.dtp_files.length > 0);

      // Costing request check
      const isCostingRequested =
        !isCostingCompleted &&
        isDesignUploaded &&
        (matchedDb?.costing_status === "pending" ||
          matchedDb?.costing_status === "in_progress" ||
          matchedDb?.costing_status === "in_costing" ||
          item.costing_status === "pending" ||
          item.costing_status === "in_progress" ||
          Boolean(matchedDb?.costing_requested_at) ||
          Boolean(item.costing_requested_at));

      const costingStatus = isCostingCompleted
        ? "completed"
        : !isDesignUploaded
          ? "awaiting_artwork"
          : isCostingRequested
            ? "pending"
            : (matchedDb?.costing_status === "completed" && !matchedDb?.bom_id)
              ? "pending"
              : (item.costing_status === "completed" && !item.bom_id)
                ? "pending"
                : matchedDb?.costing_status || item.costing_status || "not_requested";

      const costedUnitRate = !isCostingCompleted
        ? 0
        : simulatedRates[rateKey]?.bom_id && Number(simulatedRates[rateKey]?.rate) > 0
          ? Number(simulatedRates[rateKey].rate)
          : simulatedRates[subJobNo]?.bom_id && Number(simulatedRates[subJobNo]?.rate) > 0
            ? Number(simulatedRates[subJobNo].rate)
            : simulatedRates[rateKey]?.isManualSaved && Number(simulatedRates[rateKey]?.rate) > 0
              ? Number(simulatedRates[rateKey].rate)
              : matchedDb?.bom_id && Number(matchedDb.unit_rate) > 0
                ? Number(matchedDb.unit_rate)
                : item.bom_id && Number(item.unit_rate) > 0
                  ? Number(item.unit_rate)
                  : matchedDb?.unit_rate > 0 && isCostingCompleted
                    ? Number(matchedDb.unit_rate)
                    : 0;

      const rawUnitRate = isCostingCompleted ? costedUnitRate : 0;
      const unitRate = Number(Number(rawUnitRate || 0).toFixed(2));

      // Default sample rate is unit rate + 200 extra
      const defaultSampleRate =
        unitRate > 0 ? Number((unitRate + 200).toFixed(2)) : 0;
      const sampleRate =
        simulatedRates[rateKey]?.sample !== undefined
          ? Number(Number(simulatedRates[rateKey].sample).toFixed(2))
          : matchedDb?.sample_rate !== undefined && matchedDb.sample_rate > 0
            ? Number(Number(matchedDb.sample_rate).toFixed(2))
            : item.sampleRate
              ? Number(Number(item.sampleRate).toFixed(2))
              : defaultSampleRate;

      const rawArtworkCharge =
        simulatedRates[rateKey]?.artwork !== undefined
          ? Number(Number(simulatedRates[rateKey].artwork).toFixed(2))
          : matchedDb?.artwork_charge !== undefined
            ? Number(Number(matchedDb.artwork_charge).toFixed(2))
            : item.artworkCharge
              ? Number(Number(item.artworkCharge).toFixed(2))
              : 0;

      const qty = Number(item.qty || e.qty || 50);
      const lineTotal = unitRate > 0 ? Number((qty * unitRate).toFixed(2)) : 0;

      const isMulti = Boolean(items && items.length > 1);
      const isHold = Boolean(
        item.is_on_hold !== undefined
          ? item.is_on_hold
          : matchedDb?.is_on_hold !== undefined
            ? matchedDb.is_on_hold
            : !isMulti && p.is_on_hold,
      );
      const isDrop = Boolean(
        item.is_dropped !== undefined
          ? item.is_dropped
          : matchedDb?.is_dropped !== undefined
            ? matchedDb.is_dropped
            : !isMulti && p.is_dropped,
      );
      const holdReason =
        item.hold_reason ||
        matchedDb?.hold_reason ||
        (!isMulti ? p.hold_reason : "") ||
        "";
      const dropReason =
        item.drop_reason ||
        matchedDb?.drop_reason ||
        (!isMulti ? p.drop_reason : "") ||
        "";

      const quoteShared = Boolean(
        matchedDb?.quote_shared ||
        s.quoted ||
        s.quoteVia ||
        s.wizard_state?.quoted
      );
      const clientDecision =
        matchedDb?.client_quote_decision ||
        (s.decision?.decision
          ? s.decision.decision
          : s.quoteApproved
            ? "approved"
            : s.client_quote_decision || "pending");
      const clientDecisionAt =
        matchedDb?.client_quote_decision_at || s.decision?.at || null;
      const clientNotes =
        matchedDb?.client_quote_decision_notes || s.decision?.notes || "";
      const clientCommunication =
        matchedDb?.client_quote_communication || s.decision?.channel || "";

      return {
        subJobNo,
        rateKey,
        productIndex: pIdx,
        itemIndex: sIdx,
        name: p.name,
        size: item.size || e.size || 8,
        qty,
        unitRate: Number(unitRate),
        sampleRate: Number(sampleRate),
        artworkCharge: Number(rawArtworkCharge),
        lineTotal,
        isHold,
        isDrop,
        holdReason,
        dropReason,
        costingStatus,
        quoteShared,
        clientDecision,
        clientDecisionAt,
        clientNotes,
        clientCommunication,
        kind: p.kind || "custom",
      };
    });
  });

  return normalizeJobArtworkCharge(rows, defaultArtwork);
};


