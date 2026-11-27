import React, { useState } from "react";
import { useSelector } from "react-redux";
import {
  MEDAL_FINISHES,
  MEDAL_ZINC_PLATINGS,
  METAL_PLATINGS,
  SWATCH_MAP
} from "../../../utils/productConstants";
import { generateSpecLine } from "../../../utils/specLineGenerator";
import { SIZE_CARD_MAP, CommonPriceSection } from "./size-cards";

const LAPEL_SUGGESTION_COLORS = {
  "Black nickel": "#2B2D2F",
  "Matte gold": "#CDB067",
  "Shiny gold": "#F5C71A",
  "Antique copper": "#7A4222",
  Rainbow: "linear-gradient(135deg, #FF6B6B, #4ECDC4, #45B649, #9B59B6)",
  Gunmetal: "#535A61"
};

const ProductSpecificSizeCard = ({
  gIdx,
  iIdx,
  item,
  group,
  productType = "trophy",
  materials = [],
  elements = [],
  onUpdateItem,
  onRemoveSize,
  onDuplicateSize,
  canRemove = false
}) => {
  const spec = item.spec || {};
  const [unit, setUnit] = useState(spec.unit || "in");
  const [isCustomSize, setIsCustomSize] = useState(Boolean(spec.isCustomSize));

  const { activeItems = [] } = useSelector((state) => state.productConfigMaster || {});
  const productConfig = activeItems.find((p) => p.product_id === productType);

  const getDynamicSizes = (fallbackSizes) => {
    if (productConfig?.size_config?.preset_sizes && productConfig.size_config.preset_sizes.length > 0) {
      const isFallbackObj =
        Array.isArray(fallbackSizes) &&
        fallbackSizes.length > 0 &&
        typeof fallbackSizes[0] === "object" &&
        (fallbackSizes[0]?.id !== undefined || fallbackSizes[0]?.value !== undefined);

      return productConfig.size_config.preset_sizes.map((sz) => {
        if (typeof sz === "string") {
          return isFallbackObj ? { id: sz, label: sz } : sz;
        }
        if (typeof sz === "object" && sz !== null) {
          if (isFallbackObj) {
            return {
              id: sz.value || sz.label,
              label: sz.label || sz.value,
              is_usual: sz.is_usual,
            };
          }
          return sz.value !== undefined ? sz.value : sz.label;
        }
        return sz;
      });
    }
    return fallbackSizes;
  };

  const getDynamicQuantities = (fallbackQuantities) => {
    if (productConfig?.size_config?.preset_quantities && productConfig.size_config.preset_quantities.length > 0) {
      return productConfig.size_config.preset_quantities.map((q) => {
        if (typeof q === "object" && q !== null) {
          return Number(q.value ?? q.qty ?? q.label) || 0;
        }
        return Number(q) || 0;
      });
    }
    return fallbackQuantities;
  };

  // Colour-wise states & handlers (v30/v31)
  const isZinc = (spec.medalType || group?.designSpec?.medalType || "ms_punched") === "zinc_cast";
  const isColourWise = productType === "medal" || productType === "badge";
  const colourRows = item.colourQuantities || [];
  const [showCustomColorPicker, setShowCustomColorPicker] = useState(false);
  const [showAddFinishPicker, setShowAddFinishPicker] = useState(false);
  const [customColorName, setCustomColorName] = useState("");
  const [customHex, setCustomHex] = useState("#B08D57");

  // Lapel pin plating states
  const [showNewPlatingForm, setShowNewPlatingForm] = useState(false);
  const [newPlatingName, setNewPlatingName] = useState("");
  const [newPlatingColor, setNewPlatingColor] = useState("#A0703C");
  const [savePlatingForAllJobs, setSavePlatingForAllJobs] = useState(true);
  const [editingRowIndex, setEditingRowIndex] = useState(null);
  const [customLapelPlatings, setCustomLapelPlatings] = useState(() => {
    try {
      const saved = localStorage.getItem("lapel_custom_platings");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [dynamicSwatches, setDynamicSwatches] = useState({});

  const getPlatingSwatch = (plating) => {
    if (!plating) return "#D4AF37";
    if (dynamicSwatches[plating]) return dynamicSwatches[plating];
    if (SWATCH_MAP[plating]) return SWATCH_MAP[plating];
    if (LAPEL_SUGGESTION_COLORS[plating]) return LAPEL_SUGGESTION_COLORS[plating];
    return "#D4AF37";
  };

  const availableColours = productType === "medal"
    ? (isZinc ? MEDAL_ZINC_PLATINGS : MEDAL_FINISHES)
    : productType === "lapel_pin"
    ? METAL_PLATINGS
    : ["Gold mirror", "Silver mirror", "Rose gold mirror", "White", "Black", "Wood", "Red", "Blue", "Green"];

  const handleUpdateColourRow = (index, updates) => {
    const nextRows = [...colourRows];
    nextRows[index] = { ...nextRows[index], ...updates };
    const totalQty = nextRows.reduce((sum, r) => sum + (parseInt(r.qty) || 0), 0);
    onUpdateItem({
      ...item,
      qty: totalQty,
      colourQuantities: nextRows,
      colour: nextRows.map((r) => r.colour).filter(Boolean).join(", ")
    });
  };

  const handleAddColour = (colName) => {
    if (colourRows.some((r) => r.colour === colName)) return;
    const newRow = { colour: colName, qty: 0, rate: item.budget || 0, noLabel: false };
    const nextRows = [...colourRows, newRow];
    onUpdateItem({
      ...item,
      colourQuantities: nextRows,
      colour: nextRows.map((r) => r.colour).filter(Boolean).join(", ")
    });
  };

  const handleAddGoldSilverBronze = () => {
    const baseSet = isZinc ? ["Gold", "Silver", "Bronze"] : ["Gold", "Silver", "Shimmer copper"];
    const existing = new Set(colourRows.map((r) => r.colour));
    const toAdd = baseSet.filter((c) => !existing.has(c)).map((c) => ({ colour: c, qty: 0, rate: item.budget || 0, noLabel: false }));
    const nextRows = [...colourRows, ...toAdd];
    onUpdateItem({
      ...item,
      colourQuantities: nextRows,
      colour: nextRows.map((r) => r.colour).filter(Boolean).join(", ")
    });
  };

  const handleAddGoldSilver = () => {
    const baseSet = ["Gold", "Silver"];
    const existing = new Set(colourRows.map((r) => r.colour));
    const toAdd = baseSet.filter((c) => !existing.has(c)).map((c) => ({ colour: c, qty: 0, rate: item.budget || 0, noLabel: false }));
    const nextRows = [...colourRows, ...toAdd];
    onUpdateItem({
      ...item,
      colourQuantities: nextRows,
      colour: nextRows.map((r) => r.colour).filter(Boolean).join(", ")
    });
  };

  const handleAddAntiqueSet = () => {
    const baseSet = ["Antique gold", "Antique silver", "Antique bronze"];
    const existing = new Set(colourRows.map((r) => r.colour));
    const toAdd = baseSet.filter((c) => !existing.has(c)).map((c) => ({ colour: c, qty: 0, rate: item.budget || 0, noLabel: false }));
    const nextRows = [...colourRows, ...toAdd];
    onUpdateItem({
      ...item,
      colourQuantities: nextRows,
      colour: nextRows.map((r) => r.colour).filter(Boolean).join(", ")
    });
  };

  const handleRemoveColourRow = (index) => {
    const nextRows = colourRows.filter((_, idx) => idx !== index);
    const totalQty = nextRows.reduce((sum, r) => sum + (parseInt(r.qty) || 0), 0);
    onUpdateItem({
      ...item,
      qty: totalQty,
      colourQuantities: nextRows,
      colour: nextRows.map((r) => r.colour).filter(Boolean).join(", ")
    });
  };

  const handleSaveCustomColor = () => {
    if (!customColorName.trim()) return;
    handleAddColour(customColorName.trim());
    setCustomColorName("");
    setShowCustomColorPicker(false);
  };

  // Lapel Pin specific row & plating handlers
  const handleSetLapelRowPlating = (rIdx, plating) => {
    const existingRows = colourRows.length > 0
      ? [...colourRows]
      : [{ colour: "", qty: item.qty || 0, rate: item.budget || 0 }];
    const nextRows = existingRows.map((r, idx) => (idx === rIdx ? { ...r, colour: plating } : r));
    setEditingRowIndex(null);
    const totalQty = nextRows.reduce((sum, r) => sum + (parseInt(r.qty) || 0), 0);
    onUpdateItem({
      ...item,
      qty: totalQty,
      colourQuantities: nextRows,
      colour: nextRows.map((r) => r.colour).filter(Boolean).join(", ")
    });
  };

  const handleUpdateLapelRowQty = (rIdx, qtyVal) => {
    const existingRows = colourRows.length > 0
      ? [...colourRows]
      : [{ colour: "", qty: 0, rate: item.budget || 0 }];
    const nextRows = existingRows.map((r, idx) => (idx === rIdx ? { ...r, qty: qtyVal } : r));
    const totalQty = nextRows.reduce((sum, r) => sum + (parseInt(r.qty) || 0), 0);
    onUpdateItem({
      ...item,
      qty: totalQty,
      colourQuantities: nextRows,
      colour: nextRows.map((r) => r.colour).filter(Boolean).join(", ")
    });
  };

  const handleUpdateLapelRowRate = (rIdx, rateVal) => {
    const existingRows = colourRows.length > 0
      ? [...colourRows]
      : [{ colour: "", qty: item.qty || 0, rate: item.budget || 0 }];
    const nextRows = existingRows.map((r, idx) => (idx === rIdx ? { ...r, rate: rateVal } : r));
    onUpdateItem({
      ...item,
      colourQuantities: nextRows,
      colour: nextRows.map((r) => r.colour).filter(Boolean).join(", ")
    });
  };

  const handleSetAllRates = (rateVal) => {
    const existingRows = colourRows.length > 0
      ? [...colourRows]
      : [{ colour: "", qty: item.qty || 0, rate: item.budget || 0 }];
    const nextRows = existingRows.map((r) => ({ ...r, rate: rateVal }));
    onUpdateItem({
      ...item,
      budget: rateVal,
      colourQuantities: nextRows,
      colour: nextRows.map((r) => r.colour).filter(Boolean).join(", ")
    });
  };

  const handleAddLapelColour = (colName) => {
    const unconfirmedOnly = colourRows.length === 1 && !colourRows[0].colour;
    const existingRows = unconfirmedOnly ? [] : (colourRows.length > 0 ? [...colourRows] : []);
    if (existingRows.some((r) => r.colour === colName)) return;
    const newRow = { colour: colName, qty: 0, rate: item.budget || 0, noLabel: false };
    const nextRows = [...existingRows, newRow];
    const totalQty = nextRows.reduce((sum, r) => sum + (parseInt(r.qty) || 0), 0);
    onUpdateItem({
      ...item,
      qty: totalQty,
      colourQuantities: nextRows,
      colour: nextRows.map((r) => r.colour).filter(Boolean).join(", ")
    });
  };

  const handleAddLapelGoldSilver = () => {
    const baseSet = ["Gold", "Silver"];
    const baseRows = colourRows.filter((r) => Boolean(r.colour));
    const existing = new Set(baseRows.map((r) => r.colour));
    const toAdd = baseSet
      .filter((c) => !existing.has(c))
      .map((c) => ({ colour: c, qty: 0, rate: item.budget || 0, noLabel: false }));
    const nextRows = [...baseRows, ...toAdd];
    const totalQty = nextRows.reduce((sum, r) => sum + (parseInt(r.qty) || 0), 0);
    onUpdateItem({
      ...item,
      qty: totalQty,
      colourQuantities: nextRows,
      colour: nextRows.map((r) => r.colour).filter(Boolean).join(", ")
    });
  };

  const handleRemoveLapelRow = (rIdx) => {
    const existingRows = colourRows.length > 0
      ? [...colourRows]
      : [{ colour: "Gold", qty: item.qty || 0, rate: item.budget || 0 }];
    if (existingRows.length <= 1) {
      setEditingRowIndex(0);
      const nextRows = [{ colour: "", qty: 0, rate: item.budget || 0 }];
      onUpdateItem({
        ...item,
        qty: 0,
        colourQuantities: nextRows,
        colour: ""
      });
      return;
    }
    const nextRows = existingRows.filter((_, idx) => idx !== rIdx);
    const totalQty = nextRows.reduce((sum, r) => sum + (parseInt(r.qty) || 0), 0);
    onUpdateItem({
      ...item,
      qty: totalQty,
      colourQuantities: nextRows,
      colour: nextRows.map((r) => r.colour).filter(Boolean).join(", ")
    });
  };

  const handleSaveNewPlating = () => {
    const trimmed = newPlatingName.trim();
    if (!trimmed) return;
    if (savePlatingForAllJobs) {
      try {
        const nextList = Array.from(new Set([...customLapelPlatings, trimmed]));
        localStorage.setItem("lapel_custom_platings", JSON.stringify(nextList));
        setCustomLapelPlatings(nextList);
      } catch (_err) {
        /* ignore */
      }
    } else {
      setCustomLapelPlatings((prev) => Array.from(new Set([...prev, trimmed])));
    }
    setDynamicSwatches((prev) => ({
      ...prev,
      [trimmed]: newPlatingColor
    }));
    handleAddLapelColour(trimmed);
    setNewPlatingName("");
    setShowNewPlatingForm(false);
  };

  // Helper to update spec fields inside item and optional item overrides (e.g. size, qty, budget)
  const updateSpec = (updates = {}, itemOverrides = {}) => {
    const newSpec = { ...(item.spec || {}), ...updates };
    const nextItem = {
      ...item,
      ...itemOverrides,
      spec: newSpec
    };
    if (itemOverrides.size !== undefined) {
      nextItem.size = itemOverrides.size;
    }
    if (updates.designOptions !== undefined || itemOverrides.designOptions !== undefined) {
      const rawOpt = updates.designOptions !== undefined ? updates.designOptions : itemOverrides.designOptions;
      const dOpt = Math.min(5, Math.max(1, parseInt(rawOpt, 10) || 2));
      nextItem.designOptions = dOpt;
      nextItem.designOptionsCount = dOpt;
      newSpec.designOptions = dOpt;
    }
    nextItem.specLine = generateSpecLine(productType, newSpec, group);
    onUpdateItem(nextItem);
  };

  // Live Spec Line
  const liveSpecLine = item.specLine || generateSpecLine(productType, spec, group);

  // Plaque machine limit check (36 × 48 in)
  const isPlaqueOversized =
    productType === "plaque" &&
    ((spec.len && spec.len > 36) || (spec.wid && spec.wid > 48) || (spec.len && spec.len > 48) || (spec.wid && spec.wid > 36));

  const isModernProduct = (
    productType === "frame" ||
    productType === "lapel_pin" ||
    productType === "badge" ||
    productType === "cufflinks" ||
    productType === "tie_pin" ||
    productType === "fridge_magnet" ||
    productType === "flagstand" ||
    productType === "coaster" ||
    productType === "scroll"
  );

  const SpecificCard = SIZE_CARD_MAP[productType] || SIZE_CARD_MAP.trophy;

  return (
    <div className="bg-white border border-gray-200 hover:border-indigo-300 rounded-2xl overflow-hidden transition shadow-xs">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
        <div className="flex items-center gap-2.5">
          <span className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center shadow-xs ${
            isModernProduct ? "bg-purple-100 text-[#4B3BF5]" : "bg-emerald-600 text-white"
          }`}>
            {isModernProduct ? iIdx + 1 : "✓"}
          </span>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-gray-900">
              {productType === "frame"
                ? `Size ${iIdx + 1} · ${item.size || "A4"}`
                : isModernProduct
                ? `Size ${iIdx + 1}`
                : `Size Line ${iIdx + 1}`}
            </span>
            {isModernProduct && (
              <span className="text-xs text-gray-400 font-normal">
                {productType === "scroll"
                  ? (item.size === "A4" || !item.size ? "8.3 × 11.7 in" : item.size === "A3" ? "11.7 × 16.5 in" : item.size === "10×14" ? "10 × 14 in" : item.size === "12×18" ? "12 × 18 in" : item.size)
                  : item.size || (productType === "coaster" ? '4"' : productType === "flagstand" ? '10"' : productType === "cufflinks" ? "18 mm" : productType === "tie_pin" ? '2.25"' : productType === "fridge_magnet" ? "3×3 in" : productType === "badge" ? '2"' : '1.5"')}
              </span>
            )}
            {!isModernProduct && item.size && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-semibold">
                {item.size} {unit !== "in" && unit}
              </span>
            )}
            {!isModernProduct && item.qty ? (
              <span className="text-xs text-gray-500 font-normal">
                · {item.qty} pcs
              </span>
            ) : null}
            {!isModernProduct && item.budget ? (
              <span className="text-xs text-gray-500 font-normal">
                · ≈ ₹{item.budget}/pc
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onDuplicateSize && !isModernProduct && (
            <button
              type="button"
              className="px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-lg transition cursor-pointer"
              onClick={onDuplicateSize}
            >
              + Duplicate with new size
            </button>
          )}
          {canRemove && (
            <button
              type="button"
              className="text-gray-400 hover:text-red-600 font-medium text-xs transition cursor-pointer px-1"
              onClick={onRemoveSize}
            >
              {(productType === "badge" || productType === "cufflinks") ? "Remove size" : "Remove"}
            </button>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Specific Product Size Card */}
        {SpecificCard && (
          <SpecificCard
            item={item}
            spec={spec}
            group={group}
            gIdx={gIdx}
            iIdx={iIdx}
            productType={productType}
            unit={unit}
            setUnit={setUnit}
            isCustomSize={isCustomSize}
            setIsCustomSize={setIsCustomSize}
            getDynamicSizes={getDynamicSizes}
            getDynamicQuantities={getDynamicQuantities}
            updateSpec={updateSpec}
            onUpdateItem={onUpdateItem}
            colourRows={colourRows}
            availableColours={availableColours}
            handleUpdateColourRow={handleUpdateColourRow}
            handleRemoveColourRow={handleRemoveColourRow}
            handleAddColour={handleAddColour}
            handleAddGoldSilverBronze={handleAddGoldSilverBronze}
            handleAddGoldSilver={handleAddGoldSilver}
            handleAddAntiqueSet={handleAddAntiqueSet}
            showCustomColorPicker={showCustomColorPicker}
            setShowCustomColorPicker={setShowCustomColorPicker}
            customColorName={customColorName}
            setCustomColorName={setCustomColorName}
            customHex={customHex}
            setCustomHex={setCustomHex}
            handleSaveCustomColor={handleSaveCustomColor}
            editingRowIndex={editingRowIndex}
            setEditingRowIndex={setEditingRowIndex}
            getPlatingSwatch={getPlatingSwatch}
            handleSetLapelRowPlating={handleSetLapelRowPlating}
            handleUpdateLapelRowQty={handleUpdateLapelRowQty}
            handleUpdateLapelRowRate={handleUpdateLapelRowRate}
            handleSetAllRates={handleSetAllRates}
            handleAddLapelColour={handleAddLapelColour}
            handleAddLapelGoldSilver={handleAddLapelGoldSilver}
            handleRemoveLapelRow={handleRemoveLapelRow}
            showNewPlatingForm={showNewPlatingForm}
            setShowNewPlatingForm={setShowNewPlatingForm}
            newPlatingName={newPlatingName}
            setNewPlatingName={setNewPlatingName}
            newPlatingColor={newPlatingColor}
            setNewPlatingColor={setNewPlatingColor}
            savePlatingForAllJobs={savePlatingForAllJobs}
            setSavePlatingForAllJobs={setSavePlatingForAllJobs}
            handleSaveNewPlating={handleSaveNewPlating}
            customLapelPlatings={customLapelPlatings}
            materials={materials}
            elements={elements}
            isPlaqueOversized={isPlaqueOversized}
            isZinc={isZinc}
          />
        )}

        {/* Common Section: Quantities to Price, Rate, and Live Spec Line */}
        <CommonPriceSection
          item={item}
          spec={spec}
          group={group}
          productType={productType}
          colourRows={colourRows}
          isColourWise={isColourWise}
          onUpdateItem={onUpdateItem}
          updateSpec={updateSpec}
          liveSpecLine={liveSpecLine}
          materials={materials}
          elements={elements}
        />
      </div>
    </div>
  );
};

export default ProductSpecificSizeCard;
