import mongoose from "mongoose";

const trophyTypeMasterSchema = new mongoose.Schema(
  {
    category: { type: String, required: true, trim: true }, // Classic, Themed trophies, Sports · outdoor, Sports · indoor
    name: { type: String, required: true, trim: true }, // Trophy, Cup, Cricket themed trophy, etc.
    label: { type: String, trim: true }, // Display label (e.g. Cricket, Football)
    icon: { type: String, default: "🏆" },
    is_active: { type: Boolean, default: true },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
  },
  { timestamps: true }
);

trophyTypeMasterSchema.index({ category: 1, name: 1 }, { unique: true });

export default mongoose.model("TrophyTypeMaster", trophyTypeMasterSchema, "trophy_type_masters");
