import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { axiosInstance } from "../../utils/url/config";
import ImageConfirmModal from "./components/ImageConfirmModal";
import DesignZoomPreviewModal from "./components/DesignZoomPreviewModal";
import DesignerDueCountdownBadge from "../components/DesignerDueCountdownBadge";

const MultiTrophyDesignModal = ({ enquiry, onClose, onRefresh }) => {
  const [fullJob, setFullJob] = useState(
    enquiry?.rawJob || (enquiry?.sub_jobs || enquiry?.the_ask || enquiry?.wizard_state ? enquiry : null)
  );
  const rawJob = React.useMemo(
    () =>
      fullJob ||
      enquiry?.rawJob ||
      (enquiry?.sub_jobs || enquiry?.the_ask || enquiry?.wizard_state ? enquiry : {}),
    [fullJob, enquiry]
  );

  const theAsk = React.useMemo(() => rawJob?.the_ask || rawJob?.wizard_state?.the_ask || {}, [rawJob]);
  const theBrief = React.useMemo(() => rawJob?.the_brief || rawJob?.wizard_state?.the_brief || {}, [rawJob]);
  const wizardState = React.useMemo(() => rawJob?.wizard_state || {}, [rawJob]);
  const subJobs = React.useMemo(() => rawJob?.sub_jobs || [], [rawJob]);

  // Uploaded designs state: key format `${trophyIdx}-${optIdx}`
  const initialUploaded = wizardState.uploadedDesigns || {};
  const [uploadedDesigns, setUploadedDesigns] = useState(initialUploaded);

  // 1. Derive fallback reference images across all places where they could be saved
  const allFallbackRefs = React.useMemo(() => {
    if (Array.isArray(theBrief.ref_files) && theBrief.ref_files.length > 0) {
      return theBrief.ref_files;
    }
    if (
      Array.isArray(wizardState.e?.globalRefs) &&
      wizardState.e.globalRefs.length > 0
    ) {
      return wizardState.e.globalRefs;
    }
    if (
      Array.isArray(wizardState.globalRefs) &&
      wizardState.globalRefs.length > 0
    ) {
      return wizardState.globalRefs;
    }
    if (
      Array.isArray(wizardState.refFiles) &&
      wizardState.refFiles.length > 0
    ) {
      return wizardState.refFiles;
    }
    const pbList = wizardState.e?.productBriefs ? Object.values(wizardState.e.productBriefs) : [];
    for (const pb of pbList) {
      if (Array.isArray(pb?.refs) && pb.refs.length > 0) return pb.refs;
    }
    for (const sj of subJobs) {
      if (Array.isArray(sj?.ref_files) && sj.ref_files.length > 0) return sj.ref_files;
    }
    if (Array.isArray(enquiry?.images) && enquiry.images.length > 0) {
      return enquiry.images;
    }
    return [];
  }, [theBrief, wizardState, enquiry, subJobs]);

  // Derive Trophies (Multi-Trophy Line Items)
  const trophies = React.useMemo(() => {
    const rawGroups = (Array.isArray(wizardState.trophyGroups) && wizardState.trophyGroups.length > 0)
      ? wizardState.trophyGroups
      : (Array.isArray(wizardState.e?.trophyGroups) && wizardState.e.trophyGroups.length > 0)
        ? wizardState.e.trophyGroups
        : null;

    const pBriefs = wizardState.e?.productBriefs || theBrief.product_briefs || {};

    // Helper to resolve clean trophy name (filter out raw spec strings)
    const resolveTrophyName = (groupObj, sjObj, fallbackIdx) => {
      const candidates = [
        groupObj?.theme,
        groupObj?.productName,
        groupObj?.name,
        groupObj?.type,
        groupObj?.productType,
        sjObj?.theme,
        sjObj?.product_name,
        sjObj?.trophy_type,
        theAsk.product_name,
        theAsk.theme,
      ];
      for (const cand of candidates) {
        if (!cand || typeof cand !== "string") continue;
        const trimmed = cand.trim();
        if (
          trimmed &&
          trimmed !== "Custom Trophy" &&
          trimmed !== "custom" &&
          !trimmed.includes(" · ") &&
          !/^\d+(\.\d+)?\s*(in|inch|cm|mm)/i.test(trimmed)
        ) {
          return trimmed;
        }
      }
      for (const cand of candidates) {
        if (cand && typeof cand === "string" && !cand.includes(" · ") && !/^\d+(\.\d+)?\s*(in|inch|cm|mm)/i.test(cand)) {
          return cand.trim();
        }
      }
      return `Trophy ${fallbackIdx + 1}`;
    };

    // Helper to resolve refs for a product
    const resolveRefs = (groupObj, sjObj, idx) => {
      if (Array.isArray(groupObj?.refs) && groupObj.refs.length > 0) return groupObj.refs;
      const themeKey = groupObj?.theme || sjObj?.theme;
      const nameKey = groupObj?.name || groupObj?.productName || sjObj?.product_name;
      const pBrief =
        pBriefs[themeKey] ||
        pBriefs[nameKey] ||
        pBriefs[`Product ${idx + 1}`] ||
        Object.values(pBriefs)[idx];
      if (Array.isArray(pBrief?.refs) && pBrief.refs.length > 0) return pBrief.refs;
      if (Array.isArray(sjObj?.ref_files) && sjObj.ref_files.length > 0) return sjObj.ref_files;
      return allFallbackRefs;
    };

    // Helper to resolve brief text for a product
    const resolveBrief = (groupObj, sjObj, idx) => {
      if (groupObj?.brief) return groupObj.brief;
      const themeKey = groupObj?.theme || sjObj?.theme;
      const nameKey = groupObj?.name || groupObj?.productName || sjObj?.product_name;
      const pBrief =
        pBriefs[themeKey] ||
        pBriefs[nameKey] ||
        pBriefs[`Product ${idx + 1}`] ||
        Object.values(pBriefs)[idx];
      if (pBrief?.brief) return pBrief.brief;
      if (sjObj?.brief_text) return sjObj.brief_text;
      return theBrief.brief_text || "";
    };

    // Helper to resolve specific client feedback, rework remarks, and approval for a product
    const resolveFeedback = (tg, primarySj, idx) => {
      const fbFromSj = primarySj?.product_feedback;
      const fbFromWizard = wizardState.productFeedback?.[idx] || wizardState.productFeedback?.[String(idx)];
      const rawFb = fbFromSj || fbFromWizard || null;
      const fbs = Array.isArray(rawFb) ? rawFb : (rawFb ? [rawFb] : []);
      const groupChar = String.fromCharCode(65 + Number(idx));
      const hasUploadedOptions = Object.keys(uploadedDesigns || {}).some(
        (k) => (k.startsWith(`${idx}-`) || k.startsWith(`${groupChar}-`)) && Boolean(uploadedDesigns[k])
      ) || (Array.isArray(primarySj?.designer_files) && primarySj.designer_files.length > 0);

      const isApproved = Boolean(
        hasUploadedOptions && (
          primarySj?.design_approved ||
          primarySj?.design_status === "approved" ||
          fbs.some((f) => f && f.mode === "approve")
        )
      );
      const isRework = Boolean(
        !isApproved && (
          primarySj?.design_status === "rework" ||
          fbs.some((f) => f && (f.mode === "revision" || f.mode === "reject"))
        )
      );
      const activeReworkFb = fbs.slice().reverse().find((f) => f && (f.mode === "revision" || f.mode === "reject"));
      return {
        is_approved: isApproved,
        is_rework: isRework,
        rework_notes: activeReworkFb?.remark || primarySj?.rework_notes || theBrief.rework_notes || "",
        feedbacks: fbs,
        active_feedback: fbs[fbs.length - 1] || null,
      };
    };

    // Helper to resolve required design options count exactly as specified in the enquiry
    const resolveRequiredOptions = (groupObj, sjObj, fallbackIdx) => {
      const isReady = Boolean(
        groupObj?.kind === "ready" ||
        groupObj?.type === "Ready Trophy" ||
        sjObj?.trophy_type === "ready" ||
        sjObj?.kind === "ready" ||
        sjObj?.design_needed === false ||
        sjObj?.quote_only === true ||
        wizardState.e?.askMode === "ready"
      );
      if (isReady) return 0;

      const themeKey = groupObj?.theme || sjObj?.theme;
      const nameKey = groupObj?.name || groupObj?.productName || sjObj?.product_name;
      const pBrief =
        pBriefs[themeKey] ||
        pBriefs[nameKey] ||
        pBriefs[`Product ${fallbackIdx + 1}`] ||
        Object.values(pBriefs)[fallbackIdx];

      // Exact match with Enquiry Flow logic:
      if (wizardState.e?.briefMode === "each" && pBrief?.designOptions) {
        return Math.max(1, Number(pBrief.designOptions));
      }

      const candidates = [
        pBrief?.designOptions,
        wizardState.e?.designOptions,
        wizardState.e?.optionsCount,
        groupObj?.designOptions,
        groupObj?.designOptionsCount,
        groupObj?.items?.[0]?.spec?.designOptions,
        groupObj?.items?.[0]?.designOptions,
        groupObj?.items?.[0]?.designOptionsCount,
        wizardState.designOptions,
        wizardState.optionsCount,
        theAsk?.designOptions,
        theAsk?.designOptionsCount,
        sjObj?.options_count,
        theBrief?.options_count,
        enquiry?.options_count,
        enquiry?.no_of_options,
      ];

      for (const val of candidates) {
        const num = Number(val);
        if (!isNaN(num) && num > 0) return num;
      }
      return 2;
    };

    // If explicit trophyGroups exist in wizard_state
    if (rawGroups && rawGroups.length > 0) {
      return rawGroups.map((tg, idx) => {
        const groupChar = String.fromCharCode(65 + idx);
        const matchedSjs = (Array.isArray(subJobs) ? subJobs : []).filter(
          (sj) => sj.design_group === groupChar || sj.sub_job_no?.includes(`-${groupChar}`) || (tg.theme && sj.theme === tg.theme)
        );
        const primarySj = matchedSjs[0];

        const isMulti = (Array.isArray(tg.items) && tg.items.length > 1) || matchedSjs.length > 1;
        const isOnHold = Boolean(
          (!isMulti && tg.is_on_hold) ||
          (Array.isArray(tg.items) && tg.items.length > 0 && tg.items.every((it) => it.is_on_hold)) ||
          (matchedSjs.length > 0 && matchedSjs.every((s) => s.is_on_hold))
        );
        const isDropped = Boolean(
          (!isMulti && tg.is_dropped) ||
          (Array.isArray(tg.items) && tg.items.length > 0 && tg.items.every((it) => it.is_dropped)) ||
          (matchedSjs.length > 0 && matchedSjs.every((s) => s.is_dropped))
        );

        const groupVariants = (() => {
          const parentJob = enquiry?.job_no || enquiry?.enquiry_no || "RD";
          if (Array.isArray(tg.items) && tg.items.length > 0) {
            return tg.items.map((it, vIdx) => {
              const sjNo = `${parentJob}-${groupChar}${vIdx + 1}`;
              const matchedSj = matchedSjs.find(
                (s) => s.sub_job_no === sjNo || s.sub_job_no?.endsWith(`-${groupChar}${vIdx + 1}`) || String(s.size) === String(it.size)
              );
              const isHold = Boolean(
                it.is_on_hold !== undefined
                  ? it.is_on_hold
                  : (matchedSj?.is_on_hold !== undefined
                    ? matchedSj.is_on_hold
                    : (tg.items.length === 1 && tg.is_on_hold))
              );
              const isDrop = Boolean(
                it.is_dropped !== undefined
                  ? it.is_dropped
                  : (matchedSj?.is_dropped !== undefined
                    ? matchedSj.is_dropped
                    : (tg.items.length === 1 && tg.is_dropped))
              );
              return {
                sub_job_no: sjNo,
                size: it.size ? `${it.size} in` : (theAsk.size || "8 in"),
                is_on_hold: isHold,
                hold_reason: it.hold_reason || matchedSj?.hold_reason || "",
                is_dropped: isDrop,
                drop_reason: it.drop_reason || matchedSj?.drop_reason || "",
              };
            });
          }
          if (matchedSjs.length > 0) {
            return matchedSjs.map((s, vIdx) => ({
              sub_job_no: s.sub_job_no || `${parentJob}-${groupChar}${vIdx + 1}`,
              size: s.size ? `${s.size} in` : "Standard",
              is_on_hold: Boolean(s.is_on_hold),
              hold_reason: s.hold_reason || "",
              is_dropped: Boolean(s.is_dropped),
              drop_reason: s.drop_reason || "",
            }));
          }
          return [
            {
              sub_job_no: `${parentJob}-${groupChar}1`,
              size: theAsk.size ? `${theAsk.size} in` : "Standard",
              is_on_hold: Boolean(tg.is_on_hold),
              hold_reason: tg.hold_reason || "",
              is_dropped: Boolean(tg.is_dropped),
              drop_reason: tg.drop_reason || "",
            }
          ];
        })();

        const isReady = Boolean(
          tg.kind === "ready" ||
          tg.type === "Ready Trophy" ||
          primarySj?.trophy_type === "ready" ||
          primarySj?.kind === "ready" ||
          wizardState.e?.askMode === "ready"
        );

        const derivedSizes = (() => {
          if (Array.isArray(tg.items) && tg.items.length > 0) {
            return tg.items.map((it) => it.size ? `${it.size} in` : (theAsk.size || "8 in"));
          }
          if (matchedSjs.length > 0) {
            return [...new Set(matchedSjs.map((s) => s.size).filter(Boolean))];
          }
          if (Array.isArray(tg.sizes) && tg.sizes.length > 0) return tg.sizes;
          return [theAsk.size || "Standard"];
        })();

        const derivedQty = (() => {
          if (Array.isArray(tg.items) && tg.items.length > 0) {
            return tg.items.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
          }
          if (matchedSjs.length > 0) {
            return matchedSjs.reduce((acc, s) => acc + (Number(s.quantity) || 0), 0);
          }
          return tg.quantity || theAsk.quantity || 100;
        })();

        const trophyName = resolveTrophyName(tg, primarySj, idx);

        return {
          index: idx,
          name: trophyName,
          kind: isReady ? "ready" : (tg.kind || "custom"),
          sizes: derivedSizes,
          quantity: derivedQty,
          requiredOptions: resolveRequiredOptions(tg, primarySj, idx),
          refs: resolveRefs(tg, primarySj, idx),
          brief: resolveBrief(tg, primarySj, idx),
          sub_job_no: tg.sub_job_no || primarySj?.sub_job_no || `${enquiry?.job_no || enquiry?.enquiry_no || "RD"}-${groupChar}1`,
          is_on_hold: isOnHold,
          hold_reason: tg.hold_reason || primarySj?.hold_reason || "",
          is_dropped: isDropped,
          drop_reason: tg.drop_reason || primarySj?.drop_reason || "",
          variants: groupVariants,
          ...resolveFeedback(tg, primarySj, idx),
        };
      });
    }

    // If sub_jobs exist in DB (group by design_group)
    if (Array.isArray(subJobs) && subJobs.length > 0) {
      const groupMap = {};
      subJobs.forEach((sj, i) => {
        const groupChar = sj.design_group || (sj.sub_job_no ? sj.sub_job_no.split("-")[1]?.charAt(0) : "") || String.fromCharCode(65 + i);
        const groupKey = `group_${groupChar}`;

        if (!groupMap[groupKey]) {
          const idx = Object.keys(groupMap).length;
          const matchedTg = (wizardState.e?.trophyGroups || wizardState.trophyGroups)?.[idx];
          const trophyName = resolveTrophyName(matchedTg, sj, idx);
          const isReady = Boolean(
            sj.trophy_type === "ready" ||
            sj.kind === "ready" ||
            matchedTg?.kind === "ready" ||
            wizardState.e?.askMode === "ready"
          );
          const isDesignSkipped = isReady || sj.design_needed === false || sj.quote_only === true;

          groupMap[groupKey] = {
            index: idx,
            name: trophyName,
            kind: isReady ? "ready" : (sj.trophy_type || "custom"),
            sizes: [],
            quantity: 0,
            requiredOptions: resolveRequiredOptions(matchedTg, sj, idx),
            refs: resolveRefs(matchedTg, sj, idx),
            brief: resolveBrief(matchedTg, sj, idx),
            is_design_skipped: isDesignSkipped,
            quote_only: Boolean(sj.quote_only),
            sub_job_no: sj.sub_job_no || `${enquiry?.job_no || enquiry?.enquiry_no || "RD"}-${groupChar}1`,
            is_on_hold: Boolean(sj.is_on_hold),
            hold_reason: sj.hold_reason || "",
            is_dropped: Boolean(sj.is_dropped),
            drop_reason: sj.drop_reason || "",
          };
        }

        if (!groupMap[groupKey]._sjs) groupMap[groupKey]._sjs = [];
        groupMap[groupKey]._sjs.push(sj);

        if (sj.size && !groupMap[groupKey].sizes.includes(sj.size)) {
          groupMap[groupKey].sizes.push(sj.size);
        }
        if (!sj.is_dropped) {
          groupMap[groupKey].quantity += sj.quantity || 0;
        }
      });

      // A trophy group is only dropped/held if ALL its variant subjobs are dropped/held
      Object.values(groupMap).forEach((g, gIdx) => {
        Object.assign(g, resolveFeedback(null, g._sjs?.[0], g.index !== undefined ? g.index : gIdx));
        if (g._sjs && g._sjs.length > 0) {
          g.is_dropped = g._sjs.every((s) => s.is_dropped);
          g.is_on_hold = g._sjs.every((s) => s.is_on_hold);
          if (g.is_dropped) {
            g.drop_reason = g._sjs.find((s) => s.drop_reason)?.drop_reason || "";
          }
          if (g.is_on_hold) {
            g.hold_reason = g._sjs.find((s) => s.hold_reason)?.hold_reason || "";
          }
          g.variants = g._sjs.map((s) => ({
            sub_job_no: s.sub_job_no,
            size: s.size ? `${s.size} in` : "Standard",
            is_on_hold: Boolean(s.is_on_hold),
            hold_reason: s.hold_reason || "",
            is_dropped: Boolean(s.is_dropped),
            drop_reason: s.drop_reason || "",
          }));
        } else {
          g.variants = [
            {
              sub_job_no: g.sub_job_no,
              size: g.sizes?.[0] || "Standard",
              is_on_hold: Boolean(g.is_on_hold),
              is_dropped: Boolean(g.is_dropped),
            }
          ];
        }
      });

      return Object.values(groupMap);
    }

    // Default single trophy fallback
    const singleIsReady = Boolean(theAsk.askMode === "ready" || wizardState.e?.kind === "ready" || wizardState.e?.askMode === "ready");
    const singleName = resolveTrophyName(null, null, 0);
    return [
      {
        index: 0,
        name: singleName,
        kind: singleIsReady ? "ready" : "custom",
        sizes: theAsk.size ? [theAsk.size] : ["Standard"],
        quantity: enquiry?.product_quantity || theAsk.quantity || 100,
        requiredOptions: resolveRequiredOptions(null, null, 0),
        refs: allFallbackRefs,
        brief: theBrief.brief_text || "",
        sub_job_no: `${enquiry?.job_no || enquiry?.enquiry_no || "RD"}-A1`,
        is_on_hold: false,
        hold_reason: "",
        is_dropped: false,
        drop_reason: "",
        variants: [
          {
            sub_job_no: `${enquiry?.job_no || enquiry?.enquiry_no || "RD"}-A1`,
            size: theAsk.size ? `${theAsk.size} in` : "Standard",
            is_on_hold: false,
            is_dropped: false,
          }
        ],
        ...resolveFeedback(null, subJobs?.[0], 0),
      },
    ];
  }, [wizardState, theAsk, theBrief, subJobs, enquiry, allFallbackRefs, uploadedDesigns]);
  const [activeTrophyIdx, setActiveTrophyIdx] = useState(0);
  const activeTrophy = trophies[activeTrophyIdx] || trophies[0];

  const [uploadingSlots, setUploadingSlots] = useState({});
  const [previewModalData, setPreviewModalData] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [pendingUpload, setPendingUpload] = useState(null);
  const [confirmUploading, setConfirmUploading] = useState(false);

  // Fetch full details if sub_jobs or deep reference files are missing
  useEffect(() => {
    const idToFetch = enquiry?._id || enquiry?.rawJob?._id;
    if (idToFetch) {
      axiosInstance
        .get(`/enquiry-flow-integration/${idToFetch}`)
        .then((res) => {
          if (res.data?.success && res.data.data) {
            setFullJob(res.data.data);
            if (res.data.data.wizard_state?.uploadedDesigns) {
              setUploadedDesigns((prev) => ({
                ...prev,
                ...res.data.data.wizard_state.uploadedDesigns,
              }));
            }
          }
        })
        .catch((err) =>
          console.error("Error fetching full enquiry for designer modal:", err),
        );
    }
  }, [enquiry]);

  // Rework Status and Remarks
  const anyTrophyRework = trophies.some((t) => t.is_rework);
  const isRework =
    anyTrophyRework ||
    theBrief.design_status === "rework" ||
    wizardState.designStatus === "rework";
  const reworkNotes =
    activeTrophy?.rework_notes ||
    theBrief.rework_notes ||
    wizardState.designReworkRemarks ||
    "Client requested changes.";

  // Quotation stage and design approval lock checks:
  // Once a design is approved and moves to the quotation stage, extra design uploads are locked.
  const isJobInQuotationOrBeyond = Boolean(
    rawJob.wizard_state?.quoted ||
    rawJob.wizard_state?.s?.quoted ||
    rawJob.quoted ||
    rawJob.wizard_state?.costReq ||
    (Array.isArray(rawJob.common_files?.quotations) && rawJob.common_files.quotations.length > 0) ||
    rawJob.step >= 3 ||
    (rawJob.stage && !["enquiry", "brief"].includes(rawJob.stage))
  );

  // Strictly per-product lock: Extra uploads are locked ONLY if THIS specific product design is approved
  const checkIsTrophyLocked = (t) => {
    if (!t) return false;
    return Boolean(t.is_approved && !t.is_rework);
  };

  const isActiveTrophyLocked = checkIsTrophyLocked(activeTrophy);

  // Open Preview Confirmation Modal when a file is selected
  const handleSelectFile = (trophyIdx, optIdx, file) => {
    if (!file) return;
    const targetTrophy = trophies[trophyIdx] || activeTrophy;
    if (checkIsTrophyLocked(targetTrophy)) {
      toast.warn("This design option is already approved and the job has moved to quotation. Extra design uploads are locked.");
      return;
    }
    const reqOptions = Math.max(1, Number(targetTrophy?.requiredOptions) || 2);
    const extraOpts = Number(
      wizardState.extraDesignOptions?.[trophyIdx] ||
      wizardState.extraDesignOptions?.[String(trophyIdx)] ||
      0
    );
    const effectiveRequired = reqOptions + extraOpts;

    if (!targetTrophy?.is_rework && optIdx >= effectiveRequired) {
      toast.error(`Only ${effectiveRequired} design option(s) can be uploaded for this job as specified in the enquiry.`);
      return;
    }

    const slotKey = `${trophyIdx}-${optIdx}`;
    if (uploadedDesigns[slotKey]) {
      toast.warn("Existing design options cannot be replaced. Please upload your new design as the next option.");
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setPendingUpload({
      file,
      previewUrl,
      trophyIdx,
      optIdx,
      trophyName: targetTrophy?.name || activeTrophy.name,
      subJobNo: targetTrophy?.sub_job_no || activeTrophy.sub_job_no,
      slotLabel: `Option ${optIdx + 1}`,
    });
    setConfirmModalOpen(true);
  };

  // Confirm & Upload to Cloudflare R2
  const handleConfirmUpload = async () => {
    if (!pendingUpload) return;
    const { trophyIdx, optIdx, file } = pendingUpload;
    const targetTrophy = trophies[trophyIdx] || activeTrophy;
    if (checkIsTrophyLocked(targetTrophy)) {
      toast.error("Design is already approved and job is in quotation stage. Uploads are locked.");
      setConfirmModalOpen(false);
      setPendingUpload(null);
      return;
    }
    const reqOptions = Math.max(1, Number(targetTrophy?.requiredOptions) || 2);
    const extraOpts = Number(
      wizardState.extraDesignOptions?.[trophyIdx] ||
      wizardState.extraDesignOptions?.[String(trophyIdx)] ||
      0
    );
    const effectiveRequired = reqOptions + extraOpts;

    if (!targetTrophy?.is_rework && optIdx >= effectiveRequired) {
      toast.error(`Maximum design option count (${effectiveRequired}) reached.`);
      setConfirmModalOpen(false);
      setPendingUpload(null);
      return;
    }

    const slotKey = `${trophyIdx}-${optIdx}`;
    if (uploadedDesigns[slotKey]) {
      toast.error("Existing design options cannot be overwritten.");
      setConfirmModalOpen(false);
      setPendingUpload(null);
      return;
    }
    setConfirmUploading(true);
    setUploadingSlots((prev) => ({ ...prev, [slotKey]: true }));

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "clientId",
        rawJob.customer_id?._id ||
        rawJob.customer_id ||
        enquiry?.customer_id ||
        "",
      );
      formData.append(
        "clientName",
        rawJob.customer_id?.name ||
        enquiry?.customer ||
        enquiry?.name ||
        "Client",
      );
      formData.append(
        "enquiryNo",
        enquiry?.job_no || enquiry?.enquiry_no || "RD_ENQUIRY",
      );
      formData.append("folderType", "design");
      formData.append("subJobNo", activeTrophy.sub_job_no || "A1");

      const res = await axiosInstance.post(
        "/enquiry-flow-integration/upload",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );

      if (res.data?.success) {
        const permanentFileUrl = res.data.data?.file_url || res.data.data?.signed_url;
        const displayFileUrl = res.data.data?.signed_url || res.data.data?.file_url;
        const nextUploaded = {
          ...uploadedDesigns,
          [slotKey]: permanentFileUrl,
        };
        setUploadedDesigns((prev) => ({
          ...prev,
          [slotKey]: displayFileUrl,
        }));

        // Immediately persist link and all status changes to MongoDB database
        const targetJobId =
          rawJob?._id ||
          fullJob?._id ||
          enquiry?._id ||
          enquiry?.id ||
          rawJob?.enquiry_no ||
          enquiry?.job_no ||
          enquiry?.enquiry_no;

        if (targetJobId) {
          try {
            const saveRes = await axiosInstance.post(
              `/enquiry-flow-integration/${targetJobId}/designer-upload`,
              {
                trophyIndex: trophyIdx,
                optionIndex: optIdx,
                fileUrl: permanentFileUrl,
                uploadedDesigns: nextUploaded,
                designStatus: "uploaded",
              }
            );
            if (saveRes.data?.data) {
              setFullJob(saveRes.data.data);
            }
            if (typeof onRefresh === "function") {
              onRefresh();
            }
          } catch (dbErr) {
            console.error("Auto-save design link to DB error:", dbErr);
            toast.error(
              dbErr.response?.data?.message || "Design uploaded to R2, but failed to save link to DB!"
            );
            return;
          }
        }

        toast.success(
          `Option ${optIdx + 1} confirmed, uploaded and saved to DB!`,
        );
        setConfirmModalOpen(false);
        setPendingUpload(null);
      } else {
        toast.error(res.data?.message || "Upload failed");
      }
    } catch (err) {
      console.error("Error uploading design to R2:", err);
      toast.error(
        err.response?.data?.message || "Failed to upload to Cloudflare R2",
      );
    } finally {
      setUploadingSlots((prev) => ({ ...prev, [slotKey]: false }));
      setConfirmUploading(false);
    }
  };
  // Check overall completion (only for active custom trophies: non-held, non-dropped, non-ready)
  const checkAllCompleted = () => {
    const activeCustomTrophies = trophies.filter((t) => !t.is_on_hold && !t.is_dropped && t.kind !== "ready");
    if (activeCustomTrophies.length === 0) return true;
    return activeCustomTrophies.every((t) => {
      const req = t.requiredOptions || 1;
      const uploadedCount = Object.keys(uploadedDesigns).filter(
        (k) => k.startsWith(`${t.index}-`) && Boolean(uploadedDesigns[k])
      ).length;
      if (uploadedCount < req) return false;

      // If trophy is in rework/revision, verify that a fresh design option (not in rework) has been uploaded
      if (t.is_rework) {
        const reworkOptIndices = new Set();
        (t.feedbacks || []).forEach((fb) => {
          if (fb && (fb.mode === "revision" || fb.mode === "reject")) {
            (fb.optIdxs || [0]).forEach((idx) => reworkOptIndices.add(idx));
          }
        });
        if (reworkOptIndices.size === 0) reworkOptIndices.add(0);

        const hasFreshRevision = Object.keys(uploadedDesigns).some((k) => {
          if (!k.startsWith(`${t.index}-`)) return false;
          const optIdx = Number(k.split("-")[1]);
          return Boolean(uploadedDesigns[k]) && !reworkOptIndices.has(optIdx);
        });

        if (!hasFreshRevision) return false;
      }
      return true;
    });
  };

  const isAllUploaded = checkAllCompleted();
  const hasUploadedAny = Object.values(uploadedDesigns).some(
    (url) => Boolean(url && String(url).trim())
  );



  return (
    <div className="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-6xl max-h-[90vh] flex flex-col overflow-hidden text-gray-800">
      {/* ── Modal Header ── */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-slate-50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-black flex items-center justify-center text-sm shadow-md">
            RD
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-gray-900 tracking-tight">
                {enquiry?.job_no || enquiry?.enquiry_no || "Enquiry"}
              </h2>
              {isRework ? (
                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                  🟠 REWORK REQUIRED
                </span>
              ) : isAllUploaded ? (
                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  🟢 ALL DESIGNS UPLOADED
                </span>
              ) : (
                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-300">
                  🎨 DESIGN WORKSPACE
                </span>
              )}
              <DesignerDueCountdownBadge enquiry={{ ...enquiry, rawJob }} />
            </div>
            <p className="text-xs text-gray-500 font-medium">
              Client: <b>{enquiry?.customer || enquiry?.name || "Client"}</b> ·
              Total Trophies: <b>{trophies.length}</b>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 flex items-center justify-center font-bold text-sm transition cursor-pointer"
        >
          ✕
        </button>
      </div>

      {/* ── Main Modal Body: Left Trophies List + Right Workspace ── */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-0">
        {/* Left Side: Trophy Selector Tabs */}
        <div className="md:col-span-4 border-r border-gray-200 bg-gray-50 p-4 overflow-y-auto space-y-2.5">
          <div className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider px-1">
            Trophies / Sub-Jobs ({trophies.length})
          </div>

          {trophies.map((t, idx) => {
            const req = t.requiredOptions || 2;
            const uploadedCount = Object.keys(uploadedDesigns).filter(
              (k) => k.startsWith(`${t.index}-`) && Boolean(uploadedDesigns[k])
            ).length;
            const isCompleted = uploadedCount >= req;
            const isSelected = idx === activeTrophyIdx;

            return (
              <div
                key={t.index}
                onClick={() => setActiveTrophyIdx(idx)}
                className={`p-3.5 rounded-xl border-2 transition cursor-pointer ${isSelected
                  ? "border-indigo-600 bg-white shadow-md ring-2 ring-indigo-100"
                  : "border-gray-200 bg-white/70 hover:bg-white hover:border-gray-300"
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900 truncate">
                    {t.name}
                  </span>
                  {t.is_dropped ? (
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200">
                      ✕ Dropped
                    </span>
                  ) : t.is_on_hold ? (
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                      ⏳ On Hold
                    </span>
                  ) : t.kind === "ready" ? (
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                      📦 Ready Stock
                    </span>
                  ) : t.is_approved ? (
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                      ✓ Approved
                    </span>
                  ) : t.is_rework ? (
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-400 animate-pulse flex items-center gap-1">
                      ⚠️ Rework
                    </span>
                  ) : isCompleted ? (
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                      ⏳ Reviewing ({uploadedCount}/{req})
                    </span>
                  ) : (
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                      {uploadedCount}/{req} Uploaded
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-2 text-[11px] text-gray-500">
                  <span>
                    Sizes:{" "}
                    {Array.isArray(t.sizes) ? t.sizes.join(", ") : t.sizes}
                  </span>
                  <span>·</span>
                  <span>Qty: {t.quantity}</span>
                </div>

                {t.variants && t.variants.length > 1 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {t.variants.map((v, vi) => (
                      <span
                        key={v.sub_job_no || vi}
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${v.is_dropped
                          ? "bg-rose-100 text-rose-700 line-through"
                          : v.is_on_hold
                            ? "bg-amber-100 text-amber-800"
                            : "bg-gray-100 text-gray-700"
                          }`}
                      >
                        {v.sub_job_no.split("-")[1] || v.sub_job_no} ({v.size})
                        {v.is_dropped ? " · DROP" : v.is_on_hold ? " · HOLD" : ""}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right Side: Active Trophy Workspace */}
        <div className="md:col-span-8 p-6 overflow-y-auto space-y-6">
          {/* Section 1: Trophy Header & Brief */}
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-indigo-950">
                  {activeTrophy.name}
                </h3>
                <span className="text-xs text-indigo-700 font-semibold">
                  Required Design Options: <b>{Math.max(1, Number(activeTrophy.requiredOptions) || 2) + Number(wizardState.extraDesignOptions?.[activeTrophy.index] || wizardState.extraDesignOptions?.[String(activeTrophy.index)] || 0)}</b>
                </span>
              </div>

              {/* Right Top Corner: Sub-Job Numbers with Size and Hold/Drop Status */}
              <div className="flex flex-wrap sm:flex-col items-start sm:items-end gap-1.5 self-start">
                {(activeTrophy.variants && activeTrophy.variants.length > 0
                  ? activeTrophy.variants
                  : [{ sub_job_no: activeTrophy.sub_job_no, size: Array.isArray(activeTrophy.sizes) ? activeTrophy.sizes.join(", ") : (activeTrophy.sizes || "8 in"), is_on_hold: activeTrophy.is_on_hold, is_dropped: activeTrophy.is_dropped }]
                ).map((v, vIdx) => (
                  <div
                    key={v.sub_job_no || vIdx}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono font-semibold shadow-2xs transition ${v.is_dropped
                      ? "bg-rose-50 border-rose-300 text-rose-700"
                      : v.is_on_hold
                        ? "bg-amber-50 border-amber-300 text-amber-900"
                        : "bg-white border-indigo-200 text-indigo-950"
                      }`}
                  >
                    <span className={v.is_dropped ? "line-through opacity-70" : ""}>
                      {v.sub_job_no}
                    </span>
                    {v.size && (
                      <span className="text-[11px] font-sans font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                        {v.size}
                      </span>
                    )}
                    {v.is_dropped ? (
                      <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-200 text-rose-800">
                        DROPPED
                      </span>
                    ) : v.is_on_hold ? (
                      <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">
                        HOLD
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            {/* Brief Text */}
            {activeTrophy.brief && (
              <div className="text-xs text-gray-700 bg-white p-3 rounded-lg border border-indigo-100/80 leading-relaxed">
                <span className="font-bold text-gray-900 block mb-1">
                  Brief Instructions:
                </span>
                {activeTrophy.brief}
              </div>
            )}

            {/* Client Reference Images */}
            {activeTrophy.refs && activeTrophy.refs.length > 0 && (
              <div>
                <span className="text-[11px] font-bold text-gray-600 block mb-1.5 uppercase tracking-wider">
                  Client Reference Images (Click to Zoom):
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {activeTrophy.refs.map((ref, rIdx) => {
                    const imgUrl =
                      typeof ref === "string"
                        ? ref
                        : ref.signed_url ||
                        ref.url ||
                        ref.file_url ||
                        ref.dataUrl ||
                        ref.preview ||
                        "";
                    if (!imgUrl) return null;
                    return (
                      <div
                        key={rIdx}
                        className="w-16 h-16 rounded-xl overflow-hidden border border-gray-300 shadow-xs cursor-zoom-in group relative bg-gray-100 flex items-center justify-center"
                        onClick={() => setPreviewModalData({ url: imgUrl, title: ref.name || `Reference ${rIdx + 1}` })}
                        title={ref.name || `Reference ${rIdx + 1}`}
                      >
                        <img
                          src={imgUrl}
                          alt={ref.name || `Ref ${rIdx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.classList.add("opacity-40");
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Option Upload Slots (Auto-generated based on CS count) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider">
                Upload Design Options (Images directly to Cloudflare R2)
              </h4>
              <span className="text-[11px] text-gray-500">
                Format: PNG, JPG, WebP
              </span>
            </div>

            {activeTrophy.is_on_hold ? (
              <div className="p-6 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <span className="text-xl">⏳</span>
                  <span>This product is currently on HOLD</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  {activeTrophy.hold_reason ? `Reason: ${activeTrophy.hold_reason}` : "Client Servicing has placed this product on hold."}
                </p>
                <div className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-2.5 py-1 rounded inline-block">
                  Design upload is paused for this product. You can continue uploading designs for other active products.
                </div>
              </div>
            ) : activeTrophy.is_dropped ? (
              <div className="p-6 rounded-2xl bg-gray-100 border-2 border-gray-300 text-gray-700 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm text-rose-700">
                  <span className="text-xl">✕</span>
                  <span>This product was DROPPED</span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {activeTrophy.drop_reason ? `Reason: ${activeTrophy.drop_reason}` : "This product was dropped from the enquiry."}
                </p>
                <div className="text-[11px] font-semibold text-gray-500 bg-gray-200 px-2.5 py-1 rounded inline-block">
                  Design upload is disabled for dropped products.
                </div>
              </div>
            ) : activeTrophy.kind === "ready" ? (
              <div className="p-6 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm text-emerald-900">
                  <span className="text-xl">📦</span>
                  <span>Ready Stock Product — No Design Upload Required</span>
                </div>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  This product ({activeTrophy.name}) is selected directly from the ready-stock catalog. Custom artwork design upload is skipped and it proceeds directly to quotation and production.
                </p>
                <div className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-lg inline-block">
                  ✓ Ready for production/dispatch directly
                </div>
              </div>
            ) : (
              <>
                {activeTrophy.variants && activeTrophy.variants.some((v) => v.is_on_hold || v.is_dropped) && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                    <span className="text-base">ℹ️</span>
                    <span>
                      Active sizes: <b>{activeTrophy.variants.filter((v) => !v.is_on_hold && !v.is_dropped).map((v) => `${v.sub_job_no} (${v.size})`).join(", ")}</b>. (Note: {activeTrophy.variants.filter((v) => v.is_on_hold || v.is_dropped).map((v) => `${v.sub_job_no} is ${v.is_dropped ? 'DROPPED' : 'ON HOLD'}`).join(", ")}).
                    </span>
                  </div>
                )}

                {activeTrophy.is_rework && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">⚠️</span>
                      <div>
                        <span className="font-extrabold text-amber-900">Client requested changes</span>
                        <span className="text-[11px] block text-amber-800">
                          Previous design options are locked for reference and cannot be replaced. Please upload your revised artwork as a new option below.
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                      Revision Mode
                    </span>
                  </div>
                )}

                {isActiveTrophyLocked && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-950 flex items-center justify-between mb-3 shadow-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                        ✓
                      </div>
                      <div>
                        <span className="font-extrabold text-emerald-950 text-xs block">
                          Design Approved &amp; Moved to Quotation
                        </span>
                        <span className="text-[11px] block text-emerald-800">
                          Client has approved the design and this job is now in the quotation stage. Additional design option uploads are locked.
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-200 text-emerald-900 border border-emerald-300 shrink-0">
                      Uploads Locked
                    </span>
                  </div>
                )}

                {(() => {
                  const activeTrophyIdx = activeTrophy.index;
                  const reqOptions = Math.max(1, Number(activeTrophy.requiredOptions) || 2);
                  const uploadedOptKeys = Object.keys(uploadedDesigns || {}).filter(
                    (k) => k.startsWith(`${activeTrophyIdx}-`) && Boolean(uploadedDesigns[k])
                  );
                  const uploadedOptIndices = uploadedOptKeys
                    .map((k) => Number(k.split("-")[1]))
                    .filter((n) => !isNaN(n));
                  const maxUploadedOptIdx = uploadedOptIndices.length > 0 ? Math.max(...uploadedOptIndices) : -1;

                  const extraOpts = Number(
                    wizardState.extraDesignOptions?.[activeTrophyIdx] ||
                    wizardState.extraDesignOptions?.[String(activeTrophyIdx)] ||
                    0
                  );
                  const effectiveRequired = reqOptions + extraOpts;

                  // In rework mode, check if a fresh revision has already been uploaded
                  const reworkOptIndices = new Set();
                  if (activeTrophy.is_rework) {
                    (activeTrophy.feedbacks || []).forEach((fb) => {
                      if (fb && (fb.mode === "revision" || fb.mode === "reject")) {
                        (fb.optIdxs || [0]).forEach((idx) => reworkOptIndices.add(idx));
                      }
                    });
                    if (reworkOptIndices.size === 0) reworkOptIndices.add(0);
                  }

                  const hasFreshRevision = activeTrophy.is_rework && uploadedOptIndices.some(
                    (optIdx) => !reworkOptIndices.has(optIdx)
                  );

                  const isLockedByApproval = checkIsTrophyLocked(activeTrophy);

                  // Strictly show only up to effectiveRequired options.
                  // Only allow an extra revision slot if trophy is in rework and no fresh revision has been uploaded yet.
                  const needsRevisionSlot = activeTrophy.is_rework && !hasFreshRevision && (maxUploadedOptIdx >= effectiveRequired - 1);
                  const allowedSlots = needsRevisionSlot ? maxUploadedOptIdx + 2 : effectiveRequired;
                  // If design is approved and in quotation, do not show unfilled extra slots beyond existing uploads
                  const displayedSlotsCount = isLockedByApproval
                    ? Math.max(maxUploadedOptIdx + 1, 1)
                    : Math.max(allowedSlots, maxUploadedOptIdx + 1);

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Array.from({ length: displayedSlotsCount }).map((_, optIdx) => {
                        const slotKey = `${activeTrophy.index}-${optIdx}`;
                        const fileUrl = uploadedDesigns[slotKey];
                        const isUploading = uploadingSlots[slotKey];

                        // Resolve feedback for this specific option
                        const optFeedback = (activeTrophy.feedbacks || []).find((f) =>
                          Array.isArray(f?.optIdxs) && f.optIdxs.includes(optIdx)
                        ) || (activeTrophy.active_feedback?.optIdxs?.includes(optIdx) ? activeTrophy.active_feedback : null);
                        const isOptApproved = optFeedback?.mode === "approve";
                        const isOptRevision = optFeedback?.mode === "revision";
                        const isOptRejected = optFeedback?.mode === "reject";

                        return (
                          <div
                            key={optIdx}
                            className="border-2 border-dashed border-gray-300 rounded-2xl p-4 flex flex-col items-center justify-center bg-gray-50/50 hover:bg-white hover:border-indigo-400 transition min-h-[190px] relative group overflow-hidden"
                          >
                            {isUploading ? (
                              <div className="flex flex-col items-center gap-2 text-indigo-600">
                                <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                <span className="text-xs font-bold">
                                  Uploading to R2...
                                </span>
                              </div>
                            ) : fileUrl ? (
                              <div className="w-full h-full flex flex-col items-center justify-between">
                                <div
                                  className="w-full h-32 rounded-xl overflow-hidden cursor-zoom-in relative border border-gray-200 shadow-xs"
                                  onClick={() => setPreviewModalData({ url: fileUrl, title: `${activeTrophy.name} — Option ${optIdx + 1}`, optFeedback })}
                                >
                                  <img
                                    src={fileUrl}
                                    alt={`Option ${optIdx + 1}`}
                                    className="w-full h-full object-cover group-hover:scale-105 transition"
                                    onError={(e) => {
                                      e.currentTarget.onerror = null;
                                      e.currentTarget.style.display = "none";
                                      if (e.currentTarget.parentElement) {
                                        const fb = document.createElement("div");
                                        fb.className = "flex flex-col items-center justify-center w-full h-full text-slate-400 bg-slate-100 p-2 text-center";
                                        fb.innerHTML = '<span class="text-xl mb-1">🎨</span><span class="text-[10px] font-medium text-slate-500">Preview Unavailable</span>';
                                        e.currentTarget.parentElement.appendChild(fb);
                                      }
                                    }}
                                  />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition font-bold text-xs">
                                    🔍 Zoom Preview
                                  </div>
                                </div>

                                <div className="w-full flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                                  <span className="text-xs font-bold text-gray-800">
                                    Option {optIdx + 1}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    {isOptApproved ? (
                                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-300">
                                        ✓ Approved
                                      </span>
                                    ) : isOptRevision ? (
                                      <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                                        ⚠️ Changes Asked
                                      </span>
                                    ) : isOptRejected ? (
                                      <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-300">
                                        ✕ Rejected
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-bold text-gray-600 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-200">
                                        ✓ Uploaded
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Option-Specific Client Remark */}
                                {optFeedback?.remark && (
                                  <div className={`w-full mt-2 p-2 rounded-lg text-[11px] border leading-snug text-left ${isOptRevision
                                    ? "bg-amber-50/90 border-amber-300 text-amber-900"
                                    : isOptRejected
                                      ? "bg-rose-50/90 border-rose-300 text-rose-900"
                                      : "bg-emerald-50/90 border-emerald-300 text-emerald-900"
                                    }`}>
                                    <span className="font-extrabold block text-[10px] uppercase tracking-wider mb-0.5">
                                      {isOptRevision ? "Client Revision Note:" : isOptRejected ? "Rejection Reason:" : "Client Note:"}
                                    </span>
                                    "{optFeedback.remark}"
                                  </div>
                                )}
                              </div>
                            ) : isLockedByApproval ? (
                              <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gray-50/80 rounded-xl border border-gray-200">
                                <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-base mb-1.5 font-bold border border-emerald-300">
                                  ✓
                                </div>
                                <span className="text-xs font-bold text-gray-800 block">
                                  Option {optIdx + 1} Not Required
                                </span>
                                <span className="text-[10px] text-emerald-800 font-semibold mt-1 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                                  Design Approved &amp; in Quotation
                                </span>
                              </div>
                            ) : (
                              <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer p-4 text-center">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl mb-2 font-light group-hover:scale-110 transition">
                                  +
                                </div>
                                <span className="text-xs font-bold text-gray-800 block">
                                  {isRework && optIdx > 0 ? `Upload Revised (Option ${optIdx + 1})` : `Upload Option ${optIdx + 1}`}
                                </span>
                                <span className="text-[10px] text-gray-400 mt-1">
                                  Click to select design file
                                </span>
                                <input
                                  type="file"
                                  accept="image/png, image/jpeg, image/webp"
                                  className="hidden"
                                  onChange={(e) => {
                                    handleSelectFile(
                                      activeTrophy.index,
                                      optIdx,
                                      e.target.files[0],
                                    );
                                    e.target.value = null;
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal Footer ── */}
      <div className="px-6 py-4 border-t border-gray-200 bg-slate-50 flex items-center justify-between flex-shrink-0">
        <div className="text-xs text-gray-500">
          Status:{" "}
          {isAllUploaded ? (
            <span className="text-emerald-600 font-bold">
              ✓ All required designs uploaded & saved to database
              {trophies.some((t) => t.is_on_hold || t.is_dropped || t.kind === "ready") && (
                <span className="text-amber-700 text-xs ml-1 font-medium">
                  ({[
                    trophies.filter((t) => t.is_on_hold).length > 0 ? `${trophies.filter((t) => t.is_on_hold).length} on hold` : null,
                    trophies.filter((t) => t.is_dropped).length > 0 ? `${trophies.filter((t) => t.is_dropped).length} dropped` : null,
                    trophies.filter((t) => t.kind === "ready").length > 0 ? `${trophies.filter((t) => t.kind === "ready").length} ready stock` : null
                  ].filter(Boolean).join(", ")})
                </span>
              )}
            </span>
          ) : hasUploadedAny ? (
            <span className="text-emerald-600 font-bold">
              ✓ Design options uploaded & saved to database
            </span>
          ) : (
            <span className="text-amber-600 font-medium">
              Please upload design options
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (onRefresh) onRefresh();
              onClose();
            }}
            className="px-6 py-2.5 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-100 shadow-xs transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* ── Image Confirmation & Preview Modal (Before uploading to R2) ── */}
      <ImageConfirmModal
        isOpen={confirmModalOpen && Boolean(pendingUpload)}
        pendingUpload={pendingUpload}
        trophies={trophies}
        uploadedDesigns={uploadedDesigns}
        confirmUploading={confirmUploading}
        onClose={() => {
          if (!confirmUploading) {
            setConfirmModalOpen(false);
            setPendingUpload(null);
          }
        }}
        onConfirm={handleConfirmUpload}
      />

      {/* ── Zoom Preview Modal with Full Client Note ── */}
      <DesignZoomPreviewModal
        previewModalData={previewModalData}
        onClose={() => setPreviewModalData(null)}
      />
    </div>
  );
};

export default MultiTrophyDesignModal;
