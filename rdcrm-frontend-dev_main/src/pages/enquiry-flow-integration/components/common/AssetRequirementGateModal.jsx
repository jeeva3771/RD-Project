import React from "react";

/**
 * AssetRequirementGateModal.jsx
 *
 * Two-tier gate modal for mandatory assets:
 * - Tier 1 ("design"): Soft warning before Design Request. Offers [Upload Now] or [Proceed Anyway].
 * - Tier 2 ("dtp"): Hard block before Production DTP. Offers [Upload Now] only (Proceed Anyway is disabled).
 */
const AssetRequirementGateModal = ({
  isOpen = false,
  onClose = () => {},
  stage = "design", // "design" | "dtp"
  missingItems = [],
  onUploadNow = () => {},
  onProceedAnyway = null,
  isProcessing = false,
}) => {
  if (!isOpen || missingItems.length === 0) return null;

  const isDTP = stage === "dtp";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-lg w-full overflow-hidden transition-all transform animate-in zoom-in-95">
        {/* Modal Header */}
        <div
          className={`p-5 border-b flex items-start gap-3.5 ${
            isDTP
              ? "bg-gradient-to-r from-rose-50 to-red-50/50 border-rose-200"
              : "bg-gradient-to-r from-amber-50 to-yellow-50/50 border-amber-200"
          }`}
        >
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl font-bold shadow-xs shrink-0 ${
              isDTP ? "bg-rose-600 text-white" : "bg-amber-500 text-white"
            }`}
          >
            {isDTP ? "⛔" : "⚠️"}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className={`font-black text-base leading-tight ${
                  isDTP ? "text-rose-950" : "text-amber-950"
                }`}
              >
                {isDTP
                  ? "Production DTP Blocked: Missing Mandatory Assets"
                  : "Missing Mandatory Assets"}
              </h3>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                  isDTP
                    ? "bg-rose-100 text-rose-800 border-rose-300"
                    : "bg-amber-100 text-amber-900 border-amber-300"
                }`}
              >
                {isDTP ? "Strict Gate" : "Design Review"}
              </span>
            </div>

            <p
              className={`text-xs mt-1 leading-relaxed ${
                isDTP ? "text-rose-800" : "text-amber-800"
              }`}
            >
              {isDTP
                ? "Production artwork (.cdr / .pdf) cannot be released to DTP without approved mandatory assets. Placeholders are strictly prohibited in production."
                : "One or more products have mandatory assets marked as required, but they have not been uploaded yet."}
            </p>
          </div>
        </div>

        {/* Missing Items List */}
        <div className="p-5 max-h-72 overflow-y-auto space-y-3">
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
            Items Requiring Upload:
          </div>

          {missingItems.map((item, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                isDTP
                  ? "bg-rose-50/40 border-rose-200"
                  : "bg-amber-50/40 border-amber-200"
              }`}
            >
              <div className="min-w-0">
                <div className="font-extrabold text-xs text-gray-900 flex items-center gap-1.5 truncate">
                  <span>🏆</span>
                  <span>{item.productName}</span>
                  {item.subJobNo && (
                    <span className="font-mono text-[10px] text-gray-500 font-normal">
                      ({item.subJobNo})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {item.missingAssets?.map((asset, aIdx) => (
                    <span
                      key={aIdx}
                      className="px-2 py-0.5 rounded-md bg-white border border-rose-200 text-rose-700 font-bold text-[10px] shadow-2xs"
                    >
                      Missing: {asset}
                    </span>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onUploadNow(item)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition cursor-pointer shrink-0 shadow-2xs"
              >
                Upload Now →
              </button>
            </div>
          ))}

          {!isDTP && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-[11px] text-gray-600 leading-relaxed">
              💡 <b>Note:</b> You can proceed anyway to let the designer draft visual concepts and layout placeholders. However, final files must be uploaded before Production DTP.
            </div>
          )}
        </div>

        {/* Modal Action Buttons */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold text-gray-600 hover:bg-white hover:text-gray-900 transition cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2 ml-auto">
            {/* Proceed Anyway is ONLY available in Design stage (Tier 1), NOT in DTP (Tier 2) */}
            {!isDTP && onProceedAnyway && (
              <button
                type="button"
                disabled={isProcessing}
                onClick={onProceedAnyway}
                className="px-4 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold transition cursor-pointer"
              >
                Proceed Anyway without Assets
              </button>
            )}

            <button
              type="button"
              disabled={isProcessing}
              onClick={() => onUploadNow(missingItems[0])}
              className="px-5 py-2 rounded-xl text-xs font-extrabold text-white transition flex items-center gap-1.5 shadow-md cursor-pointer"
              style={{ backgroundColor: isDTP ? "#E11D48" : "#635BFF" }}
            >
              <span>Upload Now</span>
              <span>↑</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssetRequirementGateModal;
