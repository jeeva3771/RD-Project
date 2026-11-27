import React, { useState } from "react";
import StatusBadge from "../../components/StatusBadge";

const ProductConfigViewModal = ({ isOpen, onClose, product, onEdit }) => {
  const [activeTab, setActiveTab] = useState("overview");

  if (!isOpen || !product) return null;

  const TABS = [
    { id: "overview", label: "Overview & Route", icon: "📋" },
    {
      id: "design",
      label: `Design Fields (${product.design_fields?.length || 0})`,
      icon: "🎨",
    },
    { id: "size", label: "Size & Rates", icon: "📐" },
    {
      id: "presets",
      label: `Quick Presets (${product.presets?.length || 0})`,
      icon: "⚡",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-indigo-50/30 flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 shadow-xs flex items-center justify-center text-3xl">
              {product.icon || "📦"}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold text-gray-900">{product.name}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {product.product_id}
                </span>
                <StatusBadge isActive={product.is_active} />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {product.sub_label || "No subtitle specified"} · Sort Order: #{product.sort_order ?? 0}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 border border-gray-200 text-gray-500 hover:text-gray-800 flex items-center justify-center transition cursor-pointer"
            title="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Modal Tabs Bar */}
        <div className="flex items-center gap-2 px-6 border-b border-gray-200 bg-white overflow-x-auto text-xs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-3.5 border-b-2 font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
          {/* TAB 1: OVERVIEW & ROUTE */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Sub-Categories Card (if enabled) */}
              {product.has_sub_types && (
                <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100">
                  <h4 className="text-xs font-bold text-indigo-900 mb-2.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span>🗂️</span> Sub-Categories / Product Variations
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-200/70 text-indigo-800">
                      {product.sub_types?.length || 0} sub-types
                    </span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {(product.sub_types || []).map((sub, sIdx) => (
                      <div
                        key={sIdx}
                        className="p-2.5 bg-white rounded-xl border border-indigo-100 shadow-2xs space-y-1"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{sub.icon || "📦"}</span>
                          <span className="font-bold text-gray-800 text-xs truncate">
                            {sub.label}
                          </span>
                        </div>
                        <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-mono text-gray-500 bg-gray-50 border border-gray-200">
                          {sub.sub_id}
                        </span>
                        {sub.sub_text && (
                          <p className="text-[11px] text-gray-500 line-clamp-2">
                            {sub.sub_text}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Route Strip Card */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                <h4 className="text-xs font-bold text-gray-800 mb-3 flex items-center gap-1.5">
                  <span>🏭</span> Route & Operational Settings
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3 bg-white rounded-lg border border-gray-200">
                    <span className="text-[11px] text-gray-400 block mb-0.5 font-medium">Route Method</span>
                    <span className="font-bold text-gray-800 text-xs">
                      {product.route_config?.route || "In-house"}
                    </span>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-gray-200">
                    <span className="text-[11px] text-gray-400 block mb-0.5 font-medium">Minimum Order (MOQ)</span>
                    <span className="font-bold text-gray-800 text-xs">
                      {product.route_config?.moq || "MOQ 1 pcs"}
                    </span>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-gray-200">
                    <span className="text-[11px] text-gray-400 block mb-0.5 font-medium">Sample Turnaround</span>
                    <span className="font-bold text-gray-800 text-xs">
                      {product.route_config?.sample_time || "Sample in 2 working days"}
                    </span>
                  </div>
                </div>

                {product.route_config?.note && (
                  <div className="mt-3 p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-amber-900">
                    <span className="font-bold block mb-0.5">Route Note / Guideline:</span>
                    <p className="text-[11px] leading-relaxed">{product.route_config.note}</p>
                  </div>
                )}
              </div>

              {/* Live Spec Line Template */}
              <div className="p-4 rounded-xl bg-gray-900 text-white">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                  Live Spec Line Formula
                </span>
                <code className="text-xs font-mono font-semibold text-emerald-400">
                  {product.spec_line_template || "{product} · {size} · {material}"}
                </code>
                <p className="text-[11px] text-gray-400 mt-2">
                  Used by the Enquiry Flow integration to generate real-time spec summaries on the job card.
                </p>
              </div>

              {/* Meta Audit */}
              <div className="grid grid-cols-2 gap-4 text-gray-500 pt-2 border-t border-gray-100">
                <div>
                  <span className="block text-[11px] font-medium text-gray-400">Created:</span>
                  <span className="font-semibold text-gray-700">
                    {product.createdAt ? new Date(product.createdAt).toLocaleString() : "—"}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] font-medium text-gray-400">Last Updated:</span>
                  <span className="font-semibold text-gray-700">
                    {product.updatedAt ? new Date(product.updatedAt).toLocaleString() : "—"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DESIGN FIELDS */}
          {activeTab === "design" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-xs font-bold text-gray-800">
                  Section 2 Questionnaire Fields ("What's the design?")
                </h4>
                <span className="text-gray-400 text-[11px]">
                  {product.design_fields?.length || 0} fields configured
                </span>
              </div>

              {(!product.design_fields || product.design_fields.length === 0) ? (
                <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400">
                  No design fields configured for this product.
                </div>
              ) : (
                <div className="space-y-3">
                  {product.design_fields.map((field, fIdx) => (
                    <div
                      key={field.field_key || fIdx}
                      className="p-4 bg-gray-50/70 rounded-xl border border-gray-200 hover:border-gray-300 transition"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 text-xs">
                              {fIdx + 1}. {field.label}
                            </span>
                            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-gray-200 text-gray-700">
                              {field.field_key}
                            </span>
                            {field.is_required ? (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                                Required
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded text-[10px] text-gray-500 bg-gray-100">
                                Optional
                              </span>
                            )}
                            {field.is_locked ? (
                              <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                🔒 Locked: {field.locked_value || "Fixed"}
                              </span>
                            ) : field.field_type === "checkbox" ? (
                              <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
                                ☑️ Checkbox Toggle
                              </span>
                            ) : field.field_type === "file_upload" ? (
                              <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300">
                                📎 File Upload
                              </span>
                            ) : field.field_type === "number" ? (
                              <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                🔢 Number Input {field.unit ? `(${field.unit})` : ""}
                              </span>
                            ) : field.field_type === "text" ? (
                              <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-300">
                                📝 Text Input
                              </span>
                            ) : field.field_type === "textarea" ? (
                              <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
                                📄 Multiline / Notes
                              </span>
                            ) : field.selection_mode === "multiple" ? (
                              <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                {field.max_selections > 0 ? `☑️ Multi (Max ${field.max_selections})` : "☑️ Multi (Unlimited)"}
                              </span>
                            ) : (
                              <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600">
                                🔘 Single Choice
                              </span>
                            )}
                            {product.has_sub_types && (
                              <span
                                className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                                  !field.applicable_sub_types?.length
                                    ? "bg-gray-100 text-gray-700"
                                    : "bg-purple-100 text-[#4B3BF5] border border-purple-200"
                                }`}
                              >
                                {!field.applicable_sub_types?.length
                                  ? "All Sub-Types"
                                  : field.applicable_sub_types
                                      .map((sid) => {
                                        const sub = (product.sub_types || []).find((s) => s.sub_id === sid);
                                        return sub ? `${sub.icon || "📦"} ${sub.label}` : sid;
                                      })
                                      .join(", ")}
                              </span>
                            )}
                          </div>
                          {field.sub_text && (
                            <p className="text-[11px] text-gray-500 mt-0.5">{field.sub_text}</p>
                          )}
                        </div>
                      </div>

                      {/* Input Box Visual for number/text */}
                      {(field.field_type === "number" || field.field_type === "text") && (
                        <div className="mt-2.5 p-2 bg-white border border-gray-200 rounded-lg flex items-center gap-2">
                          <span className="text-[11px] font-bold text-gray-600">Input Box:</span>
                          <div className="px-3 py-0.5 bg-gray-50 border border-indigo-300 rounded text-xs text-gray-400 font-medium">
                            {field.placeholder || (field.field_type === "number" ? "Enter number" : "Enter text")}
                          </div>
                          {field.unit && (
                            <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                              {field.unit}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Checkbox Details */}
                      {field.field_type === "checkbox" && (
                        <div className="mt-2.5 p-2 bg-purple-50/70 border border-purple-200 rounded-lg flex items-center justify-between text-xs">
                          <span className="font-bold text-purple-900">
                            ☑️ Text: "{field.checkbox_label || field.label}"
                          </span>
                          <span className="text-[11px] font-semibold text-purple-700 bg-white px-2 py-0.5 rounded border border-purple-200">
                            {field.default_checked ? "Default: Checked" : "Default: Unchecked"}
                          </span>
                        </div>
                      )}

                      {/* File Upload Details */}
                      {field.field_type === "file_upload" && (
                        <div className="mt-2.5 p-2 bg-sky-50/70 border border-sky-200 rounded-lg space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sky-900">📎 Hint: {field.upload_hint || "Logo, design or reference"}</span>
                            <span className="text-[10px] font-semibold text-sky-700 bg-white px-2 py-0.5 rounded border border-sky-200">
                              {field.allow_multiple !== false ? "Multi-file" : "Single file"}
                            </span>
                          </div>
                          {field.allowed_extensions && field.allowed_extensions.length > 0 && (
                            <div className="flex items-center gap-1 text-[10px] text-sky-700">
                              <span className="font-bold">Formats:</span>
                              <span>{field.allowed_extensions.map((x) => x.toUpperCase()).join(", ")}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Options */}
                      {field.field_type !== "checkbox" && field.field_type !== "file_upload" && (
                        <div className="mt-2.5 pt-2 border-t border-gray-200/60">
                          <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1.5 tracking-wider">
                            {field.field_type === "number" || field.field_type === "text"
                              ? `Quick-Click Preset Chips (${field.options?.length || 0}):`
                              : `Options (${field.options?.length || 0}):`}
                          </span>
                          {(!field.options || field.options.length === 0) && (
                            <span className="text-[11px] text-gray-400 italic">No preset options. Direct input only.</span>
                          )}
                          <div className="flex flex-wrap gap-1.5">
                            {field.options?.map((opt, oIdx) => (
                              <span
                                key={oIdx}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${
                                  opt.is_usual
                                    ? "bg-amber-50 text-amber-900 border-amber-300 font-bold"
                                    : "bg-white text-gray-700 border-gray-200"
                                }`}
                              >
                                {opt.color_swatch && (
                                  <span
                                    className="w-2.5 h-2.5 rounded-full border border-gray-300"
                                    style={{ backgroundColor: opt.color_swatch }}
                                  />
                                )}
                                {opt.icon && <span className="text-sm">{opt.icon}</span>}
                                <span>{opt.label}</span>
                                {opt.is_usual && (
                                  <span className="text-[10px] text-amber-700 font-extrabold">★ default</span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SIZE & RATES */}
          {activeTab === "size" && (
            <div className="space-y-6">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <h4 className="text-xs font-bold text-gray-800 mb-3 flex items-center gap-1.5">
                  <span>📐</span> Size Row & Mode Settings
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3 bg-white rounded-lg border border-gray-200">
                    <span className="text-[11px] text-gray-400 block mb-0.5 font-medium">Configured Dimensions</span>
                    <span className="font-bold text-gray-800 text-xs">
                      {product.size_config?.dimensions?.length > 0
                        ? product.size_config.dimensions.map((d) => d.label).join(" × ")
                        : product.product_id === "trophy"
                          ? 'Height presets (6"–18")'
                          : "Standard size"}
                    </span>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-gray-200">
                    <span className="text-[11px] text-gray-400 block mb-0.5 font-medium">Row Header Label</span>
                    <span className="font-bold text-gray-800 text-xs">
                      {product.size_config?.size_row_title || "Size"}
                    </span>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-gray-200">
                    <span className="text-[11px] text-gray-400 block mb-0.5 font-medium">Allow Custom Entry?</span>
                    <span className="font-bold text-gray-800 text-xs">
                      {product.size_config?.allow_custom ? "Yes (Allows typing)" : "No (Fixed presets only)"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Preset Sizes */}
              <div className="p-4 bg-white rounded-xl border border-gray-200">
                <span className="text-xs font-bold text-gray-800 block mb-2">Standard Preset Sizes:</span>
                <div className="flex flex-wrap gap-2">
                  {product.size_config?.preset_sizes?.map((sz, sIdx) => (
                    <span
                      key={sIdx}
                      className={`px-3 py-1 rounded-xl text-xs border font-medium ${
                        sz.is_usual
                          ? "bg-amber-50 text-amber-900 border-amber-300 font-bold"
                          : "bg-gray-50 text-gray-700 border-gray-200"
                      }`}
                    >
                      {sz.label} {sz.is_usual && "★ default"}
                    </span>
                  ))}
                </div>
              </div>

              {/* Quantities & Budget Defaults */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 bg-white rounded-lg border border-gray-200">
                  <span className="text-[11px] text-gray-400 block mb-0.5 font-medium">Preset Quantities</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {product.size_config?.preset_quantities?.map((q) => (
                      <span key={q} className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-bold">
                        {q}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="p-3 bg-white rounded-lg border border-gray-200">
                  <span className="text-[11px] text-gray-400 block mb-0.5 font-medium">Default Budget Estimate</span>
                  <span className="font-bold text-emerald-700 text-sm">
                    ₹{product.size_config?.default_budget ?? 0}
                  </span>
                  <span className="text-[10px] text-gray-400 block mt-0.5">
                    {product.size_config?.budget_subtitle || "What the client expects"}
                  </span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-gray-200">
                  <span className="text-[11px] text-gray-400 block mb-0.5 font-medium">Design Options Shown</span>
                  <span className="font-bold text-indigo-700 text-sm">
                    {product.size_config?.default_design_options ?? 2} options
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: QUICK PRESETS */}
          {activeTab === "presets" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-1">
                <h4 className="text-xs font-bold text-gray-800">Quick Presets ("One tap fills the card")</h4>
                <span className="text-gray-400 text-[11px]">
                  {product.presets?.length || 0} combinations configured
                </span>
              </div>

              {(!product.presets || product.presets.length === 0) ? (
                <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400">
                  No quick presets defined for this product.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {product.presets.map((pr, pIdx) => (
                    <div
                      key={pIdx}
                      className="p-4 bg-gray-50/80 rounded-xl border border-gray-200 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-gray-900 text-xs">⚡ {pr.label}</span>
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                            ₹{pr.budget}
                          </span>
                        </div>
                        <div className="space-y-1 mt-2 pt-2 border-t border-gray-200 text-[11px] text-gray-600">
                          {Object.entries(pr.specs || {}).map(([k, val]) => (
                            <div key={k} className="flex justify-between">
                              <span className="text-gray-400 font-medium capitalize">{k}:</span>
                              <span className="font-semibold text-gray-800">{String(val)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-100 transition cursor-pointer"
          >
            Close
          </button>
          {onEdit && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(product);
              }}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>✏️</span> Edit Product Config
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductConfigViewModal;
