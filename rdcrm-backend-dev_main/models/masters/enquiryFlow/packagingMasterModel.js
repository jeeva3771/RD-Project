import mongoose from "mongoose";

const packagingMasterSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      trim: true,
      enum: [
        "outer_box",
        "protection",
        "label",
        "addon",
        "mode",
        "box_colour",
        "pouch",
        "tube",
        "set_box",
        "polybag",
      ],
    },
    applicable_products: [
      {
        type: String,
        trim: true,
      },
    ],
    name: {
      type: String,
      required: true,
      trim: true,
    },
    sub_text: {
      type: String,
      default: "",
      trim: true,
    },
    icon: {
      type: String,
      default: "📦",
      trim: true,
    },
    extra_cost: {
      type: Number,
      default: 0,
      min: 0,
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

packagingMasterSchema.index({ category: 1, name: 1 }, { unique: true });

export default mongoose.model("PackagingMaster", packagingMasterSchema, "packaging_masters");
