import mongoose from "mongoose";

/**
 * Tax Master Schema
 * Stored in masters/tax_masters collection.
 * Manages GST, TDS, TCS, and other statutory tax percentages and active statuses.
 */
const taxMasterSchema = new mongoose.Schema(
  {
    tax_name: {
      type: String,
      required: [true, "Tax name is required"],
      trim: true,
    },
    tax_type: {
      type: String,
      required: [true, "Tax type is required"],
      trim: true,
      enum: ["GST", "TDS", "TCS", "Cess", "Other"],
      default: "GST",
    },
    tax_rate: {
      type: Number,
      required: [true, "Tax rate percentage is required"],
      min: [0, "Tax rate cannot be negative"],
      default: 0,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null,
    },
    created_by_name: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

// Compound index for unique tax name per type
taxMasterSchema.index({ tax_name: 1, tax_type: 1 }, { unique: false });

export default mongoose.model("tax_masters", taxMasterSchema);
