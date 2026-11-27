import React from "react";
import { generateSpecLine } from "../../../utils/specLineGenerator";

/**
 * Universal Dynamic Renderer for Section 2 ("What's the design?")
 * Renders product questionnaire directly from ProductConfigMaster.design_fields.
 * Automatically synchronizes options, handles field aliases (packaging <-> pack, personal <-> names),
 * validates required fields, and provides live SPEC LINE summary.
 */
const DynamicDesignForm = ({
  group = {},
  gIdx = 0,
  productType = "",
  trophyGroups = [],
  setTrophyGroups = () => {},
  syncState = () => {},
  productConfig = null,
}) => {
  const spec = group.designSpec || {};

  // Resolve current sub-type (e.g. ms_punched vs zinc_cast for medal, name vs emblem for badge)
  const curSub =
    spec.subType ||
    spec[`${productType}Type`] ||
    (productType === "medal" ? spec.medalType : undefined) ||
    (productType === "badge" ? spec.badgeType : undefined) ||
    group.subType ||
    group.type ||
    (productConfig?.sub_types && productConfig.sub_types[0]?.sub_id);

  // 100% Dynamic Base Fields loaded directly from database (ProductConfigMaster.design_fields)
  const baseFields = [...(productConfig?.design_fields || [])];

  // Helper to extract current value for a given field definition
  const getFieldValue = (field) => {
    const k = field.field_key;
    let val = spec[k];

    if (val === undefined || val === null) {
      if (field.is_locked) return field.locked_value || field.default_value;
      if (field.field_type === "checkbox")
        return Boolean(field.default_checked);
      if (field.field_type === "file_upload") return [];
      if (k === "packaging") val = spec.pack;
      else if (k === "pack") val = spec.packaging;
      else if (k === "personal") val = spec.names;
      else if (k === "names") val = spec.personal;
      else if (k === "layers") val = spec.layers || 1;
      else if (k === "colour") val = spec.color;
      else if (k === "color") val = spec.colour;
      else if (k === "scrollType") val = spec.stype;
      else if (k === "stype") val = spec.scrollType;
      else if (k === "contentBy") val = spec.print;
      else if (k === "print") val = spec.contentBy;

      if ((val === undefined || val === null) && field.default_value) {
        val = field.default_value;
      }
    }

    return val;
  };

  // Check if a field has been satisfied
  const isFieldFilled = (field) => {
    if (field.is_locked) return true;
    if (field.field_type === "checkbox") return true;
    if (field.field_type === "file_upload") {
      if (!field.is_required) return true;
      const files = spec[field.field_key];
      return Array.isArray(files) && files.length > 0;
    }
    const val = getFieldValue(field);
    if (val === undefined || val === null || val === "") return false;
    if (Array.isArray(val)) return val.length > 0;
    if (val === "+ Client colour" && !spec.clientColourText?.trim())
      return false;
    return true;
  };

  // Dynamic Options Resolution from database (strictly from DB option_mapping, NO fallback)
  const getFieldOptionsForSpec = (field, currentSpec) => {
    const allOptions = field.options || [];
    if (!field.depends_on_field || !field.option_mapping) {
      return allOptions;
    }

    const parentField = baseFields.find(
      (f) => f.field_key === field.depends_on_field,
    );
    const parentVal =
      currentSpec[field.depends_on_field] ??
      getFieldValue(parentField || { field_key: field.depends_on_field }) ??
      "";
    if (!parentVal) return [];

    const parentLower = String(parentVal).toLowerCase();
    const mappingKeys = Object.keys(field.option_mapping);

    // Match exact or substring in DB option_mapping for this specific parent choice
    const matchedKey = mappingKeys.find(
      (k) =>
        k !== "*" &&
        (k.toLowerCase() === parentLower ||
          parentLower.includes(k.toLowerCase()) ||
          k.toLowerCase().includes(parentLower)),
    );

    // Strictly what DB option_mapping has for this matchedKey - NO fallback!
    const allowed = matchedKey ? field.option_mapping[matchedKey] : null;

    if (!allowed || !Array.isArray(allowed)) {
      return [];
    }

    return allOptions.filter((opt) => {
      const optVal =
        typeof opt === "object"
          ? opt.value !== undefined
            ? opt.value
            : opt.label
          : String(opt);
      return allowed.includes(optVal);
    });
  };

  // Update design spec with live group propagation and alias normalization
  const updateDesignSpec = (updates) => {
    const updated = [...trophyGroups];
    const normalized = { ...updates };

    // Keep packaging and pack aliases in sync
    if ("packaging" in updates) normalized.pack = updates.packaging;
    if ("pack" in updates) normalized.packaging = updates.pack;

    // Keep personal and names aliases in sync
    if ("personal" in updates) normalized.names = updates.personal;
    if ("names" in updates) normalized.personal = updates.names;

    // Keep scrollType and stype aliases in sync
    if ("scrollType" in updates) normalized.stype = updates.scrollType;
    if ("stype" in updates) normalized.scrollType = updates.stype;

    // Keep contentBy and print aliases in sync
    if ("contentBy" in updates) normalized.print = updates.contentBy;
    if ("print" in updates) normalized.contentBy = updates.print;

    // Auto-sync label / die face aliases for medals & badges
    Object.keys(updates).forEach((k) => {
      const lower = k.toLowerCase();
      if (
        lower === "front_has_label" ||
        lower === "zinc_front_has_label" ||
        lower === "back_has_label" ||
        lower === "zinc_back_has_label" ||
        lower === "haslabel" ||
        lower === "hasmedallabel" ||
        lower === "dielabel" ||
        lower === "hasdielabel" ||
        lower === "haslaba" ||
        lower === "extralabel" ||
        lower === "extra_label" ||
        (lower.includes("label") && (typeof updates[k] === "boolean" || updates[k] === "true" || updates[k] === "false"))
      ) {
        const flagVal = Boolean(updates[k]);
        normalized.hasLabel = flagVal;
        normalized.hasMedalLabel = flagVal;
        normalized.dieLabel = flagVal;
        normalized.hasDieLabel = flagVal;
        normalized.hasLabA = flagVal;
      }
    });

    // If a changed field has dependent fields, dynamically re-validate against DB option_mapping
    Object.keys(normalized).forEach((changedKey) => {
      baseFields.forEach((field) => {
        if (field.depends_on_field === changedKey && field.option_mapping) {
          const allowedOpts = getFieldOptionsForSpec(field, {
            ...spec,
            ...normalized,
          });
          const allowedValues = allowedOpts.map((o) =>
            typeof o === "object"
              ? o.value !== undefined
                ? o.value
                : o.label
              : String(o),
          );
          const currentVal = spec[field.field_key];
          if (
            currentVal &&
            !allowedValues.includes(currentVal) &&
            currentVal !== "+ Client colour" &&
            !spec.isClientColour
          ) {
            normalized[field.field_key] = allowedValues[0] || null;
          }
        }
      });
    });

    const curGroup = updated[gIdx] || {};
    const newSpec = { ...(curGroup.designSpec || {}), ...normalized };

    let newMat = curGroup.mat;
    let newMats = curGroup.mats;
    if (normalized.material) {
      newMat = normalized.material;
      newMats = [normalized.material];
    }
    let newShape = curGroup.shape;
    if (normalized.shape) {
      newShape = normalized.shape;
    }

    // Propagate spec to all items in this product group
    let newItems = curGroup.items;
    if (Array.isArray(curGroup.items)) {
      newItems = curGroup.items.map((it) => {
        const itemSpec = {
          ...(it.spec || {}),
          ...newSpec,
        };
        return {
          ...it,
          spec: itemSpec,
          specLine: generateSpecLine(productType, itemSpec, { ...curGroup, designSpec: newSpec }),
        };
      });
    }

    updated[gIdx] = {
      ...curGroup,
      designSpec: newSpec,
      mat: newMat,
      mats: newMats,
      shape: newShape,
      items: newItems,
    };

    setTrophyGroups(updated);
    if (typeof syncState === "function") {
      syncState(updated);
    }
  };


  // Dynamic filter: applicable to current sub-type and dynamic conditional visibility (from DB show_if_field)
  const visibleFields = baseFields.filter((field) => {
    // 1. Sub-type applicability filter (from DB applicable_sub_types)
    if (field.applicable_sub_types && field.applicable_sub_types.length > 0) {
      if (!field.applicable_sub_types.includes(curSub)) return false;
    } else if (curSub) {
      // If this field is generic (all sub-types), but there is a sub-type-specific field with the same key, hide generic
      const hasSpecificOverride = baseFields.some(
        (other) =>
          other !== field &&
          other.field_key === field.field_key &&
          other.applicable_sub_types &&
          other.applicable_sub_types.includes(curSub),
      );
      if (hasSpecificOverride) return false;
    }
    // 2. Dynamic conditional visibility (from DB show_if_field)
    if (field.show_if_field) {
      const parentField = baseFields.find(
        (f) => f.field_key === field.show_if_field,
      );
      const parentVal =
        spec[field.show_if_field] ??
        getFieldValue(parentField || { field_key: field.show_if_field }) ??
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
      if (pStr === "no ribbon" || pStr === "none" || pStr === "off") {
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
          String(v).trim().toLowerCase(),
        );
        if (!allowedVals.includes(pStr)) return false;
      }

      if (
        field.option_mapping &&
        Object.keys(field.option_mapping).length > 0
      ) {
        if (
          field.field_type === "number" ||
          field.field_type === "text" ||
          field.field_type === "textarea" ||
          field.field_type === "checkbox" ||
          field.field_type === "file_upload" ||
          field.is_locked
        ) {
          const parentLower = String(parentVal).toLowerCase();
          const mappingKeys = Object.keys(field.option_mapping);
          const matchedKey = mappingKeys.find(
            (k) =>
              k.toLowerCase() === parentLower ||
              parentLower.includes(k.toLowerCase()) ||
              k.toLowerCase().includes(parentLower),
          );
          if (!matchedKey) return false;
          const allowed = field.option_mapping[matchedKey];
          if (!allowed || (Array.isArray(allowed) && allowed.length === 0))
            return false;
        } else {
          const curOpts = getFieldOptionsForSpec(field, spec);
          if (curOpts.length === 0) return false;
        }
      }
    }
    return true;
  });

  const getFieldOptions = (field) => getFieldOptionsForSpec(field, spec);

  // Dynamic Subtext (100% from DB field.sub_text)
  const getFieldSubText = (field) => field.sub_text || "";

  // Dynamic Required Status (100% from DB field.is_required)
  const isFieldRequired = (field) => Boolean(field.is_required);

  // Calculate missing required fields dynamically
  const missingRequired = visibleFields
    .filter((f) => isFieldRequired(f) && !isFieldFilled(f))
    .map((f) => f.label);

  // Generic File upload handlers for any dynamic file_upload field
  const handleFieldFileUpload = (fieldKey, files) => {
    if (!files || !files.length) return;
    const existing = spec[fieldKey] || [];
    const newFiles = Array.from(files).map((f) => ({
      name: f.name,
      size: Math.round(f.size / 1024),
      type: f.type,
      at: new Date().toISOString(),
    }));
    updateDesignSpec({ [fieldKey]: [...existing, ...newFiles] });
  };

  const handleFieldRemoveFile = (fieldKey, name) => {
    const existing = spec[fieldKey] || [];
    updateDesignSpec({ [fieldKey]: existing.filter((f) => f.name !== name) });
  };

  // Legacy file upload handlers for medal artwork
  const handleFileUpload = (face, files) => {
    handleFieldFileUpload(face === "A" ? "filesA" : "filesB", files);
  };

  const handleRemoveFile = (face, name) => {
    handleFieldRemoveFile(face === "A" ? "filesA" : "filesB", name);
  };

  return (
    <div className="space-y-3">
      {/* Dynamic Specification Table Card */}
      <div className="border border-gray-200 rounded-2xl bg-white shadow-2xs divide-y divide-gray-100 overflow-hidden">
        {/* Dynamic Fields Rows */}
        {visibleFields.map((field) => {
          const val = getFieldValue(field);
          const isReq = isFieldRequired(field);
          const filled = isFieldFilled(field);
          const subText = getFieldSubText(field);
          const fieldOpts = getFieldOptions(field);
          const isColourField =
            field.field_key === "colour" || field.field_key === "color";
          const baseOptValues = fieldOpts.map((o) =>
            typeof o === "object"
              ? o.value !== undefined
                ? o.value
                : o.label
              : String(o),
          );

          // Check if Client Colour is selected/active
          const isClientColourActive =
            isColourField &&
            (spec.isClientColour ||
              val === "+ Client colour" ||
              (val &&
                !baseOptValues
                  .filter((x) => x !== "+ Client colour")
                  .includes(val)));

          return (
            <div
              key={field.field_key || field.label}
              className="p-3.5 flex flex-col sm:flex-row items-start gap-2.5 sm:gap-4"
            >
              {/* Left Column: Label, Required badge, Subtext */}
              <div className="w-full sm:w-44 shrink-0 pt-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-xs text-gray-800">
                    {field.label}
                  </span>
                  {isReq && (
                    <span
                      className={`text-[11px] font-semibold ${
                        filled ? "text-emerald-600" : "text-[#B45309]"
                      }`}
                    >
                      · required
                    </span>
                  )}
                </div>
                {subText && (
                  <span className="text-[11px] text-gray-400 font-normal block leading-tight mt-0.5">
                    {subText}
                  </span>
                )}
              </div>

              {/* Right Column: Dynamic Input Component */}
              <div className="flex-1 flex flex-col gap-2">
                {field.is_locked ? (
                  /* 1. Locked / Read-only field */
                  <div className="flex gap-2 flex-wrap items-center">
                    <div className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200 flex items-center gap-1.5 shadow-2xs">
                      <span>🔒</span>
                      <span>
                        {field.locked_value || field.default_value || val}
                      </span>
                    </div>
                  </div>
                ) : field.field_type === "textarea" ||
                  field.field_key === "notes" ? (
                  /* 2. Textarea / Multiline Notes */
                  <textarea
                    rows={2}
                    className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-y transition shadow-2xs placeholder:text-gray-400"
                    placeholder={field.placeholder || "Optional"}
                    value={val || ""}
                    onChange={(e) =>
                      updateDesignSpec({ [field.field_key]: e.target.value })
                    }
                  />
                ) : field.field_type === "number" ||
                  field.field_key === "layers" ? (
                  /* 3. Number Input with outer suffix */
                  <div className="flex flex-col gap-1.5 self-start">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        className="w-24 px-3 py-1.5 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 bg-white outline-none focus:border-[#4B3BF5] focus:ring-1 focus:ring-[#4B3BF5] shadow-2xs"
                        placeholder={field.placeholder || "0"}
                        value={val !== undefined && val !== null ? val : ""}
                        onChange={(e) =>
                          updateDesignSpec({
                            [field.field_key]: e.target.value,
                          })
                        }
                      />
                      {(field.unit ||
                        (field.field_key === "layers"
                          ? Number(val || 1) > 1
                            ? "layers"
                            : "layer"
                          : "")) && (
                        <span className="text-xs font-bold text-gray-600 select-none">
                          {field.unit ||
                            (field.field_key === "layers"
                              ? Number(val || 1) > 1
                                ? "layers"
                                : "layer"
                              : "")}
                        </span>
                      )}
                    </div>
                    {/* Optional Quick-Click Preset Chips if defined in Master */}
                    {fieldOpts && fieldOpts.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap items-center mt-0.5">
                        {fieldOpts.map((opt) => {
                          const optLabel =
                            typeof opt === "object"
                              ? opt.label || opt.value
                              : String(opt);
                          const optVal =
                            typeof opt === "object"
                              ? opt.value !== undefined
                                ? opt.value
                                : opt.label
                              : String(opt);
                          const isSel = String(val) === String(optVal);

                          return (
                            <button
                              key={optVal}
                              type="button"
                              className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition shadow-2xs ${
                                isSel
                                  ? "bg-[#4B3BF5] text-white border border-[#4B3BF5] font-semibold shadow-xs"
                                  : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                              }`}
                              onClick={() =>
                                updateDesignSpec({ [field.field_key]: optVal })
                              }
                            >
                              {optLabel}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : field.field_type === "text" ? (
                  /* 4. Simple Text input */
                  <div className="flex items-center gap-2 self-start">
                    <input
                      type="text"
                      className="text-xs px-3 py-1.5 border border-gray-300 rounded-xl focus:border-indigo-500 outline-none shadow-2xs"
                      placeholder={field.placeholder || ""}
                      value={val || ""}
                      onChange={(e) =>
                        updateDesignSpec({ [field.field_key]: e.target.value })
                      }
                    />
                    {field.unit && (
                      <span className="text-xs font-bold text-gray-600 select-none">
                        {field.unit}
                      </span>
                    )}
                  </div>
                ) : field.field_type === "checkbox" ? (
                  /* 4a. Checkbox / Toggle Field */
                  <label
                    className={`inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl border-2 transition cursor-pointer select-none self-start ${
                      val
                        ? "bg-indigo-50/80 border-[#4B3BF5] text-indigo-950 font-bold shadow-xs"
                        : "bg-white border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50 font-medium"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(val)}
                      onChange={(e) =>
                        updateDesignSpec({
                          [field.field_key]: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-[#4B3BF5] focus:ring-[#4B3BF5] cursor-pointer"
                    />
                    <span className="text-xs">
                      {field.checkbox_label ||
                        field.label ||
                        "Add a label on this die face"}
                    </span>
                    {Boolean(val) && (
                      <span className="text-xs text-[#4B3BF5] font-bold">
                        ✓
                      </span>
                    )}
                  </label>
                ) : field.field_type === "file_upload" ? (
                  /* 4b. Dynamic File Upload Dropzone + File Chips */
                  <div className="w-full max-w-lg space-y-2">
                    <label className="flex items-center gap-3 p-3 border-2 border-dashed border-indigo-200 hover:border-[#4B3BF5] hover:bg-indigo-50/30 rounded-xl cursor-pointer transition bg-gray-50/50">
                      <input
                        type="file"
                        multiple={field.allow_multiple !== false}
                        accept={
                          field.allowed_extensions &&
                          field.allowed_extensions.length > 0
                            ? field.allowed_extensions
                                .map((x) => `.${x.toLowerCase()}`)
                                .join(",") + ",image/*"
                            : "image/*,.pdf,.ai,.cdr,.eps,.svg,.psd,.zip"
                        }
                        hidden
                        onChange={(e) => {
                          handleFieldFileUpload(
                            field.field_key,
                            e.target.files,
                          );
                          e.target.value = "";
                        }}
                      />
                      <span className="w-9 h-9 rounded-xl bg-indigo-50 text-[#4B3BF5] flex items-center justify-center text-lg shrink-0">
                        📎
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-gray-800 block">
                          Upload {field.label?.toLowerCase() || "artwork"}
                        </span>
                        <span className="text-[11px] text-gray-400 block truncate">
                          {field.upload_hint ||
                            "Logo, design or reference · AI, CDR, PDF, SVG, PNG, JPG"}
                        </span>
                      </div>
                      <span className="px-2.5 py-1 bg-white border border-indigo-200 text-[#4B3BF5] rounded-lg text-[11px] font-bold shadow-2xs shrink-0">
                        Browse
                      </span>
                    </label>

                    {/* Uploaded File Chips */}
                    {Array.isArray(val) && val.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {val.map((fl) => (
                          <span
                            key={fl.name}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-900 shadow-2xs"
                          >
                            <span>📎</span>
                            <span className="truncate max-w-[150px]">
                              {fl.name}
                            </span>
                            <small className="text-indigo-400 font-normal">
                              ({fl.size || fl.kb || 0} KB)
                            </small>
                            <button
                              type="button"
                              onClick={() =>
                                handleFieldRemoveFile(field.field_key, fl.name)
                              }
                              className="text-indigo-400 hover:text-red-600 font-bold ml-0.5 cursor-pointer"
                              title={`Remove ${fl.name}`}
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : field.selection_mode === "multiple" ||
                  field.field_type === "multi_pills" ? (
                  /* 5. Multi-selection pills */
                  <div className="flex gap-2 flex-wrap items-center">
                    {fieldOpts.map((opt) => {
                      const optLabel =
                        typeof opt === "object"
                          ? opt.label || opt.value
                          : String(opt);
                      const optVal =
                        typeof opt === "object"
                          ? opt.value !== undefined
                            ? opt.value
                            : opt.label
                          : String(opt);
                      const isUsual =
                        typeof opt === "object" ? Boolean(opt.is_usual) : false;
                      const optIcon = typeof opt === "object" ? opt.icon : null;

                      const curArr = Array.isArray(val)
                        ? val
                        : val
                          ? [val]
                          : [];
                      const isSel = curArr.includes(optVal);

                      const toggle = () => {
                        const next = isSel
                          ? curArr.filter((x) => x !== optVal)
                          : [...curArr, optVal];
                        updateDesignSpec({ [field.field_key]: next });
                      };

                      return (
                        <button
                          key={optVal}
                          type="button"
                          className={`px-3.5 py-1.5 rounded-full text-xs font-medium cursor-pointer transition shadow-2xs flex items-center gap-1.5 ${
                            isSel
                              ? "bg-[#4B3BF5] text-white border border-[#4B3BF5] font-semibold shadow-xs"
                              : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                          }`}
                          onClick={toggle}
                        >
                          {optIcon && <span>{optIcon}</span>}
                          <span>{optLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  /* 6. Single-choice pills (with Client Colour custom textbox support) */
                  <>
                    <div className="flex gap-2 flex-wrap items-center">
                      {fieldOpts.map((opt) => {
                        const optLabel =
                          typeof opt === "object"
                            ? opt.label || opt.value
                            : String(opt);
                        const optVal =
                          typeof opt === "object"
                            ? opt.value !== undefined
                              ? opt.value
                              : opt.label
                            : String(opt);
                        const isUsual =
                          typeof opt === "object"
                            ? Boolean(opt.is_usual)
                            : false;
                        const optIcon =
                          typeof opt === "object" ? opt.icon : null;

                        const isClientColourOpt = optVal === "+ Client colour";
                        const isSel = isClientColourOpt
                          ? isClientColourActive
                          : String(val) === String(optVal) &&
                            !isClientColourActive;

                        const handleClick = () => {
                          if (isClientColourOpt) {
                            const nextActive = !isClientColourActive;
                            updateDesignSpec({
                              isClientColour: nextActive,
                              colour: nextActive
                                ? spec.clientColourText || "+ Client colour"
                                : null,
                              color: nextActive
                                ? spec.clientColourText || "+ Client colour"
                                : null,
                            });
                          } else {
                            updateDesignSpec({
                              [field.field_key]: isSel ? null : optVal,
                              isClientColour: false,
                              clientColourText: "",
                            });
                          }
                        };

                        // Amber dashed highlight for unselected usual packaging
                        const isPackagingUsualUnsel = false;

                        return (
                          <button
                            key={optVal}
                            type="button"
                            className={`px-3.5 py-1.5 rounded-full text-xs font-medium cursor-pointer transition shadow-2xs flex items-center gap-1.5 ${
                              isSel
                                ? "bg-[#4B3BF5] text-white border border-[#4B3BF5] font-semibold shadow-xs"
                                : isPackagingUsualUnsel
                                  ? "border-2 border-dashed border-amber-400 bg-amber-50/50 text-amber-950 hover:bg-amber-100/60 font-semibold"
                                  : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                            }`}
                            onClick={handleClick}
                          >
                            {isPackagingUsualUnsel && (
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 inline-block" />
                            )}
                            {optIcon && <span>{optIcon}</span>}
                            <span>{optLabel}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Dedicated Dynamic Custom Input Textbox (When an option with has_custom_input is selected) */}
                    {(() => {
                      const activeCustomOpt = fieldOpts.find((o) => {
                        const oVal =
                          typeof o === "object"
                            ? o.value !== undefined
                              ? o.value
                              : o.label
                            : String(o);
                        const oHasCustom =
                          (typeof o === "object" &&
                            Boolean(o.has_custom_input)) ||
                          oVal === "+ Client colour" ||
                          String(oVal).startsWith("+ ");
                        if (!oHasCustom) return false;
                        return (
                          String(val) === String(oVal) ||
                          (spec[`${field.field_key}_custom`] &&
                            val === spec[`${field.field_key}_custom`]) ||
                          (oVal === "+ Client colour" && isClientColourActive)
                        );
                      });

                      if (!activeCustomOpt) return null;

                      const customOptObj =
                        typeof activeCustomOpt === "object"
                          ? activeCustomOpt
                          : { label: activeCustomOpt, value: activeCustomOpt };
                      const boxLabel = customOptObj.custom_input_label;
                      const boxPlaceholder =
                        customOptObj.custom_input_placeholder ||
                        (customOptObj.value === "+ Client colour"
                          ? "Client colour"
                          : `Enter ${customOptObj.label || "custom details"}`);

                      const curVal =
                        field.field_key === "colour" ||
                        field.field_key === "color"
                          ? (spec.clientColourText ??
                            (val !== "+ Client colour" ? val || "" : ""))
                          : (spec[`${field.field_key}_custom`] ??
                            (val !== customOptObj.value ? val || "" : ""));

                      return (
                        <div className="w-full max-w-md pt-1.5 space-y-1">
                          {boxLabel && (
                            <label className="text-[11px] font-bold text-gray-700 block">
                              {boxLabel}
                            </label>
                          )}
                          <input
                            type="text"
                            className="w-full text-xs px-3.5 py-2.5 border border-indigo-300 rounded-xl focus:border-[#4B3BF5] focus:ring-1 focus:ring-[#4B3BF5] outline-none shadow-2xs bg-white text-gray-900 placeholder:text-gray-400 font-medium transition"
                            placeholder={boxPlaceholder}
                            value={curVal}
                            onChange={(e) => {
                              const txt = e.target.value;
                              const updates = {
                                [`${field.field_key}_custom`]: txt,
                                [field.field_key]: txt || customOptObj.value,
                              };
                              if (
                                field.field_key === "colour" ||
                                field.field_key === "color"
                              ) {
                                updates.colour = txt;
                                updates.color = txt;
                                updates.clientColourText = txt;
                                updates.isClientColour = true;
                              }
                              updateDesignSpec(updates);
                            }}
                            autoFocus
                          />
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* SPEC LINE Card */}
      <div className="rounded-xl bg-[#131226] text-white p-3.5 shadow-sm space-y-1">
        <div className="flex items-center justify-between text-[10px] font-bold tracking-wider uppercase text-gray-400">
          <span>SPEC LINE</span>
        </div>
        <div className="text-xs font-medium text-gray-100 break-words">
          {generateSpecLine(productType, spec, group) ||
            `${productConfig?.name || productType}`}
        </div>
        {missingRequired.length > 0 && (
          <div className="text-[11px] font-medium text-amber-400 pt-1 flex items-center gap-1.5">
            <span>Still needed:</span>
            <span className="font-semibold text-amber-300">
              {missingRequired.join("; ")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DynamicDesignForm;
