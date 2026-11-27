import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { backendUrl } from "../../../utils/url/config";
import SampleProofSheetApproval from "./components/SampleProofSheetApproval";

const PublicProofApprovalView = ({
  jobId,
  queryParams,
  data,
  parentJobNo,
  subjobsParam,
  onOpenImage,
}) => {
  const [proofData, setProofData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Per-file rejection modal state
  const [activeFileModal, setActiveFileModal] = useState(null); // { fileId, fileType, fileName, fileUrl }
  const [fileAlterationNotes, setFileAlterationNotes] = useState("");
  const [fileReferenceFile, setFileReferenceFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(null);
  const [feedbackError, setFeedbackError] = useState(null);

  // Helper to extract clean file name
  const getDisplayFileName = (url, fallback = "Document") => {
    if (!url) return fallback;
    try {
      const clean = url.split("?")[0];
      const parts = clean.split("/");
      const name = parts[parts.length - 1];
      return decodeURIComponent(name) || fallback;
    } catch {
      return fallback;
    }
  };

  // Helper to extract file extension / format
  const getFileExt = (url, fallback = "FILE") => {
    if (!url) return fallback;
    try {
      const clean = url.split("?")[0];
      const ext = clean.split(".").pop();
      return ext ? ext.toUpperCase().slice(0, 4) : fallback;
    } catch {
      return fallback;
    }
  };

  // Fetch proof data from backend
  const fetchProofData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const queryStr = queryParams ? queryParams : "";
      const res = await axios.get(
        `${backendUrl}/enquiry-flow-integration/public/proof-view/${jobId}${queryStr}`
      );
      if (res.data?.success) {
        setProofData(res.data.data);
      } else {
        setError(res.data?.message || "Could not load proof details");
      }
    } catch (err) {
      console.error("Error loading proof details:", err);
      setError(err.response?.data?.message || "Failed to load proof files.");
    } finally {
      setLoading(false);
    }
  }, [jobId, queryParams]);

  useEffect(() => {
    if (jobId) {
      fetchProofData();
    }
  }, [jobId, fetchProofData]);

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto bg-white rounded-2xl p-12 border border-gray-200 shadow-md text-center">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-xs font-semibold text-gray-600">
          Fetching artwork proofs from DTP studio...
        </p>
      </div>
    );
  }

  if (error || !proofData) {
    return (
      <div className="w-full max-w-4xl mx-auto bg-white rounded-2xl p-8 border border-red-200 shadow-md text-center">
        <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto text-2xl mb-3">
          ⚠️
        </div>
        <h3 className="text-base font-bold text-gray-900 mb-1">Artwork Proofs Not Available</h3>
        <p className="text-xs text-gray-500 max-w-md mx-auto mb-4">
          {error || "The DTP artwork proofs have not been uploaded or are awaiting preparation."}
        </p>
        <button
          onClick={fetchProofData}
          className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold transition cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  const subJobMap = proofData.sub_jobs || {};
  const targetSubJobNo =
    subjobsParam ||
    proofData.active_sub_jobs?.[0] ||
    Object.keys(subJobMap)[0] ||
    `${parentJobNo}-A1`;

  const activeProof = subJobMap[targetSubJobNo] || Object.values(subJobMap)[0] || {};
  const masterFiles = activeProof.master_template_files || [];
  const contentFiles = activeProof.content_proofing_files || [];

  const isSample = Boolean(
    proofData.is_sample ||
    proofData.order_type === "sample" ||
    proofData.job_type === "sample" ||
    proofData.mode === "sample" ||
    proofData.order_mode?.mode === "sample" ||
    activeProof.is_sample ||
    activeProof.cs_uploaded_proof ||
    (queryParams && (queryParams.includes("phase=sample") || queryParams.includes("sample=true"))) ||
    (typeof window !== "undefined" && (window.location.search.includes("phase=sample") || window.location.search.includes("sample=true")))
  );

  // Per-file approval / rejection handler
  const handleSubmitFileAction = async (fileId, fileType, status, reason = "", refFile = null) => {
    if (status === "Rejected" && !reason.trim()) {
      setFeedbackError("Please specify what corrections or reasons for rejection.");
      return;
    }

    try {
      setSubmitting(true);
      setFeedbackError(null);

      const targetSubJobNo =
        subjobsParam ||
        proofData?.active_sub_jobs?.[0] ||
        (data?.sub_jobs && data.sub_jobs[0]?.sub_job_no) ||
        `${parentJobNo}-A1`;

      const formData = new FormData();
      formData.append("fileId", fileId);
      formData.append("fileType", fileType);
      formData.append("status", status);
      formData.append("rejection_reason", reason.trim());
      formData.append("subJobNo", targetSubJobNo);
      formData.append("phase", isSample ? "sample" : "production");
      formData.append(
        "clientName",
        proofData?.client_name ||
          data?.contact?.name ||
          data?.customer?.name ||
          "Client"
      );
      if (refFile) {
        formData.append("reference_file", refFile);
      }

      const queryStr = queryParams ? queryParams : "";
      const res = await axios.post(
        `${backendUrl}/enquiry-flow-integration/public/proof-feedback/${jobId}${queryStr}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      if (res.data?.success) {
        setFeedbackSuccess(
          status === "Approved"
            ? (fileType === "all" || isSample)
              ? "✓ Sample artwork layout & content proof approved! Sample production can proceed."
              : `✓ ${fileType === "master" ? "Master template layout" : "Content proof document"} approved!`
            : `✓ Rejection feedback submitted. Our DTP studio will update the proofs.`
        );
        setActiveFileModal(null);
        setFileAlterationNotes("");
        setFileReferenceFile(null);
        await fetchProofData();
        setTimeout(() => setFeedbackSuccess(null), 7000);
      } else {
        setFeedbackError(res.data?.message || "Failed to update status.");
      }
    } catch (err) {
      console.error("Error submitting file action:", err);
      setFeedbackError(
        err.response?.data?.message ||
          "Failed to submit proof feedback. Please check your network connection."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Bulk stage approval (approve all pending in a stage)
  const handleBulkStageApproval = async (stage) => {
    try {
      setSubmitting(true);
      setFeedbackError(null);

      const targetSubJobNo =
        subjobsParam ||
        proofData?.active_sub_jobs?.[0] ||
        (data?.sub_jobs && data.sub_jobs[0]?.sub_job_no) ||
        `${parentJobNo}-A1`;

      const payload = {
        stage, // "master" | "proofing"
        decision: "approved",
        status: "Approved",
        subJobNo: targetSubJobNo,
        clientName:
          proofData?.client_name ||
          data?.contact?.name ||
          data?.customer?.name ||
          "Client",
      };

      const queryStr = queryParams ? queryParams : "";
      const res = await axios.post(
        `${backendUrl}/enquiry-flow-integration/public/proof-feedback/${jobId}${queryStr}`,
        payload
      );

      if (res.data?.success) {
        setFeedbackSuccess(
          stage === "master"
            ? "✓ All master template layouts approved! DTP studio can now upload content proofing files."
            : "✓ All content proofing files approved! Order released for production."
        );
        await fetchProofData();
        setTimeout(() => setFeedbackSuccess(null), 7000);
      } else {
        setFeedbackError(res.data?.message || "Failed to approve all.");
      }
    } catch (err) {
      console.error("Error submitting bulk approval:", err);
      setFeedbackError(err.response?.data?.message || "Failed to submit approval.");
    } finally {
      setSubmitting(false);
    }
  };

  let effectiveMasterFiles = [...masterFiles];
  if (isSample && activeProof.cs_uploaded_proof) {
    const alreadyExists = effectiveMasterFiles.some(
      (f) =>
        f.file_url === activeProof.cs_uploaded_proof.file_url ||
        f.raw_url === activeProof.cs_uploaded_proof.raw_url ||
        f._id === activeProof.cs_uploaded_proof._id
    );
    if (!alreadyExists) {
      effectiveMasterFiles = [activeProof.cs_uploaded_proof, ...effectiveMasterFiles];
    }
  }

  const hasMasterApproved = effectiveMasterFiles.some((f) => f.status === "Approved");
  const isMasterFullyApproved =
    effectiveMasterFiles.length > 0 && effectiveMasterFiles.every((f) => f.status === "Approved");
  const isMasterPartiallyRejected = effectiveMasterFiles.some((f) => f.status === "Rejected");
  const hasMasterPending = effectiveMasterFiles.some((f) => f.status !== "Approved" && f.status !== "Rejected");

  const isContentFullyApproved =
    contentFiles.length > 0 && contentFiles.every((f) => f.status === "Approved");
  const isContentPartiallyRejected = contentFiles.some((f) => f.status === "Rejected");
  const hasContentPending = contentFiles.some((f) => f.status !== "Approved" && f.status !== "Rejected");

  const todayStr = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="w-full max-w-4xl mx-auto print:p-0">
      {/* Toast Banner */}
      {feedbackSuccess && (
        <div className="mb-6 bg-emerald-700 text-white p-4 rounded-xl shadow-lg flex items-center justify-between text-xs font-bold animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="text-base">✓</span>
            <span>{feedbackSuccess}</span>
          </div>
          <button
            onClick={() => setFeedbackSuccess(null)}
            className="text-white/80 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {feedbackError && (
        <div className="mb-6 bg-rose-600 text-white p-4 rounded-xl shadow-lg flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span>{feedbackError}</span>
          </div>
          <button
            onClick={() => setFeedbackError(null)}
            className="text-white/80 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* SAMPLE PROOF SHEET vs PRODUCTION 2-STAGE APPROVAL */}
      {isSample ? (
        <SampleProofSheetApproval
          proofData={proofData}
          activeProof={activeProof}
          parentJobNo={parentJobNo}
          targetSubJobNo={targetSubJobNo}
          todayStr={todayStr}
          submitting={submitting}
          handleSubmitFileAction={handleSubmitFileAction}
          handleBulkStageApproval={handleBulkStageApproval}
          setActiveFileModal={setActiveFileModal}
        />
      ) : (
        <div className="w-full bg-white shadow-2xl p-6 sm:p-12 rounded-2xl border border-gray-200 print:shadow-none print:border-none print:p-0">
          {/* Document Header */}
          <div className="flex justify-between items-start border-b-2 border-indigo-600 pb-5 mb-8">
        <div>
          <div className="mb-3">
            <img
              src="https://rdcustomawards.com/cdn/shop/files/logo.svg?v=1700546283&width=90"
              alt="RD Custom Awards Logo"
              className="h-10 sm:h-12 w-auto object-contain"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            RD Custom Awards Pvt. Ltd.
          </h1>
          <p className="text-xs text-gray-500 mt-1 font-semibold">
            Official Artwork & Content Proof Approval
          </p>
        </div>
        <div className="text-right">
          <h2 className="text-lg sm:text-xl font-black text-indigo-900 tracking-tight">
            {targetSubJobNo}
          </h2>
          <p className="text-xs font-semibold text-gray-500 mt-0.5">Job: {parentJobNo}</p>
          <p className="text-xs text-gray-400 mt-0.5">{todayStr}</p>
        </div>
      </div>

      {/* Bill To / Details Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-12 text-xs mb-8 pb-6 border-b border-gray-100">
        <div className="grid grid-cols-[80px_1fr] items-start">
          <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Client</span>
          <div className="text-gray-900 font-medium leading-relaxed">
            <span className="font-bold text-gray-950 block text-sm">
              {proofData.client_company || proofData.client_name || "Client Company"}
            </span>
            <span className="text-gray-500 block mt-0.5">
              Attention: {proofData.client_name || "Client Contact"}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-[80px_1fr] items-start">
          <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Product</span>
          <div className="text-gray-900 font-medium leading-relaxed">
            <span className="font-bold text-gray-950 block text-sm">
              {activeProof.product_name || "Custom Trophy"}
            </span>
            <span className="text-gray-500 block mt-0.5">
              Quantity: {activeProof.quantity || 1} pcs
              {(typeof activeProof.size === "object" ? (activeProof.size?.trophyH || activeProof.size?.size) : activeProof.size) ? ` · Size: ${typeof activeProof.size === "object" ? (activeProof.size?.trophyH || activeProof.size?.size) : activeProof.size}` : ""}
            </span>
          </div>
        </div>
      </div>

      {/* 2-STAGE PROGRESS TRACKER */}
      <div className="mb-8 p-4 bg-slate-50 border border-slate-200 rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Approval Progression:
          </span>
          <span className="text-[11px] font-semibold text-indigo-700">
            {hasMasterApproved && isContentFullyApproved
              ? "✓ Both Stages Approved"
              : hasMasterApproved
              ? "Step 1 Approved · In Step 2"
              : "In Step 1 (Master Template)"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div
            className={`p-3 rounded-lg border flex items-center gap-2.5 ${
              hasMasterApproved
                ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                : isMasterPartiallyRejected
                ? "bg-rose-50 border-rose-300 text-rose-900"
                : "bg-white border-amber-300 text-amber-900"
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs font-bold">
              {hasMasterApproved ? "✓" : "1"}
            </span>
            <div className="min-w-0">
              <span className="block font-bold text-xs">Stage 1: Master Template</span>
              <span className="text-[10px] block opacity-80">
                {isMasterFullyApproved
                  ? "All images approved"
                  : hasMasterApproved
                  ? "Master layout approved"
                  : isMasterPartiallyRejected
                  ? "Alterations requested"
                  : "Awaiting image approvals"}
              </span>
            </div>
          </div>

          <div
            className={`p-3 rounded-lg border flex items-center gap-2.5 ${
              !hasMasterApproved
                ? "bg-gray-100 border-gray-200 text-gray-400"
                : isContentFullyApproved
                ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                : isContentPartiallyRejected
                ? "bg-rose-50 border-rose-300 text-rose-900"
                : "bg-white border-indigo-300 text-indigo-900"
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs font-bold">
              {isContentFullyApproved ? "✓" : !hasMasterApproved ? "🔒" : "2"}
            </span>
            <div className="min-w-0">
              <span className="block font-bold text-xs">Stage 2: Content Proofing</span>
              <span className="text-[10px] block opacity-80">
                {!hasMasterApproved
                  ? "Unlocks after Stage 1"
                  : isContentFullyApproved
                  ? "All files approved"
                  : isContentPartiallyRejected
                  ? "Alterations requested"
                  : "Awaiting file approvals"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* STAGE 1: MASTER TEMPLATE LAYOUT (VISUAL IMAGES) */}
      {/* ============================================================== */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
          <div>
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
              <span>{isSample ? "📄" : "🎨"}</span>
              <span>{isSample ? "Sample Artwork Proof Files" : "Stage 1: Master Template Proof Images"}</span>
            </h3>
            <p className="text-[11px] text-gray-500">
              {isSample
                ? "Please review the sample proof files below. View or download the file, and submit your approval or request alterations."
                : "Please inspect each artwork layout image. Approve each image individually or request alterations."}
            </p>
          </div>
          {hasMasterPending && effectiveMasterFiles.length > 1 && (
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleBulkStageApproval("master")}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs transition cursor-pointer disabled:opacity-50"
            >
              {isSample ? "✓ Approve All Proof Files" : "✓ Approve All Master Images"}
            </button>
          )}
        </div>

        {/* CS Uploaded Artwork Proof Highlight Card (For production only, if not sample) */}
        {!isSample && activeProof.cs_uploaded_proof && (
          <div className="mb-4 p-4 bg-indigo-50/80 border-2 border-indigo-300 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-lg font-bold shadow-2xs shrink-0">
                📄
              </span>
              <div className="min-w-0">
                <span className="font-extrabold text-gray-900 text-xs block truncate" title={activeProof.cs_uploaded_proof.name}>
                  Artwork Proof: {activeProof.cs_uploaded_proof.name}
                </span>
                <span className="text-[11px] text-indigo-700 font-medium block">
                  Uploaded by Client Servicing Coordinator · {activeProof.cs_uploaded_proof.uploaded_at ? new Date(activeProof.cs_uploaded_proof.uploaded_at).toLocaleDateString("en-IN") : "Recent"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={activeProof.cs_uploaded_proof.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
              >
                <span>👁️</span> View Document ↗
              </a>
              <a
                href={activeProof.cs_uploaded_proof.file_url}
                download={activeProof.cs_uploaded_proof.name || "Artwork_Proof"}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
              >
                <span>⬇️</span> Download
              </a>
            </div>
          </div>
        )}

        {/* SAMPLE STAGE: No image preview, just clean file link with View & Download */}
        {isSample ? (
          effectiveMasterFiles.length > 0 ? (
            <div className="space-y-3">
              {effectiveMasterFiles.map((mFile, idx) => {
                const fileId = mFile._id || mFile.file_url;
                const status = mFile.status || "Pending";
                const isItemApproved = status === "Approved";
                const isItemRejected = status === "Rejected";
                const fileName =
                  mFile.original_name ||
                  mFile.name ||
                  getDisplayFileName(mFile.file_url, `Sample Artwork Proof #${idx + 1}`);
                const ext = getFileExt(fileName || mFile.file_url, "FILE");

                return (
                  <div
                    key={fileId || idx}
                    className={`p-4 rounded-xl border-2 transition-all bg-white flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isItemApproved
                        ? "border-emerald-300 bg-emerald-50/20"
                        : isItemRejected
                        ? "border-rose-300 bg-rose-50/20"
                        : "border-gray-200 hover:border-indigo-300"
                    }`}
                  >
                    {/* Left: Extension Badge + File Info */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center text-xs font-black shrink-0 tracking-wider shadow-2xs">
                        {ext}
                      </div>
                      <div className="min-w-0">
                        <span className="font-extrabold text-gray-900 text-xs sm:text-sm block truncate" title={fileName}>
                          {fileName}
                        </span>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-gray-500">
                          <span>
                            Sample Artwork Proof #{idx + 1}
                            {mFile.uploaded_at
                              ? ` · Uploaded ${
                                  String(mFile.uploaded_at).includes("-") || String(mFile.uploaded_at).includes("T")
                                    ? new Date(mFile.uploaded_at).toLocaleDateString("en-IN")
                                    : mFile.uploaded_at
                                }`
                              : ""}
                            {mFile.uploaded_by ? ` by ${mFile.uploaded_by}` : ""}
                          </span>
                        </div>
                        {isItemRejected && (
                          <div className="mt-1.5 p-2 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-900">
                            <b>Alteration Note:</b> {mFile.rejection_reason || "Correction requested"}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: View & Download Buttons + Actions */}
                    <div className="flex flex-wrap items-center gap-3 shrink-0 self-end md:self-center">
                      <div className="flex items-center gap-2">
                        <a
                          href={mFile.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                        >
                          <span>👁️</span>
                          <span>View</span>
                        </a>
                        <a
                          href={mFile.file_url}
                          download={fileName}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                        >
                          <span>⬇️</span>
                          <span>Download</span>
                        </a>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${
                          isItemApproved
                            ? "bg-emerald-100 text-emerald-800"
                            : isItemRejected
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {status}
                      </span>

                      <div className="flex items-center gap-2">
                        {isItemApproved ? (
                          <span className="text-emerald-700 font-bold text-xs flex items-center gap-1 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                            <span>✓</span>
                            <span>Approved by you</span>
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => handleSubmitFileAction(fileId, "master", "Approved")}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs transition cursor-pointer disabled:opacity-50"
                            >
                              ✓ Approve
                            </button>
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() =>
                                setActiveFileModal({
                                  fileId,
                                  fileType: "master",
                                  fileName,
                                  fileUrl: mFile.file_url,
                                })
                              }
                              className="px-3 py-1.5 bg-white border border-rose-300 hover:bg-rose-50 text-rose-700 rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-50"
                              title="Reject proof (optionally attach reference file)"
                            >
                              ✕ Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 border-2 border-dashed border-gray-200 rounded-2xl text-center text-gray-400 text-xs">
              No sample artwork proof files uploaded yet.
            </div>
          )
        ) : (
          /* PRODUCTION STAGE: Visual Image Gallery Preview & PDF */
          effectiveMasterFiles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {effectiveMasterFiles.map((mFile, idx) => {
                const fileId = mFile._id || mFile.file_url;
                const status = mFile.status || "Pending";
                const isItemApproved = status === "Approved";
                const isItemRejected = status === "Rejected";
                const isItemPending = !isItemApproved && !isItemRejected;
                const fileName = getDisplayFileName(mFile.file_url, `Master Proof Layout #${idx + 1}`);
                const isPdf = mFile.file_url?.toLowerCase().includes(".pdf") || fileName.toLowerCase().endsWith(".pdf");

                return (
                  <div
                    key={fileId || idx}
                    className={`border-2 rounded-2xl overflow-hidden bg-white transition-all shadow-sm flex flex-col ${
                      isItemApproved
                        ? "border-emerald-300"
                        : isItemRejected
                        ? "border-rose-300"
                        : "border-gray-200 hover:border-indigo-400"
                    }`}
                  >
                    {/* Image / Document Preview Box */}
                    {isPdf ? (
                      <div className="aspect-[4/3] w-full overflow-hidden flex flex-col items-center justify-center bg-slate-100 p-4 text-center">
                        <span className="text-4xl mb-2">📄</span>
                        <span className="text-xs font-bold text-gray-800 truncate max-w-[90%]">{fileName}</span>
                        <span className="text-[10px] text-gray-500 mt-1">PDF Artwork Proof</span>
                        <div className="flex items-center gap-2 mt-3">
                          <a
                            href={mFile.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                          >
                            <span>👁️</span> View Document ↗
                          </a>
                          <a
                            href={mFile.file_url}
                            download={fileName}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                          >
                            <span>⬇️</span> Download
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="aspect-[4/3] w-full overflow-hidden flex items-center justify-center bg-slate-100 p-2 relative group">
                        <img
                          src={mFile.file_url}
                          alt={fileName}
                          className="max-h-full max-w-full object-contain cursor-pointer transition group-hover:scale-102"
                          onClick={() => onOpenImage && onOpenImage(mFile.file_url)}
                        />
                        <button
                          type="button"
                          onClick={() => onOpenImage && onOpenImage(mFile.file_url)}
                          className="absolute inset-0 bg-gray-900/30 text-white flex items-center justify-center text-xs font-bold opacity-0 group-hover:opacity-100 transition cursor-pointer"
                        >
                          🔍 Click to Zoom Full Resolution
                        </button>
                      </div>
                    )}

                    {/* Attachment Info & Action Controls */}
                    <div className="p-4 bg-white flex-1 flex flex-col justify-between border-t border-gray-100 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-bold text-gray-900 text-xs block truncate" title={fileName}>
                            {fileName}
                          </span>
                          <span className="text-[10px] text-gray-400 block mt-0.5">
                            Attachment #{idx + 1}
                            {mFile.uploaded_at ? ` · Uploaded ${mFile.uploaded_at}` : ""}
                          </span>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${
                            isItemApproved
                              ? "bg-emerald-100 text-emerald-800"
                              : isItemRejected
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {status}
                        </span>
                      </div>

                      {/* Rejection reason callout if rejected */}
                      {isItemRejected && (
                        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-900">
                          <b>Alteration Note:</b> {mFile.rejection_reason || "Correction requested"}
                        </div>
                      )}

                      {/* Per-attachment Approve / Reject Buttons */}
                      <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              if (isPdf) {
                                window.open(mFile.file_url, "_blank");
                              } else if (onOpenImage) {
                                onOpenImage(mFile.file_url);
                              } else {
                                window.open(mFile.file_url, "_blank");
                              }
                            }}
                            className="text-indigo-600 hover:text-indigo-800 font-bold text-xs flex items-center gap-1 cursor-pointer"
                          >
                            <span>👁️</span>
                            <span>View</span>
                          </button>
                          <a
                            href={mFile.file_url}
                            download={fileName}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-600 hover:text-emerald-800 font-bold text-xs flex items-center gap-1 cursor-pointer"
                          >
                            <span>⬇️</span>
                            <span>Download</span>
                          </a>
                        </div>

                        <div className="flex items-center gap-2">
                          {isItemApproved ? (
                            <span className="text-emerald-700 font-bold text-xs flex items-center gap-1">
                              <span>✓</span>
                              <span>Approved by you</span>
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={() => handleSubmitFileAction(fileId, "master", "Approved")}
                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs transition cursor-pointer disabled:opacity-50"
                              >
                                ✓ Approve
                              </button>
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={() =>
                                  setActiveFileModal({
                                    fileId,
                                    fileType: "master",
                                    fileName,
                                    fileUrl: mFile.file_url,
                                  })
                                }
                                className="px-3 py-1.5 bg-white border border-rose-300 hover:bg-rose-50 text-rose-700 rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-50"
                                title="Reject proof (optionally attach reference file)"
                              >
                                ✕ Reject
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 border-2 border-dashed border-gray-200 rounded-2xl text-center text-gray-400 text-xs">
              No master template proof images uploaded yet.
            </div>
          )
        )}
      </div>

      {/* ============================================================== */}
      {/* STAGE 2: CONTENT PROOFING (NAME LISTS & TEXT PROOFS) */}
      {/* ============================================================== */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
          <div>
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
              <span>📋</span>
              <span>Stage 2: Content Proofing Documents (Name Lists)</span>
            </h3>
            <p className="text-[11px] text-gray-500">
              View and verify each content document / name list individually.
            </p>
          </div>
          {isMasterFullyApproved && hasContentPending && contentFiles.length > 1 && (
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleBulkStageApproval("proofing")}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs transition cursor-pointer disabled:opacity-50"
            >
              ✓ Approve All Content Files
            </button>
          )}
        </div>

        {/* ACCESS GATE: If at least 1 master template file is NOT approved */}
        {!hasMasterApproved ? (
          <div className="p-6 bg-slate-50 border-2 border-dashed border-gray-300 rounded-2xl text-center space-y-2">
            <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto text-lg font-bold">
              🔒
            </div>
            <h4 className="font-bold text-gray-800 text-sm">
              Stage 2 Content Proofing is Locked
            </h4>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Please review and approve at least one Master Template layout image in Stage 1 above. Once
              approved, our DTP studio will be granted access to upload the recipient name lists
              and content proof files for your approval.
            </p>
          </div>
        ) : contentFiles.length === 0 ? (
          <div className="p-6 bg-indigo-50/50 border border-indigo-200 rounded-2xl text-center space-y-2">
            <div className="text-2xl">⏳</div>
            <h4 className="font-bold text-indigo-950 text-sm">
              Master Template Approved! Content Proofing in Preparation
            </h4>
            <p className="text-xs text-indigo-700 max-w-md mx-auto">
              Your layout approval is confirmed. Our DTP studio is now preparing the laser text and
              recipient list documents. You will be able to view and approve them here once uploaded.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {contentFiles.map((cFile, idx) => {
              const fileId = cFile._id || cFile.file_url;
              const status = cFile.status || "Pending";
              const isItemApproved = status === "Approved";
              const isItemRejected = status === "Rejected";
              const fileName = getDisplayFileName(cFile.file_url, `Content Proof File #${idx + 1}`);

              return (
                <div
                  key={fileId || idx}
                  className={`p-4 rounded-xl border-2 transition-all bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isItemApproved
                      ? "border-emerald-300 bg-emerald-50/20"
                      : isItemRejected
                      ? "border-rose-300 bg-rose-50/20"
                      : "border-gray-200 hover:border-indigo-300"
                  }`}
                >
                  {/* File Info & View Link */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg font-bold shrink-0">
                      📄
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-gray-900 text-xs block truncate" title={fileName}>
                        {fileName}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-gray-400">
                          Content File #{idx + 1}
                          {cFile.uploaded_at ? ` · ${cFile.uploaded_at}` : ""}
                        </span>
                        <a
                          href={cFile.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1"
                        >
                          <span>👁️ View / Download Document ↗</span>
                        </a>
                      </div>
                      {isItemRejected && (
                        <div className="text-[10px] text-rose-700 font-semibold mt-1">
                          Alteration requested: {cFile.rejection_reason || "Corrections requested"}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions & Status */}
                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                        isItemApproved
                          ? "bg-emerald-100 text-emerald-800"
                          : isItemRejected
                          ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {status}
                    </span>

                    {isItemApproved ? (
                      <span className="text-emerald-700 font-bold text-xs flex items-center gap-1">
                        <span>✓</span>
                        <span>Approved</span>
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleSubmitFileAction(fileId, "proofing", "Approved")}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs transition cursor-pointer disabled:opacity-50"
                        >
                          ✓ Approve
                        </button>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() =>
                            setActiveFileModal({
                              fileId,
                              fileType: "proofing",
                              fileName,
                              fileUrl: cFile.file_url,
                            })
                          }
                          className="px-3 py-1.5 bg-white border border-rose-300 hover:bg-rose-50 text-rose-700 rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-50"
                          title="Reject proof (optionally attach reference file)"
                        >
                          ✕ Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CHECKLIST */}
      <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl mb-8 text-xs text-gray-700 space-y-2">
        <h4 className="font-bold text-indigo-950 uppercase tracking-wider text-[11px] mb-1">
          Proof Verification Checklist:
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-start gap-2 bg-white p-2.5 rounded-lg border border-indigo-100">
            <span className="text-indigo-600 font-bold">☑️</span>
            <div>
              <b className="text-gray-900 block text-[11px]">Spelling & Names</b>
              <span className="text-[10px] text-gray-500">
                Verify recipient names, titles, and dates.
              </span>
            </div>
          </div>
          <div className="flex items-start gap-2 bg-white p-2.5 rounded-lg border border-indigo-100">
            <span className="text-indigo-600 font-bold">☑️</span>
            <div>
              <b className="text-gray-900 block text-[11px]">Logo & Branding</b>
              <span className="text-[10px] text-gray-500">
                Check logo placement and correct proportions.
              </span>
            </div>
          </div>
          <div className="flex items-start gap-2 bg-white p-2.5 rounded-lg border border-indigo-100">
            <span className="text-indigo-600 font-bold">☑️</span>
            <div>
              <b className="text-gray-900 block text-[11px]">Layout & Alignment</b>
              <span className="text-[10px] text-gray-500">
                Confirm spacing, fonts, and print margins.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Signatures & Footer */}
      <div className="pt-6 border-t border-gray-200">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div className="border-t border-gray-400 pt-2 text-[10px] text-gray-500 font-semibold">
            For RD Custom Awards Pvt. Ltd.
          </div>
          <div className="border-t border-gray-400 pt-2 text-[10px] text-gray-500 font-semibold">
            DTP Design Studio Artist
          </div>
          <div className="border-t border-gray-400 pt-2 text-[10px] text-gray-500 font-semibold">
            Client Acceptance & Verification
          </div>
        </div>
      </div>
    </div>
  )}

  {/* PER-FILE REJECTION / ALTERATIONS MODAL */}
  {activeFileModal && (
    <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-gray-200">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h3 className="text-sm font-bold text-rose-700 flex items-center gap-2">
            <span>✕</span>
            <span>Reject Proof / Request Changes: {activeFileModal.fileName}</span>
          </h3>
          <button
            type="button"
            onClick={() => {
              setActiveFileModal(null);
              setFileAlterationNotes("");
              setFileReferenceFile(null);
            }}
            className="text-gray-400 hover:text-gray-600 text-base cursor-pointer"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-gray-600">
          Please specify what changes or corrections are needed for this specific {activeFileModal.fileType === "master" ? "layout image" : "content document"} (e.g. spelling error, alignment, logo sizing):
        </p>

        <textarea
          rows={4}
          value={fileAlterationNotes}
          onChange={(e) => setFileAlterationNotes(e.target.value)}
          placeholder="e.g. Please change the designation from 'Manager' to 'General Manager' and increase logo size by 10%."
          className="w-full p-3 text-xs border border-gray-300 rounded-xl outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-400"
        />

        {/* Optional reference file upload */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold text-gray-700">Upload Reference File</label>
            <span className="text-[11px] text-gray-400 font-medium">(Optional)</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-gray-700 rounded-lg text-xs font-semibold cursor-pointer border border-gray-300 transition">
              Choose file
              <input
                type="file"
                className="hidden"
                onChange={(e) => setFileReferenceFile(e.target.files?.[0] || null)}
              />
            </label>
            <span className="text-xs text-gray-500 truncate max-w-[200px]">
              {fileReferenceFile ? fileReferenceFile.name : "No file chosen"}
            </span>
            {fileReferenceFile && (
              <button
                type="button"
                onClick={() => setFileReferenceFile(null)}
                className="text-xs text-rose-600 hover:underline font-bold"
              >
                Remove
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={() => {
              setActiveFileModal(null);
              setFileAlterationNotes("");
              setFileReferenceFile(null);
            }}
            className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold text-xs rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting || !fileAlterationNotes.trim()}
            onClick={() =>
              handleSubmitFileAction(
                activeFileModal.fileId,
                activeFileModal.fileType,
                "Rejected",
                fileAlterationNotes,
                fileReferenceFile
              )
            }
            className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
          >
            {submitting ? "Submitting..." : "Confirm Rejection"}
          </button>
        </div>
      </div>
    </div>
  )}
</div>
  );
};

export default PublicProofApprovalView;
