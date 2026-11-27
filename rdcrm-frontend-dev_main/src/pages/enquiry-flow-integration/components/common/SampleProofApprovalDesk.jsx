import React, { useState, useEffect } from "react";
import {
  roundOf,
  sfOf,
  CARRIERS,
  carrierOf,
  dfmt,
  todayISO,
  subJobsOf,
  formatEnquiryNo,
  ENQUIRY_CONFIG,
} from "../../utils/helpers";
import { toast } from "react-toastify";
import { axiosInstance } from "../../../../utils/url/config";
import SendDocumentOverlay from "./SendDocumentOverlay";
import CommunicationLogForm from "./CommunicationLogForm";
import ApprovalHistoryProof from "./ApprovalHistoryProof";
import SampleProofSheet from "../Steps/SampleProofSheet";

const SampleProofApprovalDesk = ({
  s,
  set,
  client,
  job,
  ids = {},
  mode = "sample", // "sample" | "pre_production"
  onApprove,
  onRevision,
}) => {
  const v = roundOf(s).v;
  const f = sfOf(s);
  const isPP = mode === "pre_production" || (mode !== "sample" && s?.mode === "production" && Boolean(s?.pp || s?.ppAfter));

  const parentJobNo = s?.seq
    ? formatEnquiryNo(s.seq)
    : (ids?.enq?.startsWith("RD") ? ids.enq : ids?.enq?.replace("ENQ/26/", "RD")) ||
      ENQUIRY_CONFIG.DEFAULT_ENQUIRY_NO;

  const allJobItems = subJobsOf(s, parentJobNo);
  const activeJobItems = allJobItems.filter((it) => !it.is_dropped);
  const displayItems =
    activeJobItems.length > 0
      ? activeJobItems
      : allJobItems.length > 0
      ? allJobItems
      : [
          {
            id: "p1",
            subJobNo: `${parentJobNo}-A1`,
            theme: s.e?.theme || s.theme || "Custom Plaque",
            size: s.e?.size || 8,
            mat: "Acrylic + Wood",
            qty: s.qty || 100,
          },
        ];

  const [samplePhotos, setSamplePhotos] = useState(f.samplePhotos || {});
  const [sampleVideos, setSampleVideos] = useState(f.sampleVideos || {});
  const [uploadingKey, setUploadingKey] = useState(null);

  // Sharing & modals
  const [showProofModal, setShowProofModal] = useState(false);
  const [showApprovalLog, setShowApprovalLog] = useState(false);
  const [activeVideoModal, setActiveVideoModal] = useState(null);
  const [activePhotoModal, setActivePhotoModal] = useState(null);

  // Physical delivery fallback state
  const isPhysicalRequested = Boolean(f.physicalSampleRequested);
  const [showPhysicalDispatch, setShowPhysicalDispatch] = useState(isPhysicalRequested || Boolean(f.disp));
  const selectedCarrier = carrierOf(
    f.disp?.carrier ||
      s.sampleCarrier ||
      s.sdeliv?.carrier ||
      s.deliv?.carrier ||
      "Our vehicle"
  );
  const [carrier, setCarrier] = useState(selectedCarrier);
  const [dispDate, setDispDate] = useState(f.disp?.date || todayISO());
  const [dispRef, setDispRef] = useState(f.disp?.ref || "");
  const [delivDate, setDelivDate] = useState(f.deliveredAt || todayISO());
  const [savingDispatch, setSavingDispatch] = useState(false);

  useEffect(() => {
    if (f.samplePhotos) setSamplePhotos(f.samplePhotos);
    if (f.sampleVideos) setSampleVideos(f.sampleVideos);
    if (f.physicalSampleRequested) setShowPhysicalDispatch(true);
  }, [f.samplePhotos, f.sampleVideos, f.physicalSampleRequested]);

  const up = (p) => {
    set({
      sflow: {
        ...(s.sflow || {}),
        [v]: {
          ...f,
          ...p,
        },
      },
      syncNow: true,
    });
  };

  // Upload handler for photos / videos to Cloudflare R2
  const handleMediaUpload = async (imgKey, file, type = "photo") => {
    if (!file) return;

    const isVideo = type === "video";
    if (isVideo && file.size > 80 * 1024 * 1024) {
      toast.warning("Video size exceeds 80MB. Please upload a compressed clip.");
      return;
    }

    setUploadingKey(`${imgKey}_${type}`);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("clientId", client?.id || client?._id || "general");
    formData.append("clientName", client?.name || "Client");
    formData.append("enquiryNo", parentJobNo);
    formData.append("folderType", "sample_media");
    formData.append("subJobNo", imgKey);

    try {
      const res = await axiosInstance.post("/enquiry-flow-integration/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data?.success) {
        const fileUrl = res.data.data?.signed_url || res.data.data?.file_url;
        const mediaObj = {
          name: file.name,
          url: fileUrl,
          rawUrl: res.data.data?.file_url,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          uploadedBy: "Client Servicing",
        };

        if (isVideo) {
          const updated = { ...sampleVideos, [imgKey]: mediaObj };
          setSampleVideos(updated);
          up({ sampleVideos: updated });
          toast.success(`Sample video uploaded for ${imgKey}!`);
        } else {
          const updated = { ...samplePhotos, [imgKey]: mediaObj };
          setSamplePhotos(updated);
          up({ samplePhotos: updated });
          toast.success(`Sample photo uploaded for ${imgKey}!`);
        }
      } else {
        toast.error("Failed to upload media. Please try again.");
      }
    } catch (err) {
      console.error("Error uploading sample media:", err);
      toast.error("Network error while uploading sample media.");
    } finally {
      setUploadingKey(null);
    }
  };

  // Send Sample Proof Email
  const handleSendProofEmail = async () => {
    const targetDbId = s.dbJobId || s._id || s.rawJob?._id || ids?.id || parentJobNo;
    try {
      const recipient = client?.email || s.contact_email || client?.contacts?.[0]?.email || "";
      if (!recipient) {
        toast.warning("Client has no email on record. Please copy and share the link manually.");
        return;
      }

      const res = await axiosInstance.post(
        `/enquiry-flow-integration/${targetDbId}/sample-proof-mail`,
        {
          to_email: recipient,
          contact_name: client?.name,
          duration: 48,
          mode: isPP ? "pre_production" : "sample",
          notes: isPP
            ? "Kindly inspect the attached photos and video clip of the pre-production sample piece."
            : `Kindly inspect the attached photos and video clip of the Sample v${v} production piece.`,
        }
      );

      if (res.data?.success) {
        up({
          sampleProofSent: "Email",
          sampleProofSentAt: new Date().toISOString(),
          photosAt: new Date().toISOString(),
        });
        setShowProofModal(false);
        toast.success(`Sample proof email sent to ${recipient}!`);
      } else {
        toast.error(res.data?.message || "Failed to send sample proof email.");
      }
    } catch (err) {
      console.error("Error sending sample proof email:", err);
      toast.error("Failed to send sample proof email.");
    }
  };

  // Copy Public Sample Proof Link
  const handleCopyPublicLink = () => {
    const targetId = s.dbJobId || s._id || s.rawJob?._id || ids?.id || parentJobNo;
    const origin = window.location.origin;
    const link = `${origin}/rd/sample-proof/${targetId}?mode=${isPP ? "pre_production" : "sample"}`;

    navigator.clipboard
      ?.writeText(link)
      .then(() => toast.success("Sample proof link copied to clipboard!"))
      .catch(() => toast.info(`Link: ${link}`));
  };

  // Save Physical Sample Dispatch
  const handleSavePhysicalDispatch = async (isDelivered = false) => {
    const targetDbId = s.dbJobId || s._id || s.rawJob?._id || ids?.id || parentJobNo;
    setSavingDispatch(true);
    try {
      await axiosInstance.post(
        `/enquiry-flow-integration/${targetDbId}/sample-physical-dispatch`,
        {
          carrier,
          docket_no: dispRef.trim(),
          dispatch_date: dispDate,
          delivery_date: isDelivered ? delivDate : null,
          is_delivered: isDelivered,
        }
      );

      const dispPayload = {
        carrier,
        ref: dispRef.trim(),
        date: dispDate,
        at: new Date().toISOString(),
      };

      up({
        disp: dispPayload,
        deliveredAt: isDelivered ? delivDate || todayISO() : f.deliveredAt || null,
      });

      toast.success(
        isDelivered
          ? "Sample physical delivery recorded successfully!"
          : "Sample physical dispatch details saved!"
      );
    } catch (err) {
      console.error("Error saving sample dispatch:", err);
      toast.error("Failed to save dispatch details.");
    } finally {
      setSavingDispatch(false);
    }
  };

  const isDelivered = Boolean(f.deliveredAt || f.photosAt || f.sampleProofSent);
  const isApproved = isPP ? Boolean(s.ppApproved) : Boolean(s.approved || f.clientApproved);

  return (
    <div className="w-full bg-white border-2 border-amber-400 rounded-2xl shadow-sm p-5 space-y-5">
      {/* 1. Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">{isPP ? "🏭" : "🧪"}</span>
            <h3 className="font-extrabold text-base text-gray-900 tracking-tight">
              {isPP
                ? `Pre-Production Sample · 1 piece approval before bulk run`
                : `Sample v${v} · Production, Photo/Video Proof & Approval`}
            </h3>
            {isPP && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                Direct Production + PP
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {isPP
              ? "Shop floor crafts 1 sample piece first. Photos & video are shared for client sign-off before full production releases."
              : "Shop floor makes the sample piece, uploads proof media, and client inspects online or in-person."}
          </p>
        </div>

        {/* Status Badge */}
        <div>
          {isApproved ? (
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full flex items-center gap-1.5 border border-emerald-300">
              <span>✓</span> Approved
            </span>
          ) : f.physicalSampleRequested ? (
            <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full flex items-center gap-1.5 border border-amber-300">
              <span>🚚</span> Physical Delivery Requested
            </span>
          ) : f.sampleProofSent ? (
            <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-xs font-bold rounded-full flex items-center gap-1.5 border border-indigo-300">
              <span>📸</span> Proof Shared
            </span>
          ) : f.readyAt ? (
            <span className="px-3 py-1 bg-amber-50 text-amber-900 text-xs font-bold rounded-full border border-amber-200">
              1 Sample Ready
            </span>
          ) : (
            <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-full">
              In Production
            </span>
          )}
        </div>
      </div>

      {/* 2. Step 1: Sample Making on Shop Floor */}
      <div
        className={`p-3.5 rounded-xl border transition ${
          f.readyAt
            ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
            : "bg-amber-50/60 border-amber-200 text-gray-900"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                f.readyAt ? "bg-emerald-500 text-white" : "bg-amber-400 text-amber-950"
              }`}
            >
              {f.readyAt ? "✓" : "1"}
            </span>
            <div>
              <b className="text-xs font-bold block">
                {isPP ? "Pre-production piece manufacturing" : "Sample production"}
              </b>
              <small className="text-[10px] text-gray-500 block">
                {f.readyAt
                  ? `Sample piece finished ${dfmt(f.readyAt)} · Ready for proof capture`
                  : "Being made on the shop floor (1 piece)"}
              </small>
            </div>
          </div>

          {!f.readyAt ? (
            <button
              type="button"
              className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-amber-950 text-xs font-bold rounded-lg shadow-2xs transition cursor-pointer"
              onClick={() => up({ readyAt: new Date().toISOString() })}
            >
              Sample piece ready
            </button>
          ) : (
            <button
              type="button"
              className="text-[10px] text-gray-400 hover:text-gray-600 underline cursor-pointer"
              onClick={() =>
                up({
                  readyAt: null,
                  sampleProofSent: null,
                  sampleProofSentAt: null,
                  photosAt: null,
                })
              }
            >
              Undo
            </button>
          )}
        </div>
      </div>

      {/* 3. Step 2: Photo & Video Upload per Product */}
      {f.readyAt && (
        <div className="p-4 bg-gray-50/70 border border-gray-200 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">📸</span>
              <h4 className="text-xs font-bold text-gray-900">
                Sample Finished Media (Photos & Video for Client Inspection)
              </h4>
            </div>
            <span className="text-[11px] text-gray-500">
              Upload from Shop Floor or CS Team
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {displayItems.map((item, idx) => {
              const imgKey = item.subJobNo || `item_${idx}`;
              const photo = samplePhotos[imgKey] || f.samplePhotos?.[imgKey];
              const video = sampleVideos[imgKey] || f.sampleVideos?.[imgKey];
              const isUploadingPhoto = uploadingKey === `${imgKey}_photo`;
              const isUploadingVideo = uploadingKey === `${imgKey}_video`;

              return (
                <div
                  key={imgKey}
                  className="p-3.5 bg-white border border-gray-200 rounded-xl shadow-2xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-extrabold text-indigo-700">
                        {item.subJobNo}
                      </span>
                      <div className="text-xs font-bold text-gray-900 line-clamp-1">
                        {item.theme || item.product || `Product ${idx + 1}`}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {item.size ? `${item.size} in · ` : ""}
                        {item.mat || "Sample piece"}
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
                      1 pc crafted
                    </span>
                  </div>

                  {/* Media Preview Grid */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100">
                    {/* Photo Box */}
                    <div className="border border-dashed border-gray-200 rounded-lg p-2 flex flex-col items-center justify-center text-center bg-gray-50/50 min-h-[90px]">
                      {photo?.url ? (
                        <div className="relative group w-full h-full flex flex-col items-center">
                          <img
                            src={photo.url}
                            alt="Sample"
                            className="w-16 h-16 object-cover rounded-md border shadow-2xs cursor-pointer"
                            onClick={() => setActivePhotoModal(photo.url)}
                          />
                          <span className="text-[9px] text-emerald-600 font-bold mt-1 truncate max-w-full">
                            ✓ Photo Attached
                          </span>
                        </div>
                      ) : (
                        <div className="text-gray-400 text-center">
                          <span className="text-lg block">📷</span>
                          <span className="text-[9px] font-medium">No photo</span>
                        </div>
                      )}
                      <input
                        type="file"
                        id={`photo-${imgKey}`}
                        accept="image/*"
                        className="hidden"
                        disabled={isUploadingPhoto}
                        onChange={(e) => handleMediaUpload(imgKey, e.target.files?.[0], "photo")}
                      />
                      <label
                        htmlFor={`photo-${imgKey}`}
                        className="mt-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                      >
                        {isUploadingPhoto ? "Uploading..." : photo?.url ? "Change Photo" : "+ Upload Photo"}
                      </label>
                    </div>

                    {/* Video Box */}
                    <div className="border border-dashed border-gray-200 rounded-lg p-2 flex flex-col items-center justify-center text-center bg-gray-50/50 min-h-[90px]">
                      {video?.url ? (
                        <div className="w-full flex flex-col items-center">
                          <button
                            type="button"
                            onClick={() => setActiveVideoModal(video.url)}
                            className="w-16 h-16 bg-slate-900 rounded-md text-white flex flex-col items-center justify-center shadow-2xs hover:bg-indigo-900 transition cursor-pointer"
                          >
                            <span className="text-lg">▶</span>
                            <span className="text-[8px] font-bold">Watch</span>
                          </button>
                          <span className="text-[9px] text-emerald-600 font-bold mt-1 truncate max-w-full">
                            ✓ Video Attached
                          </span>
                        </div>
                      ) : (
                        <div className="text-gray-400 text-center">
                          <span className="text-lg block">🎥</span>
                          <span className="text-[9px] font-medium">No video</span>
                        </div>
                      )}
                      <input
                        type="file"
                        id={`video-${imgKey}`}
                        accept="video/*"
                        className="hidden"
                        disabled={isUploadingVideo}
                        onChange={(e) => handleMediaUpload(imgKey, e.target.files?.[0], "video")}
                      />
                      <label
                        htmlFor={`video-${imgKey}`}
                        className="mt-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                      >
                        {isUploadingVideo ? "Uploading..." : video?.url ? "Change Video" : "+ Upload Video"}
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Share Actions Deck */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t">
            <div className="text-xs text-gray-600">
              {f.sampleProofSent ? (
                <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                  <span>✓</span> Sample proof shared via {f.sampleProofSent} ({dfmt(f.sampleProofSentAt)})
                </span>
              ) : (
                <span>Share finished sample photos and videos with the client for inspection</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyPublicLink}
                className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-lg shadow-2xs transition cursor-pointer"
              >
                🔗 Copy Link
              </button>
              <button
                type="button"
                onClick={() => setShowProofModal(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1.5"
              >
                <span>👁️</span> {f.sampleProofSent ? "Resend Proof" : "Preview & Share Proof"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Step 3: Physical Sample Delivery Section (Toggle / Fallback) */}
      <div className="pt-1">
        {!showPhysicalDispatch ? (
          <div className="p-3 bg-amber-50/50 border border-amber-200/80 rounded-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-base">📦</span>
              <div className="text-xs text-gray-800">
                <b>Need physical sample piece inspection?</b> If client requested to physically see the piece before sign-off.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowPhysicalDispatch(true)}
              className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-950 font-bold text-xs rounded-lg shadow-2xs cursor-pointer transition shrink-0"
            >
              + Add Sample Dispatch / Delivery
            </button>
          </div>
        ) : (
          <div className="p-4 bg-white border-2 border-indigo-200 rounded-xl shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-indigo-600 font-bold">🚚</span>
                <h4 className="text-xs font-bold text-gray-900">
                  Physical Sample Dispatch & Delivery
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowPhysicalDispatch(false)}
                className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                Hide
              </button>
            </div>
            <p className="text-[11px] text-gray-500">
              Ship the 1-2 manufactured sample pieces to client address via courier or local vehicle.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <div>
                <label className="text-[10px] font-bold text-gray-500 block mb-1">Carrier</label>
                <select
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-300 rounded-lg outline-none bg-white"
                >
                  {CARRIERS.map((c) => (
                    <option key={c.v} value={c.v}>
                      {c.icon} {c.v}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-500 block mb-1">
                  Docket / AWB / Vehicle No.
                </label>
                <input
                  type="text"
                  placeholder="e.g. DTDC-987123"
                  value={dispRef}
                  onChange={(e) => setDispRef(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-500 block mb-1">Dispatch Date</label>
                <input
                  type="date"
                  value={dispDate}
                  onChange={(e) => setDispDate(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-300 rounded-lg outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
              <button
                type="button"
                disabled={savingDispatch || !dispRef.trim()}
                onClick={() => handleSavePhysicalDispatch(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-2xs transition cursor-pointer"
              >
                {savingDispatch ? "Saving..." : "Save Dispatch Details"}
              </button>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={delivDate}
                  onChange={(e) => setDelivDate(e.target.value)}
                  className="text-xs p-1.5 border border-gray-300 rounded-lg outline-none"
                />
                <button
                  type="button"
                  disabled={savingDispatch}
                  onClick={() => handleSavePhysicalDispatch(true)}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1"
                >
                  <span>✓</span> Mark Delivered
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Step 4: Decision & Client Approval Deck */}
      {isApproved ? (
        <div className="pt-2 border-t space-y-4">
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl shadow-2xs">
            <ApprovalHistoryProof
              type="sample"
              title={isPP ? `Pre-production sample v${v} approved` : `Sample v${v} approved`}
              data={s.sampleOk || f.clientApprovedData || s.ppOk}
              s={s}
              client={client}
              docNo={isPP ? `PP Sample v${v}` : `Sample v${v} Proof`}
              docLabel="Photo Proof"
              defaultOpen={true}
              collapsible={true}
            />
            {!showApprovalLog && (
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowApprovalLog(true)}
                  className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
                >
                  Update approval log / change proof
                </button>
              </div>
            )}
          </div>
          {showApprovalLog && (
            <div className="fade">
              <CommunicationLogForm
                client={client}
                pName={isPP ? `Pre-Production Sample v${v}` : `Sample v${v}`}
                mode="sample-approval"
                feedbackMode="approve"
                title={
                  isPP
                    ? `Pre-production sample v${v} approved. How did the client confirm?`
                    : `Sample v${v} approved. How did the client confirm?`
                }
                subTitle="Record client confirmation (WhatsApp screenshot, call notes, or email) to release bulk production."
                buttonText={isPP ? "Log approval & release full production" : "Log approval and process the order"}
                buttonHint="Paste their confirmation message or attach screenshot."
                hideCard={false}
                onBack={() => setShowApprovalLog(false)}
                onLog={(logData) => {
                  if (onApprove) onApprove(logData);
                  setShowApprovalLog(false);
                  toast.success(`Approval logged! Proceeding to next step.`);
                }}
              />
            </div>
          )}
        </div>
      ) : isDelivered && (
        <div className="pt-2 border-t space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowApprovalLog(!showApprovalLog)}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-2"
            >
              <span>✓</span> {isPP ? `Client approved PP sample v${v}` : `Client approved sample v${v}`}
            </button>

            <button
              type="button"
              onClick={onRevision}
              className="px-5 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            >
              Client wants changes / alterations
            </button>

            {!showPhysicalDispatch && (
              <button
                type="button"
                onClick={() => setShowPhysicalDispatch(true)}
                className="px-5 py-3 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-700 font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
              >
                🚚 Dispatch physical piece
              </button>
            )}
          </div>

          {/* Communication Log for Internal Approval */}
          {showApprovalLog && (
            <div className="fade">
              <CommunicationLogForm
                client={client}
                pName={isPP ? `Pre-Production Sample v${v}` : `Sample v${v}`}
                mode="sample-approval"
                feedbackMode="approve"
                title={
                  isPP
                    ? `Pre-production sample v${v} approved. How did the client confirm?`
                    : `Sample v${v} approved. How did the client confirm?`
                }
                subTitle="Record client confirmation (WhatsApp screenshot, call notes, or email) to release bulk production."
                buttonText={isPP ? "Log approval & release full production" : "Log approval and process the order"}
                buttonHint="Paste their confirmation message or attach screenshot."
                hideCard={false}
                onBack={() => setShowApprovalLog(false)}
                onLog={(logData) => {
                  if (onApprove) onApprove(logData);
                  setShowApprovalLog(false);
                  toast.success(`Approval logged! Proceeding to next step.`);
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Modal 1: Send Proof Preview Modal */}
      {showProofModal && (
        <SendDocumentOverlay
          s={s}
          client={client}
          docType="sample_proof"
          mode={isPP ? "pre_production" : "sample"}
          round={v}
          subJobNos={displayItems.map((it) => it.subJobNo)}
          onClose={() => setShowProofModal(false)}
          onSend={(channel = "WhatsApp") => {
            up({
              sampleProofSent: channel,
              sampleProofSentAt: new Date().toISOString(),
              photosAt: new Date().toISOString(),
            });
            setShowProofModal(false);
          }}
        >
          <SampleProofSheet
            s={s}
            client={client}
            job={job}
            ids={ids}
            mode={isPP ? "pre_production" : "sample"}
            round={v}
            samplePhotos={samplePhotos}
            sampleVideos={sampleVideos}
            displayItems={displayItems}
            coordinatorName={s.coordinator || job?.coordinator || "Client Servicing"}
            onPreviewPhoto={(url) => setActivePhotoModal(url)}
            onPreviewVideo={(url) => setActiveVideoModal(url)}
          />
        </SendDocumentOverlay>
      )}

      {/* Modal 2: Video Playback */}
      {activeVideoModal && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setActiveVideoModal(null)}
        >
          <div
            className="bg-black rounded-2xl overflow-hidden max-w-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-3 bg-slate-900 text-white">
              <span className="text-xs font-bold">Sample Piece Video Clip</span>
              <button
                type="button"
                onClick={() => setActiveVideoModal(null)}
                className="text-white hover:text-gray-300 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <video src={activeVideoModal} controls autoPlay className="w-full max-h-[70vh]" />
          </div>
        </div>
      )}

      {/* Modal 3: Photo Enlargement */}
      {activePhotoModal && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setActivePhotoModal(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <img src={activePhotoModal} alt="Sample Large" className="max-w-full max-h-[85vh] rounded-xl object-contain" />
            <button
              type="button"
              onClick={() => setActivePhotoModal(null)}
              className="absolute top-2 right-2 text-white bg-black/60 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SampleProofApprovalDesk;
