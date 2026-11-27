import mongoose from "mongoose";

const rateUnitSchema = new mongoose.Schema(
  {
    
    id: { type: String, required: true, unique: true },

    name: {
      type: String,
      required: true,
      unique: true,
      trim: true
      // Square Inch, Piece, Unit
    },

    symbol: {
      type: String,
      required: true
      // sqin, pc, unit
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

export default mongoose.model("rate_units", rateUnitSchema);
