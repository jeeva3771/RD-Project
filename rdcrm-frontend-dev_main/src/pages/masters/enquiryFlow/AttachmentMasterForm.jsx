import React from "react";
import { Select, MenuItem } from "@mui/material";
import ApplicableProductsSelector from "./ApplicableProductsSelector";

const ATTACHMENT_TYPES = [
  { value: "pin_back", label: "Pin Backing (Butterfly clutch, Rubber cap, Magnet)" },
  { value: "badge_fixing", label: "Badge Fixing (Safety pin, Magnet strip, Clip)" },
  { value: "cufflink_closure", label: "Cufflink Closure (Bullet back, Whale back, Swivel)" },
  { value: "medal_hook", label: "Medal Hook / Loop (Ring loop, Clamping, J hook)" },
  { value: "stand_accessory", label: "Stand Accessory (Pole base, Finial, Spreader)" },
  { value: "coaster_backing", label: "Coaster Backing (Cork base, EVA foam, Felt)" },
  { value: "scroll_hardware", label: "Scroll Hardware (Wooden rod, Tassel cord, Finial)" },
  { value: "magnet_hardware", label: "Magnet Hardware (Neodymium, Ferrite sheet)" },
  { value: "other", label: "Other Hardware / Fixings" },
];

const AttachmentMasterForm = ({
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
            {currentId ? "Edit Hardware Attachment" : "Add New Hardware Attachment"}
          </h2>
          <p className="text-xs text-gray-500">
            Configure pins, magnets, clasps, medal hooks, cords, and backing accessories.
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
              Attachment Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name || ""}
              onChange={onInputChange}
              className={`w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 ${
                errors.name ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="e.g. Butterfly clutch, Magnetic clip bar"
            />
            {errors.name && <p className="mt-1 text-[11px] text-red-500">{errors.name}</p>}
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Attachment Type</label>
            <Select
              size="small"
              fullWidth
              name="type"
              value={formData.type || "pin_back"}
              onChange={onInputChange}
              sx={{ borderRadius: "0.75rem", fontSize: "0.75rem" }}
            >
              {ATTACHMENT_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value} sx={{ fontSize: "0.75rem" }}>
                  {t.label}
                </MenuItem>
              ))}
            </Select>
          </div>

          {/* Extra Cost */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Extra Cost (₹)</label>
            <input
              type="number"
              name="extra_cost"
              value={formData.extra_cost ?? 0}
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
            {isSubmitting ? "Saving..." : currentId ? "Update Attachment" : "Save Attachment"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AttachmentMasterForm;
