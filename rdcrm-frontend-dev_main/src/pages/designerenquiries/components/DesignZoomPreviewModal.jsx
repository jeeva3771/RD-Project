import React from "react";

const DesignZoomPreviewModal = ({ previewModalData, onClose }) => {
  if (!previewModalData) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-wide">{previewModalData.title || "Design Preview"}</span>
            {previewModalData.optFeedback?.mode === "revision" && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                ⚠️ Revision Requested
              </span>
            )}
            {previewModalData.optFeedback?.mode === "reject" && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/30">
                ✕ Rejected
              </span>
            )}
            {previewModalData.optFeedback?.mode === "approve" && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                ✓ Approved
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-xs transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Image View */}
        <div className="flex-1 bg-slate-950 p-4 flex items-center justify-center overflow-hidden min-h-[280px] max-h-[58vh]">
          <img
            src={previewModalData.url}
            alt={previewModalData.title || "Zoom Preview"}
            className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
          />
        </div>

        {/* Full Client Revision / Rejection Note Box below image */}
        {previewModalData.optFeedback?.remark ? (
          <div className={`p-4 border-t ${
            previewModalData.optFeedback.mode === "revision"
              ? "bg-amber-50/90 border-amber-200 text-amber-950"
              : previewModalData.optFeedback.mode === "reject"
              ? "bg-rose-50/90 border-rose-200 text-rose-950"
              : "bg-emerald-50/90 border-emerald-200 text-emerald-950"
          }`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                {previewModalData.optFeedback.mode === "revision"
                  ? "⚠️ Client Revision Instructions:"
                  : previewModalData.optFeedback.mode === "reject"
                  ? "✕ Client Rejection Reason:"
                  : "✓ Client Approval Note:"}
              </span>
              {previewModalData.optFeedback.communication?.method && (
                <span className="text-[11px] text-gray-500 font-medium">
                  Received via: <b className="text-gray-700">{previewModalData.optFeedback.communication.method}</b>
                </span>
              )}
            </div>
            <div className="text-xs font-medium leading-relaxed whitespace-pre-wrap bg-white p-3 rounded-xl border border-amber-200 shadow-2xs">
              "{previewModalData.optFeedback.remark}"
            </div>
          </div>
        ) : (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DesignZoomPreviewModal;
