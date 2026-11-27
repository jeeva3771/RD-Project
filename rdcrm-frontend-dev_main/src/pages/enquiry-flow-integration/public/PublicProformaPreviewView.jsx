import React, { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import axios from "axios";
import { backendUrl } from "../../../utils/url/config";
import ImageLightbox from "../../common/ImageLightbox";
import { formatEnquiryNo, ENQUIRY_CONFIG } from "../utils/constants";
import { formatAddress } from "../utils/helpers";

const PublicProformaPreviewView = () => {
  const { jobId } = useParams();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [piGstRate, setPiGstRate] = useState(18);
  const docSheetRef = useRef(null);

  // Client Interactive Proforma Feedback State
  const [decisionModal, setDecisionModal] = useState(null);
  const [decisionNotes, setDecisionNotes] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [successToast, setSuccessToast] = useState(null);
  const [errorToast, setErrorToast] = useState(null);

  const searchParams = new URLSearchParams(location.search);
  const encodedExpires = searchParams.get("exp") || "";

  // 1. Expiry Check
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const expParam = params.get("exp");
    const token = params.get("token");

    if (!expParam && !token) {
      setExpired(true);
      setLoading(false);
      return;
    }

    if (expParam) {
      try {
        const expiryTimestamp = parseInt(atob(expParam), 10);
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

  // 2. Fetch Proforma & Quotation Data from Public API
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
          setError(res.data?.message || "Could not load proforma invoice preview");
        }
      } catch (err) {
        console.error("Error loading proforma preview:", err);
        setError("Unable to load proforma invoice. Please check the link or contact your coordinator.");
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

  // 5. Submit Client Proforma Decision
  const handleSubmitFeedback = async () => {
    if (!decisionModal) return;
    const { decision } = decisionModal;

    if (decision !== "approved" && !decisionNotes.trim()) {
      setErrorToast("Please enter remarks / instructions before submitting.");
      return;
    }

    try {
      setSubmittingFeedback(true);
      setErrorToast(null);

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
        notes: decisionNotes.trim(),
        subJobNos: targetSubJobNos,
        clientName: data?.contact?.name || data?.customer?.name || "Client",
        exp: encodedExpires,
        sig,
        token,
      };

      const res = await axios.post(
        `${backendUrl}/enquiry-flow-integration/public/proforma-feedback/${jobId}${location.search || `?exp=${encodeURIComponent(encodedExpires)}`}`,
        payload
      );

      if (res.data?.success) {
        const clientNameStr = data?.contact?.name || data?.customer?.name || "Client";
        const nowIso = new Date().toISOString();
        setData((prev) => {
          if (!prev) return prev;
          const updatedWs = {
            ...(prev.wizard_state || {}),
            pi: {
              ...(prev.wizard_state?.pi || {}),
              client_decision: {
                decision,
                notes: decisionNotes.trim(),
                at: nowIso,
                by: clientNameStr,
              },
            },
            ...(decision === "approved"
              ? {
                  costOk: {
                    approval_type: "client_direct",
                    method: "client_link",
                    channel: "Client Link (Direct)",
                    date: nowIso.split("T")[0],
                    time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
                    whoConfirmed: clientNameStr,
                    notes: decisionNotes.trim() || "Approved via online Proforma link",
                    shared_to: clientNameStr,
                    shared_to_phone: data?.contact?.mobile || data?.contact?.phone || data?.customer?.mobile || "",
                    shared_to_email: data?.contact?.email || data?.customer?.email || "",
                    shared_by: prev.wizard_state?.pi?.sent_by || prev.wizard_state?.coordinator || "Client Servicing",
                    shared_channel: prev.wizard_state?.pi?.sent || "WhatsApp",
                    shared_at: prev.wizard_state?.pi?.sent_at || null,
                  },
                  piApproved: true,
                  clientApproved: true,
                }
              : decision === "revision"
              ? {
                  piRevise: {
                    requested_at: nowIso,
                    notes: decisionNotes.trim(),
                    by: clientNameStr,
                  },
                  costOk: null,
                  piApproved: false,
                  clientApproved: false,
                }
              : {
                  piRejected: {
                    rejected_at: nowIso,
                    notes: decisionNotes.trim(),
                    by: clientNameStr,
                  },
                  costOk: null,
                  piApproved: false,
                  clientApproved: false,
                }),
          };
          return {
            ...prev,
            wizard_state: updatedWs,
          };
        });

        const successText =
          decision === "approved"
            ? "✓ Proforma Invoice accepted and confirmed successfully!"
            : decision === "revision"
              ? "✓ Change request submitted to your Account Coordinator."
              : "✓ Proforma Invoice decline recorded.";

        setSuccessToast(successText);
        setDecisionModal(null);
        setTimeout(() => setSuccessToast(null), 8000);
      } else {
        setErrorToast(res.data?.message || "Failed to submit decision.");
      }
    } catch (err) {
      console.error("Error submitting decision:", err);
      setErrorToast(err.response?.data?.message || "Server error submitting decision.");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl flex flex-col items-center max-w-sm w-full">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
          <h3 className="font-bold text-gray-800 text-base">Loading Proforma Invoice...</h3>
          <p className="text-gray-500 text-xs mt-1 text-center">Preparing official document preview</p>
        </div>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
            🔒
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Link Expired</h2>
          <p className="text-gray-600 text-sm mb-6 leading-relaxed">
            This secure proforma review link has expired for security reasons. Please reach out to your Account Coordinator to receive an updated link.
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
            ⚠️
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Unable to Load Proforma Invoice</h2>
          <p className="text-gray-600 text-sm mb-6 leading-relaxed">
            {error || "An error occurred while loading this document."}
          </p>
        </div>
      </div>
    );
  }

  const { customer, contact, coordinator_name, uploadedDesigns } = data;
  const parentJobNo = data?.seq
    ? formatEnquiryNo(data.seq)
    : (data?.enquiry_no ? formatEnquiryNo(data.enquiry_no) : ENQUIRY_CONFIG.DEFAULT_ENQUIRY_NO);

  const subjobsParam = searchParams.get("subjobs");
  const targetSubJobsParam = subjobsParam
    ? subjobsParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
    : null;

  const activeSubJobs = (data?.sub_jobs || []).filter((sj) => {
    if (sj.is_dropped || sj.is_on_hold) return false;
    if (targetSubJobsParam && targetSubJobsParam.length > 0) {
      const sjNo = (sj.sub_job_no || "").toUpperCase();
      return targetSubJobsParam.includes(sjNo) || targetSubJobsParam.some((t) => sjNo.endsWith(t));
    }
    return true;
  });

  const subJobCode = targetSubJobsParam && targetSubJobsParam.length > 0
    ? targetSubJobsParam.join(", ")
    : (activeSubJobs.length > 1
      ? `Sub-jobs: ${activeSubJobs.map((s) => s.sub_job_no).join(", ")}`
      : (activeSubJobs[0]?.sub_job_no || `${parentJobNo}-A1`));

  const piNumber = data?.wizard_state?.pi?.no || `PI/2026/${parentJobNo}`;
  const poNumber = data?.wizard_state?.pi?.po_number || data?.wizard_state?.relPo || "BANK";

  const todayDate = new Date();
  const formattedDate = todayDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const rawDeliveryAddress = data?.wizard_state?.sampleShipTo || data?.delivery_details?.shipping_address || customer?.billing || "Client Address";
  const deliveryAddressStr = typeof rawDeliveryAddress === "string" ? rawDeliveryAddress : (rawDeliveryAddress?.label || rawDeliveryAddress?.address || "Client Address");
  const carrierName = data?.wizard_state?.sampleCarrier || data?.delivery_details?.delivery_mode || "Tempo";

  const deliveryFormatted = data?.job_completion_date
    ? new Date(data.job_completion_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
    : (data?.delivery_date ? new Date(data.delivery_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : "Scheduled Date");

  const itemsSubtotal = activeSubJobs.reduce((sum, p) => {
    const qty = Number(p.quantity || 1);
    const rate = Number(p.unit_rate || p.target_rate || 0);
    return sum + (qty * rate);
  }, 0);

  const piTaxableValue = itemsSubtotal;
  const piHalfGst = piGstRate / 2;
  const piCgstAmount = Math.round(piTaxableValue * (piHalfGst / 100));
  const piSgstAmount = Math.round(piTaxableValue * (piHalfGst / 100));
  const piTotalGst = Math.round(piTaxableValue * (piGstRate / 100));
  const piInvoiceTotal = piTaxableValue + piTotalGst;

  const rawAdvanceAmount = data?.wizard_state?.pi?.commercials?.advance_amount || data?.wizard_state?.pi?.advance_amount;
  const piAdvanceDue = rawAdvanceAmount !== undefined && rawAdvanceAmount !== null && Number(rawAdvanceAmount) > 0
    ? Number(rawAdvanceAmount)
    : Math.round(piInvoiceTotal * 0.25);
  const piBalanceDue = Math.max(0, piInvoiceTotal - piAdvanceDue);
  const placeOfSupplyStr = customer?.state ? `Place of supply: ${customer.state}` : "Place of supply: Maharashtra (27)";

  // Proforma Invoice Decision Status Check (Independent from Quotation approval)
  const piDecision = data?.wizard_state?.pi?.client_decision || null;
  const isCostOk = Boolean(data?.wizard_state?.costOk);

  const isPiApproved = piDecision?.decision === "approved" || isCostOk;
  const isPiRevision = piDecision?.decision === "revision" || Boolean(data?.wizard_state?.piRevise);
  const isPiRejected = piDecision?.decision === "rejected" || Boolean(data?.wizard_state?.piRejected);
  const hasClientResponded = isPiApproved || isPiRevision || isPiRejected;

  const decisionDate = piDecision?.at || (isCostOk ? (data?.wizard_state?.costOk?.date ? `${data.wizard_state.costOk.date} ${data.wizard_state.costOk.time || ""}` : null) : null);
  const existingNote = piDecision?.notes || (isCostOk ? data?.wizard_state?.costOk?.notes : null) || data?.wizard_state?.piRevise?.notes || data?.wizard_state?.piRejected?.notes;

  return (
    <div className="min-h-screen bg-slate-100 py-6 sm:py-12 px-3 sm:px-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-700 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce">
          <span className="text-xl">✓</span>
          <span className="text-xs font-bold">{successToast}</span>
          <button
            onClick={() => setSuccessToast(null)}
            className="text-white/80 hover:text-white font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Bar for client: No tabs, direct Print/Save as PDF */}
      <div className="w-full max-w-4xl mx-auto flex items-center justify-between mb-4 print:hidden">
        <div className="text-xs font-bold text-gray-500 flex items-center gap-1.5">
          <span>📄</span>
          <span>Official Proforma Invoice Preview</span>
        </div>
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-xl text-xs font-bold hover:bg-gray-50 shadow-2xs flex items-center gap-1.5 cursor-pointer"
        >
          <span>🖨️</span>
          <span>Print / Save as PDF</span>
        </button>
      </div>

      {/* Proforma Document Sheet */}
      <div
        ref={docSheetRef}
        className="w-full max-w-4xl mx-auto bg-white shadow-2xl p-6 sm:p-12 rounded-2xl border border-gray-200 print:shadow-none print:border-none print:p-0"
      >
        {/* Official Proforma Invoice PDF Banner Uploaded by Accounts */}
        {data?.wizard_state?.pi?.file_url && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-lg">📄</span>
              <div>
                <b className="text-emerald-950 font-bold block">
                  Official Proforma Invoice PDF Uploaded by Accounts ({data.wizard_state.pi.uploaded_by || "Accounts Desk"})
                </b>
                <span className="text-emerald-700 text-[11px]">
                  Document No: {data.wizard_state.pi.no || piNumber} · Ready for client sharing
                </span>
              </div>
            </div>
            <a
              href={data.wizard_state.pi.signed_file_url || data.wizard_state.pi.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg shadow-2xs transition flex items-center gap-1.5"
            >
              👁️ View / Download Official PDF
            </a>
          </div>
        )}

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
            <p className="text-xs text-gray-500 mt-1 font-semibold">Quotation & proforma invoice</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl sm:text-2xl font-black text-indigo-700 tracking-tight">{parentJobNo}</h2>
            <div className="text-xs font-bold text-indigo-900 mt-0.5">{piNumber}</div>
            <p className="text-[11px] font-bold text-gray-500 mt-0.5">{subJobCode}</p>
            <p className="text-xs font-semibold text-gray-500 mt-0.5">
              {formattedDate} · Your PO: {poNumber}
            </p>
          </div>
        </div>

        {/* 4 Info Blocks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-12 text-xs mb-8 pb-6 border-b border-gray-100">
          <div>
            <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px] block mb-1">Bill to</span>
            <div className="text-gray-900 font-medium leading-relaxed">
              <b className="font-bold">{(data?.wizard_state?.billTo?.on && data.wizard_state.billTo.name) ? data.wizard_state.billTo.name : (customer?.name || "Client Name")}</b>
              <br />
              {(data?.wizard_state?.billTo?.on && data.wizard_state.billTo.address) ? formatAddress(data.wizard_state.billTo.address) : (formatAddress(customer?.billing) || formatAddress(customer?.address) || "Client Billing Address")}
              <br />
              GSTIN {(data?.wizard_state?.billTo?.on && data.wizard_state.billTo.gstin) ? (typeof data.wizard_state.billTo.gstin === "object" ? (data.wizard_state.billTo.gstin?.gst_no || "") : data.wizard_state.billTo.gstin) : (typeof customer?.gstin === "object" ? (customer.gstin?.gst_no || "") : (customer?.gstin || "N/A"))}
            </div>
          </div>

          <div>
            <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px] block mb-1">Attention</span>
            <div className="text-gray-900 font-medium leading-relaxed">
              <b className="font-bold">{(data?.wizard_state?.billTo?.on && data.wizard_state.billTo.contact?.name) ? data.wizard_state.billTo.contact.name : (contact?.name || "Client Contact")}</b>
              <br />
              {(data?.wizard_state?.billTo?.on && data.wizard_state.billTo.contact?.email) ? data.wizard_state.billTo.contact.email : (contact?.email || "")}
              <br />
              {(data?.wizard_state?.billTo?.on && data.wizard_state.billTo.contact?.phone) ? `+91 ${data.wizard_state.billTo.contact.phone}` : (contact?.mobile || "")}
            </div>
          </div>

          <div>
            <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px] block mb-1">Deliver to</span>
            <div className="text-gray-900 font-medium leading-relaxed">
              {deliveryAddressStr}
            </div>
          </div>

          <div>
            <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px] block mb-1">By</span>
            <div className="text-gray-900 font-medium leading-relaxed">
              {deliveryFormatted} · {carrierName}
            </div>
          </div>
        </div>

        {/* Proforma Invoice Layout (Exact Screenshot 2) */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900">Quotation & proforma</h3>
            <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg border border-gray-200 print:hidden">
              <button
                type="button"
                onClick={() => setPiGstRate(5)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                  piGstRate === 5 ? "bg-white text-indigo-700 shadow-2xs" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                5%
              </button>
              <button
                type="button"
                onClick={() => setPiGstRate(18)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                  piGstRate === 18 ? "bg-white text-indigo-700 shadow-2xs" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                18%
              </button>
            </div>
          </div>

          <div className="border border-gray-200 rounded-xl overflow-hidden mb-6 shadow-2xs">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/60 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  <th className="py-2.5 px-4 font-semibold">DESCRIPTION</th>
                  <th className="py-2.5 px-4 text-right font-semibold">AMOUNT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {activeSubJobs.map((p, idx) => {
                  const qty = Number(p.quantity || 1);
                  const rate = Number(p.unit_rate || p.target_rate || 0);
                  const lineTotal = qty * rate;

                  const matchGroup = String(p.sub_job_no || "").match(/[-_]([A-Za-z])\d*$/);
                  const gChar = p.design_group || (matchGroup ? matchGroup[1].toUpperCase() : "A");
                  const gIdx = gChar ? gChar.charCodeAt(0) - 65 : 0;
                  const optIdx = p.approved_design_option !== undefined ? p.approved_design_option : 0;
                  const imgUrl = (uploadedDesigns && (
                    uploadedDesigns[`${gIdx}-${optIdx}`] ||
                    uploadedDesigns[`${gIdx}-0`] ||
                    uploadedDesigns[`${idx}-0`] ||
                    Object.values(uploadedDesigns)[0]
                  )) || null;

                  const specsParts = [
                    p.category || "Trophy",
                    p.material || "Composite with a solid base",
                    p.size ? `${p.size}" in` : "",
                    p.specs || p.theme || ""
                  ].filter(Boolean);
                  const specsText = p.spec_line || specsParts.join(" · ");

                  return (
                    <tr key={p.sub_job_no || idx} className="hover:bg-gray-50/30 transition">
                      <td className="py-3 px-4 align-top">
                        <div className="flex items-start gap-3">
                          {imgUrl ? (
                            <div
                              onClick={() => setPreviewImage(imgUrl)}
                              className="w-14 h-14 rounded-xl border border-gray-200 overflow-hidden bg-white shrink-0 p-0.5 shadow-2xs cursor-pointer hover:border-indigo-500 transition print:border print:border-gray-300"
                              title="Click to view full image"
                            >
                              <img
                                src={imgUrl}
                                alt={p.product_name}
                                className="w-full h-full object-cover rounded-lg"
                              />
                            </div>
                          ) : null}
                          <div>
                            <div className="font-bold text-gray-900 text-xs">
                              {idx + 1}. {p.theme || p.product_name || "crystal trophy"}
                            </div>
                            <div className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                              {specsText} · {qty} pcs × ₹{rate.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right align-top font-bold text-gray-900 whitespace-nowrap">
                        ₹{lineTotal.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  );
                })}

                <tr className="border-t border-gray-200 font-medium">
                  <td className="py-2 px-4 text-gray-700 font-bold">Taxable value</td>
                  <td className="py-2 px-4 text-right font-bold text-gray-900 whitespace-nowrap">
                    ₹{piTaxableValue.toLocaleString("en-IN")}
                  </td>
                </tr>

                <tr>
                  <td className="py-1 px-4 text-gray-600">CGST @ {piHalfGst}%</td>
                  <td className="py-1 px-4 text-right text-gray-900 whitespace-nowrap font-medium">
                    ₹{piCgstAmount.toLocaleString("en-IN")}
                  </td>
                </tr>

                <tr>
                  <td className="py-1 px-4 text-gray-600">
                    <div>SGST @ {piHalfGst}%</div>
                    <div className="text-[10px] text-gray-400">{placeOfSupplyStr}</div>
                  </td>
                  <td className="py-1 px-4 text-right text-gray-900 whitespace-nowrap font-medium align-top">
                    ₹{piSgstAmount.toLocaleString("en-IN")}
                  </td>
                </tr>

                <tr className="border-t-2 border-indigo-100 bg-indigo-50/30">
                  <td className="py-3 px-4 font-black text-sm text-indigo-900">Invoice total</td>
                  <td className="py-3 px-4 text-right font-black text-sm text-indigo-900 whitespace-nowrap">
                    ₹{piInvoiceTotal.toLocaleString("en-IN")}
                  </td>
                </tr>

                <tr>
                  <td className="py-2 px-4">
                    <span className="font-bold text-gray-800">Advance due now</span>
                    <div className="text-[10px] text-gray-400">Amount agreed with the client</div>
                  </td>
                  <td className="py-2 px-4 text-right font-bold text-gray-900 whitespace-nowrap">
                    ₹{piAdvanceDue.toLocaleString("en-IN")}
                  </td>
                </tr>

                <tr className="border-t border-gray-100">
                  <td className="py-2 px-4 font-bold text-gray-800">Balance due before dispatch</td>
                  <td className="py-2 px-4 text-right font-bold text-gray-900 whitespace-nowrap">
                    ₹{piBalanceDue.toLocaleString("en-IN")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Purple Card: Total job value incl. GST */}
          <div className="bg-[#EEF2FF] border border-indigo-100 rounded-xl p-4 flex items-center justify-between mb-4 shadow-2xs">
            <div>
              <div className="font-bold text-xs text-indigo-950">Total job value incl. GST</div>
              <div className="text-[10px] text-indigo-700/70">Final invoice total</div>
            </div>
            <div className="text-base sm:text-lg font-black text-indigo-900">
              ₹{piInvoiceTotal.toLocaleString("en-IN")}
            </div>
          </div>

          {/* Yellow Banner: Advance payable now */}
          <div className="bg-[#FEF9C3] border border-amber-200 rounded-xl p-3 text-center mb-6 shadow-2xs">
            <span className="text-xs font-black text-amber-950">
              Advance payable now: ₹{piAdvanceDue.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        {/* Commercial & Payment Terms */}
        <div className="mt-6 space-y-3">
          <div className="p-4 border border-gray-200 rounded-xl text-xs text-gray-700 bg-gray-50/60 leading-relaxed">
            <span className="font-bold text-gray-900 block mb-1">Commercial & Payment Terms:</span>
            • Payment Terms: {data?.wizard_state?.pi?.payment_terms || "100% advance upon confirmation"}.<br />
            • Ref: {parentJobNo}{data?.wizard_state?.pi?.no ? ` · Document No: ${data.wizard_state.pi.no}` : ""}. Advance payable now: ₹{piAdvanceDue.toLocaleString("en-IN")}.<br />
            • Once advance payment is confirmed, your order will proceed directly to sampling or production.
          </div>
        </div>

        {/* Proforma Status Banners */}
        {isPiApproved && (
          <div className="mt-6 p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">✓</span>
              <div>
                <span className="block text-sm font-black text-emerald-950">Proforma Invoice Accepted & Confirmed</span>
                <span className="text-xs text-emerald-800">
                  {decisionDate ? `Order acceptance recorded on ${new Date(decisionDate).toLocaleDateString("en-GB")}` : "Order acceptance recorded."}
                  {existingNote ? ` · "${existingNote}"` : ""}
                </span>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-200 text-emerald-900 text-xs font-black uppercase">Confirmed</span>
          </div>
        )}

        {isPiRevision && (
          <div className="mt-6 p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950">
            <div className="flex items-center gap-2 font-bold text-xs text-amber-900 mb-1">
              <span className="text-base">⚠️</span>
              <span>Changes Requested on Proforma Invoice:</span>
            </div>
            <p className="text-xs text-amber-900 font-medium italic">
              "{existingNote || "Client requested pricing or specification alterations."}"
            </p>
          </div>
        )}

        {isPiRejected && (
          <div className="mt-6 p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-950">
            <div className="flex items-center gap-2 font-bold text-xs text-rose-900 mb-1">
              <span className="text-base">✕</span>
              <span>Proforma Invoice Declined:</span>
            </div>
            <p className="text-xs text-rose-900 font-medium italic">
              "{existingNote || "Proforma Invoice was declined by client."}"
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
                  Client Proforma Acceptance
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-extrabold uppercase tracking-wide border border-indigo-200">
                  Action Required
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Confirm your decision directly. Our servicing & accounts team will be notified immediately.
              </p>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap shrink-0">
              <button
                type="button"
                onClick={() => {
                  setDecisionModal({ decision: "approved" });
                  setDecisionNotes("");
                  setErrorToast(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm hover:shadow transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>✓</span>
                <span>Accept Proforma</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDecisionModal({ decision: "revision" });
                  setDecisionNotes("");
                  setErrorToast(null);
                }}
                className="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm hover:shadow transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>✏️</span>
                <span>Request Changes</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDecisionModal({ decision: "rejected" });
                  setDecisionNotes("");
                  setErrorToast(null);
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
        </div>
      </div>

      {/* Decision Modal */}
      {decisionModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-gray-900 mb-2">
              {decisionModal.decision === "approved"
                ? "Confirm Proforma Acceptance"
                : decisionModal.decision === "revision"
                  ? "Request Proforma Alterations"
                  : "Decline Proforma Invoice"}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              {decisionModal.decision === "approved"
                ? "Please confirm your acceptance of this proforma invoice. Your order will move forward to sampling / production upon advance confirmation."
                : "Please describe your remarks or alteration requests for our Accounts & Servicing teams."}
            </p>

            <textarea
              value={decisionNotes}
              onChange={(e) => setDecisionNotes(e.target.value)}
              placeholder={decisionModal.decision === "approved" ? "Any remarks (optional)..." : "Enter alteration details or reasons..."}
              rows={3}
              className="w-full text-xs p-3 border border-gray-300 rounded-xl mb-4 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />

            {errorToast && <p className="text-xs text-red-600 mb-3">{errorToast}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDecisionModal(null)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingFeedback}
                onClick={handleSubmitFeedback}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl"
              >
                {submittingFeedback ? "Submitting..." : "Submit Response"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      {previewImage && (
        <ImageLightbox
          isOpen={Boolean(previewImage)}
          imageSrc={previewImage}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </div>
  );
};

export default PublicProformaPreviewView;
