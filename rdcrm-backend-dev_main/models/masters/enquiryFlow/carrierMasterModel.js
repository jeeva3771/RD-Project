import mongoose from "mongoose";

const carrierMasterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    icon: {
      type: String,
      default: "🚚",
      trim: true,
    },
    has_charges: {
      type: Boolean,
      default: false,
    },
    applies_to: {
      type: String,
      enum: ["both", "delivery", "sample"],
      default: "both",
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
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null,
    },
  },
  { timestamps: true }
);

carrierMasterSchema.index({ is_active: 1, applies_to: 1 });

export default mongoose.model("CarrierMaster", carrierMasterSchema, "carrier_masters");
