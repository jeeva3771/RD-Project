import React, { useEffect, useState, useRef, useMemo } from "react";
import PrintEnquiryLog from "../print/PrintEnquiryLog";
import DesignPreviewSheet from "./DesignPreviewSheet";
import PreviewQuoteSheet from "./PreviewQuoteSheet";
import SubJobQuotationCard from "./log-step/SubJobQuotationCard";
import DesignArtworkStatusBanner from "./log-step/DesignArtworkStatusBanner";
import ImageLightbox from "../../../common/ImageLightbox";
import EnquiryIntakeSection from "./log-step/EnquiryIntakeSection";
import ProductDelinkModal from "./log-step/ProductDelinkModal";
import DesignOptionsSection from "./log-step/DesignOptionsSection";
import JobScoreAndDecisionSection from "./log-step/JobScoreAndDecisionSection";
import { allReady, formatEnquiryNo, ENQUIRY_CONFIG } from "../../utils/helpers";
import {
  buildLifecycleSteps,
  computeFlattenedProducts,
  delinkHoldSubJobs,
  dropSubJobs,
  unholdSubJob,
  holdSingleSubJob,
  dropSingleSubJob,
  processProductFeedback,
} from "./log-step/logStepOperations";
import { toast } from "react-toastify";
import { axiosInstance } from "../../../../utils/url/config";

