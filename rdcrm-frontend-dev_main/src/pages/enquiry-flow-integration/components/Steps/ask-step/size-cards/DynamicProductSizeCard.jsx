import React from "react";
import ColourBreakdownSection from "./ColourBreakdownSection";
import ClassicBottomPricingSection from "./ClassicBottomPricingSection";

/**
 * Universal 100% Dynamic Product Size & Pricing Card
 * Completely master-driven by MongoDB ProductConfigMaster.size_config.
 * 
 * Preserves the exact two visual design systems:
 * 1. Classic Layout (Trophy, Memento, Plaque):
 *    - Full-width preset pills, clean height/dimensions, optional W & D box calculations.
 *    - Inline price rows (Quantities, Budget, Pill Stepper, Spec Line banner).
 * 2. Modern 2-Column Layout (Medal, Coaster, Frame, Badge, Lapel Pin, Cufflinks, Tie Pin, Scroll, Fridge Magnet, Flagstand):
 *    - Structured 2-column layout (w-52 label column + flex-1 input column) with border-b separators.
 *    - Modern square stepper buttons (w-7 h-7) inside gray pill.
 *    - Multi-finish/Plating breakdown table for Medals, Badges, Lapel Pins, and any colour-wise product.
 */
const DynamicProductSizeCard = ({
  item = {},
  spec = {},
  group = {},
  productType = "trophy",
  productConfig = null,
  unit = "in",
  setUnit = () => { },
  isCustomSize = false,
  setIsCustomSize = () => { },
  getDynamicSizes = () => [],
  getDynamicQuantities = () => [],
  updateSpec = () => { },
  onUpdateItem = () => { },
  currentEst = 0,
  liveSpecLine = "",
  // Colour-wise Breakdown Props
  isColourWise = false,
  isZinc = false,
  colourRows = [],
  availableColours = [],
  getPlatingSwatch = () => "#D4AF37",
  handleUpdateColourRow = () => { },
  handleRemoveColourRow = () => { },
  handleAddColour = () => { },
  handleSplitMedalLabel = () => { },
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
  const sizeCfg = productConfig?.size_config || {};
  const showQuantitiesToPriceRow = Boolean(sizeCfg.show_quantities_to_price);
  const masterDefaultBudget =
    sizeCfg.default_budget !== undefined &&
      sizeCfg.default_budget !== null &&
      Number(sizeCfg.default_budget) > 0
      ? Number(sizeCfg.default_budget)
      : 0;

  const effectiveEst = masterDefaultBudget || currentEst || 0;

  const masterDefaultDesignOptions =
    sizeCfg.default_design_options !== undefined &&
      sizeCfg.default_design_options !== null &&
      sizeCfg.default_design_options !== ""
      ? Number(sizeCfg.default_design_options)
      : 2;

  const activeDesignOptions =
    spec.designOptions !== undefined
      ? spec.designOptions
      : item.designOptions !== undefined
        ? item.designOptions
        : masterDefaultDesignOptions;

  const isTrophyProduct = productType === "trophy" || productType === "memento";

  // Check if this product follows the Modern 2-Column layout
  const isModern = Boolean(
    !isTrophyProduct &&
    (productConfig?.size_config?.layout === "two_column" ||
      sizeCfg.layout === "two_column" ||
      sizeCfg.has_colour_wise_qty ||
      sizeCfg.size_mode === "colour_wise_qty" ||
      sizeCfg.layout !== "classic")
  );

  const trophyPresetHeights = React.useMemo(() => {
    // 1. Dedicated sizes from props (sub-category specific preset sizes)
    const fromProps = typeof getDynamicSizes === "function" ? getDynamicSizes() : [];
    if (Array.isArray(fromProps) && fromProps.length > 0) {
      return fromProps.map((s) => {
        if (typeof s === "object" && s !== null) {
          return {
            label: s.label || `${s.value || s.id}"`,
            value: s.value !== undefined ? s.value : s.label,
            is_usual: Boolean(s.is_usual),
            rate: s.rate,
          };
        }
        return {
          label: `${s}"`,
          value: s,
          is_usual: String(s) === "8",
        };
      });
    }

    // 2. Master dimensions preset sizes (if configured under dimensions in Master)
    const dimHeightPresets = (productConfig?.size_config?.dimensions || [])
      .find((d) => d.key === "height" || d.label?.toLowerCase() === "height")
      ?.preset_sizes;
    if (Array.isArray(dimHeightPresets) && dimHeightPresets.length > 0) {
      return dimHeightPresets.map((s) => ({
        label: s.label || `${s.value}"`,
        value: s.value !== undefined ? s.value : s.label,
        is_usual: Boolean(s.is_usual),
      }));
    }

    const fromMaster = productConfig?.size_config?.preset_sizes;
    if (Array.isArray(fromMaster) && fromMaster.length > 0) {
      return fromMaster.map((s) => {
        if (typeof s === "object" && s !== null) {
          return {
            label: s.label || `${s.value}"`,
            value: s.value || s.label,
            is_usual: Boolean(s.is_usual),
            rate: s.rate,
          };
        }
        return {
          label: `${s}"`,
          value: s,
          is_usual: String(s) === "8",
        };
      });
    }
    return [];
  }, [getDynamicSizes, productConfig?.size_config?.preset_sizes, productConfig?.size_config?.dimensions]);

  const curSize = item.size || spec.size || "";
  const curUnit = spec.unit || unit || (String(curSize).includes("mm") ? "mm" : "in");
  const allowCustom = sizeCfg.allow_custom ?? true;

  // 1D Numeric Parsing & Unit conversion
  const parse1DVal = (val) => {
    if (!val) return "";
    const clean = String(val).replace(/in|mm|"|sq/g, "").trim();
    const parts = clean.split(/[×x]/).map((p) => p.trim());
    return parts[0] || "";
  };

  const raw1DVal = parse1DVal(curSize);

  // Purely dynamic custom dimensions configured in Product Config Master
  const dimensions = Array.isArray(sizeCfg.dimensions) && sizeCfg.dimensions.length > 0 ? sizeCfg.dimensions : null;

  // Helper to extract current dimension value from structured sizeDimensions array or spec
  const getDimensionValue = (dim, dIdx = -1, sourceSpec = spec) => {
    // 1. Look in structured sizeDimensions / dimensions array first
    const dimsArr = sourceSpec.sizeDimensions || item.sizeDimensions || sourceSpec.dimensions || item.dimensions;
    if (Array.isArray(dimsArr) && dimsArr.length > 0) {
      const found = dimsArr.find(
        (d) => d.key === dim.key || d.label?.toLowerCase() === dim.label?.toLowerCase()
      );
      if (found && found.value !== undefined && found.value !== "") {
        return String(found.value).replace(/in|mm|"|sq/g, "").trim();
      }
      if (dIdx >= 0 && dimsArr[dIdx]?.value !== undefined && dimsArr[dIdx]?.value !== "") {
        return String(dimsArr[dIdx].value).replace(/in|mm|"|sq/g, "").trim();
      }
    }

    // 2. Explicitly stored in spec under dimension key (fallback for backwards compatibility)
    if (sourceSpec[dim.key] !== undefined && sourceSpec[dim.key] !== "") {
      return String(sourceSpec[dim.key]).replace(/in|mm|"|sq/g, "").trim();
    }
    // 3. Legacy aliases
    if ((dim.key === "length" || dim.key === "len") && (sourceSpec.len || sourceSpec.customL)) {
      return String(sourceSpec.len || sourceSpec.customL).replace(/in|mm|"|sq/g, "").trim();
    }
    if ((dim.key === "breadth" || dim.key === "width" || dim.key === "wid") && (sourceSpec.wid || sourceSpec.customB || sourceSpec.trophyW)) {
      return String(sourceSpec.wid || sourceSpec.customB || sourceSpec.trophyW).replace(/in|mm|"|sq/g, "").trim();
    }
    if ((dim.key === "depth" || dim.key === "d") && sourceSpec.trophyD) {
      return String(sourceSpec.trophyD).replace(/in|mm|"|sq/g, "").trim();
    }
    if ((dim.key === "height" || dim.key === "h") && sourceSpec.trophyH) {
      return String(sourceSpec.trophyH).replace(/in|mm|"|sq/g, "").trim();
    }

    // Default fallback from dimension's configured preset_sizes
    const defaultPreset =
      dim.preset_sizes?.find((p) => p.is_usual)?.value ||
      dim.preset_sizes?.[0]?.value ||
      dim.default_value ||
      "";

    // 4. Positional extraction from curSize if curSize has "×"
    if (curSize && (String(curSize).includes("×") || String(curSize).includes("x"))) {
      const parts = String(curSize)
        .replace(/in|mm|"|sq/g, "")
        .trim()
        .split(/[×x]/)
        .map((p) => p.trim());
      const partVal = dIdx >= 0 ? parts[dIdx] : "";
      if (partVal) {
        return partVal;
      }
    }

    return String(defaultPreset).replace(/in|mm|"|sq/g, "").trim();
  };

  const trophyDimsArr = spec.sizeDimensions || item.sizeDimensions || [];
  const dimH = Array.isArray(trophyDimsArr) ? trophyDimsArr.find((d) => d.key === "height")?.value : "";
  const dimW = Array.isArray(trophyDimsArr) ? trophyDimsArr.find((d) => d.key === "width")?.value : "";
  const dimD = Array.isArray(trophyDimsArr) ? trophyDimsArr.find((d) => d.key === "depth")?.value : "";

  const currentTrophyH =
    spec.trophyH !== undefined && spec.trophyH !== null && spec.trophyH !== ""
      ? spec.trophyH
      : dimH !== undefined && dimH !== null && dimH !== ""
        ? dimH
        : (raw1DVal || "");

  const currentTrophyW =
    spec.trophyW !== undefined && spec.trophyW !== null && spec.trophyW !== ""
      ? spec.trophyW
      : dimW !== undefined && dimW !== null && dimW !== ""
        ? dimW
        : "";

  const currentTrophyD =
    spec.trophyD !== undefined && spec.trophyD !== null && spec.trophyD !== ""
      ? spec.trophyD
      : dimD !== undefined && dimD !== null && dimD !== ""
        ? dimD
        : "";

  const currentCleanHeight = String(currentTrophyH || raw1DVal || "").replace(/in|mm|"|sq/g, "").trim();
  const matchesPreset =
    trophyPresetHeights.length > 0 &&
    trophyPresetHeights.some(
      (p) => String(p.value || p.label).replace(/in|mm|"|sq/g, "").trim() === currentCleanHeight
    );
  const isTrophyCustom =
    trophyPresetHeights.length === 0 || isCustomSize || (Boolean(currentCleanHeight) && !matchesPreset);

  const buildTrophyDimensions = (hVal, wVal, dVal, u = curUnit, customOverride = null) => {
    const dims = [];
    if (hVal !== undefined && hVal !== null && hVal !== "") {
      const cleanH = String(hVal).replace(/in|mm|"|sq/g, "").trim();
      const isPreset =
        trophyPresetHeights.length > 0 &&
        trophyPresetHeights.some(
          (p) => String(p.value || p.label).replace(/in|mm|"|sq/g, "").trim() === cleanH
        );
      const isCustomH = customOverride !== null ? customOverride : (trophyPresetHeights.length === 0 || !isPreset);
      dims.push({
        key: "height",
        label: "Height",
        value: String(hVal),
        unit: u || "in",
        isCustom: isCustomH,
      });
    }
    if (wVal !== undefined && wVal !== null && wVal !== "") {
      dims.push({
        key: "width",
        label: "Width",
        value: String(wVal),
        unit: u || "in",
        isCustom: true,
      });
    }
    if (dVal !== undefined && dVal !== null && dVal !== "") {
      dims.push({
        key: "depth",
        label: "Depth",
        value: String(dVal),
        unit: u || "in",
        isCustom: true,
      });
    }
    return dims;
  };

  const handleSelectTrophyPreset = (presetVal) => {
    setIsCustomSize(false);
    const cleanNum = parseFloat(presetVal) || presetVal;
    const formatted = curUnit === "mm" ? `${cleanNum} mm` : `${cleanNum}"`;
    const nextDims = buildTrophyDimensions(cleanNum, currentTrophyW, currentTrophyD, curUnit, false);
    updateSpec(
      {
        trophyH: cleanNum,
        size: formatted,
        isCustomSize: false,
        sizeDimensions: nextDims,
      },
      {
        size: formatted,
        sizeDimensions: nextDims,
      }
    );
  };

  const handleSelectTrophyCustom = () => {
    setIsCustomSize(true);
    const currentVal = currentTrophyH || 8;
    const formatted = curUnit === "mm" ? `${currentVal} mm` : `${currentVal}"`;
    const nextDims = buildTrophyDimensions(currentVal, currentTrophyW, currentTrophyD, curUnit, true);
    updateSpec(
      {
        trophyH: currentVal,
        size: formatted,
        isCustomSize: true,
        sizeDimensions: nextDims,
      },
      {
        size: formatted,
        sizeDimensions: nextDims,
      }
    );
  };

  const handleCustomHeightInput = (e) => {
    const raw = e.target.value;
    const val = raw === "" ? "" : parseFloat(raw) || 0;
    const formatted = val === "" ? "" : curUnit === "mm" ? `${val} mm` : `${val}"`;
    const nextDims = buildTrophyDimensions(val, currentTrophyW, currentTrophyD, curUnit, true);
    updateSpec(
      {
        trophyH: val,
        size: formatted,
        isCustomSize: true,
        sizeDimensions: nextDims,
      },
      {
        size: formatted,
        sizeDimensions: nextDims,
      }
    );
  };

  // Helper to check if a dimension is custom
  const getDimensionIsCustom = (dim, dIdx = -1, sourceSpec = spec) => {
    const dimsArr = sourceSpec.sizeDimensions || item.sizeDimensions || sourceSpec.dimensions || item.dimensions;
    if (Array.isArray(dimsArr) && dimsArr.length > 0) {
      const found = dimsArr.find(
        (d) => d.key === dim.key || d.label?.toLowerCase() === dim.label?.toLowerCase()
      );
      if (found && found.isCustom !== undefined) {
        return Boolean(found.isCustom);
      }
      if (dIdx >= 0 && dimsArr[dIdx]?.isCustom !== undefined) {
        return Boolean(dimsArr[dIdx].isCustom);
      }
    }
    return Boolean(sourceSpec[`${dim.key}_isCustom`]);
  };

  // Synchronize initial sizeDimensions array on mount if not already populated
  React.useEffect(() => {
    if (isTrophyProduct) {
      const existingDims = item.sizeDimensions || spec.sizeDimensions || [];
      const hasW = existingDims.some((d) => d.key === "width");
      const hasD = existingDims.some((d) => d.key === "depth");
      const needsSync =
        existingDims.length === 0 ||
        (currentTrophyW !== "" && !hasW) ||
        (currentTrophyD !== "" && !hasD);
      if (needsSync) {
        const h = currentTrophyH || 8;
        const w = currentTrophyW;
        const d = currentTrophyD;
        const nextDims = buildTrophyDimensions(h, w, d, curUnit);
        const formatted = curUnit === "mm" ? `${h} mm` : `${h}"`;
        updateSpec(
          {
            trophyH: h,
            ...(w !== "" ? { trophyW: w } : {}),
            ...(d !== "" ? { trophyD: d } : {}),
            size: formatted,
            sizeDimensions: nextDims,
          },
          {
            size: formatted,
            sizeDimensions: nextDims,
          }
        );
      }
    } else if (dimensions && dimensions.length > 0 && (!item.sizeDimensions || item.sizeDimensions.length === 0)) {
      const initialDims = dimensions.map((dim, idx) => {
        const val = getDimensionValue(dim, idx);
        const isCust = getDimensionIsCustom(dim, idx);
        return {
          key: dim.key,
          label: dim.label,
          value: val,
          unit: curUnit || dim.unit || "in",
          isCustom: isCust,
        };
      });
      const anyCust = initialDims.some((d) => Boolean(d.isCustom));
      const comp = initialDims.map((d) => d.value).filter(Boolean).join("×");
      const formattedSize = curUnit === "mm" ? (comp ? `${comp} mm` : "") : comp;
      let initL = undefined;
      let initB = undefined;
      if (comp && (comp.includes("×") || comp.includes("x"))) {
        const parts = comp.split(/[×x]/);
        if (parts[0]) initL = parseFloat(parts[0]) || parts[0].trim();
        if (parts[1]) initB = parseFloat(parts[1]) || parts[1].trim();
      }
      const cleanSpec = {
        ...(item.spec || spec || {}),
        sizeDimensions: initialDims,
        size: formattedSize || item.size || spec.size,
        isCustomSize: anyCust,
        isCustom: anyCust,
        ...(initL !== undefined ? { len: initL } : {}),
        ...(initB !== undefined ? { wid: initB } : {}),
      };
      delete cleanSpec.dimensions;
      dimensions.forEach((d) => {
        delete cleanSpec[d.key];
        delete cleanSpec[`${d.key}_isCustom`];
      });
      updateSpec(cleanSpec, {
        sizeDimensions: initialDims,
        size: formattedSize || item.size || spec.size,
        isCustomSize: anyCust,
        isCustom: anyCust,
        ...(initL !== undefined ? { len: initL } : {}),
        ...(initB !== undefined ? { wid: initB } : {}),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimensions, isTrophyProduct]);

  // Format preset size label with active unit
  const formatPresetLabel = (sz, dim) => {
    const raw = String(sz.label || sz.value || sz).replace(/in|mm|"|sq/g, "").trim();
    const activeUnit = curUnit || spec.unit || unit || dim.unit || "in";
    if (activeUnit === "mm") {
      return `${raw} mm`;
    }
    return `${raw}"`;
  };

  // Unit Switcher Handler (Inches <-> mm)
  const handleSwitchUnit = (newUnit) => {
    if (typeof setUnit === "function") {
      setUnit(newUnit);
    }
    let newSize = curSize;
    let nextSizeDimensions = null;
    if (isTrophyProduct) {
      const h = currentTrophyH || 8;
      const w = currentTrophyW;
      const d = currentTrophyD;
      nextSizeDimensions = buildTrophyDimensions(h, w, d, newUnit);
      newSize = newUnit === "mm" ? `${h} mm` : `${h}"`;
    } else if (dimensions && dimensions.length > 0) {
      nextSizeDimensions = (dimensions || []).map((d, i) => ({
        key: d.key,
        label: d.label,
        value: getDimensionValue(d, i),
        unit: newUnit,
        isCustom: getDimensionIsCustom(d, i),
      }));
      const comp = nextSizeDimensions
        .map((d) => d.value)
        .filter(Boolean)
        .join("×");
      newSize = newUnit === "mm" ? (comp ? `${comp} mm` : "") : comp;
    } else if (sizeCfg.size_mode === "custom_2d") {
      const l = spec.len || spec.customL || 0;
      const b = spec.wid || spec.customB || 0;
      newSize = newUnit === "mm" ? `${l}×${b} mm` : `${l}×${b}`;
    } else {
      const cleanVal = parse1DVal(curSize);
      if (cleanVal) {
        newSize = newUnit === "mm" ? `${cleanVal} mm` : `${cleanVal}"`;
      }
    }
    const nextSpec = {
      ...(item.spec || spec || {}),
      unit: newUnit,
      size: newSize,
      ...(nextSizeDimensions ? { sizeDimensions: nextSizeDimensions } : {}),
    };
    delete nextSpec.dimensions;
    updateSpec(nextSpec, {
      size: newSize,
      unit: newUnit,
      ...(nextSizeDimensions ? { sizeDimensions: nextSizeDimensions } : {}),
    });
  };

  // Always Visible Unit Switcher component (Inches / mm)
  const renderUnitSwitcher = () => (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="text-xs text-gray-400 font-medium">Unit:</span>
      <div className="inline-flex items-center p-0.5 bg-gray-100 rounded-lg text-xs font-semibold">
        <button
          type="button"
          className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${curUnit !== "mm"
              ? "bg-[#4B3BF5] text-white shadow-2xs"
              : "text-gray-600 hover:text-gray-900"
            }`}
          onClick={() => handleSwitchUnit("in")}
        >
          Inches
        </button>
        <button
          type="button"
          className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${curUnit === "mm"
              ? "bg-[#4B3BF5] text-white shadow-2xs"
              : "text-gray-600 hover:text-gray-900"
            }`}
          onClick={() => handleSwitchUnit("mm")}
        >
          mm
        </button>
      </div>
    </div>
  );

  // Handle Multi-Dimension Selection & Updates
  const handleDimensionChange = (dimKey, value, isCustom = false) => {
    const cleanVal = String(value ?? "").replace(/in|mm|"|sq/g, "").trim();
    const activeUnit = curUnit || spec.unit || unit || "in";

    const updatedDimensions = (dimensions || []).map((dim, idx) => {
      const isThis = dim.key === dimKey;
      const val = isThis ? cleanVal : getDimensionValue(dim, idx);
      const isCust = isThis ? isCustom : getDimensionIsCustom(dim, idx);
      return {
        key: dim.key,
        label: dim.label,
        value: val,
        unit: activeUnit,
        isCustom: isCust,
      };
    });

    const anyCustom = updatedDimensions.some((d) => Boolean(d.isCustom));
    if (!anyCustom && typeof setIsCustomSize === "function") {
      setIsCustomSize(false);
    } else if (anyCustom && typeof setIsCustomSize === "function") {
      setIsCustomSize(true);
    }

    const compParts = updatedDimensions.map((d) => d.value).filter((p) => p !== undefined && p !== "");
    const compositeSize =
      activeUnit === "mm"
        ? `${compParts.join("×")} mm`
        : compParts.join("×");

    let lenVal = undefined;
    let widVal = undefined;
    if (compositeSize && (compositeSize.includes("×") || compositeSize.includes("x"))) {
      const parts = compositeSize.replace(/in|mm|"|sq/g, "").split(/[×x]/);
      if (parts[0]) lenVal = parseFloat(parts[0]) || parts[0].trim();
      if (parts[1]) widVal = parseFloat(parts[1]) || parts[1].trim();
    }

    const nextSpec = {
      ...(item.spec || spec || {}),
      sizeDimensions: updatedDimensions,
      size: compositeSize,
      isCustomSize: anyCustom,
      isCustom: anyCustom,
      ...(lenVal !== undefined ? { len: lenVal } : {}),
      ...(widVal !== undefined ? { wid: widVal } : {}),
    };
    delete nextSpec.dimensions;

    // Clean up loose dimension keys and *_isCustom keys so they do NOT clutter spec
    (dimensions || []).forEach((d) => {
      delete nextSpec[d.key];
      delete nextSpec[`${d.key}_isCustom`];
    });

    if (item.budget !== undefined) {
      nextSpec.budget = item.budget;
    }

    updateSpec(nextSpec, {
      size: compositeSize,
      sizeDimensions: updatedDimensions,
      budget: item.budget,
      isCustomSize: anyCustom,
      isCustom: anyCustom,
      ...(lenVal !== undefined ? { len: lenVal } : {}),
      ...(widVal !== undefined ? { wid: widVal } : {}),
    });
  };

  const calcDisplay1D = (() => {
    const n = parseFloat(raw1DVal);
    if (isNaN(n) || n <= 0) return null;
    if (curUnit === "in") {
      const mm = Math.round(n * 25.4);
      return `= ${raw1DVal}" · ${mm} mm`;
    } else {
      const inVal = (n / 25.4).toFixed(1).replace(/\.0$/, "");
      return `= ${inVal}" · ${raw1DVal} mm`;
    }
  })();

  // 2D Frame calculation (Dynamically computed from user selected dimensions)
  const frameCalc = (() => {
    if (productType !== "frame") return null;
    let L = parseFloat(spec.len || spec.customL) || 0;
    let B = parseFloat(spec.wid || spec.customB) || 0;
    if ((!L || !B) && typeof curSize === "string" && (curSize.includes("×") || curSize.includes("x"))) {
      const parts = curSize.split(/[×x]/);
      L = parseFloat(parts[0]) || 0;
      B = parseFloat(parts[1]) || 0;
    }
    if (!L || !B) return null;
    const mWidth = parseFloat(spec.mWidth ?? group.designSpec?.mWidth ?? 1);
    const mount = spec.mount || group.designSpec?.mount || "None";
    const mountBorder = mount && mount !== "None" ? 1.5 : 0;
    const outerL = Number((L + 2 * mountBorder + 2 * mWidth).toFixed(1));
    const outerB = Number((B + 2 * mountBorder + 2 * mWidth).toFixed(1));
    const rl = Math.round(2 * (outerL + outerB));
    const ft = (rl / 12).toFixed(1);
    return { outerL, outerB, rl, ft };
  })();

  const showColourBreakdown = Boolean(
    isColourWise ||
    sizeCfg.has_colour_wise_qty ||
    sizeCfg.size_mode === "colour_wise_qty"
  );

  const handleModernBudgetChange = (val) => {
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

    if (!isTrophyProduct) {
      delete nextSpec.trophyW;
      delete nextSpec.trophyD;
      delete nextSpec.trophyH;
    }

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

  const handleModernQtyUpdate = (newQty) => {
    const nextSpec = { ...(item.spec || spec || {}) };
    const nextItem = { ...item, qty: newQty, spec: nextSpec };
    if (!isTrophyProduct) {
      delete nextSpec.trophyW;
      delete nextSpec.trophyD;
      delete nextSpec.trophyH;
    }

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

  // ─────────────────────────────────────────────────────────────
  // 1. MODERN 2-COLUMN LAYOUT (Coaster, Frame, Badge, Lapel Pin, Cufflinks, Tie Pin, etc.)
  // ─────────────────────────────────────────────────────────────
  if (isModern) {
    const modernTitle = sizeCfg.size_row_title || "Product Dimensions";
    const modernSubtitle = sizeCfg.size_row_subtitle || "";

    return (
      <div className="space-y-4">
        {/* ROW 1: SIZE / MULTI-DIMENSIONS (Rendered strictly when dimensions are configured in Master) */}
        {dimensions && dimensions.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div>
                <div className="font-bold text-xs text-gray-900">{modernTitle}</div>
                <div className="text-[11px] text-gray-400">{modernSubtitle}</div>
              </div>
              {renderUnitSwitcher()}
            </div>

            {dimensions.map((dim, dIdx) => {
              const currentVal = getDimensionValue(dim, dIdx);
              const matchesAnyPreset = (dim.preset_sizes || []).some(
                (sz) => String(sz.value || sz.label || sz).replace(/in|mm|"|sq/g, "").trim() === String(currentVal).trim()
              );
              const isCustomDim = getDimensionIsCustom(dim, dIdx) || (!matchesAnyPreset && Boolean(currentVal));

              return (
                <div
                  key={dim.key || dIdx}
                  className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-gray-100"
                >
                  <div className="w-52 shrink-0 pt-1">
                    <div className="font-bold text-xs text-gray-900">{dim.label}</div>
                    <div className="text-[11px] text-gray-400">
                      Preset {dim.label.toLowerCase()} in {curUnit || dim.unit || "in"}
                    </div>
                  </div>

                  <div className="flex-1 space-y-2.5">
                    <div className="flex gap-2 flex-wrap items-center">
                      {(dim.preset_sizes || []).map((sz, pIdx) => {
                        const cleanVal = String(sz.value || sz.label || sz).replace(/in|mm|"|sq/g, "").trim();
                        const isSel =
                          !isCustomDim &&
                          String(currentVal).trim() === cleanVal;

                        return (
                          <button
                            key={pIdx}
                            type="button"
                            className={`px-4 py-1.5 rounded-full text-xs transition cursor-pointer flex items-center gap-1.5 ${isSel
                                ? "bg-[#4B3BF5] text-white border-2 border-[#4B3BF5] shadow-xs font-bold"
                                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 font-semibold"
                              }`}
                            onClick={() => handleDimensionChange(dim.key, cleanVal, false)}
                          >
                            <span>{formatPresetLabel(sz, dim)}</span>
                            {sz.is_usual && (
                              <span
                                className={`text-[10px] ${isSel ? "text-purple-200" : "text-gray-400"
                                  } font-normal`}
                              >
                                usual
                              </span>
                            )}
                          </button>
                        );
                      })}

                      {dim.allow_custom !== false && (
                        <button
                          type="button"
                          className={`px-4 py-1.5 rounded-full text-xs transition cursor-pointer ${isCustomDim
                              ? "bg-[#4B3BF5] text-white border-2 border-[#4B3BF5] shadow-xs font-bold"
                              : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 font-semibold"
                            }`}
                          onClick={() => handleDimensionChange(dim.key, currentVal, true)}
                        >
                          Custom
                        </button>
                      )}
                    </div>

                    {isCustomDim && (
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          placeholder={`Enter ${dim.label.toLowerCase()}`}
                          className="w-28 px-3 py-1.5 border border-purple-200 rounded-xl text-xs font-bold text-gray-900 bg-white outline-none focus:border-[#4B3BF5] focus:ring-2 focus:ring-[#4B3BF5]/20 shadow-2xs"
                          value={currentVal || ""}
                          onChange={(e) => handleDimensionChange(dim.key, e.target.value, true)}
                        />
                        <span className="text-xs font-semibold text-gray-500">{curUnit || dim.unit || "in"}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* COLOUR BREAKDOWN TABLE (For Badge, Lapel Pin, Medal, and colour_wise_qty) */}
        {showColourBreakdown && (
          <ColourBreakdownSection
            productType={productType}
            spec={spec}
            item={item}
            isZinc={isZinc}
            colourRows={colourRows}
            availableColours={availableColours}
            getPlatingSwatch={getPlatingSwatch}
            handleUpdateColourRow={handleUpdateColourRow}
            handleRemoveColourRow={handleRemoveColourRow}
            handleAddColour={handleAddColour}
            handleSplitMedalLabel={handleSplitMedalLabel}
            updateSpec={updateSpec}
            showCustomColorPicker={showCustomColorPicker}
            setShowCustomColorPicker={setShowCustomColorPicker}
            customColorName={customColorName}
            setCustomColorName={setCustomColorName}
            customHex={customHex}
            setCustomHex={setCustomHex}
            handleSaveCustomColor={handleSaveCustomColor}
            customFinishes={customFinishes}
            showManageCustomFinishes={showManageCustomFinishes}
            setShowManageCustomFinishes={setShowManageCustomFinishes}
            handleRemoveSavedCustomFinish={handleRemoveSavedCustomFinish}
          />
        )}

        {/* ROW 2: QUANTITIES TO PRICE */}
        {showQuantitiesToPriceRow && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
            <div className="w-52 shrink-0">
              <div className="font-bold text-xs text-gray-900">
                {sizeCfg.qty_title ||
                  (sizeCfg.uom === "pair"
                    ? "Quantities to price (pairs)"
                    : sizeCfg.uom && sizeCfg.uom !== "piece"
                      ? `Quantities to price (${sizeCfg.uom}s)`
                      : "Quantities to price")}
              </div>
              <div className="text-[11px] text-gray-400">
                {sizeCfg.qty_subtitle ||
                  (sizeCfg.uom === "pair"
                    ? "Enter in pairs (pieces = pairs × 2)"
                    : showColourBreakdown && colourRows.length > 0
                      ? "Total sum from colour breakdown above"
                      : "Add one or more")}
              </div>
            </div>
            <div className="flex-1 flex items-center gap-2 flex-wrap">
              <input
                type="number"
                placeholder="Qty"
                disabled={showColourBreakdown && colourRows.length > 0}
                className={`w-24 border border-gray-300 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-gray-900 bg-white outline-none focus:border-[#4B3BF5] focus:ring-2 focus:ring-[#4B3BF5]/20 shadow-2xs ${showColourBreakdown && colourRows.length > 0 ? "bg-gray-100 cursor-not-allowed" : "bg-white"
                  }`}
                value={item.qty || ""}
                onFocus={(e) => e.target.select()}
                onChange={(ev) => {
                  const raw = ev.target.value;
                  const val = raw === "" ? "" : parseInt(raw) || 0;
                  handleModernQtyUpdate(val);
                }}
              />
              {(!showColourBreakdown || colourRows.length === 0) &&
                getDynamicQuantities().map((presetQty) => (
                  <button
                    key={presetQty}
                    type="button"
                    className={`px-3 py-1 text-xs font-semibold rounded-full border border-dashed transition cursor-pointer ${item.qty === presetQty
                        ? "bg-[#4B3BF5] text-white border-[#4B3BF5] shadow-xs"
                        : "bg-white border-gray-300 text-gray-700 hover:border-indigo-400 hover:text-indigo-600"
                      }`}
                    onClick={() => handleModernQtyUpdate(presetQty)}
                  >
                    {presetQty}
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* ROW 3: APPROX. RATE PER PIECE */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-gray-100">
          <div className="w-52 shrink-0">
            <div className="font-bold text-xs text-gray-900">
              {sizeCfg.rate_title ||
                (sizeCfg.uom
                  ? `Approx. rate per ${sizeCfg.uom}`
                  : "Approx. rate per piece")}
            </div>
            <div className="text-[11px] text-gray-400">
              {sizeCfg.budget_subtitle || "What the client expects"}
            </div>
          </div>

          <div className="flex-1 space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 font-bold text-xs">₹</span>
              <input
                type="number"
                placeholder={effectiveEst > 0 ? `e.g. ${effectiveEst}` : "0"}
                className="w-52 px-3.5 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 bg-white outline-none focus:border-[#4B3BF5] focus:ring-2 focus:ring-[#4B3BF5]/20 transition"
                value={item.budget ? item.budget : (item.budget === 0 || item.budget === "" ? "" : (item.budget ?? ""))}
                onFocus={(e) => e.target.select()}
                onChange={(ev) => {
                  const raw = ev.target.value;
                  const val = raw === "" ? "" : parseFloat(raw) || 0;
                  handleModernBudgetChange(val);
                }}
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap pt-0.5">
              {effectiveEst > 0 && (
                <button
                  type="button"
                  className="px-4 py-1.5 rounded-full border border-gray-200 text-xs text-gray-700 hover:bg-gray-50 transition cursor-pointer flex items-center"
                  onClick={() => handleModernBudgetChange(effectiveEst)}
                >
                  <span className="font-medium">
                    Use our estimate · ₹{effectiveEst}
                  </span>
                  <span className="text-gray-400 font-normal ml-1.5">indicative</span>
                </button>
              )}
              <button
                type="button"
                className="px-4 py-1.5 rounded-full border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                onClick={() => handleModernBudgetChange(0)}
              >
                Client hasn't said
              </button>
            </div>
          </div>
        </div>

        {/* ROW 4: DESIGN OPTIONS STEPPER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <div className="w-52 shrink-0">
            <div className="font-bold text-xs text-gray-900">Design options</div>
            <div className="text-[11px] text-gray-400">For this size</div>
          </div>

          <div className="flex-1 flex items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
              <button
                type="button"
                disabled={activeDesignOptions <= 1}
                className="w-7 h-7 bg-white rounded-lg border border-gray-200 font-bold text-gray-700 flex items-center justify-center hover:bg-gray-50 active:scale-95 cursor-pointer shadow-2xs disabled:opacity-30"
                onClick={() =>
                  updateSpec(
                    { designOptions: Math.max(1, activeDesignOptions - 1) },
                    { designOptions: Math.max(1, activeDesignOptions - 1), designOptionsCount: Math.max(1, activeDesignOptions - 1) }
                  )
                }
              >
                −
              </button>
              <span className="font-bold text-xs text-gray-900 min-w-4 text-center">
                {activeDesignOptions}
              </span>
              <button
                type="button"
                disabled={activeDesignOptions >= 6}
                className="w-7 h-7 bg-white rounded-lg border border-gray-200 font-bold text-gray-700 flex items-center justify-center hover:bg-gray-50 active:scale-95 cursor-pointer shadow-2xs disabled:opacity-30"
                onClick={() =>
                  updateSpec(
                    { designOptions: Math.min(6, activeDesignOptions + 1) },
                    { designOptions: Math.min(6, activeDesignOptions + 1), designOptionsCount: Math.min(6, activeDesignOptions + 1) }
                  )
                }
              >
                +
              </button>
            </div>
            <span className="text-xs text-gray-500 font-normal">options to show the client</span>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. CLASSIC FULL-WIDTH LAYOUT (Trophy, Memento, Plaque)
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* SECTION A: PRODUCT SIZE ROW / MULTI-DIMENSIONS */}
      {isTrophyProduct ? (
        <div className="space-y-2 pb-2 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-xs text-gray-900">
                {sizeCfg.size_row_title || (trophyPresetHeights.length > 0 ? "Trophy Height" : "Trophy Dimensions")}
              </div>
              <div className="text-[11px] text-gray-400">
                {sizeCfg.size_row_subtitle ||
                  (trophyPresetHeights.length > 0
                    ? `Main vertical dimension in ${curUnit === "mm" ? "mm" : "inches"}`
                    : `Enter dimensions in ${curUnit === "mm" ? "mm" : "inches"}`)}
              </div>
            </div>
            {/* Always Visible Unit Switcher */}
            {renderUnitSwitcher()}
          </div>

          {trophyPresetHeights && trophyPresetHeights.length > 0 ? (
            /* Presets configured in Master -> Render Preset pills + Custom */
            <div className="space-y-2 pt-1">
              <div className="flex gap-2 flex-wrap items-center">
                {trophyPresetHeights.map((preset, pIdx) => {
                  const cleanPresetVal = String(preset.value || preset.label).replace(/in|mm|"|sq/g, "").trim();
                  const isSelected = !isTrophyCustom && currentCleanHeight === cleanPresetVal;

                  return (
                    <button
                      key={pIdx}
                      type="button"
                      className={`px-4 py-1.5 rounded-full text-xs transition cursor-pointer flex items-center gap-1.5 ${isSelected
                          ? "bg-[#4B3BF5] text-white border-2 border-[#4B3BF5] shadow-xs font-bold"
                          : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 font-semibold"
                        }`}
                      onClick={() => handleSelectTrophyPreset(cleanPresetVal)}
                    >
                      <span>{curUnit === "mm" ? `${cleanPresetVal} mm` : `${cleanPresetVal}"`}</span>
                      {preset.is_usual && (
                        <span className={`text-[10px] ${isSelected ? "text-purple-200" : "text-gray-400"} font-normal`}>
                          usual
                        </span>
                      )}
                    </button>
                  );
                })}

                <button
                  type="button"
                  className={`px-4 py-1.5 rounded-full text-xs transition cursor-pointer ${isTrophyCustom
                      ? "bg-[#4B3BF5] text-white border-2 border-[#4B3BF5] shadow-xs font-bold"
                      : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 font-semibold"
                    }`}
                  onClick={handleSelectTrophyCustom}
                >
                  Custom
                </button>
              </div>

              {/* Custom Height Input (Visible when Custom is chosen) */}
              {isTrophyCustom && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs font-semibold text-gray-600">Custom height:</span>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 18"
                    className="w-28 px-3 py-1.5 border border-purple-200 rounded-xl text-xs bg-white font-bold outline-none focus:border-[#4B3BF5] focus:ring-2 focus:ring-[#4B3BF5]/20 shadow-2xs"
                    value={currentTrophyH}
                    onFocus={(e) => e.target.select()}
                    onChange={handleCustomHeightInput}
                  />
                  <span className="text-xs font-semibold text-gray-500">{curUnit === "mm" ? "mm" : "inches"}</span>
                </div>
              )}

              {/* Width & Depth (2-Column Grid) */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">
                    Width (W in {curUnit === "mm" ? "mm" : "inches"})
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 4"
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-xs bg-white font-bold outline-none focus:border-[#4B3BF5] focus:ring-2 focus:ring-[#4B3BF5]/20 shadow-2xs"
                    value={currentTrophyW}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const val = raw === "" ? "" : parseFloat(raw) || 0;
                      const nextDims = buildTrophyDimensions(currentTrophyH, val, currentTrophyD, curUnit);
                      updateSpec(
                        { trophyW: val, sizeDimensions: nextDims },
                        { sizeDimensions: nextDims }
                      );
                    }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">
                    Depth (D in {curUnit === "mm" ? "mm" : "inches"})
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 3"
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-xs bg-white font-bold outline-none focus:border-[#4B3BF5] focus:ring-2 focus:ring-[#4B3BF5]/20 shadow-2xs"
                    value={currentTrophyD}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const val = raw === "" ? "" : parseFloat(raw) || 0;
                      const nextDims = buildTrophyDimensions(currentTrophyH, currentTrophyW, val, curUnit);
                      updateSpec(
                        { trophyD: val, sizeDimensions: nextDims },
                        { sizeDimensions: nextDims }
                      );
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Master has NO presets -> Clean 3-Column Input Fields (Height, Width, Depth) */
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">
                  Height (H in {curUnit === "mm" ? "mm" : "inches"})
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 8"
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-xs bg-white font-bold outline-none focus:border-[#4B3BF5] focus:ring-2 focus:ring-[#4B3BF5]/20 shadow-2xs"
                  value={currentTrophyH}
                  onFocus={(e) => e.target.select()}
                  onChange={handleCustomHeightInput}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">
                  Width (W in {curUnit === "mm" ? "mm" : "inches"})
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 4"
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-xs bg-white font-bold outline-none focus:border-[#4B3BF5] focus:ring-2 focus:ring-[#4B3BF5]/20 shadow-2xs"
                  value={currentTrophyW}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const val = raw === "" ? "" : parseFloat(raw) || 0;
                    const nextDims = buildTrophyDimensions(currentTrophyH, val, currentTrophyD, curUnit);
                    updateSpec(
                      { trophyW: val, sizeDimensions: nextDims },
                      { sizeDimensions: nextDims }
                    );
                  }}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">
                  Depth (D in {curUnit === "mm" ? "mm" : "inches"})
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 3"
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-xs bg-white font-bold outline-none focus:border-[#4B3BF5] focus:ring-2 focus:ring-[#4B3BF5]/20 shadow-2xs"
                  value={currentTrophyD}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const val = raw === "" ? "" : parseFloat(raw) || 0;
                    const nextDims = buildTrophyDimensions(currentTrophyH, currentTrophyW, val, curUnit);
                    updateSpec(
                      { trophyD: val, sizeDimensions: nextDims },
                      { sizeDimensions: nextDims }
                    );
                  }}
                />
              </div>
            </div>
          )}
        </div>
      ) : dimensions && dimensions.length > 0 ? (
        <div className="space-y-3 pb-2 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-xs text-gray-900">
                {sizeCfg.size_row_title || "Product Dimensions"}
              </div>
              <div className="text-[11px] text-gray-400">
                {sizeCfg.size_row_subtitle || "Select standard preset sizes or enter custom dimensions"}
              </div>
            </div>
            {/* Always Visible Unit Switcher */}
            {renderUnitSwitcher()}
          </div>

          {dimensions.map((dim, dIdx) => {
            const currentVal = getDimensionValue(dim, dIdx);
            const matchesAnyPreset = (dim.preset_sizes || []).some(
              (sz) => String(sz.value || sz.label || sz).replace(/in|mm|"|sq/g, "").trim() === String(currentVal).trim()
            );
            const isCustomDim = getDimensionIsCustom(dim, dIdx) || (!matchesAnyPreset && Boolean(currentVal));

            return (
              <div key={dim.key || dIdx} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-gray-800">
                    {dim.label} <span className="text-[11px] font-normal text-gray-400">({curUnit || dim.unit || "in"})</span>
                  </span>
                </div>

                <div className="flex gap-2 flex-wrap text-xs">
                  {(dim.preset_sizes || []).map((sz, pIdx) => {
                    const cleanVal = String(sz.value || sz.label || sz).replace(/in|mm|"|sq/g, "").trim();
                    const isSel =
                      !isCustomDim &&
                      String(currentVal).trim() === cleanVal;

                    return (
                      <button
                        key={pIdx}
                        type="button"
                        className={`px-3.5 py-1.5 rounded-full border text-xs font-semibold transition cursor-pointer ${isSel
                            ? "bg-[#4B3BF5] text-white border-[#4B3BF5] font-bold shadow-xs"
                            : "bg-white border-gray-300 text-gray-700 hover:border-indigo-400 hover:bg-gray-50"
                          }`}
                        onClick={() => handleDimensionChange(dim.key, cleanVal, false)}
                      >
                        <span>{formatPresetLabel(sz, dim)}</span>
                        {sz.is_usual && (
                          <span
                            className={`text-[10px] ml-1.5 ${isSel ? "text-purple-200" : "text-gray-400"
                              } font-normal`}
                          >
                            usual
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {dim.allow_custom !== false && (
                    <button
                      type="button"
                      className={`px-3.5 py-1.5 rounded-full border text-xs font-semibold transition cursor-pointer ${isCustomDim
                          ? "bg-[#4B3BF5] text-white border-[#4B3BF5] font-bold shadow-xs"
                          : "bg-white border-gray-300 text-gray-700 hover:border-indigo-400 hover:bg-gray-50"
                        }`}
                      onClick={() => handleDimensionChange(dim.key, currentVal, true)}
                    >
                      Custom
                    </button>
                  )}
                </div>

                {isCustomDim && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs font-semibold text-gray-600">Custom {dim.label.toLowerCase()}:</span>
                    <input
                      type="text"
                      placeholder={`Enter ${dim.label.toLowerCase()}`}
                      className="w-28 px-3 py-1.5 border border-purple-200 rounded-xl text-xs bg-white font-bold text-center outline-none focus:border-[#4B3BF5] focus:ring-2 focus:ring-[#4B3BF5]/20 shadow-2xs"
                      value={currentVal || ""}
                      onChange={(e) => handleDimensionChange(dim.key, e.target.value, true)}
                    />
                    <span className="text-xs text-gray-500 font-semibold">{curUnit || dim.unit || "in"}</span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Optional Width and Depth for Box calculation (Non-trophy products with has_box_dimensions) */}
          {sizeCfg.has_box_dimensions && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">
                  Width (W in {curUnit === "mm" ? "mm" : "inches"})
                </label>
                <input
                  type="number"
                  placeholder="e.g. 4"
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-xs bg-white font-bold"
                  value={spec.trophyW !== undefined && spec.trophyW !== null ? spec.trophyW : ""}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const val = raw === "" ? "" : parseFloat(raw) || 0;
                    updateSpec({ trophyW: val });
                  }}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">
                  Depth (D in {curUnit === "mm" ? "mm" : "inches"})
                </label>
                <input
                  type="number"
                  placeholder="e.g. 3"
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-xs bg-white font-bold"
                  value={spec.trophyD !== undefined && spec.trophyD !== null ? spec.trophyD : ""}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const val = raw === "" ? "" : parseFloat(raw) || 0;
                    updateSpec({ trophyD: val });
                  }}
                />
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* COLOUR BREAKDOWN TABLE (For Badge, Lapel Pin, Medal, and colour_wise_qty in Classic Layout) */}
      {showColourBreakdown && (
        <ColourBreakdownSection
          productType={productType}
          spec={spec}
          item={item}
          isZinc={isZinc}
          colourRows={colourRows}
          availableColours={availableColours}
          getPlatingSwatch={getPlatingSwatch}
          handleUpdateColourRow={handleUpdateColourRow}
          handleRemoveColourRow={handleRemoveColourRow}
          handleAddColour={handleAddColour}
          handleSplitMedalLabel={handleSplitMedalLabel}
          updateSpec={updateSpec}
          showCustomColorPicker={showCustomColorPicker}
          setShowCustomColorPicker={setShowCustomColorPicker}
          customColorName={customColorName}
          setCustomColorName={setCustomColorName}
          customHex={customHex}
          setCustomHex={setCustomHex}
          handleSaveCustomColor={handleSaveCustomColor}
          customFinishes={customFinishes}
          showManageCustomFinishes={showManageCustomFinishes}
          setShowManageCustomFinishes={setShowManageCustomFinishes}
          handleRemoveSavedCustomFinish={handleRemoveSavedCustomFinish}
        />
      )}

      {/* SECTION B: COMMON PRICE SECTION */}
      <ClassicBottomPricingSection
        item={item}
        spec={spec}
        showColourBreakdown={showColourBreakdown}
        colourRows={colourRows}
        getDynamicQuantities={getDynamicQuantities}
        onUpdateItem={onUpdateItem}
        effectiveEst={effectiveEst}
        activeDesignOptions={activeDesignOptions}
        updateSpec={updateSpec}
        showQuantitiesToPrice={showQuantitiesToPriceRow}
      />
    </div>
  );
};

export default DynamicProductSizeCard;

