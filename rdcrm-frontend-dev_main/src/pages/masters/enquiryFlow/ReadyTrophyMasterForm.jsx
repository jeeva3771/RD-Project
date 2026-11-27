import React from "react";
import { Select, MenuItem } from "@mui/material";
import EmojiHelpTooltip from "./EmojiHelpTooltip";

const ReadyTrophyMasterForm = ({
  formData,
  errors,
  isSubmitting,
  onInputChange,
  onSizesChange,
  onSubmit,
  currentId,
  handleReset,
}) => {
  const sizes = formData.sizes || [];

  const handleAddSize = () => {
    onSizesChange([...sizes, { size: "", rate: "", stock: 0 }]);
  };

  const handleRemoveSize = (index) => {
    const updated = sizes.filter((_, idx) => idx !== index);
    onSizesChange(updated);
  };

  const handleSizeFieldChange = (index, field, value) => {
    const updated = sizes.map((item, idx) => {
      if (idx === index) {
        return { ...item, [field]: value };
      }
      return item;
    });
    onSizesChange(updated);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
      <div className="p-6 border-b border-gray-200 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">
          {currentId ? "Edit Ready Trophy" : "Add Ready Trophy"}
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
        <div className="grid md:grid-cols-5 gap-6 mb-6">
          {/* Trophy Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="code"
              value={formData.code || ""}
              onChange={onInputChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.code ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="e.g. RT-101"
            />
            {errors.code && (
              <p className="mt-1 text-xs text-red-500">{errors.code}</p>
            )}
          </div>

          {/* Trophy Name */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Trophy Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name || ""}
              onChange={onInputChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="e.g. Victory Cup, Gold Star Trophy"
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
              placeholder="e.g. 🏆, 🥇, 🌟"
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

        {/* Dynamic Size & Stock Variants Section */}
        <div className="mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="text-sm font-bold text-gray-800">
                Sizes & Stock Variants
              </h3>
              <p className="text-xs text-gray-500">
                Specify available sizes (inches), selling rate (₹), and in-stock units.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddSize}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer flex items-center gap-1"
            >
              + Add Size Variant
            </button>
          </div>

          {sizes.length === 0 ? (
            <p className="text-xs text-gray-400 py-3 text-center italic bg-white rounded-lg border border-dashed border-gray-300">
              No size variants added yet. Click "+ Add Size Variant" to define sizes (e.g. 8", 10", 12").
            </p>
          ) : (
            <div className="space-y-2">
              {sizes.map((s, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-gray-200"
                >
                  <div className="flex-1">
                    <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
                      Size (inch)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 8"
                      value={s.size}
                      onChange={(e) =>
                        handleSizeFieldChange(idx, "size", e.target.value)
                      }
                      className="w-full px-2.5 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
                      Rate (₹)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 450"
                      value={s.rate}
                      onChange={(e) =>
                        handleSizeFieldChange(idx, "rate", e.target.value)
                      }
                      className="w-full px-2.5 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
                      Stock Units
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 15"
                      value={s.stock}
                      onChange={(e) =>
                        handleSizeFieldChange(idx, "stock", e.target.value)
                      }
                      className="w-full px-2.5 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveSize(idx)}
                    className="mt-4 text-red-500 hover:text-red-700 px-2 py-1 text-sm cursor-pointer"
                    title="Remove variant"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
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
              ? "Update Ready Trophy"
              : "Add Ready Trophy"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReadyTrophyMasterForm;
