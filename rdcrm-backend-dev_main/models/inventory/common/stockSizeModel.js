import mongoose from "mongoose";

const stockSizeSchema = new mongoose.Schema(
  {
    
    id: { type: String, required: true, unique: true },

    size: {
      type: String,
      required: true,
      trim: true
      // ex: "24x48"
    },

    width: {
      type: Number,
      required: true
      // 24
    },

    height: {
      type: Number,
      required: true
      // 48
    },

    unit: {
      type: String,
      default: "inch"
    },

    is_active: {
      type: Boolean,
      default: true
    },

    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true
    },

    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users"
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model("stock_sizes", stockSizeSchema);
