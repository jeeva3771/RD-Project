import React from "react";
import StatusBadge from "../../components/StatusBadge";
import { getProductBadge } from "./ApplicableProductsSelector";

const SubMasterViewModal = ({
  isOpen,
  onClose,
  onEdit,
  item,
  masterType, // "plating" | "process" | "attachment"
}) => {
  if (!isOpen || !item) return null;

  const CONFIG = {
    plating: {
      title: "Plating & Finish Details",
      icon: "✨",
      colorBadge: "bg-amber-50 text-amber-800 border-amber-200",
      costLabel: "Extra Rate / Unit",
      costValue: item.extra_rate ? `₹${item.extra_rate}` : "₹0 (Included)",
    },
    process: {
      title: "Production Technique Details",
      icon: "🖨️",
      colorBadge: "bg-purple-50 text-purple-800 border-purple-200",
      costLabel: "Base Process Cost",
      costValue: item.base_cost ? `₹${item.base_cost}` : "₹0",
    },
    attachment: {
      title: "Hardware Attachment Details",
      icon: "📎",
      colorBadge: "bg-indigo-50 text-indigo-800 border-indigo-200",
      costLabel: "Extra Attachment Cost",
      costValue: item.extra_cost ? `₹${item.extra_cost}` : "₹0 (Included)",
    },
  }[masterType] || {
    title: "Master Details",
    icon: "📋",
    colorBadge: "bg-gray-100 text-gray-800 border-gray-200",
    costLabel: "Cost",
    costValue: "₹0",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-indigo-50/20 flex justify-between items-start">
          <div className="flex items-center gap-3.5">
            {masterType === "plating" ? (
              <div
                className="w-12 h-12 rounded-2xl border-2 border-white shadow-md flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: item.code || "#D4AF37",
                }}
              />
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-white border border-gray-200 shadow-xs flex items-center justify-center text-2xl shrink-0">
                {CONFIG.icon}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">{item.name}</h2>
                <StatusBadge isActive={item.is_active} />
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{CONFIG.title}</p>
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

        {/* Content Body */}
        <div className="p-6 space-y-5 text-xs">
          {/* Main Key Info Box */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-gray-50 border border-gray-200">
            <div>
              <span className="text-[11px] text-gray-400 block mb-0.5 font-medium">
                {masterType === "plating"
                  ? "Hex Code / Color"
                  : masterType === "process"
                  ? "Process Category"
                  : "Attachment Type"}
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                {masterType === "plating" && (
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-gray-300"
                    style={{ backgroundColor: item.code || "#D4AF37" }}
                  />
                )}
                <span className="font-bold text-gray-900 text-sm font-mono">
                  {masterType === "plating"
                    ? item.code || "—"
                    : masterType === "process"
                    ? (item.category || "print").toUpperCase()
                    : item.type?.replace(/_/g, " ") || "pin_back"}
                </span>
              </div>
            </div>

            <div>
              <span className="text-[11px] text-gray-400 block mb-0.5 font-medium">
                {CONFIG.costLabel}
              </span>
              <span className="font-bold text-emerald-700 text-sm mt-0.5 block">
                {CONFIG.costValue}
              </span>
            </div>
          </div>

          {/* Applicable Products */}
          {masterType !== "plating" && (
            <div>
              <span className="text-xs font-bold text-gray-800 block mb-2">
                Applicable Products:
              </span>
              {(!item.applicable_products || item.applicable_products.length === 0) ? (
                <span className="text-gray-400 italic">None specified</span>
              ) : item.applicable_products.includes("all") ? (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 inline-block">
                  🌐 All Products Applicable
                </span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {item.applicable_products.map((prod) => {
                    const badge = getProductBadge(prod);
                    return (
                      <span
                        key={prod}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200 flex items-center gap-1.5"
                      >
                        <span>{badge.icon}</span>
                        <span>{badge.label}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Additional Meta Details */}
          <div className="pt-4 border-t border-gray-100 grid grid-cols-2 gap-4 text-gray-500">
            {typeof item.sort_order !== "undefined" && (
              <div>
                <span className="block text-[11px] font-medium text-gray-400">Sort Priority:</span>
                <span className="font-bold text-gray-800">#{item.sort_order}</span>
              </div>
            )}
            <div>
              <span className="block text-[11px] font-medium text-gray-400">Last Updated:</span>
              <span className="font-semibold text-gray-700">
                {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : "—"}
              </span>
            </div>
            <div>
              <span className="block text-[11px] font-medium text-gray-400">Record Created:</span>
              <span className="font-semibold text-gray-700">
                {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
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
                onEdit(item);
              }}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>✏️</span> Edit Record
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubMasterViewModal;
