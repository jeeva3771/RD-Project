import React, { useState, useEffect } from "react";
import { inr, LOST, formatEnquiryNo, ENQUIRY_CONFIG } from "../../../utils/helpers";
import { axiosInstance } from "../../../../../utils/url/config";
import { toast } from "react-toastify";
import QuoteDecisionStatusSection from "./QuoteDecisionStatusSection";
import OrderProgressionSection from "./OrderProgressionSection";
import SubJobRateEditModal from "./SubJobRateEditModal";
import SubJobLifecycleModal from "./SubJobLifecycleModal";
import ProgressionGuardModal from "./ProgressionGuardModal";
import EnquiryArtworkFeeModal from "./EnquiryArtworkFeeModal";
import { buildSubJobQuotationRows } from "./logStepOperations";

/**
 * SubJobQuotationCard.jsx
 * Unified Quotation, BOM Costing & Sub-Job Lifecycle Manager inside LogStep.
 * - Displays ONLY single Unit Rate for ordered quantity (no quantity slabs).
 * - Multi-trophy selective or batch quote dispatch via checkboxes.
 * - Sub-job lifecycle controls: HOLD (pause, resume later) and DROP (permanent cancel).
 * - Progression guard: allows approved sub-jobs to advance to Step 4 while auto-holding unapproved items.
 * - Quotation approval recorded via client link OR internally by Admin / Client Servicing.
 * - Communication proof logged inline using CommunicationLogForm (matching Design approval UI).
 * - Live background sync detects client approval via public quotation link.
 * - Order Progression (Step 4) unlocks ONLY after quotation is approved, with 3 v37 options.
 */
