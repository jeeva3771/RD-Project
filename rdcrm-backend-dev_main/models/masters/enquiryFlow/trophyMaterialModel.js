import mongoose from "mongoose";

const trophyMaterialSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    base_rate: { type: Number, required: true, default: 0 }, // e.g. 95, 290
    unit: { type: String, default: "inch" },
    is_active: { type: Boolean, default: true },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
  },
  { timestamps: true }
);

export default mongoose.model("TrophyMaterial", trophyMaterialSchema, "trophy_materials");
