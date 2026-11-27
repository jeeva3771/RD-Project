import React from "react";

const formatAddress = (addr) => {
  if (!addr) return "";
  if (typeof addr === "string") return addr.trim();
  if (Array.isArray(addr)) {
    for (const item of addr) {
      const res = formatAddress(item);
      if (res) return res;
    }
    return "";
  }
  if (typeof addr === "object") {
    if (typeof addr.address === "string" && addr.address.trim()) return addr.address.trim();
    if (typeof addr.full_address === "string" && addr.full_address.trim()) return addr.full_address.trim();
    const parts = [addr.address_1, addr.address_2, addr.city, addr.state, addr.postal_code || addr.pin]
      .filter((p) => p !== undefined && p !== null && String(p).trim() !== "")
      .map((p) => String(p).trim());
    if (parts.length > 0) return parts.join(", ");
    if (addr.label) return String(addr.label);
    return "";
  }
  return String(addr);
};

const getFileTypeIcon = (filename = "") => {
  const f = filename.toLowerCase();
  if (f.endsWith(".xlsx") || f.endsWith(".xls") || f.endsWith(".csv")) return "📊";
  if (f.endsWith(".docx") || f.endsWith(".doc") || f.endsWith(".txt")) return "📝";
  if (f.endsWith(".pdf")) return "📕";
  if (f.endsWith(".cdr") || f.endsWith(".ai") || f.endsWith(".eps") || f.endsWith(".psd")) return "🎨";
  if (f.endsWith(".png") || f.endsWith(".jpg") || f.endsWith(".jpeg") || f.endsWith(".webp")) return "🖼️";
  return "📎";
};

