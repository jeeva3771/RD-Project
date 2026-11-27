import React from "react";
import { Select, MenuItem } from "@mui/material";
import EmojiHelpTooltip from "./EmojiHelpTooltip";

export const CARRIER_APPLIES_TO = [
  { value: "both", label: "Both (Delivery & Sample)" },
  { value: "delivery", label: "Final Delivery Only" },
  { value: "sample", label: "Sample Delivery Only" },
];

const CarrierMasterForm = ({
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
          {currentId ? "Edit Carrier" : "Add Delivery Carrier"}
        </h2>
        {currentId && (
          <button
            type="button"
            onClick={handleReset}
            className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer font-medium"
          >
            Switch to Create
          </button>
        )}
      </div>

      <form onSubmit={onSubmit} className="p-6">
        <div className="grid md:grid-cols-3 gap-6 mb-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Carrier Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name || ""}
              onChange={onInputChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="e.g. Tempo, Porter, Courier, Our vehicle"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Icon */}
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
              placeholder="e.g. 🚚, 🛵, 📮, ✈️, 🚐, 🤝, 📷"
            />
          </div>

          {/* Has Charges (Freight Simulator) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Freight Charges Apply?
            </label>
            <Select
              name="has_charges"
              value={formData.has_charges === true || formData.has_charges === "true"}
              onChange={onInputChange}
              className="w-full"
              size="small"
            >
              <MenuItem value={true}>Yes (Requires Freight / GST simulation)</MenuItem>
              <MenuItem value={false}>No (Free / Client handles freight)</MenuItem>
            </Select>
            <p className="mt-1 text-[11px] text-gray-400">
              When Yes, displays the freight charge calculator and approval flow.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Applies To */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Applies To
            </label>
            <Select
              name="applies_to"
              value={formData.applies_to || "both"}
              onChange={onInputChange}
              className="w-full"
              size="small"
            >
              {CARRIER_APPLIES_TO.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
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
              ? "Update Carrier"
              : "Add Carrier"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CarrierMasterForm;
