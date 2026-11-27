/**
 * 100% Strictly Master Database Driven (MongoDB ProductConfigMaster) - Zero Hardcoded Values
 * Returns the Default Indicative Rate (default_budget) configured in ProductConfigMaster.
 * Never mirrors item.budget so user typing/clearing the input box does not mutate "our estimate".
 */
export const calculateProductEstimate = (
  productType,
  spec = {},
  item = {},
  group = {},
  masterMaterials = [],
  masterElements = [],
  productConfig = null
) => {
  const sizeCfg = productConfig?.size_config || {};

  // 1. Direct configured default_budget in ProductConfigMaster (MongoDB)
  const masterDefaultBudget = Number(sizeCfg.default_budget || productConfig?.default_budget || 0);
  if (masterDefaultBudget > 0) {
    return masterDefaultBudget;
  }

  // 2. Sub-type specific default budget
  const subTypeId = spec.subType || item.subType || group.subType;
  if (subTypeId && sizeCfg.sub_type_budgets?.[subTypeId]) {
    const subBudget = Number(sizeCfg.sub_type_budgets[subTypeId]);
    if (subBudget > 0) return subBudget;
  }

  // 3. Preset sizes configured with dedicated rates from Master
  const curSizeStr = String(item.size || spec.size || "").trim();
  const allPresets = [
    ...(sizeCfg.preset_sizes || []),
    ...((sizeCfg.dimensions || []).flatMap((d) => d.preset_sizes || [])),
  ];
  if (curSizeStr && allPresets.length > 0) {
    const cleanCur = curSizeStr.replace(/in|mm|"|sq/g, "").trim();
    const matched = allPresets.find((p) => {
      const pVal = String(p.value || p.label || p).replace(/in|mm|"|sq/g, "").trim();
      return pVal === cleanCur;
    });
    if (matched && Number(matched.rate || matched.budget) > 0) {
      return Number(matched.rate || matched.budget);
    }
  }

  // 4. Product Presets from ProductConfigMaster (MongoDB)
  const presets = productConfig?.presets || [];
  if (Array.isArray(presets) && presets.length > 0) {
    const pBudget = Number(presets[0]?.budget || 0);
    if (pBudget > 0) return pBudget;
  }

  return 0;
};

export const calculateDynamicEstimate = () => 0;

export default {
  calculateDynamicEstimate,
  calculateProductEstimate,
};
