/**
 * Dynamic Validation Engine for CustomTrophyForm
 * Validates against MongoDB Product Configuration Master (design_fields and size_config).
 * Fully handles sub-type applicability, conditional visibility (show_if_field), and field aliases.
 */

export const getFieldValue = (group, fieldKey, fieldDef = null) => {
  if (!fieldKey || !group) return null;

  const spec = {
    ...(group.items?.[0]?.spec || {}),
    ...(group.spec || {}),
    ...(group.designSpec || {}),
  };

  let val = spec[fieldKey];

  if (val === undefined || val === null || val === "") {
    if (fieldDef?.is_locked) return fieldDef.locked_value || fieldDef.default_value;
    if (fieldDef?.field_type === "checkbox") return Boolean(fieldDef.default_checked);
    if (fieldDef?.field_type === "file_upload") return [];

    // Common field aliases & mappings
    if (fieldKey === "packaging") val = spec.pack || spec.packaging;
    else if (fieldKey === "pack") val = spec.packaging || spec.pack;
    else if (fieldKey === "personal") val = spec.names || spec.personal;
    else if (fieldKey === "names") val = spec.personal || spec.names;
    else if (fieldKey === "weight") val = spec.wt || spec.weight;
    else if (fieldKey === "wt") val = spec.weight || spec.wt;
    else if (fieldKey === "thickness") val = spec.thk || spec.thickness;
    else if (fieldKey === "thk") val = spec.thickness || spec.thk;
    else if (fieldKey === "layers") val = spec.layers || 1;
    else if (fieldKey === "colour") val = spec.color || spec.colour;
    else if (fieldKey === "color") val = spec.colour || spec.color;
    else if (fieldKey === "scrollType") val = spec.stype || spec.scrollType;
    else if (fieldKey === "stype") val = spec.scrollType || spec.stype;
    else if (fieldKey === "contentBy") val = spec.print || spec.contentBy;
    else if (fieldKey === "print") val = spec.contentBy || spec.print;

    // Check group root properties
    if ((val === undefined || val === null || val === "") && group[fieldKey] !== undefined) {
      val = group[fieldKey];
    }

    // Fuzzy match across spec keys by field_key or label
    if (val === undefined || val === null || val === "") {
      const targetKey = String(fieldKey || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const targetLabel = String(fieldDef?.label || "").toLowerCase().replace(/[^a-z0-9]/g, "");

      for (const [sk, sv] of Object.entries(spec)) {
        if (sv !== undefined && sv !== null && sv !== "") {
          const clean = String(sk).toLowerCase().replace(/[^a-z0-9]/g, "");
          if (
            clean === targetKey ||
            clean === targetLabel ||
            (targetKey.length >= 4 && clean.includes(targetKey)) ||
            (targetLabel.length >= 4 && clean.includes(targetLabel))
          ) {
            val = sv;
            break;
          }
        }
      }
    }

    if ((val === undefined || val === null || val === "") && fieldDef?.default_value) {
      val = fieldDef.default_value;
    }
  }

  return val;
};

export const computeGroupValidation = (
  group,
  activeProductConfigs = [],
  currentPType = "trophy",
  isTrophyProduct = true
) => {
  const missing = [];
  if (!group) return { isValid: false, missing: ["Product details"] };

  // 1. Theme / Design Name (Always required)
  if (!group.theme?.trim()) {
    missing.push("Design name");
  }

  // Find active product configuration from ProductConfigMaster (MongoDB)
  const activeProdConfig = activeProductConfigs.find(
    (p) => p.product_id === currentPType
  );

  const spec = {
    ...(group.items?.[0]?.spec || {}),
    ...(group.spec || {}),
    ...(group.designSpec || {}),
  };

  const curSub =
    spec.subType ||
    spec[`${currentPType}Type`] ||
    (currentPType === "medal" ? spec.medalType : undefined) ||
    (currentPType === "badge" ? spec.badgeType : undefined) ||
    group.subType ||
    group.type ||
    (activeProdConfig?.sub_types && activeProdConfig.sub_types[0]?.sub_id);

  // Helper to determine if a design field is satisfied
  const isFieldSatisfied = (f) => {
    if (f.is_locked) return true;
    if (f.field_type === "checkbox") return true;
    if (f.field_type === "file_upload") {
      if (!f.is_required && !f.required) return true;
      const files = spec[f.field_key];
      return Array.isArray(files) && files.length > 0;
    }
    const val = getFieldValue(group, f.field_key, f);
    if (val === undefined || val === null || val === "") return false;
    if (Array.isArray(val)) return val.length > 0;
    if (val === "+ Client colour" && !spec.clientColourText?.trim()) return false;
    return true;
  };

  // 2. What's the design? - DYNAMICALLY validate visible design fields for this sub-type
  if (
    activeProdConfig?.design_fields &&
    activeProdConfig.design_fields.length > 0
  ) {
    const baseFields = [...activeProdConfig.design_fields];

    const visibleDesignFields = baseFields.filter((field) => {
      // 1. Sub-type applicability filter (from DB applicable_sub_types)
      if (field.applicable_sub_types && field.applicable_sub_types.length > 0) {
        if (curSub && !field.applicable_sub_types.includes(curSub)) return false;
      } else if (curSub) {
        // If this field is generic (all sub-types), but there is a sub-type-specific field with the same key, hide generic
        const hasSpecificOverride = baseFields.some(
          (other) =>
            other !== field &&
            other.field_key === field.field_key &&
            other.applicable_sub_types &&
            other.applicable_sub_types.includes(curSub)
        );
        if (hasSpecificOverride) return false;
      }

      // 2. Dynamic conditional visibility (from DB show_if_field)
      if (field.show_if_field) {
        const parentField = baseFields.find(
          (f) => f.field_key === field.show_if_field
        );
        const parentVal =
          spec[field.show_if_field] ??
          getFieldValue(group, field.show_if_field, parentField) ??
          "";

        // Checkbox parent condition
        if (
          (parentField && parentField.field_type === "checkbox") ||
          field.show_if_condition === "checked" ||
          field.show_if_condition === "unchecked"
        ) {
          const isParentChecked = Boolean(parentVal);
          if (field.show_if_condition === "unchecked") {
            if (isParentChecked) return false;
          } else {
            // Default: show when checked / enabled
            if (!isParentChecked) return false;
          }
          return true;
        }

        if (!parentVal) return false;
        const pStr = String(parentVal).trim().toLowerCase();
        if (
          pStr === "no ribbon" ||
          pStr === "none" ||
          pStr === "off" ||
          pStr === "blank"
        ) {
          return false;
        }

        // Explicit condition check (equals, not_equals, in)
        if (
          field.show_if_condition === "equals" &&
          field.show_if_value !== undefined
        ) {
          if (pStr !== String(field.show_if_value).trim().toLowerCase())
            return false;
        }
        if (
          field.show_if_condition === "not_equals" &&
          field.show_if_value !== undefined
        ) {
          if (pStr === String(field.show_if_value).trim().toLowerCase())
            return false;
        }
        if (
          field.show_if_condition === "in" &&
          Array.isArray(field.show_if_value)
        ) {
          const allowedVals = field.show_if_value.map((v) =>
            String(v).trim().toLowerCase()
          );
          if (!allowedVals.includes(pStr)) return false;
        }

        // Option mapping visibility check
        if (
          field.option_mapping &&
          Object.keys(field.option_mapping).length > 0
        ) {
          const parentLower = String(parentVal).toLowerCase();
          const mappingKeys = Object.keys(field.option_mapping);
          const matchedKey = mappingKeys.find(
            (k) =>
              k.toLowerCase() === parentLower ||
              parentLower.includes(k.toLowerCase()) ||
              k.toLowerCase().includes(parentLower)
          );
          if (!matchedKey) return false;
          const allowed = field.option_mapping[matchedKey];
          if (!allowed || (Array.isArray(allowed) && allowed.length === 0))
            return false;
        }
      }

      return true;
    });

    visibleDesignFields.forEach((df) => {
      if (df.is_required || df.required) {
        // Custom trophy UI does not have a packaging selector
        if (
          isTrophyProduct &&
          String(df.field_key).toLowerCase().includes("pack")
        ) {
          return;
        }
        if (!isFieldSatisfied(df)) {
          missing.push(df.label || df.field_key);
        }
      }
    });
  }

  // For Custom Trophy, validate Trophy Type & Material from the UI
  if (isTrophyProduct) {
    if (group.isCustomType && !group.customType?.trim()) {
      missing.push("Custom trophy type");
    } else if (!group.type) {
      missing.push("Trophy type");
    }
    const mats =
      Array.isArray(group.mats) && group.mats.length > 0
        ? group.mats
        : group.mat
        ? [group.mat]
        : [];
    if (mats.length === 0) {
      missing.push("Material");
    }
  }

  // 3. Sizes & Rates - DYNAMICALLY validate based on size_config and every size card in group.items
  const sizeCfg = activeProdConfig?.size_config;
  const items = Array.isArray(group.items) ? group.items : [];

  if (items.length === 0) {
    missing.push("At least one size");
  } else {
    items.forEach((item, idx) => {
      const prefix = items.length > 1 ? `Size #${idx + 1}` : "Size";
      const itemSpec = item.spec || {};
      const sizeMode =
        sizeCfg?.size_mode ||
        (isTrophyProduct ? "height_dropdown" : "custom_2d");

      // 1. Dimensions / Measurement checks
      if (isTrophyProduct) {
        const cleanSize = String(item.size || itemSpec.trophyH || itemSpec.size || "").replace(/in|mm|"|sq/g, "").trim();
        if (!cleanSize || Number(cleanSize) <= 0) {
          missing.push(`${prefix}: Height`);
        }
      } else if (sizeMode === "custom_2d") {
        const rawSize = String(item.size || itemSpec.size || "").trim();
        const sDims = itemSpec.sizeDimensions || item.sizeDimensions || [];
        const dimL = sDims.find((d) => d.key === "length" || d.label?.toLowerCase() === "length")?.value;
        const dimB = sDims.find((d) => d.key === "breadth" || d.key === "width" || d.label?.toLowerCase() === "breadth" || d.label?.toLowerCase() === "width")?.value;

        let parsedL = 0;
        let parsedB = 0;
        if (rawSize.includes("×") || rawSize.includes("x")) {
          const parts = rawSize.replace(/in|mm|"|sq/g, "").split(/[×x]/);
          parsedL = Number(parts[0]?.trim()) || 0;
          parsedB = Number(parts[1]?.trim()) || 0;
        }

        const l = Number(
          itemSpec.len || itemSpec.customL || itemSpec.customW || item.w || dimL || parsedL || 0
        );
        const b = Number(
          itemSpec.wid || itemSpec.customB || itemSpec.customH || item.h || dimB || parsedB || 0
        );

        const isExplicitCustom =
          rawSize === "Custom" ||
          itemSpec.size === "Custom" ||
          ((itemSpec.isCustomSize || itemSpec.isCustom) && (l <= 0 || b <= 0));

        if (isExplicitCustom) {
          if (l <= 0) missing.push(`${prefix}: Length`);
          if (b <= 0) missing.push(`${prefix}: Breadth / Width`);
        } else if (!rawSize && l <= 0 && b <= 0) {
          missing.push(`${prefix}: ${sizeCfg?.size_row_title || "Size"}`);
        }
      } else if (sizeMode === "custom_1d") {
        const rawSize = String(item.size || itemSpec.pinSize || itemSpec.dia || itemSpec.size || "").trim();
        const sDims = itemSpec.sizeDimensions || item.sizeDimensions || [];
        const dimVal = sDims[0]?.value;
        const cleanVal = Number(String(rawSize || dimVal || 0).replace(/in|mm|"|sq/g, "").trim()) || 0;
        const d = Number(itemSpec.customSize || itemSpec.dia || cleanVal || 0);

        const isExplicitCustom =
          rawSize === "Custom" ||
          itemSpec.size === "Custom" ||
          ((itemSpec.isCustomSize || itemSpec.isCustom) && d <= 0);

        if (isExplicitCustom) {
          if (d <= 0) missing.push(`${prefix}: Custom Dimension`);
        } else if (!rawSize && d <= 0) {
          missing.push(`${prefix}: ${sizeCfg?.size_row_title || "Size"}`);
        }
      } else if (sizeMode === "colour_wise_qty") {
        if (!item.size && !itemSpec.dia && !itemSpec.size) {
          missing.push(`${prefix}: ${sizeCfg?.size_row_title || "Size"}`);
        }
      } else if (sizeMode === "fixed_sizes_only") {
        if (!item.size && !itemSpec.size) {
          missing.push(`${prefix}: ${sizeCfg?.size_row_title || "Size"}`);
        }
      } else {
        if (
          !item.size &&
          !itemSpec.size &&
          (!item.h || !item.w) &&
          !item.standardSize
        ) {
          missing.push(`${prefix}: ${sizeCfg?.size_row_title || "Size"}`);
        }
      }

      // 2. Quantity Check
      const itemQty = Number(item.qty) || 0;
      const hasQuantitiesArray =
        Array.isArray(item.quantities) &&
        item.quantities.length > 0 &&
        item.quantities.some((q) => Number(q) > 0);
      const hasColourQty =
        Array.isArray(item.colourQuantities) &&
        item.colourQuantities.length > 0 &&
        item.colourQuantities.some((cq) => Number(cq.qty) > 0);

      if (itemQty <= 0 && !hasQuantitiesArray && !hasColourQty) {
        missing.push(`${prefix}: Quantity`);
      }

      // 3. Approx. Rate Check
      const hasDirectBudget =
        item.budget !== undefined &&
        item.budget !== null &&
        item.budget !== "";
      const hasColourBudget =
        Array.isArray(item.colourQuantities) &&
        item.colourQuantities.length > 0 &&
        item.colourQuantities.every(
          (cq) => cq.rate !== undefined && cq.rate !== null && cq.rate !== ""
        );

      if (!hasDirectBudget && !hasColourBudget) {
        missing.push(`${prefix}: Approx. rate`);
      }

      // 4. Design Options Check (Required: minimum 1)
      const dOptions = itemSpec.designOptions || item.designOptions || 2;
      if (!dOptions || Number(dOptions) < 1) {
        missing.push(`${prefix}: Design options`);
      }
    });
  }

  return {
    isValid: missing.length === 0,
    missing,
  };
};