const LogStep = ({
  s,
  set,
  client,
  heat,
  est,
  ids,
  goOrder,
  isLocked = false,
}) => {
  const isJobBlocked = Boolean(
    isLocked ||
    s?.is_lost ||
    s?.stage === "cancelled" ||
    s?.stage === "lost" ||
    s?.rawJob?.is_lost ||
    s?.rawJob?.stage === "cancelled" ||
    s?.wizard_state?.is_lost ||
    s?.isLocked,
  );

  const [showDelink, setShowDelink] = useState(false);
  const [delinkSel, setDelinkSel] = useState([]);
  const [delinkReason, setDelinkReason] = useState("Design not approved yet");
  const [delinkNote, setDelinkNote] = useState("");
  const [isDelinkActionLoading, setIsDelinkActionLoading] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [showDesignPreview, setShowDesignPreview] = useState(false);
  const [showFinalDesignShare, setShowFinalDesignShare] = useState(false);
  const [showFinalDesignOptions, setShowFinalDesignOptions] = useState(false);
  const [showPreviewQuoteSheet, setShowPreviewQuoteSheet] = useState(false);
  const [uploadedDesigns, setUploadedDesigns] = useState(
    s.uploadedDesigns || {},
  );

  useEffect(() => {
    if (s.uploadedDesigns) {
      setUploadedDesigns(s.uploadedDesigns);
    }
  }, [s.uploadedDesigns]);

  const [isUploadingR2, setIsUploadingR2] = useState(false);
  const [unselectedProducts, setUnselectedProducts] = useState(new Set());
  const [previewDesignKey, setPreviewDesignKey] = useState(null);
  const [simulatedRates, setSimulatedRates] = useState(s.simulatedRates || {});
  const [quoteSelectedProducts, setQuoteSelectedProducts] = useState(new Set());
  const prevCostingLinesRef = useRef(null);

  const e = useMemo(() => s.e || {}, [s.e]);
  const setE = (p, typedKey) =>
    set({
      e: { ...e, ...p },
      typed: typedKey ? { ...s.typed, [typedKey]: true } : s.typed,
    });

  const productsList = useMemo(() => {
    const trophyGroups = e.trophyGroups || [];
    return trophyGroups.length > 0
      ? trophyGroups.map((g, i) => {
        const isReady = Boolean(
          g.kind === "ready" ||
          g.type === "Ready Trophy" ||
          e.askMode === "ready" ||
          e.kind === "ready",
        );
        return {
          name:
            g.theme ||
            g.name ||
            (isReady
              ? g.readyCode
                ? `Ready Trophy (${g.readyCode})`
                : `Ready Trophy ${i + 1}`
              : `Product ${i + 1}`),
          kind: isReady ? "ready" : g.kind || "custom",
          readyCode: g.readyCode || g.sku || "",
          items: g.items || [],
          is_on_hold: Boolean(g.is_on_hold),
          hold_reason: g.hold_reason || "",
          is_dropped: Boolean(g.is_dropped),
          drop_reason: g.drop_reason || "",
        };
      })
      : [
        {
          name:
            e.theme ||
            (e.kind === "ready" || e.askMode === "ready"
              ? "Ready Trophy"
              : "Custom Trophy"),
          kind:
            e.kind === "ready" || e.askMode === "ready" ? "ready" : "custom",
          readyCode: e.readyCode || e.sku || "",
          items: [{ size: e.size || 8, qty: e.qty || 50 }],
          is_on_hold: false,
          is_dropped: false,
        },
      ];
  }, [e]);

  const [productFeedback, setProductFeedback] = useState({});
  const updateProductFeedback = (pIdx, field, value) => {
    setProductFeedback((prev) => {
      if (typeof field === "object" && field !== null) {
        return {
          ...prev,
          [pIdx]: { ...(prev[pIdx] || {}), ...field },
        };
      }
      return {
        ...prev,
        [pIdx]: { ...(prev[pIdx] || {}), [field]: value },
      };
    });
  };

  const getSubjobId = (index) => {
    let group = 0;
    let variant = 1;
    for (let i = 1; i <= index; i++) {
      if (productsList[i].name === productsList[i - 1].name) {
        variant++;
      } else {
        group++;
        variant = 1;
      }
    }
    return String.fromCharCode(65 + group) + variant;
  };

  const [localConfirmed, setLocalConfirmed] = useState({});

  useEffect(() => {
    if (s.productFeedback && typeof s.productFeedback === "object") {
      setLocalConfirmed((prev) => ({
        ...prev,
        ...s.productFeedback,
      }));
    }
  }, [s.productFeedback]);

  const targetDbId = s.dbJobId || s._id || s.rawJob?._id || ids?.id;
  const parentJobNo = s?.seq
    ? formatEnquiryNo(s.seq)
    : (ids?.enq?.startsWith("RD")
      ? ids.enq
      : ids?.enq?.replace("ENQ/26/", "RD")) || ENQUIRY_CONFIG.DEFAULT_ENQUIRY_NO;

  const handleDelinkHoldAction = async () => {
    if (!delinkSel.length) {
      toast.warn("Please select at least one product to delink / hold");
      return;
    }
    setIsDelinkActionLoading(true);
    try {
      await delinkHoldSubJobs({
        delinkSel,
        delinkReason,
        delinkNote,
        targetDbId,
        parentJobNo,
        e,
        s,
        set,
      });
      setDelinkSel([]);
      setShowDelink(false);
    } catch (err) {
      console.error("Error holding product:", err);
      toast.error("Failed to hold product");
    } finally {
      setIsDelinkActionLoading(false);
    }
  };

  const handleUnholdAction = async (subJobNo, groupChar, groupIdx) => {
    try {
      await unholdSubJob({
        subJobNo,
        groupChar,
        groupIdx,
        targetDbId,
        parentJobNo,
        e,
        s,
        set,
      });
    } catch (err) {
      console.error("Error unholding product:", err);
      toast.error("Failed to unhold product");
    }
  };

  const handleDropProductsAction = async () => {
    if (!delinkSel.length) {
      toast.warn("Please select at least one product to drop");
      return;
    }
    setIsDelinkActionLoading(true);
    try {
      await dropSubJobs({
        delinkSel,
        delinkReason,
        delinkNote,
        targetDbId,
        parentJobNo,
        e,
        s,
        set,
      });
      setDelinkSel([]);
      setShowDelink(false);
    } catch (err) {
      console.error("Error dropping product:", err);
      toast.error("Failed to drop product");
    } finally {
      setIsDelinkActionLoading(false);
    }
  };

  const handleHoldSingleSubJobAction = async (subJobNo, reason) => {
    try {
      await holdSingleSubJob({
        subJobNo,
        reason,
        targetDbId,
        parentJobNo,
        e,
        s,
        set,
      });
    } catch (err) {
      console.error("Error holding sub-job:", err);
      toast.error("Failed to hold sub-job");
    }
  };

  const handleDropSingleSubJobAction = async (subJobNo, reason) => {
    try {
      await dropSingleSubJob({
        subJobNo,
        reason,
        targetDbId,
        parentJobNo,
        e,
        s,
        set,
      });
    } catch (err) {
      console.error("Error dropping sub-job:", err);
      toast.error("Failed to drop sub-job");
    }
  };

  const confirmProductFeedback = (pIdx, communicationLog) => {
    processProductFeedback({
      pIdx,
      communicationLog,
      productFeedback,
      localConfirmed,
      setLocalConfirmed,
      setProductFeedback,
      s,
      set,
      e,
      ids,
      productsList,
      uploadedDesigns,
    });
  };

  const dbSubJobs = useMemo(() => (Array.isArray(s.sub_jobs) ? s.sub_jobs : []), [s.sub_jobs]);

  const flattenedProducts = useMemo(() => {
    return computeFlattenedProducts(
      productsList,
      e,
      unselectedProducts,
      parentJobNo,
      dbSubJobs,
      simulatedRates,
    );
  }, [
    productsList,
    e,
    unselectedProducts,
    parentJobNo,
    dbSubJobs,
    simulatedRates,
  ]);

  useEffect(() => {
    if (flattenedProducts.length > 0) {
      setQuoteSelectedProducts((prev) => {
        const next = new Set();
        prev.forEach((k) => {
          const item = flattenedProducts.find((fp) => fp.rateKey === k);
          if (item && !item.isHold && !item.isDrop) {
            next.add(k);
          }
        });

        if (next.size === 0 && prev.size === 0) {
          const completedKeys = flattenedProducts
            .filter(
              (fp) =>
                !fp.isDrop &&
                !fp.isHold &&
                (fp.costingStatus === "completed" || fp.unitRate > 0),
            )
            .map((fp) => fp.rateKey);

          if (completedKeys.length > 0) {
            return new Set(completedKeys);
          } else {
            const activeKeys = flattenedProducts
              .filter((fp) => !fp.isDrop && !fp.isHold)
              .map((fp) => fp.rateKey);
            return new Set(activeKeys);
          }
        }
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flattenedProducts.length, s.sub_jobs]);

  useEffect(() => {
    if (simulatedRates && Object.keys(simulatedRates).length > 0) {
      const lines = flattenedProducts.map((p) => {
        const r0 = Number(
          (simulatedRates[p.rateKey]?.rate !== undefined
            ? simulatedRates[p.rateKey].rate
            : p.unitRate || p.target_rate || p.rate || 0
          ).toFixed(2),
        );
        const sRate =
          simulatedRates[p.rateKey]?.sample !== undefined
            ? Number(Number(simulatedRates[p.rateKey].sample).toFixed(2))
            : r0 > 0
              ? Number((r0 + 200).toFixed(2))
              : 0;
        return {
          id: p.rateKey,
          name: `${p.subJobNo || `${ids?.enq || ENQUIRY_CONFIG.DEFAULT_ENQUIRY_NO}-${p.subjobId}`} ${p.name}`,
          spec: p.spec_line || `${p.name} · ${p.size} in`,
          kind: p.kind || "custom",
          source: "Agreed with client",
          rate: r0,
          slabs: [[p.qty, r0]],
          sampleRate: sRate,
        };
      });

      const linesStr = JSON.stringify(lines);
      if (prevCostingLinesRef.current !== linesStr) {
        prevCostingLinesRef.current = linesStr;
        set({
          costing: {
            ...(s.costing || {}),
            ref: ids?.enq || ENQUIRY_CONFIG.DEFAULT_ENQUIRY_NO,
            rate: lines[0]?.rate || 0,
            sampleRate: lines[0]?.sampleRate || 0,
            lines: lines,
          },
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulatedRates]);

  const [pendingUpload, setPendingUpload] = useState(null);

  const handleDesignUpload = (pIdx, optIdx, file) => {
    if (!file) return;
    const key = `${pIdx}-${optIdx}`;
    if (uploadedDesigns[key]) {
      toast.warn(
        "Existing design options cannot be replaced. Please upload your new design as the next option.",
      );
      return;
    }

    const baseOpt = e.briefMode === "each" && e.productBriefs?.[productsList[pIdx]?.name]?.designOptions
      ? e.productBriefs[productsList[pIdx]?.name].designOptions : e.designOptions || 2;
    const optCount = baseOpt + (s.extraDesignOptions?.[pIdx] || 0);
    const pFbs = Array.isArray(s.productFeedback?.[pIdx]) ? s.productFeedback[pIdx] : (s.productFeedback?.[pIdx] ? [s.productFeedback[pIdx]] : []);
    const isRework = pFbs.some((fb) => fb?.mode === "revision" || fb?.mode === "reject");
    const isApproved = pFbs.some((fb) => fb?.mode === "approve");
    const isJobInQuotation = Boolean(
      s.quoted ||
      s.costReq ||
      (Array.isArray(s.common_files?.quotations) && s.common_files.quotations.length > 0) ||
      s.step >= 3 ||
      (s.stage && !["enquiry", "brief"].includes(s.stage))
    );

    if (isApproved && !isRework && isJobInQuotation) {
      toast.warn("This product's design is already approved and moved to quotation. Extra design uploads are locked.");
      return;
    }

    if (!isRework && optIdx >= optCount) {
      toast.error(`Maximum design option count (${optCount}) reached for this product.`);
      return;
    }

    const url = URL.createObjectURL(file);
    setPendingUpload({ pIdx, optIdx, file, url });
  };

  const confirmUploadToR2 = async () => {
    if (!pendingUpload) return;
    const { pIdx, optIdx, file, url: localPreviewUrl } = pendingUpload;
    const key = `${pIdx}-${optIdx}`;
    if (uploadedDesigns[key]) {
      toast.error("Existing design options cannot be overwritten.");
      setPendingUpload(null);
      return;
    }

    const baseOpt = e.briefMode === "each" && e.productBriefs?.[productsList[pIdx]?.name]?.designOptions
      ? e.productBriefs[productsList[pIdx]?.name].designOptions : e.designOptions || 2;
    const optCount = baseOpt + (s.extraDesignOptions?.[pIdx] || 0);
    const pFbs = Array.isArray(s.productFeedback?.[pIdx]) ? s.productFeedback[pIdx] : (s.productFeedback?.[pIdx] ? [s.productFeedback[pIdx]] : []);
    const isRework = pFbs.some((fb) => fb?.mode === "revision" || fb?.mode === "reject");
    const isApproved = pFbs.some((fb) => fb?.mode === "approve");
    const isJobInQuotation = Boolean(
      s.quoted ||
      s.costReq ||
      (Array.isArray(s.common_files?.quotations) && s.common_files.quotations.length > 0) ||
      s.step >= 3 ||
      (s.stage && !["enquiry", "brief"].includes(s.stage))
    );

    if (isApproved && !isRework && isJobInQuotation) {
      toast.warn("This product's design is already approved and moved to quotation. Extra design uploads are locked.");
      return;
    }

    if (!isRework && optIdx >= optCount) {
      toast.error(`Maximum design option count (${optCount}) reached for this product.`);
      setPendingUpload(null);
      return;
    }

    setIsUploadingR2(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "clientId",
        client?.id || client?._id || s.clientId || "general",
      );
      formData.append("enquiryNo", ids?.enq || formatEnquiryNo(s.seq));
      formData.append("folderType", "design");
      formData.append(
        "subJobNo",
        `${ids?.enq || formatEnquiryNo(s.seq)}-${getSubjobId(pIdx)}`,
      );

      const res = await axiosInstance.post(
        "/enquiry-flow-integration/upload",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );

      const r2Url =
        res.data?.data?.signed_url ||
        res.data?.data?.file_url ||
        localPreviewUrl;
      setUploadedDesigns((prev) => {
        const next = { ...prev, [key]: r2Url };
        set({ uploadedDesigns: next });
        return next;
      });
      toast.success(`Option ${optIdx + 1} uploaded to Cloudflare R2!`);
    } catch (err) {
      console.warn("Could not upload to R2, saving locally:", err);
      setUploadedDesigns((prev) => {
        const next = { ...prev, [key]: localPreviewUrl };
        set({ uploadedDesigns: next });
        return next;
      });
      toast.info(`Option ${optIdx + 1} attached`);
    } finally {
      setIsUploadingR2(false);
      setPendingUpload(null);
    }
  };

  const removeDesign = (key) => {
    toast.warn("Uploaded design options cannot be deleted.");
  };

  const toggleProductSelection = (pIdx) => {
    const p = productsList[pIdx];
    if (p && (p.is_on_hold || p.is_dropped)) return;
    setUnselectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(pIdx)) next.delete(pIdx);
      else next.add(pIdx);
      return next;
    });
  };

  // User Role Logic
  let authUser = null;
  try {
    const raw = localStorage.getItem("user");
    if (raw) authUser = JSON.parse(raw);
  } catch (_err) {
    /* ignore */
  }

  const roleName = String(
    authUser?.role?.name || authUser?.role_obj?.name || authUser?.role || "",
  ).toLowerCase();

  const currentUser = authUser
    ? {
      ...authUser,
      name: authUser.name || "Executive",
      role: roleName || "admin",
    }
    : { name: "Admin", role: "admin" };
  const currentUserName = currentUser.name;

  const isCSExec =
    roleName.includes("executive") &&
    !roleName.includes("manager") &&
    !roleName.includes("admin") &&
    !authUser?.is_head;

  const canAssign =
    (roleName.includes("admin") ||
      roleName.includes("manager") ||
      authUser?.is_head === true) &&
    !isCSExec;

  const [coordinatorsList, setCoordinatorsList] = useState([]);

  useEffect(() => {
    let isMounted = true;
    axiosInstance
      .get("/enquiry-flow-integration/coordinators")
      .then((res) => {
        if (isMounted && res.data?.data && res.data.data.length > 0) {
          setCoordinatorsList(res.data.data);
          if (isCSExec) {
            set({ coordinator: currentUserName });
          }
        }
      })
      .catch((err) => {
        console.warn("Could not fetch coordinators:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [isCSExec, currentUserName, set]);

  useEffect(() => {
    if (isCSExec && s.coordinator !== currentUserName) {
      set({ coordinator: currentUserName });
    }
  }, [isCSExec, currentUserName, s.coordinator, set]);

  const sendingIndices = productsList
    .map((_, i) => i)
    .filter(
      (i) =>
        !unselectedProducts.has(i) &&
        !productsList[i].is_on_hold &&
        !productsList[i].is_dropped,
    );
  const customSendingIndices = sendingIndices.filter(
    (i) => productsList[i].kind !== "ready",
  );
  const hasCustomProducts = customSendingIndices.length > 0;
  const isAllReadyProducts = sendingIndices.length > 0 && !hasCustomProducts;
  const isDesignerRequired = e.designer !== false && hasCustomProducts;
  const hasAtLeastOneUpload = customSendingIndices.some((pIdx) =>
    Object.keys(uploadedDesigns).some((k) => k.startsWith(`${pIdx}-`)),
  );
  const isSendDisabled =
    hasCustomProducts &&
    (customSendingIndices.length === 0 || !hasAtLeastOneUpload);

  // Status refresh from backend (updates sub_jobs with newly uploaded production files)
  const [isRefreshingJobStatus, setIsRefreshingJobStatus] = useState(false);
  const handleRefreshJobStatus = async () => {
    if (!targetDbId) return;
    setIsRefreshingJobStatus(true);
    try {
      const res = await axiosInstance.get(
        `/enquiry-flow-integration/${targetDbId}`,
      );
      if (res.data?.data) {
        const freshJob = res.data.data;
        if (Array.isArray(freshJob.sub_jobs)) {
          set({ sub_jobs: freshJob.sub_jobs });
        }
        if (freshJob.wizard_state?.designApproved !== undefined) {
          set({ designApproved: freshJob.wizard_state.designApproved });
        }
      }
    } catch (err) {
      console.warn("Could not refresh sub-job statuses:", err);
    } finally {
      setIsRefreshingJobStatus(false);
    }
  };

  useEffect(() => {
    if (targetDbId) {
      handleRefreshJobStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetDbId]);

  // Compute status for custom sub-jobs: approved, uploaded, and awaiting upload
  const {
    approvedCustomSubJobs,
    uploadedCustomSubJobs,
    awaitingUploadSubJobs,
  } = useMemo(() => {
    if (!isDesignerRequired) {
      return {
        approvedCustomSubJobs: [],
        uploadedCustomSubJobs: [],
        awaitingUploadSubJobs: [],
      };
    }

    const approved = [];
    const uploaded = [];
    const awaiting = [];

    productsList.forEach((p, pIdx) => {
      if (p.kind === "ready" || p.is_dropped || p.is_on_hold) return;
      const groupChar = String.fromCharCode(65 + pIdx);
      const items =
        p.items && p.items.length > 0
          ? p.items
          : [{ size: e.size || 8, qty: e.qty || 50 }];

      const pFbs = Array.isArray(localConfirmed[pIdx])
        ? localConfirmed[pIdx]
        : localConfirmed[pIdx]
          ? [localConfirmed[pIdx]]
          : Array.isArray(s.productFeedback?.[pIdx])
            ? s.productFeedback[pIdx]
            : s.productFeedback?.[pIdx]
              ? [s.productFeedback[pIdx]]
              : [];
      const isProductApproved = pFbs.some((fb) => fb?.mode === "approve");

      items.forEach((item, sIdx) => {
        if (item.is_dropped || item.is_on_hold) return;
        const subJobNo = `${parentJobNo}-${groupChar}${sIdx + 1}`;
        const matchedDb = dbSubJobs.find(
          (sj) =>
            sj.sub_job_no === subJobNo ||
            sj.sub_job_no?.endsWith(`${groupChar}${sIdx + 1}`),
        );

        const isSubJobApproved =
          (Boolean(matchedDb?.design_approved) &&
            matchedDb?.design_status === "approved") ||
          isProductApproved ||
          (Boolean(s.designApproved) && s.designStatus === "approved");

        if (!isSubJobApproved) return;

        const designerFiles = Array.isArray(matchedDb?.designer_files)
          ? matchedDb.designer_files
          : [];
        const dtpFiles = Array.isArray(matchedDb?.dtp_files)
          ? matchedDb.dtp_files
          : [];

        const hasUploaded =
          designerFiles.length > 0 ||
          dtpFiles.length > 0 ||
          (Boolean(matchedDb?.is_design_uploaded) &&
            (designerFiles.length > 0 || dtpFiles.length > 0));

        const sjInfo = {
          subJobNo,
          groupChar,
          name: p.name,
          size: item.size || e.size || 8,
          qty: item.qty || e.qty || 50,
          designerFiles,
          dtpFiles,
          costingStatus: matchedDb?.costing_status || item.costing_status,
        };

        approved.push(sjInfo);
        if (hasUploaded) {
          uploaded.push(sjInfo);
        } else {
          awaiting.push(sjInfo);
        }
      });
    });

    return {
      approvedCustomSubJobs: approved,
      uploadedCustomSubJobs: uploaded,
      awaitingUploadSubJobs: awaiting,
    };
  }, [
    isDesignerRequired,
    productsList,
    localConfirmed,
    s.productFeedback,
    s.designApproved,
    parentJobNo,
    dbSubJobs,
    s.designStatus,
    e.size,
    e.qty,
  ]);

  // Sub-Job Quotation & Costing Desk:
  // - Default for custom designs: HIDDEN!
  // - Becomes visible ONLY AFTER the designer uploads the approved design file(s).
  // - For pure ready stock products (no custom products): visible directly.
  const canShowQuotationDesk = hasCustomProducts
    ? uploadedCustomSubJobs.length > 0
    : true;

  const initials = (n) =>
    n
      ? n
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
      : "";

  // 1. Initial Intake State
  if (!s.enqSent) {
    return (
      <EnquiryIntakeSection
        s={s}
        set={set}
        e={e}
        setE={setE}
        client={client}
        ids={ids}
        canAssign={canAssign}
        coordinatorsList={coordinatorsList}
        initials={initials}
        heat={heat}
        est={est}
      />
    );
  }

  // 2. Post-Intake State (Lifecycle & Operations)
  const quoted = s.quoted;
  const steps = buildLifecycleSteps(
    s,
    e,
    ids,
    heat,
    canAssign,
    client,
    productsList,
  );

  const lines = productsList.flatMap((p, i) => {
    const groupChar = String.fromCharCode(65 + i);
    return (p.items || [{ size: e.size || 8, qty: e.qty || 100 }]).map(
      (item, j) => {
        const subJobId = `${parentJobNo}-${groupChar}${j + 1}`;
        const matchedSj = (Array.isArray(s.sub_jobs) ? s.sub_jobs : []).find(
          (sj) =>
            sj.sub_job_no === subJobId ||
            sj.sub_job_no?.endsWith(`-${groupChar}${j + 1}`),
        );
        const isMulti = Boolean(p.items && p.items.length > 1);
        const isDropped = Boolean(
          item.is_dropped !== undefined
            ? item.is_dropped
            : matchedSj?.is_dropped !== undefined
              ? matchedSj.is_dropped
              : !isMulti && p.is_dropped,
        );
        const isOnHold = Boolean(
          item.is_on_hold !== undefined
            ? item.is_on_hold
            : matchedSj?.is_on_hold !== undefined
              ? matchedSj.is_on_hold
              : !isMulti && p.is_on_hold,
        );

        return {
          id: subJobId,
          name: p.name,
          size: item.size || matchedSj?.size || e.size || 8,
          qty: item.qty || matchedSj?.quantity || e.qty || 100,
          productIndex: i,
          is_on_hold: isOnHold,
          hold_reason:
            item.hold_reason ||
            matchedSj?.hold_reason ||
            (!isMulti ? p.hold_reason : "") ||
            "",
          is_dropped: isDropped,
          drop_reason:
            item.drop_reason ||
            matchedSj?.drop_reason ||
            (!isMulti ? p.drop_reason : "") ||
            "",
        };
      },
    );
  });

  const numLines = lines.length;
  const productsDesc = productsList
    .map((p) => `${p.name} (${p.items[0]?.size || e.size || 8} in)`)
    .join(" · ");

  return (
    <div className="fade space-y-4 relative">
      {/* Upload Confirmation Modal */}
      {pendingUpload && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-gray-900 text-sm">
                Confirm Design Upload
              </h3>
              <button
                onClick={() => setPendingUpload(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-4 flex flex-col items-center">
              <div className="w-40 h-40 rounded-lg border border-gray-200 overflow-hidden mb-4 bg-gray-50 flex items-center justify-center p-2">
                <img
                  src={pendingUpload.url}
                  className="max-w-full max-h-full object-contain shadow-sm"
                  alt="Pending Upload"
                />
              </div>
              <p className="text-xs text-gray-600 text-center font-medium">
                Are you sure you want to upload this design for Option{" "}
                {pendingUpload.optIdx + 1}?
              </p>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                disabled={isUploadingR2}
                onClick={() => setPendingUpload(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={isUploadingR2}
                onClick={confirmUploadToR2}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                {isUploadingR2 ? (
                  <>
                    <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                    <span>Uploading to R2...</span>
                  </>
                ) : (
                  "Upload to Cloud (R2)"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pipeline View */}
      <div className="panel p-4 bg-white border rounded-xl shadow-sm">
        <h4 className="font-bold text-sm text-gray-900 mb-3">
          Enquiry Lifecycle Pipeline
        </h4>
        <div className="space-y-3">
          {steps.map((p, i) => (
            <div
              key={i}
              className={`pstep flex items-start gap-3 p-2.5 rounded-lg border transition ${p.done
                ? "bg-emerald-50/60 border-emerald-200"
                : p.now
                  ? "bg-amber-50 border-amber-300 ring-1 ring-amber-400/30"
                  : "bg-gray-50 border-gray-200"
                }`}
            >
              <div
                className={`pdot w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${p.done
                  ? "bg-emerald-600 text-white"
                  : p.now
                    ? "bg-amber-500 text-white"
                    : "bg-gray-200 text-gray-600"
                  }`}
              >
                {p.done ? "✓" : i + 1}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm text-gray-900">{p.t}</div>
                {p.s && (
                  <div className="text-xs text-gray-500 mt-0.5">{p.s}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Products Summary Panel */}
      <div className="panel p-4 bg-white border border-gray-200 rounded-xl shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-sm text-gray-900">
              Products on this enquiry
            </h4>
            <p className="text-xs text-gray-500">{productsDesc}</p>
          </div>
          {/* {!isJobBlocked && (
            <button className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-xs cursor-pointer">
              Change sizes or products
            </button>
          )} */}
        </div>

        <div className="bg-gray-50/50 border border-gray-200 rounded-xl p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-gray-700">
              Job {parentJobNo} · {numLines} line{numLines > 1 ? "s" : ""}
            </span>
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-[10px] font-bold rounded">
              provisional
            </span>
          </div>
          <div className="border border-gray-200 bg-white rounded-lg p-2 space-y-1">
            {lines.map((l) => (
              <div
                key={l.id}
                className="text-[11px] text-gray-700 p-1.5 flex items-center justify-between border-b border-gray-100 last:border-b-0"
              >
                <div>
                  <span className="text-indigo-600 font-bold mr-1">{l.id}</span>
                  {l.name} · {l.size} in · {l.qty} pcs
                </div>
                <div className="flex items-center gap-2">
                  {l.is_dropped ? (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200">
                      ✕ DROPPED
                    </span>
                  ) : l.is_on_hold ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                        ⏳ ON HOLD
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleUnholdAction(
                            l.id,
                            String.fromCharCode(65 + l.productIndex),
                            l.productIndex,
                          )
                        }
                        className="text-[11px] text-indigo-600 font-bold hover:underline cursor-pointer"
                      >
                        Unhold
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                      active
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-500 mt-2">
            These line numbers are quotable now and lock permanently when the
            job is Won.
          </p>
        </div>
      </div>

      {/* Delink Panel Button */}
      {numLines > 1 && !showDelink && !isJobBlocked && (
        <div className="panel p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-sm text-gray-900 mb-1">
                {numLines} products on this job
              </h4>
              <p className="text-xs text-gray-500">
                Take a product off this job: delink it to a separate sub-job on
                hold, or drop it completely.
              </p>
            </div>
            <button
              onClick={() => setShowDelink(true)}
              className="px-3 py-1.5 border border-indigo-200 rounded-lg text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 shadow-xs cursor-pointer"
            >
              ⛓️ Delink or remove a product
            </button>
          </div>
        </div>
      )}

      {/* Expanded Delink Modal-like Inline Panel */}
      {showDelink && (
        <ProductDelinkModal
          lines={lines}
          delinkSel={delinkSel}
          setDelinkSel={setDelinkSel}
          delinkReason={delinkReason}
          setDelinkReason={setDelinkReason}
          delinkNote={delinkNote}
          setDelinkNote={setDelinkNote}
          isDelinkActionLoading={isDelinkActionLoading}
          handleDelinkHold={handleDelinkHoldAction}
          handleDropProducts={handleDropProductsAction}
          onClose={() => {
            setShowDelink(false);
            setDelinkSel([]);
          }}
        />
      )}

      {/* Design Options Panel */}
      <DesignOptionsSection
        s={s}
        set={set}
        e={e}
        client={client}
        ids={ids}
        lines={lines}
        productsList={productsList}
        numLines={numLines}
        unselectedProducts={unselectedProducts}
        toggleProductSelection={toggleProductSelection}
        handleUnhold={handleUnholdAction}
        uploadedDesigns={uploadedDesigns}
        handleDesignUpload={handleDesignUpload}
        removeDesign={removeDesign}
        setPreviewDesignKey={setPreviewDesignKey}
        isDesignerRequired={isDesignerRequired}
        isAllReadyProducts={isAllReadyProducts}
        isSendDisabled={isSendDisabled}
        sendingIndices={sendingIndices}
        setShowDesignPreview={setShowDesignPreview}
        productFeedback={productFeedback}
        updateProductFeedback={updateProductFeedback}
        localConfirmed={localConfirmed}
        confirmProductFeedback={confirmProductFeedback}
        showFinalDesignOptions={showFinalDesignOptions}
        setShowFinalDesignOptions={setShowFinalDesignOptions}
        showFinalDesignShare={showFinalDesignShare}
        setShowFinalDesignShare={setShowFinalDesignShare}
        currentUser={currentUser}
        isLocked={isJobBlocked}
      />

      {/* Intermediate Design Approval & Artwork Upload Status Banner */}
      {isDesignerRequired && (
        <DesignArtworkStatusBanner
          approvedSubJobs={approvedCustomSubJobs}
          uploadedSubJobs={uploadedCustomSubJobs}
          awaitingUploadSubJobs={awaitingUploadSubJobs}
          onRefresh={handleRefreshJobStatus}
          isRefreshing={isRefreshingJobStatus}
        />
      )}

      {/* Sub-Job Quotation, BOM Costing & Lifecycle Desk:
          Default is HIDDEN for custom designs; visible ONLY after designer uploads approved production files */}
      {canShowQuotationDesk && (
        <SubJobQuotationCard
          s={s}
          set={set}
          e={e}
          client={client}
          ids={ids}
          productsList={productsList}
          flattenedProducts={flattenedProducts}
          simulatedRates={simulatedRates}
          setSimulatedRates={setSimulatedRates}
          quoteSelectedProducts={quoteSelectedProducts}
          setQuoteSelectedProducts={setQuoteSelectedProducts}
          onOpenPreviewQuote={() => setShowPreviewQuoteSheet(true)}
          goOrder={goOrder}
          onHoldSubJob={handleHoldSingleSubJobAction}
          onUnholdSubJob={handleUnholdAction}
          onDropSubJob={handleDropSingleSubJobAction}
          isLocked={isJobBlocked}
        />
      )}

      {/* Print & Job Score & Client Decisions */}
      {s.enqSent && (
        <JobScoreAndDecisionSection
          s={s}
          set={set}
          e={e}
          client={client}
          productsList={productsList}
          currentUser={currentUser}
          quoted={quoted}
          setShowPrint={setShowPrint}
          goOrder={goOrder}
          isLocked={isJobBlocked}
        />
      )}

      {/* The Printable Overlay */}
      {showPrint && (
        <PrintEnquiryLog
          s={s}
          e={e}
          client={client}
          setShowPrint={setShowPrint}
          ids={ids}
          heat={heat}
          currentUser={currentUser}
          uploadedDesigns={uploadedDesigns}
        />
      )}

      {/* The Design Send Preview Overlay */}
      {showDesignPreview && (
        <DesignPreviewSheet
          s={s}
          e={e}
          client={client}
          setShowDesignPreview={setShowDesignPreview}
          ids={ids}
          uploadedDesigns={uploadedDesigns}
          selectedProducts={
            new Set(
              productsList
                .map((_, i) => i)
                .filter(
                  (i) =>
                    !unselectedProducts.has(i) &&
                    !productsList[i].is_on_hold &&
                    !productsList[i].is_dropped,
                ),
            )
          }
          productsList={productsList}
          currentUser={currentUser}
          onSend={(channel = "WhatsApp") => {
            const nowStr = new Date().toISOString();
            set({
              optionsShared: nowStr,
              optionsSharedChannel:
                typeof channel === "string" ? channel : "WhatsApp",
            });
          }}
        />
      )}

      {/* Full-screen Preview Modal */}
      {previewDesignKey && uploadedDesigns[previewDesignKey] && (
        <ImageLightbox
          src={uploadedDesigns[previewDesignKey]}
          fileName="Design Option Preview"
          onClose={() => setPreviewDesignKey(null)}
        />
      )}

      {/* The Quote Preview Overlay */}
      {showPreviewQuoteSheet && (
        <PreviewQuoteSheet
          s={s}
          e={e}
          client={client}
          productsList={flattenedProducts}
          currentUser={{ name: "Coordinator" }}
          ids={ids}
          simulatedRates={simulatedRates}
          quoteSelectedProducts={quoteSelectedProducts}
          onClose={() => setShowPreviewQuoteSheet(false)}
          onSend={async (channel = "email") => {
            const linesToSend = [];
            const selectedNos = [];
            flattenedProducts.forEach((p) => {
              if (
                quoteSelectedProducts.has(p.rateKey) &&
                !p.isHold &&
                !p.isDrop
              ) {
                const r0 = Number(
                  (simulatedRates[p.rateKey]?.rate !== undefined
                    ? simulatedRates[p.rateKey].rate
                    : p.unitRate || p.target_rate || p.rate || 0
                  ).toFixed(2),
                );
                const sampleRate = Number(
                  (simulatedRates[p.rateKey]?.sample !== undefined
                    ? simulatedRates[p.rateKey].sample
                    : p.sampleRate || (r0 > 0 ? r0 + 200 : 0)
                  ).toFixed(2),
                );
                const subJobNo =
                  p.subJobNo || `${ids?.enq || ENQUIRY_CONFIG.DEFAULT_ENQUIRY_NO}-${p.subjobId}`;
                selectedNos.push(subJobNo);
                linesToSend.push({
                  id: p.rateKey,
                  name: `${subJobNo} ${p.name}`,
                  spec: p.spec_line || `${p.name} · ${p.size} in`,
                  kind: p.kind || "custom",
                  source: "Agreed with client",
                  rate: r0,
                  slabs: [[p.qty, r0]],
                  sampleRate: sampleRate,
                });
              }
            });

            const targetDbId = s.dbJobId || s._id || s.rawJob?._id || ids?.id;
            if (targetDbId && selectedNos.length > 0) {
              try {
                await axiosInstance.post(
                  `/enquiry-flow-integration/${targetDbId}/send-quotes`,
                  {
                    subJobNos: selectedNos,
                    channel: channel || s.quoteVia || "email",
                  },
                );
              } catch (err) {
                console.warn("Could not log quote send to backend:", err);
              }
            }

            if (linesToSend.length > 0) {
              const cst = {
                ref: ids?.enq || ENQUIRY_CONFIG.DEFAULT_ENQUIRY_NO,
                rate: linesToSend[0]?.rate || 0,
                sampleRate: linesToSend[0]?.sampleRate || 0,
                setup: 1500,
                validity: 15,
                by: "Agreed rate · entered by CS",
                at: new Date().toISOString(),
                agreed: new Date().toISOString(),
                slabs: linesToSend[0]?.slabs || [],
                lines: linesToSend,
                note: "Rates as agreed with the client on the revised sizes and quantities.",
              };

              set({ costing: cst, quoted: true, quoteVia: channel });
            }
            setShowPreviewQuoteSheet(false);
          }}
        />
      )}
    </div>
  );
};

export default LogStep;
