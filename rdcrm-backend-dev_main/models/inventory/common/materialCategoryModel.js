import mongoose from "mongoose";

const materialCategorySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  is_active: { type: Boolean, default: true },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  created_at: { type: String, required: true },
  updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
  updated_at: { type: String },
});

export default mongoose.model("material_categories", materialCategorySchema);

