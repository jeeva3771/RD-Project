import React from "react";
import { Select, MenuItem } from "@mui/material";
import ApplicableProductsSelector from "./ApplicableProductsSelector";

const CATEGORIES = [
  { value: "print", label: "Printing (UV, Screen, Digital, Offset)" },
  { value: "engrave", label: "Engraving (Laser, Rotary, Diamond)" },
  { value: "enamel", label: "Enamel (Soft Enamel, Hard Enamel, Epoxy)" },
  { value: "cast", label: "Casting & Die (Zinc Cast, MS Punch)" },
  { value: "finish", label: "Surface Finish & Polish" },
  { value: "other", label: "Other Techniques" },
];

const ProcessEnquiryMasterForm = ({
  formData,
  errors,
  isSubmitting,
  onInputChange,
  setFormData,
  onSubmit,
  currentId,
  handleReset,
}) => {

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 mb-6">
      <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
        <div>
          <h2 className="text-base font-bold text-gray-800">
            {currentId ? "Edit Production Technique" : "Add New Production Technique"}
          </h2>
          <p className="text-xs text-gray-500">
            Configure printing methods, engraving, enameling, and casting options used across product questionnaire cards.
          </p>
        </div>
        {currentId && (
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
          >
            Switch to Create
          </button>
        )}
      </div>

      <form onSubmit={onSubmit} className="p-6">
        <div className="grid md:grid-cols-3 gap-4 mb-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Technique Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name || ""}
              onChange={onInputChange}
              className={`w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 ${
                errors.name ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="e.g. UV Direct Print, Soft Enamel Colour Fill"
            />
            {errors.name && <p className="mt-1 text-[11px] text-red-500">{errors.name}</p>}
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Category</label>
            <Select
              size="small"
              fullWidth
              name="category"
              value={formData.category || "print"}
              onChange={onInputChange}
              sx={{ borderRadius: "0.75rem", fontSize: "0.75rem" }}
            >
              {CATEGORIES.map((cat) => (
                <MenuItem key={cat.value} value={cat.value} sx={{ fontSize: "0.75rem" }}>
                  {cat.label}
                </MenuItem>
              ))}
            </Select>
          </div>

          {/* Base Cost */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Base Cost (₹)</label>
            <input
              type="number"
              name="base_cost"
              value={formData.base_cost ?? 0}
              onChange={onInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="0"
              min="0"
            />
          </div>
        </div>

        {/* Applicable Products (Dynamic from Product Engine) */}
        <ApplicableProductsSelector
          value={formData.applicable_products}
          onChange={(newVal) =>
            setFormData((prev) => ({ ...prev, applicable_products: newVal }))
          }
          activeColor="indigo"
        />

        {/* Status */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Status</label>
            <Select
              size="small"
              fullWidth
              value={formData.is_active ? "true" : "false"}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, is_active: e.target.value === "true" }))
              }
              sx={{ borderRadius: "0.75rem", fontSize: "0.75rem" }}
            >
              <MenuItem value="true" sx={{ fontSize: "0.75rem" }}>
                Active
              </MenuItem>
              <MenuItem value="false" sx={{ fontSize: "0.75rem" }}>
                Inactive
              </MenuItem>
            </Select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : currentId ? "Update Technique" : "Save Technique"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProcessEnquiryMasterForm;
