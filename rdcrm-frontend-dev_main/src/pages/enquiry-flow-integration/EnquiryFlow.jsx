import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { axiosInstance } from "../../utils/url/config";
import { useLoader } from "../../context/LoaderContext";

import "./EnquiryFlow.css";
import JobsBoard from "./components/JobsBoard";
import ClientStep from "./components/Steps/ClientStep";
import AskStep from "./components/Steps/AskStep";
import BriefStep from "./components/Steps/BriefStep";
import LogStep from "./components/Steps/LogStep";
import ModeStep from "./components/Steps/ModeStep";
import DetailsStep from "./components/Steps/DetailsStep";
import SendStep from "./components/Steps/SendStep";
import JobCard from "./components/JobCard";
import StageBar from "./components/common/StageBar";
import CancelledEnquiryBanner from "./components/common/CancelledEnquiryBanner";
import {
  heatOf,
  finOf,
  mapJobToBoardCard,
  mapCustomerToClientProfile,
  validateBriefStepProgression,
  sanitizeWizardState,
} from "./utils/helpers";
import { STEPS, Q, ENQUIRY_CONFIG, formatEnquiryNo, deriveDocNo } from "./utils/constants";
import { mapBackendJobToWizardState } from "./utils/enquiryHydrationService";
import { buildSubJobsPayload } from "./utils/enquirySyncService";
import { toast } from "react-toastify";

