import React from "react";

/**
 * DesignArtworkStatusBanner.jsx
 *
 * Displays the intermediate status between Design Approval and Quotation Desk:
 * 1. Awaiting Designer Upload: When a design is approved, but designer has not yet uploaded .cdr/.pdf files.
 *    (Production artwork must be uploaded ONLY by the assigned designer in the Designer portal).
 * 2. Design File Uploaded: When designer uploads production artwork.
 *    (Shows uploaded file details, confirms quotation request dispatched to Quotation Desk).
 */
const DesignArtworkStatusBanner = ({
  approvedSubJobs = [],
  uploadedSubJobs = [],
  awaitingUploadSubJobs = [],
  onRefresh = () => {},
  isRefreshing = false,
}) => {
  // If no design has been approved at all, do not render anything
  if (approvedSubJobs.length === 0 && uploadedSubJobs.length === 0) {
    return null;
  }

  const hasUploaded = uploadedSubJobs.length > 0;
  const isAwaitingAll = awaitingUploadSubJobs.length > 0 && !hasUploaded;

  return (
    <div className="space-y-3 fade">
      {/* ── State 1: Design Approved — Awaiting Designer Upload ── */}
      {isAwaitingAll && (
        <div className="panel p-5 bg-gradient-to-r from-amber-50/90 to-amber-100/60 border-2 border-amber-300/80 rounded-2xl shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
                ⏳
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-extrabold text-sm text-amber-950">
                    Design Approved — Request Sent to Designer for Production
                    File Upload
                  </h4>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-extrabold uppercase tracking-wide border border-amber-300">
                    Awaiting Designer Artwork (.cdr / .pdf)
                  </span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed mt-1">
                  Client has approved the design option. A production file
                  upload request has been dispatched to the designer. Production
                  artwork (.cdr / .pdf) must be uploaded directly by the
                  designer in the Designer Portal. Once the designer uploads the
                  production artwork, the quotation request will automatically
                  be sent to the Quotation Desk, and the Sub-Job Quotation &
                  Costing Desk will open here.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isRefreshing}
              onClick={onRefresh}
              className="px-3.5 py-1.5 bg-white hover:bg-amber-100 text-amber-900 font-bold border border-amber-300 rounded-xl text-xs transition shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0 self-start sm:self-center disabled:opacity-50"
            >
              <span className={isRefreshing ? "animate-spin" : ""}>↻</span>
              <span>{isRefreshing ? "Checking..." : "Refresh Status"}</span>
            </button>
          </div>

          {/* Sub-job badges waiting for designer upload */}
          <div className="pt-2 border-t border-amber-200/80">
            <span className="text-[11px] font-bold text-amber-900 block mb-2">
              Approved Items Pending Designer Production File Upload:
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {awaitingUploadSubJobs.map((sj) => (
                <div
                  key={sj.subJobNo}
                  className="px-3 py-1.5 bg-white/90 border border-amber-300 rounded-xl text-xs flex items-center gap-2 shadow-2xs"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  <span className="font-extrabold text-gray-900">
                    {sj.subJobNo}
                  </span>
                  <span className="text-gray-500 font-medium">
                    ({sj.name} · {sj.size} in · {sj.qty} pcs)
                  </span>
                  <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                    Awaiting Designer (.cdr / .pdf)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── State 2: Design File Uploaded by Designer ── */}
      {hasUploaded && (
        <div className="panel p-5 bg-gradient-to-r from-emerald-50/90 to-teal-50/60 border-2 border-emerald-300/80 rounded-2xl shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
                ✓
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-extrabold text-sm text-emerald-950">
                    Approved Design File Uploaded by Designer
                  </h4>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-200 text-emerald-900 text-[10px] font-extrabold uppercase tracking-wide border border-emerald-300">
                    Quotation Request Sent to Desk
                  </span>
                </div>
                <p className="text-xs text-emerald-800 leading-relaxed mt-1">
                  Designer has successfully uploaded the approved production
                  artwork (.cdr / .pdf). Quotation & Costing request has been
                  dispatched to the Quotation Desk. You can now view Sub-Job
                  Quotations and Costing Desk below.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isRefreshing}
              onClick={onRefresh}
              className="px-3.5 py-1.5 bg-white hover:bg-emerald-100 text-emerald-900 font-bold border border-emerald-300 rounded-xl text-xs transition shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0 self-start sm:self-center disabled:opacity-50"
            >
              <span className={isRefreshing ? "animate-spin" : ""}>↻</span>
              <span>{isRefreshing ? "Checking..." : "Refresh Status"}</span>
            </button>
          </div>

          {/* Uploaded Artwork Files List */}
          <div className="pt-2 border-t border-emerald-200/80 space-y-2">
            <span className="text-[11px] font-bold text-emerald-900 block">
              Uploaded Production Artwork Files:
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {uploadedSubJobs.map((sj) => {
                const filesList = [];
                if (Array.isArray(sj.dtpFiles) && sj.dtpFiles.length > 0) {
                  sj.dtpFiles.forEach((f) => {
                    filesList.push({
                      url: f.file_url,
                      name: f.file_name || f.file_url?.split("/").pop(),
                      type:
                        f.file_type ||
                        (f.file_url?.toLowerCase().endsWith(".cdr")
                          ? "cdr"
                          : "pdf"),
                    });
                  });
                } else if (
                  Array.isArray(sj.designerFiles) &&
                  sj.designerFiles.length > 0
                ) {
                  sj.designerFiles.forEach((url) => {
                    filesList.push({
                      url,
                      name: url.split("/").pop(),
                      type: url.toLowerCase().endsWith(".cdr") ? "cdr" : "pdf",
                    });
                  });
                }

                return (
                  <div
                    key={sj.subJobNo}
                    className="p-3 bg-white/95 border border-emerald-200 rounded-xl space-y-2 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-xs text-gray-900">
                          {sj.subJobNo}
                        </span>
                        <span className="text-[11px] text-gray-500 font-medium">
                          · {sj.name}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Design File Ready
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {filesList.length > 0 ? (
                        filesList.map((file, fIdx) => (
                          <div
                            key={fIdx}
                            className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                          >
                            <div className="flex items-center gap-2 truncate pr-2">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                                  file.type === "cdr"
                                    ? "bg-purple-100 text-purple-800"
                                    : "bg-rose-100 text-rose-800"
                                }`}
                              >
                                {file.type}
                              </span>
                              <span
                                className="font-semibold text-gray-800 truncate"
                                title={file.name}
                              >
                                {file.name}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-[11px] text-emerald-700 italic">
                          Artwork confirmed & synced with Quotation Desk
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Note if some remaining items are still waiting */}
            {awaitingUploadSubJobs.length > 0 && (
              <div className="p-2.5 bg-amber-50/90 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between mt-2">
                <span className="text-[11px]">
                  ⏳ <b>{awaitingUploadSubJobs.length} item(s)</b> still
                  awaiting designer artwork upload:{" "}
                  {awaitingUploadSubJobs.map((sj) => sj.subJobNo).join(", ")}
                </span>
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                  Pending Designer Upload
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DesignArtworkStatusBanner;
