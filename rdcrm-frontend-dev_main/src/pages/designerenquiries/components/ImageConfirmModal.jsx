import React from "react";

const ImageConfirmModal = ({
  isOpen,
  pendingUpload,
  trophies,
  uploadedDesigns,
  confirmUploading,
  onClose,
  onConfirm,
}) => {
  if (!isOpen || !pendingUpload) return null;

  const alreadyUploaded = [];
  (trophies || []).forEach((t) => {
    Object.keys(uploadedDesigns || {})
      .filter((k) => k.startsWith(`${t.index}-`) && Boolean(uploadedDesigns[k]))
      .forEach((key) => {
        const optIdx = Number(key.split("-")[1]);
        alreadyUploaded.push({
          trophyName: t.name,
          optionLabel: `Option ${optIdx + 1}`,
          url: uploadedDesigns[key],
          isCurrentSlot:
            pendingUpload.trophyIdx === t.index &&
            pendingUpload.optIdx === optIdx,
        });
      });
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto p-6 space-y-5 animate-in fade-in duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h3 className="text-base font-extrabold text-gray-900">
              Confirm Design Upload
            </h3>
            <p className="text-xs text-indigo-600 font-semibold mt-0.5">
              {pendingUpload.trophyName} · {pendingUpload.slotLabel} (
              {pendingUpload.subJobNo})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={confirmUploading}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold flex items-center justify-center cursor-pointer transition disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {/* Previously Uploaded Designs Section */}
        {alreadyUploaded.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-bold text-gray-700 block">
              Already Uploaded Designs ({alreadyUploaded.length}):
            </span>
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin">
              {alreadyUploaded.map((item, idx) => (
                <div
                  key={idx}
                  className="flex-shrink-0 flex flex-col items-center w-24 p-2 bg-gray-50 border border-gray-200 rounded-xl"
                >
                  <div className="w-20 h-20 rounded-lg overflow-hidden border border-gray-300 relative bg-white">
                    <img
                      src={item.url}
                      alt={item.optionLabel}
                      className="w-full h-full object-cover"
                    />
                    {item.isCurrentSlot && (
                      <span className="absolute bottom-0 inset-x-0 bg-amber-600/90 text-white text-[9px] font-bold text-center py-0.5">
                        Will Replace
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-bold text-gray-700 mt-1 truncate max-w-full text-center">
                    {item.optionLabel}
                  </span>
                  <span className="text-[9px] text-gray-400 truncate max-w-full text-center">
                    {item.trophyName}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* New Image Preview Section */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-gray-900 block">
            New Design Preview (To be uploaded):
          </span>
          <div className="w-full h-56 rounded-2xl overflow-hidden border-2 border-indigo-200 bg-slate-900 flex items-center justify-center relative shadow-inner">
            <img
              src={pendingUpload.previewUrl}
              alt="New Design Preview"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
            <span className="font-medium truncate max-w-[260px]">
              📄 {pendingUpload.file?.name}
            </span>
            <span>{pendingUpload.file?.size ? (pendingUpload.file.size / 1024).toFixed(1) : 0} KB</span>
          </div>
        </div>

        {/* Permanent Lock Notice */}
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
          <span className="text-base leading-none">⚠️</span>
          <span className="leading-snug">
            <b>Notice:</b> Once confirmed, this design image will be
            uploaded directly to Cloudflare R2 and <b>cannot be removed</b>.
          </span>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            disabled={confirmUploading}
            className="px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmUploading}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            {confirmUploading && (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            <span>
              {confirmUploading
                ? "Uploading to Cloudflare R2..."
                : "✓ Confirm & Upload to R2"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageConfirmModal;
