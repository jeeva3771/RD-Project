import React, { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import { fetchActivePlatingFinishes } from "../../../../reducer/masters/enquiryFlow/platingFinishMasterReducer";

const DEFAULT_STANDARD_FINISHES = [
  { name: "Shiny gold", swatch: "#D4AF37" },
  { name: "Silver", swatch: "#C0C0C0" },
  { name: "Antique copper", swatch: "#8B4513" },
  { name: "Antique bronze", swatch: "#CD7F32" },
  { name: "Matte gold", swatch: "#CDB067" },
  { name: "Black nickel", swatch: "#2B2D2F" },
  { name: "Rainbow", swatch: "linear-gradient(135deg, #FF6B6B, #4ECDC4, #45B649, #9B59B6)" },
  { name: "Gunmetal", swatch: "#535A61" },
  { name: "Antique Silver", swatch: "#8A9BA8" },
  { name: "Rose Gold", swatch: "#B76E79" },
];

const STANDARD_DIMENSION_PRESETS = [
  { label: "Height", key: "height", unit: "in", placeholder: 'e.g. 6", 8", 10", 12"' },
  { label: "Length", key: "length", unit: "in", placeholder: 'e.g. 8", 10", 12", 15"' },
  { label: "Width", key: "width", unit: "in", placeholder: 'e.g. 4", 5", 6", 8"' },
  { label: "Thickness", key: "thickness", unit: "mm", placeholder: "e.g. 3 mm, 5 mm, 8 mm" },
  { label: "Diameter", key: "diameter", unit: "in", placeholder: 'e.g. 2", 2.5", 3"' },
  { label: "Breadth", key: "breadth", unit: "in", placeholder: 'e.g. 4", 6", 8"' },
];

const UNIT_OPTIONS = [
  { value: "in", label: "Inches (in)" },
  { value: "mm", label: "Millimeters (mm)" },
];

const ProductConfigSizeTab = ({ formData, setFormData }) => {
  const hasSubTypes = Boolean(formData?.has_sub_types && (formData?.sub_types || []).length > 0);
  const [activeSubFilter, setActiveSubFilter] = useState(() => {
    if (hasSubTypes) {
      return formData.sub_types[0]?.sub_id || null;
    }
    return null;
  });

  useEffect(() => {
    if (hasSubTypes) {
      if (!activeSubFilter || !formData.sub_types.some((s) => s.sub_id === activeSubFilter)) {
        setActiveSubFilter(formData.sub_types[0]?.sub_id || null);
      }
    } else {
      setActiveSubFilter(null);
    }
  }, [hasSubTypes, formData?.sub_types, activeSubFilter]);

  // Active sub-type object if viewing a specific sub-type
  const activeSub = hasSubTypes
    ? (formData.sub_types || []).find((s) => s.sub_id === activeSubFilter) || formData.sub_types[0]
    : null;

  // Active size configuration (reads from active sub-type or category default)
  const activeSizeConfig = React.useMemo(() => {
    if (!activeSub) return formData.size_config || {};
    if (activeSub.size_config && Object.keys(activeSub.size_config).length > 0) {
      return activeSub.size_config;
    }
    // Fallback: inherit from category default size_config
    return formData.size_config || {};
  }, [activeSub, formData.size_config]);

  const dimensions = activeSizeConfig.dimensions || [];

  const dispatch = useDispatch();
  const { activeItems: masterFinishes = [] } = useSelector(
    (state) => state.platingFinishMaster || {}
  );

  useEffect(() => {
    if (!masterFinishes || masterFinishes.length === 0) {
      dispatch(fetchActivePlatingFinishes());
    }
  }, [dispatch, masterFinishes]);

  // Combine standard finishes with any custom added colours
  const allFinishOptions = useMemo(() => {
    const list = [];
    const seen = new Set();

    (masterFinishes || []).forEach((f) => {
      if (f && f.name && !seen.has(f.name.toLowerCase())) {
        seen.add(f.name.toLowerCase());
        list.push({
          name: f.name,
          swatch: f.swatch_color || f.color || f.hex || "#D4AF37",
        });
      }
    });

    DEFAULT_STANDARD_FINISHES.forEach((df) => {
      if (!seen.has(df.name.toLowerCase())) {
        seen.add(df.name.toLowerCase());
        list.push(df);
      }
    });

    (activeSizeConfig.available_colours || []).forEach((cName) => {
      if (cName && !seen.has(cName.toLowerCase())) {
        seen.add(cName.toLowerCase());
        const customHex = activeSizeConfig.colour_swatches?.[cName] || "#B08D57";
        list.push({ name: cName, swatch: customHex });
      }
    });

    return list;
  }, [masterFinishes, activeSizeConfig.available_colours, activeSizeConfig.colour_swatches]);

  // Local state for quick adding preset sizes per dimension
  const [quickSizeInputs, setQuickSizeInputs] = useState({});

  // Local state for preset quantities text input
  const [presetQtyText, setPresetQtyText] = useState(null);

  useEffect(() => {
    setPresetQtyText(null);
  }, [formData.product_id, formData._id, activeSubFilter]);

  // Unified Mutator: updates Category Default OR active Sub-Type with exact same structure
  const updateActiveSizeConfig = (updater) => {
    setFormData((prev) => {
      if (!activeSub) {
        // 1. Updating Category Default / All
        const curCfg = prev.size_config || {};
        const nextCfg = typeof updater === "function" ? updater(curCfg) : { ...curCfg, ...updater };
        if (nextCfg.show_quantities_to_price === false) {
          nextCfg.preset_quantities = [];
        }
        return { ...prev, size_config: nextCfg };
      }

      // 2. Updating specific Sub-Type
      const nextSubs = (prev.sub_types || []).map((sub) => {
        if (sub.sub_id !== activeSubFilter) return sub;
        const curCfg = (sub.size_config && Object.keys(sub.size_config).length > 0)
          ? sub.size_config
          : JSON.parse(JSON.stringify(prev.size_config || {}));
        const nextCfg = typeof updater === "function" ? updater(curCfg) : { ...curCfg, ...updater };

        const showQtys = nextCfg.show_quantities_to_price !== undefined
          ? Boolean(nextCfg.show_quantities_to_price)
          : (sub.show_quantities_to_price ?? true);

        const cleanPresetQtys = showQtys === false
          ? []
          : (nextCfg.preset_quantities !== undefined ? nextCfg.preset_quantities : (sub.preset_quantities || []));

        nextCfg.show_quantities_to_price = showQtys;
        nextCfg.preset_quantities = cleanPresetQtys;

        return {
          ...sub,
          size_config: nextCfg,
          default_budget: nextCfg.default_budget !== undefined ? nextCfg.default_budget : sub.default_budget,
          has_colour_wise_qty: Boolean(nextCfg.has_colour_wise_qty),
          show_quantities_to_price: showQtys,
          available_colours: nextCfg.available_colours || sub.available_colours,
          colour_swatches: nextCfg.colour_swatches || sub.colour_swatches,
          preset_quantities: cleanPresetQtys,
        };
      });

      // Keep sub_type_budgets, colour_wise_sub_types, and quantities_to_price_sub_types synced in size_config
      const curCfg = prev.size_config || {};
      const targetSub = nextSubs.find((s) => s.sub_id === activeSubFilter);
      const targetCfg = targetSub?.size_config || {};

      const nextBudgets = { ...(curCfg.sub_type_budgets || {}) };
      if (targetCfg.default_budget !== undefined) {
        nextBudgets[activeSubFilter] = targetCfg.default_budget;
      }

      const curColourList = Array.isArray(curCfg.colour_wise_sub_types)
        ? [...curCfg.colour_wise_sub_types]
        : [];
      const nextColourList = targetCfg.has_colour_wise_qty
        ? Array.from(new Set([...curColourList, activeSubFilter]))
        : curColourList.filter((id) => id !== activeSubFilter);

      const curQtyList = Array.isArray(curCfg.quantities_to_price_sub_types)
        ? [...curCfg.quantities_to_price_sub_types]
        : [];
      const nextQtyList = (targetCfg.show_quantities_to_price !== false)
        ? Array.from(new Set([...curQtyList, activeSubFilter]))
        : curQtyList.filter((id) => id !== activeSubFilter);

      return {
        ...prev,
        sub_types: nextSubs,
        size_config: {
          ...curCfg,
          sub_type_budgets: nextBudgets,
          colour_wise_sub_types: nextColourList,
          quantities_to_price_sub_types: nextQtyList,
        },
      };
    });
  };

  // State for adding custom colour
  const [customColourInput, setCustomColourInput] = useState("");
  const [customColourHex, setCustomColourHex] = useState("#B08D57");

  const handleToggleColour = (colourName) => {
    updateActiveSizeConfig((cfg) => {
      const curList = Array.isArray(cfg.available_colours) ? [...cfg.available_colours] : [];
      const isSelected = curList.includes(colourName);
      const nextList = isSelected
        ? curList.filter((c) => c !== colourName)
        : [...curList, colourName];
      return { ...cfg, available_colours: nextList };
    });
  };

  const handleSelectAllColours = () => {
    const allNames = allFinishOptions.map((f) => f.name);
    updateActiveSizeConfig((cfg) => ({
      ...cfg,
      available_colours: allNames,
    }));
  };

  const handleClearAllColours = () => {
    updateActiveSizeConfig((cfg) => ({
      ...cfg,
      available_colours: [],
    }));
  };

  const handleAddCustomColour = () => {
    const clean = customColourInput.trim();
    if (!clean) return;
    updateActiveSizeConfig((cfg) => {
      const curList = Array.isArray(cfg.available_colours) ? [...cfg.available_colours] : [];
      const nextList = curList.includes(clean) ? curList : [...curList, clean];
      const curSwatches = { ...(cfg.colour_swatches || {}) };
      curSwatches[clean] = customColourHex;
      return {
        ...cfg,
        available_colours: nextList,
        colour_swatches: curSwatches,
      };
    });
    setCustomColourInput("");
  };

  // Quantities to Price (Preset Quantity Pills) state & toggle
  const isQuantitiesToPriceEnabled = Boolean(
    activeSizeConfig.show_quantities_to_price === true ||
    (activeSizeConfig.show_quantities_to_price !== false &&
      Array.isArray(activeSizeConfig.preset_quantities) &&
      activeSizeConfig.preset_quantities.length > 0)
  );

  const handleToggleQuantitiesToPrice = () => {
    const nextVal = !isQuantitiesToPriceEnabled;
    if (nextVal) {
      const defaultQtys =
        Array.isArray(activeSizeConfig.preset_quantities) && activeSizeConfig.preset_quantities.length > 0
          ? activeSizeConfig.preset_quantities
          : [50, 100, 250];
      updateActiveSizeConfig({
        show_quantities_to_price: true,
        preset_quantities: defaultQtys,
      });
    } else {
      updateActiveSizeConfig({
        show_quantities_to_price: false,
        preset_quantities: [],
      });
      setPresetQtyText(null);
    }
  };

  // 1. Dimension Handlers
  const handleAddDimension = (template = null) => {
    const nextKey = template ? template.key : `dim_${Date.now()}`;
    const nextLabel = template ? template.label : "Custom Dimension";
    const nextUnit = template ? template.unit : "in";

    const newDim = {
      key: nextKey,
      label: nextLabel,
      unit: nextUnit,
      allow_custom: true,
      default_value: "",
      preset_sizes: [],
    };

    updateActiveSizeConfig((cfg) => ({
      ...cfg,
      dimensions: [...(cfg.dimensions || []), newDim],
    }));
  };

  const handleRemoveDimension = (dIdx) => {
    updateActiveSizeConfig((cfg) => ({
      ...cfg,
      dimensions: (cfg.dimensions || []).filter((_, i) => i !== dIdx),
    }));
  };

  const handleUpdateDimension = (dIdx, field, val) => {
    updateActiveSizeConfig((cfg) => {
      const nextDims = (cfg.dimensions || []).map((dim, i) => {
        if (i !== dIdx) return dim;
        const updated = { ...dim, [field]: val };
        if (field === "label" && !dim._customKeySet) {
          updated.key = val.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 30);
        }
        return updated;
      });
      return { ...cfg, dimensions: nextDims };
    });
  };

  // 2. Preset Sizes inside a Dimension
  const handleAddPresetToDimension = (dIdx, sizeLabel = "") => {
    const labelToAdd = sizeLabel.trim();
    updateActiveSizeConfig((cfg) => {
      const nextDims = (cfg.dimensions || []).map((dim, i) => {
        if (i !== dIdx) return dim;
        const existing = dim.preset_sizes || [];
        if (
          labelToAdd &&
          existing.some(
            (ps) => (ps.label || "").trim().toLowerCase() === labelToAdd.toLowerCase()
          )
        ) {
          return dim;
        }
        if (!labelToAdd && existing.some((ps) => !(ps.label || "").trim())) {
          return dim;
        }
        const isFirst = existing.length === 0;
        return {
          ...dim,
          preset_sizes: [
            ...existing,
            { label: labelToAdd, value: labelToAdd, is_usual: isFirst },
          ],
        };
      });
      return { ...cfg, dimensions: nextDims };
    });
  };

  const handleQuickAddPreset = (dIdx) => {
    const val = (quickSizeInputs[dIdx] || "").trim();
    if (!val) return;
    const currentDim = dimensions[dIdx];
    const alreadyExists = (currentDim?.preset_sizes || []).some(
      (ps) => (ps.label || "").trim().toLowerCase() === val.toLowerCase()
    );
    if (alreadyExists) {
      setQuickSizeInputs((prev) => ({ ...prev, [dIdx]: "" }));
      return;
    }
    handleAddPresetToDimension(dIdx, val);
    setQuickSizeInputs((prev) => ({ ...prev, [dIdx]: "" }));
  };

  const handleUpdatePresetInDimension = (dIdx, pIdx, field, val) => {
    updateActiveSizeConfig((cfg) => {
      const nextDims = (cfg.dimensions || []).map((dim, i) => {
        if (i !== dIdx) return dim;
        const nextPresets = (dim.preset_sizes || []).map((ps, pi) => {
          if (field === "is_usual") {
            return { ...ps, is_usual: pi === pIdx ? val : false };
          }
          if (pi !== pIdx) return ps;
          const updated = { ...ps, [field]: val };
          if (field === "label") updated.value = val;
          return updated;
        });
        return { ...dim, preset_sizes: nextPresets };
      });
      return { ...cfg, dimensions: nextDims };
    });
  };

  const handleRemovePresetFromDimension = (dIdx, pIdx) => {
    updateActiveSizeConfig((cfg) => {
      const nextDims = (cfg.dimensions || []).map((dim, i) => {
        if (i !== dIdx) return dim;
        return {
          ...dim,
          preset_sizes: (dim.preset_sizes || []).filter((_, pi) => pi !== pIdx),
        };
      });
      return { ...cfg, dimensions: nextDims };
    });
  };

  return (
    <div className="space-y-6">
      {/* ─────────────────────────────────────────────────────────────
          SUB-CATEGORY SELECTOR TABS (Flow matching Tab 2)
      ───────────────────────────────────────────────────────────── */}
      {hasSubTypes && (
        <div className="flex items-center gap-1.5 overflow-x-auto p-1.5 bg-gray-100 rounded-xl border border-gray-200 text-xs">
          {(formData.sub_types || []).map((sub) => {
            const isCur = activeSubFilter === sub.sub_id;
            const subCfg = (sub.size_config && Object.keys(sub.size_config).length > 0)
              ? sub.size_config
              : formData.size_config || {};
            const dimPresetCount = (subCfg.dimensions || []).reduce(
              (acc, d) => acc + (d.preset_sizes?.length || 0),
              0
            );
            const directPresetCount = subCfg.preset_sizes?.length || 0;
            const count = dimPresetCount || directPresetCount || 0;

            return (
              <button
                key={sub.sub_id}
                type="button"
                onClick={() => setActiveSubFilter(sub.sub_id)}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  isCur
                    ? "bg-[#4B3BF5] text-white shadow-2xs"
                    : "text-gray-600 hover:text-gray-900 bg-white border border-gray-200"
                }`}
              >
                <span>{sub.icon || "📦"}</span>
                <span>{sub.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    isCur ? "bg-indigo-900/40 text-white" : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {count} sizes
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Sub-type active info banner */}
      {hasSubTypes && activeSub && (
        <div className="flex items-center gap-2 p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-indigo-900">
          <span className="text-base">{activeSub.icon || "ℹ️"}</span>
          <span>
            Viewing & configuring sizes & rates specifically for <strong>{activeSub.label}</strong>.
            Changes here are saved directly for this sub-category.
          </span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SECTION A: SIZE HEADERS & SETTINGS
      ───────────────────────────────────────────────────────────── */}
      <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-xs text-gray-900 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#4B3BF5]"></span>
              Section 3: Size Headers & Settings
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Customize title and subtitle for the size card {activeSub ? `(${activeSub.label})` : ""}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Size Row Title
            </label>
            <input
              type="text"
              value={activeSizeConfig.size_row_title || ""}
              onChange={(e) => updateActiveSizeConfig({ size_row_title: e.target.value })}
              placeholder="e.g. Product Dimensions, Face size"
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-medium bg-white focus:outline-none focus:border-[#4B3BF5] focus:ring-1 focus:ring-[#4B3BF5]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Size Row Subtitle
            </label>
            <input
              type="text"
              value={activeSizeConfig.size_row_subtitle || ""}
              onChange={(e) => updateActiveSizeConfig({ size_row_subtitle: e.target.value })}
              placeholder="e.g. Scroll sheet size, Pole height, Face diameter, Plaque size"
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-medium bg-white focus:outline-none focus:border-[#4B3BF5] focus:ring-1 focus:ring-[#4B3BF5]"
            />
          </div>
        </div>

        {/* Colour / Finish Wise Quantity Breakdown Toggle */}
        <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-4">
          <div>
            <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5 cursor-pointer">
              <span>🎨</span>
              <span>Enable Colour / Finish Wise Quantity Breakdown</span>
            </label>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Show finish/colour table (e.g. Gold, Silver, Bronze) with individual quantity & rate per finish on the size card
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(activeSizeConfig.has_colour_wise_qty || activeSizeConfig.size_mode === "colour_wise_qty")}
            onClick={() => {
              const currentActive = activeSizeConfig.has_colour_wise_qty || activeSizeConfig.size_mode === "colour_wise_qty";
              updateActiveSizeConfig({ has_colour_wise_qty: !currentActive });
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              (activeSizeConfig.has_colour_wise_qty || activeSizeConfig.size_mode === "colour_wise_qty")
                ? "bg-[#4B3BF5]"
                : "bg-gray-200"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                (activeSizeConfig.has_colour_wise_qty || activeSizeConfig.size_mode === "colour_wise_qty")
                  ? "translate-x-5"
                  : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Available Colours / Finishes Checklist for this sub-type */}
        {Boolean(activeSizeConfig.has_colour_wise_qty || activeSizeConfig.size_mode === "colour_wise_qty") && (
          <div className="pt-4 mt-2 border-t border-indigo-100 bg-indigo-50/40 -mx-5 -mb-5 p-5 rounded-b-2xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <span>🎨</span>
                  <span>Available Colours / Finishes {activeSub ? `for ${activeSub.label}` : ""}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-200 text-indigo-800">
                    {(activeSizeConfig.available_colours || []).length} selected
                  </span>
                </label>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Click to select which finishes are available for this specific sub-category in the Enquiry Flow.
                </p>
              </div>

              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={handleSelectAllColours}
                  className="px-2 py-1 text-[11px] font-semibold text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50 rounded-lg cursor-pointer"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleClearAllColours}
                  className="px-2 py-1 text-[11px] font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Colour Pills Checklist */}
            <div className="flex flex-wrap gap-2 items-center pt-1">
              {allFinishOptions.map((f) => {
                const isSelected = (activeSizeConfig.available_colours || []).includes(f.name);
                return (
                  <button
                    key={f.name}
                    type="button"
                    onClick={() => handleToggleColour(f.name)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer shadow-2xs ${
                      isSelected
                        ? "bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-200"
                        : "bg-white text-gray-700 border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/50"
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                      style={{ background: f.swatch || "#B08D57" }}
                    />
                    <span>{f.name}</span>
                    {isSelected ? (
                      <span className="text-[10px] ml-0.5 font-bold">✓</span>
                    ) : (
                      <span className="text-[10px] text-gray-300 ml-0.5">+</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Quick Add Custom Colour Input */}
            <div className="pt-2 flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-gray-600">+ Custom Colour:</span>
              <input
                type="text"
                value={customColourInput}
                onChange={(e) => setCustomColourInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomColour();
                  }
                }}
                placeholder="e.g. Rose Gold, Matt Black"
                className="w-44 px-2.5 py-1 text-xs border border-gray-300 rounded-lg bg-white font-medium outline-none focus:border-[#4B3BF5]"
              />
              <input
                type="color"
                value={customColourHex}
                onChange={(e) => setCustomColourHex(e.target.value)}
                className="w-7 h-7 p-0.5 border border-gray-300 rounded-lg cursor-pointer bg-white"
                title="Choose custom swatch color"
              />
              <button
                type="button"
                onClick={handleAddCustomColour}
                disabled={!customColourInput.trim()}
                className="px-3 py-1 bg-indigo-700 text-white rounded-lg text-xs font-bold hover:bg-indigo-800 cursor-pointer disabled:opacity-40 transition"
              >
                Add Colour
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION B: PRODUCT DIMENSIONS & MULTI-PRESET SIZES
      ───────────────────────────────────────────────────────────── */}
      <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-xs text-gray-900 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Product Dimensions & Standard Preset Sizes {activeSub ? `(${activeSub.label})` : ""}
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Add individual dimensions (Height, Length, Width, Thickness, etc.) and save multiple preset sizes under each.
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleAddDimension()}
            className="px-3.5 py-1.5 bg-[#4B3BF5] text-white hover:bg-[#3d2ee0] rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <span>+</span>
            <span>Add Dimension</span>
          </button>
        </div>

        {/* Quick Template Dimension Chips */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className="text-[11px] font-bold text-gray-500 mr-1">Quick Add:</span>
          {STANDARD_DIMENSION_PRESETS.map((tpl) => {
            const isAlreadyAdded = dimensions.some(
              (d) => d.key === tpl.key || d.label.toLowerCase() === tpl.label.toLowerCase()
            );
            return (
              <button
                key={tpl.key}
                type="button"
                onClick={() => handleAddDimension(tpl)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-1 ${
                  isAlreadyAdded
                    ? "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                    : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                }`}
                title={`Add ${tpl.label} dimension with standard presets`}
              >
                <span>+</span>
                <span>{tpl.label}</span>
                <span className="text-[10px] text-gray-400 font-normal">({tpl.unit})</span>
              </button>
            );
          })}
        </div>

        {/* Dimensions Cards List */}
        {dimensions.length === 0 ? (
          <div className="p-6 border-2 border-dashed border-gray-200 rounded-xl text-center bg-gray-50/50">
            <span className="text-2xl block mb-1">📐</span>
            <p className="text-xs font-bold text-gray-700">No custom dimensions added yet</p>
            <p className="text-[11px] text-gray-500 max-w-md mx-auto mt-1">
              Click any quick button above (e.g. <b>+ Height</b>, <b>+ Length</b>, <b>+ Width</b>) or click <b>Add Dimension</b> to define multiple preset sizes for each dimension.
            </p>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            {dimensions.map((dim, dIdx) => (
              <div
                key={dIdx}
                className="p-4 bg-gray-50/80 border border-gray-200 rounded-xl space-y-3.5 hover:border-gray-300 transition"
              >
                {/* Dimension Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-[#4B3BF5] font-bold text-[10px] flex items-center justify-center shrink-0">
                      {dIdx + 1}
                    </span>

                    {/* Dimension Label Input */}
                    <div className="flex-1 max-w-xs">
                      <input
                        type="text"
                        value={dim.label || ""}
                        onChange={(e) => handleUpdateDimension(dIdx, "label", e.target.value)}
                        placeholder="Dimension Name, e.g. Height"
                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-bold text-gray-900 bg-white focus:outline-none focus:border-[#4B3BF5]"
                      />
                    </div>

                    {/* Key badge */}
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-gray-200 text-gray-600">
                      key: {dim.key}
                    </span>
                  </div>

                  {/* Unit Selector & Allow Custom Toggle */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <label className="text-[11px] font-bold text-gray-600">Unit:</label>
                      <select
                        value={dim.unit || "in"}
                        onChange={(e) => handleUpdateDimension(dIdx, "unit", e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded-lg text-xs font-semibold bg-white"
                      >
                        {UNIT_OPTIONS.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={dim.allow_custom !== false}
                        onChange={(e) => handleUpdateDimension(dIdx, "allow_custom", e.target.checked)}
                        className="rounded text-[#4B3BF5] focus:ring-[#4B3BF5]"
                      />
                      <span>Allow Custom</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => handleRemoveDimension(dIdx)}
                      className="text-gray-400 hover:text-red-600 p-1 hover:bg-red-50 rounded-lg transition cursor-pointer"
                      title="Delete this dimension"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Dimension Preset Sizes Pills */}
                <div className="pt-2 border-t border-gray-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-gray-700">
                      Preset Sizes for {dim.label || "Dimension"} (Click ★ to set default):
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAddPresetToDimension(dIdx)}
                      className="text-xs font-bold text-[#4B3BF5] hover:underline cursor-pointer"
                    >
                      + Add Size
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 items-center">
                    {(dim.preset_sizes || []).map((sz, pIdx) => {
                      const szLen = (sz.label || "").length;
                      const szWidthCh = szLen > 0 ? Math.max(szLen + 1, 5) : 8;
                      const isDuplicate = Boolean(
                        (sz.label || "").trim() &&
                        (dim.preset_sizes || []).some(
                          (other, oi) =>
                            oi !== pIdx &&
                            (other.label || "").trim().toLowerCase() === (sz.label || "").trim().toLowerCase()
                        )
                      );

                      return (
                        <div
                          key={pIdx}
                          className={`flex items-center gap-1.5 rounded-full pl-3 pr-2 py-1 text-xs shadow-2xs transition ${
                            isDuplicate
                              ? "bg-red-50 border-2 border-red-400 text-red-700"
                              : "bg-white border border-gray-300 hover:border-[#4B3BF5]/50"
                          }`}
                          title={isDuplicate ? "Duplicate preset size (will be removed on blur)" : ""}
                        >
                          <input
                            type="text"
                            value={sz.label || ""}
                            onChange={(e) =>
                              handleUpdatePresetInDimension(dIdx, pIdx, "label", e.target.value)
                            }
                            onBlur={(e) => {
                              const clean = e.target.value.trim();
                              if (!clean) return;
                              const hasDuplicate = (dim.preset_sizes || []).some(
                                (other, oi) =>
                                    oi !== pIdx &&
                                    (other.label || "").trim().toLowerCase() === clean.toLowerCase()
                              );
                              if (hasDuplicate) {
                                handleRemovePresetFromDimension(dIdx, pIdx);
                              }
                            }}
                            style={{ width: `${szWidthCh}ch` }}
                            className="min-w-[45px] max-w-[160px] outline-none font-bold text-gray-800 text-xs bg-transparent"
                            placeholder="Size"
                          />
                          <button
                            type="button"
                            className={`text-[9px] px-1.5 py-0.5 rounded cursor-pointer transition ${
                              sz.is_usual
                                ? "bg-amber-100 text-amber-900 border border-amber-300 font-bold"
                                : "text-gray-400 hover:text-gray-600"
                            }`}
                            onClick={() =>
                              handleUpdatePresetInDimension(dIdx, pIdx, "is_usual", !sz.is_usual)
                            }
                            title="Toggle default size"
                          >
                            {sz.is_usual ? "★ default" : "default"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemovePresetFromDimension(dIdx, pIdx)}
                            className="w-4 h-4 rounded-full flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer shrink-0"
                            title="Delete preset size"
                          >
                            <svg className="w-2.5 h-2.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M2 2l10 10M12 2L2 12" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}

                    {/* Quick Add input box for this dimension */}
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={quickSizeInputs[dIdx] || ""}
                        onChange={(e) =>
                          setQuickSizeInputs((prev) => ({ ...prev, [dIdx]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleQuickAddPreset(dIdx);
                          }
                        }}
                        placeholder={`Type size, e.g. ${dim.unit === "mm" ? "25 mm" : '10"'}`}
                        className="w-28 px-2.5 py-1 border border-dashed border-gray-300 rounded-full text-xs bg-white text-gray-700 outline-none focus:border-[#4B3BF5]"
                      />
                      <button
                        type="button"
                        onClick={() => handleQuickAddPreset(dIdx)}
                        className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-[11px] font-bold cursor-pointer"
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION C: DEFAULT PRICING & QUANTITIES
      ───────────────────────────────────────────────────────────── */}
      <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-xs space-y-4">
        <h3 className="font-bold text-xs text-gray-900 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-gray-100">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          Default Pricing & Quantities {activeSub ? `(${activeSub.label})` : ""}
        </h3>

        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Unit of Measure (UOM)</label>
            <select
              value={activeSizeConfig.uom || "piece"}
              onChange={(e) => updateActiveSizeConfig({ uom: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold bg-white"
            >
              <option value="piece">Piece (pc)</option>
              <option value="pair">Pair (pairs)</option>
              <option value="set">Set (sets)</option>
              <option value="nos">Nos</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Default Indicative Rate (₹)</label>
            <input
              type="number"
              value={activeSizeConfig.default_budget ?? ""}
              onChange={(e) => {
                const val = e.target.value === "" ? "" : Number(e.target.value);
                updateActiveSizeConfig({ default_budget: val });
              }}
              onBlur={() => {
                if (activeSizeConfig.default_budget === "" || isNaN(activeSizeConfig.default_budget)) {
                  updateActiveSizeConfig({ default_budget: 0 });
                }
              }}
              placeholder="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Default Design Options</label>
            <input
              type="number"
              min="1"
              max="10"
              value={activeSizeConfig.default_design_options ?? ""}
              onChange={(e) => {
                const val = e.target.value === "" ? "" : Number(e.target.value);
                updateActiveSizeConfig({ default_design_options: val });
              }}
              onBlur={() => {
                if (activeSizeConfig.default_design_options === "" || isNaN(activeSizeConfig.default_design_options)) {
                  updateActiveSizeConfig({ default_design_options: 2 });
                }
              }}
              placeholder="2"
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold bg-white"
            />
          </div>
        </div>

        {/* Quantities to Price / Preset Quantities Toggle & Input */}
        <div className="pt-4 border-t border-gray-100 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm">🔢</span>
                <span className="text-xs font-bold text-gray-900">
                  Enable Quantities to Price (Preset Quantity Pills) {activeSub ? `for ${activeSub.label}` : ""}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Show quick-select quantity buttons (e.g. 50, 100, 250) on the size card for this sub-category. When unchecked, pills won&apos;t show and won&apos;t store in DB.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={isQuantitiesToPriceEnabled}
              onClick={handleToggleQuantitiesToPrice}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isQuantitiesToPriceEnabled ? "bg-[#4B3BF5]" : "bg-gray-200"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  isQuantitiesToPriceEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Preset Quantities Input Box & Pills Preview (Only when toggle is ON) */}
          {isQuantitiesToPriceEnabled ? (
            <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2">
              <label className="block text-xs font-bold text-indigo-950">
                Preset Quantities (comma-separated)
              </label>
              <div className="max-w-md">
                <input
                  type="text"
                  value={presetQtyText !== null ? presetQtyText : (activeSizeConfig.preset_quantities || []).join(", ")}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setPresetQtyText(raw);
                    const rawVals = raw
                      .split(",")
                      .map((x) => parseInt(x.trim(), 10))
                      .filter((n) => !isNaN(n));
                    const uniqueVals = Array.from(new Set(rawVals));
                    updateActiveSizeConfig({ preset_quantities: uniqueVals });
                  }}
                  onBlur={() => {
                    setPresetQtyText(null);
                    const unique = Array.from(new Set(activeSizeConfig.preset_quantities || []));
                    updateActiveSizeConfig({ preset_quantities: unique });
                  }}
                  placeholder="e.g. 50, 100, 250"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold bg-white outline-none focus:border-[#4B3BF5]"
                />
              </div>

              {Array.isArray(activeSizeConfig.preset_quantities) && activeSizeConfig.preset_quantities.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-gray-400 font-semibold">Pills:</span>
                  {Array.from(new Set(activeSizeConfig.preset_quantities)).map((q, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold"
                    >
                      {q}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-[11px] text-gray-500 italic">
              Quantities to price pills are turned off for this sub-category. In Enquiry Flow, sales person will enter the quantity manually.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

ProductConfigSizeTab.propTypes = {
  formData: PropTypes.shape({
    _id: PropTypes.string,
    product_id: PropTypes.string,
    has_sub_types: PropTypes.bool,
    sub_types: PropTypes.arrayOf(PropTypes.object),
    size_config: PropTypes.object,
  }).isRequired,
  setFormData: PropTypes.func.isRequired,
};

export default ProductConfigSizeTab;