const SampleProofSheetApproval = ({
  proofData = {},
  activeProof = {},
  parentJobNo = "",
  targetSubJobNo = "",
  todayStr = "",
  submitting = false,
  handleSubmitFileAction,
  handleBulkStageApproval,
  setActiveFileModal,
}) => {
  const round = activeProof.round || 1;
  const artistName = activeProof.assigned_to_name || "DTP Artist";

  // Derive products list with fallbacks
  const allProducts =
    Array.isArray(proofData.all_products) && proofData.all_products.length > 0
      ? proofData.all_products
      : [
        {
          subJobNo: targetSubJobNo,
          theme: activeProof.theme || activeProof.product_name || "Custom Trophy",
          spec:
            (typeof activeProof.spec === "string" && activeProof.spec) ||
            activeProof.spec_line ||
            (activeProof.size
              ? `Trophy · ${typeof activeProof.size === "object" ? (activeProof.size?.trophyH || activeProof.size?.size || 8) : activeProof.size}" in · Fusion: MDF + Crystal`
              : "Trophy · 8\" in · Fusion: MDF + Crystal"),
          imgUrl: activeProof.img_url || "",
          qty: activeProof.quantity || 1,
        },
      ];

  // Content File Info
  const contentName =
    activeProof.content_name ||
    activeProof.cs_uploaded_content?.name ||
    activeProof.content_proofing_files?.[0]?.original_name ||
    activeProof.content_proofing_files?.[0]?.name ||
    "Sample Artwork Content";

  const contentUrl =
    activeProof.content_file_url ||
    activeProof.cs_uploaded_content?.file_url ||
    activeProof.content_proofing_files?.[0]?.file_url ||
    null;

  // Build list of all available sample content proof files (any format)
  const contentFilesList = [];
  if (Array.isArray(activeProof.content_proofing_files) && activeProof.content_proofing_files.length > 0) {
    activeProof.content_proofing_files.forEach((f) => {
      if (
        !contentFilesList.some(
          (c) =>
            (c.file_url && f.file_url && c.file_url === f.file_url) ||
            (c._id && f._id && String(c._id) === String(f._id))
        )
      ) {
        contentFilesList.push(f);
      }
    });
  }
  if (activeProof.cs_uploaded_content) {
    if (!contentFilesList.some((c) => c.file_url === activeProof.cs_uploaded_content.file_url)) {
      contentFilesList.push(activeProof.cs_uploaded_content);
    }
  }
  if (contentFilesList.length === 0 && (contentName || contentUrl)) {
    contentFilesList.push({
      original_name: contentName,
      name: contentName,
      file_url: contentUrl,
      status: "Pending",
    });
  }

  // Build list of all available sample proof files (images only)
  const proofFilesList = [];
  if (activeProof.cs_uploaded_proof) {
    proofFilesList.push(activeProof.cs_uploaded_proof);
  }
  (activeProof.master_template_files || []).forEach((f) => {
    if (
      !proofFilesList.some(
        (p) =>
          (p._id && f._id && String(p._id) === String(f._id)) ||
          (p.file_url && f.file_url && p.file_url === f.file_url) ||
          (p.raw_url && f.raw_url && p.raw_url === f.raw_url)
      )
    ) {
      proofFilesList.push(f);
    }
  });

  const primaryProof = proofFilesList[0] || {};
  const sampleProofId = primaryProof._id || primaryProof.file_url || "sample_proof";
  const sampleProofName =
    primaryProof.name ||
    primaryProof.original_name ||
    "Sample_Artwork_Proof";
  const sampleProofUrl = primaryProof.file_url || "";
  const sampleProofStatus = primaryProof.status || activeProof.proof_status || "Pending";

  // Unified single approval calculation:
  // Both Master Template images and Content files are approved together
  const isAllMasterApproved =
    proofFilesList.length > 0
      ? proofFilesList.every((f) => f.status === "Approved")
      : sampleProofStatus === "Approved" || Boolean(activeProof.is_master_approved);
  const isAllContentApproved =
    contentFilesList.length > 0
      ? contentFilesList.every((f) => f.status === "Approved")
      : Boolean(activeProof.is_content_approved);

  const isApproved = Boolean(
    activeProof.proof_status === "approved" ||
    activeProof.proof_status === "Approved" ||
    sampleProofStatus === "Approved" ||
    primaryProof.status === "Approved" ||
    Boolean(activeProof.proof_decision?.decision === "approved") ||
    Boolean(proofData?.proof_decision?.decision === "approved") ||
    (isAllMasterApproved && isAllContentApproved) ||
    isAllMasterApproved ||
    Boolean(activeProof.is_master_approved)
  );

  // When approved, ensure all displayed files reflect Approved badge
  if (isApproved) {
    contentFilesList.forEach((f) => {
      f.status = "Approved";
    });
    proofFilesList.forEach((f) => {
      f.status = "Approved";
    });
  }

  const isRejected = !isApproved && (
    proofFilesList.some((f) => f.status === "Rejected") ||
    contentFilesList.some((f) => f.status === "Rejected")
  );

  const rejectionNotes = [
    ...proofFilesList.map((f) => f.rejection_reason),
    ...contentFilesList.map((f) => f.rejection_reason),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="w-full max-w-4xl mx-auto bg-white shadow-2xl p-8 sm:p-12 rounded-xl mb-8 relative z-10 print:shadow-none print:border-none print:p-0 text-gray-800 text-xs border border-gray-200">
      {/* Document Header */}
      <div className="flex justify-between items-start border-b-2 border-indigo-600 pb-4 mb-8">
        <div>
          <div className="mb-2">
            <img
              src="https://rdcustomawards.com/cdn/shop/files/logo.svg?v=1700546283&width=90"
              alt="RD Custom Awards Logo"
              className="h-10 sm:h-12 w-auto object-contain"
            />
          </div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">
            RD Custom Awards Pvt. Ltd.
          </h2>
          <p className="text-xs text-gray-500 mt-1 font-medium">
            Artwork proof for approval · sample
          </p>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-black text-indigo-900 tracking-tight">
            {targetSubJobNo}
          </h2>
          <p className="text-xs text-gray-500 font-semibold mt-0.5">Job: {parentJobNo}</p>
          <p className="text-xs text-gray-400 mt-0.5">{todayStr}</p>
        </div>
      </div>

      {/* To & Attention Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs mb-8 pb-6 border-b border-gray-100">
        <div className="grid grid-cols-[80px_1fr] items-start">
          <span className="text-gray-400 font-medium">To</span>
          <div className="text-gray-900 font-medium leading-relaxed">
            <span className="font-bold block text-sm">
              {typeof proofData.client_company === "string" ? proofData.client_company : (typeof proofData.client_name === "string" ? proofData.client_name : "Client Name Ltd")}
            </span>
            <span className="block mt-0.5 text-gray-600 whitespace-pre-line">
              {formatAddress(proofData.client_address) || "Plot 14, MIDC, Andheri East, Mumbai 400093"}
            </span>
            <span className="block mt-0.5 text-gray-500 font-semibold">
              GSTIN {typeof proofData.client_gstin === "object" ? (proofData.client_gstin?.gst_no || "") : (proofData.client_gstin || "27AADCM5561H1Z6")}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-[80px_1fr] items-start">
          <span className="text-gray-400 font-medium">Attention</span>
          <div className="text-gray-900 font-medium leading-relaxed">
            <span className="font-bold block text-sm">
              {proofData.client_name || "Contact Person"}
            </span>
            <span className="block mt-0.5 text-gray-600">
              {proofData.client_email || "contact@client.example"}
            </span>
            <span className="block mt-0.5 text-gray-600">
              +91 {proofData.client_phone || "9820055123"}
            </span>
          </div>
        </div>
      </div>

      {/* Section: Artwork proof round */}
      <div className="space-y-4 mb-8">
        <h3 className="text-sm font-bold text-gray-900">
          Artwork proof · round {round}
        </h3>

        <div className="border-t border-gray-200">
          <table className="w-full text-xs text-left">
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-3 text-gray-400 font-medium w-36">Job / Sub-job</td>
                <td className="py-3 font-semibold text-gray-900">
                  {parentJobNo} · {targetSubJobNo}
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-3 text-gray-400 font-medium w-36">For</td>
                <td className="py-3 font-semibold text-gray-900">
                  Sample piece · {activeProof.theme || activeProof.product_name || "Custom Trophy"}
                </td>
              </tr>
              {artistName && (
                <tr className="border-b border-gray-100">
                  <td className="py-3 text-gray-400 font-medium w-36">DTP Artist</td>
                  <td className="py-3 font-semibold text-gray-900">{artistName}</td>
                </tr>
              )}

              {/* Product preview cards */}
              {allProducts.length > 0 && (
                <tr className="border-b border-gray-100">
                  <td className="py-3 text-gray-400 font-medium w-36 align-top">Product preview</td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-3 items-start">
                      {allProducts.map((prod, pIdx) => (
                        <div
                          key={prod.subJobNo || pIdx}
                          className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-200 bg-white shadow-2xs max-w-sm"
                        >
                          <div className="w-16 h-16 rounded-lg border border-gray-200 overflow-hidden bg-white shrink-0 p-0.5 shadow-2xs flex items-center justify-center">
                            {prod.imgUrl ? (
                              <img
                                src={prod.imgUrl}
                                alt={prod.theme || "Trophy"}
                                className="w-full h-full object-cover rounded"
                              />
                            ) : (
                              <span className="text-2xl">🏆</span>
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
                                `${(typeof prod.size === "object" ? (prod.size?.trophyH || prod.size?.size) : prod.size) ? (typeof prod.size === "object" ? (prod.size?.trophyH || prod.size?.size) : prod.size) + ' in · ' : ''}${prod.qty || 1} pcs`}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              )}

              {/* Content Proof Documents Row */}
              <tr className="border-b border-gray-100">
                <td className="py-3 text-gray-400 font-medium w-36 align-top">
                  Content Proof
                  <span className="block text-[10px] text-gray-400 font-normal">
                    Documents & lists
                  </span>
                </td>
                <td className="py-3 text-gray-800 font-medium">
                  {contentFilesList.length > 0 ? (
                    <div className="space-y-2">
                      {contentFilesList.map((cf, idx) => {
                        const cfName = cf.name || cf.original_name || `Content_File_${idx + 1}`;
                        const cfUrl = cf.file_url || "";
                        const cfStatus = cf.status || "Pending";
                        const isCfApproved = cfStatus === "Approved";
                        const isCfRejected = cfStatus === "Rejected";

                        return (
                          <div
                            key={cf._id || idx}
                            className="flex flex-wrap items-center justify-between p-2 rounded-lg border border-gray-200 bg-gray-50/50 hover:bg-gray-50 transition"
                          >
                            <div className="flex items-center gap-2 truncate max-w-md">
                              <span className="text-base">{getFileTypeIcon(cfName)}</span>
                              <span className="font-semibold text-gray-900 text-xs truncate" title={cfName}>
                                {cfName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${isCfApproved
                                    ? "bg-emerald-100 text-emerald-800"
                                    : isCfRejected
                                      ? "bg-rose-100 text-rose-800"
                                      : "bg-amber-100 text-amber-800"
                                  }`}
                              >
                                {cfStatus}
                              </span>
                              {cfUrl && (
                                <>
                                  <a
                                    href={cfUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline"
                                  >
                                    👁️ View
                                  </a>
                                  <a
                                    href={cfUrl}
                                    download={cfName}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-bold text-emerald-600 hover:text-emerald-800 underline"
                                  >
                                    ⬇️ Download
                                  </a>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-gray-400 italic">No content proof documents uploaded yet</span>
                  )}
                </td>
              </tr>

              {/* Master Template Proof Images Row */}
              <tr className="border-b border-gray-100">
                <td className="py-3 text-gray-400 font-medium w-36 align-top">
                  Master Template
                  <span className="block text-[10px] text-gray-400 font-normal">
                    Layout proof images
                  </span>
                </td>
                <td className="py-3 text-indigo-900 font-semibold">
                  {proofFilesList.length > 0 ? (
                    <div className="space-y-2">
                      {proofFilesList.map((pf, idx) => {
                        const pfName = pf.name || pf.original_name || `Sample_Proof_${idx + 1}`;
                        const pfUrl = pf.file_url || "";
                        const pfStatus = pf.status || activeProof.proof_status || "Pending";
                        const isPfApproved = pfStatus === "Approved";
                        const isPfRejected = pfStatus === "Rejected";

                        return (
                          <div
                            key={pf._id || idx}
                            className="flex flex-wrap items-center justify-between p-2 rounded-lg border border-indigo-100 bg-indigo-50/30 hover:bg-indigo-50/60 transition"
                          >
                            <div className="flex items-center gap-3 truncate max-w-md">
                              {/* Image thumbnail preview */}
                              <div className="w-12 h-12 rounded-lg border border-indigo-200 overflow-hidden bg-white shrink-0 flex items-center justify-center shadow-2xs">
                                {pfUrl ? (
                                  <img
                                    src={pfUrl}
                                    alt={pfName}
                                    className="w-full h-full object-contain"
                                  />
                                ) : (
                                  <span>🖼️</span>
                                )}
                              </div>
                              <span className="font-semibold text-gray-900 text-xs truncate" title={pfName}>
                                {pfName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${isPfApproved
                                    ? "bg-emerald-100 text-emerald-800"
                                    : isPfRejected
                                      ? "bg-rose-100 text-rose-800"
                                      : "bg-indigo-100 text-indigo-700"
                                  }`}
                              >
                                {pfStatus}
                              </span>
                              {pfUrl && (
                                <>
                                  <a
                                    href={pfUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline"
                                  >
                                    👁️ View
                                  </a>
                                  <a
                                    href={pfUrl}
                                    download={pfName}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-bold text-emerald-600 hover:text-emerald-800 underline"
                                  >
                                    ⬇️ Download
                                  </a>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-gray-400 italic">No master template images uploaded yet</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Callout Boxes */}
        <div className="space-y-3 pt-3">
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 leading-relaxed">
            The layout proof images and content files are attached above. Please check every detail, spelling, logo and placement, then reply to approve or list corrections.
          </div>
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 leading-relaxed">
            Please check the details and reply within 24 hours if anything needs to change.
          </div>
        </div>

        {/* CLIENT DECISION & UNIFIED APPROVAL BAR */}
        <div className="pt-4 border-t border-gray-200">
          {isApproved ? (
            <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow-xs">
                  ✓
                </span>
                <div>
                  <span className="font-extrabold text-emerald-950 text-sm block">
                    Sample Artwork Layout & Content Proof Approved
                  </span>
                  <span className="text-[11px] text-emerald-800 font-medium">
                    Thank you! Both layout and content proofs are confirmed. Sample production will proceed.
                  </span>
                </div>
              </div>
              <span className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-2xs">
                ✓ Confirmed
              </span>
            </div>
          ) : isRejected ? (
            <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-rose-600 text-white flex items-center justify-center font-bold text-base shadow-xs">
                    ✏️
                  </span>
                  <div>
                    <span className="font-extrabold text-rose-950 text-sm block">
                      Alteration Requested
                    </span>
                    <span className="text-[11px] text-rose-800 font-medium">
                      Our DTP studio will prepare the revised proof with your corrections.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    if (handleBulkStageApproval) {
                      handleBulkStageApproval("all");
                    } else {
                      handleSubmitFileAction(null, "all", "Approved");
                    }
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  ✓ Change to Approved
                </button>
              </div>
              {rejectionNotes && (
                <div className="p-3 bg-white border border-rose-200 rounded-lg text-xs text-rose-900 font-medium">
                  <b>Your Alteration Note:</b> {rejectionNotes}
                </div>
              )}
            </div>
          ) : (
            <div className="p-5 bg-gradient-to-r from-indigo-50/80 via-white to-emerald-50/60 border-2 border-indigo-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
              <div>
                <h4 className="font-black text-gray-900 text-sm flex items-center gap-2">
                  <span>✍️</span>
                  <span>Client Approval Decision</span>
                </h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  Please review the master template images and content proof above, then select your decision:
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    if (handleBulkStageApproval) {
                      handleBulkStageApproval("all");
                    } else {
                      handleSubmitFileAction(null, "all", "Approved");
                    }
                  }}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md hover:shadow-lg transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span>✓</span>
                  <span>Approve Sample Artwork & Content</span>
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    const target = proofFilesList[0] || contentFilesList[0] || primaryProof;
                    setActiveFileModal({
                      fileId: target._id || target.file_url || sampleProofId,
                      fileType: "all",
                      fileName: "Sample Artwork & Content Proof",
                      fileUrl: target.file_url || sampleProofUrl,
                    });
                  }}
                  className="px-4 py-2.5 bg-white border-2 border-rose-300 hover:bg-rose-50 text-rose-700 font-extrabold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span>✏️</span>
                  <span>Request Alteration</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Signatures & Reference Footer */}
      <div className="pt-6 border-t border-gray-200">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div className="border-t border-gray-400 pt-2 text-[10px] text-gray-500 font-semibold">
            For RD Custom Awards Pvt. Ltd.
          </div>
          <div className="border-t border-gray-400 pt-2 text-[10px] text-gray-500 font-semibold">
            Coordinator
          </div>
          <div className="border-t border-gray-400 pt-2 text-[10px] text-gray-500 font-semibold">
            Client acceptance
          </div>
        </div>
        <div className="text-center text-[10px] text-gray-400 mt-6 font-medium">
          {targetSubJobNo} · Job reference since enquiry {parentJobNo}
        </div>
      </div>
    </article>
  );
};

export default SampleProofSheetApproval;
