import React from "react";

export const COPYRIGHT_OPTIONS = [
  {
    id: 1,
    value:
      "This artwork is the intellectual property of RD Custom Awards Pvt. Ltd., and all copyrights are held exclusively by RD Custom Awards Pvt. Ltd",
  },
  {
    id: 2,
    value:
      "Please note Design Copyrights Apply & is credited with the designer of this design",
  },
];

export const ToggleSwitch = ({ value, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!value)}
    className={`relative inline-flex w-10 h-5 rounded-full transition-colors duration-200 cursor-pointer flex-shrink-0 ${
      value ? "bg-[#635BFF]" : "bg-gray-200"
    }`}
  >
    <span
      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
        value ? "translate-x-5" : "translate-x-0"
      }`}
    />
  </button>
);

/**
 * Reusable Design Settings Card
 * Handles toggles (Designer needed, Quote only, Show RD logo, Show RD content),
 * Assign Designer selection, Copyright options, Design options count, Due in hours,
 * and Client Review Link Expiry.
 *
 * Supports both:
 * 1. Per-product mode (isPerProduct = true)
 * 2. Global mode (isPerProduct = false)
 */
const DesignSettingsCard = ({
  isPerProduct = false,
  productName = "",
  designer = true,
  quoteOnly = false,
  showRDLogo = false,
  showRDContent = false,
  assignedDesigner = "",
  assignedDesignerName = "",
  copyrightContent = "",
  designOptions = 2,
  optionsDueIn = 24,
  linksDuration = 24,
  designersList = [],
  products = [],
  onUpdate = () => {},
  onApplyToAllProducts = null,
  onLinksDurationChange = () => {},
}) => {
  return (
    <div
      className={
        isPerProduct
          ? "pt-3 border-t border-gray-100 space-y-4"
          : "panel p-4 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-4"
      }
    >
      {isPerProduct && (
        <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">
          Design settings for this product
        </div>
      )}

      {/* 4 Main Toggles */}
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 ${isPerProduct ? "gap-2.5" : "gap-3"}`}
      >
        {/* Toggle 1: Designer needed */}
        <div
          className={`p-3 rounded-xl border-2 flex items-center justify-between gap-3 transition ${
            designer
              ? "bg-indigo-50/60 border-indigo-400"
              : "bg-white border-gray-200"
          }`}
        >
          <div>
            <div className="font-bold text-xs text-gray-900">
              Designer needed
            </div>
            <div className="text-[11px] text-gray-500">
              Design team creates options before the quote
            </div>
          </div>
          <ToggleSwitch
            value={designer}
            onChange={(v) => onUpdate({ designer: v })}
          />
        </div>

        {/* Toggle 2: Quote only */}
        <div
          className={`p-3 rounded-xl border-2 flex items-center justify-between gap-3 transition ${
            quoteOnly
              ? "bg-amber-50/60 border-amber-400"
              : "bg-white border-gray-200"
          }`}
        >
          <div>
            <div className="font-bold text-xs text-gray-900">Quote only</div>
            <div className="text-[11px] text-gray-500">
              Client just wants a price for now
            </div>
          </div>
          <ToggleSwitch
            value={quoteOnly}
            onChange={(v) => onUpdate({ quoteOnly: v })}
          />
        </div>

        {/* Toggle 3: Show RD logo */}
        <div
          className={`p-3 rounded-xl border-2 flex items-center justify-between gap-3 transition ${
            showRDLogo
              ? "bg-indigo-50/60 border-indigo-400"
              : "bg-white border-gray-200"
          }`}
        >
          <div>
            <div className="font-bold text-xs text-gray-900 flex items-center gap-1.5">
              <span>Show RD logo</span>
              {isPerProduct && (
                <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-100 px-1.5 py-0.2 rounded">
                  All trophies
                </span>
              )}
            </div>
            <div className="text-[11px] text-gray-500">
              On the design options we share
            </div>
          </div>
          <ToggleSwitch
            value={showRDLogo}
            onChange={(v) => onUpdate({ showRDLogo: v })}
          />
        </div>

        {/* Toggle 4: Show RD content */}
        <div
          className={`p-3 rounded-xl border-2 flex items-center justify-between gap-3 transition ${
            showRDContent
              ? "bg-indigo-50/60 border-indigo-400"
              : "bg-white border-gray-200"
          }`}
        >
          <div>
            <div className="font-bold text-xs text-gray-900 flex items-center gap-1.5">
              <span>Show RD content</span>
              {isPerProduct && (
                <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-100 px-1.5 py-0.2 rounded">
                  All trophies
                </span>
              )}
            </div>
            <div className="text-[11px] text-gray-500">
              Company profile with the options
            </div>
          </div>
          <ToggleSwitch
            value={showRDContent}
            onChange={(v) => {
              if (v && !copyrightContent) {
                onUpdate({
                  showRDContent: true,
                  copyrightContent: COPYRIGHT_OPTIONS[0].value,
                });
              } else {
                onUpdate({ showRDContent: v });
              }
            }}
          />
        </div>
      </div>

      {/* Assign Designer Dropdown */}
      {designer && (
        <div
          className={`sm:col-span-2 p-3 rounded-xl border space-y-2 transition ${
            !assignedDesigner
              ? "border-amber-300 bg-amber-50/40"
              : "border-indigo-200 bg-indigo-50/50"
          }`}
        >
          <div className="flex items-center justify-between flex-wrap gap-1">
            <label className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
              <span>🎨</span>{" "}
              {isPerProduct
                ? `Assign Designer for ${productName || "Product"}`
                : "Assign Designer"}{" "}
              <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              {isPerProduct &&
                onApplyToAllProducts &&
                products.length > 1 &&
                assignedDesigner && (
                  <button
                    type="button"
                    onClick={() =>
                      onApplyToAllProducts(
                        assignedDesigner,
                        assignedDesignerName,
                      )
                    }
                    className="text-[10px] text-indigo-700 bg-indigo-100 hover:bg-indigo-200 px-2 py-0.5 rounded font-bold transition cursor-pointer"
                    title="Assign this same designer to all products in this enquiry"
                  >
                    ⚡ Apply to all products
                  </button>
                )}
              <span className="text-[10px] text-indigo-600 font-semibold">
                {designersList.length} designers available
              </span>
            </div>
          </div>
          <select
            className={`w-full px-3 py-2 bg-white rounded-lg text-xs font-medium text-gray-800 outline-none cursor-pointer shadow-xs border ${
              !assignedDesigner
                ? "border-amber-400 focus:border-amber-500"
                : "border-indigo-300 focus:border-indigo-600"
            }`}
            value={assignedDesigner || ""}
            onChange={(ev) => {
              const dId = ev.target.value;
              const sel = designersList.find(
                (d) => String(d._id || d.id) === String(dId),
              );
              onUpdate({
                assignedDesigner: dId,
                designerName: sel?.name || "",
                designer_id: dId,
                designer_name: sel?.name || "",
              });
            }}
          >
            <option value="">Select a Designer to assign</option>
            {designersList.map((d) => (
              <option key={d._id || d.id} value={d._id || d.id}>
                {d.name} ({d.role})
              </option>
            ))}
          </select>
          {!assignedDesigner && (
            <div className="text-[11px] text-amber-700 font-semibold flex items-center gap-1">
              <span>⚠️</span>
              <span>Please select a designer to proceed</span>
            </div>
          )}
        </div>
      )}

      {/* Copyright Content Dropdown when Show RD content is ON */}
      {showRDContent && (
        <div className="space-y-1.5 fade">
          <label className="block text-xs font-bold text-gray-800 flex items-center gap-1.5">
            <span>Copyright Content</span>
            {isPerProduct && (
              <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-100 px-1.5 py-0.2 rounded">
                Applies to all trophies
              </span>
            )}
            <span className="text-red-500">*</span>
          </label>
          <select
            className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
            value={copyrightContent || COPYRIGHT_OPTIONS[0].value}
            onChange={(ev) => onUpdate({ copyrightContent: ev.target.value })}
          >
            {COPYRIGHT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.value}>
                {opt.value}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* How many design options */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-gray-800">
          How many design options?
        </div>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => {
            const isSelected = Number(designOptions) === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => onUpdate({ designOptions: n })}
                className="w-9 h-9 rounded-full border-2 text-xs font-extrabold transition cursor-pointer"
                style={
                  isSelected
                    ? {
                        borderColor: "#635BFF",
                        color: "#635BFF",
                        backgroundColor: "#EEF2FF",
                      }
                    : {
                        borderColor: "#E5E7EB",
                        color: "#6B7280",
                        backgroundColor: "#fff",
                      }
                }
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      {/* Options due in */}
      {designer && (
        <div className="space-y-2">
          <div className="text-xs font-bold text-gray-800">Options due in</div>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { v: 4, label: "4 hours", sub: "rush" },
              { v: 24, label: "24 hours", sub: null },
              { v: 48, label: "48 hours", sub: null },
            ].map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => onUpdate({ optionsDueIn: opt.v })}
                className="px-4 py-2 rounded-full border-2 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                style={
                  optionsDueIn === opt.v
                    ? {
                        borderColor: "#635BFF",
                        color: "#635BFF",
                        backgroundColor: "#EEF2FF",
                      }
                    : {
                        borderColor: "#E5E7EB",
                        color: "#374151",
                        backgroundColor: "#fff",
                      }
                }
              >
                <span>{opt.label}</span>
                {opt.sub && (
                  <span className="text-[10px] opacity-60 font-normal">
                    {opt.sub}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Client Review Link Expiry (Common setting across all products) */}
      <div className="pt-3 border-t border-gray-100 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-800">
              Client Review Link Expiry
            </span>
            {isPerProduct && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Common for all products
              </span>
            )}
          </div>
          <span className="text-[10px] text-gray-400 font-medium">
            Link expires after this duration
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { v: 24, label: "24 hours (Default)" },
            { v: 48, label: "48 hours" },
          ].map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => onLinksDurationChange(opt.v)}
              className="px-4 py-2 rounded-full border-2 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
              style={
                linksDuration === opt.v
                  ? {
                      borderColor: "#10B981",
                      color: "#065F46",
                      backgroundColor: "#ECFDF5",
                    }
                  : {
                      borderColor: "#E5E7EB",
                      color: "#374151",
                      backgroundColor: "#fff",
                    }
              }
            >
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-400">
          When client opens the WhatsApp or Email review link, it will remain
          active for {linksDuration} hours
          {isPerProduct
            ? " (applies commonly across all products in this enquiry)."
            : "."}
        </p>
      </div>
    </div>
  );
};

export default DesignSettingsCard;
