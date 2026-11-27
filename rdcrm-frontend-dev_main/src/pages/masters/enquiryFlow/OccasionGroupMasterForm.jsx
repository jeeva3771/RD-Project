import React from "react";
import { Select, MenuItem } from "@mui/material";
import EmojiHelpTooltip from "./EmojiHelpTooltip";

const OccasionGroupMasterForm = ({
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
          {currentId ? "Edit Occasion Group" : "Add Occasion Group"}
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
        <div className="grid md:grid-cols-4 gap-6 mb-4">
          {/* Group Name */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Group Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name || ""}
              onChange={onInputChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="e.g. Corporate, Milestones, Sports & events"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Icon / Emoji */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
              <span>Icon / Emoji</span>
              <EmojiHelpTooltip />
            </label>
            <input
              type="text"
              name="icon"
              value={formData.icon || ""}
              onChange={onInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 🏢, 🎯, 🎉, 🏅, 🪔"
            />
          </div>

          {/* Sort Order */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sort Order
            </label>
            <input
              type="number"
              name="sort_order"
              value={formData.sort_order ?? 0}
              onChange={onInputChange}
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-6 mb-6">
          {/* Description */}
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              type="text"
              name="description"
              value={formData.description || ""}
              onChange={onInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Corporate and business recognition awards"
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
              ? "Update Group"
              : "Add Group"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default OccasionGroupMasterForm;

