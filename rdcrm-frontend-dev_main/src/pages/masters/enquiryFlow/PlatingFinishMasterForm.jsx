import React from "react";
import { Select, MenuItem } from "@mui/material";

const PlatingFinishMasterForm = ({
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
            {currentId ? "Edit Plating & Finish" : "Add New Plating & Finish"}
          </h2>
          <p className="text-xs text-gray-500">
            Configure shared electroplating and metallic finishes for metals, badges, medals, etc.
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
        <div className="grid md:grid-cols-4 gap-4 mb-4">
          {/* Name */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Finish Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name || ""}
              onChange={onInputChange}
              className={`w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 ${
                errors.name ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="e.g. Shiny Gold, Antique Bronze, Black Nickel"
            />
            {errors.name && <p className="mt-1 text-[11px] text-red-500">{errors.name}</p>}
          </div>

          {/* Color Code / Swatch */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Color Code / Gradient
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formData.code?.startsWith("#") ? formData.code : "#D4AF37"}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, code: e.target.value }))
                }
                className="w-9 h-9 p-0.5 border border-gray-300 rounded-lg cursor-pointer"
              />
              <input
                type="text"
                name="code"
                value={formData.code || ""}
                onChange={onInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="#D4AF37"
              />
            </div>
          </div>

          {/* Extra Rate */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Extra Rate (₹ / pc)
            </label>
            <input
              type="number"
              name="extra_rate"
              value={formData.extra_rate ?? 0}
              onChange={onInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="0"
              min="0"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {/* Sort Order */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Sort Order</label>
            <input
              type="number"
              name="sort_order"
              value={formData.sort_order ?? 0}
              onChange={onInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="0"
            />
          </div>

          {/* Status */}
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
            {isSubmitting ? "Saving..." : currentId ? "Update Finish" : "Save Finish"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PlatingFinishMasterForm;
