import React, { useState, useEffect } from "react";
import { dtpOf, dtpState, DTP_LABEL, proofLine, dfmt, allReady, allItems } from "../../utils/helpers";
import CommunicationLogForm from "./CommunicationLogForm";
import ArtworkProofSheet from "../Steps/ArtworkProofSheet";
import ImageLightbox from "../../../common/ImageLightbox";
import { axiosInstance } from "../../../../utils/url/config";
import AssetRequirementGateModal from "./AssetRequirementGateModal";
import AssetUploadModal from "./AssetUploadModal";
import { checkMandatoryAssetsReadiness } from "../../utils/assetValidationHelpers";
import { toast } from "react-toastify";
import ProductionDtpArtworkCard from "./ProductionDtpArtworkCard";

const ArtworkPanel = ({ s, set, client, job, ids = {}, phase = "sample" }) => {
  const d = dtpOf(s, phase);
  const st = dtpState(s, phase);
  const isS = phase === "sample";
  const round = d.round || 1;
  const title = isS ? "Sample artwork (DTP)" : "Production artwork (DTP)";

  const [busy, setBusy] = useState(false);
  const [cap, setCap] = useState(false);
  const [corrOpen, setCorrOpen] = useState(false);
  const [corrText, setCorrText] = useState("");
  const [showProofSheet, setShowProofSheet] = useState(false);
  const [inputText, setInputText] = useState(d.text || "");
  const [fileName, setFileName] = useState(d.content?.name || "");

  // Live DTP Proofs state
  const targetJobId =
    s?.dbJobId || s?.rawJob?._id || s?._id || job?._id || ids?.jobId || ids?.enqId || s?.seq;
  const [dtpProofs, setDtpProofs] = useState(null);
  const [loadingDtp, setLoadingDtp] = useState(false);
  const [previewImg, setPreviewImg] = useState(null);

  // Tier 2 Production DTP Asset Enforcement Gate State
  const [showDtpGateModal, setShowDtpGateModal] = useState(false);
  const [dtpGateMissingItems, setDtpGateMissingItems] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedUploadProduct, setSelectedUploadProduct] = useState(null);

  useEffect(() => {
    if (!targetJobId) return;
    let isMounted = true;
    const fetchProofs = async () => {
      try {
        setLoadingDtp(true);
        const res = await axiosInstance.get(`/enquiry-flow-integration/${targetJobId}/dtp-proofs?phase=${phase}`);
        if (isMounted && res.data?.success && res.data.proofs) {
          setDtpProofs(res.data.proofs);
        }
      } catch (err) {
        console.warn("Could not fetch live DTP proofs:", err);
      } finally {
        if (isMounted) setLoadingDtp(false);
      }
    };
    fetchProofs();
    return () => {
      isMounted = false;
    };
  }, [targetJobId, phase]);

  const parentJobNo = s?.seq
    ? String(s.seq).startsWith("RD")
      ? s.seq
      : `RD${s.seq}`
    : (ids?.enq?.startsWith("RD") ? ids.enq : ids?.enq?.replace("ENQ/26/", "RD")) || "RD21071";
  const subJobCode = s?.e?.subJobNo || `${parentJobNo}-A1`;

  const currentProof = dtpProofs
    ? dtpProofs[subJobCode] ||
    dtpProofs[subJobCode.replace(/^RD/i, "")] ||
    dtpProofs[`RD${subJobCode.replace(/^RD/i, "")}`] ||
    Object.values(dtpProofs)[0] ||
    null
    : null;

  // Production Phase: Delegate to dedicated 2-Stage DTP Pipeline Card (Master Template -> Gate -> Content Proofing)
  if (!isS) {
    return (
      <ProductionDtpArtworkCard
        s={s}
        set={set}
        client={client}
        job={job}
        ids={ids}
        currentProof={currentProof}
        dtpProofs={dtpProofs}
        setDtpProofs={setDtpProofs}
        subJobCode={subJobCode}
        targetJobId={targetJobId}
        onReloadProofs={async () => {
          if (!targetJobId) return;
          try {
            const res = await axiosInstance.get(`/enquiry-flow-integration/${targetJobId}/dtp-proofs?phase=production`);
            if (res.data?.success && res.data.proofs) {
              setDtpProofs(res.data.proofs);
            }
          } catch (err) {
            console.warn("Could not reload dtp proofs:", err);
          }
        }}
      />
    );
  }

  const liveMasterProofs = currentProof?.master_template_files || [];
  const liveContentProofs = currentProof?.content_proofing_files || [];
  const hasLiveProofs = liveMasterProofs.length > 0 || liveContentProofs.length > 0;
  const isMasterApproved =
    Boolean(currentProof?.is_master_approved) ||
    (liveMasterProofs.length > 0 && liveMasterProofs.every((f) => f.status === "Approved"));
  const isContentApproved =
    Boolean(currentProof?.is_content_approved) ||
    (liveContentProofs.length > 0 && liveContentProofs.every((f) => f.status === "Approved"));

  const isProofApproved = Boolean(
    st === "approved" ||
    d.approved ||
    d.proofFile?.status === "Approved" ||
    (Array.isArray(d.proofFiles) && d.proofFiles.some((f) => f.status === "Approved")) ||
    (s?.wizard_state?.dtp?.[phase]?.approved) ||
    (s?.wizard_state?.dtp?.[phase]?.proofFile?.status === "Approved") ||
    (s?.wizard_state?.dtp?.[isS ? "sample" : "production"]?.approved) ||
    (s?.wizard_state?.dtp?.[isS ? "sample" : "production"]?.proofFile?.status === "Approved") ||
    (isS
      ? (
          currentProof?.proof_status === "approved" ||
          isMasterApproved ||
          currentProof?.is_master_approved ||
          d.proofFile?.status === "Approved" ||
          (s?.sub_jobs || []).some((sj) => sj.sample_proof_status === "approved" || sj.proof_status === "approved" || sj.master_template_status === "approved") ||
          (job?.sub_jobs || []).some((sj) => sj.sample_proof_status === "approved" || sj.proof_status === "approved" || sj.master_template_status === "approved") ||
          (s?.rawJob?.sub_jobs || []).some((sj) => sj.sample_proof_status === "approved" || sj.proof_status === "approved" || sj.master_template_status === "approved")
        )
      : (
          (isMasterApproved && isContentApproved) ||
          currentProof?.production_proof_status === "approved" ||
          (s?.sub_jobs || []).some((sj) => sj.production_proof_status === "approved") ||
          (job?.sub_jobs || []).some((sj) => sj.production_proof_status === "approved") ||
          (s?.rawJob?.sub_jobs || []).some((sj) => sj.production_proof_status === "approved")
        )
    )
  );

  // Effective DTP state: If live DTP files exist from DTP Studio or approved, calculate accurately
  const effectiveSt = isProofApproved
    ? "approved"
    : hasLiveProofs && (st === "content" || st === "ready" || st === "dtp")
      ? d.proofSent
        ? "client"
        : "proof"
      : st;

  const up = (p) => {
    const norm = isS ? "sample" : "prod";
    const alt = isS ? "sample" : "production";
    set({
      dtp: {
        ...(s.dtp || {}),
        [phase]: {
          ...d,
          ...p
        },
        [norm]: {
          ...d,
          ...p
        },
        [alt]: {
          ...d,
          ...p
        }
      }
    });
  };

  const handleSendToDTP = () => {
    if (!isS) {
      // Production DTP stage: Strictly enforce mandatory assets!
      const subJobs = s?.sub_jobs && s.sub_jobs.length > 0 ? s.sub_jobs : [];
      const theBrief = s?.the_brief || {};
      const readiness = checkMandatoryAssetsReadiness(subJobs, theBrief, "each");
      if (readiness.hasMissing) {
        setDtpGateMissingItems(readiness.missingList);
        setShowDtpGateModal(true);
        return;
      }
    }
    up({ sentAt: new Date().toISOString() });
  };

  const handleFileUpload = async (e) => {
    const rawFiles = e.target.files;
    if (!rawFiles || rawFiles.length === 0) return;
    const files = Array.from(rawFiles);

    // PRODUCTION DTP: Keep exact existing single file logic untouched
    if (!isS) {
      const file = files[0];
      if (!file) return;

      if (!targetJobId) {
        setFileName(file.name);
        up({
          content: { name: file.name, rows: 40, parsed: true },
          contentAt: new Date().toISOString()
        });
        toast.success(`Content file "${file.name}" saved locally`);
        return;
      }

      try {
        setBusy(true);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("subJobNo", subJobCode);
        formData.append("phase", phase);
        formData.append("fileCategory", "content");

        const res = await axiosInstance.post(
          `/enquiry-flow-integration/${targetJobId}/upload-artwork-proof`,
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          }
        );

        if (res.data?.success && res.data?.content) {
          const cObj = res.data.content;
          setFileName(cObj.name);
          up({
            content: {
              name: cObj.name,
              file_url: cObj.signed_url || cObj.file_url,
              raw_url: cObj.raw_url || cObj.file_url,
              size: cObj.size,
              uploadedAt: cObj.uploaded_at,
              rows: 40,
              parsed: true,
            },
            contentAt: cObj.uploaded_at || new Date().toISOString(),
          });
          toast.success(`Content file "${cObj.name}" uploaded to Cloudflare R2!`);
        } else {
          toast.error(res.data?.message || "Failed to upload content file");
        }
      } catch (err) {
        console.error("Content upload error:", err);
        setFileName(file.name);
        up({
          content: { name: file.name, rows: 40, parsed: true },
          contentAt: new Date().toISOString(),
        });
        toast.error(err.response?.data?.message || "Upload failed, saved locally");
      } finally {
        setBusy(false);
      }
      return;
    }

    // SAMPLE DTP: Multiple files upload of ANY file type (.xlsx, .doc, .pdf, .cdr, .ai, etc.)
    if (!targetJobId) {
      toast.error("Job reference missing. Please refresh the page.");
      return;
    }

    try {
      setBusy(true);
      let successCount = 0;
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("subJobNo", subJobCode);
        formData.append("phase", "sample");
        formData.append("fileCategory", "content");

        const res = await axiosInstance.post(
          `/enquiry-flow-integration/${targetJobId}/upload-artwork-proof`,
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          }
        );
        if (res.data?.success) successCount++;
      }

      if (successCount > 0) {
        setFileName(`${successCount} file(s) uploaded`);
        try {
          const proofRes = await axiosInstance.get(`/enquiry-flow-integration/${targetJobId}/dtp-proofs`);
          if (proofRes.data?.success && proofRes.data.proofs) {
            setDtpProofs(proofRes.data.proofs);
          }
        } catch (fetchErr) {
          console.warn("Could not reload dtp proofs:", fetchErr);
        }
        toast.success(`${successCount} Sample content proof file(s) uploaded successfully!`);
      }
    } catch (err) {
      console.error("Sample content upload error:", err);
      toast.error(err.response?.data?.message || "Error uploading sample content files");
    } finally {
      setBusy(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleProofUpload = async (e) => {
    const rawFiles = e.target.files;
    if (!rawFiles || rawFiles.length === 0) return;
    const files = Array.from(rawFiles);

    // PRODUCTION DTP: Keep exact existing single file logic untouched
    if (!isS) {
      const file = files[0];
      if (!file) return;

      if (!targetJobId) {
        toast.error("Job reference missing. Please save or refresh the job first.");
        return;
      }

      try {
        setBusy(true);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("subJobNo", subJobCode);
        formData.append("phase", phase);
        formData.append("round", round);

        const res = await axiosInstance.post(
          `/enquiry-flow-integration/${targetJobId}/upload-artwork-proof`,
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          }
        );

        if (res.data?.success && res.data.proofFile) {
          const pf = res.data.proofFile;
          up({
            proofFile: {
              name: pf.name || file.name,
              size: pf.size || file.size,
              file_url: pf.signed_url || pf.file_url,
              raw_url: pf.raw_url || pf.file_url,
              uploadedAt: pf.uploaded_at || new Date().toISOString(),
              uploadedBy: pf.uploaded_by || "Client Servicing",
            },
            proofAt: new Date().toISOString(),
            round,
          });

          try {
            const proofRes = await axiosInstance.get(`/enquiry-flow-integration/${targetJobId}/dtp-proofs`);
            if (proofRes.data?.success && proofRes.data.proofs) {
              setDtpProofs(proofRes.data.proofs);
            }
          } catch (fetchErr) {
            console.warn("Could not reload dtp proofs after upload:", fetchErr);
          }

          toast.success(`DTP Proof "${file.name}" uploaded to Cloudflare R2 successfully!`);
        } else {
          toast.error(res.data?.message || "Failed to upload artwork proof to R2.");
        }
      } catch (err) {
        console.error("Error uploading artwork proof:", err);
        toast.error(err.response?.data?.message || "Network error while uploading proof to R2.");
      } finally {
        setBusy(false);
        if (e.target) e.target.value = "";
      }
      return;
    }

    // SAMPLE DTP: Multiple file upload of IMAGES ONLY (.jpg, .jpeg, .png, .webp)
    if (!targetJobId) {
      toast.error("Job reference missing. Please save or refresh the job first.");
      return;
    }

    const imageFiles = files.filter((f) => f.type.startsWith("image/") || /\.(jpg|jpeg|png|webp)$/i.test(f.name));
    if (imageFiles.length !== files.length) {
      toast.warning("Sample Master Template only accepts image files (PNG, JPG, JPEG, WEBP). Non-image files were skipped.");
    }
    if (imageFiles.length === 0) {
      if (e.target) e.target.value = "";
      return;
    }

    try {
      setBusy(true);
      let successCount = 0;
      for (const file of imageFiles) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("subJobNo", subJobCode);
        formData.append("phase", "sample");
        formData.append("round", round);
        formData.append("fileCategory", "proof");

        const res = await axiosInstance.post(
          `/enquiry-flow-integration/${targetJobId}/upload-artwork-proof`,
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          }
        );
        if (res.data?.success) successCount++;
      }

      if (successCount > 0) {
        up({
          proofAt: new Date().toISOString(),
          round,
        });

        try {
          const proofRes = await axiosInstance.get(`/enquiry-flow-integration/${targetJobId}/dtp-proofs`);
          if (proofRes.data?.success && proofRes.data.proofs) {
            setDtpProofs(proofRes.data.proofs);
          }
        } catch (fetchErr) {
          console.warn("Could not reload dtp proofs:", fetchErr);
        }

        toast.success(`${successCount} Sample Master Template image(s) uploaded successfully!`);
      }
    } catch (err) {
      console.error("Error uploading sample proof images:", err);
      toast.error(err.response?.data?.message || "Network error while uploading sample images.");
    } finally {
      setBusy(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleSendBackToDTP = () => {
    if (!corrText.trim()) return;
    up({
      corrections: [
        ...(d.corrections || []),
        { round, note: corrText.trim(), at: new Date().toISOString() }
      ],
      round: round + 1,
      proofAt: null,
      proofSent: null,
      sentAt: new Date().toISOString()
    });
    setCorrText("");
    setCorrOpen(false);
  };

  // Client Servicing logs client approval after communicating (via phone, whatsapp, etc.)
  const handleCSClientApproval = async (logData) => {
    try {
      setBusy(true);
      const channel = logData?.channel || logData?.method || logData?.mode || "Client Communication";
      const remarks = logData?.notes || logData?.remarks || "Approved via CS Client Communication";

      if (targetJobId) {
        await axiosInstance.post(`/enquiry-flow-integration/public/proof-feedback/${targetJobId}?phase=${phase}`, {
          stage: "all",
          decision: "approved",
          status: "Approved",
          subJobNo: subJobCode,
          clientName: `${client?.name || "Client"} (via CS: ${logData?.by || "Client Servicing"})`,
          remarks: `${channel}: ${remarks}`,
        });
      }

      up({
        approved: logData,
        proofSent: d.proofSent || channel,
      });

      // Reload live dtp proofs
      try {
        const proofRes = await axiosInstance.get(`/enquiry-flow-integration/${targetJobId}/dtp-proofs?phase=${phase}`);
        if (proofRes.data?.success && proofRes.data.proofs) {
          setDtpProofs(proofRes.data.proofs);
        }
      } catch (fetchErr) {
        console.warn("Could not reload dtp proofs:", fetchErr);
      }

      toast.success(
        isS
          ? "Sample artwork & content approval logged! Both Master Template & Content are approved."
          : "Artwork approval logged successfully!"
      );
    } catch (err) {
      console.error("Error logging client approval:", err);
      up({ approved: logData });
      toast.warning("Approval saved locally; sync will complete on next save.");
    } finally {
      setBusy(false);
      setCap(false);
    }
  };

  // If approved or skipped, show the compact completed card
  if (effectiveSt === "approved" || effectiveSt === "skipped") {
    return (
      <div className="w-full bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 shadow-2xs transition-all">
        {showProofSheet && (
          <ArtworkProofSheet
            s={s}
            set={set}
            client={client}
            job={job}
            ids={ids}
            phase={phase}
            dtpProofData={currentProof}
            onBack={() => setShowProofSheet(false)}
            onMarkSent={(method) => {
              up({ proofSent: method || "WhatsApp" });
              setShowProofSheet(false);
            }}
          />
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
              {effectiveSt === "skipped" ? "–" : "✓"}
            </span>
            <div>
              <b className="text-[13px] text-gray-900 block font-bold">
                {title} · {DTP_LABEL[effectiveSt]}
              </b>
              <small className="text-[11px] text-gray-500 block">
                {effectiveSt === "approved"
                  ? `Round ${round} · ${proofLine(d.approved || (isS ? currentProof?.proof_decision : (currentProof?.production_proof_decision || (currentProof?.is_master_approved && currentProof?.is_content_approved ? currentProof?.proof_decision : null))) || { at: new Date().toISOString() })}${d.content
                    ? ` · ${d.content.name}${d.content.rows ? ` (${d.content.rows} names)` : ""}`
                    : ""
                  }`
                  : "Marked as not needed for this job"}
              </small>
            </div>
          </div>
          <button
            className="text-[11px] font-bold text-gray-400 hover:text-gray-600 underline cursor-pointer"
            onClick={() => {
              up({ approved: null, skipped: false });
              if (!isS && targetJobId) {
                axiosInstance.post(`/enquiry-flow-integration/public/proof-feedback/${targetJobId}?phase=${phase}`, {
                  stage: "all",
                  decision: "revision",
                  status: "Pending",
                  subJobNo: subJobCode,
                  phase: phase,
                  remarks: "DTP reopened for alterations",
                }).catch(() => {});
              }
            }}
          >
            Reopen
          </button>
        </div>
      </div>
    );
  }

  // Active / in-progress DTP Card (Matches Screenshots 1, 3, 4, 5)
  const earlierCorrectionsText = (d.corrections || [])
    .map((c) => `R${c.round}: ${c.note}`)
    .join(" · ");

  return (
    <div className="w-full bg-white border-2 border-amber-400 rounded-xl shadow-sm overflow-hidden transition-all">
      {showProofSheet && (
        <ArtworkProofSheet
          s={s}
          set={set}
          client={client}
          job={job}
          ids={ids}
          phase={phase}
          dtpProofData={currentProof}
          onBack={() => setShowProofSheet(false)}
          onMarkSent={(method) => {
            up({ proofSent: method || "WhatsApp" });
            setShowProofSheet(false);
          }}
        />
      )}
      {/* Header with Round Title */}
      <div className="p-4 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold bg-indigo-50 text-indigo-600">
            ✏️
          </div>
          <h4 className="font-bold text-sm text-gray-900">
            {title} · round {round}
          </h4>
        </div>
        <p className="text-[11px] text-gray-500 ml-8">
          {isS
            ? "Artwork for the single sample piece. It goes to the client for approval before the shop floor makes the sample."
            : "Full name list and content for the order. DTP prepares the artwork; the client approves the proof before the run."}
        </p>

        {/* 4 Steps Indicator Bar */}
        <div className="flex items-center gap-2 mt-3 ml-8 text-[10px] font-bold">
          {[
            { k: "content", label: "1 Content" },
            { k: "dtp", label: "2 DTP proof" },
            { k: "client", label: "3 Client" },
            { k: "approved", label: "4 Approved" }
          ].map((step, idx) => {
            const stepOrder = ["content", "ready", "dtp", "proof", "client", "approved"];
            const isPassed = stepOrder.indexOf(effectiveSt) >= stepOrder.indexOf(step.k);
            return (
              <span
                key={step.k}
                className={`px-3 py-1 rounded-full transition-all ${isPassed
                    ? "bg-amber-100 text-amber-900 border border-amber-300"
                    : "bg-gray-100 text-gray-400"
                  }`}
              >
                {isPassed && idx < 3 ? "✓ " : ""}
                {step.label}
              </span>
            );
          })}
        </div>

        {/* Ready stock notice if present */}
        {allReady(s) ? (
          <div className="mt-3 ml-8 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-900">
            <div className="flex items-center gap-2">
              <span>🏆</span>
              <span>
                <b>Ready stock order:</b> Stock trophy is ready; DTP is only needed if text engraving / logo plate is required.
              </span>
            </div>
            <button
              type="button"
              onClick={() => up({ skipped: true })}
              className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer ml-2 shrink-0"
            >
              Skip artwork (No engraving)
            </button>
          </div>
        ) : allItems(s).some((x) => x.kind === "ready") ? (
          <div className="mt-3 ml-8 p-2 bg-gray-50 border border-gray-200 rounded-lg text-[11px] text-gray-700 font-medium">
            🏆 <b>Also in this order:</b> Ready stock items included (no 3D design approval needed for ready stock).
          </div>
        ) : null}
      </div>

      <div className="p-5 ml-2 space-y-4 text-xs">
        {/* Row 1: Content Input / File */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-16 font-bold text-gray-700 pt-1 text-[11px]">Content</div>
          <div className="flex-1 space-y-2">
            {d.content?.name || fileName ? (
              <div className="flex flex-wrap items-center gap-2 text-[11px] bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg w-fit">
                <span className="text-gray-400">📎</span>
                <span className="text-gray-700 font-medium">
                  {d.content?.name || fileName}
                  {d.content?.rows ? ` · ${d.content.rows} names / lines` : ""}
                </span>
                {(d.content?.file_url || currentProof?.content_file_url || currentProof?.cs_uploaded_content?.file_url) && (
                  <>
                    <a
                      href={d.content?.file_url || currentProof?.content_file_url || currentProof?.cs_uploaded_content?.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-indigo-600 hover:text-indigo-800 ml-1.5 flex items-center gap-0.5"
                    >
                      <span>👁️</span> View
                    </a>
                    <a
                      href={d.content?.file_url || currentProof?.content_file_url || currentProof?.cs_uploaded_content?.file_url}
                      download={d.content?.name || fileName || "Content_File"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-emerald-600 hover:text-emerald-800 ml-1 flex items-center gap-0.5"
                    >
                      <span>⬇️</span> Download
                    </a>
                  </>
                )}
                <label className="font-bold text-indigo-600 hover:text-indigo-800 ml-2 cursor-pointer border-l border-gray-200 pl-2">
                  Replace
                  <input
                    type="file"
                    hidden
                    disabled={busy}
                    accept={isS ? "*/*" : ".xlsx,.csv,.docx,.pdf"}
                    multiple={isS}
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
            ) : (
              <label className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white border border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs hover:bg-gray-50 transition w-fit">
                <span>📎</span> {isS ? "Upload content proof file(s) (Any format: .xlsx, .pdf, .docx, .cdr, .ai)" : "Upload content file (.xlsx, .csv, .docx, .pdf)"}
                <input
                  type="file"
                  hidden
                  disabled={busy}
                  accept={isS ? "*/*" : ".xlsx,.csv,.docx,.pdf"}
                  multiple={isS}
                  onChange={handleFileUpload}
                />
              </label>
            )}
            {isS && (
              <input
                type="text"
                className="w-full p-2.5 text-xs border border-gray-200 rounded-lg focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none"
                placeholder='Text on the sample, e.g. "Top Performer 2026 · Anita Desai"'
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  up({ text: e.target.value });
                }}
              />
            )}
            {!isS && !d.content && (
              <span className="text-[11px] text-rose-600 font-semibold block">
                Awaiting the content list from the client
              </span>
            )}
          </div>
        </div>

        {/* Row 2: DTP Operations */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 border-t border-gray-100 pt-4">
          <div className="w-16 font-bold text-gray-700 text-[11px] pt-1">DTP</div>
          <div className="flex-1 space-y-1.5">
            {effectiveSt === "content" && (
              <span className="text-[11px] text-gray-400">
                {isS
                  ? "Add the sample text or file, then send to DTP."
                  : "Upload the content to send it to DTP."}
              </span>
            )}

            {effectiveSt === "ready" && (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="px-5 py-2.5 bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold rounded-lg shadow-2xs transition cursor-pointer"
                  onClick={handleSendToDTP}
                >
                  Send to DTP
                </button>
                <span className="text-[11px] text-gray-400">
                  DTP load today: 5 jobs · usual turnaround {isS ? "4 h" : "1 day"}
                </span>
              </div>
            )}

            {effectiveSt === "dtp" && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-200 rounded-full font-bold text-[11px]">
                  With DTP since {dfmt(d.sentAt)}
                </span>
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm transition cursor-pointer">
                  <span>📁</span>
                  <span>{busy ? "Uploading..." : isS ? "Upload Sample Master Template (Images)" : "Upload DTP proof"}</span>
                  <input
                    type="file"
                    hidden
                    disabled={busy}
                    accept={isS ? "image/*" : ".pdf,.png,.jpg,.jpeg,.ai,.cdr,.eps"}
                    multiple={isS}
                    onChange={handleProofUpload}
                  />
                </label>
                <button
                  type="button"
                  className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold rounded-lg transition cursor-pointer"
                  onClick={() => {
                    up({
                      proofFile: {
                        name: isS ? "Sample_Artwork_Proof_v1.pdf" : "Production_Artwork_Proof_v1.pdf",
                        size: 1048576,
                        uploadedAt: new Date().toISOString()
                      },
                      proofAt: new Date().toISOString(),
                      round
                    });
                    toast.success("DTP Proof simulated successfully!");
                  }}
                >
                  Simulate: DTP sends the proof
                </button>
              </div>
            )}

            {/* Proof Ready Pill (Screenshots 1, 3, 4, 5) */}
            {(effectiveSt === "proof" || effectiveSt === "client") && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="px-4 py-1.5 bg-[#EEEDFE] text-[#3126B4] font-bold rounded-full text-xs inline-block">
                    Proof ready · round {round} · {dfmt(d.proofAt || new Date())}
                  </span>
                  {d.proofFile ? (
                    <div className="flex items-center gap-2 text-[11px] bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg">
                      <span className="text-gray-400">📄</span>
                      <span className="text-gray-800 font-medium">{d.proofFile.name}</span>
                      {d.proofFile.file_url && (
                        <>
                          <a
                            href={d.proofFile.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-indigo-600 hover:text-indigo-800 ml-1.5 flex items-center gap-0.5"
                          >
                            <span>👁️</span> View
                          </a>
                          <a
                            href={d.proofFile.file_url}
                            download={d.proofFile.name || "Sample_Artwork_Proof"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-emerald-600 hover:text-emerald-800 ml-1 flex items-center gap-0.5"
                          >
                            <span>⬇️</span> Download
                          </a>
                        </>
                      )}
                      <label className="font-bold text-indigo-600 hover:text-indigo-800 ml-2 cursor-pointer border-l border-gray-200 pl-2">
                        {isS ? "+ Add / Replace Images" : "Replace"}
                        <input
                          type="file"
                          hidden
                          disabled={busy}
                          accept={isS ? "image/*" : ".pdf,.png,.jpg,.jpeg,.ai,.cdr,.eps"}
                          multiple={isS}
                          onChange={handleProofUpload}
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer">
                      {isS ? "+ Upload Sample Master Template Images" : "+ Upload proof file"}
                      <input
                        type="file"
                        hidden
                        disabled={busy}
                        accept={isS ? "image/*" : ".pdf,.png,.jpg,.jpeg,.ai,.cdr,.eps"}
                        multiple={isS}
                        onChange={handleProofUpload}
                      />
                    </label>
                  )}
                </div>
                {earlierCorrectionsText && (
                  <div className="text-[11px] text-gray-500 mt-1.5 ml-1">
                    Earlier corrections: {earlierCorrectionsText}
                  </div>
                )}
              </div>
            )}

            {/* LIVE DTP STUDIO PROOFS (Master Proofs & Content Proofs) */}
            {hasLiveProofs && (
              <div className="mt-3 p-4 bg-gradient-to-br from-indigo-50/70 via-slate-50 to-amber-50/40 border-2 border-indigo-200 rounded-xl space-y-3.5">
                <div className="flex items-center justify-between border-b border-indigo-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                      🎨
                    </span>
                    <span className="font-black text-gray-900 text-xs">
                      Live DTP Studio Proofs ({currentProof?.sub_job_no})
                    </span>
                    <span className="text-[10px] text-gray-500 font-medium">
                      Artist: {currentProof?.assigned_to_name || "DTP Artist"}
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${currentProof?.dtp_status === "Completed"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-indigo-100 text-indigo-800"
                      }`}
                  >
                    {currentProof?.dtp_status || "In Studio"}
                  </span>
                </div>

                {/* Master Proof Image Gallery */}
                {liveMasterProofs.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-2">
                      {isS ? "Sample Master Template Proof Images:" : "Master Template Proof Images:"}
                    </span>
                    <div className="flex flex-wrap gap-3">
                      {liveMasterProofs.map((m, idx) => (
                        <div
                          key={idx}
                          className="border border-indigo-200 rounded-xl overflow-hidden bg-white p-2 shadow-2xs max-w-[200px] group"
                        >
                          <div className="h-28 w-full overflow-hidden rounded-lg bg-slate-100 flex items-center justify-center relative">
                            <img
                              src={m.file_url}
                              alt={`Master proof ${idx + 1}`}
                              className="max-h-full max-w-full object-contain cursor-pointer group-hover:scale-105 transition"
                              onClick={() => setPreviewImg(m.file_url)}
                            />
                            <button
                              type="button"
                              onClick={() => setPreviewImg(m.file_url)}
                              className="absolute inset-0 bg-gray-900/40 text-white flex items-center justify-center text-xs font-bold opacity-0 group-hover:opacity-100 transition cursor-pointer"
                            >
                              🔍 Zoom
                            </button>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[10px]">
                            <span className="font-bold text-gray-800 truncate" title={m.original_name || `Master Proof #${idx + 1}`}>
                              {m.original_name || `Master Proof #${idx + 1}`}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded font-black text-[9px] uppercase ${m.status === "Approved"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : m.status === "Rejected"
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                            >
                              {m.status || "Pending"}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[10px]">
                            <a
                              href={m.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-bold text-indigo-600 hover:text-indigo-800"
                            >
                              👁️ View
                            </a>
                            <a
                              href={m.file_url}
                              download={m.original_name || `Master_Proof_${idx + 1}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-bold text-emerald-600 hover:text-emerald-800"
                            >
                              ⬇️ Download
                            </a>
                          </div>
                          {m.rejection_reason && (
                            <div className="text-[9px] text-rose-700 font-semibold mt-1">
                              Alterations: {m.rejection_reason}
                            </div>
                          )}
                          {m.uploaded_at && (
                            <div className="text-[9px] text-gray-400 mt-0.5">
                              Uploaded {m.uploaded_at}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stage 2 Content Proofing Gate & Files (Production gated, Sample always unlocked) */}
                {!isS && !isMasterApproved ? (
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg flex items-center justify-between text-xs text-amber-900">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🔒</span>
                      <span>
                        <b>Content proofing locked:</b> Client must approve the Master Template layout above before DTP artist can upload content proof documents.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                        {isS ? "Content Proofing Files & Documents (Any format):" : "Content Proofing Files & Name Lists:"}
                      </span>
                      {!isS && (
                        <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          ✓ Master Layout Approved (Content Proofing Unlocked)
                        </span>
                      )}
                    </div>

                    {liveContentProofs.length > 0 ? (
                      <div className="space-y-1.5">
                        {liveContentProofs.map((c, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between bg-white border border-gray-200 px-3 py-2 rounded-lg text-xs"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="text-indigo-600 font-bold">📄</span>
                              <span className="font-medium text-gray-800 truncate text-[11px]">
                                Content Proof #{idx + 1}
                                {c.status ? ` (${c.status})` : ""}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${c.status === "Approved"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : c.status === "Rejected"
                                      ? "bg-rose-100 text-rose-800"
                                      : "bg-amber-100 text-amber-800"
                                  }`}
                              >
                                {c.status || "Pending"}
                              </span>
                              <a
                                href={c.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-600 font-bold hover:underline shrink-0 text-[11px]"
                              >
                                View ↗
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 bg-white border border-dashed border-gray-300 rounded-lg text-center text-xs text-gray-500">
                        Master template approved! Awaiting content proof documents upload from DTP artist.
                      </div>
                    )}
                  </div>
                )}

                {/* Quick Share with Client button */}
                <div className="pt-2 border-t border-indigo-100/60 flex items-center justify-between">
                  <span className="text-[11px] text-gray-500">
                    Live files ready from DTP. Click to review sheet & share with client.
                  </span>
                  <button
                    type="button"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-2xs transition cursor-pointer flex items-center gap-1.5"
                    onClick={() => setShowProofSheet(true)}
                  >
                    <span>📤</span>
                    <span>Preview & Share Proof with Client</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Row 3: Client Row & Actions (Screenshots 1, 3, 4, 5) */}
        {(effectiveSt === "proof" || effectiveSt === "client") && (
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 border-t border-gray-100 pt-4">
            <div className="w-16 font-bold text-gray-700 pt-2 text-[11px]">Client</div>
            <div className="flex-1 space-y-3">
              {/* SCREENSHOT 1: When Proof is ready, but not yet sent to client */}
              {effectiveSt === "proof" && (
                <div className="space-y-2">
                  <span className="text-xs text-gray-500 block">
                    Goes to {client?.name || "Client Name Ltd"}.
                  </span>
                  <button
                    type="button"
                    className="px-5 py-2.5 bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold text-xs rounded-xl shadow-2xs transition cursor-pointer"
                    onClick={() => setShowProofSheet(true)}
                  >
                    Preview and send proof
                  </button>
                </div>
              )}

              {/* SCREENSHOT 3, 4, 5: When proof has been sent to client */}
              {effectiveSt === "client" && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="px-3.5 py-1.5 bg-[#FFF8D6] text-amber-900 border border-[#FBE577] rounded-full font-semibold text-xs">
                      Sent via {d.proofSent || "Hand-delivered / other"} · awaiting approval
                    </span>
                    <button
                      type="button"
                      className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-xl shadow-2xs transition cursor-pointer"
                      onClick={() => setShowProofSheet(true)}
                    >
                      Resend
                    </button>
                    <button
                      type="button"
                      className="px-5 py-2 bg-[#059669] hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-2xs transition cursor-pointer flex items-center gap-1.5"
                      onClick={() => setCap(true)}
                    >
                      <span>✓</span>
                      <span>{isS ? "Client Communicated & Approved" : "Artwork approved"}</span>
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-xl shadow-2xs transition cursor-pointer"
                      onClick={() => setCorrOpen(true)}
                    >
                      Corrections asked
                    </button>
                  </div>

                  {/* SCREENSHOT 4 & 5: Inline Corrections Form */}
                  {corrOpen && (
                    <div className="flex flex-wrap items-center gap-2 pt-1 fade">
                      <input
                        type="text"
                        autoFocus
                        className="p-2 text-xs border-2 border-indigo-500 rounded-lg outline-none bg-white min-w-[240px] flex-1 max-w-md focus:ring-1 focus:ring-indigo-400"
                        placeholder="What needs correcting? e.g. Spelling, logo size..."
                        value={corrText}
                        onChange={(e) => setCorrText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && corrText.trim()) {
                            handleSendBackToDTP();
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 font-semibold text-xs rounded-lg transition cursor-pointer"
                        onClick={() => {
                          setCorrOpen(false);
                          setCorrText("");
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={!corrText.trim()}
                        className="px-5 py-2 bg-amber-400 hover:bg-amber-500 disabled:opacity-40 text-amber-950 font-bold text-xs rounded-lg shadow-2xs transition cursor-pointer"
                        onClick={handleSendBackToDTP}
                      >
                        Send back to DTP
                      </button>
                    </div>
                  )}

                  {/* Approval Log Capture Modal */}
                  {cap && (
                    <div className="mt-2 border border-gray-200 rounded-xl bg-gray-50 p-4 relative fade">
                      <button
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 cursor-pointer"
                        onClick={() => setCap(false)}
                      >
                        ✖
                      </button>
                      <h4 className="text-xs font-bold text-gray-800 mb-3 ml-1">
                        Log client approval for {title} (Round {round})
                      </h4>
                      <CommunicationLogForm
                        client={client}
                        mode="design"
                        feedbackMode="approve"
                        hideCard={true}
                        onBack={() => setCap(false)}
                        onLog={handleCSClientApproval}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Skip Option Footer */}
      {isS && st !== "client" && (
        <div className="px-5 py-3.5 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between">
          <button
            type="button"
            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer transition"
            onClick={() => up({ skipped: true })}
          >
            No artwork needed for this sample
          </button>
          <span className="text-[10px] text-gray-400">
            Skips DTP and proceeds directly to sample production
          </span>
        </div>
      )}

      {/* Lightbox for zooming live DTP master proof image */}
      {previewImg && (
        <ImageLightbox
          src={previewImg}
          fileName="DTP Master Template Proof"
          onClose={() => setPreviewImg(null)}
        />
      )}

      {/* Strict Hard Gate Modal (Tier 2: Production DTP Gate - Proceed Anyway is NOT allowed) */}
      <AssetRequirementGateModal
        isOpen={showDtpGateModal}
        onClose={() => setShowDtpGateModal(false)}
        stage="dtp"
        missingItems={dtpGateMissingItems}
        onUploadNow={(item) => {
          setSelectedUploadProduct(item.product);
          setShowUploadModal(true);
        }}
      />

      {/* Direct Asset Upload Modal for DTP */}
      {showUploadModal && (
        <AssetUploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          product={selectedUploadProduct}
          clientId={s?.clientId || s?.customer_id?._id || s?.customer_id || ""}
          clientName={client || s?.customer_id?.name || ""}
          enquiryNo={s?.enquiry_no || ""}
          onSaveAssets={({ subJobNo, client_logo, signatures, additional_files }) => {
            const updatedSubJobs = (s?.sub_jobs || []).map((sj) => {
              if (sj.sub_job_no === subJobNo || sj.name === subJobNo || sj.product_name === subJobNo) {
                return {
                  ...sj,
                  client_logo: client_logo || sj.client_logo,
                  signatures: signatures || sj.signatures,
                  additional_files: additional_files || sj.additional_files,
                };
              }
              return sj;
            });
            set(
              {
                sub_jobs: updatedSubJobs,
                the_brief: {
                  ...(s?.the_brief || {}),
                  client_logo: client_logo || s?.the_brief?.client_logo,
                  signatures: signatures || s?.the_brief?.signatures,
                  additional_files: additional_files || s?.the_brief?.additional_files,
                },
              },
              true
            );
            toast.success("Assets uploaded! You can now send to DTP.");
            setShowUploadModal(false);
            setShowDtpGateModal(false);
          }}
          onImmediateSave={(patch) => set(patch, true)}
        />
      )}
    </div>
  );
};

export default ArtworkPanel;