const EnquiryFlow = () => {
  const [view, setView] = useState("board");
  const [seqCount, setSeqCount] = useState(ENQUIRY_CONFIG.STARTING_SEQ);
  const [selectedClientDetail, setSelectedClientDetail] = useState(null);
  const [boardRefreshKey, setBoardRefreshKey] = useState(0);
  const { showLoader, hideLoader } = useLoader();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Helper to navigate with a direct query param (?<objectId>) without the "job=" key prefix
  const updateUrlJob = (id) => {
    if (id) {
      const cleanId = String(id).trim();
      if (location.search !== `?${cleanId}`) {
        navigate({ pathname: location.pathname, search: `?${cleanId}` }, { replace: true });
      }
    } else {
      if (location.search) {
        navigate({ pathname: location.pathname, search: "" }, { replace: true });
      }
    }
  };

  // Extracts urlJobId strictly from direct ?<objectId> (24-hex MongoDB ObjectId)
  // No redirection for job=rd...
  const getUrlJobId = () => {
    const raw = (location.search || "").replace(/^\?/, "").trim();
    if (!raw) return "";

    const firstSegment = raw.split("&")[0];
    if (firstSegment && !firstSegment.includes("=")) {
      const decoded = decodeURIComponent(firstSegment).trim();
      if (/^[0-9a-fA-F]{24}$/.test(decoded)) {
        return decoded;
      }
    }
    return "";
  };

  const urlJobId = getUrlJobId();

  let userRole = "";
  try {
    const rawUser = localStorage.getItem("user");
    if (rawUser) {
      const u = JSON.parse(rawUser);
      userRole = String(u?.role?.name || u?.role_obj?.name || u?.role || "").toLowerCase();
    }
  } catch (_e) {
    // ignore error reading local user
  }

  const debounceSyncTimerRef = useRef(null);
  const lastSyncedPayloadRef = useRef(null);
  const hydratedClientRef = useRef(null);
  const hydratedStatsRef = useRef(null);

  const [s, setS] = useState({
    step: 0,
    e: {
      type: "Trophy",
      theme: "Custom Trophy",
      askMode: "custom",
      designer: true,
      productName: "Custom Trophy",
      size: "8",
      qty: 50,
      budget: 850,
      material: "MDF",
      trophyGroups: [
        {
          theme: "Custom Trophy",
          productName: "Custom Trophy",
          kind: "custom",
          type: "Trophy",
          mat: "MDF",
          items: [{ size: 8, qty: 50, budget: 850, designOptionsCount: 2 }],
        },
      ],
    },
    clientId: null,
    contactId: null,
    coordinator: null,
    enqSent: false,
    mode: null,
    qty: 50,
    leadDate: null,
    sent: false,
    seq: ENQUIRY_CONFIG.STARTING_SEQ,
    enquiry_no: ENQUIRY_CONFIG.DEFAULT_ENQUIRY_NO,
    charge: "foc",
    sampleRate: 0,
  });

  const handleOpenJob = (job, updateUrl = true) => {
    const raw = job.rawJob || job;
    const baseState = sanitizeWizardState(job.wizard_state || {}) || {};
    const eObj = baseState.e || {};
    const evDate = raw.event_date || raw.the_ask?.event_date || eObj.event_date || eObj.eventExactDate || eObj.eventDate || "";
    const needDate = raw.delivery_date || raw.needed_by_date || raw.the_ask?.delivery_date || raw.the_ask?.needed_by_date || eObj.delivery_date || eObj.neededByDate || eObj.deliveryDate || "";
    const compDate = raw.job_completion_date || raw.the_ask?.job_completion_date || raw.delivery_details?.job_completion_date || eObj.job_completion_date || eObj.jobCompletionDate || baseState.jobDeliveryDate || "";

    const resolvedClientId = baseState.clientId || raw.customer_id?._id || raw.customer_id;
    const resolvedContactId = baseState.contactId || raw.contact_id || "ct1";
    const resolvedShipToId = baseState.shipToId || raw.ship_to_id || "sh_0";
    const rawCoord = (raw.coordinator_name === "Priya Nair" ? "" : (raw.coordinator_name || ""));
    const resolvedCoordinator = baseState.coordinator || rawCoord || "";
    const resolvedQty = Number(baseState.qty || raw.the_ask?.quantity || raw.delivery_details?.quantity || (raw.sub_jobs?.[0]?.quantity) || 50);
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
            const effR = (sj.unit_rate && Number(sj.unit_rate) > 0)
              ? Number(sj.unit_rate)
              : (item.rate && Number(item.rate) > 0)
              ? Number(item.rate)
              : (item.unit_rate && Number(item.unit_rate) > 0)
              ? Number(item.unit_rate)
              : (hasBom ? (sj.unit_rate || item.rate || 0) : 0);

            const sjColours = (item.colourQuantities && item.colourQuantities.length > 0)
              ? item.colourQuantities
              : (sj.spec?.colourQuantities && sj.spec.colourQuantities.length > 0)
                ? sj.spec.colourQuantities
                : (sj.colourQuantities && sj.colourQuantities.length > 0)
                  ? sj.colourQuantities
                  : [];

            const sjCustoms = (item.customFinishes && item.customFinishes.length > 0)
              ? item.customFinishes
              : (sj.spec?.customFinishes && sj.spec.customFinishes.length > 0)
                ? sj.spec.customFinishes
                : (sj.customFinishes && sj.customFinishes.length > 0)
                  ? sj.customFinishes
                  : [];

            const sjDims = (item.sizeDimensions && item.sizeDimensions.length > 0)
              ? item.sizeDimensions
              : (sj.spec?.sizeDimensions && sj.spec.sizeDimensions.length > 0)
                ? sj.spec.sizeDimensions
                : (sj.sizeDimensions && sj.sizeDimensions.length > 0)
                  ? sj.sizeDimensions
                  : [];

            return {
              ...item,
              rate: effR,
              unit_rate: effR,
              budget: item.budget || sj.target_rate || 0,
              sizeRate: item.sizeRate !== undefined ? item.sizeRate : (sj.spec?.sizeRate || sj.size_rate || sj.sizeRate || 0),
              sizeDimensions: sjDims,
              colourQuantities: sjColours,
              colour: item.colour || sj.spec?.colour || sj.colour || "",
              customFinishes: sjCustoms,
              sampleRate: sj.sample_rate || item.sampleRate || (effR > 0 ? effR + 200 : 0),
              artworkCharge: sj.artwork_charge !== undefined ? sj.artwork_charge : (item.artworkCharge || 0),
              bom_id: sj.bom_id || item.bom_id || null,
              costing_status: isCompleted ? "completed" : (sj.costing_status === "completed" ? "pending" : (sj.costing_status || item.costing_status || "not_requested")),
              spec: {
                ...(sj.spec || {}),
                ...(item.spec || {}),
                ...(sjColours.length > 0 ? { colourQuantities: sjColours } : {}),
                ...(sjCustoms.length > 0 ? { customFinishes: sjCustoms } : {}),
                ...(sjDims.length > 0 ? { sizeDimensions: sjDims } : {}),
              },
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

    const newState = mapBackendJobToWizardState(job, seqCount);
    try {
      sessionStorage.setItem("active_integration_job_id", String(raw._id || job._id || job.id));
    } catch (_e) {
      /* ignore */
    }
    setS(newState);
    if (updateUrl) {
      const objectId = String(raw._id || job._id || job.dbJobId || job.dbId || "");
      if (objectId && /^[0-9a-fA-F]{24}$/.test(objectId)) {
        updateUrlJob(objectId);
      }
    }
    setView("job");
  };

  // Fetch ONLY the specific selected job (full payload + signed R2 URLs + live BOM rates)
  const fetchAndOpenJobById = useCallback(
    async (jobIdOrNo, updateUrl = true) => {
      if (!jobIdOrNo) return;
      if (showLoader) showLoader();
      try {
        const res = await axiosInstance.get(`/enquiry-flow-integration/${jobIdOrNo}`);
        if (res.data?.success && res.data?.data) {
          const fullJob = res.data.data;
          if (fullJob.customer_id && typeof fullJob.customer_id === "object") {
            hydratedClientRef.current = String(fullJob.customer_id._id || fullJob.customer_id.id || "");
            setSelectedClientDetail(mapCustomerToClientProfile(fullJob.customer_id));
          }
          handleOpenJob(fullJob, updateUrl);
        } else {
          toast.error("Enquiry job details not found");
        }
      } catch (err) {
        console.error("Failed to fetch job details:", err);
        toast.error(err.response?.data?.message || "Failed to load enquiry job details");
      } finally {
        if (hideLoader) hideLoader();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showLoader, hideLoader]
  );

  // Sync only the currently selected single client's details + stats when clientId changes
  useEffect(() => {
    if (s.newClient) {
      setSelectedClientDetail(mapCustomerToClientProfile(s.newClient));
      return;
    }
    if (!s.clientId) {
      hydratedClientRef.current = null;
      hydratedStatsRef.current = null;
      setSelectedClientDetail(null);
      return;
    }
    const clientIdStr = String(s.clientId);
    const alreadyHydratedFromJob = hydratedClientRef.current === clientIdStr;
    const alreadyFetchedStats = hydratedStatsRef.current === clientIdStr;
    if (alreadyHydratedFromJob && alreadyFetchedStats) return;

    hydratedClientRef.current = clientIdStr;
    hydratedStatsRef.current = clientIdStr;

    let cancelled = false;
    Promise.all([
      alreadyHydratedFromJob
        ? Promise.resolve(null)
        : axiosInstance.get(`/customer/${s.clientId}`).catch(() => null),
      alreadyFetchedStats
        ? Promise.resolve(null)
        : axiosInstance.get(`/enquiry-flow-integration/client-stats/${s.clientId}`).catch(() => null),
    ]).then(([custRes, statsRes]) => {
      if (cancelled) return;
      const custData = custRes?.data?.data;
      const statsData = statsRes?.data?.success ? statsRes.data : null;
      if (custData) {
        setSelectedClientDetail(mapCustomerToClientProfile(custData, statsData));
      } else if (statsData) {
        setSelectedClientDetail((prev) =>
          prev
            ? {
              ...prev,
              jobs: statsData.stats?.in_process_jobs ?? prev.jobs,
              won: statsData.stats?.completed_jobs ?? prev.won,
              overdue: statsData.stats?.realtime_outstanding ?? prev.overdue,
              live: statsData.live_jobs?.length > 0 ? statsData.live_jobs : prev.live,
              pastOrders: statsData.past_orders?.length > 0 ? statsData.past_orders : prev.pastOrders,
            }
            : prev
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [s.clientId, s.newClient]);

  const syncJobToBackend = async (currentState) => {
    const effectiveClientId = currentState.clientId;
    if (!effectiveClientId) return null;
    try {
      const parentNo = currentState.enquiry_no || formatEnquiryNo(currentState.seq);

      // Resolve contact from currently selected client
      const activeClient =
        selectedClientDetail && String(selectedClientDetail.id) === String(effectiveClientId)
          ? selectedClientDetail
          : currentState.newClient || null;

      const allAvailableContacts = [
        ...(Array.isArray(activeClient?.contacts) ? activeClient.contacts : []),
        ...(Array.isArray(currentState.cExtra) ? currentState.cExtra.filter((x) => String(x.clientId) === String(effectiveClientId)) : []),
      ];

      const selectedContact = currentState.contactId
        ? allAvailableContacts.find((c) => String(c.id || c._id) === String(currentState.contactId))
        : (allAvailableContacts.find((x) => x.last) || allAvailableContacts[0] || null);

      const effContactId = selectedContact ? String(selectedContact.id || selectedContact._id) : (currentState.contactId || null);
      const effContactPerson = selectedContact?.name || currentState.e?.contactPerson || (activeClient?.contact_person && activeClient.contact_person !== "Primary Contact" ? activeClient.contact_person : "");
      const effContactMobile = selectedContact?.phone || selectedContact?.mobile_no || currentState.e?.contactPhone || (activeClient?.mobile_no ? String(activeClient.mobile_no) : "");
      const effContactEmail = selectedContact?.email || currentState.e?.contactEmail || activeClient?.email || "";

      const subJobs = buildSubJobsPayload(currentState, parentNo);

      const effSize = String(
        currentState.e?.size ||
        currentState.e?.trophyGroups?.[0]?.items?.[0]?.size ||
        "8"
      );

      const effQty = Number(
        currentState.qty ||
        currentState.finalQty ||
        currentState.e?.qty ||
        currentState.e?.trophyGroups?.[0]?.items?.[0]?.qty ||
        50
      );

      const effEventDate = currentState.e?.event_date || currentState.e?.eventDate || currentState.e?.eventExactDate || null;
      const effNeededByDate = currentState.e?.needed_by_date || currentState.e?.neededByDate || currentState.leadDate || null;
      const effDeliveryDate = currentState.e?.delivery_date || currentState.e?.needed_by_date || currentState.e?.neededByDate || currentState.leadDate || currentState.jobDeliveryDate || null;
      const effJobCompletionDate = currentState.e?.job_completion_date || currentState.e?.jobCompletionDate || currentState.jobDeliveryDate || null;

      const effGlobalDesignerId =
        currentState.e?.assignedDesigner ||
        currentState.e?.designer_id ||
        currentState.e?.designerId ||
        (currentState.e?.productBriefs ? Object.values(currentState.e.productBriefs).find(pb => pb?.assignedDesigner)?.assignedDesigner : "") ||
        "";

      const effGlobalDesignerName =
        currentState.e?.assignedDesignerName ||
        currentState.e?.designer_name ||
        currentState.e?.designerName ||
        (currentState.e?.productBriefs ? Object.values(currentState.e.productBriefs).find(pb => pb?.designerName)?.designerName : "") ||
        "";

      const hasActiveCustom = subJobs.some(
        (sj) => !sj.is_dropped && !sj.is_on_hold && sj.trophy_type !== "ready" && sj.kind !== "ready"
      );

      const payload = {
        enquiry_no: parentNo,
        seq: currentState.seq,
        step: currentState.step,
        customer_id: effectiveClientId,
        contact_id: effContactId,
        contact_person: effContactPerson,
        contact_mobile: effContactMobile,
        contact_email: effContactEmail,
        ship_to_id: currentState.shipToId || "sh_0",
        coordinator_name: currentState.coordinator,
        event_date: effEventDate,
        needed_by_date: effNeededByDate,
        delivery_date: effDeliveryDate,
        job_completion_date: effJobCompletionDate,
        sub_jobs: subJobs,
        the_ask: {
          product_type: currentState.e?.type || "Trophy",
          theme: currentState.e?.theme || "Custom Trophy",
          ask_mode: currentState.e?.askMode || "custom",
          sku: currentState.e?.sku,
          product_name: currentState.e?.productName || currentState.e?.theme || "Custom Trophy",
          size: effSize,
          material: currentState.e?.material || "MDF",
          quantity: effQty,
          approx_budget: currentState.e?.approxBudget,
          budget_none: currentState.e?.budgetNone || false,
          occasion: currentState.e?.occasion || "Annual awards",
          scope: currentState.e?.scope || "local",
          destination_city: currentState.e?.destinationCity,
          destination_country: currentState.e?.destinationCountry,
          event_date: effEventDate,
          delivery_date: effDeliveryDate,
          needed_by_date: effNeededByDate,
          job_completion_date: effJobCompletionDate,
        },
        assigned_designer: effGlobalDesignerId,
        assigned_designer_name: effGlobalDesignerName,
        the_brief: {
          brief_text: currentState.brief || currentState.e?.globalBrief || (currentState.e?.productBriefs ? Object.values(currentState.e.productBriefs).map(p => p.brief).filter(Boolean).join("\n---\n") : ""),
          product_briefs: currentState.e?.productBriefs || {},
          design_needed: currentState.e?.designer !== undefined ? Boolean(currentState.e.designer) : hasActiveCustom,
          options_count: currentState.e?.designOptions || currentState.optionsCount || 2,
          options_due_in: currentState.e?.optionsDueIn || 24,
          designer_assigned_at:
            currentState.the_brief?.designer_assigned_at ||
            (effGlobalDesignerId ? (currentState.designerAssignedAt || new Date()) : undefined),
          ref_files: (currentState.e?.globalRefs && currentState.e.globalRefs.length > 0) ? currentState.e.globalRefs : (currentState.refFiles || []),
          client_logo:
            (currentState.e?.globalLogos && currentState.e.globalLogos.length > 0)
              ? currentState.e.globalLogos
              : (currentState.e?.clientLogo && currentState.e.clientLogo.length > 0)
                ? currentState.e.clientLogo
                : (currentState.e?.clientLogos && currentState.e.clientLogos.length > 0)
                  ? currentState.e.clientLogos
                  : (currentState.clientLogo && currentState.clientLogo.length > 0)
                    ? currentState.clientLogo
                    : (currentState.the_brief?.client_logo && currentState.the_brief.client_logo.length > 0)
                      ? currentState.the_brief.client_logo
                      : (currentState.e?.productBriefs
                          ? Object.values(currentState.e.productBriefs).flatMap((pb) => pb.clientLogo || pb.client_logo || []).filter(Boolean)
                          : []),
          signatures:
            (currentState.e?.globalSignatures && currentState.e.globalSignatures.length > 0)
              ? currentState.e.globalSignatures
              : (currentState.e?.signatures && currentState.e.signatures.length > 0)
                ? currentState.e.signatures
                : (currentState.the_brief?.signatures && currentState.the_brief.signatures.length > 0)
                  ? currentState.the_brief.signatures
                  : (currentState.e?.productBriefs
                      ? Object.values(currentState.e.productBriefs).flatMap((pb) => pb.signatures || []).filter(Boolean)
                      : []),
          additional_files:
            (currentState.e?.globalAdditionalFiles && currentState.e.globalAdditionalFiles.length > 0)
              ? currentState.e.globalAdditionalFiles
              : (currentState.e?.additionalFiles && currentState.e.additionalFiles.length > 0)
                ? currentState.e.additionalFiles
                : (currentState.e?.additional_files && currentState.e.additional_files.length > 0)
                  ? currentState.e.additional_files
                  : (currentState.the_brief?.additional_files && currentState.the_brief.additional_files.length > 0)
                    ? currentState.the_brief.additional_files
                    : (currentState.e?.productBriefs
                        ? Object.values(currentState.e.productBriefs).flatMap((pb) => pb.additionalFiles || pb.additional_files || []).filter(Boolean)
                        : []),
          is_logo_mandatory: Boolean(currentState.e?.is_logo_mandatory ?? currentState.e?.isLogoMandatory ?? currentState.the_brief?.is_logo_mandatory ?? false),
          is_signature_mandatory: Boolean(currentState.e?.is_signature_mandatory ?? currentState.e?.isSignatureMandatory ?? currentState.the_brief?.is_signature_mandatory ?? false),
          is_additional_files_mandatory: Boolean(currentState.e?.is_additional_files_mandatory ?? currentState.e?.isAdditionalFilesMandatory ?? currentState.the_brief?.is_additional_files_mandatory ?? false),
          show_logo: currentState.showLogo ?? currentState.e?.showRDLogo ?? false,
          show_content: currentState.showContent ?? currentState.e?.showRDContent ?? false,
          content_text: currentState.contentDetails || currentState.e?.copyrightContent || currentState.e?.copyright_content || "",
          copyright_content: currentState.e?.copyrightContent || currentState.e?.copyright_content || "",
          // Designer assignment - saved from BriefStep
          designer_id: effGlobalDesignerId,
          designer_name: effGlobalDesignerName,
          quote_only: !!(currentState.e?.quoteOnly),
          design_status:
            (currentState.designApproved || currentState.designStatus === "approved" || currentState.the_brief?.design_status === "approved")
              ? "approved"
              : (currentState.designStatus || currentState.the_brief?.design_status || "pending"),
          options_shared: !!(currentState.optionsShared ?? currentState.the_brief?.options_shared ?? false),
          options_shared_at: currentState.optionsShared ? new Date(currentState.optionsShared) : undefined,
          options_shared_channel: currentState.optionsSharedChannel || undefined,
        },
        log_track: {
          origin: currentState.origin || "Email",
          heat_score: currentState.heatScore || 50,
          heat_label: currentState.heatLabel || "Warm",
          proof_type: currentState.proofType,
          proof_file: currentState.proofFile,
          internal_notes: currentState.internalNotes,
          enq_sent: currentState.enqSent || false,
          sent_at: currentState.enqSent ? new Date() : undefined,
        },
        order_mode: {
          mode: currentState.mode,
          charge: currentState.charge || "foc",
          bill_to: currentState.billTo || null,
          sample_rate: Number(currentState.sampleRate) || 0,
          sample_qty: Number(currentState.sampleQty) || 1,
          sample_approved: Boolean(
            currentState.ratesApproved ||
            currentState.sampleConfirmed ||
            currentState.sampleRatesState === "approved" ||
            currentState.approved
          ),
          sample_date: currentState.sampleDate || null,
          production_date: currentState.productionDate || null,
        },
        delivery_details: {
          quantity: Number(currentState.qty || currentState.finalQty) || 0,
          target_rate: Number(currentState.jobRate) || 0,
          client_po: currentState.clientPo || "",
          delivery_date: effDeliveryDate,
          needed_by_date: effNeededByDate,
          job_completion_date: effJobCompletionDate,
          delivery_mode: currentState.delivCarrier || currentState.sampleCarrier || currentState.deliveryMode || "",
          delivery_cost: Number(currentState.sampleChargesAmount || currentState.deliveryCost) || 0,
          who_pays: (currentState.sampleFreight === "Client pays freight" || currentState.delivPayer === "client" || currentState.whoPays === "Client") ? "Client" : "RD",
          shipping_address: currentState.sampleAddress || currentState.shipTo || null,
        },
        financials: {
          subtotal: Number(currentState.subtotal) || 0,
          gst_rate: Number(currentState.gstRate) || 18,
          gst_amount: Number(currentState.gstAmount) || 0,
          total: Number(currentState.finalTotal) || 0,
          advance_percentage: Number(currentState.advPct) || 50,
          advance_required: Number(currentState.advDue) || 0,
          advance_received: Number(currentState.advRecd) || 0,
          advance_txn_id: currentState.advTxn || "",
          advance_date: currentState.advDate || "",
          balance: Number(currentState.balance) || 0,
          payment_status: currentState.paymentStatus || "pending",
          proforma_no: currentState.proforma?.pno || "",
          proforma_date: currentState.proforma?.date || "",
          tax_invoice_no: currentState.tinv || "",
        },
        stage: currentState.sent
          ? (currentState.mode === "sample" ? "sample" : "production")
          : (currentState.enqSent ? "brief" : "enquiry"),
        sample_rates_approved: Boolean(
          currentState.ratesApproved ||
          currentState.sampleConfirmed ||
          currentState.sampleRatesState === "approved" ||
          currentState.sampleDecision?.decision === "approved"
        ),
        wizard_state: sanitizeWizardState(currentState),
      };

      let syncRes;
      if (currentState.dbJobId) {
        try {
          syncRes = await axiosInstance.put(`/enquiry-flow-integration/${currentState.dbJobId}`, payload);
        } catch (putErr) {
          if (putErr.response?.status === 404) {
            console.warn("PUT failed (404 Not Found), falling back to POST upsert:", putErr.message);
            syncRes = await axiosInstance.post("/enquiry-flow-integration", payload);
            if (syncRes?.data?.data?._id) {
              setS((prev) => ({
                ...prev,
                dbJobId: syncRes.data.data._id,
                enquiry_no: syncRes.data.data.enquiry_no || prev.enquiry_no,
                seq: syncRes.data.data.seq || prev.seq,
              }));
            }
          } else {
            throw putErr;
          }
        }
      } else {
        syncRes = await axiosInstance.post("/enquiry-flow-integration", payload);
        if (syncRes?.data?.data?._id) {
          setS((prev) => ({
            ...prev,
            dbJobId: syncRes.data.data._id,
            enquiry_no: syncRes.data.data.enquiry_no || prev.enquiry_no,
            seq: syncRes.data.data.seq || prev.seq,
          }));
        }
      }
      const savedJobId = String(syncRes?.data?.data?._id || currentState.dbJobId || "");
      if (savedJobId && (!urlJobId || urlJobId !== savedJobId)) {
        updateUrlJob(savedJobId);
      }
      if (currentState.enqSent || view === "board") {
        setBoardRefreshKey((k) => k + 1);
      }
      return syncRes?.data;
    } catch (err) {
      console.warn("Could not sync enquiry job to backend (integration):", err.response?.data?.error || err.response?.data || err.message, err);
    }
  };

  const handleNewEnquiry = async () => {
    try {
      sessionStorage.removeItem("active_integration_job_id");
      sessionStorage.removeItem("integration_brief_draft");
    } catch (_e) {
      /* ignore */
    }
    updateUrlJob(null);
    let nextSeq = seqCount;
    let nextEnqNo = formatEnquiryNo(nextSeq);
    try {
      const res = await axiosInstance.get("/enquiry-flow-integration/next-number");
      if (res.data?.seq) {
        nextSeq = res.data.seq;
        nextEnqNo = res.data.enquiry_no || formatEnquiryNo(nextSeq);
      }
    } catch (err) {
      console.log("Next sequence fallback:", err);
    }

    setSeqCount(nextSeq);
    setS({
      step: 0,
      e: {
        type: "Trophy",
        theme: "Custom Trophy",
        askMode: "custom",
        designer: true,
        productName: "Custom Trophy",
        size: "8",
        qty: 50,
        budget: 850,
        material: "MDF",
        briefMode: "one",
        globalBrief: "",
        globalRefs: [],
        productBriefs: {},
        trophyGroups: [
          {
            theme: "Custom Trophy",
            productName: "Custom Trophy",
            kind: "custom",
            type: "Trophy",
            mat: "MDF",
            items: [{ size: 8, qty: 50, budget: 850, designOptionsCount: 2 }],
          },
        ],
      },
      clientId: null,
      contactId: null,
      coordinator: null,
      the_brief: {
        brief_text: "",
        product_briefs: {},
        ref_files: [],
        design_needed: true,
        options_count: 2,
      },
      sub_jobs: [],
      optionsShared: false,
      optionsSharedChannel: "",
      designApproved: false,
      designStatus: "pending",
      quoteApproved: false,
      client_quote_decision: "pending",
      quoted: false,
      productFeedback: {},
      uploadedDesigns: {},
      enqSent: false,
      mode: null,
      qty: 50,
      leadDate: null,
      sent: false,
      seq: nextSeq,
      enquiry_no: nextEnqNo,
      charge: "foc",
      sampleRate: 0,
      dbJobId: null,
      is_lost: false,
      stage: "enquiry",
      isLocked: false,
    });
    setView("job");
  };

  const set = (p, immediate = false) => {
    if (!p) {
      handleNewEnquiry();
      return;
    }
    setS((prev) => {
      const updated = { ...prev, ...p };
      if (immediate || p.syncNow) {
        if (debounceSyncTimerRef.current) clearTimeout(debounceSyncTimerRef.current);
        syncJobToBackend(updated);
      } else {
        if (debounceSyncTimerRef.current) clearTimeout(debounceSyncTimerRef.current);
        debounceSyncTimerRef.current = setTimeout(() => {
          const shouldSync = (
            p.sflow !== undefined || p.enqSent || p.step !== undefined || p.sent || p.mode ||
            p.clientId || p.e || p.qty !== undefined || p.contactId || p.subJobs ||
            p.optionsShared !== undefined || p.optionsSharedChannel !== undefined ||
            p.designApproved !== undefined || p.productFeedback !== undefined ||
            p.designStatus !== undefined || p.uploadedDesigns !== undefined ||
            p.finalDesignShared !== undefined || p.extraDesignOptions !== undefined ||
            p.costReq !== undefined || p.sampleConfirmSent !== undefined ||
            p.sampleRatesSent !== undefined || p.sampleRatesState !== undefined ||
            p.ratesApproved !== undefined || p.sampleConfirmed !== undefined ||
            p.sampleRateOk !== undefined || p.sampleDecision !== undefined ||
            p.ratesApprovalLog !== undefined || p.charge !== undefined ||
            p.sampleRate !== undefined || p.sampleRateManual !== undefined ||
            p.sampleBillingParty !== undefined || p.sampleCarrier !== undefined ||
            p.sampleFreight !== undefined || p.sampleShipTo !== undefined ||
            p.sampleAddress !== undefined || p.sampleChargesAmount !== undefined ||
            p.sampleGst !== undefined || p.sampleGstIncl !== undefined ||
            p.sampleReadyDate !== undefined || p.sampleNotes !== undefined ||
            p.costing !== undefined || p.simulatedRates !== undefined ||
            p.billTo !== undefined
          );
          if (shouldSync) {
            syncJobToBackend(updated);
          }
        }, 400); // Fast 400ms real-time auto-save
      }
      return updated;
    });
  };
  const isLostOrCancelled = Boolean(
    s?.is_lost ||
    s?.stage === "cancelled" ||
    s?.stage === "lost" ||
    s?.rawJob?.is_lost ||
    s?.rawJob?.stage === "cancelled" ||
    s?.wizard_state?.is_lost ||
    s?.isLocked
  );

  const handleStepClick = (i) => {
    if (isLostOrCancelled) {
      if (i !== 3) {
        toast.warning("This enquiry has been cancelled and is completely locked.");
        return;
      }
    }
    if (i <= s.step) {
      set({ step: i });
      return;
    }
    // Block jumping forward from Step 2 (Brief) if brief or designer is incomplete
    if (s.step === 2 && i > 2) {
      const { isValid, error } = validateBriefStepProgression(s);
      if (!isValid) {
        toast.warn(error || "Please complete the brief details before proceeding");
        return;
      }
    }
    set({ step: i });
  };

  const next = () => {
    const nextStep = s.step + 1;
    handleStepClick(nextStep);
  };

  const handleGoToBoard = async () => {
    try {
      sessionStorage.removeItem("active_integration_job_id");
      sessionStorage.removeItem("integration_brief_draft");
    } catch (_e) {
      /* ignore */
    }
    updateUrlJob(null);
    let nextSeq = seqCount;
    let nextEnqNo = formatEnquiryNo(nextSeq);
    try {
      const res = await axiosInstance.get("/enquiry-flow-integration/next-number");
      if (res.data?.seq) {
        nextSeq = res.data.seq;
        nextEnqNo = res.data.enquiry_no || formatEnquiryNo(nextSeq);
      }
    } catch (err) {
      console.log("Next sequence fallback:", err);
    }

    setSeqCount(nextSeq);
    setS({
      step: 0,
      e: {
        type: "Trophy",
        theme: "Custom Trophy",
        askMode: "custom",
        designer: true,
        briefMode: "one",
        globalBrief: "",
        globalRefs: [],
        productBriefs: {},
        trophyGroups: [
          {
            theme: "Custom Trophy",
            productName: "Custom Trophy",
            kind: "custom",
            type: "Trophy",
            mat: "MDF",
            items: [{ size: 8, qty: 50, budget: 850, designOptionsCount: 2 }],
          },
        ],
      },
      clientId: null,
      contactId: null,
      coordinator: null,
      the_brief: {
        brief_text: "",
        product_briefs: {},
        ref_files: [],
        design_needed: true,
        options_count: 2,
      },
      sub_jobs: [],
      optionsShared: false,
      optionsSharedChannel: "",
      designApproved: false,
      designStatus: "pending",
      quoteApproved: false,
      client_quote_decision: "pending",
      quoted: false,
      productFeedback: {},
      uploadedDesigns: {},
      enqSent: false,
      mode: null,
      qty: 50,
      leadDate: null,
      sent: false,
      seq: nextSeq,
      enquiry_no: nextEnqNo,
      charge: "foc",
      sampleRate: 0,
      dbJobId: null,
      is_lost: false,
      stage: "enquiry",
      isLocked: false,
    });
    setBoardRefreshKey((k) => k + 1);
    setView("board");
  };

  useEffect(() => {
    axiosInstance
      .get("/enquiry-flow-integration/next-number")
      .then((res) => {
        if (res.data?.seq) {
          setSeqCount(res.data.seq);
          setS((prev) => {
            if (prev.dbJobId || view === "job" || prev.clientId) {
              return prev;
            }
            return {
              ...prev,
              seq: res.data.seq,
              enquiry_no: res.data.enquiry_no || formatEnquiryNo(res.data.seq),
            };
          });
        }
      })
      .catch((err) => console.log("Next enquiry seq fallback", err));
  }, [view, boardRefreshKey]);

  // When URL has ?job=..., fetch ONLY that specific job by ID; otherwise reset to Jobs Board
  useEffect(() => {
    if (!urlJobId) {
      setView("board");
      try {
        sessionStorage.removeItem("active_integration_job_id");
        sessionStorage.removeItem("integration_brief_draft");
      } catch (_e) {
        /* ignore */
      }
    } else {
      const isCurrentJob =
        view === "job" &&
        ((s.dbJobId && String(s.dbJobId) === String(urlJobId)) ||
          (s.seq && String(s.seq) === String(urlJobId)) ||
          (s.seq && (s.enquiry_no === String(urlJobId) || formatEnquiryNo(s.seq) === String(urlJobId))) ||
          (s.enquiry_no && String(s.enquiry_no) === String(urlJobId)));

      if (!isCurrentJob) {
        fetchAndOpenJobById(urlJobId, false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlJobId]);

  // Intercept any native window.alert calls inside enquiry-flow and redirect to toast notification
  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (msg) => {
      toast.warn(String(msg || ""), { position: "top-right", autoClose: 4000 });
    };
    return () => {
      window.alert = originalAlert;
    };
  }, []);

  const currentClient = selectedClientDetail || (s.newClient ? mapCustomerToClientProfile(s.newClient) : null);

  const curSeq = s.seq || seqCount;
  const enqId = s.enquiry_no || formatEnquiryNo(curSeq);
  const currentIds = {
    enq: enqId,
    qt: deriveDocNo(enqId, "QT"),
    cst: deriveDocNo(enqId, "CST"),
    s: deriveDocNo(enqId, "RD/S"),
    p: deriveDocNo(enqId, "RD/P"),
  };

  return (
    <div className="enquiry-flow-page app">
      <header
        className="top"
        style={{ justifyContent: "flex-end", gap: "10px" }}
      >
        {view !== "board" && (
          <button className="themebtn" onClick={handleGoToBoard}>
            ▦ Jobs board
          </button>
        )}
        <button className="themebtn" onClick={handleNewEnquiry}>
          + New enquiry
        </button>
      </header>

      {view === "board" ? (
        <div style={{ padding: "20px 24px", width: "100%", margin: "0" }}>
          <JobsBoard
            role={userRole}
            onOpen={(card) => fetchAndOpenJobById(card._id || card.id, true)}
            ex="all"
            refreshKey={boardRefreshKey}
            clientStep={
              <div className="panel" style={{ marginBottom: "16px" }}>
                <b style={{ fontSize: "18px", fontFamily: "var(--display)" }}>
                  Start a new enquiry ({currentIds.enq})
                </b>
                <p
                  style={{
                    color: "var(--ink2)",
                    fontSize: "13px",
                    margin: "4px 0 16px",
                  }}
                >
                  Search a client, or pick one below. The job card automatically initializes as {currentIds.enq}.
                </p>
                <ClientStep
                  s={s}
                  set={(p) => {
                    set(p);
                    if (p && p.clientId) {
                      setView("job");
                    }
                  }}
                  next={() => {
                    set({ step: 1 });
                    setView("job");
                  }}
                  client={currentClient}
                  onResume={() => setView("job")}
                />
              </div>
            }
          />
        </div>
      ) : (
        <div className="grid">
          <aside className="rail" style={{ background: "transparent", backgroundColor: "transparent", border: "none", boxShadow: "none" }}>
            <h1 className="railtitle">One job, start to finish</h1>
            <p className="railsub">
              Enquiry, sample and production on one card.
            </p>
            {STEPS.map((st, i) => {
              const active = s.step === i;
              const done = s.step > i;
              const showGroupHeader = i === 0 || STEPS[i - 1].g !== st.g;

              // Dynamic subtitle text for rail steps to match design
              let subText = st.sub;
              if (i === 0) {
                subText = currentClient ? currentClient.name : "Search or add";
              } else if (i === 1) {
                subText = (s.e?.theme || s.e?.type) ? `${s.e.theme || s.e.type} · ${s.qty || s.e?.qty || 50} pcs` : "Custom Trophy · 50 pcs";
              } else if (i === 2) {
                subText = "Refs, design, options";
              } else if (i === 3) {
                subText = "Source, owner, heat";
              } else if (i === 4) {
                subText = "Unlocks when won";
              }

              return (
                <React.Fragment key={i}>
                  {showGroupHeader && (
                    <div className="rgroup">
                      <span>{st.g}</span>
                      {st.g === "Order" && <span className="lock">· unlocks when won</span>}
                    </div>
                  )}
                  <button
                    className={`rstep ${active ? "on" : ""} ${done ? "done" : ""}`}
                    onClick={() => handleStepClick(i)}
                  >
                    <span className="rdot">{done ? "✓" : i + 1}</span>
                    <span>
                      <span className="rlabel">{st.label}</span>
                      {subText && <div className="rsum">{subText}</div>}
                    </span>
                  </button>
                </React.Fragment>
              );
            })}
          </aside>

          <main className="stage">
            {isLostOrCancelled && (
              <CancelledEnquiryBanner s={s} onBackToBoard={() => setView("board")} />
            )}
            {s.step !== 6 && (
              <>
                <h2 className="q">{Q[s.step][0]}</h2>
                <p className="qs">{Q[s.step][1]}</p>

                {/* 9-Stage Lifecycle Bar */}
                <StageBar
                  s={s}
                  f={finOf(
                    s,
                    { rate: s.jobRate || 1000, product: s.e?.theme || "Custom Trophy" },
                    currentClient,
                    s.qty || 100
                  )}
                />
              </>
            )}

            {s.step === 0 && (
              <ClientStep s={s} set={set} next={next} client={currentClient} />
            )}
            {s.step === 1 && (
              <AskStep
                s={s}
                set={set}
                next={next}
                client={currentClient}
                syncJobToBackend={syncJobToBackend}
              />
            )}
            {s.step === 2 && <BriefStep key={s.dbJobId || s.seq || "new-enquiry"} s={s} set={set} next={next} />}
            {s.step === 3 && (
              <LogStep
                s={s}
                set={set}
                next={next}
                client={currentClient}
                heat={heatOf(currentClient, s.e)}
                ids={currentIds}
                goOrder={(m) => {
                  if (isLostOrCancelled) {
                    toast.warning("This enquiry has been cancelled and cannot progress to ordering.");
                    return;
                  }
                  set({ mode: m, step: 4 });
                }}
                isLocked={isLostOrCancelled}
              />
            )}
            {s.step === 4 && <ModeStep s={s} set={set} next={next} />}
            {s.step === 5 && (
              <DetailsStep
                s={s}
                set={set}
                next={next}
                client={currentClient}
                job={{ rate: s.jobRate || 1000, product: s.e?.theme || "Custom Trophy" }}
                ids={currentIds}
              />
            )}
            {s.step === 6 && (
              <SendStep
                s={s}
                set={set}
                client={currentClient}
                ids={currentIds}
              />
            )}
          </main>

          <JobCard s={s} client={currentClient} ids={currentIds} />
        </div>
      )}
    </div>
  );
};

export default EnquiryFlow;
