import React, { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import axios from "axios";
import { backendUrl } from "../../../utils/url/config";
import ImageLightbox from "../../common/ImageLightbox";
import PublicSampleConfirmationView from "./PublicSampleConfirmationView";
import PublicProofApprovalView from "./PublicProofApprovalView";
import { formatEnquiryNo, ENQUIRY_CONFIG } from "../utils/constants";
import { formatAddress } from "../utils/helpers";

const PublicQuotePreviewView = () => {
  const { jobId } = useParams();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const docSheetRef = useRef(null);

  // Client Interactive Quotation Feedback State
  const [quoteDecisionModal, setQuoteDecisionModal] = useState(null);
  const [quoteNotes, setQuoteNotes] = useState("");
  const [submittingQuoteFeedback, setSubmittingQuoteFeedback] = useState(false);
  const [quoteSuccessToast, setQuoteSuccessToast] = useState(null);
  const [quoteErrorToast, setQuoteErrorToast] = useState(null);

  const searchParams = new URLSearchParams(location.search);
  const encodedExpires = searchParams.get("exp") || "";
  const tabParam = searchParams.get("tab");
  const isSampleTabParam = tabParam === "sample";
  const isDeliveryTabParam = tabParam === "delivery";
  const isProofTabParam = tabParam === "proof";
  const [activeTab, setActiveTab] = useState(
    isProofTabParam
      ? "proof"
      : isSampleTabParam
      ? "sample"
      : isDeliveryTabParam
      ? "delivery"
      : "quote"
  );

  // 1. Expiry Check
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const encodedExpires = params.get("exp");
    const token = params.get("token");

    if (!encodedExpires && !token) {
      setExpired(true);
      setLoading(false);
      return;
    }

    if (encodedExpires) {
      try {
        const expiryTimestamp = parseInt(atob(encodedExpires), 10);
        if (isNaN(expiryTimestamp) || Date.now() > expiryTimestamp) {
          setExpired(true);
          setLoading(false);
          return;
        }
      } catch (e) {
        setExpired(true);
        setLoading(false);
        return;
      }
    } else if (token) {
      try {
        const base64 = token.replace(/-/g, "+").replace(/_/g, "/");
        const parsed = JSON.parse(atob(base64));
        if (parsed.exp && Date.now() > parsed.exp) {
          setExpired(true);
          setLoading(false);
          return;
        }
      } catch (e) {
        // Let backend validate token
      }
    }
  }, [location.search]);

  // 2. Fetch Quotation Data from Public API
  useEffect(() => {
    if (expired) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const queryStr = location.search ? location.search : "";
        const res = await axios.get(`${backendUrl}/enquiry-flow-integration/public/quote-view/${jobId}${queryStr}`);
        if (res.data?.success) {
          setData(res.data.data);
        } else {
          setError(res.data?.message || "Could not load quotation preview");
        }
      } catch (err) {
        console.error("Error loading quotation preview:", err);
        setError("Unable to load quotation. Please check the link or contact your coordinator.");
      } finally {
        setLoading(false);
      }
    };

    if (jobId) {
      fetchData();
    }
  }, [jobId, expired, location.search]);

  // 3. Security: Disable right-click
  useEffect(() => {
    const handler = (e) => e.preventDefault();
    document.addEventListener("contextmenu", handler);
    return () => document.removeEventListener("contextmenu", handler);
  }, []);

  // 4. Print / PDF Handler
  const handlePrint = () => {
    window.print();
  };

  // 5. Submit Client Quotation Decision
  const handleSubmitQuoteFeedback = async () => {
    if (!quoteDecisionModal) return;
    const { decision } = quoteDecisionModal;

    if (decision !== "approved" && !quoteNotes.trim()) {
      setQuoteErrorToast("Please enter remarks / instructions before submitting.");
      return;
    }

    try {
      setSubmittingQuoteFeedback(true);
      setQuoteErrorToast(null);

      const subjobsParam = searchParams.get("subjobs");
      const targetSubJobsParam = subjobsParam
        ? subjobsParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
        : null;

      const targetSubJobNos = (data?.sub_jobs || [])
        .filter((sj) => {
          if (sj.is_dropped || sj.is_on_hold) return false;
          if (targetSubJobsParam && targetSubJobsParam.length > 0) {
            const sjNo = (sj.sub_job_no || "").toUpperCase();
            return targetSubJobsParam.includes(sjNo) || targetSubJobsParam.some((t) => sjNo.endsWith(t));
          }
          return true;
        })
        .map((s) => s.sub_job_no);

      const queryParams = new URLSearchParams(location.search);
      const token = queryParams.get("token") || "";
      const sig = queryParams.get("sig") || "";

      const payload = {
        decision,
        notes: quoteNotes.trim(),
        subJobNos: targetSubJobNos,
        clientName: data?.contact?.name || data?.customer?.name || "Client",
        exp: encodedExpires,
        sig,
        token,
      };

      const res = await axios.post(
        `${backendUrl}/enquiry-flow-integration/public/quote-feedback/${jobId}${location.search || `?exp=${encodeURIComponent(encodedExpires)}`}`,
        payload
      );

      if (res.data?.success) {
        // Update local sub_jobs in data
        setData((prev) => {
          if (!prev) return prev;
          const updatedSjs = (prev.sub_jobs || []).map((sj) => ({
            ...sj,
            client_quote_decision: decision,
            client_quote_decision_at: new Date().toISOString(),
            client_quote_decision_notes: quoteNotes.trim(),
            client_quote_communication: "Direct Client Response",
          }));
          return {
            ...prev,
            sub_jobs: updatedSjs,
          };
        });

        const successText =
          decision === "approved"
            ? "✓ Quotation approved and order confirmed successfully!"
            : decision === "revision"
              ? "✓ Change request submitted to your Account Coordinator."
              : "✓ Quotation decline recorded.";

        setQuoteSuccessToast(successText);
        setQuoteDecisionModal(null);
        setTimeout(() => setQuoteSuccessToast(null), 8000);
      } else {
        setQuoteErrorToast(res.data?.message || "Failed to submit decision.");
      }
    } catch (err) {
      console.error("Error submitting quote feedback:", err);
      setQuoteErrorToast(
        err.response?.data?.message || "Failed to submit quotation decision. Please check your link or network."
      );
    } finally {
      setSubmittingQuoteFeedback(false);
    }
  };

  // 5c. Submit Client Sample Order & Rates Decision
  const handleSubmitSampleFeedback = async (decision, notes = "") => {
    try {
      setSubmittingQuoteFeedback(true);
      setQuoteErrorToast(null);
      const queryParams = new URLSearchParams(location.search);
      const token = queryParams.get("token") || "";
      const sig = queryParams.get("sig") || "";
      const res = await axios.post(
        `${backendUrl}/enquiry-flow-integration/public/sample-feedback/${jobId}${location.search || `?exp=${encodeURIComponent(encodedExpires)}`}`,
        {
          decision,
          notes,
          clientName: data?.contact?.name || data?.customer?.name || "Client",
          exp: encodedExpires,
          sig,
          token,
        }
      );
      if (res.data?.success) {
        setData((prev) => ({
          ...prev,
          wizard_state: {
            ...(prev?.wizard_state || {}),
            sampleConfirmed: decision === "approved",
            sampleRatesState: decision === "approved" ? "approved" : "revision",
            sampleDecision: {
              decision,
              notes,
              at: new Date().toISOString(),
              by: data?.contact?.name || data?.customer?.name || "Client",
            },
          },
        }));
        setQuoteSuccessToast(
          decision === "approved"
            ? "✓ Sample order & rates confirmed successfully!"
            : "✓ Alteration request submitted for sample order."
        );
        setQuoteDecisionModal(null);
        setTimeout(() => setQuoteSuccessToast(null), 8000);
      } else {
        setQuoteErrorToast(res.data?.message || "Failed to submit sample decision.");
      }
    } catch (err) {
      console.error("Error submitting sample feedback:", err);
      setQuoteErrorToast(err.response?.data?.message || "Failed to submit sample decision.");
    } finally {
      setSubmittingQuoteFeedback(false);
    }
  };

  // 5b. Submit Client Delivery Charges Decision
  const handleSubmitDeliveryFeedback = async (decision, notes = "") => {
    try {
      setSubmittingQuoteFeedback(true);
      setQuoteErrorToast(null);
      const queryParams = new URLSearchParams(location.search);
      const token = queryParams.get("token") || "";
      const sig = queryParams.get("sig") || "";
      const res = await axios.post(
        `${backendUrl}/enquiry-flow-integration/public/delivery-feedback/${jobId}${location.search || `?exp=${encodeURIComponent(encodedExpires)}`}`,
        {
          decision,
          notes,
          clientName: data?.contact?.name || data?.customer?.name || "Client",
          exp: encodedExpires,
          sig,
          token,
        }
      );
      if (res.data?.success) {
        setData((prev) => ({
          ...prev,
          wizard_state: {
            ...(prev?.wizard_state || {}),
            sampleChargesState: decision === "approved" ? "approved" : "simulated",
            sampleChargesDecision: {
              decision,
              notes,
              at: new Date().toISOString(),
              by: data?.contact?.name || data?.customer?.name || "Client",
            },
          },
        }));
        setQuoteSuccessToast(
          decision === "approved"
            ? "✓ Delivery & courier charges confirmed successfully!"
            : "✓ Change request submitted for delivery charges."
        );
        setQuoteDecisionModal(null);
        setTimeout(() => setQuoteSuccessToast(null), 8000);
      } else {
        setQuoteErrorToast(res.data?.message || "Failed to submit decision.");
      }
    } catch (err) {
      console.error("Error submitting delivery feedback:", err);
      setQuoteErrorToast(err.response?.data?.message || "Failed to submit decision.");
    } finally {
      setSubmittingQuoteFeedback(false);
    }
  };

  // Expired Screen
  if (expired) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto text-3xl shadow-inner">
            ⏳
          </div>
          <h2 className="text-xl font-bold text-slate-900">This Quotation Link Has Expired</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            For pricing accuracy and security, quotation review links are valid for a limited period.
            Please reach out to your Account Coordinator at <strong>RD Custom Awards Pvt. Ltd.</strong> to request a fresh link.
          </p>
          <div className="pt-4 border-t border-slate-100 text-xs text-slate-400">
            RD Custom Awards Pvt. Ltd. · Mumbai
          </div>
        </div>
      </div>
    );
  }

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-semibold text-slate-600">Loading quotation details...</p>
        </div>
      </div>
    );
  }

  // Error Screen
  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-red-100 rounded-2xl shadow-xl p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto text-3xl">
            ⚠️
          </div>
          <h2 className="text-xl font-bold text-slate-900">Quotation Not Found</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            {error || "The requested quotation preview is unavailable."}
          </p>
        </div>
      </div>
    );
  }

  const { customer, contact, coordinator_name, sub_jobs, uploadedDesigns, trophyGroups, createdAt } = data;

  const parentJobNo = data.enquiry_no || (data.seq ? formatEnquiryNo(data.seq) : ENQUIRY_CONFIG.DEFAULT_ENQUIRY_NO);

  const subjobsParam = searchParams.get("subjobs");
  const targetSubJobsParam = subjobsParam
    ? subjobsParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
    : null;

  const activeSubJobs = (sub_jobs || []).filter((sj) => {
    if (sj.is_dropped || sj.is_on_hold) return false;
    if (targetSubJobsParam && targetSubJobsParam.length > 0) {
      const sjNo = (sj.sub_job_no || "").toUpperCase();
      return targetSubJobsParam.includes(sjNo) || targetSubJobsParam.some((t) => sjNo.endsWith(t));
    }
    return true;
  });

  const subJobCode = activeSubJobs.length > 0
    ? activeSubJobs.map((sj) => sj.sub_job_no).join(", ")
    : (sub_jobs && sub_jobs[0] ? sub_jobs[0].sub_job_no : `${parentJobNo}-A1`);

  const validUntil = new Date(createdAt || Date.now());
  validUntil.setDate(validUntil.getDate() + 15);
  const validUntilStr = validUntil.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  const formattedDate = new Date(createdAt || Date.now()).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const allSjs = Array.isArray(sub_jobs) ? sub_jobs : [];
  const anyQuoteApproved =
    activeSubJobs.some((s) => s.client_quote_decision === "approved") ||
    allSjs.some((s) => !s.is_dropped && s.client_quote_decision === "approved") ||
    data?.wizard_state?.quoteApproved === true ||
    data?.wizard_state?.client_quote_decision === "approved" ||
    data?.client_quote_decision === "approved" ||
    data?.quoteApproved === true;

  const anyQuoteRevision =
    activeSubJobs.some((s) => s.client_quote_decision === "revision") ||
    allSjs.some((s) => !s.is_dropped && s.client_quote_decision === "revision") ||
    data?.client_quote_decision === "revision";

  const anyQuoteRejected =
    activeSubJobs.some((s) => s.client_quote_decision === "rejected") ||
    allSjs.some((s) => !s.is_dropped && s.client_quote_decision === "rejected") ||
    data?.client_quote_decision === "rejected";

  const hasClientResponded = anyQuoteApproved || anyQuoteRevision || anyQuoteRejected;
  const existingQuoteNote =
    activeSubJobs.find((s) => s.client_quote_decision_notes)?.client_quote_decision_notes ||
    allSjs.find((s) => s.client_quote_decision_notes)?.client_quote_decision_notes ||
    data?.wizard_state?.decision?.notes ||
    data?.client_quote_decision_notes ||
    "";
  const decisionDate =
    activeSubJobs.find((s) => s.client_quote_decision_at)?.client_quote_decision_at ||
    allSjs.find((s) => s.client_quote_decision_at)?.client_quote_decision_at ||
    data?.wizard_state?.decision?.at ||
    data?.client_quote_decision_at ||
    null;

  const carrierName = data?.wizard_state?.sampleCarrier || data?.delivery_details?.delivery_mode || "Tempo";
  const isClientPayer = Boolean(
    data?.wizard_state?.sampleFreight === "Client pays freight" ||
    data?.delivery_details?.who_pays === "Client"
  );
  const deliveryAmount = Number(
    data?.wizard_state?.sampleChargesAmount ||
    data?.delivery_details?.delivery_cost ||
    0
  );
  const deliveryGst = Math.round(deliveryAmount * 0.18);
  const deliveryTotal = deliveryAmount + deliveryGst;
  const isDeliveryApproved = Boolean(
    data?.wizard_state?.sampleChargesState === "approved" ||
    data?.wizard_state?.sampleChargesDecision?.decision === "approved"
  );
  const isDeliveryRevision = Boolean(
    data?.wizard_state?.sampleChargesDecision?.decision === "revision"
  );
  const deliveryNote = data?.wizard_state?.sampleChargesDecision?.notes || "";
  const rawDeliveryAddress = data?.wizard_state?.sampleShipTo || data?.delivery_details?.shipping_address || customer?.billing || "Client Address";
  const deliveryAddressStr = formatAddress(rawDeliveryAddress) || "Client Address";
  const hasDeliveryDetails = deliveryAmount > 0 || isDeliveryTabParam || data?.wizard_state?.sampleCarrier || data?.delivery_details?.delivery_mode;
  const hasSampleDetails = Boolean(
    isSampleTabParam ||
    activeTab === "sample" ||
    (data?.wizard_state?.sampleItems && data.wizard_state.sampleItems.length > 0) ||
    data?.wizard_state?.sampleRatesState ||
    data?.wizard_state?.sampleRate ||
    (data?.sub_jobs && data.sub_jobs.some((s) => s.sample_rate > 0))
  );

  // Resolve enquiry-wide 1-time artwork charge (default ₹1,500)
  const enquiryArtworkCharge = Number(
    data?.financials?.artwork_charge !== undefined
      ? data.financials.artwork_charge
      : data?.wizard_state?.costing?.artwork !== undefined
        ? data.wizard_state.costing.artwork
        : 1500
  );

  const itemsSubtotal = activeSubJobs.reduce((sum, p) => {
    const qty = Number(p.quantity || 1);
    const rate = Number(p.unit_rate || p.target_rate || 0);
    return sum + (qty * rate);
  }, 0);

  const totalQuoteAmount = itemsSubtotal + enquiryArtworkCharge;

  return (
    <div className="min-h-screen bg-slate-100 py-6 sm:py-12 px-3 sm:px-6">
      {/* Toast Notification */}
      {quoteSuccessToast && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-700 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce">
          <span className="text-xl">✓</span>
          <span className="text-xs font-bold">{quoteSuccessToast}</span>
          <button
            onClick={() => setQuoteSuccessToast(null)}
            className="text-white/80 hover:text-white font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Bar for client */}
      {!(isProofTabParam || activeTab === "proof") ? (
        <div className="w-full max-w-4xl mx-auto flex items-center justify-between mb-4 print:hidden">
          <div className="flex items-center gap-2">
            {hasSampleDetails && (
              <button
                type="button"
                onClick={() => setActiveTab("sample")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${activeTab === "sample"
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
                  }`}
              >
                <span>🧪</span>
                <span>Sample Confirmation</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab("quote")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${activeTab === "quote"
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
                }`}
            >
              Quotation Preview
            </button>
            {hasDeliveryDetails && (
              <button
                type="button"
                onClick={() => setActiveTab("delivery")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${activeTab === "delivery"
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
                  }`}
              >
                <span>🚚</span>
                <span>Delivery & Courier Charges</span>
              </button>
            )}
          </div>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-xl text-xs font-bold hover:bg-gray-50 shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <span>🖨️</span>
            <span>Print / Save as PDF</span>
          </button>
        </div>
      ) : (
        <div className="w-full max-w-4xl mx-auto flex items-center justify-end mb-4 print:hidden">
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-xl text-xs font-bold hover:bg-gray-50 shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <span>🖨️</span>
            <span>Print / Save as PDF</span>
          </button>
        </div>
      )}

      {/* Document Sheet */}
      {activeTab === "proof" ? (
        <PublicProofApprovalView
          jobId={jobId}
          queryParams={location.search}
          data={data}
          parentJobNo={parentJobNo}
          subjobsParam={subjobsParam}
          onOpenImage={(url) => setPreviewImage(url)}
        />
      ) : activeTab === "sample" ? (
        <PublicSampleConfirmationView
          data={data}
          parentJobNo={parentJobNo}
          subjobsParam={subjobsParam}
          onSubmitFeedback={handleSubmitSampleFeedback}
          submitting={submittingQuoteFeedback}
          docSheetRef={docSheetRef}
          onOpenImage={(url) => setPreviewImage(url)}
        />
      ) : activeTab === "delivery" ? (
        <div
          ref={docSheetRef}
          className="w-full max-w-4xl mx-auto bg-white shadow-2xl p-6 sm:p-12 rounded-2xl border border-gray-200 print:shadow-none print:border-none print:p-0"
        >
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-indigo-600 pb-5 mb-8">
            <div>
              <div className="mb-3">
                <img
                  src="https://rdcustomawards.com/cdn/shop/files/logo.svg?v=1700546283&width=90"
                  alt="RD Custom Awards Logo"
                  className="h-10 sm:h-12 w-auto object-contain"
                />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">RD Custom Awards Pvt. Ltd.</h1>
              <p className="text-xs text-gray-500 mt-1 font-semibold">Delivery & Courier Charges Summary</p>
            </div>
            <div className="text-right">
              <h2 className="text-lg sm:text-xl font-black text-indigo-900 tracking-tight">{subJobCode}</h2>
              <p className="text-xs font-semibold text-gray-500 mt-0.5">Job: {parentJobNo}</p>
              <p className="text-xs text-gray-400 mt-0.5">{formattedDate}</p>
            </div>
          </div>

          {/* Bill to / Deliver to */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-12 text-xs mb-8 pb-6 border-b border-gray-100">
            <div className="grid grid-cols-[80px_1fr] items-start">
              <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Bill to</span>
              <div className="text-gray-900 font-medium leading-relaxed">
                <span className="font-bold text-gray-950 block text-sm">{(data?.wizard_state?.billTo?.on && data.wizard_state.billTo.name) ? data.wizard_state.billTo.name : (customer?.name || "Client Name")}</span>
                {formatAddress((data?.wizard_state?.billTo?.on && data.wizard_state.billTo.address) ? data.wizard_state.billTo.address : (customer?.billing || customer?.address)) ? (
                  <span className="whitespace-pre-line text-gray-600 block mt-0.5">{formatAddress((data?.wizard_state?.billTo?.on && data.wizard_state.billTo.address) ? data.wizard_state.billTo.address : (customer?.billing || customer?.address))}</span>
                ) : null}
                {((data?.wizard_state?.billTo?.on && data.wizard_state.billTo.gstin) || customer?.gstin) && (
                  <span className="text-gray-500 block mt-1">GSTIN: {(data?.wizard_state?.billTo?.on && data.wizard_state.billTo.gstin) ? data.wizard_state.billTo.gstin : (typeof customer.gstin === "object" ? (customer.gstin?.gst_no || "") : customer.gstin)}</span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-[80px_1fr] items-start">
              <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Deliver to</span>
              <div className="text-gray-900 font-medium leading-relaxed">
                <span className="font-bold text-gray-950 block text-sm">{deliveryAddressStr}</span>
                <span className="text-gray-500 block mt-1">Attention: {contact?.name || "Client Contact"} {contact?.mobile ? `(${contact.mobile})` : ""}</span>
              </div>
            </div>
          </div>

          {/* Delivery Charges Table */}
          <h3 className="text-sm font-black text-gray-900 mb-4 uppercase tracking-wider">Courier & Dispatch Summary</h3>
          <div className="border border-gray-200 rounded-xl overflow-hidden mb-8">
            <table className="w-full text-xs text-left">
              <tbody className="divide-y divide-gray-100">
                <tr className="bg-gray-50/50">
                  <td className="py-3.5 px-4 font-bold text-gray-500 w-44">Carrier Mode</td>
                  <td className="py-3.5 px-4 font-extrabold text-gray-900 text-sm">
                    {carrierName} · {isClientPayer ? "Client pays (added to invoice)" : "RD pays (borne by RD)"}
                  </td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-bold text-gray-500">Destination</td>
                  <td className="py-3.5 px-4 text-gray-800">{deliveryAddressStr}</td>
                </tr>
                <tr className="bg-gray-50/50">
                  <td className="py-3.5 px-4 font-bold text-gray-500">Courier / Freight Rate</td>
                  <td className="py-3.5 px-4 text-gray-900 font-semibold">
                    ₹{deliveryAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-bold text-gray-500">Applicable GST (18%)</td>
                  <td className="py-3.5 px-4 text-gray-900 font-semibold">
                    ₹{deliveryGst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr className="bg-indigo-50/60 font-bold border-t-2 border-indigo-200">
                  <td className="py-4 px-4 text-indigo-950 font-black text-sm">Total Delivery Charges</td>
                  <td className="py-4 px-4 text-indigo-950 font-black text-base">
                    ₹{deliveryTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Delivery Status Banner */}
          {isDeliveryApproved && (
            <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950 flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">✓</span>
                <div>
                  <span className="block text-sm font-black text-emerald-950">Courier & Delivery Charges Approved</span>
                  <span className="text-xs text-emerald-800">Client approval confirmed. Ready for dispatch.</span>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-200 text-emerald-900 text-xs font-black uppercase">Approved</span>
            </div>
          )}

          {isDeliveryRevision && (
            <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 mb-6">
              <div className="flex items-center gap-2 font-bold text-xs text-amber-900 mb-1">
                <span className="text-base">⚠️</span>
                <span>Change Requested on Delivery Charges:</span>
              </div>
              <p className="text-xs text-amber-900 font-medium italic">
                "{deliveryNote || "Client requested changes to courier mode or charges."}"
              </p>
            </div>
          )}

          {/* Client Action Buttons */}
          {!isDeliveryApproved && (
            <div className="p-5 sm:p-6 bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 border-2 border-indigo-200 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden mb-8">
              <div className="space-y-1">
                <h4 className="text-sm font-black uppercase tracking-wider text-slate-900">
                  Approve Courier / Delivery Charges
                </h4>
                <p className="text-xs text-slate-600">
                  Confirm to authorize courier dispatch with {carrierName}.
                </p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  disabled={submittingQuoteFeedback}
                  onClick={() => handleSubmitDeliveryFeedback("approved")}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span>✓</span>
                  <span>{submittingQuoteFeedback ? "Saving..." : "Approve Courier Rate"}</span>
                </button>
                <button
                  type="button"
                  disabled={submittingQuoteFeedback}
                  onClick={() => {
                    const reason = window.prompt("Enter requested alteration for delivery charges:");
                    if (reason && reason.trim()) {
                      handleSubmitDeliveryFeedback("revision", reason.trim());
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span>✏️</span>
                  <span>Request Change</span>
                </button>
              </div>
            </div>
          )}

          {/* Signatures */}
          <div className="pt-6 border-t border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              <div className="border-t border-gray-400 pt-2 text-[10px] text-gray-500 font-semibold">
                For RD Custom Awards Pvt. Ltd.
              </div>
              <div className="border-t border-gray-400 pt-2 text-[10px] text-gray-500 font-semibold">
                {coordinator_name || "Account Coordinator"}, Dispatch & Servicing
              </div>
              <div className="border-t border-gray-400 pt-2 text-[10px] text-gray-500 font-semibold">
                Client Acceptance & Date
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          ref={docSheetRef}
          className="w-full max-w-4xl mx-auto bg-white shadow-2xl p-6 sm:p-12 rounded-2xl border border-gray-200 print:shadow-none print:border-none print:p-0"
        >
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-indigo-600 pb-5 mb-8">
            <div>
              <div className="mb-3">
                <img
                  src="https://rdcustomawards.com/cdn/shop/files/logo.svg?v=1700546283&width=90"
                  alt="RD Custom Awards Logo"
                  className="h-10 sm:h-12 w-auto object-contain"
                />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">RD Custom Awards Pvt. Ltd.</h1>
              <p className="text-xs text-gray-500 mt-1 font-semibold">Commercial Quotation</p>
            </div>
            <div className="text-right">
              <h2 className="text-lg sm:text-xl font-black text-indigo-900 tracking-tight">{subJobCode}</h2>
              <p className="text-xs font-semibold text-gray-500 mt-0.5">Job: {parentJobNo}</p>
              <p className="text-xs text-gray-400 mt-0.5">{formattedDate}</p>
            </div>
          </div>

          {/* To / Attention Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-12 text-xs mb-8 pb-6 border-b border-gray-100">
            <div className="grid grid-cols-[80px_1fr] items-start">
              <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Quotation to</span>
              <div className="text-gray-900 font-medium leading-relaxed">
                <span className="font-bold text-gray-950 block text-sm">{(data?.wizard_state?.billTo?.on && data.wizard_state.billTo.name) ? data.wizard_state.billTo.name : (customer?.name || "Client Name")}</span>
                {formatAddress((data?.wizard_state?.billTo?.on && data.wizard_state.billTo.address) ? data.wizard_state.billTo.address : (customer?.billing || customer?.address)) ? (
                  <span className="whitespace-pre-line text-gray-600 block mt-0.5">
                    {formatAddress((data?.wizard_state?.billTo?.on && data.wizard_state.billTo.address) ? data.wizard_state.billTo.address : (customer?.billing || customer?.address))}
                  </span>
                ) : null}
                {((data?.wizard_state?.billTo?.on && data.wizard_state.billTo.gstin) || customer?.gstin) ? (
                  <span className="text-gray-500 block mt-1">
                    GSTIN: {(data?.wizard_state?.billTo?.on && data.wizard_state.billTo.gstin) ? data.wizard_state.billTo.gstin : (typeof customer.gstin === "object" ? (customer.gstin?.gst_no || "") : customer.gstin)}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="grid grid-cols-[80px_1fr] items-start">
              <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Attention</span>
              <div className="text-gray-900 font-medium leading-relaxed">
                <span className="font-bold text-gray-950 block text-sm">{contact?.name || "Client Contact"}</span>
                {contact?.email && <span className="text-gray-600 block mt-0.5">{contact.email}</span>}
                {contact?.mobile && <span className="text-gray-600 block">{contact.mobile}</span>}
                <div className="mt-2 text-[11px] text-gray-500">
                  <span className="font-semibold text-gray-700">Valid until:</span> {validUntilStr}
                </div>
              </div>
            </div>
          </div>

          {/* Quotation Items Table */}
          <h3 className="text-sm font-black text-gray-900 mb-4 uppercase tracking-wider">Quotation Details</h3>
          <div className="border-t border-gray-200 overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 font-semibold bg-gray-50/50">
                  <th className="py-3 px-2 font-bold">#</th>
                  <th className="py-3 px-3 font-bold">Item Description</th>
                  <th className="py-3 px-3 text-right font-bold">Qty</th>
                  <th className="py-3 px-3 text-right font-bold">Unit Rate</th>
                  <th className="py-3 px-3 text-right font-bold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeSubJobs.map((p, displayIndex) => {
                  const qty = Number(p.quantity || 1);
                  const rate = Number(p.unit_rate || p.target_rate || 0);
                  const lineTotal = qty * rate;

                  // Attempt to find product design image from uploadedDesigns using common design group
                  const matchGroup = String(p.sub_job_no || "").match(/[-_]([A-Za-z])\d*$/);
                  const gChar = p.design_group || (matchGroup ? matchGroup[1].toUpperCase() : "A");
                  const gIdx = gChar ? gChar.charCodeAt(0) - 65 : 0;
                  const optIdx = p.approved_design_option !== undefined ? p.approved_design_option : 0;
                  const imgUrl = (uploadedDesigns && (
                    uploadedDesigns[`${gIdx}-${optIdx}`] ||
                    uploadedDesigns[`${gIdx}-0`] ||
                    uploadedDesigns[`${displayIndex}-0`] ||
                    Object.values(uploadedDesigns)[0]
                  )) || null;

                  return (
                    <tr key={p.sub_job_no || displayIndex} className="hover:bg-gray-50/40 transition">
                      <td className="py-4 px-2 align-top text-gray-400 font-medium">{displayIndex + 1}</td>
                      <td className="py-4 px-3 pr-4 align-top">
                        <div className="flex items-start gap-3">
                          {imgUrl ? (
                            <div
                              onClick={() => setPreviewImage(imgUrl)}
                              className="w-14 h-14 rounded-lg border border-gray-200 overflow-hidden bg-white shrink-0 p-0.5 shadow-2xs cursor-pointer hover:border-indigo-500 transition"
                              title="Click to view full image"
                            >
                              <img
                                src={imgUrl}
                                alt={p.product_name}
                                className="w-full h-full object-cover rounded-md"
                              />
                            </div>
                          ) : null}
                          <div className="min-w-0">
                            <div className="font-bold text-gray-900 text-sm mb-0.5">
                              {p.sub_job_no} {p.theme || p.product_name || "Custom Trophy"}
                            </div>
                            <div className="text-[11px] text-gray-500 leading-tight">
                              {p.spec_line || `${p.theme || 'Trophy'} · ${p.size || 8} in`}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-3 text-right align-top whitespace-nowrap font-medium text-gray-700">
                        {qty} pcs
                      </td>
                      <td className="py-4 px-3 text-right align-top whitespace-nowrap font-semibold text-gray-900">
                        ₹{rate.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/pc
                      </td>
                      <td className="py-4 px-3 text-right align-top font-bold text-indigo-950 whitespace-nowrap">
                        ₹{lineTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}

                {/* Dedicated 1-Time Setup & Artwork Line Item at End of Quotation List */}
                {enquiryArtworkCharge > 0 && (
                  <tr className="bg-indigo-50/20 hover:bg-indigo-50/40 transition">
                    <td className="py-4 px-2 align-top text-gray-400 font-medium">{activeSubJobs.length + 1}</td>
                    <td className="py-4 px-3 pr-4 align-top">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-indigo-900 text-sm">1-Time Setup & Artwork Fee</span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-indigo-100 text-indigo-700">1-TIME FEE</span>
                      </div>
                      <div className="text-[11px] text-gray-500 leading-tight mt-0.5">
                        Enquiry-level artwork processing & machine setup (1-time fee across all sub-jobs)
                      </div>
                    </td>
                    <td className="py-4 px-3 text-right align-top whitespace-nowrap font-medium text-gray-700">
                      1 Lot
                    </td>
                    <td className="py-4 px-3 text-right align-top whitespace-nowrap font-semibold text-gray-900">
                      ₹{enquiryArtworkCharge.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-3 text-right align-top font-bold text-indigo-950 whitespace-nowrap">
                      ₹{enquiryArtworkCharge.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50/70 font-bold">
                  <td colSpan="4" className="py-3 px-3 text-right text-gray-700 text-xs uppercase tracking-wider">
                    Total Estimate (Excl. GST):
                  </td>
                  <td className="py-3 px-3 text-right text-sm font-black text-indigo-900 whitespace-nowrap">
                    ₹{totalQuoteAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Sample Rates / Extras */}
          <div className="mt-6 border-t border-gray-100 pt-4">
            <div className="grid grid-cols-[120px_1fr] text-xs gap-4 mb-2">
              <span className="text-gray-500 font-semibold">Sample Rates:</span>
              <div className="text-gray-700">
                {activeSubJobs.map((p) => {
                  const matchedSample = (data?.wizard_state?.sampleItems || []).find((it) => it.subJobNo === p.sub_job_no);
                  const uRate = Number(p.unit_rate || p.target_rate || 0);
                  const sampleRate = Number(matchedSample?.rate || p.sample_rate || (uRate > 0 ? uRate + 200 : (data?.wizard_state?.sampleRate || 0)));
                  const rateText = sampleRate > 0
                    ? `₹${sampleRate.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/pc`
                    : (data?.wizard_state?.charge === "foc" ? "Free of cost" : "₹0.00/pc");
                  return `${p.sub_job_no}: ${rateText}`;
                }).join(" · ")}
              </div>
            </div>
            <div className="grid grid-cols-[120px_1fr] text-xs gap-4">
              <span className="text-gray-500 font-semibold">Setup / Artwork:</span>
              <div className="text-gray-700">
                ₹{enquiryArtworkCharge.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} one-time (waived upon bulk order confirmation)
              </div>
            </div>
          </div>

          {/* Commercial Terms */}
          <div className="mt-6 space-y-3">
            <div className="p-4 border border-gray-200 rounded-xl text-xs text-gray-700 bg-gray-50/60 leading-relaxed">
              <span className="font-bold text-gray-900 block mb-1">Commercial Terms & Acceptance:</span>
              • Amounts are before GST (applicable GST extra).<br />
              • Payment Terms: 100% advance upon order confirmation.<br />
              • Ref: {parentJobNo}. Please reply with your approval or any alterations required.
            </div>
          </div>

          {/* Quotation Status Banners */}
          {anyQuoteApproved && (
            <div className="mt-6 p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">✓</span>
                <div>
                  <span className="block text-sm font-black text-emerald-950">Quotation Accepted & Confirmed</span>
                  <span className="text-xs text-emerald-800">
                    {decisionDate ? `Order acceptance recorded on ${new Date(decisionDate).toLocaleDateString("en-GB")}` : "Order acceptance recorded."}
                    {existingQuoteNote ? ` · "${existingQuoteNote}"` : ""}
                  </span>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-200 text-emerald-900 text-xs font-black uppercase">Confirmed</span>
            </div>
          )}

          {anyQuoteRevision && (
            <div className="mt-6 p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950">
              <div className="flex items-center gap-2 font-bold text-xs text-amber-900 mb-1">
                <span className="text-base">⚠️</span>
                <span>Changes Requested on Quotation:</span>
              </div>
              <p className="text-xs text-amber-900 font-medium italic">
                "{existingQuoteNote || "Client requested pricing or specification alterations."}"
              </p>
            </div>
          )}

          {anyQuoteRejected && (
            <div className="mt-6 p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-950">
              <div className="flex items-center gap-2 font-bold text-xs text-rose-900 mb-1">
                <span className="text-base">✕</span>
                <span>Quotation Declined:</span>
              </div>
              <p className="text-xs text-rose-900 font-medium italic">
                "{existingQuoteNote || "Quotation was declined by client."}"
              </p>
            </div>
          )}

          {/* Client Decision Action Toolbar - Only visible before response is submitted */}
          {!hasClientResponded && (
            <div className="mt-6 p-5 sm:p-6 bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 border-2 border-indigo-200/90 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <h4 className="text-sm font-black uppercase tracking-wider text-slate-900">
                    Client Quotation Acceptance
                  </h4>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-extrabold uppercase tracking-wide border border-indigo-200">
                    Action Required
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Confirm your decision directly. Our servicing team will be notified immediately.
                </p>
              </div>
              <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setQuoteDecisionModal({ decision: "approved" });
                    setQuoteNotes("");
                    setQuoteErrorToast(null);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm hover:shadow transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span>✓</span>
                  <span>Accept Quotation</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQuoteDecisionModal({ decision: "revision" });
                    setQuoteNotes("");
                    setQuoteErrorToast(null);
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm hover:shadow transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span>✏️</span>
                  <span>Request Changes</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQuoteDecisionModal({ decision: "rejected" });
                    setQuoteNotes("");
                    setQuoteErrorToast(null);
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 font-bold text-xs border border-rose-200 hover:border-rose-300 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <span>✕</span>
                  <span>Decline</span>
                </button>
              </div>
            </div>
          )}

          {/* Signatures & Seal */}
          <div className="mt-12 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              <div>
                <div className="border-t border-gray-400 pt-2 text-[10px] text-gray-500 font-semibold">
                  For RD Custom Awards Pvt. Ltd.
                </div>
              </div>
              <div>
                <div className="border-t border-gray-400 pt-2 text-[10px] text-gray-500 font-semibold">
                  {coordinator_name || "Account Coordinator"}, Client Servicing
                </div>
              </div>
              <div>
                <div className="border-t border-gray-400 pt-2 text-[10px] text-gray-500 font-semibold">
                  Client Acceptance & Date
                </div>
              </div>
            </div>

            <div className="text-center text-[10px] text-gray-400 mt-8 font-medium">
              {subJobCode} · RD Custom Awards Pvt. Ltd. · Mumbai, India
            </div>
          </div>
        </div>
      )}

      {/* Quotation Decision Confirmation Modal */}
      {quoteDecisionModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 print:hidden"
          onClick={() => !submittingQuoteFeedback && setQuoteDecisionModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden p-6 space-y-4 animate-in fade-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">
                  {quoteDecisionModal.decision === "approved" ? "✓" : quoteDecisionModal.decision === "revision" ? "✏️" : "✕"}
                </span>
                <div>
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide">
                    {quoteDecisionModal.decision === "approved"
                      ? "Confirm Quotation Acceptance"
                      : quoteDecisionModal.decision === "revision"
                        ? "Request Quotation Revisions"
                        : "Decline Quotation"}
                  </h3>
                  <p className="text-xs text-indigo-700 font-semibold mt-0.5">
                    Job: {parentJobNo} · {subJobCode}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuoteDecisionModal(null)}
                disabled={submittingQuoteFeedback}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center font-bold text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Error Message */}
            {quoteErrorToast && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                {quoteErrorToast}
              </div>
            )}

            {/* Notes / Instructions */}
            <div className="space-y-1.5 text-xs text-gray-700">
              <label className="font-bold block">
                {quoteDecisionModal.decision === "approved"
                  ? "Optional Order / PO Notes:"
                  : quoteDecisionModal.decision === "revision"
                    ? "Describe the required changes or alterations (Required):"
                    : "Reason for declining (Required):"}
              </label>
              <textarea
                rows={3}
                value={quoteNotes}
                onChange={(e) => setQuoteNotes(e.target.value)}
                placeholder={
                  quoteDecisionModal.decision === "approved"
                    ? "e.g. Quotation accepted! PO # PO-2026-091 attached, please initiate production sample."
                    : quoteDecisionModal.decision === "revision"
                      ? "e.g. Please revise rate based on revised quantity of 100 pcs instead of 50 pcs..."
                      : "e.g. Event postponed / budget constraint."
                }
                className="w-full p-3 rounded-xl border border-gray-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 text-xs text-gray-900 resize-none font-sans"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setQuoteDecisionModal(null)}
                disabled={submittingQuoteFeedback}
                className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitQuoteFeedback}
                disabled={submittingQuoteFeedback}
                className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md transition flex items-center gap-1.5 cursor-pointer ${quoteDecisionModal.decision === "approved"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : quoteDecisionModal.decision === "revision"
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-rose-600 hover:bg-rose-700"
                  } ${submittingQuoteFeedback ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                {submittingQuoteFeedback ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>
                    {quoteDecisionModal.decision === "approved"
                      ? "Confirm & Accept"
                      : quoteDecisionModal.decision === "revision"
                        ? "Submit Revision Request"
                        : "Confirm Decline"}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox for zooming design/product images */}
      {previewImage && (
        <ImageLightbox
          src={previewImage}
          fileName="Quotation Product Image"
          onClose={() => setPreviewImage(null)}
        />
      )}
    </div>
  );
};

export default PublicQuotePreviewView;