const SubJobQuotationCard = ({
  s,
  set,
  e,
  client,
  ids,
  productsList = [],
  flattenedProducts = [],
  simulatedRates = {},
  setSimulatedRates,
  quoteSelectedProducts = new Set(),
  setQuoteSelectedProducts,
  onOpenPreviewQuote,
  goOrder,
  onHoldSubJob,
  onUnholdSubJob,
  onDropSubJob,
  isLocked = false,
}) => {
  const [editingSubJob, setEditingSubJob] = useState(null); // Sub-job being edited for rates
  const [editRate, setEditRate] = useState("");
  const [editSampleRate, setEditSampleRate] = useState("");
  const [editArtworkCharge, setEditArtworkCharge] = useState("");
  const [isSavingRate, setIsSavingRate] = useState(false);

  // Enquiry-level 1-time artwork fee editing modal
  const [isEditingArtworkModal, setIsEditingArtworkModal] = useState(false);
  const [artworkFeeInput, setArtworkFeeInput] = useState("");
  const [isSavingArtworkFee, setIsSavingArtworkFee] = useState(false);

  // Hold / Drop dialog state
  const [dialogAction, setDialogAction] = useState(null); // { type: 'hold' | 'drop', subJobNo, name }
  const [dialogReason, setDialogReason] = useState("");
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Partial progression guard modal state
  const [showProgressionGuard, setShowProgressionGuard] = useState(false);
  const [pendingOrderMode, setPendingOrderMode] = useState(null);

  // Internal Quote Decision Recording State (Admin / Client Servicing)
  // Renders CommunicationLogForm inline (matching DesignOptionsSection)
  const [decisionMode, setDecisionMode] = useState(null); // 'approve' | 'revision' | 'rejected' | null
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // Progression: Lost reason selector state (v37 style)
  const [lostOpen, setLostOpen] = useState(false);
  const [selectedLostReason, setSelectedLostReason] = useState("");
  const [lostNotes, setLostNotes] = useState("");

  const parentJobNo = s?.rawJob?.enquiry_no || (s?.seq
    ? formatEnquiryNo(s.seq)
    : ids?.enq || ENQUIRY_CONFIG.DEFAULT_ENQUIRY_NO);

  // Build merged sub-job rows combining productsList, s.sub_jobs, and flattenedProducts
  const dbSubJobs = Array.isArray(s.sub_jobs) ? s.sub_jobs : [];

  const subJobRows = buildSubJobQuotationRows({
    productsList,
    e,
    s,
    dbSubJobs,
    simulatedRates,
    parentJobNo,
    defaultArtwork: 1500,
  });

  // Resolve enquiry-wide 1-time artwork charge (default ₹1,500)
  const enquiryArtworkCharge = Number(
    s.financials?.artwork_charge !== undefined
      ? s.financials.artwork_charge
      : s.wizard_state?.costing?.artwork !== undefined
        ? s.wizard_state.costing.artwork
        : s.costing?.artwork !== undefined
          ? s.costing.artwork
          : 1500
  );

  // Calculate totals across active (non-dropped) sub-jobs
  const activeRows = subJobRows.filter((r) => !r.isDrop);
  const itemsSubtotal = activeRows.reduce(
    (sum, r) => sum + (r.lineTotal || 0),
    0,
  );
  const totalSubtotal = itemsSubtotal + (enquiryArtworkCharge || 0);
  const gstRate = s.financials?.gst_rate || 18;
  const gstAmount = Math.round((totalSubtotal * gstRate) / 100);
  const grandTotal = totalSubtotal + gstAmount;

  // Quotation Status Evaluation
  const isQuoteShared = Boolean(
    s.quoted ||
    s.quoteVia ||
    s.wizard_state?.quoted ||
    subJobRows.some((r) => r.quoteShared) ||
    dbSubJobs.some((sj) => sj.quote_shared)
  );

  const isQuoteApproved = Boolean(
    s.quoteApproved ||
    s.wizard_state?.quoteApproved ||
    s.client_quote_decision === "approved" ||
    s.decision?.decision === "approved" ||
    (activeRows.length > 0 && activeRows.some((r) => r.clientDecision === "approved")) ||
    (dbSubJobs.length > 0 && dbSubJobs.some((sj) => !sj.is_dropped && !sj.is_on_hold && sj.client_quote_decision === "approved"))
  );

  const isQuoteRevision = Boolean(
    !isQuoteApproved && (
      s.client_quote_decision === "revision" ||
      s.decision?.decision === "revision" ||
      subJobRows.some((r) => r.clientDecision === "revision") ||
      dbSubJobs.some((sj) => sj.client_quote_decision === "revision")
    )
  );

  const isQuoteRejected = Boolean(
    !isQuoteApproved && (
      s.lost ||
      s.client_quote_decision === "rejected" ||
      s.decision?.decision === "rejected" ||
      subJobRows.some((r) => r.clientDecision === "rejected") ||
      dbSubJobs.some((sj) => sj.client_quote_decision === "rejected")
    )
  );

  const approvedAt =
    s.decision?.at ||
    activeRows.find((r) => r.clientDecision === "approved")?.clientDecisionAt ||
    dbSubJobs.find((sj) => sj.client_quote_decision === "approved")?.client_quote_decision_at;
  const approvedVia =
    s.decision?.channel ||
    activeRows.find((r) => r.clientDecision === "approved")?.clientCommunication ||
    dbSubJobs.find((sj) => sj.client_quote_decision === "approved")?.client_quote_communication ||
    "Client Link";
  const approvedNote =
    s.decision?.notes ||
    activeRows.find((r) => r.clientDecision === "approved")?.clientNotes ||
    dbSubJobs.find((sj) => sj.client_quote_decision === "approved")?.client_quote_decision_notes ||
    "";

  const formattedApprovalDate = approvedAt
    ? new Date(approvedAt).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    : new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  // Live background polling check: If quote is shared and not yet marked approved,
  // query the backend every 7 seconds to check if client approved via public link
  const checkLiveQuoteStatus = async (isManual = false) => {
    const jobId = s.dbJobId || s._id;
    if (!jobId) return;
    try {
      if (isManual) setIsCheckingStatus(true);
      const res = await axiosInstance.get(`/enquiry-flow-integration/${jobId}`);
      const freshJob = res.data?.data;
      if (!freshJob) return;

      const freshSjs = Array.isArray(freshJob.sub_jobs) ? freshJob.sub_jobs : [];
      const anySjApproved = freshSjs.some(
        (sj) => !sj.is_dropped && !sj.is_on_hold && sj.client_quote_decision === "approved"
      );
      const anySjRevision = freshSjs.some(
        (sj) => !sj.is_dropped && !sj.is_on_hold && sj.client_quote_decision === "revision"
      );
      const anySjRejected = freshSjs.some(
        (sj) => !sj.is_dropped && !sj.is_on_hold && sj.client_quote_decision === "rejected"
      );
      const isApprovedInDb = Boolean(
        freshJob.wizard_state?.quoteApproved === true ||
        freshJob.wizard_state?.client_quote_decision === "approved" ||
        anySjApproved
      );

      if (isApprovedInDb) {
        const approvedSj = freshSjs.find((sj) => sj.client_quote_decision === "approved");
        set({
          quoteApproved: true,
          client_quote_decision: "approved",
          sub_jobs: freshSjs,
          rawJob: freshJob,
          decision: {
            decision: "approved",
            channel: approvedSj?.client_quote_communication || "Direct Client Response",
            notes: approvedSj?.client_quote_decision_notes || "Client confirmed via link",
            at: approvedSj?.client_quote_decision_at || new Date().toISOString(),
          },
        });
        if (isManual) {
          toast.success("✓ Quotation has been approved by the client!");
        }
      } else if (anySjRevision && s.client_quote_decision !== "revision") {
        set({
          client_quote_decision: "revision",
          sub_jobs: freshSjs,
          rawJob: freshJob,
        });
        if (isManual) {
          toast.info("Client requested quotation revisions.");
        }
      } else if (anySjRejected && s.client_quote_decision !== "rejected") {
        set({
          client_quote_decision: "rejected",
          sub_jobs: freshSjs,
          rawJob: freshJob,
        });
        if (isManual) {
          toast.info("Client declined quotation.");
        }
      } else if (isManual) {
        toast.info("Quotation is still awaiting client response.");
      }
    } catch (err) {
      if (isManual) toast.error("Could not fetch quotation status.");
    } finally {
      if (isManual) setIsCheckingStatus(false);
    }
  };

  useEffect(() => {
    if (!isQuoteShared || isQuoteApproved) return;
    const interval = setInterval(() => {
      checkLiveQuoteStatus(false);
    }, 7000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isQuoteShared, isQuoteApproved, s.dbJobId, s._id]);

  // Saves decision submitted via inline CommunicationLogForm (matching Design approval UI)
  const handleSaveCommunicationLog = async (logData) => {
    setIsSubmittingDecision(true);
    const now = new Date();
    const jobId = s.dbJobId || s._id;

    // Convert method to friendly channel label
    const methodMap = {
      whatsapp: "WhatsApp",
      email: "Email",
      verbal: logData.verbalType === "phone" ? "Phone Call" : "In Person",
      written: logData.poNumber ? `Written / PO #${logData.poNumber}` : "Written / PO",
      screenshot: "Screenshot",
    };
    const channelLabel = methodMap[logData.method] || logData.method || "Direct Client Response";

    const notes =
      logData.feedbackDetails ||
      logData.waMessage ||
      logData.emailKeyLines ||
      logData.verbalSay ||
      logData.poNumber ||
      "";

    const decisionVal = decisionMode === "approve" ? "approved" : decisionMode;
    const isApproved = decisionVal === "approved";
    const atDate = `${logData.date || now.toISOString().slice(0, 10)}T${logData.time || now.toTimeString().slice(0, 5)}:00.000Z`;

    try {
      if (jobId) {
        const payload = {
          subJobNo: "all",
          decision: decisionVal,
          channel: channelLabel,
          notes,
          contactPerson: logData.whoConfirmed,
          proofUrl: logData.attachment?.url || "",
          proofName: logData.attachment?.name || "",
          decisionDate: logData.date,
          decisionTime: logData.time,
          communicationLog: logData,
        };
        const res = await axiosInstance.post(
          `/enquiry-flow-integration/${jobId}/quote-decision`,
          payload
        );
        if (res.data?.success) {
          toast.success(
            isApproved
              ? "✓ Quotation approved and order acceptance recorded!"
              : decisionVal === "revision"
                ? "Change request recorded."
                : "Quotation marked as lost."
          );

          const updatedDbSubJobs = res.data.data?.sub_jobs || dbSubJobs.map((sj) => ({
            ...sj,
            client_quote_decision: decisionVal,
            client_quote_decision_at: atDate,
            client_quote_decision_notes: notes,
            client_quote_communication: channelLabel,
            client_quote_proof: logData.attachment?.url || "",
          }));

          set({
            quoteApproved: isApproved,
            client_quote_decision: decisionVal,
            client_quote_decision_notes: notes,
            client_quote_decision_at: atDate,
            client_quote_communication: channelLabel,
            decision: {
              decision: decisionVal,
              channel: channelLabel,
              notes,
              at: atDate,
              by: logData.whoConfirmed || s.coordinator || "Client Servicing / Admin",
              proofUrl: logData.attachment?.url || "",
              proofName: logData.attachment?.name || "",
              communicationLog: logData,
            },
            lost: decisionVal === "rejected" ? notes : null,
            sub_jobs: updatedDbSubJobs,
          });
        }
      } else {
        const updatedLocalSubJobs = dbSubJobs.map((sj) => ({
          ...sj,
          client_quote_decision: decisionVal,
          client_quote_decision_at: atDate,
          client_quote_decision_notes: notes,
          client_quote_communication: channelLabel,
          client_quote_proof: logData.attachment?.url || "",
        }));

        set({
          quoteApproved: isApproved,
          client_quote_decision: decisionVal,
          client_quote_decision_notes: notes,
          client_quote_decision_at: atDate,
          client_quote_communication: channelLabel,
          decision: {
            decision: decisionVal,
            channel: channelLabel,
            notes,
            at: atDate,
            by: logData.whoConfirmed || s.coordinator || "Client Servicing / Admin",
            proofUrl: logData.attachment?.url || "",
            proofName: logData.attachment?.name || "",
            communicationLog: logData,
          },
          lost: decisionVal === "rejected" ? notes : null,
          sub_jobs: updatedLocalSubJobs,
        });

        toast.success(
          isApproved
            ? "Quotation approved locally."
            : "Decision recorded locally."
        );
      }
      setDecisionMode(null);
    } catch (err) {
      console.error("Error recording quote decision:", err);
      toast.error(err.response?.data?.message || "Failed to record quotation decision.");
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  const handleRecordDecision = async ({ decision, channel, notes, lostReason }) => {
    setIsSubmittingDecision(true);
    const now = new Date();
    const jobId = s.dbJobId || s._id;
    const finalNotes = lostReason ? `${lostReason}${notes ? ` - ${notes}` : ""}` : notes;

    try {
      if (jobId) {
        const payload = {
          subJobNo: "all",
          decision,
          channel: channel || "Phone Call",
          notes: finalNotes || "",
        };
        const res = await axiosInstance.post(
          `/enquiry-flow-integration/${jobId}/quote-decision`,
          payload
        );
        if (res.data?.success) {
          toast.success(
            decision === "approved"
              ? "✓ Quotation approved and order acceptance recorded!"
              : decision === "revision"
                ? "Change request recorded."
                : "Quotation marked as lost."
          );

          const updatedDbSubJobs = res.data.data?.sub_jobs || dbSubJobs.map((sj) => ({
            ...sj,
            client_quote_decision: decision,
            client_quote_decision_at: now.toISOString(),
            client_quote_decision_notes: finalNotes,
            client_quote_communication: channel,
          }));

          set({
            quoteApproved: decision === "approved",
            client_quote_decision: decision,
            decision: {
              decision,
              channel: channel || "Phone Call",
              notes: finalNotes,
              at: now.toISOString(),
              by: s.coordinator || "Client Servicing / Admin",
            },
            lost: decision === "rejected" ? (lostReason || finalNotes) : null,
            sub_jobs: updatedDbSubJobs,
          });
        }
      } else {
        const updatedLocalSubJobs = dbSubJobs.map((sj) => ({
          ...sj,
          client_quote_decision: decision,
          client_quote_decision_at: now.toISOString(),
          client_quote_decision_notes: finalNotes,
          client_quote_communication: channel,
        }));

        set({
          quoteApproved: decision === "approved",
          client_quote_decision: decision,
          decision: {
            decision,
            channel: channel || "Phone Call",
            notes: finalNotes,
            at: now.toISOString(),
            by: s.coordinator || "Client Servicing / Admin",
          },
          lost: decision === "rejected" ? (lostReason || finalNotes) : null,
          sub_jobs: updatedLocalSubJobs,
        });

        toast.success(
          decision === "approved"
            ? "Quotation approved locally."
            : "Decision recorded locally."
        );
      }
      setDecisionMode(null);
    } catch (err) {
      console.error("Error recording quote decision:", err);
      toast.error(err.response?.data?.message || "Failed to record quotation decision.");
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  const isJobBlocked = Boolean(
    isLocked ||
    s.is_lost ||
    s.stage === "cancelled" ||
    s.stage === "lost" ||
    s.rawJob?.is_lost ||
    s.rawJob?.stage === "cancelled" ||
    s.wizard_state?.is_lost ||
    s.isLocked
  );

  const handleConfirmLost = async () => {
    if (!selectedLostReason) {
      toast.warning("Please pick a reason for marking the job as lost.");
      return;
    }
    const targetDbId = s.dbJobId || s._id || s.rawJob?._id || ids?.id;
    setIsSubmittingDecision(true);
    try {
      const fullNotes = lostNotes ? `${selectedLostReason} - ${lostNotes}` : selectedLostReason;
      if (targetDbId) {
        await axiosInstance.post(`/enquiry-flow-integration/${targetDbId}/lost`, {
          lost_stage: "quotation",
          lost_reason: selectedLostReason,
          lost_notes: lostNotes,
        });
      }

      const updatedSubJobs = (s.sub_jobs || []).map((sj) => ({
        ...sj,
        client_quote_decision: "rejected",
        is_dropped: true,
        drop_reason: fullNotes,
        stage: "cancelled",
      }));

      set({
        is_lost: true,
        stage: "cancelled",
        quoteApproved: false,
        client_quote_decision: "rejected",
        decision: {
          decision: "rejected",
          channel: "Lost in Progression",
          notes: fullNotes,
          at: new Date().toISOString(),
          by: s.coordinator || "Client Servicing / Admin",
        },
        lost: fullNotes,
        lostReason: selectedLostReason,
        lostNotes: lostNotes,
        lostAt: new Date().toISOString(),
        lostBy: s.coordinator || "Client Servicing / Admin",
        isLocked: true,
        sub_jobs: updatedSubJobs,
      });

      toast.success("✕ Enquiry marked as Lost & Cancelled. Job abandoned and locked.");
      setLostOpen(false);
    } catch (err) {
      console.error("Error marking job as lost:", err);
      toast.error(err.response?.data?.message || "Failed to mark job as lost.");
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  // Sub-jobs eligible for quotation selection: neither dropped nor on hold, and artwork uploaded
  const selectableRows = subJobRows.filter((r) => !r.isDrop && !r.isHold && r.costingStatus !== "awaiting_artwork");

  // Toggle selection for selective quoting (block hold, dropped, and awaiting artwork sub-jobs)
  const toggleSelectRow = (rateKey) => {
    if (isJobBlocked) return;
    const row = subJobRows.find((r) => r.rateKey === rateKey);
    if (row && (row.isHold || row.isDrop || row.costingStatus === "awaiting_artwork")) return;
    const nextSet = new Set(quoteSelectedProducts);
    if (nextSet.has(rateKey)) {
      nextSet.delete(rateKey);
    } else {
      nextSet.add(rateKey);
    }
    setQuoteSelectedProducts(nextSet);
  };

  const selectAllActive = () => {
    if (isJobBlocked) return;
    const activeKeys = selectableRows.map((r) => r.rateKey);
    setQuoteSelectedProducts(new Set(activeKeys));
  };

  const clearSelection = () => {
    setQuoteSelectedProducts(new Set());
  };

  // 1. Request Costing for Sub-Jobs (Single or Batch)
  const handleRequestCosting = async (subJobNos = []) => {
    if (isJobBlocked) {
      toast.warning("This enquiry is cancelled and locked. Costing cannot be requested.");
      return;
    }
    const eligibleRows = (quoteSelectedProducts.size > 0
      ? subJobRows.filter((r) => quoteSelectedProducts.has(r.rateKey))
      : activeRows
    ).filter((r) => r.costingStatus !== "awaiting_artwork");

    const targetNos =
      Array.isArray(subJobNos) && subJobNos.length > 0
        ? subJobNos
        : eligibleRows.map((r) => r.subJobNo);

    if (targetNos.length === 0) {
      toast.warn("No eligible sub-jobs for costing. Designer must upload approved artwork files (.cdr/.pdf) first.");
      return;
    }

    const nowIso = new Date().toISOString();
    const jobId = s.dbJobId || s._id;

    // Immediately update sub_jobs in local state with pending costing status
    const updatedLocalSubJobs =
      dbSubJobs.length > 0
        ? dbSubJobs.map((sj) =>
          targetNos.includes(sj.sub_job_no)
            ? {
              ...sj,
              costing_status: "pending",
              costing_requested_at: nowIso,
            }
            : sj,
        )
        : targetNos.map((no) => ({
          sub_job_no: no,
          costing_status: "pending",
          costing_requested_at: nowIso,
        }));

    if (!jobId) {
      toast.info("Costing request recorded locally.");
      set({
        costReq: nowIso,
        sub_jobs: updatedLocalSubJobs,
      });
      return;
    }

    try {
      const payload = {
        subJobNos: targetNos,
        notes: "Requested from Enquiry Quotation Desk",
      };
      const res = await axiosInstance.post(
        `/enquiry-flow-integration/${jobId}/request-costing`,
        payload,
      );
      if (res.data?.success) {
        toast.success(res.data.message || "Costing requested successfully!");
        set({
          costReq: nowIso,
          sub_jobs: res.data.data?.sub_jobs || updatedLocalSubJobs,
        });
      }
    } catch (err) {
      console.error("Error requesting costing:", err);
      toast.error(
        err.response?.data?.message || "Failed to request costing from desk",
      );
      set({
        costReq: nowIso,
        sub_jobs: updatedLocalSubJobs,
      });
    }
  };

  // 2. Open Rate Modal & Save Rate to Backend
  const handleOpenEditRate = (row) => {
    if (isJobBlocked) {
      toast.warning("This enquiry is cancelled and locked.");
      return;
    }
    setEditingSubJob(row);
    const existingRate =
      row.unitRate > 0
        ? row.unitRate
        : simulatedRates[row.rateKey]?.rate > 0
          ? simulatedRates[row.rateKey].rate
          : 0;
    setEditRate(existingRate > 0 ? Number(existingRate).toFixed(2) : "0.00");
    const defaultSample =
      existingRate > 0 ? Number((existingRate + 200).toFixed(2)) : "";
    setEditSampleRate(
      row.sampleRate !== undefined && row.sampleRate > 0
        ? Number(row.sampleRate).toFixed(2)
        : defaultSample,
    );
    setEditArtworkCharge(
      row.artworkCharge !== undefined
        ? Number(row.artworkCharge).toFixed(2)
        : "0.00",
    );
  };

  const handleSaveRate = async () => {
    if (!editingSubJob) return;
    // Unit rate cannot be edited - read-only from calculated unit rate
    const existingRate =
      editingSubJob.unitRate > 0
        ? editingSubJob.unitRate
        : Number(editRate) > 0
          ? Number(editRate)
          : simulatedRates[editingSubJob.rateKey]?.rate || 0;

    const uRate = Number(Number(existingRate || 0).toFixed(2));
    const sRate =
      editSampleRate !== ""
        ? Number(Number(editSampleRate).toFixed(2))
        : uRate > 0
          ? Number((uRate + 200).toFixed(2))
          : uRate;
    const aCharge = Number(Number(editArtworkCharge || 0).toFixed(2));

    setIsSavingRate(true);
    const nextSimulated = { ...simulatedRates };
    if (aCharge > 0) {
      Object.keys(nextSimulated).forEach((k) => {
        if (k !== editingSubJob.rateKey && k !== editingSubJob.subJobNo) {
          if (nextSimulated[k] && typeof nextSimulated[k] === "object") {
            nextSimulated[k] = { ...nextSimulated[k], artwork: 0 };
          }
        }
      });
    }

    const updatedRates = {
      ...nextSimulated,
      [editingSubJob.rateKey]: {
        rate: uRate,
        sample: sRate,
        artwork: aCharge,
        costing_status: "completed",
        isManualSaved: true,
      },
    };
    setSimulatedRates(updatedRates);

    const jobId = s.dbJobId || s._id;
    if (jobId) {
      try {
        const payload = {
          subJobNo: editingSubJob.subJobNo,
          unit_rate: uRate,
          sample_rate: sRate,
          artwork_charge: aCharge,
          costing_status: "completed",
          notes: "Sample Rate & Artwork fee updated via Enquiry Flow LogStep",
        };
        const res = await axiosInstance.post(
          `/enquiry-flow-integration/${jobId}/submit-bom-rate`,
          payload,
        );
        if (res.data?.success) {
          toast.success(`Rates updated for ${editingSubJob.subJobNo}`);
          set({
            costing: {
              rate: uRate,
              sampleRate: sRate,
              artwork: aCharge,
            },
            sub_jobs: res.data.data?.sub_jobs || s.sub_jobs,
            financials: res.data.data?.financials || s.financials,
          });
        }
      } catch (err) {
        console.error("Error syncing rate to backend:", err);
        toast.warning("Rate applied locally, but server sync failed.");
      }
    } else {
      set({
        costing: {
          rate: uRate,
          sampleRate: sRate,
          artwork: aCharge,
        },
      });
      toast.success(`Rate saved locally for ${editingSubJob.subJobNo}`);
    }

    setIsSavingRate(false);
    setEditingSubJob(null);
  };

  const handleOpenArtworkModal = () => {
    if (isJobBlocked) {
      toast.warning("This enquiry is cancelled and locked.");
      return;
    }
    setArtworkFeeInput(Number(enquiryArtworkCharge).toFixed(2));
    setIsEditingArtworkModal(true);
  };

  const handleSaveEnquiryArtwork = async () => {
    const fee = Number(Number(artworkFeeInput || 0).toFixed(2));
    setIsSavingArtworkFee(true);
    const newItemsSubtotal = itemsSubtotal;
    const newTotalSubtotal = newItemsSubtotal + fee;
    const currentGstRate = s.financials?.gst_rate || 18;
    const newGstAmount = Math.round((newTotalSubtotal * currentGstRate) / 100);
    const newGrandTotal = newTotalSubtotal + newGstAmount;

    const updatedFinancials = {
      ...(s.financials || {}),
      artwork_charge: fee,
      items_subtotal: newItemsSubtotal,
      subtotal: newTotalSubtotal,
      gst_rate: currentGstRate,
      gst_amount: newGstAmount,
      total: newGrandTotal,
    };

    set({
      financials: updatedFinancials,
      costing: { ...(s.costing || {}), artwork: fee },
    }, true);

    const jobId = s.dbJobId || s._id;
    if (jobId) {
      try {
        await axiosInstance.put(`/enquiry-flow-integration/${jobId}`, {
          financials: updatedFinancials,
          wizard_state: {
            ...s,
            financials: updatedFinancials,
            costing: { ...(s.costing || {}), artwork: fee },
          },
        });
        toast.success(`1-Time Artwork Fee updated to ₹${fee.toLocaleString("en-IN")}`);
      } catch (err) {
        toast.warning("Artwork fee updated locally.");
      }
    } else {
      toast.success(`1-Time Artwork Fee updated to ₹${fee.toLocaleString("en-IN")}`);
    }
    setIsSavingArtworkFee(false);
    setIsEditingArtworkModal(false);
  };

  // 3. Sub-job lifecycle actions: Hold / Drop
  const handleConfirmLifecycleAction = async () => {
    if (!dialogAction) return;
    const { type, subJobNo, productIndex } = dialogAction;
    setIsActionLoading(true);

    try {
      if (type === "hold") {
        if (onHoldSubJob) {
          await onHoldSubJob(subJobNo, dialogReason);
        }
      } else if (type === "drop") {
        if (onDropSubJob) {
          await onDropSubJob(subJobNo, dialogReason);
        }
      }
    } catch (err) {
      console.error(`Error performing ${type}:`, err);
    } finally {
      setIsActionLoading(false);
      setDialogAction(null);
      setDialogReason("");
    }
  };

  // 4. Progression Guard before moving to Step 4 (Order mode)
  const handleAttemptOrderMode = (mode) => {
    if (isJobBlocked) {
      toast.warning("This enquiry has been cancelled and cannot progress to ordering.");
      return;
    }
    // Check if there are active sub-jobs that are not on hold and not dropped
    const activeSubJobs = subJobRows.filter((r) => !r.isDrop && !r.isHold);
    const approvedSubJobs = activeSubJobs.filter(
      (r) => r.clientDecision === "approved" || r.costingStatus === "completed",
    );
    const unapprovedSubJobs = activeSubJobs.filter(
      (r) => r.clientDecision !== "approved" && r.costingStatus !== "completed",
    );

    if (approvedSubJobs.length > 0 && unapprovedSubJobs.length > 0) {
      // Partial approval detected! Show progression guard dialog
      setPendingOrderMode(mode);
      setShowProgressionGuard(true);
      return;
    }

    // Otherwise, continue directly
    goOrder(mode);
  };

  // User confirms putting unapproved sub-jobs on hold and progressing
  const handleConfirmProgressionGuard = async () => {
    const unapproved = subJobRows.filter(
      (r) =>
        !r.isDrop &&
        !r.isHold &&
        r.clientDecision !== "approved" &&
        r.costingStatus !== "completed",
    );
    setIsActionLoading(true);

    try {
      for (const row of unapproved) {
        if (onHoldSubJob) {
          await onHoldSubJob(
            row.subJobNo,
            "Auto-held during partial order progression to Step 4",
          );
        }
      }
      toast.success(
        `${unapproved.length} sub-job(s) placed on HOLD. Proceeding with approved orders.`,
      );
      setShowProgressionGuard(false);
      if (pendingOrderMode) {
        goOrder(pendingOrderMode);
      }
    } catch (err) {
      console.error("Error auto-holding sub-jobs:", err);
      toast.error("Failed to hold some sub-jobs, but proceeding.");
      setShowProgressionGuard(false);
      if (pendingOrderMode) goOrder(pendingOrderMode);
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1-Time Artwork Fee Modal */}
      <EnquiryArtworkFeeModal
        isOpen={isEditingArtworkModal}
        onClose={() => setIsEditingArtworkModal(false)}
        artworkFeeInput={artworkFeeInput}
        setArtworkFeeInput={setArtworkFeeInput}
        onSave={handleSaveEnquiryArtwork}
        isSaving={isSavingArtworkFee}
      />

      {/* Rate Editing Modal */}
      <SubJobRateEditModal
        editingSubJob={editingSubJob}
        setEditingSubJob={setEditingSubJob}
        editRate={editRate}
        editSampleRate={editSampleRate}
        setEditSampleRate={setEditSampleRate}
        editArtworkCharge={editArtworkCharge}
        setEditArtworkCharge={setEditArtworkCharge}
        isSavingRate={isSavingRate}
        handleSaveRate={handleSaveRate}
      />

      {/* Lifecycle Action Dialog (Hold / Drop) */}
      <SubJobLifecycleModal
        dialogAction={dialogAction}
        setDialogAction={setDialogAction}
        dialogReason={dialogReason}
        setDialogReason={setDialogReason}
        isActionLoading={isActionLoading}
        handleConfirmLifecycleAction={handleConfirmLifecycleAction}
      />

      {/* Progression Guard Modal */}
      <ProgressionGuardModal
        showProgressionGuard={showProgressionGuard}
        setShowProgressionGuard={setShowProgressionGuard}
        subJobRows={subJobRows}
        pendingOrderMode={pendingOrderMode}
        isActionLoading={isActionLoading}
        handleConfirmProgressionGuard={handleConfirmProgressionGuard}
      />

      {/* Main Quotation Desk Card */}
      <div className="panel p-5 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-4">
        {/* Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg shadow-2xs">
              💰
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-sm text-gray-900">
                  Sub-Job Quotation & Costing Desk
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold">
                  {subJobRows.length} {subJobRows.length > 1 ? "Items" : "Item"}
                </span>
              </div>
              <p className="text-[11px] text-gray-500">
                Independent sub-job rates for ordered quantities · Send
                consolidated quotes or dispatch selectively.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={selectAllActive}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-[11px] font-semibold text-gray-600 hover:bg-gray-50 transition cursor-pointer"
            >
              Select All
            </button>
            {quoteSelectedProducts.size > 0 && (
              <button
                type="button"
                onClick={clearSelection}
                className="px-2 py-1.5 text-[11px] text-gray-400 hover:text-gray-600 transition cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Sub-Jobs Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-gray-200 text-gray-400 font-bold uppercase text-[10px] tracking-wider bg-gray-50/70">
                <th className="py-2.5 px-3 w-8">
                  <input
                    type="checkbox"
                    checked={
                      selectableRows.length > 0 &&
                      selectableRows.every((r) =>
                        quoteSelectedProducts.has(r.rateKey),
                      )
                    }
                    disabled={selectableRows.length === 0}
                    onChange={(ev) =>
                      ev.target.checked ? selectAllActive() : clearSelection()
                    }
                    className={`w-3.5 h-3.5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 ${selectableRows.length === 0
                        ? "opacity-40 cursor-not-allowed bg-gray-200"
                        : "cursor-pointer"
                      }`}
                    title={
                      selectableRows.length === 0
                        ? "No selectable sub-jobs"
                        : "Select all active sub-jobs"
                    }
                  />
                </th>
                <th className="py-2.5 px-3">Sub-Job & Product</th>
                <th className="py-2.5 px-3 text-right">Ordered Qty</th>
                <th className="py-2.5 px-3 text-right">Unit Rate (₹)</th>
                <th className="py-2.5 px-3 text-right">Sample (₹)</th>
                <th className="py-2.5 px-3 text-right">Line Total (₹)</th>
                <th className="py-2.5 px-3 text-center">Costing Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {subJobRows.map((row) => {
                const isHoldOrDrop = Boolean(row.isHold || row.isDrop);
                const isSelected =
                  !isHoldOrDrop && quoteSelectedProducts.has(row.rateKey);
                const isReadyTrophy = row.kind === "ready";

                return (
                  <tr
                    key={row.subJobNo}
                    className={`transition-colors ${row.isDrop
                        ? "bg-gray-50/80 opacity-50"
                        : row.isHold
                          ? "bg-amber-50/40"
                          : isSelected
                            ? "bg-indigo-50/30"
                            : "hover:bg-gray-50/50"
                      }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3 px-3 align-middle">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isHoldOrDrop || row.costingStatus === "awaiting_artwork"}
                        onChange={() => {
                          if (!isHoldOrDrop && row.costingStatus !== "awaiting_artwork") toggleSelectRow(row.rateKey);
                        }}
                        className={`w-3.5 h-3.5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 ${isHoldOrDrop || row.costingStatus === "awaiting_artwork"
                            ? "opacity-40 cursor-not-allowed bg-gray-200"
                            : "cursor-pointer"
                          }`}
                        title={
                          row.isHold
                            ? "Sub-job is on hold (cannot share quotation)"
                            : row.isDrop
                              ? "Sub-job is dropped (cannot share quotation)"
                              : row.costingStatus === "awaiting_artwork"
                                ? "Awaiting approved design file upload by designer before quotation can be created"
                                : "Select for quotation"
                        }
                      />
                    </td>

                    {/* Sub-Job ID & Details */}
                    <td className="py-3 px-3 align-middle">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-black px-1.5 py-0.5 rounded bg-gray-100 text-indigo-700 border border-gray-200">
                          {row.subJobNo}
                        </span>
                        <div>
                          <div className="font-bold text-gray-900 flex items-center gap-1.5">
                            <span>{row.name}</span>
                            {isReadyTrophy && (
                              <span className="text-[9px] font-extrabold px-1 rounded bg-emerald-100 text-emerald-800">
                                READY
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-500">
                            {row.size} in
                          </span>
                        </div>
                      </div>

                      {/* Hold or Drop badges */}
                      {row.isHold && (
                        <div className="mt-1 text-[10px] font-bold text-amber-800 flex items-center gap-1">
                          <span>⏳ ON HOLD</span>
                          {row.holdReason && (
                            <span className="font-normal italic">
                              ({row.holdReason})
                            </span>
                          )}
                        </div>
                      )}
                      {row.isDrop && (
                        <div className="mt-1 text-[10px] font-bold text-rose-700 flex items-center gap-1">
                          <span>✕ DROPPED</span>
                          {row.dropReason && (
                            <span className="font-normal italic">
                              ({row.dropReason})
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Ordered Qty */}
                    <td className="py-3 px-3 text-right font-medium text-gray-700 align-middle">
                      {row.qty} pcs
                    </td>

                    {/* Unit Rate */}
                    <td className="py-3 px-3 text-right align-middle">
                      {row.unitRate > 0 && row.costingStatus === "completed" ? (
                        <span className="font-extrabold text-gray-900 text-[13px]">
                          ₹
                          {Number(row.unitRate).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">Pending</span>
                      )}
                    </td>

                    {/* Sample Rate */}
                    <td className="py-3 px-3 text-right text-gray-600 align-middle">
                      {row.sampleRate > 0 ? (
                        <div>
                          <div className="font-semibold text-gray-900 text-xs">
                            ₹{Number(row.sampleRate).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/pc
                          </div>
                          <div className="text-[10px] text-gray-500 font-medium">
                            {Number(row.sampleQty || s?.sampleQty || 1)} pcs: ₹{Number(Number(row.sampleRate) * Number(row.sampleQty || s?.sampleQty || 1)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>

                    {/* Line Total */}
                    <td className="py-3 px-3 text-right align-middle">
                      {row.lineTotal > 0 &&
                        row.costingStatus === "completed" ? (
                        <span className="font-extrabold text-indigo-900 text-[13px]">
                          ₹
                          {Number(row.lineTotal).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    {/* Costing Status Badge */}
                    <td className="py-3 px-3 text-center align-middle">
                      {row.costingStatus === "completed" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs whitespace-nowrap">
                          <span>✓</span> Costing Completed
                        </span>
                      ) : row.costingStatus === "awaiting_artwork" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs whitespace-nowrap">
                          <span>⏳</span> Awaiting Artwork
                        </span>
                      ) : row.costingStatus === "pending" ||
                        row.costingStatus === "in_progress" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 shadow-2xs whitespace-nowrap">
                          <span>📋</span> Quotation Requested
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200 whitespace-nowrap">
                          Not Requested
                        </span>
                      )}

                      {row.quoteShared && (
                        <div className="mt-1">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700">
                            Quoted ✉️
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-right align-middle">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Share Quote Quick Button (when costing is completed) */}
                        {row.costingStatus === "completed" &&
                          !row.isDrop &&
                          !row.isHold && (
                            <button
                              type="button"
                              onClick={() => {
                                if (setQuoteSelectedProducts)
                                  setQuoteSelectedProducts(
                                    new Set([row.rateKey]),
                                  );
                                if (onOpenPreviewQuote) onOpenPreviewQuote();
                              }}
                              className="px-2.5 py-1 rounded-lg border border-indigo-200 hover:border-indigo-400 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition cursor-pointer shadow-2xs flex items-center gap-1 whitespace-nowrap"
                              title="Preview and share quotation for this sub-job with client"
                            >
                              <span>📤</span>
                              <span>Share Quote</span>
                            </button>
                          )}

                        {/* Edit Rate Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditRate(row)}
                          className="px-2.5 py-1 rounded-lg border border-gray-200 hover:border-indigo-400 text-[11px] font-semibold text-gray-700 hover:text-indigo-600 bg-white hover:bg-indigo-50/50 transition cursor-pointer shadow-2xs"
                          title="View unit rate & edit sample rate (+₹200 default)"
                        >
                          {row.sampleRate > 0 ? "Edit Rates" : "+ Rates"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Dedicated 1-Time Setup & Artwork Fee Row at the end of the Quotation List */}
              <tr className="bg-gradient-to-r from-indigo-50/70 via-purple-50/40 to-white border-t-2 border-indigo-200">
                <td className="py-3 px-3 text-center align-middle text-indigo-500 font-bold text-sm">
                  🎨
                </td>
                <td colSpan={3} className="py-3 px-3 align-middle">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-gray-900 text-xs">
                      1-Time Setup & Artwork Fee (Enquiry-Wide)
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 uppercase tracking-tight">
                      1-Time Fee
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Vectorizing logo, proof preparation, & production tooling setup (billed once per enquiry)
                  </p>
                </td>
                <td className="py-3 px-3 text-right align-middle text-xs font-semibold text-gray-500">
                  1 Lot
                </td>
                <td className="py-3 px-3 text-right align-middle">
                  <span className="font-extrabold text-indigo-950 text-sm">
                    ₹{Number(enquiryArtworkCharge).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </td>
                <td colSpan={2} className="py-3 px-3 text-right align-middle">
                  {!isJobBlocked && (
                    <button
                      type="button"
                      onClick={handleOpenArtworkModal}
                      className="px-2.5 py-1 rounded-lg border border-indigo-200 hover:border-indigo-400 text-[11px] font-bold text-indigo-700 bg-white hover:bg-indigo-50 transition cursor-pointer shadow-2xs inline-flex items-center gap-1"
                      title="Edit enquiry-level 1-time artwork charge"
                    >
                      <span>✏️</span>
                      <span>Edit Fee</span>
                    </button>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Commercials Summary Strip */}
        <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/70 p-4 rounded-xl">
          <div className="text-xs text-gray-600 space-y-0.5">
            <div>
              <span className="font-bold text-gray-900">
                {activeRows.length} Active Items
              </span>{" "}
              · Total Pieces:{" "}
              <span className="font-bold text-gray-900">
                {activeRows.reduce((sum, r) => sum + r.qty, 0)} pcs
              </span>
            </div>
            <div className="text-[11px] text-gray-500">
              Rates valid for 15 days · GST @ {gstRate}% calculated on
              confirmation.
            </div>
          </div>

          <div className="flex items-center gap-5 text-xs">
            <div className="text-right">
              <span className="text-[10px] text-gray-400 uppercase font-bold block">
                Products Subtotal
              </span>
              <span className="font-bold text-gray-700">
                {inr(itemsSubtotal)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-indigo-600 uppercase font-bold block">
                1-Time Artwork
              </span>
              <span className="font-bold text-indigo-900">
                + {inr(enquiryArtworkCharge)}
              </span>
            </div>
            <div className="text-right border-l border-gray-200 pl-4">
              <span className="text-[10px] text-gray-400 uppercase font-bold block">
                Net Subtotal
              </span>
              <span className="font-extrabold text-gray-900">
                {inr(totalSubtotal)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-gray-400 uppercase font-bold block">
                GST ({gstRate}%)
              </span>
              <span className="text-gray-600">{inr(gstAmount)}</span>
            </div>
            <div className="text-right border-l border-gray-200 pl-4">
              <span className="text-[10px] text-indigo-600 uppercase font-extrabold block">
                Total Estimate
              </span>
              <span className="text-base font-black text-indigo-950">
                {inr(grandTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Quotation Dispatch Actions */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {quoteSelectedProducts.size > 0
                ? `${quoteSelectedProducts.size} item(s) selected for quote preview`
                : "No items selected (All ready items will be quoted)"}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={selectableRows.length === 0}
              onClick={() => {
                if (selectableRows.length === 0) return;
                onOpenPreviewQuote();
              }}
              className={`px-5 py-2.5 rounded-xl text-xs font-extrabold shadow-sm transition flex items-center gap-1.5 ${selectableRows.length === 0
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-yellow-500 hover:bg-yellow-600 text-white cursor-pointer"
                }`}
              title={
                selectableRows.length === 0
                  ? "All sub-jobs are on hold or dropped. Cannot share quotation."
                  : ""
              }
            >
              <span>📄</span>
              <span>
                {s.quoted
                  ? "Open or Reshare Quote"
                  : quoteSelectedProducts.size > 0
                    ? `Preview & Share Selected Quote (${quoteSelectedProducts.size})`
                    : "Preview & Share Quote"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Quotation Approval / Decision Status Section */}
      <div className="space-y-3">
        <QuoteDecisionStatusSection
          decisionMode={decisionMode}
          setDecisionMode={setDecisionMode}
          client={client}
          parentJobNo={parentJobNo}
          handleSaveCommunicationLog={handleSaveCommunicationLog}
          isQuoteApproved={isQuoteApproved}
          formattedApprovalDate={formattedApprovalDate}
          approvedVia={approvedVia}
          approvedNote={approvedNote}
          isQuoteShared={isQuoteShared}
          isQuoteRevision={isQuoteRevision}
          isQuoteRejected={isQuoteRejected}
          checkLiveQuoteStatus={checkLiveQuoteStatus}
          isCheckingStatus={isCheckingStatus}
          isJobBlocked={isJobBlocked}
        />

        {/* Next Stage: Order Progression (Step 4) / Cancelled State */}
        <OrderProgressionSection
          isQuoteApproved={isQuoteApproved}
          isJobBlocked={isJobBlocked}
          s={s}
          lostOpen={lostOpen}
          setLostOpen={setLostOpen}
          selectedLostReason={selectedLostReason}
          setSelectedLostReason={setSelectedLostReason}
          lostNotes={lostNotes}
          setLostNotes={setLostNotes}
          isSubmittingDecision={isSubmittingDecision}
          handleAttemptOrderMode={handleAttemptOrderMode}
          handleConfirmLost={handleConfirmLost}
        />
      </div>
    </div>
  );
};

export default SubJobQuotationCard;
