import React from "react";

const ClassicBottomPricingSection = ({
  item = {},
  spec = {},
  showColourBreakdown = false,
  colourRows = [],
  getDynamicQuantities = () => [],
  onUpdateItem = () => {},
  effectiveEst = 0,
  activeDesignOptions = 2,
  updateSpec = () => {},
  showQuantitiesToPrice = true,
}) => {
  const handleBudgetUpdate = (val) => {
    const shouldSyncColours = showColourBreakdown && !spec.rateByColour && Array.isArray(colourRows) && colourRows.length > 0;
    const nextColours = shouldSyncColours
      ? colourRows.map((r) => ({ ...r, rate: val === "" ? 0 : val }))
      : (showColourBreakdown ? (item.colourQuantities || spec.colourQuantities || []) : []);

    const nextSpec = {
      ...(item.spec || spec || {}),
      budget: val,
    };
    const nextItem = {
      ...item,
      budget: val,
      spec: nextSpec,
    };

    if (!showColourBreakdown) {
      delete nextSpec.colourQuantities;
      delete nextSpec.colour;
      delete nextSpec.customFinishes;
      delete nextSpec.labelOption;
      delete nextSpec.hasLabel;
      delete nextSpec.rateByColour;
      delete nextSpec.colourRows;
      delete nextItem.colourQuantities;
      delete nextItem.colour;
      delete nextItem.customFinishes;
    } else if (nextColours.length > 0) {
      nextSpec.colourQuantities = nextColours;
      nextItem.colourQuantities = nextColours;
    }

    onUpdateItem(nextItem);
  };

  const handleQtyUpdate = (newQty) => {
    const nextSpec = { ...(item.spec || spec || {}) };
    const nextItem = { ...item, qty: newQty, spec: nextSpec };
    if (!showColourBreakdown) {
      delete nextSpec.colourQuantities;
      delete nextSpec.colour;
      delete nextSpec.customFinishes;
      delete nextSpec.labelOption;
      delete nextSpec.hasLabel;
      delete nextSpec.rateByColour;
      delete nextSpec.colourRows;
      delete nextItem.colourQuantities;
      delete nextItem.colour;
      delete nextItem.customFinishes;
    }
    onUpdateItem(nextItem);
  };

  return (
    <>
      {/* 1. Quantities to price */}
      {showQuantitiesToPrice && (
        <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="font-bold text-xs text-gray-900">Quantities to price</div>
            <div className="text-[11px] text-gray-400">
              {showColourBreakdown && colourRows.length > 0
                ? "Total sum from colour breakdown above"
                : "Add one or more quantity targets"}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="number"
              placeholder="Qty"
              disabled={showColourBreakdown && colourRows.length > 0}
              className={`w-24 border border-gray-200 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-gray-900 outline-none focus:border-indigo-500 shadow-2xs ${
                showColourBreakdown && colourRows.length > 0 ? "bg-gray-100 cursor-not-allowed" : "bg-white"
              }`}
              value={item.qty || ""}
              onChange={(ev) => {
                const val = parseInt(ev.target.value) || 0;
                handleQtyUpdate(val);
              }}
            />
            {(!showColourBreakdown || colourRows.length === 0) &&
              getDynamicQuantities().map((presetQty) => (
                <button
                  key={presetQty}
                  type="button"
                  className={`px-3 py-1 text-xs font-semibold rounded-full border transition cursor-pointer ${
                    item.qty === presetQty
                      ? "bg-[#4B3BF5] text-white border-[#4B3BF5] shadow-xs"
                      : "bg-white border-dashed border-gray-300 text-gray-700 hover:border-indigo-500 hover:text-indigo-600"
                  }`}
                  onClick={() => handleQtyUpdate(presetQty)}
                >
                  {presetQty}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* 2. Approx rate per piece */}
      <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="font-bold text-xs text-gray-900">Approx. rate per piece</div>
          <div className="text-[11px] text-gray-400">What the client expects</div>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs font-bold text-gray-500">₹</span>
              <input
                type="number"
                placeholder={effectiveEst > 0 ? `e.g. ${effectiveEst}` : "0"}
                className="w-32 pl-7 pr-3 py-1.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 bg-white outline-none focus:border-indigo-500"
                value={item.budget ? item.budget : (item.budget === 0 || item.budget === "" ? "" : (item.budget ?? ""))}
                onFocus={(e) => e.target.select()}
                onChange={(ev) => {
                  const raw = ev.target.value;
                  const val = raw === "" ? "" : parseFloat(raw) || 0;
                  handleBudgetUpdate(val);
                }}
              />
            </div>
            {effectiveEst > 0 && (
              <button
                type="button"
                className="px-4 py-1.5 rounded-full border border-gray-200 text-xs text-gray-700 hover:bg-gray-50 transition cursor-pointer flex items-center"
                onClick={() => handleBudgetUpdate(effectiveEst)}
              >
                <span className="font-medium">Use our estimate · ₹{effectiveEst}</span>
                <span className="text-gray-400 font-normal ml-1.5">indicative</span>
              </button>
            )}
          </div>
          <button
            type="button"
            className="px-4 py-1.5 rounded-full border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition cursor-pointer"
            onClick={() => handleBudgetUpdate(0)}
          >
            Client hasn't said
          </button>
        </div>
      </div>

      {/* 3. Design options stepper */}
      <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="font-bold text-xs text-gray-900">Design options</div>
          <div className="text-[11px] text-gray-400">For this size</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-4 border border-indigo-200 rounded-full px-3 py-1 bg-white shadow-2xs">
            <button
              type="button"
              disabled={activeDesignOptions <= 1}
              onClick={() =>
                updateSpec(
                  { designOptions: Math.max(1, activeDesignOptions - 1) },
                  { designOptions: Math.max(1, activeDesignOptions - 1), designOptionsCount: Math.max(1, activeDesignOptions - 1) }
                )
              }
              className="text-gray-500 hover:text-gray-900 disabled:opacity-30 font-bold text-sm cursor-pointer p-0.5"
            >
              −
            </button>
            <span className="font-bold text-xs text-gray-900 min-w-4 text-center">
              {activeDesignOptions}
            </span>
            <button
              type="button"
              disabled={activeDesignOptions >= 6}
              onClick={() =>
                updateSpec(
                  { designOptions: Math.min(6, activeDesignOptions + 1) },
                  { designOptions: Math.min(6, activeDesignOptions + 1), designOptionsCount: Math.min(6, activeDesignOptions + 1) }
                )
              }
              className="text-gray-500 hover:text-gray-900 disabled:opacity-30 font-bold text-sm cursor-pointer p-0.5"
            >
              +
            </button>
          </div>
          <span className="text-xs text-gray-500 font-normal">options to show the client</span>
        </div>
      </div>
    </>
  );
};

export default ClassicBottomPricingSection;
