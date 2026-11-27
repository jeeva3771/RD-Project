import React from "react";

const EnquiryArtworkFeeModal = ({
  isOpen,
  onClose,
  artworkFeeInput,
  setArtworkFeeInput,
  onSave,
  isSaving,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4"
      onClick={() => !isSaving && onClose()}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100 fade"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 bg-gradient-to-r from-indigo-50 to-indigo-100/50 border-b border-indigo-100 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-700 block">
              Enquiry Pricing
            </span>
            <h3 className="font-extrabold text-sm text-gray-900">
              1-Time Setup & Artwork Fee
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/80 hover:bg-white text-gray-400 hover:text-gray-700 flex items-center justify-center transition cursor-pointer shadow-2xs"
          >
            ✕
          </button>
        </div>
        <div className="p-5 space-y-3 text-xs">
          <p className="text-gray-600 leading-relaxed">
            This is a one-time charge applied to the entire enquiry (defaults to ₹1,500). Enter 0 to waive.
          </p>
          <div>
            <label className="block text-gray-700 font-bold mb-1">
              1-Time Artwork Fee (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-400 font-bold text-sm">
                ₹
              </span>
              <input
                type="number"
                step="0.01"
                value={artworkFeeInput}
                onChange={(e) => setArtworkFeeInput(e.target.value)}
                placeholder="1500.00"
                autoFocus
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold text-sm"
              />
            </div>
          </div>
        </div>
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={onSave}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Fee"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnquiryArtworkFeeModal;
