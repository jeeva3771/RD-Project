import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { toast } from "react-toastify";
import EmojiHelpTooltip from "./EmojiHelpTooltip";
import { fetchConstructions } from "../../../reducer/masters/enquiryFlow/constructionMasterReducer";
import ProductConfigSizeTab from "./components/ProductConfigSizeTab";

const SIZE_MODES = [
  { value: "custom_2d", label: "2D Dimensions (L × B in/mm)", desc: "e.g. Scroll, Fridge Magnet, Frame" },
  { value: "custom_1d", label: "1D Dimension (Diameter / Height)", desc: "e.g. Coasters, Flag stand, Cufflinks, Tie bar" },
  { value: "height_dropdown", label: "Height Dropdown (Inches & mm)", desc: "e.g. Trophy & Mementos" },
  { value: "colour_wise_qty", label: "Colour-wise Quantity Table", desc: "e.g. Lapel pin, Name Badge, Emblem" },
  { value: "fixed_sizes_only", label: "Fixed Preset Sizes Only", desc: "e.g. Readymade standard items" },
  { value: "multi_dimensions", label: "Custom Multi-Dimensions", desc: "e.g. Height, Length, Width, Thickness" },
];

const ROUTE_TYPES = ["In-house", "Outsourced", "Partly in-house"];

const ProductConfigMasterForm = ({
  formData,
  errors,
  isSubmitting,
  onInputChange,
  setFormData,
  onSubmit,
  currentId,
  handleReset,
}) => {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState("basic"); // "basic", "design", "size", "presets"
  const [designSubFilter, setDesignSubFilter] = useState(() => {
    if (formData?.has_sub_types && (formData?.sub_types || []).length > 0) {
      return formData.sub_types[0].sub_id;
    }
    return "all";
  });

  useEffect(() => {
    if (formData?.has_sub_types && (formData?.sub_types || []).length > 0) {
      if (designSubFilter === "all" || !formData.sub_types.some((s) => s.sub_id === designSubFilter)) {
        setDesignSubFilter(formData.sub_types[0].sub_id);
      }
    } else if (!formData?.has_sub_types && designSubFilter !== "all") {
      setDesignSubFilter("all");
    }
  }, [formData?.has_sub_types, formData?.sub_types, designSubFilter]);

  // Accordion state for question rows in "What's the design?"
  const [expandedFields, setExpandedFields] = useState({});

  const toggleFieldAccordion = (fieldId, defaultState = false) => {
    setExpandedFields((prev) => {
      const current = prev[fieldId] !== undefined ? prev[fieldId] : defaultState;
      return { ...prev, [fieldId]: !current };
    });
  };

  const handleExpandAllFields = () => {
    const next = {};
    (formData.design_fields || []).forEach((field, i) => {
      const id = field._clientId || field._id || field.field_key || `field_${i}`;
      next[id] = true;
    });
    setExpandedFields(next);
  };

  const handleCollapseAllFields = () => {
    const next = {};
    (formData.design_fields || []).forEach((field, i) => {
      const id = field._clientId || field._id || field.field_key || `field_${i}`;
      next[id] = false;
    });
    setExpandedFields(next);
  };

  // 0. Sub-Types Handlers
  const handleAddSubType = () => {
    setFormData((prev) => ({
      ...prev,
      has_sub_types: true,
      sub_types: [
        ...(prev.sub_types || []),
        {
          sub_id: `sub_${Date.now()}`,
          label: "New Sub-Category",
          icon: "📦",
          sub_text: "",
          is_active: true,
        },
      ],
    }));
  };

  const handleRemoveSubType = (sIdx) => {
    setFormData((prev) => ({
      ...prev,
      sub_types: (prev.sub_types || []).filter((_, idx) => idx !== sIdx),
    }));
  };

  const handleSubTypeChange = (sIdx, key, val) => {
    setFormData((prev) => {
      const nextSubs = (prev.sub_types || []).map((sub, i) =>
        i === sIdx ? { ...sub, [key]: val } : sub
      );
      return { ...prev, sub_types: nextSubs };
    });
  };

  // 1. Questionnaire Fields Handlers
  const handleAddField = () => {
    const newClientId = `df_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setFormData((prev) => ({
      ...prev,
      design_fields: [
        ...(prev.design_fields || []),
        {
          _clientId: newClientId,
          field_key: `field_${Date.now()}`,
          label: "New Option",
          sub_text: "",
          field_type: "pills",
          is_required: false,
          default_value: "",
          applicable_sub_types: designSubFilter !== "all" ? [designSubFilter] : [],
          options: [
            { label: "Option 1", value: "Option 1", is_usual: true },
            { label: "Option 2", value: "Option 2", is_usual: false },
          ],
        },
      ],
    }));
    setExpandedFields((prev) => ({ ...prev, [newClientId]: true }));
  };

  // Safe mutator for design fields respecting sub-type isolation
  const updateDesignField = (fIdx, mutatorFn, options = {}) => {
    setFormData((prev) => {
      const fields = [...(prev.design_fields || [])];
      const targetField = fields[fIdx];
      if (!targetField) return prev;

      // Check if this field should be isolated for the current sub-type
      const allSubIds = (prev.sub_types || []).map((s) => s.sub_id);
      const isFilteredToSub = prev.has_sub_types && designSubFilter && designSubFilter !== "all";
      const curCovered = (targetField.applicable_sub_types && targetField.applicable_sub_types.length > 0)
        ? targetField.applicable_sub_types
        : allSubIds;
      const otherSubIds = isFilteredToSub ? curCovered.filter((id) => id !== designSubFilter) : [];
      const needsFork = isFilteredToSub && otherSubIds.length > 0 && !options.skipFork;

      if (needsFork) {
        // 1. Dedicated copy strictly for active sub-type
        const dedicatedField = JSON.parse(JSON.stringify(targetField));
        dedicatedField._clientId = `df_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        dedicatedField.applicable_sub_types = [designSubFilter];

        // 2. Sibling retains original untouched configuration for remaining sub-types
        const siblingField = JSON.parse(JSON.stringify(targetField));
        siblingField._clientId = `df_${Date.now() + 1}_${Math.random().toString(36).slice(2, 7)}`;
        siblingField.applicable_sub_types = otherSubIds;

        // Apply mutation to dedicated field
        mutatorFn(dedicatedField);

        // Replace target with dedicated field and insert sibling right after it
        fields[fIdx] = dedicatedField;
        fields.splice(fIdx + 1, 0, siblingField);

        // Keep accordion open for the new dedicated field
        setExpandedFields((exp) => ({ ...exp, [dedicatedField._clientId]: true }));

        return { ...prev, design_fields: fields };
      }

      // Normal in-place mutation (already dedicated to this sub-type, or in "all" view, or skipFork)
      const updatedField = JSON.parse(JSON.stringify(targetField));
      mutatorFn(updatedField);
      fields[fIdx] = updatedField;
      return { ...prev, design_fields: fields };
    });
  };

  const handleIsolateFieldForSubType = (fIdx) => {
    updateDesignField(fIdx, () => {});
    const subObj = (formData.sub_types || []).find((s) => s.sub_id === designSubFilter);
    toast.success(`Question isolated exclusively for "${subObj?.label || designSubFilter}". Edits won't affect other sub-types.`);
  };

  const handleRemoveField = (fIdx) => {
    setFormData((prev) => {
      const fields = [...(prev.design_fields || [])];
      const targetField = fields[fIdx];
      if (!targetField) return prev;

      const allSubIds = (prev.sub_types || []).map((s) => s.sub_id);
      const isFilteredToSub = prev.has_sub_types && designSubFilter && designSubFilter !== "all";
      const curCovered = (targetField.applicable_sub_types && targetField.applicable_sub_types.length > 0)
        ? targetField.applicable_sub_types
        : allSubIds;
      const otherSubIds = isFilteredToSub ? curCovered.filter((id) => id !== designSubFilter) : [];

      if (isFilteredToSub && otherSubIds.length > 0) {
        // Remove only from current sub-type, preserve for other sub-types
        fields[fIdx] = {
          ...targetField,
          applicable_sub_types: otherSubIds,
        };
        const subObj = (prev.sub_types || []).find((s) => s.sub_id === designSubFilter);
        toast.info(`Question removed from "${subObj?.label || designSubFilter}" (preserved for other sub-types).`);
        return { ...prev, design_fields: fields };
      }

      const filtered = fields.filter((_, idx) => idx !== fIdx);
      toast.success("Question deleted.");
      return { ...prev, design_fields: filtered };
    });
  };

  const handleFieldChange = (fIdx, key, val, options = {}) => {
    updateDesignField(
      fIdx,
      (targetField) => {
        targetField[key] = val;
      },
      key === "applicable_sub_types" ? { skipFork: true, ...options } : options
    );
  };

  // Toggle an allowed option in option_mapping for a parent option
  const handleToggleOptionMapping = (fIdx, parentVal, childOptVal) => {
    updateDesignField(fIdx, (targetField) => {
      const curMapping = { ...(targetField.option_mapping || {}) };
      const curAllowed = Array.isArray(curMapping[parentVal]) ? [...curMapping[parentVal]] : [];
      const isAllowed = curAllowed.includes(childOptVal);
      const nextAllowed = isAllowed
        ? curAllowed.filter((x) => x !== childOptVal)
        : [...curAllowed, childOptVal];
      curMapping[parentVal] = nextAllowed;
      targetField.option_mapping = curMapping;
    });
  };

  // Bulk set all or none for a parent option in option_mapping
  const handleBulkSetOptionMapping = (fIdx, parentVal, allChildOptValues, mode) => {
    updateDesignField(fIdx, (targetField) => {
      const curMapping = { ...(targetField.option_mapping || {}) };
      curMapping[parentVal] = mode === "all" ? [...allChildOptValues] : [];
      targetField.option_mapping = curMapping;
    });
  };

  // Add a brand-new option directly to a specific parent choice
  const handleAddOptionToParent = (fIdx, parentVal, isCustom = false) => {
    updateDesignField(fIdx, (targetField) => {
      const curOpts = targetField.options || [];
      const questionLabel = targetField.label || "Choice";
      let newLabel = isCustom ? `+ Client ${questionLabel.toLowerCase()}` : `Choice ${curOpts.length + 1}`;
      const existingLabels = new Set(curOpts.map((o) => (typeof o === "object" ? o.value || o.label : String(o))));
      let counter = 1;
      while (existingLabels.has(newLabel)) {
        counter += 1;
        newLabel = isCustom
          ? `+ Client ${questionLabel.toLowerCase()} (${counter})`
          : `Choice ${curOpts.length + counter}`;
      }

      const newOptItem = {
        label: newLabel,
        value: newLabel,
        is_usual: false,
        has_custom_input: isCustom,
        custom_input_label: isCustom ? `Client ${questionLabel}` : "",
        custom_input_placeholder: isCustom ? `Enter client ${questionLabel.toLowerCase()}` : "",
      };
      targetField.options = [...curOpts, newOptItem];

      const curMapping = { ...(targetField.option_mapping || {}) };
      const curAllowed = Array.isArray(curMapping[parentVal]) ? [...curMapping[parentVal]] : [];
      if (!curAllowed.includes(newLabel)) {
        curAllowed.push(newLabel);
      }
      targetField.option_mapping = curMapping;
    });
  };

  // Remove an option from a specific parent choice (and clean up if unused anywhere)
  const handleRemoveOptionFromParent = (fIdx, parentVal, optVal) => {
    updateDesignField(fIdx, (targetField) => {
      const curMapping = { ...(targetField.option_mapping || {}) };
      const curAllowed = Array.isArray(curMapping[parentVal]) ? [...curMapping[parentVal]] : [];
      curMapping[parentVal] = curAllowed.filter((x) => x !== optVal);

      // Check if optVal is used in any other parent option
      const isUsedElsewhere = Object.entries(curMapping).some(([k, list]) => {
        return k !== parentVal && Array.isArray(list) && list.includes(optVal);
      });

      let nextOpts = targetField.options || [];
      if (!isUsedElsewhere) {
        nextOpts = nextOpts.filter((o) => {
          const val = typeof o === "object" ? o.value || o.label : String(o);
          return val !== optVal;
        });
      }

      targetField.options = nextOpts;
      targetField.option_mapping = curMapping;
    });
  };

  // Rename an option across options and option_mapping
  const handleRenameOptionInMapping = (fIdx, oldVal, newVal) => {
    updateDesignField(fIdx, (targetField) => {
      const nextOpts = (targetField.options || []).map((o) => {
        const v = typeof o === "object" ? o.value || o.label : String(o);
        if (v === oldVal) {
          return typeof o === "object" ? { ...o, label: newVal, value: newVal } : newVal;
        }
        return o;
      });

      const curMapping = { ...(targetField.option_mapping || {}) };
      Object.keys(curMapping).forEach((pk) => {
        if (Array.isArray(curMapping[pk])) {
          curMapping[pk] = curMapping[pk].map((v) => (v === oldVal ? newVal : v));
        }
      });

      targetField.options = nextOpts;
      targetField.option_mapping = curMapping;
    });
  };

  // Toggle custom input setting on an option
  const handleToggleOptionCustomInput = (fIdx, optIdx) => {
    updateDesignField(fIdx, (targetField) => {
      const curOpts = [...(targetField.options || [])];
      if (!curOpts[optIdx]) return;
      const cur = curOpts[optIdx];
      const nextCustom = !cur.has_custom_input;
      curOpts[optIdx] = {
        ...cur,
        has_custom_input: nextCustom,
        custom_input_label: nextCustom ? (cur.custom_input_label || cur.label || "Custom Details") : "",
        custom_input_placeholder: nextCustom ? (cur.custom_input_placeholder || `Enter ${cur.label || "custom details"}`) : "",
      };
      targetField.options = curOpts;
    });
  };

  // Update custom input label or placeholder
  const handleUpdateOptionCustomInput = (fIdx, optIdx, key, val) => {
    updateDesignField(fIdx, (targetField) => {
      const curOpts = [...(targetField.options || [])];
      if (!curOpts[optIdx]) return;
      curOpts[optIdx] = {
        ...curOpts[optIdx],
        [key]: val,
      };
      targetField.options = curOpts;
    });
  };

  // Drag and drop reordering for question rows
  const [draggedFieldIdx, setDraggedFieldIdx] = useState(null);
  const [dragOverFieldIdx, setDragOverFieldIdx] = useState(null);

  const handleFieldDragStart = (e, realIdx) => {
    setDraggedFieldIdx(realIdx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(realIdx));
  };

  const handleFieldDragOver = (e, realIdx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverFieldIdx !== realIdx) {
      setDragOverFieldIdx(realIdx);
    }
  };

  const handleFieldDragEnd = () => {
    setDraggedFieldIdx(null);
    setDragOverFieldIdx(null);
  };

  const handleFieldDrop = (e, targetRealIdx) => {
    e.preventDefault();
    if (draggedFieldIdx === null || draggedFieldIdx === undefined) return;
    if (draggedFieldIdx === targetRealIdx) {
      handleFieldDragEnd();
      return;
    }

    setFormData((prev) => {
      const fields = [...(prev.design_fields || [])];
      const [movedItem] = fields.splice(draggedFieldIdx, 1);
      fields.splice(targetRealIdx, 0, movedItem);
      return { ...prev, design_fields: fields };
    });

    handleFieldDragEnd();
  };

  const handleMoveField = (fromIdx, toIdx) => {
    if (toIdx < 0 || toIdx >= (formData.design_fields || []).length) return;
    setFormData((prev) => {
      const fields = [...(prev.design_fields || [])];
      const [movedItem] = fields.splice(fromIdx, 1);
      fields.splice(toIdx, 0, movedItem);
      return { ...prev, design_fields: fields };
    });
  };

  // Option pill tags within a field
  const handleAddOption = (fIdx) => {
    updateDesignField(fIdx, (targetField) => {
      targetField.options = [
        ...(targetField.options || []),
        { label: `New Choice`, value: `New Choice`, is_usual: false },
      ];
    });
  };

  // Add a dedicated custom input option pill
  const handleAddCustomOption = (fIdx) => {
    updateDesignField(fIdx, (targetField) => {
      const curOpts = targetField.options || [];
      const questionLabel = targetField.label || "Choice";
      let newLabel = `+ Client ${questionLabel.toLowerCase()}`;
      const existingLabels = new Set(curOpts.map((o) => (typeof o === "object" ? o.value || o.label : String(o))));
      let counter = 1;
      while (existingLabels.has(newLabel)) {
        counter += 1;
        newLabel = `+ Client ${questionLabel.toLowerCase()} (${counter})`;
      }
      targetField.options = [
        ...curOpts,
        {
          label: newLabel,
          value: newLabel,
          is_usual: false,
          has_custom_input: true,
          custom_input_label: `Client ${questionLabel}`,
          custom_input_placeholder: `Enter client ${questionLabel.toLowerCase()}`,
        },
      ];
    });
  };

  const handleRemoveOption = (fIdx, optIdx) => {
    updateDesignField(fIdx, (targetField) => {
      const curOpts = targetField.options || [];
      const removedOpt = curOpts[optIdx];
      const removedVal = typeof removedOpt === "object" ? removedOpt.value || removedOpt.label : String(removedOpt);
      const curMapping = { ...(targetField.option_mapping || {}) };
      Object.keys(curMapping).forEach((k) => {
        if (Array.isArray(curMapping[k])) {
          curMapping[k] = curMapping[k].filter((v) => v !== removedVal);
        }
      });
      targetField.options = curOpts.filter((_, idx) => idx !== optIdx);
      targetField.option_mapping = curMapping;
    });
  };

  const handleOptionChange = (fIdx, optIdx, key, val) => {
    updateDesignField(fIdx, (targetField) => {
      const curOpts = targetField.options || [];
      targetField.options = curOpts.map((opt, j) => {
        if (j !== optIdx) return opt;
        const updated = { ...opt, [key]: val };
        if (
          key === "label" &&
          (!updated.value || updated.value === opt.label)
        ) {
          updated.value = val;
        }
        return updated;
      });
    });
  };

  const handleFeedFromConstructionMaster = async (fIdx) => {
    try {
      const res = await dispatch(fetchConstructions({ limit: 100 })).unwrap();
      const list = res?.data || [];
      if (!list.length) {
        toast.info("No constructions found in master");
        return;
      }
      const newOptions = list.map((item) => ({
        label: item.name,
        value: item.name,
        icon: item.icon || "🏗️",
        is_usual: item.name?.toLowerCase().includes("plaque"),
      }));

      updateDesignField(fIdx, (targetField) => {
        const curLabel = targetField?.label;
        targetField.label = (!curLabel || curLabel === "New Option") ? "Construction type" : curLabel;
        targetField.field_key = (!targetField?.field_key || targetField?.field_key.startsWith("field_")) ? "construction" : targetField?.field_key;
        targetField.options = newOptions;
      });
      toast.success(`Fed ${newOptions.length} options from Construction Master!`);
    } catch (err) {
      console.error(err);
      toast.error(typeof err === "string" ? err : "Failed to fetch options from Construction Master");
    }
  };



  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 mb-6 overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>{formData.icon || "📦"}</span>
            <span>{currentId ? `Edit Product: ${formData.name}` : "Create New Dynamic Product"}</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure Section 2 questionnaire & Section 3 size panels without code changes
          </p>
        </div>
        {currentId && (
          <button
            type="button"
            onClick={handleReset}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-2xs"
          >
            + Create Another Product
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white px-5 pt-2 gap-2 text-xs font-bold">
        {[
          { id: "basic", label: "1. Basic & Route Strip", icon: "⚙️" },
          { id: "design", label: "2. What's the design? Builder", icon: "🎨", count: formData.design_fields?.length || 0 },
          { id: "size", label: "3. Sizes & Rates Setup", icon: "📐" },
          { id: "presets", label: "4. Quick Presets & Spec Line", icon: "⚡" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`px-4 py-2.5 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === tab.id
                ? "border-[#4B3BF5] text-[#4B3BF5] bg-purple-50/30"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className="ml-1 px-1.5 py-0.2 bg-gray-200 text-gray-700 rounded-full text-[10px]">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="p-6">
        {/* TAB 1: BASIC & ROUTE STRIP */}
        {activeTab === "basic" && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Product ID (slug) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="product_id"
                  disabled={!!currentId}
                  value={formData.product_id || ""}
                  onChange={onInputChange}
                  placeholder="e.g. keychain"
                  className={`w-full px-3 py-2 border rounded-xl text-xs font-medium outline-none focus:border-[#4B3BF5] ${
                    errors.product_id ? "border-red-400" : "border-gray-300"
                  }`}
                />
                <span className="text-[10px] text-gray-400">Unique lowercase identifier</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Product Display Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name || ""}
                  onChange={onInputChange}
                  placeholder="e.g. Custom Keychain"
                  className={`w-full px-3 py-2 border rounded-xl text-xs font-medium outline-none focus:border-[#4B3BF5] ${
                    errors.name ? "border-red-400" : "border-gray-300"
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center">
                  <span>Icon (Emoji / symbol)</span>
                  <EmojiHelpTooltip />
                </label>
                <input
                  type="text"
                  name="icon"
                  value={formData.icon || ""}
                  onChange={onInputChange}
                  placeholder="e.g. 🔑"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-medium outline-none focus:border-[#4B3BF5]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Sub-label</label>
                <input
                  type="text"
                  name="sub_label"
                  value={formData.sub_label || ""}
                  onChange={onInputChange}
                  placeholder="e.g. Leather · Metal"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-medium outline-none focus:border-[#4B3BF5]"
                />
              </div>
            </div>

            {/* Sub-Categories / Variations Section */}
            <div className="p-4 bg-indigo-50/40 border border-indigo-100 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-xs text-indigo-900 uppercase tracking-wider">
                      Product Sub-Categories / Types
                    </h3>
                    <EmojiHelpTooltip />
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                      {(formData.sub_types || []).length} types
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Enable if this product has sub-types (e.g. Medal has MS Punched & Zinc Cast; Badge has Name, Emblem & Button)
                  </p>
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <span className="text-xs font-bold text-gray-700">Has Sub-Types?</span>
                  <input
                    type="checkbox"
                    checked={formData.has_sub_types || false}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        has_sub_types: e.target.checked,
                        sub_types: e.target.checked
                          ? prev.sub_types?.length
                            ? prev.sub_types
                            : [
                                {
                                  sub_id: "type_1",
                                  label: "Type 1",
                                  icon: "📦",
                                  sub_text: "",
                                  is_active: true,
                                },
                              ]
                          : prev.sub_types,
                      }))
                    }
                    className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                  />
                </label>
              </div>

              {formData.has_sub_types && (
                <div className="space-y-2 pt-2 border-t border-indigo-100">
                  <div className="space-y-2">
                    {(formData.sub_types || []).map((sub, sIdx) => (
                      <div
                        key={sIdx}
                        className="flex flex-wrap md:flex-nowrap items-center gap-2 bg-white border border-gray-200 rounded-xl p-2.5 shadow-2xs"
                      >
                        <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 font-bold text-xs flex items-center justify-center shrink-0">
                          {sIdx + 1}
                        </span>

                        <div className="w-16">
                          <input
                            type="text"
                            value={sub.icon || "📦"}
                            onChange={(e) => handleSubTypeChange(sIdx, "icon", e.target.value)}
                            className="w-full px-2 py-1 border border-gray-200 rounded-lg text-center text-sm font-bold bg-gray-50"
                            title="Sub-type Icon"
                          />
                        </div>

                        <div className="flex-1 min-w-[140px]">
                          <input
                            type="text"
                            value={sub.label || ""}
                            onChange={(e) => handleSubTypeChange(sIdx, "label", e.target.value)}
                            placeholder="Sub-type Label (e.g. MS Punched Medal)"
                            className="w-full px-2.5 py-1 border border-gray-200 rounded-lg text-xs font-bold text-gray-800"
                          />
                        </div>

                        <div className="w-32">
                          <input
                            type="text"
                            value={sub.sub_id || ""}
                            onChange={(e) =>
                              handleSubTypeChange(
                                sIdx,
                                "sub_id",
                                e.target.value.toLowerCase().replace(/\s+/g, "_")
                              )
                            }
                            placeholder="Slug (e.g. ms_punched)"
                            className="w-full px-2.5 py-1 border border-gray-200 rounded-lg text-xs font-mono text-gray-600"
                          />
                        </div>

                        <div className="flex-1 min-w-[180px]">
                          <input
                            type="text"
                            value={sub.sub_text || ""}
                            onChange={(e) => handleSubTypeChange(sIdx, "sub_text", e.target.value)}
                            placeholder="Subtext description..."
                            className="w-full px-2.5 py-1 border border-gray-200 rounded-lg text-xs text-gray-500"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveSubType(sIdx)}
                          className="text-xs text-red-500 hover:text-red-700 font-bold px-2 py-1 rounded cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleAddSubType}
                    className="px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-xl text-xs font-bold cursor-pointer transition shadow-2xs"
                  >
                    + Add Sub-Category
                  </button>
                </div>
              )}
            </div>

            {/* Route Strip Box */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl space-y-4">
              <h3 className="font-bold text-xs text-gray-900 uppercase tracking-wider">
                Section 2 Route Banner Strip
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Manufacturing Route</label>
                  <select
                    value={formData.route_config?.route || "In-house"}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        route_config: { ...prev.route_config, route: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-medium bg-white"
                  >
                    {ROUTE_TYPES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">MOQ Tag</label>
                  <input
                    type="text"
                    value={formData.route_config?.moq || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        route_config: { ...prev.route_config, moq: e.target.value },
                      }))
                    }
                    placeholder="e.g. MOQ 50 pcs"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-medium bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Sample Time Tag</label>
                  <input
                    type="text"
                    value={formData.route_config?.sample_time || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        route_config: { ...prev.route_config, sample_time: e.target.value },
                      }))
                    }
                    placeholder="e.g. Sample in 2 working days"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-medium bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Subtext Note</label>
                <input
                  type="text"
                  value={formData.route_config?.note || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      route_config: { ...prev.route_config, note: e.target.value },
                    }))
                  }
                  placeholder="Costing decides in-house / outsource / split for each job..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-medium bg-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: QUESTIONNAIRE BUILDER */}
        {activeTab === "design" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-2">
              <div>
                <h3 className="font-bold text-xs text-gray-900 flex items-center gap-2 flex-wrap">
                  <span>Section 2 Questionnaire Rows ("What's the design?")</span>
                  <span className="text-[10px] font-normal text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span>⠿</span>
                    <span>Drag rows or use ▲▼ to reorder</span>
                  </span>
                </h3>
                <p className="text-[11px] text-gray-500">
                  Configure question cards and option pills. Tag rows to specific sub-categories if applicable.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleExpandAllFields}
                  className="px-2.5 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-semibold cursor-pointer transition shadow-2xs"
                  title="Expand all questions"
                >
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={handleCollapseAllFields}
                  className="px-2.5 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-semibold cursor-pointer transition shadow-2xs"
                  title="Collapse all questions"
                >
                  Collapse All
                </button>
                <button
                  type="button"
                  onClick={handleAddField}
                  className="px-3 py-1.5 bg-[#4B3BF5] text-white rounded-xl text-xs font-bold hover:bg-indigo-700 cursor-pointer shadow-xs"
                >
                  + Add Question Row
                </button>
              </div>
            </div>

            {/* Sub-Type Filter Tabs (if product has sub-types) */}
            {formData.has_sub_types && (formData.sub_types || []).length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto p-1.5 bg-gray-100 rounded-xl border border-gray-200 text-xs">
                {(formData.sub_types || []).map((sub) => {
                  const count = (formData.design_fields || []).filter((f) => {
                    if (f.applicable_sub_types && f.applicable_sub_types.length > 0) {
                      return f.applicable_sub_types.includes(sub.sub_id);
                    }
                    const hasSpecific = (formData.design_fields || []).some(
                      (other) =>
                        other !== f &&
                        other.field_key === f.field_key &&
                        other.applicable_sub_types &&
                        other.applicable_sub_types.includes(sub.sub_id)
                    );
                    return !hasSpecific;
                  }).length;
                  const isCur = designSubFilter === sub.sub_id;
                  return (
                    <button
                      key={sub.sub_id}
                      type="button"
                      onClick={() => setDesignSubFilter(sub.sub_id)}
                      className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        isCur
                          ? "bg-indigo-600 text-white shadow-2xs"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      <span>{sub.icon || "📦"}</span>
                      <span>{sub.label}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                          isCur ? "bg-indigo-800 text-indigo-100" : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Sub-type active info banner */}
            {formData.has_sub_types && designSubFilter && designSubFilter !== "all" && (
              <div className="flex items-center gap-2 p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-indigo-900">
                <span className="text-base">ℹ️</span>
                <span>
                  Viewing & editing specifically for{" "}
                  <strong>
                    {(formData.sub_types || []).find((s) => s.sub_id === designSubFilter)?.label || designSubFilter}
                  </strong>
                  . Editing any shared options will automatically isolate them for this sub-type without affecting other sub-types.
                </span>
              </div>
            )}

            {(formData.design_fields || [])
              .map((field, realIdx) => ({ field, realIdx }))
              .filter(({ field }) => {
                if (designSubFilter === "all") return true;
                if (field.applicable_sub_types && field.applicable_sub_types.length > 0) {
                  return field.applicable_sub_types.includes(designSubFilter);
                }
                const hasSpecific = (formData.design_fields || []).some(
                  (other) =>
                    other !== field &&
                    other.field_key === field.field_key &&
                    other.applicable_sub_types &&
                    other.applicable_sub_types.includes(designSubFilter)
                );
                return !hasSpecific;
              })
              .map(({ field, realIdx }, displayIdx) => {
                const isAllSubs = !field.applicable_sub_types?.length;
                const fieldKeyId = field._clientId || field._id || field.field_key || `field_${realIdx}`;
                const isExpanded = expandedFields[fieldKeyId] !== undefined
                  ? !!expandedFields[fieldKeyId]
                  : displayIdx === 0;

                const precedingFields = (formData.design_fields || []).filter((_, idx) => idx < realIdx);
                const rawParentKey = field.depends_on_field || field.show_if_field || "";
                const hasValidParent = Boolean(rawParentKey && precedingFields.some((f) => f.field_key === rawParentKey));
                const parentFieldObj = hasValidParent ? precedingFields.find((f) => f.field_key === rawParentKey) : null;

                return (
                  <div
                    key={fieldKeyId}
                    onDragOver={(e) => handleFieldDragOver(e, realIdx)}
                    onDrop={(e) => handleFieldDrop(e, realIdx)}
                    className={`rounded-2xl border transition ${
                      draggedFieldIdx === realIdx
                        ? "opacity-30 border-2 border-dashed border-[#4B3BF5] bg-indigo-50/50 scale-[0.99] p-4"
                        : dragOverFieldIdx === realIdx && draggedFieldIdx !== realIdx
                        ? "ring-2 ring-[#4B3BF5] ring-offset-2 border-indigo-400 bg-indigo-50/30 p-4"
                        : isExpanded
                        ? "p-4 bg-gray-50/70 border-indigo-200 shadow-xs space-y-3"
                        : "p-3 bg-white border-gray-200 hover:border-indigo-200 hover:bg-gray-50/40 shadow-2xs space-y-2"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-1">
                        {/* Drag Handle Grip Icon */}
                        <div
                          draggable
                          onDragStart={(e) => handleFieldDragStart(e, realIdx)}
                          onDragEnd={handleFieldDragEnd}
                          className="p-1 text-gray-400 hover:text-[#4B3BF5] cursor-grab active:cursor-grabbing rounded hover:bg-purple-100/60 transition shrink-0"
                          title="Drag to reorder question row"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="8" cy="5" r="1.5" />
                            <circle cx="16" cy="5" r="1.5" />
                            <circle cx="8" cy="12" r="1.5" />
                            <circle cx="16" cy="12" r="1.5" />
                            <circle cx="8" cy="19" r="1.5" />
                            <circle cx="16" cy="19" r="1.5" />
                          </svg>
                        </div>

                        {/* Move Up/Down Quick Arrows */}
                        <div className="flex flex-col items-center shrink-0">
                          <button
                            type="button"
                            disabled={realIdx === 0}
                            onClick={() => handleMoveField(realIdx, realIdx - 1)}
                            className="text-gray-400 hover:text-indigo-600 disabled:opacity-20 cursor-pointer text-[10px] leading-none p-0.5"
                            title="Move up"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            disabled={realIdx === (formData.design_fields || []).length - 1}
                            onClick={() => handleMoveField(realIdx, realIdx + 1)}
                            className="text-gray-400 hover:text-indigo-600 disabled:opacity-20 cursor-pointer text-[10px] leading-none p-0.5"
                            title="Move down"
                          >
                            ▼
                          </button>
                        </div>

                        <span className="w-5 h-5 rounded-full bg-purple-100 text-[#4B3BF5] font-bold text-xs flex items-center justify-center shrink-0">
                          {displayIdx + 1}
                        </span>
                        <input
                          type="text"
                          value={field.label || ""}
                          onChange={(e) => handleFieldChange(realIdx, "label", e.target.value)}
                          placeholder="Question Label (e.g. Scroll type, Material)"
                          className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-bold text-gray-900 bg-white flex-1"
                        />
                        <input
                          type="text"
                          value={field.field_key || ""}
                          onChange={(e) => handleFieldChange(realIdx, "field_key", e.target.value)}
                          placeholder="key (e.g. scrollType)"
                          className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-600 bg-white w-36"
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Scope Indicator Badge */}
                        {formData.has_sub_types && (
                          <>
                            {designSubFilter !== "all" ? (
                              !isAllSubs && field.applicable_sub_types?.length === 1 && field.applicable_sub_types[0] === designSubFilter ? (
                                <span
                                  className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1"
                                  title="This question is isolated exclusively for this sub-type. Changes will not affect other sub-types."
                                >
                                  <span>🎯</span> Exclusive to this Sub-Type
                                </span>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1"
                                    title="This question is shared with other sub-types. Editing any option will automatically isolate it for this sub-type."
                                  >
                                    <span>🌐</span> Shared ({isAllSubs ? "All Sub-Types" : `${field.applicable_sub_types.length} Sub-Types`})
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleIsolateFieldForSubType(realIdx)}
                                    className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-300 transition cursor-pointer shadow-2xs"
                                    title="Click to isolate this question specifically for this sub-type now"
                                  >
                                    ✨ Isolate for this Type
                                  </button>
                                </div>
                              )
                            ) : (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isAllSubs
                                    ? "bg-gray-200 text-gray-700"
                                    : "bg-indigo-100 text-indigo-700 border border-indigo-200"
                                }`}
                              >
                                {isAllSubs
                                  ? "All Sub-Types"
                                  : `${field.applicable_sub_types.length} Sub-Type(s)`}
                              </span>
                            )}
                          </>
                        )}

                        {/* Mode Indicator Badge */}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            field.is_locked
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : field.field_type === "checkbox"
                              ? "bg-purple-100 text-purple-800 border border-purple-300"
                              : field.field_type === "file_upload"
                              ? "bg-sky-100 text-sky-800 border border-sky-300"
                              : field.field_type === "number"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : field.field_type === "text"
                              ? "bg-teal-100 text-teal-800 border border-teal-300"
                              : field.field_type === "textarea"
                              ? "bg-indigo-100 text-indigo-800 border border-indigo-300"
                              : field.selection_mode === "multiple"
                              ? "bg-blue-100 text-blue-800 border border-blue-200"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {field.is_locked
                            ? `🔒 Locked: ${field.locked_value || "Fixed"}`
                            : field.field_type === "checkbox"
                            ? "☑️ Checkbox Toggle"
                            : field.field_type === "file_upload"
                            ? "📎 File Upload"
                            : field.field_type === "number"
                            ? `🔢 Number Input ${field.unit ? `(${field.unit})` : ""}`
                            : field.field_type === "text"
                            ? "📝 Text Input"
                            : field.field_type === "textarea"
                            ? "📄 Multiline / Notes"
                            : field.selection_mode === "multiple"
                            ? field.max_selections > 0
                              ? `☑️ Multi (Max ${field.max_selections})`
                              : "☑️ Multi (Unlimited)"
                            : "🔘 Single Choice"}
                        </span>

                        {/* Options count badge */}
                        {!field.is_locked &&
                          field.field_type !== "number" &&
                          field.field_type !== "text" &&
                          field.field_type !== "textarea" &&
                          field.field_type !== "checkbox" &&
                          field.field_type !== "file_upload" && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              {(field.options || []).length} options
                            </span>
                          )}

                        {/* Linked Parent Badge (if linked to a valid preceding question) */}
                        {hasValidParent && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200" title={`Depends on question: ${parentFieldObj?.label || rawParentKey}`}>
                            🔗 Linked: {parentFieldObj?.label || rawParentKey}
                          </span>
                        )}

                        <label className="flex items-center gap-1.5 text-xs font-bold text-amber-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={field.is_required || false}
                            onChange={(e) => handleFieldChange(realIdx, "is_required", e.target.checked)}
                            className="rounded"
                          />
                          <span>Required</span>
                        </label>

                        <button
                          type="button"
                          onClick={() => handleRemoveField(realIdx)}
                          className="text-xs text-red-500 hover:text-red-700 font-bold px-2 py-1 rounded cursor-pointer"
                        >
                          Delete
                        </button>

                        {/* Accordion Toggle Pill Button */}
                        <button
                          type="button"
                          onClick={() => toggleFieldAccordion(fieldKeyId, isExpanded)}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs ${
                            isExpanded
                              ? "bg-indigo-600 text-white hover:bg-indigo-700"
                              : "bg-white text-indigo-600 hover:bg-indigo-50 border border-indigo-200"
                          }`}
                          title={isExpanded ? "Collapse question details" : "Expand question to edit options and logic"}
                        >
                          <span>{isExpanded ? "Collapse" : "Edit"}</span>
                          <svg
                            className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Collapsed Options Preview Bar (Shown when collapsed so user can glance at options) */}
                    {!isExpanded && (
                      <div
                        onClick={() => toggleFieldAccordion(fieldKeyId, isExpanded)}
                        className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2 text-[11px] text-gray-500 cursor-pointer hover:text-indigo-600 transition"
                      >
                        <div className="flex items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap">
                          {field.sub_text && (
                            <span className="text-gray-400 italic">"{field.sub_text}" ·</span>
                          )}
                          {field.is_locked ? (
                            <span className="font-semibold text-amber-700">🔒 Fixed: {field.locked_value || "Fixed"}</span>
                          ) : field.field_type === "checkbox" ? (
                            <span className="font-semibold text-purple-700">☑️ Checkbox: "{field.checkbox_label || field.label}" ({field.default_checked ? "Default ON" : "Default OFF"})</span>
                          ) : field.field_type === "file_upload" ? (
                            <span className="font-semibold text-sky-700">📎 File Upload: {field.upload_hint || "Accepts artwork files"}</span>
                          ) : field.field_type === "number" || field.field_type === "text" || field.field_type === "textarea" ? (
                            <span className="font-medium text-gray-600">
                              {field.placeholder || "Salesperson types directly"} {field.unit ? `(${field.unit})` : ""}
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5 overflow-hidden">
                              <span className="font-bold text-gray-700 shrink-0">Options ({field.options?.length || 0}):</span>
                              <span className="text-gray-500 truncate">
                                {(field.options || []).map((o) => (typeof o === "object" ? o.label : o)).join(", ") || "No options yet"}
                              </span>
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] text-indigo-600 font-bold shrink-0 hover:underline">
                          Click to expand ▾
                        </span>
                      </div>
                    )}

                    {/* Accordion Body (Shown when expanded) */}
                    {isExpanded && (
                      <div className="space-y-3 pt-2 border-t border-gray-200/80">
                        <div>
                          <input
                            type="text"
                            value={field.sub_text || ""}
                            onChange={(e) => handleFieldChange(realIdx, "sub_text", e.target.value)}
                            placeholder="Optional subtext (e.g. Client specifies it, or Costing may fill)"
                            className="w-full px-3 py-1 border border-gray-200 rounded-lg text-[11px] text-gray-500 bg-white"
                          />
                        </div>

                    {/* Answer Mode Toolbar (Single vs Multiple vs Number Input vs Text Input vs Locked) */}
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-white border border-gray-200 rounded-xl text-xs">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-bold text-gray-700 mr-1">Answer Mode:</span>
                        
                        <button
                          type="button"
                          onClick={() => {
                            handleFieldChange(realIdx, "is_locked", false);
                            handleFieldChange(realIdx, "field_type", "pills");
                            handleFieldChange(realIdx, "selection_mode", "single");
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                            !field.is_locked &&
                            (field.field_type === "pills" || !field.field_type) &&
                            (field.selection_mode || "single") === "single"
                              ? "bg-indigo-600 text-white shadow-2xs"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          🔘 Single Choice
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            handleFieldChange(realIdx, "is_locked", false);
                            handleFieldChange(realIdx, "field_type", "pills");
                            handleFieldChange(realIdx, "selection_mode", "multiple");
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                            !field.is_locked &&
                            (field.field_type === "pills" || !field.field_type) &&
                            field.selection_mode === "multiple"
                              ? "bg-indigo-600 text-white shadow-2xs"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          ☑️ Multiple Choice
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            handleFieldChange(realIdx, "is_locked", false);
                            handleFieldChange(realIdx, "field_type", "number");
                            handleFieldChange(realIdx, "selection_mode", "single");
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                            !field.is_locked && field.field_type === "number"
                              ? "bg-emerald-600 text-white shadow-2xs"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          🔢 Number Input
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            handleFieldChange(realIdx, "is_locked", false);
                            handleFieldChange(realIdx, "field_type", "text");
                            handleFieldChange(realIdx, "selection_mode", "single");
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                            !field.is_locked && field.field_type === "text"
                              ? "bg-teal-600 text-white shadow-2xs"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          📝 Text Input
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            handleFieldChange(realIdx, "is_locked", false);
                            handleFieldChange(realIdx, "field_type", "textarea");
                            handleFieldChange(realIdx, "selection_mode", "single");
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                            !field.is_locked && field.field_type === "textarea"
                              ? "bg-indigo-600 text-white shadow-2xs"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          📄 Multiline / Notes
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            handleFieldChange(realIdx, "is_locked", true);
                            if (!field.locked_value && field.options?.[0]?.label) {
                              handleFieldChange(realIdx, "locked_value", field.options[0].label);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                            field.is_locked
                              ? "bg-amber-600 text-white shadow-2xs"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          🔒 Locked (Fixed Value)
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            handleFieldChange(realIdx, "is_locked", false);
                            handleFieldChange(realIdx, "field_type", "checkbox");
                            handleFieldChange(realIdx, "selection_mode", "single");
                            if (!field.checkbox_label) {
                              handleFieldChange(realIdx, "checkbox_label", field.label || "Add a label on this die face");
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                            !field.is_locked && field.field_type === "checkbox"
                              ? "bg-purple-600 text-white shadow-2xs"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          ☑️ Checkbox
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            handleFieldChange(realIdx, "is_locked", false);
                            handleFieldChange(realIdx, "field_type", "file_upload");
                            handleFieldChange(realIdx, "selection_mode", "single");
                            if (!field.allowed_extensions || field.allowed_extensions.length === 0) {
                              handleFieldChange(realIdx, "allowed_extensions", ["ai", "cdr", "pdf", "svg", "png", "jpg", "psd", "zip"]);
                            }
                            if (field.allow_multiple === undefined) {
                              handleFieldChange(realIdx, "allow_multiple", true);
                            }
                            if (!field.upload_hint) {
                              handleFieldChange(realIdx, "upload_hint", "Logo, design or reference · AI, CDR, PDF, SVG, PNG, JPG");
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                            !field.is_locked && field.field_type === "file_upload"
                              ? "bg-sky-600 text-white shadow-2xs"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          📎 File Upload
                        </button>
                      </div>

                      {/* Optional Limit Input for Multiple Choice */}
                      {!field.is_locked && field.field_type === "pills" && field.selection_mode === "multiple" && (
                        <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg">
                          <span className="text-[10px] font-bold text-indigo-900">Max limit (optional):</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="Unlimited"
                            value={field.max_selections || ""}
                            onChange={(e) =>
                              handleFieldChange(
                                realIdx,
                                "max_selections",
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="w-16 px-1.5 py-0.5 border border-indigo-300 rounded text-center text-xs font-bold bg-white text-indigo-900"
                            title="Leave 0 or blank for no limit (unlimited selections allowed)"
                          />
                          <span className="text-[10px] text-indigo-700 font-medium">
                            {field.max_selections > 0 ? `Max ${field.max_selections} selections` : "Unlimited (No limit)"}
                          </span>
                        </div>
                      )}

                      {/* Unit Suffix and Placeholder for Number / Text / Textarea Input */}
                      {!field.is_locked && (field.field_type === "number" || field.field_type === "text" || field.field_type === "textarea") && (
                        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                          {field.field_type !== "textarea" && (
                            <>
                              <span className="text-[10px] font-bold text-emerald-900">Unit suffix:</span>
                              <input
                                type="text"
                                placeholder="e.g. g, mm, pcs"
                                value={field.unit || ""}
                                onChange={(e) => handleFieldChange(realIdx, "unit", e.target.value)}
                                className="w-16 px-1.5 py-0.5 border border-emerald-300 rounded text-center text-xs font-bold bg-white text-emerald-900"
                              />
                            </>
                          )}
                          <span className="text-[10px] font-bold text-emerald-900 ml-1">Placeholder:</span>
                          <input
                            type="text"
                            placeholder={field.field_type === "textarea" ? "e.g. Optional notes..." : "e.g. 30"}
                            value={field.placeholder || ""}
                            onChange={(e) => handleFieldChange(realIdx, "placeholder", e.target.value)}
                            className="w-32 px-1.5 py-0.5 border border-emerald-300 rounded text-xs font-medium bg-white text-emerald-900"
                          />
                        </div>
                      )}

                      {/* Checkbox Sub-Settings Bar */}
                      {!field.is_locked && field.field_type === "checkbox" && (
                        <div className="flex flex-wrap items-center gap-3 bg-purple-50 border border-purple-200 px-2.5 py-1.5 rounded-lg text-xs">
                          <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                            <span className="text-[10px] font-bold text-purple-900 shrink-0">Checkbox Text:</span>
                            <input
                              type="text"
                              placeholder="e.g. Add a label on this die face"
                              value={field.checkbox_label || ""}
                              onChange={(e) => handleFieldChange(realIdx, "checkbox_label", e.target.value)}
                              className="flex-1 px-2 py-0.5 border border-purple-300 rounded text-xs font-semibold bg-white text-purple-950"
                            />
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] font-bold text-purple-900">Default:</span>
                            <button
                              type="button"
                              onClick={() => handleFieldChange(realIdx, "default_checked", !field.default_checked)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition ${
                                field.default_checked
                                  ? "bg-purple-600 text-white shadow-2xs"
                                  : "bg-white text-purple-700 border border-purple-300"
                              }`}
                            >
                              {field.default_checked ? "☑️ Checked" : "⬜ Unchecked"}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* File Upload Sub-Settings Bar */}
                      {!field.is_locked && field.field_type === "file_upload" && (
                        <div className="flex flex-wrap items-center gap-2 bg-sky-50 border border-sky-200 px-2.5 py-1.5 rounded-lg text-xs">
                          <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                            <span className="text-[10px] font-bold text-sky-900 shrink-0">Upload Hint:</span>
                            <input
                              type="text"
                              placeholder="e.g. Logo, design or reference · AI, CDR, PDF, SVG, PNG"
                              value={field.upload_hint || ""}
                              onChange={(e) => handleFieldChange(realIdx, "upload_hint", e.target.value)}
                              className="flex-1 px-2 py-0.5 border border-sky-300 rounded text-xs font-medium bg-white text-sky-950"
                            />
                          </div>
                          <label className="flex items-center gap-1 text-[10px] font-bold text-sky-900 cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={field.allow_multiple !== false}
                              onChange={(e) => handleFieldChange(realIdx, "allow_multiple", e.target.checked)}
                              className="rounded text-sky-600"
                            />
                            <span>Multi-file</span>
                          </label>
                          <div className="w-full flex items-center gap-1 pt-1 border-t border-sky-200/60">
                            <span className="text-[10px] font-bold text-sky-900 shrink-0">Formats:</span>
                            <div className="flex flex-wrap gap-1">
                              {["AI", "CDR", "PDF", "SVG", "PNG", "JPG", "PSD", "ZIP"].map((ext) => {
                                const curExts = field.allowed_extensions || ["ai", "cdr", "pdf", "svg", "png", "jpg", "psd", "zip"];
                                const isIncluded = curExts.map((x) => x.toLowerCase()).includes(ext.toLowerCase());
                                return (
                                  <button
                                    key={ext}
                                    type="button"
                                    onClick={() => {
                                      const next = isIncluded
                                        ? curExts.filter((x) => x.toLowerCase() !== ext.toLowerCase())
                                        : [...curExts, ext.toLowerCase()];
                                      handleFieldChange(realIdx, "allowed_extensions", next);
                                    }}
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer transition ${
                                      isIncluded
                                        ? "bg-sky-600 text-white"
                                        : "bg-white text-gray-500 border border-gray-200"
                                    }`}
                                  >
                                    {ext}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Locked Value Input & Preview */}
                      {field.is_locked && (
                        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                          <span className="text-[11px] font-bold text-amber-900">Fixed value:</span>
                          <input
                            type="text"
                            placeholder="e.g. Round or Brass"
                            value={field.locked_value || ""}
                            onChange={(e) => handleFieldChange(realIdx, "locked_value", e.target.value)}
                            className="px-2 py-0.5 border border-amber-300 rounded text-xs font-bold bg-white text-gray-900 w-28"
                          />
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 border border-dashed border-indigo-400 bg-white text-gray-900 rounded-full font-bold text-xs shadow-2xs">
                            🔒 {field.locked_value || "Fixed Value"}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Live Preview for Number / Text / Textarea Input */}
                    {!field.is_locked && (field.field_type === "number" || field.field_type === "text" || field.field_type === "textarea") && (
                      <div className="p-3 bg-gradient-to-r from-gray-50 to-slate-50 border border-indigo-100 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-extrabold text-gray-900">{field.label || "Question"}</span>
                          {field.is_required && (
                            <span className="text-[10px] font-bold text-amber-600">required</span>
                          )}
                          {field.sub_text && (
                            <span className="text-[11px] text-gray-500 font-medium">· {field.sub_text}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-1 max-w-sm justify-end">
                          {field.field_type === "textarea" ? (
                            <div className="w-full px-3 py-2 bg-white border-2 border-indigo-400 rounded-xl text-xs text-gray-400 font-medium shadow-inner h-14 overflow-hidden">
                              {field.placeholder || "Optional multiline notes / textarea"}
                            </div>
                          ) : (
                            <>
                              <div className="w-32 px-3 py-1.5 bg-white border-2 border-indigo-400 rounded-xl text-xs text-gray-400 font-medium text-center shadow-inner">
                                {field.placeholder || (field.field_type === "number" ? "Enter number" : "Enter text")}
                              </div>
                              {field.unit && (
                                <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded-lg border border-gray-200">
                                  {field.unit}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Live Preview for Checkbox */}
                    {!field.is_locked && field.field_type === "checkbox" && (
                      <div className="p-3 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-extrabold text-gray-900">{field.label || "Question"}</span>
                          {field.is_required && (
                            <span className="text-[10px] font-bold text-amber-600">required</span>
                          )}
                          {field.sub_text && (
                            <span className="text-[11px] text-gray-500 font-medium">· {field.sub_text}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-300 bg-white shadow-2xs text-xs font-bold text-purple-950">
                            <span>{field.default_checked ? "☑️" : "⬜"}</span>
                            <span>{field.checkbox_label || field.label || "Add a label on this die face"}</span>
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Live Preview for File Upload */}
                    {!field.is_locked && field.field_type === "file_upload" && (
                      <div className="p-3 bg-gradient-to-r from-sky-50 to-slate-50 border border-sky-200 rounded-xl space-y-2 shadow-2xs">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-extrabold text-gray-900">{field.label || "Question"}</span>
                          {field.is_required && (
                            <span className="text-[10px] font-bold text-amber-600">required</span>
                          )}
                          {field.sub_text && (
                            <span className="text-[11px] text-gray-500 font-medium">· {field.sub_text}</span>
                          )}
                        </div>
                        <div className="border border-dashed border-sky-300 rounded-xl p-2.5 bg-white flex items-center justify-center gap-2 text-sky-700">
                          <span className="text-base">📎</span>
                          <div className="text-center">
                            <span className="text-xs font-bold block">{field.label || "Upload artwork file"}</span>
                            <span className="text-[10px] text-gray-500">{field.upload_hint || "Logo, design or reference · AI, CDR, PDF, SVG, PNG, JPG"}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Sub-Category Applicability Selector (if product has sub-types) */}
                    {formData.has_sub_types && (formData.sub_types || []).length > 0 && (
                      <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-indigo-50/40 border border-indigo-100 rounded-xl text-xs">
                        <span className="text-[11px] font-bold text-indigo-900 flex items-center gap-1">
                          <span>🎯</span> Sub-Category Applicability:
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleFieldChange(realIdx, "applicable_sub_types", [], { skipFork: true })}
                            className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                              isAllSubs
                                ? "bg-indigo-600 text-white shadow-2xs"
                                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            🌐 All Sub-Types (Common)
                          </button>

                          {(formData.sub_types || []).map((sub) => {
                            const isSelected = (field.applicable_sub_types || []).includes(sub.sub_id);
                            return (
                              <button
                                key={sub.sub_id}
                                type="button"
                                onClick={() => {
                                  const cur = field.applicable_sub_types || [];
                                  let next;
                                  if (isSelected) {
                                    next = cur.filter((x) => x !== sub.sub_id);
                                  } else {
                                    next = [...cur, sub.sub_id];
                                  }
                                  handleFieldChange(realIdx, "applicable_sub_types", next, { skipFork: true });
                                }}
                                className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${
                                  isSelected
                                    ? "bg-indigo-600 text-white shadow-2xs"
                                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                                }`}
                              >
                                <span>{sub.icon || "📦"}</span>
                                <span>{sub.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Question Linking & Cascading Rules (Chain Logic) */}
                    <div className="p-3 bg-indigo-50/40 border border-indigo-100 rounded-2xl text-xs space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">🔗</span>
                          <div>
                            <span className="font-bold text-xs text-indigo-950 block">Question Linking & Cascading Rules (Chain Logic)</span>
                            <span className="text-[10px] text-indigo-600/80 font-normal">Link this question to a preceding question and filter options per parent choice</span>
                          </div>
                        </div>

                        {/* Dropdown to link parent question */}
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] text-indigo-900 font-semibold">Depends on Parent Question:</label>
                          <select
                            value={hasValidParent ? rawParentKey : ""}
                            onChange={(e) => {
                              const pKey = e.target.value;
                              handleFieldChange(realIdx, "depends_on_field", pKey);
                              handleFieldChange(realIdx, "show_if_field", pKey);
                              if (!pKey) {
                                handleFieldChange(realIdx, "option_mapping", {});
                              }
                            }}
                            className="text-xs px-2.5 py-1.5 bg-white border border-indigo-200 rounded-xl outline-none font-semibold text-indigo-950 focus:border-indigo-600 shadow-2xs"
                          >
                            <option value="">Independent (Always show all options)</option>
                            {precedingFields.map((f) => (
                              <option key={f.field_key} value={f.field_key}>
                                Q. {f.label} ({f.field_key})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* When a parent question is linked */}
                      {(() => {
                        if (!hasValidParent) return null;
                        const parentField = parentFieldObj;

                        // Checkbox parent condition
                        if (parentField && parentField.field_type === "checkbox") {
                          const isCheckedCond = field.show_if_condition === "unchecked" ? "unchecked" : "checked";
                          return (
                            <div className="pt-2 border-t border-indigo-100/80 space-y-2.5">
                              <div className="flex flex-wrap items-center justify-between gap-1.5">
                                <div>
                                  <span className="text-[11px] font-bold text-indigo-950 block">
                                    ☑️ Checkbox Conditional Rule:
                                  </span>
                                  <span className="text-[10px] text-indigo-600/80">
                                    Show this question when parent checkbox "{parentField.label || parentField.checkbox_label || rawParentKey}" is:
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleFieldChange(realIdx, "show_if_condition", "checked");
                                    handleFieldChange(realIdx, "show_if_value", true);
                                  }}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                    isCheckedCond === "checked"
                                      ? "bg-purple-600 text-white shadow-2xs"
                                      : "bg-white text-gray-700 border border-gray-200 hover:border-purple-300 hover:bg-purple-50"
                                  }`}
                                >
                                  <span>☑️</span>
                                  <span>When Checked (Enabled / Yes)</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleFieldChange(realIdx, "show_if_condition", "unchecked");
                                    handleFieldChange(realIdx, "show_if_value", false);
                                  }}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                    isCheckedCond === "unchecked"
                                      ? "bg-purple-600 text-white shadow-2xs"
                                      : "bg-white text-gray-700 border border-gray-200 hover:border-purple-300 hover:bg-purple-50"
                                  }`}
                                >
                                  <span>⬜</span>
                                  <span>When Unchecked (Disabled / No)</span>
                                </button>
                              </div>
                              <p className="text-[10px] text-gray-500 italic">
                                💡 Tip: In the enquiry form, this question will appear line-by-line only when the salesperson checks this box.
                              </p>
                            </div>
                          );
                        }

                        if (!parentField || !parentField.options || parentField.options.length === 0) {
                          return (
                            <p className="text-[11px] text-indigo-600 italic bg-white/80 p-2.5 rounded-xl border border-indigo-100">
                              ℹ️ Parent question "{parentField?.label || rawParentKey}" has no selectable options yet. Add options to the parent question above first.
                            </p>
                          );
                        }

                        const childOptions = field.options || [];
                        const allChildValues = childOptions.map((o) => (typeof o === "object" ? o.value || o.label : String(o)));

                        const parentOptions = parentField.options.map((o) =>
                          typeof o === "object" ? o.value || o.label : String(o)
                        );

                        const curMapping = field.option_mapping || {};

                        const isInputField =
                          field.is_locked ||
                          field.field_type === "number" ||
                          field.field_type === "text" ||
                          field.field_type === "textarea" ||
                          field.field_type === "checkbox" ||
                          field.field_type === "file_upload";

                        if (isInputField) {
                          return (
                            <div className="pt-2 border-t border-indigo-100/80 space-y-2.5">
                              <div className="flex flex-wrap items-center justify-between gap-1.5">
                                <div>
                                  <span className="text-[11px] font-bold text-indigo-950 block">
                                    👁️ Conditional Display Rules:
                                  </span>
                                  <span className="text-[10px] text-indigo-600/80">
                                    Select which choice(s) of "{parentField.label || rawParentKey}" will display this input question:
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-2 pt-1">
                                {parentOptions.map((pOpt) => {
                                  const isEnabled = Boolean(curMapping[pOpt]);
                                  return (
                                    <button
                                      key={pOpt}
                                      type="button"
                                      onClick={() => {
                                        const nextMapping = { ...curMapping };
                                        if (isEnabled) {
                                          delete nextMapping[pOpt];
                                        } else {
                                          nextMapping[pOpt] = true;
                                        }
                                        handleFieldChange(realIdx, "option_mapping", nextMapping);
                                      }}
                                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                        isEnabled
                                          ? "bg-indigo-600 text-white shadow-2xs"
                                          : "bg-white text-gray-700 border border-gray-200 hover:border-indigo-300 hover:bg-gray-50"
                                      }`}
                                    >
                                      <span>{isEnabled ? "✓" : "○"}</span>
                                      <span>When client picks: "{pOpt}"</span>
                                    </button>
                                  );
                                })}
                              </div>
                              <p className="text-[10px] text-gray-500 italic">
                                💡 Tip: Click to highlight the choices that should show this {field.field_type === "number" ? "number input" : "input"}. Unselected choices will hide this question entirely.
                              </p>
                            </div>
                          );
                        }

                        return (
                          <div className="pt-2 border-t border-indigo-100/80 space-y-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                              <div>
                                <span className="text-[11px] font-bold text-indigo-950 block">
                                  📊 Options Configuration per Parent Choice:
                                </span>
                                <span className="text-[10px] text-indigo-600/80">
                                  Edit, add, or remove options for each parent choice below (like independent questions)
                                </span>
                              </div>
                            </div>

                            <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                              {parentOptions.map((pOpt) => {
                                const allowedInRow = curMapping[pOpt] || [];
                                const otherAvailable = allChildValues.filter((cv) => !allowedInRow.includes(cv));

                                return (
                                  <div
                                    key={pOpt}
                                    className="p-3 rounded-2xl border transition space-y-2 bg-white border-gray-200/90 hover:border-indigo-300 shadow-2xs"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-gray-100">
                                      <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                                        <span className="font-bold text-xs text-gray-900">
                                          When client picks: <span className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">"{pOpt}"</span>
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => handleAddOptionToParent(realIdx, pOpt, false)}
                                          className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-lg transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                        >
                                          <span>+ Add Option</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleAddOptionToParent(realIdx, pOpt, true)}
                                          className="text-[10px] font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2 py-0.5 rounded-lg transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                          title={`Add a custom input option when client picks "${pOpt}"`}
                                        >
                                          <span>💬</span> + Need Custom
                                        </button>
                                        {allowedInRow.length > 0 && (
                                          <button
                                            type="button"
                                            onClick={() => handleBulkSetOptionMapping(realIdx, pOpt, allChildValues, "none")}
                                            className="text-[10px] font-medium text-gray-500 hover:text-red-600 px-1.5 py-0.5 rounded transition cursor-pointer"
                                          >
                                            Clear All
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {/* Editable Pills for this Parent Choice */}
                                    <div className="flex flex-wrap gap-2 items-center min-h-[32px]">
                                      {allowedInRow.length === 0 ? (
                                        <span className="text-[11px] text-gray-400 italic">
                                          No options configured yet for this choice. Click "+ Add Option" above.
                                        </span>
                                      ) : (
                                        allowedInRow.map((cVal, cIdx) => {
                                          const optIdx = (field.options || []).findIndex(
                                            (o) => (typeof o === "object" ? o.value || o.label : String(o)) === cVal
                                          );
                                          const optObj = optIdx !== -1 ? field.options[optIdx] : { label: cVal, value: cVal };
                                          const cValLen = (cVal || "").length;
                                          const cValWidthCh = cValLen > 0
                                            ? Math.max(cValLen + 1, optObj.has_custom_input ? 14 : 7)
                                            : (optObj.has_custom_input ? 16 : 11);

                                          return (
                                            <div key={`${cVal}-${cIdx}`} className="flex flex-col gap-1">
                                              <div className={`flex items-center gap-1.5 bg-white border rounded-full pl-2.5 pr-2 py-1 text-xs shadow-2xs transition ${
                                                optObj.has_custom_input
                                                  ? "border-purple-300 bg-purple-50/40"
                                                  : "border-indigo-300 hover:border-indigo-500"
                                              }`}>
                                                <span className={optObj.has_custom_input ? "text-purple-600 text-[11px]" : "text-indigo-500 text-[10px]"}>
                                                  {optObj.has_custom_input ? "💬" : "🏷️"}
                                                </span>
                                                <input
                                                  type="text"
                                                  value={cVal}
                                                  onChange={(e) => handleRenameOptionInMapping(realIdx, cVal, e.target.value)}
                                                  style={{ width: `${cValWidthCh}ch` }}
                                                  className={`min-w-[50px] max-w-[200px] outline-none font-bold text-xs bg-transparent ${
                                                    optObj.has_custom_input ? "text-purple-900" : "text-gray-900"
                                                  }`}
                                                  placeholder={optObj.has_custom_input ? "e.g. + Client colour" : "Option text"}
                                                />
                                                <button
                                                  type="button"
                                                  onClick={() => handleRemoveOptionFromParent(realIdx, pOpt, cVal)}
                                                  className="w-4 h-4 rounded-full flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer shrink-0"
                                                  title={`Remove "${cVal}" from ${pOpt}`}
                                                >
                                                  <svg className="w-2.5 h-2.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M2 2l10 10M12 2L2 12" />
                                                  </svg>
                                                </button>
                                              </div>
                                              {/* Custom Box Label & Placeholder Config */}
                                              {optObj.has_custom_input && optIdx !== -1 && (
                                                <div className="flex items-center gap-1 bg-purple-50/80 border border-purple-200 px-2 py-1 rounded-xl text-[10px] shadow-2xs">
                                                  <span className="text-purple-900 font-bold whitespace-nowrap">Box:</span>
                                                  <input
                                                    type="text"
                                                    placeholder="Label"
                                                    value={optObj.custom_input_label || ""}
                                                    onChange={(e) => handleUpdateOptionCustomInput(realIdx, optIdx, "custom_input_label", e.target.value)}
                                                    className="px-1.5 py-0.5 bg-white border border-purple-200 rounded text-[10px] w-20 outline-none font-semibold text-gray-800 focus:border-purple-400"
                                                    title="Label displayed in enquiry flow"
                                                  />
                                                  <input
                                                    type="text"
                                                    placeholder="Placeholder"
                                                    value={optObj.custom_input_placeholder || ""}
                                                    onChange={(e) => handleUpdateOptionCustomInput(realIdx, optIdx, "custom_input_placeholder", e.target.value)}
                                                    className="px-1.5 py-0.5 bg-white border border-purple-200 rounded text-[10px] w-28 outline-none text-gray-800 focus:border-purple-400"
                                                    title="Placeholder inside the text box"
                                                  />
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })
                                      )}
                                    </div>

                                    {/* Quick-Add from other choices */}
                                    {otherAvailable.length > 0 && (
                                      <div className="flex items-center gap-1.5 pt-1 text-[11px] text-gray-500 flex-wrap">
                                        <span className="text-[10px] text-gray-400 font-medium">Add from other choices:</span>
                                        {otherAvailable.map((optName) => (
                                          <button
                                            key={optName}
                                            type="button"
                                            onClick={() => handleToggleOptionMapping(realIdx, pOpt, optName)}
                                            className="px-2 py-0.5 rounded-full border border-dashed border-gray-300 bg-gray-50/80 hover:bg-indigo-50 hover:border-indigo-400 text-gray-600 hover:text-indigo-800 text-[10px] font-semibold transition cursor-pointer flex items-center gap-0.5"
                                            title={`Add existing "${optName}" to ${pOpt}`}
                                          >
                                            <span className="text-indigo-600 font-bold">+</span>
                                            <span>{optName}</span>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Option Pills (Hidden when locked, textarea, checkbox, or file_upload) */}
                    {!field.is_locked &&
                    field.field_type !== "textarea" &&
                    field.field_type !== "checkbox" &&
                    field.field_type !== "file_upload" ? (
                      <div className="pt-2 border-t border-gray-200/80">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-bold text-gray-700 flex items-center gap-0.5">
                            <span>
                              {field.field_type === "number" || field.field_type === "text"
                                ? "Optional Quick-Click Preset Chips (e.g. 25g, 30g, 40g to fill automatically):"
                                : "Options / Selectable Pills:"}
                            </span>
                            <EmojiHelpTooltip />
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleFeedFromConstructionMaster(realIdx)}
                              className="text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-lg cursor-pointer transition flex items-center gap-1 shadow-2xs"
                              title="Feed options and icons from Construction Master"
                            >
                              <span>📥</span> Feed from Construction Master
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddOption(realIdx)}
                              className="text-[11px] font-bold text-[#4B3BF5] hover:underline cursor-pointer"
                            >
                              + Add Option Pill
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddCustomOption(realIdx)}
                              className="text-[10px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-300 px-2.5 py-1 rounded-lg cursor-pointer transition flex items-center gap-1 shadow-2xs"
                              title="Add a custom input option (e.g. + Client Colour, Other, etc. that displays an input box when selected)"
                            >
                              <span>💬</span> + Need Custom
                            </button>
                          </div>
                        </div>

                        {(!field.options || field.options.length === 0) &&
                          (field.field_type === "number" || field.field_type === "text") && (
                            <p className="text-[11px] text-gray-400 italic mb-1.5">
                              No preset chips. Salesperson will type value directly into the input box.
                            </p>
                          )}

                        <div className="flex flex-wrap gap-2">
                          {(field.options || []).map((opt, optIdx) => {
                            const labelLength = (opt.label || "").length;
                            const inputWidthCh = labelLength > 0
                              ? Math.max(labelLength + 1, opt.has_custom_input ? 14 : 7)
                              : (opt.has_custom_input ? 16 : 11);

                            return (
                              <div key={optIdx} className="flex flex-col gap-1">
                                <div className={`flex items-center gap-1.5 bg-white border rounded-full pl-2 pr-2 py-1 text-xs shadow-2xs transition ${
                                  opt.has_custom_input
                                    ? "border-purple-300 bg-purple-50/40"
                                    : "border-gray-300 hover:border-indigo-300"
                                }`}>
                                  {/* Optional Icon / Emoji input */}
                                  {opt.has_custom_input ? (
                                    <span className="text-xs ml-1" title="Custom Input Option">💬</span>
                                  ) : (
                                    <input
                                      type="text"
                                      value={opt.icon || ""}
                                      onChange={(e) => handleOptionChange(realIdx, optIdx, "icon", e.target.value)}
                                      className="w-7 text-center outline-none bg-gray-50 hover:bg-gray-100 rounded text-xs border border-gray-200 py-0.5"
                                      placeholder="🏷️"
                                      title="Optional Emoji / Icon - Click the (i) info icon above or press Win + . (Windows) / Cmd + Ctrl + Space (Mac) to insert"
                                    />
                                  )}
                                  <input
                                    type="text"
                                    value={opt.label || ""}
                                    onChange={(e) => handleOptionChange(realIdx, optIdx, "label", e.target.value)}
                                    style={{ width: `${inputWidthCh}ch` }}
                                    className={`min-w-[55px] max-w-[220px] outline-none font-semibold text-xs bg-transparent ${
                                      opt.has_custom_input ? "text-purple-950 font-bold" : "text-gray-800"
                                    }`}
                                    placeholder={opt.has_custom_input ? "e.g. + Client colour" : "Option text"}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveOption(realIdx, optIdx)}
                                    className="w-4 h-4 rounded-full flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer shrink-0"
                                    title="Delete option"
                                  >
                                    <svg className="w-2.5 h-2.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M2 2l10 10M12 2L2 12" />
                                    </svg>
                                  </button>
                                </div>
                                {/* Inline Custom Box Label & Placeholder Config */}
                                {opt.has_custom_input && (
                                  <div className="flex items-center gap-1.5 bg-purple-50/80 border border-purple-200 px-2.5 py-1 rounded-xl text-[10px] shadow-2xs">
                                    <span className="text-purple-900 font-bold whitespace-nowrap">Input Box:</span>
                                    <input
                                      type="text"
                                      placeholder="Box Label (e.g. Client Colour)"
                                      value={opt.custom_input_label || ""}
                                      onChange={(e) => handleUpdateOptionCustomInput(realIdx, optIdx, "custom_input_label", e.target.value)}
                                      className="px-2 py-0.5 bg-white border border-purple-200 rounded text-[10px] w-28 outline-none font-semibold text-gray-800 focus:border-purple-400"
                                      title="Label displayed next to custom input box in enquiry flow"
                                    />
                                    <input
                                      type="text"
                                      placeholder="Placeholder (e.g. Enter client colour)"
                                      value={opt.custom_input_placeholder || ""}
                                      onChange={(e) => handleUpdateOptionCustomInput(realIdx, optIdx, "custom_input_placeholder", e.target.value)}
                                      className="px-2 py-0.5 bg-white border border-purple-200 rounded text-[10px] w-36 outline-none text-gray-800 focus:border-purple-400"
                                      title="Placeholder inside the custom text box"
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-gray-200/80 flex items-center justify-between text-xs text-gray-500">
                        <span className="text-[11px] font-medium">
                          This field is locked. In the enquiry flow, clients will see the fixed locked pill:
                        </span>
                        <span className="inline-flex items-center gap-1 px-3 py-1 border border-dashed border-indigo-400 bg-white text-gray-900 rounded-full font-bold text-xs shadow-2xs">
                          🔒 {field.locked_value || "Fixed Value"}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          </div>
        )}

        {/* TAB 3: SIZES & RATES SETUP */}
        {activeTab === "size" && (
          <ProductConfigSizeTab
            formData={formData}
            setFormData={setFormData}
            sizeModes={SIZE_MODES}
          />
        )}

        {/* TAB 4: PRESETS & SPEC LINE */}
        {activeTab === "presets" && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Live SPEC LINE Template</label>
              <input
                type="text"
                name="spec_line_template"
                value={formData.spec_line_template || ""}
                onChange={onInputChange}
                placeholder="e.g. Scroll · {size} · {orientation} · {personal}"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold bg-white font-mono"
              />
              <span className="text-[11px] text-gray-400">
                Variables enclosed in curly braces like &#123;size&#125;, &#123;orientation&#125; are replaced with active values.
              </span>
            </div>

            <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl space-y-3">
              <h3 className="font-bold text-xs text-gray-900 uppercase tracking-wider">
                Quick Presets ("One tap fills the card")
              </h3>
              <p className="text-[11px] text-gray-500">
                Define pre-filled combinations with preset budget rates.
              </p>

              {(formData.presets || []).map((preset, pIdx) => (
                <div key={pIdx} className="p-3 bg-white border border-gray-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <input
                      type="text"
                      value={preset.label || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          presets: (prev.presets || []).map((p, i) =>
                            i === pIdx ? { ...p, label: val } : p
                          ),
                        }));
                      }}
                      placeholder="Preset Button Label (e.g. Velvet scroll with brass rods, A4)"
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-bold text-gray-900 flex-1"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400">₹</span>
                      <input
                        type="number"
                        value={preset.budget || 0}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setFormData((prev) => ({
                            ...prev,
                            presets: (prev.presets || []).map((p, i) =>
                              i === pIdx ? { ...p, budget: val } : p
                            ),
                          }));
                        }}
                        placeholder="Rate"
                        className="w-24 px-2 py-1.5 border border-gray-300 rounded-lg text-xs font-bold text-gray-900"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            presets: (prev.presets || []).filter((_, i) => i !== pIdx),
                          }));
                        }}
                        className="text-xs text-red-500 font-bold px-2 py-1 hover:text-red-700 cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => {
                  setFormData((prev) => ({
                    ...prev,
                    presets: [
                      ...(prev.presets || []),
                      { label: "New Quick Preset", specs: {}, budget: 250 },
                    ],
                  }));
                }}
                className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl text-xs font-bold cursor-pointer"
              >
                + Add Preset Card
              </button>
            </div>
          </div>
        )}

        {/* Submit Bar */}
        <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={handleReset}
            className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-xs font-bold hover:bg-gray-50 cursor-pointer"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-[#4B3BF5] hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : currentId ? "Update Product" : "Save & Activate Product"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProductConfigMasterForm;
