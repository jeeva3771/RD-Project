import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { fetchActivePlatingFinishes } from "../../../../../reducer/masters/enquiryFlow/platingFinishMasterReducer";
import {
  MEDAL_FINISHES,
  MEDAL_ZINC_PLATINGS,
  METAL_PLATINGS,
  SWATCH_MAP
} from "../../../utils/productConstants";
import { generateSpecLine } from "../../../utils/specLineGenerator";
import { calculateProductEstimate } from "../../../utils/trophyMasterService";
import { DynamicProductSizeCard } from "./size-cards";

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
  const dispatch = useDispatch();
  const spec = item.spec || {};
  const [unit, setUnit] = useState(spec.unit || "in");
  const curUnit = spec.unit || unit || (String(item.size).includes("mm") ? "mm" : "in");
  const [isCustomSize, setIsCustomSize] = useState(Boolean(spec.isCustomSize));

  useEffect(() => {
    setIsCustomSize(Boolean(spec.isCustomSize));
  }, [spec.isCustomSize]);

  const { activeItems = [] } = useSelector((state) => state.productConfigMaster || {});
  const { activeItems: masterFinishes = [] } = useSelector((state) => state.platingFinishMaster || {});

  useEffect(() => {
    if (!masterFinishes || masterFinishes.length === 0) {
      dispatch(fetchActivePlatingFinishes());
    }
  }, [dispatch, masterFinishes]);

  const productConfig = activeItems.find((p) => p.product_id === productType);

  // Resolve active sub-type for this product item
  const currentSubTypeId =
    spec.subType ||
    spec[`${productType}Type`] ||
    (productType === "medal" ? spec.medalType : undefined) ||
    (productType === "badge" ? spec.badgeType : undefined) ||
    group.subType;

  const matchedSubType = (productConfig?.sub_types || []).find(
    (s) => s.sub_id === currentSubTypeId
  );

  const subSizeCfg = useMemo(() => matchedSubType?.size_config || {}, [matchedSubType?.size_config]);

  const subTypeBudget =
    subSizeCfg.default_budget !== undefined && subSizeCfg.default_budget !== null && subSizeCfg.default_budget !== ""
      ? Number(subSizeCfg.default_budget)
      : matchedSubType?.default_budget !== undefined && matchedSubType?.default_budget !== null && matchedSubType?.default_budget !== ""
      ? Number(matchedSubType.default_budget)
      : productConfig?.size_config?.sub_type_budgets?.[currentSubTypeId] !== undefined
      ? Number(productConfig.size_config.sub_type_budgets[currentSubTypeId])
      : undefined;

  const effectiveProductConfig = React.useMemo(() => {
    if (!productConfig) return productConfig;
    const baseSizeConfig = productConfig.size_config || {};

    let showQtyPricing = true;
    if (productConfig.has_sub_types && currentSubTypeId) {
      if (subSizeCfg?.show_quantities_to_price !== undefined) {
        showQtyPricing = Boolean(subSizeCfg.show_quantities_to_price);
      } else if (matchedSubType?.show_quantities_to_price !== undefined) {
        showQtyPricing = Boolean(matchedSubType.show_quantities_to_price);
      } else if (Array.isArray(productConfig.size_config?.quantities_to_price_sub_types)) {
        showQtyPricing = productConfig.size_config.quantities_to_price_sub_types.includes(currentSubTypeId);
      } else {
        showQtyPricing = Boolean(
          Array.isArray(subSizeCfg?.preset_quantities) && subSizeCfg.preset_quantities.length > 0
        );
      }
    } else if (baseSizeConfig.show_quantities_to_price !== undefined) {
      showQtyPricing = Boolean(baseSizeConfig.show_quantities_to_price);
    }

    const mergedSizeConfig = {
      ...baseSizeConfig,
      ...(subSizeCfg && Object.keys(subSizeCfg).length > 0 ? subSizeCfg : {}),
      show_quantities_to_price: showQtyPricing,
      default_budget: subTypeBudget !== undefined && subTypeBudget > 0 ? subTypeBudget : baseSizeConfig.default_budget,
    };
    return {
      ...productConfig,
      size_config: mergedSizeConfig,
    };
  }, [productConfig, subSizeCfg, matchedSubType, currentSubTypeId, subTypeBudget]);

  const currentEst = calculateProductEstimate(
    productType,
    spec,
    item,
    group,
    materials,
    elements,
    effectiveProductConfig
  );

  // Dynamic sizes: supports Sub-Category dedicated preset sizes and Trophy height presets
  const getDynamicSizes = () => {
    if (productType === "trophy" || productType === "memento") {
      const dimHeightPresets = (productConfig?.size_config?.dimensions || [])
        .find((d) => d.key === "height" || d.label?.toLowerCase() === "height")
        ?.preset_sizes;
      if (Array.isArray(dimHeightPresets) && dimHeightPresets.length > 0) {
        return dimHeightPresets;
      }
      const pSizes = productConfig?.size_config?.preset_sizes;
      if (Array.isArray(pSizes) && pSizes.length > 0) {
        return pSizes;
      }
      return [];
    }

    // For sub-typed products: prioritize dedicated preset sizes
    if (productConfig?.has_sub_types && currentSubTypeId) {
      if (Array.isArray(subSizeCfg.dimensions) && subSizeCfg.dimensions.length > 0) {
        const dimSizes = subSizeCfg.dimensions.flatMap((d) => d.preset_sizes || []);
        if (dimSizes.length > 0) return dimSizes;
      }
      if (Array.isArray(subSizeCfg.preset_sizes) && subSizeCfg.preset_sizes.length > 0) {
        return subSizeCfg.preset_sizes;
      }
      if (Array.isArray(matchedSubType?.preset_sizes) && matchedSubType.preset_sizes.length > 0) {
        return matchedSubType.preset_sizes;
      }
      const allPresets = productConfig?.size_config?.preset_sizes || [];
      const subFiltered = allPresets.filter(
        (ps) => Array.isArray(ps.applicable_sub_types) && ps.applicable_sub_types.includes(currentSubTypeId)
      );
      if (subFiltered.length > 0) {
        return subFiltered;
      }
    }

    const pSizes = productConfig?.size_config?.preset_sizes;
    if (Array.isArray(pSizes) && pSizes.length > 0) {
      return pSizes;
    }
    return [];
  };

  // Preset quantities: reads from Sub-Type / Master or defaults to Trophy's standard targets
  const getDynamicQuantities = () => {
    // Check if target quantity pills are enabled for this sub-type
    if (productConfig?.has_sub_types && currentSubTypeId) {
      const showPills =
        subSizeCfg.show_quantities_to_price !== undefined
          ? Boolean(subSizeCfg.show_quantities_to_price)
          : matchedSubType?.show_quantities_to_price !== undefined
          ? Boolean(matchedSubType.show_quantities_to_price)
          : Array.isArray(productConfig?.size_config?.quantities_to_price_sub_types)
          ? productConfig.size_config.quantities_to_price_sub_types.includes(currentSubTypeId)
          : (Array.isArray(subSizeCfg.preset_quantities) && subSizeCfg.preset_quantities.length > 0);

      if (!showPills) {
        return [];
      }

      // Prioritize sub-type dedicated preset quantities
      const subQtys = subSizeCfg.preset_quantities !== undefined
        ? subSizeCfg.preset_quantities
        : matchedSubType?.preset_quantities;

      if (Array.isArray(subQtys)) {
        return subQtys
          .map((q) => {
            if (typeof q === "object" && q !== null) {
              return Number(q.value ?? q.qty ?? q.label) || 0;
            }
            return Number(q) || 0;
          })
          .filter((q) => q > 0);
      }
    } else if (productConfig?.size_config?.show_quantities_to_price === false) {
      return [];
    }

    const masterQtys = productConfig?.size_config?.preset_quantities;
    if (masterQtys && Array.isArray(masterQtys) && masterQtys.length > 0) {
      return masterQtys
        .map((q) => {
          if (typeof q === "object" && q !== null) {
            return Number(q.value ?? q.qty ?? q.label) || 0;
          }
          return Number(q) || 0;
        })
        .filter((q) => q > 0);
    }
    if ((productType === "trophy" || productType === "memento") && productConfig?.size_config?.show_quantities_to_price !== false) {
      return [10, 25, 50, 100, 250, 500];
    }
    return [];
  };

  // Colour-wise states & handlers (v30/v31)
  const isZinc = (spec.medalType || group?.designSpec?.medalType || "ms_punched") === "zinc_cast";
  const isColourWise = Boolean(
    subSizeCfg.has_colour_wise_qty !== undefined
      ? subSizeCfg.has_colour_wise_qty
      : matchedSubType?.has_colour_wise_qty !== undefined
      ? matchedSubType.has_colour_wise_qty
      : Array.isArray(productConfig?.size_config?.colour_wise_sub_types) && currentSubTypeId
      ? productConfig.size_config.colour_wise_sub_types.includes(currentSubTypeId)
      : productConfig?.size_config?.has_colour_wise_qty ||
        productConfig?.size_config?.size_mode === "colour_wise_qty" ||
        (!productConfig && (productType === "medal" || productType === "lapel_pin" || productType === "badge"))
  );

  // Automatically clean up ghost / previous colour data when product doesn't support colour breakdown
  useEffect(() => {
    if (!isColourWise) {
      const hasStaleColours =
        (item.colourQuantities && item.colourQuantities.length > 0) ||
        (spec.colourQuantities && spec.colourQuantities.length > 0) ||
        Boolean(item.colour || spec.colour || spec.labelOption || spec.hasLabel || spec.rateByColour || spec.customFinishes || item.customFinishes);

      if (hasStaleColours) {
        const cleanedSpec = { ...(item.spec || spec || {}) };
        delete cleanedSpec.colourQuantities;
        delete cleanedSpec.colour;
        delete cleanedSpec.customFinishes;
        delete cleanedSpec.labelOption;
        delete cleanedSpec.hasLabel;
        delete cleanedSpec.rateByColour;
        delete cleanedSpec.colourRows;

        const cleanedItem = {
          ...item,
          spec: cleanedSpec,
        };
        delete cleanedItem.colourQuantities;
        delete cleanedItem.colour;
        delete cleanedItem.customFinishes;

        cleanedItem.specLine = generateSpecLine(productType, cleanedSpec, group);
        onUpdateItem(cleanedItem);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isColourWise, productType]);
  const colourRows = useMemo(() => {
    return (item.colourQuantities || []).filter(
      (r) => r && typeof r === "object" && Boolean(r.colour && String(r.colour).trim())
    );
  }, [item.colourQuantities]);
  const [showCustomColorPicker, setShowCustomColorPicker] = useState(false);
  const [customColorName, setCustomColorName] = useState("");
  const [customHex, setCustomHex] = useState("#B08D57");

  const authUser = useSelector((state) => state.auth?.user || {});

  // Custom finishes states (Stored directly in enquiry DB spec.customFinishes)
  const getInitialCustomMedalFinishes = useCallback(() => {
    const list = [];
    const sourceList = Array.isArray(item.customFinishes)
      ? item.customFinishes
      : Array.isArray(spec.customFinishes)
        ? spec.customFinishes
        : null;

    if (sourceList !== null) {
      sourceList.forEach((c) => {
        const name = typeof c === "object" ? (c.colour || c.name) : c;
        if (name && !list.includes(name)) list.push(name);
      });
      return list;
    }

    (item.colourQuantities || []).forEach((r) => {
      if (r.colour && (r.isCustom || r.colourCode)) {
        if (!list.includes(r.colour)) list.push(r.colour);
      }
    });
    return list;
  }, [item.customFinishes, item.colourQuantities, spec.customFinishes]);

  const [customMedalFinishes, setCustomMedalFinishes] = useState(getInitialCustomMedalFinishes);
  const [showNewMedalFinishForm, setShowNewMedalFinishForm] = useState(false);
  const [showManageCustomFinishes, setShowManageCustomFinishes] = useState(false);
  const [newMedalFinishName, setNewMedalFinishName] = useState("");
  const [newMedalFinishColor, setNewMedalFinishColor] = useState("#B08D57");

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

  useEffect(() => {
    const fromItem = getInitialCustomMedalFinishes();
    setCustomMedalFinishes(fromItem);

    const swatches = {};
    (item.customFinishes || spec.customFinishes || []).forEach((c) => {
      const name = typeof c === "object" ? (c.colour || c.name) : c;
      const code = typeof c === "object" ? (c.colourCode || c.code) : null;
      if (name && code) {
        swatches[name] = code;
      }
    });
    (item.colourQuantities || []).forEach((r) => {
      if (r.colour && r.colourCode) {
        swatches[r.colour] = r.colourCode;
      }
    });
    if (Object.keys(swatches).length > 0) {
      setDynamicSwatches((prev) => ({ ...swatches, ...prev }));
    }
  }, [getInitialCustomMedalFinishes, item.customFinishes, item.colourQuantities, spec.customFinishes]);

  // Dynamic finishes from PlatingFinishMaster (MongoDB)
  const masterProductFinishes = useMemo(() => {
    if (!Array.isArray(masterFinishes) || masterFinishes.length === 0) {
      return [];
    }
    return masterFinishes.filter((item) => {
      if (item.is_active === false) return false;
      const apps = Array.isArray(item.applicable_products) ? item.applicable_products : [];
      const lowerApps = apps.map((a) => String(a).toLowerCase().trim());
      const lowerProduct = String(productType || "").toLowerCase().trim();

      if (lowerApps.length === 0 || lowerApps.includes("all")) return true;
      if (lowerApps.includes(lowerProduct)) return true;
      if (lowerProduct === "badge" && (lowerApps.includes("badge") || lowerApps.includes("badges"))) return true;
      if (lowerProduct === "medal") {
        if (isZinc && (lowerApps.includes("medal_zinc") || lowerApps.includes("zinc_cast"))) return true;
        if (!isZinc && (lowerApps.includes("medal_ms") || lowerApps.includes("ms_punched"))) return true;
        return lowerApps.includes("medal") || lowerApps.includes("medals");
      }
      if (lowerProduct === "lapel_pin") {
        return lowerApps.includes("lapel_pin") || lowerApps.includes("lapel pin") || lowerApps.includes("pin");
      }
      return false;
    });
  }, [masterFinishes, productType, isZinc]);

  const masterFinishNames = useMemo(() => {
    return masterProductFinishes.map((f) => f.name).filter(Boolean);
  }, [masterProductFinishes]);

  const masterSwatchMap = useMemo(() => {
    const map = {};
    if (Array.isArray(masterFinishes)) {
      masterFinishes.forEach((item) => {
        if (item.name && item.code) {
          map[item.name] = item.code;
          map[item.name.toLowerCase()] = item.code;
        }
      });
    }
    return map;
  }, [masterFinishes]);

  const getPlatingSwatch = (plating) => {
    if (!plating) return "#D4AF37";
    const customConfigSwatch =
      subSizeCfg.colour_swatches?.[plating] ||
      productConfig?.size_config?.colour_swatches?.[plating];
    if (customConfigSwatch) return customConfigSwatch;

    if (dynamicSwatches[plating]) return dynamicSwatches[plating];
    const matchRow = (colourRows || []).find((r) => r.colour === plating && r.colourCode);
    if (matchRow && matchRow.colourCode) return matchRow.colourCode;
    const customMatch = (item.customFinishes || spec.customFinishes || []).find(
      (c) => (typeof c === "object" ? (c.colour || c.name) : c) === plating
    );
    if (customMatch && typeof customMatch === "object" && (customMatch.colourCode || customMatch.code)) {
      return customMatch.colourCode || customMatch.code;
    }

    // Master DB swatch lookup
    if (masterSwatchMap[plating]) return masterSwatchMap[plating];
    if (masterSwatchMap[plating.toLowerCase()]) return masterSwatchMap[plating.toLowerCase()];

    // Fallback static maps
    if (SWATCH_MAP[plating]) return SWATCH_MAP[plating];
    if (LAPEL_SUGGESTION_COLORS[plating]) return LAPEL_SUGGESTION_COLORS[plating];
    return "#D4AF37";
  };

  const customFinishNames = useMemo(() => {
    const list = (item.customFinishes || spec.customFinishes || []).map((c) =>
      typeof c === "object" ? (c.colour || c.name) : c
    ).filter(Boolean);
    return Array.from(new Set([...list, ...customMedalFinishes]));
  }, [item.customFinishes, spec.customFinishes, customMedalFinishes]);

  const allMedalFinishes = useMemo(() => {
    const baseList =
      masterFinishNames.length > 0
        ? masterFinishNames
        : isZinc
          ? MEDAL_ZINC_PLATINGS
          : MEDAL_FINISHES;

    return Array.from(new Set([...baseList, ...customFinishNames]));
  }, [masterFinishNames, isZinc, customFinishNames]);

  const availableColours = useMemo(() => {
    // 1. Sub-type dedicated assigned colours from Master
    const subColours = subSizeCfg.available_colours || matchedSubType?.available_colours;
    if (Array.isArray(subColours) && subColours.length > 0) {
      return Array.from(new Set([...subColours, ...customFinishNames]));
    }

    // 2. Category level assigned colours from Master
    const catColours = productConfig?.size_config?.available_colours;
    if (Array.isArray(catColours) && catColours.length > 0) {
      return Array.from(new Set([...catColours, ...customFinishNames]));
    }

    // 3. Fallback standard finishes
    let baseList = [];
    if (productType === "medal") baseList = allMedalFinishes;
    else if (masterFinishNames.length > 0) baseList = masterFinishNames;
    else if (productType === "lapel_pin") baseList = METAL_PLATINGS;
    else baseList = ["Gold mirror", "Silver mirror", "Rose gold mirror", "White", "Black", "Wood", "Red", "Blue", "Green"];

    return Array.from(new Set([...baseList, ...customFinishNames]));
  }, [subSizeCfg.available_colours, matchedSubType?.available_colours, productConfig?.size_config?.available_colours, productType, allMedalFinishes, masterFinishNames, customFinishNames]);

  const handleUpdateColourRow = (index, updates) => {
    const nextRows = [...colourRows];
    nextRows[index] = { ...nextRows[index], ...updates };
    const totalQty = nextRows.reduce((sum, r) => sum + (parseInt(r.qty) || 0), 0);
    onUpdateItem({
      ...item,
      qty: totalQty,
      colourQuantities: nextRows,
      colour: nextRows.map((r) => r.colour).filter(Boolean).join(", "),
      spec: {
        ...(item.spec || {}),
        colourQuantities: nextRows
      }
    });
  };

  const handleAddColour = (colName, customSwatch = null, isCustomColor = false) => {
    if (colourRows.some((r) => r.colour === colName)) return;
    const swatch = customSwatch || getPlatingSwatch(colName);
    const isCustom = isCustomColor || customFinishNames.includes(colName);
    const newRow = {
      colour: colName,
      colourCode: swatch,
      isCustom,
      qty: 0,
      rate: item.budget || item.sizeRate || 0,
      noLabel: false
    };
    const nextRows = [...colourRows, newRow];
    onUpdateItem({
      ...item,
      colourQuantities: nextRows,
      colour: nextRows.map((r) => r.colour).filter(Boolean).join(", "),
      spec: {
        ...(item.spec || {}),
        colourQuantities: nextRows
      }
    });
  };

  const handleSaveNewMedalFinish = () => {
    const trimmed = newMedalFinishName.trim();
    if (!trimmed) return;
    const nextList = Array.from(new Set([...customMedalFinishes, trimmed]));
    setCustomMedalFinishes(nextList);
    setDynamicSwatches((prev) => ({ ...prev, [trimmed]: newMedalFinishColor }));

    // Prepare updated customFinishes array
    const existingCustoms = (item.customFinishes || spec.customFinishes || []).filter(
      (c) => (typeof c === "object" ? (c.colour || c.name) : c) !== trimmed
    );
    const updatedCustoms = [
      ...existingCustoms,
      {
        colour: trimmed,
        colourCode: newMedalFinishColor,
        isCustom: true
      }
    ];

    // Add or update in colourRows
    let nextRows = [...colourRows];
    if (!nextRows.some((r) => r.colour === trimmed)) {
      nextRows.push({
        colour: trimmed,
        colourCode: newMedalFinishColor,
        isCustom: true,
        qty: 0,
        rate: item.budget || 0,
        noLabel: false
      });
    } else {
      nextRows = nextRows.map((r) =>
        r.colour === trimmed ? { ...r, colourCode: newMedalFinishColor, isCustom: true } : r
      );
    }

    onUpdateItem({
      ...item,
      customFinishes: updatedCustoms,
      colourQuantities: nextRows,
      colour: nextRows.map((r) => r.colour).filter(Boolean).join(", "),
      spec: {
        ...(item.spec || {}),
        customFinishes: updatedCustoms,
        colourQuantities: nextRows
      }
    });

    setNewMedalFinishName("");
    setNewMedalFinishColor("#B08D57");
    setShowNewMedalFinishForm(false);
  };

  const handleRemoveSavedCustomFinish = (name) => {
    // Guard: Do not allow removal if the finish is currently in use in active colour rows
    if (colourRows.some((r) => r.colour === name)) {
      return;
    }

    const nextList = customMedalFinishes.filter((x) => x !== name);
    setCustomMedalFinishes(nextList);

    const existingCustoms = (item.customFinishes || spec.customFinishes || []).filter(
      (c) => (typeof c === "object" ? (c.colour || c.name) : c) !== name
    );

    onUpdateItem({
      ...item,
      customFinishes: existingCustoms,
      spec: {
        ...(item.spec || {}),
        customFinishes: existingCustoms
      }
    });
  };

  const handleRemoveSavedMedalFinish = handleRemoveSavedCustomFinish;

  const handleSplitMedalLabel = (idx) => {
    const row = colourRows[idx];
    if (!row) return;
    const newRow = {
      colour: row.colour,
      colourCode: row.colourCode || getPlatingSwatch(row.colour),
      isCustom: row.isCustom || false,
      qty: 0,
      rate: row.rate || item.budget || 0,
      noLabel: !row.noLabel
    };
    const nextRows = [...colourRows];
    nextRows.splice(idx + 1, 0, newRow);
    const totalQty = nextRows.reduce((sum, r) => sum + (parseInt(r.qty) || 0), 0);
    onUpdateItem({
      ...item,
      qty: totalQty,
      colourQuantities: nextRows,
      colour: nextRows.map((r) => r.colour).filter(Boolean).join(", "),
      spec: {
        ...(item.spec || {}),
        colourQuantities: nextRows
      }
    });
  };

  const handleAddGoldSilverBronze = () => {
    const baseSet = isZinc ? ["Gold", "Silver", "Bronze"] : ["Gold", "Silver", "Shimmer copper"];
    const existing = new Set(colourRows.map((r) => r.colour));
    const toAdd = baseSet.filter((c) => !existing.has(c)).map((c) => ({ colour: c, colourCode: getPlatingSwatch(c), qty: 0, rate: item.budget || 0, noLabel: false }));
    const nextRows = [...colourRows, ...toAdd];
    onUpdateItem({
      ...item,
      colourQuantities: nextRows,
      colour: nextRows.map((r) => r.colour).filter(Boolean).join(", "),
      spec: {
        ...(item.spec || {}),
        colourQuantities: nextRows
      }
    });
  };

  const handleAddGoldSilver = () => {
    const baseSet = ["Gold", "Silver"];
    const existing = new Set(colourRows.map((r) => r.colour));
    const toAdd = baseSet.filter((c) => !existing.has(c)).map((c) => ({ colour: c, colourCode: getPlatingSwatch(c), qty: 0, rate: item.budget || 0, noLabel: false }));
    const nextRows = [...colourRows, ...toAdd];
    onUpdateItem({
      ...item,
      colourQuantities: nextRows,
      colour: nextRows.map((r) => r.colour).filter(Boolean).join(", "),
      spec: {
        ...(item.spec || {}),
        colourQuantities: nextRows
      }
    });
  };

  const handleAddAntiqueSet = () => {
    const baseSet = ["Antique gold", "Antique silver", "Antique bronze"];
    const existing = new Set(colourRows.map((r) => r.colour));
    const toAdd = baseSet.filter((c) => !existing.has(c)).map((c) => ({ colour: c, colourCode: getPlatingSwatch(c), qty: 0, rate: item.budget || 0, noLabel: false }));
    const nextRows = [...colourRows, ...toAdd];
    onUpdateItem({
      ...item,
      colourQuantities: nextRows,
      colour: nextRows.map((r) => r.colour).filter(Boolean).join(", "),
      spec: {
        ...(item.spec || {}),
        colourQuantities: nextRows
      }
    });
  };

  const handleRemoveColourRow = (index) => {
    const nextRows = colourRows.filter((_, idx) => idx !== index);
    const totalQty = nextRows.reduce((sum, r) => sum + (parseInt(r.qty) || 0), 0);

    // Keep customFinishes intact even if row is removed - only deleted via Manage Saved drawer
    const savedCustoms = item.customFinishes || spec.customFinishes || [];

    onUpdateItem({
      ...item,
      qty: totalQty,
      customFinishes: savedCustoms,
      colourQuantities: nextRows,
      colour: nextRows.map((r) => r.colour).filter(Boolean).join(", "),
      spec: {
        ...(item.spec || {}),
        customFinishes: savedCustoms,
        colourQuantities: nextRows
      }
    });
  };

  const handleSaveCustomColor = () => {
    const trimmed = customColorName.trim();
    if (!trimmed) return;

    // 1. Update dynamic swatches map with user-selected customHex
    setDynamicSwatches((prev) => ({ ...prev, [trimmed]: customHex }));

    // 2. Add to custom finishes state
    setCustomMedalFinishes((prev) => Array.from(new Set([...prev, trimmed])));

    // 3. Prepare updated customFinishes array
    const existingCustoms = (item.customFinishes || spec.customFinishes || []).filter(
      (c) => (typeof c === "object" ? (c.colour || c.name) : c) !== trimmed
    );
    const customObj = {
      colour: trimmed,
      colourCode: customHex,
      isCustom: true
    };
    const updatedCustoms = [...existingCustoms, customObj];

    // 4. Add or update in colourRows with isCustom: true
    let nextRows = [...colourRows];
    const existingRowIdx = nextRows.findIndex((r) => r.colour === trimmed);
    if (existingRowIdx === -1) {
      nextRows.push({
        colour: trimmed,
        colourCode: customHex,
        isCustom: true,
        qty: 0,
        rate: item.budget || item.sizeRate || 0,
        noLabel: false
      });
    } else {
      nextRows[existingRowIdx] = {
        ...nextRows[existingRowIdx],
        colourCode: customHex,
        isCustom: true
      };
    }

    const totalQty = nextRows.reduce((sum, r) => sum + (parseInt(r.qty) || 0), 0);

    onUpdateItem({
      ...item,
      qty: totalQty,
      customFinishes: updatedCustoms,
      colourQuantities: nextRows,
      colour: nextRows.map((r) => r.colour).filter(Boolean).join(", "),
      spec: {
        ...(item.spec || {}),
        customFinishes: updatedCustoms,
        colourQuantities: nextRows
      }
    });

    setCustomColorName("");
    setCustomHex("#B08D57");
    setShowCustomColorPicker(false);
  };

  // Lapel Pin specific row & plating handlers
  const handleSetLapelRowPlating = (rIdx, plating) => {
    const existingRows = [...colourRows];
    const nextRows = existingRows.map((r, idx) => (idx === rIdx ? { ...r, colour: plating, colourCode: getPlatingSwatch(plating) } : r));
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
    const existingRows = [...colourRows];
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
    const existingRows = [...colourRows];
    const nextRows = existingRows.map((r, idx) => (idx === rIdx ? { ...r, rate: rateVal } : r));
    onUpdateItem({
      ...item,
      colourQuantities: nextRows,
      colour: nextRows.map((r) => r.colour).filter(Boolean).join(", ")
    });
  };

  const handleSetAllRates = (rateVal) => {
    const existingRows = [...colourRows];
    const nextRows = existingRows.map((r) => ({ ...r, rate: rateVal }));
    onUpdateItem({
      ...item,
      budget: rateVal,
      colourQuantities: nextRows,
      colour: nextRows.map((r) => r.colour).filter(Boolean).join(", ")
    });
  };

  const handleAddLapelColour = (colName) => {
    const existingRows = [...colourRows];
    if (existingRows.some((r) => r.colour === colName)) return;
    const newRow = { colour: colName, colourCode: getPlatingSwatch(colName), qty: 0, rate: item.budget || 0, noLabel: false };
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
      .map((c) => ({ colour: c, colourCode: getPlatingSwatch(c), qty: 0, rate: item.budget || 0, noLabel: false }));
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
    const nextRows = colourRows.filter((_, idx) => idx !== rIdx);
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
      } catch (e) {
        console.debug("Storage not available", e);
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

    // Clean up unnecessary redundant legacy fields so spec stays clean
    if (newSpec.sizeDimensions && Array.isArray(newSpec.sizeDimensions) && newSpec.sizeDimensions.length > 0) {
      delete newSpec.dimensions;
    }

    const isTrophyProduct = (productType || "").toLowerCase().includes("trophy") || (productType || "").toLowerCase().includes("memento");
    if (!isTrophyProduct) {
      delete newSpec.trophyW;
      delete newSpec.trophyD;
      delete newSpec.trophyH;
    }

    if (!isColourWise) {
      delete newSpec.colourQuantities;
      delete newSpec.colour;
      delete newSpec.customFinishes;
      delete newSpec.labelOption;
      delete newSpec.hasLabel;
      delete newSpec.rateByColour;
      delete newSpec.colourRows;
    } else {
      const activeColours = updates.colourQuantities !== undefined
        ? updates.colourQuantities
        : itemOverrides.colourQuantities !== undefined
          ? itemOverrides.colourQuantities
          : Array.isArray(item.colourQuantities)
            ? item.colourQuantities
            : (newSpec.colourQuantities || []);
      if (activeColours.length > 0) {
        newSpec.colourQuantities = activeColours;
      } else {
        delete newSpec.colourQuantities;
      }

      const activeColour = updates.colour !== undefined
        ? updates.colour
        : itemOverrides.colour !== undefined
          ? itemOverrides.colour
          : item.colour !== undefined
            ? item.colour
            : (newSpec.colour || "");
      if (activeColour && String(activeColour).trim()) {
        newSpec.colour = String(activeColour).trim();
      } else {
        delete newSpec.colour;
      }

      const activeCustoms = updates.customFinishes !== undefined
        ? updates.customFinishes
        : itemOverrides.customFinishes !== undefined
          ? itemOverrides.customFinishes
          : Array.isArray(item.customFinishes)
            ? item.customFinishes
            : (newSpec.customFinishes !== undefined ? newSpec.customFinishes : []);

      const cleanCustoms = Array.isArray(activeCustoms)
        ? activeCustoms.map((c) => {
            if (typeof c === "string") return { colour: c, colourCode: "#B08D57", isCustom: true };
            return {
              colour: c.colour || c.name || "",
              colourCode: c.colourCode || c.code || "#B08D57",
              isCustom: true
            };
          }).filter((c) => Boolean(c.colour))
        : [];

      if (cleanCustoms.length > 0) {
        newSpec.customFinishes = cleanCustoms;
      } else {
        delete newSpec.customFinishes;
      }
    }

    const nextItem = {
      ...item,
      ...itemOverrides,
      ...(!isColourWise
        ? {}
        : {
            colourQuantities: newSpec.colourQuantities || [],
            colour: newSpec.colour || "",
            customFinishes: newSpec.customFinishes || []
          }),
      spec: newSpec
    };
    if (!isColourWise) {
      delete nextItem.colourQuantities;
      delete nextItem.colour;
      delete nextItem.customFinishes;
    }
    if (itemOverrides.size !== undefined) {
      nextItem.size = itemOverrides.size;
    }
    if (itemOverrides.sizeDimensions !== undefined || updates.sizeDimensions !== undefined) {
      const sDims = itemOverrides.sizeDimensions || updates.sizeDimensions;
      nextItem.sizeDimensions = sDims;
      newSpec.sizeDimensions = sDims;
      delete nextItem.dimensions;
      delete newSpec.dimensions;
    }
    if (itemOverrides.sizeRate !== undefined || updates.sizeRate !== undefined) {
      const sRate = itemOverrides.sizeRate !== undefined ? itemOverrides.sizeRate : updates.sizeRate;
      nextItem.sizeRate = sRate;
      newSpec.sizeRate = sRate;
    }
    if (updates.designOptions !== undefined || itemOverrides.designOptions !== undefined) {
      const rawOpt = updates.designOptions !== undefined ? updates.designOptions : itemOverrides.designOptions;
      const dOpt = Math.min(5, Math.max(1, parseInt(rawOpt, 10) || 2));
      nextItem.designOptions = dOpt;
      nextItem.designOptionsCount = dOpt;
      newSpec.designOptions = dOpt;
    }
    if (itemOverrides.isCustomSize !== undefined || updates.isCustomSize !== undefined) {
      const isCust = itemOverrides.isCustomSize !== undefined ? itemOverrides.isCustomSize : updates.isCustomSize;
      nextItem.isCustomSize = isCust;
      newSpec.isCustomSize = isCust;
    }
    if (itemOverrides.isCustom !== undefined || updates.isCustom !== undefined) {
      const isCust = itemOverrides.isCustom !== undefined ? itemOverrides.isCustom : updates.isCustom;
      nextItem.isCustom = isCust;
      newSpec.isCustom = isCust;
    }
    if (itemOverrides.len !== undefined || updates.len !== undefined) {
      const lVal = itemOverrides.len !== undefined ? itemOverrides.len : updates.len;
      nextItem.len = lVal;
      newSpec.len = lVal;
    }
    if (itemOverrides.wid !== undefined || updates.wid !== undefined) {
      const wVal = itemOverrides.wid !== undefined ? itemOverrides.wid : updates.wid;
      nextItem.wid = wVal;
      newSpec.wid = wVal;
    }
    if (itemOverrides.budget !== undefined || updates.budget !== undefined || item.budget !== undefined) {
      const bgt = itemOverrides.budget !== undefined ? itemOverrides.budget : updates.budget !== undefined ? updates.budget : item.budget;
      nextItem.budget = bgt;
      newSpec.budget = bgt;
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

  const isModernProduct = Boolean(
    productConfig?.size_config?.layout === "two_column" ||
    productConfig?.size_config?.has_colour_wise_qty ||
    productConfig?.size_config?.size_mode === "colour_wise_qty" ||
    (productConfig?.size_config?.layout !== "classic" && productType !== "trophy" && productType !== "memento")
  );

  return (
    <div className="bg-white border border-gray-200 hover:border-indigo-300 rounded-2xl overflow-hidden transition shadow-xs">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
        <div className="flex items-center gap-2.5">
          <span className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center shadow-xs ${isModernProduct ? "bg-purple-100 text-[#4B3BF5]" : "bg-emerald-600 text-white"
            }`}>
            {isModernProduct ? iIdx + 1 : "✓"}
          </span>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-gray-900">
              {isModernProduct
                ? `Size ${iIdx + 1}`
                : `Size Line ${iIdx + 1}`}
            </span>
            {isModernProduct && item.size && (
              <span className="text-xs text-gray-400 font-normal">
                {item.size}
                {!String(item.size).includes("mm") && !String(item.size).includes('"') && curUnit === "mm" ? " mm" : ""}
                {!String(item.size).includes("mm") && !String(item.size).includes('"') && curUnit !== "mm" ? '"' : ""}
              </span>
            )}
            {!isModernProduct && item.size && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-semibold">
                {item.size}
                {!String(item.size).includes("mm") && !String(item.size).includes('"') && curUnit === "mm" ? " mm" : ""}
                {!String(item.size).includes("mm") && !String(item.size).includes('"') && curUnit !== "mm" ? '"' : ""}
              </span>
            )}
            {!isModernProduct && item.qty ? (
              <span className="text-xs text-gray-500 font-normal">
                · {item.qty} pcs
              </span>
            ) : null}
            {!isModernProduct && (item.sizeRate || item.budget) ? (
              <span className="text-xs text-gray-500 font-normal">
                · ≈ ₹{item.sizeRate || item.budget}/pc
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
              Remove size
            </button>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* 100% Dynamic Universal Product Size & Pricing Card */}
        <DynamicProductSizeCard
          item={item}
          spec={spec}
          group={group}
          gIdx={gIdx}
          iIdx={iIdx}
          productType={productType}
          productConfig={effectiveProductConfig || productConfig}
          unit={unit}
          setUnit={setUnit}
          isCustomSize={isCustomSize}
          setIsCustomSize={setIsCustomSize}
          getDynamicSizes={getDynamicSizes}
          getDynamicQuantities={getDynamicQuantities}
          updateSpec={updateSpec}
          onUpdateItem={onUpdateItem}
          currentEst={currentEst}
          liveSpecLine={liveSpecLine}
          isColourWise={isColourWise}
          isZinc={isZinc}
          colourRows={colourRows}
          availableColours={availableColours}
          getPlatingSwatch={getPlatingSwatch}
          handleUpdateColourRow={handleUpdateColourRow}
          handleRemoveColourRow={handleRemoveColourRow}
          handleAddColour={handleAddColour}
          handleSplitMedalLabel={handleSplitMedalLabel}
          showCustomColorPicker={showCustomColorPicker}
          setShowCustomColorPicker={setShowCustomColorPicker}
          customColorName={customColorName}
          setCustomColorName={setCustomColorName}
          customHex={customHex}
          setCustomHex={setCustomHex}
          handleSaveCustomColor={handleSaveCustomColor}
          customFinishes={item.customFinishes || spec.customFinishes || []}
          showManageCustomFinishes={showManageCustomFinishes}
          setShowManageCustomFinishes={setShowManageCustomFinishes}
          handleRemoveSavedCustomFinish={handleRemoveSavedCustomFinish}
          materials={materials}
          elements={elements}
        />
      </div>
    </div>
  );
};

export default ProductSpecificSizeCard;
