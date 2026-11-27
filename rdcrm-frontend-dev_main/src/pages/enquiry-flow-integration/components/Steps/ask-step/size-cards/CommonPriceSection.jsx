import React from "react";

const CommonPriceSection = ({
  productType,
  productConfig = null,
  item = {},
  spec = {},
  isColourWise,
  colourRows = [],
  getPlatingSwatch,
  handleUpdateColourRow,
  handleRemoveColourRow,
  handleAddGoldSilverBronze,
  availableColours = [],
  handleAddColour,
  showCustomColorPicker,
  setShowCustomColorPicker,
  customHex,
  setCustomHex,
  customColorName,
  setCustomColorName,
  handleSaveCustomColor,
  onUpdateItem,
  getDynamicQuantities = () => [],
  currentEst,
  updateSpec,
  liveSpecLine
}) => {
  const showQuantitiesToPrice = Boolean(productConfig?.size_config?.show_quantities_to_price);

  return (
    <>
      {/* Colour-wise Quantity Breakdown (v30, v31) */}
      {isColourWise && (
        <div className="pt-3 border-t border-gray-100 space-y-2.5">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-bold text-xs text-gray-900 flex items-center gap-1.5">
                <span>🎨</span>
                <span>Colour / Finish Wise Quantities (v30)</span>
              </span>
              <span className="text-[11px] text-gray-400">
                Split total quantity across finishes (e.g. Gold, Silver, Bronze)
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-gray-100 p-0.5 rounded-lg text-[11px] font-semibold">
              <button
                type="button"
                className={`px-2 py-0.5 rounded ${!spec.rateByColour ? "bg-white text-gray-900 shadow-2xs font-bold" : "text-gray-600"}`}
                onClick={() => updateSpec({ rateByColour: false })}
              >
                Same rate for all
              </button>
              <button
                type="button"
                className={`px-2 py-0.5 rounded ${spec.rateByColour ? "bg-white text-gray-900 shadow-2xs font-bold" : "text-gray-600"}`}
                onClick={() => updateSpec({ rateByColour: true })}
              >
                Differs by colour
              </button>
            </div>
          </div>

          {/* Colour Table */}
          {colourRows.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-white text-xs">
              <div className="grid grid-cols-12 gap-2 bg-gray-50 px-3 py-1.5 font-bold text-gray-500 text-[11px] uppercase tracking-wider border-b border-gray-200">
                <div className="col-span-1">Swatch</div>
                <div className="col-span-4">Colour / Plating</div>
                <div className="col-span-3 text-right">Quantity</div>
                {spec.rateByColour && <div className="col-span-3 text-right">Rate/pc</div>}
                <div className={`${spec.rateByColour ? "col-span-1" : "col-span-4"} text-right`}>Action</div>
              </div>
              {colourRows.map((cr, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 items-center border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                  <div className="col-span-1 flex items-center justify-center">
                    <span
                      className="w-4 h-4 rounded-full border border-gray-300 shadow-2xs inline-block"
                      style={{ background: getPlatingSwatch ? getPlatingSwatch(cr.colour) : "#D4AF37" }}
                    />
                  </div>
                  <div className="col-span-4 font-bold text-gray-800 flex items-center gap-1.5">
                    <span>{cr.colour}</span>
                    {productType === "medal" && (
                      <button
                        type="button"
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold cursor-pointer ${!cr.noLabel ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-500"
                          }`}
                        onClick={() => handleUpdateColourRow(idx, { noLabel: !cr.noLabel })}
                        title="Toggle label on this colour"
                      >
                        {!cr.noLabel ? "+Label" : "No label"}
                      </button>
                    )}
                  </div>
                  <div className="col-span-3 text-right">
                    <input
                      type="number"
                      placeholder="0"
                      className="w-20 px-2 py-1 text-right border border-gray-200 rounded-lg text-xs font-bold text-gray-900 bg-white"
                      value={cr.qty || ""}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) =>
                        handleUpdateColourRow(idx, {
                          qty: e.target.value === "" ? "" : (parseInt(e.target.value) || 0)
                        })
                      }
                    />
                  </div>
                  {spec.rateByColour && (
                    <div className="col-span-3 text-right">
                      <div className="relative inline-block w-20">
                        <span className="absolute left-2 top-1 text-[10px] text-gray-400">₹</span>
                        <input
                          type="number"
                          placeholder="Rate"
                          className="w-full pl-4 pr-1.5 py-1 text-right border border-gray-200 rounded-lg text-xs font-bold text-gray-900 bg-white"
                          value={cr.rate || ""}
                          onChange={(e) => handleUpdateColourRow(idx, { rate: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  )}
                  <div className={`${spec.rateByColour ? "col-span-1" : "col-span-4"} text-right`}>
                    <button
                      type="button"
                      className="text-gray-400 hover:text-red-500 font-bold text-sm px-1 cursor-pointer"
                      onClick={() => handleRemoveColourRow(idx)}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Action Chips & Set Presets */}
          <div className="flex gap-1.5 flex-wrap items-center pt-1 text-xs">
            <button
              type="button"
              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
              onClick={handleAddGoldSilverBronze}
            >
              <span>🏆</span>
              <span>+ Gold · Silver · Bronze Set</span>
            </button>

            {availableColours.filter((c) => !colourRows.some((r) => r.colour === c)).map((c) => (
              <button
                key={c}
                type="button"
                className="px-2 py-0.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                onClick={() => handleAddColour(c)}
              >
                <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ background: getPlatingSwatch ? getPlatingSwatch(c) : "#D4AF37" }} />
                <span>+ {c}</span>
              </button>
            ))}

            <button
              type="button"
              className="px-2 py-0.5 border border-dashed border-indigo-300 text-indigo-700 hover:bg-indigo-50 rounded-md text-[11px] font-semibold cursor-pointer"
              onClick={() => setShowCustomColorPicker(!showCustomColorPicker)}
            >
              + Add Custom Colour
            </button>
          </div>

          {/* Custom Colour Modal/Inline Form */}
          {showCustomColorPicker && (
            <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2 text-xs">
              <span className="font-bold text-amber-900 block">Create Custom Colour / Finish</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0.5"
                  value={customHex}
                  onChange={(e) => setCustomHex(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Colour name, e.g. Black Nickel, Rainbow"
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
                  value={customColorName}
                  onChange={(e) => setCustomColorName(e.target.value)}
                />
                <button
                  type="button"
                  className="px-3 py-1.5 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 cursor-pointer"
                  onClick={handleSaveCustomColor}
                >
                  Add Colour
                </button>
                <button
                  type="button"
                  className="px-2 py-1.5 text-gray-500 hover:text-gray-700 font-semibold cursor-pointer"
                  onClick={() => setShowCustomColorPicker(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Common Section: Quantities to Price & Rate (For non-medal, non-frame, non-lapel_pin, non-badge, non-cufflinks, non-tie_pin, non-fridge_magnet, non-flagstand, non-coaster, and non-scroll products) */}
      {/* {productType !== "medal" && productType !== "frame" && productType !== "lapel_pin" && productType !== "badge" && productType !== "cufflinks" && productType !== "tie_pin" && productType !== "fridge_magnet" && productType !== "flagstand" && productType !== "coaster" && productType !== "scroll" && ( */}
      <>
        {showQuantitiesToPrice && (
          <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="font-bold text-xs text-gray-900">
                Quantities to price
              </div>
              <div className="text-[11px] text-gray-400">
                {isColourWise && colourRows.length > 0 ? "Total sum from colour breakdown above" : "Add one or more quantity targets"}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="number"
                placeholder="Qty"
                disabled={isColourWise && colourRows.length > 0}
                className={`w-24 border border-gray-200 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-gray-900 outline-none focus:border-indigo-500 shadow-2xs ${isColourWise && colourRows.length > 0 ? "bg-gray-100 cursor-not-allowed" : "bg-white"
                  }`}
                value={item.qty || ""}
                onFocus={(e) => e.target.select()}
                onChange={(ev) => {
                  const raw = ev.target.value;
                  const val = raw === "" ? "" : parseInt(raw) || 0;
                  onUpdateItem({ ...item, qty: val });
                }}
              />
              {(!isColourWise || colourRows.length === 0) && getDynamicQuantities().map((presetQty) => (
                <button
                  key={presetQty}
                  type="button"
                  className={`px-3 py-1 text-xs font-semibold rounded-full border transition cursor-pointer ${item.qty === presetQty
                    ? "bg-[#4B3BF5] text-white border-[#4B3BF5] shadow-xs"
                    : "bg-white border-dashed border-gray-300 text-gray-700 hover:border-indigo-500 hover:text-indigo-600"
                    }`}
                  onClick={() => onUpdateItem({ ...item, qty: presetQty })}
                >
                  {presetQty}
                </button>
              ))}
            </div>
          </div>
        )}

        {(() => {
          const masterDefaultBudget =
            productConfig?.size_config?.default_budget !== undefined &&
              productConfig?.size_config?.default_budget !== null &&
              Number(productConfig?.size_config?.default_budget) > 0
              ? Number(productConfig?.size_config?.default_budget)
              : 0;
          const effectiveEst = masterDefaultBudget || currentEst || 0;

          return (
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
                        onUpdateItem({ ...item, budget: val });
                      }}
                    />
                  </div>
                  {effectiveEst > 0 && (
                    <button
                      type="button"
                      className="px-4 py-1.5 rounded-full border border-gray-200 text-xs text-gray-700 hover:bg-gray-50 transition cursor-pointer flex items-center"
                      onClick={() => {
                        onUpdateItem({ ...item, budget: effectiveEst });
                      }}
                    >
                      <span className="font-medium">Use our estimate · ₹{effectiveEst}</span>
                      <span className="text-gray-400 font-normal ml-1.5">indicative</span>
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  className="px-4 py-1.5 rounded-full border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                  onClick={() => onUpdateItem({ ...item, budget: 0 })}
                >
                  Client hasn't said
                </button>
              </div>
            </div>
          );
        })()}

        {/* Row: Design options stepper */}
        <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="font-bold text-xs text-gray-900">Design options</div>
            <div className="text-[11px] text-gray-400">For this size</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-4 border border-indigo-200 rounded-full px-3 py-1 bg-white shadow-2xs">
              <button
                type="button"
                disabled={(spec.designOptions || item.designOptions || 2) <= 1}
                onClick={() =>
                  updateSpec(
                    { designOptions: Math.max(1, (spec.designOptions || item.designOptions || 2) - 1) },
                    { designOptions: Math.max(1, (item.designOptions || 2) - 1) }
                  )
                }
                className="text-gray-500 hover:text-gray-900 disabled:opacity-30 font-bold text-sm cursor-pointer p-0.5"
              >
                −
              </button>
              <span className="font-bold text-xs text-gray-900 min-w-4 text-center">
                {spec.designOptions || item.designOptions || 2}
              </span>
              <button
                type="button"
                disabled={(spec.designOptions || item.designOptions || 2) >= 6}
                onClick={() =>
                  updateSpec(
                    { designOptions: Math.min(6, (spec.designOptions || item.designOptions || 2) + 1) },
                    { designOptions: Math.min(6, (item.designOptions || 2) + 1) }
                  )
                }
                className="text-gray-500 hover:text-gray-900 disabled:opacity-30 font-bold text-sm cursor-pointer p-0.5"
              >
                +
              </button>
            </div>
            <span className="text-xs text-gray-500 font-normal">
              options to show the client
            </span>
          </div>
        </div>
      </>
      {/* )} */}

      {/* Live Spec Line Banner (Section 15 of Ronald's spec) */}
      {/* {productType !== "frame" && productType !== "lapel_pin" && productType !== "badge" && productType !== "cufflinks" && productType !== "tie_pin" && productType !== "fridge_magnet" && productType !== "flagstand" && productType !== "coaster" && productType !== "scroll" && ( */}
      {/* <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-2 text-xs text-gray-700">
        <span className="text-sm">🏷️</span>
        <div className="flex-1 truncate">
          <span className="text-gray-400 font-semibold mr-1.5">Spec Line:</span>
          <span className="font-bold text-gray-900">{liveSpecLine}</span>
        </div>
      </div> */}
      {/* )} */}
    </>
  );
};

export default CommonPriceSection;

