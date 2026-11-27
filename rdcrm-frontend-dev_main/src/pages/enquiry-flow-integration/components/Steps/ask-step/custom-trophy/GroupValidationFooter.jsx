import React from "react";

/**
 * GroupValidationFooter
 * Renders the bottom action bar for the product configuration card:
 *  - "Done with this product" submit button (dynamically enabled based on master validation & saving state)
 *  - Status badge: "All required details filled" vs "Still needed: [field names]"
 *  - "Discard this product" action
 */
const GroupValidationFooter = ({
  validation = { isValid: false, missing: [] },
  isSaving = false,
  onDone = () => {},
  onDiscard = () => {},
}) => {
  return (
    <div className="flex items-center justify-between pt-4 border-t border-gray-100 flex-wrap gap-3">
      <div className="flex items-center gap-3 flex-wrap flex-1">
        <button
          type="button"
          disabled={!validation.isValid || isSaving}
          className={`px-6 py-2.5 font-bold rounded-xl text-xs transition select-none flex items-center gap-2 ${
            validation.isValid && !isSaving
              ? "bg-[#FCE6A9] hover:bg-[#f6dc98] text-gray-800 shadow-xs cursor-pointer active:scale-98"
              : "bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-200 shadow-none opacity-80"
          }`}
          onClick={onDone}
        >
          {isSaving && (
            <span className="w-3.5 h-3.5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin shrink-0" />
          )}
          <span>{isSaving ? "Saving to database..." : "Done with this product"}</span>
        </button>

        {validation.isValid ? (
          <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
            <span>✓</span> All required details filled
          </span>
        ) : (
          <span className="text-xs text-amber-700 font-medium flex items-center gap-1.5 flex-wrap">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
            <span className="font-semibold text-gray-700">Still needed:</span>
            <span className="text-gray-500">
              {validation.missing.join(", ")}
            </span>
          </span>
        )}
      </div>

      <button
        type="button"
        className="text-xs text-gray-500 hover:text-red-600 font-medium transition cursor-pointer"
        onClick={onDiscard}
      >
        Discard this product
      </button>
    </div>
  );
};

export default GroupValidationFooter;
