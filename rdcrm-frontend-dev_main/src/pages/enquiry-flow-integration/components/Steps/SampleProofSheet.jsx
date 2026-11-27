import React, { useState } from "react";
import {
  contactsOf,
  formatAddress,
  digits,
  getAllProductPreviews,
  formatEnquiryNo,
  ENQUIRY_CONFIG,
} from "../../utils/helpers";

/**
 * SampleProofSheet
 * Official pre-production sample photo & video inspection document.
 * Matches company document layout: Header, To/Attention, Round, Product Preview with Approved Design,
 * Sample Proof photos with Preview & Download, Sample Video with View & Download, Instruction Boxes, and Signature lines.
 */
const SampleProofSheet = ({
  s = {},
  client = {},
  customer = null,
  contact = null,
  job = {},
  ids = {},
  mode = "sample",
  round = 1,
  samplePhotos = {},
  sampleVideos = {},
  displayItems = [],
  coordinatorName = "",
  onPreviewPhoto,
  onPreviewVideo,
}) => {
  const isPP = mode === "pre_production" || (mode !== "sample" && s?.mode === "production" && Boolean(s?.pp || s?.ppAfter));

  const parentJobNo = s?.seq
    ? formatEnquiryNo(s.seq)
    : (ids?.enq?.startsWith("RD") ? ids.enq : ids?.enq?.replace("ENQ/26/", "RD")) ||
      ENQUIRY_CONFIG.DEFAULT_ENQUIRY_NO;

  // Resolve contacts
  const contacts = contactsOf(client, s);
  const selectedContact =
    contact ||
    contacts.find((c) => c.id === s?.contactId) ||
    contacts[0] ||
    {};

  const contactName =
    selectedContact.name ||
    client?.contact ||
    client?.name ||
    "Contact Person";
  const contactRole = selectedContact.role || "";
  const contactEmail =
    selectedContact.email ||
    client?.email ||
    "contact@client.example";
  const rawPhone = String(
    selectedContact.phone || selectedContact.mobile || client?.mobile || "9820055123"
  );
  const contactPhone = `+91 ${digits(rawPhone)}`;

  const todayStr = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Client / Customer details (prioritizes "Bill a different party" when active)
  const isDiffBill = Boolean(s.billTo && s.billTo.on && (s.billTo.name || s.billTo.address));
  const activeClientName = isDiffBill
    ? (s.billTo.name || customer?.name || client?.name || "Client Name Ltd")
    : (customer?.name || client?.name || client?.company || "Client Name Ltd");

  const activeClientAddress = isDiffBill
    ? (formatAddress(s.billTo.address) || formatAddress(customer?.billing) || formatAddress(customer?.address) || formatAddress(client?.billing) || formatAddress(client?.address) || "Plot 14, MIDC, Andheri East, Mumbai 400093")
    : (formatAddress(customer?.billing) || formatAddress(customer?.address) || formatAddress(client?.billing) || formatAddress(client?.address) || "Plot 14, MIDC, Andheri East, Mumbai 400093");

  const rawGstin = isDiffBill
    ? (s.billTo.gstin || customer?.gstin || client?.gstin || "27AADCM5561H1Z6")
    : (customer?.gstin || client?.gstin || "27AADCM5561H1Z6");
  const activeClientGstin =
    typeof rawGstin === "object" ? (rawGstin.gst_no || "") : (rawGstin || "");

  // Coordinator
  const coordinator =
    coordinatorName ||
    s.coordinator ||
    s.account_manager ||
    s.clientServicing ||
    job?.coordinator ||
    "Client Servicing";

  // Derive products list (with approved design images)
  const previews = getAllProductPreviews(s, s?.e || {}, parentJobNo);
  const allProducts = (previews && previews.length > 0)
    ? previews.map((p, idx) => {
        const matchingDisplay = (displayItems || []).find((d) => d.subJobNo === p.subJobNo) || displayItems?.[idx] || {};
        const img = p.imgUrl || p.approved_design_url || matchingDisplay.imgUrl || matchingDisplay.approved_design_url || matchingDisplay.image || null;
        return {
          ...p,
          ...matchingDisplay,
          imgUrl: img,
          approved_design_url: img,
        };
      })
    : (displayItems && displayItems.length > 0)
    ? displayItems.map((d, idx) => ({
        ...d,
        subJobNo: d.subJobNo || `${parentJobNo}-A${idx + 1}`,
        theme: d.theme || d.name || "Custom Trophy",
        spec: (typeof d.spec === "string" && d.spec) || d.specLine || d.spec_line || `${(typeof d.size === "object" ? (d.size?.trophyH || d.size?.size) : d.size) ? (typeof d.size === "object" ? (d.size?.trophyH || d.size?.size) : d.size) + ' in · ' : ''}${d.mat || d.material || 'MDF + Crystal'}`,
        imgUrl: d.imgUrl || d.approved_design_url || d.image || null,
        approved_design_url: d.approved_design_url || d.imgUrl || d.image || null,
      }))
    : [];

  const subJobCode =
    displayItems.length > 1
      ? displayItems.map((it) => it.subJobNo).join(", ")
      : (displayItems[0]?.subJobNo || allProducts[0]?.subJobNo || `${parentJobNo}-A1`);

  const primaryTheme =
    displayItems[0]?.theme ||
    allProducts[0]?.theme ||
    s.e?.theme ||
    "Crystal Trophy";

  // Build photo entries list
  const photoEntries = [];
  if (samplePhotos && typeof samplePhotos === "object") {
    // If it's a map by subJobNo
    Object.entries(samplePhotos).forEach(([key, val]) => {
      if (!val) return;
      if (Array.isArray(val)) {
        val.forEach((p) => {
          if (p?.url || typeof p === "string") {
            photoEntries.push({
              subJobNo: key,
              url: p.url || p,
              name: p.name || `${key}_sample_photo.jpg`,
              status: "READY",
            });
          }
        });
      } else if (val.url || typeof val === "string") {
        photoEntries.push({
          subJobNo: key,
          url: val.url || val,
          name: val.name || `${key}_sample_photo.jpg`,
          status: "READY",
        });
      }
    });
  }

  // Build video entries list
  const videoEntries = [];
  if (sampleVideos && typeof sampleVideos === "object") {
    Object.entries(sampleVideos).forEach(([key, val]) => {
      if (!val) return;
      if (Array.isArray(val)) {
        val.forEach((v) => {
          if (v?.url || typeof v === "string") {
            videoEntries.push({
              subJobNo: key,
              url: v.url || v,
              name: v.name || `${key}_inspection_video.mp4`,
              status: "READY",
            });
          }
        });
      } else if (val.url || typeof val === "string") {
        videoEntries.push({
          subJobNo: key,
          url: val.url || val,
          name: val.name || `${key}_inspection_video.mp4`,
          status: "READY",
        });
      }
    });
  }

  // Internal Lightbox / Video modal state if parent didn't pass handlers
  const [localPhotoModal, setLocalPhotoModal] = useState(null);
  const [localVideoModal, setLocalVideoModal] = useState(null);

  const openPhoto = (url, name) => {
    if (onPreviewPhoto) {
      onPreviewPhoto(url, name);
    } else {
      setLocalPhotoModal({ url, name });
    }
  };

  const openVideo = (url, name) => {
    if (onPreviewVideo) {
      onPreviewVideo(url, name);
    } else {
      setLocalVideoModal({ url, name });
    }
  };

  const handleDownload = async (e, fileUrl, defaultName = "sample-file") => {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();
    if (!fileUrl) return;
    try {
      const res = await fetch(fileUrl);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = defaultName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      const a = document.createElement("a");
      a.href = fileUrl;
      a.download = defaultName;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <>
      <article className="w-full max-w-4xl mx-auto bg-white shadow-2xl p-8 sm:p-12 rounded-xl mb-8 relative z-10 print-content text-gray-800 text-xs border border-gray-100 text-left">
        {/* Document Header */}
        <div className="flex justify-between items-start border-b-2 border-indigo-600 pb-4 mb-8">
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">RD Custom Awards Pvt. Ltd.</h2>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              {isPP ? "Pre-production sample proof for approval" : `Sample v${round} production proof for approval`}
            </p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-black text-indigo-900 tracking-tight">
              {subJobCode}
            </h2>
            <p className="text-xs text-gray-500 font-semibold mt-0.5">Job: {parentJobNo}</p>
            <p className="text-xs text-gray-400 mt-0.5">{todayStr}</p>
          </div>
        </div>

        {/* To & Attention Grid */}
        <div className="grid grid-cols-2 gap-12 text-xs mb-8">
          <div className="grid grid-cols-[80px_1fr] items-start">
            <span className="text-gray-400 font-medium">To</span>
            <div className="text-gray-900 font-medium leading-relaxed">
              <span className="font-bold text-gray-900 block">{activeClientName}</span>
              <span className="text-gray-600 block whitespace-pre-line">
                {activeClientAddress}
              </span>
              <span className="text-gray-600 block mt-0.5">
                GSTIN {activeClientGstin}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-[80px_1fr] items-start">
            <span className="text-gray-400 font-medium">Attention</span>
            <div className="text-gray-900 font-medium leading-relaxed">
              <span className="font-bold text-gray-900 block">
                {contactName} {contactRole ? <span className="font-normal text-gray-500">({contactRole})</span> : ""}
              </span>
              <span className="text-gray-600 block">{contactEmail}</span>
              <span className="text-gray-600 block">{contactPhone}</span>
            </div>
          </div>
        </div>

        {/* Section: Pre-production sample proof round */}
        <div className="pt-4 border-t border-gray-100 space-y-4 mb-8">
          <h3 className="text-sm font-bold text-gray-900">
            {isPP ? `Pre-production sample proof · round ${round}` : `Sample v${round} production proof`}
          </h3>

          <div className="border-t border-gray-200">
            <table className="w-full text-xs text-left">
              <tbody>
                {/* 1. Job / Sub-job */}
                <tr className="border-b border-gray-100">
                  <td className="py-3 text-gray-400 font-medium w-36">Job / Sub-job</td>
                  <td className="py-3 font-semibold text-gray-900">{parentJobNo} · {subJobCode}</td>
                </tr>

                {/* 2. For */}
                <tr className="border-b border-gray-100">
                  <td className="py-3 text-gray-400 font-medium w-36">For</td>
                  <td className="py-3 font-semibold text-gray-900">
                    {isPP ? "Pre-production sample (1 piece)" : `Sample v${round} production piece`} · {primaryTheme}
                  </td>
                </tr>

                {/* 3. Coordinator */}
                <tr className="border-b border-gray-100">
                  <td className="py-3 text-gray-400 font-medium w-36">Coordinator</td>
                  <td className="py-3 font-semibold text-gray-900">{coordinator}</td>
                </tr>

                {/* 4. Product preview (Approved Design Images) */}
                {allProducts && allProducts.length > 0 && (
                  <tr className="border-b border-gray-100">
                    <td className="py-3 text-gray-400 font-medium w-36 align-top">Product preview</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-3 items-start">
                        {allProducts.map((prod, pIdx) => {
                          const img = prod.imgUrl || prod.approved_design_url;
                          return (
                            <div
                              key={prod.subJobNo || pIdx}
                              className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-200 bg-white shadow-2xs max-w-sm hover:border-indigo-300 transition"
                            >
                              <div
                                className="w-16 h-16 rounded-lg border border-gray-200 overflow-hidden bg-white shrink-0 p-0.5 shadow-2xs cursor-pointer group relative"
                                onClick={() => img && openPhoto(img, `${prod.subJobNo} Approved Design`)}
                                title="Click to preview approved design"
                              >
                                {img ? (
                                  <>
                                    <img
                                      src={img}
                                      alt={prod.theme || "Trophy Design"}
                                      className="w-full h-full object-cover rounded"
                                    />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[10px] font-bold rounded">
                                      👁
                                    </div>
                                  </>
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-[10px]">
                                    No img
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <span className="inline-block text-[10px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.2 rounded mb-0.5">
                                  {prod.subJobNo}
                                </span>
                                <div className="text-xs font-bold text-gray-900 truncate">
                                  {prod.theme}
                                </div>
                                <div className="text-[10px] text-gray-500">
                                  {(typeof prod.spec === "string" && prod.spec) ||
                                    prod.specLine ||
                                    prod.spec_line ||
                                    `${(typeof prod.size === "object" ? (prod.size?.trophyH || prod.size?.size) : prod.size) ? (typeof prod.size === "object" ? (prod.size?.trophyH || prod.size?.size) : prod.size) + ' in · ' : ''}${prod.material || prod.mat || 'Fusion: MDF + Crystal'}`}
                                </div>
                                {img && (
                                  <div className="flex items-center gap-2 mt-1">
                                    <button
                                      type="button"
                                      onClick={() => openPhoto(img, `${prod.subJobNo} Approved Design`)}
                                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer"
                                    >
                                      <span>👁</span> View
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => handleDownload(e, img, `${prod.subJobNo}-approved-design.jpg`)}
                                      className="text-[10px] font-bold text-gray-600 hover:text-gray-900 flex items-center gap-0.5 cursor-pointer"
                                    >
                                      <span>⬇</span> Download
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                )}

                {/* 5. Sample Proof (Photos with Thumbnail, Preview & Download) */}
                <tr className="border-b border-gray-100">
                  <td className="py-3 text-gray-400 font-medium w-36 align-top">Sample Proof</td>
                  <td className="py-3">
                    {photoEntries.length > 0 ? (
                      <div className="space-y-2.5">
                        {photoEntries.map((pe, idx) => (
                          <div
                            key={idx}
                            className="flex flex-wrap items-center gap-3 p-2.5 rounded-xl border border-gray-200 bg-white shadow-2xs hover:border-indigo-300 transition"
                          >
                            {/* Photo Thumbnail */}
                            <div
                              className="w-14 h-14 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 shrink-0 p-0.5 shadow-2xs cursor-pointer group relative"
                              onClick={() => openPhoto(pe.url, pe.name)}
                              title="Click to preview sample photo"
                            >
                              <img
                                src={pe.url}
                                alt={pe.name}
                                className="w-full h-full object-cover rounded"
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[10px] font-bold rounded">
                                👁
                              </div>
                            </div>

                            {/* File Details */}
                            <div className="flex-1 min-w-[180px]">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm">📄</span>
                                <span className="font-semibold text-gray-900 text-xs truncate max-w-xs">{pe.name}</span>
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase">
                                  {pe.status || "READY"}
                                </span>
                              </div>
                              <div className="text-[10px] text-gray-400 mt-0.5">
                                {pe.subJobNo ? `Sub-job: ${pe.subJobNo} · ` : ""}Shop floor crafted sample piece photo
                              </div>
                            </div>

                            {/* Actions: View & Download */}
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => openPhoto(pe.url, pe.name)}
                                className="px-2.5 py-1 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition cursor-pointer flex items-center gap-1"
                              >
                                <span>👁</span> View
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDownload(e, pe.url, pe.name)}
                                className="px-2.5 py-1 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-200 transition cursor-pointer flex items-center gap-1"
                              >
                                <span>⬇</span> Download
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-gray-400 text-xs italic py-1">
                        <span>📄</span> No sample photo uploaded yet
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-gray-100 text-gray-500 uppercase">
                          PENDING
                        </span>
                      </div>
                    )}
                  </td>
                </tr>

                {/* 6. Sample Video (Inspection Video with View & Download) */}
                {videoEntries.length > 0 && (
                  <tr className="border-b border-gray-100">
                    <td className="py-3 text-gray-400 font-medium w-36 align-top">Sample Video</td>
                    <td className="py-3">
                      <div className="space-y-2.5">
                        {videoEntries.map((ve, idx) => (
                          <div
                            key={idx}
                            className="flex flex-wrap items-center gap-3 p-2.5 rounded-xl border border-gray-200 bg-white shadow-2xs hover:border-indigo-300 transition"
                          >
                            {/* Video Play Thumbnail */}
                            <div
                              className="w-14 h-14 rounded-lg border border-gray-200 overflow-hidden bg-slate-900 shrink-0 flex items-center justify-center text-white cursor-pointer group relative shadow-2xs"
                              onClick={() => openVideo(ve.url, ve.name)}
                              title="Click to play video"
                            >
                              <span className="text-xl group-hover:scale-110 transition">▶</span>
                            </div>

                            {/* Video Details */}
                            <div className="flex-1 min-w-[180px]">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm">🎥</span>
                                <span className="font-semibold text-gray-900 text-xs truncate max-w-xs">{ve.name}</span>
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                                  READY
                                </span>
                              </div>
                              <div className="text-[10px] text-gray-400 mt-0.5">
                                {ve.subJobNo ? `Sub-job: ${ve.subJobNo} · ` : ""}360° rotating inspection video clip
                              </div>
                            </div>

                            {/* Actions: View & Download */}
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => openVideo(ve.url, ve.name)}
                                className="px-2.5 py-1 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition cursor-pointer flex items-center gap-1"
                              >
                                <span>👁</span> View
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDownload(e, ve.url, ve.name)}
                                className="px-2.5 py-1 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-200 transition cursor-pointer flex items-center gap-1"
                              >
                                <span>⬇</span> Download
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Instruction Callout Boxes matching screenshot */}
        <div className="space-y-3 mb-8">
          <div className="border border-gray-200 rounded-xl p-3.5 bg-gray-50/60 text-gray-700 text-xs font-medium leading-relaxed">
            The pre-production sample photos and video are attached with this message. Please check trophy finish, engraving, logo alignment, and proportions, then reply to approve or list corrections.
          </div>
          <div className="border border-gray-200 rounded-xl p-3.5 bg-gray-50/60 text-gray-700 text-xs font-medium leading-relaxed">
            Please check the details and reply within 24 hours if anything needs to change.
          </div>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-3 gap-8 pt-8 border-t border-gray-200 text-xs text-gray-500 mb-6">
          <div className="border-t border-gray-900 pt-2 font-medium">
            For RD Custom Awards Pvt. Ltd.
          </div>
          <div className="border-t border-gray-900 pt-2 font-medium text-center">
            Coordinator
          </div>
          <div className="border-t border-gray-900 pt-2 font-medium text-right">
            Client acceptance
          </div>
        </div>

        {/* Reference Footer Note */}
        <div className="text-center text-[10px] text-gray-400">
          {subJobCode} · Job reference since enquiry {parentJobNo}
        </div>
      </article>

      {/* Local Video Playback Modal */}
      {localVideoModal && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLocalVideoModal(null)}
        >
          <div
            className="bg-black rounded-2xl overflow-hidden max-w-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-3 bg-slate-900 text-white">
              <span className="text-xs font-bold">{localVideoModal.name || "Sample Video Clip"}</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={(e) => handleDownload(e, localVideoModal.url, localVideoModal.name)}
                  className="text-xs text-indigo-300 hover:text-white font-bold cursor-pointer"
                >
                  ⬇ Download
                </button>
                <button
                  type="button"
                  onClick={() => setLocalVideoModal(null)}
                  className="text-white hover:text-gray-300 text-sm font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>
            <video src={localVideoModal.url} controls autoPlay className="w-full max-h-[70vh]" />
          </div>
        </div>
      )}

      {/* Local Photo Enlargement Modal */}
      {localPhotoModal && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLocalPhotoModal(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-2.5 bg-black/70 rounded-t-xl text-white">
              <span className="text-xs font-bold truncate max-w-md">{localPhotoModal.name || "Sample Photo"}</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={(e) => handleDownload(e, localPhotoModal.url, localPhotoModal.name)}
                  className="text-xs text-indigo-300 hover:text-white font-bold cursor-pointer"
                >
                  ⬇ Download
                </button>
                <button
                  type="button"
                  onClick={() => setLocalPhotoModal(null)}
                  className="text-white hover:text-gray-300 text-sm font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>
            <img
              src={localPhotoModal.url}
              alt={localPhotoModal.name}
              className="max-w-full max-h-[80vh] rounded-b-xl object-contain bg-black"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default SampleProofSheet;
