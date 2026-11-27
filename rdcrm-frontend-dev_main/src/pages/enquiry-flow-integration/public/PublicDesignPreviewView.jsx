import React, { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import axios from "axios";
import { backendUrl } from "../../../utils/url/config";
import ImageLightbox from "../../common/ImageLightbox";
import { formatEnquiryNo, ENQUIRY_CONFIG } from "../utils/constants";

const PublicDesignPreviewView = () => {
  const { jobId } = useParams();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  // Client Interactive Feedback State
  const [selectedOptions, setSelectedOptions] = useState({});
  const [feedbackModal, setFeedbackModal] = useState(null);
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSuccessToast, setFeedbackSuccessToast] = useState(null);
  const [feedbackErrorToast, setFeedbackErrorToast] = useState(null);

  const searchParams = new URLSearchParams(location.search);
  const encodedExpires = searchParams.get("exp") || "";

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

  // 2. Fetch Design Data from Public API
  useEffect(() => {
    if (expired) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const queryStr = location.search ? location.search : "";
        const res = await axios.get(`${backendUrl}/enquiry-flow-integration/public/design-view/${jobId}${queryStr}`);
        if (res.data?.success) {
          setData(res.data.data);
        } else {
          setError(res.data?.message || "Could not load design preview");
        }
      } catch (err) {
        console.error("Error loading design preview:", err);
        setError("Unable to load design options. Please check the link or contact your coordinator.");
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

  // 4. Security: PrintScreen guard
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "PrintScreen") {
        const overlay = document.createElement("div");
        overlay.style.position = "fixed";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100vw";
        overlay.style.height = "100vh";
        overlay.style.background = "#000";
        overlay.style.zIndex = "999999";
        document.body.appendChild(overlay);
        setTimeout(() => {
          overlay.remove();
        }, 300);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // 5. Open Feedback Dialog
  const handleOpenFeedbackModal = (pIdx, mode, productName, groupChar, subJobNo, optIdx, availableOptions = []) => {
    const defaultOpt = optIdx !== undefined ? optIdx : (selectedOptions[pIdx] || 0);
    setFeedbackModal({
      pIdx,
      mode,
      productName,
      groupChar,
      subJobNo,
      optIdx: defaultOpt,
      selectedOptIdxs: [defaultOpt],
      availableOptions,
    });
    setFeedbackNotes("");
    setFeedbackErrorToast(null);
  };

  // 6. Submit Client Feedback to Backend Public API
  const handleSubmitFeedback = async () => {
    if (!feedbackModal) return;
    const { pIdx, mode, groupChar, subJobNo, optIdx, selectedOptIdxs = [] } = feedbackModal;

    const targetOptIdxs =
      mode === "approve"
        ? [optIdx]
        : selectedOptIdxs.length > 0
        ? [...selectedOptIdxs].sort((a, b) => a - b)
        : [optIdx];

    if ((mode === "revision" || mode === "reject") && targetOptIdxs.length === 0) {
      setFeedbackErrorToast("Please select at least one design option.");
      return;
    }

    if ((mode === "revision" || mode === "reject") && !feedbackNotes.trim()) {
      setFeedbackErrorToast(
        mode === "revision"
          ? "Please enter your revision notes or reason before submitting."
          : "Please enter your reason for rejection before submitting."
      );
      return;
    }

    try {
      setSubmittingFeedback(true);
      setFeedbackErrorToast(null);

      const queryParams = new URLSearchParams(location.search);
      const token = queryParams.get("token") || "";
      const sig = queryParams.get("sig") || "";

      const payload = {
        pIdx,
        groupChar,
        subJobNo,
        mode,
        optIdxs: targetOptIdxs,
        remark: feedbackNotes.trim(),
        clientName: data?.contact?.name || data?.customer?.name || "Client",
        exp: encodedExpires,
        sig,
        token,
      };

      const res = await axios.post(
        `${backendUrl}/enquiry-flow-integration/public/design-feedback/${jobId}${location.search || `?exp=${encodeURIComponent(encodedExpires)}`}`,
        payload
      );

      if (res.data?.success) {
        const newFeedbackObj = {
          mode,
          optIdxs: targetOptIdxs,
          remark: feedbackNotes.trim(),
          communication: {
            method: "Direct Client Response",
            date: new Date().toISOString(),
            contact_person: data?.contact?.name || "Client",
          },
        };

        // Update local sub_jobs in data for ALL sub-jobs in this common design group
        setData((prev) => {
          if (!prev) return prev;
          const targetSubJobNosList = subJobNo ? String(subJobNo).split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) : [];
          const effectiveGroup =
            groupChar ||
            (subJobNo && (String(subJobNo).match(/[-_]([A-Za-z])\d*$/) || String(subJobNo).match(/^([A-Za-z])\d+/))?.[1]?.toUpperCase()) ||
            String.fromCharCode(65 + pIdx);

          const updatedSjs = (prev.sub_jobs || []).map((sj, idx) => {
            const sjGroup = sj.design_group || (String(sj.sub_job_no || "").match(/[-_]([A-Za-z])\d*$/) || String(sj.sub_job_no || "").match(/^([A-Za-z])\d+/))?.[1]?.toUpperCase();
            const sjUpper = String(sj.sub_job_no || "").toUpperCase();
            const isMatch =
              (effectiveGroup && (sjGroup === effectiveGroup || sjUpper.includes(`-${effectiveGroup}`))) ||
              (targetSubJobNosList.length > 0 && (targetSubJobNosList.includes(sjUpper) || targetSubJobNosList.some((t) => sjUpper.endsWith(t)))) ||
              idx === pIdx;

            if (isMatch) {
              return {
                ...sj,
                design_status: mode === "approve" ? "approved" : "rework",
                design_approved: mode === "approve",
                approved_design_option: targetOptIdxs[0],
                product_feedback: newFeedbackObj,
                rework_notes: mode !== "approve" ? feedbackNotes.trim() : sj.rework_notes,
              };
            }
            return sj;
          });

          const currentPFeedback = prev.productFeedback || {};
          const existingFbs = Array.isArray(currentPFeedback[pIdx])
            ? currentPFeedback[pIdx]
            : currentPFeedback[pIdx]
            ? [currentPFeedback[pIdx]]
            : [];
          const updatedPFeedback = {
            ...currentPFeedback,
            [pIdx]: [
              ...existingFbs,
              newFeedbackObj,
            ],
          };

          return {
            ...prev,
            sub_jobs: updatedSjs,
            productFeedback: updatedPFeedback,
          };
        });

        const optListStr = targetOptIdxs.map((i) => `Option ${i + 1}`).join(", ");
        const successText =
          mode === "approve"
            ? `✓ Design Option ${targetOptIdxs[0] + 1} for "${feedbackModal.productName}" approved successfully!`
            : mode === "revision"
            ? `✓ Change request for ${optListStr} of "${feedbackModal.productName}" submitted to our design team!`
            : `✓ Rejection for ${optListStr} of "${feedbackModal.productName}" recorded.`;

        setFeedbackSuccessToast(successText);
        setFeedbackModal(null);
        setTimeout(() => setFeedbackSuccessToast(null), 8000);
      } else {
        setFeedbackErrorToast(res.data?.message || "Failed to submit feedback.");
      }
    } catch (err) {
      console.error("Error submitting design feedback:", err);
      setFeedbackErrorToast(
        err.response?.data?.message || "Failed to submit feedback. Please check your link or network."
      );
    } finally {
      setSubmittingFeedback(false);
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
          <h2 className="text-xl font-bold text-slate-900">This Review Link Has Expired</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            For version control and design security, client review links are valid for a limited period.
            Please reach out to your Account Coordinator at <strong>RD Custom Awards Pvt. Ltd.</strong> to request a fresh review link.
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
          <p className="text-xs font-semibold text-slate-600">Loading design options...</p>
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
          <h2 className="text-xl font-bold text-slate-900">Design Not Found</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            {error || "The requested design preview is unavailable."}
          </p>
        </div>
      </div>
    );
  }

  const formatAddress = (addr) => {
    if (!addr) return "";
    if (typeof addr === "string") return addr;
    if (Array.isArray(addr) && addr.length > 0) return formatAddress(addr[0]);
    if (typeof addr === "object") {
      const parts = [
        addr.address_1,
        addr.address_2,
        addr.city,
        addr.state,
        addr.postal_code || addr.pincode,
      ].filter(Boolean);
      return parts.join(", ");
    }
    return "";
  };

  const { customer, contact, coordinator_name, sub_jobs, the_brief, uploadedDesigns, trophyGroups, globalBrief, productBriefs, briefMode, links_duration, createdAt, productFeedback } = data || {};

  const parentJobNo = data.enquiry_no || (data.seq ? formatEnquiryNo(data.seq) : ENQUIRY_CONFIG.DEFAULT_ENQUIRY_NO);
  const subJobCode = sub_jobs && sub_jobs[0] ? sub_jobs[0].sub_job_no : `${parentJobNo}-A1`;

  const subjobsParam = searchParams.get("subjobs");
  const selectedSubjobCodes = subjobsParam
    ? subjobsParam.split(",").map((s) => s.trim().toUpperCase())
    : null;

  // Build product list from trophyGroups or sub_jobs (excluding held or dropped products)
  const rawProductsList = (trophyGroups && trophyGroups.length > 0)
    ? trophyGroups
        .map((g, i) => ({
          ...g,
          originalIndex: i,
          name: g.theme || g.productName || `Product ${i + 1}`,
          items: g.items || [],
          is_on_hold: Boolean(g.is_on_hold || (g.items && g.items.length === 1 && g.items[0].is_on_hold) || sub_jobs?.[i]?.is_on_hold),
          is_dropped: Boolean(g.is_dropped || (g.items && g.items.length === 1 && g.items[0].is_dropped) || sub_jobs?.[i]?.is_dropped),
        }))
        .filter((g) => !g.is_on_hold && !g.is_dropped)
    : (sub_jobs && sub_jobs.length > 0)
      ? sub_jobs
          .map((sj, i) => ({
            originalIndex: i,
            name: sj.theme || sj.product_name || "Custom Trophy",
            items: [{ size: sj.size || 8, qty: sj.quantity || 50 }],
            is_on_hold: Boolean(sj.is_on_hold),
            is_dropped: Boolean(sj.is_dropped),
          }))
          .filter((sj) => !sj.is_on_hold && !sj.is_dropped)
      : [{ originalIndex: 0, name: "Custom Trophy", items: [{ size: 8, qty: 50 }] }];

  const productsList = rawProductsList.filter((p, mapIdx) => {
    if (!selectedSubjobCodes || selectedSubjobCodes.length === 0) return true;
    const pIdx = p.originalIndex !== undefined ? p.originalIndex : mapIdx;
    const groupChar = String.fromCharCode(65 + pIdx);
    const sj = (sub_jobs || []).find(
      (s) => s.design_group === groupChar || s.sub_job_no?.includes(`-${groupChar}`)
    ) || (sub_jobs || [])[pIdx];
    const subJobCode = sj?.sub_job_no || `${parentJobNo}-${groupChar}1`;

    return selectedSubjobCodes.some(
      (code) =>
        subJobCode.toUpperCase() === code ||
        subJobCode.toUpperCase().includes(code) ||
        code.includes(subJobCode.toUpperCase()) ||
        code === groupChar ||
        code.endsWith(`-${groupChar}1`) ||
        code.endsWith(`${groupChar}1`)
    );
  });

  const formattedDate = new Date(createdAt || Date.now()).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  return (
    <div className="min-h-screen bg-slate-100 py-6 sm:py-12 px-3 sm:px-6">
      {/* Toast Notification */}
      {feedbackSuccessToast && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-700 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce">
          <span className="text-xl">✓</span>
          <span className="text-xs font-bold">{feedbackSuccessToast}</span>
          <button
            onClick={() => setFeedbackSuccessToast(null)}
            className="text-white/80 hover:text-white font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Document Sheet */}
      <div className="w-full max-w-4xl mx-auto bg-white shadow-2xl p-6 sm:p-12 rounded-2xl border border-gray-200">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-indigo-600 pb-5 mb-8">
          <div>
            {data.showRDLogo !== false && (
              <div className="mb-3">
                <img
                  src="https://rdcustomawards.com/cdn/shop/files/logo.svg?v=1700546283&width=90"
                  alt="RD Custom Awards Logo"
                  className="h-10 sm:h-12 w-auto object-contain"
                />
              </div>
            )}
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">RD Custom Awards Pvt. Ltd.</h1>
            <p className="text-xs text-gray-500 mt-1 font-semibold">Design options for approval</p>
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
            <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">To</span>
            <div className="text-gray-900 font-medium leading-relaxed">
              <span className="font-bold text-gray-950 block text-sm">{customer?.name || "Client"}</span>
              {formatAddress(customer?.billing || customer?.address) ? (
                <span className="whitespace-pre-line text-gray-600 block mt-0.5">
                  {formatAddress(customer?.billing || customer?.address)}
                </span>
              ) : null}
              {customer?.gstin ? (
                <span className="text-gray-500 block mt-1">
                  GSTIN: {typeof customer.gstin === "object" ? (customer.gstin.gst_no || "") : String(customer.gstin)}
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
            </div>
          </div>
        </div>

        {/* Design Options Section */}
        <h3 className="text-sm font-black text-gray-900 mb-4 uppercase tracking-wider">Design options</h3>
        <div className="border-t border-gray-200 divide-y divide-gray-200">
          {productsList.map((p, mapIdx) => {
            const pIdx = p.originalIndex !== undefined ? p.originalIndex : mapIdx;
            const uploadedKeys = Object.keys(uploadedDesigns || {}).filter(k => k.startsWith(`${pIdx}-`));
            const uploadedCount = uploadedKeys.length;
            const pBrief = briefMode === "each" ? (productBriefs?.[p.name]?.brief || globalBrief) : globalBrief;
            const pSize = p.items?.[0]?.size || "8";

            const groupChar = String.fromCharCode(65 + pIdx);
            const groupSubJobs = (sub_jobs || []).filter(
              (s) => !s.is_dropped && !s.is_on_hold && (s.design_group === groupChar || s.sub_job_no?.toUpperCase().includes(`-${groupChar}`))
            );
            const matchingSubJob = groupSubJobs[0] || (sub_jobs || [])[pIdx];
            const allProductFeedback = productFeedback || data?.productFeedback || {};
            const rawPFeedback = allProductFeedback[pIdx] || allProductFeedback[String(pIdx)] || allProductFeedback[p.name] || allProductFeedback[matchingSubJob?.sub_job_no];
            const fbs = Array.isArray(rawPFeedback)
              ? [...rawPFeedback]
              : rawPFeedback
              ? [rawPFeedback]
              : [];
            if (matchingSubJob?.product_feedback && !fbs.some(f => f.mode === matchingSubJob.product_feedback.mode && JSON.stringify(f.optIdxs) === JSON.stringify(matchingSubJob.product_feedback.optIdxs))) {
              fbs.push(matchingSubJob.product_feedback);
            }
            const approvedFb = fbs.find((f) => f && f.mode === "approve");
            const isApproved = Boolean(
              matchingSubJob?.design_approved ||
              matchingSubJob?.design_status === "approved" ||
              approvedFb ||
              (groupSubJobs.length > 0 && groupSubJobs.every((s) => s.design_approved))
            );
            const approvedRemark = approvedFb?.remark || (matchingSubJob?.product_feedback?.mode === "approve" ? matchingSubJob?.product_feedback?.remark : "");
            const reworkFb = fbs.find((f) => f && (f.mode === "revision" || f.mode === "reject"));
            const isRework = Boolean(
              !isApproved &&
              (reworkFb || matchingSubJob?.design_status === "rework" || matchingSubJob?.product_feedback?.mode === "revision" || matchingSubJob?.product_feedback?.mode === "reject" || matchingSubJob?.rework_notes)
            );
            const reworkRemark = reworkFb?.remark || matchingSubJob?.product_feedback?.remark || matchingSubJob?.rework_notes || the_brief?.rework_notes || "";

            // Find the first option that has an image and is NOT in rework/rejected status
            const unreviewedOptIdx = Array.from({ length: 10 }).findIndex((_, idx) => {
              const hasImg = uploadedDesigns[`${pIdx}-${idx}`];
              const isReworkedOpt = fbs.some((f) => f && (f.mode === "revision" || f.mode === "reject") && (f.optIdxs?.includes(idx) || (!f.optIdxs && idx === 0)));
              return hasImg && !isReworkedOpt;
            });
            const defaultSelectedOpt = unreviewedOptIdx !== -1 ? unreviewedOptIdx : (matchingSubJob?.approved_design_option ?? 0);
            const selectedOpt =
              selectedOptions[pIdx] !== undefined
                ? selectedOptions[pIdx]
                : defaultSelectedOpt;

            const availableOptions = Array.from({ length: 10 })
              .map((_, idx) => {
                const imgUrl = uploadedDesigns[`${pIdx}-${idx}`];
                if (!imgUrl) return null;
                const thisOptFb = fbs.find((f) => f && (f.optIdxs?.includes(idx) || (!f.optIdxs && idx === 0)));
                const isApprovedOpt = isApproved && (matchingSubJob?.approved_design_option === idx || (matchingSubJob?.approved_design_option === undefined && idx === 0) || approvedFb?.optIdxs?.includes(idx));
                const isReworkOpt = !isApproved && Boolean(
                  (thisOptFb && (thisOptFb.mode === "revision" || thisOptFb.mode === "rework")) ||
                  (!thisOptFb && (uploadedCount === 1 || idx === 0) && (isRework || matchingSubJob?.design_status === "rework" || matchingSubJob?.rework_notes))
                );
                const isRejectOpt = !isApproved && Boolean(thisOptFb && thisOptFb.mode === "reject");

                return {
                  optIdx: idx,
                  imgUrl,
                  label: `Option ${idx + 1}`,
                  status: isApprovedOpt ? "approved" : isReworkOpt ? "revision" : isRejectOpt ? "reject" : "pending",
                };
              })
              .filter(Boolean);

            const selectedOptFb = fbs.find((f) => f && (f.optIdxs?.includes(selectedOpt) || (!f.optIdxs && selectedOpt === 0)));
            const isSingleOptRework =
              !isApproved &&
              uploadedCount === 1 &&
              (isRework || matchingSubJob?.design_status === "rework" || matchingSubJob?.rework_notes);

            const isSelectedOptRework =
              !isApproved &&
              (isSingleOptRework ||
                Boolean(selectedOptFb && (selectedOptFb.mode === "revision" || selectedOptFb.mode === "rework")));

            const isSelectedOptRejected =
              !isApproved &&
              Boolean(selectedOptFb && selectedOptFb.mode === "reject");

            const affectedOptsForBanner = selectedOptFb?.optIdxs?.length > 1
              ? selectedOptFb.optIdxs.map((i) => `Option ${i + 1}`).join(", ")
              : `Option ${selectedOpt + 1}`;

            return (
              <div key={pIdx} className="grid grid-cols-1 sm:grid-cols-[200px_1fr] py-6 text-xs gap-4">
                <div>
                  <div className="font-bold text-gray-950 text-sm">{p.name}</div>
                  <div className="text-xs text-gray-500 mt-1 font-medium">
                    {groupSubJobs.length > 1
                      ? `Sizes: ${groupSubJobs.map((s) => `${s.size || 8} in`).join(", ")}`
                      : `${pSize} in`}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {groupSubJobs.length > 0 ? (
                      groupSubJobs.map((sj, sIdx) => (
                        <span key={sIdx} className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200">
                          {sj.sub_job_no} ({sj.size || 8} in)
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200">
                        {parentJobNo}-{groupChar}1 ({pSize} in)
                      </span>
                    )}
                  </div>
                  {groupSubJobs.length > 1 && (
                    <div className="text-[10px] text-gray-400 mt-1.5 italic">
                      Common design applies to all sizes
                    </div>
                  )}
                </div>
                <div>
                  {/* Status Banner if already acted upon */}
                  {isApproved && (
                    <div className="mb-3 p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-xs">
                          <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">✓</span>
                          <span>Design Approved (Option {(matchingSubJob?.approved_design_option ?? approvedFb?.optIdxs?.[0] ?? 0) + 1})</span>
                        </div>
                        {approvedRemark && (
                          <span className="text-[11px] text-emerald-800 italic">"{approvedRemark}"</span>
                        )}
                      </div>
                      {groupSubJobs.length > 1 && (
                        <div className="text-[10px] text-emerald-700 font-medium pl-7">
                          ✓ Applied to all sizes: {groupSubJobs.map((s) => `${s.sub_job_no} (${s.size || 8} in)`).join(", ")}
                        </div>
                      )}
                    </div>
                  )}

                  {isRework && (
                    <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900 mb-0.5">
                        <span>⚠️</span>
                        <span>Previous Revision Request on Option {(reworkFb?.optIdxs?.[0] ?? 0) + 1}:</span>
                      </div>
                      <p className="text-xs text-amber-900 font-medium italic">
                        "{reworkRemark || "Client requested revisions."}"
                      </p>
                      {uploadedCount > 1 && (
                        <p className="text-[11px] text-amber-800 font-semibold mt-1.5 flex items-center gap-1">
                          <span>✨</span>
                          <span>Revised design option has been uploaded by designer. Please review and approve below.</span>
                        </p>
                      )}
                    </div>
                  )}

                  <div className="font-bold text-gray-900 mb-1">
                    {uploadedCount} {uploadedCount === 1 ? "option" : "options"} attached
                  </div>
                  <div className="text-gray-500 mb-4 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                    <span className="font-semibold text-gray-700">Brief: </span>
                    {pBrief || "Custom Trophy Design"}
                  </div>

                  {uploadedCount > 0 ? (
                    <>
                      <div className="flex flex-wrap gap-4 pt-1">
                        {Array.from({ length: 10 }).map((_, optIdx) => {
                          const imgUrl = uploadedDesigns[`${pIdx}-${optIdx}`];
                          if (!imgUrl) return null;
                          const isSelected = selectedOpt === optIdx;
                          const isThisOptApproved = isApproved && (matchingSubJob?.approved_design_option === optIdx || (matchingSubJob?.approved_design_option === undefined && optIdx === 0) || approvedFb?.optIdxs?.includes(optIdx));
                          const thisOptFb = fbs.find((f) => f && (f.optIdxs?.includes(optIdx) || (!f.optIdxs && optIdx === 0)));
                          const isThisOptRework = !isApproved && Boolean(
                            (thisOptFb && (thisOptFb.mode === "revision" || thisOptFb.mode === "rework")) ||
                            (!thisOptFb && (uploadedCount === 1 || optIdx === 0) && (isRework || matchingSubJob?.design_status === "rework" || matchingSubJob?.rework_notes))
                          );
                          const isThisOptRejected = !isApproved && Boolean(thisOptFb && thisOptFb.mode === "reject");

                          return (
                            <div
                              key={optIdx}
                              onClick={() => {
                                if (!isApproved) {
                                  setSelectedOptions((prev) => ({ ...prev, [pIdx]: optIdx }));
                                }
                              }}
                              className={`flex flex-col items-center p-2 rounded-2xl border-2 transition ${
                                isThisOptApproved
                                  ? "border-emerald-500 bg-emerald-50/50 shadow-md ring-2 ring-emerald-200"
                                  : isThisOptRejected
                                  ? "border-rose-400 bg-rose-50/40 shadow-xs ring-1 ring-rose-300 cursor-pointer"
                                  : isThisOptRework
                                  ? "border-amber-400 bg-amber-50/40 shadow-xs ring-1 ring-amber-300 cursor-pointer"
                                  : isSelected && !isApproved
                                  ? "border-indigo-600 bg-indigo-50/40 shadow-md ring-2 ring-indigo-200 cursor-pointer"
                                  : isApproved
                                  ? "border-gray-200 bg-gray-50/40 opacity-70"
                                  : "border-gray-200 bg-white hover:border-gray-400 cursor-pointer"
                              }`}
                            >
                              <div 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewImage(imgUrl);
                                }}
                                className="w-32 h-32 sm:w-40 sm:h-40 rounded-xl border border-gray-200 bg-white p-1.5 shadow-xs flex items-center justify-center overflow-hidden cursor-zoom-in hover:border-indigo-500 hover:shadow-md transition group relative"
                                title="Click to zoom image"
                              >
                                <img 
                                  src={imgUrl} 
                                  alt={`Option ${optIdx + 1}`} 
                                  className="w-full h-full object-contain rounded-lg group-hover:scale-105 transition duration-200"
                                />
                                <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded font-bold">
                                  🔍 Zoom
                                </span>
                                {isThisOptApproved && (
                                  <span className="absolute top-1 left-1 bg-emerald-600 text-white text-[9px] px-1.5 py-0.5 rounded font-bold shadow-xs">
                                    ✓ Approved
                                  </span>
                                )}
                                {isThisOptRework && !isThisOptApproved && (
                                  <span className="absolute top-1 left-1 bg-amber-600 text-white text-[9px] px-1.5 py-0.5 rounded font-bold shadow-xs">
                                    Changes Asked
                                  </span>
                                )}
                                {isThisOptRejected && !isThisOptApproved && (
                                  <span className="absolute top-1 left-1 bg-rose-600 text-white text-[9px] px-1.5 py-0.5 rounded font-bold shadow-xs">
                                    Rejected
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-col items-center gap-0.5 mt-2">
                                {isApproved ? (
                                  isThisOptApproved ? (
                                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                                      <span>✓</span> Option {optIdx + 1} (Approved)
                                    </span>
                                  ) : (
                                    <span className="text-xs font-semibold text-gray-400">
                                      Option {optIdx + 1}
                                    </span>
                                  )
                                ) : isThisOptRejected ? (
                                  <>
                                    <span className="text-xs font-bold text-rose-800 flex items-center gap-1">
                                      <span>✕</span> Option {optIdx + 1}
                                    </span>
                                    {thisOptFb?.remark && (
                                      <span className="text-[10px] text-rose-700 italic max-w-[130px] text-center truncate">
                                        "{thisOptFb.remark}"
                                      </span>
                                    )}
                                  </>
                                ) : isThisOptRework ? (
                                  <>
                                    <span className="text-xs font-bold text-amber-800 flex items-center gap-1">
                                      <span>⚠️</span> Option {optIdx + 1}
                                    </span>
                                    {(thisOptFb?.remark || reworkRemark) && (
                                      <span className="text-[10px] text-amber-700 italic max-w-[130px] text-center truncate">
                                        "{thisOptFb?.remark || reworkRemark}"
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`product-opt-${pIdx}`}
                                      checked={isSelected}
                                      onChange={() => setSelectedOptions((prev) => ({ ...prev, [pIdx]: optIdx }))}
                                      className="accent-indigo-600 cursor-pointer"
                                    />
                                    <span className="text-xs font-bold text-gray-800">
                                      Option {optIdx + 1}
                                    </span>
                                  </label>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* If the currently selected option already has Changes Asked / Revision submitted */}
                      {!isApproved && isSelectedOptRework && (
                        <div className="mt-4 pt-3 border-t border-amber-200 bg-amber-50/80 p-3.5 rounded-xl border border-amber-300 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xl">⏳</span>
                            <div>
                              <div className="font-bold text-xs text-amber-950 flex items-center gap-2">
                                <span>Decision Submitted: Changes Asked for {affectedOptsForBanner}</span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 border border-amber-300">
                                  Revision in Progress
                                </span>
                              </div>
                              <div className="text-[11px] text-amber-800 mt-1">
                                {(selectedOptFb?.remark || reworkRemark) ? (
                                  <span>Your request: <em className="font-bold text-amber-950">"{selectedOptFb?.remark || reworkRemark}"</em>. </span>
                                ) : null}
                                <span>Our design team is working on the revised design. You will be notified once ready.</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* If the currently selected option was Rejected */}
                      {!isApproved && isSelectedOptRejected && (
                        <div className="mt-4 pt-3 border-t border-rose-200 bg-rose-50/80 p-3.5 rounded-xl border border-rose-300 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xl">✕</span>
                            <div>
                              <div className="font-bold text-xs text-rose-950 flex items-center gap-2">
                                <span>Decision Submitted: {affectedOptsForBanner} Rejected</span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-200 text-rose-900 border border-rose-300">
                                  Rejected
                                </span>
                              </div>
                              <div className="text-[11px] text-rose-800 mt-1">
                                {(selectedOptFb?.remark || reworkRemark) ? (
                                  <span>Reason: <em className="font-bold text-rose-950">"{selectedOptFb?.remark || reworkRemark}"</em>. </span>
                                ) : null}
                                <span>Our design team has been notified.</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Interactive Client Decision Toolbar - Only shown for pending / unreviewed options */}
                      {!isApproved && !isSelectedOptRework && !isSelectedOptRejected && (
                        <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-xl border">
                          <div className="text-xs text-gray-700">
                            <div>Selected Option: <b className="text-indigo-900 font-bold">Option {selectedOpt + 1}</b></div>
                            {groupSubJobs.length > 1 && (
                              <div className="text-[10px] text-gray-500 mt-0.5">
                                Decision applies to: {groupSubJobs.map((s) => s.sub_job_no).join(", ")}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenFeedbackModal(
                                  pIdx,
                                  "approve",
                                  p.name,
                                  groupChar,
                                  groupSubJobs.map((s) => s.sub_job_no).join(",") || matchingSubJob?.sub_job_no,
                                  selectedOpt,
                                  availableOptions
                                )
                              }
                              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                            >
                              <span>✓</span>
                              <span>Approve Option {selectedOpt + 1}{groupSubJobs.length > 1 ? " (All Sizes)" : ""}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenFeedbackModal(
                                  pIdx,
                                  "revision",
                                  p.name,
                                  groupChar,
                                  groupSubJobs.map((s) => s.sub_job_no).join(",") || matchingSubJob?.sub_job_no,
                                  selectedOpt,
                                  availableOptions
                                )
                              }
                              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                            >
                              <span>✏️</span>
                              <span>Ask Changes</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenFeedbackModal(
                                  pIdx,
                                  "reject",
                                  p.name,
                                  groupChar,
                                  groupSubJobs.map((s) => s.sub_job_no).join(",") || matchingSubJob?.sub_job_no,
                                  selectedOpt,
                                  availableOptions
                                )
                              }
                              className="px-3 py-1.5 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-xs transition flex items-center gap-1 cursor-pointer"
                            >
                              <span>✕</span>
                              <span>Reject</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-xs text-amber-600 italic">No design images uploaded yet.</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Notices */}
        <div className="mt-8 space-y-3">
          <div className="p-4 border border-indigo-100 rounded-xl text-xs text-indigo-950 bg-indigo-50/50 flex items-center gap-2">
            <span>📎</span>
            <span>Design files are attached with this message. Please reply with your choice for each product, or any changes you need.</span>
          </div>
          <div className="p-4 border border-gray-200 rounded-xl text-xs text-gray-700 bg-gray-50/70 flex items-center gap-2">
            <span>⏰</span>
            <span>Please check the details and reply within <strong>{links_duration || 24} hours</strong> if anything needs to change.</span>
          </div>
          {(data.showRDContent || data.copyrightContent || the_brief?.show_content || the_brief?.copyright_content) && (
            <div className="p-3.5 border border-amber-200 rounded-xl text-xs text-amber-900 bg-amber-50/80 flex items-center gap-2">
              <span className="text-base">🛡️</span>
              <span className="font-medium">
                {data.copyrightContent || the_brief?.copyright_content || "This artwork is the intellectual property of RD Custom Awards Pvt. Ltd., and all copyrights are held exclusively by RD Custom Awards Pvt. Ltd."}
              </span>
            </div>
          )}
        </div>

        {/* Signatures & Footer */}
        <div className="border-t border-gray-200 mt-12 pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-[10px] text-gray-500 text-center sm:text-left">
            <div className="border-t border-gray-400 pt-2 font-medium">For RD Custom Awards Pvt. Ltd.</div>
            <div className="border-t border-gray-400 pt-2 font-medium">{coordinator_name || "Coordinator"}, Coordinator</div>
            <div className="border-t border-gray-400 pt-2 font-medium text-center">Client acceptance</div>
          </div>
          <div className="text-center text-[10px] text-gray-400 mt-6 font-medium">
            {subJobCode} · Job reference since enquiry {parentJobNo}
          </div>
        </div>
      </div>

      {/* Client Feedback Confirmation & Notes Modal */}
      {feedbackModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !submittingFeedback && setFeedbackModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden p-6 space-y-4 animate-in fade-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">
                  {feedbackModal.mode === "approve" ? "✓" : feedbackModal.mode === "revision" ? "✏️" : "✕"}
                </span>
                <div>
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide">
                    {feedbackModal.mode === "approve"
                      ? "Approve Design Option"
                      : feedbackModal.mode === "revision"
                      ? "Request Revisions / Changes"
                      : "Reject Design Option"}
                  </h3>
                  <p className="text-xs text-indigo-700 font-semibold mt-0.5">
                    {feedbackModal.productName} ·{" "}
                    {feedbackModal.mode === "approve"
                      ? `Option ${feedbackModal.optIdx + 1}`
                      : feedbackModal.selectedOptIdxs?.length > 1
                      ? feedbackModal.selectedOptIdxs.map((i) => `Option ${i + 1}`).join(", ")
                      : `Option ${(feedbackModal.selectedOptIdxs?.[0] ?? feedbackModal.optIdx) + 1}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFeedbackModal(null)}
                disabled={submittingFeedback}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center font-bold text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Error Message in modal */}
            {feedbackErrorToast && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                {feedbackErrorToast}
              </div>
            )}

            {/* If Revision or Reject and multiple options exist, allow Multi-Option selection */}
            {feedbackModal.mode !== "approve" && feedbackModal.availableOptions?.length > 1 && (
              <div className="space-y-2 pb-3 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-800">
                    Apply to Option(s):
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const allIdxs = feedbackModal.availableOptions.map((o) => o.optIdx);
                      const isAll = feedbackModal.selectedOptIdxs?.length === allIdxs.length;
                      setFeedbackModal((prev) => ({
                        ...prev,
                        selectedOptIdxs: isAll ? [prev.optIdx] : allIdxs,
                      }));
                    }}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                  >
                    {feedbackModal.selectedOptIdxs?.length === feedbackModal.availableOptions.length
                      ? "Reset to Single Option"
                      : "Select All Options"}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {feedbackModal.availableOptions.map((opt) => {
                    const isChecked = feedbackModal.selectedOptIdxs?.includes(opt.optIdx);
                    return (
                      <label
                        key={opt.optIdx}
                        className={`flex items-center gap-2 p-2 rounded-xl border-2 cursor-pointer transition ${
                          isChecked
                            ? "border-indigo-600 bg-indigo-50/50 shadow-xs ring-1 ring-indigo-200"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setFeedbackModal((prev) => {
                              const cur = prev.selectedOptIdxs || [];
                              const updated = cur.includes(opt.optIdx)
                                ? cur.filter((i) => i !== opt.optIdx)
                                : [...cur, opt.optIdx];
                              return { ...prev, selectedOptIdxs: updated };
                            });
                          }}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
                        />
                        {opt.imgUrl && (
                          <img
                            src={opt.imgUrl}
                            alt={opt.label}
                            className="w-8 h-8 object-contain rounded border border-gray-200 bg-white"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-gray-900 truncate">{opt.label}</div>
                          {opt.status && opt.status !== "pending" && (
                            <div className="text-[9px] text-amber-700 capitalize font-medium">
                              {opt.status === "revision" ? "Changes Asked" : opt.status}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
                {feedbackModal.selectedOptIdxs?.length === 0 && (
                  <p className="text-[11px] text-rose-600 font-semibold">
                    Please select at least one option.
                  </p>
                )}
              </div>
            )}

            {/* Approve Notice */}
            {feedbackModal.mode === "approve" && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2">
                <span className="text-base">ℹ️</span>
                <span>
                  You are approving <strong>Option {feedbackModal.optIdx + 1}</strong>. This design choice will be locked for production.
                </span>
              </div>
            )}

            {/* Instructions / Textarea */}
            <div className="space-y-1.5 text-xs text-gray-700">
              <label className="font-bold block">
                {feedbackModal.mode === "approve"
                  ? "Optional Note for Production:"
                  : feedbackModal.mode === "revision"
                  ? "Describe the changes you need (Required):"
                  : "Reason for rejection (Required):"}
              </label>
              <textarea
                rows={3}
                value={feedbackNotes}
                onChange={(e) => setFeedbackNotes(e.target.value)}
                placeholder={
                  feedbackModal.mode === "approve"
                    ? "e.g. Design approved! Please proceed with production."
                    : feedbackModal.mode === "revision"
                    ? "e.g. Please change trophy base color to matte black, make the logo 15% larger, and check spelling of company name..."
                    : "e.g. Design does not match our event theme."
                }
                className="w-full p-3 rounded-xl border border-gray-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 text-xs text-gray-900 resize-none font-sans"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setFeedbackModal(null)}
                disabled={submittingFeedback}
                className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitFeedback}
                disabled={submittingFeedback || ((feedbackModal.mode === "revision" || feedbackModal.mode === "reject") && feedbackModal.selectedOptIdxs?.length === 0)}
                className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md transition flex items-center gap-1.5 cursor-pointer ${
                  feedbackModal.mode === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : feedbackModal.mode === "revision"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-rose-600 hover:bg-rose-700"
                } ${(submittingFeedback || ((feedbackModal.mode === "revision" || feedbackModal.mode === "reject") && feedbackModal.selectedOptIdxs?.length === 0)) ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                {submittingFeedback ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>
                    {feedbackModal.mode === "approve"
                      ? "Approve Design"
                      : feedbackModal.selectedOptIdxs?.length > 1
                      ? `Submit for ${feedbackModal.selectedOptIdxs.length} Options`
                      : "Submit to Design Team"}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Zoom Modal */}
      {previewImage && (
        <ImageLightbox 
          src={previewImage} 
          onClose={() => setPreviewImage(null)} 
        />
      )}
    </div>
  );
};

export default PublicDesignPreviewView;

