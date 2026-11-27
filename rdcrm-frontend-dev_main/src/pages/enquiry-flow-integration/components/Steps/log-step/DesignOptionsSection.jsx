import React, { useState } from "react";
import CommunicationLogForm from "../../common/CommunicationLogForm";
import FinalDesignSheet from "../FinalDesignSheet";
import AssetReadinessBanner from "./AssetReadinessBanner";
import { toast } from "react-toastify";

const DesignOptionsSection = ({
  s,
  set,
  e,
  client,
  ids,
  lines,
  productsList,
  numLines,
  unselectedProducts,
  toggleProductSelection,
  handleUnhold,
  uploadedDesigns,
  handleDesignUpload,
  removeDesign,
  setPreviewDesignKey,
  isDesignerRequired,
  isAllReadyProducts,
  isSendDisabled,
  sendingIndices,
  setShowDesignPreview,
  productFeedback,
  updateProductFeedback,
  localConfirmed,
  confirmProductFeedback,
  showFinalDesignOptions,
  setShowFinalDesignOptions,
  showFinalDesignShare,
  setShowFinalDesignShare,
  currentUser,
  isLocked = false,
}) => {
  const [loggingPIdx, setLoggingPIdx] = useState(null);

  const notifyAlert = (message) => {
    toast.warn(message, { position: "top-right", autoClose: 3500 });
  };

  const theBrief = s.the_brief || s.rawJob?.the_brief || {};
  const hasUploadedSubJobs =
    Array.isArray(s.sub_jobs) &&
    s.sub_jobs.some(
      (sj) =>
        !sj.is_dropped &&
        !sj.is_on_hold &&
        sj.trophy_type !== "ready" &&
        sj.kind !== "ready" &&
        sj.design_status === "uploaded"
    );
  const isNewlyUploaded =
    theBrief.design_status === "uploaded" ||
    s.designStatus === "uploaded" ||
    hasUploadedSubJobs;

  return (
    <div className="panel p-4 bg-white border-2 border-indigo-600 rounded-xl shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[11px]">
          🎨
        </span>
        <h4 className="font-bold text-sm text-gray-900">Design options</h4>
      </div>
      <p className="text-[10px] text-gray-500 mb-4">
        {numLines} custom product{numLines > 1 ? "s" : ""} ·{" "}
        {productsList
          .map((p, pIdx) => {
            const baseOptCount =
              e.briefMode === "each" && e.productBriefs?.[p.name]?.designOptions
                ? e.productBriefs[p.name].designOptions
                : e.designOptions || 2;
            const optCount = baseOptCount + (s.extraDesignOptions?.[pIdx] || 0);
            return `${p.name} (${optCount} options)`;
          })
          .join(", ")}
      </p>

      {/* Mandatory Assets Readiness Banner (shows warning if deferred assets still missing) */}
      <AssetReadinessBanner
        products={s.sub_jobs && s.sub_jobs.length > 0 ? s.sub_jobs : productsList}
        theBrief={theBrief}
        briefMode={e.briefMode || "one"}
        clientId={s?.clientId || s?.customer_id?._id || s?.customer_id || ""}
        clientName={client || s?.customer_id?.name || ""}
        enquiryNo={s?.enquiry_no || ""}
        onUpdateSubJobAssets={({ subJobNo, client_logo, signatures, additional_files }) => {
          const updatedSubJobs = (s.sub_jobs || []).map((sj) => {
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
                ...(s.the_brief || {}),
                client_logo: client_logo || s.the_brief?.client_logo,
                signatures: signatures || s.the_brief?.signatures,
                additional_files: additional_files || s.the_brief?.additional_files,
              },
            },
            true
          );
          toast.success("Mandatory assets updated successfully!");
        }}
        onImmediateSave={(patch) => set(patch, true)}
      />

      {/* Product Design Uploaders */}
      <div className="space-y-4 mb-5">
        {productsList.map((p, pIdx) => {
          const baseOptCount =
            e.briefMode === "each" && e.productBriefs?.[p.name]?.designOptions
              ? e.productBriefs[p.name].designOptions
              : e.designOptions || 2;
          const optCount = baseOptCount + (s.extraDesignOptions?.[pIdx] || 0);
          const pFbs = Array.isArray(s.productFeedback?.[pIdx])
            ? s.productFeedback[pIdx]
            : s.productFeedback?.[pIdx]
              ? [s.productFeedback[pIdx]]
              : [];
          const isApproved = pFbs.some((fb) => fb?.mode === "approve");
          const activeFb =
            pFbs.find((fb) => fb?.mode === "approve") || pFbs[pFbs.length - 1];
          const matchedLine = lines.find((l) => l.productIndex === pIdx);

          const productUploadedIndices = Object.keys(uploadedDesigns || {})
            .filter((k) => k.startsWith(`${pIdx}-`) && Boolean(uploadedDesigns[k]))
            .map((k) => Number(k.split("-")[1]))
            .filter((n) => !isNaN(n));
          const maxUploadedIdx = productUploadedIndices.length > 0 ? Math.max(...productUploadedIndices) : -1;

          // In rework mode, check if a fresh revision has already been uploaded
          const isRework = pFbs.some((fb) => fb?.mode === "revision" || fb?.mode === "reject");
          const hasFreshRevision = maxUploadedIdx >= optCount;
          const needsRevisionSlot = isRework && !hasFreshRevision && (maxUploadedIdx >= optCount - 1);

          // Strictly allow only up to optCount options (e.g. 2 options).
          // Only show an extra revision slot if product is in rework and no fresh revision has been uploaded yet.
          const effectiveOptCount = needsRevisionSlot
            ? Math.max(optCount + 1, maxUploadedIdx + 2)
            : Math.max(optCount, maxUploadedIdx + 1);

          return (
            <div
              key={pIdx}
              className={`border rounded-lg p-3 ${p.is_dropped
                  ? "bg-gray-100/70 border-gray-300 opacity-60"
                  : p.is_on_hold
                    ? "bg-amber-50/50 border-amber-300"
                    : "bg-gray-50/50 border-gray-200"
                }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={
                      !p.is_dropped &&
                      !p.is_on_hold &&
                      !unselectedProducts.has(pIdx)
                    }
                    disabled={Boolean(p.is_dropped || p.is_on_hold || isLocked)}
                    onChange={() => {
                      if (!p.is_dropped && !p.is_on_hold && !isLocked) toggleProductSelection(pIdx);
                    }}
                    className={`w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 ${p.is_dropped || p.is_on_hold || isLocked
                        ? "opacity-40 cursor-not-allowed bg-gray-200"
                        : "cursor-pointer"
                      }`}
                    title={
                      isLocked
                        ? "Job is cancelled / locked"
                        : p.is_on_hold
                          ? "Sub-job is on hold (cannot share design options)"
                          : p.is_dropped
                            ? "Sub-job is dropped (cannot share design options)"
                            : "Select product to share design options"
                    }
                  />
                  <div className="text-xs font-bold text-gray-900 flex items-center gap-2">
                    <span>{p.name}</span>
                    {p.kind === "ready" ? (
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                        📦 READY STOCK
                      </span>
                    ) : (
                      <span className="text-gray-400 font-normal">
                        ({optCount} options)
                      </span>
                    )}
                  </div>
                  {p.is_on_hold && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                      ⏳ ON HOLD
                    </span>
                  )}
                  {p.is_dropped && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-200 text-rose-900 border border-rose-300">
                      ✕ DROPPED
                    </span>
                  )}
                </div>
                {p.is_on_hold ? (
                  !isLocked ? (
                    <button
                      type="button"
                      onClick={() =>
                        handleUnhold(
                          matchedLine?.id,
                          String.fromCharCode(65 + pIdx),
                          pIdx
                        )
                      }
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-900 transition cursor-pointer"
                    >
                      Resume / Unhold
                    </button>
                  ) : null
                ) : p.kind === "ready" ? (
                  <div className="text-[10px] font-bold px-2 py-0.5 rounded-full text-emerald-700 bg-emerald-100 border border-emerald-200">
                    Ready Stock ✓
                  </div>
                ) : (
                  activeFb && (
                    <div
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${activeFb.mode === "approve"
                          ? "text-emerald-600 bg-emerald-100"
                          : activeFb.mode === "reject"
                            ? "text-red-600 bg-red-100"
                            : "text-amber-600 bg-amber-100"
                        }`}
                    >
                      {activeFb.mode === "approve"
                        ? "Approved"
                        : activeFb.mode === "reject"
                          ? "Rejected"
                          : "Changes Asked"}{" "}
                      {activeFb.optIdxs?.length > 0
                        ? `(Opts: ${activeFb.optIdxs.map((i) => i + 1).join(", ")})`
                        : ""}
                    </div>
                  )
                )}
              </div>
              {p.is_on_hold && (
                <div className="p-3 bg-amber-100/70 border border-amber-300 rounded-lg text-xs text-amber-900 mb-3 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <span>⏳</span> This sub-job is currently on HOLD
                  </div>
                  <p className="text-[11px] text-amber-800">
                    {p.hold_reason
                      ? `Reason: ${p.hold_reason}`
                      : "Design process is paused for this sub-job. Designer will not be asked for designs."}
                  </p>
                </div>
              )}
              {p.is_dropped && (
                <div className="p-3 bg-gray-200/70 border border-gray-300 rounded-lg text-xs text-gray-700 mb-3 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-rose-700">
                    <span>✕</span> This sub-job has been DROPPED
                  </div>
                  <p className="text-[11px] text-gray-600">
                    {p.drop_reason
                      ? `Reason: ${p.drop_reason}`
                      : "This product was removed from the enquiry and will not proceed."}
                  </p>
                </div>
              )}
              {activeFb?.remark && (
                <div className="text-[11px] text-gray-600 italic mb-3 px-1 border-l-2 border-indigo-200 ml-1 pl-2">
                  "{activeFb.remark}"
                </div>
              )}
              {p.kind === "ready" ? (
                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-base">
                      📦
                    </div>
                    <div>
                      <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                        <span>Ready Stock Product</span>
                        {p.readyCode && (
                          <span className="font-mono text-[10px] bg-emerald-200/80 px-1.5 py-0.5 rounded font-extrabold text-emerald-800">
                            {p.readyCode}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-emerald-700">
                        Standard catalog item · No custom design approval needed · Direct to quotation &amp; production.
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase font-black px-2.5 py-1 bg-emerald-200 text-emerald-900 rounded-lg shrink-0">
                    Ready Stock ✓
                  </span>
                </div>
              ) : (
                <>
                  {isDesignerRequired &&
                    !p.is_on_hold &&
                    !p.is_dropped &&
                    (() => {
                      const productUploadedCount = Array.from({
                        length: optCount,
                      }).filter((_, i) => uploadedDesigns[`${pIdx}-${i}`]).length;
                      return productUploadedCount === 0 ? (
                        <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between text-xs text-amber-900 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-base">⏳</span>
                            <div>
                              <span className="font-extrabold text-amber-900">
                                Awaiting Designer Upload
                              </span>
                              <span className="text-[11px] block text-amber-700">
                                Assigned to:{" "}
                                <b>
                                  {e?.productBriefs?.[p.name]?.designerName ||
                                    e?.productBriefs?.[p.theme]?.designerName ||
                                    e?.assignedDesignerName ||
                                    e?.designer_name ||
                                    e?.designerName ||
                                    "Designer"}
                                </b>
                                . Upload design options before sending to client.
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] uppercase font-black px-2.5 py-1 bg-amber-200 text-amber-900 rounded-lg shrink-0">
                            Awaiting ⏳
                          </span>
                        </div>
                      ) : (
                        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between text-xs text-emerald-900 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-base">🟢</span>
                            <div>
                              <span className="font-extrabold text-emerald-900">
                                Design Uploaded ({productUploadedCount} of {optCount} options)
                              </span>
                              <span className="text-[11px] block text-emerald-700">
                                Uploaded by{" "}
                                <b>
                                  {e?.assignedDesignerName ||
                                    e?.designer_name ||
                                    "Designer"}
                                </b>
                                . Ready to send to client.
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] uppercase font-black px-2.5 py-1 bg-emerald-200 text-emerald-900 rounded-lg shrink-0">
                            Ready ✓
                          </span>
                        </div>
                      );
                    })()}
                  {!p.is_on_hold && !p.is_dropped && (
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {Array.from({ length: effectiveOptCount }).map((_, i) => {
                        const fileUrl = uploadedDesigns[`${pIdx}-${i}`];
                        if (fileUrl) {
                          const fbs = Array.isArray(s.productFeedback?.[pIdx])
                            ? s.productFeedback[pIdx]
                            : s.productFeedback?.[pIdx]
                              ? [s.productFeedback[pIdx]]
                              : [];
                          const fb = fbs.find((f) => f.optIdxs?.includes(i));
                          const mode = fb ? fb.mode : null;

                          let borderClass = "border-gray-200";
                          if (mode === "approve")
                            borderClass = "border-emerald-500 ring-2 ring-emerald-200";
                          else if (mode === "reject")
                            borderClass = "border-red-500 ring-2 ring-red-200";
                          else if (mode === "revision")
                            borderClass = "border-amber-500 ring-2 ring-amber-200";

                          return (
                            <div
                              key={i}
                              className={`w-24 h-24 shrink-0 rounded-xl border-2 ${borderClass} shadow-sm flex flex-col items-center justify-center bg-white cursor-zoom-in group overflow-hidden relative`}
                              onClick={() => setPreviewDesignKey(`${pIdx}-${i}`)}
                            >
                              <img
                                src={fileUrl}
                                className="w-full h-full object-cover"
                                alt={`Option ${i + 1}`}
                                onError={(ev) => {
                                  ev.currentTarget.onerror = null;
                                  ev.currentTarget.style.display = "none";
                                  if (ev.currentTarget.parentElement) {
                                    const placeholder = document.createElement("div");
                                    placeholder.className =
                                      "flex flex-col items-center justify-center w-full h-full text-slate-400 bg-slate-50 text-[10px] text-center p-1";
                                    placeholder.innerHTML =
                                      "<span>🎨</span><span>Design Preview</span>";
                                    ev.currentTarget.parentElement.appendChild(
                                      placeholder
                                    );
                                  }
                                }}
                              />
                              {mode === "reject" && (
                                <div className="absolute inset-0 bg-red-500/10 pointer-events-none" />
                              )}
                              {mode === "revision" && (
                                <div className="absolute inset-0 bg-amber-500/10 pointer-events-none" />
                              )}
                              {mode && (
                                <div
                                  className={`absolute bottom-0 left-0 right-0 text-center text-[9px] font-bold text-white py-0.5 shadow-sm ${mode === "approve"
                                      ? "bg-emerald-500"
                                      : mode === "reject"
                                        ? "bg-red-500"
                                        : "bg-amber-500"
                                    }`}
                                >
                                  {mode === "approve"
                                    ? "Approved"
                                    : mode === "reject"
                                      ? "Rejected"
                                      : "Changes Asked"}
                                </div>
                              )}
                            </div>
                          );
                        }
                        if (i >= optCount && !needsRevisionSlot) {
                          return null;
                        }

                        return !isApproved && !isLocked ? (
                          <label
                            key={i}
                            className="w-24 h-24 shrink-0 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center bg-white cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition group overflow-hidden relative"
                          >
                            <span className="text-2xl text-gray-300 group-hover:text-indigo-400 font-light">
                              +
                            </span>
                            <span className="text-[10px] font-semibold text-gray-400 group-hover:text-indigo-500 mt-1">
                              {pFbs.some((f) => f?.mode === "revision" || f?.mode === "reject") && i > 0
                                ? `Revised Opt ${i + 1}`
                                : `Option ${i + 1}`}
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(evt) =>
                                handleDesignUpload(pIdx, i, evt.target.files[0])
                              }
                            />
                          </label>
                        ) : null;
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {isAllReadyProducts ? (
        <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-2 bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📦</span>
            <div>
              <p className="text-xs text-emerald-950 font-bold leading-tight">
                Every item on this enquiry is Ready Stock
              </p>
              <p className="text-[10px] text-emerald-700">
                Design options and artwork approval are skipped. Proceed directly to pricing &amp; quotation below.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1.5 rounded-lg shrink-0">
            Direct to Costing / Quote ↓
          </span>
        </div>
      ) : !s.designApproved ? (
        <div className="border-t border-gray-100 pt-4 mt-2 space-y-4">
          {/* 1. Send / Share Options with Client */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            {isNewlyUploaded && (
              <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎨</span>
                  <div>
                    <p className="text-xs text-amber-950 font-bold leading-tight">
                      New / Revised Design Options Uploaded by Designer
                    </p>
                    <p className="text-[10px] text-amber-800">
                      Designer has submitted new designs. Review and send the options to the client for approval.
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-md shrink-0">
                  Ready to Share
                </span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-indigo-900 font-bold leading-tight flex items-center gap-2">
                  <span>Send design options for client approval</span>
                  {s.optionsShared ? (
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Shared via {s.optionsSharedChannel || "client link"}
                      {typeof s.optionsShared === "string" && s.optionsShared.includes("T")
                        ? ` (${new Date(s.optionsShared).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}, ${new Date(s.optionsShared).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })})`
                        : ""}
                    </span>
                  ) : null}
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Sends review link with selected designs to {client?.name || "Client"}.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[10px] text-gray-400 max-w-[150px] text-right leading-tight hidden sm:block">
                  Click preview to review and send.
                </span>

                <button
                  disabled={isLocked || isSendDisabled || sendingIndices.length === 0}
                  title={
                    isLocked
                      ? "Enquiry is cancelled / locked. Cannot send design options."
                      : sendingIndices.length === 0
                        ? "All sub-jobs are on hold or dropped. Cannot send design options."
                        : isSendDisabled
                          ? "Please upload at least one design option before sending"
                          : ""
                  }
                  className={`px-4 py-2 text-white text-xs font-bold rounded-lg transition shadow-sm cursor-pointer flex items-center gap-1.5 ${isLocked || isSendDisabled || sendingIndices.length === 0
                      ? "bg-gray-300 cursor-not-allowed opacity-60"
                      : "bg-amber-500 hover:bg-amber-600"
                    }`}
                  onClick={() => {
                    if (isLocked) return;
                    setShowDesignPreview(true);
                  }}
                >
                  <span>✉️ / 💬</span>
                  <span>{s.optionsShared ? "Preview / Share or Resend options" : "Preview and send design options"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. Client Response & Direct CS / Admin Approval (Per Product) */}
          {!isLocked && (
            <div className="border border-indigo-100 rounded-xl p-3.5 bg-white shadow-2xs space-y-3">
              <div className="border-b border-gray-100 pb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-indigo-700 font-bold leading-tight">
                    Client Response &amp; Internal Approval (Per Product)
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Client Servicing / Admin can directly approve, ask changes, or reject here if client responded via Call or WhatsApp.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {productsList.map((p, pIdx) => {
                  const baseOptCount =
                    e.briefMode === "each" && e.productBriefs?.[p.name]?.designOptions
                      ? e.productBriefs[p.name].designOptions
                      : e.designOptions || 2;
                  const optCount =
                    baseOptCount + (s.extraDesignOptions?.[pIdx] || 0);
                  const uploadedCount = Array.from({ length: 10 }).filter(
                    (_, i) => uploadedDesigns[`${pIdx}-${i}`]
                  ).length;
                  if (
                    p.is_on_hold ||
                    p.is_dropped ||
                    p.kind === "ready" ||
                    uploadedCount === 0 ||
                    (Array.isArray(s.productFeedback?.[pIdx])
                      ? s.productFeedback[pIdx]
                      : s.productFeedback?.[pIdx]
                        ? [s.productFeedback[pIdx]]
                        : []
                    ).some((fb) => fb?.mode === "approve")
                  )
                    return null;

                  const currentFeedback = productFeedback[pIdx] || {};
                  const fbs = Array.isArray(localConfirmed[pIdx])
                    ? localConfirmed[pIdx]
                    : localConfirmed[pIdx]
                      ? [localConfirmed[pIdx]]
                      : [];

                  const sjDesignStatus = s.sub_jobs?.[pIdx]?.design_status || p.design_status;
                  const isSubJobNewlyUploaded = sjDesignStatus === "uploaded";

                  let isFullyConfirmed = false;
                  const existingSystem = Array.isArray(s.productFeedback?.[pIdx])
                    ? s.productFeedback[pIdx]
                    : s.productFeedback?.[pIdx]
                      ? [s.productFeedback[pIdx]]
                      : [];
                  const allFbs = [...existingSystem, ...fbs];
                  if (allFbs.some((fb) => fb.mode === "approve")) {
                    isFullyConfirmed = true;
                  } else if (!isSubJobNewlyUploaded) {
                    const reviewedSet = new Set();
                    allFbs.forEach((fb) =>
                      fb.optIdxs?.forEach((i) => reviewedSet.add(i))
                    );
                    isFullyConfirmed = reviewedSet.size >= uploadedCount;
                  }

                  const confirmedBlocks = fbs.map((fb, idx) => {
                    const icon =
                      fb.communication?.method === "whatsapp"
                        ? "💬"
                        : fb.communication?.method === "screenshot"
                          ? "📸"
                          : fb.communication?.method === "email"
                            ? "✉️"
                            : fb.communication?.method === "verbal"
                              ? "🗣️"
                              : "📄";
                    return (
                      <div
                        key={`conf-${idx}`}
                        className="p-3 border border-indigo-200 rounded-lg bg-indigo-50/50 flex flex-col gap-2 mb-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-indigo-900">
                            {p.name} (Opt {fb.optIdxs?.map((i) => i + 1).join(", ")})
                          </span>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold px-2 py-1 bg-white rounded border border-indigo-100 text-indigo-700 uppercase shadow-sm">
                              {fb.mode === "approve"
                                ? "Approved"
                                : fb.mode === "revision"
                                  ? "Changes Asked"
                                  : "Rejected"}
                            </span>
                            {fb.communication?.approval_type === "client_direct" || fb.source === "client_link" ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold inline-flex items-center gap-1">
                                🟢 Client Direct
                              </span>
                            ) : fb.communication?.logged_by ? (
                              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300 text-[10px] font-bold inline-flex items-center gap-1">
                                🔵 Logged by {fb.communication.logged_by}
                              </span>
                            ) : (
                              <span className="text-[10px] text-indigo-500 font-medium flex items-center gap-1">
                                Confirmed{" "}
                                <span className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center text-[10px]">
                                  {icon}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                        {fb.remark && (
                          <p className="text-[10px] text-indigo-800 italic bg-white p-1.5 rounded border border-indigo-100">
                            "{fb.remark}"
                          </p>
                        )}
                      </div>
                    );
                  });

                  if (isFullyConfirmed) {
                    return <div key={pIdx}>{confirmedBlocks}</div>;
                  }

                  if (loggingPIdx === pIdx) {
                    return (
                      <div key={pIdx}>
                        {confirmedBlocks}
                        <CommunicationLogForm
                          client={client}
                          pName={p.name}
                          feedbackMode={currentFeedback.mode}
                          optIdxs={currentFeedback.optIdxs}
                          onBack={() => setLoggingPIdx(null)}
                          onLog={(log) => {
                            setLoggingPIdx(null);
                            confirmProductFeedback(pIdx, log);
                          }}
                        />
                      </div>
                    );
                  }

                  return (
                    <div
                      key={pIdx}
                      className="p-3 border border-gray-200 rounded-lg bg-gray-50/50"
                    >
                      {confirmedBlocks}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                        <p className="text-xs font-bold text-gray-900">{p.name}</p>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => {
                              const curIdxs = currentFeedback.optIdxs || [];
                              const safeIdxs = curIdxs.length > 1 ? [curIdxs[0]] : curIdxs;
                              updateProductFeedback(pIdx, { mode: "approve", optIdxs: safeIdxs });
                            }}
                            className={`px-3 py-1.5 text-[11px] font-bold rounded-md shadow-sm transition cursor-pointer ${currentFeedback.mode === "approve"
                                ? "bg-emerald-500 text-white"
                                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                              }`}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => updateProductFeedback(pIdx, "mode", "revision")}
                            className={`px-3 py-1.5 text-[11px] font-bold rounded-md shadow-sm transition cursor-pointer ${currentFeedback.mode === "revision"
                                ? "bg-amber-500 text-white"
                                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                              }`}
                          >
                            Ask Changes
                          </button>
                          <button
                            onClick={() => updateProductFeedback(pIdx, "mode", "reject")}
                            className={`px-3 py-1.5 text-[11px] font-bold rounded-md shadow-sm transition cursor-pointer ${currentFeedback.mode === "reject"
                                ? "bg-red-500 text-white"
                                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                              }`}
                          >
                            Reject
                          </button>
                        </div>
                      </div>

                      {currentFeedback.mode && (
                        <div className="space-y-3 mt-3 pt-3 border-t border-gray-200">
                          <div>
                            <p className="text-[11px] font-semibold text-gray-700 mb-1.5">
                              {currentFeedback.mode === "approve"
                                ? "Which option is approved? (Select one)"
                                : currentFeedback.mode === "revision"
                                  ? "Which options need changes?"
                                  : "Which options are rejected?"}
                            </p>
                            <div className="flex flex-wrap gap-3">
                              {Array.from({ length: 10 }).map((_, i) => {
                                const fileUrl = uploadedDesigns[`${pIdx}-${i}`];
                                if (!fileUrl) return null;

                                const isReviewed = allFbs.some((fb) =>
                                  fb.optIdxs?.includes(i)
                                );
                                const isSelected = (
                                  currentFeedback.optIdxs || []
                                ).includes(i);
                                const isApproveMode = currentFeedback.mode === "approve";

                                return (
                                  <label
                                    key={i}
                                    className={`flex flex-col gap-1 items-center p-1 border-2 rounded-lg transition ${isReviewed
                                        ? "opacity-50 cursor-not-allowed border-transparent"
                                        : isSelected
                                          ? isApproveMode
                                            ? "border-emerald-500 bg-emerald-50 shadow-sm cursor-pointer"
                                            : "border-indigo-500 bg-indigo-50 shadow-sm cursor-pointer"
                                          : "border-transparent hover:bg-gray-100 cursor-pointer"
                                      }`}
                                  >
                                    <div className="relative w-16 h-16 rounded border overflow-hidden bg-white">
                                      <img
                                        src={fileUrl}
                                        className="w-full h-full object-cover"
                                        alt={`Option ${i + 1}`}
                                        onError={(ev) => {
                                          ev.currentTarget.onerror = null;
                                          ev.currentTarget.classList.add("opacity-40");
                                        }}
                                      />
                                      <input
                                        type={isApproveMode ? "radio" : "checkbox"}
                                        name={`product_opt_choice_${pIdx}`}
                                        className={`absolute top-1 left-1 w-3.5 h-3.5 border-gray-300 focus:ring-emerald-500 disabled:opacity-50 ${isApproveMode
                                            ? "text-emerald-600 rounded-full"
                                            : "text-indigo-600 rounded-sm"
                                          }`}
                                        checked={isSelected || isReviewed}
                                        disabled={isReviewed}
                                        onChange={() => {
                                          if (isReviewed) return;
                                          if (isApproveMode) {
                                            updateProductFeedback(pIdx, "optIdxs", [i]);
                                          } else {
                                            const currentIdxs =
                                              currentFeedback.optIdxs || [];
                                            const newIdxs = currentIdxs.includes(i)
                                              ? currentIdxs.filter((id) => id !== i)
                                              : [...currentIdxs, i];
                                            updateProductFeedback(pIdx, "optIdxs", newIdxs);
                                          }
                                        }}
                                      />
                                    </div>
                                    <span className={`text-[9px] font-bold ${isSelected && isApproveMode ? "text-emerald-700" : "text-gray-600"}`}>
                                      Opt {i + 1}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>

                          <input
                            type="text"
                            placeholder={
                              currentFeedback.mode === "approve"
                                ? "Approval remark (optional)..."
                                : currentFeedback.mode === "revision"
                                  ? "What changes did the client ask for?"
                                  : "Reason for rejection (optional)..."
                            }
                            className={`w-full p-2 text-xs border rounded-lg focus:outline-none focus:ring-1 ${currentFeedback.mode === "approve"
                                ? "border-emerald-200 focus:ring-emerald-500"
                                : currentFeedback.mode === "revision"
                                  ? "border-amber-200 focus:ring-amber-500"
                                  : "border-red-200 focus:ring-red-500"
                              }`}
                            value={currentFeedback.remark || ""}
                            onChange={(evt) =>
                              updateProductFeedback(pIdx, "remark", evt.target.value)
                            }
                          />
                        </div>
                      )}

                      {currentFeedback.mode && (
                        <div className="mt-4 flex justify-end">
                          <button
                            onClick={() => {
                              if (
                                !currentFeedback.optIdxs ||
                                currentFeedback.optIdxs.length === 0
                              ) {
                                notifyAlert(
                                  `Please select at least one design option for ${p.name}.`,
                                  "Selection Required"
                                );
                                return;
                              }
                              setLoggingPIdx(pIdx);
                            }}
                            className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-emerald-700 transition cursor-pointer"
                          >
                            Next: log how they{" "}
                            {currentFeedback.mode === "approve"
                              ? "approved"
                              : currentFeedback.mode === "revision"
                                ? "asked changes"
                                : "rejected"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Share Final Design Block (appears if at least one is approved) */}
          {productsList.some((_, i) => {
            const fbs = Array.isArray(s.productFeedback?.[i])
              ? s.productFeedback[i]
              : s.productFeedback?.[i]
                ? [s.productFeedback[i]]
                : [];
            const localFbs = Array.isArray(localConfirmed[i])
              ? localConfirmed[i]
              : localConfirmed[i]
                ? [localConfirmed[i]]
                : [];
            return [...fbs, ...localFbs].some((fb) => fb.mode === "approve");
          }) && (
              <div className="mt-6 border border-emerald-500 rounded-xl bg-white overflow-hidden shadow-sm">
                <div className="p-4 flex items-center justify-between">
                  <div className="flex gap-3 items-center">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold">
                      ✓
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900 mb-0.5">
                        Design approved
                      </div>
                      <div className="text-xs text-gray-500">
                        {productsList
                          .filter((p, i) => {
                            const fbs = Array.isArray(s.productFeedback?.[i])
                              ? s.productFeedback[i]
                              : s.productFeedback?.[i]
                                ? [s.productFeedback[i]]
                                : [];
                            const localFbs = Array.isArray(localConfirmed[i])
                              ? localConfirmed[i]
                              : localConfirmed[i]
                                ? [localConfirmed[i]]
                                : [];
                            return [...fbs, ...localFbs].some(
                              (fb) => fb.mode === "approve"
                            );
                          })
                          .map((p) => p.name)
                          .join(", ")}
                      </div>
                    </div>
                  </div>
                  {!isLocked && (
                    <button
                      onClick={() => setShowFinalDesignShare(true)}
                      className="text-xs font-bold text-indigo-700 hover:text-indigo-800 cursor-pointer"
                    >
                      Share final design (optional)
                    </button>
                  )}
                </div>
              </div>
            )}
        </div>
      ) : (
        <div className="flex flex-col gap-2 border-t border-gray-100 pt-4 mt-2">
          {!showFinalDesignOptions ? (
            <div className="border border-emerald-500 rounded-xl bg-white overflow-hidden shadow-sm">
              <div className="p-4 flex items-center justify-between">
                <div className="flex gap-3 items-center">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold">
                    ✓
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900 mb-0.5">
                      Design approved
                    </div>
                    <div className="text-xs text-gray-500">
                      {productsList
                        .map((p, i) => {
                          const fbs = Array.isArray(s.productFeedback?.[i])
                            ? s.productFeedback[i]
                            : s.productFeedback?.[i]
                              ? [s.productFeedback[i]]
                              : [];
                          const fb = fbs.find((f) => f?.mode === "approve");
                          if (!fb) return null;
                          return `${p.name}: option ${fb.optIdxs
                            ?.map((idx) => idx + 1)
                            .join(", ")}`;
                        })
                        .filter(Boolean)
                        .join(" · ")}
                      {s.finalDesignShared
                        ? ` · final design shared via ${s.finalDesignVia || "Hand-delivered / other"
                        }`
                        : ""}
                    </div>
                  </div>
                </div>
                {!isLocked && (
                  <button
                    onClick={() => setShowFinalDesignOptions(true)}
                    className="text-xs font-bold text-indigo-700 hover:text-indigo-800 cursor-pointer"
                  >
                    {s.finalDesignShared
                      ? "Open or resend"
                      : "Share final design (optional)"}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="border border-emerald-500 rounded-xl bg-white overflow-hidden shadow-sm">
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold">
                      ✓
                    </span>
                    <span className="text-sm font-bold">Design Approved</span>
                  </div>
                </div>

                {productsList.map((p, pIdx) => {
                  const fbs = Array.isArray(s.productFeedback?.[pIdx])
                    ? s.productFeedback[pIdx]
                    : s.productFeedback?.[pIdx]
                      ? [s.productFeedback[pIdx]]
                      : [];
                  const feedback =
                    fbs.find((f) => f?.mode === "approve") || fbs[fbs.length - 1];
                  if (!feedback) return null;
                  return (
                    <div
                      key={pIdx}
                      className="text-xs flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg border mt-2"
                    >
                      <span className="font-medium">
                        {p.name} (Opts: {feedback.optIdxs?.map((i) => i + 1).join(", ")})
                      </span>
                      <span className="text-gray-500 italic">
                        {feedback.remark || "No remark"}
                      </span>
                    </div>
                  );
                })}

                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-[10px] text-gray-500 mb-3">
                    Only needed if someone who didn't approve it should see the final design.
                    <br />
                    Goes to {client?.name || "Client"}.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowFinalDesignOptions(false)}
                      className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => setShowFinalDesignShare(true)}
                      className="px-5 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold rounded-lg shadow-sm transition cursor-pointer"
                    >
                      Preview and share
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Render FinalDesignSheet when toggled */}
      {showFinalDesignShare && (
        <FinalDesignSheet
          s={s}
          e={e}
          client={client}
          productsList={productsList}
          currentUser={{ name: "Coordinator" }}
          ids={ids}
          approvedFeedback={{ ...(s.productFeedback || {}), ...localConfirmed }}
          uploadedDesigns={uploadedDesigns}
          unselectedProducts={unselectedProducts}
          setShowFinalDesign={setShowFinalDesignShare}
          onSend={() => {
            set({ finalDesignShared: true, finalDesignVia: "share" });
            setShowFinalDesignShare(false);
          }}
        />
      )}
    </div>
  );
};

export default DesignOptionsSection;

