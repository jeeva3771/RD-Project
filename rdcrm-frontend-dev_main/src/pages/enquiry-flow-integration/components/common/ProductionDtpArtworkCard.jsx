import React, { useState } from "react";
import { toast } from "react-toastify";
import { axiosInstance } from "../../../../utils/url/config";
import CommunicationLogForm from "./CommunicationLogForm";
import ArtworkProofSheet from "../Steps/ArtworkProofSheet";
import ImageLightbox from "../../../common/ImageLightbox";
import { dfmt } from "../../utils/helpers";

/**
 * ProductionDtpArtworkCard
 * 2-Stage Pipeline for Production Artwork (DTP):
 * Stage 1: Master Template Proof (DTP uploads -> View in card -> Client share link OR CS direct approval)
 * [HARD GATE]: At least 1 Master Template file must be approved before Content Proofing unlocks.
 * Stage 2: Content Proofing (DTP uploads content proof / name lists -> View in card -> Client share OR CS approval)
 */
const ProductionDtpArtworkCard = ({
  s,
  set,
  client,
  job,
  ids = {},
  currentProof = null,
  dtpProofs = null,
  setDtpProofs,
  subJobCode = "",
  targetJobId = "",
  onReloadProofs,
}) => {
  const d = s?.dtp?.production || s?.dtp?.prod || {};
  const round = d.round || 1;

  // Local state
  const [busy, setBusy] = useState(false);
  const [previewImg, setPreviewImg] = useState(null);
  const [showProofSheet, setShowProofSheet] = useState(false);
  const [showCommunicationModal, setShowCommunicationModal] = useState(false);
  const [commTargetStage, setCommTargetStage] = useState("all"); // "master" | "proofing" | "all"

  // Per-file rejection modal state
  const [rejectionModal, setRejectionModal] = useState(null); // { fileId, fileType, fileName, fileUrl }
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionRefFile, setRejectionRefFile] = useState(null);

  // Content file upload (for CS to upload recipient list to DTP)
  const [uploadingContent, setUploadingContent] = useState(false);

  // Derive active proof from dtpProofs or currentProof
  const activeProof = dtpProofs
    ? dtpProofs[subJobCode] ||
      dtpProofs[subJobCode.replace(/^RD/i, "")] ||
      dtpProofs[`RD${subJobCode.replace(/^RD/i, "")}`] ||
      Object.values(dtpProofs)[0] ||
      currentProof
    : currentProof;

  // Files derived from live DTP proofs
  const masterFiles = activeProof?.master_template_files || [];
  const contentFiles = activeProof?.content_proofing_files || [];

  const approvedMasterCount = masterFiles.filter((f) => f.status === "Approved").length;
  const rejectedMasterCount = masterFiles.filter((f) => f.status === "Rejected").length;
  const hasMasterApproved = approvedMasterCount > 0;
  const isMasterFullyApproved = masterFiles.length > 0 && approvedMasterCount === masterFiles.length;

  const approvedContentCount = contentFiles.filter((f) => f.status === "Approved").length;
  const rejectedContentCount = contentFiles.filter((f) => f.status === "Rejected").length;
  const hasContentApproved = approvedContentCount > 0;
  const isContentFullyApproved = contentFiles.length > 0 && approvedContentCount === contentFiles.length;

  // Overall completion status
  const isAllApproved = Boolean(
    d.approved ||
    (hasMasterApproved && hasContentApproved) ||
    (hasMasterApproved && contentFiles.length > 0 && isContentFullyApproved) ||
    activeProof?.production_proof_status === "approved" ||
    (s?.sub_jobs || []).some((sj) => sj.production_proof_status === "approved")
  );

  const getCleanFileName = (file, fallback = "Proof File") => {
    if (file?.original_name) return file.original_name;
    if (file?.name) return file.name;
    if (file?.file_url) {
      try {
        const clean = file.file_url.split("?")[0].split("/").pop();
        return decodeURIComponent(clean.replace(/^[A-Za-z0-9_-]+---/, "")) || fallback;
      } catch {
        return fallback;
      }
    }
    return fallback;
  };

  const fetchLatestProofs = React.useCallback(async (showToast = true) => {
    if (!targetJobId) return;
    try {
      setBusy(true);
      const res = await axiosInstance.get(`/enquiry-flow-integration/${targetJobId}/dtp-proofs?phase=production`);
      if (res.data?.success && res.data.proofs) {
        if (setDtpProofs) setDtpProofs(res.data.proofs);
        if (showToast) toast.success("DTP proofs synchronized!");
      }
      if (onReloadProofs) onReloadProofs();
    } catch (err) {
      console.warn("Could not reload DTP proofs:", err);
      if (showToast) toast.error("Could not sync DTP proofs.");
    } finally {
      setBusy(false);
    }
  }, [targetJobId, setDtpProofs, onReloadProofs]);

  React.useEffect(() => {
    fetchLatestProofs(false);
  }, [fetchLatestProofs]);

  const updateParentState = (patch) => {
    set({
      dtp: {
        ...(s.dtp || {}),
        production: {
          ...d,
          ...patch,
        },
        prod: {
          ...d,
          ...patch,
        },
      },
    });
  };

  // 1. Per-file Action: Approve or Reject
  const handleFileAction = async (fileId, fileType, status, reason = "", refFile = null) => {
    if (status === "Rejected" && !reason.trim()) {
      toast.warning("Please specify the reason for rejection.");
      return;
    }

    try {
      setBusy(true);
      const formData = new FormData();
      formData.append("fileId", fileId);
      formData.append("fileType", fileType);
      formData.append("status", status);
      formData.append("rejection_reason", reason.trim());
      formData.append("subJobNo", subJobCode);
      formData.append("phase", "production");
      formData.append(
        "clientName",
        client?.name ? `${client.name} (via Client Servicing)` : "Client Servicing"
      );
      if (refFile) {
        formData.append("reference_file", refFile);
      }

      const res = await axiosInstance.post(
        `/enquiry-flow-integration/${targetJobId}/cs-proof-feedback`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      if (res.data?.success) {
        toast.success(
          status === "Approved"
            ? `✓ ${fileType === "master" ? "Master Template file" : "Content proof file"} approved!`
            : `✓ Proof rejected. Feedback sent to DTP Studio.`
        );
        setRejectionModal(null);
        setRejectionReason("");
        setRejectionRefFile(null);
        await fetchLatestProofs();
      } else {
        toast.error(res.data?.message || "Failed to update file status.");
      }
    } catch (err) {
      console.error("Error updating file status:", err);
      toast.error(err.response?.data?.message || "Error updating file status.");
    } finally {
      setBusy(false);
    }
  };

  // 2. Bulk Stage Approval
  const handleBulkStageApproval = async (stage) => {
    try {
      setBusy(true);
      const res = await axiosInstance.post(`/enquiry-flow-integration/${targetJobId}/cs-proof-feedback`, {
        stage, // "master" | "proofing"
        decision: "approved",
        status: "Approved",
        subJobNo: subJobCode,
        phase: "production",
        clientName: client?.name ? `${client.name} (via Client Servicing)` : "Client Servicing",
      });

      if (res.data?.success) {
        toast.success(
          stage === "master"
            ? "✓ All Master Template layout files approved! Stage 2 Content Proofing unlocked."
            : "✓ All Content Proofing files approved!"
        );
        await fetchLatestProofs();
      } else {
        toast.error(res.data?.message || "Failed to bulk approve stage.");
      }
    } catch (err) {
      console.error("Error bulk approving stage:", err);
      toast.error(err.response?.data?.message || "Network error during approval.");
    } finally {
      setBusy(false);
    }
  };

  // 3. Client Servicing Logs Communication Approval
  const handleLogCommunicationApproval = async (logData) => {
    try {
      setBusy(true);
      const channel = logData?.channel || logData?.method || logData?.mode || "Client Communication";
      const remarks = logData?.notes || logData?.remarks || "Approved via Client Servicing Discussion";

      await axiosInstance.post(`/enquiry-flow-integration/${targetJobId}/cs-proof-feedback`, {
        stage: commTargetStage, // "master" | "proofing" | "all"
        decision: "approved",
        status: "Approved",
        subJobNo: subJobCode,
        phase: "production",
        clientName: `${client?.name || "Client"} (via CS: ${logData?.by || "Coordinator"})`,
        remarks: `${channel}: ${remarks}`,
      });

      updateParentState({
        approved: logData,
        proofSent: d.proofSent || channel,
      });

      await fetchLatestProofs();
      toast.success(
        commTargetStage === "master"
          ? "Master Template approval recorded from client communication!"
          : commTargetStage === "proofing"
          ? "Content proofing approval recorded!"
          : "Production artwork approval recorded successfully!"
      );
    } catch (err) {
      console.error("Error logging client communication approval:", err);
      toast.error(err.response?.data?.message || "Failed to record approval.");
    } finally {
      setBusy(false);
      setShowCommunicationModal(false);
    }
  };

  // 4. Client Servicing Uploads Content File (e.g. .xlsx, .docx) for DTP Artist
  const handleUploadContentFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingContent(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("subJobNo", subJobCode);
      formData.append("phase", "production");
      formData.append("fileCategory", "content");

      const res = await axiosInstance.post(
        `/enquiry-flow-integration/${targetJobId}/upload-artwork-proof`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      if (res.data?.success) {
        toast.success(`Content file "${file.name}" uploaded and sent to DTP Studio!`);
        await fetchLatestProofs();
      } else {
        toast.error(res.data?.message || "Failed to upload content file.");
      }
    } catch (err) {
      console.error("Error uploading content file:", err);
      toast.error(err.response?.data?.message || "Failed to upload content file.");
    } finally {
      setUploadingContent(false);
      if (e.target) e.target.value = "";
    }
  };

  // 5. Quick Copy Public Review Link
  const handleCopyReviewLink = async () => {
    try {
      const res = await axiosInstance.get(`/enquiry-flow-integration/${targetJobId}/public-link`, {
        params: {
          subjobs: subJobCode,
          duration: 48,
          tab: "proof",
          phase: "production",
        },
      });

      if (res.data?.success && res.data.url) {
        navigator.clipboard?.writeText(res.data.url);
        toast.success("Client proof review link copied to clipboard!");
      } else {
        const fallbackUrl = `${window.location.origin}/rd/quote-view/${targetJobId}?tab=proof&subjobs=${encodeURIComponent(subJobCode)}&phase=production`;
        navigator.clipboard?.writeText(fallbackUrl);
        toast.info("Review link copied to clipboard!");
      }
    } catch (err) {
      const fallbackUrl = `${window.location.origin}/rd/quote-view/${targetJobId}?tab=proof&subjobs=${encodeURIComponent(subJobCode)}&phase=production`;
      navigator.clipboard?.writeText(fallbackUrl);
      toast.info("Review link copied to clipboard!");
    }
  };

  // Completed State View
  if (isAllApproved && !rejectionModal && !showCommunicationModal) {
    return (
      <div className="w-full bg-emerald-50/70 border-2 border-emerald-300 rounded-xl p-5 shadow-2xs transition-all">
        {showProofSheet && (
          <ArtworkProofSheet
            s={s}
            set={set}
            client={client}
            job={job}
            ids={ids}
            phase="production"
            dtpProofData={currentProof}
            onBack={() => setShowProofSheet(false)}
            onMarkSent={(method) => {
              updateParentState({ proofSent: method || "WhatsApp" });
              setShowProofSheet(false);
            }}
          />
        )}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-base font-black shrink-0 shadow-2xs">
              ✓
            </span>
            <div>
              <div className="flex items-center gap-2">
                <b className="text-sm text-gray-900 font-bold">
                  Production artwork (DTP) · Fully Approved
                </b>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
                  Ready for Production
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Master template layout and content proofing files have been approved. The order is released for manufacturing run.
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-gray-500 font-medium">
                <span>• Master Template: {approvedMasterCount} approved</span>
                <span>• Content Proofing: {approvedContentCount} approved</span>
                {currentProof?.assigned_to_name && (
                  <span>• DTP Artist: {currentProof.assigned_to_name}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowProofSheet(true)}
              className="px-3.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-lg transition shadow-2xs cursor-pointer"
            >
              📄 View Proof Sheet
            </button>
            <button
              type="button"
              onClick={() => {
                updateParentState({ approved: null });
                toast.info("DTP reopened for modifications.");
              }}
              className="text-xs font-bold text-gray-500 hover:text-gray-800 underline cursor-pointer ml-1"
            >
              Reopen
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white border-2 border-indigo-400 rounded-xl shadow-sm overflow-hidden transition-all">
      {/* Proof Sheet Modal Overlay */}
      {showProofSheet && (
        <ArtworkProofSheet
          s={s}
          set={set}
          client={client}
          job={job}
          ids={ids}
          phase="production"
          dtpProofData={currentProof}
          onBack={() => setShowProofSheet(false)}
          onMarkSent={(method) => {
            updateParentState({ proofSent: method || "WhatsApp" });
            setShowProofSheet(false);
          }}
        />
      )}

      {/* Card Header & Pipeline Tracker */}
      <div className="p-4 sm:p-5 border-b border-gray-100 bg-slate-50/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-sm font-bold shadow-2xs">
              🎨
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-sm text-gray-900">
                  Production artwork (DTP)
                </h4>
                <span className="text-[11px] font-semibold text-gray-500">
                  · Sub-job {subJobCode}
                </span>
                {currentProof?.assigned_to_name && (
                  <span className="text-[10px] bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold px-2 py-0.5 rounded-full">
                    Artist: {currentProof.assigned_to_name}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                2-Stage Approval Pipeline: Stage 1 Master Template layout proof ➔ Stage 2 Content proofing & recipient lists.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={fetchLatestProofs}
              disabled={busy}
              className="px-3 py-1.5 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1 cursor-pointer"
              title="Refresh proofs from DTP Studio"
            >
              <span>🔄</span>
              <span>Sync with DTP</span>
            </button>
            <button
              type="button"
              onClick={handleCopyReviewLink}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-bold transition shadow-2xs flex items-center gap-1 cursor-pointer"
            >
              <span>📋</span>
              <span>Copy Client Link</span>
            </button>
          </div>
        </div>

        {/* 2-STAGE PROGRESS TRACKER BAR */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-3 border-t border-gray-200/60 text-xs">
          {/* Tracker Stage 1 */}
          <div
            className={`p-2.5 rounded-lg border flex items-center justify-between ${
              hasMasterApproved
                ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                : masterFiles.length > 0
                ? "bg-amber-50 border-amber-300 text-amber-900"
                : "bg-white border-gray-200 text-gray-600"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-[10px] font-black">
                {hasMasterApproved ? "✓" : "1"}
              </span>
              <div>
                <span className="font-bold text-[11px] block">Stage 1: Master Template</span>
                <span className="text-[10px] block opacity-80">
                  {hasMasterApproved
                    ? `${approvedMasterCount} approved · Unlocked Stage 2`
                    : masterFiles.length > 0
                    ? `${masterFiles.length} uploaded · Awaiting approval`
                    : "Awaiting DTP upload"}
                </span>
              </div>
            </div>
            <span
              className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                hasMasterApproved
                  ? "bg-emerald-200 text-emerald-950"
                  : masterFiles.length > 0
                  ? "bg-amber-200 text-amber-950"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {hasMasterApproved ? "Approved" : masterFiles.length > 0 ? "Pending" : "Waiting DTP"}
            </span>
          </div>

          {/* Tracker Stage 2 */}
          <div
            className={`p-2.5 rounded-lg border flex items-center justify-between ${
              !hasMasterApproved
                ? "bg-gray-50 border-gray-200 text-gray-400 opacity-80"
                : hasContentApproved
                ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                : contentFiles.length > 0
                ? "bg-indigo-50 border-indigo-300 text-indigo-900"
                : "bg-amber-50/60 border-amber-200 text-amber-900"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-[10px] font-black">
                {!hasMasterApproved ? "🔒" : hasContentApproved ? "✓" : "2"}
              </span>
              <div>
                <span className="font-bold text-[11px] block">Stage 2: Content Proofing</span>
                <span className="text-[10px] block opacity-80">
                  {!hasMasterApproved
                    ? "Locked (requires Stage 1 approval)"
                    : hasContentApproved
                    ? `${approvedContentCount} approved · Ready`
                    : contentFiles.length > 0
                    ? `${contentFiles.length} file(s) · Awaiting review`
                    : "Stage unlocked · Awaiting files"}
                </span>
              </div>
            </div>
            <span
              className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                !hasMasterApproved
                  ? "bg-gray-200 text-gray-600"
                  : hasContentApproved
                  ? "bg-emerald-200 text-emerald-950"
                  : "bg-indigo-100 text-indigo-800"
              }`}
            >
              {!hasMasterApproved ? "Locked" : hasContentApproved ? "Approved" : "In Progress"}
            </span>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* ============================================================== */}
        {/* STAGE 1: MASTER TEMPLATE PROOF FILES & ACTIONS */}
        {/* ============================================================== */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-gray-900 uppercase tracking-wide">
                  Stage 1: Master Template Proof
                </span>
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                    hasMasterApproved
                      ? "bg-emerald-100 text-emerald-800"
                      : rejectedMasterCount > 0
                      ? "bg-rose-100 text-rose-800"
                      : masterFiles.length > 0
                      ? "bg-amber-100 text-amber-800"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {hasMasterApproved
                    ? `✓ Approved (${approvedMasterCount}/${masterFiles.length})`
                    : rejectedMasterCount > 0
                    ? "Alterations Requested"
                    : masterFiles.length > 0
                    ? "Awaiting Approval"
                    : "No Files Uploaded"}
                </span>
              </div>
              <p className="text-[11px] text-gray-500">
                Visual artwork layout, dimensions, positioning & styling from DTP. Client or CS must approve at least 1 file.
              </p>
            </div>

            {/* Quick Actions for Stage 1 */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowProofSheet(true)}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>📤</span>
                <span>Share Proof with Client</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCommTargetStage("master");
                  setShowCommunicationModal(true);
                }}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-2xs flex items-center gap-1 cursor-pointer"
              >
                <span>✓</span>
                <span>Client Communicated & Approve</span>
              </button>

              {masterFiles.length > 1 && !isMasterFullyApproved && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleBulkStageApproval("master")}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Approve All Master Files
                </button>
              )}
            </div>
          </div>

          {/* Master Template Files List / Gallery */}
          {masterFiles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {masterFiles.map((mFile, idx) => {
                const fileId = mFile._id || mFile.file_url;
                const status = mFile.status || "Pending";
                const isApproved = status === "Approved";
                const isRejected = status === "Rejected";
                const fileName = getCleanFileName(mFile, `Master Proof Layout #${idx + 1}`);
                const isPdf = mFile.file_url?.toLowerCase().includes(".pdf");

                return (
                  <div
                    key={fileId || idx}
                    className={`border-2 rounded-xl overflow-hidden bg-white shadow-2xs flex flex-col justify-between transition-all ${
                      isApproved
                        ? "border-emerald-300"
                        : isRejected
                        ? "border-rose-300"
                        : "border-gray-200 hover:border-indigo-300"
                    }`}
                  >
                    {/* Preview Area */}
                    <div className="h-36 w-full bg-slate-100 flex items-center justify-center relative overflow-hidden group">
                      {isPdf ? (
                        <div className="flex flex-col items-center justify-center p-3 text-center">
                          <span className="text-3xl text-rose-500">📄</span>
                          <span className="text-[11px] font-bold text-gray-800 mt-1 truncate max-w-[180px]">
                            {fileName}
                          </span>
                          <span className="text-[9px] text-gray-400">PDF Proof Document</span>
                        </div>
                      ) : (
                        <img
                          src={mFile.file_url}
                          alt={fileName}
                          className="h-full w-full object-contain cursor-pointer transition group-hover:scale-105"
                          onClick={() => setPreviewImg(mFile.file_url)}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (isPdf) {
                            window.open(mFile.file_url, "_blank");
                          } else {
                            setPreviewImg(mFile.file_url);
                          }
                        }}
                        className="absolute inset-0 bg-gray-900/40 text-white flex items-center justify-center text-xs font-bold opacity-0 group-hover:opacity-100 transition cursor-pointer"
                      >
                        🔍 Zoom / Full View
                      </button>
                    </div>

                    {/* Metadata & Actions */}
                    <div className="p-3 space-y-2 border-t border-gray-100">
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0">
                          <span className="font-bold text-xs text-gray-900 block truncate" title={fileName}>
                            {fileName}
                          </span>
                          <span className="text-[10px] text-gray-400 block">
                            {mFile.uploaded_at ? `Uploaded ${dfmt(mFile.uploaded_at)}` : "Uploaded recently"}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shrink-0 ${
                            isApproved
                              ? "bg-emerald-100 text-emerald-800"
                              : isRejected
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {status}
                        </span>
                      </div>

                      {/* Rejection Note & Reference File */}
                      {isRejected && (
                        <div className="p-2 bg-rose-50 border border-rose-200 rounded text-[10px] text-rose-900 space-y-1">
                          <div><b>Rejection:</b> {mFile.rejection_reason || "Proof rejected"}</div>
                          {mFile.rejection_reference_file && (
                            <a
                              href={mFile.rejection_reference_file}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-rose-700 hover:underline font-bold inline-flex items-center gap-1"
                            >
                              <span>📎</span> View reference file
                            </a>
                          )}
                        </div>
                      )}

                      {/* Bottom Action Row */}
                      <div className="flex items-center justify-between pt-1 border-t border-gray-100 text-xs">
                        <div className="flex items-center gap-2">
                          <a
                            href={mFile.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-indigo-600 hover:text-indigo-800 text-[11px]"
                          >
                            👁️ View
                          </a>
                          <a
                            href={mFile.file_url}
                            download={fileName}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-emerald-600 hover:text-emerald-800 text-[11px]"
                          >
                            ⬇️ Download
                          </a>
                        </div>

                        {/* CS Approve / Reject Buttons (2 options) */}
                        <div className="flex items-center gap-1.5">
                          {isApproved ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                              <span>✓</span> Approved
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  setRejectionModal({
                                    fileId,
                                    fileType: "master",
                                    fileName,
                                    fileUrl: mFile.file_url,
                                  })
                                }
                                className="px-2.5 py-1 bg-white border border-rose-300 hover:bg-rose-50 text-rose-700 font-bold text-[10px] rounded transition cursor-pointer"
                                title="Reject proof (optionally attach reference file)"
                              >
                                ✕ Reject
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleFileAction(fileId, "master", "Approved")}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded transition shadow-2xs cursor-pointer"
                                title="Approve proof"
                              >
                                ✓ Approve
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
            <div className="p-8 border-2 border-dashed border-gray-200 rounded-xl text-center space-y-2 bg-slate-50/40">
              <span className="text-3xl block">🎨</span>
              <p className="text-xs font-bold text-gray-700">
                Awaiting Master Template layout files from DTP Studio
              </p>
              <p className="text-[11px] text-gray-400 max-w-md mx-auto">
                Once the job is in DTP Studio, the artist will upload the layout proof images. They will immediately appear here for your review and client approval.
              </p>
              <button
                type="button"
                onClick={fetchLatestProofs}
                className="px-3.5 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold transition cursor-pointer mt-2 inline-flex items-center gap-1"
              >
                <span>🔄</span> Check for new DTP files
              </button>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* HARD GATE BANNER: MUST APPROVE AT LEAST 1 MASTER TEMPLATE FILE */}
        {/* ============================================================== */}
        <div
          className={`p-4 rounded-xl border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            hasMasterApproved
              ? "bg-emerald-50/80 border-emerald-300 text-emerald-900"
              : "bg-amber-50/80 border-amber-300 text-amber-900"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-current/20 flex items-center justify-center text-sm font-black shrink-0">
              {hasMasterApproved ? "✓" : "🔒"}
            </span>
            <div>
              <span className="font-extrabold text-xs block">
                {hasMasterApproved
                  ? "Master Template Approved · Stage 2 Unlocked"
                  : "Gate Protection: Master Template Approval Required"}
              </span>
              <p className="text-[11px] mt-0.5 opacity-90">
                {hasMasterApproved
                  ? `At least one Master Template file is approved (${approvedMasterCount} approved). DTP Studio is authorized to proceed to Stage 2 Content Proofing.`
                  : "At least one Master Template file must be approved before moving to Content Proofing. Stage 2 content files remain locked until layout approval."}
              </p>
            </div>
          </div>
          {hasMasterApproved ? (
            <span className="px-3 py-1 bg-emerald-200 text-emerald-950 font-black rounded-lg text-[10px] uppercase shrink-0">
              ✓ Gate Passed
            </span>
          ) : (
            <span className="px-3 py-1 bg-amber-200 text-amber-950 font-black rounded-lg text-[10px] uppercase shrink-0">
              🔒 Content Locked
            </span>
          )}
        </div>

        {/* ============================================================== */}
        {/* STAGE 2: CONTENT PROOFING & NAME LISTS */}
        {/* ============================================================== */}
        <div
          className={`space-y-3 transition-all ${
            !hasMasterApproved ? "opacity-50 pointer-events-none select-none" : ""
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-gray-900 uppercase tracking-wide">
                  Stage 2: Content Proofing (Name Lists & Text)
                </span>
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                    !hasMasterApproved
                      ? "bg-gray-200 text-gray-600"
                      : hasContentApproved
                      ? "bg-emerald-100 text-emerald-800"
                      : rejectedContentCount > 0
                      ? "bg-rose-100 text-rose-800"
                      : contentFiles.length > 0
                      ? "bg-indigo-100 text-indigo-800"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {!hasMasterApproved
                    ? "Locked"
                    : hasContentApproved
                    ? `✓ Approved (${approvedContentCount}/${contentFiles.length})`
                    : rejectedContentCount > 0
                    ? "Alterations Requested"
                    : contentFiles.length > 0
                    ? "Awaiting Approval"
                    : "Awaiting DTP Upload"}
                </span>
              </div>
              <p className="text-[11px] text-gray-500">
                Recipient name lists, text proofs, typography documents from DTP Studio for final run approval.
              </p>
            </div>

            {/* Quick Actions for Stage 2 */}
            {hasMasterApproved && (
              <div className="flex flex-wrap items-center gap-2">
                <label className="px-3.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-bold transition shadow-2xs flex items-center gap-1.5 cursor-pointer">
                  <span>📎</span>
                  <span>{uploadingContent ? "Uploading..." : "Upload Content File (.xlsx, .doc)"}</span>
                  <input
                    type="file"
                    hidden
                    disabled={uploadingContent || busy}
                    accept=".xlsx,.csv,.docx,.pdf,.doc"
                    onChange={handleUploadContentFile}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setShowProofSheet(true)}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span>📤</span>
                  <span>Share with Client</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCommTargetStage("proofing");
                    setShowCommunicationModal(true);
                  }}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-2xs flex items-center gap-1 cursor-pointer"
                >
                  <span>✓</span>
                  <span>Client Communicated & Approve</span>
                </button>

                {contentFiles.length > 1 && !isContentFullyApproved && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleBulkStageApproval("proofing")}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    Approve All Content Files
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Content Proofing Files List */}
          {hasMasterApproved && contentFiles.length > 0 ? (
            <div className="space-y-2.5">
              {contentFiles.map((cFile, idx) => {
                const fileId = cFile._id || cFile.file_url;
                const status = cFile.status || "Pending";
                const isApproved = status === "Approved";
                const isRejected = status === "Rejected";
                const fileName = getCleanFileName(cFile, `Content Proof Document #${idx + 1}`);

                return (
                  <div
                    key={fileId || idx}
                    className={`p-3.5 rounded-xl border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isApproved
                        ? "border-emerald-300 bg-emerald-50/20"
                        : isRejected
                        ? "border-rose-300 bg-rose-50/20"
                        : "border-gray-200 hover:border-indigo-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center text-lg font-bold shrink-0">
                        📄
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-gray-900 block truncate" title={fileName}>
                          {fileName}
                        </span>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[10px] text-gray-400">
                          <span>Proof #{idx + 1}</span>
                          {cFile.uploaded_at && <span>• Uploaded {dfmt(cFile.uploaded_at)}</span>}
                          {cFile.uploaded_by && <span>• By {cFile.uploaded_by}</span>}
                        </div>
                        {isRejected && (
                          <div className="mt-1 p-1.5 bg-rose-50 border border-rose-200 rounded text-[10px] text-rose-900 space-y-1">
                            <div><b>Rejection:</b> {cFile.rejection_reason || "Proof rejected"}</div>
                            {cFile.rejection_reference_file && (
                              <a
                                href={cFile.rejection_reference_file}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-rose-700 hover:underline font-bold inline-flex items-center gap-1"
                              >
                                <span>📎</span> View reference file
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 shrink-0 self-end sm:self-center">
                      <div className="flex items-center gap-2 text-xs">
                        <a
                          href={cFile.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded font-bold transition text-[11px]"
                        >
                          👁️ View
                        </a>
                        <a
                          href={cFile.file_url}
                          download={fileName}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded font-bold transition text-[11px]"
                        >
                          ⬇️ Download
                        </a>
                      </div>

                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                          isApproved
                            ? "bg-emerald-100 text-emerald-800"
                            : isRejected
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {status}
                      </span>

                      {/* CS Approve / Reject Buttons (2 options) */}
                      <div className="flex items-center gap-1.5">
                        {isApproved ? (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 flex items-center gap-1">
                            <span>✓</span> Approved
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                setRejectionModal({
                                  fileId,
                                  fileType: "proofing",
                                  fileName,
                                  fileUrl: cFile.file_url,
                                })
                              }
                              className="px-2.5 py-1 bg-white border border-rose-300 hover:bg-rose-50 text-rose-700 font-bold text-xs rounded transition cursor-pointer"
                              title="Reject proof (optionally attach reference file)"
                            >
                              ✕ Reject
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleFileAction(fileId, "proofing", "Approved")}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded transition shadow-2xs cursor-pointer"
                              title="Approve proof"
                            >
                              ✓ Approve
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : hasMasterApproved ? (
            <div className="p-6 border-2 border-dashed border-gray-200 rounded-xl text-center space-y-2 bg-slate-50/40">
              <span className="text-3xl block">📋</span>
              <p className="text-xs font-bold text-gray-700">
                Master Template approved! Awaiting Content Proofing files from DTP Studio
              </p>
              <p className="text-[11px] text-gray-400 max-w-md mx-auto">
                DTP Studio is preparing the name lists and content proofs. You can also upload a recipient spreadsheet or name file directly to DTP using the button above.
              </p>
            </div>
          ) : (
            <div className="p-6 border-2 border-dashed border-gray-200 rounded-xl text-center text-gray-400 text-xs">
              🔒 Stage 2 Content Proofing will appear once Master Template is approved.
            </div>
          )}
        </div>
      </div>

      {/* Rejection Modal with Optional Reference File */}
      {rejectionModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={() => {
            setRejectionModal(null);
            setRejectionReason("");
            setRejectionRefFile(null);
          }}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-sm text-rose-700 flex items-center gap-1.5">
                <span>✕</span>
                <span>Reject Proof / Request Changes</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setRejectionModal(null);
                  setRejectionReason("");
                  setRejectionRefFile(null);
                }}
                className="text-gray-400 hover:text-gray-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <span className="text-xs font-bold text-gray-700 block mb-1">Target Proof File:</span>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-gray-800 truncate">
                {rejectionModal.fileName}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Reason for Rejection / Changes Required: <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={4}
                className="w-full p-2.5 text-xs border border-gray-300 rounded-lg focus:border-rose-500 focus:ring-1 focus:ring-rose-400 outline-none"
                placeholder="Specify corrections needed (spelling, fonts, logo resize, alignment)..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>

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
                    onChange={(e) => setRejectionRefFile(e.target.files?.[0] || null)}
                  />
                </label>
                <span className="text-xs text-gray-500 truncate max-w-[200px]">
                  {rejectionRefFile ? rejectionRefFile.name : "No file chosen"}
                </span>
                {rejectionRefFile && (
                  <button
                    type="button"
                    onClick={() => setRejectionRefFile(null)}
                    className="text-xs text-rose-600 hover:underline font-bold"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => {
                  setRejectionModal(null);
                  setRejectionReason("");
                  setRejectionRefFile(null);
                }}
                className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !rejectionReason.trim()}
                onClick={() =>
                  handleFileAction(
                    rejectionModal.fileId,
                    rejectionModal.fileType,
                    "Rejected",
                    rejectionReason,
                    rejectionRefFile
                  )
                }
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-2xs transition cursor-pointer"
              >
                {busy ? "Submitting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Communication Log Modal */}
      {showCommunicationModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={() => setShowCommunicationModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowCommunicationModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 font-bold text-sm cursor-pointer"
            >
              ✕
            </button>
            <h4 className="text-sm font-extrabold text-gray-900 mb-3">
              Log Client Discussion & Approval (
              {commTargetStage === "master"
                ? "Stage 1: Master Template"
                : commTargetStage === "proofing"
                ? "Stage 2: Content Proofing"
                : "Both Stages"}
              )
            </h4>
            <p className="text-xs text-gray-500 mb-4">
              Record the client conversation (via phone, WhatsApp, or in-person) and immediately mark the selected proof stage as approved.
            </p>
            <CommunicationLogForm
              client={client}
              mode="design"
              feedbackMode="approve"
              hideCard={true}
              onBack={() => setShowCommunicationModal(false)}
              onLog={handleLogCommunicationApproval}
            />
          </div>
        </div>
      )}

      {/* Image Zoom Lightbox */}
      {previewImg && (
        <ImageLightbox
          src={previewImg}
          fileName="Production Artwork Proof"
          onClose={() => setPreviewImg(null)}
        />
      )}
    </div>
  );
};

export default ProductionDtpArtworkCard;
