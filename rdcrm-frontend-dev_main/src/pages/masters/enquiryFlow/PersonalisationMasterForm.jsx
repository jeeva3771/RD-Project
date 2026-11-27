import React from "react";
import { Select, MenuItem } from "@mui/material";

const PersonalisationMasterForm = ({
  formData,
  errors,
  isSubmitting,
  onInputChange,
  onSubmit,
  currentId,
  handleReset,
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
      <div className="p-6 border-b border-gray-200 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">
          {currentId ? "Edit Personalisation Option" : "Add Personalisation Option"}
        </h2>
        {currentId && (
          <button
            type="button"
            onClick={handleReset}
            className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer"
          >
            Switch to Create
          </button>
        )}
      </div>

      <form onSubmit={onSubmit} className="p-6">
        <div className="grid md:grid-cols-3 gap-6 mb-6">
          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Label / Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="label"
              value={formData.label || ""}
              onChange={onInputChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.label ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="e.g. Printed sticker, Metal engraved plate"
            />
            {errors.label && (
              <p className="mt-1 text-xs text-red-500">{errors.label}</p>
            )}
          </div>

          {/* Extra Cost */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Extra Cost (₹)
            </label>
            <input
              type="number"
              name="extra_cost"
              value={formData.extra_cost ?? 0}
              onChange={onInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 0, 30, 60, 90"
              min="0"
              step="any"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <Select
              name="is_active"
              value={formData.is_active ?? true}
              onChange={onInputChange}
              displayEmpty
              className="w-full"
              size="small"
            >
              <MenuItem value={true}>Active</MenuItem>
              <MenuItem value={false}>Inactive</MenuItem>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg cursor-pointer ${
              isSubmitting ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {isSubmitting
              ? "Saving..."
              : currentId
              ? "Update Option"
              : "Add Option"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PersonalisationMasterForm;
