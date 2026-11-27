import React from "react";

/**
 * ColourBreakdownSection
 * Reusable colour/finish breakdown table supporting:
 * - Medal (MS & Zinc), Lapel Pin, Badge, and any product configured with colour_wise_qty.
 * - Same rate for all vs Differs by colour toggle.
 * - Quantity & individual rate inputs per colour row.
 * - +Label / No label toggle and Split label for medals.
 * - Quick presets: Gold/Silver/Bronze set, Gold/Silver, Antique set.
 * - Custom colour / finish picker with native color input and custom name.
 */
const ColourBreakdownSection = ({
  productType,
  spec = {},
  item = {},
  isZinc = false,
  colourRows = [],
  availableColours = [],
  getPlatingSwatch = () => "#D4AF37",
  handleUpdateColourRow = () => { },
  handleRemoveColourRow = () => { },
  handleAddColour = () => { },
  handleSplitMedalLabel = () => { },
  updateSpec = () => { },
  showCustomColorPicker = false,
  setShowCustomColorPicker = () => { },
  customColorName = "",
  setCustomColorName = () => { },
  customHex = "#B08D57",
  setCustomHex = () => { },
  handleSaveCustomColor = () => { },
  customFinishes = [],
  showManageCustomFinishes = false,
  setShowManageCustomFinishes = () => { },
  handleRemoveSavedCustomFinish = () => { }
}) => {
  const isMedal =
    productType === "medal" ||
    item?.product_type === "medal" ||
    (typeof productType === "string" && productType.toLowerCase().includes("medal"));

  const cleanColourRows = React.useMemo(() => {
    return (colourRows || []).filter(
      (r) => r && typeof r === "object" && Boolean(r.colour && String(r.colour).trim())
    );
  }, [colourRows]);

  const currentLabelOption =
    spec.labelOption ||
    (spec.hasLabel ? "with_label" : "no_label");

  const totalQty = cleanColourRows.reduce((sum, r) => sum + (parseInt(r.qty) || 0), 0);
  const labelledQty =
    currentLabelOption === "with_label"
      ? totalQty
      : currentLabelOption === "split"
        ? cleanColourRows.filter((r) => !r.noLabel).reduce((sum, r) => sum + (parseInt(r.qty) || 0), 0)
        : 0;

  const uniqueSavedCustoms = React.useMemo(() => {
    const seen = new Set();
    const result = [];
    (customFinishes || []).forEach((f) => {
      const name = typeof f === "object" ? (f.colour || f.name) : f;
      if (name && !seen.has(name)) {
        seen.add(name);
        result.push(f);
      }
    });
    return result;
  }, [customFinishes]);

  return (
    <div className="pb-4 border-b border-gray-100 space-y-2.5">
      {/* Header & Controls Strip (Label option + Differs by colour) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <span className="font-bold text-xs text-gray-900 flex items-center gap-1.5">
            <span>🎨</span>
            <span>{isZinc ? "Plating & Quantity Breakdown" : "Colour / Finish Wise Quantities"}</span>
          </span>
          <span className="text-[11px] text-gray-400">
            Split total quantity across finishes (e.g. Gold, Silver, Bronze)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Label Toggle: No label | With label | Split */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-semibold text-gray-500 mr-0.5">🏷️ Label:</span>
            <div className="flex items-center gap-0.5 bg-gray-100 p-0.5 rounded-lg text-[11px] font-semibold">
              <button
                type="button"
                className={`px-2 py-0.5 rounded transition cursor-pointer ${currentLabelOption === "no_label"
                  ? "bg-white text-gray-900 shadow-2xs font-bold"
                  : "text-gray-500 hover:text-gray-800"
                  }`}
                onClick={() => updateSpec({ labelOption: "no_label", hasLabel: false })}
                title="No label on items"
              >
                No label
              </button>
              <button
                type="button"
                className={`px-2 py-0.5 rounded transition cursor-pointer ${currentLabelOption === "with_label"
                  ? "bg-white text-amber-900 shadow-2xs font-bold"
                  : "text-gray-500 hover:text-gray-800"
                  }`}
                onClick={() => updateSpec({ labelOption: "with_label", hasLabel: true })}
                title="All items have label"
              >
                With label
              </button>
              <button
                type="button"
                className={`px-2 py-0.5 rounded transition cursor-pointer ${currentLabelOption === "split"
                  ? "bg-white text-indigo-900 shadow-2xs font-bold"
                  : "text-gray-500 hover:text-gray-800"
                  }`}
                onClick={() => updateSpec({ labelOption: "split", hasLabel: true })}
                title="Split label per colour row"
              >
                Split
              </button>
            </div>
          </div>

          {/* Differs by colour toggle */}
          <div className="flex items-center gap-0.5 bg-gray-100 p-0.5 rounded-lg text-[11px] font-semibold">
            <button
              type="button"
              className={`px-2 py-0.5 rounded transition cursor-pointer ${!spec.rateByColour ? "bg-white text-gray-900 shadow-2xs font-bold" : "text-gray-600 hover:text-gray-900"
                }`}
              onClick={() => {
                const commonRate =
                  item.budget !== undefined && item.budget !== null && item.budget !== ""
                    ? Number(item.budget)
                    : (spec.budget !== undefined && spec.budget !== null && spec.budget !== ""
                      ? Number(spec.budget)
                      : (item.sizeRate || 0));
                const nextRows = (colourRows || []).map((r) => ({ ...r, rate: commonRate }));
                updateSpec(
                  { rateByColour: false, colourQuantities: nextRows },
                  { colourQuantities: nextRows }
                );
              }}
            >
              Same rate
            </button>
            <button
              type="button"
              className={`px-2 py-0.5 rounded transition cursor-pointer ${spec.rateByColour ? "bg-white text-gray-900 shadow-2xs font-bold" : "text-gray-600 hover:text-gray-900"
                }`}
              onClick={() => updateSpec({ rateByColour: true })}
            >
              Differs by colour
            </button>
          </div>
        </div>
      </div>

      {/* Colour Breakdown Table */}
      {cleanColourRows.length > 0 ? (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white text-xs shadow-2xs">
          <div className="grid grid-cols-12 gap-2 bg-gray-50 px-3 py-1.5 font-bold text-gray-500 text-[11px] uppercase tracking-wider border-b border-gray-200">
            <div className="col-span-1">Swatch</div>
            <div className="col-span-4">Colour / Plating</div>
            <div className="col-span-3 text-right">Quantity</div>
            {spec.rateByColour && <div className="col-span-3 text-right">Rate/pc</div>}
            <div className={`${spec.rateByColour ? "col-span-1" : "col-span-4"} text-right`}>Action</div>
          </div>
          {cleanColourRows.map((cr, idx) => {
            const isDuplicateColour = cleanColourRows.filter((r) => r.colour === cr.colour).length > 1;
            const origIdx = colourRows.findIndex((r) => r === cr || (r.colour === cr.colour && r.qty === cr.qty));
            const targetIdx = origIdx !== -1 ? origIdx : idx;

            return (
              <div
                key={idx}
                className="grid grid-cols-12 gap-2 px-3 py-2 items-center border-b border-gray-100 last:border-0 hover:bg-gray-50/50"
              >
                <div className="col-span-1 flex items-center justify-center">
                  <span
                    className="w-4 h-4 rounded-full border border-gray-300 shadow-2xs inline-block"
                    style={{ background: getPlatingSwatch ? getPlatingSwatch(cr.colour) : "#D4AF37" }}
                  />
                </div>
                <div className="col-span-4 font-bold text-gray-800 flex items-center gap-1.5 flex-wrap">
                  <span>{cr.colour}</span>
                  {currentLabelOption === "split" && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className={`text-[10px] px-1.5 py-0.5 rounded font-bold cursor-pointer transition ${!cr.noLabel
                          ? "bg-amber-100 text-amber-800 border border-amber-200"
                          : "bg-gray-100 text-gray-500 border border-gray-200"
                          }`}
                        onClick={() => handleUpdateColourRow(targetIdx, { noLabel: !cr.noLabel })}
                        title="Toggle label for this row"
                      >
                        {!cr.noLabel ? "+Label" : "No label"}
                      </button>
                      {!isDuplicateColour && (
                        <button
                          type="button"
                          className="text-[11px] text-indigo-600 hover:underline font-semibold cursor-pointer"
                          onClick={() => handleSplitMedalLabel(targetIdx)}
                          title="Split into with label and without label rows"
                        >
                          + split
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="col-span-3 text-right">
                  <input
                    type="number"
                    placeholder="0"
                    className="w-20 px-2 py-1 text-right border border-gray-200 rounded-lg text-xs font-bold text-gray-900 bg-white focus:border-[#4B3BF5] outline-none"
                    value={cr.qty || ""}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) =>
                      handleUpdateColourRow(targetIdx, {
                        qty: e.target.value === "" ? "" : parseInt(e.target.value) || 0
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
                        className="w-full pl-4 pr-1.5 py-1 text-right border border-gray-200 rounded-lg text-xs font-bold text-gray-900 bg-white focus:border-[#4B3BF5] outline-none"
                        value={cr.rate || ""}
                        onChange={(e) =>
                          handleUpdateColourRow(targetIdx, { rate: parseFloat(e.target.value) || 0 })
                        }
                      />
                    </div>
                  </div>
                )}
                <div className={`${spec.rateByColour ? "col-span-1" : "col-span-4"} text-right`}>
                  <button
                    type="button"
                    className="text-gray-400 hover:text-red-500 font-bold text-sm px-1 cursor-pointer transition"
                    onClick={() => handleRemoveColourRow(targetIdx)}
                    title="Remove this colour row"
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}

          {/* Total Summary Row */}
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-gray-200 text-xs font-bold text-gray-800">
            <span>Total</span>
            <div className="flex items-center gap-3">
              {currentLabelOption === "with_label" && totalQty > 0 && (
                <span className="text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md font-semibold text-[10px] flex items-center gap-1">
                  <span>🏷️</span> All with label
                </span>
              )}
              {currentLabelOption === "split" && totalQty > 0 && (
                <span className="text-gray-500 font-normal text-[11px] flex items-center gap-1.5">
                  <span className="text-amber-700 font-semibold">{labelledQty} with label</span>
                  <span>·</span>
                  <span className="text-gray-500">{totalQty - labelledQty} without label</span>
                </span>
              )}
              <span className="text-indigo-900 font-bold">{totalQty} pcs</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-center text-xs text-gray-500">
          Pick a finish or set below to add colour-wise quantities
        </div>
      )}

      {/* Dynamic Available Finishes from Master & Custom */}
      <div className="flex gap-1.5 flex-wrap items-center pt-1 text-xs">
        {/* Individual Unselected Finishes from Master */}
        {availableColours
          .filter((c) => !cleanColourRows.some((r) => r.colour === c))
          .map((c) => (
            <button
              key={c}
              type="button"
              className="px-2.5 py-1 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              onClick={() => handleAddColour(c)}
            >
              <span
                className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                style={{ background: getPlatingSwatch ? getPlatingSwatch(c) : "#D4AF37" }}
              />
              <span>+ {c}</span>
            </button>
          ))}

        {/* Add Custom Colour */}
        <button
          type="button"
          className="px-2.5 py-1 border border-dashed border-indigo-400 text-indigo-700 hover:bg-indigo-50/60 rounded-lg text-[11px] font-bold cursor-pointer transition shadow-2xs"
          onClick={() => setShowCustomColorPicker(!showCustomColorPicker)}
        >
          + Add Custom Colour
        </button>

        {/* Manage saved (N) */}
        {uniqueSavedCustoms.length > 0 && (
          <button
            type="button"
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium ml-2 cursor-pointer transition underline decoration-dotted"
            onClick={() => setShowManageCustomFinishes((prev) => !prev)}
          >
            {showManageCustomFinishes ? "Done" : `Manage saved (${uniqueSavedCustoms.length})`}
          </button>
        )}
      </div>

      {/* Saved Custom Colours Drawer */}
      {showManageCustomFinishes && uniqueSavedCustoms.length > 0 && (
        <div className="p-3.5 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/50 space-y-2 text-xs">
          <div className="font-bold text-gray-800">
            {isMedal ? "Saved medal colours" : "Saved custom colours"}
          </div>
          <div className="text-[11px] text-gray-500">
            Remove one to retire it from the list. Jobs that already use it keep it.
          </div>
          <div className="flex gap-2 flex-wrap pt-1">
            {uniqueSavedCustoms.map((f) => {
              const colName = typeof f === "object" ? (f.colour || f.name) : f;
              const colCode =
                typeof f === "object"
                  ? f.colourCode || f.code
                  : getPlatingSwatch
                    ? getPlatingSwatch(colName)
                    : "#D4AF37";
              const isColourInUse = cleanColourRows.some((r) => r.colour === colName);

              return (
                <span
                  key={colName}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 rounded-full font-semibold shadow-2xs text-gray-800"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                    style={{ background: colCode || "#D4AF37" }}
                  />
                  <span>{colName}</span>
                  {isColourInUse ? (
                    <span
                      className="inline-flex items-center gap-1 ml-1 cursor-not-allowed"
                      title="Cannot remove while in use in table above. Remove the row first."
                    >
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                        In use
                      </span>
                      <button
                        type="button"
                        disabled
                        className="text-xs text-gray-300 font-bold cursor-not-allowed opacity-60"
                        title="Cannot remove while in use in table above"
                      >
                        Remove
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="text-xs text-red-500 hover:text-red-700 font-bold ml-1 cursor-pointer transition"
                      onClick={() => handleRemoveSavedCustomFinish(colName)}
                      title="Remove saved colour"
                    >
                      Remove
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Inline Custom Colour Creator */}
      {showCustomColorPicker && (
        <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2 text-xs shadow-2xs">
          <span className="font-bold text-amber-900 block">Create Custom Colour / Finish</span>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="color"
              className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0.5"
              value={customHex}
              onChange={(e) => setCustomHex(e.target.value)}
            />
            <input
              type="text"
              placeholder="Colour name, e.g. Black Nickel, Rainbow"
              className="flex-1 min-w-[160px] px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white font-medium outline-none focus:border-amber-500"
              value={customColorName}
              onChange={(e) => setCustomColorName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSaveCustomColor();
                }
              }}
            />
            <button
              type="button"
              className="px-3 py-1.5 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 cursor-pointer shadow-2xs"
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
  );
};

export default ColourBreakdownSection;

