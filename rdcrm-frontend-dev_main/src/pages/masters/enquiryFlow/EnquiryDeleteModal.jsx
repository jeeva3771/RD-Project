import React from "react";

const EnquiryDeleteModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Delete Confirmation",
  itemName,
  message,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 animate-fadeIn">
        <div className="p-6 text-center">
          {/* Danger Icon */}
          <div className="mx-auto w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-2xl mb-4 border border-red-100 shadow-inner">
            ⚠️
          </div>

          {/* Title */}
          <h3 className="text-base font-bold text-gray-900 mb-2">
            {title}
          </h3>

          {/* Description */}
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            {message ? (
              message
            ) : (
              <>
                Are you sure you want to delete{" "}
                <span className="font-bold text-gray-800">
                  "{itemName || "this item"}"
                </span>
                ? This action is permanent and cannot be undone.
              </>
            )}
          </p>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={isLoading}
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={onConfirm}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-semibold text-white shadow-md shadow-red-500/20 transition cursor-pointer disabled:opacity-50"
            >
              {isLoading ? "Deleting..." : "Yes, Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnquiryDeleteModal;
