import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchActiveProductConfigs } from "../../../reducer/masters/enquiryFlow/productConfigMasterReducer";

const FALLBACK_PRODUCTS = [
  { id: "lapel_pin", label: "Lapel Pin", icon: "🎖️" },
  { id: "badge", label: "Badge", icon: "🔘" },
  { id: "cufflinks", label: "Cufflinks", icon: "👔" },
  { id: "tie_pin", label: "Tie Bar", icon: "👔" },
  { id: "medal", label: "Medal", icon: "🥇" },
  { id: "flagstand", label: "Flag Stand", icon: "🚩" },
  { id: "coaster", label: "Coaster", icon: "☕" },
  { id: "scroll", label: "Scroll", icon: "📜" },
  { id: "fridge_magnet", label: "Fridge Magnet", icon: "🧲" },
  { id: "plaque", label: "Plaque", icon: "🛡️" },
  { id: "trophy", label: "Trophy", icon: "🏆" },
  { id: "frame", label: "Frame", icon: "🖼️" },
];

const ApplicableProductsSelector = ({
  value = [],
  onChange,
  label = "Applicable Products",
  activeColor = "indigo", // "indigo" | "purple"
}) => {
  const dispatch = useDispatch();
  const { activeItems = [], loading } = useSelector((state) => state.productConfigMaster || {});

  useEffect(() => {
    dispatch(fetchActiveProductConfigs());
  }, [dispatch]);

  const products =
    activeItems && activeItems.length > 0
      ? activeItems.map((item) => ({
          id: item.product_id,
          label: item.name,
          icon: item.icon || "📦",
        }))
      : FALLBACK_PRODUCTS;

  const selectedList = Array.isArray(value) ? value : [];

  const toggleProduct = (prodId) => {
    const updated = selectedList.includes(prodId)
      ? selectedList.filter((p) => p !== prodId)
      : [...selectedList, prodId];
    onChange(updated);
  };

  const handleSelectAll = () => {
    onChange(products.map((p) => p.id));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const activeClasses =
    activeColor === "purple"
      ? "bg-purple-600 text-white shadow-xs ring-2 ring-purple-300"
      : "bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-300";

  return (
    <div className="mb-4">
      {/* Header with Title, Count & Quick Select Actions */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <label className="block text-xs font-bold text-gray-700">
            {label}
          </label>
          <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
            {selectedList.length} of {products.length} selected
          </span>
          {loading && (
            <span className="text-[10px] text-indigo-500 font-medium animate-pulse">
              Syncing with Product Engine...
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={handleSelectAll}
            className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer transition hover:underline"
          >
            Select All
          </button>
          <span className="text-gray-300">|</span>
          <button
            type="button"
            onClick={handleClearAll}
            className="text-gray-500 hover:text-gray-700 font-medium cursor-pointer transition hover:underline"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Product Pills fetched from Product Engine */}
      <div className="flex flex-wrap gap-2">
        {products.map((prod) => {
          const isSelected = selectedList.includes(prod.id);
          return (
            <button
              type="button"
              key={prod.id}
              onClick={() => toggleProduct(prod.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 select-none ${
                isSelected
                  ? activeClasses
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-transparent"
              }`}
            >
              <span className="text-sm">{prod.icon}</span>
              <span>{prod.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const getProductBadge = (prodId, customList = null) => {
  const list = customList && customList.length > 0 ? customList : FALLBACK_PRODUCTS;
  const found = list.find((p) => p.id === prodId || p.product_id === prodId);
  if (found) {
    return { id: found.id || found.product_id, label: found.label || found.name, icon: found.icon || "📦" };
  }
  return { id: prodId, label: String(prodId || "").replace(/_/g, " "), icon: "📦" };
};

export default ApplicableProductsSelector;
