import mongoose from "mongoose";

const processMasterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    category: {
      type: String,
      enum: ["print", "engrave", "enamel", "cast", "finish", "other"],
      default: "print",
      trim: true,
    },
    applicable_products: [
      {
        type: String,
        trim: true,
      },
    ],
    base_cost: {
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

export default mongoose.model("ProcessMaster", processMasterSchema, "process_masters");
