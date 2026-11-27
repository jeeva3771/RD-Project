import mongoose from "mongoose";

const platingFinishMasterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    code: {
      type: String,
      default: "#D4AF37",
      trim: true,
    },
    applicable_products: [
      {
        type: String,
        trim: true,
      },
    ],
    extra_rate: {
      type: Number,
      default: 0,
      min: 0,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    sort_order: {
      type: Number,
      default: 0,
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

export default mongoose.model("PlatingFinishMaster", platingFinishMasterSchema, "plating_finish_masters");
